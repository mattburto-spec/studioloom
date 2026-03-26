"use client";

import { useState, useEffect, useCallback } from "react";

interface Submission {
  id: string;
  studentId: string;
  studentName: string | null;
  contextNote: string | null;
  content: Record<string, unknown>; // Serialized student responses from lesson pages
  submittedAt: string;
}

interface Review {
  id: string;
  submissionId: string;
  content: Record<string, unknown>;
  createdAt: string;
}

interface GalleryBrowserProps {
  roundId: string;
  reviewFormat: "comment" | "pmi" | "two-stars-wish";
  minReviews: number;
  anonymous: boolean;
}

const sentenceStarters: Record<string, string[]> = {
  comment: [
    "I notice that…",
    "Have you considered…",
    "One strength is…",
    "A suggestion would be…",
    "I wonder if…",
    "This connects to…",
  ],
  pmi_plus: [
    "This works well because…",
    "A benefit is…",
    "This is good for…",
  ],
  pmi_minus: [
    "A challenge might be…",
    "This could fail if…",
    "A risk is…",
  ],
  pmi_interesting: [
    "It's interesting that…",
    "I notice the connection to…",
    "This could lead to…",
  ],
  two_stars: [
    "I appreciated how you…",
    "The strength here is…",
    "You did well with…",
  ],
  two_wish: [
    "Next time, you could…",
    "I'd love to see you…",
    "Consider trying…",
  ],
};

