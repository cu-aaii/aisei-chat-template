export const LOCK_FILE: string;
export const MAPPINGS: { from: string; to: string; prefix?: string }[];
export const APP_GENERATED: string[];
export function sha256(buf: Buffer | string): string;
export function listFiles(dir: string, base?: string): string[];
export function ownedRoots(root: string): string[];
export function hashTree(root: string): Record<string, string>;
export function diffLock(
  locked: Record<string, string>,
  actual: Record<string, string>,
): { missing: string[]; extra: string[]; changed: string[]; ok: boolean };
export function mapPath(upstream: string): string | null;
