"use client";

import { useState } from "react";
import type {
  LessonProfile,
  LessonFlowPhase,
  LessonPhase,
  EnergyState,
  CognitiveLevel,
  SkillStage,
} from "@/types/lesson-intelligence";
import { getCriterionDisplay } from "@/lib/constants";

/* ================================================================
   CONSTANTS & HELPERS
   ================================================================ */

const PHASE_LABELS: Record<LessonPhase, string> = {
  warm_up: "Warm-up",
  vocabulary: "Vocabulary",
  introduction: "Introduction",
  demonstration: "Demonstration",
  guided_practice: "Guided Practice",
  independent_work: "Independent Work",
  making: "Making",
  collaboration: "Collaboration",
  critique: "Critique",
  gallery_walk: "Gallery Walk",
  presentation: "Presentation",
  testing: "Testing",
  iteration: "Iteration",
  reflection: "Reflection",
  assessment: "Assessment",
  cleanup: "Cleanup",
  extension: "Extension",
  transition: "Transition",
  station_rotation: "Station Rotation",
};

const PHASE_EMOJI: Record<LessonPhase, string> = {
  warm_up: "🔥",
  vocabulary: "📖",
  introduction: "👋",
  demonstration: "🎯",
  guided_practice: "🤝",
  independent_work: "✏️",
  making: "🔨",
  collaboration: "👥",
  critique: "💬",
  gallery_walk: "🖼️",
  presentation: "🎤",
  testing: "🧪",
  iteration: "🔄",
  reflection: "🪞",
  assessment: "📋",
  cleanup: "🧹",
  extension: "🚀",
  transition: "➡️",
  station_rotation: "🔄",
};

const ENERGY_COLORS: Record<EnergyState, string> = {
  calm_focus: "#5BA3D0",
  curious_exploration: "#E86F2C",
  creative_energy: "#8B5CF6",
  high_energy_active: "#EF4444",
  productive_struggle: "#FBBF24",
  reflective: "#86EFAC",
  collaborative_buzz: "#14B8A6",
  quiet_concentration: "#94A3B8",
  celebratory: "#F59E0B",
  tired_low_energy: "#D1D5DB",
};

const ENERGY_LABELS: Record<EnergyState, string> = {
  calm_focus: "Calm Focus",
  curious_exploration: "Curious",
  creative_energy: "Creative",
  high_energy_active: "High Energy",
  productive_struggle: "Struggle",
  reflective: "Reflective",
  collaborative_buzz: "Collaborative",
  quiet_concentration: "Quiet",
  celebratory: "Celebratory",
  tired_low_energy: "Low Energy",
};

const COGNITIVE_COLORS: Record<CognitiveLevel, string> = {
  remember: "#94A3B8",
  understand: "#3B82F6",
  apply: "#14B8A6",
  analyse: "#F97316",
  evaluate: "#EF4444",
  create: "#8B5CF6",
};

const COMPLEXITY_COLORS: Record<string, { bg: string; text: string }> = {
  introductory: { bg: "bg-blue-100", text: "text-blue-700" },
  developing: { bg: "bg-green-100", text: "text-green-700" },
  proficient: { bg: "bg-orange-100", text: "text-orange-700" },
  advanced: { bg: "bg-purple-100", text: "text-purple-700" },
};

