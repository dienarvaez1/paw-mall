import type { Bindings } from '../src/env';

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://paw:paw@localhost:5434/paw_mall';

export const testEnv: Bindings = { DATABASE_URL: TEST_DATABASE_URL };
