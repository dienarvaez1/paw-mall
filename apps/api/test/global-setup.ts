import postgres from 'postgres';

import { TEST_DATABASE_URL } from './env';

/** Integration tests need the migrated Docker database; fail fast with the fix if it's missing. */
export default async function checkDatabase() {
  const client = postgres(TEST_DATABASE_URL, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await client`SELECT postgis_lib_version()`;
  } catch (error) {
    const { message, code } = error as Error & { code?: string };
    throw new Error(
      `API tests need the local database with PostGIS (${message || code || 'connection failed'}).\n` +
        'Start it with: pnpm db:up && pnpm db:migrate',
    );
  } finally {
    await client.end();
  }
}
