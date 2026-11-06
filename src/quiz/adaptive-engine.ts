import type { Difficulty, QuestionType } from './quiz.contract.js';
import { computeCoverage, type ScoredResult } from './scoring.js';

/**
 * The adaptive engine: pure functions that decide what to ask next. The LLM
 * only writes a question for the concept, difficulty and type chosen here.
 */

export const DIFFICULTY_LEVELS: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
];

/** Every EXPLANATION_EVERY-th question is an explanation question. */
export const EXPLANATION_EVERY = 3;

export interface NextQuestionPlan {
  conceptId: string;
  difficulty: Difficulty;
  type: QuestionType;
}

/**
 * Orders concepts by priority: uncovered first (in syllabus order), then
 * weak (fewest questions, then lowest average), then strong (same tiebreak).
 */
export function rankConcepts(
  conceptIds: readonly string[],
  results: readonly ScoredResult[],
): string[] {
  const coverage = computeCoverage(
    conceptIds.map((id) => ({ id, name: id })),
    results,
  );
  const bucket = { 'not-covered': 0, weak: 1, strong: 2 } as const;

  return coverage
    .map((c, order) => ({ ...c, order }))
    .sort(
      (a, b) =>
        bucket[a.status] - bucket[b.status] ||
        a.questionsAsked - b.questionsAsked ||
        (a.averageScore ?? 0) - (b.averageScore ?? 0) ||
        a.order - b.order,
    )
    .map((c) => c.conceptId);
}

/**
 * Next difficulty: one step up after a correct answer, one down after an
 * incorrect or skipped one, unchanged after a partial one. It never leaves
 * the chosen level ±1 (nor the easy..hard range).
 */
export function nextDifficulty(
  chosen: Difficulty,
  results: readonly Pick<ScoredResult, 'verdict'>[],
): Difficulty {
  const base = DIFFICULTY_LEVELS.indexOf(chosen);
  const min = Math.max(0, base - 1);
  const max = Math.min(DIFFICULTY_LEVELS.length - 1, base + 1);

  let level = base;
  for (const { verdict } of results) {
    if (verdict === 'correct') level += 1;
    else if (verdict === 'incorrect' || verdict === 'skipped') level -= 1;
    level = Math.min(max, Math.max(min, level));
  }
  return DIFFICULTY_LEVELS[level];
}

/** Mostly MCQs: every 3rd question (index 2, 5, 8, …) is an explanation. */
export function nextQuestionType(questionIndex: number): QuestionType {
  return questionIndex % EXPLANATION_EVERY === EXPLANATION_EVERY - 1
    ? 'explanation'
    : 'mcq';
}

export interface PlannedSlot extends NextQuestionPlan {
  /** Absolute 0-based position in the quiz. */
  position: number;
}

export interface BatchPlanInput {
  /** focusConceptIds if given, otherwise the topic's concepts. */
  conceptPool: readonly string[];
  chosen: Difficulty;
  /** Graded results, oldest first. They drive difficulty and coverage. */
  results: readonly ScoredResult[];
  /** Concepts of questions handed out but not graded yet: already taken. */
  issuedConceptIds: readonly (readonly string[])[];
  count: number;
}

/**
 * Plans a batch of `count` questions together:
 * - difficulty adapts from graded results only (the same for the batch);
 * - concepts follow the usual priority (uncovered, then weak, then strong),
 *   but concepts already taken by issued questions or earlier slots in the
 *   batch go last, so slots get distinct concepts whenever the pool allows;
 * - the every-3rd-is-an-explanation rule uses the absolute position.
 */
export function planQuestionBatch(input: BatchPlanInput): PlannedSlot[] {
  const { conceptPool, chosen, results, issuedConceptIds, count } = input;
  if (conceptPool.length === 0) {
    throw new Error('planQuestionBatch needs at least one concept');
  }

  const ranked = rankConcepts(conceptPool, results);
  const taken = new Map<string, number>(ranked.map((id) => [id, 0]));
  for (const ids of issuedConceptIds) {
    for (const id of ids) {
      if (taken.has(id)) taken.set(id, taken.get(id)! + 1);
    }
  }

  const difficulty = nextDifficulty(chosen, results);
  const start = results.length + issuedConceptIds.length;
  const slots: PlannedSlot[] = [];

  for (let i = 0; i < count; i++) {
    // Least-taken concept wins; ties keep the priority order.
    let best = ranked[0];
    for (const id of ranked) {
      if (taken.get(id)! < taken.get(best)!) best = id;
    }
    taken.set(best, taken.get(best)! + 1);

    const position = start + i;
    slots.push({
      position,
      conceptId: best,
      difficulty,
      type: nextQuestionType(position),
    });
  }
  return slots;
}
