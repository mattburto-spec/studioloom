"use client";

import { useState } from "react";

interface ExtractedBlock {
  tempId: string;
  title: string;
  description: string;
  bloom_level: string;
  time_weight: string;
  activity_category: string;
  phase: string;
  grouping?: string;
  materials?: string[];
  teaching_approach?: string;
  scaffolding_notes?: string;
}

interface Lesson {
  title: string;
  learningGoal: string;
  blocks: ExtractedBlock[];
  matchPercentage: number;
  originalIndex: number;
}

interface MatchReportProps {
  lessons: Lesson[];
  overallMatchPercentage: number;
  totalBlocks: number;
  unmatchedBlocks: ExtractedBlock[];
  metadata: {
    detectedLessonCount: number;
    sequenceConfidence: number;
    assessmentPoints: number[];
  };
  onAccept: () => void;
  onReject: () => void;
}

// ── Visual helpers ──────────────────────────────────────────

function getMatchColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600 bg-emerald-50";
  if (pct >= 50) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

const PHASE_COLORS: Record<string, string> = {
  hook: "bg-amber-100 text-amber-700",
  explore: "bg-blue-100 text-blue-700",
  explain: "bg-purple-100 text-purple-700",
  apply: "bg-green-100 text-green-700",
  reflect: "bg-pink-100 text-pink-700",
  assess: "bg-indigo-100 text-indigo-700",
  introduction: "bg-sky-100 text-sky-700",
  warmup: "bg-amber-100 text-amber-700",
};

const CATEGORY_ICONS: Record<string, string> = {
  discussion: "\uD83D\uDCAC",
  hands_on: "\u270B",
  writing: "\u270D\uFE0F",
  research: "\uD83D\uDD0D",
  presentation: "\uD83C\uDFA4",
  collaboration: "\uD83E\uDD1D",
  assessment: "\uD83D\uDCDD",
  reflection: "\uD83E\uDD14",
  reading: "\uD83D\uDCD6",
  design: "\u2712\uFE0F",
  making: "\uD83D\uDEE0\uFE0F",
  digital: "\uD83D\uDCBB",
};

function PhaseTag({ phase }: { phase: string }) {
  const label = phase.replace(/_/g, " ");
  const color = PHASE_COLORS[phase.toLowerCase()] || "bg-gray-100 text-gray-600";
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color} capitalize`}>
      {label}
    </span>
  );
}

function BloomTag({ level }: { level: string }) {
  // Bloom's cognitive level — color by depth
  const bloomOrder = ["remember", "understand", "apply", "analyse", "analyze", "evaluate", "create"];
  const idx = bloomOrder.indexOf(level.toLowerCase());
  const colors = [
    "bg-gray-100 text-gray-600",     // remember
    "bg-blue-50 text-blue-600",      // understand
    "bg-cyan-50 text-cyan-700",      // apply
    "bg-violet-50 text-violet-600",  // analyse
    "bg-violet-50 text-violet-600",  // analyze (US spelling)
    "bg-orange-50 text-orange-600",  // evaluate
    "bg-rose-50 text-rose-600",      // create
  ];
  const color = idx >= 0 ? colors[idx] : "bg-gray-100 text-gray-600";
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${color} capitalize`}>
      {level}
    </span>
  );
}

function TimeTag({ weight }: { weight: string }) {
  const label = weight.replace(/_/g, " ");
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 capitalize">
      {label}
    </span>
  );
}

// ── Main component ──────────────────────────────────────────

