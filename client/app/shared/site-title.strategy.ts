import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** Suffix appended to every page title except the homepage's, which is the site name. */
export const SITE_NAME = 'AISEI Chat Template';

/** Fallback description, kept in sync with the `<meta name="description">` in index.html. */
const DEFAULT_DESCRIPTION =
  'A starter Angular + Hono site with a built-in AI chat assistant, from the Cornell AI Innovation Hub.';

/**
 * Sets `<title>` and `<meta name="description">` on every navigation.
 *
 * Titles: routes declare a short `title` ("About") and this appends the site name,
 * so tabs and search results read "About | AISEI Chat Template"
 * instead of a bare "About". The homepage's title already *is* the site name, so it
 * is passed through unsuffixed.
 *
 * Descriptions: taken from the deepest route with a `data.description`. Runs during
 * prerender too — the router navigates on the server — so every static HTML file
 * ships with its own description rather than relying on a client-side update.
 */
@Injectable({ providedIn: 'root' })
export class SiteTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  override updateTitle(state: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(state);
    if (pageTitle) {
      this.title.setTitle(pageTitle === SITE_NAME ? pageTitle : `${pageTitle} | ${SITE_NAME}`);
    }

    this.meta.updateTag({
      name: 'description',
      content: this.findDescription(state),
    });
  }

  /** Deepest matched route wins, falling back to any ancestor's, then the default. */
  private findDescription(state: RouterStateSnapshot): string {
    let route: ActivatedRouteSnapshot | null = state.root;
    let description: string | undefined;
    while (route) {
      description = (route.data['description'] as string | undefined) ?? description;
      route = route.firstChild;
    }
    return description ?? DEFAULT_DESCRIPTION;
  }
}
