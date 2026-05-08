"use client";

/**
 * G3.3 — student-facing teacher feedback components.
 *
 * Three exports cover the full visibility story:
 *
 *   useTileFeedback(unitId, pageId)
 *     Hook. Fetches /api/student/tile-comments and returns a tile_id → comment map.
 *     Single fetch per (unit, page); shareable across the lesson page so the
 *     banner + inline cards + bottom panel all stay in sync.
 *
 *   <TeacherFeedbackBanner comments={...} />
 *     Top-of-lesson banner shown when ≥1 comment exists. Click → smooth-scroll
 *     to the first feedback card. Lights up the existence of feedback even
 *     when the student would otherwise miss it.
 *
 *   <InlineTeacherFeedback comment={...} />
 *     Per-tile renderer, mounted directly below an ActivityCard. The
 *     comment is "anchored" — it's literally next to the response it's
 *     about, not buried in a panel at the bottom.
 *
 *   <TeacherFeedbackPanel ... />
 *     LEGACY (G2.3) — bottom-of-page list. Kept for the no-anchor fallback
 *     when the caller can't render inline. New code should prefer the
 *     hook + InlineTeacherFeedback combo.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

export interface TileComment {
  tile_id: string;
  page_id: string;
  student_facing_comment: string;
  score: number | null;
  released_at: string | null;
}

// ─── Hook: useTileFeedback ─────────────────────────────────────────────────

export function useTileFeedback(unitId: string, pageId: string) {
  const [comments, setComments] = useState<TileComment[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/student/tile-comments?unitId=${encodeURIComponent(unitId)}&pageId=${encodeURIComponent(pageId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setComments([]);
          return;
        }
        const json = (await res.json()) as { comments: TileComment[] };
        if (!cancelled) setComments(json.comments ?? []);
      } catch {
        if (!cancelled) setComments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId, pageId]);

  // Map for O(1) lookup by tile_id.
  const byTileId = useMemo(() => {
    const m: Record<string, TileComment> = {};
    for (const c of comments ?? []) m[c.tile_id] = c;
    return m;
  }, [comments]);

  return { comments, byTileId, loading: comments === null };
}

// ─── <TeacherFeedbackBanner /> ────────────────────────────────────────────

export function TeacherFeedbackBanner({
  comments,
}: {
  comments: TileComment[];
}) {
  if (comments.length === 0) return null;

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
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-left hover:bg-emerald-100 transition group"
      >
        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-900 leading-tight">
            Your teacher left {comments.length} feedback comment{comments.length === 1 ? "" : "s"} on this lesson
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

export function InlineTeacherFeedback({
  comment,
  isFirst = false,
}: {
  comment: TileComment | undefined;
  /** Mark the first feedback card on the page so the banner can scroll to it. */
  isFirst?: boolean;
}) {
  if (!comment) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, scale: 0.99, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="max-w-3xl mx-auto px-4 mt-3 mb-6"
      data-feedback-anchor={isFirst ? "true" : undefined}
      aria-label="Feedback from your teacher"
    >
      <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-50 to-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
            Feedback from your teacher
          </span>
          {typeof comment.score === "number" && (
            <span className="ml-auto text-[10px] font-mono tabular-nums text-emerald-700">
              score {comment.score}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">
          {comment.student_facing_comment}
        </p>
      </div>
    </motion.aside>
  );
}

// ─── <TeacherFeedbackPanel /> (legacy — kept for compatibility) ───────────

export interface TeacherFeedbackPanelProps {
  unitId: string;
  pageId: string;
  /** Optional: tile_id → display label (typically the tile prompt). */
  tileLabels?: Record<string, string>;
}

export function TeacherFeedbackPanel({
  unitId,
  pageId,
  tileLabels,
}: TeacherFeedbackPanelProps) {
  const { comments } = useTileFeedback(unitId, pageId);

  if (comments === null || comments.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-3xl mx-auto px-4 mt-8 mb-6"
      aria-label="Feedback from your teacher"
    >
      <header className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-gray-900">Feedback from your teacher</h2>
          <p className="text-[11px] text-gray-500">
            {comments.length} comment{comments.length === 1 ? "" : "s"} on this lesson
          </p>
        </div>
      </header>

      <ul className="space-y-2.5">
        {comments.map((c, i) => {
          const label =
            tileLabels?.[c.tile_id] ??
            (c.tile_id.startsWith("activity_")
              ? `Activity ${i + 1}`
              : `Section ${i + 1}`);
          return (
            <motion.li
              key={c.tile_id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.04 }}
              className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3"
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 truncate">
                  {label}
                </span>
                {typeof c.score === "number" && (
                  <span className="text-[10px] font-mono text-emerald-600 tabular-nums">
                    score {c.score}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                {c.student_facing_comment}
              </p>
            </motion.li>
          );
        })}
      </ul>
    </motion.section>
  );
}
