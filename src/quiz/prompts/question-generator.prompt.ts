import { z } from 'zod';
import type {
  SyllabusConcept,
  SyllabusTopic,
} from '../../syllabus/syllabus.data.js';
import type { Difficulty, QuestionType } from '../quiz.contract.js';
import { DIFFICULTY_GUIDE, describeConcept } from './shared.js';

/*
 * LLM-facing schemas stay free of min/max constraints: strict structured
 * output modes reject several JSON-schema keywords. Sizes are checked in
 * code (see question-checks.ts) and a bad output is retried.
 */

export const generatedMcqSchema = z.object({
  prompt: z
    .string()
    .describe(
      'The question stem, self-contained, plain text (inline code in backticks is fine). Do not list the options here.',
    ),
  options: z
    .array(
      z.object({
        id: z.string().describe('Any unique label, e.g. "A".'),
        text: z.string().describe('The option text, short and specific.'),
        explanation: z
          .string()
          .describe(
            'One or two sentences on why this option is correct or why it is wrong. Do not start with "Correct" or "Incorrect".',
          ),
      }),
    )
    .describe('Exactly 4 options. Exactly one is correct.'),
  correctOptionId: z.string().describe('The id of the single correct option.'),
  referenceAnswer: z
    .string()
    .describe(
      'A short model explanation of the correct answer (2-4 sentences).',
    ),
  keyPoints: z
    .array(z.string())
    .describe('2-4 key facts a learner should take away from this question.'),
  hints: z
    .array(z.string())
    .describe(
      'Exactly 3 hints, from gentle to strong. None may state or clearly identify the correct option.',
    ),
});
export type GeneratedMcq = z.infer<typeof generatedMcqSchema>;

export const generatedExplanationSchema = z.object({
  prompt: z
    .string()
    .describe(
      'The question: ask the learner to explain something in their own words (no code required). Self-contained, plain text.',
    ),
  referenceAnswer: z
    .string()
    .describe('A complete, concise model answer (3-6 sentences).'),
  keyPoints: z
    .array(z.string())
    .describe(
      'The 2-5 key points a full answer must cover. Each is one specific, checkable statement. This is the grading rubric.',
    ),
  hints: z
    .array(z.string())
    .describe(
      'Exactly 3 hints, from gentle to strong. None may give away the full answer.',
    ),
});
export type GeneratedExplanation = z.infer<typeof generatedExplanationSchema>;

export const QUESTION_GENERATOR_INSTRUCTIONS = `You are an expert data structures and algorithms interviewer who writes precise, unambiguous quiz questions for software engineers preparing for coding interviews.

Rules:
- Test exactly the concept you are given, at exactly the difficulty you are given.
- Be technically correct. If a question depends on assumptions (sorted input, non-negative values, average vs worst case), state them in the stem.
- The learner answers without writing code, so ask about reasoning, behaviour, complexity, trade-offs, tracing small examples, or choosing an approach.
- Keep stems under 80 words. Small inline examples are welcome.
- Never repeat or lightly reword a question the learner has already seen.

For multiple-choice questions:
- Exactly 4 options and exactly one correct answer. The distractors must be plausible (common misconceptions) but unambiguously wrong.
- Options must be distinct and similar in length and style, so the answer can't be guessed from the form.
- Never use "all of the above", "none of the above", or options that refer to other options by letter: options are shuffled.

Hints go from a gentle nudge (which idea to think about), to a stronger pointer (the key property or step), to a near-solution scaffold. No hint may state the answer.`;

export interface GenerateQuestionInput {
  topic: SyllabusTopic;
  concept: SyllabusConcept;
  difficulty: Difficulty;
  type: QuestionType;
  previousStems: string[];
  /** Feedback from a rejected earlier draft, if any. */
  feedback?: string;
}

export function buildQuestionGeneratorPrompt(
  input: GenerateQuestionInput,
): string {
  const parts = [
    describeConcept(input.topic, input.concept),
    `Difficulty: ${DIFFICULTY_GUIDE[input.difficulty]}`,
    input.type === 'mcq'
      ? 'Question type: multiple choice (4 options, one correct).'
      : 'Question type: explanation. The learner answers in a few sentences of plain words, graded against your key points.',
  ];

  if (input.previousStems.length > 0) {
    parts.push(
      `Questions already asked in this quiz (do not repeat these or ask the same thing in other words):\n${input.previousStems
        .map((stem) => `- ${stem}`)
        .join('\n')}`,
    );
  }
  if (input.feedback) {
    parts.push(
      `An independent reviewer rejected your previous draft for this slot. Write a NEW question that avoids these problems:\n${input.feedback}`,
    );
  }

  parts.push('Write the question now.');
  return parts.join('\n\n');
}