export default function MatchReport({
  lessons,
  overallMatchPercentage,
  totalBlocks,
  unmatchedBlocks,
  metadata,
  onAccept,
  onReject,
}: MatchReportProps) {
  const [expandedLesson, setExpandedLesson] = useState<number | null>(
    lessons.length === 1 ? 0 : null
  );

  // Aggregate stats
  const allBlocks = lessons.flatMap((l) => l.blocks);
  const phaseBreakdown = new Map<string, number>();
  const categoryBreakdown = new Map<string, number>();
  const bloomBreakdown = new Map<string, number>();
  for (const b of allBlocks) {
    if (b.phase) phaseBreakdown.set(b.phase, (phaseBreakdown.get(b.phase) || 0) + 1);
    if (b.activity_category) categoryBreakdown.set(b.activity_category, (categoryBreakdown.get(b.activity_category) || 0) + 1);
    if (b.bloom_level) bloomBreakdown.set(b.bloom_level, (bloomBreakdown.get(b.bloom_level) || 0) + 1);
  }
  const materialsSet = new Set<string>();
  for (const b of allBlocks) {
    for (const m of b.materials || []) materialsSet.add(m);
  }

  return (
    <div className="space-y-4">
      {/* ── Summary stats ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Reconstruction Report</h3>
          <span
            className={`text-sm font-bold px-3 py-1 rounded-lg ${getMatchColor(overallMatchPercentage)}`}
          >
            {overallMatchPercentage}% match
          </span>
        </div>

        {/* Primary numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {metadata.detectedLessonCount}
            </div>
            <div className="text-[11px] text-gray-500">
              Lesson{metadata.detectedLessonCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalBlocks}</div>
            <div className="text-[11px] text-gray-500">
              Activit{totalBlocks !== 1 ? "ies" : "y"}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {(metadata.sequenceConfidence * 100).toFixed(0)}%
            </div>
            <div className="text-[11px] text-gray-500">Sequence Confidence</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {metadata.assessmentPoints.length}
            </div>
            <div className="text-[11px] text-gray-500">Assessment Points</div>
          </div>
        </div>

        {/* Breakdown strips */}
        <div className="space-y-2 pt-3 border-t border-gray-100">
          {/* Bloom's distribution */}
          {bloomBreakdown.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-14 shrink-0">
                Bloom&apos;s
              </span>
              {Array.from(bloomBreakdown.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([level, count]) => (
                  <span key={level} className="inline-flex items-center gap-1">
                    <BloomTag level={level} />
                    <span className="text-[10px] text-gray-400">&times;{count}</span>
                  </span>
                ))}
            </div>
          )}

          {/* Phase distribution */}
          {phaseBreakdown.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-14 shrink-0">
                Phases
              </span>
              {Array.from(phaseBreakdown.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([phase, count]) => (
                  <span key={phase} className="inline-flex items-center gap-1">
                    <PhaseTag phase={phase} />
                    <span className="text-[10px] text-gray-400">&times;{count}</span>
                  </span>
                ))}
            </div>
          )}

          {/* Activity types */}
          {categoryBreakdown.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-14 shrink-0">
                Types
              </span>
              {Array.from(categoryBreakdown.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => {
                  const icon = CATEGORY_ICONS[cat.toLowerCase()] || "";
                  const label = cat.replace(/_/g, " ");
                  return (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 text-[10px] bg-gray-50 text-gray-600 rounded px-1.5 py-0.5 capitalize"
                    >
                      {icon && <span>{icon}</span>}
                      {label} &times;{count}
                    </span>
                  );
                })}
            </div>
          )}

          {/* Materials */}
          {materialsSet.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-14 shrink-0">
                Materials
              </span>
              {Array.from(materialsSet)
                .slice(0, 8)
                .map((mat) => (
                  <span
                    key={mat}
                    className="text-[10px] bg-gray-50 text-gray-600 rounded px-1.5 py-0.5"
                  >
                    {mat}
                  </span>
                ))}
              {materialsSet.size > 8 && (
                <span className="text-[10px] text-gray-400">
                  +{materialsSet.size - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Per-lesson breakdown ── */}
      <div className="space-y-2">
        {lessons.map((lesson, i) => {
          const isExpanded = expandedLesson === i;
          return (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Lesson header — always visible, clickable */}
              <button
                onClick={() => setExpandedLesson(isExpanded ? null : i)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
              >
                <span className="text-xs font-bold text-gray-400 w-6 shrink-0">
                  L{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {lesson.title}
                    </h4>
                    {metadata.assessmentPoints.includes(i) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold shrink-0">
                        Assessment
                      </span>
                    )}
                  </div>
                  {!isExpanded && lesson.learningGoal && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {lesson.learningGoal}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gray-400">
                    {lesson.blocks.length} activit{lesson.blocks.length !== 1 ? "ies" : "y"}
                  </span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getMatchColor(lesson.matchPercentage)}`}
                  >
                    {lesson.matchPercentage}%
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-100">
                  {lesson.learningGoal && (
                    <p className="text-xs text-gray-500 italic pt-2">
                      {lesson.learningGoal}
                    </p>
                  )}

                  {/* Activity cards */}
                  <div className="space-y-2">
                    {lesson.blocks.map((block, bIdx) => (
                      <div
                        key={block.tempId}
                        className="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-gray-300 mt-0.5 w-4 shrink-0">
                            {bIdx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="text-xs font-semibold text-gray-800">
                                {block.title}
                              </span>
                              {block.phase && <PhaseTag phase={block.phase} />}
                              {block.bloom_level && <BloomTag level={block.bloom_level} />}
                              {block.time_weight && <TimeTag weight={block.time_weight} />}
                            </div>

                            {block.description && (
                              <p className="text-[11px] text-gray-500 leading-relaxed mb-1.5">
                                {block.description}
                              </p>
                            )}

                            {/* Extra detail chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {block.activity_category && (
                                <span className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 capitalize">
                                  {CATEGORY_ICONS[block.activity_category.toLowerCase()] || ""}{" "}
                                  {block.activity_category.replace(/_/g, " ")}
                                </span>
                              )}
                              {block.grouping && block.grouping !== "whole_class" && (
                                <span className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 capitalize">
                                  {block.grouping.replace(/_/g, " ")}
                                </span>
                              )}
                              {block.materials && block.materials.length > 0 && (
                                <span className="text-[10px] text-gray-400">
                                  Materials: {block.materials.join(", ")}
                                </span>
                              )}
                            </div>

                            {block.teaching_approach && (
                              <p className="text-[10px] text-gray-400 mt-1 italic">
                                {block.teaching_approach}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Unmatched blocks ── */}
      {unmatchedBlocks.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h4 className="text-xs font-semibold text-amber-700 mb-2">
            {unmatchedBlocks.length} Unmatched Block{unmatchedBlocks.length !== 1 ? "s" : ""}
          </h4>
          <div className="space-y-1.5">
            {unmatchedBlocks.map((block) => (
              <div
                key={block.tempId}
                className="flex items-start gap-2 text-xs bg-white rounded-lg border border-amber-200 px-3 py-2"
              >
                <span className="font-medium text-amber-800">{block.title}</span>
                {block.description && (
                  <span className="text-amber-600 truncate">{block.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-3">
        <button
          onClick={onAccept}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #059669, #047857)",
            boxShadow: "0 4px 14px rgba(5, 150, 105, 0.3)",
          }}
        >
          Accept &amp; Create Unit
        </button>
        <button
          onClick={onReject}
          className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
