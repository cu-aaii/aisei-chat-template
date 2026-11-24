import { defineConfig } from 'vitest/config';

/**
 * The unit tests that need no gateway key: the design-system lock and raw-colour checks (scripts/) and the
 * client's logic tests (look, theme, pre-paint, logo sprite, focus ring). `npm run check` runs them.
 *
 * Explicit `include`: never the default glob, which would also pick up `dist/server/**` after a build, and never
 * `evals/`, whose `chat.test.ts` calls the paid gateway (that one is `npm run test:chat`, with its own config).
 * `environment: 'node'`: these tests assert logic and files, not rendered markup.
 */
export default defineConfig({
  // Angular's @Injectable needs the legacy decorator transform (Vite 8 transforms TS with oxc).
  oxc: { decorator: { legacy: true } },
  test: {
    include: ['scripts/**/*.test.ts', 'client/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist/**'],
    environment: 'node',
    globals: false,
  },
});
