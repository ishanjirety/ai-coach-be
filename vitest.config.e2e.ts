import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // The env schema is validated at import time, so test values go here.
    env: {
      NODE_ENV: 'test',
      OPENROUTER_API_KEY: 'test-key',
      LOG_LEVEL: 'silent',
      QUIZ_TOKEN_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      // One fake model id per task, so the mock LLM (test/mock-llm.ts) can
      // tell tasks apart. Two-model chains exercise the rotated retry.
      LLM_QUESTION_GENERATE_MODELS: 'test/generate,test/generate-fallback',
      LLM_QUESTION_VALIDATE_MODELS: 'test/validate,test/validate-fallback',
      LLM_ANSWER_EVALUATE_MODELS: 'test/evaluate,test/evaluate-fallback',
      LLM_COACH_CHAT_MODELS: 'test/chat',
      LLM_REPORT_GENERATE_MODELS: 'test/report,test/report-fallback',
    },
  },
});
