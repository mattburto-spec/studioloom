import { describe, it, expect } from "vitest";
import {
  extractDesignPhilosophy,
  extractLastJournalNext,
  extractKanbanSummary,
  swapKanbanForFirstMove,
  type ProgressRowLike,
} from "../payload-builder";
import type { KanbanCard } from "@/lib/unit-tools/kanban/types";

// Strategy Canvas + Process Journal responses are stored by the
// existing structured-prompts pipeline as composed markdown:
//   `## <prompt.label>\n<answer>\n\n## <next label>\n<answer>`
// The helpers use parseComposedContent against the canonical presets
// to round-trip the answers back out. Test fixtures below mirror the
// real composed shape.

function strategyCanvasResponse({
  philosophy,
  biggestRisk,
  fallbackPlan,
}: {
  philosophy?: string;
  biggestRisk?: string;
  fallbackPlan?: string;
}): string {
  const parts: string[] = [];
  if (philosophy) parts.push(`## Design philosophy\n${philosophy}`);
  if (biggestRisk) parts.push(`## Biggest risk to your project\n${biggestRisk}`);
  if (fallbackPlan) parts.push(`## Fallback plan\n${fallbackPlan}`);
  return parts.join("\n\n");
}

function journalResponse({
  did,
  noticed,
  decided,
  next,
}: {
  did?: string;
  noticed?: string;
  decided?: string;
  next?: string;
}): string {
  const parts: string[] = [];
  if (did) parts.push(`## What did you DO this class?\n${did}`);
  if (noticed) parts.push(`## What did you NOTICE?\n${noticed}`);
  if (decided) parts.push(`## What did you DECIDE?\n${decided}`);
  if (next) parts.push(`## What's NEXT?\n${next}`);
  return parts.join("\n\n");
}

function progressRow(
  responses: Record<string, string>,
  updatedAt: string,
): ProgressRowLike {
  return { responses, updated_at: updatedAt };
}

describe("extractDesignPhilosophy", () => {
  it("returns null when no rows present", () => {
    expect(extractDesignPhilosophy([])).toEqual({ value: null, updatedAt: null });
  });

  it("returns null when rows have no Strategy Canvas response", () => {
    const rows = [
      progressRow(
        { "0": journalResponse({ did: "Sketched", next: "Refine" }) },
        "2026-05-12T10:00:00Z",
      ),
    ];
    expect(extractDesignPhilosophy(rows)).toEqual({ value: null, updatedAt: null });
  });

  it("extracts philosophy from the latest non-empty response", () => {
    const rows = [
      progressRow(
        { "0": strategyCanvasResponse({ philosophy: "Light + sharp nose" }) },
        "2026-05-10T10:00:00Z",
      ),
      progressRow(
        { "1": strategyCanvasResponse({ philosophy: "Heavy + wide base" }) },
        "2026-05-12T10:00:00Z",
      ),
    ];
    const result = extractDesignPhilosophy(rows);
    expect(result.value).toBe("Heavy + wide base");
    expect(result.updatedAt).toBe("2026-05-12T10:00:00Z");
  });

  it("ignores empty philosophy fields even on newer rows", () => {
    const rows = [
      progressRow(
        { "0": strategyCanvasResponse({ philosophy: "Light + sharp nose" }) },
        "2026-05-10T10:00:00Z",
      ),
      // Newer row with only biggest_risk set, no philosophy
      progressRow(
        { "1": strategyCanvasResponse({ biggestRisk: "Wheels misaligned" }) },
        "2026-05-12T10:00:00Z",
      ),
    ];
    const result = extractDesignPhilosophy(rows);
    expect(result.value).toBe("Light + sharp nose");
  });

  it("skips non-string response values defensively", () => {
    const rows: ProgressRowLike[] = [
      { responses: { "0": 42 as unknown as string }, updated_at: "2026-05-12T10:00:00Z" },
      { responses: null, updated_at: "2026-05-12T10:00:00Z" },
      {
        responses: { "0": strategyCanvasResponse({ philosophy: "Light" }) },
        updated_at: "2026-05-12T10:00:00Z",
      },
    ];
    expect(extractDesignPhilosophy(rows).value).toBe("Light");
  });
});

describe("extractLastJournalNext", () => {
  it("returns the most recent journal NEXT prompt", () => {
    const rows = [
      progressRow(
        { "0": journalResponse({ next: "Refine sketch" }) },
        "2026-05-10T10:00:00Z",
      ),
      progressRow(
        { "1": journalResponse({ next: "Cut balsa templates" }) },
        "2026-05-12T10:00:00Z",
      ),
    ];
    const result = extractLastJournalNext(rows);
    expect(result.value).toBe("Cut balsa templates");
    expect(result.updatedAt).toBe("2026-05-12T10:00:00Z");
  });

  it("ignores journal entries with empty NEXT field", () => {
    const rows = [
      progressRow(
        { "0": journalResponse({ did: "Sketched 3 ideas", next: "Compare them" }) },
        "2026-05-10T10:00:00Z",
      ),
      // Newer entry but only DID is filled, no NEXT
      progressRow(
        { "1": journalResponse({ did: "Bandsawed the profile" }) },
        "2026-05-12T10:00:00Z",
      ),
    ];
    const result = extractLastJournalNext(rows);
    expect(result.value).toBe("Compare them");
  });

  it("returns null when no journal entries have NEXT set", () => {
    const rows = [
      progressRow(
        { "0": strategyCanvasResponse({ philosophy: "Light" }) },
        "2026-05-12T10:00:00Z",
      ),
    ];
    expect(extractLastJournalNext(rows).value).toBeNull();
  });
});

