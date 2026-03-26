"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock } from "lucide-react";
import type { GalleryRound, GallerySubmission, GalleryReview } from "@/types";

interface GalleryMonitorProps {
  roundId: string;
  onClose?: () => void;
}

interface SubmissionWithStats {
  id: string;
  student_id: string;
  student_name: string;
  context_note: string;
  created_at: string;
  review_count: number;
  is_complete: boolean;
}

interface MonitorData {
  round: GalleryRound;
  submissions: SubmissionWithStats[];
  totalStudents: number;
  submissionCount: number;
  reviewCompletionCount: number;
}

export function GalleryMonitor({ roundId, onClose }: GalleryMonitorProps) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [submissionDetails, setSubmissionDetails] = useState<Record<string, unknown>>({});
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`/api/teacher/gallery/${roundId}`);
        if (!res.ok) {
          throw new Error("Failed to load gallery round");
        }
        const result = await res.json();
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roundId]);

  const handleCloseRound = async () => {
    if (!data) return;

    setClosing(true);
    try {
      const res = await fetch(`/api/teacher/gallery/${roundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      if (!res.ok) {
        throw new Error("Failed to close round");
      }

      if (data) {
        setData({ ...data, round: { ...data.round, status: "closed" } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close round");
    } finally {
      setClosing(false);
    }
  };

  const toggleStudentExpand = async (studentId: string) => {
    if (expandedStudent === studentId) {
      setExpandedStudent(null);
    } else {
      setExpandedStudent(studentId);
      // Load detailed submission info if not already loaded
      if (!submissionDetails[studentId]) {
        try {
          const res = await fetch(`/api/teacher/gallery/${roundId}?studentId=${studentId}`);
          if (res.ok) {
            const result = await res.json();
            setSubmissionDetails((prev) => ({
              ...prev,
              [studentId]: result.details,
            }));
          }
        } catch (err) {
          console.error("Failed to load submission details:", err);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
        <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-semibold text-red-900">Error Loading Gallery</h3>
          <p className="text-sm text-red-800 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
        <p className="text-gray-600">Gallery round not found</p>
      </div>
    );
  }

  const { round, submissions, totalStudents, submissionCount, reviewCompletionCount } = data;
  const submissionRate = totalStudents > 0 ? Math.round((submissionCount / totalStudents) * 100) : 0;
  const reviewRate =
    totalStudents > 0 ? Math.round((reviewCompletionCount / totalStudents) * 100) : 0;

  const averageReviewsPerSubmission =
    submissionCount > 0
      ? (submissions.reduce((sum, s) => sum + s.review_count, 0) / submissionCount).toFixed(1)
      : "0";

  const statusColor =
    round.status === "open"
      ? "bg-green-100 text-green-800 border-green-300"
      : "bg-gray-100 text-gray-800 border-gray-300";
  const statusLabel = round.status === "open" ? "Open" : "Closed";

  const deadlineInfo =
    round.deadline && new Date(round.deadline) > new Date()
      ? `Due ${new Date(round.deadline).toLocaleDateString()}`
      : null;

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 border-b border-purple-500">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{round.title}</h2>
            {round.description && <p className="text-purple-100 text-sm mt-1">{round.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColor}`}>
              {statusLabel}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-purple-100 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-200">
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <p className="text-xs text-gray-600 font-medium mb-1">SUBMISSIONS</p>
          <p className="text-2xl font-bold text-purple-600">
            {submissionCount}/{totalStudents}
          </p>
          <p className="text-xs text-gray-500 mt-1">{submissionRate}%</p>
        </div>

        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <p className="text-xs text-gray-600 font-medium mb-1">REVIEWS COMPLETE</p>
          <p className="text-2xl font-bold text-blue-600">
            {reviewCompletionCount}/{totalStudents}
          </p>
          <p className="text-xs text-gray-500 mt-1">{reviewRate}%</p>
        </div>

        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <p className="text-xs text-gray-600 font-medium mb-1">AVG REVIEWS PER WORK</p>
          <p className="text-2xl font-bold text-emerald-600">{averageReviewsPerSubmission}</p>
          <p className="text-xs text-gray-500 mt-1">min: {round.min_reviews}</p>
        </div>

        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          {deadlineInfo ? (
            <>
              <p className="text-xs text-gray-600 font-medium mb-1">DEADLINE</p>
              <p className="text-sm font-medium text-gray-900">{deadlineInfo}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-600 font-medium mb-1">FORMAT</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{round.review_format}</p>
            </>
          )}
        </div>
      </div>

      {/* Per-Student Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">STUDENT</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">SUBMITTED</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                REVIEWS GIVEN
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                REVIEWS RECEIVED
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission, idx) => (
              <tr
                key={submission.student_id}
                className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                  idx % 2 === 1 ? "bg-gray-50" : "bg-white"
                }`}
                onClick={() => toggleStudentExpand(submission.student_id)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-medium flex items-center justify-center text-xs">
                      {submission.student_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{submission.student_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <CheckCircle size={20} className="mx-auto text-green-600" />
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {submission.review_count}/{round.min_reviews}
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-gray-700">
                  <span className="font-medium">
                    {submissions.reduce((sum, s) => (s.student_id === submission.student_id ? sum + 1 : sum), 0)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {submission.is_complete ? (
                    <span className="inline-block px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      Complete
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                      In Progress
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
        <button
          onClick={handleCloseRound}
          disabled={closing || round.status === "closed"}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
        >
          {closing ? "Closing..." : "Close Round"}
        </button>
        <button
          disabled
          className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed font-medium"
        >
          Remind Students
        </button>
      </div>
    </div>
  );
}
