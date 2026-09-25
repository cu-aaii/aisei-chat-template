import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AbstractChat, DefaultChatTransport } from 'ai';
import type { ChatInit, ChatState, ChatStatus, UIMessage } from 'ai';

/**
 * The AI SDK's transport uses raw `fetch()`, not Angular's `HttpClient`, so its
 * built-in XSRF interceptor never runs here — this reads the double-submit cookie
 * the server sets (see `server/middleware/csrf.ts`) and echoes it back manually.
 */
function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Echoes the double-submit cookie back as a header — see `readCookie` above. */
function csrfHeaders(): Record<string, string> {
  const token = readCookie('XSRF-TOKEN');
  return token ? { 'X-XSRF-TOKEN': token } : {};
}

/**
 * Angular signals-based `ChatState`. The AI SDK's default state implementation
 * mutates the in-progress assistant message in place and hands `replaceMessage`
 * that same object reference on every streamed chunk — an OnPush component whose
 * template reads `chat.messages` never sees a change, since the reference never
 * changes. This shallow-clones the message (and its parts) on every replace so
 * every read gets a fresh reference. Ported from ng-chat's `NgChatState`.
 */
class SignalChatState<M extends UIMessage = UIMessage> implements ChatState<M> {
  readonly #messages = signal<M[]>([]);
  readonly #status = signal<ChatStatus>('ready');
  readonly #error = signal<Error | undefined>(undefined);

  get messages(): M[] {
    return this.#messages();
  }
  set messages(m: M[]) {
    this.#messages.set([...m]);
  }

  get status(): ChatStatus {
    return this.#status();
  }
  set status(s: ChatStatus) {
    this.#status.set(s);
  }

  get error(): Error | undefined {
    return this.#error();
  }
  set error(e: Error | undefined) {
    this.#error.set(e);
  }

  constructor(initial: M[] = []) {
    this.#messages.set([...initial]);
  }

  setMessages = (msgs: M[]): void => {
    this.#messages.set([...msgs]);
  };

  pushMessage = (m: M): void => {
    this.#messages.update((msgs) => [...msgs, m]);
  };

  popMessage = (): void => {
    this.#messages.update((msgs) => msgs.slice(0, -1));
  };

  replaceMessage = (index: number, message: M): void => {
    this.#messages.update((msgs) => {
      const copy = [...msgs];
      copy[index] = {
        ...message,
        parts: (message.parts ?? []).map((p) => ({ ...p })),
      } as M;
      return copy;
    });
  };

  snapshot = <T>(thing: T): T => {
    try {
      return structuredClone(thing);
    } catch {
      return thing;
    }
  };
}

class SiteChat<M extends UIMessage = UIMessage> extends AbstractChat<M> {
  constructor(init: Omit<ChatInit<M>, 'messages'> & { messages?: M[] }) {
    super({ ...init, state: new SignalChatState<M>(init.messages) });
  }
}

/**
 * App-wide singleton chat conversation. Backs both the floating chat dialog
 * (mounted once in `PublicLayoutComponent`, never destroyed) and the inline
 * AI panel on `/search` — deliberately one shared conversation, so switching
 * between the two surfaces on the same visit continues the same thread.
 */
@Injectable({ providedIn: 'root' })
export class ChatEngineService {
  /**
   * Whether the site assistant is turned on server-side (`CHAT_ENABLED` in
   * `server/app.config.ts`). Optimistically `true` so the widget doesn't flash in
   * on the common path; flips to `false` once `GET /api/chat/config` confirms the
   * feature is off, which hides the floating dialog and the search page's AI tab.
   */
  readonly enabled = signal(true);

  /**
   * Friendly tool-name -> label map for the chat panel's tool-call summary (e.g.
   * `search_content` -> "Searching site content"), sourced from
   * `server/modules/chat/tool-labels.ts` via `GET /api/chat/config`. Empty until
   * that request resolves; `ChatPanelComponent.toolLabel()` falls back to the raw
   * tool name for anything not (yet) present here.
   */
  readonly toolLabels = signal<Record<string, string>>({});

  constructor() {
    // Prerendering runs this in Node with no origin to resolve a relative URL
    // against, and there's no server-rendered request to read config from anyway
    // — skip there and only check once hydrated in the browser.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    fetch('/api/chat/config', { headers: csrfHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { enabled?: boolean; toolLabels?: Record<string, string> } | null) => {
        if (body && body.enabled === false) this.enabled.set(false);
        if (body?.toolLabels) this.toolLabels.set(body.toolLabels);
      })
      .catch(() => {
        // Config is optional: on failure the widget keeps its defaults.
      });
  }

  readonly chat = new SiteChat<UIMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: csrfHeaders,
    }),
  });

  /** Ends the shared conversation and starts a fresh one — used by the "clear chat" action. */
  async clear(): Promise<void> {
    if (this.chat.status === 'streaming' || this.chat.status === 'submitted') {
      await this.chat.stop();
    }
    this.chat.messages = [];
    this.chat.clearError();
  }
}
