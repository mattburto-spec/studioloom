/**
 * Source-static wiring test — Phase 5E-TEXT
 * Verifies that checkClientSide() is imported and called in all 7 text choke points.
 * Uses grep-style source assertions (not runtime mocking) to ensure wiring survives refactors.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = resolve(__dirname, "../../../..");

/** Read a source file relative to src/ */
function readSrc(relPath: string): string {
  return readFileSync(resolve(SRC, relPath), "utf-8");
}

/**
 * Each choke point must:
 * 1. Import checkClientSide from content-safety/client-filter
 * 2. Call checkClientSide() somewhere in the file
 * 3. Use the correct source string in the log-client-block fetch body
 */
interface ChokePoint {
  file: string;
  source: string;
  description: string;
}

const CHOKE_POINTS: ChokePoint[] = [
  {
    file: "src/hooks/usePageResponses.ts",
    source: "student_progress",
    description: "usePageResponses — saveProgress()",
  },
  {
    file: "src/hooks/useToolSession.ts",
    source: "tool_session",
    description: "useToolSession — updateState()",
  },
  {
    file: "src/components/student/DesignAssistantWidget.tsx",
    source: "student_progress",
    description: "DesignAssistantWidget — sendMessage()",
  },
  {
    file: "src/components/gallery/GallerySubmitPrompt.tsx",
    source: "gallery_post",
    description: "GallerySubmitPrompt — handleSubmit()",
  },
  {
    file: "src/components/gallery/GalleryBrowser.tsx",
    source: "peer_review",
    description: "GalleryBrowser — handleSubmitReview()",
  },
  {
    file: "src/components/quest/EvidenceCapture.tsx",
    source: "quest_evidence",
    description: "EvidenceCapture — handleSubmit()",
  },
  {
    file: "src/hooks/useOpenStudio.ts",
    source: "student_progress",
    description: "useOpenStudio — startSession/endSession/updateFocusArea",
  },
];

describe("client-filter wiring — 7 text choke points", () => {
  for (const cp of CHOKE_POINTS) {
    describe(cp.description, () => {
      const src = readSrc(cp.file);

      it("imports checkClientSide from content-safety/client-filter", () => {
        expect(src).toContain("checkClientSide");
        expect(src).toMatch(/from\s+["']@\/lib\/content-safety\/client-filter["']/);
      });

      it("calls checkClientSide()", () => {
        expect(src).toMatch(/checkClientSide\(/);
      });

      it(`logs with source: '${cp.source}'`, () => {
        // Accept either single or double quotes around the source value
        const hasDoubleQuote = src.includes(`source: "${cp.source}"`);
        const hasSingleQuote = src.includes(`source: '${cp.source}'`);
        expect(hasDoubleQuote || hasSingleQuote).toBe(true);
      });

      it("posts to /api/safety/log-client-block", () => {
        expect(src).toContain("/api/safety/log-client-block");
      });
    });
  }

  // Meta-test: ensure CHOKE_POINTS covers all 7 expected files
  it("covers exactly 7 choke points", () => {
    expect(CHOKE_POINTS).toHaveLength(7);
  });

  // Verify sources match ContentSource type values
  it("all sources are valid ContentSource values", () => {
    const validSources = new Set([
      "student_progress",
      "tool_session",
      "gallery_post",
      "peer_review",
      "quest_evidence",
      "open_studio",
    ]);
    for (const cp of CHOKE_POINTS) {
      expect(validSources.has(cp.source)).toBe(true);
    }
  });
});
