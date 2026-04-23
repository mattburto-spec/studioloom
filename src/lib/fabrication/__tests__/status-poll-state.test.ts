import { describe, it, expect } from "vitest";
import {
  statusPollReducer,
  initialStatusPollState,
  isTerminalScanStatus,
  selectStagedMessage,
  type FabricationPollState,
} from "../status-poll-state";
import type { JobStatusSuccess } from "../orchestration";

/**
 * Pure reducer + selector tests for the Phase 4-5 polling state machine.
 * No DOM, no timers, no fetch — all side effects live in the hook
 * (src/hooks/useFabricationStatus.ts).
 */

function makeStatus(
  partialRevision: Partial<NonNullable<JobStatusSuccess["revision"]>> | null,
  overrides: Partial<JobStatusSuccess> = {}
): JobStatusSuccess {
  return {
    jobId: "job-1",
    jobStatus: "scanning",
    currentRevision: 1,
    fileType: "stl",
    revision: partialRevision
      ? {
          id: "rev-1",
          revisionNumber: 1,
          scanStatus: null,
          scanError: null,
          scanCompletedAt: null,
          scanRulesetVersion: null,
          thumbnailUrl: null,
          ...partialRevision,
        }
      : null,
    scanJob: null,
    ...overrides,
  };
}

// ============================================================
// isTerminalScanStatus
// ============================================================

describe("isTerminalScanStatus", () => {
  it("returns true for 'done' and 'error'", () => {
    expect(isTerminalScanStatus("done")).toBe(true);
    expect(isTerminalScanStatus("error")).toBe(true);
  });
  it("returns false for 'pending' and 'running'", () => {
    expect(isTerminalScanStatus("pending")).toBe(false);
    expect(isTerminalScanStatus("running")).toBe(false);
  });
  it("returns false for null/undefined (initial state before any scan job)", () => {
    expect(isTerminalScanStatus(null)).toBe(false);
    expect(isTerminalScanStatus(undefined)).toBe(false);
  });
});

// ============================================================
// statusPollReducer — initial + TICK
// ============================================================

describe("statusPollReducer — initial state", () => {
  it("is idle with elapsedMs 0", () => {
    expect(initialStatusPollState).toEqual({ kind: "idle", elapsedMs: 0 });
  });
});

describe("statusPollReducer — TICK", () => {
  it("updates elapsedMs in idle", () => {
    const next = statusPollReducer(initialStatusPollState, {
      type: "TICK",
      elapsedMs: 500,
    });
    expect(next).toEqual({ kind: "idle", elapsedMs: 500 });
  });

  it("updates elapsedMs in polling", () => {
    const state: FabricationPollState = {
      kind: "polling",
      status: makeStatus({ scanStatus: "pending" }),
      elapsedMs: 0,
    };
    const next = statusPollReducer(state, { type: "TICK", elapsedMs: 3000 });
    if (next.kind !== "polling") throw new Error("expected polling");
    expect(next.elapsedMs).toBe(3000);
  });

  it("is a no-op in done (terminal states freeze elapsed)", () => {
    const state: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(state, { type: "TICK", elapsedMs: 6000 });
    expect(next).toBe(state); // same reference
  });

  it("is a no-op in error/timeout", () => {
    const errorState: FabricationPollState = { kind: "error", message: "x", elapsedMs: 1 };
    expect(statusPollReducer(errorState, { type: "TICK", elapsedMs: 2 })).toBe(errorState);
    const timeoutState: FabricationPollState = { kind: "timeout", elapsedMs: 1 };
    expect(statusPollReducer(timeoutState, { type: "TICK", elapsedMs: 2 })).toBe(timeoutState);
  });
});

// ============================================================
// statusPollReducer — POLL_SUCCESS
// ============================================================

