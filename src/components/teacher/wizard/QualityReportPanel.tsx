"use client";

import { useState } from "react";
import type { QualityReport, PrincipleScore } from "@/types/lesson-intelligence";

interface Props {
  report: QualityReport;
}

const PRINCIPLE_LABELS: Record<string, string> = {
  iteration: "Iteration & Improvement",
  productive_failure: "Productive Failure",
  diverge_converge: "Diverge → Converge",
  scaffolding_fade: "Scaffolding Fade",
  process_assessment: "Process Assessment",
  critique_culture: "Critique Culture",
  digital_physical_balance: "Digital/Physical Balance",
  differentiation: "Differentiation",
  metacognitive_framing: "Metacognitive Framing",
  safety_culture: "Safety Culture",
};

function getScoreColor(score: number): string {
  if (score >= 75) return "text-accent-green";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function getScoreBg(score: number): string {
  if (score >= 75) return "bg-accent-green/10 border-accent-green/30";
  if (score >= 50) return "bg-amber-500/10 border-amber-500/30";
  return "bg-red-500/10 border-red-500/30";
}

function getScoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Needs Work";
  return "Weak";
}

function PrincipleBar({ principle }: { principle: PrincipleScore }) {
  const pct = principle.score * 10; // 0-10 → 0-100
  const label = PRINCIPLE_LABELS[principle.principle] || principle.principle;
  const barColor = pct >= 70 ? "bg-accent-green" : pct >= 40 ? "bg-amber-500" : "bg-red-400";

  return (
    <div className="group">
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className={`font-bold ${pct >= 70 ? "text-accent-green" : pct >= 40 ? "text-amber-500" : "text-red-400"}`}>
          {principle.score}/10
        </span>
      </div>
      <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {principle.issue && (
        <p className="text-[10px] text-text-tertiary mt-0.5 hidden group-hover:block">
          {principle.issue}
        </p>
      )}
    </div>
  );
}

/**
 * QualityReportPanel — Shows AI quality evaluation results.
 * Displays as a compact badge that expands to show principle-level scores,
 * warnings, and critical issues.
 */
export function QualityReportPanel({ report }: Props) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor = getScoreColor(report.overallScore);
  const scoreBg = getScoreBg(report.overallScore);
  const scoreLabel = getScoreLabel(report.overallScore);

  const hasCritical = report.criticalIssues.length > 0;
  const hasWarnings = report.warnings.length > 0;

  // Sort principles: lowest scores first when expanded
  const sortedPrinciples = [...report.principleScores].sort(
    (a, b) => a.score - b.score
  );

  return (
    <div className={`rounded-xl border ${scoreBg} overflow-hidden transition-all duration-300`}>
      {/* Compact badge header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
      >
        {/* Score circle */}
        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          report.overallScore >= 75 ? "border-accent-green" : report.overallScore >= 50 ? "border-amber-500" : "border-red-500"
        }`}>
          <span className={`text-sm font-bold ${scoreColor}`}>
            {report.overallScore}
          </span>
        </div>

        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary">Quality Score</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${scoreColor}`}>
              {scoreLabel}
            </span>
          </div>
          <p className="text-[10px] text-text-tertiary mt-0.5">
            {report.principleScores.filter((p) => p.score >= 7).length}/{report.principleScores.length} principles strong
            {hasCritical && " · "}
            {hasCritical && <span className="text-red-500">{report.criticalIssues.length} critical</span>}
            {hasWarnings && !hasCritical && " · "}
            {hasWarnings && !hasCritical && <span className="text-amber-500">{report.warnings.length} warnings</span>}
          </p>
        </div>

        {/* Expand arrow */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-text-tertiary transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10">
          {/* Critical issues */}
          {hasCritical && (
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Critical Issues</span>
              {report.criticalIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/5 rounded-lg px-3 py-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Warnings</span>
              {report.warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-500/5 rounded-lg px-3 py-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Principle scores */}
          <div className="mt-3 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Pedagogy Principles</span>
            {sortedPrinciples.map((p) => (
              <PrincipleBar key={p.principle} principle={p} />
            ))}
          </div>

          {/* Timing analysis */}
          {report.timingAnalysis && (
            <div className="mt-3 pt-2 border-t border-white/5">
              <div className="flex items-center gap-4 text-[11px] text-text-secondary">
                <span>Total: {report.timingAnalysis.totalMinutes}m</span>
                <span>Expected: {report.timingAnalysis.expectedMinutes}m</span>
                {Math.abs(report.timingAnalysis.variance) > 10 && (
                  <span className={report.timingAnalysis.variance > 0 ? "text-amber-500" : "text-blue-400"}>
                    {report.timingAnalysis.variance > 0 ? "+" : ""}{Math.round(report.timingAnalysis.variance)}% variance
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Model info */}
          <p className="text-[9px] text-text-tertiary/50 mt-3">
            Evaluated by {report.modelVersion} · {new Date(report.evaluatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
