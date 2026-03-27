"use client";

import Link from "next/link";
import { formatDate, getDaysUntil } from "@/lib/utils";

interface GalleryRound {
  id: string;
  title: string;
  unitTitle: string;
  reviewFormat: "comment" | "pmi" | "two-stars-wish";
  deadline?: string;
  hasSubmitted: boolean;
  reviewsCompleted: number;
  minReviews: number;
  totalSubmissions: number;
}

interface GalleryDashboardCardProps {
  round: GalleryRound;
  unitId: string;
}

export function GalleryDashboardCard({
  round,
  unitId,
}: GalleryDashboardCardProps) {
  const reviewProgress = round.minReviews > 0
    ? Math.round((round.reviewsCompleted / round.minReviews) * 100)
    : 0;

  const isDeadlineSoon = round.deadline
    ? getDaysUntil(round.deadline) <= 3 && getDaysUntil(round.deadline) > 0
    : false;

  const isDeadlinePassed = round.deadline
    ? getDaysUntil(round.deadline) <= 0
    : false;

  const allSubmissionsReviewed =
    round.reviewsCompleted >= round.minReviews && round.minReviews > 0;

  return (
    <Link href={`/gallery/${round.id}`}>
      <div className="group flex items-center gap-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 px-4 py-3 transition-all duration-200 hover:shadow-sm cursor-pointer">
        {/* Icon */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-slate-900 group-hover:text-purple-700 transition-colors truncate">
              {round.title}
            </h4>
            {/* Status badge */}
            {round.hasSubmitted ? (
              <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                Shared
              </span>
            ) : (
              <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                Not submitted
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
            {round.unitTitle && <span className="truncate">{round.unitTitle}</span>}
            <span>Reviews {round.reviewsCompleted}/{round.minReviews}</span>
            {round.totalSubmissions > 0 && <span>{round.totalSubmissions} to review</span>}
            {round.deadline && (
              <span className={isDeadlinePassed ? "text-red-600 font-medium" : isDeadlineSoon ? "text-amber-600 font-medium" : ""}>
                {isDeadlinePassed ? `Ended ${formatDate(round.deadline)}` : isDeadlineSoon ? `Due soon` : `Due ${formatDate(round.deadline)}`}
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 text-slate-400 group-hover:text-purple-600 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
