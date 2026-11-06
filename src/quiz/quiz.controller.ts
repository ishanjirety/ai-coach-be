import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { pipeUIMessageStreamToResponse } from 'ai';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CoachChatService } from './coach-chat.service.js';
import {
  type ChatRequest,
  chatRequestSchema,
  type EvaluateRequest,
  evaluateRequestSchema,
  type EvaluateResponse,
  type QuestionsRequest,
  questionsRequestSchema,
  type QuestionsResponse,
  type ReportRequest,
  reportRequestSchema,
  type ReportResponse,
} from './quiz.contract.js';
import { QuizService } from './quiz.service.js';

/** Aborts in-flight LLM work (and its cost) when the client goes away. */
function abortOnClose(res: Response): AbortSignal {
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) abort.abort();
  });
  return abort.signal;
}

@Controller('quiz')
export class QuizController {
  constructor(
    private readonly quiz: QuizService,
    private readonly coach: CoachChatService,
  ) {}

  @Post('questions')
  @HttpCode(200)
  questions(
    @Body(new ZodValidationPipe(questionsRequestSchema))
    body: QuestionsRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<QuestionsResponse> {
    return this.quiz.questions(body, abortOnClose(res));
  }

  @Post('evaluate')
  @HttpCode(200)
  evaluate(
    @Body(new ZodValidationPipe(evaluateRequestSchema)) body: EvaluateRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EvaluateResponse> {
    return this.quiz.evaluate(body, abortOnClose(res));
  }

  @Post('report')
  @HttpCode(200)
  report(
    @Body(new ZodValidationPipe(reportRequestSchema)) body: ReportRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse> {
    return this.quiz.report(body, abortOnClose(res));
  }

  @Post('chat')
  async chat(
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    const signal = abortOnClose(res);
    const stream = await this.coach.stream(body, signal);
    // x-request-id is already set on `res` by the logger module.
    await pipeUIMessageStreamToResponse({ response: res, stream });
  }
}
