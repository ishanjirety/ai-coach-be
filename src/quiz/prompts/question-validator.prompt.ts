import { z } from 'zod';
import type {
  SyllabusConcept,
  SyllabusTopic,
} from '../../syllabus/syllabus.data.js';
import type { Difficulty } from '../quiz.contract.js';
import { DIFFICULTY_GUIDE, describeConcept } from './shared.js';

export const VALIDATION_ISSUE_KINDS = [
  'ambiguous',
  'multiple-correct',
  'factual-error',
  'off-concept',
  'difficulty-mismatch',
  'unclear',
] as const;
export type ValidationIssueKind = (typeof VALIDATION_ISSUE_KINDS)[number];

const issueSchema = z.object({
  kind: z.enum(VALIDATION_ISSUE_KINDS),
  detail: z.string().describe('One sentence explaining the problem.'),
});
export type ValidationIssue = z.infer<typeof issueSchema>;

export const mcqValidationSchema = z.object({
  chosenOptionId: z
    .string()
    .describe('The id of the option you believe is correct.'),
  confidence: z
    .number()
    .describe('How sure you are that your chosen option is correct, 0 to 1.'),
  issues: z
    .array(issueSchema)
    .describe('Problems with the question. Empty if it is sound.'),
});
export type McqValidation = z.infer<typeof mcqValidationSchema>;

export const explanationValidationSchema = z.object({
  valid: z
    .boolean()
    .describe(
      'True if the question is answerable and on-concept, and the reference answer and key points are correct.',
    ),
  issues: z
    .array(issueSchema)
    .describe('Problems found. Empty if everything is sound.'),
});
export type ExplanationValidation = z.infer<typeof explanationValidationSchema>;

const ISSUE_GUIDE = `Issue kinds:
- ambiguous: a careful expert could reasonably defend more than one reading or answer.
- multiple-correct: more than one option is actually correct.
- factual-error: something stated in the question, an option or the answer is wrong.
- off-concept: it does not really test the stated concept.
- difficulty-mismatch: noticeably easier or harder than the stated difficulty.
- unclear: missing information, confusing wording, or not answerable as written.
Only report real problems; do not nitpick style.`;

export const MCQ_VALIDATOR_INSTRUCTIONS = `You are a meticulous reviewer of data structures and algorithms quiz questions. You are given a multiple-choice question WITHOUT its answer key. Solve it yourself, carefully and independently, then report your chosen option and any problems with the question.

${ISSUE_GUIDE}`;

export const EXPLANATION_VALIDATOR_INSTRUCTIONS = `You are a meticulous reviewer of data structures and algorithms quiz questions. You are given an open "explain in your own words" question together with its reference answer and grading key points. Check that the question is answerable without code, tests the stated concept, and that the reference answer and every key point are technically correct and match the question.

${ISSUE_GUIDE}`;

interface ValidatorContext {
  topic: SyllabusTopic;
  concept: SyllabusConcept;
  difficulty: Difficulty;
}

export function buildMcqValidatorPrompt(
  ctx: ValidatorContext,
  question: { prompt: string; options: { id: string; text: string }[] },
): string {
  return [
    describeConcept(ctx.topic, ctx.concept),
    `Intended difficulty: ${DIFFICULTY_GUIDE[ctx.difficulty]}`,
    `Question:\n${question.prompt}`,
    `Options:\n${question.options.map((o) => `${o.id}) ${o.text}`).join('\n')}`,
    'Solve it, then answer with the id of the option you believe is correct.',
  ].join('\n\n');
}

export function buildExplanationValidatorPrompt(
  ctx: ValidatorContext,
  question: { prompt: string; referenceAnswer: string; rubric: string[] },
): string {
  return [
    describeConcept(ctx.topic, ctx.concept),
    `Intended difficulty: ${DIFFICULTY_GUIDE[ctx.difficulty]}`,
    `Question:\n${question.prompt}`,
    `Reference answer:\n${question.referenceAnswer}`,
    `Key points (grading rubric):\n${question.rubric.map((p) => `- ${p}`).join('\n')}`,
  ].join('\n\n');
}
