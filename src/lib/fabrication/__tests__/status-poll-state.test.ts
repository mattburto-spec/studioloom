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

function makeStatus(partialRevision: Partial<NonNullable<JobStatusSuccess["revision"]>> | null): JobStatusSuccess {
  return {
    jobId: "job-1",
    jobStatus: "scanning",
    currentRevision: 1,
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

  it("done state is frozen — late POLL_SUCCESS is a no-op (no resurrection)", () => {
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
  it("uses 'Uploading your file…' when elapsed < 2s, regardless of scanStatus", () => {
    expect(selectStagedMessage({ scanStatus: null, elapsedMs: 500 })).toBe(
      "Uploading your file…"
    );
    expect(selectStagedMessage({ scanStatus: "pending", elapsedMs: 1999 })).toBe(
      "Uploading your file…"
    );
  });

  it("uses 'Checking your geometry…' between 2 and 5 seconds", () => {
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

  it("accepts null scanStatus through the whole arc (same copy as pending/running)", () => {
    expect(selectStagedMessage({ scanStatus: null, elapsedMs: 3000 })).toBe(
      "Checking your geometry…"
    );
    expect(selectStagedMessage({ scanStatus: null, elapsedMs: 20000 })).toBe(
      "Rendering preview…"
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
});
