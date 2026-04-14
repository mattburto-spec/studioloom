/**
 * Admin layout nav — source-static test for 12 primary tabs per spec §9.8.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "layout.tsx"),
  "utf-8"
);

describe("admin layout — tab scaffold", () => {
  it("has exactly 12 primary TABS entries", () => {
    // Extract the TABS array (between "const TABS = [" and "];")
    const match = src.match(/const TABS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const entries = match![1].match(/\{ label:/g);
    expect(entries).toHaveLength(12);
  });

  it("primary TABS includes all 12 spec §9.8 labels", () => {
    const expectedLabels = [
      "Dashboard", "Pipeline", "Library", "Controls",
      "Cost & Usage", "Quality", "Wiring", "Teachers",
      "Students", "Schools", "Bug Reports", "Audit Log",
    ];
    for (const label of expectedLabels) {
      expect(src).toContain(`label: "${label}"`);
    }
  });

  it("has a secondary TOOLS_TABS array", () => {
    expect(src).toContain("const TOOLS_TABS = [");
  });

  it("renders both primary and secondary nav rows", () => {
    expect(src).toContain("TABS.map");
    expect(src).toContain("TOOLS_TABS.map");
  });
});
