/** Shared presentational content models. Add your own content types here. */

/** One segment of the hero headline; `accent` sets it as an italic accent word (both values look the same since #22). */
export interface HeroSegment {
  text: string;
  accent?: 1 | 2;
}
