import {
  nextDifficulty,
  nextQuestionType,
  planQuestionBatch,
  rankConcepts,
} from './adaptive-engine.js';
import type { ScoredResult } from './scoring.js';

const result = (
  conceptId: string,
  verdict: ScoredResult['verdict'],
  score = verdict === 'correct' ? 1 : verdict === 'partial' ? 0.5 : 0,
): ScoredResult => ({
  conceptIds: [conceptId],
  difficulty: 'medium',
  verdict,
  score,
});

describe('rankConcepts', () => {
  const pool = ['a', 'b', 'c', 'd'];

  it('keeps syllabus order when nothing has been asked', () => {
    expect(rankConcepts(pool, [])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts uncovered concepts first, then weak, then strong', () => {
    const results = [result('a', 'correct'), result('b', 'incorrect')];
    expect(rankConcepts(pool, results)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('orders weak concepts by fewest questions, then lowest average', () => {
    const results = [
      result('a', 'partial', 0.6),
      result('b', 'incorrect'),
      result('c', 'incorrect'),
      result('c', 'partial', 0.5),
      result('d', 'correct'),
    ];
    // a (1 q, 0.6) and b (1 q, 0) before c (2 q); b has the lower average.
    expect(rankConcepts(pool, results)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('ignores results for concepts outside the pool', () => {
    expect(rankConcepts(['a', 'b'], [result('z', 'incorrect')])).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('nextDifficulty', () => {
  it('starts at the chosen level', () => {
    expect(nextDifficulty('medium', [])).toBe('medium');
  });

  it('goes up after a correct answer and down after a miss', () => {
    expect(nextDifficulty('medium', [result('a', 'correct')])).toBe('hard');
    expect(nextDifficulty('medium', [result('a', 'incorrect')])).toBe('easy');
    expect(nextDifficulty('medium', [result('a', 'skipped')])).toBe('easy');
  });

  it('stays put after a partial answer', () => {
    expect(nextDifficulty('medium', [result('a', 'partial')])).toBe('medium');
  });

  it('never moves more than one step from the chosen level', () => {
    const streak = Array.from({ length: 5 }, () => result('a', 'correct'));
    expect(nextDifficulty('easy', streak)).toBe('medium');
    const misses = Array.from({ length: 5 }, () => result('a', 'incorrect'));
    expect(nextDifficulty('hard', misses)).toBe('medium');
  });

  it('clamps at the ends of the range and recovers immediately', () => {
    // hard can't go higher, so one miss after a correct streak steps down.
    expect(
      nextDifficulty('hard', [
        result('a', 'correct'),
        result('a', 'correct'),
        result('a', 'incorrect'),
      ]),
    ).toBe('medium');
    expect(
      nextDifficulty('easy', [
        result('a', 'incorrect'),
        result('a', 'correct'),
      ]),
    ).toBe('medium');
  });
});

describe('nextQuestionType', () => {
  it('makes every third question an explanation', () => {
    expect(Array.from({ length: 7 }, (_, i) => nextQuestionType(i))).toEqual([
      'mcq',
      'mcq',
      'explanation',
      'mcq',
      'mcq',
      'explanation',
      'mcq',
    ]);
  });
});

describe('planQuestionBatch', () => {
  const plan = (
    overrides: Partial<Parameters<typeof planQuestionBatch>[0]> = {},
  ) =>
    planQuestionBatch({
      conceptPool: ['a', 'b', 'c', 'd'],
      chosen: 'medium',
      results: [],
      issuedConceptIds: [],
      count: 3,
      ...overrides,
    });

  it('plans a fresh batch with distinct concepts and absolute positions', () => {
    expect(plan()).toEqual([
      { position: 0, conceptId: 'a', difficulty: 'medium', type: 'mcq' },
      { position: 1, conceptId: 'b', difficulty: 'medium', type: 'mcq' },
      {
        position: 2,
        conceptId: 'c',
        difficulty: 'medium',
        type: 'explanation',
      },
    ]);
  });

  it('treats issued concepts as taken and continues the positions', () => {
    const slots = plan({
      results: [result('a', 'correct')],
      issuedConceptIds: [['b'], ['c']],
      count: 2,
    });
    // d: uncovered and untaken. Then a: graded (strong) but not pending,
    // which beats doubling up on b or c while they're still unanswered.
    expect(slots.map((s) => s.conceptId)).toEqual(['d', 'a']);
    expect(slots.map((s) => s.position)).toEqual([3, 4]);
    expect(slots.map((s) => s.type)).toEqual(['mcq', 'mcq']);
  });

  it('puts weak concepts before strong ones once everything is taken', () => {
    const slots = plan({
      conceptPool: ['a', 'b'],
      results: [result('a', 'correct'), result('b', 'incorrect')],
      count: 2,
    });
    expect(slots.map((s) => s.conceptId)).toEqual(['b', 'a']);
  });

  it('adapts difficulty from graded results only', () => {
    const slots = plan({
      results: [result('a', 'correct')],
      issuedConceptIds: [['b']],
      count: 1,
    });
    expect(slots[0].difficulty).toBe('hard');
    expect(plan({ issuedConceptIds: [['a'], ['b']] })[0].difficulty).toBe(
      'medium',
    );
  });

  it('repeats concepts round-robin when the pool is smaller than the batch', () => {
    const slots = plan({ conceptPool: ['x'], count: 3 });
    expect(slots.map((s) => s.conceptId)).toEqual(['x', 'x', 'x']);
    expect(
      plan({ conceptPool: ['x', 'y'], count: 3 }).map((s) => s.conceptId),
    ).toEqual(['x', 'y', 'x']);
  });

  it('rejects an empty pool', () => {
    expect(() => plan({ conceptPool: [] })).toThrow();
  });
});
