import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ChatEngineService } from '../../services/chat-engine.service';
import { ChatPanelComponent } from '../chat/chat-panel.component';
import { IconComponent } from '../icon/icon.component';
import { stopsIn, wrapTab } from '../../layout/focus-wrap';

/** Everything a keyboard can reach inside the panel (focus-wrap's default list has no textarea). */
const PANEL_STOPS = 'a[href], button:not([disabled]), textarea, summary';

/**
 * Floating chat, on the design system's agent-chat block (`cu-chat`, design-system/blocks/chat.css; reference
 * behaviour `initChat` in showcase.js). Mounted once in `PublicLayoutComponent`, outside the router outlet, so
 * the conversation survives navigation.
 *
 * Behaviour, as the block requires: the launcher opens a non-modal `<dialog>` (the page stays usable) and hides
 * itself; focus goes to the message field; Tab and Shift+Tab wrap inside the panel; Escape or Minimize closes it
 * and returns focus to the launcher. Below 768px the panel fills the screen, so there it is modal (`aria-modal`,
 * the page behind inert). "Expand" is this app's addition: a modal (`showModal()`) panel over most of the window;
 * Escape there returns to the small panel first.
 *
 * Hidden (CSS, not `@if`) on routes flagged `data.hideChatWidget === true` and when the server reports
 * `CHAT_ENABLED=false`, so the `@defer`-loaded panel keeps its state. `<app-chat-panel>` (and `marked`,
 * `dompurify`) loads on first interaction with the launcher, out of every page's initial bundle.
 */
@Component({
  selector: 'app-chat-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ChatPanelComponent],
  host: { '[class.suppressed]': '!enabled()' },
  template: `
    <div class="cu-chat" #root>
      <button
        #launcher
        type="button"
        class="cu-chat__launcher"
        [attr.aria-expanded]="open()"
        aria-controls="site-chat"
        (click)="openPanel()"
      >
        <svg appIcon="forum"></svg>Ask the Hub
      </button>
      <dialog
        #panel
        id="site-chat"
        class="cu-chat__panel"
        [class.app-chat--expanded]="expanded()"
        aria-labelledby="site-chat-title"
        tabindex="-1"
        [attr.aria-modal]="modal() ? 'true' : null"
        (keydown)="onKeydown($event)"
        (cancel)="onDialogCancel($event)"
      >
        <div class="cu-chat__bar">
          <h2 class="cu-chat__title" id="site-chat-title">Hub Assistant</h2>
          <button
            type="button"
            class="cu-chat__icon"
            aria-label="Clear chat"
            [disabled]="chatEngine.chat.messages.length === 0"
            (click)="clearChat()"
          >
            <svg appIcon="delete"></svg>
          </button>
          <span class="app-chat__divider" aria-hidden="true"></span>
          <button
            type="button"
            class="cu-chat__icon app-chat__expand"
            [attr.aria-label]="expanded() ? 'Restore smaller chat' : 'Expand chat'"
            (click)="toggleExpanded()"
          >
            <svg [appIcon]="expanded() ? 'unfold_less' : 'unfold_more'"></svg>
          </button>
          <button type="button" class="cu-chat__icon" aria-label="Minimize chat" (click)="close()">
            <svg appIcon="remove"></svg>
          </button>
        </div>
        @defer (on interaction(launcher)) {
          <app-chat-panel />
        } @placeholder {
          <div class="app-chat__placeholder"></div>
        }
      </dialog>
    </div>
  `,
  styles: `
    :host(.suppressed) { display: none; }

    .app-chat__placeholder { flex: 1; }
    /* "Clear chat" is destructive and cannot be undone: a rule sets it apart from the window controls beside it,
       so a slightly-off click on Expand or Minimize never wipes the conversation. */
    .app-chat__divider { align-self: stretch; margin-block: var(--space-1); border-inline-start: var(--border-thin) solid var(--color-line); }
    .cu-chat__icon:disabled { color: var(--color-dim); cursor: default; }
    .cu-chat__icon:disabled:hover { background: none; }

    /* Expanded: a modal panel over most of the window (this app's addition to the block). */
    .cu-chat__panel.app-chat--expanded {
      position: fixed;
      inset: var(--space-8) var(--space-5) var(--space-5);
      inline-size: auto;
      block-size: auto;
      max-inline-size: none;
      max-block-size: none;
    }
    .cu-chat__panel::backdrop { background: color-mix(in srgb, var(--color-scrim) 40%, transparent); }

    /* Phones: the block already fills the screen with the panel, so there is nothing to expand. */
    @media (max-width: 767px) {
      .app-chat__expand { display: none; }
      .cu-chat__panel.app-chat--expanded { inset: 0; }
    }
  `,
})
export class ChatDialogComponent {
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  protected readonly chatEngine = inject(ChatEngineService);

