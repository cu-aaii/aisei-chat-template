// The transcript line builder and its on/off switch. Pure functions plus the router's
// GET /config, so no gateway call, no key, no build.
import type { UIMessage } from 'ai';
import { describe, expect, test, vi } from 'vitest';
import { createChatRouter } from '../server/modules/chat/chat-router.js';
import {
  TRANSCRIPT_MAX_CHARS,
  buildTranscriptLine,
  capText,
  logTranscript,
  sanitizeConversationId,
} from '../server/modules/chat/transcript-log.js';
import { ToolRegistry } from '../server/modules/chat/tools/registry.js';

function msg(role: 'user' | 'assistant', text: string): UIMessage {
  return { id: `${role}-${text.length}`, role, parts: [{ type: 'text', text }] };
}

const NOW = new Date('2026-11-09T17:00:00.000Z');

function turn(overrides: Partial<Parameters<typeof buildTranscriptLine>[0]> = {}) {
  return {
    conversationId: 'abc-123_X',
    messages: [msg('user', 'first question'), msg('assistant', 'first answer'), msg('user', 'second question')],
    assistant: 'second answer',
    steps: [{ toolCalls: [{ toolName: 'search_content' }] }, { toolCalls: [] }],
    model: 'claude-sonnet-5',
    inputTokens: 11,
    outputTokens: 22,
    sha: 'deadbeef',
    now: NOW,
    ...overrides,
  };
}

describe('buildTranscriptLine', () => {
  test('logs the last user message only, never the history', () => {
    const line = buildTranscriptLine(turn());
    expect(line.user).toBe('second question');
    expect(JSON.stringify(line)).not.toContain('first question');
    expect(JSON.stringify(line)).not.toContain('first answer');
  });

  test('turn is the number of user messages in the request', () => {
    expect(buildTranscriptLine(turn()).turn).toBe(2);
    expect(buildTranscriptLine(turn({ messages: [msg('user', 'hi')] })).turn).toBe(1);
  });

  test('has exactly the documented fields', () => {
    const line = buildTranscriptLine(turn());
    expect(line).toEqual({
      event: 'chat.transcript',
      conversationId: 'abc-123_X',
      turn: 2,
      user: 'second question',
      assistant: 'second answer',
      tools: ['search_content'],
      model: 'claude-sonnet-5',
      inputTokens: 11,
      outputTokens: 22,
      sha: 'deadbeef',
      ts: '2026-11-09T17:00:00.000Z',
      truncated: false,
    });
  });

  test('joins only the text parts of the last user message', () => {
    const last: UIMessage = {
      id: 'u',
      role: 'user',
      parts: [{ type: 'text', text: 'a' }, { type: 'step-start' }, { type: 'text', text: 'b' }],
    };
    expect(buildTranscriptLine(turn({ messages: [last] })).user).toBe('a\nb');
  });

  test('caps user and assistant at 8000 characters and sets truncated', () => {
    const long = 'x'.repeat(TRANSCRIPT_MAX_CHARS + 500);
    const cutUser = buildTranscriptLine(turn({ messages: [msg('user', long)] }));
    expect(cutUser.user).toHaveLength(TRANSCRIPT_MAX_CHARS);
    expect(cutUser.assistant).toBe('second answer');
    expect(cutUser.truncated).toBe(true);

    const cutAssistant = buildTranscriptLine(turn({ assistant: long }));
    expect(cutAssistant.assistant).toHaveLength(TRANSCRIPT_MAX_CHARS);
    expect(cutAssistant.truncated).toBe(true);
  });

  test('exactly 8000 characters is not truncated', () => {
    const exact = 'y'.repeat(TRANSCRIPT_MAX_CHARS);
    const line = buildTranscriptLine(turn({ assistant: exact }));
    expect(line.assistant).toHaveLength(TRANSCRIPT_MAX_CHARS);
    expect(line.truncated).toBe(false);
  });

  test('a cut never leaves half of a surrogate pair', () => {
    const text = 'a'.repeat(TRANSCRIPT_MAX_CHARS - 1) + '😀';
    const { text: cut, cut: wasCut } = capText(text);
    expect(wasCut).toBe(true);
    expect(cut).toBe('a'.repeat(TRANSCRIPT_MAX_CHARS - 1));
  });

  test('tools lists the tool calls of every step, in order', () => {
    const line = buildTranscriptLine(
      turn({ steps: [{ toolCalls: [{ toolName: 'search_content' }] }, { toolCalls: [{ toolName: 'read_content' }] }] }),
    );
    expect(line.tools).toEqual(['search_content', 'read_content']);
  });

  test('carries no IP, NetID, email or header field', () => {
    const keys = Object.keys(buildTranscriptLine(turn()));
    for (const banned of ['ip', 'netid', 'netId', 'email', 'headers', 'userAgent']) {
      expect(keys).not.toContain(banned);
    }
  });
});

