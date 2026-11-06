import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

/**
 * Last line of defence: every thrown error ends up here, gets logged with the
 * request context, and is returned to the client in one consistent shape.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const logPayload = {
      err: exception,
      status,
      method: req.method,
      path: req.originalUrl,
    };
    if (status >= 500) {
      this.logger.error(logPayload, 'Unhandled exception');
    } else {
      this.logger.warn(logPayload, 'Request rejected');
    }

    // A streaming response may already have started; we can't send JSON then.
    if (res.headersSent) {
      res.end();
      return;
    }

    res.status(status).json({
      statusCode: status,
      requestId: req.id,
      ...(typeof body === 'string' ? { message: body } : body),
    });
  }
}
