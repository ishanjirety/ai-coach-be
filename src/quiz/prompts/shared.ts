import type {
  SyllabusConcept,
  SyllabusTopic,
} from '../../syllabus/syllabus.data.js';
import type { Difficulty } from '../quiz.contract.js';

export const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  easy: 'Easy: tests recognition and definitions: what the technique is, its basic complexity, or which structure fits an obvious scenario. One reasoning step.',
  medium:
    'Medium: tests applying the concept to a concrete, typical interview scenario: tracing a small example, choosing between two plausible approaches, or spotting a common bug. Two or three reasoning steps.',
  hard: 'Hard: tests deep understanding: edge cases, why an approach is correct or fails, complexity of a non-obvious variant, or combining the concept with another idea. Several reasoning steps, but still answerable in a couple of minutes without writing code.',
};

export function describeConcept(
  topic: SyllabusTopic,
  concept: SyllabusConcept,
): string {
  return [
    `Topic: ${topic.name} (${topic.description})`,
    `Concept: ${concept.name} [id: ${concept.id}]`,
    `Concept description: ${concept.description}`,
  ].join('\n');
}

/** Wraps untrusted text so the model treats it as data, not instructions. */
export function fence(tag: string, text: string): string {
  const safe = text.replaceAll(`</${tag}>`, `</ ${tag}>`);
  return `<${tag}>\n${safe}\n</${tag}>`;
}
