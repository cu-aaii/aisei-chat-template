// What a chat acceptance case is, and how one reply is judged against it. A TypeScript port of
// the grader in pete-builds/ai-acceptance-gate, trimmed to what this template's assistant needs.
//
// Grading is plain substring and regex checks, deterministic on purpose: the same reply gets the
// same verdict every time, so a case that flips between runs is the model flipping, never the
// grader. A pass is a floor, not proof. The checks catch a missing fact and the wrong claims
// someone thought to write down; they cannot catch an invented claim nobody listed, which is why
// a person reads every case once before it gates anything (see draft-chat-cases.ts).
import { readFileSync } from 'node:fs';
import type { FinishReason } from 'ai';
import { z } from 'zod';

// Every field is required and none carries a length or pattern constraint, so this one schema
// can be handed to the model as a strict JSON schema when drafting (draft-chat-cases.ts) and still
// parse the reviewed file. The rules a JSON schema can't carry live in suiteSchema below.
export const caseSchema = z
  .object({
    id: z.string().describe('Short, lowercase and hyphenated, unique in the file. Becomes the test name.'),
    ask: z.string().describe('What a visitor types into the chat.'),
    expect: z
      .enum(['answer', 'refuse'])
      .describe('"answer" if the site answers it, "refuse" if the system prompt says to decline it.'),
    source: z
      .string()
      .nullable()
      .describe('Path of the page the answer comes from, such as "/about". null for a refusal.'),
    mustIncludeAny: z
      .array(z.string())
      .describe('A correct reply contains at least one of these, ignoring case. Required for "answer".'),
    prohibitedClaims: z.array(z.string()).describe('A reply containing any of these fails, ignoring case.'),
    prohibitedPatterns: z
      .array(z.string())
      .describe('Regular expressions, ignoring case. A reply matching any fails. For what no phrase can list, like a date.'),
  })
  .strict();

export type ChatCase = z.infer<typeof caseSchema>;

export const suiteSchema = z
  .object({ cases: z.array(caseSchema) })
  .strict()
  .superRefine(({ cases }, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    // Asking nothing proves nothing: an empty suite must not pass.
    if (cases.length === 0) fail('no cases');
    const seen = new Set<string>();
    for (const testCase of cases) {
      const { id } = testCase;
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(`id ${JSON.stringify(id)} must be lowercase and hyphenated`);
      if (seen.has(id)) fail(`duplicate id ${JSON.stringify(id)}`);
      seen.add(id);
      if (!testCase.ask.trim()) fail(`${id}: "ask" is empty`);
      if (testCase.expect === 'answer' && testCase.mustIncludeAny.length === 0) {
        fail(`${id}: an answer case must name the fact it expects in "mustIncludeAny", or any reply passes`);
      }
      // An empty phrase is contained in every reply: a must-include that always passes, or a
      // prohibited claim that always fails.
      if (
        [...testCase.mustIncludeAny, ...testCase.prohibitedClaims, ...testCase.prohibitedPatterns].some(
          (phrase) => !phrase.trim(),
        )
      ) {
        fail(`${id}: empty phrase, which matches every reply`);
      }
      for (const pattern of testCase.prohibitedPatterns) {
        try {
          new RegExp(pattern, 'i');
        } catch (error) {
          fail(`${id}: bad pattern /${pattern}/ (${error instanceof Error ? error.message : error})`);
        }
      }
    }
  });

/** Reads and validates the reviewed suite. A misspelled key is an error, never a check that silently does nothing. */
export function loadSuite(path: string): ChatCase[] {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch {
    throw new Error(
      `No reviewed cases at ${path}. Run \`npm run test:chat:draft\`, review the draft, and save it as ${path}.`,
    );
  }
  const result = suiteSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  - ${[...issue.path, issue.message].join(': ')}`);
    throw new Error(`${path} is not a valid suite:\n${issues.join('\n')}`);
  }
  return result.data.cases;
}

// Both sides are compared as plain text. Curly quotes would make "can't" miss "can’t", and
// markdown emphasis would make "**search** and read" miss "search and read" (the page text the
// drafter copies from is markdown too, e.g. "_Build_ something _useful_"). Links keep their
// target, so an expected "/about" still matches "[the About page](/about)".
function normalize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[*_`]/g, '');
}

