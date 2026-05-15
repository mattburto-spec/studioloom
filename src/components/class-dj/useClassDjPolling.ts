"use client";

/**
 * Class DJ — polling hook (Phase 4)
 *
 * Polls GET /api/student/class-dj/state at the canonical cadence:
 *   - student role: every 2s
 *   - teacher role: every 1s
 *
 * Pauses entirely when `document.visibilityState === "hidden"`. Resumes
 * on visible. Hard cap: stops polling after 5 minutes regardless of
 * state (defensive against zombie tabs).
 *
 * This is the canonical live-block precedent — Phase 7 codifies the
 * pattern in docs/specs/live-blocks-pattern.md so future live blocks
 * (live-exit-ticket, live-crit, live-do-now) reuse the cadence.
 *
 * Brief: docs/projects/class-dj-block-brief.md §4 (lifecycle + polling
 * discipline).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollingParams {
  unitId: string;
  pageId: string;
  activityId: string;
  classId: string;
}

export type Role = "student" | "teacher";

const CADENCE_MS: Record<Role, number> = {
  student: 2000,
  teacher: 1000,
};

const HARD_CAP_MS = 5 * 60 * 1000; // 5 minutes

export interface ClassDjState {
  status: "armed" | "live" | "closed";
  round: Record<string, unknown> | null;
  my_vote: Record<string, unknown> | null;
  participation_count: number;
  class_size: number;
  tally?: {
    mood_histogram: Record<string, number>;
    energy_histogram: Record<string, number>;
  };
  suggestion?: {
    items: Array<Record<string, unknown>>;
    generated_at: string;
    vote_count: number;
  };
}

interface HookResult {
  state: ClassDjState | null;
  error: string | null;
  isFetching: boolean;
  /** Force an immediate refetch (bypasses cadence). */
  refetch: () => void;
  /** True when the hook has stopped polling (closed state OR hard cap). */
  stopped: boolean;
}

export function useClassDjPolling(
  role: Role,
  params: PollingParams,
  options: { enabled?: boolean } = {},
): HookResult {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<ClassDjState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [stopped, setStopped] = useState(false);

  // Mount-time epoch for the hard cap.
  const startedAtRef = useRef<number>(Date.now());

  // When `status === "closed"` is first observed, record the timestamp so we
  // keep polling for a grace window. Reason: when the timer naturally expires
  // and the gate is met, ClassDjBlock auto-fires /suggest from the student
  // side. The new suggestion row is inserted server-side, but we need at
  // least one more poll across all connected clients to catch it. Without
  // this grace window, polling stops on the first close-poll and every
  // client misses the auto-generated suggestion until they refresh.
  const closeFirstSeenAtRef = useRef<number | null>(null);

  // Grace window after close before truly stopping. 15s covers:
  //   - ~2s student polling cadence × multiple polls
  //   - Stage 3 LLM candidate-pool call (~3-8s)
  //   - Stage 5 narration LLM call (~2-5s)
  //   - Margin for slow networks
  const CLOSE_GRACE_MS = 15_000;

  // Build the URL once per param change.
  const url = (() => {
    const qs = new URLSearchParams({
      unitId: params.unitId,
      pageId: params.pageId,
      activityId: params.activityId,
      classId: params.classId,
    }).toString();
    return `/api/student/class-dj/state?${qs}`;
  })();

  const fetchOnce = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setError(errBody.error ?? `HTTP ${res.status}`);
      } else {
        const body = (await res.json()) as ClassDjState;
        setState(body);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setIsFetching(false);
    }
  }, [url]);

  useEffect(() => {
    if (!enabled || stopped) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      // Pause when tab hidden — don't fetch, but keep the tick alive
      // so we resume cleanly on visible.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timer = setTimeout(tick, CADENCE_MS[role]);
        return;
      }
      // Hard cap: 5 minutes since mount.
      if (Date.now() - startedAtRef.current > HARD_CAP_MS) {
        setStopped(true);
        return;
      }
      await fetchOnce();
      if (cancelled) return;
      // Round closed — keep polling for a grace window so the
      // auto-suggest fired by ClassDjBlock on close-detection has time
      // to complete and propagate. Stop early if we already have the
      // suggestion in hand. See closeFirstSeenAtRef / CLOSE_GRACE_MS docs
      // above for the rationale.
      if (state?.status === "closed") {
        if (closeFirstSeenAtRef.current === null) {
          closeFirstSeenAtRef.current = Date.now();
        }
        const elapsed = Date.now() - closeFirstSeenAtRef.current;
        const hasSuggestion = Boolean(state.suggestion?.items);
        if (hasSuggestion || elapsed > CLOSE_GRACE_MS) {
          setStopped(true);
          return;
        }
        // Otherwise keep polling at the normal cadence — fall through.
      }
      timer = setTimeout(tick, CADENCE_MS[role]);
    };

    // Kick off immediately.
    tick();

    // Wake on visibilitychange (resume fast when user returns to tab).
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps — tick captures
    // the latest state.status via closure, but cadence/role/url drive the
    // effect's restart cadence. We don't want re-running on every state
    // update.
  }, [enabled, stopped, role, url, fetchOnce]);

  return { state, error, isFetching, refetch: fetchOnce, stopped };
}

export { CADENCE_MS as CLASS_DJ_POLLING_CADENCE_MS, HARD_CAP_MS as CLASS_DJ_POLLING_HARD_CAP_MS };
