import { z } from 'zod';

export const ERROR_CODES = [
  'BAD_REQUEST',
  'NOT_FOUND',
  'PLACE_NOT_FOUND',
  'POLICY_NOT_FOUND',
  'POLICY_EXISTS',
  'NOT_A_PET_VENUE',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Every API error has this shape; the app maps the code to a translated message. */
export const errorResponseSchema = z.object({
  error: z.object({ code: z.enum(ERROR_CODES) }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
