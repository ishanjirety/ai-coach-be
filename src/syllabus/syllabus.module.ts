import { Module } from '@nestjs/common';
import { SyllabusController } from './syllabus.controller.js';
import { SyllabusService } from './syllabus.service.js';

@Module({
  controllers: [SyllabusController],
  providers: [SyllabusService],
  exports: [SyllabusService],
})
export class SyllabusModule {}
