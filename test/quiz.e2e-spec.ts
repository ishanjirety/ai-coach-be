import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { QuizTokenService } from '../src/common/crypto/quiz-token.service.js';
import { LlmService } from '../src/llm/llm.service.js';
import {
  CORRECT_TEXT,
  generateByType,
  mcqDraft,
  MockLlm,
  optionIdFor,
  usageChunk,
  validateCorrectly,
  validateWrongly,
} from './mock-llm.js';

const TOPIC = 'binary-search';

describe('Quiz API (e2e)', () => {
  let app: INestApplication<App>;
  const llm = new MockLlm();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Only model construction is replaced; task routing, retries, validation
    // and logging all run for real.
    vi.spyOn(app.get(LlmService), 'createModel').mockImplementation(
      llm.createModel,
    );
  });

  beforeEach(() => {
    llm.reset();
    llm.generate['question-generate'] = generateByType;
    llm.generate['question-validate'] = validateCorrectly;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  interface IssuedQuestion {
    question: {
      id: string;
      type: string;
      difficulty: string;
      prompt: string;
      conceptIds: string[];
      options?: { id: string; text: string }[];
    };
    questionToken: string;
    index: number;
  }

  const questions = (body: Record<string, unknown> = {}) =>
    http()
      .post('/api/quiz/questions')
      .send({
        topicId: TOPIC,
        difficulty: 'medium',
        totalQuestions: 5,
        count: 1,
        resultTokens: [],
        issuedQuestionTokens: [],
        ...body,
      });

  /** Requests a batch of one and returns its single question. */
  const one = async (
    body: Record<string, unknown> = {},
  ): Promise<IssuedQuestion> => {
    const res = await questions({ ...body, count: 1 }).expect(200);
    expect(res.body.questions).toHaveLength(1);
    return res.body.questions[0];
  };

  // -------------------------------------------------------------------------
  describe('GET /api/syllabus/topics', () => {
    it('lists topics with public concept fields only', async () => {
      const res = await http().get('/api/syllabus/topics').expect(200);
      expect(res.body.topics).toHaveLength(18);
      const topic = res.body.topics.find((t: { id: string }) => t.id === TOPIC);
      expect(topic).toMatchObject({ id: TOPIC, name: 'Binary Search' });
      expect(Object.keys(topic.concepts[0]).sort()).toEqual(['id', 'name']);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors', () => {
    it('rejects a malformed questions body with issues', async () => {
      const res = await questions({ totalQuestions: 7 }).expect(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        message: 'Validation failed',
      });
      expect(res.body.requestId).toBeTruthy();
      expect(res.body.issues.fieldErrors.totalQuestions).toBeDefined();
    });

    it('rejects an unknown topic', async () => {
      const res = await questions({ topicId: 'nope' }).expect(400);
      expect(res.body.message).toBe('Unknown topicId "nope"');
    });

    it('rejects focus concepts from another topic', async () => {
      const res = await questions({
        focusConceptIds: ['graphs.bfs'],
      }).expect(400);
      expect(res.body.message).toMatch(/Unknown concept id/);
    });

    it('rejects a tampered or wrong-kind token', async () => {
      const res = await http()
        .post('/api/quiz/evaluate')
        .send({
          questionToken: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          answer: { skipped: true },
        })
        .expect(400);
      expect(res.body.message).toMatch(
        /Invalid questionToken: it was modified/,
      );

      const body = await one();
      const evaluated = await http()
        .post('/api/quiz/evaluate')
        .send({ questionToken: body.questionToken, answer: { skipped: true } })
        .expect(200);
      const wrongKind = await http()
        .post('/api/quiz/evaluate')
        .send({
          questionToken: evaluated.body.resultToken,
          answer: { skipped: true },
        })
        .expect(400);
      expect(wrongKind.body.message).toMatch(/expected a question token/);
    });

    it('rejects an answer with more than one shape', async () => {
      await http()
        .post('/api/quiz/evaluate')
        .send({ questionToken: 'abc', answer: { optionId: 'a', text: 'x' } })
        .expect(400);
    });

    it('rejects chat with a system message', async () => {
      await http()
        .post('/api/quiz/chat')
        .send({
          topicId: TOPIC,
          answered: false,
          messages: [
            { id: '1', role: 'system', parts: [{ type: 'text', text: 'hi' }] },
          ],
        })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /api/quiz/questions (batches)', () => {
    const evaluate = async (questionToken: string, answer: object) =>
      (
        await http()
          .post('/api/quiz/evaluate')
          .send({ questionToken, answer })
          .expect(200)
      ).body as { resultToken: string };

    const correctOption = (q: IssuedQuestion) =>
      q.question.options!.find((o) => o.text === CORRECT_TEXT)!.id;

    it('returns a batch of 3 with distinct concepts and contiguous indexes', async () => {
      const res = await questions({ count: 3 }).expect(200);
      const batch = res.body.questions as IssuedQuestion[];

      expect(res.body.total).toBe(5);
      expect(batch.map((q) => q.index)).toEqual([1, 2, 3]);
      expect(batch.map((q) => q.question.conceptIds[0])).toEqual([
        'binary-search.classic',
        'binary-search.boundaries',
        'binary-search.loop-invariants',
      ]);
      // Every 3rd question (absolute position) is an explanation.
      expect(batch.map((q) => q.question.type)).toEqual([
        'mcq',
        'mcq',
        'explanation',
      ]);
      expect(new Set(batch.map((q) => q.question.id)).size).toBe(3);
      // Generated and validated per slot.
      expect(llm.callsFor('question-generate')).toHaveLength(3);
      expect(llm.callsFor('question-validate')).toHaveLength(3);
      expect(JSON.stringify(res.body)).not.toContain('correctOptionId');
    });

    it('continues after issued and graded questions without repeating concepts', async () => {
      const first = (await questions({ count: 3 }).expect(200)).body
        .questions as IssuedQuestion[];
      const r1 = await evaluate(first[0].questionToken, {
        optionId: correctOption(first[0]),
      });
      llm.calls.length = 0;

      const res = await questions({
        count: 3,
        resultTokens: [r1.resultToken],
        // q1 is both graded and issued (the result wins); q2 is sent twice.
        issuedQuestionTokens: [
          first[0].questionToken,
          first[1].questionToken,
          first[1].questionToken,
          first[2].questionToken,
        ],
      }).expect(200);
      const batch = res.body.questions as IssuedQuestion[];

      // 1 graded + 2 issued = 3 used, so count is clamped to the 2 left.
      expect(batch.map((q) => q.index)).toEqual([4, 5]);
      const earlier = first.map((q) => q.question.conceptIds[0]);
      for (const q of batch) {
        expect(earlier).not.toContain(q.question.conceptIds[0]);
      }
      expect(new Set(batch.map((q) => q.question.conceptIds[0])).size).toBe(2);
      // Difficulty adapts from the graded (correct) answer only.
      expect(batch.map((q) => q.question.difficulty)).toEqual(['hard', 'hard']);
      // Stems of graded and issued questions are passed on to avoid repeats.
      const prompt = llm.callsFor('question-generate')[0].promptText;
      expect(prompt).toContain('Questions already asked in this quiz');
      expect(prompt).toContain(
        'Explain in your own words why binary search needs sorted input.',
      );
    });

    it('returns 409 once every question has been issued', async () => {
      const a = (await questions({ count: 3 }).expect(200)).body
        .questions as IssuedQuestion[];
      const b = (
        await questions({
          count: 3,
          issuedQuestionTokens: a.map((q) => q.questionToken),
        }).expect(200)
      ).body.questions as IssuedQuestion[];
      expect(b.map((q) => q.index)).toEqual([4, 5]);

      const res = await questions({
        count: 1,
        issuedQuestionTokens: [...a, ...b].map((q) => q.questionToken),
      }).expect(409);
      expect(res.body.message).toMatch(/quiz is complete/);
    });

    it('returns the slots that succeeded when one fails', async () => {
      llm.generate['question-generate'] = (call) =>
        call.promptText.includes('[id: binary-search.boundaries]')
          ? mcqDraft({ correctOptionId: 'Z' })
          : generateByType(call);

      const res = await questions({ count: 3 }).expect(200);
      const batch = res.body.questions as IssuedQuestion[];
      expect(batch.map((q) => q.index)).toEqual([1, 2]);
      expect(batch.map((q) => q.question.conceptIds[0])).toEqual([
        'binary-search.classic',
        'binary-search.loop-invariants',
      ]);
    });

    it('returns 502 only when every slot fails', async () => {
      // Fails both the MCQ and the explanation schema.
      llm.generate['question-generate'] = () => ({ prompt: '' });
      const res = await questions({ count: 3 }).expect(502);
      expect(res.body.message).toBe('Coach unavailable, please try again');
      // 3 slots x (attempt + rotated retry).
      expect(llm.callsFor('question-generate')).toHaveLength(6);
    });

    it('rejects issued tokens of the wrong kind or topic', async () => {
      const q = await one();
      const r = await evaluate(q.questionToken, { skipped: true });

      const wrongKind = await questions({
        issuedQuestionTokens: [r.resultToken],
      }).expect(400);
      expect(wrongKind.body.message).toBe(
        'Invalid issuedQuestionTokens[0]: expected a question token but got a result token.',
      );

      const wrongTopic = await questions({
        topicId: 'graphs',
        issuedQuestionTokens: [q.questionToken],
      }).expect(400);
      expect(wrongTopic.body.message).toMatch(/different topic/);
    });

    it('validates count', async () => {
      await questions({ count: 0 }).expect(400);
      await questions({ count: 4 }).expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('questions → evaluate → report', () => {
    it('runs a full 3-question quiz', async () => {
      llm.generate['answer-evaluate'] = () => ({
        verdict: 'partial',
        score: 0.5,
        feedback: 'You have the right idea but missed why order matters.',
        missedPoints: ['That inference only holds when the input is sorted'],
      });
      llm.generate['report-generate'] = (call) => {
        expect(call.promptText).toContain('Score: ');
        return {
          summary: 'A solid start on binary search.',
          strengths: ['You know the complexity of classic binary search.'],
          weaknesses: ['Explaining why sorted input is needed.'],
          improvementPlan: [
            {
              conceptId: 'binary-search.boundaries',
              why: 'Not covered yet.',
              whatToStudy: ['Lower vs upper bound'],
              practiceIdeas: ['Search Insert Position'],
            },
          ],
          nextSteps: ['Practise lower-bound searches.'],
        };
      };

      // Q1: MCQ. The public question must not leak the answer key.
      const q1 = await one();
      expect(q1.index).toBe(1);
      expect(q1.question).toMatchObject({
        type: 'mcq',
        difficulty: 'medium',
        conceptIds: ['binary-search.classic'],
      });
      expect(q1.question.options!.map((o) => o.id)).toEqual([
        'a',
        'b',
        'c',
        'd',
      ]);
      const leaked = JSON.stringify(q1.question);
      for (const secret of [
        'correctOptionId',
        'rubric',
        'hints',
        'referenceAnswer',
        'explanation',
      ]) {
        expect(leaked).not.toContain(secret);
      }
      expect(JSON.stringify(q1)).not.toContain('Each step halves the range');

      const correctId = q1.question.options!.find(
        (o) => o.text === CORRECT_TEXT,
      )!.id;
      const e1 = await http()
        .post('/api/quiz/evaluate')
        .send({
          questionToken: q1.questionToken,
          answer: { optionId: correctId },
        })
        .expect(200);
      expect(e1.body.evaluation).toMatchObject({
        verdict: 'correct',
        score: 1,
        correctOptionId: correctId,
        missedPoints: [],
      });
      expect(e1.body.evaluation.feedback).toMatch(/^Correct!/);
      // MCQs are graded in code.
      expect(llm.callsFor('answer-evaluate')).toHaveLength(0);

      // Q2: next concept, one step harder after a correct answer.
      const q2 = await one({
        resultTokens: [e1.body.resultToken],
      });
      expect(q2.index).toBe(2);
      expect(q2.question).toMatchObject({
        type: 'mcq',
        difficulty: 'hard',
        conceptIds: ['binary-search.boundaries'],
      });
      // The generator is told what was already asked.
      expect(llm.callsFor('question-generate').at(-1)!.promptText).toContain(
        'What is the worst-case time complexity of binary search?',
      );
      const e2 = await http()
        .post('/api/quiz/evaluate')
        .send({
          questionToken: q2.questionToken,
          answer: { skipped: true },
        })
        .expect(200);
      expect(e2.body.evaluation).toMatchObject({
        verdict: 'skipped',
        score: 0,
      });
      expect(e2.body.evaluation.correctOptionId).toBeDefined();

      // Q3: every third question is an explanation; back to medium.
      const tokens = [e1.body.resultToken, e2.body.resultToken];
      const q3 = await one({ resultTokens: tokens });
      expect(q3.question).toMatchObject({
        type: 'explanation',
        difficulty: 'medium',
      });
      expect(q3.question.options).toBeUndefined();

      // Wrong answer shape for the question type → 400.
      await http()
        .post('/api/quiz/evaluate')
        .send({
          questionToken: q3.questionToken,
          answer: { optionId: 'a' },
        })
        .expect(400);

      const e3 = await http()
        .post('/api/quiz/evaluate')
        .send({
          questionToken: q3.questionToken,
          answer: { text: 'Because you compare with the middle element.' },
        })
        .expect(200);
      expect(e3.body.evaluation).toMatchObject({
        verdict: 'partial',
        score: 0.5,
        missedPoints: ['That inference only holds when the input is sorted'],
      });
      expect(e3.body.evaluation.correctOptionId).toBeUndefined();
      const gradeCall = llm.callsFor('answer-evaluate')[0];
      expect(gradeCall.promptText).toContain('<learner_answer>');

      // Report: score and coverage computed in code.
      const report = await http()
        .post('/api/quiz/report')
        .send({
          topicId: TOPIC,
          difficulty: 'medium',
          // A duplicate token must not count twice.
          resultTokens: [...tokens, e3.body.resultToken, e1.body.resultToken],
        })
        .expect(200);

      // (1.5*1 + 2*0 + 1.5*0.5) / (1.5 + 2 + 1.5) = 2.25 / 5 = 45%
      expect(report.body.score).toEqual({
        percent: 45,
        correct: 1,
        partial: 1,
        incorrect: 0,
        skipped: 1,
        total: 3,
      });
      const coverage = Object.fromEntries(
        report.body.coverage.map((c: { conceptId: string; status: string }) => [
          c.conceptId,
          c.status,
        ]),
      );
      expect(coverage['binary-search.classic']).toBe('strong');
      expect(coverage['binary-search.boundaries']).toBe('weak');
      expect(coverage['binary-search.rotated-array']).toBe('not-covered');
      expect(report.body.coverage).toHaveLength(7);

      // One plan entry per weak/not-covered concept, weak first.
      const planIds = report.body.improvementPlan.map(
        (p: { conceptId: string }) => p.conceptId,
      );
      const needsWork = report.body.coverage
        .filter((c: { status: string }) => c.status !== 'strong')
        .map((c: { conceptId: string }) => c.conceptId);
      expect(new Set(planIds)).toEqual(new Set(needsWork));
      expect(report.body.improvementPlan[0]).toMatchObject({
        conceptId: 'binary-search.boundaries',
        name: 'Lower & upper bound',
        why: 'Not covered yet.',
      });
      expect(report.body).toMatchObject({
        summary: 'A solid start on binary search.',
        nextSteps: ['Practise lower-bound searches.'],
      });
    });

    it('limits questions to focusConceptIds', async () => {
      const res = await one({
        focusConceptIds: ['binary-search.on-answer'],
      });
      expect(res.question.conceptIds).toEqual(['binary-search.on-answer']);
    });

    it('rejects result tokens from another topic', async () => {
      const q = await one();
      const e = await http()
        .post('/api/quiz/evaluate')
        .send({
          questionToken: q.questionToken,
          answer: { skipped: true },
        })
        .expect(200);
      const res = await http()
        .post('/api/quiz/report')
        .send({
          topicId: 'graphs',
          difficulty: 'easy',
          resultTokens: [e.body.resultToken],
        })
        .expect(400);
      expect(res.body.message).toMatch(/different topic/);
    });
  });

  // -------------------------------------------------------------------------
  describe('generation fallbacks and blind-solve validation', () => {
    it('retries an invalid draft once on the rotated chain', async () => {
      llm.generate['question-generate'] = (call) =>
        call.index === 0
          ? mcqDraft({ options: mcqDraft().options.slice(0, 3) })
          : mcqDraft();

      await one();
      const calls = llm.callsFor('question-generate');
      expect(calls.map((c) => c.modelId)).toEqual([
        'test/generate',
        'test/generate-fallback',
      ]);
      // Layer 1: the OpenRouter fallback list is sent with the call.
      expect(calls[0].options.providerOptions?.openrouter).toMatchObject({
        models: ['test/generate-fallback'],
        provider: { require_parameters: true, allow_fallbacks: true },
      });
    });

    it('returns 502 when every generation attempt is invalid', async () => {
      llm.generate['question-generate'] = () =>
        mcqDraft({ correctOptionId: 'Z' });
      const res = await questions().expect(502);
      expect(res.body.message).toBe('Coach unavailable, please try again');
      expect(llm.callsFor('question-generate')).toHaveLength(2);
    });

    it('validator never sees the answer key', async () => {
      await one();
      const [validation] = llm.callsFor('question-validate');
      expect(validation.promptText).toContain(CORRECT_TEXT);
      expect(validation.promptText).not.toContain('Each step halves the range');
      expect(validation.promptText).not.toContain('That is a linear scan');
      expect(validation.promptText).not.toContain(mcqDraft().referenceAnswer);
    });

    it('regenerates with feedback after a rejection, then accepts', async () => {
      llm.generate['question-validate'] = (call) =>
        call.index === 0 ? validateWrongly(call) : validateCorrectly(call);

      await one();
      const generations = llm.callsFor('question-generate');
      expect(generations).toHaveLength(2);
      expect(generations[1].promptText).toContain(
        'rejected your previous draft',
      );
      expect(generations[1].promptText).toContain(
        'ambiguous: Average vs worst case unclear.',
      );
      expect(llm.callsFor('question-validate')).toHaveLength(2);
    });

    it('returns 502 when the question is rejected twice', async () => {
      llm.generate['question-validate'] = validateWrongly;
      const res = await questions().expect(502);
      expect(res.body.message).toBe('Coach unavailable, please try again');
      expect(llm.callsFor('question-generate')).toHaveLength(2);
    });

    it('fails open when the validator is down', async () => {
      llm.generate['question-validate'] = () => {
        throw new Error('validator outage');
      };
      const res = await one();
      expect(res.question.type).toBe('mcq');
      // Both validator attempts ran (primary, then rotated), then skipped.
      expect(llm.callsFor('question-validate').map((c) => c.modelId)).toEqual([
        'test/validate',
        'test/validate-fallback',
      ]);
    });

    it('returns 502 when answer grading fails on every attempt', async () => {
      llm.generate['answer-evaluate'] = () => {
        throw new Error('down');
      };
      const questionToken = app.get(QuizTokenService).seal('question', {
        id: 'q-x',
        topicId: TOPIC,
        type: 'explanation',
        prompt: 'Explain binary search.',
        difficulty: 'easy',
        conceptIds: ['binary-search.classic'],
        referenceAnswer: 'It halves the range.',
        rubric: ['halves the range'],
        hints: ['a', 'b', 'c'],
      });
      const res = await http()
        .post('/api/quiz/evaluate')
        .send({ questionToken, answer: { text: 'my answer' } })
        .expect(502);
      expect(res.body.message).toBe('Coach unavailable, please try again');
      expect(llm.callsFor('answer-evaluate').map((c) => c.modelId)).toEqual([
        'test/evaluate',
        'test/evaluate-fallback',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /api/quiz/chat', () => {
    const chat = (body: Record<string, unknown>) =>
      http()
        .post('/api/quiz/chat')
        .send({
          topicId: TOPIC,
          answered: false,
          messages: [
            {
              id: 'm1',
              role: 'user',
              parts: [{ type: 'text', text: 'Can I get a hint?' }],
            },
          ],
          ...body,
        });

    it('streams a giveHint tool call and a follow-up answer', async () => {
      const q = await one();
      llm.stream = (call) =>
        call.index === 0
          ? [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'giveHint',
                input: '{"level":1}',
              },
              {
                ...usageChunk,
                finishReason: { unified: 'tool-calls', raw: undefined },
              },
            ]
          : [
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'Think about the range.' },
              { type: 'text-end', id: 't1' },
              usageChunk,
            ];

      const res = await chat({ questionToken: q.questionToken }).expect(200);
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      expect(res.text).toContain('"toolName":"giveHint"');
      expect(res.text).toContain('Think about how the search range changes.');
      expect(res.text).toContain('Think about the range.');

      // While unanswered, the system prompt carries no answer key.
      const system = llm.callsFor('coach-chat')[0].promptText;
      expect(system).toContain('has NOT answered it yet');
      expect(system).not.toContain('Correct option');
      expect(system).not.toContain('Each step halves the range');
      expect(system).not.toContain(mcqDraft().referenceAnswer);
    });

    it('includes the answer key once the question is answered', async () => {
      const q = await one();
      llm.stream = () => [
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Here is why.' },
        { type: 'text-end', id: 't1' },
        usageChunk,
      ];
      await chat({
        questionToken: q.questionToken,
        answered: true,
      }).expect(200);
      const system = llm.callsFor('coach-chat')[0].promptText;
      const correctId = optionIdFor(system, CORRECT_TEXT);
      expect(system).toContain(`Correct option: ${correctId}) ${CORRECT_TEXT}`);
    });

    it('rejects an unknown topic before streaming', async () => {
      const res = await chat({ topicId: 'nope' }).expect(400);
      expect(res.body.message).toBe('Unknown topicId "nope"');
    });

    it('rejects more than 100 messages', async () => {
      const messages = Array.from({ length: 101 }, (_, i) => ({
        id: `m${i}`,
        role: 'user',
        parts: [{ type: 'text', text: 'hi' }],
      }));
      await chat({ messages }).expect(400);
    });
  });
});
