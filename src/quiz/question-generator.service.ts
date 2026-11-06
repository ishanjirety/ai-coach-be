import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LlmService, LlmTaskFailedException } from '../llm/llm.service.js';
import type {
  SyllabusConcept,
  SyllabusTopic,
} from '../syllabus/syllabus.data.js';
import type { Difficulty, QuestionType } from './quiz.contract.js';
import type { PrivateQuestion } from './quiz-tokens.js';
import {
  buildQuestionGeneratorPrompt,
  generatedExplanationSchema,
  generatedMcqSchema,
  QUESTION_GENERATOR_INSTRUCTIONS,
} from './prompts/question-generator.prompt.js';
import {
  buildExplanationValidatorPrompt,
  buildMcqValidatorPrompt,
  EXPLANATION_VALIDATOR_INSTRUCTIONS,
  explanationValidationSchema,
  MCQ_VALIDATOR_INSTRUCTIONS,
  mcqValidationSchema,
} from './prompts/question-validator.prompt.js';
import {
  checkExplanationDraft,
  checkMcqDraft,
  decideExplanationValidation,
  decideMcqValidation,
  describeRejection,
  HINT_COUNT,
  shuffleMcq,
  type ValidationDecision,
} from './question-checks.js';

export interface GenerateQuestionParams {
  topic: SyllabusTopic;
  concept: SyllabusConcept;
  difficulty: Difficulty;
  type: QuestionType;
  previousStems: string[];
  abortSignal?: AbortSignal;
}

type ValidationOutcome =
  | { status: 'accepted'; decision: ValidationDecision }
  | { status: 'rejected'; decision: ValidationDecision; feedback: string }
  | { status: 'skipped' };

/** Generation rounds: the first draft plus one regeneration with feedback. */
const MAX_ROUNDS = 2;

/**
 * Writes one question for an exact concept, difficulty and type:
 *   generate (schema + semantic check, retried by LlmService)
 *   → blind-solve validation by a different model family
 *   → on rejection, regenerate once with the validator's feedback.
 */
@Injectable()
export class QuestionGeneratorService {
  constructor(
    private readonly llm: LlmService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(QuestionGeneratorService.name);
  }

  async generate(params: GenerateQuestionParams): Promise<PrivateQuestion> {
    const context = {
      topicId: params.topic.id,
      conceptId: params.concept.id,
      difficulty: params.difficulty,
      questionType: params.type,
    };
    let feedback: string | undefined;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const question = await this.draft(
        params,
        { ...context, round },
        feedback,
      );
      const validation = await this.validate(question, params, {
        ...context,
        round,
        questionId: question.id,
      });

      if (validation.status !== 'rejected') return question;
      feedback = validation.feedback;
    }

    this.logger.error(
      { ...context, rounds: MAX_ROUNDS },
      'Question rejected by the validator on every round',
    );
    throw new LlmTaskFailedException('question-validate');
  }

  private async draft(
    params: GenerateQuestionParams,
    context: Record<string, unknown>,
    feedback: string | undefined,
  ): Promise<PrivateQuestion> {
    const prompt = buildQuestionGeneratorPrompt({ ...params, feedback });
    const base = {
      id: randomUUID(),
      topicId: params.topic.id,
      difficulty: params.difficulty,
      conceptIds: [params.concept.id],
    };

    if (params.type === 'mcq') {
      const { output } = await this.llm.runStructured('question-generate', {
        schema: generatedMcqSchema,
        instructions: QUESTION_GENERATOR_INSTRUCTIONS,
        prompt,
        context,
        semanticCheck: checkMcqDraft,
        abortSignal: params.abortSignal,
      });
      const shuffled = shuffleMcq(output);
      return {
        ...base,
        type: 'mcq',
        prompt: output.prompt.trim(),
        options: shuffled.options,
        correctOptionId: shuffled.correctOptionId,
        optionExplanations: shuffled.optionExplanations,
        referenceAnswer: output.referenceAnswer.trim(),
        rubric: output.keyPoints.map((p) => p.trim()).filter(Boolean),
        hints: output.hints.slice(0, HINT_COUNT).map((h) => h.trim()),
      };
    }

    const { output } = await this.llm.runStructured('question-generate', {
      schema: generatedExplanationSchema,
      instructions: QUESTION_GENERATOR_INSTRUCTIONS,
      prompt,
      context,
      semanticCheck: checkExplanationDraft,
      abortSignal: params.abortSignal,
    });
    return {
      ...base,
      type: 'explanation',
      prompt: output.prompt.trim(),
      referenceAnswer: output.referenceAnswer.trim(),
      rubric: output.keyPoints.map((p) => p.trim()).filter(Boolean),
      hints: output.hints.slice(0, HINT_COUNT).map((h) => h.trim()),
    };
  }

  /**
   * Blind-solve validation. Fails open: if the validator's whole chain is
   * down, the question is served and a warning logged.
   */
  private async validate(
    question: PrivateQuestion,
    params: GenerateQuestionParams,
    context: Record<string, unknown>,
  ): Promise<ValidationOutcome> {
    const ctx = {
      topic: params.topic,
      concept: params.concept,
      difficulty: params.difficulty,
    };

    let decision: ValidationDecision;
    let chosenOptionText: string | undefined;
    try {
      if (question.type === 'mcq') {
        const options = question.options ?? [];
        const { output } = await this.llm.runStructured('question-validate', {
          schema: mcqValidationSchema,
          instructions: MCQ_VALIDATOR_INSTRUCTIONS,
          // No answer key here: the validator solves it independently.
          prompt: buildMcqValidatorPrompt(ctx, {
            prompt: question.prompt,
            options,
          }),
          context,
          abortSignal: params.abortSignal,
        });
        decision = decideMcqValidation(output, question.correctOptionId ?? '');
        chosenOptionText = options.find(
          (o) => o.id === output.chosenOptionId.trim().toLowerCase(),
        )?.text;
        this.logger.debug(
          { ...context, validation: output },
          'Validator output',
        );
      } else {
        const { output } = await this.llm.runStructured('question-validate', {
          schema: explanationValidationSchema,
          instructions: EXPLANATION_VALIDATOR_INSTRUCTIONS,
          prompt: buildExplanationValidatorPrompt(ctx, question),
          context,
          abortSignal: params.abortSignal,
        });
        decision = decideExplanationValidation(output);
        this.logger.debug(
          { ...context, validation: output },
          'Validator output',
        );
      }
    } catch (error) {
      if (error instanceof LlmTaskFailedException) {
        this.logger.warn(
          context,
          'question validation skipped: validator unavailable, serving the question unvalidated',
        );
        return { status: 'skipped' };
      }
      throw error;
    }

    const logFields = {
      ...context,
      answerMatched: decision.answerMatched,
      issueKinds: decision.blockingIssues.map((i) => i.kind),
    };
    if (decision.accepted) {
      this.logger.info(
        { ...logFields, outcome: 'accepted' },
        'Question validation',
      );
      return { status: 'accepted', decision };
    }
    this.logger.warn(
      { ...logFields, outcome: 'rejected' },
      'Question validation',
    );
    return {
      status: 'rejected',
      decision,
      feedback: describeRejection(decision, chosenOptionText),
    };
  }
}
