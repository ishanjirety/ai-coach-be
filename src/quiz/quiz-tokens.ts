import type { Difficulty, QuestionType, Verdict } from './quiz.contract.js';

/**
 * What a questionToken seals: the full private question. Only the public
 * part (id, type, prompt, options, conceptIds, difficulty) ever reaches the
 * client in the clear.
 */
export interface PrivateQuestion {
  id: string;
  topicId: string;
  type: QuestionType;
  prompt: string;
  difficulty: Difficulty;
  conceptIds: string[];
  /** MCQ only: shuffled, with stable ids a–d. */
  options?: { id: string; text: string }[];
  /** MCQ only. */
  correctOptionId?: string;
  /** MCQ only: why each option is right or wrong, keyed by option id. */
  optionExplanations?: Record<string, string>;
  /** Model answer shown after grading. */
  referenceAnswer: string;
  /** Key points a full answer covers; used for grading and missedPoints. */
  rubric: string[];
  /** Progressively stronger hints (level 1–3) that never give the answer. */
  hints: string[];
}

/** What a resultToken seals: one graded answer. */
export interface QuestionResult {
  questionId: string;
  topicId: string;
  type: QuestionType;
  conceptIds: string[];
  difficulty: Difficulty;
  verdict: Verdict;
  score: number;
  /** Short version of the prompt, for avoiding repeats and for the report. */
  stem: string;
}

export const STEM_MAX_CHARS = 200;

export function toStem(prompt: string): string {
  const flat = prompt.replace(/\s+/g, ' ').trim();
  return flat.length <= STEM_MAX_CHARS
    ? flat
    : `${flat.slice(0, STEM_MAX_CHARS - 1)}…`;
}
