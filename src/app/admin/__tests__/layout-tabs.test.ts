/**
 * Admin layout nav — source-static test.
 *
 * Updated 4 May 2026: dropped Pipeline + Library tabs (Dimensions3 generation
 * pipeline + activity-block library, both quarantined while Dimensions3 is
 * on hold). Pilot-focused tab set is 10 primary + 4 secondary tools.
 * Was 12 + 12 per the original spec §9.8 — diff captured in this commit's
 * dashboard refresh.
 *
 * Updated 8 May 2026: added Preflight tab (Pilot Mode P3) — links to
 * /admin/preflight/flagged for ruleset-tuning loop visibility. Now 10
 * primary tabs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "layout.tsx"),
  "utf-8"
);

describe("admin layout — tab scaffold (pilot-focused, post-Dimensions3-pause)", () => {
  it("has exactly 10 primary TABS entries", () => {
    const match = src.match(/const TABS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const entries = match![1].match(/\{ label:/g);
    expect(entries).toHaveLength(10);
  });

  it("primary TABS includes all 10 pilot-focused labels", () => {
    // 4 May trims:
    //   AM: Pipeline + Library (Dimensions3 quarantined)
    //   PM #1: Quality + Controls (Dimensions3 + empty hub)
    //   PM #2: Wiring (reference doc, not daily-ops surface)
    //   Added: AI Budget + Deletions (new pilot-ops tabs).
    // 8 May:
    //   Added: Preflight (Pilot Mode P3 dev review surface).
    const expectedLabels = [
      "Dashboard", "Cost & Usage", "AI Budget",
      "Teachers", "Students", "Schools", "Bug Reports",
      "Preflight", "Audit Log", "Deletions",
    ];
    for (const label of expectedLabels) {
      expect(src).toContain(`label: "${label}"`);
    }
  });

  it("primary TABS does NOT include hidden-from-nav entries", () => {
    // All 5 removed tabs still have page files so direct URLs work; nav
    // just hides them.
    const match = src.match(/const TABS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const tabsBlock = match![1];
    expect(tabsBlock).not.toContain('label: "Pipeline"');
    expect(tabsBlock).not.toContain('label: "Library"');
    expect(tabsBlock).not.toContain('label: "Quality"');
    expect(tabsBlock).not.toContain('label: "Controls"');
    expect(tabsBlock).not.toContain('label: "Wiring"');
  });

  it("has a secondary TOOLS_TABS array with 2 surviving tools", () => {
    expect(src).toContain("const TOOLS_TABS = [");
    const match = src.match(/const TOOLS_TABS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const entries = match![1].match(/\{ label:/g);
    expect(entries).toHaveLength(2);
  });

  it("secondary TOOLS_TABS keeps Registries + Frameworks", () => {
    // Settings + AI Model dropped 4 May PM — rarely touched, accessible
    // by direct URL when needed.
    const expected = ["Registries", "Frameworks"];
    for (const label of expected) {
      expect(src).toContain(`label: "${label}"`);
    }
  });

  it("secondary TOOLS_TABS does NOT include Settings or AI Model", () => {
    const match = src.match(/const TOOLS_TABS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const block = match![1];
    expect(block).not.toContain('label: "Settings"');
    expect(block).not.toContain('label: "AI Model"');
  });

  it("renders both primary and secondary nav rows", () => {
    expect(src).toContain("TABS.map");
    expect(src).toContain("TOOLS_TABS.map");
  });

  it("Teachers tab gets a pending-requests count badge", () => {
    // Phase 6.7 surfaced teacher_access_requests in the nav so the queue
    // isn't buried inside the Teachers tab page.
    expect(src).toContain("pendingTeacherRequests");
    expect(src).toContain('"/admin/teachers"');
  });
});
