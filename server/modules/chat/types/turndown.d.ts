// turndown ships no type declarations and there's no @types/turndown package;
// this covers the minimal surface read-content.ts actually uses.
declare module 'turndown' {
  export default class TurndownService {
    constructor(options?: Record<string, unknown>);
    remove(selectors: string | string[]): this;
    turndown(input: string): string;
  }
}
