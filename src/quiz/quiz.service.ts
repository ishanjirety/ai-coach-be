import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { QuizTokenService } from '../common/crypto/quiz-token.service.js';
import type { SyllabusTopic } from '../syllabus/syllabus.data.js';
import { SyllabusService } from '../syllabus/syllabus.service.js';
import { LlmTaskFailedException } from '../llm/llm.service.js';
import { planQuestionBatch } from './adaptive-engine.js';
import { AnswerEvaluatorService } from './answer-evaluator.service.js';
import { QuestionGeneratorService } from './question-generator.service.js';
import type {
  EvaluateRequest,
  EvaluateResponse,
  PublicQuestion,
  QuestionsRequest,
  QuestionsResponse,
  ReportRequest,
  ReportResponse,
} from './quiz.contract.js';
import {
  toStem,
  type PrivateQuestion,
  type QuestionResult,
} from './quiz-tokens.js';
import { ReportGeneratorService } from './report-generator.service.js';

/** Orchestrates the stateless quiz: opens tokens, plans, delegates, seals. */
@Injectable()
export class QuizService {
  constructor(
    private readonly syllabus: SyllabusService,
    private readonly tokens: QuizTokenService,
    private readonly generator: QuestionGeneratorService,
    private readonly evaluator: AnswerEvaluatorService,
    private readonly reports: ReportGeneratorService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(QuizService.name);
  }

  /**
   * A batch of up to `count` new questions, planned together and generated
   * in parallel. Slots that fail are dropped; only if all fail is it a 502.
   */
  async questions(
    request: QuestionsRequest,
    abortSignal?: AbortSignal,
  ): Promise<QuestionsResponse> {
    const startedAt = Date.now();
    const topic = this.syllabus.getTopicOrThrow(request.topicId);
    const focus = [...new Set(request.focusConceptIds ?? [])];
    this.syllabus.assertConceptsInTopic(topic, focus);

    const results = this.openResults(topic, request.resultTokens);
    const issued = this.openIssued(
      topic,
      request.issuedQuestionTokens,
      new Set(results.map((r) => r.questionId)),
    );

    const used = results.length + issued.length;
    const remaining = request.totalQuestions - used;
    if (remaining <= 0) {
      throw new ConflictException(
        `The quiz is complete: all ${request.totalQuestions} questions have been issued (${results.length} graded).`,
      );
    }
    const count = Math.min(request.count, remaining);

    const pool = focus.length > 0 ? focus : topic.concepts.map((c) => c.id);
    const slots = planQuestionBatch({
      conceptPool: pool,
      chosen: request.difficulty,
      results,
      issuedConceptIds: issued.map((q) => q.conceptIds),
      count,
    });
    const previousStems = [
      ...results.map((r) => r.stem),
      ...issued.map((q) => toStem(q.prompt)),
    ];

    this.logger.info(
      {
        topicId: topic.id,
        chosenDifficulty: request.difficulty,
        graded: results.length,
        issued: issued.length,
        requested: request.count,
        planned: count,
        focus: focus.length > 0 ? focus : undefined,
        slots,
      },
      'Planned question batch',
    );

    const settled = await Promise.allSettled(
      slots.map((slot) =>
        this.generator.generate({
          topic,
          concept: this.syllabus.findConcept(slot.conceptId)!,
          difficulty: slot.difficulty,
          type: slot.type,
          previousStems,
          abortSignal,
        }),
      ),
    );

    const generated: PrivateQuestion[] = [];
    const failures: unknown[] = [];
    settled.forEach((outcome, i) => {
      const slot = slots[i];
      const fields = {
        slot: i,
        position: slot.position,
        conceptId: slot.conceptId,
        difficulty: slot.difficulty,
        questionType: slot.type,
      };
      if (outcome.status === 'fulfilled') {
        generated.push(outcome.value);
        this.logger.info(
          { ...fields, questionId: outcome.value.id, outcome: 'ok' },
          'Question slot finished',
        );
      } else {
        failures.push(outcome.reason);
        this.logger.warn(
          { ...fields, err: outcome.reason, outcome: 'failed' },
          'Question slot failed',
        );
      }
    });

    this.logger.info(
      {
        topicId: topic.id,
        requested: request.count,
        planned: count,
        returned: generated.length,
        durationMs: Date.now() - startedAt,
      },
      'Question batch finished',
    );

    if (generated.length === 0) {
      throw (
        failures.find((e) => e instanceof LlmTaskFailedException) ?? failures[0]
      );
    }

    return {
      // In plan order, renumbered so indexes stay contiguous.
      questions: generated.map((question, i) => ({
        question: toPublicQuestion(question),
        questionToken: this.tokens.seal('question', question),
        index: used + i + 1,
      })),
      total: request.totalQuestions,
    };
  }

