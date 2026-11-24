import { ApplicationConfig } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  TitleStrategy,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { provideClientHydration, withEventReplay, withNoIncrementalHydration } from '@angular/platform-browser';
import { routes } from './app.routes';
import { SiteTitleStrategy } from './shared/site-title.strategy';
import { provideLook } from './shared/look/look';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withComponentInputBinding(),
      withViewTransitions(),
      withPreloading(PreloadAllModules),
    ),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    { provide: TitleStrategy, useClass: SiteTitleStrategy },
    // The site's Cornell look: header style, navigation, headings, first-visit colour mode, the footer's Appearance
    // switch. Choose one in design-system/showcase/customizer.html, which writes this object (the cornell-look
    // skill). Empty = the defaults (shared/look/look.ts, DEFAULT_LOOK): the CDS white banner under the thin red line.
    ...provideLook({}),
  ],
};
