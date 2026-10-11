import { TEST_DATABASE_URL, prepareTestDatabase } from './test-db';

/** Integration tests need the Docker database with PostGIS; fail fast with the fix if it's missing. */
export default async function setupDatabase() {
  try {
    await prepareTestDatabase();
  } catch (error) {
    const { message, code } = error as Error & { code?: string };
    throw new Error(
      `Tests need the local Postgres server with PostGIS at ${new URL(TEST_DATABASE_URL).host} (${message || code || 'connection failed'}).\n` +
        'Start it with: pnpm db:up',
    );
  }
}
