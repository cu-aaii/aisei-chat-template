export const BASELINE: string;
export function stripComments(src: string, isTs: boolean): string;
export function findColours(src: string, isTs: boolean): { token: string; line: number }[];
export function tally(entries: [string, { token: string; line: number }[]][]): Record<string, Record<string, number>>;
export function overBaseline(
  current: Record<string, Record<string, number>>,
  baseline: Record<string, Record<string, number>>,
): { file: string; token: string; extra: number }[];
export function checkRawColours(
  root: string,
  opts?: { writeBaseline?: boolean },
): { code: number; lines: string[]; current: Record<string, Record<string, number>> };
