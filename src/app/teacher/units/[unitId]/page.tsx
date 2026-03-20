"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TeacherFeedbackForm from "@/components/teacher/knowledge/TeacherFeedbackForm";
import { NMConfigPanel, NMResultsPanel } from "@/components/nm";
import type { NMUnitConfig } from "@/lib/nm/constants";
import { DEFAULT_NM_CONFIG } from "@/lib/nm/constants";
import {
  getPageList,
  normalizeContentData,
  isV3,
  isV4,
} from "@/lib/unit-adapter";
import { computeLessonBoundaries } from "@/lib/timeline";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import type {
  Unit,
  UnitPage,
  UnitContentDataV4,
  TimelineActivity,
  ComputedLesson,
  PageContent,
  WorkshopPhases,
} from "@/types";

// ---------------------------------------------------------------------------
// Style constants (matching SkeletonReview)
// ---------------------------------------------------------------------------
const PHASE_COLORS: Record<string, string> = {
  Research: "bg-blue-100 text-blue-700",
  Ideation: "bg-purple-100 text-purple-700",
  Planning: "bg-indigo-100 text-indigo-700",
  "Skill Building": "bg-amber-100 text-amber-700",
  Making: "bg-green-100 text-green-700",
  Testing: "bg-orange-100 text-orange-700",
  Iteration: "bg-teal-100 text-teal-700",
  Evaluation: "bg-rose-100 text-rose-700",
  Presentation: "bg-pink-100 text-pink-700",
};

const CRITERION_COLORS: Record<string, string> = {
  A: "bg-blue-500",
  B: "bg-green-500",
  C: "bg-orange-500",
  D: "bg-purple-500",
};

