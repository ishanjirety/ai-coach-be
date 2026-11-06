import { Controller, Get } from '@nestjs/common';
import type { TopicsResponse } from '../quiz/quiz.contract.js';
import { SyllabusService } from './syllabus.service.js';

@Controller('syllabus')
export class SyllabusController {
  constructor(private readonly syllabus: SyllabusService) {}

  /** Public view: concept descriptions stay server-side. */
  @Get('topics')
  topics(): TopicsResponse {
    return {
      topics: this.syllabus.listTopics().map((topic) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        concepts: topic.concepts.map(({ id, name }) => ({ id, name })),
      })),
    };
  }
}
