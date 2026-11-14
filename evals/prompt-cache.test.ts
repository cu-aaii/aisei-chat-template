// Prompt-cache breakpoints on the wire body. Pure functions — no gateway call, no key.
import { describe, expect, test } from 'vitest';
import {
  readCacheUsage,
  stampCacheBreakpoints,
  sumCacheUsage,
} from '../server/modules/chat/prompt-cache.js';

const MARK = { type: 'ephemeral' };

interface Part { type?: string; text?: string; cache_control?: unknown }
interface Msg { role: string; content: string | Part[]; cache_control?: unknown }
interface Wire { tools: { cache_control?: unknown }[]; messages: Msg[] }

/** The stamped body, typed for assertions. */
function stamp(b: Record<string, unknown>): Wire {
  return stampCacheBreakpoints(b) as unknown as Wire;
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    model: 'claude-sonnet-5',
    tools: [
      { type: 'function', function: { name: 'search_content' } },
      { type: 'function', function: { name: 'read_content' } },
    ],
    messages: [
      { role: 'system', content: 'You are the site assistant.' },
      { role: 'user', content: 'What is AISEI?' },
    ],
    ...overrides,
  };
}

function countMarks(b: Wire): number {
  let n = 0;
  for (const t of b.tools ?? []) if (t.cache_control) n++;
  for (const m of b.messages ?? []) {
    if (m.cache_control) n++;
    if (Array.isArray(m.content)) for (const p of m.content) if (p.cache_control) n++;
  }
  return n;
}

describe('stampCacheBreakpoints', () => {
  test('non-Claude models are returned untouched (same object)', () => {
    const b = body({ model: 'gpt-5.1' });
    expect(stampCacheBreakpoints(b)).toBe(b);
  });

  test('marks the system message and the last message, never a tool', () => {
    const out = stamp(body());
    expect(out.tools.some((t) => t.cache_control)).toBe(false);
    expect(out.messages[0].content).toEqual([
      { type: 'text', text: 'You are the site assistant.', cache_control: MARK },
    ]);
    expect(out.messages[1]).toEqual({ role: 'user', content: 'What is AISEI?', cache_control: MARK });
    expect(countMarks(out)).toBe(2);
  });

  test('does not mutate the input', () => {
    const b = body();
    const snapshot = JSON.stringify(b);
    stampCacheBreakpoints(b);
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  test('rolls forward onto a trailing tool result inside the tool loop', () => {
    const out = stamp(
      body({
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'q' },
          { role: 'assistant', content: '', tool_calls: [{ id: 't1' }] },
          { role: 'tool', tool_call_id: 't1', content: '{"hits":3}' },
        ],
      }),
    );
    expect(out.messages[3].cache_control).toEqual(MARK);
    expect(out.messages[1].cache_control).toBeUndefined();
    expect(countMarks(out)).toBe(2);
  });

  test('content-part messages get the mark on the last part only', () => {
    const out = stamp(
      body({
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] },
        ],
      }),
    );
    expect((out.messages[1].content as Part[])[0].cache_control).toBeUndefined();
    expect((out.messages[1].content as Part[])[1].cache_control).toEqual(MARK);
  });

  test('already-marked content and empty strings are left alone', () => {
    const marked = { role: 'user', content: 'x', cache_control: MARK };
    const out = stamp(body({ messages: [{ role: 'system', content: 's' }, marked] }));
    expect(out.messages[1]).toBe(marked);

    const empty = { role: 'assistant', content: '' };
    const out2 = stamp(body({ messages: [{ role: 'system', content: 's' }, empty] }));
    expect(out2.messages[1]).toBe(empty);
  });

  test('a lone system message is marked once, not twice', () => {
    const out = stamp(body({ messages: [{ role: 'system', content: 's' }] }));
    expect(countMarks(out)).toBe(1);
  });
});

describe('cache usage', () => {
  test('reads take the max of the two spellings, writes come from Anthropic only', () => {
    expect(
      readCacheUsage({
        prompt_tokens_details: { cached_tokens: 900 },
        cache_read_input_tokens: 900,
        cache_creation_input_tokens: 120,
      }),
    ).toEqual({ cacheReadTokens: 900, cacheWriteTokens: 120 });
    expect(readCacheUsage(undefined)).toEqual({ cacheReadTokens: 0, cacheWriteTokens: 0 });
  });

  test('sums across tool-loop steps', () => {
    expect(
      sumCacheUsage([
        { usage: { raw: { cache_creation_input_tokens: 2000 } } },
        { usage: { raw: { cache_read_input_tokens: 2000, cache_creation_input_tokens: 300 } } },
        {},
      ]),
    ).toEqual({ cacheReadTokens: 2000, cacheWriteTokens: 2300 });
  });
});
