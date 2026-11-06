import { randomInt } from 'node:crypto';
import type {
  GeneratedExplanation,
  GeneratedMcq,
} from './prompts/question-generator.prompt.js';
import type {
  ExplanationValidation,
  McqValidation,
  ValidationIssue,
  ValidationIssueKind,
} from './prompts/question-validator.prompt.js';

/**
 * Pure checks on LLM-written questions: the semantic check run on every
 * draft, the option shuffle, and the accept/reject decision on the
 * validator's blind solve.
 */

export const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;
export const HINT_COUNT = 3;

const MAX_PROMPT_CHARS = 1200;
const MAX_OPTION_CHARS = 300;
const CROSS_REFERENCE = [
  /\b(all|none|both|neither) of the (above|options|others)\b/i,
  /\b[Oo]ptions? [A-D]\b/,
];

const normalise = (text: string) =>
  text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Models like to open explanations with a verdict; the feedback adds its own. */
const LEADING_VERDICT =
  /^\s*(?:correct|incorrect|wrong|right|true|false|not quite|yes|no)\b\s*[.!:,;-]*\s*/i;

export function stripLeadingVerdict(text: string): string {
  const stripped = text.replace(LEADING_VERDICT, '').trim();
  return stripped.length > 0
    ? stripped[0].toUpperCase() + stripped.slice(1)
    : text.trim();
}

const nonEmpty = (text: string | undefined) =>
  typeof text === 'string' && text.trim().length > 0;

/** Returns why a draft MCQ is unusable, or null if it is fine. */
export function checkMcqDraft(draft: GeneratedMcq): string | null {
  if (!nonEmpty(draft.prompt)) return 'empty prompt';
  if (draft.prompt.length > MAX_PROMPT_CHARS) return 'prompt too long';
  if (draft.options.length !== 4) {
    return `expected exactly 4 options, got ${draft.options.length}`;
  }
  const ids = draft.options.map((o) => o.id.trim());
  if (new Set(ids).size !== 4) return 'option ids are not unique';
  const texts = draft.options.map((o) => normalise(o.text));
  if (texts.some((t) => t.length === 0)) return 'empty option text';
  if (new Set(texts).size !== 4) return 'option texts are not unique';
  if (draft.options.some((o) => o.text.length > MAX_OPTION_CHARS)) {
    return 'option text too long';
  }
  if (
    draft.options.some((o) => CROSS_REFERENCE.some((re) => re.test(o.text)))
  ) {
    return 'an option refers to other options, which breaks shuffling';
  }
  if (!ids.includes(draft.correctOptionId.trim())) {
    return `correctOptionId "${draft.correctOptionId}" is not one of the options`;
  }
  if (!nonEmpty(draft.referenceAnswer)) return 'empty reference answer';
  if (draft.keyPoints.filter(nonEmpty).length === 0) return 'no key points';
  if (draft.hints.filter(nonEmpty).length < HINT_COUNT) {
    return `expected ${HINT_COUNT} hints`;
  }
  const correctText = normalise(
    draft.options.find((o) => o.id.trim() === draft.correctOptionId.trim())!
      .text,
  );
  if (
    correctText.length >= 12 &&
    draft.hints.some((h) => normalise(h).includes(correctText))
  ) {
    return 'a hint gives away the correct option';
  }
  return null;
}

/** Returns why a draft explanation question is unusable, or null. */
export function checkExplanationDraft(
  draft: GeneratedExplanation,
): string | null {
  if (!nonEmpty(draft.prompt)) return 'empty prompt';
  if (draft.prompt.length > MAX_PROMPT_CHARS) return 'prompt too long';
  if (!nonEmpty(draft.referenceAnswer)) return 'empty reference answer';
  const points = draft.keyPoints.filter(nonEmpty);
  if (points.length < 2 || points.length > 6) {
    return `expected 2-6 key points, got ${points.length}`;
  }
  if (draft.hints.filter(nonEmpty).length < HINT_COUNT) {
    return `expected ${HINT_COUNT} hints`;
  }
  return null;
}

export interface ShuffledMcq {
  options: { id: string; text: string }[];
  correctOptionId: string;
  optionExplanations: Record<string, string>;
}

/**
 * Shuffles a checked MCQ draft (Fisher-Yates, crypto RNG) and assigns stable
 * ids a–d in display order, so the model's own labels never reach the client.
 */
export function shuffleMcq(
  draft: GeneratedMcq,
  random: (max: number) => number = randomInt,
): ShuffledMcq {
  const options = [...draft.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  const correctLabel = draft.correctOptionId.trim();
  const result: ShuffledMcq = {
    options: [],
    correctOptionId: '',
    optionExplanations: {},
  };
  options.forEach((option, index) => {
    const id = OPTION_IDS[index];
    result.options.push({ id, text: option.text.trim() });
    result.optionExplanations[id] = stripLeadingVerdict(option.explanation);
    if (option.id.trim() === correctLabel) result.correctOptionId = id;
  });
  return result;
}

/** 'difficulty-mismatch' is logged but doesn't reject a question. */
export const NON_BLOCKING_ISSUES: readonly ValidationIssueKind[] = [
  'difficulty-mismatch',
];

export interface ValidationDecision {
  accepted: boolean;
  blockingIssues: ValidationIssue[];
  /** MCQ only: did the blind solve agree with the answer key? */
  answerMatched?: boolean;
}

const blocking = (issues: readonly ValidationIssue[]) =>
  issues.filter((i) => !NON_BLOCKING_ISSUES.includes(i.kind));

/** Accept an MCQ only if the blind solve matches the key and nothing blocks. */
export function decideMcqValidation(
  validation: McqValidation,
  correctOptionId: string,
): ValidationDecision {
  const answerMatched =
    validation.chosenOptionId.trim().toLowerCase() ===
    correctOptionId.toLowerCase();
  const blockingIssues = blocking(validation.issues);
  return {
    accepted: answerMatched && blockingIssues.length === 0,
    blockingIssues,
    answerMatched,
  };
}

/** Accept an explanation question if it's valid and nothing blocks. */
export function decideExplanationValidation(
  validation: ExplanationValidation,
): ValidationDecision {
  const blockingIssues = blocking(validation.issues);
  return {
    accepted: validation.valid && blockingIssues.length === 0,
    blockingIssues,
  };
}

/** Feedback for the generator after a rejection. */
export function describeRejection(
  decision: ValidationDecision,
  chosenOptionText?: string,
): string {
  const lines = decision.blockingIssues.map((i) => `- ${i.kind}: ${i.detail}`);
  if (decision.answerMatched === false) {
    lines.unshift(
      `- An independent expert solving the question chose a different option${
        chosenOptionText ? ` ("${chosenOptionText}")` : ''
      } than your answer key. The question is ambiguous or the key is wrong.`,
    );
  }
  return lines.length > 0
    ? lines.join('\n')
    : '- The reviewer judged the question invalid.';
}
