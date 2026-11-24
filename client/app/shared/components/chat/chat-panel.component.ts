import {
  afterEveryRender,
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  isDevMode,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ChatEngineService } from '../../services/chat-engine.service';
import { IconComponent } from '../icon/icon.component';
import { MarkdownPipe } from './markdown.pipe';
import { ThinkingIndicatorComponent } from './thinking-indicator.component';
import { TranscriptNoticeComponent } from './transcript-notice.component';

interface MessagePart {
  type: string;
  text?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
}

/**
 * The chat's message log and composer, inside the floating `<app-chat-dialog>`; it reads the
 * `ChatEngineService` singleton, so the conversation outlives the panel.
 *
 * Markup is the design system's agent-chat block (design-system/blocks/chat.css): `cu-chat__log`
 * (`role="log"`, so new messages are announced), `cu-chat__msg--user` / `--agent`, a `cu-chat__composer`
 * form with a `cu-input` textarea and a `cu-button`, and the `cu-chat__hint` line. A failed request is a
 * `cu-notice cu-notice--warn` (status is never colour alone). The assistant's answers are Markdown: the
 * design system's base styles draw their paragraphs, lists, links and code.
 */
@Component({
  selector: 'app-chat-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MarkdownPipe, ThinkingIndicatorComponent, TranscriptNoticeComponent],
  host: { class: 'app-chat-panel', '(click)': 'onContentClick($event)' },
  template: `
    <div #scroller class="cu-chat__log" role="log" aria-label="Conversation">
      @if (chatEngine.chat.messages.length > 0) {
        @for (message of chatEngine.chat.messages; track message.id) {
          <div
            class="cu-chat__msg"
            [class.cu-chat__msg--user]="message.role === 'user'"
            [class.cu-chat__msg--agent]="message.role !== 'user'"
          >
            @for (part of asParts(message.parts); track $index) {
              @switch (kind(part)) {
                @case ('text') {
                  @if (message.role === 'user') {
                    <div class="user-text">{{ part.text }}</div>
                  } @else {
                    <div class="text" [innerHTML]="part.text | chatMarkdown"></div>
                  }
                }
                @case ('tool') {
                  @if (debugTools) {
                    <details class="tool-call">
                      <summary>{{ toolLabel(part) }}</summary>
                      @if (part.input) {
                        <pre class="tool-io"><code>{{ stringify(part.input) }}</code></pre>
                      }
                      @if (part.output) {
                        <pre class="tool-io"><code>{{ stringify(part.output) }}</code></pre>
                      }
                      @if (part.errorText) {
                        <p class="tool-error">{{ part.errorText }}</p>
                      }
                    </details>
                  }
                }
              }
            }
            @if (!debugTools && showThinking(message)) {
              <app-thinking-indicator [label]="activeToolLabel(message)" />
            }
            @if (isStreamingLast(message.id)) {
              <span class="cursor" aria-hidden="true">▋</span>
            }
          </div>
        }
        @if (awaitingReply()) {
          <div class="cu-chat__msg cu-chat__msg--agent">
            <app-thinking-indicator />
          </div>
        }
      } @else {
        <p class="cu-chat__msg cu-chat__msg--agent">
          Hi, I can answer questions about anything on this site. Ask me what a page says.
        </p>
      }
    </div>

    @if (errorText()) {
      <div class="cu-notice cu-notice--warn app-chat__error" role="alert">
        <p class="cu-notice__title">The assistant could not answer</p>
        <p>{{ errorText() }}</p>
      </div>
    }
    <app-transcript-notice />
    <form class="cu-chat__composer" (submit)="onSubmit($event)">
      <label class="cu-sr-only" for="site-chat-message">Message</label>
      <textarea
        #box
        id="site-chat-message"
        name="message"
        class="cu-input"
        rows="1"
        placeholder="Ask a question…"
        aria-describedby="site-chat-hint"
        (input)="autoGrow(box)"
        (keydown)="onKeydown($event, box)"
      ></textarea>
      @if (busy()) {
        <button type="button" class="cu-button cu-button--secondary cu-button--icon-only" aria-label="Stop" (click)="onStop()">
          <svg appIcon="close"></svg>
        </button>
      } @else {
        <button type="submit" class="cu-button cu-button--icon-only" aria-label="Send message">
          <svg appIcon="send"></svg>
        </button>
      }
    </form>
    <p class="cu-chat__hint" id="site-chat-hint">Enter to send · Shift+Enter for a new line · Esc to minimize</p>
  `,
  styles: `
    /* The host sits between the panel (a flex column) and the block's parts: it passes the column on. */
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    .user-text { white-space: pre-wrap; overflow-wrap: anywhere; }
    .text { overflow-wrap: anywhere; }
    /* The answer's own elements (p, ul, pre) come from [innerHTML], which emulated encapsulation never reaches:
       their spacing is in theme/app.css (.app-chat-panel .text). */

    .cursor { display: inline-block; margin-inline-start: 1px; animation: chat-blink 1s step-end infinite; }
    @keyframes chat-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }

    /* Raw tool input/output: development builds only (see debugTools). */
    .tool-call {
      margin-block: var(--space-2);
      font-size: var(--text-xs);
      border: var(--border-thin) solid var(--color-line);
      background: var(--color-surface);
    }
    .tool-call summary { cursor: pointer; padding: var(--space-1) var(--space-2); color: var(--color-muted); font-weight: var(--weight-bold); }
    .tool-io {
      margin: 0;
      padding: var(--space-2);
      border-block-start: var(--border-thin) solid var(--color-line);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      max-height: 200px;
      overflow-y: auto;
    }
    .tool-error { margin: 0; padding: var(--space-2); color: var(--color-error-text); }

    .app-chat__error { margin: 0 var(--space-4) var(--space-2); font-size: var(--text-sm); }
    .app-chat__error p { margin: 0; }
  `,
})
export class ChatPanelComponent {
  protected readonly chatEngine = inject(ChatEngineService);
  private readonly router = inject(Router);

