import { BadRequestException, Injectable } from '@nestjs/common';
import {
  convertToModelMessages,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { PinoLogger } from 'nestjs-pino';
import { QuizTokenService } from '../common/crypto/quiz-token.service.js';
import { LlmService } from '../llm/llm.service.js';
import { SyllabusService } from '../syllabus/syllabus.service.js';
import { buildCoachTools } from './coach.tools.js';
import { buildCoachPrompt } from './prompts/coach.prompt.js';
import type { ChatRequest } from './quiz.contract.js';
import type { PrivateQuestion } from './quiz-tokens.js';

/** Tool call → follow-up text needs 2 steps; 3 allows one more tool round. */
const MAX_STEPS = 3;

@Injectable()
export class CoachChatService {
  constructor(
    private readonly llm: LlmService,
    private readonly syllabus: SyllabusService,
    private readonly tokens: QuizTokenService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CoachChatService.name);
  }

  /**
   * Validates the request (throws 400 before anything is streamed) and
   * returns the UI message stream. Streaming uses OpenRouter-native fallback
   * only: a model can't be swapped mid-stream.
   */
  async stream(
    request: ChatRequest,
    abortSignal: AbortSignal,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const topic = this.syllabus.getTopicOrThrow(request.topicId);
    const question = request.questionToken
      ? this.tokens.open<PrivateQuestion>(
          'question',
          request.questionToken,
          'questionToken',
        )
      : undefined;
    if (question && question.topicId !== topic.id) {
      throw new BadRequestException(
        'questionToken belongs to a different topic than topicId',
      );
    }

    const messages = request.messages as UIMessage[];
    const tools = buildCoachTools({ topic, question });
    const instructions = buildCoachPrompt({
      topic,
      question,
      answered: request.answered,
    });

    const plan = this.llm.for('coach-chat');
    const startedAt = Date.now();
    const base = {
      task: plan.task,
      primary: plan.primary,
      fallbacks: plan.fallbacks,
      attempt: 1,
      topicId: topic.id,
      questionId: question?.id,
      conceptId: question?.conceptIds[0],
      difficulty: question?.difficulty,
      answered: request.answered,
      messageCount: messages.length,
    };

    this.logger.info(base, 'Coach chat stream started');
    this.logger.debug({ ...base, instructions, messages }, 'LLM prompt');

    const result = streamText({
      ...plan.settings,
      instructions,
      messages: await convertToModelMessages(messages, {
        tools,
        ignoreIncompleteToolCalls: true,
      }),
      tools,
      stopWhen: isStepCount(MAX_STEPS),
      abortSignal,
      onEnd: (event) => {
        this.logger.info(
          {
            ...base,
            ...this.llm.describeOutcome(plan, {
              response: event.response,
              usage: event.totalUsage,
              providerMetadata: event.providerMetadata,
            }),
            steps: event.steps.length,
            toolCalls: event.steps.flatMap((s) =>
              s.toolCalls.map((c) => c.toolName),
            ),
            finishReason: event.finishReason,
            durationMs: Date.now() - startedAt,
            outcome: 'ok',
          },
          'LLM call finished',
        );
        this.logger.debug({ ...base, text: event.text }, 'LLM output');
      },
      onAbort: () => {
        this.logger.warn(
          { ...base, durationMs: Date.now() - startedAt, outcome: 'aborted' },
          'LLM call aborted by client',
        );
      },
      onError: ({ error }) => {
        this.logger.error(
          {
            ...base,
            err: error,
            durationMs: Date.now() - startedAt,
            outcome: 'error',
          },
          'LLM call failed',
        );
      },
    });

    return toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      // Sent to the client; keep provider internals out of it.
      onError: () => 'The coach ran into a problem. Please try again.',
    });
  }
}
