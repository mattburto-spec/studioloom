/**
 * Round 10 (6 May 2026) — NarrativeModal fetches fresh progress on
 * open + NarrativeView keeps auto-captured photos.
 *
 * Bug Matt hit: he wrote a Process Journal entry, opened the
 * Portfolio panel → Narrative tab. Empty narrative. The journal
 * was on the server (autosave fired) but the parent lesson page's
 * `progress` snapshot was loaded BEFORE the save. NarrativeModal
 * was trusting that stale prop.
 *
 * Plus a deeper bug uncovered along the way: Process Journal
 * photos were dropped from narrative entirely because the filter
 * stripped EVERY type='auto' entry. We now keep auto entries
 * that have a media_url (photo), drop pure-text duplicates.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MODAL_SRC = readFileSync(
  join(__dirname, "..", "NarrativeModal.tsx"),
  "utf-8"
);

const VIEW_SRC = readFileSync(
  join(__dirname, "..", "NarrativeView.tsx"),
  "utf-8"
);

const PANEL_SRC = readFileSync(
  join(__dirname, "..", "PortfolioPanel.tsx"),
  "utf-8"
);

describe("NarrativeModal — fresh-progress fetch on open", () => {
  it("tracks freshProgress state populated by /api/student/unit fetch", () => {
    expect(MODAL_SRC).toContain("freshProgress");
    expect(MODAL_SRC).toMatch(/setFreshProgress/);
  });

  it("fetches /api/student/unit on open AND awaits both promises before clearing loading", () => {
    expect(MODAL_SRC).toMatch(
      /fetch\(`\/api\/student\/unit\?unitId=\$\{unit\.id\}`\)/
    );
    expect(MODAL_SRC).toContain("Promise.allSettled");
  });

  it("uses freshProgress as the source of truth, falls back to the prop", () => {
    expect(MODAL_SRC).toMatch(
      /const effectiveProgress\s*=\s*freshProgress\s*\?\?\s*progress/
    );
    // buildNarrativeSections gets effectiveProgress, not the stale prop.
    // LIS.E added a third arg (portfolioEntries) — match the call with
    // any whitespace + that third positional so the freshProgress check
    // doesn't break when the call gets future args added.
    expect(MODAL_SRC).toMatch(
      /buildNarrativeSections\(\s*allPages,\s*effectiveProgress,\s*portfolioEntries/,
    );
  });
});

describe("NarrativeView — keep auto entries that have a photo", () => {
  it("filter keeps auto entries with media_url, drops pure-text auto entries", () => {
    expect(VIEW_SRC).toMatch(
      /portfolioEntries\.filter\(\(e\)\s*=>\s*\{[\s\S]{0,300}e\.type\s*!==\s*"auto"[\s\S]{0,200}return\s+Boolean\(e\.media_url\)/
    );
  });

  it("non-auto types (note / link / photo via QuickCaptureFAB) still pass through", () => {
    // The early `return true` for non-auto entries is preserved.
    expect(VIEW_SRC).toMatch(
      /if\s*\(e\.type\s*!==\s*"auto"\)\s*return\s+true/
    );
  });
});

describe("PortfolioPanel — rich-text content rendering (round 15)", () => {
  it("imports looksLikeRichText to detect HTML content", () => {
    expect(PANEL_SRC).toContain(
      'from "@/components/student/RichTextEditor"'
    );
    expect(PANEL_SRC).toContain("looksLikeRichText");
  });

  it("renders rich-text content via dangerouslySetInnerHTML (matches narrative pattern)", () => {
    expect(PANEL_SRC).toMatch(
      /looksLikeRichText\(entry\.content\)\s*\?\s*\(\s*<div[\s\S]{0,300}dangerouslySetInnerHTML=\{\{\s*__html:\s*entry\.content\s*\}\}/
    );
  });

  it("plain-text fallback uses whitespace-pre-wrap so newlines survive", () => {
    expect(PANEL_SRC).toMatch(
      /<p[^>]+whitespace-pre-wrap[^>]*>\s*\{entry\.content\}/
    );
  });
});

describe("PortfolioPanel — Export PPT button retired (round 10)", () => {
  it('drops "next/dynamic" import + ExportPortfolioPpt dynamic factory', () => {
    expect(PANEL_SRC).not.toMatch(/from\s*"next\/dynamic"/);
    expect(PANEL_SRC).not.toMatch(/dynamic\(\(\)\s*=>\s*import\("\.\/ExportPortfolioPpt"\)/);
  });

  it("does not render <ExportPortfolioPpt> any more", () => {
    expect(PANEL_SRC).not.toContain("<ExportPortfolioPpt");
  });

  it("doc comment notes the FU-AGENCY-PPT-EXPORT-RESTORE follow-up", () => {
    expect(PANEL_SRC).toContain("FU-AGENCY-PPT-EXPORT-RESTORE");
  });
});
