"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { checkClientSide, MODERATION_MESSAGES, detectLanguage } from "@/lib/content-safety/client-filter";

interface GalleryRound {
  id: string;
  title: string;
  description: string;
  pageIds: string[];
  reviewFormat: "comment" | "pmi" | "two-stars-wish";
  deadline?: string;
}

interface GallerySubmitPromptProps {
  round: GalleryRound;
  onSubmit: () => void;
  pageNames?: Record<string, string>; // pageId -> page title
}

export function GallerySubmitPrompt({
  round,
  onSubmit,
  pageNames = {},
}: GallerySubmitPromptProps) {
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!context.trim()) {
      setError("Please share something about your work");
      return;
    }

    // Content safety check — block before submission
    const moderationCheck = checkClientSide(context);
    if (!moderationCheck.ok) {
      const lang = detectLanguage(context);
      setError(MODERATION_MESSAGES[lang === "zh" ? "zh" : "en"]);
      fetch("/api/safety/log-client-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "gallery_post",
          flags: moderationCheck.flags,
          snippet: context.slice(0, 200),
        }),
      }).catch(() => {});
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/student/gallery/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          contextNote: context,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit work");
      }

      setSubmitted(true);
      setContext("");
      setTimeout(() => onSubmit(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-8 text-center">
        <div className="mb-3 flex justify-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Work shared!</h3>
        <p className="text-slate-600">Your classmates will see your submission soon.</p>
      </div>
    );
  }

  const pageList = round.pageIds
    .map((id) => pageNames[id] || `Page ${id.slice(0, 8)}`)
    .join(", ");

  const isDeadlineApproaching = round.deadline
    ? new Date(round.deadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : false;

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
      {/* Gradient header with gallery icon */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-4 flex items-center gap-3">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div>
          <h3 className="font-semibold text-white">{round.title}</h3>
          <p className="text-purple-100 text-sm">{round.description}</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* What to share section */}
        <div>
          <h4 className="font-medium text-slate-900 mb-2">What to share</h4>
          <p className="text-slate-600 text-sm mb-3">Pages from your work:</p>
          <div className="flex flex-wrap gap-2">
            {round.pageIds.map((pageId) => (
              <div
                key={pageId}
                className="inline-flex items-center px-3 py-1.5 bg-slate-100 rounded-full text-slate-700 text-sm"
              >
                <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                {pageNames[pageId] || `Page ${pageId.slice(0, 8)}`}
              </div>
            ))}
          </div>
        </div>

        {/* Context textarea */}
        <div>
          <label htmlFor="context" className="block font-medium text-slate-900 mb-2">
            Share your context (optional)
          </label>
          <p className="text-slate-600 text-sm mb-2">
            Tell your classmates what feedback you're looking for or what's interesting about your work.
          </p>
          <textarea
            id="context"
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              setError(null);
            }}
            placeholder="E.g., I'm stuck on the handle design • I tried a new colour palette • Feedback on my details please"
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none"
            rows={3}
          />
          {error && (
            <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
              <span>⚠</span> {error}
            </p>
          )}
        </div>

        {/* Deadline display */}
        {round.deadline && (
          <div className={`rounded-lg p-3 text-sm ${
            isDeadlineApproaching
              ? "bg-amber-50 border border-amber-200 text-amber-900"
              : "bg-slate-50 border border-slate-200 text-slate-700"
          }`}>
            <span className="font-medium">
              {isDeadlineApproaching ? "📍 Deadline approaching: " : "📅 Deadline: "}
            </span>
            {formatDate(round.deadline)}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !context.trim()}
          className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-r-transparent rounded-full animate-spin"></span>
              Sharing your work…
            </span>
          ) : (
            "Share to Gallery"
          )}
        </button>
      </div>
    </div>
  );
}
