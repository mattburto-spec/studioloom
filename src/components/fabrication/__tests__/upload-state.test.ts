import { describe, it, expect } from "vitest";
import {
  uploadReducer,
  initialUploadState,
  uploadProgressPercent,
  type UploadState,
} from "../upload-state";

/**
 * Pure reducer tests for the Phase 4-4 upload state machine. No fetch,
 * no DOM — the page wires the side effects and dispatches actions, so
 * the reducer is a plain transition table.
 */

describe("uploadReducer — initial state", () => {
  it("starts idle", () => {
    expect(initialUploadState).toEqual({ kind: "idle" });
  });
});

describe("uploadReducer — START_UPLOAD", () => {
  it("transitions idle → uploading with correct fields", () => {
    const next = uploadReducer(initialUploadState, {
      type: "START_UPLOAD",
      jobId: "job-1",
      revisionId: "rev-1",
      totalBytes: 12345,
    });
    expect(next).toEqual({
      kind: "uploading",
      jobId: "job-1",
      revisionId: "rev-1",
      loaded: 0,
      total: 12345,
      indeterminate: false,
    });
  });

  it("transitions error → uploading on restart (covers 'Try again' retry)", () => {
    const errorState: UploadState = { kind: "error", message: "boom" };
    const next = uploadReducer(errorState, {
      type: "START_UPLOAD",
      jobId: "j",
      revisionId: "r",
      totalBytes: 1,
    });
    expect(next.kind).toBe("uploading");
  });
});

describe("uploadReducer — PROGRESS", () => {
  it("updates loaded/total when in uploading state", () => {
    const state: UploadState = {
      kind: "uploading",
      jobId: "j",
      revisionId: "r",
      loaded: 0,
      total: 100,
      indeterminate: false,
    };
    const next = uploadReducer(state, { type: "PROGRESS", loaded: 42, total: 100 });
    if (next.kind !== "uploading") throw new Error("expected uploading");
    expect(next.loaded).toBe(42);
    expect(next.total).toBe(100);
  });

  it("clears indeterminate flag when real progress arrives", () => {
    const state: UploadState = {
      kind: "uploading",
      jobId: "j",
      revisionId: "r",
      loaded: 0,
      total: 100,
      indeterminate: true,
    };
    const next = uploadReducer(state, { type: "PROGRESS", loaded: 10, total: 100 });
    if (next.kind !== "uploading") throw new Error("expected uploading");
    expect(next.indeterminate).toBe(false);
  });

  it("is a no-op when not uploading (progress events after completion)", () => {
    const state: UploadState = { kind: "done", jobId: "j" };
    const next = uploadReducer(state, { type: "PROGRESS", loaded: 99, total: 100 });
    expect(next).toBe(state); // same reference = no re-render
  });
});

describe("uploadReducer — PROGRESS_INDETERMINATE", () => {
  it("flips indeterminate: true while uploading", () => {
    const state: UploadState = {
      kind: "uploading",
      jobId: "j",
      revisionId: "r",
      loaded: 0,
      total: 100,
      indeterminate: false,
    };
    const next = uploadReducer(state, { type: "PROGRESS_INDETERMINATE" });
    if (next.kind !== "uploading") throw new Error("expected uploading");
    expect(next.indeterminate).toBe(true);
  });

  it("is a no-op in non-uploading states", () => {
    const state: UploadState = { kind: "idle" };
    const next = uploadReducer(state, { type: "PROGRESS_INDETERMINATE" });
    expect(next).toBe(state);
  });
});

describe("uploadReducer — UPLOAD_COMPLETE", () => {
  it("transitions uploading → enqueuing and preserves jobId/revisionId", () => {
    const state: UploadState = {
      kind: "uploading",
      jobId: "j",
      revisionId: "r",
      loaded: 100,
      total: 100,
      indeterminate: false,
    };
    const next = uploadReducer(state, { type: "UPLOAD_COMPLETE" });
    expect(next).toEqual({ kind: "enqueuing", jobId: "j", revisionId: "r" });
  });

  it("is a no-op if not uploading (e.g. error already set)", () => {
    const state: UploadState = { kind: "error", message: "x" };
    const next = uploadReducer(state, { type: "UPLOAD_COMPLETE" });
    expect(next).toBe(state);
  });
});

describe("uploadReducer — ENQUEUE_COMPLETE", () => {
  it("transitions enqueuing → done with jobId preserved", () => {
    const state: UploadState = {
      kind: "enqueuing",
      jobId: "j",
      revisionId: "r",
    };
    const next = uploadReducer(state, { type: "ENQUEUE_COMPLETE" });
    expect(next).toEqual({ kind: "done", jobId: "j" });
  });

  it("is a no-op if not enqueuing", () => {
    const state: UploadState = { kind: "idle" };
    const next = uploadReducer(state, { type: "ENQUEUE_COMPLETE" });
    expect(next).toBe(state);
  });
});

describe("uploadReducer — ERROR + RESET", () => {
  it("ERROR transitions from any state", () => {
    const states: UploadState[] = [
      { kind: "idle" },
      { kind: "uploading", jobId: "j", revisionId: "r", loaded: 0, total: 1, indeterminate: false },
      { kind: "enqueuing", jobId: "j", revisionId: "r" },
      { kind: "done", jobId: "j" },
    ];
    for (const s of states) {
      const next = uploadReducer(s, { type: "ERROR", message: "oops" });
      expect(next).toEqual({ kind: "error", message: "oops" });
    }
  });

  it("RESET returns to idle", () => {
    const state: UploadState = { kind: "error", message: "x" };
    expect(uploadReducer(state, { type: "RESET" })).toEqual({ kind: "idle" });
  });
});

describe("uploadProgressPercent", () => {
  it("returns null for non-uploading states", () => {
    expect(uploadProgressPercent({ kind: "idle" })).toBeNull();
    expect(uploadProgressPercent({ kind: "enqueuing", jobId: "j", revisionId: "r" })).toBeNull();
    expect(uploadProgressPercent({ kind: "done", jobId: "j" })).toBeNull();
    expect(uploadProgressPercent({ kind: "error", message: "x" })).toBeNull();
  });

  it("returns null when indeterminate", () => {
    expect(
      uploadProgressPercent({
        kind: "uploading",
        jobId: "j",
        revisionId: "r",
        loaded: 50,
        total: 100,
        indeterminate: true,
      })
    ).toBeNull();
  });

  it("rounds to the nearest integer percent", () => {
    expect(
      uploadProgressPercent({
        kind: "uploading",
        jobId: "j",
        revisionId: "r",
        loaded: 50,
        total: 100,
        indeterminate: false,
      })
    ).toBe(50);

    expect(
      uploadProgressPercent({
        kind: "uploading",
        jobId: "j",
        revisionId: "r",
        loaded: 333,
        total: 1000,
        indeterminate: false,
      })
    ).toBe(33);
  });

  it("caps at 100 even if loaded > total (defensive)", () => {
    expect(
      uploadProgressPercent({
        kind: "uploading",
        jobId: "j",
        revisionId: "r",
        loaded: 150,
        total: 100,
        indeterminate: false,
      })
    ).toBe(100);
  });

  it("returns null when total is 0 (avoid divide-by-zero)", () => {
    expect(
      uploadProgressPercent({
        kind: "uploading",
        jobId: "j",
        revisionId: "r",
        loaded: 0,
        total: 0,
        indeterminate: false,
      })
    ).toBeNull();
  });
});
