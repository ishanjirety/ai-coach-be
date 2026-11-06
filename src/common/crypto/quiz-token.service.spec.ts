import type { AppConfigService } from '../../config/app-config.service.js';
import {
  InvalidQuizTokenException,
  QuizTokenService,
} from './quiz-token.service.js';

const makeService = (secret = 'a'.repeat(40)) =>
  new QuizTokenService({
    get: () => secret,
  } as unknown as AppConfigService);

describe('QuizTokenService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips a payload', () => {
    const service = makeService();
    const payload = { questionId: 'q1', score: 0.5, list: ['x', 'y'] };
    const token = service.seal('result', payload);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(service.open('result', token)).toEqual(payload);
  });

  it('does not reveal the payload in the token', () => {
    const token = makeService().seal('question', {
      correctOptionId: 'secret-b',
    });
    expect(Buffer.from(token, 'base64url').toString('latin1')).not.toContain(
      'secret-b',
    );
  });

  it('produces a different token each time (random IV)', () => {
    const service = makeService();
    expect(service.seal('result', { a: 1 })).not.toBe(
      service.seal('result', { a: 1 }),
    );
  });

  it('rejects a tampered token', () => {
    const service = makeService();
    const raw = Buffer.from(service.seal('result', { score: 0 }), 'base64url');
    raw[raw.length - 1] ^= 0x01;
    const tampered = raw.toString('base64url');

    expect(() => service.open('result', tampered)).toThrow(
      InvalidQuizTokenException,
    );
    expect(() => service.open('result', tampered)).toThrow(/modified/);
  });

  it('rejects garbage and truncated tokens', () => {
    const service = makeService();
    expect(() => service.open('result', 'not-a-token')).toThrow(/modified/);
    expect(() => service.open('result', '')).toThrow(/modified/);
  });

  it('rejects a token sealed with another secret', () => {
    const token = makeService('b'.repeat(40)).seal('result', { score: 1 });
    expect(() => makeService().open('result', token)).toThrow(/modified/);
  });

  it('rejects a token of the wrong kind', () => {
    const service = makeService();
    const token = service.seal('question', { id: 'q' });
    expect(() => service.open('result', token, 'resultTokens[0]')).toThrow(
      'Invalid resultTokens[0]: expected a result token but got a question token.',
    );
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const service = makeService();
    const token = service.seal('result', { score: 1 });

    vi.setSystemTime(new Date('2026-01-01T05:59:00Z'));
    expect(service.open('result', token)).toEqual({ score: 1 });

    vi.setSystemTime(new Date('2026-01-01T06:00:01Z'));
    expect(() => service.open('result', token)).toThrow(/expired/);
  });

  it('maps to a 400', () => {
    try {
      makeService().open('result', 'x');
      expect.fail('should throw');
    } catch (error) {
      expect((error as InvalidQuizTokenException).getStatus()).toBe(400);
    }
  });
});
