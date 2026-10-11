import type { Bindings } from '../src/env';
import { TEST_DATABASE_URL } from './test-db';

export { TEST_DATABASE_URL };

export const testEnv: Bindings = { DATABASE_URL: TEST_DATABASE_URL };
