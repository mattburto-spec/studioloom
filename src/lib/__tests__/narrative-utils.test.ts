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

describe("buildNarrativeSections — portfolio-filter inclusion (LIS.E)", () => {
  // FU-LIS-PORTFOLIO-NARRATIVE-DISPLAY: when ANY section in the unit has
  // portfolioCapture: true, the filter activates. Pre-fix, manual
  // Portfolio captures of regular text responses (PortfolioCaptureAffordance
  // → portfolio_entries with type='auto', no media_url) were silently
  // dropped because the section itself didn't carry portfolioCapture.
  // Post-fix: passing portfolioEntries through includes those sections.

  function makePortfolioEntry(
    pageId: string,
    sectionIndex: number,
    over?: Record<string, unknown>
  ) {
    return {
      id: `pe-${pageId}-${sectionIndex}`,
      student_id: "s1",
      unit_id: "u1",
      type: "auto" as const,
      content: null,
      media_url: null,
      link_url: null,
      link_title: null,
      page_id: pageId,
      section_index: sectionIndex,
      created_at: "2026-05-10T12:00:00Z",
      ...over,
    };
  }

  it("includes a non-portfolioCapture section when student manually sent it to portfolio", () => {
    // p1 has a portfolioCapture section (activates the filter); p1 ALSO
    // has a regular text-response section that the student manually sent
    // via PortfolioCaptureAffordance. Pre-fix: only the portfolioCapture
    // section showed in Narrative. Post-fix: both show.
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            // Section 0: portfolioCapture-flagged — shows pre + post fix
            activityId: "auto1",
            responseType: "structured-prompts",
            portfolioCapture: true,
            prompt: "Auto-capture journal",
          },
          {
            // Section 1: regular text response, manually sent to portfolio
            activityId: "manual1",
            responseType: "text",
            prompt: "Open response",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_auto1: "auto value",
      activity_manual1: "manual value",
    });
    const portfolioEntries = [
      // Auto-capture entry for section 0 (would've existed via the
      // structured-prompts auto-save anyway)
      makePortfolioEntry("p1", 0),
      // Manual capture entry for section 1 — this is the one whose
      // (pageId, sectionIndex) opens the gate for the section
      makePortfolioEntry("p1", 1),
    ];
    const out = buildNarrativeSections([page], [progress], portfolioEntries);
    expect(out).toHaveLength(1);
    expect(out[0].pages).toHaveLength(1);
    const responses = out[0].pages[0].responses;
    expect(responses["section_0"]).toBe("auto value");
    expect(responses["section_1"]).toBe("manual value");
  });

  it("excludes a non-portfolioCapture section when no portfolio entry exists for it (other sections in unit set portfolioCapture)", () => {
    // Negative control: same shape, but no portfolio_entries for
    // section 1. Filter excludes it (the response wasn't sent to
    // portfolio, so it shouldn't surface in the narrative).
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "auto1",
            responseType: "structured-prompts",
            portfolioCapture: true,
            prompt: "Auto-capture journal",
          },
          {
            activityId: "manual1",
            responseType: "text",
            prompt: "Open response",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_auto1: "auto value",
      activity_manual1: "draft, never sent to portfolio",
    });
    const portfolioEntries = [makePortfolioEntry("p1", 0)]; // only section 0
    const out = buildNarrativeSections([page], [progress], portfolioEntries);
    expect(out[0].pages[0].responses["section_0"]).toBe("auto value");
    expect(out[0].pages[0].responses["section_1"]).toBeUndefined();
  });

  it("portfolioEntries default empty array — legacy callers stay back-compat", () => {
    // Existing buildNarrativeSections(pages, progress) callers that
    // haven't been updated yet should still work. They lose only the
    // LIS.E manual-capture inclusion, not any pre-existing behaviour.
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "auto1",
            responseType: "structured-prompts",
            portfolioCapture: true,
            prompt: "Journal",
          },
        ],
      },
    });
    const progress = makeProgress("p1", { activity_auto1: "value" });
    // No third argument
    const out = buildNarrativeSections([page], [progress]);
    expect(out[0].pages[0].responses["section_0"]).toBe("value");
  });

  it("matches portfolio_entries on the (page_id, section_index) coord — not unit-wide", () => {
    // Defensive: a portfolio entry on page p2 must NOT trigger inclusion
    // on page p1's section. Coord match has to be exact.
    const p1 = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "auto1",
            responseType: "structured-prompts",
            portfolioCapture: true,
            prompt: "Auto",
          },
          {
            activityId: "manual1",
            responseType: "text",
            prompt: "Manual",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_auto1: "auto value",
      activity_manual1: "manual value",
    });
    // Portfolio entry is for p2:0, NOT p1:1
    const portfolioEntries = [makePortfolioEntry("p2", 0)];
    const out = buildNarrativeSections([p1], [progress], portfolioEntries);
    expect(out[0].pages[0].responses["section_1"]).toBeUndefined();
  });

  it("ignores portfolio entries with null page_id or null section_index (e.g. QuickCaptureFAB notes)", () => {
    // Notes / photos uploaded via QuickCaptureFAB don't carry pageId/
    // sectionIndex. They live in portfolio_entries but shouldn't open
    // gates on any section.
    const page = makePage({
      id: "p1",
      type: "lesson",
      content: {
        sections: [
          {
            activityId: "auto1",
            responseType: "structured-prompts",
            portfolioCapture: true,
            prompt: "Auto",
          },
          {
            activityId: "manual1",
            responseType: "text",
            prompt: "Manual",
          },
        ],
      },
    });
    const progress = makeProgress("p1", {
      activity_auto1: "auto value",
      activity_manual1: "draft, not sent",
    });
    const portfolioEntries = [
      makePortfolioEntry("p1", 0),
      // Standalone note — no page_id or section_index
      {
        ...makePortfolioEntry("", 0),
        page_id: null,
        section_index: null,
      },
    ];
    const out = buildNarrativeSections([page], [progress], portfolioEntries);
    expect(out[0].pages[0].responses["section_0"]).toBe("auto value");
    expect(out[0].pages[0].responses["section_1"]).toBeUndefined();
  });
});
