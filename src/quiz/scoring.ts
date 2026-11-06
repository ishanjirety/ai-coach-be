import type {
  CoverageStatus,
  Difficulty,
  ReportResponse,
  Verdict,
} from './quiz.contract.js';

/** Harder questions count for more. */
export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

/** A concept's average score at or above this is "strong". */
export const STRONG_THRESHOLD = 0.7;

export interface ScoredResult {
  conceptIds: string[];
  difficulty: Difficulty;
  verdict: Verdict;
  score: number;
}

export type ScoreSummary = ReportResponse['score'];

export interface ConceptCoverage {
  conceptId: string;
  name: string;
  status: CoverageStatus;
  questionsAsked: number;
  /** Mean 0–1 score over the questions that touched it; null if none. */
  averageScore: number | null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Difficulty-weighted percent (0–100, integer) plus verdict counts. */
export function computeScore(results: readonly ScoredResult[]): ScoreSummary {
  let weighted = 0;
  let totalWeight = 0;
  const counts = { correct: 0, partial: 0, incorrect: 0, skipped: 0 };

  for (const result of results) {
    const weight = DIFFICULTY_WEIGHT[result.difficulty];
    weighted += weight * clamp01(result.score);
    totalWeight += weight;
    counts[result.verdict] += 1;
  }

  return {
    percent: totalWeight === 0 ? 0 : Math.round((100 * weighted) / totalWeight),
    ...counts,
    total: results.length,
  };
}

/**
 * Per-concept coverage, in the order of `concepts`. A question tagged with
 * several concepts counts toward each of them.
 */
export function computeCoverage(
  concepts: readonly { id: string; name: string }[],
  results: readonly ScoredResult[],
): ConceptCoverage[] {
  return concepts.map(({ id, name }) => {
    const scores = results
      .filter((r) => r.conceptIds.includes(id))
      .map((r) => clamp01(r.score));

    if (scores.length === 0) {
      return {
        conceptId: id,
        name,
        status: 'not-covered',
        questionsAsked: 0,
        averageScore: null,
      };
    }
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    return {
      conceptId: id,
      name,
      status: averageScore >= STRONG_THRESHOLD ? 'strong' : 'weak',
      questionsAsked: scores.length,
      averageScore,
    };
  });
}
