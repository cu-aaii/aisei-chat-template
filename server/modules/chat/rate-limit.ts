// Per-IP sliding-window rate limiter — ported from ng-chat's
// packages/chat-server/src/lib/rate-limit.ts. /api/chat is public and unauthenticated
// and forwards to a paid gateway, so this caps abuse without needing a session/auth layer.
import type { Context } from 'hono';

export function getClientIp(c: Context): string {
  // The ALB always appends the real, TCP-verified client IP as the LAST entry of
  // X-Forwarded-For — anything before that is client-supplied and can be spoofed to
  // defeat this per-IP limiter, so we must trust the last hop, not the first.
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return c.req.header('x-real-ip') ?? 'unknown';
}

export function createRateLimiter(maxRequests: number, windowMs: number): (ip: string) => boolean {
  const buckets = new Map<string, number[]>();

  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of buckets) {
      const kept = timestamps.filter((t) => t > cutoff);
      if (kept.length === 0) buckets.delete(ip);
      else buckets.set(ip, kept);
    }
  }, windowMs);
  sweep.unref();

  return (ip: string): boolean => {
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (buckets.get(ip) ?? []).filter((t) => t > cutoff);
    if (timestamps.length >= maxRequests) {
      buckets.set(ip, timestamps);
      return false;
    }
    timestamps.push(now);
    buckets.set(ip, timestamps);
    return true;
  };
}
