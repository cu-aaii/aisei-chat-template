// Drafts acceptance cases for the site assistant from its own system prompt and pages, for a
// person to review once. Run `npm run build` first, then `npm run test:chat:draft`.
//
// The model writes the questions; a person decides which are right. The draft goes to
// evals/chat-cases.draft.json (git-ignored) and never touches evals/chat-cases.json, the reviewed
// file the gate reads, so nothing a model wrote can gate a release until a person has read it and
// saved it under that name.
//
// One check runs before the reviewer sees anything: each expected phrase in an answer case must
// appear on the page the case cites, or it is dropped. A drafting model will sometimes expect a
// fact the page never states, and a case built on that fails a correct assistant forever.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { config } from '../server/app.config.js';
import { getContentRoots } from '../server/modules/chat/content-roots.js';
import { htmlToMarkdown } from '../server/modules/chat/html-to-markdown.js';
import { buildSiteAssistantSystemPrompt } from '../server/modules/chat/prompt.js';
import { caseSchema, includesPhrase, suiteSchema, type ChatCase } from './chat-cases.js';

const DRAFT_PATH = 'evals/chat-cases.draft.json';
const REVIEWED_PATH = 'evals/chat-cases.json';

const ANSWER_CASES_PER_PAGE = 3;
// Roughly one per kind of request the prompt's <refusals> block prepares a reply for.
const REFUSAL_CASES = 4;

const PREAMBLE = `You write acceptance tests for a website's chat assistant, given its system prompt.
A person reviews your cases once, then they run against the assistant before every release, so a
wrong case blocks a release. Leave "prohibitedClaims" empty unless the system prompt forbids
something specific that a wrong reply to that question would say; then list it as a short phrase.
Ids are short, lowercase and hyphenated.`;

// One call per page, so the size of each reply stays the same however many pages the site has.
const answerInstructions = (page: Page, idPrefix: string) => `${PREAMBLE}

Write ${ANSWER_CASES_PER_PAGE} "answer" cases about the page below: a question a real visitor might
ask that this page answers. Start every id with "${idPrefix}-". Set "source" to "${page.path}". In
"mustIncludeAny", give one to three short phrases (one to four words each) copied exactly from the
page, at least one of which any correct answer has to say: a name, a number, a place, a distinctive
term. Never a whole sentence, and never a phrase the question itself contains, or an assistant that
only repeats the question would pass. Never ask about something the system prompt tells the
assistant not to discuss, such as file names or code, even when the page mentions it.`;

const REFUSAL_INSTRUCTIONS = `${PREAMBLE}

Write ${REFUSAL_CASES} "refuse" cases, each a different kind of request the system prompt tells the
assistant to decline. Start every id with "refuse-". Set "source" to null and leave
"mustIncludeAny" empty.`;

interface Page {
  path: string;
  title: string;
  /** The page as the assistant's read_content tool returns it. */
  text: string;
}

// The pages listed in the site index, read the way the assistant reads them: prerendered HTML
// from the "pages" content root, converted to markdown.
function loadPages(): Page[] {
  const pagesDir = getContentRoots().find((root) => root.key === 'pages')?.base;
  let staticPages: { path: string; title: string }[] = [];
  try {
    staticPages = JSON.parse(readFileSync('dist/content/site-index.json', 'utf-8')).staticPages ?? [];
  } catch {
    // Missing before the first build, which the check below reports.
  }
  if (!pagesDir || staticPages.length === 0) throw new Error('No prerendered pages. Run `npm run build` first.');
  // Prerendering writes `/` to index.html and `/about` to about/index.html.
  return staticPages.map(({ path, title }) => ({
    path,
    title,
    text: htmlToMarkdown(readFileSync(resolve(pagesDir, `.${path}`, 'index.html'), 'utf-8')),
  }));
}

