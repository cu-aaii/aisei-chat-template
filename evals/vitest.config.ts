import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// The same .env the dev server reads (`npm run server:dev` passes --env-file=.env), loaded here so
// it is in place before any test imports server/app.config.ts. Like --env-file, it never overrides
// a variable that is already set, so a key injected by CI wins over a blank one in a local .env.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['evals/**/*.test.ts'],
  },
});
