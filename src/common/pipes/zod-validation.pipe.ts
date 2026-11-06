import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';

/**
 * Validates and parses a value against a Zod schema.
 *
 *   @Body(new ZodValidationPipe(mySchema)) body: MyType
 */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: z.flattenError(result.error),
      });
    }
    return result.data;
  }
}
