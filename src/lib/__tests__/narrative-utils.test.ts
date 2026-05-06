/**
 * Smoke-fix round 5 — buildNarrativeSections key-scheme audit.
 *
 * Bug: lesson page stores responses under `activity_${activityId}` for
 * any section authored as a modern activity block (Process Journal,
 * custom blocks). Narrative was only reading `section_${i}`, so journal
 * entries silently fell off the narrative even though
 * student_progress.responses held the data. This test locks the dual-
 * key lookup contract.
 */

import { describe, it, expect } from "vitest";
import { buildNarrativeSections } from "../narrative-utils";
import type { UnitPage, StudentProgress } from "@/types";

function makePage(over: {
  id: string;
  title?: string;
  type?: string;
  content?: unknown;
}): UnitPage {
  return {
    title: `Page ${over.id}`,
    type: "lesson",
    content: null,
    ...over,
  } as unknown as UnitPage;
}

function makeProgress(
  pageId: string,
  responses: Record<string, unknown>
): StudentProgress {
  return {
    page_id: pageId,
    responses,
    updated_at: "2026-05-06T12:00:00Z",
  } as unknown as StudentProgress;
}

describe("buildNarrativeSections — dual key-scheme lookup", () => {
  it("reads activity_${activityId} responses (round 5 fix)", () => {
    const page = makePage({
      id: "p1",
      title: "Lesson 1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "abc12345",
            responseType: "structured-prompts",
            prompt: "Journal",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_abc12345: "## Did\nbody text",
    });
    const out = buildNarrativeSections([page], [progress]);
    expect(out).toHaveLength(1);
    expect(out[0].pages).toHaveLength(1);
    // Output normalised to section_${i} key (NarrativeView reads that)
    expect(out[0].pages[0].responses["section_0"]).toBe("## Did\nbody text");
  });

  it("reads section_${i} responses (legacy path, no activityId)", () => {
    const page = makePage({
      id: "p1",
      title: "Lesson 1",
      type: "lesson",
      content: {
        sections: [
          {
            // no activityId — legacy block
            responseType: "text",
            prompt: "Old-style response",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      section_0: "Legacy response text",
    });
    const out = buildNarrativeSections([page], [progress]);
    expect(out).toHaveLength(1);
    expect(out[0].pages[0].responses["section_0"]).toBe("Legacy response text");
  });

  it("prefers activity_${activityId} when both keys exist (modern wins)", () => {
    // Defensive: if a unit was migrated and has both keys present (e.g.
    // a one-time backfill), the modern key should win since that's what
    // the lesson page is currently writing.
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "abc12345",
            responseType: "structured-prompts",
            prompt: "Journal",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_abc12345: "modern value",
      section_0: "legacy value",
    });
    const out = buildNarrativeSections([page], [progress]);
    expect(out[0].pages[0].responses["section_0"]).toBe("modern value");
  });

  it("skips empty activity_${activityId} value (no fallback to section_${i} when activityId is set)", () => {
    // If the section HAS an activityId, an empty modern-key value means
    // "no answer yet" — we should not silently surface a stale legacy
    // value. The ?? operator preserves this because empty string is
    // truthy-for-?? but the empty-check below filters it out.
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "abc12345",
            responseType: "structured-prompts",
            prompt: "Journal",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_abc12345: "",
      section_0: "stale legacy value",
    });
    const out = buildNarrativeSections([page], [progress]);
    // ?? treats "" as a valid value; empty-string filter then drops it.
    // Net result: no entry rendered.
    expect(out).toHaveLength(0);
  });

  it("falls back to section_${i} when activity_ key is undefined (mid-migration safety)", () => {
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "abc12345",
            responseType: "structured-prompts",
            prompt: "Journal",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      // no activity_abc12345 key
      section_0: "legacy value",
    });
    const out = buildNarrativeSections([page], [progress]);
    expect(out[0].pages[0].responses["section_0"]).toBe("legacy value");
  });

  it("portfolioCapture filter still works under the dual-key lookup", () => {
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "journal01",
            responseType: "structured-prompts",
            prompt: "Journal",
            portfolioCapture: true,
          },
          {
            activityId: "scratch01",
            responseType: "text",
            prompt: "Scratch work",
            // no portfolioCapture — should be filtered out
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_journal01: "## Did\nimportant journal entry",
      activity_scratch01: "scratch text not for narrative",
    });
    const out = buildNarrativeSections([page], [progress]);
    expect(out).toHaveLength(1);
    const responses = out[0].pages[0].responses;
    expect(responses["section_0"]).toBe("## Did\nimportant journal entry");
    expect(responses["section_1"]).toBeUndefined();
  });

  it("returns empty array when no responses match (Matt's regression case)", () => {
    // The exact scenario Matt hit: a journal entry saved under
    // activity_<id>, but Narrative was reading section_${i} only, so
    // sections array came back empty → "No responses yet" empty state.
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "journal01",
            responseType: "structured-prompts",
            prompt: "Journal",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_journal01: "## Did\nstudent wrote this",
    });
    // Pre-fix: out would be []. Post-fix: entry surfaces.
    const out = buildNarrativeSections([page], [progress]);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].pages[0].responses["section_0"]).toBe(
      "## Did\nstudent wrote this"
    );
  });
});
