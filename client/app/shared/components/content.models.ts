/** Shared presentational content models. Add your own content types here. */

/** One segment of the hero headline; `accent` colors it as an italic accent word. */
export interface HeroSegment {
  text: string;
  accent?: 1 | 2;
}
