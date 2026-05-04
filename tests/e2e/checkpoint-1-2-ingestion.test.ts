/**
 * Phase 1.7 Checkpoint 1.2 — Dimensions3 Ingestion E2E Test
 *
 * This file is the canonical gate for Checkpoint 1.2. It replaces the
 * 9-step manual walkthrough (which remains available as an optional
 * pre-push smoke, see dimensions3-completion-spec.md §3.7).
 *
 * Structure:
 *   - α (sandbox) DOCX variant — runs on every `npm test`, no API key.
 *     Asserts tight values against the sandbox pipeline's deterministic
 *     output. Any drift here = real regression in parse / extract /
 *     moderation code (the stages that still run live in sandbox mode).
 *
 *   - β (live) DOCX variant — gated by RUN_E2E=1, requires
 *     ANTHROPIC_API_KEY. Asserts tight structural/enum/numeric values
 *     captured from a real pipeline run, loose substring/range checks
 *     on classification text fields that can wobble between Haiku/Sonnet
 *     minor revisions.
 *
 *   - β (live) PDF variant — same pattern, gated by RUN_E2E=1. Uses a
 *     CC-BY external resource (Teach Engineering "Under Pressure:
 *     Young's Modulus" activity) to exercise a different parse path
 *     (PDF text extraction) and a different subject domain (Physics,
 *     not Design Technology).
 *
 * Lesson #38: every assertion compares to an expected value, not to
 * "non-null" or "> 0". Lesson #39: this is the first live integration
 * test against real teacher content — the Pass A + Pass B max_tokens
 * truncation bug that triggered those fixes was invisible to 613 unit
 * tests because they all run in sandbox mode.
 *
 * Baseline live runs (11 Apr 2026):
 *   - DOCX: cost=$0.175035, wallTime=132,488ms (Sonnet 4 Pass B dominates)
 *   - PDF:  cost=$0.034195, wallTime=27,145ms
 * These are NOT asserted — they will drift with model pricing and
 * network. Recorded as baselines so future regressions jump out visually.
 *
 * To run:
 *   npm test                                    # α only
 *   RUN_E2E=1 ANTHROPIC_API_KEY=... npm test -- checkpoint-1-2   # α + β
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { computeContentFingerprint } from "@/lib/ingestion/fingerprint";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

// Fixtures relocated 29 Apr 2026 from docs/lesson plans/ to tests/fixtures/ingestion/.
// Original location was repo-bloat masquerading as docs; these are test inputs.
const DOCX_PATH = path.resolve(
  process.cwd(),
  "tests/fixtures/ingestion/mburton packaging redesign unit.docx"
);
const PDF_PATH = path.resolve(
  process.cwd(),
  "tests/fixtures/ingestion/Under Pressure_ Using Young’s Modulus to Explore Material Properties - Activity - Teach Engineering.pdf"
);

async function loadDocxText(): Promise<string> {
  const buf = await fs.readFile(DOCX_PATH);
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}

async function loadPdfText(): Promise<string> {
  const buf = await fs.readFile(PDF_PATH);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

// ---------------------------------------------------------------------------
// RUN_E2E gating
// ---------------------------------------------------------------------------

const RUN_E2E = process.env.RUN_E2E === "1";
const HAS_API_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const itLive = RUN_E2E && HAS_API_KEY ? it : it.skip;

// ---------------------------------------------------------------------------
// α — Sandbox DOCX
// ---------------------------------------------------------------------------

describe("Checkpoint 1.2 α — sandbox DOCX ingestion", () => {
  it("runs the full pipeline against the packaging DOCX in sandbox mode", async () => {
    const rawText = await loadDocxText();

    const result = await runIngestionPipeline(
      { rawText, copyrightFlag: "own" },
      { sandboxMode: true }
    );

    // --- Dedup ---
    expect(result.dedup.fileHash).toBe(
      "854fb63694b03b2ae8edfdf51cbca991e784b65bba976209337958278a98514e"
    );
    expect(result.dedup.isDuplicate).toBe(false);

    // --- Parse (deterministic — same in sandbox and live) ---
    expect(result.parse.title).toBe("Task 1: Folio submission (30%)");
    // Word count changed from 3154→3110 after adding Week/Lesson heading
    // detection (16 Apr 2026) — lines like "Lesson 4" without colons are
    // now correctly detected as headings rather than body text.
    expect(result.parse.totalWordCount).toBe(3110);
    expect(result.parse.headingCount).toBe(50);
    expect(result.parse.sections).toHaveLength(50);

    // --- Classification (sandbox constants from simulateClassification) ---
    expect(result.classification.documentType).toBe("lesson_plan");
    expect(result.classification.confidence).toBe(0.75);
    expect(result.classification.detectedSubject).toBe("Design Technology");
    expect(result.classification.detectedStrand).toBe("Materials & Manufacture");
    expect(result.classification.detectedLevel).toBe("MYP3");
    expect(result.classification.sections).toHaveLength(50);
    // strand/level/subject confidences wired through to classification.confidences
    expect(result.classification.confidences).toMatchObject({
      documentType: 0.75,
      subject: 0.7,
      strand: 0.5,
      level: 0.5,
    });

    // --- Analysis (Pass B enrichment) ---
    expect(result.analysis.enrichedSections).toHaveLength(50);

    // --- Extraction ---
    // Note: post-FU "extract.ts filter widening" (15 Apr 2026) — the extractor
    // now also pulls sections that Pass B enriched with an activity_category
    // even when sectionType is "instruction" (catches teaching resources that
    // lack explicit duration markers). All 50 enriched sections in this fixture
    // carry activity_category in sandbox mode, so all 50 are extracted.
    expect(result.extraction.blocks).toHaveLength(50);
    expect(result.extraction.totalSectionsProcessed).toBe(50);
    expect(result.extraction.activitySectionsFound).toBe(50);
    expect(result.extraction.piiDetected).toBe(false);

    // --- Moderation ---
    expect(result.moderation.approvedCount).toBe(50);
    expect(result.moderation.flaggedCount).toBe(0);
    expect(result.moderation.pendingCount).toBe(0);

    // --- Structural completeness (Lesson #39 defensive assertion) ---
    // Every block must have non-empty title + bloom_level + phase.
    // Catches the class of bug where a truncated tool_use response
    // returns blocks with undefined fields.
    for (const block of result.extraction.blocks) {
      expect(block.title).toBeTruthy();
      expect(block.bloom_level).toBeTruthy();
      expect(block.phase).toBeTruthy();
      expect(block.activity_category).toBeTruthy();
    }

    // --- Every moderated block has a moderation_status ---
    for (const modBlock of result.moderation.blocks) {
      expect(modBlock.moderationStatus).toMatch(/^(approved|flagged|pending)$/);
    }

    // --- Cost (sandbox = 0, live would differ) ---
    expect(result.totalCost.estimatedCostUSD).toBe(0);
  });

  it("is idempotent — same DOCX produces the same fileHash + same fingerprints across runs", async () => {
    const rawText = await loadDocxText();

    const run1 = await runIngestionPipeline(
      { rawText, copyrightFlag: "own" },
      { sandboxMode: true }
    );
    const run2 = await runIngestionPipeline(
      { rawText, copyrightFlag: "own" },
      { sandboxMode: true }
    );

    // File hash is content-derived: must be stable.
    expect(run1.dedup.fileHash).toBe(run2.dedup.fileHash);

    // Block count stable.
    expect(run1.extraction.blocks.length).toBe(run2.extraction.blocks.length);

    // Fingerprints computed from (title, prompt, sourceType) must be
    // identical across runs — only tempId (random UUID) differs.
    const fingerprints1 = run1.extraction.blocks.map((b) =>
      computeContentFingerprint({
        title: b.title,
        prompt: b.prompt,
        sourceType: "extracted",
      })
    );
    const fingerprints2 = run2.extraction.blocks.map((b) =>
      computeContentFingerprint({
        title: b.title,
        prompt: b.prompt,
        sourceType: "extracted",
      })
    );
    expect(fingerprints1).toEqual(fingerprints2);
  });
});

// ---------------------------------------------------------------------------
// β — Live DOCX (gated by RUN_E2E=1)
// ---------------------------------------------------------------------------

describe("Checkpoint 1.2 β — live DOCX ingestion [RUN_E2E=1]", () => {
  itLive(
    "runs the full pipeline against the packaging DOCX against the real Anthropic API",
    async () => {
      const rawText = await loadDocxText();

      const result = await runIngestionPipeline(
        { rawText, copyrightFlag: "own" },
        { apiKey: process.env.ANTHROPIC_API_KEY!, sandboxMode: false }
      );

      // --- Dedup (content-derived, identical to sandbox) ---
      expect(result.dedup.fileHash).toBe(
        "854fb63694b03b2ae8edfdf51cbca991e784b65bba976209337958278a98514e"
      );
      expect(result.dedup.isDuplicate).toBe(false);

      // --- Parse (deterministic — same as sandbox) ---
      expect(result.parse.totalWordCount).toBe(3110);
      expect(result.parse.sections).toHaveLength(50);

      // --- Classification: tight on enums, loose on AI-generated text ---
      // TIGHT: documentType is an enum, should be scheme_of_work for this
      // 6-week unit (not a single lesson).
      expect(result.classification.documentType).toBe("scheme_of_work");
      // TIGHT: detectedSubject is enum-ish — Design Technology, not Physics.
      expect(result.classification.detectedSubject).toBe("Design Technology");
      // Range on confidence — Haiku confidence wobbles a couple points.
      expect(result.classification.confidence).toBeGreaterThanOrEqual(0.85);
      // LOOSE: level phrasing can be Year 11 / Stage 6 / Y11 / NSW Stage 6.
      expect(result.classification.detectedLevel).toMatch(/year 11|stage 6|y11/i);
      // LOOSE: topic phrasing varies ("Sustainable Packaging Re-design" /
      // "Sustainable Packaging Redesign" / "Packaging redesign unit").
      expect(result.classification.topic?.toLowerCase()).toContain("packaging");
      // LOOSE-but-narrow: strand must mention design process, design and
      // production, or materials — anything wildly off-syllabus fails.
      expect(result.classification.detectedStrand).toMatch(
        /design process|design and production|materials/i
      );
      // Sections preserved through classification.
      expect(result.classification.sections).toHaveLength(50);

      // --- Analysis (Pass B live enrichment) ---
      expect(result.analysis.enrichedSections).toHaveLength(50);

      // --- Extraction ---
      // Baseline: live runs produced 12, 13, 14 blocks (2026-04-11, N=3).
      // Range 11–15 allows ±2 drift for AI non-determinism on sectionType
      // tagging in Pass B. Outer sanity: 10–16 (see below). If a legitimate
      // run falls outside 11–15, widen deliberately — don't paper over.
      // Block count is AI-judgment-dependent, not structural — same category
      // as bloom distribution. Internal consistency asserted separately.
      expect(result.extraction.blocks.length).toBeGreaterThanOrEqual(11);
      expect(result.extraction.blocks.length).toBeLessThanOrEqual(15);
      // Outer sanity bound (documented, not asserted here — if you see a
      // value outside 10–16 in CI logs, that's the "something else is wrong"
      // signal, not the ±2 drift signal):
      //   expect(result.extraction.blocks.length).toBeGreaterThanOrEqual(10);
      //   expect(result.extraction.blocks.length).toBeLessThanOrEqual(16);
      // Internal consistency: activitySectionsFound tracks blocks.length.
      expect(result.extraction.activitySectionsFound).toBe(
        result.extraction.blocks.length
      );
      expect(result.extraction.totalSectionsProcessed).toBe(50);
      expect(result.extraction.piiDetected).toBe(false);

      // --- Moderation ---
      // Approved = blocks - flagged; pending always 0 in current pipeline.
      // Flagged observed stable at 1 across N=2 (the third DOCX run
      // aborted on the blocks.length assertion before moderation asserted),
      // so cap ≤ 2 rather than exact-match — tighten when we have more data.
      expect(result.moderation.approvedCount).toBeGreaterThanOrEqual(10);
      expect(result.moderation.approvedCount).toBeLessThanOrEqual(14);
      expect(result.moderation.flaggedCount).toBeLessThanOrEqual(2);
      expect(result.moderation.pendingCount).toBe(0);
      expect(
        result.moderation.approvedCount + result.moderation.flaggedCount
      ).toBe(result.extraction.blocks.length);

      // --- Structural completeness (Lesson #39) ---
      for (const block of result.extraction.blocks) {
        expect(block.title).toBeTruthy();
        expect(block.bloom_level).toBeTruthy();
        expect(block.phase).toBeTruthy();
        expect(block.activity_category).toBeTruthy();
      }
      for (const modBlock of result.moderation.blocks) {
        expect(modBlock.moderationStatus).toMatch(
          /^(approved|flagged|pending)$/
        );
      }

      // --- Bloom distribution shape, not exact counts ---
      // Year 11 folio task: higher-order thinking (create + apply + analyze)
      // should dominate. Exact counts wobble between Haiku minor revisions.
      const bloomCounts: Record<string, number> = {};
      for (const block of result.extraction.blocks) {
        bloomCounts[block.bloom_level] = (bloomCounts[block.bloom_level] ?? 0) + 1;
      }
      const higherOrder =
        (bloomCounts.create ?? 0) +
        (bloomCounts.apply ?? 0) +
        (bloomCounts.analyze ?? 0) +
        (bloomCounts.evaluate ?? 0);
      expect(higherOrder).toBeGreaterThanOrEqual(7);

      // --- Cost sanity (not asserted as exact — just bounded) ---
      // Baseline: $0.175. Fail only if wildly off (< $0.01 = not actually
      // called; > $2 = runaway loop or wrong model).
      expect(result.totalCost.estimatedCostUSD).toBeGreaterThan(0.01);
      expect(result.totalCost.estimatedCostUSD).toBeLessThan(2);
    }
  );
});

// ---------------------------------------------------------------------------
// β — Live PDF (gated by RUN_E2E=1)
// ---------------------------------------------------------------------------

describe("Checkpoint 1.2 β — live PDF ingestion [RUN_E2E=1]", () => {
  itLive(
    "runs the full pipeline against the Young's Modulus PDF against the real Anthropic API",
    async () => {
      const rawText = await loadPdfText();

      const result = await runIngestionPipeline(
        { rawText, copyrightFlag: "cc-by" },
        { apiKey: process.env.ANTHROPIC_API_KEY!, sandboxMode: false }
      );

      // --- Dedup ---
      expect(result.dedup.fileHash).toBe(
        "21c02fc3c2fe3627445fa53ee695bd756cf3d52b6b1a6e1d13f3ca37b1b2d378"
      );
      expect(result.dedup.isDuplicate).toBe(false);

      // --- Parse (deterministic) ---
      expect(result.parse.totalWordCount).toBe(3170);
      expect(result.parse.sections).toHaveLength(6);

      // --- Classification ---
      // TIGHT: documentType for a third-party activity resource is 'resource'.
      expect(result.classification.documentType).toBe("resource");
      // TIGHT: Physics is the correct subject — Young's Modulus is a
      // Physics topic, NOT Design Technology.
      expect(result.classification.detectedSubject).toBe("Physics");
      expect(result.classification.confidence).toBeGreaterThanOrEqual(0.85);
      // LOOSE: Grade 9 / Year 9 / Y9 / NGSS HS-PS2-6.
      expect(result.classification.detectedLevel).toMatch(
        /grade 9|year 9|y9|hs-ps2/i
      );
      // LOOSE: topic contains young's modulus or material properties.
      expect(result.classification.topic?.toLowerCase()).toMatch(
        /young.?s modulus|material propert/
      );
      // LOOSE-but-narrow: strand mentions materials or properties.
      expect(result.classification.detectedStrand).toMatch(
        /material|propert/i
      );

      // --- Analysis ---
      expect(result.analysis.enrichedSections).toHaveLength(6);

      // --- Extraction ---
      // Baseline: live runs produced 3, 3, 2 blocks (2026-04-11, N=3).
      // Narrow range 2–4 mirrors the DOCX treatment at this fixture's
      // scale. PDF has only 6 parsed sections total, so drift is
      // structurally capped. Tighten to === 3 once we have N ≥ 5 stable
      // data points (tighten-on-more-data policy).
      expect(result.extraction.blocks.length).toBeGreaterThanOrEqual(2);
      expect(result.extraction.blocks.length).toBeLessThanOrEqual(4);
      expect(result.extraction.activitySectionsFound).toBe(
        result.extraction.blocks.length
      );
      expect(result.extraction.totalSectionsProcessed).toBe(6);
      expect(result.extraction.piiDetected).toBe(false);

      // --- Moderation ---
      // Flagged stable at 0 across N=3 but keeping the same shape as
      // DOCX assertions (accounting invariant + tolerant caps).
      expect(result.moderation.approvedCount).toBeGreaterThanOrEqual(1);
      expect(result.moderation.approvedCount).toBeLessThanOrEqual(4);
      expect(result.moderation.flaggedCount).toBeLessThanOrEqual(1);
      expect(result.moderation.pendingCount).toBe(0);
      expect(
        result.moderation.approvedCount + result.moderation.flaggedCount
      ).toBe(result.extraction.blocks.length);

      // --- Structural completeness (Lesson #39) ---
      for (const block of result.extraction.blocks) {
        expect(block.title).toBeTruthy();
        expect(block.bloom_level).toBeTruthy();
        expect(block.phase).toBeTruthy();
        expect(block.activity_category).toBeTruthy();
      }
      for (const modBlock of result.moderation.blocks) {
        expect(modBlock.moderationStatus).toMatch(
          /^(approved|flagged|pending)$/
        );
      }

      // --- Cost bound ---
      // Baseline: $0.034. Smaller doc, lower bound.
      expect(result.totalCost.estimatedCostUSD).toBeGreaterThan(0.005);
      expect(result.totalCost.estimatedCostUSD).toBeLessThan(1);
    }
  );
});
