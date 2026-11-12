import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ChatEngineService, type FeedbackRating } from '../../services/chat-engine.service';
import { IconComponent, type IconName } from '../icon/icon.component';

interface RatingOption {
  value: FeedbackRating;
  label: string;
  icon: IconName;
}

/**
 * Tester rating for one finished assistant answer: Good / Partly / Not helpful, then an
 * optional note. Three options, not two — "right, but it missed X" is the most common
 * verdict when a librarian checks an answer, and a forced thumbs-up/down loses it.
 * Rendered by ChatPanelComponent only when `ChatEngineService.feedback()` is on
 * (`CHAT_FEEDBACK=true`), so a live site with the flag off shows nothing.
 */
@Component({
  selector: 'app-answer-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="feedback" role="group" aria-label="Rate this answer">
      <span class="prompt">Rate this answer</span>
      @for (option of options; track option.value) {
        <button
          type="button"
          class="choice"
          [class.selected]="saved()?.rating === option.value"
          [attr.aria-pressed]="saved()?.rating === option.value"
          [disabled]="pending()"
          (click)="choose(option.value)"
        >
          <app-icon [name]="option.icon" />
          <span>{{ option.label }}</span>
        </button>
      }
    </div>
    @if (saved(); as current) {
      @if (noteOpen()) {
        <form class="note" (submit)="saveNote($event, noteBox.value)">
          <label class="note-label" [attr.for]="noteId()">{{ notePrompt() }}</label>
          <textarea
            #noteBox
            class="note-field"
            rows="2"
            maxlength="1000"
            [id]="noteId()"
            [value]="current.note"
            placeholder="Optional"
            [attr.aria-describedby]="noteId() + '-hint'"
          ></textarea>
          <p class="note-hint" [id]="noteId() + '-hint'">Saved with this conversation for review. Please don't include personal details.</p>
          <div class="note-actions">
            <button type="submit" class="note-save" [disabled]="pending()">Save note</button>
            <button type="button" class="note-skip" (click)="noteOpen.set(false)">Skip</button>
          </div>
        </form>
      } @else {
        <p class="status" role="status">
          Thanks, saved{{ current.note ? ' with a note' : '' }}.
          <button type="button" class="link" (click)="noteOpen.set(true)">
            {{ current.note ? 'Edit note' : 'Add a note' }}
          </button>
        </p>
      }
    }
    @if (failed()) {
      <p class="status error" role="alert">Couldn't save that rating. Please try again.</p>
    }
  `,
  styles: `
    :host { display: block; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border); }
    .feedback { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .prompt { font-size: 13px; color: #555; margin-right: 2px; flex-basis: 100%; }
    .choice {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: #fff;
      color: #333;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .choice app-icon { font-size: 15px; }
    .choice:hover:not(:disabled) { border-color: #999; }
    .choice.selected { border-color: var(--color-accent); color: var(--color-accent); background: #fdf3f3; }
    .choice:disabled { opacity: 0.6; cursor: default; }
    .note { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
    .note-label { font-size: 13px; color: #555; }
    .note-field {
      font: inherit;
      font-size: 14px;
      padding: 6px 8px;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      resize: vertical;
      background: #fff;
    }
    .note-hint { margin: 0; font-size: 12px; color: #666; }
    .note-actions { display: flex; gap: 8px; }
    .note-save, .note-skip {
      font: inherit;
      font-size: 13px;
      padding: 3px 12px;
      border-radius: 14px;
      cursor: pointer;
    }
    .note-save { border: none; background: var(--color-accent); color: #fff; }
    .note-save:disabled { opacity: 0.6; cursor: default; }
    .note-skip { border: 1px solid var(--color-border); background: #fff; color: #333; }
    .status { margin: 6px 0 0; font-size: 13px; color: #555; }
    .status.error { color: #8a1113; }
    .link {
      border: none;
      background: none;
      padding: 0;
      font: inherit;
      color: var(--color-accent);
      text-decoration: underline;
      cursor: pointer;
    }
  `,
})
export class AnswerFeedbackComponent {
  /** The assistant message being rated. */
  readonly messageId = input.required<string>();
  /** 1-based turn: the number of user messages up to this answer, as in the transcript line. */
  readonly turn = input.required<number>();

  private readonly chatEngine = inject(ChatEngineService);

  protected readonly options: readonly RatingOption[] = [
    { value: 'good', label: 'Good', icon: 'thumb_up' },
    { value: 'partly', label: 'Partly', icon: 'thumbs_up_down' },
    { value: 'not-helpful', label: 'Not helpful', icon: 'thumb_down' },
  ];

  protected readonly saved = computed(() => this.chatEngine.ratings()[this.messageId()]);
  protected readonly noteId = computed(() => `feedback-note-${this.messageId()}`);
  protected readonly notePrompt = computed(() =>
    this.saved()?.rating === 'good' ? 'Anything to add?' : 'What was missing or wrong?',
  );
  protected readonly pending = signal(false);
  protected readonly failed = signal(false);
  protected readonly noteOpen = signal(false);

  protected async choose(rating: FeedbackRating): Promise<void> {
    if (this.saved()?.rating === rating) {
      this.noteOpen.set(true);
      return;
    }
    // A changed rating keeps the note already written.
    if (await this.send(rating, this.saved()?.note ?? '')) this.noteOpen.set(true);
  }

  protected async saveNote(event: SubmitEvent, note: string): Promise<void> {
    event.preventDefault();
    const current = this.saved();
    if (!current) return;
    if (await this.send(current.rating, note.trim())) this.noteOpen.set(false);
  }

  private async send(rating: FeedbackRating, note: string): Promise<boolean> {
    this.pending.set(true);
    this.failed.set(false);
    const ok = await this.chatEngine.rate(this.messageId(), this.turn(), rating, note);
    this.pending.set(false);
    this.failed.set(!ok);
    return ok;
  }
}
