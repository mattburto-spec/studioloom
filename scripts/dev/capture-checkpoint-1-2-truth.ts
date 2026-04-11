/**
 * One-shot truth-value capture for Phase 1.7 Checkpoint 1.2.
 *
 * Runs runIngestionPipeline() against the packaging redesign DOCX fixture
 * in BOTH sandbox mode and live mode, prints the values the test will
 * assert against. Per Lesson #38, all assertions must compare to expected
 * values; this script generates those expected values once.
 *
 * Dev-only: not part of the main scripts/ workflow. Run when capturing
 * fresh truth values for the Checkpoint 1.2 E2E test (e.g., after any
 * change to Pass A/B/extraction/moderation that shifts expected values).
 *
 * Run: ANTHROPIC_API_KEY=... npx tsx scripts/dev/capture-checkpoint-1-2-truth.ts
 * Or:  npx tsx -r dotenv/config scripts/dev/capture-checkpoint-1-2-truth.ts dotenv_config_path=.env.local
 *
 * Not committed as a test — this is a developer tool. Output goes to stdout
 * only; transcribed manually into tests/e2e/checkpoint-1-2-ingestion.test.ts.
 */

import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { runIngestionPipeline } from "../../src/lib/ingestion/pipeline";
import { computeContentFingerprint } from "../../src/lib/ingestion/fingerprint";

const DOCX_PATH = path.resolve(
  "docs/lesson plans/mburton packaging redesign unit.docx"
);
const PDF_PATH = path.resolve(
  "docs/lesson plans/Under Pressure_ Using Young’s Modulus to Explore Material Properties - Activity - Teach Engineering.pdf"
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

function summarise(label: string, result: Awaited<ReturnType<typeof runIngestionPipeline>>) {
  console.log(`\n========== ${label} ==========`);
  console.log("dedup.fileHash         :", result.dedup.fileHash);
  console.log("dedup.isDuplicate      :", result.dedup.isDuplicate);
  console.log("parse.title            :", JSON.stringify(result.parse.title));
  console.log("parse.totalWordCount   :", result.parse.totalWordCount);
  console.log("parse.headingCount     :", result.parse.headingCount);
  console.log("parse.sections.length  :", result.parse.sections.length);
  console.log("classification.documentType  :", result.classification.documentType);
  console.log("classification.confidence    :", result.classification.confidence);
  console.log("classification.confidences   :", JSON.stringify(result.classification.confidences));
  console.log("classification.detectedSubject:", result.classification.detectedSubject);
  console.log("classification.detectedStrand :", result.classification.detectedStrand);
  console.log("classification.detectedLevel  :", result.classification.detectedLevel);
  console.log("classification.topic          :", JSON.stringify(result.classification.topic));
  console.log("classification.sections.length:", result.classification.sections.length);
  console.log("analysis.enrichedSections.length:", result.analysis.enrichedSections.length);
  console.log("extraction.blocks.length      :", result.extraction.blocks.length);
  console.log("extraction.totalSectionsProcessed:", result.extraction.totalSectionsProcessed);
  console.log("extraction.activitySectionsFound :", result.extraction.activitySectionsFound);
  console.log("extraction.piiDetected           :", result.extraction.piiDetected);
  console.log("moderation.approvedCount:", result.moderation.approvedCount);
  console.log("moderation.flaggedCount :", result.moderation.flaggedCount);
  console.log("moderation.pendingCount :", result.moderation.pendingCount);

  console.log("\n--- per-block bloom_level distribution ---");
  const bloomCounts: Record<string, number> = {};
  for (const b of result.extraction.blocks) {
    bloomCounts[b.bloom_level] = (bloomCounts[b.bloom_level] ?? 0) + 1;
  }
  console.log(bloomCounts);

  console.log("\n--- per-block moderation status distribution ---");
  const modCounts: Record<string, number> = {};
  for (const b of result.moderation.blocks) {
    modCounts[b.moderationStatus] = (modCounts[b.moderationStatus] ?? 0) + 1;
  }
  console.log(modCounts);

  console.log("\n--- first 3 block titles ---");
  for (const b of result.extraction.blocks.slice(0, 3)) {
    console.log(`  - "${b.title}" [bloom=${b.bloom_level}, phase=${b.phase}, cat=${b.activity_category}]`);
  }

  console.log("\n--- first 3 block fingerprints (sourceType='extracted') ---");
  for (const b of result.extraction.blocks.slice(0, 3)) {
    const fp = computeContentFingerprint({ title: b.title, prompt: b.prompt, sourceType: "extracted" });
    console.log(`  - ${b.tempId}: ${fp}`);
  }

  console.log("\ntotalCost.estimatedCostUSD:", result.totalCost.estimatedCostUSD);
  console.log("totalTimeMs               :", result.totalTimeMs);
}

async function main() {
  const mode = process.argv[2] ?? "docx"; // "docx" | "pdf" | "both"

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (mode === "docx" || mode === "both") {
    const rawText = await loadDocxText();
    console.log("\n### DOCX fixture ###");
    console.log("Loaded fixture: rawText.length =", rawText.length);
    console.log("First 200 chars:", JSON.stringify(rawText.slice(0, 200)));

    const sandboxResult = await runIngestionPipeline(
      { rawText, copyrightFlag: "own" },
      { sandboxMode: true }
    );
    summarise("DOCX SANDBOX MODE (α baseline)", sandboxResult);

    if (apiKey) {
      const liveResult = await runIngestionPipeline(
        { rawText, copyrightFlag: "own" },
        { apiKey, sandboxMode: false }
      );
      summarise("DOCX LIVE MODE (β captured truth)", liveResult);
    } else {
      console.log("\n[!] ANTHROPIC_API_KEY not set — skipping DOCX live β capture");
    }
  }

  if (mode === "pdf" || mode === "both") {
    const rawText = await loadPdfText();
    console.log("\n### PDF fixture ###");
    console.log("Loaded fixture: rawText.length =", rawText.length);
    console.log("First 200 chars:", JSON.stringify(rawText.slice(0, 200)));

    const sandboxResult = await runIngestionPipeline(
      { rawText, copyrightFlag: "cc-by" },
      { sandboxMode: true }
    );
    summarise("PDF SANDBOX MODE (α reference)", sandboxResult);

    if (apiKey) {
      const liveResult = await runIngestionPipeline(
        { rawText, copyrightFlag: "cc-by" },
        { apiKey, sandboxMode: false }
      );
      summarise("PDF LIVE MODE (β captured truth)", liveResult);
    } else {
      console.log("\n[!] ANTHROPIC_API_KEY not set — skipping PDF live β capture");
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
