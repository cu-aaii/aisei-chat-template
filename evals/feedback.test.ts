// The tester-rating endpoint (CHAT_FEEDBACK): validation, the on/off switch, and the one
// log line it writes. No gateway, no key, no build.
import { describe, expect, test, vi } from 'vitest';
import { createChatRouter } from '../server/modules/chat/chat-router.js';
import {
  FEEDBACK_MAX_NOTE_CHARS,
  createFeedbackRouter,
  parseFeedback,
} from '../server/modules/chat/feedback.js';
import { ToolRegistry } from '../server/modules/chat/tools/registry.js';

const NOW = new Date('2026-11-12T17:00:00.000Z');
const valid = { conversationId: 'c-123', turn: 2, messageId: 'msg_abc', rating: 'partly', note: '  missed HeinOnline ' };

function post(app: ReturnType<typeof createFeedbackRouter>, body: unknown) {
  return app.request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('parseFeedback', () => {
  test('builds the chat.feedback line, trimming the note', () => {
    const parsed = parseFeedback(valid, 'deadbeef', NOW);
    expect(parsed).toEqual({
      ok: true,
      line: {
        event: 'chat.feedback',
        conversationId: 'c-123',
        turn: 2,
        messageId: 'msg_abc',
        rating: 'partly',
        note: 'missed HeinOnline',
        sha: 'deadbeef',
        ts: NOW.toISOString(),
      },
    });
  });

  test('accepts all three ratings and a missing note', () => {
    for (const rating of ['good', 'partly', 'not-helpful']) {
      const parsed = parseFeedback({ ...valid, rating, note: undefined }, 's', NOW);
      expect(parsed.ok && parsed.line.note).toBe('');
    }
  });

  test('refuses an unknown rating, a bad turn, a non-string or over-long note', () => {
    expect(parseFeedback({ ...valid, rating: 'meh' }, 's').ok).toBe(false);
    expect(parseFeedback({ ...valid, turn: 0 }, 's').ok).toBe(false);
    expect(parseFeedback({ ...valid, turn: 1.5 }, 's').ok).toBe(false);
    expect(parseFeedback({ ...valid, turn: '2' }, 's').ok).toBe(false);
    expect(parseFeedback({ ...valid, note: 42 }, 's').ok).toBe(false);
    expect(parseFeedback({ ...valid, note: 'x'.repeat(FEEDBACK_MAX_NOTE_CHARS + 1) }, 's').ok).toBe(false);
    expect(parseFeedback(null, 's').ok).toBe(false);
  });

  test('replaces an unsafe conversation or message id with "unknown"', () => {
    const parsed = parseFeedback({ ...valid, conversationId: 'a b<script>', messageId: 'x'.repeat(65) }, 's');
    expect(parsed.ok && [parsed.line.conversationId, parsed.line.messageId]).toEqual(['unknown', 'unknown']);
  });

  test('never carries extra fields from the request into the line', () => {
    const parsed = parseFeedback({ ...valid, netid: 'abc123', ip: '1.2.3.4' }, 's');
    expect(parsed.ok && Object.keys(parsed.line).sort()).toEqual(
      ['conversationId', 'event', 'messageId', 'note', 'rating', 'sha', 'ts', 'turn'],
    );
  });
});

describe('POST /api/chat/feedback', () => {
  test('is a 404 and writes nothing when the flag is off or unset', async () => {
    const write = vi.fn();
    expect((await post(createFeedbackRouter({ enabled: false, write }), valid)).status).toBe(404);
    expect((await post(createFeedbackRouter({ write }), valid)).status).toBe(404);
    expect(write).not.toHaveBeenCalled();
  });

  test('writes exactly one bare single-line JSON string when on', async () => {
    const write = vi.fn();
    const res = await post(createFeedbackRouter({ enabled: true, buildSha: 'abc1234', write }), {
      ...valid,
      note: 'line one\nline two',
    });
    expect(res.status).toBe(200);
    expect(write).toHaveBeenCalledTimes(1);
    const out = write.mock.calls[0][0] as string;
    expect(out).not.toContain('\n');
    expect(out.startsWith('{"event":"chat.feedback"')).toBe(true);
    expect(JSON.parse(out)).toMatchObject({ rating: 'partly', note: 'line one\nline two', sha: 'abc1234' });
  });

  test('answers 400 for invalid JSON or an invalid rating, 413 for an oversized body', async () => {
    const write = vi.fn();
    const app = createFeedbackRouter({ enabled: true, write });
    expect((await post(app, '{not json')).status).toBe(400);
    expect((await post(app, { ...valid, rating: 'great' })).status).toBe(400);
    expect((await post(app, { ...valid, note: 'x'.repeat(5_000) })).status).toBe(413);
    expect(write).not.toHaveBeenCalled();
  });

  test('has its own rate limit', async () => {
    const app = createFeedbackRouter({ enabled: true, write: vi.fn(), rateLimit: { maxRequests: 2, windowMs: 60_000 } });
    expect((await post(app, valid)).status).toBe(200);
    expect((await post(app, valid)).status).toBe(200);
    expect((await post(app, valid)).status).toBe(429);
  });

  test('a writer failure is a 500, not a crash', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const app = createFeedbackRouter({
        enabled: true,
        write: () => {
          throw new Error('stdout closed');
        },
      });
      expect((await post(app, valid)).status).toBe(500);
    } finally {
      errors.mockRestore();
    }
  });
});

describe('GET /config', () => {
  test('reports feedback true only when switched on', async () => {
    const base = { baseURL: 'http://127.0.0.1:1/v1', defaultModel: 'claude-sonnet-5', systemPrompt: 't', tools: new ToolRegistry() };
    const read = async (feedback?: boolean) =>
      ((await (await createChatRouter({ ...base, feedback }).request('/config')).json()) as { feedback: boolean }).feedback;
    expect(await read(true)).toBe(true);
    expect(await read(false)).toBe(false);
    expect(await read(undefined)).toBe(false);
  });
});
