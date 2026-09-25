// Streaming chat endpoint — a trimmed port of ng-chat's
// packages/chat-server/src/chat-router.ts. Deliberately does not port /compact,
// /close, token-counting/history-compaction, or file-attachment handling: this
// assistant is in-memory and per-request-stateless, so there's no session to protect,
// and it's text-only.
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { Hono } from 'hono';
import { createRateLimiter, getClientIp } from './rate-limit.js';
import type { ToolRegistry } from './tools/registry.js';

export interface ChatRouterConfig {
  baseURL: string;
  apiKey?: string;
  defaultModel: string;
  systemPrompt: string;
  tools: ToolRegistry;
  toolLabels?: Record<string, string>;
  maxToolRounds?: number;
  maxOutputTokens?: number;
  rateLimit?: { maxRequests: number; windowMs: number };
  /** Request-size caps — see DEFAULT_LIMITS. */
  limits?: Partial<RequestLimits>;
  /**
   * Whether to stream the model's reasoning parts to the browser. Off by default: this
   * endpoint is public, the chat panel renders only `text` and tool parts (see
   * ChatPanelComponent.kind), and reasoning about the system prompt is not something to
   * hand a visitor. Wired to dev-only in chat.routes.ts.
   */
  sendReasoning?: boolean;
  providerName?: string;
}

export interface RequestLimits {
  /** Max characters in a single visitor turn. */
  maxMessageChars: number;
  /** Max characters across the whole conversation. */
  maxTotalChars: number;
  /** Max messages in the conversation. */
  maxMessages: number;
}

// The rate limiter caps how *often* an IP can post; these cap how *much* it can post
// each time. Without them a single request can carry an arbitrarily large `messages`
// array straight through to a metered gateway. Sized for a site FAQ conversation: a long
// visitor question is a few hundred characters, not a few thousand.
const DEFAULT_LIMITS: RequestLimits = {
  maxMessageChars: 4_000,
  maxTotalChars: 24_000,
  maxMessages: 40,
};

interface ChatRequestBody {
  messages?: UIMessage[];
  model?: string;
}

/**
 * Characters of visible text in a message. Only `text` parts are counted — tool inputs
 * and outputs are server-generated, so they aren't an attacker-controlled size lever
 * and charging them against a visitor's budget would just truncate long conversations
 * early.
 */
function textLength(message: UIMessage): number {
  if (!Array.isArray(message.parts)) return 0;
  let total = 0;
  for (const part of message.parts) {
    if (part.type === 'text' && typeof part.text === 'string') total += part.text.length;
  }
  return total;
}

export function createChatRouter(config: ChatRouterConfig): Hono {
  const provider = createOpenAICompatible({
    name: config.providerName ?? 'gateway',
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    // Without this, the gateway's streaming response never includes a usage chunk, so
    // onFinish's usage/totalUsage below come back all-`undefined` — needed for the
    // spend logging.
    includeUsage: true,
  });

  const maxRounds = config.maxToolRounds ?? 8;
  const limits: RequestLimits = { ...DEFAULT_LIMITS, ...config.limits };
  const checkRate =
    config.rateLimit && config.rateLimit.maxRequests > 0
      ? createRateLimiter(config.rateLimit.maxRequests, config.rateLimit.windowMs)
      : null;

  const app = new Hono();

  app.get('/config', (c) =>
    c.json({
      enabled: true,
      model: config.defaultModel,
      tools: config.tools.names(),
      toolLabels: config.toolLabels ?? {},
    }),
  );

  app.post('/', async (c) => {
    if (checkRate && !checkRate(getClientIp(c))) {
      return c.json({ error: 'Too many requests. Please wait before sending another message.' }, 429);
    }

    let body: ChatRequestBody;
    try {
      body = await c.req.json<ChatRequestBody>();
    } catch {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.some((m) => !Array.isArray(m.parts))) {
      return c.json({ error: 'Messages must use the AI SDK UIMessage shape with a `parts` array.' }, 400);
    }

    // Size checks before `streamText`, so an oversized request costs us a JSON response
    // rather than a gateway call. The conversation caps answer 413 (rather than 400) and
    // name the fix, because unlike an over-long single message the visitor can't shorten
    // what they already sent — `ChatEngineService.clear()` backs the "clear chat" action
    // that resolves it, and ChatPanelComponent surfaces these messages in its error banner.
    const perMessage = messages.map(textLength);
    if (perMessage.some((n) => n > limits.maxMessageChars)) {
      return c.json(
        { error: `That message is too long — please keep it under ${limits.maxMessageChars} characters.` },
        400,
      );
    }
    if (messages.length > limits.maxMessages) {
      return c.json({ error: 'This conversation has gotten long — please clear the chat and start fresh.' }, 413);
    }
    if (perMessage.reduce((sum, n) => sum + n, 0) > limits.maxTotalChars) {
      return c.json({ error: 'This conversation has gotten long — please clear the chat and start fresh.' }, 413);
    }

    const modelId = body.model === config.defaultModel ? body.model : config.defaultModel;

    try {
      const result = streamText({
        model: provider(modelId),
        system: config.systemPrompt,
        messages: await convertToModelMessages(messages, { ignoreIncompleteToolCalls: true }),
        tools: config.tools.toAiTools(),
        stopWhen: stepCountIs(maxRounds),
        // A grounded answer about a page is a few hundred tokens. A cap
        // this low is also the backstop on "write me a novel"-shaped abuse getting
        // through the system prompt's scope rules.
        maxOutputTokens: config.maxOutputTokens ?? 2_000,
        abortSignal: c.req.raw.signal,
        // No spend-tracking DB — this logs to stdout so gateway cost/abuse trends show
        // up in whatever already ingests container logs (e.g. CloudWatch Logs). Actual
        // alarming on this is ops-owned infra, out of this repo's scope.
        onFinish: ({ usage, totalUsage }) => {
          console.log('[chat] usage', {
            ip: getClientIp(c),
            model: modelId,
            inputTokens: totalUsage.inputTokens ?? usage.inputTokens,
            outputTokens: totalUsage.outputTokens ?? usage.outputTokens,
            totalTokens: totalUsage.totalTokens ?? usage.totalTokens,
          });
        },
      });

      return result.toUIMessageStreamResponse({
        sendReasoning: config.sendReasoning ?? false,
        onError: (err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[chat] stream error:', message);
          return message;
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
