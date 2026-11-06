import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfigService } from '../config/app-config.service.js';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Centralised logging. Wraps nestjs-pino so the rest of the app only ever
 * imports `Logger` / `PinoLogger` from 'nestjs-pino' and never configures it.
 *
 * - Every HTTP request gets a request id (honours an incoming x-request-id),
 *   which is echoed back in the response and attached to every log line
 *   written while handling that request.
 * - Pretty output in development, JSON in production.
 * - Sensitive headers are redacted.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const pretty = config.get('LOG_PRETTY') ?? !config.isProduction;

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL'),
            transport: pretty
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const incoming = req.headers[REQUEST_ID_HEADER];
              const id =
                (Array.isArray(incoming) ? incoming[0] : incoming) ??
                randomUUID();
              res.setHeader(REQUEST_ID_HEADER, id);
              return id;
            },
            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
            },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
