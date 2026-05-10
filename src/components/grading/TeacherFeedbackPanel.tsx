"use client";

/**
 * Student-facing teacher-feedback surfaces.
 *
 * History:
 *   G3.3 — original implementation read /api/student/tile-comments
 *     and rendered each comment as a single emerald card via
 *     <InlineTeacherFeedback comment={...} />.
 *   TFL.2 Pass B (B.2, 10 May 2026) — replaces the single-comment
 *     model with multi-turn threads. New endpoint
 *     /api/student/tile-feedback returns Record<tileId, Turn[]>; the
 *     inline renderer wraps Pass A's <TeacherFeedback /> component
 *     so the speech-bubble shape, threading, sentiment chips, and
 *     resolved-summary collapse all light up. Replies are gated off
 *     until B.3 ships the POST endpoint.
 *
 * Three exports cover the full visibility story:
 *
 *   useTileFeedbackThreads(unitId, pageId)
 *     Hook. Fetches /api/student/tile-feedback and returns a
 *     `threadsByTileId` map (Record<tileId, Turn[]>). Single fetch
 *     per (unit, page); shareable across the lesson page so the
 *     banner + inline cards stay in sync.
 *
 *   <TeacherFeedbackBanner threadsByTileId={...} />
 *     Top-of-lesson banner shown when ≥1 thread has at least one
 *     teacher turn. Click → smooth-scroll to the first feedback card.
 *
 *   <InlineTeacherFeedback turns={...} threadId={...} isFirst={...} />
 *     Per-tile renderer mounted directly below the ActivityCard.
 *     Wraps Pass A's <TeacherFeedback />. Carries
 *     data-feedback-anchor on the FIRST tile that has a thread, so
 *     the banner's smooth-scroll lands on that card.
 *
 * Pass B sub-phases B.3+ will introduce onReply; for now the inline
 * renderer passes a no-op AND disables the QuickReplies via
 * repliesEnabled={false}, so the read-only thread is the full UX
 * until that endpoint exists.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TeacherFeedback } from "@/components/lesson/TeacherFeedback";
import type {
  Turn,
  Sentiment,
} from "@/components/lesson/TeacherFeedback/types";

/** Map shape returned by GET /api/student/tile-feedback. Empty
 *  threads (no turns yet) MAY be present as empty arrays — callers
 *  should treat both `undefined` and `[]` as "no feedback". */
export type ThreadsByTileId = Record<string, Turn[]>;

// ─── Hook: useTileFeedbackThreads ─────────────────────────────────────────

export function useTileFeedbackThreads(unitId: string, pageId: string) {
  const [threadsByTileId, setThreadsByTileId] =
    useState<ThreadsByTileId | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/student/tile-feedback?unitId=${encodeURIComponent(unitId)}&pageId=${encodeURIComponent(pageId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setThreadsByTileId({});
          return;
        }
        const json = (await res.json()) as { threadsByTileId: ThreadsByTileId };
        if (!cancelled) setThreadsByTileId(json.threadsByTileId ?? {});
      } catch {
        if (!cancelled) setThreadsByTileId({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId, pageId]);

  // Derived: count of tiles with at least one TEACHER turn — the only
  // threads worth surfacing in the banner. A thread containing only a
  // student-side draft (which doesn't exist in v1 anyway) wouldn't
  // count as "feedback".
  const teacherFedTileIds = useMemo(() => {
    if (!threadsByTileId) return [];
    return Object.entries(threadsByTileId)
      .filter(([, turns]) => turns.some((t) => t.role === "teacher"))
      .map(([tileId]) => tileId);
  }, [threadsByTileId]);

  return {
    threadsByTileId: threadsByTileId ?? {},
    teacherFedTileIds,
    loading: threadsByTileId === null,
  };
}

// ─── <TeacherFeedbackBanner /> ────────────────────────────────────────────

export function TeacherFeedbackBanner({
  teacherFedTileIds,
}: {
  /** Tile IDs with ≥1 teacher turn — derived in the hook. The banner
   *  shows count + scroll-to-first-anchor; it doesn't read the turns. */
  teacherFedTileIds: string[];
}) {
  if (teacherFedTileIds.length === 0) return null;

  const onJump = () => {
    const first = document.querySelector('[data-feedback-anchor="true"]');
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-3xl mx-auto px-4 mt-3 mb-2"
    >
      <button
        type="button"
        onClick={onJump}
        data-testid="teacher-feedback-banner"
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-left hover:bg-emerald-100 transition group"
      >
        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-900 leading-tight">
            Your teacher left feedback on {teacherFedTileIds.length}{" "}
            {teacherFedTileIds.length === 1 ? "tile" : "tiles"} on this lesson
          </p>
          <p className="text-[11px] text-emerald-700">
            Tap to jump to the first one — they appear next to your responses.
          </p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-600 group-hover:translate-y-0.5 transition-transform flex-shrink-0"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </motion.div>
  );
}

// ─── <InlineTeacherFeedback /> ────────────────────────────────────────────

export interface InlineTeacherFeedbackProps {
  /** All turns on this tile, ordered by sent_at. Empty array = no
   *  comment yet; the wrapper renders nothing rather than the empty
   *  state placeholder (the lesson page wants tiles with no feedback
   *  to look unaffected, not annotated). */
  turns: Turn[];
  /** Stable id for ARIA wiring. Typically grade.id; the wrapper
   *  passes it through. */
  threadId: string;
  /** Mark the first feedback wrapper on the page so the banner can
   *  scroll to it. */
  isFirst?: boolean;
}

export function InlineTeacherFeedback({
  turns,
  threadId,
  isFirst = false,
}: InlineTeacherFeedbackProps) {
  // No turns at all → render nothing. Empty turns on a tile that
  // otherwise has none means "this tile has never had feedback" —
  // we don't want to clutter the lesson page with empty placeholders.
  if (turns.length === 0) return null;

  // Pass B.2 onReply is a no-op resolved promise — the QuickReplies +
  // ReplyBox aren't rendered (repliesEnabled=false) so this is just
  // a TypeScript stub satisfying the prop. B.3 replaces this with
  // a real persist-to-server handler.
  const handleReply = async (_s: Sentiment, _text?: string) => {
    // intentional no-op — replies disabled in Pass B.2
    return;
  };

  return (
    <div
      className="max-w-3xl mx-auto px-4 mt-3 mb-6"
      data-feedback-anchor={isFirst ? "true" : undefined}
      aria-label="Feedback from your teacher"
    >
      <TeacherFeedback
        threadId={threadId}
        turns={turns}
        repliesEnabled={false}
        onReply={handleReply}
      />
    </div>
  );
}