describe("statusPollReducer — POLL_SUCCESS", () => {
  it("idle → polling when scanStatus is pending", () => {
    const next = statusPollReducer(initialStatusPollState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "pending" }),
      elapsedMs: 500,
    });
    expect(next.kind).toBe("polling");
    if (next.kind === "polling") {
      expect(next.status.revision?.scanStatus).toBe("pending");
      expect(next.elapsedMs).toBe(500);
    }
  });

  it("idle → polling when no revision exists yet (edge case: scan_job pre-revision)", () => {
    const next = statusPollReducer(initialStatusPollState, {
      type: "POLL_SUCCESS",
      status: makeStatus(null),
      elapsedMs: 100,
    });
    expect(next.kind).toBe("polling");
  });

  it("idle → done when scanStatus is already 'done' on first poll", () => {
    // Rare but possible if the scan was very fast.
    const next = statusPollReducer(initialStatusPollState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done", scanCompletedAt: "2026-04-22" }),
      elapsedMs: 2500,
    });
    expect(next.kind).toBe("done");
    if (next.kind === "done") expect(next.status.revision?.scanStatus).toBe("done");
  });

  it("idle → error when scanStatus is 'error' with scan_error text", () => {
    const next = statusPollReducer(initialStatusPollState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "error", scanError: "OSError: cairo missing" }),
      elapsedMs: 1800,
    });
    expect(next.kind).toBe("error");
    if (next.kind === "error") expect(next.message).toBe("OSError: cairo missing");
  });

  it("idle → error with default message when scanStatus='error' and scan_error is null", () => {
    const next = statusPollReducer(initialStatusPollState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "error", scanError: null }),
      elapsedMs: 1800,
    });
    expect(next.kind).toBe("error");
    if (next.kind === "error") expect(next.message).toBe("Scan failed");
  });

  it("polling → done on terminal status transition", () => {
    const state: FabricationPollState = {
      kind: "polling",
      status: makeStatus({ scanStatus: "running" }),
      elapsedMs: 4000,
    };
    const next = statusPollReducer(state, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done" }),
      elapsedMs: 6000,
    });
    expect(next.kind).toBe("done");
  });

  it("done state freezes same-revision late POLL_SUCCESS (no resurrection)", () => {
    // Both state and late-arrival are for currentRevision=1 (default).
    // Reducer keeps the frozen state.
    const doneState: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(doneState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "pending" }),
      elapsedMs: 7000,
    });
    expect(next).toBe(doneState);
  });

  // Phase 6-0: auto-unfreeze on revision bump (PH5-FU-REUPLOAD-POLL-STUCK fix)

  it("done state UNFREEZES when polled currentRevision > frozen revision (new rev pending)", () => {
    const doneState: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 1 }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(doneState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "pending" }, { currentRevision: 2 }),
      elapsedMs: 7000,
    });
    expect(next.kind).toBe("polling");
    if (next.kind === "polling") {
      expect(next.status.currentRevision).toBe(2);
    }
  });

  it("done state UNFREEZES straight to done when new revision already terminal (fast scan)", () => {
    // Edge case: re-upload, next poll fires after scanner already
    // completed the new revision. Should go done→done (different rev)
    // not done→polling→done.
    const doneState: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 1 }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(doneState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 2 }),
      elapsedMs: 7000,
    });
    expect(next.kind).toBe("done");
    if (next.kind === "done") {
      expect(next.status.currentRevision).toBe(2);
    }
  });

  it("done state UNFREEZES to error when new revision scan failed", () => {
    const doneState: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 1 }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(doneState, {
      type: "POLL_SUCCESS",
      status: makeStatus(
        { scanStatus: "error", scanError: "trimesh parse failed" },
        { currentRevision: 2 }
      ),
      elapsedMs: 7000,
    });
    expect(next.kind).toBe("error");
    if (next.kind === "error") {
      expect(next.message).toBe("trimesh parse failed");
    }
  });

  it("done state STAYS FROZEN when polled currentRevision equals frozen revision", () => {
    // Belt-and-braces — same-rev late arrival is the common case.
    const doneState: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 3 }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(doneState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 3 }),
      elapsedMs: 6000,
    });
    expect(next).toBe(doneState);
  });

  it("done state STAYS FROZEN when polled currentRevision is LOWER than frozen (defensive)", () => {
    // Shouldn't happen in practice (revisions only increment) but the
    // guard should be strict-greater, not not-equal.
    const doneState: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 3 }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(doneState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 2 }),
      elapsedMs: 6000,
    });
    expect(next).toBe(doneState);
  });

  it("error state stays frozen regardless of polled currentRevision (no auto-unfreeze for errors)", () => {
    // Unlike done, error state doesn't carry revision info so we can't
    // safely compare. User must take explicit action (page refresh) to
    // exit an error state.
    const errState: FabricationPollState = { kind: "error", message: "x", elapsedMs: 1 };
    const next = statusPollReducer(errState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 99 }),
      elapsedMs: 2,
    });
    expect(next).toBe(errState);
  });

  it("timeout state stays frozen regardless of polled currentRevision", () => {
    const timeoutState: FabricationPollState = { kind: "timeout", elapsedMs: 90000 };
    const next = statusPollReducer(timeoutState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 99 }),
      elapsedMs: 92000,
    });
    expect(next).toBe(timeoutState);
  });

  it("error state is frozen against late POLL_SUCCESS", () => {
    const errState: FabricationPollState = { kind: "error", message: "x", elapsedMs: 1 };
    const next = statusPollReducer(errState, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done" }),
      elapsedMs: 2,
    });
    expect(next).toBe(errState);
  });
});