export function GalleryBrowser({
  roundId,
  reviewFormat,
  minReviews,
  anonymous,
}: GalleryBrowserProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedSet, setReviewedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Review form state
  const [commentText, setCommentText] = useState("");
  const [pmiPlus, setPmiPlus] = useState("");
  const [pmiMinus, setPmiMinus] = useState("");
  const [pmiInteresting, setPmiInteresting] = useState("");
  const [twoStarOne, setTwoStarOne] = useState("");
  const [twoStarTwo, setTwoStarTwo] = useState("");
  const [twoWish, setTwoWish] = useState("");

  // Load submissions
  useEffect(() => {
    const loadSubmissions = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/student/gallery/submissions?roundId=${roundId}`);
        if (!res.ok) throw new Error("Failed to load submissions");
        const data = await res.json();
        setSubmissions(data.submissions || []);

        // Load review history to mark already-reviewed
        const reviewRes = await fetch(`/api/student/gallery/review-history?roundId=${roundId}`);
        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          setReviewedSet(new Set(reviewData.reviewedSubmissionIds || []));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load submissions");
      } finally {
        setLoading(false);
      }
    };

    loadSubmissions();
  }, [roundId]);

  const resetForm = useCallback(() => {
    setCommentText("");
    setPmiPlus("");
    setPmiMinus("");
    setPmiInteresting("");
    setTwoStarOne("");
    setTwoStarTwo("");
    setTwoWish("");
  }, []);

  const handleSubmitReview = async () => {
    const currentSubmission = submissions[currentIndex];
    if (!currentSubmission) return;

    // Basic validation
    let hasContent = false;
    if (reviewFormat === "comment") {
      if (!commentText.trim()) {
        setError("Please write your comment");
        return;
      }
      hasContent = !!commentText.trim();
    } else if (reviewFormat === "pmi") {
      hasContent = !!(pmiPlus.trim() || pmiMinus.trim() || pmiInteresting.trim());
      if (!hasContent) {
        setError("Please add at least one PMI note");
        return;
      }
    } else if (reviewFormat === "two-stars-wish") {
      hasContent = !!(twoStarOne.trim() || twoStarTwo.trim() || twoWish.trim());
      if (!hasContent) {
        setError("Please add at least one star or wish");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      let reviewContent: Record<string, unknown> = {};

      if (reviewFormat === "comment") {
        reviewContent = { text: commentText.trim() };
      } else if (reviewFormat === "pmi") {
        reviewContent = {
          plus: pmiPlus.trim(),
          minus: pmiMinus.trim(),
          interesting: pmiInteresting.trim(),
        };
      } else if (reviewFormat === "two-stars-wish") {
        reviewContent = {
          starOne: twoStarOne.trim(),
          starTwo: twoStarTwo.trim(),
          wish: twoWish.trim(),
        };
      }

      const res = await fetch("/api/student/gallery/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          submissionId: currentSubmission.id,
          content: reviewContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }

      // Mark as reviewed
      const newReviewedSet = new Set(reviewedSet);
      newReviewedSet.add(currentSubmission.id);
      setReviewedSet(newReviewedSet);

      resetForm();

      // Auto-advance to next unreviewed submission
      let nextIndex = currentIndex + 1;
      while (
        nextIndex < submissions.length &&
        newReviewedSet.has(submissions[nextIndex].id)
      ) {
        nextIndex++;
      }

      if (nextIndex < submissions.length) {
        setCurrentIndex(nextIndex);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    let nextIndex = currentIndex + 1;
    while (
      nextIndex < submissions.length &&
      reviewedSet.has(submissions[nextIndex].id)
    ) {
      nextIndex++;
    }
    if (nextIndex < submissions.length) {
      setCurrentIndex(nextIndex);
      resetForm();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetForm();
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center">
        <div className="inline-block w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3"></div>
        <p className="text-slate-600">Loading submissions…</p>
      </div>
    );
  }

  if (error && !submissions.length) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center">
        <p className="text-red-700 font-medium mb-2">Something went wrong</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center">
        <p className="text-slate-600 font-medium mb-1">No submissions yet</p>
        <p className="text-slate-500 text-sm">Come back later to review your classmates' work.</p>
      </div>
    );
  }

  const currentSubmission = submissions[currentIndex];
  const unreviewed = submissions.filter((s) => !reviewedSet.has(s.id));
  const allReviewsCompleted = unreviewed.length === 0;
  const canSubmitReview = !allReviewsCompleted && currentSubmission && !reviewedSet.has(currentSubmission.id);

  const progressPercent = submissions.length > 0
    ? Math.round((reviewedSet.size / submissions.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-900">
            {reviewedSet.size}/{submissions.length} Reviews Completed
          </h3>
          {minReviews > reviewedSet.size && (
            <span className="text-sm text-slate-600">
              {minReviews - reviewedSet.size} more needed
            </span>
          )}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {allReviewsCompleted ? (
        // All reviews done
        <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-8 text-center">
          <div className="mb-3 flex justify-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Reviews complete!</h3>
          <p className="text-slate-600 text-sm">You've reviewed all submissions. Check back for feedback on your own work.</p>
        </div>
      ) : (
        // Submission viewer + review form
        <div className="space-y-6">
          {/* Submission card */}
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-900">
                    {anonymous ? "A classmate's work" : currentSubmission?.studentName || "Anonymous"}
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Submitted {new Date(currentSubmission?.submittedAt || "").toLocaleDateString()}
                  </p>
                </div>
                {reviewedSet.has(currentSubmission?.id || "") && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <span>✓</span> Already reviewed
                  </div>
                )}
              </div>
            </div>

            {/* Context note if present */}
            {currentSubmission?.contextNote && (
              <div className="px-6 py-4 bg-blue-50 border-b border-slate-200">
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Their context:</span> "{currentSubmission.contextNote}"
                </p>
              </div>
            )}

            {/* Submission content preview */}
            <div className="px-6 py-6 max-h-96 overflow-y-auto">
              <div className="prose prose-sm max-w-none text-slate-700">
                <p className="text-sm text-slate-600 mb-3 italic">Student responses from the gallery pages:</p>
                <pre className="bg-slate-100 p-3 rounded-lg text-xs overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                  {JSON.stringify(currentSubmission?.content, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Review form */}
          {canSubmitReview && (
            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <h4 className="font-medium text-slate-900 mb-4">Your feedback</h4>

              {reviewFormat === "comment" && (
                <div>
                  <label htmlFor="review-comment" className="block text-sm font-medium text-slate-700 mb-2">
                    Comment
                  </label>
                  <p className="text-xs text-slate-600 mb-3">Start with one of these:</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {sentenceStarters.comment.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => setCommentText(starter)}
                        className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="review-comment"
                    value={commentText}
                    onChange={(e) => {
                      setCommentText(e.target.value);
                      setError(null);
                    }}
                    placeholder="Write your comment here…"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none"
                    rows={4}
                  />
                </div>
              )}

              {reviewFormat === "pmi" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Plus */}
                  <div>
                    <label htmlFor="review-plus" className="block text-sm font-medium text-green-700 mb-2">
                      ➕ Plus
                    </label>
                    <p className="text-xs text-slate-600 mb-2">Benefits & strengths:</p>
                    <textarea
                      id="review-plus"
                      value={pmiPlus}
                      onChange={(e) => {
                        setPmiPlus(e.target.value);
                        setError(null);
                      }}
                      placeholder="This works well because…"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none text-sm"
                      rows={3}
                    />
                  </div>

                  {/* Minus */}
                  <div>
                    <label htmlFor="review-minus" className="block text-sm font-medium text-red-700 mb-2">
                      ➖ Minus
                    </label>
                    <p className="text-xs text-slate-600 mb-2">Challenges & risks:</p>
                    <textarea
                      id="review-minus"
                      value={pmiMinus}
                      onChange={(e) => {
                        setPmiMinus(e.target.value);
                        setError(null);
                      }}
                      placeholder="A challenge might be…"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none text-sm"
                      rows={3}
                    />
                  </div>

                  {/* Interesting */}
                  <div>
                    <label htmlFor="review-interesting" className="block text-sm font-medium text-purple-700 mb-2">
                      🤔 Interesting
                    </label>
                    <p className="text-xs text-slate-600 mb-2">Observations & possibilities:</p>
                    <textarea
                      id="review-interesting"
                      value={pmiInteresting}
                      onChange={(e) => {
                        setPmiInteresting(e.target.value);
                        setError(null);
                      }}
                      placeholder="It's interesting that…"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {reviewFormat === "two-stars-wish" && (
                <div className="space-y-4">
                  {/* Star 1 */}
                  <div>
                    <label htmlFor="review-star1" className="block text-sm font-medium text-yellow-700 mb-2">
                      ⭐ First Star
                    </label>
                    <p className="text-xs text-slate-600 mb-2">A strength you noticed:</p>
                    <textarea
                      id="review-star1"
                      value={twoStarOne}
                      onChange={(e) => {
                        setTwoStarOne(e.target.value);
                        setError(null);
                      }}
                      placeholder="I appreciated how you…"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none text-sm"
                      rows={2}
                    />
                  </div>

                  {/* Star 2 */}
                  <div>
                    <label htmlFor="review-star2" className="block text-sm font-medium text-yellow-700 mb-2">
                      ⭐ Second Star
                    </label>
                    <p className="text-xs text-slate-600 mb-2">Another strength:</p>
                    <textarea
                      id="review-star2"
                      value={twoStarTwo}
                      onChange={(e) => {
                        setTwoStarTwo(e.target.value);
                        setError(null);
                      }}
                      placeholder="You did well with…"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none text-sm"
                      rows={2}
                    />
                  </div>

                  {/* Wish */}
                  <div>
                    <label htmlFor="review-wish" className="block text-sm font-medium text-blue-700 mb-2">
                      🌟 Wish
                    </label>
                    <p className="text-xs text-slate-600 mb-2">Something to work toward:</p>
                    <textarea
                      id="review-wish"
                      value={twoWish}
                      onChange={(e) => {
                        setTwoWish(e.target.value);
                        setError(null);
                      }}
                      placeholder="Next time, you could…"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none text-sm"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-red-600 text-sm mt-4 flex items-center gap-1">
                  <span>⚠</span> {error}
                </p>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmitReview}
                disabled={submitting}
                className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-r-transparent rounded-full animate-spin"></span>
                    Submitting…
                  </span>
                ) : (
                  "Submit Review"
                )}
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              ← Previous
            </button>

            <span className="text-sm text-slate-600">
              {currentIndex + 1} of {submissions.length}
            </span>

            <button
              onClick={handleNext}
              disabled={currentIndex >= submissions.length - 1}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
