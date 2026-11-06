import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  createOpenRouter,
  type OpenRouterProvider,
} from '@openrouter/ai-sdk-provider';
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type JSONValue,
  type LanguageModel,
  type LanguageModelUsage,
  type ProviderMetadata,
} from 'ai';
import { PinoLogger } from 'nestjs-pino';
import type { ZodType } from 'zod';
import { AppConfigService } from '../config/app-config.service.js';
import {
  chainAcceptsTemperature,
  LLM_TASKS,
  rotateChain,
  type LlmTask,
} from './llm-tasks.js';

export const COACH_UNAVAILABLE_MESSAGE = 'Coach unavailable, please try again';

/**
 * A structured task failed on every attempt. It is a 502 for the client, but
 * callers can catch it to degrade gracefully (e.g. skip question validation).
 */
export class LlmTaskFailedException extends BadGatewayException {
  constructor(readonly task: LlmTask) {
    super(COACH_UNAVAILABLE_MESSAGE);
  }
}

/** Settings to spread into `generateText` / `streamText` for one attempt. */
export interface LlmCallSettings {
  model: LanguageModel;
  temperature?: number;
  maxOutputTokens: number;
  maxRetries: number;
  timeout?: number;
  providerOptions: { openrouter: Record<string, JSONValue> };
}

export interface LlmCallPlan {
  task: LlmTask;
  /** The model asked for first on this attempt. */
  primary: string;
  /** What OpenRouter may switch to server-side. */
  fallbacks: string[];
  settings: LlmCallSettings;
}

/** Log fields that describe how a finished call went. */
export interface LlmCallOutcomeFields {
  servedBy: string | undefined;
  fallbackUsed: boolean;
  usage: { input?: number; output?: number; total?: number };
  cost?: number;
}

export interface StructuredRequest<T> {
  schema: ZodType<T>;
  instructions: string;
  prompt: string;
  /** Extra fields for the log lines, e.g. conceptId, difficulty. */
  context?: Record<string, unknown>;
  /** Returns a reason when the parsed output is unusable, or null if fine. */
  semanticCheck?: (output: T) => string | null;
  abortSignal?: AbortSignal;
}

export interface StructuredResult<T> {
  output: T;
  servedBy: string | undefined;
  attempt: number;
}

type AttemptOutcome =
  'ok' | 'invalid-output' | 'rejected' | 'timeout' | 'aborted' | 'error';

class SemanticCheckError extends Error {}

/**
 * The only way the app talks to a model. Services ask for a *task*, never a
 * model id; the task decides the model chain, temperature and timeout.
 *
 * Two layers of fallback:
 *  1. OpenRouter-native: every call sends the primary plus a `models` list,
 *     so OpenRouter switches model server-side on outages, rate limits or
 *     provider errors.
 *  2. App-level (structured tasks only): on an error, a timeout, an invalid
 *     output or a failed semantic check, retry once with the chain rotated so
 *     a different model goes first. Then a 502.
 */
@Injectable()
export class LlmService {
  private readonly provider: OpenRouterProvider;
  private readonly chains: Record<LlmTask, readonly string[]>;

  constructor(
    config: AppConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LlmService.name);

    this.provider = createOpenRouter({
      apiKey: config.get('OPENROUTER_API_KEY'),
      baseURL: config.get('OPENROUTER_BASE_URL'),
      appName: config.get('OPENROUTER_APP_NAME'),
      appUrl: config.get('OPENROUTER_APP_URL'),
    });

    const chains = {} as Record<LlmTask, readonly string[]>;
    for (const [task, taskConfig] of Object.entries(LLM_TASKS) as [
      LlmTask,
      (typeof LLM_TASKS)[LlmTask],
    ][]) {
      const override = config.get(taskConfig.envKey) as string[] | undefined;
      chains[task] = override ?? taskConfig.models;
    }
    this.chains = chains;

