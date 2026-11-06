import { bandScore } from './answer-evaluator.service.js';
import { buildImprovementPlan } from './report-generator.service.js';
import { computeCoverage, computeScore, type ScoredResult } from './scoring.js';

const r = (
  conceptIds: string[],
  difficulty: ScoredResult['difficulty'],
  verdict: ScoredResult['verdict'],
  score: number,
): ScoredResult => ({ conceptIds, difficulty, verdict, score });

describe('computeScore', () => {
  it('is zero for no results', () => {
    expect(computeScore([])).toEqual({
      percent: 0,
      correct: 0,
      partial: 0,
      incorrect: 0,
      skipped: 0,
      total: 0,
    });
  });

  it('weights scores by difficulty (easy 1, medium 1.5, hard 2)', () => {
    // (1*1 + 1.5*0 + 2*0.5) / (1 + 1.5 + 2) = 2 / 4.5 = 44.4%
    const score = computeScore([
      r(['a'], 'easy', 'correct', 1),
      r(['b'], 'medium', 'incorrect', 0),
      r(['c'], 'hard', 'partial', 0.5),
    ]);
    expect(score).toEqual({
      percent: 44,
      correct: 1,
      partial: 1,
      incorrect: 1,
      skipped: 0,
      total: 3,
    });
  });

  it('counts skips as zero', () => {
    const score = computeScore([
      r(['a'], 'hard', 'correct', 1),
      r(['a'], 'hard', 'skipped', 0),
    ]);
    expect(score.percent).toBe(50);
    expect(score.skipped).toBe(1);
  });

  it('clamps out-of-range scores', () => {
    expect(computeScore([r(['a'], 'easy', 'correct', 7)]).percent).toBe(100);
  });
});

describe('computeCoverage', () => {
  const concepts = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ];

  it('marks strong (>= 0.7), weak (< 0.7) and not-covered', () => {
    const coverage = computeCoverage(concepts, [
      r(['a'], 'easy', 'correct', 1),
      r(['a'], 'easy', 'partial', 0.4),
      r(['b'], 'easy', 'partial', 0.6),
    ]);
    expect(coverage).toEqual([
      {
        conceptId: 'a',
        name: 'A',
        status: 'strong',
        questionsAsked: 2,
        averageScore: 0.7,
      },
      {
        conceptId: 'b',
        name: 'B',
        status: 'weak',
        questionsAsked: 1,
        averageScore: 0.6,
      },
      {
        conceptId: 'c',
        name: 'C',
        status: 'not-covered',
        questionsAsked: 0,
        averageScore: null,
      },
    ]);
  });

  it('counts a multi-concept question toward each concept', () => {
    const coverage = computeCoverage(concepts, [
      r(['a', 'b'], 'medium', 'correct', 1),
    ]);
    expect(coverage.map((c) => c.questionsAsked)).toEqual([1, 1, 0]);
  });
});

describe('buildImprovementPlan', () => {
  const topic = {
    id: 't',
    name: 'T',
    description: '',
    concepts: [
      { id: 'a', name: 'A', description: 'desc A' },
      { id: 'b', name: 'B', description: 'desc B' },
      { id: 'c', name: 'C', description: 'desc C' },
    ],
  };
  const coverage = computeCoverage(topic.concepts, [
    r(['a'], 'easy', 'correct', 1),
    r(['b'], 'easy', 'incorrect', 0),
  ]);

  it('covers every weak and not-covered concept, weak first', () => {
    const plan = buildImprovementPlan(topic, coverage, {
      improvementPlan: [
        {
          conceptId: 'c',
          why: 'not asked',
          whatToStudy: ['x'],
          practiceIdeas: ['y'],
        },
      ],
    });
    expect(plan.map((p) => p.conceptId)).toEqual(['b', 'c']);
    expect(plan[1]).toEqual({
      conceptId: 'c',
      name: 'C',
      why: 'not asked',
      whatToStudy: ['x'],
      practiceIdeas: ['y'],
    });
    // b had no LLM entry: falls back to the syllabus description.
    expect(plan[0].whatToStudy).toEqual(['desc B']);
  });

  it('drops entries for unknown concepts and keeps advice on strong ones', () => {
    const plan = buildImprovementPlan(topic, coverage, {
      improvementPlan: [
        { conceptId: 'zzz', why: '?', whatToStudy: [], practiceIdeas: [] },
        {
          conceptId: 'a',
          why: 'go deeper',
          whatToStudy: ['p'],
          practiceIdeas: ['q'],
        },
      ],
    });
    expect(plan.map((p) => p.conceptId)).toEqual(['b', 'c', 'a']);
  });
});

describe('bandScore', () => {
  it('keeps the score consistent with the verdict', () => {
    expect(bandScore({ verdict: 'correct', score: 0.5 })).toBe(0.8);
    expect(bandScore({ verdict: 'partial', score: 0.95 })).toBe(0.79);
    expect(bandScore({ verdict: 'incorrect', score: 0.6 })).toBe(0.29);
    expect(bandScore({ verdict: 'partial', score: 0.555 })).toBe(0.56);
    expect(bandScore({ verdict: 'correct', score: Number.NaN })).toBe(0.8);
  });
});
