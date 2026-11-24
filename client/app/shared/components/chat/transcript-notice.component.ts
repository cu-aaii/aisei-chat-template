import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ChatEngineService } from '../../services/chat-engine.service';

/**
 * Standing disclosure shown just above the chat input when the server saves
 * conversations (`CHAT_TRANSCRIPT_LOG`, reported as `transcriptLog` by
 * `GET /api/chat/config`). Renders nothing while the flag is false — including
 * before the config resolves or if the fetch failed.
 */
@Component({
  selector: 'app-transcript-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chatEngine.transcriptLog()) {
      <p class="transcript-notice">Test version: conversations are saved for review.</p>
    }
  `,
  styles: `
    .transcript-notice {
      margin: 0;
      padding: 0 var(--space-4) var(--space-2);
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-muted);
      max-inline-size: none;
    }
  `,
})
export class TranscriptNoticeComponent {
  protected readonly chatEngine = inject(ChatEngineService);
}
