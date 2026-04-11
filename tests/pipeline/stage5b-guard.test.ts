/**
 * Phase 2 sub-task 5.1 — Permanent guard against Stage 5b reintroduction.
 *
 * Stage 5b never existed in the Dimensions3 pipeline. This test exists so
 * that if anyone ever creates a stage5b-*.ts file or references a stage 5b
 * symbol, CI fails immediately with a clear message pointing back to the
 * v2 spec decision (no Stage 5b — Stage 5 applies timing in a single pass).
 *
 * If this test ever fires, read docs/projects/dimensions3-completion-spec.md
 * before "fixing" it.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STAGES_DIR = join(process.cwd(), "src/lib/pipeline/stages");
const ORCHESTRATOR = join(process.cwd(), "src/lib/pipeline/orchestrator.ts");

const FORBIDDEN_PATTERNS = [
  /stage5b/i,
  /stage_5b/i,
  /stage5_5/i,
  /5b_apply/i,
];

describe("Stage 5b guard (Phase 2 sub-task 5.1)", () => {
  it("has no stage5b-*.ts file in the stages directory", () => {
    const files = readdirSync(STAGES_DIR);
    const stage5bFiles = files.filter((f) =>
      FORBIDDEN_PATTERNS.some((p) => p.test(f))
    );
    expect(
      stage5bFiles,
      `Forbidden Stage 5b file(s) found: ${stage5bFiles.join(", ")}. See dimensions3-completion-spec.md — Stage 5b does not exist by design.`
    ).toEqual([]);
  });

  it("orchestrator does not import or call any stage5b symbol", () => {
    const src = readFileSync(ORCHESTRATOR, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(
        pattern.test(src),
        `orchestrator.ts contains forbidden pattern ${pattern}. Stage 5b does not exist by design — read dimensions3-completion-spec.md.`
      ).toBe(false);
    }
  });

  it("orchestrator imports exactly stages 1-6 (no gaps, no extras)", () => {
    const src = readFileSync(ORCHESTRATOR, "utf8");
    const stageImports = src.match(/from "\.\/stages\/stage\d[^"]*"/g) ?? [];
    const stageNumbers = stageImports
      .map((s) => s.match(/stage(\d)/)?.[1])
      .filter(Boolean)
      .sort();
    expect(stageNumbers).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});
