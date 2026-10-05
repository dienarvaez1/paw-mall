import type { ErrorCode, ErrorResponse } from '@paw-mall/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function errorResponse(c: Context, status: ContentfulStatusCode, code: ErrorCode) {
  const body: ErrorResponse = { error: { code } };
  return c.json(body, status);
}
