import type { GeneratedMcq } from './prompts/question-generator.prompt.js';
import {
  checkExplanationDraft,
  checkMcqDraft,
  decideExplanationValidation,
  decideMcqValidation,
  describeRejection,
  shuffleMcq,
  stripLeadingVerdict,
} from './question-checks.js';

const mcq = (overrides: Partial<GeneratedMcq> = {}): GeneratedMcq => ({
  prompt: 'What is the time complexity of binary search on a sorted array?',
  options: [
    { id: 'A', text: 'O(log n)', explanation: 'Halves the range.' },
    { id: 'B', text: 'O(n)', explanation: 'That is a linear scan.' },
    { id: 'C', text: 'O(n log n)', explanation: 'That is sorting.' },
    { id: 'D', text: 'O(1)', explanation: 'Needs comparisons.' },
  ],
  correctOptionId: 'A',
  referenceAnswer: 'Each step halves the search range.',
  keyPoints: ['Halving gives log n steps'],
  hints: ['Think about the range size.', 'It halves.', 'How many halvings?'],
  ...overrides,
});

describe('checkMcqDraft', () => {
  it('accepts a well-formed draft', () => {
    expect(checkMcqDraft(mcq())).toBeNull();
  });

  it('requires exactly 4 options', () => {
    expect(checkMcqDraft(mcq({ options: mcq().options.slice(0, 3) }))).toMatch(
      /exactly 4/,
    );
  });

  it('requires unique option texts and ids', () => {
    const options = mcq().options.map((o) => ({ ...o }));
    options[1].text = ' o(LOG n) ';
    expect(checkMcqDraft(mcq({ options }))).toMatch(/texts are not unique/);

    const sameIds = mcq().options.map((o) => ({ ...o, id: 'A' }));
    expect(checkMcqDraft(mcq({ options: sameIds }))).toMatch(/ids/);
  });

  it('requires the correct id to be one of the options', () => {
    expect(checkMcqDraft(mcq({ correctOptionId: 'E' }))).toMatch(
      /not one of the options/,
    );
  });

  it('rejects options that reference other options', () => {
    const options = mcq().options.map((o) => ({ ...o }));
    options[3].text = 'All of the above';
    expect(checkMcqDraft(mcq({ options }))).toMatch(/refers to other options/);
  });

  it('requires 3 hints that do not give the answer away', () => {
    expect(checkMcqDraft(mcq({ hints: ['one'] }))).toMatch(/3 hints/);

    const leaky = mcq({
      options: mcq().options.map((o, i) =>
        i === 0 ? { ...o, text: 'It runs in logarithmic time' } : o,
      ),
      hints: ['a', 'b', 'The answer: it runs in logarithmic time'],
    });
    expect(checkMcqDraft(leaky)).toMatch(/gives away/);
  });
});

describe('checkExplanationDraft', () => {
  const draft = {
    prompt: 'Explain why BFS finds shortest paths in unweighted graphs.',
    referenceAnswer: 'It explores by distance.',
    keyPoints: ['explores in layers', 'first visit is shortest'],
    hints: ['h1', 'h2', 'h3'],
  };

  it('accepts a well-formed draft', () => {
    expect(checkExplanationDraft(draft)).toBeNull();
  });

  it('needs 2-6 key points and 3 hints', () => {
    expect(checkExplanationDraft({ ...draft, keyPoints: ['x'] })).toMatch(
      /key points/,
    );
    expect(checkExplanationDraft({ ...draft, hints: [] })).toMatch(/hints/);
  });
});

describe('shuffleMcq', () => {
  it('assigns ids a-d in display order and tracks the correct option', () => {
    // random(i + 1) always returns 0: [A,B,C,D] → [B,C,D,A]
    const shuffled = shuffleMcq(mcq(), () => 0);
    expect(shuffled.options).toEqual([
      { id: 'a', text: 'O(n)' },
      { id: 'b', text: 'O(n log n)' },
      { id: 'c', text: 'O(1)' },
      { id: 'd', text: 'O(log n)' },
    ]);
    expect(shuffled.correctOptionId).toBe('d');
    expect(shuffled.optionExplanations.d).toBe('Halves the range.');
  });

  it('always keeps the correct answer and all four options', () => {
    for (let i = 0; i < 50; i++) {
      const shuffled = shuffleMcq(mcq());
      const correct = shuffled.options.find(
        (o) => o.id === shuffled.correctOptionId,
      );
      expect(correct?.text).toBe('O(log n)');
      expect(new Set(shuffled.options.map((o) => o.text)).size).toBe(4);
    }
  });
});

describe('decideMcqValidation', () => {
  it('accepts when the blind solve matches and nothing blocks', () => {
    expect(
      decideMcqValidation(
        { chosenOptionId: 'B', confidence: 0.9, issues: [] },
        'b',
      ),
    ).toEqual({ accepted: true, blockingIssues: [], answerMatched: true });
  });

  it('treats difficulty-mismatch as non-blocking', () => {
    const decision = decideMcqValidation(
      {
        chosenOptionId: 'b',
        confidence: 0.9,
        issues: [{ kind: 'difficulty-mismatch', detail: 'too easy' }],
      },
      'b',
    );
    expect(decision.accepted).toBe(true);
  });

  it('rejects when the blind solve disagrees with the key', () => {
    const decision = decideMcqValidation(
      { chosenOptionId: 'c', confidence: 0.8, issues: [] },
      'b',
    );
    expect(decision).toEqual({
      accepted: false,
      blockingIssues: [],
      answerMatched: false,
    });
    expect(describeRejection(decision, 'O(1)')).toMatch(
      /chose a different option \("O\(1\)"\)/,
    );
  });

  it('rejects on a blocking issue even when the answer matches', () => {
    const decision = decideMcqValidation(
      {
        chosenOptionId: 'b',
        confidence: 0.5,
        issues: [{ kind: 'multiple-correct', detail: 'b and c both work' }],
      },
      'b',
    );
    expect(decision.accepted).toBe(false);
    expect(describeRejection(decision)).toBe(
      '- multiple-correct: b and c both work',
    );
  });
});

describe('decideExplanationValidation', () => {
  it('accepts a valid question with only non-blocking issues', () => {
    expect(
      decideExplanationValidation({
        valid: true,
        issues: [{ kind: 'difficulty-mismatch', detail: 'easy' }],
      }).accepted,
    ).toBe(true);
  });

  it('rejects an invalid question or a blocking issue', () => {
    expect(
      decideExplanationValidation({ valid: false, issues: [] }).accepted,
    ).toBe(false);
    expect(
      decideExplanationValidation({
        valid: true,
        issues: [{ kind: 'factual-error', detail: 'wrong rubric' }],
      }).accepted,
    ).toBe(false);
  });
});

describe('stripLeadingVerdict', () => {
  it('removes a leading verdict word', () => {
    expect(stripLeadingVerdict('Incorrect. it is linear.')).toBe(
      'It is linear.',
    );
    expect(stripLeadingVerdict('Correct: halves the range')).toBe(
      'Halves the range',
    );
    expect(stripLeadingVerdict('Rightmost index wins.')).toBe(
      'Rightmost index wins.',
    );
    expect(stripLeadingVerdict('Correct.')).toBe('Correct.');
  });
});
