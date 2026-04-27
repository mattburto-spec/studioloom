"use client";

import { useEffect, useState } from "react";
import type { L1Target } from "@/lib/tap-a-word/language-mapping";

/**
 * Phase 2.5 — page-session cache for the student's resolved support
 * settings. Fetches once per (studentId, classId) tuple via
 * GET /api/student/me/support-settings, then serves from memory.
 *
 * Used by TappableText to gate rendering BEFORE any tap happens — if
 * tapAWordEnabled is false, the component skips wrapping words as buttons
 * entirely (just renders plain spans). Avoids the "tap and tap and see
 * the same disabled message" UX failure of lazy-on-tap detection.
 *
 * Cache is module-scoped (Map) so all TappableText instances on the same
 * page share the result — single network request per page load.
 */

export interface ResolvedClientSettings {
  l1Target: L1Target;
  tapAWordEnabled: boolean;
  l1Source: "intake" | "student-override" | "class-override" | "default";
  tapASource: "default" | "student-override" | "class-override";
}

interface CacheEntry {
  loading: boolean;
  data: ResolvedClientSettings | null;
  error: string | null;
  // Promise so concurrent first-callers don't fire duplicate fetches
  inflight: Promise<void> | null;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(classId?: string): string {
  return classId ? `c:${classId}` : "no-class";
}

function fetchOnce(classId: string | undefined): Promise<void> {
  const key = cacheKey(classId);
  const existing = cache.get(key);
  if (existing?.inflight) return existing.inflight;

  const url = classId
    ? `/api/student/me/support-settings?classId=${encodeURIComponent(classId)}`
    : "/api/student/me/support-settings";

  const promise = (async () => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        cache.set(key, {
          loading: false,
          data: null,
          error: `HTTP ${res.status}`,
          inflight: null,
        });
        return;
      }
      const data = (await res.json()) as ResolvedClientSettings;
      cache.set(key, { loading: false, data, error: null, inflight: null });
    } catch (e) {
      cache.set(key, {
        loading: false,
        data: null,
        error: e instanceof Error ? e.message : "fetch failed",
        inflight: null,
      });
    }
  })();

  cache.set(key, { loading: true, data: null, error: null, inflight: promise });
  return promise;
}

export function useStudentSupportSettings(classId?: string): {
  loaded: boolean;
  data: ResolvedClientSettings | null;
  error: string | null;
} {
  const key = cacheKey(classId);
  const initial = cache.get(key);
  const [tick, setTick] = useState(initial?.data ? 1 : 0);

  useEffect(() => {
    const current = cache.get(key);
    if (current?.data || current?.error) {
      // Already cached — no fetch needed
      setTick((t) => t + 1);
      return;
    }
    let cancelled = false;
    void fetchOnce(classId).then(() => {
      if (!cancelled) setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key, classId]);

  // Mute unused-var warning by referencing tick
  void tick;

  const entry = cache.get(key);
  return {
    loaded: !!(entry?.data || entry?.error),
    data: entry?.data ?? null,
    error: entry?.error ?? null,
  };
}

/**
 * Test-only: clear the module-level cache between tests.
 * Not exported by the barrel; only test code should reach for it.
 */
export function __resetSupportSettingsCacheForTests(): void {
  cache.clear();
}