describe("extractKanbanSummary", () => {
  function card(partial: Partial<KanbanCard>): KanbanCard {
    return {
      id: partial.id ?? "c1",
      title: partial.title ?? "Untitled",
      status: partial.status ?? "backlog",
      dod: null,
      estimateMinutes: null,
      actualMinutes: null,
      blockType: null,
      blockedAt: null,
      becauseClause: null,
      lessonLink: null,
      source: "manual",
      createdAt: "2026-05-12T10:00:00Z",
      movedAt: null,
      doneAt: null,
      ...partial,
    };
  }

  it("filters this_class cards + identifies most-recently-done", () => {
    const cards: KanbanCard[] = [
      card({ id: "a", title: "A", status: "backlog" }),
      card({ id: "b", title: "B", status: "this_class" }),
      card({ id: "c", title: "C", status: "this_class" }),
      card({ id: "d", title: "D", status: "doing" }),
      card({
        id: "e",
        title: "E",
        status: "done",
        doneAt: "2026-05-10T10:00:00Z",
      }),
      card({
        id: "f",
        title: "F",
        status: "done",
        doneAt: "2026-05-12T10:00:00Z",
      }),
    ];
    const { thisClassCards, lastDoneCard } = extractKanbanSummary(cards);
    expect(thisClassCards.map((c) => c.id)).toEqual(["b", "c"]);
    expect(lastDoneCard?.id).toBe("f");
    expect(lastDoneCard?.title).toBe("F");
  });

  it("returns null lastDoneCard when no cards are done", () => {
    const cards: KanbanCard[] = [
      card({ id: "a", title: "A", status: "backlog" }),
      card({ id: "b", title: "B", status: "this_class" }),
    ];
    expect(extractKanbanSummary(cards).lastDoneCard).toBeNull();
  });

  it("returns empty thisClassCards when none in lane", () => {
    const cards: KanbanCard[] = [
      card({ id: "a", title: "A", status: "backlog" }),
      card({ id: "b", title: "B", status: "doing" }),
    ];
    expect(extractKanbanSummary(cards).thisClassCards).toEqual([]);
  });
});

describe("swapKanbanForFirstMove", () => {
  function card(partial: Partial<KanbanCard>): KanbanCard {
    return {
      id: partial.id ?? "c1",
      title: partial.title ?? "Untitled",
      status: partial.status ?? "backlog",
      dod: null,
      estimateMinutes: null,
      actualMinutes: null,
      blockType: null,
      blockedAt: null,
      becauseClause: null,
      lessonLink: null,
      source: "manual",
      createdAt: "2026-05-12T10:00:00Z",
      movedAt: null,
      doneAt: null,
      ...partial,
    };
  }

  const NOW = "2026-05-12T11:00:00Z";

  it("returns null when chosen card doesn't exist", () => {
    const cards = [card({ id: "a", status: "this_class" })];
    expect(swapKanbanForFirstMove(cards, "nope", NOW)).toBeNull();
  });

  it("returns null when chosen card is already in doing (idempotent)", () => {
    const cards = [card({ id: "a", status: "doing" })];
    expect(swapKanbanForFirstMove(cards, "a", NOW)).toBeNull();
  });

  it("moves chosen card to doing when no other card is in doing", () => {
    const cards = [
      card({ id: "a", title: "Sketch", status: "this_class" }),
      card({ id: "b", title: "Cut", status: "backlog" }),
    ];
    const result = swapKanbanForFirstMove(cards, "a", NOW);
    expect(result).not.toBeNull();
    expect(result!.movedToDoing).toEqual({ id: "a", title: "Sketch" });
    expect(result!.demotedFromDoing).toEqual([]);
    const newA = result!.newCards.find((c) => c.id === "a")!;
    expect(newA.status).toBe("doing");
    expect(newA.movedAt).toBe(NOW);
    // Other cards untouched.
    expect(result!.newCards.find((c) => c.id === "b")!.status).toBe("backlog");
    expect(result!.newCards.find((c) => c.id === "b")!.movedAt).toBeNull();
  });

  it("demotes the currently-doing card to this_class so WIP=1 holds", () => {
    const cards = [
      card({ id: "a", title: "Sketch", status: "doing" }),
      card({ id: "b", title: "Cut", status: "this_class" }),
    ];
    const result = swapKanbanForFirstMove(cards, "b", NOW);
    expect(result).not.toBeNull();
    expect(result!.movedToDoing).toEqual({ id: "b", title: "Cut" });
    expect(result!.demotedFromDoing).toEqual([{ id: "a", title: "Sketch" }]);
    expect(result!.newCards.find((c) => c.id === "a")!.status).toBe("this_class");
    expect(result!.newCards.find((c) => c.id === "b")!.status).toBe("doing");
  });

  // [Negative control] precedence — if the swap accidentally LOST the
  // demoted card (e.g. filter instead of map), it'd be missing from
  // newCards. The card count must equal input count.
  it("[negative control] never drops cards from the array", () => {
    const cards = [
      card({ id: "a", status: "doing" }),
      card({ id: "b", status: "this_class" }),
      card({ id: "c", status: "backlog" }),
      card({ id: "d", status: "done", doneAt: "2026-05-10T10:00:00Z" }),
    ];
    const result = swapKanbanForFirstMove(cards, "b", NOW);
    expect(result!.newCards).toHaveLength(cards.length);
  });
});