describe('sanitizeConversationId', () => {
  test.each(['a', 'abc-123_X', 'a'.repeat(64), '123e4567-e89b-12d3-a456-426614174000'])('accepts %s', (id) => {
    expect(sanitizeConversationId(id)).toBe(id);
  });

  test.each([
    ['empty', ''],
    ['65 characters', 'a'.repeat(65)],
    ['a space', 'ab cd'],
    ['a newline', 'abc\n{"event":"x"}'],
    ['a quote', 'a"b'],
    ['an email', 'me@cornell.edu'],
    ['a dot', 'a.b'],
    ['a number', 42],
    ['undefined', undefined],
    ['null', null],
    ['an object', { id: 'a' }],
  ])('rejects %s', (_label, id) => {
    expect(sanitizeConversationId(id)).toBe('unknown');
  });

  test('the line uses "unknown" for a bad id', () => {
    expect(buildTranscriptLine(turn({ conversationId: 'bad id!' })).conversationId).toBe('unknown');
  });
});

describe('logTranscript', () => {
  test('writes nothing when the flag is off or unset', () => {
    const write = vi.fn();
    logTranscript(false, turn(), write);
    logTranscript(undefined, turn(), write);
    expect(write).not.toHaveBeenCalled();
  });

  test('writes exactly one single-line JSON string when on', () => {
    const write = vi.fn();
    logTranscript(true, turn({ messages: [msg('user', 'line one\nline two')], assistant: 'a\nb' }), write);
    expect(write).toHaveBeenCalledTimes(1);
    const out = write.mock.calls[0][0] as string;
    expect(out).not.toContain('\n');
    expect(out.startsWith('{"event":"chat.transcript"')).toBe(true);
    expect(JSON.parse(out).user).toBe('line one\nline two');
  });

  test('console.log by default gets the bare JSON string with no prefix', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      logTranscript(true, turn());
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]).toHaveLength(1);
      expect(JSON.parse(spy.mock.calls[0][0] as string).event).toBe('chat.transcript');
    } finally {
      spy.mockRestore();
    }
  });

  test('never throws, even when the writer throws or the turn is malformed', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() =>
        logTranscript(
          true,
          turn(),
          () => {
            throw new Error('stdout closed');
          },
        ),
      ).not.toThrow();
      const malformed = turn({ messages: [{ id: 'x', role: 'user' } as unknown as UIMessage] });
      expect(() => logTranscript(true, malformed, vi.fn())).not.toThrow();
      expect(errors).toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});

describe('GET /config', () => {
  const base = {
    baseURL: 'http://127.0.0.1:1/v1',
    defaultModel: 'claude-sonnet-5',
    systemPrompt: 'test',
    tools: new ToolRegistry(),
  };

  test('reports transcriptLog true only when switched on', async () => {
    const on = await createChatRouter({ ...base, transcriptLog: true }).request('/config');
    expect(((await on.json()) as { transcriptLog: boolean }).transcriptLog).toBe(true);
    const off = await createChatRouter({ ...base, transcriptLog: false }).request('/config');
    expect(((await off.json()) as { transcriptLog: boolean }).transcriptLog).toBe(false);
    const unset = await createChatRouter(base).request('/config');
    expect(((await unset.json()) as { transcriptLog: boolean }).transcriptLog).toBe(false);
  });
});
