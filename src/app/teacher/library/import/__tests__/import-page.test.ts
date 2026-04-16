/**
 * Source-static tests for /teacher/library/import page.
 * Verifies: sessionStorage handoff from library landing redirect,
 * shape validation on parsed result, cleanup on malformed data.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8"
);

describe("/teacher/library/import page — sessionStorage handoff", () => {
  it("reads pendingImportResult from sessionStorage on mount", () => {
    expect(src).toContain('sessionStorage.getItem("pendingImportResult")');
  });

  it("removes the key after reading (prevents stale reuse)", () => {
    expect(src).toContain('sessionStorage.removeItem("pendingImportResult")');
  });

  it("parses the stashed JSON and sets result state", () => {
    expect(src).toContain("JSON.parse(stashed)");
    expect(src).toContain("setResult(parsed)");
  });

  it("validates shape before setting result (reconstruction + ingestion)", () => {
    expect(src).toContain("parsed?.reconstruction && parsed?.ingestion");
  });

  it("catches parse errors and cleans up storage", () => {
    // try/catch wraps the parse logic
    expect(src).toContain("catch (e)");
    expect(src).toContain("Failed to parse pendingImportResult");
    // Also removes the key on error
    const catchIdx = src.indexOf("catch (e)");
    const removeAfterCatch = src.indexOf('sessionStorage.removeItem("pendingImportResult")', catchIdx);
    expect(removeAfterCatch).toBeGreaterThan(catchIdx);
  });

  it("runs the effect only once on mount (empty deps)", () => {
    // useEffect with [] dependency array
    expect(src).toContain("useEffect(() => {");
    // The handoff effect ends with }, []);
    const effectIdx = src.indexOf("pendingImportResult");
    const closingDeps = src.indexOf("}, []);", effectIdx);
    expect(closingDeps).toBeGreaterThan(effectIdx);
  });

  // Regression: paste form still renders in input stage (default state)
  it("shows textarea paste form in input stage (default state)", () => {
    expect(src).toContain("Paste your unit plan text here...");
    expect(src).toContain('stage === "input"');
  });

  // Regression: MatchReport still renders when result is set
  it("renders MatchReport when result is populated", () => {
    expect(src).toContain("<MatchReport");
    expect(src).toContain("result.reconstruction.lessons");
  });
});
