import { describe, it, expect } from "vitest";
import { pickTodaysLessonId } from "../pick-todays-lesson";

// Tier 2 lesson scheduling — Teaching Mode auto-jumps to today's class
// or the closest by absolute date difference. Tests pin down:
//   - empty inputs fall back to first page
//   - exact match wins
//   - closest by abs(diff) wins when no exact match
//   - ties broken by earlier display order
//   - stale schedule entries (page_id no longer in pages) ignored
//   - unparseable scheduled_date strings ignored
//   - works with overdue dates (past wins if closest)

const NOW = "2026-05-13T10:00:00Z";

function page(id: string) {
  return { id };
}

describe("pickTodaysLessonId", () => {
  it("returns null when there are no pages", () => {
    expect(pickTodaysLessonId([], [], NOW)).toBeNull();
  });

  it("returns the first page when there's no schedule (legacy fallback)", () => {
    const pages = [page("a"), page("b"), page("c")];
    expect(pickTodaysLessonId(pages, [], NOW)).toBe("a");
  });

  it("returns the exact-match page when today matches a scheduled date", () => {
    const pages = [page("class-1"), page("class-2"), page("class-3")];
    const schedule = [
      { page_id: "class-1", scheduled_date: "2026-05-07" },
      { page_id: "class-2", scheduled_date: "2026-05-10" },
      { page_id: "class-3", scheduled_date: "2026-05-13" }, // today
    ];
    expect(pickTodaysLessonId(pages, schedule, NOW)).toBe("class-3");
  });

  it("returns the closest by abs(diff) when no exact match", () => {
    const pages = [page("class-1"), page("class-2"), page("class-3")];
    const schedule = [
      { page_id: "class-1", scheduled_date: "2026-05-07" }, // -6 days
      { page_id: "class-2", scheduled_date: "2026-05-15" }, // +2 days  ← closest
      { page_id: "class-3", scheduled_date: "2026-05-20" }, // +7 days
    ];
    expect(pickTodaysLessonId(pages, schedule, NOW)).toBe("class-2");
  });

  it("breaks abs-diff ties by preferring the earlier page (display order)", () => {
    const pages = [page("class-1"), page("class-2"), page("class-3")];
    const schedule = [
      { page_id: "class-2", scheduled_date: "2026-05-10" }, // -3 days
      { page_id: "class-3", scheduled_date: "2026-05-16" }, // +3 days
    ];
    // Both class-2 and class-3 are 3 days away. class-2 wins (earlier).
    expect(pickTodaysLessonId(pages, schedule, NOW)).toBe("class-2");
  });

  it("ignores schedule entries whose page_id is no longer in the unit (stale rows)", () => {
    const pages = [page("class-1"), page("class-2")];
    const schedule = [
      { page_id: "DELETED-page", scheduled_date: "2026-05-13" }, // exact-match but stale
      { page_id: "class-1", scheduled_date: "2026-05-07" }, // -6 days
    ];
    expect(pickTodaysLessonId(pages, schedule, NOW)).toBe("class-1");
  });

  it("ignores unparseable scheduled_date strings", () => {
    const pages = [page("class-1"), page("class-2")];
    const schedule = [
      { page_id: "class-1", scheduled_date: "garbage" },
      { page_id: "class-2", scheduled_date: "2026-05-15" }, // +2 days
    ];
    expect(pickTodaysLessonId(pages, schedule, NOW)).toBe("class-2");
  });

  it("falls back to first page when EVERY schedule entry is invalid / stale", () => {
    const pages = [page("class-1"), page("class-2")];
    const schedule = [
      { page_id: "DELETED", scheduled_date: "2026-05-13" },
      { page_id: "class-1", scheduled_date: "garbage" },
    ];
    expect(pickTodaysLessonId(pages, schedule, NOW)).toBe("class-1");
  });

  it("picks the most recent past class when all scheduled dates are overdue", () => {
    const pages = [page("class-1"), page("class-2"), page("class-3")];
    const schedule = [
      { page_id: "class-1", scheduled_date: "2026-04-01" }, // -42 days
      { page_id: "class-2", scheduled_date: "2026-04-15" }, // -28 days
      { page_id: "class-3", scheduled_date: "2026-05-10" }, // -3 days  ← closest
    ];
    expect(pickTodaysLessonId(pages, schedule, NOW)).toBe("class-3");
  });

  it("picks the upcoming nearest class when all scheduled dates are future", () => {
    const pages = [page("class-1"), page("class-2"), page("class-3")];
    const schedule = [
      { page_id: "class-1", scheduled_date: "2026-05-20" }, // +7 days  ← closest
      { page_id: "class-2", scheduled_date: "2026-06-10" }, // +28 days
      { page_id: "class-3", scheduled_date: "2026-07-01" }, // +49 days
    ];
    expect(pickTodaysLessonId(pages, schedule, NOW)).toBe("class-1");
  });

  // Negative control: if the helper accidentally returned `pages[0]`
  // when an exact-match schedule entry exists, this would return
  // 'class-1' not 'class-3'. Locks in the schedule-overrides-fallback
  // semantics.
  it("[negative control] schedule wins over the legacy first-page fallback", () => {
    const pages = [page("class-1"), page("class-2"), page("class-3")];
    const schedule = [
      { page_id: "class-3", scheduled_date: "2026-05-13" }, // today
    ];
    const picked = pickTodaysLessonId(pages, schedule, NOW);
    expect(picked).toBe("class-3");
    expect(picked).not.toBe("class-1");
  });
});
