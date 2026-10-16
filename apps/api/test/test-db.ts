import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Tests run against their own database on the Docker server, never the dev one: test rows can't
 * mix with real data, and `pnpm places:*` commands can't remove test places mid-run.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://pet_helper:pet_helper@localhost:5434/pet_helper_test';

const quiet = { max: 1, connect_timeout: 3, onnotice: () => {} };
// Any constant; it keeps the API and importer test runs from migrating at the same time.
const MIGRATION_LOCK = 7_171_001;

/** Creates the test database if it's missing and applies the migrations. Safe to run in parallel. */
export async function prepareTestDatabase() {
  const name = new URL(TEST_DATABASE_URL).pathname.slice(1);
  const serverUrl = new URL(TEST_DATABASE_URL);
  serverUrl.pathname = '/postgres';
  const server = postgres(serverUrl.href, quiet);
  try {
    const [found] = await server`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (!found) {
      await server.unsafe(`CREATE DATABASE "${name}"`).catch((error: { code?: string }) => {
        // Another test run created it first.
        if (error.code !== '42P04' && error.code !== '23505') throw error;
      });
    }
  } finally {
    await server.end();
  }

  const client = postgres(TEST_DATABASE_URL, quiet);
  try {
    await client`SELECT pg_advisory_lock(${MIGRATION_LOCK})`;
    await migrate(drizzle(client), {
      migrationsFolder: join(import.meta.dirname, '../src/db/migrations'),
    });
  } finally {
    await client.end();
  }
}
