// Only five things come from the environment: the port (genuinely differs between local
// dev and the container), the gateway API key (a secret), the chat kill switch (an
// incident lever whose whole value is being changeable without a rebuild), the build
// sha (baked into the image at build time, never set by hand), and the transcript-log
// switch (a privacy-relevant opt-in that must be flippable per deployment). Everything else about the
// chat feature is plain configuration and lives in this file as a constant.
//
// Keeping settings as constants means `.env` can never silently disagree with production.
export interface EnvVars {
  /**
   * The git commit the image was built from, reported by `GET /health` as `sha`. The
   * deploy pipeline passes it as a Docker build arg (`--build-arg BUILD_SHA=...`) and the
   * Dockerfile's `app` stage sets it; unset locally, so `/health` says `unknown`. It is how
   * you tell, after a merge, that the new build is the one serving.
   */
  BUILD_SHA?: string;
  /** 4318 locally, 8000 in the container (baked into the Dockerfile). */
  PORT?: string;
  /**
   * The app's only genuine secret. From `.env` locally; in a deployment, inject it as an
   * environment variable from your platform's secret store — never commit it. Absent locally is a supported
   * state — chat.routes.ts mounts a stub router so `npm run dev` works without it.
   */
  GATEWAY_API_KEY?: string;
  /**
   * Opt-in. Set to `true` to write one JSON line per chat turn to stdout (the user's last
   * message, the assistant's answer, tool names, token counts) so it lands in the container
   * log. Off unless exactly `true`. See modules/chat/transcript-log.ts.
   */
  CHAT_TRANSCRIPT_LOG?: string;
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
  buildSha: typedEnv.BUILD_SHA?.trim() || 'unknown',
  chatTranscriptLog: typedEnv.CHAT_TRANSCRIPT_LOG === 'true',
} as const;
