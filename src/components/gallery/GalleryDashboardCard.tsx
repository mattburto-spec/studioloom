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
    <Link href={`/unit/${unitId}/gallery/${round.id}`}>
      <div className="group relative rounded-2xl bg-white border border-slate-200 hover:border-purple-300 overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer">
        {/* Background gradient accent */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full -translate-x-16 -translate-y-16 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-300"></div>

        {/* Content */}
        <div className="relative px-6 py-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors">
                {round.title}
              </h4>
              <p className="text-sm text-slate-600 mt-0.5">{round.unitTitle}</p>
            </div>

            {/* Gallery icon */}
            <div className="flex-shrink-0 ml-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center group-hover:from-purple-200 group-hover:to-indigo-200 transition-colors">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Submission status */}
          <div className="mb-4 flex items-center gap-2">
            {round.hasSubmitted ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Work shared
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                <svg
                  className="w-3.5 h-3.5 animate-pulse"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                Not submitted
              </div>
            )}
          </div>

          {/* Reviews progress */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700">
                Reviews {round.reviewsCompleted}/{round.minReviews}
              </span>
              {allSubmissionsReviewed && (
                <span className="text-xs font-medium text-green-700">
                  ✓ Complete
                </span>
              )}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(reviewProgress, 100)}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Submissions count */}
          <div className="text-xs text-slate-600 mb-3">
            <span className="font-medium text-slate-700">
              {round.totalSubmissions}
            </span>{" "}
            submission{round.totalSubmissions !== 1 ? "s" : ""} to review
          </div>

          {/* Deadline */}
          {round.deadline && (
            <div
              className={`inline-block text-xs font-medium px-2 py-1 rounded-lg mb-3 ${
                isDeadlinePassed
                  ? "bg-red-100 text-red-700"
                  : isDeadlineSoon
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {isDeadlinePassed ? (
                <span>Ended {formatDate(round.deadline)}</span>
              ) : isDeadlineSoon ? (
                <span>Due soon: {formatDate(round.deadline)}</span>
              ) : (
                <span>Due {formatDate(round.deadline)}</span>
              )}
            </div>
          )}

          {/* CTA button */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            {round.hasSubmitted ? (
              <>
                {allSubmissionsReviewed ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      // Navigation will happen from Link wrapper
                    }}
                    className="flex-1 text-left text-sm font-medium text-slate-700 group-hover:text-purple-700 transition-colors"
                  >
                    View feedback →
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      // Navigation will happen from Link wrapper
                    }}
                    className="flex-1 text-left text-sm font-medium text-purple-700 group-hover:text-purple-900 transition-colors"
                  >
                    Continue reviewing →
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  // Navigation will happen from Link wrapper
                }}
                className="flex-1 text-left text-sm font-medium text-purple-700 group-hover:text-purple-900 transition-colors"
              >
                Share your work →
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
