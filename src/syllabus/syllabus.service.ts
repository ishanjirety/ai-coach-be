import { BadRequestException, Injectable } from '@nestjs/common';
import {
  SYLLABUS,
  type SyllabusConcept,
  type SyllabusTopic,
} from './syllabus.data.js';

/** Read-only lookups over the static syllabus. */
@Injectable()
export class SyllabusService {
  private readonly topics = new Map<string, SyllabusTopic>(
    SYLLABUS.map((topic) => [topic.id, topic]),
  );
  private readonly concepts = new Map<string, SyllabusConcept>(
    SYLLABUS.flatMap((topic) => topic.concepts).map((c) => [c.id, c]),
  );

  listTopics(): readonly SyllabusTopic[] {
    return SYLLABUS;
  }

  findTopic(topicId: string): SyllabusTopic | undefined {
    return this.topics.get(topicId);
  }

  findConcept(conceptId: string): SyllabusConcept | undefined {
    return this.concepts.get(conceptId);
  }

  /** The topic, or a 400 naming the unknown id. */
  getTopicOrThrow(topicId: string): SyllabusTopic {
    const topic = this.findTopic(topicId);
    if (!topic) {
      throw new BadRequestException(`Unknown topicId "${topicId}"`);
    }
    return topic;
  }

  /** Throws a 400 if any id is not a concept of the topic. */
  assertConceptsInTopic(topic: SyllabusTopic, conceptIds: string[]): void {
    const allowed = new Set(topic.concepts.map((c) => c.id));
    const unknown = conceptIds.filter((id) => !allowed.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown concept id(s) for topic "${topic.id}": ${unknown.join(', ')}`,
      );
    }
  }
}
