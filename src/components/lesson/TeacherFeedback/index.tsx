/**
 * <TeacherFeedback /> — public entry. Pass A (10 May 2026).
 *
 * Orchestrates the four-state machine derived from the turns array:
 *   - empty       : zero turns → render the empty-state placeholder
 *   - fresh-unread: 1 teacher turn, no replies → single bubble + pills
 *   - active      : ≥1 student reply → Thread (multi-turn)
 *   - resolved    : latest is got_it → ResolvedSummary, expandable
 *
 * Pass B will:
 *   - Replace fixtures with a hook that loads turns from
 *     `tile_feedback_turns` (filtered by tile_id + student_id).
 *   - Wire `onReply` to a POST endpoint that inserts a student turn.
 *   - Wire the read-receipt RPC to fire on first paint of any unseen
 *     teacher turn.
 *   - Add `needsReply` plumbing on the marking-page composer side.
 *
 * The component is presentation-only: state derivation, animation,
 * a11y. No data fetching, no persistence, no read-receipt logic.
 */

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type {
  Sentiment,
  TeacherFeedbackProps,
  TeacherTurn,
  Turn,
} from "./types";
import { SENTIMENT_LABELS } from "./types";
import { SpeechBubbleTail } from "./SpeechBubbleTail";
import { QuickReplies } from "./QuickReplies";
import { ReplyBox } from "./ReplyBox";
import { Thread } from "./Thread";
import { ResolvedSummary } from "./ResolvedSummary";

function deriveState(turns: Turn[]): "empty" | "fresh-unread" | "active" | "resolved" {
  if (turns.length === 0) return "empty";
  const latest = turns[turns.length - 1];
  if (latest.role === "student" && latest.sentiment === "got_it") {
    return "resolved";
  }
  // ≥2 turns AND we have at least one student reply means we're in
  // an active thread.
  const hasStudentReply = turns.some((t) => t.role === "student");
  if (hasStudentReply) return "active";
  // 1 teacher turn, no student reply yet → fresh.
  return "fresh-unread";
}

function teacherInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