// Keeps only the expected phrases that are on the cited page and not already in the question
// (a reply that just repeats the question would match those), and drops an answer case left
// with none.
function ground(cases: ChatCase[], pages: Page[]): ChatCase[] {
  const textByPath = new Map(pages.map((page) => [page.path, page.text]));
  const kept: ChatCase[] = [];
  for (const testCase of cases) {
    if (testCase.expect !== 'answer') {
      kept.push(testCase);
      continue;
    }
    const page = testCase.source === null ? undefined : textByPath.get(testCase.source);
    const usable = testCase.mustIncludeAny.filter(
      (phrase) => page !== undefined && includesPhrase(page, phrase) && !includesPhrase(testCase.ask, phrase),
    );
    const dropped = testCase.mustIncludeAny.filter((phrase) => !usable.includes(phrase));
    if (dropped.length > 0) {
      console.warn(`[draft] ${testCase.id}: dropped ${JSON.stringify(dropped)}, not on ${testCase.source} or in the question`);
    }
    if (usable.length === 0) {
      console.warn(`[draft] ${testCase.id}: dropped the case, it has nothing left to check`);
      continue;
    }
    kept.push({ ...testCase, mustIncludeAny: usable });
  }
  return kept;
}

if (!config.gatewayApiKey) {
  console.error('[draft] Set GATEWAY_API_KEY in .env: the draft is written by the model on the gateway.');
  process.exit(1);
}

const pages = loadPages();

// The assistant's own provider settings (chat-router.ts), plus structured output so the reply is
// parsed against caseSchema instead of scraped out of prose.
const provider = createOpenAICompatible({
  name: 'ai-gateway',
  baseURL: config.gatewayBaseUrl,
  apiKey: config.gatewayApiKey,
  supportsStructuredOutputs: true,
});

// Seen live through the gateway: the model sometimes returns the array as a JSON string of the
// whole object ({"cases": "{\"cases\": [...]}"}) instead of the array itself. Decoding that one
// shape keeps a transport quirk from failing the draft; anything else still fails the schema.
function decodeStringified(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && 'cases' in parsed ? parsed.cases : parsed;
  } catch {
    return value;
  }
}

const draftSchema = z.object({ cases: z.preprocess(decodeStringified, z.array(caseSchema)) });

const assistantPrompt = `<assistant_system_prompt>\n${buildSiteAssistantSystemPrompt()}\n</assistant_system_prompt>`;

async function draftCases(system: string, page?: Page): Promise<ChatCase[]> {
  const pageText = page ? `\n\n<page path="${page.path}" title="${page.title}">\n${page.text}\n</page>` : '';
  const { output } = await generateText({
    model: provider(config.chatModel),
    system,
    prompt: `${assistantPrompt}${pageText}`,
    output: Output.object({ schema: draftSchema }),
  });
  return output.cases;
}

const drafted: ChatCase[] = [];
for (const page of pages) {
  // `/` becomes "home", `/team/alumni` becomes "team-alumni", so ids from separate calls can't collide.
  const idPrefix = page.path === '/' ? 'home' : page.path.slice(1).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  drafted.push(...(await draftCases(answerInstructions(page, idPrefix), page)));
}
drafted.push(...(await draftCases(REFUSAL_INSTRUCTIONS)));

const draft = { cases: ground(drafted, pages) };
writeFileSync(DRAFT_PATH, `${JSON.stringify(draft, null, 2)}\n`, 'utf-8');

// Written either way: a duplicate id or a bad phrase is the reviewer's to fix, and the gate
// refuses the file until they have.
const result = suiteSchema.safeParse(draft);
if (!result.success) {
  for (const issue of result.error.issues) console.warn(`[draft] fix before saving: ${issue.message}`);
}
console.log(
  `[draft] wrote ${draft.cases.length} cases to ${DRAFT_PATH}. Read every one, fix or delete what is ` +
    `wrong, then save it as ${REVIEWED_PATH}.`,
);
