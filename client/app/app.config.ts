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
  ],
};
