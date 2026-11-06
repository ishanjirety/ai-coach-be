import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { SyllabusTopic } from '../syllabus/syllabus.data.js';
import type { PrivateQuestion } from './quiz-tokens.js';

/**
 * Tools for the coach chat. Their outputs are streamed to the browser, so
 * they only ever return safe data: pre-written hints (which never reveal the
 * answer) and public syllabus descriptions.
 *
 * Output shapes (what the FE renders):
 *   giveHint       → { level, hint } | { level, hint: null, note }
 *   explainConcept → { conceptId, name, description }
 */
export function buildCoachTools(input: {
  topic: SyllabusTopic;
  question?: PrivateQuestion;
}): ToolSet {
  const { topic, question } = input;
  const conceptIds = topic.concepts.map((c) => c.id) as [string, ...string[]];

  return {
    giveHint: tool({
      description:
        'Get a pre-written hint for the current question. Level 1 is a gentle nudge, 2 a stronger pointer, 3 a near-solution scaffold. Never reveals the answer.',
      inputSchema: z.object({
        level: z
          .number()
          .int()
          .min(1)
          .max(3)
          .describe('Hint strength: 1, 2 or 3.'),
      }),
      execute: async ({ level }) => {
        const clamped = Math.min(3, Math.max(1, Math.round(level)));
        if (!question || question.hints.length === 0) {
          return {
            level: clamped,
            hint: null,
            note: 'There is no active question to give a hint for.',
          };
        }
        const hint =
          question.hints[Math.min(clamped, question.hints.length) - 1];
        return { level: clamped, hint };
      },
    }),

    explainConcept: tool({
      description: `Look up the syllabus description of a concept in "${topic.name}".`,
      inputSchema: z.object({
        conceptId: z.enum(conceptIds).describe('The concept id.'),
      }),
      execute: async ({ conceptId }) => {
        const concept = topic.concepts.find((c) => c.id === conceptId);
        if (!concept) {
          return {
            conceptId,
            name: conceptId,
            description: 'Unknown concept.',
          };
        }
        return {
          conceptId: concept.id,
          name: concept.name,
          description: concept.description,
        };
      },
    }),
  };
}
