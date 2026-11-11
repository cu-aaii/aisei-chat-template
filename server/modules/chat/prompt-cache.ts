// Prompt-cache breakpoints for Claude models behind the Cornell AI Gateway (LiteLLM).
//
// The gateway's Claude model groups configure one injection point — the system message —
// and a configured point overrides LiteLLM's automatic defaults, so without help from the
// client the conversation history is never cached. Every tool-loop round and every turn
// then re-bills the whole history as uncached input (TDX 2467466: on a 3-round loop the
// uncached input grew 6.4k → 12.8k → 19.1k; with a last-message breakpoint it stayed ~0).
//
// This router is an ideal case for it: the system prompt, the tool list and the model are
// fixed, and the client re-sends the conversation verbatim each turn — nothing on this side
// rewrites history — so everything before the newest message is a byte-identical prefix of
// the next request.
//
// Two breakpoints, applied to the OpenAI-compatible wire body just before it is sent:
//   1. the system message   (render order is tools → system → messages, so this one entry
//                             covers the fixed tool block too)
//   2. the last message      (rolls forward each round: the next request reads up to here
//                             and writes only what was appended)
// No mark on the last tool: with a fixed system prompt it is a second cache entry for a
// prefix the system mark already covers, and measured on this app it roughly tripled the
// write on a one-shot question (4,388 vs 663 tokens). Anthropic allows four marks per
// request; the gateway's own system-message point skips a message that already carries one.
//
// Cost trade-off: a cache write is billed at 1.25× input, and the last-message mark writes
// the new tail every call. A conversation that never continues pays that 25% on its tail
// and gets nothing back; any second round or second turn inside the 5-minute TTL repays it.

type Json = Record<string, unknown>;
interface CacheMark { readonly type: 'ephemeral' }
type ContentPart = Json & { cache_control?: CacheMark };
type WireMessage = Json & { role?: unknown; content?: unknown; cache_control?: CacheMark };
type WireBody = Json & { model?: unknown; messages?: unknown };

const MARK: CacheMark = { type: 'ephemeral' };

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null;
}

export function isClaudeModel(model: unknown): boolean {
  return typeof model === 'string' && model.toLowerCase().includes('claude');
}

function hasMark(message: WireMessage): boolean {
  if (message.cache_control) return true;
  return Array.isArray(message.content) && message.content.some((p) => isObject(p) && p.cache_control);
}

/** Same shape the gateway's injection hook writes: string content gets a message-level mark,
 * content-part arrays get it on the last part (Anthropic allows it only there). */
function markMessage(message: unknown): unknown {
  if (!isObject(message)) return message;
  const msg = message as WireMessage;
  if (hasMark(msg)) return msg;
  const content = msg.content;
  if (typeof content === 'string') {
    if (content.length === 0) return msg; // an empty block can't carry a mark
    return { ...msg, cache_control: MARK };
  }
  if (Array.isArray(content) && content.length > 0) {
    const last: unknown = content[content.length - 1];
    if (!isObject(last)) return msg;
    const marked: ContentPart = { ...last, cache_control: MARK };
    return { ...msg, content: [...content.slice(0, -1), marked] };
  }
  return msg;
}

/**
 * Return `body` with cache breakpoints added, or `body` itself (same object) when the model
 * is not Claude — `cache_control` is the one non-model-agnostic field, and another provider
 * could reject it.
 */
export function stampCacheBreakpoints(body: WireBody): WireBody {
  if (!isClaudeModel(body.model) || !Array.isArray(body.messages) || body.messages.length === 0) {
    return body;
  }
  const messages: unknown[] = [...body.messages];
  const first = messages[0];
  const firstIsSystem = isObject(first) && first.role === 'system';
  if (firstIsSystem && typeof first.content === 'string' && first.content.length > 0) {
    messages[0] = { ...first, content: [{ type: 'text', text: first.content, cache_control: MARK }] };
  }
  const lastIndex = messages.length - 1;
  // A one-message request is only the system prompt (already marked) or a lone user turn.
  if (lastIndex > 0 || !firstIsSystem) messages[lastIndex] = markMessage(messages[lastIndex]);
  return { ...body, messages };
}

interface RawUsage {
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

/**
 * Cache counters from one step's raw gateway usage. LiteLLM reports reads as OpenAI's
 * `prompt_tokens_details.cached_tokens` and/or Anthropic's `cache_read_input_tokens`
 * (sometimes both — the same quantity, so take the max, never the sum); writes only as
 * `cache_creation_input_tokens`, which the AI SDK's openai-compatible provider does not map.
 */
export function readCacheUsage(raw: unknown): { cacheReadTokens: number; cacheWriteTokens: number } {
  const u: RawUsage = isObject(raw) ? (raw as RawUsage) : {};
  const read = Math.max(u.cache_read_input_tokens ?? 0, u.prompt_tokens_details?.cached_tokens ?? 0);
  return { cacheReadTokens: read, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 };
}

/** Sum of the cache counters over every step of a turn (the tool loop is one call per step). */
export function sumCacheUsage(steps: readonly { usage?: { raw?: unknown } }[]): {
  cacheReadTokens: number;
  cacheWriteTokens: number;
} {
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  for (const step of steps) {
    const c = readCacheUsage(step.usage?.raw);
    cacheReadTokens += c.cacheReadTokens;
    cacheWriteTokens += c.cacheWriteTokens;
  }
  return { cacheReadTokens, cacheWriteTokens };
}