  protected readonly open = signal(false);
  protected readonly expanded = signal(false);
  private readonly phone = signal(false);
  /** Modal while it fills a phone screen; expanded is modal through showModal() and needs no extra attribute. */
  protected readonly modal = computed(() => this.open() && this.phone() && !this.expanded());

  private readonly rootEl = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly launcherEl = viewChild.required<ElementRef<HTMLButtonElement>>('launcher');
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

  constructor() {
    const media = this.doc.defaultView?.matchMedia?.('(max-width: 767px)');
    if (media) {
      this.phone.set(media.matches);
      const onChange = (e: MediaQueryListEvent) => this.phone.set(e.matches);
      media.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
    }
    // While the panel fills a phone screen, everything outside the chat is inert.
    effect((onCleanup) => {
      if (!this.modal()) return;
      const inerted = this.inertOutside(this.rootEl().nativeElement);
      onCleanup(() => inerted.forEach((el) => el.removeAttribute('inert')));
    });
  }

  protected openPanel(): void {
    const dialog = this.panelEl().nativeElement;
    if (!dialog.open) dialog.show();
    this.open.set(true);
    // On the first open the panel is still loading (@defer); it focuses its own field once it renders.
    this.focusField();
  }

  protected clearChat(): void {
    void this.chatEngine.clear();
    this.focusField();
  }

  protected toggleExpanded(): void {
    const dialog = this.panelEl().nativeElement;
    dialog.close();
    if (this.expanded()) dialog.show();
    else dialog.showModal();
    this.expanded.update((v) => !v);
    this.focusField();
  }

  /** Escape on a modal (expanded) dialog: return to the small panel instead of closing. */
  protected onDialogCancel(event: Event): void {
    event.preventDefault();
    if (this.expanded()) this.toggleExpanded();
  }

  protected onKeydown(e: KeyboardEvent): void {
    const dialog = this.panelEl().nativeElement;
    if (e.key === 'Escape') {
      if (dialog.matches(':modal')) return; // the cancel event handles it
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key === 'Tab') wrapTab(e, stopsIn(dialog, PANEL_STOPS), dialog, this.doc.activeElement);
  }

  protected close(): void {
    if (!this.open()) return;
    const dialog = this.panelEl().nativeElement;
    if (dialog.open) dialog.close();
    this.open.set(false);
    this.expanded.set(false);
    // After change detection has shown the launcher again (aria-expanded="true" hides it).
    setTimeout(() => this.launcherEl().nativeElement.focus());
  }

  private focusField(): void {
    setTimeout(() => this.panelEl().nativeElement.querySelector('textarea')?.focus());
  }

  /** Mark every sibling of the chat's ancestors (up to <body>) inert, and return what was marked. */
  private inertOutside(keep: HTMLElement): HTMLElement[] {
    const marked: HTMLElement[] = [];
    let node: HTMLElement | null = keep;
    while (node && node !== this.doc.body) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children) as HTMLElement[]) {
        if (sibling === node || sibling.hasAttribute('inert') || sibling.tagName === 'SCRIPT') continue;
        sibling.setAttribute('inert', '');
        marked.push(sibling);
      }
      node = parent;
    }
    return marked;
  }
}
