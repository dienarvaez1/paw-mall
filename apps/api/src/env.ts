import type { Database } from './db/client';

export type Bindings = {
  /** Postgres connection string (wrangler.toml [vars] locally). */
  DATABASE_URL: string;
};

export type Variables = {
  db: Database;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
