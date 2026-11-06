import { simulateReadableStream, type LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

/**
 * Scriptable mock LLM for e2e tests. The e2e env (vitest.config.e2e.ts)
 * gives every task its own fake model ids, so a model id tells us the task.
 */

export type MockTask =
  | 'question-generate'
  | 'question-validate'
  | 'answer-evaluate'
  | 'coach-chat'
  | 'report-generate';

const TASK_BY_PREFIX: [string, MockTask][] = [
  ['test/generate', 'question-generate'],
  ['test/validate', 'question-validate'],
  ['test/evaluate', 'answer-evaluate'],
  ['test/chat', 'coach-chat'],
  ['test/report', 'report-generate'],
];

type CallOptions = Parameters<MockLanguageModelV4['doGenerate']>[0];

export interface MockCall {
  task: MockTask;
  modelId: string;
  /** Index of this call within its task, from 0. */
  index: number;
  options: CallOptions;
  /** System + user text of the prompt, for assertions. */
  promptText: string;
  /** Top-level properties of the requested JSON schema, if any. */
  schemaKeys: string[];
}

/** Returns a JSON-able object, or throws to simulate a failure. */
export type GenerateHandler = (call: MockCall) => unknown;
export type StreamHandler = (call: MockCall) => unknown[];

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function promptText(options: CallOptions): string {
  return options.prompt
    .map((message) =>
      typeof message.content === 'string'
        ? message.content
        : message.content
            .map((part) => ('text' in part ? part.text : ''))
            .join('\n'),
    )
    .join('\n');
}

function schemaKeys(options: CallOptions): string[] {
  const format = options.responseFormat;
  if (format?.type !== 'json' || !format.schema) return [];
  const properties = (format.schema as { properties?: object }).properties;
  return properties ? Object.keys(properties) : [];
}

export class MockLlm {
  readonly calls: MockCall[] = [];
  generate: Partial<Record<MockTask, GenerateHandler>> = {};
  stream: StreamHandler | undefined;

  reset(): void {
    this.calls.length = 0;
    this.generate = {};
    this.stream = undefined;
  }

  callsFor(task: MockTask): MockCall[] {
    return this.calls.filter((c) => c.task === task);
  }

  createModel = (modelId: string): LanguageModel => {
    const task = TASK_BY_PREFIX.find(([prefix]) =>
      modelId.startsWith(prefix),
    )?.[1];
    if (!task) throw new Error(`No mock task for model ${modelId}`);

    const record = (options: CallOptions): MockCall => {
      const call: MockCall = {
        task,
        modelId,
        index: this.callsFor(task).length,
        options,
        promptText: promptText(options),
        schemaKeys: schemaKeys(options),
      };
      this.calls.push(call);
      return call;
    };

    return new MockLanguageModelV4({
      modelId,
      doGenerate: async (options) => {
        const call = record(options);
        const handler = this.generate[task];
        if (!handler) throw new Error(`No mock handler for ${task}`);
        const output = handler(call);
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          finishReason: { unified: 'stop', raw: undefined },
          usage,
          warnings: [],
          response: { modelId },
        };
      },
      doStream: async (options) => {
        const call = record(options);
        if (!this.stream) throw new Error('No mock stream handler');
        return {
          stream: simulateReadableStream({
            chunks: this.stream(call) as never[],
          }),
        };
      },
    });
  };
}

// ---------------------------------------------------------------------------
// Canned outputs

export const CORRECT_TEXT = 'O(log n)';

export const mcqDraft = (overrides: Record<string, unknown> = {}) => ({
  prompt: 'What is the worst-case time complexity of binary search?',
  options: [
    { id: 'A', text: CORRECT_TEXT, explanation: 'Each step halves the range.' },
    { id: 'B', text: 'O(n)', explanation: 'That is a linear scan.' },
    { id: 'C', text: 'O(n log n)', explanation: 'That is comparison sorting.' },
    {
      id: 'D',
      text: 'O(1)',
      explanation: 'It needs more than one comparison.',
    },
  ],
  correctOptionId: 'A',
  referenceAnswer: 'Binary search halves the range each step: O(log n).',
  keyPoints: ['The range halves every step', 'log2(n) steps in the worst case'],
  hints: [
    'Think about how the search range changes.',
    'How many times can you halve n?',
    'Count the halvings until one element is left.',
  ],
  ...overrides,
});

export const explanationDraft = () => ({
  prompt: 'Explain in your own words why binary search needs sorted input.',
  referenceAnswer:
    'Binary search discards half the range based on one comparison, which is only valid if the order tells us which side the target is on.',
  keyPoints: [
    'Comparing with the middle tells which half can contain the target',
    'That inference only holds when the input is sorted',
  ],
  hints: [
    'Think about the comparison.',
    'What does order tell you?',
    'Unsorted: target could be anywhere.',
  ],
});

/** Generator handler that answers with the right draft for the schema asked. */
export const generateByType: GenerateHandler = (call) =>
  call.schemaKeys.includes('options') ? mcqDraft() : explanationDraft();

/** Option id the prompt shows next to `text`, e.g. "c) O(log n)" → "c". */
export function optionIdFor(prompt: string, text: string): string {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\b([a-d])\\) ${escaped}`).exec(prompt);
  if (!match) throw new Error(`Option "${text}" not found in prompt`);
  return match[1];
}

/** Validator that blind-solves correctly (MCQ) or approves (explanation). */
export const validateCorrectly: GenerateHandler = (call) =>
  call.schemaKeys.includes('chosenOptionId')
    ? {
        chosenOptionId: optionIdFor(call.promptText, CORRECT_TEXT),
        confidence: 0.95,
        issues: [],
      }
    : { valid: true, issues: [] };

/** Validator that disagrees with the answer key. */
export const validateWrongly: GenerateHandler = (call) => ({
  chosenOptionId: optionIdFor(call.promptText, 'O(n)'),
  confidence: 0.7,
  issues: [{ kind: 'ambiguous', detail: 'Average vs worst case unclear.' }],
});

export const usageChunk = {
  type: 'finish',
  finishReason: { unified: 'stop', raw: undefined },
  usage,
};
