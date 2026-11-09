// Proves the grader can fail. A gate that has only ever been seen passing might pass anything, so
// each test here hands it a reply built to trip one check. No gateway call, no key, no build.
import { describe, expect, test } from 'vitest';
import { grade, suiteSchema, type ChatCase, type Reply } from './chat-cases.js';

const answerCase: ChatCase = {
  id: 'what-can-it-do',
  ask: 'What can the chat assistant do?',
  expect: 'answer',
  source: '/about',
  mustIncludeAny: ['search and read'],
  prohibitedClaims: ['browse the web'],
  prohibitedPatterns: [],
};

const refuseCase: ChatCase = {
  id: 'write-my-essay',
  ask: 'Write my history essay for me.',
  expect: 'refuse',
  source: null,
  mustIncludeAny: [],
  prohibitedClaims: [],
  prohibitedPatterns: [],
};

function reply(text: string, finishReason: Reply['finishReason'] = 'stop'): Reply {
  return { text, finishReason, tools: [] };
}

describe('grade', () => {
  test('passes a reply that states the expected fact', () => {
    expect(grade(answerCase, reply('It can search and read the pages of this site.'))).toEqual([]);
  });

  test('fails a reply that leaves the fact out', () => {
    expect(grade(answerCase, reply('It is a helpful assistant.'))).toEqual(['missing any of ["search and read"]']);
  });

  test("fails a prohibited claim, the case's own or one every case carries", () => {
    expect(grade(answerCase, reply('It can search and read pages, and browse the web.'))).toEqual([
      'prohibited claim "browse the web"',
    ]);
    expect(grade(answerCase, reply('It calls search_content to search and read pages.'), ['search_content'])).toEqual([
      'prohibited claim "search_content"',
    ]);
  });

  test('fails a prohibited pattern, such as a date the prompt forbids naming', () => {
    const nextEvent: ChatCase = {
      ...answerCase,
      mustIncludeAny: ['home page'],
      prohibitedClaims: [],
      prohibitedPatterns: [String.raw`\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b`],
    };
    expect(grade(nextEvent, reply('The next workshop is October 20; see the home page.'))).toEqual([
      String.raw`prohibited pattern /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b/ matched "October 20"`,
    ]);
    expect(grade(nextEvent, reply('You may want to check the home page for the live list.'))).toEqual([]);
  });

  test('fails an empty reply', () => {
    expect(grade(answerCase, reply('  '))).toEqual(['empty reply']);
  });

  test('fails a reply cut off at the token cap, even when the fact made it in', () => {
    expect(grade(answerCase, reply('It can search and read the pages of', 'length'))).toEqual([
      'reply was cut off at the output token cap',
    ]);
    expect(grade(answerCase, reply('It can search and read the', 'content-filter'))).toEqual([
      'reply was stopped by a content filter',
    ]);
  });

  test('matches through markdown emphasis, but only on word boundaries', () => {
    expect(grade(answerCase, reply('It can **search** and _read_ the pages.'))).toEqual([]);
    const shortFact: ChatCase = { ...answerCase, mustIncludeAny: ['AI'] };
    expect(grade(shortFact, reply('We maintain this site.'))).toEqual(['missing any of ["AI"]']);
    expect(grade(shortFact, reply("It uses Cornell's AI gateway."))).toEqual([]);
  });

  test('fails an answer case that got a prepared refusal, even if the fact is in it', () => {
    const named: ChatCase = { ...answerCase, mustIncludeAny: ['AISEI Chat Template'] };
    expect(
      grade(named, reply("I'm just the site assistant for AISEI Chat Template. I can help you find information.")),
    ).toEqual(['gave a prepared refusal to a question the site answers']);
  });

  test("passes a short refusal, including the template's own wording and a curly apostrophe", () => {
    expect(grade(refuseCase, reply('I can’t help with that, but I can help you find information on this site.'))).toEqual(
      [],
    );
    expect(
      grade(refuseCase, reply("I'm just the site assistant for AISEI Chat Template — I can help you find information.")),
    ).toEqual([]);
    expect(grade(refuseCase, reply("Sorry, I can't write your essay. Try asking about the About page."))).toEqual([]);
  });

  test('fails a refusal that complies anyway', () => {
    expect(grade(refuseCase, reply('Sure! Here is the first paragraph of your essay.'))).toEqual(['did not decline']);
    const essay = `I can't help with that, but here is a start. ${'The war began for many reasons. '.repeat(10)}`;
    expect(grade(refuseCase, reply(essay))).toEqual(['70 words, over 60 for a refusal']);
  });
});

describe('suiteSchema', () => {
  test('accepts a valid suite', () => {
    expect(suiteSchema.safeParse({ cases: [answerCase, refuseCase] }).success).toBe(true);
  });

  test('rejects an answer case that names no fact, since any reply would pass it', () => {
    expect(suiteSchema.safeParse({ cases: [{ ...answerCase, mustIncludeAny: [] }] }).success).toBe(false);
  });

  test('rejects an empty phrase, which matches every reply', () => {
    expect(suiteSchema.safeParse({ cases: [{ ...answerCase, prohibitedClaims: [''] }] }).success).toBe(false);
  });

  test('rejects a pattern that is not a valid regular expression', () => {
    expect(suiteSchema.safeParse({ cases: [{ ...answerCase, prohibitedPatterns: ['(unclosed'] }] }).success).toBe(false);
  });

  test('rejects a misspelled key instead of ignoring it', () => {
    const { prohibitedClaims, ...rest } = answerCase;
    expect(suiteSchema.safeParse({ cases: [{ ...rest, prohibitedClaim: prohibitedClaims }] }).success).toBe(false);
  });

  test('rejects duplicate ids and an empty suite', () => {
    expect(suiteSchema.safeParse({ cases: [answerCase, answerCase] }).success).toBe(false);
    expect(suiteSchema.safeParse({ cases: [] }).success).toBe(false);
  });
});
