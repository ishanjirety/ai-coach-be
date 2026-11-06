import { Module } from '@nestjs/common';
import { QuizTokenService } from './quiz-token.service.js';

@Module({
  providers: [QuizTokenService],
  exports: [QuizTokenService],
})
export class CryptoModule {}
