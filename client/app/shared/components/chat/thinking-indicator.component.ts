import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_MS = 90;

/**
 * CLI-style braille spinner + static label, shown in place of the raw
 * tool-call summary while a tool is running (see ChatPanelComponent). The
 * label itself doesn't rotate — see the "single static label per tool"
 * decision behind ChatEngineService.toolLabels — only the spinner glyph
 * animates, mirroring the Claude Code CLI's status line.
 */
@Component({
  selector: 'app-thinking-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="thinking" role="status">
      <span class="spinner" aria-hidden="true">{{ frame() }}</span>
      <span class="label">{{ label() }}…</span>
    </span>
  `,
  styles: `
    .thinking {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 6px 0;
      font-size: 15px;
      color: #666;
    }
    .spinner {
      display: inline-block;
      width: 1em;
      font-family: monospace;
    }
    .label { font-style: italic; }
  `,
})
export class ThinkingIndicatorComponent {
  readonly label = input('Thinking');

  private readonly index = signal(0);
  protected readonly frame = computed(() => SPINNER_FRAMES[this.index() % SPINNER_FRAMES.length]);

  constructor() {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => this.index.update((i) => i + 1), FRAME_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