// ============================================================
// statusPollReducer — POLL_ERROR + TIMEOUT
// ============================================================

describe("statusPollReducer — POLL_ERROR", () => {
  it("idle → error with message + elapsed", () => {
    const next = statusPollReducer(initialStatusPollState, {
      type: "POLL_ERROR",
      message: "network timeout",
      elapsedMs: 3000,
    });
    expect(next).toEqual({
      kind: "error",
      message: "network timeout",
      elapsedMs: 3000,
    });
  });

  it("polling → error", () => {
    const state: FabricationPollState = {
      kind: "polling",
      status: makeStatus({ scanStatus: "pending" }),
      elapsedMs: 3000,
    };
    const next = statusPollReducer(state, {
      type: "POLL_ERROR",
      message: "500",
      elapsedMs: 3500,
    });
    expect(next.kind).toBe("error");
  });

  it("done state is frozen against POLL_ERROR", () => {
    const doneState: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(doneState, {
      type: "POLL_ERROR",
      message: "stale 404",
      elapsedMs: 6000,
    });
    expect(next).toBe(doneState);
  });
});

describe("statusPollReducer — TIMEOUT", () => {
  it("polling → timeout when fired", () => {
    const state: FabricationPollState = {
      kind: "polling",
      status: makeStatus({ scanStatus: "running" }),
      elapsedMs: 89000,
    };
    const next = statusPollReducer(state, { type: "TIMEOUT", elapsedMs: 90000 });
    expect(next).toEqual({ kind: "timeout", elapsedMs: 90000 });
  });

  it("done is frozen against TIMEOUT", () => {
    const doneState: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }),
      elapsedMs: 5000,
    };
    const next = statusPollReducer(doneState, { type: "TIMEOUT", elapsedMs: 90000 });
    expect(next).toBe(doneState);
  });
});

// ============================================================
// selectStagedMessage
// ============================================================

describe("selectStagedMessage", () => {
  // Phase 6-6b (smoke feedback): pre-first-poll copy switched from
  // "Uploading your file…" to "Loading your submission…" — see
  // status-poll-state.ts for rationale. Status page is reached via
  // nav + bookmarks + teacher-action links, not just post-upload
  // redirect, so the "uploading" framing was misleading in most of
  // the entry paths.
  it("uses 'Loading your submission…' when scanStatus is null (pre-first-poll)", () => {
    expect(selectStagedMessage({ scanStatus: null, elapsedMs: 0 })).toBe(
      "Loading your submission…"
    );
    expect(selectStagedMessage({ scanStatus: null, elapsedMs: 500 })).toBe(
      "Loading your submission…"
    );
    // Stays as "Loading" even past the old 2s threshold — the
    // threshold was an artifact of the "just uploaded" framing,
    // which no longer applies. Once scanStatus is known, the arc
    // takes over.
    expect(selectStagedMessage({ scanStatus: null, elapsedMs: 10000 })).toBe(
      "Loading your submission…"
    );
  });

  it("uses 'Checking your geometry…' from t=0 up to 5 seconds when scanning", () => {
    expect(selectStagedMessage({ scanStatus: "pending", elapsedMs: 0 })).toBe(
      "Checking your geometry…"
    );
    expect(selectStagedMessage({ scanStatus: "pending", elapsedMs: 2000 })).toBe(
      "Checking your geometry…"
    );
    expect(selectStagedMessage({ scanStatus: "running", elapsedMs: 4999 })).toBe(
      "Checking your geometry…"
    );
  });

  it("uses 'Checking machine fit…' between 5 and 15 seconds", () => {
    expect(selectStagedMessage({ scanStatus: "pending", elapsedMs: 5000 })).toBe(
      "Checking machine fit…"
    );
    expect(selectStagedMessage({ scanStatus: "running", elapsedMs: 14999 })).toBe(
      "Checking machine fit…"
    );
  });

  it("uses 'Rendering preview…' between 15 and 30 seconds", () => {
    expect(selectStagedMessage({ scanStatus: "running", elapsedMs: 15000 })).toBe(
      "Rendering preview…"
    );
    expect(selectStagedMessage({ scanStatus: "running", elapsedMs: 29999 })).toBe(
      "Rendering preview…"
    );
  });

  it("uses 'Still checking…' after 30 seconds", () => {
    expect(
      selectStagedMessage({ scanStatus: "running", elapsedMs: 30000 })
    ).toMatch(/Still checking/);
    expect(
      selectStagedMessage({ scanStatus: "pending", elapsedMs: 60000 })
    ).toMatch(/Still checking/);
  });

  it("falls back to 'Working on it…' for unexpected scanStatus values", () => {
    expect(selectStagedMessage({ scanStatus: "weird", elapsedMs: 10000 })).toBe(
      "Working on it…"
    );
  });
});

