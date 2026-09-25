import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ChatEngineService } from '../../services/chat-engine.service';
import { ChatPanelComponent } from '../chat/chat-panel.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Floating global chat launcher, mounted once in `PublicLayoutComponent`
 * outside the router outlet so the conversation survives navigation.
 * Hidden via `[class.suppressed]` (not `@if`) on routes flagged
 * `data.hideChatWidget === true` (currently just `/search`, which builds the
 * same conversation into its own layout) — CSS suppression, not destruction,
 * keeps the `@defer`-loaded panel's state intact if a visitor opened it
 * before navigating there. Also suppressed sitewide when
 * `ChatEngineService.enabled()` is `false` (server's `CHAT_ENABLED=false`).
 *
 * `<app-chat-panel>` only loads on first interaction with the launcher —
 * `marked`/`dompurify`/the message list stay out of every page's initial
 * bundle for visitors who never open the widget.
 */
@Component({
  selector: 'app-chat-dialog',
  imports: [IconComponent, ChatPanelComponent],
  host: { '[class.suppressed]': '!enabled()' },
  template: `
    <dialog
      #panel
      class="chat-panel-shell"
      aria-label="Chat with the AI Innovation Hub assistant"
      tabindex="-1"
      [class.open]="open()"
      [class.expanded]="expanded()"
      [attr.aria-hidden]="open() ? null : 'true'"
      [attr.inert]="open() ? null : ''"
      (keydown.escape)="onEscape()"
      (cancel)="onDialogCancel($event)"
    >
      <div class="titlebar">
        <app-icon name="chat" />
        <span class="title">Hub Assistant</span>
        <button
          type="button"
          class="titlebar-btn"
          aria-label="Clear chat"
          [disabled]="chatEngine.chat.messages.length === 0"
          (click)="clearChat()"
        >
          <app-icon name="delete" />
        </button>
        <span class="divider" aria-hidden="true"></span>
        <div class="actions">
          <button
            type="button"
            class="titlebar-btn"
            [attr.aria-label]="expanded() ? 'Restore smaller chat' : 'Expand chat'"
            [attr.aria-expanded]="expanded()"
            (click)="toggleExpanded()"
          >
            <app-icon [name]="expanded() ? 'close_fullscreen' : 'open_in_full'" />
          </button>
          <button type="button" class="titlebar-btn" aria-label="Close chat" (click)="close()">
            <app-icon name="close" />
          </button>
        </div>
      </div>
      @defer (on interaction(launcher)) {
        <app-chat-panel />
      } @placeholder {
        <div class="panel-placeholder"></div>
      }
    </dialog>

    <button
      #launcher
      type="button"
      class="launcher"
      [class.hidden]="open()"
      [attr.aria-hidden]="open() ? 'true' : null"
      [attr.tabindex]="open() ? -1 : null"
      (click)="openPanel()"
    >
      <app-icon name="chat" />
      <span>Ask the Hub</span>
    </button>
  `,
  styles: `
    :host {
      display: block;
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 900;
    }
    :host(.suppressed) {
      display: none;
    }

    .launcher {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border: none;
      border-radius: 999px;
      background: var(--color-accent);
      color: #fff;
      font-family: var(--body-font);
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
    }
    .launcher app-icon {
      font-size: 20px;
    }
    .launcher:hover {
      background: var(--color-accent-dark);
    }
    .launcher:focus-visible {
      outline: 2px solid var(--color-accent-dark);
      outline-offset: 2px;
    }
    .launcher.hidden {
      display: none;
    }

    .chat-panel-shell {
      margin: 0;
      padding: 0;
      max-width: none;
      max-height: none;
      position: absolute;
      left: auto;
      right: 0;
      bottom: 0;
      width: 420px;
      height: min(640px, calc(100vh - 120px));
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      visibility: hidden;
      opacity: 0;
      transform: translateY(10px) scale(0.98);
      pointer-events: none;
    }
    @media (prefers-reduced-motion: no-preference) {
      .chat-panel-shell {
        transition: opacity 0.18s ease, transform 0.18s ease, visibility 0s linear 0.18s;
      }
      .chat-panel-shell.open {
        transition: opacity 0.18s ease, transform 0.18s ease;
      }
    }
    .chat-panel-shell.open {
      visibility: visible;
      opacity: 1;
      transform: none;
      pointer-events: auto;
    }
    .chat-panel-shell.expanded {
      position: fixed;
      top: 68px;
      right: 20px;
      bottom: 20px;
      left: 20px;
      width: auto;
      height: auto;
      z-index: 1000;
    }
    .chat-panel-shell::backdrop {
      background: rgba(20, 20, 20, 0.32);
    }
    .chat-panel-shell app-chat-panel {
      flex: 1;
      min-height: 0;
    }
    .panel-placeholder {
      flex: 1;
    }

    .titlebar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--color-primary, #222);
      color: #fff;
    }
    .titlebar app-icon:first-child {
      font-size: 18px;
    }
    .title {
      font-family: var(--heading-font);
      font-weight: 700;
      font-size: 16px;
      flex: 1;
    }
    /**
     * Separates "Clear chat" — destructive, and irreversible — from the
     * window controls next to it, so expanding or closing the panel can't
     * become a wiped conversation from a slightly-off click.
     */
    .divider {
      flex: 0 0 auto;
      width: 1px;
      height: 20px;
      background: rgba(255, 255, 255, 0.25);
    }
    .actions {
      display: flex;
      gap: 2px;
    }
    .titlebar-btn {
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: rgba(255, 255, 255, 0.75);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .titlebar-btn app-icon {
      font-size: 20px;
    }
    .titlebar-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.12);
    }
    .titlebar-btn:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 1px;
    }
    .titlebar-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .titlebar-btn:disabled:hover {
      background: transparent;
    }

    @media (max-width: 767px) {
      :host {
        right: 12px;
        bottom: 12px;
      }
      .chat-panel-shell {
        width: calc(100vw - 24px);
        height: min(70vh, calc(100vh - 80px));
      }
      .chat-panel-shell.expanded {
        top: 60px;
        right: 12px;
        bottom: 12px;
        left: 12px;
        width: auto;
        height: auto;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatDialogComponent {
  private readonly router = inject(Router);
  protected readonly chatEngine = inject(ChatEngineService);

  protected readonly open = signal(false);
  protected readonly expanded = signal(false);

  private readonly launcherEl = viewChild<ElementRef<HTMLElement>>('launcher');
  private readonly panelEl = viewChild.required<ElementRef<HTMLDialogElement>>('panel');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly enabled = computed(() => {
    if (!this.chatEngine.enabled()) return false;
    this.url();
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data['hideChatWidget'] !== true;
  });

  protected openPanel(): void {
    const dialog = this.panelEl().nativeElement;
    if (!dialog.open) dialog.show();
    this.open.set(true);
  }

  protected clearChat(): void {
    void this.chatEngine.clear();
  }

  protected toggleExpanded(): void {
    if (this.expanded()) {
      this.collapseFromExpanded();
      return;
    }
    const dialog = this.panelEl().nativeElement;
    if (dialog.open) dialog.close();
    dialog.showModal();
    this.expanded.set(true);
  }

  protected onDialogCancel(event: Event): void {
    event.preventDefault();
    if (this.expanded()) this.collapseFromExpanded();
  }

  protected onEscape(): void {
    const dialog = this.panelEl().nativeElement;
    if (dialog.matches(':modal')) return;
    this.close();
  }

  protected close(): void {
    if (!this.open()) return;
    const dialog = this.panelEl().nativeElement;
    if (dialog.open) dialog.close();
    this.open.set(false);
    this.expanded.set(false);
    requestAnimationFrame(() => this.launcherEl()?.nativeElement.focus());
  }

  private collapseFromExpanded(): void {
    const dialog = this.panelEl().nativeElement;
    dialog.close();
    dialog.show();
    this.expanded.set(false);
  }
}
