import { Module } from '@nestjs/common';
import { CryptoModule } from '../common/crypto/crypto.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { SyllabusModule } from '../syllabus/syllabus.module.js';
import { AnswerEvaluatorService } from './answer-evaluator.service.js';
import { CoachChatService } from './coach-chat.service.js';
import { QuestionGeneratorService } from './question-generator.service.js';
import { QuizController } from './quiz.controller.js';
import { QuizService } from './quiz.service.js';
import { ReportGeneratorService } from './report-generator.service.js';

@Module({
  imports: [LlmModule, CryptoModule, SyllabusModule],
  controllers: [QuizController],
  providers: [
    QuizService,
    QuestionGeneratorService,
    AnswerEvaluatorService,
    ReportGeneratorService,
    CoachChatService,
  ],
})
export class QuizModule {}
