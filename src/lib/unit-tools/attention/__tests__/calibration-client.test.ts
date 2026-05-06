/**
 * AG.4 follow-up — calibration-client pure helpers.
 *
 * Covers `pickLatestPerElementAndSource` (the only pure logic in the
 * file). The fetch wrappers are exercised at runtime; we don't mock
 * fetch here.
 */

import { describe, it, expect } from "vitest";
import { pickLatestPerElementAndSource } from "../calibration-client";

function row(over: {
  element: string;
  source: "student_self" | "teacher_observation";
  rating: number;
  created_at: string;
  comment?: string | null;
  competency?: string;
}) {
  return {
    element: over.element,
    source: over.source,
    rating: over.rating,
    created_at: over.created_at,
    comment: over.comment ?? null,
    competency: over.competency ?? "agency_in_learning",
  };
}

describe("pickLatestPerElementAndSource", () => {
  it("returns empty map for empty input", () => {
    expect(pickLatestPerElementAndSource([]).size).toBe(0);
  });

  it("keeps a single row per (element, source) pair", () => {
    const out = pickLatestPerElementAndSource([
      row({
        element: "acting_with_autonomy",
        source: "student_self",
        rating: 2,
        created_at: "2026-05-01T10:00:00Z",
      }),
      row({
        element: "acting_with_autonomy",
        source: "teacher_observation",
        rating: 3,
        created_at: "2026-05-02T10:00:00Z",
      }),
      row({
        element: "being_reflective",
        source: "student_self",
        rating: 1,
        created_at: "2026-05-03T10:00:00Z",
      }),
    ]);
    expect(out.size).toBe(3);
    expect(out.get("acting_with_autonomy::student_self")?.rating).toBe(2);
    expect(out.get("acting_with_autonomy::teacher_observation")?.rating).toBe(3);
    expect(out.get("being_reflective::student_self")?.rating).toBe(1);
  });

  it("keeps the latest row when multiple exist for same (element, source)", () => {
    const out = pickLatestPerElementAndSource([
      row({
        element: "acting_with_autonomy",
        source: "student_self",
        rating: 1,
        created_at: "2026-05-01T10:00:00Z",
      }),
      row({
        element: "acting_with_autonomy",
        source: "student_self",
        rating: 3,
        created_at: "2026-05-05T10:00:00Z", // newer
      }),
      row({
        element: "acting_with_autonomy",
        source: "student_self",
        rating: 2,
        created_at: "2026-05-03T10:00:00Z",
      }),
    ]);
    expect(out.size).toBe(1);
    expect(out.get("acting_with_autonomy::student_self")?.rating).toBe(3);
  });

  it("treats student_self and teacher_observation as separate keys (no cross-contamination)", () => {
    const out = pickLatestPerElementAndSource([
      row({
        element: "acting_with_autonomy",
        source: "student_self",
        rating: 1,
        created_at: "2026-05-01T10:00:00Z",
      }),
      row({
        element: "acting_with_autonomy",
        source: "teacher_observation",
        rating: 4,
        created_at: "2026-04-01T10:00:00Z", // older but different source
      }),
    ]);
    expect(out.get("acting_with_autonomy::student_self")?.rating).toBe(1);
    expect(out.get("acting_with_autonomy::teacher_observation")?.rating).toBe(4);
  });

  it("preserves comment + created_at on the kept row", () => {
    const out = pickLatestPerElementAndSource([
      row({
        element: "being_reflective",
        source: "teacher_observation",
        rating: 3,
        comment: "Strong reflection in the chat",
        created_at: "2026-05-04T12:00:00Z",
      }),
    ]);
    const kept = out.get("being_reflective::teacher_observation");
    expect(kept?.comment).toBe("Strong reflection in the chat");
    expect(kept?.created_at).toBe("2026-05-04T12:00:00Z");
  });
});
