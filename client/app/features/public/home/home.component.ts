import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeroComponent } from '../../../shared/components/hero/hero.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { LocalistEventsWidgetComponent } from '../../../shared/components/localist-events-widget/localist-events-widget.component';
import { HeroSegment } from '../../../shared/components/content.models';

/**
 * Landing page: animated hero → a short "what is this" block → an embedded
 * third-party widget (Cornell's Localist events calendar).
 *
 * The events section is here on purpose — it is the simplest example in the
 * template of embedding someone else's widget in an Angular page. See
 * LocalistEventsWidgetComponent for how the script tag is injected in the browser
 * only (never during prerender). Swap the query parameters there to show a
 * different calendar, or delete the section if you don't need it.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HeroComponent, LocalistEventsWidgetComponent, ButtonComponent],
  template: `
    <app-hero [title]="heroTitle" [subtitle]="heroSubtitle" />

    <section class="wrap container-fluid intro">
      <div class="sec-head">
        <span class="eyebrow">Start here</span>
        <h2>A starting point for your project</h2>
      </div>
      <p>
        This page, the About page, the header, the footer, and the chat assistant in the
        corner are all yours to change. Edit
        <code>client/app/features/public/home/home.component.ts</code> to change this page,
        and <code>server/modules/chat/prompt.ts</code> to change what the assistant knows
        and how it answers.
      </p>
      <div class="see-all-wrap">
        <a appButton routerLink="/about">About this project</a>
      </div>
    </section>

    <!-- Embedded third-party widget: see LocalistEventsWidgetComponent -->
    <section class="wrap container-fluid pad-bottom">
      <div class="sec-head">
        <span class="eyebrow">Upcoming Events</span>
        <h2>Workshops, talks, and networking from Cornell's events calendar</h2>
      </div>
      <div class="event-list">
        <app-localist-events-widget containerId="localist-widget-home" [num]="3" [days]="60" />
      </div>
    </section>
  `,
  styles: `
    :host { display: block; background: #fff; }

    .wrap { margin-bottom: 56px; }
    .wrap.pad-bottom { margin-bottom: 72px; }

    .intro p { max-width: 720px; margin: 0 auto; font-size: 17px; line-height: 1.6; }
    .intro code { font-size: 15px; background: #f3f3f3; padding: 1px 5px; border-radius: 3px; }

    /* Two-part centered section heading (big red line + smaller black line) */
    .sec-head { text-align: center; margin: 48px 0 28px; }
    .sec-head .eyebrow {
      display: block;
      font-family: var(--heading-font);
      font-size: 34px;
      font-weight: 700;
      color: var(--color-accent);
      line-height: 1.15;
    }
    .sec-head h2 {
      font-family: var(--heading-font);
      font-size: 18px;
      font-weight: 600;
      margin: 6px 0 0;
      color: #222;
      line-height: 1.3;
    }

    .see-all-wrap { text-align: center; margin-top: 36px; }
    .event-list { max-width: 760px; margin: 0 auto; }

    @media (max-width: 767px) {
      .sec-head .eyebrow { font-size: 28px; }
    }
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
