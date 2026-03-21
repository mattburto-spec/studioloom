"use client";

import { useEffect, useState } from "react";

interface PaceData {
  page_id: string;
  too_slow: number;
  just_right: number;
  too_fast: number;
  total: number;
}

export function PaceFeedbackSummary({ unitId }: { unitId: string }) {
  const [pages, setPages] = useState<PaceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const res = await fetch(`/api/teacher/pace-feedback?unit_id=${unitId}`);
        if (res.ok) {
          const { pages: data } = (await res.json()) as { pages: PaceData[] };
          setPages(data);
        }
      } catch {
        // Silently skip on error — pace feedback is non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [unitId]);

  if (loading || pages.length === 0) {
    return (
      <div className="text-sm text-text-secondary">
        No pace feedback yet. Students submit feedback after completing each lesson.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary">Student Pace Feedback</h3>
      {pages.map((page) => {
        const slowPct = Math.round((page.too_slow / page.total) * 100) || 0;
        const rightPct = Math.round((page.just_right / page.total) * 100) || 0;
        const fastPct = Math.round((page.too_fast / page.total) * 100) || 0;

        return (
          <div key={page.page_id} className="space-y-1">
            <div className="text-xs font-medium text-text-secondary">{page.page_id}</div>
            <div className="flex h-6 rounded-full overflow-hidden bg-surface-alt border border-border">
              {/* Too fast — red */}
              {fastPct > 0 && (
                <div
                  className="bg-rose-500 flex items-center justify-center text-white text-xs font-medium transition-all"
                  style={{ width: `${fastPct}%` }}
                  title={`${page.too_fast} too fast`}
                >
                  {fastPct >= 15 && `${page.too_fast}`}
                </div>
              )}
              {/* Just right — green */}
              {rightPct > 0 && (
                <div
                  className="bg-accent-green flex items-center justify-center text-white text-xs font-medium transition-all"
                  style={{ width: `${rightPct}%` }}
                  title={`${page.just_right} just right`}
                >
                  {rightPct >= 15 && `${page.just_right}`}
                </div>
              )}
              {/* Too slow — amber */}
              {slowPct > 0 && (
                <div
                  className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium transition-all"
                  style={{ width: `${slowPct}%` }}
                  title={`${page.too_slow} too slow`}
                >
                  {slowPct >= 15 && `${page.too_slow}`}
                </div>
              )}
            </div>
            <div className="text-xs text-text-secondary flex gap-3">
              <span>Total: {page.total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
