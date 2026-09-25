// Shared HTML->Markdown conversion for prerendered "pages" content, used by both
// read-content.ts (full-file reads) and search-content.ts (line search over the
// converted text instead of raw HTML boilerplate).
import TurndownService from 'turndown';

const BOILERPLATE_SELECTORS = [
  'script',
  'style',
  'nav',
  'header',
  'footer',
  'app-public-masthead',
  'app-site-footer',
  'app-scroll-to-top',
  'app-chat-dialog',
];

const turndown = new TurndownService();
turndown.remove(BOILERPLATE_SELECTORS);

export function htmlToMarkdown(html: string): string {
  const mainMatch = html.match(/<main[^>]*id=["']main["'][^>]*>([\s\S]*?)<\/main>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const fragment = mainMatch?.[1] ?? bodyMatch?.[1] ?? html;
  return turndown.turndown(fragment);
}
