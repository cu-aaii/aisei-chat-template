import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeroComponent } from '../../../shared/components/hero/hero.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LocalistEventsWidgetComponent } from '../../../shared/components/localist-events-widget/localist-events-widget.component';
import { HeroSegment } from '../../../shared/components/content.models';

/**
 * Landing page: hero → a short "what is this" block → an embedded third-party widget (Cornell's Localist events
 * calendar).
 *
 * The events section is here on purpose: it is the simplest example in the template of embedding someone else's
 * widget in an Angular page. See LocalistEventsWidgetComponent for how the script tag is injected in the browser
 * only (never during prerender). Swap the query parameters there to show a different calendar, or delete the
 * section if you don't need it.
 *
 * Built from the Cornell design system: `cu-container` for the column, `cu-button` for the call to action, and
 * its tokens for the section headings (design-system/COMPONENTS.md).
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HeroComponent, LocalistEventsWidgetComponent, IconComponent],
  template: `
    <app-hero [title]="heroTitle" [subtitle]="heroSubtitle" />

    <section class="cu-container section" aria-labelledby="home-start">
      <div class="sec-head">
        <span class="eyebrow">Start here</span>
        <h2 id="home-start">A starting point for your project</h2>
      </div>
      <p class="lead">
        This page, the About page, the header, the footer, and the chat assistant in the
        corner are all yours to change. Edit
        <code>client/app/features/public/home/home.component.ts</code> to change this page,
        and <code>server/modules/chat/prompt.ts</code> to change what the assistant knows
        and how it answers.
      </p>
      <p class="actions">
        <a class="cu-button cu-button--secondary" routerLink="/about"
          >About this project<svg appIcon="arrow_forward" class="cu-icon--trail"></svg
        ></a>
      </p>
    </section>

    <!-- Embedded third-party widget: see LocalistEventsWidgetComponent -->
    <section class="cu-container section" aria-labelledby="home-events">
      <div class="sec-head">
        <span class="eyebrow">Upcoming Events</span>
        <h2 id="home-events">Workshops, talks, and networking from Cornell's events calendar</h2>
      </div>
      <div class="event-list">
        <app-localist-events-widget containerId="localist-widget-home" [num]="3" [days]="60" />
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }

    .section { padding-block: var(--space-8) 0; }
    .section:last-child { padding-block-end: var(--space-10); }

    .lead { max-width: 45rem; margin: 0 auto; font-size: var(--text-lg); line-height: var(--leading-body); }

    /* Two-part centred section heading: a large red line above the h2. */
    .sec-head { text-align: center; margin-block-end: var(--space-6); }
    .sec-head .eyebrow {
      display: block;
      font-family: var(--font-sans);
      font-size: var(--text-h2);
      font-weight: var(--weight-bold);
      color: var(--color-red-text);
      line-height: 1.15;
    }
    .sec-head h2 {
      font-family: var(--font-sans);
      font-size: var(--text-lg);
      font-weight: var(--weight-semibold);
      margin: var(--space-2) 0 0;
      color: var(--color-heading);
      line-height: 1.3;
    }

    .actions { text-align: center; margin-block-start: var(--space-6); }
    .event-list { max-width: 48rem; margin: 0 auto; }
  `,
})
export class HomeComponent {
  readonly heroTitle: HeroSegment[] = [
    { text: 'Build', accent: 1 },
    { text: 'something' },
    { text: 'useful', accent: 2 },
  ];
  readonly heroSubtitle =
    'A starter site with a built-in AI assistant. Replace this text with a ' +
    'one-sentence description of your project.';
}
