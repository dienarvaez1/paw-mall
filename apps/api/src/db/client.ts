import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export function createDb(connectionString: string) {
  // Each request opens a small client and closes it afterwards (Workers can't share sockets).
  const client = postgres(connectionString, {
    max: 5,
    connect_timeout: 3,
    fetch_types: false,
    onnotice: () => {},
  });
  const db = drizzle(client, { casing: 'snake_case' });
  return { db, client, close: () => client.end() };
}

export type Database = ReturnType<typeof createDb>['db'];
