/**
 * <TeacherFeedback /> — types.
 *
 * Pass A (10 May 2026) — visual + interactive component, fixtures only.
 * Pass B will wire these to the `tile_feedback_turns` schema. The shapes
 * below are the BUILD CONTRACT: when the schema lands in Pass B, the
 * loader returns Turn[] in this exact shape so no component change is
 * needed.
 *
 * Why polymorphic Turn (teacher | student) rather than two arrays:
 *   The thread renderer interleaves turns by sentAt. Treating each turn
 *   as a row with a discriminated `role` lets the renderer iterate
 *   linearly without zip/merge logic, and matches the natural shape of a
 *   single SQL query with `ORDER BY sent_at ASC`. Also future-proofs for
 *   AI-mediator turns or peer-reviewer turns without changing the
 *   renderer (just a new `role` discriminator).
 */

/** Student reaction to a teacher comment.
 *  - got_it: student understood. Implicitly resolves the thread.
 *  - not_sure: student doesn't follow; reply text required (≥10 chars).
 *  - pushback: student disagrees; reply text required (≥10 chars).
 *    Surfaced to the student as the label "I disagree" — DB enum stays
 *    `pushback` (Lesson #29 — UI labels can drift; DB enums shouldn't).
 */
export type Sentiment = "got_it" | "not_sure" | "pushback";

/** UI-only label for a sentiment. Matches Matt's TFL.2 brief decision
 *  "I disagree" over "Push back" (10 May 2026). */
export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  got_it: "Got it",
  not_sure: "Not sure",
  pushback: "I disagree",
};

/** Minimum reply length for sentiments that require justification. */
export const REPLY_MIN_CHARS = 10;

export interface TeacherTurn {
  role: "teacher";
  /** Stable identifier — typically a row id from `tile_feedback_turns`.
   *  Pass A fixtures use synthetic ids (`fixture-t-1` etc). */
  id: string;
  /** Resolves to a real teacher row in Pass B. Used to derive name +
   *  initials. Pass A: included for shape parity. */
  authorId: string;
  /** Display name as shown to the student ("Mr Burton", "Ms Smith").
   *  Pass A passes this through directly; Pass B will resolve from
   *  `authorId`. */
  authorName: string;
  /** Sanitized HTML allowing strong, em, p, ul, ol, li, blockquote.
   *  All other tags must be stripped at the persistence boundary —
   *  the component does NOT sanitize at render time (Lesson #38: trust
   *  but verify only at the boundary). */
  bodyHTML: string;
  /** ISO timestamp of when the turn was sent to the student. */
  sentAt: string;
  /** ISO timestamp of last edit. Undefined if never edited. */
  editedAt?: string;
}

export interface StudentTurn {
  role: "student";
  id: string;
  /** Discriminated reaction. Drives the sentiment chip + thread bubble
   *  border colour. */
  sentiment: Sentiment;
  /** Plain text only — student replies are NOT rich-text. The
   *  composer's textarea enforces this. */
  text: string;
  sentAt: string;
}

export type Turn = TeacherTurn | StudentTurn;

/** Thread state — derived from the turns array, not stored separately.
 *  - empty       : zero turns (no teacher comment yet — empty state)
 *  - fresh-unread: 1 teacher turn, no student replies, attentionGrab on
 *  - active      : ≥1 teacher turn, ≥1 student turn, latest is teacher
 *                  awaiting a reply OR latest is student awaiting follow-up
 *  - resolved    : latest turn is `student.sentiment === "got_it"` */
export type ThreadState = "empty" | "fresh-unread" | "active" | "resolved";

export interface TeacherFeedbackProps {
  /** Stable id for ARIA wiring. Becomes the suffix of the section's
   *  aria-labelledby. */
  threadId: string;
  /** Ordered by sentAt ASC. The first turn (turns[0]) is always teacher
   *  by contract — the component throws (in dev) if not. */
  turns: Turn[];
  /** When true, render the unread pulse + ring on Fresh state. The
   *  parent typically derives this from a "haven't seen this turn yet"
   *  flag (TFL.1 read receipts). */
  attentionGrab?: boolean;
  /** Pass-B-only flag. When true: Got-it pill is disabled, the upstream
   *  response submit is gated (parent's responsibility), header gets a
   *  red "Needs reply" pill. Component just signals the disabled state.
   *  Pass A keeps the prop for forward-compat + Storybook coverage. */
  needsReply?: boolean;
  /** Called when the student picks a sentiment + (optionally) sends a
   *  reply. The promise resolves once persistence completes — the
   *  component shows a sending spinner until then. */
  onReply: (sentiment: Sentiment, text?: string) => Promise<void>;
  /** Optional. Pass B may use this for explicit teacher-set close.
   *  Pass A: not wired in fixtures. */
  onResolve?: () => void;
  /** Called when the resolved-summary card is clicked to expand. */
  onReopen?: () => void;
}