    this.logger.info({ chains }, 'OpenRouter provider initialised');
  }

  /** The model chain for a task: primary first. */
  chain(task: LlmTask): readonly string[] {
    return this.chains[task];
  }

  /**
   * Call settings for one attempt of a task. `attempt` 2+ rotates the chain
   * so a different model is asked first.
   */
  for(task: LlmTask, attempt = 1): LlmCallPlan {
    const chain = rotateChain(this.chains[task], attempt - 1);
    const [primary, ...fallbacks] = chain;
    const { temperature, maxOutputTokens, timeoutMs } = LLM_TASKS[task];
    return {
      task,
      primary,
      fallbacks,
      settings: {
        model: this.createModel(primary),
        ...(chainAcceptsTemperature(chain) ? { temperature } : {}),
        maxOutputTokens,
        // One SDK-level retry for transient network errors; app-level retries
        // happen in runStructured, so the two don't multiply much.
        maxRetries: 1,
        ...(timeoutMs ? { timeout: timeoutMs } : {}),
        providerOptions: {
          openrouter: {
            ...(fallbacks.length > 0 ? { models: fallbacks } : {}),
            provider: { require_parameters: true, allow_fallbacks: true },
            usage: { include: true },
          },
        },
      },
    };
  }

  /** Builds the AI SDK model for an OpenRouter slug. Tests replace this. */
  createModel(modelId: string): LanguageModel {
    return this.provider.chat(modelId);
  }

  /** Extracts what to log from a finished call (generate or stream). */
  describeOutcome(
    plan: LlmCallPlan,
    result: {
      response?: { modelId?: string };
      usage?: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
    },
  ): LlmCallOutcomeFields {
    const servedBy = result.response?.modelId;
    const openrouterUsage = (
      result.providerMetadata?.openrouter as
        { usage?: { cost?: unknown } } | undefined
    )?.usage;
    const cost =
      typeof openrouterUsage?.cost === 'number'
        ? openrouterUsage.cost
        : undefined;
    return {
      servedBy,
      fallbackUsed:
        servedBy !== undefined &&
        servedBy !== plan.primary &&
        !servedBy.startsWith(`${plan.primary}-`),
      usage: {
        input: result.usage?.inputTokens,
        output: result.usage?.outputTokens,
        total: result.usage?.totalTokens,
      },
      ...(cost !== undefined ? { cost } : {}),
    };
  }

  /**
   * Structured output with validation and one rotated retry. Throws
   * LlmTaskFailedException (502) when both attempts fail.
   */
  async runStructured<T>(
    task: LlmTask,
    request: StructuredRequest<T>,
  ): Promise<StructuredResult<T>> {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const plan = this.for(task, attempt);
      const startedAt = Date.now();
      const base = {
        task,
        primary: plan.primary,
        fallbacks: plan.fallbacks,
        attempt,
        ...request.context,
      };

      this.logger.debug(
        { ...base, instructions: request.instructions, prompt: request.prompt },
        'LLM prompt',
      );

      try {
        const result = await generateText({
          ...plan.settings,
          instructions: request.instructions,
          prompt: request.prompt,
          output: Output.object({ schema: request.schema }),
          abortSignal: request.abortSignal,
        });
        const outcome = this.describeOutcome(plan, result);
        const output = result.output;

        const reason = request.semanticCheck?.(output) ?? null;
        if (reason !== null) {
          this.logger.debug({ ...base, output }, 'LLM output (rejected)');
          throw new SemanticCheckError(reason);
        }

        this.logger.info(
          {
            ...base,
            ...outcome,
            durationMs: Date.now() - startedAt,
            outcome: 'ok' satisfies AttemptOutcome,
          },
          'LLM call finished',
        );
        this.logger.debug({ ...base, output }, 'LLM output');
        return { output, servedBy: outcome.servedBy, attempt };
      } catch (error) {
        const outcome = this.classify(error, request.abortSignal);
        const fields = {
          ...base,
          durationMs: Date.now() - startedAt,
          outcome,
          ...(error instanceof SemanticCheckError
            ? { reason: error.message }
            : { err: error }),
        };

        if (outcome === 'aborted') {
          this.logger.warn(fields, 'LLM call aborted by client');
          throw error;
        }
        const willRetry = attempt < maxAttempts;
        this.logger.warn(
          { ...fields, willRetry },
          willRetry ? 'LLM call failed, retrying' : 'LLM call failed',
        );
      }
    }

    this.logger.error({ task }, 'LLM task failed on every attempt');
    throw new LlmTaskFailedException(task);
  }

  private classify(error: unknown, signal?: AbortSignal): AttemptOutcome {
    if (signal?.aborted) return 'aborted';
    if (error instanceof SemanticCheckError) return 'rejected';
    if (NoObjectGeneratedError.isInstance(error)) return 'invalid-output';
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || /timed? ?out/i.test(error.message))
    ) {
      return 'timeout';
    }
    return 'error';
  }
}
