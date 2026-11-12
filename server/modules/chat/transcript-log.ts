// One structured JSON line per chat turn, written to stdout, so whatever already ingests
// the container's logs (e.g. CloudWatch Logs) keeps the whole turn as a single event and a
// search for `chat.transcript` finds it. Off unless CHAT_TRANSCRIPT_LOG=true (see
// server/app.config.ts). Pure functions, so the tests need no gateway and no server.
//
// What is deliberately NOT in the line: client IP, NetID, email, request headers, and the
// earlier turns of the conversation (each turn logs only its own user message).
import type { UIMessage } from 'ai';

/** Max characters of the user text and of the assistant text, each. */
export const TRANSCRIPT_MAX_CHARS = 8_000;

const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** The AI SDK's chat id (`body.id`), or "unknown" when absent or not a plain short token. */
export function sanitizeConversationId(id: unknown): string {
  return typeof id === 'string' && CONVERSATION_ID_PATTERN.test(id) ? id : 'unknown';
}

/** Number of user messages in the request: the 1-based number of this turn. */
export function countUserMessages(messages: readonly UIMessage[]): number {
  return messages.filter((m) => m.role === 'user').length;
}

/** Text parts of the LAST user message only. Never the history. */
export function lastUserText(messages: readonly UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text)
      .join('\n');
  }
  return '';
}

/** Cuts `text` to `max` characters without leaving half of a surrogate pair behind. */
export function capText(text: string, max: number = TRANSCRIPT_MAX_CHARS): { text: string; cut: boolean } {
  if (text.length <= max) return { text, cut: false };
  let end = max;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return { text: text.slice(0, end), cut: true };
}

/**
 * Whether any of the provider's raw usage objects carried `prompt_tokens_details.cached_tokens`
 * (or Anthropic's `cache_read_input_tokens`) as a number. The SDK reports `cacheReadTokens` as 0 when the gateway sends nothing, so a 0
 * there alone does not prove \"no cache\"; this tells \"cache miss\" from \"not reported\".
 */
export function cacheReportedIn(raws: ReadonlyArray<unknown>): boolean {
  return raws.some((raw) => {
    const u = raw as
      | { prompt_tokens_details?: { cached_tokens?: unknown }; cache_read_input_tokens?: unknown }
      | null
      | undefined;
    return typeof u?.prompt_tokens_details?.cached_tokens === 'number' || typeof u?.cache_read_input_tokens === 'number';
  });
}

export interface TranscriptTurn {
  /** Raw `body.id` from the request; validated here. */
  conversationId: unknown;
  messages: readonly UIMessage[];
  /** The final assistant text for the turn. */
  assistant: string;
  /** Steps of the turn, only for the names of the tool calls made. */
  steps?: ReadonlyArray<{ toolCalls?: ReadonlyArray<{ toolName: string }> }>;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Input tokens served from the provider's prompt cache (0 when none or not reported). */
  cachedInputTokens?: number;
  /** True only when the provider's raw usage carried `prompt_tokens_details.cached_tokens`. */
  cacheReported?: boolean;
  /** Ms from the request reaching the router to the first streamed text chunk; null if none. */
  msToFirstChunk?: number | null;
  /** Ms from the request reaching the router to the end of the turn. */
  msTotal?: number;
  sha: string;
  /** Injectable for tests. */
  now?: Date;
}

export interface TranscriptLine {
  event: 'chat.transcript';
  conversationId: string;
  turn: number;
  user: string;
  assistant: string;
  tools: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheReported: boolean;
  msToFirstChunk: number | null;
  msTotal: number;
  sha: string;
  ts: string;
  truncated: boolean;
}

export function buildTranscriptLine(turn: TranscriptTurn): TranscriptLine {
  const user = capText(lastUserText(turn.messages));
  const assistant = capText(turn.assistant ?? '');
  return {
    event: 'chat.transcript',
    conversationId: sanitizeConversationId(turn.conversationId),
    turn: countUserMessages(turn.messages),
    user: user.text,
    assistant: assistant.text,
    tools: (turn.steps ?? []).flatMap((step) => (step.toolCalls ?? []).map((call) => call.toolName)),
    model: turn.model,
    inputTokens: turn.inputTokens ?? 0,
    outputTokens: turn.outputTokens ?? 0,
    cachedInputTokens: turn.cachedInputTokens ?? 0,
    cacheReported: turn.cacheReported ?? false,
    msToFirstChunk: turn.msToFirstChunk ?? null,
    msTotal: turn.msTotal ?? 0,
    sha: turn.sha,
    ts: (turn.now ?? new Date()).toISOString(),
    truncated: user.cut || assistant.cut,
  };
}

/**
 * Writes the turn's line when `enabled`; does nothing otherwise. Never throws: a logging
 * problem must not reach the stream. `write` is injectable for tests; by default a single
 * `console.log(JSON.stringify(line))`, no prefix, so it stays one log event.
 */
export function logTranscript(
  enabled: boolean | undefined,
  turn: TranscriptTurn,
  write: (line: string) => void = (line) => console.log(line),
): void {
  if (enabled !== true) return;
  try {
    write(JSON.stringify(buildTranscriptLine(turn)));
  } catch (err) {
    try {
      console.error('[chat] transcript log failed:', err instanceof Error ? err.message : String(err));
    } catch {
      // Nothing more to do: the turn itself must still complete.
    }
  }
}
