// Mounts the real chat router when gateway credentials are configured, otherwise a
// stub that streams a "not configured" message — so `npm run dev` never crashes for a
// contributor without GATEWAY_API_KEY.
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { Hono } from 'hono';
import { config } from '../../app.config.js';
import { createChatRouter } from './chat-router.js';
import { buildSiteAssistantSystemPrompt } from './prompt.js';
import { TOOL_LABELS } from './tool-labels.js';
import { readContentTool } from './tools/read-content.js';
import { ToolRegistry } from './tools/registry.js';
import { searchContentTool } from './tools/search-content.js';

const tools = new ToolRegistry().registerAll({
  search_content: searchContentTool,
  read_content: readContentTool,
});

const NOT_CONFIGURED_MESSAGE =
  "The site assistant isn't configured yet — ask a site admin to set GATEWAY_API_KEY.";

const DISABLED_MESSAGE = 'The site assistant is currently disabled.';

// Always on. This was once toggleable via CHAT_TOOL_LABELS_ENABLED, but showing raw tool
// names is a debugging affordance for whoever is adding a tool, not a deployment setting —
// and ChatPanelComponent.toolLabel already falls back to the raw name for any tool missing
// from TOOL_LABELS, which covers the case the flag existed for.
const toolLabels = TOOL_LABELS;

// `enabled: false` is the client's cue (via GET /config) to hide the widget entirely,
// rather than rendering it with a "not configured" message — see CHAT_ENABLED in
// server/app.config.ts.
function stubChatRouter(message: string, enabled: boolean): Hono {
  const app = new Hono();

  app.post('/', () => {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const id = crypto.randomUUID();
        writer.write({ type: 'text-start', id });
        writer.write({ type: 'text-delta', id, delta: message });
        writer.write({ type: 'text-end', id });
      },
    });
    return createUIMessageStreamResponse({ stream });
  });

  app.get('/config', (c) => c.json({ enabled, model: null, tools: tools.names(), toolLabels }));

  return app;
}

// The API key is the only thing that can be missing now — the gateway base URL and model
// are constants in app.config.ts, so there's nothing else to check before going live.
export const chatRouter = !config.chatEnabled
  ? stubChatRouter(DISABLED_MESSAGE, false)
  : config.gatewayApiKey
    ? createChatRouter({
        baseURL: config.gatewayBaseUrl,
        apiKey: config.gatewayApiKey,
        defaultModel: config.chatModel,
        // Embeds dist/content/site-index.json, so it is only complete after `npm run build`
        // (or `predev`, which runs the same export script) — see prompt.ts.
        systemPrompt: buildSiteAssistantSystemPrompt(),
        tools,
        toolLabels,
        rateLimit: config.rateLimit,
        // Reasoning is a debugging aid, like the raw tool-call panel it sits next to in
        // the UI (see ChatPanelComponent.debugTools) — never streamed to a public visitor.
        sendReasoning: !config.isProduction,
        providerName: 'ai-gateway',
      })
    : stubChatRouter(NOT_CONFIGURED_MESSAGE, true);
