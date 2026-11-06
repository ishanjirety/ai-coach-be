import { z } from 'zod';

/**
 * Optional per-task model chain: "primary,fallback1,fallback2" (OpenRouter
 * slugs). Unset means the defaults in src/llm/llm-tasks.ts.
 */
const modelChain = z
  .string()
  .optional()
  .transform((value) =>
    value === undefined
      ? undefined
      : value
          .split(',')
          .map((slug) => slug.trim())
          .filter(Boolean),
  )
  .refine(
    (models) =>
      models === undefined || (models.length >= 1 && models.length <= 3),
    'must list 1 to 3 comma-separated model slugs',
  )
  .refine(
    (models) =>
      models === undefined ||
      models.every((slug) => /^[\w.-]+\/[\w.:-]+$/.test(slug)),
    'each model must be an OpenRouter slug like "vendor/model"',
  );

/**
 * Every environment variable the app reads is declared and validated here.
 * The app refuses to boot if this schema fails, so misconfiguration surfaces
 * immediately instead of at the first request.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  /** Comma-separated list of allowed origins, e.g. "http://localhost:3000". */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('debug'),
  /** Pretty, human-readable logs. Defaults to on outside production. */
  LOG_PRETTY: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),

  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENROUTER_BASE_URL: z.url().optional(),
  OPENROUTER_APP_NAME: z.string().default('AI Interview Coach'),
  OPENROUTER_APP_URL: z.string().optional(),

  /** Per-task model overrides (see src/llm/llm-tasks.ts for the defaults). */
  LLM_QUESTION_GENERATE_MODELS: modelChain,
  LLM_QUESTION_VALIDATE_MODELS: modelChain,
  LLM_ANSWER_EVALUATE_MODELS: modelChain,
  LLM_COACH_CHAT_MODELS: modelChain,
  LLM_REPORT_GENERATE_MODELS: modelChain,

  /**
   * Secret used to seal quiz tokens (AES-256-GCM). Anyone holding it can mint
   * scores or read answer keys, so keep it out of the repo.
   */
  QUIZ_TOKEN_SECRET: z
    .string()
    .min(32, 'QUIZ_TOKEN_SECRET must be at least 32 characters'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
