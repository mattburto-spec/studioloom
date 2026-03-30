"use client";

/**
 * AnalysisDetailPanel — Rich display of AI analysis intelligence for a knowledge item.
 * Shows Bloom's distribution, lesson flow phases, strengths, gaps, pedagogical approach,
 * scaffolding strategy, cognitive load, skills developed, and more.
 *
 * Mounted above the edit form on the knowledge page when an item has profile data.
 */

import { useState } from "react";

// ─── Types (mirrors LessonProfile shape from profile_data JSONB) ───

interface LessonFlowPhase {
  phase?: string;
  title?: string;
  description?: string;
  estimated_minutes?: number;
  teacher_role?: string;
  student_cognitive_level?: string;
  energy_state?: string;
  scaffolding_present?: string[];
  materials_needed?: string[];
  tools_required?: string[];
  safety_considerations?: string[];
}

interface CriterionAnalysis {
  criterion?: string;
  emphasis?: string;
  skill_development?: string;
  how_developed?: string;
  evidence_from_text?: string;
}

interface AnalysedStrength {
  what?: string;
  why_it_works?: string;
}

interface AnalysedGap {
  what?: string;
  suggestion?: string;
}

interface SkillDeveloped {
  skill?: string;
  to_what_level?: string;
}

interface ProfileData {
  title?: string;
  subject_area?: string;
  grade_level?: string;
  estimated_duration_minutes?: number;
  lesson_type?: string;
  lesson_flow?: LessonFlowPhase[];
  criteria_analysis?: CriterionAnalysis[];
  pedagogical_approach?: { primary?: string; secondary?: string; reasoning?: string } | string;
  scaffolding_strategy?: { model?: string; how_supports_are_introduced?: string; how_supports_are_removed?: string; reasoning?: string };
  cognitive_load_curve?: { description?: string; peak_moment?: string; recovery_moment?: string };
  classroom_management?: { noise_level_curve?: string; movement_required?: boolean; grouping_progression?: string; the_5_and_5?: string };
  strengths?: AnalysedStrength[];
  gaps?: AnalysedGap[];
  skills_developed?: SkillDeveloped[];
  prerequisites?: { skill_or_knowledge?: string; why_needed?: string }[];
  energy_and_sequencing?: { starts_as?: string; ends_as?: string; ideal_follows?: string; avoid_after?: string };
  bloom_distribution?: Record<string, number>;
  udl_coverage?: { engagement?: string[]; representation?: string[]; action_expression?: string[]; principle_gaps?: string };
  grouping_analysis?: { progression?: string; time_distribution?: { individual_pct?: number; pair_pct?: number; small_group_pct?: number; whole_class_pct?: number } };
  complexity_level?: string;
  analysis_version?: string;
  analysis_model?: string;
  analysis_timestamp?: string;
}

interface AnalysisDetailPanelProps {
  profileData: Record<string, unknown>;
  onClose?: () => void;
}

// ─── Helpers ───

