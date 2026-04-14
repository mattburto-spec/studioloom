/**
 * Source-static tests for /admin/controls pipeline settings page.
 * Verifies the 5 setting keys are present and PATCH wiring exists.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8"
);

describe("/admin/controls page source-static", () => {
  it("references all 5 AdminSettingKey enum members", () => {
    expect(src).toContain("AdminSettingKey.STAGE_ENABLED");
    expect(src).toContain("AdminSettingKey.COST_CEILING_PER_RUN");
    expect(src).toContain("AdminSettingKey.COST_CEILING_PER_DAY");
    expect(src).toContain("AdminSettingKey.MODEL_OVERRIDE");
    expect(src).toContain("AdminSettingKey.STARTER_PATTERNS_ENABLED");
  });

  it("fetches from /api/admin/settings", () => {
    expect(src).toContain("/api/admin/settings");
  });

  it("uses PATCH method for saves", () => {
    expect(src).toContain("PATCH");
  });

  it("does NOT import AIControlPanel", () => {
    expect(src).not.toContain("AIControlPanel");
  });
});
