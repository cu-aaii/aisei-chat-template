// Tester feedback on assistant answers: a rating (good / partly / not helpful) and an
// optional note, written as one `chat.feedback` JSON line to stdout — the same place and
// shape as the `chat.transcript` line (transcript-log.ts), so whatever ingests container
// logs (e.g. CloudWatch Logs) keeps both and a search for `chat.feedback` finds them.
// Off unless CHAT_FEEDBACK=true (server/app.config.ts); with it off the endpoint is a 404
// and GET /api/chat/config reports `feedback: false`, so the buttons never render.
//
// A rating is joined to the answer it rates by `conversationId` + `turn`, the same two
// fields the transcript line carries. Like the transcript line, it never includes an IP,
// NetID, email or request header.
import { Hono } from 'hono';
import { createRateLimiter, getClientIp } from './rate-limit.js';
import { sanitizeConversationId } from './transcript-log.js';

/** Three, not two: "right, but…" is the most common tester verdict and the most useful. */
export const FEEDBACK_RATINGS = ['good', 'partly', 'not-helpful'] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

/** Max characters in the optional note. */
export const FEEDBACK_MAX_NOTE_CHARS = 1_000;

/** Raw request bodies over this are refused before they are parsed. */
const MAX_BODY_CHARS = 4_000;

const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface FeedbackLine {
  event: 'chat.feedback';
  conversationId: string;
  turn: number;
  messageId: string;
  rating: FeedbackRating;
  note: string;
  sha: string;
  ts: string;
}

export type FeedbackParse = { ok: true; line: FeedbackLine } | { ok: false; error: string };

/** Validates a POST body into the line to log. Pure, so the tests need no server. */
export function parseFeedback(body: unknown, sha: string, now: Date = new Date()): FeedbackParse {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Expected a JSON object.' };
  const b = body as Record<string, unknown>;

  if (typeof b.rating !== 'string' || !(FEEDBACK_RATINGS as readonly string[]).includes(b.rating)) {
    return { ok: false, error: `rating must be one of: ${FEEDBACK_RATINGS.join(', ')}.` };
  }
  if (typeof b.turn !== 'number' || !Number.isInteger(b.turn) || b.turn < 1 || b.turn > 1_000) {
    return { ok: false, error: 'turn must be a positive integer.' };
  }
  const note = b.note === undefined || b.note === null ? '' : b.note;
  if (typeof note !== 'string') return { ok: false, error: 'note must be a string.' };
  if (note.length > FEEDBACK_MAX_NOTE_CHARS) {
    return { ok: false, error: `Please keep the note under ${FEEDBACK_MAX_NOTE_CHARS} characters.` };
  }

  return {
    ok: true,
    line: {
      event: 'chat.feedback',
      conversationId: sanitizeConversationId(b.conversationId),
      turn: b.turn,
      messageId: typeof b.messageId === 'string' && MESSAGE_ID_PATTERN.test(b.messageId) ? b.messageId : 'unknown',
      rating: b.rating as FeedbackRating,
      note: note.trim(),
      sha,
      ts: now.toISOString(),
    },
  };
}

export interface FeedbackRouterConfig {
  /** CHAT_FEEDBACK. When not exactly `true`, POST answers 404 and nothing is written. */
  enabled?: boolean;
  buildSha?: string;
  /** Separate from the chat limiter: rating an answer must never cost a visitor a question. */
  rateLimit?: { maxRequests: number; windowMs: number };
  /** Injectable for tests; by default one bare `console.log`, so it stays one log event. */
  write?: (line: string) => void;
}

/** Mounted at /api/chat/feedback, so the CSRF check on /api/chat/* covers it. */
export function createFeedbackRouter(config: FeedbackRouterConfig): Hono {
  const app = new Hono();
  const write = config.write ?? ((line: string) => console.log(line));
  const checkRate =
    config.rateLimit && config.rateLimit.maxRequests > 0
      ? createRateLimiter(config.rateLimit.maxRequests, config.rateLimit.windowMs)
      : null;

  app.post('/', async (c) => {
    if (config.enabled !== true) return c.json({ error: 'Not found.' }, 404);
    if (checkRate && !checkRate(getClientIp(c))) {
      return c.json({ error: 'Too many ratings. Please wait a moment.' }, 429);
    }

    const raw = await c.req.text();
    if (raw.length > MAX_BODY_CHARS) return c.json({ error: 'Request too large.' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const parsed = parseFeedback(body, config.buildSha ?? 'unknown');
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    try {
      write(JSON.stringify(parsed.line));
    } catch (err) {
      console.error('[chat] feedback log failed:', err instanceof Error ? err.message : String(err));
      return c.json({ error: 'Could not save the rating.' }, 500);
    }
    return c.json({ ok: true });
  });

  return app;
}