  /**
   * Raw tool-call input/output is a debugging aid, not something to expose
   * to site visitors — `isDevMode()` is true under `ng serve`/dev builds and
   * false under `ng build --configuration production` (what `npm run build`
   * and the Docker image use), so this needs no separate feature flag.
   */
  protected readonly debugTools = isDevMode();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  constructor() {
    // The first open happens before this @defer chunk has loaded: take focus once, when the panel first shows.
    afterNextRender(() => this.box()?.nativeElement.focus());
    afterEveryRender(() => {
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      if (nearBottom) el.scrollTop = el.scrollHeight;
    });
  }

  /**
   * Route in-site links from assistant answers through the Angular router.
   *
   * The assistant's markdown goes through `[innerHTML]`, which Angular does not compile —
   * so `routerLink` can never be applied to these anchors, and every `/projects/<slug>`
   * the model emits would otherwise be a plain `<a>` doing a full document load: the whole
   * bundle re-downloads and the open conversation is destroyed. Delegating from the host
   * instead of wiring each anchor means links inside a still-streaming message work too.
   *
   * The widget itself is deliberately left alone — navigation happens behind it and the
   * conversation stays exactly where it was. Note this means that in expanded (modal) mode
   * the panel covers the viewport, so a visitor won't see the new page until they collapse
   * or close it.
   */
  protected onContentClick(event: MouseEvent): void {
    if (event.defaultPrevented) return;
    // Leave new-tab / new-window / middle-click / download intents to the browser.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const anchor = (event.target as Element | null)?.closest('a');
    if (!anchor) return;
    if (anchor.hasAttribute('download') || anchor.hasAttribute('target')) return;

    const href = anchor.getAttribute('href');
    // Bare fragments are in-page jumps, not routes.
    if (!href || href.startsWith('#')) return;

    // Resolving against the document catches same-origin absolute URLs as well as the
    // relative paths the prompt asks for. `mailto:`/`tel:` resolve to a null origin and
    // fall through to the browser, as do genuinely external links.
    let target: URL;
    try {
      target = new URL(anchor.href, document.baseURI);
    } catch {
      return;
    }
    if (target.origin !== window.location.origin) return;

    event.preventDefault();
    void this.router.navigateByUrl(target.pathname + target.search + target.hash);
  }

  protected busy(): boolean {
    const status = this.chatEngine.chat.status;
    return status === 'submitted' || status === 'streaming';
  }

  protected errorText(): string | undefined {
    return this.chatEngine.chat.error?.message;
  }

  /**
   * True from the moment a question is sent until the first chunk of the reply
   * arrives. In that window there is no assistant message yet, so `showThinking`
   * (which lives inside a message) has nothing to attach to, and the visitor sees
   * a silent pause. With a large system prompt that pause is most of the wait:
   * the model reads the whole prompt before it streams a word.
   */
  protected awaitingReply(): boolean {
    if (!this.busy()) return false;
    const messages = this.chatEngine.chat.messages;
    const last = messages[messages.length - 1];
    return !last || last.role !== 'assistant';
  }

  protected isStreamingLast(id: string): boolean {
    if (this.chatEngine.chat.status !== 'streaming') return false;
    const messages = this.chatEngine.chat.messages;
    const last = messages[messages.length - 1];
    return !!last && last.id === id && last.role === 'assistant';
  }

  /**
   * True while the assistant is between chunks of visible text for the message
   * currently streaming — no parts yet, or the most recent part is a tool call
   * rather than text. Models often stream a preamble sentence before calling a
   * tool, so this can't just check "no text has arrived yet": that preamble
   * part persists in `parts` throughout the tool call that follows it.
   */
  protected showThinking(message: { id: string; role: string; parts: unknown }): boolean {
    if (message.role !== 'assistant' || !this.isStreamingLast(message.id)) return false;
    const parts = this.asParts(message.parts);
    const last = parts[parts.length - 1];
    return !last || last.type !== 'text';
  }

  protected activeToolLabel(message: { parts: unknown }): string {
    const parts = this.asParts(message.parts);
    for (let i = parts.length - 1; i >= 0; i--) {
      if (this.kind(parts[i]) === 'tool') return this.toolLabel(parts[i]);
    }
    return 'Thinking';
  }

  protected asParts(parts: unknown): MessagePart[] {
    return parts as MessagePart[];
  }

  protected kind(part: MessagePart): 'text' | 'tool' | 'other' {
    if (part.type === 'text') return 'text';
    if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) return 'tool';
    return 'other';
  }

  protected toolLabel(part: MessagePart): string {
    const name = part.type === 'dynamic-tool' ? 'tool' : part.type.slice('tool-'.length);
    const label = this.chatEngine.toolLabels()[name];
    if (label) return label;
    const verb = part.state === 'output-available' ? 'Called' : 'Calling';
    return `${verb} ${name}`;
  }

  protected stringify(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  protected autoGrow(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  protected onKeydown(event: KeyboardEvent, box: HTMLTextAreaElement): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send(box);
    }
  }

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const box = (event.target as HTMLFormElement).querySelector('textarea');
    if (box) this.send(box);
  }

  protected onStop(): void {
    this.chatEngine.chat.stop();
  }

  private send(box: HTMLTextAreaElement): void {
    const text = box.value.trim();
    if (!text || this.busy()) return;
    this.chatEngine.chat.sendMessage({ text });
    box.value = '';
    this.autoGrow(box);
  }
}
