import { describe, it, expect } from "vitest";
import type { QueueRow } from "@/lib/fabrication/teacher-orchestration";
import {
  QUEUE_TABS,
  statusesForTab,
  tabForStatus,
  tabLabel,
  emptyMessageForTab,
  bucketRowsForTab,
  countRowsPerTab,
  shouldFlagRevisionCount,
  parseTabParam,
  isCleanRow,
  matchesSearch,
  sortKeyForRow,
} from "../teacher-queue-helpers";

/**
 * Phase 6-3 tab-logic tests. Pure-function coverage — same convention
 * as the other fabrication helper suites (no DOM render harness).
 */

function row(partial: Partial<QueueRow> & { jobStatus: string }): QueueRow {
  // Minimal factory — fields the helpers actually read + defensible
  // defaults for the rest so TypeScript is happy.
  return {
    jobId: "job-" + Math.random().toString(36).slice(2, 8),
    studentName: "Test Student",
    studentId: "s-1",
    className: null,
    classId: null,
    unitTitle: null,
    machineLabel: "Bambu X1C",
    machineCategory: "3d_printer",
    thumbnailUrl: null,
    currentRevision: 1,
    ruleCounts: { block: 0, warn: 0, fyi: 0 },
    createdAt: "2026-04-22T12:00:00Z",
    updatedAt: "2026-04-22T12:00:00Z",
    originalFilename: "file.stl",
    ...partial,
  };
}

describe("statusesForTab", () => {
  it("maps each tab to its spec statuses", () => {
    expect(statusesForTab("pending")).toEqual(["pending_approval"]);
    expect(statusesForTab("approved")).toEqual(["approved", "picked_up"]);
    expect(statusesForTab("revision")).toEqual(["needs_revision"]);
    expect(statusesForTab("completed")).toEqual(["completed", "rejected"]);
  });
  it("returns null for the All tab (no filter)", () => {
    expect(statusesForTab("all")).toBeNull();
  });
});

describe("tabForStatus", () => {
  it("reverses statusesForTab for the 4 bucketed tabs", () => {
    expect(tabForStatus("pending_approval")).toBe("pending");
    expect(tabForStatus("approved")).toBe("approved");
    expect(tabForStatus("picked_up")).toBe("approved");
    expect(tabForStatus("needs_revision")).toBe("revision");
    expect(tabForStatus("completed")).toBe("completed");
    expect(tabForStatus("rejected")).toBe("completed");
  });
  it("routes unbucketed statuses (uploaded/scanning/cancelled) to 'all'", () => {
    expect(tabForStatus("uploaded")).toBe("all");
    expect(tabForStatus("scanning")).toBe("all");
    expect(tabForStatus("cancelled")).toBe("all");
  });
  it("routes unknown statuses to 'all' defensively", () => {
    expect(tabForStatus("weird-new-status")).toBe("all");
  });
});

describe("tabLabel + emptyMessageForTab", () => {
  it("returns a human label for every tab", () => {
    for (const t of QUEUE_TABS) {
      expect(tabLabel(t).length).toBeGreaterThan(0);
      expect(emptyMessageForTab(t).length).toBeGreaterThan(0);
    }
  });
  it("uses the correct Phase 6 brief wording for pending", () => {
    expect(tabLabel("pending")).toBe("Pending approval");
  });
});

describe("bucketRowsForTab", () => {
  const rows = [
    row({ jobId: "a", jobStatus: "pending_approval" }),
    row({ jobId: "b", jobStatus: "approved" }),
    row({ jobId: "c", jobStatus: "picked_up" }),
    row({ jobId: "d", jobStatus: "needs_revision" }),
    row({ jobId: "e", jobStatus: "completed" }),
    row({ jobId: "f", jobStatus: "rejected" }),
    row({ jobId: "g", jobStatus: "uploaded" }),
  ];

  it("returns every row under 'all'", () => {
    expect(bucketRowsForTab(rows, "all")).toHaveLength(rows.length);
  });
  it("pending: only pending_approval", () => {
    const out = bucketRowsForTab(rows, "pending");
    expect(out.map((r) => r.jobId)).toEqual(["a"]);
  });
  it("approved: approved + picked_up", () => {
    const out = bucketRowsForTab(rows, "approved");
    expect(out.map((r) => r.jobId).sort()).toEqual(["b", "c"]);
  });
  it("revision: only needs_revision", () => {
    const out = bucketRowsForTab(rows, "revision");
    expect(out.map((r) => r.jobId)).toEqual(["d"]);
  });
  it("completed: completed + rejected", () => {
    const out = bucketRowsForTab(rows, "completed");
    expect(out.map((r) => r.jobId).sort()).toEqual(["e", "f"]);
  });
  it("uploaded rows stay out of the 4 bucketed tabs", () => {
    for (const t of ["pending", "approved", "revision", "completed"] as const) {
      const out = bucketRowsForTab(rows, t);
      expect(out.some((r) => r.jobStatus === "uploaded")).toBe(false);
    }
  });
});

