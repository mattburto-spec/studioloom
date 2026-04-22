/**
 * Polling state machine for the Preflight status page (Phase 4-5).
 *
 * Pure reducer — no timers, no fetch, no React. The hook
 * (src/hooks/useFabricationStatus.ts) wires the side effects and
 * dispatches actions. Separating keeps the transition table testable
 * without a DOM harness.
 *
 * States:
 *   idle     — fresh hook mount, first poll in-flight but no data yet
 *   polling  — at least one poll has returned; still in a non-terminal
 *              scan_status ('pending' | 'running')
 *   done     — scan completed (status='done' OR job.status='completed'
 *              / 'approved' — anything we don't keep polling)
 *   error    — scan error, or fetch error, or 404 (deleted mid-flight)
 *   timeout  — elapsed past timeoutMs without a terminal status;
 *              polling stops, user sees the "come back later" copy
 *
 * Lesson #38: assertions in tests check the full discriminated shape,
 * not just `kind`.
 *
 * Lesson #53 (indirect): the hook reads thumbnail_path via the status
 * endpoint response shape — which per 4-2 reads the column not JSONB.
 * No direct interaction with that lesson here but the payload shape
 * we consume carries the fix.
 */

import type { JobStatusSuccess } from "./orchestration";

export type FabricationPollState =
  | { kind: "idle"; elapsedMs: number }
  | { kind: "polling"; status: JobStatusSuccess; elapsedMs: number }
  | { kind: "done"; status: JobStatusSuccess; elapsedMs: number }
  | { kind: "error"; message: string; elapsedMs: number }
  | { kind: "timeout"; elapsedMs: number };

export type FabricationPollAction =
  | { type: "TICK"; elapsedMs: number }
  | { type: "POLL_SUCCESS"; status: JobStatusSuccess; elapsedMs: number }
  | { type: "POLL_ERROR"; message: string; elapsedMs: number }
  | { type: "TIMEOUT"; elapsedMs: number };

export const initialStatusPollState: FabricationPollState = {
  kind: "idle",
  elapsedMs: 0,
};

/**
 * Terminal scan_status values — once we see one, stop polling. Note
 * that the worker may also drive the job through job-level status
 * transitions (uploaded → scanning → needs_revision/...); for the
 * student polling view, we key off scan_status because that's the
 * most granular signal for "work still in progress vs finished".
 */
const TERMINAL_SCAN_STATUSES = new Set(["done", "error"]);

export function isTerminalScanStatus(scanStatus: string | null | undefined): boolean {
  return scanStatus !== null && scanStatus !== undefined && TERMINAL_SCAN_STATUSES.has(scanStatus);
}

export function statusPollReducer(
  state: FabricationPollState,
  action: FabricationPollAction
): FabricationPollState {
  switch (action.type) {
    case "TICK":
      // Plain elapsed-time tick — no network data. Only updates elapsed
      // when state is still active (idle/polling); terminal states are
      // frozen so the UI doesn't keep ticking after done/error/timeout.
      if (state.kind === "idle" || state.kind === "polling") {
        return { ...state, elapsedMs: action.elapsedMs };
      }
      return state;

    case "POLL_SUCCESS": {
      const { status, elapsedMs } = action;
      // If we already landed on a terminal state, freeze — a late-
      // arriving poll response shouldn't resurrect the UI.
      if (state.kind === "done" || state.kind === "error" || state.kind === "timeout") {
        return state;
      }
      if (isTerminalScanStatus(status.revision?.scanStatus)) {
        // Use the scanStatus to decide done vs error. Explicit error
        // status lands on the error branch with the scan_error text.
        if (status.revision?.scanStatus === "error") {
          return {
            kind: "error",
            message: status.revision?.scanError ?? "Scan failed",
            elapsedMs,
          };
        }
        return { kind: "done", status, elapsedMs };
      }
      return { kind: "polling", status, elapsedMs };
    }

    case "POLL_ERROR":
      // Network / 500 / 404 — surface immediately. User can retry via a
      // full page reload (no in-flight retry logic in v1).
      if (state.kind === "done" || state.kind === "error" || state.kind === "timeout") {
        return state;
      }
      return {
        kind: "error",
        message: action.message,
        elapsedMs: action.elapsedMs,
      };

    case "TIMEOUT":
      if (state.kind === "done" || state.kind === "error" || state.kind === "timeout") {
        return state;
      }
      return { kind: "timeout", elapsedMs: action.elapsedMs };

    default:
      return state;
  }
}

// ============================================================
// Staged message selector — Phase 4-5 brief §3 heuristic
// ============================================================

/**
 * Picks the visible copy for the progress card based on how long we've
 * been waiting. The worker doesn't emit per-stage signals, so this is
 * purely an elapsed-time heuristic — a best-guess "what we're probably
 * doing right now" story arc that feels honest without lying about the
 * worker's internal state.
 *
 * Brief heuristic (exact thresholds):
 *   t < 2 s           → Uploading your file…
 *   2–5 s  + pending/running → Checking your geometry…
 *   5–15 s + pending/running → Checking machine fit…
 *  15–30 s + pending/running → Rendering preview…
 *  > 30 s  + pending/running → Still checking — this one's taking a bit longer…
 *
 * For states outside the "polling" arc (idle before first poll, other
 * scan_status values) the early messages still apply based on elapsed.
 */
export function selectStagedMessage(params: {
  scanStatus: string | null;
  elapsedMs: number;
}): string {
  const { scanStatus, elapsedMs } = params;

  if (elapsedMs < 2000) {
    return "Uploading your file…";
  }
  if (scanStatus === "pending" || scanStatus === "running" || scanStatus === null) {
    if (elapsedMs < 5000) return "Checking your geometry…";
    if (elapsedMs < 15000) return "Checking machine fit…";
    if (elapsedMs < 30000) return "Rendering preview…";
    return "Still checking — this one's taking a bit longer…";
  }
  return "Working on it…";
}