// ============================================================
// statusPollReducer — RESET (Phase 5-5)
// ============================================================

describe("statusPollReducer — RESET", () => {
  it("returns to idle from any state (enables re-upload un-freeze)", () => {
    const states: FabricationPollState[] = [
      { kind: "idle", elapsedMs: 500 },
      {
        kind: "polling",
        status: makeStatus({ scanStatus: "pending" }),
        elapsedMs: 3000,
      },
      {
        kind: "done",
        status: makeStatus({ scanStatus: "done" }),
        elapsedMs: 9000,
      },
      { kind: "error", message: "boom", elapsedMs: 5000 },
      { kind: "timeout", elapsedMs: 90000 },
    ];
    for (const s of states) {
      const next = statusPollReducer(s, { type: "RESET" });
      expect(next).toEqual({ kind: "idle", elapsedMs: 0 });
    }
  });

  it("RESET + subsequent POLL_SUCCESS transitions normally (no lingering freeze)", () => {
    const done: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }),
      elapsedMs: 9000,
    };
    const afterReset = statusPollReducer(done, { type: "RESET" });
    expect(afterReset.kind).toBe("idle");
    const afterPoll = statusPollReducer(afterReset, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "pending" }),
      elapsedMs: 500,
    });
    expect(afterPoll.kind).toBe("polling");
  });

  // Phase 6-5b: codifies the "reset-before-poll" sequence the page's
  // handleReuploadSuccess handler uses. The page dispatches RESET
  // BEFORE awaiting the revision-history fetch, then any Rev N+1 poll
  // that lands during the await window transitions cleanly from idle
  // to polling/done. If this test ever fails, someone probably
  // reordered the handler to await-then-reset, which re-introduces
  // the PH5-FU-REUPLOAD-POLL-STUCK timing hole (flash-of-idle after
  // a clean auto-unfreeze).
  it("reset-before-poll sequence: done(Rev 1) → RESET → POLL_SUCCESS(Rev 2 pending) lands cleanly in polling", () => {
    // Initial terminal state — Rev 1 has scanned + student has a result.
    const doneRev1: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 1 }),
      elapsedMs: 9000,
    };
    // Page handler fires RESET before awaiting revisions fetch.
    const afterReset = statusPollReducer(doneRev1, { type: "RESET" });
    expect(afterReset).toEqual({ kind: "idle", elapsedMs: 0 });
    // Poll fires during the await window — returns Rev 2 pending.
    const afterPoll = statusPollReducer(afterReset, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "pending" }, { currentRevision: 2 }),
      elapsedMs: 250,
    });
    expect(afterPoll.kind).toBe("polling");
    if (afterPoll.kind === "polling") {
      expect(afterPoll.status.currentRevision).toBe(2);
      expect(afterPoll.status.revision?.scanStatus).toBe("pending");
    }
  });

  it("reset-before-poll sequence: done(Rev 1) → RESET → POLL_SUCCESS(Rev 2 DONE) lands directly in done", () => {
    // Fast-scan case — Rev 2 is already scanned by the time the first
    // post-reset poll lands. Single transition idle → done.
    const doneRev1: FabricationPollState = {
      kind: "done",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 1 }),
      elapsedMs: 9000,
    };
    const afterReset = statusPollReducer(doneRev1, { type: "RESET" });
    const afterPoll = statusPollReducer(afterReset, {
      type: "POLL_SUCCESS",
      status: makeStatus({ scanStatus: "done" }, { currentRevision: 2 }),
      elapsedMs: 1200,
    });
    expect(afterPoll.kind).toBe("done");
    if (afterPoll.kind === "done") {
      expect(afterPoll.status.currentRevision).toBe(2);
    }
  });
});