const SKILL_STAGE_COLORS: Record<SkillStage, { bg: string; text: string }> = {
  introduced: { bg: "bg-blue-50", text: "text-blue-600" },
  practiced: { bg: "bg-teal-50", text: "text-teal-600" },
  consolidated: { bg: "bg-orange-50", text: "text-orange-600" },
  mastered: { bg: "bg-purple-50", text: "text-purple-600" },
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ================================================================
   COMPONENT
   ================================================================ */

interface LessonProfileReviewProps {
  profile: LessonProfile;
  profileId?: string;
  onVerify?: (rating: number) => void;
  onClose?: () => void;
  onReanalyse?: () => void;
  onQuickModify?: () => void;
  onFeedback?: () => void;
}

export default function LessonProfileReview({
  profile,
  profileId,
  onVerify,
  onClose,
  onReanalyse,
  onQuickModify,
  onFeedback,
}: LessonProfileReviewProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["criteria", "flow"])
  );
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  function togglePhase(idx: number) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleVerify() {
    if (!profileId || rating === 0) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/teacher/knowledge/lesson-profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_verified: true,
          teacher_quality_rating: rating,
        }),
      });
      if (res.ok) {
        setVerified(true);
        onVerify?.(rating);
      }
    } finally {
      setVerifying(false);
    }
  }

  // Compute cumulative times for lesson flow
  const cumulativeTimes: number[] = [];
  let runningTime = 0;
  for (const phase of profile.lesson_flow ?? []) {
    cumulativeTimes.push(runningTime);
    runningTime += phase.estimated_minutes;
  }

  const cc = COMPLEXITY_COLORS[profile.complexity_level] || COMPLEXITY_COLORS.developing;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* ─── A. HEADER ─── */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">{profile.title}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-text-secondary">
              {profile.subject_area && (
                <span className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg>
                  {profile.subject_area}
                </span>
              )}
              {profile.grade_level && (
                <span className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                  {profile.grade_level}
                </span>
              )}
              {profile.estimated_duration_minutes > 0 && (
                <span className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {formatMinutes(profile.estimated_duration_minutes)}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cc.bg} ${cc.text}`}>
                {profile.complexity_level}
              </span>
              {profile.pedagogical_approach?.primary && (
                <span className="px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple text-[10px] font-medium">
                  {profile.pedagogical_approach.primary}
                </span>
              )}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-text-secondary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {/* ─── B. CRITERIA ANALYSIS ─── */}
        {profile.criteria_analysis?.length > 0 && (
          <SectionToggle
            title="Criteria Analysis"
            subtitle={profile.criteria_analysis.map((c) => c.criterion).join(", ")}
            isOpen={expandedSections.has("criteria")}
            onToggle={() => toggleSection("criteria")}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.criteria_analysis.map((ca) => {
                const criterionInfo = getCriterionDisplay(ca.criterion);
                const emphasisBg =
                  ca.emphasis === "primary"
                    ? "border-l-4"
                    : ca.emphasis === "secondary"
                      ? "border-l-2"
                      : "border-l";
                return (
                  <div
                    key={ca.criterion}
                    className={`rounded-lg border border-border p-4 ${emphasisBg}`}
                    style={{ borderLeftColor: criterionInfo.color }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: criterionInfo.color }}
                      >
                        {ca.criterion}
                      </span>
                      <span className="text-sm font-semibold text-text-primary">
                        {criterionInfo.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-text-secondary ml-auto">
                        {ca.emphasis}
                      </span>
                    </div>
                    <p className="text-xs text-text-primary mb-1">{ca.skill_development}</p>
                    <p className="text-xs text-text-secondary">{ca.how_developed}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-medium ${ca.assessment_embedded ? "text-green-600" : "text-orange-500"}`}>
                        {ca.assessment_embedded ? "✓ Assessment embedded" : "⚠ Assessment bolted on"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionToggle>
        )}

        {/* ─── C. LESSON FLOW TABLE ─── */}
        {profile.lesson_flow?.length > 0 && (
          <SectionToggle
            title="Lesson Flow"
            subtitle={`${profile.lesson_flow.length} phases · ${formatMinutes(runningTime)} total`}
            isOpen={expandedSections.has("flow")}
            onToggle={() => toggleSection("flow")}
          >
            {/* Timeline bar */}
            <div className="mb-4 flex items-center gap-1 overflow-x-auto">
              {profile.lesson_flow.map((phase, i) => {
                const widthPct = (phase.estimated_minutes / runningTime) * 100;
                return (
                  <div
                    key={i}
                    className="h-3 rounded-full cursor-pointer hover:opacity-80 transition"
                    style={{
                      width: `${Math.max(widthPct, 2)}%`,
                      backgroundColor: ENERGY_COLORS[phase.energy_state] || "#94A3B8",
                      minWidth: "8px",
                    }}
                    title={`${PHASE_LABELS[phase.phase] || phase.phase} (${phase.estimated_minutes}m)`}
                    onClick={() => togglePhase(i)}
                  />
                );
              })}
            </div>

            {/* Phase rows */}
            <div className="space-y-1">
              {profile.lesson_flow.map((phase, i) => (
                <PhaseRow
                  key={i}
                  phase={phase}
                  index={i}
                  cumulativeTime={cumulativeTimes[i]}
                  isExpanded={expandedPhases.has(i)}
                  onToggle={() => togglePhase(i)}
                />
              ))}
            </div>
          </SectionToggle>
        )}

        {/* ─── D. PEDAGOGICAL DNA ─── */}
        <SectionToggle
          title="Pedagogical DNA"
          subtitle={profile.pedagogical_approach?.primary}
          isOpen={expandedSections.has("pedagogy")}
          onToggle={() => toggleSection("pedagogy")}
        >
          <div className="space-y-4">
            {/* Approach */}
            {profile.pedagogical_approach && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Approach</h4>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded-md bg-brand-purple/10 text-brand-purple text-xs font-medium">
                    {profile.pedagogical_approach.primary}
                  </span>
                  {profile.pedagogical_approach.secondary && (
                    <span className="px-2 py-1 rounded-md bg-gray-200 text-text-secondary text-xs font-medium">
                      {profile.pedagogical_approach.secondary}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary">{profile.pedagogical_approach.reasoning}</p>
              </div>
            )}

            {/* Scaffolding */}
            {profile.scaffolding_strategy && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Scaffolding Strategy</h4>
                <span className="px-2 py-1 rounded-md bg-accent-blue/10 text-accent-blue text-xs font-medium mb-2 inline-block">
                  {profile.scaffolding_strategy.model}
                </span>
                <div className="space-y-1 mt-2">
                  <p className="text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">Introduced:</span> {profile.scaffolding_strategy.how_supports_are_introduced}
                  </p>
                  <p className="text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">Removed:</span> {profile.scaffolding_strategy.how_supports_are_removed}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">{profile.scaffolding_strategy.reasoning}</p>
                </div>
              </div>
            )}

            {/* Cognitive Load */}
            {profile.cognitive_load_curve && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Cognitive Load Curve</h4>
                <p className="text-xs text-text-secondary mb-2">{profile.cognitive_load_curve.description}</p>
                <div className="flex gap-4">
                  <div className="text-xs">
                    <span className="font-medium text-red-600">Peak:</span>{" "}
                    <span className="text-text-secondary">{profile.cognitive_load_curve.peak_moment}</span>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium text-green-600">Recovery:</span>{" "}
                    <span className="text-text-secondary">{profile.cognitive_load_curve.recovery_moment}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Classroom Management */}
            {profile.classroom_management && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Classroom Management</h4>
                <div className="space-y-2 text-xs text-text-secondary">
                  <p><span className="font-medium text-text-primary">Noise:</span> {profile.classroom_management.noise_level_curve}</p>
                  <p><span className="font-medium text-text-primary">Grouping:</span> {profile.classroom_management.grouping_progression}</p>
                  <p><span className="font-medium text-text-primary">Movement:</span> {profile.classroom_management.movement_required ? "Yes — students need to move" : "Seated activity"}</p>
                  <p><span className="font-medium text-text-primary">The 5-and-5:</span> {profile.classroom_management.the_5_and_5}</p>
                  {profile.classroom_management.behaviour_hotspots && (
                    <p><span className="font-medium text-orange-600">Hotspots:</span> {profile.classroom_management.behaviour_hotspots}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </SectionToggle>

        {/* ─── E. QUALITY ANALYSIS ─── */}
        {(profile.strengths?.length > 0 || profile.gaps?.length > 0) && (
          <SectionToggle
            title="Quality Analysis"
            subtitle={`${profile.strengths?.length || 0} strengths · ${profile.gaps?.length || 0} gaps`}
            isOpen={expandedSections.has("quality")}
            onToggle={() => toggleSection("quality")}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Strengths */}
              {profile.strengths?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Strengths
                  </h4>
                  <div className="space-y-2">
                    {profile.strengths.map((s, i) => (
                      <div key={i} className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-xs font-medium text-green-900">{s.what}</p>
                        <p className="text-xs text-green-700 mt-1">{s.why_it_works}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gaps */}
              {profile.gaps?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Gaps
                  </h4>
                  <div className="space-y-2">
                    {profile.gaps.map((g, i) => (
                      <div key={i} className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                        <p className="text-xs font-medium text-orange-900">{g.what}</p>
                        <p className="text-xs text-orange-700 mt-1">{g.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionToggle>
        )}

        {/* ─── F. SEQUENCING INTELLIGENCE ─── */}
        <SectionToggle
          title="Sequencing & Skills"
          subtitle={`${profile.skills_developed?.length || 0} skills · ${profile.prerequisites?.length || 0} prereqs`}
          isOpen={expandedSections.has("sequencing")}
          onToggle={() => toggleSection("sequencing")}
        >
          <div className="space-y-4">
            {/* Prerequisites */}
            {profile.prerequisites?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Prerequisites</h4>
                <ul className="space-y-1">
                  {profile.prerequisites.map((p, i) => (
                    <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                      <span className="text-text-secondary/40 mt-0.5">•</span>
                      <span>
                        <span className="font-medium text-text-primary">{p.skill_or_knowledge}</span>
                        {" — "}{p.why_needed}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills Developed */}
            {profile.skills_developed?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Skills Developed</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.skills_developed.map((sd, i) => {
                    const sc = SKILL_STAGE_COLORS[sd.to_what_level] || SKILL_STAGE_COLORS.introduced;
                    return (
                      <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                        {sd.skill} → {sd.to_what_level}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Energy & Sequencing */}
            {profile.energy_and_sequencing && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Energy & Sequencing</h4>
                <div className="flex items-center gap-3 mb-3">
                  <EnergyBadge state={profile.energy_and_sequencing.starts_as} label="Starts as" />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                  <EnergyBadge state={profile.energy_and_sequencing.ends_as} label="Ends as" />
                </div>
                <div className="space-y-1 text-xs text-text-secondary">
                  <p><span className="font-medium text-text-primary">Best followed by:</span> {profile.energy_and_sequencing.ideal_follows}</p>
                  <p><span className="font-medium text-orange-600">Avoid after:</span> {profile.energy_and_sequencing.avoid_after}</p>
                  {profile.energy_and_sequencing.ideal_time_of_day && (
                    <p><span className="font-medium text-text-primary">Ideal time:</span> {profile.energy_and_sequencing.ideal_time_of_day}</p>
                  )}
                </div>
              </div>
            )}

            {/* Narrative Role */}
            {profile.narrative_role && (
              <div className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Narrative role:</span> {profile.narrative_role}
              </div>
            )}
          </div>
        </SectionToggle>

        {/* ─── F2. 3-PASS RAW DATA ─── */}
        <SectionToggle
          title="3-Pass Analysis Data"
          subtitle="Structure → Pedagogy → Design Teaching"
          isOpen={expandedSections.has("passes")}
          onToggle={() => toggleSection("passes")}
        >
          <div className="space-y-4">
            {/* Pass 1: Structure */}
            <div className="rounded-xl border border-indigo-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-indigo-50 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-semibold text-indigo-900">Structure</span>
                <span className="text-xs text-indigo-500 ml-auto">Haiku · fast extraction</span>
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                <DataRow label="Title" value={profile.title} />
                <DataRow label="Subject" value={profile.subject_area} />
                <DataRow label="Grade" value={profile.grade_level} />
                <DataRow label="Duration" value={profile.estimated_duration_minutes ? `${profile.estimated_duration_minutes} min` : undefined} />
                <DataRow label="Type" value={profile.lesson_type} />
                <DataRow label="Sections" value={profile.lesson_flow?.length ? `${profile.lesson_flow.length} phases detected` : undefined} />
                {profile.lesson_flow && profile.lesson_flow.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.lesson_flow.map((phase, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                        {PHASE_LABELS[phase.phase] || phase.phase} ({phase.estimated_minutes}m)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pass 2: Pedagogy */}
            <div className="rounded-xl border border-purple-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-purple-50 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center">2</span>
                <span className="text-sm font-semibold text-purple-900">Pedagogy</span>
                <span className="text-xs text-purple-500 ml-auto">Sonnet · deep reasoning</span>
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                <DataRow label="Primary approach" value={profile.pedagogical_approach?.primary} />
                {profile.pedagogical_approach?.secondary && (
                  <DataRow label="Secondary" value={profile.pedagogical_approach.secondary} />
                )}
                {profile.pedagogical_approach?.reasoning && (
                  <p className="text-xs text-text-secondary italic leading-relaxed pl-2 border-l-2 border-purple-200">
                    {profile.pedagogical_approach.reasoning}
                  </p>
                )}
                <DataRow label="Scaffolding" value={profile.scaffolding_strategy?.model} />
                {profile.cognitive_load_curve && (
                  <DataRow label="Cognitive load" value={profile.cognitive_load_curve.description} />
                )}
                <DataRow label="Complexity" value={profile.complexity_level} />
                {profile.strengths && profile.strengths.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Strengths ({profile.strengths.length})</p>
                    <div className="space-y-1">
                      {profile.strengths.map((s, i) => (
                        <p key={i} className="text-xs text-text-secondary">
                          <span className="text-purple-500 mr-1">+</span>
                          <span className="font-medium text-text-primary">{s.what}</span>
                          {s.why_it_works && <span className="text-text-secondary"> — {s.why_it_works}</span>}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {profile.gaps && profile.gaps.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-amber-600 mb-1">Gaps ({profile.gaps.length})</p>
                    <div className="space-y-1">
                      {profile.gaps.map((g, i) => (
                        <p key={i} className="text-xs text-text-secondary">
                          <span className="text-amber-500 mr-1">!</span>
                          <span className="font-medium text-text-primary">{g.what}</span>
                          {g.suggestion && <span className="text-text-secondary"> — {g.suggestion}</span>}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pass 3: Design Teaching */}
            <div className="rounded-xl border border-emerald-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-emerald-50 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">3</span>
                <span className="text-sm font-semibold text-emerald-900">Design Teaching</span>
                <span className="text-xs text-emerald-500 ml-auto">Sonnet · specialist analysis</span>
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                {profile.classroom_management && (
                  <>
                    <DataRow label="Noise curve" value={profile.classroom_management.noise_level_curve} />
                    <DataRow label="Movement" value={profile.classroom_management.movement_required ? "Yes" : "No"} />
                    <DataRow label="Grouping" value={profile.classroom_management.grouping_progression} />
                    {profile.classroom_management.behaviour_hotspots && (
                      <DataRow label="Behaviour hotspots" value={profile.classroom_management.behaviour_hotspots} />
                    )}
                  </>
                )}
                {/* Workshop-specific data is extracted from lesson_flow phases */}
                {profile.prerequisites && profile.prerequisites.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Prerequisites</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.prerequisites.map((p, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs" title={p.why_needed}>
                          {p.skill_or_knowledge}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.skills_developed && profile.skills_developed.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Skills developed</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.skills_developed.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs">
                          {s.skill} <span className="opacity-60">({s.to_what_level})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.energy_and_sequencing && (
                  <>
                    <DataRow label="Starts as" value={profile.energy_and_sequencing.starts_as} />
                    <DataRow label="Ends as" value={profile.energy_and_sequencing.ends_as} />
                    <DataRow label="Ideal follows" value={profile.energy_and_sequencing.ideal_follows} />
                    <DataRow label="Avoid after" value={profile.energy_and_sequencing.avoid_after} />
                  </>
                )}
                {profile.narrative_role && (
                  <DataRow label="Narrative role" value={profile.narrative_role} />
                )}
              </div>
            </div>
          </div>
        </SectionToggle>
      </div>

      {/* ─── G. VERIFICATION FOOTER ─── */}
      {profileId && (
        <div className="px-6 py-4 border-t border-border bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              {/* Star Rating */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-secondary mr-1">Rate:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="text-lg leading-none transition"
                    disabled={verified}
                  >
                    <span className={
                      star <= (hoverRating || rating) ? "text-yellow-400" : "text-gray-300"
                    }>
                      ★
                    </span>
                  </button>
                ))}
              </div>

              {/* Metadata */}
              <span className="text-[10px] text-text-secondary/60">
                {profile.analysis_model} · v{profile.analysis_version}
                {profile.analysis_timestamp && ` · ${new Date(profile.analysis_timestamp).toLocaleDateString()}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onFeedback && (
                <button
                  onClick={onFeedback}
                  className="px-3 py-1.5 rounded-full border border-border text-text-secondary text-xs font-medium hover:bg-gray-100 transition flex items-center gap-1.5"
                  title="Record post-lesson reflection"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                  Feedback
                </button>
              )}
              {onQuickModify && (
                <button
                  onClick={onQuickModify}
                  className="px-3 py-1.5 rounded-full border border-border text-text-secondary text-xs font-medium hover:bg-gray-100 transition flex items-center gap-1.5"
                  title="Adapt this lesson on the fly"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  Quick Modify
                </button>
              )}
              {onReanalyse && (
                <button
                  onClick={onReanalyse}
                  className="px-3 py-1.5 rounded-full border border-border text-text-secondary text-xs font-medium hover:bg-gray-100 transition flex items-center gap-1.5"
                  title="Re-analyse with latest AI prompts"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
                  Re-analyse
                </button>
              )}
              {verified ? (
                <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Verified
                </span>
              ) : (
                <button
                  onClick={handleVerify}
                  disabled={verifying || rating === 0}
                  className="px-4 py-2 gradient-cta text-white rounded-full text-xs font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {verifying ? "Saving..." : "Looks Good ✓"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

/** Collapsible section wrapper */
function SectionToggle({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && !isOpen && (
            <span className="text-xs text-text-secondary">{subtitle}</span>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`text-text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Single phase row in the lesson flow table */
function PhaseRow({
  phase,
  index,
  cumulativeTime,
  isExpanded,
  onToggle,
}: {
  phase: LessonFlowPhase;
  index: number;
  cumulativeTime: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const energyColor = ENERGY_COLORS[phase.energy_state] || "#94A3B8";
  const cogColor = COGNITIVE_COLORS[phase.student_cognitive_level] || "#94A3B8";

  return (
    <div className={`rounded-lg border transition ${isExpanded ? "border-border bg-white shadow-sm" : "border-transparent hover:bg-gray-50"}`}>
      {/* Compact row */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
      >
        {/* Time */}
        <span className="text-[10px] font-mono text-text-secondary/60 w-10 text-right flex-shrink-0">
          {cumulativeTime}m
        </span>

        {/* Duration bar */}
        <span className="text-[10px] font-medium text-text-secondary w-8 flex-shrink-0">
          {phase.estimated_minutes}m
        </span>

        {/* Phase icon + name */}
        <span className="text-sm flex-shrink-0">{PHASE_EMOJI[phase.phase] || "📌"}</span>
        <span className="text-xs font-medium text-text-primary min-w-0 truncate flex-1">
          {phase.title || PHASE_LABELS[phase.phase] || phase.phase}
        </span>

        {/* Energy dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: energyColor }}
          title={ENERGY_LABELS[phase.energy_state]}
        />

        {/* Cognitive level */}
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0"
          style={{ backgroundColor: cogColor + "15", color: cogColor }}
        >
          {phase.student_cognitive_level}
        </span>

        {/* Expand chevron */}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`text-text-secondary/40 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3">
          {/* Purpose */}
          <div className="text-xs">
            <span className="font-medium text-text-primary">Purpose: </span>
            <span className="text-text-secondary">{phase.pedagogical_purpose}</span>
          </div>

          {/* Teacher Role + Check for Understanding */}
          <div className="flex flex-wrap gap-4 text-xs">
            <div>
              <span className="font-medium text-text-primary">Teacher: </span>
              <span className="text-text-secondary">{phase.teacher_role.replace(/_/g, " ")}</span>
            </div>
            {phase.check_for_understanding && (
              <div>
                <span className="font-medium text-text-primary">Check: </span>
                <span className="text-text-secondary">{phase.check_for_understanding}</span>
              </div>
            )}
          </div>

          {/* Scaffolding */}
          {(phase.scaffolding_present?.length > 0 || phase.scaffolding_removed?.length > 0) && (
            <div className="flex flex-wrap gap-4 text-xs">
              {phase.scaffolding_present?.length > 0 && (
                <div>
                  <span className="font-medium text-green-700">Scaffolding: </span>
                  <span className="text-text-secondary">{phase.scaffolding_present.join(", ")}</span>
                </div>
              )}
              {phase.scaffolding_removed?.length > 0 && (
                <div>
                  <span className="font-medium text-orange-600">Removed: </span>
                  <span className="text-text-secondary">{phase.scaffolding_removed.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {/* Differentiation */}
          {phase.differentiation && (
            <div className="bg-blue-50/50 rounded-md p-2.5 text-xs space-y-1">
              <span className="font-medium text-blue-800 text-[10px] uppercase tracking-wide">Differentiation</span>
              <p className="text-text-secondary"><span className="font-medium text-text-primary">Extension:</span> {phase.differentiation.extension}</p>
              <p className="text-text-secondary"><span className="font-medium text-text-primary">Support:</span> {phase.differentiation.support}</p>
              {phase.differentiation.ell_modification && (
                <p className="text-text-secondary"><span className="font-medium text-text-primary">ELL:</span> {phase.differentiation.ell_modification}</p>
              )}
            </div>
          )}

          {/* Materials & Tools */}
          {(phase.materials_needed?.length || phase.tools_required?.length) && (
            <div className="flex flex-wrap gap-4 text-xs">
              {phase.materials_needed?.length && (
                <div>
                  <span className="font-medium text-text-primary">Materials: </span>
                  <span className="text-text-secondary">{phase.materials_needed.join(", ")}</span>
                </div>
              )}
              {phase.tools_required?.length && (
                <div>
                  <span className="font-medium text-text-primary">Tools: </span>
                  <span className="text-text-secondary">{phase.tools_required.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {/* Safety */}
          {phase.safety_considerations?.length && (
            <div className="bg-red-50/50 rounded-md p-2.5 text-xs">
              <span className="font-medium text-red-700">⚠ Safety: </span>
              <span className="text-red-800">{phase.safety_considerations.join("; ")}</span>
            </div>
          )}

          {/* Station Rotation */}
          {phase.station_rotation && (
            <div className="bg-purple-50/50 rounded-md p-2.5 text-xs space-y-1">
              <span className="font-medium text-purple-800 text-[10px] uppercase tracking-wide">Station Rotation</span>
              <p className="text-text-secondary">{phase.station_rotation.stations} stations · {phase.station_rotation.minutes_per_station}m each</p>
              <p className="text-text-secondary"><span className="font-medium text-text-primary">Others do:</span> {phase.station_rotation.what_others_do}</p>
              <p className="text-text-secondary"><span className="font-medium text-text-primary">Signal:</span> {phase.station_rotation.rotation_management}</p>
            </div>
          )}

          {/* Transitions */}
          {(phase.transition_from_previous || phase.transition_to_next) && (
            <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
              {phase.transition_from_previous && (
                <p><span className="font-medium text-text-primary">From previous:</span> {phase.transition_from_previous}</p>
              )}
              {phase.transition_to_next && (
                <p><span className="font-medium text-text-primary">To next:</span> {phase.transition_to_next}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Energy state badge */
function EnergyBadge({ state, label }: { state: EnergyState; label: string }) {
  const color = ENERGY_COLORS[state] || "#94A3B8";
  const text = ENERGY_LABELS[state] || state;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-secondary">{label}:</span>
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-medium" style={{ color }}>
        {text}
      </span>
    </div>
  );
}

/** Simple key-value row for the 3-pass data view */
function DataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-text-secondary w-28 shrink-0 text-right pt-0.5">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}
