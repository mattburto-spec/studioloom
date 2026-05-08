import { describe, it, expect } from "vitest";
import {
  UNREAD_THRESHOLD_MS,
  classifyCommentReadState,
  formatRelativeAgo,
  isCommentUnread,
} from "../comment-status";

/**
 * Pure-helper tests for TFL.1 read receipts.
 * Lesson #38 — assert exact expected values, not non-null. Boundary
 * cases at exactly the 48h threshold are deliberate; the brief's
 * Open Question 2.4 locked in strict-greater-than.
 */

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-05-08T12:00:00Z").getTime();

describe("UNREAD_THRESHOLD_MS", () => {
  it("equals 48 hours in milliseconds", () => {
    expect(UNREAD_THRESHOLD_MS).toBe(48 * 60 * 60 * 1000);
  });
});

describe("classifyCommentReadState", () => {
  it("returns 'unsent' when no comment has been sent", () => {
    expect(
      classifyCommentReadState({ commentSentAt: null, seenAt: null, now: NOW }),
    ).toBe("unsent");
    expect(
      classifyCommentReadState({
        commentSentAt: null,
        seenAt: new Date(NOW - HOUR),
        now: NOW,
      }),
    ).toBe("unsent");
  });

  it("returns 'seen-current' when student saw the latest version", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: new Date(NOW - 5 * HOUR),
        seenAt: new Date(NOW - HOUR),
        now: NOW,
      }),
    ).toBe("seen-current");
  });

  it("returns 'seen-current' on the exact-equal boundary (seenAt === sentAt)", () => {
    const t = new Date(NOW - 5 * HOUR);
    expect(
      classifyCommentReadState({ commentSentAt: t, seenAt: t, now: NOW }),
    ).toBe("seen-current");
  });

  it("returns 'seen-stale' when teacher edited the comment after the student last saw it", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: new Date(NOW - HOUR),
        seenAt: new Date(NOW - 5 * HOUR),
        now: NOW,
      }),
    ).toBe("seen-stale");
  });

  it("returns 'unread-fresh' when comment was sent within the 48h window", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: new Date(NOW - HOUR),
        seenAt: null,
        now: NOW,
      }),
    ).toBe("unread-fresh");
  });

  it("returns 'unread-fresh' at EXACTLY 48h (strict greater-than — boundary case)", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: new Date(NOW - 48 * HOUR),
        seenAt: null,
        now: NOW,
      }),
    ).toBe("unread-fresh");
  });

  it("returns 'unread-stale' one millisecond past the 48h boundary", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: new Date(NOW - 48 * HOUR - 1),
        seenAt: null,
        now: NOW,
      }),
    ).toBe("unread-stale");
  });

  it("returns 'unread-stale' for a clearly past-threshold comment (49h)", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: new Date(NOW - 49 * HOUR),
        seenAt: null,
        now: NOW,
      }),
    ).toBe("unread-stale");
  });

  it("respects a custom thresholdMs (test override)", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: new Date(NOW - 2 * HOUR),
        seenAt: null,
        now: NOW,
        thresholdMs: HOUR, // 1h threshold; 2h ago = past it
      }),
    ).toBe("unread-stale");
  });

  it("accepts ISO strings as well as Date objects (Supabase rows return strings)", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: "2026-05-06T12:00:00Z", // 48h before NOW exactly
        seenAt: null,
        now: NOW,
      }),
    ).toBe("unread-fresh");
  });

  it("treats invalid date strings as null (defensive)", () => {
    expect(
      classifyCommentReadState({
        commentSentAt: "not-a-date",
        seenAt: null,
        now: NOW,
      }),
    ).toBe("unsent");
  });
});

describe("isCommentUnread (boolean wrapper)", () => {
  it("returns true ONLY for the 'unread-stale' state", () => {
    const inputs: Array<[string, boolean]> = [
      [
        "stale unread (49h)",
        isCommentUnread({
          commentSentAt: new Date(NOW - 49 * HOUR),
          seenAt: null,
          now: NOW,
        }),
      ],
      [
        "fresh unread (1h)",
        isCommentUnread({
          commentSentAt: new Date(NOW - HOUR),
          seenAt: null,
          now: NOW,
        }),
      ],
      [
        "exact 48h",
        isCommentUnread({
          commentSentAt: new Date(NOW - 48 * HOUR),
          seenAt: null,
          now: NOW,
        }),
      ],
      [
        "seen-current",
        isCommentUnread({
          commentSentAt: new Date(NOW - 5 * HOUR),
          seenAt: new Date(NOW - HOUR),
          now: NOW,
        }),
      ],
      [
        "seen-stale (teacher edited after student saw)",
        isCommentUnread({
          commentSentAt: new Date(NOW - HOUR),
          seenAt: new Date(NOW - 5 * HOUR),
          now: NOW,
        }),
      ],
      ["unsent", isCommentUnread({ commentSentAt: null, seenAt: null, now: NOW })],
    ];
    expect(inputs).toEqual([
      ["stale unread (49h)", true],
      ["fresh unread (1h)", false],
      ["exact 48h", false],
      ["seen-current", false],
      ["seen-stale (teacher edited after student saw)", false],
      ["unsent", false],
    ]);
  });
});

describe("formatRelativeAgo", () => {
  it("returns 'never' when the timestamp is null", () => {
    expect(formatRelativeAgo(null, NOW)).toBe("never");
  });

  it("returns 'just now' for sub-minute deltas", () => {
    expect(formatRelativeAgo(new Date(NOW - 30 * 1000), NOW)).toBe("just now");
    expect(formatRelativeAgo(new Date(NOW), NOW)).toBe("just now");
  });

  it("returns 'just now' defensively for clock-skew negative deltas", () => {
    expect(formatRelativeAgo(new Date(NOW + 60 * 1000), NOW)).toBe("just now");
  });

  it("returns 'Xm ago' for minute-resolution deltas", () => {
    expect(formatRelativeAgo(new Date(NOW - 3 * 60 * 1000), NOW)).toBe("3m ago");
    expect(formatRelativeAgo(new Date(NOW - 59 * 60 * 1000), NOW)).toBe("59m ago");
  });

  it("returns 'Xh ago' for hour-resolution deltas", () => {
    expect(formatRelativeAgo(new Date(NOW - 60 * 60 * 1000), NOW)).toBe("1h ago");
    expect(formatRelativeAgo(new Date(NOW - 23 * HOUR), NOW)).toBe("23h ago");
  });

  it("returns 'Xd ago' for day-resolution deltas", () => {
    expect(formatRelativeAgo(new Date(NOW - 24 * HOUR), NOW)).toBe("1d ago");
    expect(formatRelativeAgo(new Date(NOW - 5 * 24 * HOUR), NOW)).toBe("5d ago");
  });
});
