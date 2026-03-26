"use client";

import { useState, useEffect } from "react";

/**
 * ClassProfileOverview — Teacher view of aggregated student learning profiles.
 *
 * Shows at-a-glance class composition: language diversity, design confidence
 * distribution, working style preferences, learning differences, and TCK count.
 * Helps teachers plan lessons and differentiation.
 *
 * Research basis: docs/research/student-influence-factors.md
 * - Self-efficacy (d=0.92): confidence distribution tells teacher where to scaffold
 * - Language proficiency (d=moderate): multilingual count drives ELL planning
 * - Collectivist/individualist (d=0.35): working style split informs group/solo balance
 * - Learning differences: UDL accommodation planning
 */

interface ClassProfileOverviewProps {
  classId: string;
}

interface ProfileSummary {
  total: number;
  profilesCompleted: number;
  languages: Record<string, number>;
  confidenceDistribution: number[];
  workingStyles: Record<string, number>;
  feedbackPreferences: Record<string, number>;
  learningDifferences: Record<string, number>;
  multilingual: number;
  tck: number;
}

interface StudentProfile {
  id: string;
  name: string;
  ell_level: string;
  profile: {
    languages_at_home?: string[];
    countries_lived_in?: string[];
    design_confidence?: number;
    working_style?: string;
    feedback_preference?: string;
    learning_differences?: string[];
  } | null;
}

const CONFIDENCE_LABELS = ["Nervous", "Unsure", "Getting there", "Confident", "Loves it"];
const CONFIDENCE_COLORS = ["#EF4444", "#F59E0B", "#EAB308", "#10B981", "#7B2FF2"];
const CONFIDENCE_EMOJIS = ["😰", "😬", "🙂", "😊", "🤩"];

const WORKING_STYLE_LABELS: Record<string, string> = {
  solo: "Solo",
  partner: "Partner",
  small_group: "Group",
};

const DIFF_LABELS: Record<string, string> = {
  adhd: "ADHD",
  dyslexia: "Dyslexia",
  dyscalculia: "Dyscalculia",
  autism: "Autism/ASD",
  anxiety: "Anxiety",
  other: "Other",
};

export function ClassProfileOverview({ classId }: ClassProfileOverviewProps) {
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/teacher/class-profiles?classId=${classId}`);
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary);
          setStudents(data.students);
        }
      } catch (err) {
        console.error("[ClassProfileOverview] Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-48 mb-3" />
        <div className="h-20 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500">No students enrolled yet</p>
      </div>
    );
  }

  const completionPct = Math.round((summary.profilesCompleted / summary.total) * 100);

  // Top 5 languages
  const topLanguages = Object.entries(summary.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">👤</span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">Student Profiles</h3>
            <p className="text-xs text-gray-500">
              {summary.profilesCompleted}/{summary.total} completed · {summary.multilingual} multilingual · {summary.tck} TCK
            </p>
          </div>
        </div>
        <span className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {/* Compact summary — always visible */}
      <div className="px-5 py-3 border-t border-gray-100">
        {/* Completion bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${completionPct}%`,
                background: completionPct === 100 ? "#10B981" : "linear-gradient(90deg, #7B2FF2, #a855f7)",
              }}
            />
          </div>
          <span className="text-xs text-gray-400">{completionPct}%</span>
        </div>

        {/* Confidence distribution — horizontal bar */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1.5">Design Confidence</p>
          <div className="flex h-6 rounded-lg overflow-hidden">
            {summary.confidenceDistribution.map((count, i) => {
              if (count === 0) return null;
              const pct = (count / summary.profilesCompleted) * 100;
              return (
                <div
                  key={i}
                  className="flex items-center justify-center text-white text-[10px] font-bold transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: CONFIDENCE_COLORS[i],
                    minWidth: count > 0 ? 24 : 0,
                  }}
                  title={`${CONFIDENCE_LABELS[i]}: ${count} student${count !== 1 ? "s" : ""}`}
                >
                  {CONFIDENCE_EMOJIS[i]} {count}
                </div>
              );
            })}
            {summary.profilesCompleted === 0 && (
              <div className="flex-1 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                No data yet
              </div>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="flex gap-3 text-xs">
          {/* Working styles */}
          <div className="flex gap-1.5">
            {Object.entries(summary.workingStyles).map(([style, count]) => (
              count > 0 && (
                <span
                  key={style}
                  className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700"
                >
                  {WORKING_STYLE_LABELS[style]} {count}
                </span>
              )
            ))}
          </div>

          {/* Feedback split */}
          <div className="flex gap-1.5">
            {summary.feedbackPreferences.private > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                🔒 {summary.feedbackPreferences.private}
              </span>
            )}
            {summary.feedbackPreferences.public > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                💬 {summary.feedbackPreferences.public}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Languages */}
          {topLanguages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Languages Spoken at Home</p>
              <div className="flex flex-wrap gap-1.5">
                {topLanguages.map(([lang, count]) => (
                  <span
                    key={lang}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-purple-50 text-purple-700"
                  >
                    {lang} <span className="text-purple-400 font-medium">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Learning differences (sensitive — show counts only, not per-student) */}
          {Object.keys(summary.learningDifferences).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">
                Learning Differences <span className="text-gray-400">(self-disclosed, confidential)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(summary.learningDifferences).map(([diff, count]) => (
                  <span
                    key={diff}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-pink-50 text-pink-700"
                  >
                    {DIFF_LABELS[diff] || diff} <span className="text-pink-400 font-medium">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Per-student table */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Individual Profiles</p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Student</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Languages</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Confidence</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Style</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {s.profile?.languages_at_home?.join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.profile?.design_confidence
                          ? CONFIDENCE_EMOJIS[(s.profile.design_confidence as number) - 1]
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.profile?.working_style
                          ? WORKING_STYLE_LABELS[s.profile.working_style] || s.profile.working_style
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.profile?.feedback_preference === "private" ? "🔒" : s.profile?.feedback_preference === "public" ? "💬" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