function formatRelativeTime(iso: string): string {
  const sentMs = new Date(iso).getTime();
  const ageMs = Date.now() - sentMs;
  const min = Math.floor(ageMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function TeacherFeedback({
  threadId,
  turns,
  attentionGrab = false,
  needsReply = false,
  onReply,
  onReopen,
}: TeacherFeedbackProps) {
  // Component-level state.
  // - selectedSentiment: which pill the user has clicked. null until
  //   the first click. `got_it` resolves immediately; `not_sure` /
  //   `pushback` open the reply box.
  // - replyOpen: whether the reply textarea is rendered.
  // - sending: in-flight send to the parent (await onReply).
  // - reopenedFromResolved: when true, render the full thread instead
  //   of the resolved summary even though state is "resolved".
  const [selectedSentiment, setSelectedSentiment] =
    React.useState<Sentiment | null>(null);
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [reopenedFromResolved, setReopenedFromResolved] = React.useState(false);

  const state = deriveState(turns);
  const titleId = `teacher-feedback-title-${threadId}`;

  // Dev-only contract check: if the array is non-empty, the first
  // entry must be a teacher turn. Lesson #38 — assert at the boundary.
  React.useEffect(() => {
    if (turns.length > 0 && turns[0].role !== "teacher") {
      // eslint-disable-next-line no-console
      console.error(
        `[TeacherFeedback] thread ${threadId}: first turn must be a teacher turn. Got ${turns[0].role}.`,
      );
    }
  }, [turns, threadId]);

  async function handleSelect(s: Sentiment) {
    if (s === "got_it") {
      // Single-click resolution. No reply box.
      setSending(true);
      try {
        await onReply("got_it");
      } finally {
        setSending(false);
      }
      return;
    }
    setSelectedSentiment(s);
    setReplyOpen(true);
  }

  async function handleSend(text: string) {
    if (!selectedSentiment) return;
    setSending(true);
    try {
      await onReply(selectedSentiment, text);
      // Clear local state — the new student turn will arrive via the
      // turns prop on the parent's next render.
      setSelectedSentiment(null);
      setReplyOpen(false);
    } finally {
      setSending(false);
    }
  }

  function handleCancel() {
    setSelectedSentiment(null);
    setReplyOpen(false);
  }

  // Empty state — no comment yet from teacher. Spec: subtle,
  // non-attention-grabbing.
  if (state === "empty") {
    return (
      <section
        data-testid="teacher-feedback"
        data-state="empty"
        aria-labelledby={titleId}
        className="mt-4 rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-5"
      >
        <h3 id={titleId} className="sr-only">
          Teacher feedback
        </h3>
        <div className="text-sm text-gray-500 italic">
          No teacher feedback yet on this tile.
        </div>
      </section>
    );
  }

  // Resolved (collapsed) state — unless the user re-opened it.
  if (state === "resolved" && !reopenedFromResolved) {
    const latestTeacherTurn = [...turns]
      .reverse()
      .find((t): t is TeacherTurn => t.role === "teacher");
    if (!latestTeacherTurn) return null;
    return (
      <section
        data-testid="teacher-feedback"
        data-state="resolved"
        aria-labelledby={titleId}
        className="relative mt-6"
      >
        <h3 id={titleId} className="sr-only">
          Teacher feedback (resolved)
        </h3>
        <SpeechBubbleTail variant="teacher" />
        <ResolvedSummary
          latestTeacherTurn={latestTeacherTurn}
          turnCount={turns.length}
          onReopen={() => {
            setReopenedFromResolved(true);
            onReopen?.();
          }}
        />
      </section>
    );
  }

  // Active thread (or re-opened resolved) — render the multi-turn Thread.
  if (state === "active" || (state === "resolved" && reopenedFromResolved)) {
    return (
      <section
        data-testid="teacher-feedback"
        data-state={state === "resolved" ? "resolved-expanded" : "active"}
        aria-labelledby={titleId}
        className="relative mt-6"
      >
        <h3 id={titleId} className="sr-only">
          Teacher feedback thread
        </h3>
        <SpeechBubbleTail variant="teacher" />
        <Thread turns={turns} />
        {/* Latest turn is teacher → show pills below. Latest turn
            is student → no controls (teacher's move next). The Thread
            already shows the trailing student turn's sentiment chip;
            we don't duplicate the pills until the teacher replies. */}
        {turns[turns.length - 1].role === "teacher" && state !== "resolved" && (
          <div className="mt-4 px-1">
            <div
              id={`${titleId}-pills`}
              className="text-[10px] font-bold tracking-wider uppercase text-emerald-700/70 mb-2"
            >
              How does this land?
            </div>
            <QuickReplies
              selected={selectedSentiment}
              onSelect={handleSelect}
              disableGotIt={needsReply}
              labelId={`${titleId}-pills`}
            />
            {selectedSentiment &&
              selectedSentiment !== "got_it" && (
                <ReplyBox
                  sentiment={selectedSentiment}
                  open={replyOpen}
                  sending={sending}
                  onCancel={handleCancel}
                  onSend={handleSend}
                />
              )}
          </div>
        )}
      </section>
    );
  }

  // Fresh-unread (single teacher turn) — speech bubble with avatar
  // header, body, pills below.
  const turn = turns[0] as TeacherTurn;
  return (
    <motion.section
      data-testid="teacher-feedback"
      data-state="fresh-unread"
      aria-labelledby={titleId}
      className="relative mt-6"
      animate={
        attentionGrab
          ? {
              boxShadow: [
                "0 0 0 0 rgba(16,185,129,0.4)",
                "0 0 0 8px rgba(16,185,129,0)",
                "0 0 0 0 rgba(16,185,129,0)",
              ],
            }
          : undefined
      }
      transition={
        attentionGrab
          ? { duration: 1.4, repeat: Infinity, ease: "easeOut" }
          : undefined
      }
      style={{ borderRadius: 24 }}
    >
      <h3 id={titleId} className="sr-only">
        Teacher feedback
      </h3>
      <SpeechBubbleTail variant="teacher" />
      <div className="rounded-3xl border-2 border-emerald-500 bg-emerald-50 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-[0_0_0_3px_rgba(16,185,129,0.2)]">
            {teacherInitials(turn.authorName)}
          </div>
          <span className="text-sm font-bold text-emerald-950">
            {turn.authorName}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-extrabold tracking-wider uppercase">
            Teacher
          </span>
          {needsReply && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <line x1="4" y1="22" x2="4" y2="15" />
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1" />
              </svg>
              Needs reply
            </span>
          )}
          <span className="text-[11px] text-gray-500">
            · {formatRelativeTime(turn.sentAt)}
            {turn.editedAt && " (edited)"}
          </span>
        </div>
        <div
          className="prose prose-sm max-w-none text-emerald-950 leading-relaxed [&_em]:text-emerald-900 [&_strong]:text-emerald-950 mb-4"
          dangerouslySetInnerHTML={{ __html: turn.bodyHTML }}
        />
        <div
          id={`${titleId}-pills`}
          className="text-[10px] font-bold tracking-wider uppercase text-emerald-700/70 mb-2"
        >
          {needsReply ? "Reply required to continue" : "How does this land?"}
        </div>
        <QuickReplies
          selected={selectedSentiment}
          onSelect={handleSelect}
          disableGotIt={needsReply}
          labelId={`${titleId}-pills`}
        />
        {selectedSentiment && selectedSentiment !== "got_it" && (
          <ReplyBox
            sentiment={selectedSentiment}
            open={replyOpen}
            sending={sending}
            onCancel={handleCancel}
            onSend={handleSend}
          />
        )}
      </div>
    </motion.section>
  );
}
