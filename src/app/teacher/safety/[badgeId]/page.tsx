"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Badge, QuestionPoolItem, LearningCard } from "@/types";

// ============================================================================
// SVG Icons (inline, no lucide-react)
// ============================================================================

const BackArrowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const EditIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L21 3z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ============================================================================
// Types
// ============================================================================

type TabType = "overview" | "questions" | "learn" | "results";

interface ResultsData {
  total_attempts: number;
  total_passed: number;
  average_score: number;
  results: Array<{
    student_id: string;
    student_name: string;
    score: number;
    attempt_number: number;
    time_taken_seconds: number | null;
    status: "active" | "expired" | "revoked";
    awarded_at: string;
  }>;
}

// ============================================================================
// Main Component
// ============================================================================

export default function BadgeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const badgeId = params?.badgeId as string;

  const [badge, setBadge] = useState<Badge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [results, setResults] = useState<ResultsData | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Fetch badge details on mount
  useEffect(() => {
    if (!badgeId) return;

    const fetchBadge = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/teacher/badges/${badgeId}`);
        if (!response.ok) {
          throw new Error("Failed to load badge");
        }

        const data = await response.json();
        setBadge(data.badge);
      } catch (err) {
        console.error("[BadgeDetailPage] Fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load badge");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBadge();
  }, [badgeId]);

  // Fetch results when results tab is clicked
  useEffect(() => {
    if (activeTab !== "results" || !badgeId) return;

    const fetchResults = async () => {
      try {
        setResultsLoading(true);
        const response = await fetch(`/api/teacher/badges/${badgeId}/results`);
        if (!response.ok) {
          throw new Error("Failed to load results");
        }

        const data = await response.json();
        setResults(data);
      } catch (err) {
        console.error("[BadgeDetailPage] Results fetch error:", err);
      } finally {
        setResultsLoading(false);
      }
    };

    fetchResults();
  }, [activeTab, badgeId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-200 rounded-lg w-1/3" />
            <div className="h-64 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !badge) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link
            href="/teacher/safety"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 font-medium"
          >
            <BackArrowIcon />
            Back to Badges
          </Link>
          <div className="bg-white border border-red-200 rounded-lg p-8 text-center">
            <p className="text-red-600 font-medium">
              {error || "Badge not found"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const passRate =
    results && results.total_attempts > 0
      ? Math.round((results.total_passed / results.total_attempts) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header / Back Link */}
        <div className="mb-6">
          <Link
            href="/teacher/safety"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium mb-4"
          >
            <BackArrowIcon />
            Back to Badges
          </Link>
        </div>

        {/* Badge Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 text-4xl"
                style={{ backgroundColor: `${badge.color}20` }}
              >
                {badge.icon_name}
              </div>

              {/* Title + Info */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {badge.name}
                  </h1>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    badge.category === "safety"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : badge.category === "skill"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-purple-50 border-purple-200 text-purple-700"
                  }`}>
                    {badge.category.charAt(0).toUpperCase() + badge.category.slice(1)}
                  </span>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                    Tier {badge.tier}
                  </span>
                </div>
                {badge.description && (
                  <p className="text-gray-600">{badge.description}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {badge.created_by_teacher_id && (
                <button
                  // Edit action would go here
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  <EditIcon />
                  Edit
                </button>
              )}
              <button
                onClick={() => setShowAssignModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                <PlusIcon />
                Assign
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 bg-white rounded-t-lg px-6">
          {(["overview", "questions", "learn", "results"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-4 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? "text-purple-600 border-b-2 border-purple-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Overview</h2>

              {/* Description */}
              {badge.description && (
                <div className="mb-8 pb-8 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </h3>
                  <p className="text-gray-600">{badge.description}</p>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Pass Threshold
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {badge.pass_threshold}%
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Questions
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {badge.question_count}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Retake Cooldown
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {badge.retake_cooldown_minutes}
                  </p>
                  <p className="text-xs text-gray-500">min</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Expiry
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {badge.expiry_months ? badge.expiry_months : "∞"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {badge.expiry_months ? "months" : "never"}
                  </p>
                </div>
              </div>

              {/* Topics */}
              {badge.topics && badge.topics.length > 0 && (
                <div className="mb-8 pb-8 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Topics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {badge.topics.map((topic) => (
                      <span
                        key={topic}
                        className="text-xs px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Preview */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Test Preview
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Sample questions from the test pool ({badge.question_pool.length} total):
                </p>

                <div className="space-y-4">
                  {badge.question_pool.slice(0, 3).map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-xs font-bold bg-purple-100 text-purple-700 rounded px-2 py-1 flex-shrink-0">
                          Q{idx + 1}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-gray-300 bg-white text-gray-600">
                          {q.type === "multiple_choice"
                            ? "Multiple Choice"
                            : q.type === "true_false"
                            ? "True/False"
                            : "Short Answer"}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-gray-900 mb-3">
                        {(q as any).prompt || q.text}
                      </p>

                      {q.options && q.options.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {q.options.map((option, optIdx) => (
                            <div
                              key={optIdx}
                              className={`text-sm px-3 py-2 rounded border ${
                                option === q.correct_answer
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                  : "bg-white border-gray-200 text-gray-700"
                              }`}
                            >
                              {option === q.correct_answer && (
                                <span className="font-semibold mr-2">✓</span>
                              )}
                              {option}
                            </div>
                          ))}
                        </div>
                      )}

                      {(q as any).explanation && (
                        <div className="text-xs text-gray-600 border-t border-gray-200 pt-3 mt-3">
                          <span className="font-semibold">Explanation: </span>
                          {(q as any).explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* QUESTIONS TAB */}
          {activeTab === "questions" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Questions</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {badge.question_count} questions in pool,
                    {Math.min(10, badge.question_count)} drawn per test
                  </p>
                </div>
                {badge.created_by_teacher_id && (
                  <button className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors">
                    <PlusIcon />
                    Add Question
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {badge.question_pool.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xs font-bold bg-gray-100 text-gray-700 rounded px-2 py-1 flex-shrink-0">
                        Q{idx + 1}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full border border-gray-300 bg-white text-gray-600">
                        {q.type === "multiple_choice"
                          ? "Multiple Choice"
                          : q.type === "true_false"
                          ? "True/False"
                          : "Short Answer"}
                      </span>
                      {(q as any).difficulty && (
                        <span className={`text-xs px-2 py-1 rounded-full border ${
                          (q as any).difficulty === "easy"
                            ? "bg-green-50 border-green-200 text-green-700"
                            : (q as any).difficulty === "medium"
                            ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                            : "bg-red-50 border-red-200 text-red-700"
                        }`}>
                          {(q as any).difficulty}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-gray-900 mb-3">
                      {(q as any).prompt || q.text}
                    </p>

                    {q.options && q.options.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {q.options.map((option, optIdx) => (
                          <div
                            key={optIdx}
                            className={`text-sm px-3 py-2 rounded border ${
                              option === q.correct_answer
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                : "bg-white border-gray-200 text-gray-700"
                            }`}
                          >
                            {option === q.correct_answer && (
                              <span className="font-semibold mr-2">✓</span>
                            )}
                            {option}
                          </div>
                        ))}
                      </div>
                    )}

                    {(q as any).explanation && (
                      <div className="text-xs text-gray-600 border-t border-gray-200 pt-3 mt-3">
                        <span className="font-semibold">Explanation: </span>
                        {(q as any).explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEARN CONTENT TAB */}
          {activeTab === "learn" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Learning Resources
              </h2>

              {badge.learn_content && badge.learn_content.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {badge.learn_content.map((card) => (
                    <div
                      key={card.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="text-3xl flex-shrink-0">{card.icon}</div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {card.title}
                        </h3>
                      </div>

                      <p className="text-sm text-gray-600 mb-4">
                        {card.description}
                      </p>

                      {card.tips && card.tips.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-700 mb-2">
                            Tips:
                          </p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {card.tips.map((tip, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="flex-shrink-0">•</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {card.examples && card.examples.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-2">
                            Examples:
                          </p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {card.examples.map((example, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="flex-shrink-0">•</span>
                                <span>{example}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">
                    No learning resources available for this badge yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* RESULTS TAB */}
          {activeTab === "results" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Results</h2>

              {resultsLoading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Loading results...</p>
                </div>
              ) : results && results.total_attempts > 0 ? (
                <div>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-blue-600 uppercase">
                        Total Attempts
                      </p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">
                        {results.total_attempts}
                      </p>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-emerald-600 uppercase">
                        Pass Rate
                      </p>
                      <p className="text-2xl font-bold text-emerald-900 mt-1">
                        {passRate}%
                      </p>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-purple-600 uppercase">
                        Average Score
                      </p>
                      <p className="text-2xl font-bold text-purple-900 mt-1">
                        {results.average_score.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Results Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">
                            Student
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">
                            Score
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">
                            Attempt
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">
                            Time
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.results.map((result, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-3 px-4 text-gray-900 font-medium">
                              {result.student_name}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                                  result.score >= badge.pass_threshold
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {result.score >= badge.pass_threshold && (
                                  <CheckCircleIcon />
                                )}
                                {result.score}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              #{result.attempt_number}
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {result.time_taken_seconds
                                ? `${Math.round(
                                    result.time_taken_seconds / 60
                                  )} min`
                                : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                                  result.status === "active"
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : result.status === "expired"
                                    ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                    : "bg-red-50 border-red-200 text-red-700"
                                }`}
                              >
                                {result.status.charAt(0).toUpperCase() +
                                  result.status.slice(1)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600 text-xs">
                              {new Date(result.awarded_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">
                    No students have taken this test yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal (placeholder) */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Assign Badge
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Assign this badge to a unit, class, or individual students.
            </p>

            <div className="space-y-3 mb-6">
              <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <p className="font-medium text-gray-900">Assign to Unit</p>
                <p className="text-xs text-gray-500">
                  Make available as a checkpoint in a unit
                </p>
              </button>

              <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <p className="font-medium text-gray-900">Grant to Students</p>
                <p className="text-xs text-gray-500">
                  Manually award badge to specific students
                </p>
              </button>
            </div>

            <button
              onClick={() => setShowAssignModal(false)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
