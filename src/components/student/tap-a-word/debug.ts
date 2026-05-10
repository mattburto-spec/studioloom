"use client";

/**
 * Tap-a-word diagnostic logger. Off by default in production. Enable
 * with:
 *
 *   localStorage.setItem("tap-a-word-debug", "1")
 *
 * then refresh. Disable with:
 *
 *   localStorage.removeItem("tap-a-word-debug")
 *
 * Filed in response to Matt's 11 May 2026 report — "sometimes need to
 * click 4 times with 4 different outcomes". The existing console.debug
 * calls in TappableText / useWordLookup / WordPopover were gated on
 * NODE_ENV !== production, so they were silent on studioloom.org.
 * This wraps them in a single helper that respects both the dev-mode
 * gate AND a localStorage opt-in for prod diagnosis.
 *
 * Uses console.log (not console.debug) so the messages show in
 * Chrome's default Info filter — Verbose isn't on by default and most
 * teachers won't think to toggle it.
 */

let cached: boolean | null = null;

function tapDebugEnabled(): boolean {
  if (cached !== null) return cached;
  if (typeof window === "undefined") {
    cached = false;
    return false;
  }
  // Always on in development.
  if (process.env.NODE_ENV !== "production") {
    cached = true;
    return true;
  }
  // Opt-in in production via localStorage.
  try {
    cached = window.localStorage.getItem("tap-a-word-debug") === "1";
  } catch {
    cached = false;
  }
  return cached;
}

export function tapLog(label: string, payload?: Record<string, unknown>): void {
  if (!tapDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(`[tap-a-word] ${label}`, payload ?? {});
}
