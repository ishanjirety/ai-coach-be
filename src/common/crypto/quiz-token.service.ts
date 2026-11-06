import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';

/** What a token carries. A token of one kind is never accepted as another. */
export type QuizTokenKind = 'question' | 'result';

const TOKEN_VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
/** Binds every ciphertext to this purpose, so the key can't be reused elsewhere. */
const AAD = Buffer.from(`dsa-coach/quiz-token/v${TOKEN_VERSION}`);

interface Envelope<T> {
  v: number;
  k: QuizTokenKind;
  /** Expiry, ms since epoch. */
  exp: number;
  d: T;
}

/** Thrown for any token the server won't accept. Always a 400. */
export class InvalidQuizTokenException extends BadRequestException {}

/**
 * Seals quiz state into opaque, tamper-proof tokens so the backend can stay
 * stateless without trusting the client:
 *
 *   token = base64url( iv[12] | authTag[16] | AES-256-GCM(json envelope) )
 *
 * GCM authenticates the ciphertext, so any edit fails to open. The envelope
 * carries a version, the token kind and an expiry.
 */
@Injectable()
export class QuizTokenService {
  private readonly key: Buffer;

  constructor(config: AppConfigService) {
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        config.get('QUIZ_TOKEN_SECRET'),
        'dsa-coach',
        'quiz-token-key',
        32,
      ),
    );
  }

  seal<T>(kind: QuizTokenKind, payload: T, ttlMs = DEFAULT_TTL_MS): string {
    const envelope: Envelope<T> = {
      v: TOKEN_VERSION,
      k: kind,
      exp: Date.now() + ttlMs,
      d: payload,
    };
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(AAD);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(envelope), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
      'base64url',
    );
  }

  /**
   * Opens a token of the expected kind. `label` names the field in error
   * messages, e.g. "resultTokens[2]".
   */
  open<T>(kind: QuizTokenKind, token: string, label = `${kind} token`): T {
    const envelope = this.decrypt(token, label);

    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      envelope.v !== TOKEN_VERSION
    ) {
      throw new InvalidQuizTokenException(
        `Invalid ${label}: unsupported token version. Please start a new quiz.`,
      );
    }
    if (envelope.k !== kind) {
      throw new InvalidQuizTokenException(
        `Invalid ${label}: expected a ${kind} token but got a ${String(envelope.k)} token.`,
      );
    }
    if (typeof envelope.exp !== 'number' || envelope.exp <= Date.now()) {
      throw new InvalidQuizTokenException(
        `Invalid ${label}: it has expired. Please start a new quiz.`,
      );
    }
    return envelope.d as T;
  }

  private decrypt(token: string, label: string): Envelope<unknown> {
    try {
      const raw = Buffer.from(token, 'base64url');
      if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error('too short');

      const iv = raw.subarray(0, IV_BYTES);
      const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
      const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAAD(AAD);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plaintext) as Envelope<unknown>;
    } catch {
      throw new InvalidQuizTokenException(
        `Invalid ${label}: it was modified or not issued by this server.`,
      );
    }
  }
}