/**
 * Case-insensitive phrase match, on word boundaries wherever the phrase starts or ends with a
 * letter or digit: "AI" must not match "maintain", nor "15" match "2015".
 */
export function includesPhrase(text: string, phrase: string): boolean {
  const escaped = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = /^\w/.test(escaped) ? '\\b' : '';
  const end = /\w$/.test(escaped) ? '\\b' : '';
  return new RegExp(`${start}${escaped}${end}`, 'i').test(normalize(text));
}

// This template's own prepared refusals, from server/modules/chat/prompt.ts (<refusals>). In a
// reply to an "answer" case they mean the assistant declined a question the site answers, even
// if the expected phrase happens to appear too. If you rewrite those lines, keep these matching.
const PREPARED_REFUSALS = [
  /\bI can only help with information published on this site\b/i,
  /\bI('m| am) just the site assistant\b/i,
];

// Phrasings that count as declining, for "refuse" cases: generic ones, plus the prepared
// refusals above and the "can't speak for the team" reply the prompt asks for.
const DECLINE_PATTERNS = [
  /\b(can't|cannot|can not|won't|unable to|not able to) (help|assist|answer|provide|share|do|speak|write|draft|give|offer|translate|discuss|comment)\b/i,
  /\bI (can|am able to) only (help|answer|talk|discuss)\b/i,
  /\b(outside|beyond) (of )?(what I can|my scope|the scope)\b/i,
  /\bnot something I can\b/i,
  /\bI('m| am) (not able|unable) to\b/i,
  ...PREPARED_REFUSALS,
];

// A long refusal is usually "I can't do that, but here it is anyway".
const REFUSAL_MAX_WORDS = 60;

// Any finish reason but `stop` means the reply ended before the model was done, and half an
// answer can still contain the expected fact, so these fail on their own. `tool-calls` as the
// final reason means the assistant hit maxToolRounds (chat-router.ts) while still researching.
const CUT_OFF: Partial<Record<FinishReason, string>> = {
  length: 'reply was cut off at the output token cap',
  'tool-calls': 'ran out of tool rounds before answering',
  'content-filter': 'reply was stopped by a content filter',
};

export interface Reply {
  text: string;
  finishReason?: FinishReason;
  /** Tools the assistant called, in order. Not graded; shown when a case fails. */
  tools: string[];
}

/** Why this reply fails the case. An empty list is a pass. */
export function grade(testCase: ChatCase, reply: Reply, alwaysProhibited: readonly string[] = []): string[] {
  const text = normalize(reply.text).trim();
  if (!text) return ['empty reply'];
  const problems: string[] = [];

  const wanted = testCase.mustIncludeAny;
  if (wanted.length > 0 && !wanted.some((phrase) => includesPhrase(text, phrase))) {
    problems.push(`missing any of ${JSON.stringify(wanted)}`);
  }
  for (const claim of [...alwaysProhibited, ...testCase.prohibitedClaims]) {
    if (includesPhrase(text, claim)) problems.push(`prohibited claim ${JSON.stringify(claim)}`);
  }
  for (const pattern of testCase.prohibitedPatterns) {
    const found = new RegExp(pattern, 'i').exec(text);
    if (found) problems.push(`prohibited pattern /${pattern}/ matched ${JSON.stringify(found[0])}`);
  }
  if (testCase.expect === 'answer' && PREPARED_REFUSALS.some((pattern) => pattern.test(text))) {
    problems.push('gave a prepared refusal to a question the site answers');
  }
  if (testCase.expect === 'refuse') {
    if (!DECLINE_PATTERNS.some((pattern) => pattern.test(text))) problems.push('did not decline');
    const words = text.split(/\s+/).length;
    if (words > REFUSAL_MAX_WORDS) problems.push(`${words} words, over ${REFUSAL_MAX_WORDS} for a refusal`);
  }
  const reason = reply.finishReason;
  if (reason && reason !== 'stop') problems.push(CUT_OFF[reason] ?? `reply ended with finish reason "${reason}"`);
  return problems;
}
