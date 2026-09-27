import type { FastifyError, FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { ApiErrorBody, CartIssue } from '@kafeshop/core';

/** An error that is safe to show to the client as-is. */
export class AppError extends Error {
  override name = 'AppError';

  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly extra: { fields?: Record<string, string>; issues?: CartIssue[] } = {},
  ) {
    super(message);
  }
}

export const notFound = (message = 'Nije pronađeno.') => new AppError(404, 'NOT_FOUND', message);

/** Parses input with a Zod schema, turning failures into a 400 with per-field messages. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_';
    fields[path] ??= issue.message;
  }
  throw new AppError(400, 'VALIDATION_FAILED', 'Proverite unete podatke.', { fields });
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler<FastifyError | AppError>((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ApiErrorBody = { error: { code: error.code, message: error.message, ...error.extra } };
      return reply.status(error.statusCode).send(body);
    }
    // Fastify's own client errors (bad JSON, body too large, rate limit...) carry a 4xx status code.
    const status = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (status < 500) {
      const body: ApiErrorBody = {
        error: {
          code: status === 429 ? 'RATE_LIMITED' : (error.code ?? 'BAD_REQUEST'),
          message: status === 429 ? 'Previše zahteva. Pokušajte ponovo za minut.' : error.message,
        },
      };
      return reply.status(status).send(body);
    }
    request.log.error({ err: error }, 'Unhandled error');
    const body: ApiErrorBody = {
      error: { code: 'INTERNAL', message: 'Došlo je do greške na serveru. Pokušajte ponovo.' },
    };
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'Ruta ne postoji.' } };
    return reply.status(404).send(body);
  });
}
