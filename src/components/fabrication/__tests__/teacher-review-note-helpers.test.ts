import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  teacherReviewStyleFor,
  studentActionsLocked,
  formatReviewedAt,
  shouldShowReviewCard,
  shouldHideSubmitButton,
  canWithdrawJob,
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

describe("shouldHideSubmitButton", () => {
  it("hides Submit on needs_revision (teacher asked for a fix)", () => {
    expect(shouldHideSubmitButton("needs_revision")).toBe(true);
  });
  it("hides Submit on pending_approval (already submitted, would 409)", () => {
    expect(shouldHideSubmitButton("pending_approval")).toBe(true);
  });
  it("keeps Submit for pre-submit statuses (uploaded/scanning)", () => {
    expect(shouldHideSubmitButton("uploaded")).toBe(false);
    expect(shouldHideSubmitButton("scanning")).toBe(false);
  });
  it("keeps Submit visible for terminal statuses (studentActionsLocked handles the lockdown)", () => {
    // These return false here because the UI uses the broader
    // studentActionsLocked to hide all actions at once — this helper
    // only controls the Submit-vs-Re-upload split for interactive
    // statuses. Defensive for callers that compose both.
    expect(shouldHideSubmitButton("approved")).toBe(false);
    expect(shouldHideSubmitButton("rejected")).toBe(false);
    expect(shouldHideSubmitButton("completed")).toBe(false);
  });
});

describe("canWithdrawJob", () => {
  it("allows withdraw for pre-teacher-action statuses", () => {
    expect(canWithdrawJob("uploaded")).toBe(true);
    expect(canWithdrawJob("scanning")).toBe(true);
    expect(canWithdrawJob("pending_approval")).toBe(true);
    expect(canWithdrawJob("needs_revision")).toBe(true);
  });
  it("blocks withdraw once the teacher has actioned / fabricator has picked up", () => {
    expect(canWithdrawJob("approved")).toBe(false);
    expect(canWithdrawJob("rejected")).toBe(false);
    expect(canWithdrawJob("picked_up")).toBe(false);
    expect(canWithdrawJob("completed")).toBe(false);
  });
  it("already-cancelled shows no button (terminal)", () => {
    expect(canWithdrawJob("cancelled")).toBe(false);
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