const BLOOM_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  remember: { bg: "bg-gray-100", text: "text-gray-700", bar: "bg-gray-400" },
  understand: { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" },
  apply: { bg: "bg-green-50", text: "text-green-700", bar: "bg-green-500" },
  analyse: { bg: "bg-yellow-50", text: "text-yellow-700", bar: "bg-yellow-500" },
  analyze: { bg: "bg-yellow-50", text: "text-yellow-700", bar: "bg-yellow-500" },
  evaluate: { bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-500" },
  create: { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500" },
};

const BLOOM_ORDER = ["remember", "understand", "apply", "analyse", "analyze", "evaluate", "create"];

const PHASE_COLORS: Record<string, string> = {
  warm_up: "bg-amber-100 text-amber-800",
  vocabulary: "bg-blue-100 text-blue-800",
  introduction: "bg-indigo-100 text-indigo-800",
  demonstration: "bg-purple-100 text-purple-800",
  guided_practice: "bg-violet-100 text-violet-800",
  independent_work: "bg-emerald-100 text-emerald-800",
  making: "bg-orange-100 text-orange-800",
  collaboration: "bg-cyan-100 text-cyan-800",
  critique: "bg-pink-100 text-pink-800",
  gallery_walk: "bg-rose-100 text-rose-800",
  presentation: "bg-sky-100 text-sky-800",
  testing: "bg-lime-100 text-lime-800",
  iteration: "bg-teal-100 text-teal-800",
  reflection: "bg-fuchsia-100 text-fuchsia-800",
  assessment: "bg-red-100 text-red-800",
  cleanup: "bg-gray-100 text-gray-800",
  extension: "bg-green-100 text-green-800",
  transition: "bg-slate-100 text-slate-800",
  station_rotation: "bg-yellow-100 text-yellow-800",
};

const TEACHER_ROLE_ICONS: Record<string, string> = {
  direct_instruction: "🎯",
  modelling: "🎨",
  facilitating: "💬",
  circulating: "🚶",
  observing: "👀",
  "co-working": "🤝",
  conferencing: "🗣️",
};

const SKILL_STAGE_COLORS: Record<string, string> = {
  introduced: "bg-blue-100 text-blue-700",
  practiced: "bg-green-100 text-green-700",
  consolidated: "bg-purple-100 text-purple-700",
  mastered: "bg-amber-100 text-amber-700",
};

function formatPhase(phase: string): string {
  return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

// ─── Sub-components ───

function SectionHeader({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5 mb-2">
      <span className="text-text-secondary/60">{icon}</span>
      {children}
    </h4>
  );
}

function BloomDistributionChart({ bloom }: { bloom: Record<string, number> }) {
  // Normalize values
  const entries = BLOOM_ORDER
    .filter((k) => bloom[k] !== undefined && bloom[k] > 0)
    .map((k) => ({ key: k, value: bloom[k] }));

  if (entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + e.value, 0);
  const isNormalized = total <= 1.5;
  const max = Math.max(...entries.map((e) => isNormalized ? e.value : e.value / 100));

  return (
    <div className="space-y-1">
      {entries.map(({ key, value }) => {
        const pct = isNormalized ? value * 100 : value;
        const colors = BLOOM_COLORS[key] || BLOOM_COLORS.remember;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-text-secondary w-16 text-right capitalize">
              {key === "analyse" ? "Analyse" : key}
            </span>
            <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${colors.bar} transition-all`}
                style={{ width: `${(isNormalized ? value : value / 100) / max * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-text-secondary w-8">{Math.round(pct)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function LessonFlowTimeline({ phases }: { phases: LessonFlowPhase[] }) {
  const totalMinutes = phases.reduce((s, p) => s + (p.estimated_minutes || 0), 0);

  return (
    <div className="space-y-1.5">
      {phases.map((phase, i) => {
        const phaseColor = PHASE_COLORS[phase.phase || ""] || "bg-gray-100 text-gray-800";
        const roleIcon = TEACHER_ROLE_ICONS[phase.teacher_role || ""] || "📋";
        const widthPct = totalMinutes > 0 ? ((phase.estimated_minutes || 0) / totalMinutes) * 100 : 0;

        return (
          <div key={i} className="flex items-start gap-2">
            {/* Time column */}
            <div className="w-8 text-right flex-shrink-0">
              <span className="text-[10px] font-medium text-text-secondary">
                {phase.estimated_minutes ? `${phase.estimated_minutes}m` : ""}
              </span>
            </div>

            {/* Bar */}
            <div className="w-16 flex-shrink-0 pt-1">
              <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${phaseColor.split(" ")[0].replace("100", "400").replace("50", "400")}`}
                  style={{ width: `${Math.max(widthPct, 8)}%` }}
                />
              </div>
            </div>

            {/* Phase info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${phaseColor}`}>
                  {formatPhase(phase.phase || "unknown")}
                </span>
                {phase.teacher_role && (
                  <span className="text-[10px] text-text-secondary" title={`Teacher: ${formatPhase(phase.teacher_role)}`}>
                    {roleIcon}
                  </span>
                )}
                {phase.student_cognitive_level && (
                  <span className={`text-[9px] px-1 py-0.5 rounded ${BLOOM_COLORS[phase.student_cognitive_level]?.bg || "bg-gray-50"} ${BLOOM_COLORS[phase.student_cognitive_level]?.text || "text-gray-600"}`}>
                    {formatPhase(phase.student_cognitive_level)}
                  </span>
                )}
              </div>
              {phase.title && (
                <p className="text-[11px] text-text-primary mt-0.5 line-clamp-1">{phase.title}</p>
              )}
              {phase.description && (
                <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">{phase.description}</p>
              )}
            </div>
          </div>
        );
      })}
      {totalMinutes > 0 && (
        <div className="text-[10px] text-text-secondary/60 text-right pt-1 border-t border-border/50">
          Total: {formatDuration(totalMinutes)}
        </div>
      )}
    </div>
  );
}

function StrengthsGapsSection({ strengths, gaps }: { strengths?: AnalysedStrength[]; gaps?: AnalysedGap[] }) {
  if ((!strengths || strengths.length === 0) && (!gaps || gaps.length === 0)) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Strengths */}
      {strengths && strengths.length > 0 && (
        <div>
          <SectionHeader icon={<StrengthIcon />}>Strengths</SectionHeader>
          <div className="space-y-1.5">
            {strengths.map((s, i) => (
              <div key={i} className="bg-green-50/50 border border-green-100 rounded-lg p-2">
                <p className="text-[11px] font-medium text-green-800">{s.what}</p>
                {s.why_it_works && (
                  <p className="text-[10px] text-green-700/70 mt-0.5">{s.why_it_works}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps */}
      {gaps && gaps.length > 0 && (
        <div>
          <SectionHeader icon={<GapIcon />}>Gaps</SectionHeader>
          <div className="space-y-1.5">
            {gaps.map((g, i) => (
              <div key={i} className="bg-amber-50/50 border border-amber-100 rounded-lg p-2">
                <p className="text-[11px] font-medium text-amber-800">{g.what}</p>
                {g.suggestion && (
                  <p className="text-[10px] text-amber-700/70 mt-0.5">
                    <span className="font-medium">Suggestion:</span> {g.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

export default function AnalysisDetailPanel({ profileData, onClose }: AnalysisDetailPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const p = profileData as ProfileData;

  if (!p || Object.keys(p).length === 0) return null;

  // Extract pedagogical approach (can be string or object)
  const pedApproach = typeof p.pedagogical_approach === "string"
    ? { primary: p.pedagogical_approach }
    : p.pedagogical_approach;

  const hasLessonFlow = p.lesson_flow && p.lesson_flow.length > 0;
  const hasBloom = p.bloom_distribution && Object.keys(p.bloom_distribution).length > 0;
  const hasStrengthsGaps = (p.strengths && p.strengths.length > 0) || (p.gaps && p.gaps.length > 0);
  const hasCriteria = p.criteria_analysis && p.criteria_analysis.length > 0;
  const hasSkills = p.skills_developed && p.skills_developed.length > 0;
  const hasScaffolding = p.scaffolding_strategy && typeof p.scaffolding_strategy === "object";
  const hasCogLoad = p.cognitive_load_curve && typeof p.cognitive_load_curve === "object";
  const hasGrouping = p.grouping_analysis && typeof p.grouping_analysis === "object";
  const hasManagement = p.classroom_management && typeof p.classroom_management === "object";
  const hasEnergy = p.energy_and_sequencing && typeof p.energy_and_sequencing === "object";

  return (
    <div className="bg-gradient-to-br from-purple-50/60 to-indigo-50/40 rounded-xl border border-purple-100 mb-4 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-purple-50/30 transition"
      >
        <div className="flex items-center gap-2">
          <AnalysisIcon />
          <span className="text-sm font-semibold text-purple-900">AI Analysis Intelligence</span>
          {p.analysis_version && (
            <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
              v{p.analysis_version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <span
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="text-text-secondary/40 hover:text-text-secondary transition cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-purple-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* ── Identity Row ── */}
          <div className="flex flex-wrap items-center gap-2">
            {p.lesson_type && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 capitalize">
                {formatPhase(p.lesson_type)}
              </span>
            )}
            {p.subject_area && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {p.subject_area}
              </span>
            )}
            {p.grade_level && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                {p.grade_level}
              </span>
            )}
            {p.estimated_duration_minutes && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                {formatDuration(p.estimated_duration_minutes)}
              </span>
            )}
            {p.complexity_level && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                p.complexity_level === "introductory" ? "bg-green-50 text-green-700" :
                p.complexity_level === "developing" ? "bg-blue-50 text-blue-700" :
                p.complexity_level === "proficient" ? "bg-purple-50 text-purple-700" :
                "bg-red-50 text-red-700"
              }`}>
                {formatPhase(p.complexity_level)}
              </span>
            )}
            {pedApproach?.primary && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                {pedApproach.primary}
              </span>
            )}
            {pedApproach?.secondary && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50/60 text-violet-600">
                {pedApproach.secondary}
              </span>
            )}
          </div>

          {/* ── Pedagogical reasoning ── */}
          {pedApproach?.reasoning && (
            <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
              <SectionHeader icon={<BrainIcon />}>Pedagogical Reasoning</SectionHeader>
              <p className="text-[11px] text-text-secondary leading-relaxed">{pedApproach.reasoning}</p>
            </div>
          )}

          {/* ── Two-column layout: Bloom's + Lesson Flow ── */}
          <div className={`grid gap-4 ${hasBloom && hasLessonFlow ? "grid-cols-2" : "grid-cols-1"}`}>
            {/* Bloom's */}
            {hasBloom && (
              <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
                <SectionHeader icon={<BloomIcon />}>Bloom&apos;s Distribution</SectionHeader>
                <BloomDistributionChart bloom={p.bloom_distribution!} />
              </div>
            )}

            {/* Lesson Flow */}
            {hasLessonFlow && (
              <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
                <SectionHeader icon={<FlowIcon />}>Lesson Flow</SectionHeader>
                <LessonFlowTimeline phases={p.lesson_flow!} />
              </div>
            )}
          </div>

          {/* ── Strengths & Gaps ── */}
          {hasStrengthsGaps && (
            <StrengthsGapsSection strengths={p.strengths} gaps={p.gaps} />
          )}

          {/* ── Criteria Analysis ── */}
          {hasCriteria && (
            <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
              <SectionHeader icon={<CriteriaIcon />}>Criteria Analysis</SectionHeader>
              <div className="space-y-2">
                {p.criteria_analysis!.map((ca, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      ca.emphasis === "primary" ? "bg-indigo-100 text-indigo-700" :
                      ca.emphasis === "secondary" ? "bg-blue-50 text-blue-600" :
                      "bg-gray-50 text-gray-600"
                    }`}>
                      {ca.criterion || "?"}
                    </span>
                    <div className="flex-1 min-w-0">
                      {ca.skill_development && (
                        <p className="text-[11px] text-text-primary">{ca.skill_development}</p>
                      )}
                      {ca.how_developed && (
                        <p className="text-[10px] text-text-secondary mt-0.5">{ca.how_developed}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Three-column row: Scaffolding + Cognitive Load + Grouping ── */}
          {(hasScaffolding || hasCogLoad || hasGrouping) && (
            <div className="grid grid-cols-3 gap-3">
              {hasScaffolding && (
                <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
                  <SectionHeader icon={<ScaffoldIcon />}>Scaffolding</SectionHeader>
                  <p className="text-[10px] font-medium text-purple-700 mb-1">
                    {p.scaffolding_strategy!.model}
                  </p>
                  {p.scaffolding_strategy!.how_supports_are_introduced && (
                    <p className="text-[10px] text-text-secondary">
                      <span className="text-green-600">+</span> {p.scaffolding_strategy!.how_supports_are_introduced}
                    </p>
                  )}
                  {p.scaffolding_strategy!.how_supports_are_removed && (
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      <span className="text-red-500">−</span> {p.scaffolding_strategy!.how_supports_are_removed}
                    </p>
                  )}
                </div>
              )}

              {hasCogLoad && (
                <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
                  <SectionHeader icon={<CogLoadIcon />}>Cognitive Load</SectionHeader>
                  {p.cognitive_load_curve!.description && (
                    <p className="text-[10px] text-text-secondary mb-1">{p.cognitive_load_curve!.description}</p>
                  )}
                  {p.cognitive_load_curve!.peak_moment && (
                    <p className="text-[10px] text-text-secondary">
                      <span className="text-orange-600 font-medium">Peak:</span> {p.cognitive_load_curve!.peak_moment}
                    </p>
                  )}
                  {p.cognitive_load_curve!.recovery_moment && (
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      <span className="text-green-600 font-medium">Recovery:</span> {p.cognitive_load_curve!.recovery_moment}
                    </p>
                  )}
                </div>
              )}

              {hasGrouping && (
                <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
                  <SectionHeader icon={<GroupIcon />}>Grouping</SectionHeader>
                  {p.grouping_analysis!.progression && (
                    <p className="text-[10px] text-text-secondary mb-1">{p.grouping_analysis!.progression}</p>
                  )}
                  {p.grouping_analysis!.time_distribution && (
                    <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-gray-100">
                      {p.grouping_analysis!.time_distribution.individual_pct ? (
                        <div className="bg-blue-400 rounded-l" style={{ flex: p.grouping_analysis!.time_distribution.individual_pct }} title={`Individual: ${p.grouping_analysis!.time_distribution.individual_pct}%`} />
                      ) : null}
                      {p.grouping_analysis!.time_distribution.pair_pct ? (
                        <div className="bg-green-400" style={{ flex: p.grouping_analysis!.time_distribution.pair_pct }} title={`Pairs: ${p.grouping_analysis!.time_distribution.pair_pct}%`} />
                      ) : null}
                      {p.grouping_analysis!.time_distribution.small_group_pct ? (
                        <div className="bg-purple-400" style={{ flex: p.grouping_analysis!.time_distribution.small_group_pct }} title={`Small groups: ${p.grouping_analysis!.time_distribution.small_group_pct}%`} />
                      ) : null}
                      {p.grouping_analysis!.time_distribution.whole_class_pct ? (
                        <div className="bg-amber-400 rounded-r" style={{ flex: p.grouping_analysis!.time_distribution.whole_class_pct }} title={`Whole class: ${p.grouping_analysis!.time_distribution.whole_class_pct}%`} />
                      ) : null}
                    </div>
                  )}
                  {p.grouping_analysis!.time_distribution && (
                    <div className="flex gap-2 mt-1 text-[9px] text-text-secondary/60">
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /> Ind</span>
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Pair</span>
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" /> Group</span>
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Class</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Skills Developed ── */}
          {hasSkills && (
            <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
              <SectionHeader icon={<SkillIcon />}>Skills Developed</SectionHeader>
              <div className="flex flex-wrap gap-1.5">
                {p.skills_developed!.map((s, i) => (
                  <span
                    key={i}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SKILL_STAGE_COLORS[s.to_what_level || ""] || "bg-gray-100 text-gray-700"}`}
                    title={s.to_what_level ? `Stage: ${formatPhase(s.to_what_level)}` : undefined}
                  >
                    {s.skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Classroom Management ── */}
          {hasManagement && (
            <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
              <SectionHeader icon={<ManageIcon />}>Classroom Management</SectionHeader>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary">
                {p.classroom_management!.noise_level_curve && (
                  <div><span className="font-medium text-text-primary">Noise curve:</span> {p.classroom_management!.noise_level_curve}</div>
                )}
                {p.classroom_management!.grouping_progression && (
                  <div><span className="font-medium text-text-primary">Grouping:</span> {p.classroom_management!.grouping_progression}</div>
                )}
                {p.classroom_management!.the_5_and_5 && (
                  <div className="col-span-2"><span className="font-medium text-text-primary">Fast/slow finishers:</span> {p.classroom_management!.the_5_and_5}</div>
                )}
              </div>
            </div>
          )}

          {/* ── Energy & Sequencing ── */}
          {hasEnergy && (
            <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
              <SectionHeader icon={<EnergyIcon />}>Energy & Sequencing</SectionHeader>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary">
                {p.energy_and_sequencing!.starts_as && (
                  <div><span className="font-medium text-text-primary">Starts as:</span> {formatPhase(p.energy_and_sequencing!.starts_as)}</div>
                )}
                {p.energy_and_sequencing!.ends_as && (
                  <div><span className="font-medium text-text-primary">Ends as:</span> {formatPhase(p.energy_and_sequencing!.ends_as)}</div>
                )}
                {p.energy_and_sequencing!.ideal_follows && (
                  <div><span className="font-medium text-text-primary">Best after:</span> {p.energy_and_sequencing!.ideal_follows}</div>
                )}
                {p.energy_and_sequencing!.avoid_after && (
                  <div><span className="font-medium text-text-primary">Avoid after:</span> {p.energy_and_sequencing!.avoid_after}</div>
                )}
              </div>
            </div>
          )}

          {/* ── Analysis metadata ── */}
          <div className="flex items-center gap-3 text-[9px] text-text-secondary/50 pt-2 border-t border-purple-100/50">
            {p.analysis_model && <span>Model: {p.analysis_model}</span>}
            {p.analysis_timestamp && <span>Analysed: {new Date(p.analysis_timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
            {p.analysis_version && <span>Pipeline: v{p.analysis_version}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline SVG Icons (Lesson Learned #16: no lucide-react) ───

function AnalysisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44A2.5 2.5 0 015.5 17a2.5 2.5 0 01-1.06-4.19A3 3 0 018 7.5" />
      <path d="M14.5 2A2.5 2.5 0 0012 4.5v15a2.5 2.5 0 004.96.44A2.5 2.5 0 0018.5 17a2.5 2.5 0 001.06-4.19A3 3 0 0016 7.5" />
    </svg>
  );
}

function BloomIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function StrengthIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CriteriaIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ScaffoldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}

function CogLoadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function SkillIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ManageIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function EnergyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
