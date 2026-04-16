/**
 * Source-static tests for /teacher/library/import page.
 * Verifies: 2-step classify→continue flow, stale sessionStorage cleanup,
 * ClassificationCheckpoint rendering, MatchReport rendering.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8"
);

describe("/teacher/library/import page — 2-step import flow", () => {
  // ── Stale sessionStorage cleanup ──
  it("cleans up stale pendingImportResult on mount", () => {
    expect(src).toContain('sessionStorage.removeItem("pendingImportResult")');
  });

  it("runs the cleanup effect only once on mount (empty deps)", () => {
    expect(src).toContain("useEffect(() => {");
    const effectIdx = src.indexOf("pendingImportResult");
    const closingDeps = src.indexOf("}, []);", effectIdx);
    expect(closingDeps).toBeGreaterThan(effectIdx);
  });

  // ── Step 1: Classify ──
  it("calls the classify endpoint for step 1", () => {
    expect(src).toContain('"/api/teacher/library/import/classify"');
  });

  it("renders ClassificationCheckpoint for checkpoint stage", () => {
    expect(src).toContain("<ClassificationCheckpoint");
    expect(src).toContain("handleCheckpointConfirm");
  });

  // ── Step 2: Continue ──
  it("calls the import endpoint with classification for step 2", () => {
    expect(src).toContain('"/api/teacher/library/import"');
    expect(src).toContain("classification: classifyResult.classification");
  });

  it("sends corrections in the continue request body", () => {
    expect(src).toContain("corrections: corrections || undefined");
  });

  // ── Stage-based rendering ──
  it("shows textarea paste form in input stage (default state)", () => {
    expect(src).toContain("Paste your unit plan text here...");
    expect(src).toContain('stage === "input"');
  });

  it("has a checkpoint stage between classify and processing", () => {
    expect(src).toContain('stage === "checkpoint"');
  });

  it("has a processing stage while Pass B runs", () => {
    expect(src).toContain('stage === "processing"');
  });

  // ── MatchReport still renders ──
  it("renders MatchReport when result is populated", () => {
    expect(src).toContain("<MatchReport");
    expect(src).toContain("result.reconstruction.lessons");
  });
});
