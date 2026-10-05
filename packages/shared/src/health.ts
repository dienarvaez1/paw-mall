import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  /** The API answers even when Postgres is down, so the app can tell the two apart. */
  database: z.discriminatedUnion('status', [
    z.object({ status: z.literal('ok'), postgis: z.string() }),
    z.object({ status: z.literal('unavailable') }),
  ]),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
