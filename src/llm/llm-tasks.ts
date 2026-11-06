import type { Env } from '../config/env.schema.js';

/** Every kind of LLM call the app makes. Each has its own model chain. */
export type LlmTask =
  | 'question-generate'
  | 'question-validate'
  | 'answer-evaluate'
  | 'coach-chat'
  | 'report-generate';

export interface LlmTaskConfig {
  /** Primary first, then fallbacks (max 3 in total). */
  models: readonly string[];
  /** Only sent when every model in the chain accepts it (see below). */
  temperature: number;
  /**
   * Output cap. Required in practice: without it OpenRouter reserves the
   * model's full context (e.g. 65k tokens) against the credit limit and can
   * refuse the call with a 402.
   */
  maxOutputTokens: number;
  /** Total time budget for one attempt, ms. Unset = no app-level timeout. */
  timeoutMs?: number;
  /** Env var that overrides `models`. */
  envKey: keyof Env;
}

/**
 * Default models per task. All of them support structured outputs and tools
 * on OpenRouter. Override any chain with its env var, e.g.
 * LLM_QUESTION_GENERATE_MODELS="vendor/a,vendor/b".
 */
export const LLM_TASKS: Record<LlmTask, LlmTaskConfig> = {
  'question-generate': {
    models: [
      'anthropic/claude-sonnet-5.5',
      'openai/gpt-6.1-terra',
      'google/gemini-4-argon',
    ],
    temperature: 0.8,
    maxOutputTokens: 2000,
    timeoutMs: 30_000,
    envKey: 'LLM_QUESTION_GENERATE_MODELS',
  },
  // Deliberately a different model family from the generator, so the blind
  // solve doesn't share the generator's blind spots.
  'question-validate': {
    models: [
      'openai/gpt-6.1-terra',
      'google/gemini-3.8-flash',
      'deepseek/deepseek-v4.1-flash',
    ],
    temperature: 0,
    maxOutputTokens: 1500,
    timeoutMs: 20_000,
    envKey: 'LLM_QUESTION_VALIDATE_MODELS',
  },
  'answer-evaluate': {
    models: [
      'anthropic/claude-haiku-5.5',
      'openai/gpt-6-luna',
      'google/gemini-3.8-flash',
    ],
    temperature: 0,
    maxOutputTokens: 1000,
    timeoutMs: 20_000,
    envKey: 'LLM_ANSWER_EVALUATE_MODELS',
  },
  'coach-chat': {
    models: [
      'anthropic/claude-haiku-5.5',
      'openai/gpt-6-luna',
      'google/gemini-3.8-flash',
    ],
    temperature: 0.6,
    maxOutputTokens: 1000,
    envKey: 'LLM_COACH_CHAT_MODELS',
  },
  'report-generate': {
    models: [
      'anthropic/claude-sonnet-5.5',
      'openai/gpt-6.1-terra',
      'google/gemini-4-argon',
    ],
    temperature: 0.4,
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    envKey: 'LLM_REPORT_GENERATE_MODELS',
  },
};

/**
 * Models that reject `temperature` (OpenRouter catalog, checked 2026-11-06).
 * Calls send `require_parameters: true`, so a single unsupported parameter
 * makes OpenRouter skip that model and serve a fallback instead. Temperature
 * is therefore only sent when every model in the chain accepts it; models
 * not listed here are assumed to accept it.
 */
export const MODELS_WITHOUT_TEMPERATURE: ReadonlySet<string> = new Set([
  'anthropic/claude-sonnet-5.5',
  'anthropic/claude-haiku-5.5',
  'openai/gpt-6.1-terra',
  'openai/gpt-6-luna',
]);

export function chainAcceptsTemperature(models: readonly string[]): boolean {
  return models.every((model) => !MODELS_WITHOUT_TEMPERATURE.has(model));
}

/** Rotates a chain so it starts at `offset` (wrapping around). */
export function rotateChain(
  models: readonly string[],
  offset: number,
): string[] {
  if (models.length === 0) return [];
  const start = offset % models.length;
  return [...models.slice(start), ...models.slice(0, start)];
}
