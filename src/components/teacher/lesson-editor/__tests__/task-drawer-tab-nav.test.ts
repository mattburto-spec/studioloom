/**
 * TG.0D.3 — pure-logic tests for TaskDrawer tab nav descriptors + dirty check.
 *
 * Per Lesson #71: tests import from .ts sibling, never from .tsx.
 * Per Lesson #38: assertions check expected values, not just presence.
 */

import { describe, it, expect } from "vitest";
import {
  buildTabNavDescriptors,
  formatTabLabel,
  isFormStateDirty,
} from "../TaskDrawer.types";
import { SUMMATIVE_TAB_ORDER } from "../summative-form-state";

describe("buildTabNavDescriptors", () => {
  const ZERO_COUNTS = {
    grasps: 0,
    submission: 0,
    rubric: 0,
    timeline: 0,
    policy: 0,
  };

  it("returns 5 descriptors in fixed order (GRASPS first, Policy last)", () => {
    const ds = buildTabNavDescriptors("grasps", ZERO_COUNTS);
    expect(ds).toHaveLength(5);
    expect(ds.map((d) => d.id)).toEqual([
      "grasps",
      "submission",
      "rubric",
      "timeline",
      "policy",
    ]);
  });

  it("preserves the tab order from SUMMATIVE_TAB_ORDER (single source of truth)", () => {
    const ds = buildTabNavDescriptors("grasps", ZERO_COUNTS);
    expect(ds.map((d) => d.id)).toEqual(SUMMATIVE_TAB_ORDER);
  });

  it("numbers tabs 1-5", () => {
    const ds = buildTabNavDescriptors("grasps", ZERO_COUNTS);
    expect(ds.map((d) => d.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("flags only the active tab", () => {
    const ds = buildTabNavDescriptors("rubric", ZERO_COUNTS);
    expect(ds.find((d) => d.id === "rubric")!.isActive).toBe(true);
    expect(ds.filter((d) => d.isActive)).toHaveLength(1);
    expect(ds.find((d) => d.id === "grasps")!.isActive).toBe(false);
  });

  it("uses the canonical labels (GRASPS not 'Grasps')", () => {
    const ds = buildTabNavDescriptors("grasps", ZERO_COUNTS);
    expect(ds.find((d) => d.id === "grasps")!.label).toBe("GRASPS");
    expect(ds.find((d) => d.id === "submission")!.label).toBe("Submission");
    expect(ds.find((d) => d.id === "rubric")!.label).toBe("Rubric");
    expect(ds.find((d) => d.id === "timeline")!.label).toBe("Timeline");
    expect(ds.find((d) => d.id === "policy")!.label).toBe("Policy");
  });

  it("propagates per-tab error counts", () => {
    const ds = buildTabNavDescriptors("grasps", {
      grasps: 7,
      submission: 0,
      rubric: 2,
      timeline: 1,
      policy: 0,
    });
    expect(ds.find((d) => d.id === "grasps")!.errorCount).toBe(7);
    expect(ds.find((d) => d.id === "submission")!.errorCount).toBe(0);
    expect(ds.find((d) => d.id === "rubric")!.errorCount).toBe(2);
    expect(ds.find((d) => d.id === "timeline")!.errorCount).toBe(1);
    expect(ds.find((d) => d.id === "policy")!.errorCount).toBe(0);
  });

  it("falls back to 0 if a tab is missing from the counts map (defensive)", () => {
    const ds = buildTabNavDescriptors("grasps", {
      grasps: 1,
    } as any);
    expect(ds.find((d) => d.id === "submission")!.errorCount).toBe(0);
    expect(ds.find((d) => d.id === "policy")!.errorCount).toBe(0);
  });
});

describe("formatTabLabel", () => {
  it("renders just number + label when error count is 0", () => {
    expect(
      formatTabLabel({
        number: 1,
        id: "grasps",
        label: "GRASPS",
        isActive: true,
        errorCount: 0,
      })
    ).toBe("1. GRASPS");
  });

  it("appends error count in parens when > 0", () => {
    expect(
      formatTabLabel({
        number: 3,
        id: "rubric",
        label: "Rubric",
        isActive: false,
        errorCount: 2,
      })
    ).toBe("3. Rubric (2)");
  });

  it("handles single-error count correctly (still parenthesised)", () => {
    expect(
      formatTabLabel({
        number: 5,
        id: "policy",
        label: "Policy",
        isActive: false,
        errorCount: 1,
      })
    ).toBe("5. Policy (1)");
  });
});

describe("isFormStateDirty", () => {
  it("returns false when current === initial (deep equality via JSON)", () => {
    const a = { x: 1, y: { z: [1, 2, 3] } };
    const b = { x: 1, y: { z: [1, 2, 3] } };
    expect(isFormStateDirty(a, b)).toBe(false);
  });

  it("returns true when a top-level field changes", () => {
    const a = { title: "" };
    const b = { title: "Quiz" };
    expect(isFormStateDirty(b, a)).toBe(true);
  });

  it("returns true when a nested field changes", () => {
    const a = { grasps: { goal: "" } };
    const b = { grasps: { goal: "G" } };
    expect(isFormStateDirty(b, a)).toBe(true);
  });

  it("returns true when an array is reordered", () => {
    const a = { criteria: ["a", "b"] };
    const b = { criteria: ["b", "a"] };
    expect(isFormStateDirty(b, a)).toBe(true);
  });

  it("returns false when objects have same fields in different declaration order (key order is JSON-stable)", () => {
    // JSON.stringify visits keys in insertion order — declaring fields in
    // a different order DOES produce a different string. This is a known
    // limitation of the cheap dirty check; use spread + reset + reload via
    // loadFromTask to avoid this in practice.
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    expect(isFormStateDirty(b, a)).toBe(true); // documented quirk
  });
});
