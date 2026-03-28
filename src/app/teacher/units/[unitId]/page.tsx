"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TeacherFeedbackForm from "@/components/teacher/knowledge/TeacherFeedbackForm";
import UnitThumbnailPicker from "@/components/teacher/UnitThumbnailPicker";
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
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showLessons, setShowLessons] = useState(false);
  const [allClasses, setAllClasses] = useState<Array<{
    id: string;
    name: string;
    code: string;
    studentCount: number;
    isArchived: boolean;
    nmEnabled: boolean;
    assigned: boolean;
    isForked: boolean;
    termId: string | null;
    termName: string | null;
    termDates: string | null;
  }>>([]);
  const [togglingClass, setTogglingClass] = useState<string | null>(null);
  const [terms, setTerms] = useState<Array<{
    id: string;
    academic_year: string;
    term_name: string;
    term_order: number;
    start_date?: string;
    end_date?: string;
  }>>([]);
  // When a class is toggled ON, show inline term picker for that class
  const [pendingTermClass, setPendingTermClass] = useState<string | null>(null);
  const [pendingTermId, setPendingTermId] = useState<string | null>(null);
  const [savingTerm, setSavingTerm] = useState(false);

  // Version history
  const [versions, setVersions] = useState<Array<{
    version: number;
    label: string;
    created_at: string;
    source_class_id: string | null;
    sourceClassName: string | null;
  }>>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [forks, setForks] = useState<Array<{
    classId: string;
    forkedAt: string | null;
    forkedFromVersion: number | null;
  }>>([]);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("units")
        .select("*")
        .eq("id", unitId)
        .single();
      setUnit(data);
      // Load thumbnail_url (may not exist if migration 052 not applied)
      setThumbnailUrl(data?.thumbnail_url ?? null);

      // Fetch ALL teacher's classes + which ones have this unit assigned + terms
      const [classesRes, classUnitsRes, studentsRes, termsRes] = await Promise.all([
        supabase.from("classes").select("id, name, code, is_archived").order("name"),
        supabase.from("class_units").select("class_id, nm_config, term_id, content_data, forked_at").eq("unit_id", unitId),
        supabase.from("class_students").select("class_id").eq("is_active", true),
        fetch("/api/teacher/school-calendar").then((r) => (r.ok ? r.json() : Promise.resolve({ terms: [] }))),
      ]);

      // Store terms for the picker
      const loadedTerms = termsRes?.terms || [];
      setTerms(loadedTerms);

      // Build a term lookup for display
      const termLookup = new Map<string, { term_name: string; start_date?: string; end_date?: string }>();
      for (const t of loadedTerms) {
        termLookup.set(t.id, { term_name: t.term_name, start_date: t.start_date, end_date: t.end_date });
      }

      const assignedMap = new Map<string, { nm_config?: { enabled?: boolean }; term_id?: string | null; isForked?: boolean; forkedAt?: string | null }>();
      for (const cu of classUnitsRes.data || []) {
        assignedMap.set(cu.class_id, {
          nm_config: cu.nm_config as { enabled?: boolean } | undefined,
          term_id: cu.term_id || null,
          isForked: !!(cu as Record<string, unknown>).content_data,
          forkedAt: (cu as Record<string, unknown>).forked_at as string | null,
        });
      }

      const countByClass = new Map<string, number>();
      for (const s of studentsRes.data || []) {
        countByClass.set(s.class_id, (countByClass.get(s.class_id) || 0) + 1);
      }

      const unitNmConfig = data?.nm_config as { enabled?: boolean } | null;
      const classes = (classesRes.data || [])
        .filter((c) => !c.is_archived) // only show active classes in the toggle
        .map((cls) => {
          const cuData = assignedMap.get(cls.id);
          const termId = cuData?.term_id || null;
          const termData = termId ? termLookup.get(termId) : null;
          const termDates = termData?.start_date && termData?.end_date
            ? `${formatShortDate(termData.start_date)} – ${formatShortDate(termData.end_date)}`
            : null;
          return {
            id: cls.id,
            name: cls.name,
            code: cls.code,
            studentCount: countByClass.get(cls.id) || 0,
            isArchived: cls.is_archived ?? false,
            nmEnabled: cuData?.nm_config?.enabled ?? unitNmConfig?.enabled ?? false,
            assigned: assignedMap.has(cls.id),
            isForked: cuData?.isForked ?? false,
            termId,
            termName: termData?.term_name || null,
            termDates,
          };
        });

      setAllClasses(classes);

      // Fetch version history
      try {
        const versionsRes = await fetch(`/api/teacher/units/versions?unitId=${unitId}`);
        if (versionsRes.ok) {
          const vData = await versionsRes.json();
          setVersions(vData.versions || []);
          setCurrentVersion(vData.currentVersion ?? 1);
          setForks(vData.forks || []);
        }
      } catch {
        // Non-critical — versions section just won't show data
      }

      setLoading(false);
    }
    load();
  }, [unitId]);

  async function toggleClassAssignment(classId: string, currentlyAssigned: boolean) {
    setTogglingClass(classId);
    const supabase = createClient();

    if (currentlyAssigned) {
      // Remove assignment — also close any pending term picker
      if (pendingTermClass === classId) {
        setPendingTermClass(null);
        setPendingTermId(null);
      }
      await supabase
        .from("class_units")
        .delete()
        .eq("class_id", classId)
        .eq("unit_id", unitId);
    } else {
      // Create assignment
      await supabase
        .from("class_units")
        .upsert({
          class_id: classId,
          unit_id: unitId,
          is_active: true,
        });

      // If teacher has terms set up, show inline term picker
      if (terms.length > 0) {
        setPendingTermClass(classId);
        setPendingTermId(null);
      }
    }

    // Update local state
    setAllClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? { ...c, assigned: !currentlyAssigned, termId: null, termName: null, termDates: null }
          : c
      )
    );
    setTogglingClass(null);
  }

  async function assignTermToClass(classId: string, termId: string | null) {
    setSavingTerm(true);
    try {
      const res = await fetch("/api/teacher/class-units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, unitId, term_id: termId }),
      });
      if (res.ok) {
        const termData = termId ? terms.find((t) => t.id === termId) : null;
        const termDates = termData?.start_date && termData?.end_date
          ? `${formatShortDate(termData.start_date)} – ${formatShortDate(termData.end_date)}`
          : null;
        setAllClasses((prev) =>
          prev.map((c) =>
            c.id === classId
              ? { ...c, termId, termName: termData?.term_name || null, termDates }
              : c
          )
        );
      }
    } catch {
      // silently fail — teacher can set it later via Settings
    } finally {
      setSavingTerm(false);
      setPendingTermClass(null);
      setPendingTermId(null);
    }
  }

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
      <h1 className="text-2xl font-bold text-text-primary mt-1">{unit.title}</h1>
      {unit.description && (
        <p className="text-base text-text-secondary mt-2 leading-relaxed">{unit.description}</p>
      )}

      {/* Cover image picker */}
      <div className="mt-4 mb-2">
        <UnitThumbnailPicker
          unitId={unitId}
          unitTitle={unit.title}
          currentThumbnailUrl={thumbnailUrl}
          onThumbnailChange={setThumbnailUrl}
        />
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mt-3 mb-5 text-sm text-text-tertiary">
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
          href={(() => {
            const assigned = allClasses.filter((c) => c.assigned);
            return assigned.length > 0
              ? `/teacher/units/${unitId}/class/${assigned[0].id}/edit`
              : `/teacher/units/${unitId}/edit`;
          })()}
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
      {/* Lesson / page list — collapsible                                   */}
      {/* ----------------------------------------------------------------- */}
      <button
        onClick={() => setShowLessons(!showLessons)}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-white hover:bg-surface-alt transition-colors mb-3"
      >
        <div className="text-left">
          <span className="text-base font-semibold text-text-primary">
            Unit Plan — {isTimelineUnit ? lessons.length : pages.length}{" "}
            {isTimelineUnit || isJourneyUnit ? "lessons" : "pages"}
          </span>
          {unit.topic && (
            <span className="block text-xs text-text-tertiary mt-0.5">{unit.topic}</span>
          )}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-tertiary transition-transform flex-shrink-0 ${showLessons ? "rotate-180" : ""}`}
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
          <Link
            href={(() => {
              const assigned = allClasses.filter((c) => c.assigned);
              return assigned.length > 0
                ? `/teacher/units/${unitId}/class/${assigned[0].id}/edit`
                : `/teacher/units/${unitId}/edit`;
            })()}
            className="text-accent-blue text-xs mt-2 inline-block"
          >
            Edit unit to add content
          </Link>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Version History (P1)                                                  */}
      {/* ----------------------------------------------------------------- */}
      {(versions.length > 0 || forks.length > 0) && (
        <div className="mt-8 mb-6">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2 hover:text-purple-700 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Versions
            <span className="text-sm font-normal text-text-tertiary ml-1">
              (v{currentVersion}{forks.length > 0 ? `, ${forks.length} fork${forks.length !== 1 ? "s" : ""}` : ""})
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`ml-auto text-gray-400 transition-transform ${showVersions ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showVersions && (
            <div className="space-y-2">
              {/* Original version (always present) */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-xs font-bold text-gray-600">v1</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-primary">Original</span>
                  <span className="text-xs text-text-tertiary ml-2">Created with unit</span>
                </div>
                {currentVersion === 1 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Current</span>
                )}
              </div>

              {/* Saved versions */}
              {versions
                .filter((v) => v.version > 1)
                .sort((a, b) => b.version - a.version)
                .map((v) => (
                  <div key={v.version} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50 text-xs font-bold text-purple-700">v{v.version}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-text-primary">{v.label}</span>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        {v.sourceClassName && (
                          <span>From <span className="font-medium">{v.sourceClassName}</span> &middot; </span>
                        )}
                        {v.created_at && new Date(v.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {v.version === currentVersion && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Current</span>
                    )}
                  </div>
                ))}

              {/* Active forks */}
              {forks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-text-tertiary mb-2 uppercase tracking-wide">Active Class Forks</p>
                  {forks.map((f) => {
                    const cls = allClasses.find((c) => c.id === f.classId);
                    return (
                      <div key={f.classId} className="flex items-center gap-2 py-1.5 text-xs">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" /><path d="M12 12v3" /></svg>
                        <span className="font-medium text-text-primary">{cls?.name || f.classId}</span>
                        <span className="text-text-tertiary">
                          forked from v{f.forkedFromVersion || 1}
                          {f.forkedAt && ` on ${new Date(f.forkedAt).toLocaleDateString()}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Classes — toggle assignment                                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="mt-8 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            Classes
            <span className="text-sm font-normal text-text-tertiary ml-1">
              ({allClasses.filter((c) => c.assigned).length} assigned)
            </span>
          </h2>
          <p className="text-xs text-text-tertiary">Toggle to assign or unassign</p>
        </div>

        {allClasses.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-border text-center">
            <p className="text-sm text-text-secondary">No classes yet.</p>
            <Link href="/teacher/classes" className="text-xs text-purple-600 hover:text-purple-700 mt-1 inline-block">
              Create a class →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show assigned classes first, then unassigned */}
            {(() => {
              const sorted = [...allClasses].sort((a, b) => (a.assigned === b.assigned ? 0 : a.assigned ? -1 : 1));
              const assignedCount = sorted.filter((c) => c.assigned).length;
              const unassignedCount = sorted.length - assignedCount;
              const allAssigned = unassignedCount === 0 && assignedCount > 0;
              return (<>
                {sorted.map((cls, idx) => (
                <div key={cls.id}>
                  {/* Divider between assigned and unassigned */}
                  {idx === assignedCount && unassignedCount > 0 && assignedCount > 0 && (
                    <div className="flex items-center gap-2 py-2 mt-2">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Not assigned</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}
                <div
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    cls.assigned
                      ? "border-purple-200 bg-purple-50/50"
                      : "border-border bg-white"
                  } ${pendingTermClass === cls.id ? "rounded-b-none border-b-0" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleClassAssignment(cls.id, cls.assigned)}
                      disabled={togglingClass === cls.id}
                      className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 ${
                        cls.assigned ? "bg-purple-600" : "bg-gray-200"
                      } ${togglingClass === cls.id ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          cls.assigned ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate block">{cls.name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-text-tertiary mt-0.5 flex-wrap">
                        <span>{cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}</span>
                        {cls.nmEnabled && cls.assigned && (
                          <>
                            <span className="text-text-tertiary/40">·</span>
                            <span className="text-pink-500 font-medium">NM</span>
                          </>
                        )}
                        {cls.isForked && cls.assigned && (
                          <>
                            <span className="text-text-tertiary/40">·</span>
                            <span className="text-amber-600 font-medium">Customized</span>
                          </>
                        )}
                        {cls.assigned && cls.termName && (
                          <>
                            <span className="text-text-tertiary/40">·</span>
                            <span className="text-purple-600 font-medium">{cls.termName}</span>
                            {cls.termDates && (
                              <span className="text-text-tertiary">{cls.termDates}</span>
                            )}
                          </>
                        )}
                        {cls.assigned && !cls.termName && terms.length > 0 && (
                          <>
                            <span className="text-text-tertiary/40">·</span>
                            <button
                              onClick={() => {
                                setPendingTermClass(cls.id);
                                setPendingTermId(null);
                              }}
                              className="text-amber-600 font-medium hover:text-amber-700 transition-colors"
                            >
                              Assign term
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {cls.assigned && (
                    <Link
                      href={`/teacher/units/${unitId}/class/${cls.id}`}
                      className="text-xs text-purple-600 hover:text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-50 transition flex-shrink-0"
                    >
                      Settings →
                    </Link>
                  )}
                </div>

                {/* Inline term picker — shown after toggling ON or clicking "Assign term" */}
                {pendingTermClass === cls.id && (
                  <div className="px-4 py-3 bg-purple-50/80 border border-purple-200 border-t-0 rounded-b-xl flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-text-secondary flex-shrink-0">Term:</label>
                    <select
                      value={pendingTermId || ""}
                      onChange={(e) => setPendingTermId(e.target.value || null)}
                      className="text-xs px-2 py-1.5 rounded-lg border border-purple-200 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-300 flex-1 min-w-[140px] max-w-[260px]"
                    >
                      <option value="">Select a term…</option>
                      {/* Group by academic year */}
                      {Array.from(new Set(terms.map((t) => t.academic_year))).map((year) => (
                        <optgroup key={year} label={year}>
                          {terms
                            .filter((t) => t.academic_year === year)
                            .sort((a, b) => a.term_order - b.term_order)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.term_name}
                                {t.start_date ? ` (${formatShortDate(t.start_date)})` : ""}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      onClick={() => assignTermToClass(cls.id, pendingTermId)}
                      disabled={savingTerm}
                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {savingTerm ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setPendingTermClass(null);
                        setPendingTermId(null);
                      }}
                      className="text-xs text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
              ))}
              {/* Helper when all classes are already assigned */}
              {allAssigned && (
                <p className="text-xs text-text-tertiary text-center pt-3 pb-1">
                  All your classes are assigned to this unit.{" "}
                  <Link href="/teacher/dashboard" className="text-purple-600 hover:text-purple-700 font-medium">
                    Create a new class
                  </Link>{" "}
                  from your dashboard to assign more.
                </p>
              )}
              </>);
            })()}
          </div>
        )}
      </div>
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
// Helpers — date formatting
// ---------------------------------------------------------------------------

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
