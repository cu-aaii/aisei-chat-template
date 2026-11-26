import { describe, expect, it } from 'vitest';
import { resolveIsProduction } from './app.config.js';

// An unset NODE_ENV must fail closed (#20): production means the Secure CSRF cookie (csrf.ts) and
// no streamed model reasoning (chat.routes.ts sends reasoning only when !isProduction).
describe('resolveIsProduction', () => {
  it('treats an unset NODE_ENV as production, so no reasoning is streamed', () => {
    const isProduction = resolveIsProduction(undefined);
    expect(isProduction).toBe(true);
    expect(!isProduction).toBe(false);
  });

  it('resolves the three named modes', () => {
    expect(resolveIsProduction('production')).toBe(true);
    expect(resolveIsProduction('development')).toBe(false);
    expect(resolveIsProduction('test')).toBe(false);
  });

  it.each(['', '   ', 'prod', 'Production', ' production'])('refuses NODE_ENV=%j', (value) => {
    expect(() => resolveIsProduction(value)).toThrow(/Invalid NODE_ENV/);
  });
});
