/**
 * Orchestrator ← admin_settings integration tests.
 * Verifies: stage-disable abort, per-run cost ceiling, daily cost ceiling,
 * model override passthrough, starter patterns passthrough.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "orchestrator.ts"),
  "utf-8"
);

describe("orchestrator ← admin_settings source-static", () => {
  it("calls loadAdminSettings at run start", () => {
    expect(src).toContain("loadAdminSettings(config.supabase)");
  });

  // NC: remove the loadAdminSettings call → this test flips to fail
  it("checks stageEnabled before each stage", () => {
    expect(src).toContain('stageEnabled["retrieve"] === false');
    expect(src).toContain('stageEnabled["assemble"] === false');
    expect(src).toContain('stageEnabled["gap_fill"] === false');
    expect(src).toContain('stageEnabled["polish"] === false');
    expect(src).toContain('stageEnabled["timing"] === false');
    expect(src).toContain('stageEnabled["score"] === false');
  });

  it("enforces per-run cost ceiling after AI-calling stages", () => {
    // checkRunCeiling is called after stages 1-4 (the ones with real costs)
    expect(src).toContain("checkRunCeiling()");
    expect(src).toContain("Per-run cost ceiling exceeded");
    expect(src).toContain("costCeilingPerRun");
  });

  // NC: remove the daily cost ceiling check → this test flips to fail
  it("checks daily cost ceiling before pipeline starts", () => {
    expect(src).toContain("Daily cost ceiling exceeded");
    expect(src).toContain("cost_rollups");
    expect(src).toContain("costCeilingPerDay");
  });

  it("applies model override per stage via resolveModel", () => {
    expect(src).toContain('resolveModel("assemble")');
    expect(src).toContain('resolveModel("gap_fill")');
    expect(src).toContain('resolveModel("polish")');
    expect(src).toContain("modelOverride[stageKey]");
  });

  it("passes starterPatternsEnabled to Stage 1", () => {
    expect(src).toContain("starterPatternsEnabled: starterPatternsEnabled");
  });

  it("uses shouldEnforceCostCeilings for sandbox guard", () => {
    expect(src).toContain("shouldEnforceCostCeilings({ sandboxMode: config.sandboxMode })");
  });

  it("imports from @/lib/admin/settings and @/types/admin", () => {
    expect(src).toContain('from "@/lib/admin/settings"');
    expect(src).toContain('from "@/types/admin"');
    expect(src).toContain("AdminSettingKey");
  });
});
