/**
 * Source-static + structural tests for multipart upload on library ingest + import routes.
 * Verifies: multipart branching, file validation, extractDocument reuse,
 * suggestedRedirect on scheme_of_work, symmetry between routes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ingestSrc = readFileSync(
  join(__dirname, "..", "ingest", "route.ts"),
  "utf-8"
);

const importSrc = readFileSync(
  join(__dirname, "..", "import", "route.ts"),
  "utf-8"
);

// ─── Ingest route ──────────────────────────────────────────

describe("ingest route — multipart upload", () => {
  it("branches on multipart/form-data content type", () => {
    expect(ingestSrc).toContain('contentType.includes("multipart/form-data")');
  });

  it("reuses extractDocument from @/lib/knowledge/extract", () => {
    expect(ingestSrc).toContain('from "@/lib/ingestion/document-extract"');
    expect(ingestSrc).toContain("extractDocument(buffer, file.name, file.type)");
  });

  it("rejects files larger than 20MB with 413", () => {
    expect(ingestSrc).toContain("20 * 1024 * 1024");
    expect(ingestSrc).toContain("File too large (max 20MB)");
  });

  it("validates file extension against accepted list", () => {
    expect(ingestSrc).toContain("ACCEPTED_EXTENSIONS");
    // Must accept all 5 types
    expect(ingestSrc).toContain('"pdf"');
    expect(ingestSrc).toContain('"docx"');
    expect(ingestSrc).toContain('"pptx"');
    expect(ingestSrc).toContain('"txt"');
    expect(ingestSrc).toContain('"md"');
  });

  it("handles .txt and .md via direct UTF-8 decode, not extractDocument", () => {
    expect(ingestSrc).toContain('ext === "txt" || ext === "md"');
    expect(ingestSrc).toContain('buffer.toString("utf-8")');
  });

  it("returns suggestedRedirect: 'import' when documentType is scheme_of_work", () => {
    expect(ingestSrc).toContain('result.classification.documentType === "scheme_of_work"');
    expect(ingestSrc).toContain('response.suggestedRedirect = "import"');
  });

  it("does NOT return suggestedRedirect for other document types", () => {
    // The redirect is inside a conditional — only scheme_of_work triggers it
    // Verify exactly one assignment site (inside the scheme_of_work conditional)
    const redirectMatches = ingestSrc.match(/suggestedRedirect/g);
    expect(redirectMatches).toHaveLength(1);
  });

  it("preserves JSON path — still calls request.json() for non-multipart", () => {
    expect(ingestSrc).toContain("request.json()");
    expect(ingestSrc).toContain("rawText is required and must be non-empty");
  });

  it("passes extracted text through runIngestionPipeline (shared path)", () => {
    expect(ingestSrc).toContain("runIngestionPipeline(");
    expect(ingestSrc).toContain("{ rawText, copyrightFlag }");
  });
});

// ─── Import route ──────────────────────────────────────────

describe("import route — multipart upload", () => {
  it("branches on multipart/form-data content type", () => {
    expect(importSrc).toContain('contentType.includes("multipart/form-data")');
  });

  it("reuses extractDocument from @/lib/knowledge/extract", () => {
    expect(importSrc).toContain('from "@/lib/ingestion/document-extract"');
    expect(importSrc).toContain("extractDocument(buffer, file.name, file.type)");
  });

  it("rejects files larger than 20MB with 413", () => {
    expect(importSrc).toContain("20 * 1024 * 1024");
    expect(importSrc).toContain("File too large (max 20MB)");
  });

  it("validates file extension against accepted list", () => {
    expect(importSrc).toContain("ACCEPTED_EXTENSIONS");
  });

  it("handles .txt and .md via direct UTF-8 decode", () => {
    expect(importSrc).toContain('ext === "txt" || ext === "md"');
    expect(importSrc).toContain('buffer.toString("utf-8")');
  });

  it("does NOT return suggestedRedirect (import IS the destination)", () => {
    expect(importSrc).not.toContain("suggestedRedirect");
  });

  it("preserves JSON path with 50-char minimum", () => {
    expect(importSrc).toContain("request.json()");
    expect(importSrc).toContain("rawText is required and must be at least 50 characters");
  });

  it("chains reconstructUnit after pipeline (unchanged from JSON path)", () => {
    expect(importSrc).toContain("reconstructUnit(ingestion)");
    expect(importSrc).toContain("reconstructionToContentData(reconstruction)");
  });

  it("enforces 50-char minimum on multipart extracted text", () => {
    expect(importSrc).toContain("Extracted text is too short (need at least 50 characters)");
  });
});

// ─── Symmetry audit (Lesson #39) ───────────────────────────

describe("route symmetry — ingest vs import multipart branches", () => {
  it("both import extractDocument from the same module", () => {
    const ingestImport = ingestSrc.match(/from "@\/lib\/ingestion\/document-extract"/);
    const importImport = importSrc.match(/from "@\/lib\/ingestion\/document-extract"/);
    expect(ingestImport).not.toBeNull();
    expect(importImport).not.toBeNull();
  });

  it("both use identical MAX_FILE_SIZE constant", () => {
    expect(ingestSrc).toContain("const MAX_FILE_SIZE = 20 * 1024 * 1024");
    expect(importSrc).toContain("const MAX_FILE_SIZE = 20 * 1024 * 1024");
  });

  it("both use identical ACCEPTED_EXTENSIONS list", () => {
    const ingestExts = ingestSrc.match(/ACCEPTED_EXTENSIONS = \[([^\]]+)\]/)?.[1];
    const importExts = importSrc.match(/ACCEPTED_EXTENSIONS = \[([^\]]+)\]/)?.[1];
    expect(ingestExts).toBeDefined();
    expect(ingestExts).toBe(importExts);
  });
});
