import type { ErrorCode, ErrorResponse } from '@pet-helper/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

export function errorResponse(c: Context, status: ContentfulStatusCode, code: ErrorCode) {
  const body: ErrorResponse = { error: { code } };
  return c.json(body, status);
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Validates input with a shared schema; on failure the response is a 400 BAD_REQUEST. */
export function parseInput<S extends z.ZodType>(
  c: Context,
  schema: S,
  input: unknown,
): Parsed<z.infer<S>> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, response: errorResponse(c, 400, 'BAD_REQUEST') };
}
