import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AppConfigModule } from './config/app-config.module.js';
import { HealthModule } from './health/health.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { QuizModule } from './quiz/quiz.module.js';
import { SyllabusModule } from './syllabus/syllabus.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    HealthModule,
    SyllabusModule,
    QuizModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
