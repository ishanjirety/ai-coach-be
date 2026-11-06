import { z } from 'zod';

/**
 * The public API contract (mirrored by the FE in src/lib/api/contract.ts).
 * Request schemas are enforced with ZodValidationPipe; response schemas
 * document the shape and are type-checked against what the services return.
 */

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const questionTypeSchema = z.enum(['mcq', 'explanation']);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const verdictSchema = z.enum([
  'correct',
  'partial',
  'incorrect',
  'skipped',
]);
export type Verdict = z.infer<typeof verdictSchema>;

const idSchema = z.string().trim().min(1).max(100);
/** Sealed tokens are opaque base64url strings. */
const tokenSchema = z
  .string()
  .min(1)
  .max(20_000)
  .regex(/^[A-Za-z0-9_-]+$/, 'must be a token issued by this server');

// ---------------------------------------------------------------------------
// GET /syllabus/topics

export const topicsResponseSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      concepts: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
});
export type TopicsResponse = z.infer<typeof topicsResponseSchema>;

// ---------------------------------------------------------------------------
// POST /quiz/questions (a batch, generated in parallel, for prefetching)

export const questionsRequestSchema = z.object({
  topicId: idSchema,
  difficulty: difficultySchema,
  totalQuestions: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  /** Clamped to the questions remaining. */
  count: z.number().int().min(1).max(3),
  /** Graded questions. */
  resultTokens: z.array(tokenSchema).max(15),
  /** Handed out but not graded yet (buffered, unanswered or grading). */
  issuedQuestionTokens: z.array(tokenSchema).max(15).default([]),
  focusConceptIds: z.array(idSchema).max(20).optional(),
});
export type QuestionsRequest = z.infer<typeof questionsRequestSchema>;

export const publicQuestionSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  prompt: z.string(),
  options: z
    .array(z.object({ id: z.string(), text: z.string() }))
    .length(4)
    .optional(),
  conceptIds: z.array(z.string()),
  difficulty: difficultySchema,
});
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;

export const questionsResponseSchema = z.object({
  questions: z.array(
    z.object({
      question: publicQuestionSchema,
      questionToken: z.string(),
      /** 1-based position in the quiz; contiguous within a batch. */
      index: z.number().int(),
    }),
  ),
  total: z.number().int(),
});
export type QuestionsResponse = z.infer<typeof questionsResponseSchema>;

// ---------------------------------------------------------------------------
// POST /quiz/evaluate

export const answerSchema = z.union([
  z.strictObject({ optionId: idSchema }),
  z.strictObject({ text: z.string().trim().min(1).max(4000) }),
  z.strictObject({ skipped: z.literal(true) }),
]);
export type Answer = z.infer<typeof answerSchema>;

export const evaluateRequestSchema = z.object({
  questionToken: tokenSchema,
  answer: answerSchema,
});
export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;

export const evaluationSchema = z.object({
  verdict: verdictSchema,
  score: z.number().min(0).max(1),
  feedback: z.string(),
  correctOptionId: z.string().optional(),
  referenceAnswer: z.string(),
  missedPoints: z.array(z.string()),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const evaluateResponseSchema = z.object({
  evaluation: evaluationSchema,
  resultToken: z.string(),
});
export type EvaluateResponse = z.infer<typeof evaluateResponseSchema>;

// ---------------------------------------------------------------------------
// POST /quiz/chat

/**
 * A UI message from the AI SDK `useChat` hook. Parts are kept loose: the AI
 * SDK owns their structure, we only guard the envelope and the sizes. Only
 * user/assistant roles are accepted, so a client can't inject system text.
 */
const uiMessageSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(['user', 'assistant']),
  parts: z.array(z.looseObject({ type: z.string() })).max(50),
  metadata: z.unknown().optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema).min(1).max(100),
  topicId: idSchema,
  questionToken: tokenSchema.optional(),
  answered: z.boolean(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// ---------------------------------------------------------------------------
// POST /quiz/report

export const reportRequestSchema = z.object({
  topicId: idSchema,
  difficulty: difficultySchema,
  resultTokens: z.array(tokenSchema).min(1).max(15),
});
export type ReportRequest = z.infer<typeof reportRequestSchema>;

export const coverageStatusSchema = z.enum(['strong', 'weak', 'not-covered']);
export type CoverageStatus = z.infer<typeof coverageStatusSchema>;

export const reportResponseSchema = z.object({
  score: z.object({
    percent: z.number(),
    correct: z.number().int(),
    partial: z.number().int(),
    incorrect: z.number().int(),
    skipped: z.number().int(),
    total: z.number().int(),
  }),
  coverage: z.array(
    z.object({
      conceptId: z.string(),
      name: z.string(),
      status: coverageStatusSchema,
      questionsAsked: z.number().int(),
    }),
  ),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvementPlan: z.array(
    z.object({
      conceptId: z.string(),
      name: z.string(),
      why: z.string(),
      whatToStudy: z.array(z.string()),
      practiceIdeas: z.array(z.string()),
    }),
  ),
  nextSteps: z.array(z.string()),
});
export type ReportResponse = z.infer<typeof reportResponseSchema>;
