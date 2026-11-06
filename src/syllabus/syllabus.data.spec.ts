import { SYLLABUS } from './syllabus.data.js';

describe('SYLLABUS', () => {
  it('has 18 topics with 6-10 concepts each', () => {
    expect(SYLLABUS).toHaveLength(18);
    for (const topic of SYLLABUS) {
      expect(topic.concepts.length).toBeGreaterThanOrEqual(6);
      expect(topic.concepts.length).toBeLessThanOrEqual(10);
    }
  });

  it('uses unique, topic-prefixed ids and non-trivial descriptions', () => {
    const topicIds = SYLLABUS.map((t) => t.id);
    expect(new Set(topicIds).size).toBe(topicIds.length);

    const conceptIds = SYLLABUS.flatMap((t) => t.concepts.map((c) => c.id));
    expect(new Set(conceptIds).size).toBe(conceptIds.length);

    for (const topic of SYLLABUS) {
      for (const concept of topic.concepts) {
        expect(concept.id.startsWith(`${topic.id}.`)).toBe(true);
        expect(concept.description.length).toBeGreaterThan(60);
      }
    }
  });
});
