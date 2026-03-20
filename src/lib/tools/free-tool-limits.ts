/**
 * Rate limit configuration for free tools (Phase 6.5 Lead Gen).
 *
 * 20 uses per 30-day rolling window, keyed by email.
 * In-memory — resets on Vercel cold start, acceptable for free tier.
 */

import type { RateLimitWindow } from "@/lib/rate-limit";

export const FREE_TOOL_LIMITS: RateLimitWindow[] = [
  { maxRequests: 20, windowMs: 30 * 24 * 60 * 60 * 1000 }, // 20 per 30 days
];

export function freeToolRateLimitKey(tool: string, email: string): string {
  return `free-tool:${tool}:${email.trim().toLowerCase()}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