function getPhaseColor(label: string): string {
  // Try exact match first, then partial
  if (PHASE_COLORS[label]) return PHASE_COLORS[label];
  for (const [k, v] of Object.entries(PHASE_COLORS)) {
    if (label.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "bg-gray-100 text-gray-600";
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function UnitDetailPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = use(params);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [nmConfig, setNmConfig] = useState<NMUnitConfig>(DEFAULT_NM_CONFIG);
  const [showLessons, setShowLessons] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("units")
        .select("*")
        .eq("id", unitId)
        .single();
      setUnit(data);
      if (data?.nm_config) {
        setNmConfig(data.nm_config as NMUnitConfig);
      }
      setLoading(false);
    }
    load();
  }, [unitId]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-16 bg-gray-50 rounded-xl" />
          <div className="h-6 bg-gray-100 rounded w-48" />
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-white border border-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!unit) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-text-secondary">Unit not found.</p>
        <Link href="/teacher/units" className="text-accent-blue text-sm mt-2 inline-block">
          ← Back to units
        </Link>
      </main>
    );
  }

  const normalized = normalizeContentData(unit.content_data);
  const pages = getPageList(unit.content_data);
  const isTimelineUnit = isV4(normalized);
  const isJourneyUnit = isV3(normalized);

  // For v4: compute lesson groupings + activities
  let lessons: ComputedLesson[] = [];
  let activityMap = new Map<string, TimelineActivity>();
  if (isTimelineUnit) {
    const v4 = normalized as UnitContentDataV4;
    lessons = computeLessonBoundaries(v4.timeline, v4.lessonLengthMinutes);
    activityMap = new Map(v4.timeline.map((a) => [a.id, a]));
  }

  const firstPageId = pages[0]?.id;

  // Build phase-grouped structure for v4
  type PhaseGroup = {
    label: string;
    groupKey: string;
    lessons: Array<{ lesson: ComputedLesson; activities: TimelineActivity[]; index: number }>;
  };

  const phaseGroups: PhaseGroup[] = [];
  if (isTimelineUnit) {
    let currentPhase = "";
    let groupCounter = 0;
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const activities = lesson.activityIds
        .map((id) => activityMap.get(id))
        .filter((a): a is TimelineActivity => a != null);
      const phaseLabel = activities.find((a) => a.phaseLabel)?.phaseLabel || "Lessons";
      if (phaseLabel !== currentPhase) {
        currentPhase = phaseLabel;
        groupCounter++;
        phaseGroups.push({ label: currentPhase, groupKey: `${currentPhase}-${groupCounter}`, lessons: [] });
      }
      phaseGroups[phaseGroups.length - 1].lessons.push({ lesson, activities, index: i });
    }
  }

  // Build phase-grouped structure for v2/v3
  type PageGroup = {
    label: string;
    groupKey: string;
    pages: Array<{ page: UnitPage; index: number }>;
  };

  const pageGroups: PageGroup[] = [];
  if (!isTimelineUnit) {
    let currentCriterion = "";
    let groupCounter = 0;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const label = isJourneyUnit
        ? "Lessons"
        : page.criterion
          ? `Criterion ${page.criterion}`
          : "Pages";
      if (label !== currentCriterion) {
        currentCriterion = label;
        groupCounter++;
        pageGroups.push({ label: currentCriterion, groupKey: `${currentCriterion}-${groupCounter}`, pages: [] });
      }
      pageGroups[pageGroups.length - 1].pages.push({ page, index: i });
    }
  }

  const totalMinutes = isTimelineUnit
    ? lessons.reduce((sum, l) => sum + l.totalMinutes, 0)
    : 0;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/teacher/units"
        className="text-xs text-text-secondary hover:text-text-primary transition mb-3 flex items-center gap-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Units
      </Link>

      {/* Title + description */}
      <h1 className="text-lg font-semibold text-text-primary">{unit.title}</h1>
      {unit.description && (
        <p className="text-sm text-text-secondary mt-1">{unit.description}</p>
      )}

      {/* Unit arc / description card (if available — mimics narrative arc) */}
      {unit.topic && (
        <div className="mt-4 mb-6 p-4 rounded-xl bg-gradient-to-r from-brand-purple/5 to-blue-50/50 border border-brand-purple/10">
          <p className="text-xs font-medium text-brand-purple mb-1">Topic</p>
          <p className="text-sm text-text-secondary leading-relaxed">{unit.topic}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-xs text-text-tertiary">
        <span>
          {isTimelineUnit ? lessons.length : pages.length}{" "}
          {isTimelineUnit || isJourneyUnit ? "lessons" : "pages"}
        </span>
        {totalMinutes > 0 && (
          <span>{Math.round(totalMinutes / 60)} hours total</span>
        )}
        {isTimelineUnit && phaseGroups.length > 1 && (
          <span>{phaseGroups.length} phases</span>
        )}
        {unit.grade_level && <span>Grade {unit.grade_level}</span>}
        {unit.duration_weeks && <span>{unit.duration_weeks} weeks</span>}
        <span className={unit.is_published ? "text-accent-green" : ""}>
          {unit.is_published ? "Published" : "Draft"}
        </span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {/* Teach This — primary action */}
        <Link
          href={`/teacher/teach/${unitId}`}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Teach This
        </Link>
        {firstPageId && (
          <button
            onClick={() => window.open(`/unit/${unitId}/${firstPageId}`, "_blank")}
            className="px-4 py-2 rounded-xl bg-dark-blue text-white font-medium text-sm hover:bg-dark-blue/90 transition-colors shadow-sm flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview as Student
          </button>
        )}
        <Link
          href={`/teacher/units/${unitId}/edit`}
          className="px-4 py-2 rounded-xl border border-border text-text-primary font-medium text-sm hover:bg-surface-alt transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Unit
        </Link>
        <button
          disabled
          className="px-4 py-2 rounded-xl border border-border text-text-secondary/40 font-medium text-sm cursor-not-allowed"
          title="Coming soon"
        >
          Generate PPTs
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-xl border border-border text-text-secondary/40 font-medium text-sm cursor-not-allowed"
          title="Coming soon"
        >
          Generate Worksheets
        </button>
        <button
          onClick={() => setShowFeedback(!showFeedback)}
          className={`px-4 py-2 rounded-xl border font-medium text-sm transition-colors flex items-center gap-2 ${
            showFeedback
              ? "border-accent-orange bg-accent-orange/5 text-accent-orange"
              : "border-border text-text-primary hover:bg-surface-alt"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {showFeedback ? "Hide Feedback" : "Give Feedback"}
        </button>
      </div>

      {/* Teacher feedback form (expandable) */}
      {showFeedback && (
        <div className="mb-6 p-5 rounded-xl border border-accent-orange/20 bg-accent-orange/5">
          <TeacherFeedbackForm
            unitId={unitId}
            lessonTitle={unit.title}
            onSubmit={() => setShowFeedback(false)}
            onClose={() => setShowFeedback(false)}
          />
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* New Metrics config panel                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6">
        <NMConfigPanel
          unitId={unitId}
          pages={pages.map((p, i) => ({ id: p.id, title: p.title || p.content?.title || `Page ${i + 1}` }))}
          currentConfig={nmConfig}
          onSave={async (config) => {
            const res = await fetch("/api/teacher/nm-config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ unitId, config }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.error("Failed to save NM config:", errData);
              throw new Error(errData.error || "Save failed");
            }
            setNmConfig(config);
          }}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* New Metrics results panel                                          */}
      {/* ----------------------------------------------------------------- */}
      {nmConfig.enabled && (
        <div className="mb-6">
          <NMResultsPanel unitId={unitId} />
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Lesson / page list — collapsible                                   */}
      {/* ----------------------------------------------------------------- */}
      <button
        onClick={() => setShowLessons(!showLessons)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-white hover:bg-surface-alt transition-colors mb-2"
      >
        <span className="text-sm font-medium text-text-primary">
          Unit Plan — {isTimelineUnit ? lessons.length : pages.length}{" "}
          {isTimelineUnit || isJourneyUnit ? "lessons" : "pages"}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-tertiary transition-transform ${showLessons ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showLessons && (isTimelineUnit ? (
        <div className="space-y-6">
          {phaseGroups.map((phase) => (
            <div key={phase.groupKey}>
              {/* Phase header */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getPhaseColor(phase.label)}`}>
                  {phase.label}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-text-tertiary">
                  {phase.lessons.length} lesson{phase.lessons.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Lesson cards */}
              <div className="space-y-1.5">
                {phase.lessons.map(({ lesson, activities }) => (
                  <LessonCard
                    key={lesson.lessonId}
                    lessonNumber={lesson.lessonNumber}
                    title={getLessonTitle(activities)}
                    subtitle={getLessonSubtitle(activities)}
                    minutes={lesson.totalMinutes}
                    criterionTags={getLessonCriterionTags(activities)}
                    activityHints={getActivityHints(activities)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {pageGroups.map((group) => (
            <div key={group.groupKey}>
              {/* Group header (only show if multiple groups) */}
              {pageGroups.length > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    group.label.startsWith("Criterion")
                      ? getPhaseColor(group.label)
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-text-tertiary">
                    {group.pages.length} {isJourneyUnit ? "lesson" : "page"}{group.pages.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {/* Page cards */}
              <div className="space-y-1.5">
                {group.pages.map(({ page, index }) => (
                  <LessonCard
                    key={page.id}
                    lessonNumber={index + 1}
                    title={page.title || page.content?.title || `Page ${index + 1}`}
                    subtitle={page.content?.learningGoal || undefined}
                    minutes={undefined}
                    criterionTags={getPageCriterionTags(page)}
                    activityHints={getPageActivityHints(page)}
                    badgeId={!isJourneyUnit && page.criterion ? page.id : undefined}
                    badgeColor={
                      page.criterion && (page.criterion as CriterionKey) in CRITERIA
                        ? CRITERIA[page.criterion as CriterionKey].color
                        : undefined
                    }
                    workshopPhases={(page.content as PageContent & { workshopPhases?: WorkshopPhases })?.workshopPhases || undefined}
                    extensionCount={((page.content as PageContent & { extensions?: unknown[] })?.extensions)?.length}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {showLessons && pages.length === 0 && lessons.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-text-secondary text-sm">No content yet.</p>
          <Link href={`/teacher/units/${unitId}/edit`} className="text-accent-blue text-xs mt-2 inline-block">
            Edit unit to add content
          </Link>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Lesson card — matches SkeletonReview LessonSkeletonCard style
// ---------------------------------------------------------------------------
/** Compact phase bar for read-only view of workshop timing */
function MiniPhaseBar({ phases }: { phases: { opening: number; miniLesson: number; workTime: number; debrief: number } }) {
  const total = phases.opening + phases.miniLesson + phases.workTime + phases.debrief;
  if (total === 0) return null;
  const segments = [
    { min: phases.opening, color: "#C4B5FD", label: "Open" },
    { min: phases.miniLesson, color: "#93C5FD", label: "Teach" },
    { min: phases.workTime, color: "#86EFAC", label: "Work" },
    { min: phases.debrief, color: "#FCD34D", label: "Debrief" },
  ];
  return (
    <div className="flex items-center gap-1 mt-1.5">
      <div className="flex rounded-full overflow-hidden h-1.5 flex-1">
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.min / total) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${s.min}m`} />
        ))}
      </div>
      <span className="text-[9px] text-text-tertiary">{total}m</span>
    </div>
  );
}

function LessonCard({
  lessonNumber,
  title,
  subtitle,
  minutes,
  criterionTags,
  activityHints,
  badgeId,
  badgeColor,
  workshopPhases,
  extensionCount,
}: {
  lessonNumber: number;
  title: string;
  subtitle?: string;
  minutes?: number;
  criterionTags: string[];
  activityHints: string[];
  badgeId?: string;
  badgeColor?: string;
  workshopPhases?: { opening: { durationMinutes: number }; miniLesson: { durationMinutes: number }; workTime: { durationMinutes: number }; debrief: { durationMinutes: number } };
  extensionCount?: number;
}) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-border hover:border-gray-300 bg-white transition-colors">
      {/* Lesson number badge */}
      {badgeId && badgeColor ? (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
          style={{ backgroundColor: badgeColor }}
        >
          {badgeId}
        </div>
      ) : (
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[11px] font-semibold text-text-secondary mt-0.5">
          {lessonNumber}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary leading-snug">{title}</p>
        {subtitle && (
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{subtitle}</p>
        )}

        {/* Workshop phase bar — shown when timing data exists */}
        {workshopPhases && (
          <MiniPhaseBar phases={{
            opening: workshopPhases.opening.durationMinutes,
            miniLesson: workshopPhases.miniLesson.durationMinutes,
            workTime: workshopPhases.workTime.durationMinutes,
            debrief: workshopPhases.debrief.durationMinutes,
          }} />
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5">
          {minutes != null && !workshopPhases && (
            <span className="text-[10px] text-text-tertiary">{minutes}min</span>
          )}

          {/* Criterion pips */}
          {criterionTags.length > 0 && (
            <div className="flex items-center gap-0.5">
              {criterionTags.map((tag) => (
                <div
                  key={tag}
                  className={`w-4 h-1.5 rounded-full ${CRITERION_COLORS[tag] || "bg-gray-300"}`}
                  title={`Criterion ${tag}`}
                />
              ))}
            </div>
          )}

          {/* Extension indicator */}
          {extensionCount != null && extensionCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
              {extensionCount} ext
            </span>
          )}

          {/* Activity hints */}
          {activityHints.length > 0 && (
            <span className="flex-1 text-[10px] text-text-tertiary truncate">
              {activityHints.slice(0, 3).join(" \u2022 ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers — extract display data from activities / pages
// ---------------------------------------------------------------------------

function getLessonTitle(activities: TimelineActivity[]): string {
  const core = activities.find((a) => a.role === "core");
  if (core?.phaseLabel) return `${core.phaseLabel} \u2014 ${core.title}`;
  return core?.title || activities[0]?.title || "Untitled Lesson";
}

function getLessonSubtitle(activities: TimelineActivity[]): string | undefined {
  const core = activities.find((a) => a.role === "core") || activities.find((a) => a.role === "intro");
  return core?.prompt;
}

function getLessonCriterionTags(activities: TimelineActivity[]): string[] {
  const tags = new Set<string>();
  for (const a of activities) {
    for (const t of a.criterionTags || []) {
      tags.add(t);
    }
  }
  return Array.from(tags).sort();
}

function getActivityHints(activities: TimelineActivity[]): string[] {
  return activities
    .filter((a) => a.role === "warmup" || a.role === "core")
    .map((a) => {
      const prefix = a.role === "warmup" ? "Warmup" : "Core";
      return `${prefix}: ${a.title}`;
    });
}

function getPageCriterionTags(page: UnitPage): string[] {
  const tags = new Set<string>();
  if (page.criterion) tags.add(page.criterion);
  for (const s of page.content?.sections || []) {
    for (const t of (s as { criterionTags?: string[] }).criterionTags || []) {
      tags.add(t);
    }
  }
  return Array.from(tags).sort();
}

function getPageActivityHints(page: UnitPage): string[] {
  return (page.content?.sections || [])
    .slice(0, 3)
    .map((s, i) => {
      const prompt = (s as { prompt?: string }).prompt || "";
      return prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt;
    })
    .filter(Boolean);
}
