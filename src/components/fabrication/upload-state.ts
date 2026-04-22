/**
 * Upload state machine for the Preflight student upload flow (Phase 4-4).
 *
 * Pure reducer — no side effects, no fetch, no DOM. The page wires the
 * side effects (POST /upload, XHR PUT, POST /enqueue-scan, router push)
 * and dispatches actions at each transition. Keeps the state logic
 * testable without a DOM harness (the project has no @testing-library/
 * react infrastructure).
 *
 * State diagram:
 *
 *   idle ──START_UPLOAD──→ uploading ──PROGRESS──→ uploading
 *                          │
 *                          UPLOAD_COMPLETE
 *                          │
 *                          ▼
 *                          enqueuing ──ENQUEUE_COMPLETE──→ done
 *
 *   [any state] ──ERROR──→ error ──RESET──→ idle
 */

export type UploadState =
  | { kind: "idle" }
  | {
      kind: "uploading";
      jobId: string;
      revisionId: string;
      loaded: number;
      total: number;
      indeterminate: boolean;
    }
  | { kind: "enqueuing"; jobId: string; revisionId: string }
  | { kind: "done"; jobId: string }
  | { kind: "error"; message: string };

export type UploadAction =
  | {
      type: "START_UPLOAD";
      jobId: string;
      revisionId: string;
      totalBytes: number;
    }
  | { type: "PROGRESS"; loaded: number; total: number }
  | { type: "PROGRESS_INDETERMINATE" }
  | { type: "UPLOAD_COMPLETE" }
  | { type: "ENQUEUE_COMPLETE" }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

export const initialUploadState: UploadState = { kind: "idle" };

export function uploadReducer(
  state: UploadState,
  action: UploadAction
): UploadState {
  switch (action.type) {
    case "START_UPLOAD":
      return {
        kind: "uploading",
        jobId: action.jobId,
        revisionId: action.revisionId,
        loaded: 0,
        total: action.totalBytes,
        indeterminate: false,
      };

    case "PROGRESS":
      if (state.kind !== "uploading") return state;
      return {
        ...state,
        loaded: action.loaded,
        total: action.total,
        indeterminate: false,
      };

    case "PROGRESS_INDETERMINATE":
      // Stop trigger per brief §3 4-4: "if browser PUT progress events
      // don't fire (some browsers + some proxies strip them), fall back
      // to an indeterminate spinner — don't block the phase."
      if (state.kind !== "uploading") return state;
      return { ...state, indeterminate: true };

    case "UPLOAD_COMPLETE":
      if (state.kind !== "uploading") return state;
      return {
        kind: "enqueuing",
        jobId: state.jobId,
        revisionId: state.revisionId,
      };

    case "ENQUEUE_COMPLETE":
      if (state.kind !== "enqueuing") return state;
      return { kind: "done", jobId: state.jobId };

    case "ERROR":
      return { kind: "error", message: action.message };

    case "RESET":
      return initialUploadState;

    default:
      return state;
  }
}

/**
 * Helper for the UI: returns 0..100 progress percentage or null when
 * indeterminate / not uploading. Caller renders an indeterminate
 * spinner when this returns null AND state.kind === "uploading".
 */
export function uploadProgressPercent(state: UploadState): number | null {
  if (state.kind !== "uploading") return null;
  if (state.indeterminate) return null;
  if (state.total === 0) return null;
  return Math.min(100, Math.round((state.loaded / state.total) * 100));
}
