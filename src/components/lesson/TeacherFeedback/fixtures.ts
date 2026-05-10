/**
 * <TeacherFeedback /> — fixture threads for the sandbox.
 *
 * Pass A only — these get replaced by live data in Pass B. The shapes
 * conform to the Turn type so Pass B can drop in without touching the
 * component.
 *
 * Each fixture corresponds to one of the four states from the
 * designer's artboards:
 *   1. Fresh, unread       — single teacher turn, attentionGrab on
 *   2. Active mid-thread   — teacher → student "not_sure" → teacher
 *   3. Flagged needs-reply — teacher turn with needsReply=true (the
 *                            disable lives on the prop, not the turn)
 *   4. Resolved            — full thread ending in got_it
 *
 * Plus a fifth "empty" fixture for the no-comment-yet state.
 */

import type { Turn } from "./types";

const TEACHER_BURTON = {
  authorId: "teacher-burton",
  authorName: "Mr Burton",
};

/** Fixture 1 — Fresh, unread. */
export const FRESH_UNREAD_TURNS: Turn[] = [
  {
    role: "teacher",
    id: "fixture-t-fresh-1",
    ...TEACHER_BURTON,
    bodyHTML:
      "I can't see a definition in your own words yet — your draft restates the prompt. Try the shape: <em>“Agency is when I &hellip; instead of &hellip;”</em> and add one example from this lesson.",
    sentAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
];

/** Fixture 2 — Active mid-thread (3 turns). Demonstrates the
 *  bubble→thread morph: turn 1 is teacher, turn 2 is student "not_sure"
 *  with a reply, turn 3 is a teacher follow-up that addresses the
 *  reply. The renderer interleaves by sentAt order. */
export const ACTIVE_THREAD_TURNS: Turn[] = [
  {
    role: "teacher",
    id: "fixture-t-active-1",
    ...TEACHER_BURTON,
    bodyHTML:
      "Strong start, but I want to hear <strong>your</strong> definition — not the textbook's. Rewrite this in two sentences using one example from your own work this week.",
    sentAt: new Date(Date.now() - 11 * 60_000).toISOString(),
  },
  {
    role: "student",
    id: "fixture-s-active-2",
    sentiment: "not_sure",
    text: "Do you mean an example from the prototype I made on Tuesday, or one from the brainstorm?",
    sentAt: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
  {
    role: "teacher",
    id: "fixture-t-active-3",
    ...TEACHER_BURTON,
    bodyHTML:
      "The prototype — the brainstorm is too early to argue from. Pick one decision you made on Tuesday and use that.",
    sentAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
];

/** Fixture 3 — same shape as Fresh but the parent passes
 *  `needsReply=true` on the props. Disables Got-it. */
export const NEEDS_REPLY_TURNS: Turn[] = [
  {
    role: "teacher",
    id: "fixture-t-flag-1",
    ...TEACHER_BURTON,
    bodyHTML:
      "Strong start, but I want to hear <strong>your</strong> definition — not the textbook's. Rewrite this in two sentences using one example from your own work this week.",
    sentAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
];

/** Fixture 4 — Resolved (got_it on the latest turn). */
export const RESOLVED_TURNS: Turn[] = [
  {
    role: "teacher",
    id: "fixture-t-res-1",
    ...TEACHER_BURTON,
    bodyHTML:
      "I can't see a definition in your own words yet — your draft restates the prompt. Try the shape: <em>“Agency is when I &hellip; instead of &hellip;”</em> and add one example from this lesson.",
    sentAt: new Date(Date.now() - 22 * 60_000).toISOString(),
  },
  {
    role: "student",
    id: "fixture-s-res-2",
    sentiment: "got_it",
    text: "",
    sentAt: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
];

/** Fixture 5 — Empty (no comment from teacher yet). */
export const EMPTY_TURNS: Turn[] = [];
