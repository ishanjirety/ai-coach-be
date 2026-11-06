import { BadRequestException, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LlmService } from '../llm/llm.service.js';
import { SyllabusService } from '../syllabus/syllabus.service.js';
import type { Answer, Evaluation } from './quiz.contract.js';
import type { PrivateQuestion } from './quiz-tokens.js';
import {
  ANSWER_EVALUATOR_INSTRUCTIONS,
  buildAnswerEvaluatorPrompt,
  explanationGradeSchema,
  type ExplanationGrade,
} from './prompts/answer-evaluator.prompt.js';

/** Score bands that keep the LLM's 0–1 score consistent with its verdict. */
const VERDICT_BANDS = {
  correct: [0.8, 1],
  partial: [0.3, 0.79],
  incorrect: [0, 0.29],
} as const;

/**
 * Grades answers. MCQs and skips are graded in code; only explanation
 * answers go to the LLM, graded against the sealed rubric.
 */
@Injectable()
export class AnswerEvaluatorService {
  constructor(
    private readonly llm: LlmService,
    private readonly syllabus: SyllabusService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnswerEvaluatorService.name);
  }

  async evaluate(
    question: PrivateQuestion,
    answer: Answer,
    abortSignal?: AbortSignal,
  ): Promise<Evaluation> {
    const correctOptionId =
      question.type === 'mcq'
        ? { correctOptionId: question.correctOptionId }
        : {};

    if ('skipped' in answer) {
      return {
        verdict: 'skipped',
        score: 0,
        feedback:
          'You skipped this one. Read the reference answer below; the coach can walk you through it.',
        ...correctOptionId,
        referenceAnswer: question.referenceAnswer,
        missedPoints: question.rubric,
      };
    }

    if (question.type === 'mcq') {
      if (!('optionId' in answer)) {
        throw new BadRequestException(
          'This is a multiple-choice question: answer with { optionId }.',
        );
      }
      return this.gradeMcq(question, answer.optionId);
    }

    if (!('text' in answer)) {
      throw new BadRequestException(
        'This is an explanation question: answer with { text }.',
      );
    }
    return this.gradeExplanation(question, answer.text, abortSignal);
  }

  private gradeMcq(question: PrivateQuestion, optionId: string): Evaluation {
    const options = question.options ?? [];
    if (!options.some((o) => o.id === optionId)) {
      throw new BadRequestException(
        `Unknown optionId "${optionId}". Expected one of: ${options.map((o) => o.id).join(', ')}.`,
      );
    }
    const correctId = question.correctOptionId ?? '';
    const isCorrect = optionId === correctId;
    const explain = (id: string) => question.optionExplanations?.[id] ?? '';

    const feedback = isCorrect
      ? `Correct! ${explain(correctId)}`
      : `Not quite. ${explain(optionId)} The correct answer is ${correctId.toUpperCase()}: ${explain(correctId)}`;

    return {
      verdict: isCorrect ? 'correct' : 'incorrect',
      score: isCorrect ? 1 : 0,
      feedback: feedback.replace(/\s+/g, ' ').trim(),
      correctOptionId: correctId,
      referenceAnswer: question.referenceAnswer,
      missedPoints: isCorrect ? [] : question.rubric,
    };
  }

  private async gradeExplanation(
    question: PrivateQuestion,
    text: string,
    abortSignal?: AbortSignal,
  ): Promise<Evaluation> {
    const conceptName = question.conceptIds
      .map((id) => this.syllabus.findConcept(id)?.name ?? id)
      .join(', ');

    const { output } = await this.llm.runStructured('answer-evaluate', {
      schema: explanationGradeSchema,
      instructions: ANSWER_EVALUATOR_INSTRUCTIONS,
      prompt: buildAnswerEvaluatorPrompt({
        conceptName,
        question: question.prompt,
        referenceAnswer: question.referenceAnswer,
        rubric: question.rubric,
        answer: text,
      }),
      context: {
        questionId: question.id,
        conceptId: question.conceptIds[0],
        difficulty: question.difficulty,
        answerChars: text.length,
      },
      semanticCheck: (grade) =>
        Number.isFinite(grade.score) && grade.feedback.trim().length > 0
          ? null
          : 'missing score or feedback',
      abortSignal,
    });

    const score = bandScore(output);
    if (score !== output.score) {
      this.logger.debug(
        {
          questionId: question.id,
          verdict: output.verdict,
          raw: output.score,
          score,
        },
        'Adjusted LLM score into its verdict band',
      );
    }

    return {
      verdict: output.verdict,
      score,
      feedback: output.feedback.trim(),
      referenceAnswer: question.referenceAnswer,
      missedPoints: output.missedPoints.map((p) => p.trim()).filter(Boolean),
    };
  }
}

/** Clamps the score into the band of the verdict, rounded to 2 decimals. */
export function bandScore(
  grade: Pick<ExplanationGrade, 'verdict' | 'score'>,
): number {
  const [min, max] = VERDICT_BANDS[grade.verdict];
  const raw = Number.isFinite(grade.score) ? grade.score : min;
  return Math.round(Math.min(max, Math.max(min, raw)) * 100) / 100;
}
