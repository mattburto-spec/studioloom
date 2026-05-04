/**
 * Admin layout nav — source-static test.
 *
 * Updated 4 May 2026: dropped Pipeline + Library tabs (Dimensions3 generation
 * pipeline + activity-block library, both quarantined while Dimensions3 is
 * on hold). Pilot-focused tab set is 10 primary + 4 secondary tools.
 * Was 12 + 12 per the original spec §9.8 — diff captured in this commit's
 * dashboard refresh.
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
    const expectedLabels = [
      "Dashboard", "Cost & Usage", "Quality", "Wiring",
      "Teachers", "Students", "Schools", "Bug Reports",
      "Audit Log", "Controls",
    ];
    for (const label of expectedLabels) {
      expect(src).toContain(`label: "${label}"`);
    }
  });

  it("primary TABS does NOT include Dimensions3-quarantined entries", () => {
    // Pipeline + Library were the Dimensions3 generation surfaces; not in
    // the visible nav while the project is on hold. Page files remain so
    // bookmarks don't 404; the nav just hides them.
    const match = src.match(/const TABS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const tabsBlock = match![1];
    expect(tabsBlock).not.toContain('label: "Pipeline"');
    expect(tabsBlock).not.toContain('label: "Library"');
  });

  it("has a secondary TOOLS_TABS array with 4 surviving tools", () => {
    expect(src).toContain("const TOOLS_TABS = [");
    const match = src.match(/const TOOLS_TABS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const entries = match![1].match(/\{ label:/g);
    expect(entries).toHaveLength(4);
  });

  it("secondary TOOLS_TABS keeps Settings + Registries + AI Model + Frameworks", () => {
    const expected = ["Settings", "Registries", "AI Model", "Frameworks"];
    for (const label of expected) {
      expect(src).toContain(`label: "${label}"`);
    }
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
