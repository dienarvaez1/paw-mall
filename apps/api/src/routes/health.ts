import { type HealthResponse, healthResponseSchema } from '@paw-mall/shared';
import { Hono } from 'hono';

import pkg from '../../package.json';
import { createDb } from '../db/client';
import type { AppEnv } from '../env';

/** PostGIS version when the database answers, or "unavailable". */
async function checkDatabase(connectionString: string): Promise<HealthResponse['database']> {
  const { client, close } = createDb(connectionString);
  try {
    const [row] = await client<{ postgis: string }[]>`SELECT postgis_lib_version() AS postgis`;
    return row ? { status: 'ok', postgis: row.postgis } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  } finally {
    await close().catch(() => {});
  }
}

export const healthRoute = new Hono<AppEnv>().get('/', async (c) => {
  const body: HealthResponse = healthResponseSchema.parse({
    status: 'ok',
    version: pkg.version,
    database: await checkDatabase(c.env.DATABASE_URL),
  });
  return c.json(body);
});
