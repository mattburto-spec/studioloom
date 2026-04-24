"use client";

/**
 * useFabricationStatus — Phase 4-5 polling hook.
 *
 * Polls `GET /api/student/fabrication/jobs/{jobId}/status` every 2 s
 * (default), tracks elapsed time, stops on terminal status or 90 s
 * timeout (default). Cancels cleanly on unmount.
 *
 * Pure state transitions live in `src/lib/fabrication/status-poll-state.ts`
 * — this hook is the side-effect wrapper: timers + fetch + dispatch.
 *
 * Note: this is the first extracted React hook in the codebase. Pattern
 * chosen to keep the status page shell lightweight; the alternative was
 * inlining ~80 lines of timer + fetch machinery into page.tsx. A hook
 * plus a pure reducer is more testable (reducer tests cover transition
 * logic without a jsdom harness).
 */

import * as React from "react";
import {
  initialStatusPollState,
  statusPollReducer,
  type FabricationPollState,
} from "@/lib/fabrication/status-poll-state";

export interface UseFabricationStatusOptions {
  /** Poll interval in ms. Default 2000 (brief §3 4-5). */
  pollIntervalMs?: number;
  /** Total timeout in ms before the "come back later" message. Default 90000. */
  timeoutMs?: number;
  /** Override fetch for testing. Defaults to global fetch. */
  fetcher?: typeof fetch;
  /**
   * Phase 5-4: when true, polls with `?include=results` so the response
   * includes scan_results + acknowledged_warnings. Used by the results
   * page (Phase 5-4) where the bucketed UI needs the full rule list.
   * Default false — keeps the 2s poll payload light.
   */
  includeResults?: boolean;
}

/**
 * Returned alongside the poll state so callers can force-reset after a
 * re-upload (Phase 5-5). Without this, the reducer's terminal-state
 * freeze would keep the UI stuck on the previous revision's "done" card
 * even after a new revision starts scanning.
 */
export interface UseFabricationStatusReturn {
  state: FabricationPollState;
  reset: () => void;
}

export function useFabricationStatus(
  jobId: string,
  options: UseFabricationStatusOptions = {}
): UseFabricationStatusReturn {
  const {
    pollIntervalMs = 2000,
    timeoutMs = 90000,
    fetcher,
    includeResults = false,
  } = options;

  // fetcher captured once per mount — changing it mid-lifecycle isn't a
  // supported use case. Ref so stable identity across polls.
  const fetcherRef = React.useRef(fetcher ?? ((...args) => fetch(...args)) as typeof fetch);

  const [state, dispatch] = React.useReducer(
    statusPollReducer,
    initialStatusPollState
  );

  // startedAt is set once per jobId mount — survives across re-renders,
  // resets when jobId changes.
  const startedAtRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    // Reset the clock + reducer when jobId changes.
    startedAtRef.current = Date.now();

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let tickTimer: ReturnType<typeof setInterval> | null = null;

    const elapsed = () => Date.now() - startedAtRef.current;

    const statusUrl = includeResults
      ? `/api/student/fabrication/jobs/${jobId}/status?include=results`
      : `/api/student/fabrication/jobs/${jobId}/status`;

    async function pollOnce() {
      if (cancelled) return;
      try {
        const res = await fetcherRef.current(statusUrl, { credentials: "same-origin" });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          dispatch({
            type: "POLL_ERROR",
            message: body.error || `Status check failed (HTTP ${res.status})`,
            elapsedMs: elapsed(),
          });
          return; // terminal — schedulePoll won't run after dispatch above
        }
        const data = await res.json();
        dispatch({ type: "POLL_SUCCESS", status: data, elapsedMs: elapsed() });
      } catch (e) {
        if (cancelled) return;
        dispatch({
          type: "POLL_ERROR",
          message: e instanceof Error ? e.message : "Network error",
          elapsedMs: elapsed(),
        });
      }
    }

    function schedulePoll() {
      if (cancelled) return;
      // If we've already hit a terminal state in the reducer, the next
      // effect run (via state being a terminal kind) will short-circuit.
      // But on this effect run, we've only dispatched; the useReducer
      // returns the new state on the NEXT render, not here. Guard via
      // elapsed-vs-timeoutMs instead.
      if (elapsed() >= timeoutMs) {
        dispatch({ type: "TIMEOUT", elapsedMs: elapsed() });
        return;
      }
      pollTimer = setTimeout(async () => {
        await pollOnce();
        schedulePoll();
      }, pollIntervalMs);
    }

    // Kick off an immediate first poll so the UI isn't "idle" for 2 s
    // before anything happens.
    pollOnce().then(() => {
      if (!cancelled) schedulePoll();
    });

    // Tick timer — drives the elapsed-time readout + staged messages
    // even between polls. 250 ms is smooth enough for the reader.
    tickTimer = setInterval(() => {
      if (!cancelled) {
        dispatch({ type: "TICK", elapsedMs: elapsed() });
      }
    }, 250);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (tickTimer) clearInterval(tickTimer);
    };
  }, [jobId, pollIntervalMs, timeoutMs, includeResults]);

  // Terminal-state guard: once the reducer says we're in done/error/
  // timeout, we could bail the effect early on next mount — but the
  // reducer itself already freezes terminal states against late events,
  // so no extra logic needed here.

  // reset() — dispatched by the page after a successful re-upload so
  // the next POLL_SUCCESS can move the reducer off the frozen 'done'
  // state into a fresh 'polling' state for the new revision. We also
  // reset startedAtRef so the staged messaging elapsed-time restarts.
  const reset = React.useCallback(() => {
    startedAtRef.current = Date.now();
    dispatch({ type: "RESET" });
  }, []);

  return { state, reset };
}
