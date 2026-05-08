/**
 * TFL.1 — pure helpers backing the read-receipt UI.
 *
 * Extracted to a `.ts` module (Lesson #71 — pure logic in `.tsx` isn't
 * testable in this repo's vitest config) so the marking-page row chip
 * can derive its label deterministically and the tests can assert
 * exact expected values (Lesson #38).
 *
 * Domain rules locked in §3 of the brief:
 *   - student_seen_comment_at is the timestamp of the LAST lesson view
 *     that surfaced this comment. Bumped by the student-side GET; null
 *     means "never seen since this comment was sent".
 *   - "Unread > 48h" is a soft amber indicator; the threshold lives
 *     here as a constant, not a teacher-tunable setting (Lesson #44).
 *   - Strict greater-than: a comment sent EXACTLY 48h ago that the
 *     student hasn't seen is NOT yet flagged amber. The threshold is
 *     "past 48h", not "at 48h".
 */

/** Soft "unread for too long" threshold. 48h matches the brief; not
 *  configurable per teacher in v1. */
export const UNREAD_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export type CommentReadState =
  | "unsent" // teacher hasn't sent a comment yet
  | "seen-current" // student has seen the latest version
  | "seen-stale" // student saw an older version; teacher has since edited
  | "unread-fresh" // sent recently, still inside the 48h window
  | "unread-stale"; // sent past the 48h window with no view

export interface CommentReadInput {
  /** Timestamp the student-facing comment was last written (or null if
   *  no comment exists). Mirrors `student_tile_grades.updated_at` for
   *  rows where `student_facing_comment` is non-empty. The brief
   *  documents that `updated_at` already serves as "last comment
   *  edit" for the purposes of this check. */
  commentSentAt: Date | string | null;
  /** Timestamp of the most recent student view; null if never seen. */
  seenAt: Date | string | null;
  /** Override the threshold for tests. Production callers omit this. */
  thresholdMs?: number;
  /** Override "now" for tests. Production callers omit this. */
  now?: Date | number;
}

/**
 * Classify the read state of a comment for a single (student, tile).
 * Returns an enum string the UI maps to chip styling.
 *
 * Truth table (with default 48h threshold):
 *   commentSentAt=null                                 → unsent
 *   seenAt=null,    sent < 48h ago                     → unread-fresh
 *   seenAt=null,    sent ≥ 48h ago (strict >)          → unread-stale
 *   seenAt is set,  seenAt >= commentSentAt            → seen-current
 *   seenAt is set,  seenAt <  commentSentAt            → seen-stale
 *
 * The strict-greater-than rule on the threshold means a comment sent
 * EXACTLY 48h ago is still "unread-fresh" — the amber flip happens
 * one millisecond later. Conservative on purpose: don't blame teachers
 * for the 48h boundary case.
 */
export function classifyCommentReadState(input: CommentReadInput): CommentReadState {
  const sent = toEpoch(input.commentSentAt);
  if (sent === null) return "unsent";

  const seen = toEpoch(input.seenAt);
  if (seen !== null) {
    return seen >= sent ? "seen-current" : "seen-stale";
  }

  const now = input.now === undefined ? Date.now() : toEpoch(input.now)!;
  const threshold = input.thresholdMs ?? UNREAD_THRESHOLD_MS;
  const ageMs = now - sent;
  return ageMs > threshold ? "unread-stale" : "unread-fresh";
}

/**
 * Convenience: same inputs, returns just the boolean "show the amber
 * unread-stale dot" answer. Used by the row chip when it just needs a
 * yes/no signal rather than the full state.
 */
export function isCommentUnread(input: CommentReadInput): boolean {
  return classifyCommentReadState(input) === "unread-stale";
}

/**
 * TFL.1.3 — tooltip copy for the read-receipt dot on the marking-page
 * row chip. Returns null for the 'unsent' state (no dot rendered, no
 * tooltip needed). Drives both the visual treatment and the hover
 * copy from a single source of truth so the dot color and the
 * tooltip text can never disagree.
 */
export function commentChipTooltip(
  state: CommentReadState,
  commentSentAt: Date | string | null,
  seenAt: Date | string | null,
  now?: Date | number,
): string | null {
  if (state === "unsent") return null;
  const sentAgo = formatRelativeAgo(commentSentAt, now);
  const seenAgo = formatRelativeAgo(seenAt, now);
  switch (state) {
    case "seen-current":
      return `Seen ${seenAgo}`;
    case "seen-stale":
      return `Seen the older version (${seenAgo})`;
    case "unread-fresh":
      return `Sent ${sentAgo}, not yet seen`;
    case "unread-stale":
      return `Sent ${sentAgo}, unread`;
  }
}

/**
 * Format a relative-time string for the chip tooltip ("3m ago",
 * "2h ago", "3d ago"). Caps at days; weeks/months land outside the
 * 48h window anyway and the tooltip just says "X days ago".
 */
export function formatRelativeAgo(when: Date | string | null, now?: Date | number): string {
  const t = toEpoch(when);
  if (t === null) return "never";
  const n = now === undefined ? Date.now() : toEpoch(now)!;
  const ms = n - t;
  if (ms < 0) return "just now"; // clock skew defensive
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// ─── Internal ──────────────────────────────────────────────────────────────

function toEpoch(v: Date | string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}
