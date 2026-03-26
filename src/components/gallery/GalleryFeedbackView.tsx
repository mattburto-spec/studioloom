"use client";

import { useState, useEffect } from "react";
import { formatDate, timeAgo } from "@/lib/utils";

interface Review {
  id: string;
  reviewerName: string | null;
  createdAt: string;
  content: Record<string, unknown>;
}

interface GalleryFeedbackViewProps {
  roundId: string;
  reviewFormat: "comment" | "pmi" | "two-stars-wish";
}

export function GalleryFeedbackView({
  roundId,
  reviewFormat,
}: GalleryFeedbackViewProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [reviewsCompleted, setReviewsCompleted] = useState(0);
  const [minRequired, setMinRequired] = useState(0);

  useEffect(() => {
    const loadFeedback = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/student/gallery/feedback?roundId=${roundId}`);
        if (!res.ok) throw new Error("Failed to load feedback");

        const data = await res.json();
        setReviews(data.reviews || []);
        setLocked(data.locked === true);
        setReviewsCompleted(data.reviewsCompleted || 0);
        setMinRequired(data.minRequired || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load feedback");
      } finally {
        setLoading(false);
      }
    };

    loadFeedback();
  }, [roundId]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center">
        <div className="inline-block w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3"></div>
        <p className="text-slate-600">Loading your feedback…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center">
        <p className="text-red-700 font-medium mb-2">Something went wrong</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  // Locked state - effort-gated
  if (locked) {
    const stillNeeded = minRequired - reviewsCompleted;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-300 p-8 relative overflow-hidden">
          {/* Blur overlay */}
          <div className="absolute inset-0 bg-white/40 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-slate-600 font-medium mb-2">Your feedback is locked</p>
              <p className="text-slate-500 text-sm">
                Complete <span className="font-semibold">{stillNeeded} more review{stillNeeded !== 1 ? "s" : ""}</span> to unlock
              </p>
            </div>
          </div>

          {/* Content behind blur - not visible but preserves spacing */}
          <div className="space-y-4 opacity-30 pointer-events-none">
            {reviews.slice(0, 2).map((review) => (
              <div key={review.id} className="p-4 bg-white rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600">Feedback preview</p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress card */}
        <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-900">Your review progress</h3>
            <span className="text-sm font-semibold text-purple-700">
              {reviewsCompleted}/{minRequired}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((reviewsCompleted / minRequired) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            {stillNeeded > 0
              ? `Complete ${stillNeeded} more review${stillNeeded !== 1 ? "s" : ""} to see what your classmates are saying.`
              : "You've completed all required reviews!"}
          </p>
        </div>
      </div>
    );
  }

  // Unlocked state - show reviews
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center">
        <p className="text-slate-600 font-medium mb-1">No feedback yet</p>
        <p className="text-slate-500 text-sm">Your classmates will share their thoughts soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with count */}
      <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-4">
        <h3 className="font-medium text-slate-900">
          Your feedback ({reviews.length})
        </h3>
        <p className="text-sm text-slate-600 mt-2">
          {reviews.length === 1
            ? "One classmate shared feedback on your work."
            : `${reviews.length} classmates shared feedback on your work.`}
        </p>
      </div>

      {/* Review cards */}
      <div className="space-y-4">
        {reviews.map((review, idx) => (
          <div
            key={review.id}
            className="rounded-2xl bg-white border border-slate-200 overflow-hidden hover:border-purple-300 transition-colors"
          >
            {/* Review header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {review.reviewerName || "A classmate"}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    {timeAgo(review.createdAt)}
                  </p>
                </div>
                <span className="text-2xl">💬</span>
              </div>
            </div>

            {/* Review content */}
            <div className="px-6 py-6">
              {reviewFormat === "comment" && (
                <div>
                  <p className="text-slate-700 leading-relaxed">
                    {typeof review.content.text === "string"
                      ? review.content.text
                      : "No comment provided"}
                  </p>
                </div>
              )}

              {reviewFormat === "pmi" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Plus */}
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-900 mb-2 flex items-center gap-1.5">
                      <span>➕</span> Plus
                    </h4>
                    <p className="text-sm text-green-800">
                      {typeof review.content.plus === "string" && review.content.plus
                        ? review.content.plus
                        : "—"}
                    </p>
                  </div>

                  {/* Minus */}
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-900 mb-2 flex items-center gap-1.5">
                      <span>➖</span> Minus
                    </h4>
                    <p className="text-sm text-red-800">
                      {typeof review.content.minus === "string" && review.content.minus
                        ? review.content.minus
                        : "—"}
                    </p>
                  </div>

                  {/* Interesting */}
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-1.5">
                      <span>🤔</span> Interesting
                    </h4>
                    <p className="text-sm text-purple-800">
                      {typeof review.content.interesting === "string" && review.content.interesting
                        ? review.content.interesting
                        : "—"}
                    </p>
                  </div>
                </div>
              )}

              {reviewFormat === "two-stars-wish" && (
                <div className="space-y-3">
                  {(typeof review.content.starOne === "string" && review.content.starOne) && (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm font-medium text-yellow-900 mb-1">⭐ Star</p>
                      <p className="text-sm text-yellow-800">{review.content.starOne}</p>
                    </div>
                  )}

                  {(typeof review.content.starTwo === "string" && review.content.starTwo) && (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm font-medium text-yellow-900 mb-1">⭐ Star</p>
                      <p className="text-sm text-yellow-800">{review.content.starTwo}</p>
                    </div>
                  )}

                  {(typeof review.content.wish === "string" && review.content.wish) && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900 mb-1">🌟 Wish</p>
                      <p className="text-sm text-blue-800">{review.content.wish}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats placeholder for future AI summarization */}
      {reviews.length >= 3 && (
        <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-4">
          <p className="text-sm text-indigo-900">
            <span className="font-medium">💡 Tip:</span> Look for patterns in the feedback. What themes do you notice? What's one specific thing you can improve next time?
          </p>
        </div>
      )}
    </div>
  );
}
