import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './shared/services/theme/theme.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: `:host { display: block; min-height: 100vh; }`,
})
export class AppComponent {
  constructor() {
    // Applies the stored colour mode (assets/pre-paint.js already did, before first paint; this keeps the
    // service's signals in step with it, and covers a blocked script).
    inject(ThemeService);
  }
}
