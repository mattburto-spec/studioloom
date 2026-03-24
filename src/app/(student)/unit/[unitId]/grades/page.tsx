"use client";

import { useState, useEffect, use } from "react";
import { useStudent } from "@/app/(student)/student-context";
import { CRITERIA, type CriterionKey } from "@/lib/constants";

interface CriterionScore {
  criterion_key: string;
  level: number;
  comment?: string;
  tags?: string[];
}

interface AssessmentData {
  criterion_scores?: Record<string, CriterionScore>;
  overall_grade?: number;
  teacher_comments?: string;
  strengths?: string[];
  areas_for_improvement?: string[];
  targets?: string[];
  is_draft?: boolean;
}

const CRITERION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  B: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  C: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  D: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

export default function StudentGradesPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = use(params);
  const student = useStudent();
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [unitTitle, setUnitTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGrades() {
      try {
        const res = await fetch(
          `/api/student/grades?unitId=${encodeURIComponent(unitId)}`
        );
        if (res.ok) {
          const data = await res.json();
          setAssessment(data.assessment);
          setUnitTitle(data.unitTitle || "");
        }
      } catch (err) {
        console.error("Failed to load grades:", err);
      } finally {
        setLoading(false);
      }
    }
    loadGrades();
  }, [unitId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  // No grades yet
  if (!assessment || assessment.is_draft) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">My Grades</h1>
        {unitTitle && (
          <p className="text-sm text-gray-500 mb-8">{unitTitle}</p>
        )}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-lg font-medium text-gray-700 mb-2">
            No grades published yet
          </h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Your teacher hasn&apos;t published grades for this unit yet. Keep working on your lessons — grades will appear here once they&apos;re ready.
          </p>
        </div>
      </div>
    );
  }

  const scores = assessment.criterion_scores || {};
  const criteriaKeys = Object.keys(CRITERIA) as CriterionKey[];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">My Grades</h1>
      {unitTitle && (
        <p className="text-sm text-gray-500 mb-6">{unitTitle}</p>
      )}

      {/* Overall grade */}
      {assessment.overall_grade && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 text-center">
          <div className="text-sm text-gray-500 mb-1">Overall Grade</div>
          <div className="text-4xl font-bold text-indigo-600">
            {assessment.overall_grade}
          </div>
        </div>
      )}

      {/* Criterion scores */}
      <div className="space-y-3 mb-6">
        {criteriaKeys.map((key) => {
          const score = scores[key];
          const colors = CRITERION_COLORS[key] || CRITERION_COLORS.A;
          const criterion = CRITERIA[key];

          return (
            <div
              key={key}
              className={`${colors.bg} border ${colors.border} rounded-xl p-4`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`text-sm font-semibold ${colors.text}`}>
                  Criterion {key}: {criterion?.label || key}
                </div>
                {score ? (
                  <div
                    className={`text-lg font-bold ${colors.text}`}
                  >
                    {score.level}/8
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">—</div>
                )}
              </div>
              {score?.comment && (
                <p className="text-sm text-gray-600 mt-2">{score.comment}</p>
              )}
              {score?.tags && score.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {score.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Teacher comments */}
      {assessment.teacher_comments && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Teacher Comments
          </h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {assessment.teacher_comments}
          </p>
        </div>
      )}

      {/* Strengths */}
      {assessment.strengths && assessment.strengths.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-emerald-700 mb-2">
            Strengths
          </h3>
          <ul className="text-sm text-emerald-800 space-y-1">
            {assessment.strengths.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas for improvement */}
      {assessment.areas_for_improvement &&
        assessment.areas_for_improvement.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-amber-700 mb-2">
              Areas to Develop
            </h3>
            <ul className="text-sm text-amber-800 space-y-1">
              {assessment.areas_for_improvement.map((a, i) => (
                <li key={i}>• {a}</li>
              ))}
            </ul>
          </div>
        )}

      {/* Targets */}
      {assessment.targets && assessment.targets.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">
            Targets
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            {assessment.targets.map((t, i) => (
              <li key={i}>→ {t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}