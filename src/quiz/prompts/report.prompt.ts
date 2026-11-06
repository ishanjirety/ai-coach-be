import { z } from 'zod';
import type { SyllabusTopic } from '../../syllabus/syllabus.data.js';
import type { Difficulty } from '../quiz.contract.js';
import type { QuestionResult } from '../quiz-tokens.js';
import type { ConceptCoverage, ScoreSummary } from '../scoring.js';

export const reportAdviceSchema = z.object({
  summary: z
    .string()
    .describe(
      'Two or three sentences addressed to the learner ("you") on how the quiz went overall.',
    ),
  strengths: z
    .array(z.string())
    .describe(
      'One to four specific strengths, each tied to a concept or question. Empty if nothing was answered well.',
    ),
  weaknesses: z
    .array(z.string())
    .describe(
      'One to four specific weaknesses or gaps, each tied to a concept or question. Empty if none.',
    ),
  improvementPlan: z
    .array(
      z.object({
        conceptId: z
          .string()
          .describe('A concept id from the coverage table, copied exactly.'),
        why: z
          .string()
          .describe(
            'One sentence: why this concept needs work (what went wrong, or that it was not covered).',
          ),
        whatToStudy: z
          .array(z.string())
          .describe('Two or three specific things to study or review.'),
        practiceIdeas: z
          .array(z.string())
          .describe(
            'Two or three concrete practice exercises, e.g. well-known interview problems by name.',
          ),
      }),
    )
    .describe(
      'One entry for EVERY concept whose status is "weak" or "not-covered", weakest first.',
    ),
  nextSteps: z
    .array(z.string())
    .describe('Two to four short, actionable next steps.'),
});
export type ReportAdvice = z.infer<typeof reportAdviceSchema>;

export const REPORT_INSTRUCTIONS = `You are an encouraging, honest data structures and algorithms coach writing the end-of-quiz report for a learner preparing for coding interviews.

- The score and the concept coverage are already computed. Use them as given; never recompute, contradict or invent numbers.
- Be specific: refer to the concepts and to what was actually asked. Avoid generic advice like "practise more".
- "not-covered" means the quiz did not ask about that concept. It is not a failure; recommend it as a gap to explore.
- Keep every list item to one sentence.`;

const percent = (n: number | null) =>
  n === null ? 'n/a' : `${Math.round(n * 100)}%`;

export function buildReportPrompt(input: {
  topic: SyllabusTopic;
  difficulty: Difficulty;
  score: ScoreSummary;
  coverage: ConceptCoverage[];
  results: QuestionResult[];
}): string {
  const conceptName = new Map(input.topic.concepts.map((c) => [c.id, c.name]));
  const conceptDescription = new Map(
    input.topic.concepts.map((c) => [c.id, c.description]),
  );

  const questions = input.results
    .map(
      (r, i) =>
        `${i + 1}. [${r.type}, ${r.difficulty}, concept: ${r.conceptIds
          .map((id) => conceptName.get(id) ?? id)
          .join(
            ', ',
          )}] verdict: ${r.verdict} (score ${percent(r.score)})\n   "${r.stem}"`,
    )
    .join('\n');

  const coverage = input.coverage
    .map(
      (c) =>
        `- ${c.conceptId} | ${c.name} | status: ${c.status} | questions: ${c.questionsAsked} | average: ${percent(c.averageScore)}\n  (${conceptDescription.get(c.conceptId) ?? ''})`,
    )
    .join('\n');

  const s = input.score;
  return [
    `Topic: ${input.topic.name} (${input.topic.description})`,
    `Chosen difficulty: ${input.difficulty}`,
    `Score: ${s.percent}% (difficulty-weighted). ${s.correct} correct, ${s.partial} partial, ${s.incorrect} incorrect, ${s.skipped} skipped, out of ${s.total}.`,
    `Questions asked, in order:\n${questions}`,
    `Concept coverage (id | name | status | questions | average score):\n${coverage}`,
    'Write the report.',
  ].join('\n\n');
}