describe("countRowsPerTab", () => {
  it("counts each bucket plus 'all' == rows.length", () => {
    const rows = [
      row({ jobStatus: "pending_approval" }),
      row({ jobStatus: "pending_approval" }),
      row({ jobStatus: "approved" }),
      row({ jobStatus: "picked_up" }),
      row({ jobStatus: "needs_revision" }),
      row({ jobStatus: "completed" }),
      row({ jobStatus: "rejected" }),
      row({ jobStatus: "uploaded" }), // not in any sub-bucket
    ];
    const counts = countRowsPerTab(rows);
    expect(counts).toEqual({
      pending: 2,
      approved: 2,
      revision: 1,
      completed: 2,
      all: 8,
    });
  });
  it("returns zero counts on an empty list", () => {
    const counts = countRowsPerTab([]);
    expect(counts).toEqual({
      pending: 0,
      approved: 0,
      revision: 0,
      completed: 0,
      all: 0,
    });
  });
});

describe("shouldFlagRevisionCount", () => {
  it("flags at 3 or more", () => {
    expect(shouldFlagRevisionCount(3)).toBe(true);
    expect(shouldFlagRevisionCount(4)).toBe(true);
    expect(shouldFlagRevisionCount(10)).toBe(true);
  });
  it("does not flag 1 or 2", () => {
    expect(shouldFlagRevisionCount(1)).toBe(false);
    expect(shouldFlagRevisionCount(2)).toBe(false);
  });
});

describe("parseTabParam", () => {
  it("returns 'pending' when the param is absent", () => {
    expect(parseTabParam(null)).toBe("pending");
  });
  it("returns the tab when the param is one of the 5 known tabs", () => {
    for (const t of QUEUE_TABS) {
      expect(parseTabParam(t)).toBe(t);
    }
  });
  it("falls back to 'pending' for an unknown value", () => {
    expect(parseTabParam("nonsense")).toBe("pending");
    expect(parseTabParam("")).toBe("pending");
  });
});

// ============================================================
// Phase 8.1d-16 — bulk-approve + filter helpers
// ============================================================

describe("isCleanRow", () => {
  it("is true when block + warn are both zero (FYI doesn't disqualify)", () => {
    const r = row({
      jobStatus: "pending_approval",
      ruleCounts: { block: 0, warn: 0, fyi: 5 },
    });
    expect(isCleanRow(r)).toBe(true);
  });
  it("is false when ANY block fires", () => {
    const r = row({
      jobStatus: "pending_approval",
      ruleCounts: { block: 1, warn: 0, fyi: 0 },
    });
    expect(isCleanRow(r)).toBe(false);
  });
  it("is false when ANY warn fires (acks aren't visible at queue scope)", () => {
    const r = row({
      jobStatus: "pending_approval",
      ruleCounts: { block: 0, warn: 1, fyi: 0 },
    });
    expect(isCleanRow(r)).toBe(false);
  });
});

describe("matchesSearch", () => {
  const r = row({
    jobStatus: "pending_approval",
    studentName: "Anna Lee",
    originalFilename: "coaster_v3.svg",
    unitTitle: "Cardboard chair",
    className: "DT 9 — Eng",
    machineLabel: "Glowforge Pro",
  });

  it("matches across student name, filename, unit, class, and machine", () => {
    expect(matchesSearch(r, "Anna")).toBe(true);
    expect(matchesSearch(r, "coaster")).toBe(true);
    expect(matchesSearch(r, "chair")).toBe(true);
    expect(matchesSearch(r, "DT 9")).toBe(true);
    expect(matchesSearch(r, "glowforge")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(matchesSearch(r, "ANNA")).toBe(true);
    expect(matchesSearch(r, "GLOWforge")).toBe(true);
  });
  it("returns true on empty / whitespace-only queries (no filter)", () => {
    expect(matchesSearch(r, "")).toBe(true);
    expect(matchesSearch(r, "   ")).toBe(true);
  });
  it("returns false when no field contains the substring", () => {
    expect(matchesSearch(r, "xyzzy")).toBe(false);
  });
  it("handles null unit/class without crashing", () => {
    const sparse = row({
      jobStatus: "pending_approval",
      studentName: "Beth",
      unitTitle: null,
      className: null,
    });
    expect(matchesSearch(sparse, "beth")).toBe(true);
    expect(matchesSearch(sparse, "doesnotexist")).toBe(false);
  });
});

describe("sortKeyForRow", () => {
  const r = row({
    jobStatus: "pending_approval",
    createdAt: "2026-04-20T10:00:00Z",
    updatedAt: "2026-04-25T10:00:00Z",
  });
  it("uses createdAt on the pending tab (how long has it waited)", () => {
    expect(sortKeyForRow(r, "pending")).toBe("2026-04-20T10:00:00Z");
  });
  it("uses updatedAt on other tabs (most recent activity)", () => {
    expect(sortKeyForRow(r, "approved")).toBe("2026-04-25T10:00:00Z");
    expect(sortKeyForRow(r, "revision")).toBe("2026-04-25T10:00:00Z");
    expect(sortKeyForRow(r, "completed")).toBe("2026-04-25T10:00:00Z");
    expect(sortKeyForRow(r, "all")).toBe("2026-04-25T10:00:00Z");
  });
  it("falls back to createdAt when updatedAt is empty", () => {
    const noUpdate = row({
      jobStatus: "approved",
      createdAt: "2026-04-20T10:00:00Z",
      updatedAt: "",
    });
    expect(sortKeyForRow(noUpdate, "approved")).toBe("2026-04-20T10:00:00Z");
  });
});
