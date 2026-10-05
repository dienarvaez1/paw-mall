export type Bindings = {
  /** Postgres connection string (wrangler.toml [vars] locally). */
  DATABASE_URL: string;
};

export type AppEnv = { Bindings: Bindings };
