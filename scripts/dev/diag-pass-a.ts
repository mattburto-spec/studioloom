/**
 * Dev-only diagnostic — call live Pass A in isolation and inspect its
 * return value + the raw Anthropic response stop_reason. Kept after
 * Phase 1.7 fix as a reusable troubleshooting tool for future Pass A
 * issues. Re-run if Pass A starts misbehaving on a particular document.
 *
 * Phase 1.7 history: surfaced a crash where live Pass A returned a
 * classification with undefined `sections` (max_tokens=2000 truncation),
 * breaking Pass B at pass-b.ts:102. Fixed in pass-a.ts via max_tokens
 * bump + stop_reason guard + defensive `?? []`. See Lesson #39.
 *
 * Run: ANTHROPIC_API_KEY=... npx tsx scripts/dev/diag-pass-a.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import Anthropic from "@anthropic-ai/sdk";
import { parseDocument } from "../../src/lib/ingestion/parse";
import { passA } from "../../src/lib/ingestion/pass-a";

async function main() {
  const buf = await fs.readFile(
    path.resolve("docs/lesson plans/mburton packaging redesign unit.docx")
  );
  const { value: rawText } = await mammoth.extractRawText({ buffer: buf });
  const parsed = parseDocument(rawText);
  console.log("parse: title =", parsed.title);
  console.log("parse: sections =", parsed.sections.length, "headingCount =", parsed.headingCount);

  // Call passA directly
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const result = await passA.run(parsed, { apiKey });
  console.log("\n=== Pass A result ===");
  console.log("documentType:", result.documentType);
  console.log("confidence:", result.confidence);
  console.log("topic:", result.topic);
  console.log("detectedSubject:", result.detectedSubject);
  console.log("detectedStrand:", result.detectedStrand);
  console.log("detectedLevel:", result.detectedLevel);
  console.log("sections:", result.sections === undefined ? "<undefined>" : `array of ${result.sections.length}`);
  if (result.sections) {
    console.log("first section:", JSON.stringify(result.sections[0]));
  }
  console.log("cost:", result.cost);

  // Direct Anthropic call to see raw response stop_reason
  console.log("\n=== Raw direct call to inspect stop_reason ===");
  const client = new Anthropic({ apiKey });
  const sectionSummaries = parsed.sections
    .map((s) => `[Section ${s.index}: "${s.heading}"]\n${s.content.slice(0, 300)}`)
    .join("\n\n");
  const prompt = `Classify this document. ${parsed.sections.length} sections.\n\n${sectionSummaries}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    tools: [
      {
        name: "classify_document",
        description: "Classify document",
        input_schema: {
          type: "object" as const,
          properties: {
            documentType: { type: "string" },
            sections: { type: "array", items: { type: "object" } },
          },
          required: ["documentType", "sections"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "classify_document" },
  });
  console.log("stop_reason:", response.stop_reason);
  console.log("usage:", response.usage);
  const tool = response.content.find((b) => b.type === "tool_use");
  if (tool && tool.type === "tool_use") {
    const input = tool.input as { documentType?: string; sections?: unknown[] };
    console.log("returned documentType:", input.documentType);
    console.log("returned sections:", input.sections === undefined ? "<undefined>" : `array of ${input.sections.length}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
