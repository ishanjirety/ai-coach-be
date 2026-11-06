import {
  chainAcceptsTemperature,
  LLM_TASKS,
  rotateChain,
} from './llm-tasks.js';

describe('rotateChain', () => {
  it('starts the chain at the given offset, wrapping around', () => {
    expect(rotateChain(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c']);
    expect(rotateChain(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a']);
    expect(rotateChain(['a', 'b', 'c'], 4)).toEqual(['b', 'c', 'a']);
    expect(rotateChain(['a'], 1)).toEqual(['a']);
  });
});

describe('chainAcceptsTemperature', () => {
  it('is false if any model rejects temperature', () => {
    expect(
      chainAcceptsTemperature(['google/gemini-3.8-flash', 'openai/gpt-6-luna']),
    ).toBe(false);
    expect(
      chainAcceptsTemperature([
        'google/gemini-3.8-flash',
        'deepseek/deepseek-v4.1-flash',
      ]),
    ).toBe(true);
  });
});

describe('LLM_TASKS', () => {
  it('has 1-3 models and an output cap per task', () => {
    for (const config of Object.values(LLM_TASKS)) {
      expect(config.models.length).toBeGreaterThanOrEqual(1);
      expect(config.models.length).toBeLessThanOrEqual(3);
      expect(config.maxOutputTokens).toBeGreaterThan(0);
    }
  });

  it('validates questions with a different model family than it generates them', () => {
    const vendor = (slug: string) => slug.split('/')[0];
    expect(vendor(LLM_TASKS['question-validate'].models[0])).not.toBe(
      vendor(LLM_TASKS['question-generate'].models[0]),
    );
  });
});
