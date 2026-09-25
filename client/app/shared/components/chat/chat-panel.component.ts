import {
  afterEveryRender,
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
 * Shared chat surface — the message list + composer used by both the floating
 * `<app-chat-dialog>` (mounted once, every page) and the inline AI panel on
 * `/search`. Both read the same `ChatEngineService` singleton, so a
 * conversation started in one continues seamlessly in the other.
 */
@Component({
  selector: 'app-chat-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MarkdownPipe, ThinkingIndicatorComponent],
  host: { class: 'chat-panel', '(click)': 'onContentClick($event)' },
  template: `
    <div #scroller class="scroll" role="log" aria-live="polite" aria-label="Chat messages">
      @if (chatEngine.chat.messages.length > 0) {
        @for (message of chatEngine.chat.messages; track message.id) {
          <div class="row" [class.user]="message.role === 'user'" [class.assistant]="message.role !== 'user'">
            <div class="bubble">
              @for (part of asParts(message.parts); track $index) {
                @switch (kind(part)) {
                  @case ('text') {
                    @if (message.role === 'user') {
                      <div class="text user-text">{{ part.text }}</div>
                    } @else {
                      <div class="text" [innerHTML]="part.text | chatMarkdown"></div>
                    }
                  }
                  @case ('tool') {
                    @if (debugTools) {
                      <details class="tool-call">
                        <summary>{{ toolLabel(part) }}</summary>
                        @if (part.input) {
                          <pre class="tool-io">{{ stringify(part.input) }}</pre>
                        }
                        @if (part.output) {
                          <pre class="tool-io">{{ stringify(part.output) }}</pre>
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
          </div>
        }
      } @else {
        <div class="empty">
          <app-icon name="chat" />
          <h2>Ask about the Hub</h2>
          <p>Ask me about anything on this site.</p>
        </div>
      }
    </div>

    <form class="composer" (submit)="onSubmit($event)">
      @if (errorText()) {
        <div class="error-banner">{{ errorText() }}</div>
      }
      <div class="input-row">
        <textarea
          #box
          name="message"
          class="field"
          rows="1"
          aria-label="Message"
          placeholder="Ask a question…"
          (input)="autoGrow(box)"
          (keydown)="onKeydown($event, box)"
        ></textarea>
        @if (busy()) {
          <button type="button" class="action stop" aria-label="Stop" (click)="onStop()">
            <app-icon name="close" />
          </button>
        } @else {
          <button type="submit" class="action send" aria-label="Send message">
            <app-icon name="send" />
          </button>
        }
      </div>
    </form>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      font-family: var(--body-font);
    }

    .scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 16px;
    }

    .empty {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #666;
      gap: 4px;
      padding: 24px;
    }
    .empty app-icon { font-size: 34px; color: var(--color-accent); margin-bottom: 6px; }
    .empty h2 { font-family: var(--heading-font); font-size: 20px; margin: 0; color: #222; }
    .empty p { font-size: 16px; margin: 0; max-width: 280px; }

    .row { display: flex; margin: 10px 0; }
    .row.user { justify-content: flex-end; }
    .row.assistant { justify-content: flex-start; }
    .bubble {
      max-width: 88%;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 16px;
      line-height: 1.55;
    }
    .row.user .bubble { background: var(--color-accent); color: #fff; }
    .row.assistant .bubble { background: #f2f2f2; color: #222; border: 1px solid var(--color-border); }
    .user-text { white-space: pre-wrap; word-break: break-word; }

    .text :first-child { margin-top: 0; }
    .text :last-child { margin-bottom: 0; }
    .text p { margin: 0 0 8px; }
    .text pre { background: rgba(0, 0, 0, 0.06); padding: 8px 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
    .text code { font-family: monospace; font-size: 14px; background: rgba(0, 0, 0, 0.07); padding: 1px 5px; border-radius: 3px; }
    .text pre code { background: none; padding: 0; }
    .text ul, .text ol { margin: 4px 0 8px; padding-left: 20px; }
    .text a { color: var(--color-accent); }

    .cursor { display: inline-block; margin-left: 1px; animation: chat-blink 1s step-end infinite; }
    @keyframes chat-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

    .tool-call {
      margin: 6px 0;
      font-size: 12.5px;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: #fff;
    }
    .tool-call summary {
      cursor: pointer;
      padding: 6px 10px;
      color: #555;
      font-weight: 700;
    }
    .tool-io {
      margin: 0;
      padding: 8px 10px;
      border-top: 1px solid var(--color-border);
      font-family: monospace;
      font-size: 11.5px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 200px;
      overflow-y: auto;
    }
    .tool-error { margin: 0; padding: 8px 10px; color: #8a1113; font-size: 12px; }

    .composer { flex: 0 0 auto; padding: 10px 12px 12px; border-top: 1px solid var(--color-border); }
    .error-banner {
      margin-bottom: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: #fdf1e0;
      color: #8a5a00;
      font-size: 14px;
    }
    .input-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      border: 1px solid var(--color-border);
      border-radius: 18px;
      padding: 4px 4px 4px 12px;
      background: #fff;
    }
    .field {
      flex: 1;
      align-self: stretch;
      border: none;
      outline: none;
      resize: none;
      background: transparent;
      font: inherit;
      font-size: 16px;
      line-height: 1.5;
      max-height: 160px;
      overflow-y: auto;
      padding: 8px 0;
    }
    .action {
      flex: 0 0 auto;
      width: 38px;
      height: 38px;
      border: none;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: var(--color-accent);
      color: #fff;
    }
    .action app-icon { font-size: 20px; }
    .action:disabled { opacity: 0.4; cursor: default; }
    .action.stop { background: #666; }
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

  constructor() {
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
