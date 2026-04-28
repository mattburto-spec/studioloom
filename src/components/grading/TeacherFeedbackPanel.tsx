"use client";

/**
 * G2.3 — student-facing teacher feedback panel.
 *
 * Mounted on the student lesson page, just above the footer. Fetches
 * /api/student/tile-comments?unitId=...&pageId=... and renders one
 * card per anchored teacher comment, each labelled with the tile's
 * prompt so the student knows which response the feedback is for.
 *
 * v1 = list, not visually anchored to each section. Iterate to inline-
 * anchored when there's signal that students want it stitched into the
 * lesson flow.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface TileComment {
  tile_id: string;
  page_id: string;
  student_facing_comment: string;
  score: number | null;
  released_at: string | null;
}

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
