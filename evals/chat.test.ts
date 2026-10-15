// The pre-launch gate: asks the real assistant every reviewed case in evals/chat-cases.json and
// fails on any wrong answer. Run `npm run build` first, then `npm run test:chat`.
//
// It drives the whole app in-process through Hono's `app.request()`, not just the chat router:
// the CSRF check, the rate limiter and size caps, the real system prompt, the real tools reading
// the prerendered pages, and a real call to the gateway with GATEWAY_API_KEY. Nothing is mocked,
// so a pass means the thing a visitor talks to answered correctly. It also means every run is
// billed like a visitor's message, which is why RUNS_PER_CASE stays low.
import { parseJsonEventStream, uiMessageChunkSchema } from 'ai';
import { beforeAll, describe, expect, test } from 'vitest';
import { config } from '../server/app.config.js';
import { app } from '../server/app.js';
import { buildSiteAssistantSystemPrompt } from '../server/modules/chat/prompt.js';
import { TOOL_LABELS } from '../server/modules/chat/tool-labels.js';
import { grade, loadSuite, type Reply } from './chat-cases.js';

// A case passes only if every run passes. The model samples, so one clean run can hide an answer
// that is right only some of the time; two runs catch most of those at twice the gateway cost.
const RUNS_PER_CASE = 2;

// A run is a few gateway round trips (search, read, answer) plus the pacing below.
const CASE_TIMEOUT_MS = RUNS_PER_CASE * 120_000;

// In-process there is no X-Forwarded-For, so to the rate limiter every request from this file is
// one visitor (see getClientIp in rate-limit.ts). Spacing requests at the limiter's own rate keeps
// the gate inside the limit rather than loosening it; the extra second is headroom so timing
// jitter can never fit one request too many into a window.
const PACE_MS = config.rateLimit.windowMs / config.rateLimit.maxRequests + 1_000;

// app.request() addresses http://localhost, so this is the same-origin Origin a browser would send.
const ORIGIN = 'http://localhost';

// Same cwd anchor as server/modules/chat/content-roots.ts: npm scripts run from the repo root.
const cases = loadSuite('evals/chat-cases.json');

// Never acceptable in any reply, read from the live code so they follow edits to it: tool names,
// which the prompt's <style> block says never to mention, and the prompt's own section tags, which
// only appear in a reply that is quoting the system prompt.
const alwaysProhibited = [
  ...Object.keys(TOOL_LABELS),
  ...new Set(buildSiteAssistantSystemPrompt().match(/<[a-z_]+>/g) ?? []),
];

let csrfToken = '';
let lastRequestAt = 0;

beforeAll(async () => {
  // Without a key, chat.routes.ts mounts the stub router, which answers every question with "not
  // configured". Grading that would test nothing, so stop before asking anything.
  if (!config.chatEnabled || !config.gatewayApiKey) {
    throw new Error('Set GATEWAY_API_KEY in .env and leave CHAT_ENABLED on: the gate asks the real assistant.');
  }
  // Fetch a page first, as a browser does, to be handed the double-submit cookie (server/app.ts).
  const page = await app.request('/', { headers: { accept: 'text/html' } });
  csrfToken = /XSRF-TOKEN=([^;]+)/.exec(page.headers.get('set-cookie') ?? '')?.[1] ?? '';
  if (!csrfToken) {
    throw new Error('GET / set no XSRF-TOKEN cookie. Run `npm run build` first: the gate needs the prerendered pages.');
  }
});

/** One visitor message through POST /api/chat, read with the stream parser the browser's transport uses. */
async function ask(question: string): Promise<Reply> {
  const wait = lastRequestAt + PACE_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  const response = await app.request('/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      cookie: `XSRF-TOKEN=${csrfToken}`,
      'x-xsrf-token': csrfToken,
    },
    // The body DefaultChatTransport sends from client/app/shared/services/chat-engine.service.ts.
    body: JSON.stringify({
      id: crypto.randomUUID(),
      trigger: 'submit-message',
      messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: question }] }],
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`POST /api/chat answered ${response.status}: ${await response.text()}`);
  }

  const reply: Reply = { text: '', tools: [] };
  let finished = false;
  for await (const part of parseJsonEventStream({ stream: response.body, schema: uiMessageChunkSchema })) {
    if (!part.success) throw part.error;
    const chunk = part.value;
    // The chat panel renders each text part as its own block, so they are joined the same way.
    if (chunk.type === 'text-start' && reply.text) reply.text += '\n\n';
    else if (chunk.type === 'text-delta') reply.text += chunk.delta;
    else if (chunk.type === 'tool-input-start') reply.tools.push(chunk.toolName);
    else if (chunk.type === 'error') throw new Error(`stream error: ${chunk.errorText}`);
    else if (chunk.type === 'finish') {
      finished = true;
      reply.finishReason = chunk.finishReason;
    }
  }
  // No reply to grade is a broken run, not a wrong answer, and the error says which.
  if (!finished) throw new Error('the stream ended without a finish part');
  return reply;
}

describe('site assistant', () => {
  for (const testCase of cases) {
    test(
      testCase.id,
      async () => {
        for (let run = 1; run <= RUNS_PER_CASE; run++) {
          const reply = await ask(testCase.ask);
          // On failure, show what the assistant actually said: the reviewer needs it to decide
          // whether the answer is wrong or the case is.
          expect(
            grade(testCase, reply, alwaysProhibited),
            `run ${run} of ${RUNS_PER_CASE}\nasked: ${testCase.ask}\nreplied: ${reply.text}\n` +
              `tools: ${reply.tools.join(', ') || 'none'}\n`,
          ).toEqual([]);
        }
      },
      CASE_TIMEOUT_MS,
    );
  }
});
