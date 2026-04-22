import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  teacherReviewStyleFor,
  studentActionsLocked,
  formatReviewedAt,
  shouldShowReviewCard,
} from "../teacher-review-note-helpers";

/**
 * Phase 6-5 student-side review card helper tests.
 */

describe("teacherReviewStyleFor", () => {
  it("returns amber/needs_revision style for 'needs_revision'", () => {
    const s = teacherReviewStyleFor("needs_revision");
    expect(s.variant).toBe("needs_revision");
    expect(s.cardClass).toMatch(/amber/);
    expect(s.headingClass).toMatch(/amber/);
    expect(s.heading).toMatch(/revision/i);
    expect(s.showStartFreshCta).toBe(false);
  });
  it("returns red/rejected style for 'rejected' with Start fresh CTA", () => {
    const s = teacherReviewStyleFor("rejected");
    expect(s.variant).toBe("rejected");
    expect(s.cardClass).toMatch(/red/);
    expect(s.headingClass).toMatch(/red/);
    expect(s.heading).toMatch(/reject/i);
    expect(s.showStartFreshCta).toBe(true);
  });
  it("returns green/approved style for 'approved'", () => {
    const s = teacherReviewStyleFor("approved");
    expect(s.variant).toBe("approved");
    expect(s.cardClass).toMatch(/green/);
    expect(s.headingClass).toMatch(/green/);
    expect(s.heading).toMatch(/approve/i);
    expect(s.showStartFreshCta).toBe(false);
  });
  it("returns 'none' variant for statuses that don't show a review card", () => {
    for (const s of [
      "uploaded",
      "scanning",
      "pending_approval",
      "picked_up",
      "completed",
      "cancelled",
      "weird-unknown",
    ]) {
      expect(teacherReviewStyleFor(s).variant).toBe("none");
    }
  });
});

describe("studentActionsLocked", () => {
  it("locks actions for terminal-from-student-view statuses", () => {
    expect(studentActionsLocked("rejected")).toBe(true);
    expect(studentActionsLocked("approved")).toBe(true);
    expect(studentActionsLocked("completed")).toBe(true);
    expect(studentActionsLocked("picked_up")).toBe(true);
    expect(studentActionsLocked("cancelled")).toBe(true);
  });
  it("leaves actions unlocked for mid-flow statuses", () => {
    expect(studentActionsLocked("uploaded")).toBe(false);
    expect(studentActionsLocked("scanning")).toBe(false);
    expect(studentActionsLocked("needs_revision")).toBe(false);
    expect(studentActionsLocked("pending_approval")).toBe(false);
  });
});

describe("formatReviewedAt", () => {
  const NOW = new Date("2026-04-23T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for null/undefined/invalid", () => {
    expect(formatReviewedAt(null)).toBeNull();
    expect(formatReviewedAt(undefined)).toBeNull();
    expect(formatReviewedAt("not-a-date")).toBeNull();
  });
  it("returns 'just now' for <60s", () => {
    expect(formatReviewedAt(new Date(NOW - 30_000).toISOString())).toBe(
      "reviewed just now"
    );
  });
  it("returns minute/hour/day deltas for older timestamps", () => {
    expect(formatReviewedAt(new Date(NOW - 5 * 60_000).toISOString())).toBe(
      "reviewed 5m ago"
    );
    expect(formatReviewedAt(new Date(NOW - 3 * 60 * 60_000).toISOString())).toBe(
      "reviewed 3h ago"
    );
    expect(
      formatReviewedAt(new Date(NOW - 2 * 24 * 60 * 60_000).toISOString())
    ).toBe("reviewed 2d ago");
  });
});

describe("shouldShowReviewCard", () => {
  it("shows for the 3 actioned statuses", () => {
    expect(shouldShowReviewCard("needs_revision", "any note")).toBe(true);
    expect(shouldShowReviewCard("needs_revision", null)).toBe(true);
    expect(shouldShowReviewCard("rejected", null)).toBe(true);
    expect(shouldShowReviewCard("approved", null)).toBe(true);
  });
  it("hides for pending_approval / pre-submission statuses", () => {
    expect(shouldShowReviewCard("uploaded", null)).toBe(false);
    expect(shouldShowReviewCard("scanning", null)).toBe(false);
    expect(shouldShowReviewCard("pending_approval", "teacher added a note")).toBe(
      false
    );
    expect(shouldShowReviewCard("picked_up", null)).toBe(false);
    expect(shouldShowReviewCard("cancelled", null)).toBe(false);
  });
});
