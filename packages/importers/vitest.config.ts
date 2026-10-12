import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL } from '../../apps/api/test/test-db.ts';

// Same test database as the API tests (never the dev one); the API's setup creates and migrates it.
export default defineConfig({
  test: {
    globalSetup: ['../../apps/api/test/global-setup.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
});
