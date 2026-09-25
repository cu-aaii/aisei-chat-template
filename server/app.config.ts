// Only three things come from the environment: the port (genuinely differs between local
// dev and the container), the gateway API key (a secret), and the chat kill switch (an
// incident lever whose whole value is being changeable without a rebuild). Everything else
// about the chat feature is plain configuration and lives in this file as a constant.
//
// Keeping settings as constants means `.env` can never silently disagree with production.
export interface EnvVars {
  /** 4318 locally, 8000 in the container (baked into the Dockerfile). */
  PORT?: string;
  /**
   * The app's only genuine secret. From `.env` locally; in a deployment, inject it as an
   * environment variable from your platform's secret store — never commit it. Absent locally is a supported
   * state — chat.routes.ts mounts a stub router so `npm run dev` works without it.
   */
  GATEWAY_API_KEY?: string;
  /**
   * Kill switch, kept in the environment on purpose: pulling the chat feature (gateway
   * abuse, a cost spike) should be a config change, not a rebuild. Set to `false`.
   */
  CHAT_ENABLED?: string;
}

// Non-secret chat configuration. Changing any of these is an ordinary code change,
// reviewed in a diff, and cannot fall out of sync with a deployed env var.
const GATEWAY_BASE_URL = 'https://api.ai.it.cornell.edu/v1';
const CHAT_MODEL = 'claude-sonnet-5';

// Per-IP cap on /api/chat, which is public, unauthenticated, and forwards to a paid
// gateway. 15/min is well clear of a real conversation's pace (a person sends a message
// every 10-30s). Complemented by the per-request size caps in modules/chat/chat-router.ts.
// If you deploy behind a WAF, add an edge rate rule there too.
const RATE_LIMIT_MAX_REQUESTS = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

const requiredEnvVars: (keyof EnvVars)[] = [];

const typedEnv = process.env as unknown as EnvVars;

requiredEnvVars.forEach((key) => {
  if (!typedEnv[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const config = {
  port: Number(typedEnv.PORT ?? 4318),
  isProduction: process.env.NODE_ENV === 'production',
  chatEnabled: typedEnv.CHAT_ENABLED !== 'false',
  gatewayBaseUrl: GATEWAY_BASE_URL,
  gatewayApiKey: typedEnv.GATEWAY_API_KEY,
  chatModel: CHAT_MODEL,
  rateLimit: {
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  },
} as const;