  async evaluate(
    request: EvaluateRequest,
    abortSignal?: AbortSignal,
  ): Promise<EvaluateResponse> {
    const question = this.tokens.open<PrivateQuestion>(
      'question',
      request.questionToken,
      'questionToken',
    );
    const evaluation = await this.evaluator.evaluate(
      question,
      request.answer,
      abortSignal,
    );

    const result: QuestionResult = {
      questionId: question.id,
      topicId: question.topicId,
      type: question.type,
      conceptIds: question.conceptIds,
      difficulty: question.difficulty,
      verdict: evaluation.verdict,
      score: evaluation.score,
      stem: toStem(question.prompt),
    };
    this.logger.info(
      {
        questionId: question.id,
        conceptId: question.conceptIds[0],
        difficulty: question.difficulty,
        questionType: question.type,
        verdict: evaluation.verdict,
        score: evaluation.score,
      },
      'Answer evaluated',
    );

    return { evaluation, resultToken: this.tokens.seal('result', result) };
  }

  async report(
    request: ReportRequest,
    abortSignal?: AbortSignal,
  ): Promise<ReportResponse> {
    const topic = this.syllabus.getTopicOrThrow(request.topicId);
    const results = this.openResults(topic, request.resultTokens);
    return this.reports.generate({
      topic,
      difficulty: request.difficulty,
      results,
      abortSignal,
    });
  }

  /**
   * Opens result tokens, checks they belong to the topic, and drops repeats
   * of the same question (first one wins), so a score can't be inflated by
   * resubmitting one token.
   */
  private openResults(
    topic: SyllabusTopic,
    tokens: readonly string[],
  ): QuestionResult[] {
    const seen = new Set<string>();
    const results: QuestionResult[] = [];

    tokens.forEach((token, index) => {
      const result = this.tokens.open<QuestionResult>(
        'result',
        token,
        `resultTokens[${index}]`,
      );
      if (result.topicId !== topic.id) {
        throw new BadRequestException(
          `resultTokens[${index}] belongs to a different topic than topicId`,
        );
      }
      if (seen.has(result.questionId)) {
        this.logger.warn(
          { questionId: result.questionId, index },
          'Duplicate result token ignored',
        );
        return;
      }
      seen.add(result.questionId);
      results.push(result);
    });
    return results;
  }

  /**
   * Opens issued (not yet graded) question tokens. Questions already graded
   * are dropped (a result beats an issued token), as are repeats.
   */
  private openIssued(
    topic: SyllabusTopic,
    tokens: readonly string[],
    gradedIds: ReadonlySet<string>,
  ): PrivateQuestion[] {
    const seen = new Set(gradedIds);
    const issued: PrivateQuestion[] = [];

    tokens.forEach((token, index) => {
      const question = this.tokens.open<PrivateQuestion>(
        'question',
        token,
        `issuedQuestionTokens[${index}]`,
      );
      if (question.topicId !== topic.id) {
        throw new BadRequestException(
          `issuedQuestionTokens[${index}] belongs to a different topic than topicId`,
        );
      }
      if (seen.has(question.id)) return;
      seen.add(question.id);
      issued.push(question);
    });
    return issued;
  }
}

export function toPublicQuestion(question: PrivateQuestion): PublicQuestion {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    ...(question.options
      ? { options: question.options.map(({ id, text }) => ({ id, text })) }
      : {}),
    conceptIds: question.conceptIds,
    difficulty: question.difficulty,
  };
}
