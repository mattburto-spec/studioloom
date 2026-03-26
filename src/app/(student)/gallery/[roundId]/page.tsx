"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useStudent } from "../../student-context";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { GallerySubmitPrompt } from "@/components/gallery/GallerySubmitPrompt";
import { GalleryFeedbackView } from "@/components/gallery/GalleryFeedbackView";

// ---------------------------------------------------------------------------
// Student Gallery Page — /gallery/[roundId]
// 3 modes: submit → browse & review → view feedback
// ---------------------------------------------------------------------------

type GalleryMode = "submit" | "browse" | "feedback";

interface RoundInfo {
  id: string;
  title: string;
  description: string;
  pageIds: string[];
  reviewFormat: "comment" | "pmi" | "two-stars-wish";
  minReviews: number;
  anonymous: boolean;
  status: string;
  deadline: string | null;
  hasSubmitted: boolean;
  reviewsCompleted: number;
  totalSubmissions: number;
}

export default function StudentGalleryPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = use(params);
  const { student } = useStudent();
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GalleryMode>("submit");

  useEffect(() => {
    async function loadRound() {
      try {
        const res = await fetch(`/api/student/gallery/rounds`);
        if (!res.ok) throw new Error("Failed to load gallery rounds");
        const data = await res.json();
        const rounds = Array.isArray(data) ? data : data.rounds || [];
        const found = rounds.find((r: any) => r.id === roundId);
        if (!found) {
          setError("Gallery round not found or not available.");
          return;
        }
        setRound(found);

        // Determine initial mode
        if (!found.hasSubmitted) {
          setMode("submit");
        } else if (found.reviewsCompleted < found.minReviews) {
          setMode("browse");
        } else {
          setMode("feedback");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadRound();
  }, [roundId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="h-12 w-64 bg-gray-200 rounded-xl animate-pulse mb-6" />
          <div className="h-96 bg-gray-200 rounded-2xl animate-pulse" />
        </div>
      </main>
    );
  }

  if (error || !round) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-900 font-semibold text-lg mb-2">{error || "Gallery not found"}</p>
          <Link href="/dashboard" className="text-purple-600 hover:underline text-sm">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Dashboard
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-bold text-gray-900">{round.title}</h1>
          {round.status === "closed" && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">Closed</span>
          )}
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
          <button
            onClick={() => round.hasSubmitted ? null : setMode("submit")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
              mode === "submit"
                ? "bg-white text-purple-700 shadow-sm"
                : round.hasSubmitted
                ? "text-green-600 cursor-default"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {round.hasSubmitted ? "✓ Submitted" : "1. Share"}
          </button>
          <button
            onClick={() => round.hasSubmitted ? setMode("browse") : null}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
              mode === "browse"
                ? "bg-white text-purple-700 shadow-sm"
                : !round.hasSubmitted
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-500 hover:text-gray-700"
            }`}
            disabled={!round.hasSubmitted}
          >
            2. Review ({round.reviewsCompleted}/{round.minReviews})
          </button>
          <button
            onClick={() => round.reviewsCompleted >= round.minReviews ? setMode("feedback") : null}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
              mode === "feedback"
                ? "bg-white text-purple-700 shadow-sm"
                : round.reviewsCompleted < round.minReviews
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-500 hover:text-gray-700"
            }`}
            disabled={round.reviewsCompleted < round.minReviews}
          >
            3. Feedback {round.reviewsCompleted < round.minReviews ? "🔒" : ""}
          </button>
        </div>

        {/* Content */}
        {mode === "submit" && !round.hasSubmitted && (
          <GallerySubmitPrompt
            round={{ id: round.id, title: round.title, description: round.description, pageIds: round.pageIds, reviewFormat: round.reviewFormat, deadline: round.deadline || undefined }}
            onSubmit={() => {
              setRound({ ...round, hasSubmitted: true });
              setMode("browse");
            }}
          />
        )}

        {mode === "submit" && round.hasSubmitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-green-800 font-semibold text-lg mb-2">Work shared!</p>
            <p className="text-green-600 text-sm mb-4">Now review your classmates&apos; work to unlock your feedback.</p>
            <button
              onClick={() => setMode("browse")}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
            >
              Start Reviewing
            </button>
          </div>
        )}

        {mode === "browse" && (
          <GalleryBrowser
            roundId={roundId}
            reviewFormat={round.reviewFormat}
            minReviews={round.minReviews}
            anonymous={round.anonymous}
          />
        )}

        {mode === "feedback" && (
          <GalleryFeedbackView roundId={roundId} reviewFormat={round.reviewFormat} />
        )}
      </div>
    </main>
  );
}
