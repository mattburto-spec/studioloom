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

  // ── JSON direct-import path (Path B) ──
  it("accepts .json files in the file picker", () => {
    expect(src).toContain('accept=".pdf,.docx,.pptx,.txt,.md,.json,application/json"');
  });

  it("imports the JSON validator and isJsonUnitFile helper", () => {
    expect(src).toContain('from "@/lib/units/import-json"');
    expect(src).toContain("validateUnitJson");
    expect(src).toContain("isJsonUnitFile");
  });

  it("branches on isJsonUnitFile in handleFileUpload", () => {
    expect(src).toContain("if (isJsonUnitFile(file))");
    expect(src).toContain("handleJsonImport(file)");
  });

  it("posts JSON imports straight to /api/teacher/units with action: create", () => {
    // Look for the JSON path's POST — distinct from the classify POST
    const jsonImportIdx = src.indexOf("handleJsonImport");
    const apiCallIdx = src.indexOf('"/api/teacher/units"', jsonImportIdx);
    const actionCreateIdx = src.indexOf('action: "create"', jsonImportIdx);
    expect(jsonImportIdx).toBeGreaterThan(0);
    expect(apiCallIdx).toBeGreaterThan(jsonImportIdx);
    expect(actionCreateIdx).toBeGreaterThan(jsonImportIdx);
  });

  it("renders the JSON validation error block when errors are present", () => {
    expect(src).toContain("jsonValidationErrors");
    expect(src).toContain("JSON validation failed");
  });
});
