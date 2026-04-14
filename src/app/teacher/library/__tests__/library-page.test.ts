/**
 * Source-static tests for /teacher/library landing page.
 * Verifies: both cards render, drag-drop wiring, file picker, intent-guard prompt,
 * 20MB client-side size check, Link click-through preserved.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8"
);

describe("/teacher/library page — cards + upload", () => {
  // ── Both cards render ──
  it("renders Review Queue card with link to /teacher/library/review", () => {
    expect(src).toContain('href="/teacher/library/review"');
    expect(src).toContain("Review Queue");
  });

  it("renders Import Unit card with link to /teacher/library/import", () => {
    expect(src).toContain('href="/teacher/library/import"');
    expect(src).toContain("Import Unit");
  });

  // ── Drag-drop wiring ──
  it("wires onDragOver, onDragLeave, onDrop on both cards", () => {
    // Both cards have these event handlers
    const dragOverCount = (src.match(/onDragOver/g) || []).length;
    const dragLeaveCount = (src.match(/onDragLeave/g) || []).length;
    const dropCount = (src.match(/onDrop=\{/g) || []).length;
    expect(dragOverCount).toBeGreaterThanOrEqual(2); // definition + 2 cards
    expect(dragLeaveCount).toBeGreaterThanOrEqual(2);
    expect(dropCount).toBeGreaterThanOrEqual(2);
  });

  // ── File picker ──
  it("has hidden file inputs with correct accept attribute", () => {
    expect(src).toContain('accept={ACCEPTED}');
    expect(src).toContain('".pdf,.docx,.pptx,.txt,.md"');
  });

  it("has upload buttons for each card", () => {
    const uploadButtonCount = (src.match(/Upload file/g) || []).length;
    expect(uploadButtonCount).toBe(2); // one per card
  });

  it("has separate file input refs for each card", () => {
    expect(src).toContain("reviewInputRef");
    expect(src).toContain("importInputRef");
  });

  // ── 20MB client-side check ──
  it("checks 20MB file size limit on the client", () => {
    expect(src).toContain("20 * 1024 * 1024");
    expect(src).toContain("File too large (max 20MB)");
  });

  // ── Intent-guard prompt ──
  it("shows redirect prompt when suggestedRedirect is import", () => {
    expect(src).toContain('suggestedRedirect === "import"');
    expect(src).toContain("setShowRedirectPrompt(true)");
  });

  it("redirect prompt has Yes and No buttons", () => {
    expect(src).toContain("Yes, redirect");
    expect(src).toContain("No, continue");
  });

  it("Yes button re-POSTs to import endpoint", () => {
    expect(src).toContain('"/api/teacher/library/import"');
    expect(src).toContain("handleRedirectYes");
  });

  it("No button dismisses prompt", () => {
    expect(src).toContain("handleRedirectNo");
    expect(src).toContain("setShowRedirectPrompt(false)");
  });

  it("redirect prompt has data-testid for testing", () => {
    expect(src).toContain('data-testid="redirect-prompt"');
  });

  // ── Review card posts to ingest endpoint ──
  it("Review Queue card uploads to /api/teacher/library/ingest", () => {
    expect(src).toContain('"/api/teacher/library/ingest"');
  });

  // ── Import card posts to import endpoint ──
  it("Import Unit card uploads to /api/teacher/library/import", () => {
    expect(src).toContain('"/api/teacher/library/import"');
  });

  // ── Link navigation preserved ──
  it("uses Link component for card navigation (not just buttons)", () => {
    expect(src).toContain('import Link from "next/link"');
    // Both cards wrap their text content in Link
    const linkHrefCount = (src.match(/href="\/teacher\/library\/(review|import)"/g) || []).length;
    expect(linkHrefCount).toBeGreaterThanOrEqual(2);
  });

  // ── stopPropagation on upload affordances ──
  it("stops propagation on upload button clicks to prevent Link navigation", () => {
    expect(src).toContain("e.stopPropagation()");
  });

  // ── sessionStorage handoff (Commit 4) ──
  it("handleRedirectYes stashes result in sessionStorage before navigation", () => {
    expect(src).toContain('sessionStorage.setItem("pendingImportResult"');
    expect(src).toContain("JSON.stringify(data)");
    // SSR guard
    expect(src).toContain('typeof window !== "undefined"');
  });

  it("sessionStorage write happens before router.push", () => {
    const storageIdx = src.indexOf("sessionStorage.setItem");
    const pushIdx = src.indexOf('router.push("/teacher/library/import")');
    expect(storageIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeGreaterThan(-1);
    expect(storageIdx).toBeLessThan(pushIdx);
  });
});
