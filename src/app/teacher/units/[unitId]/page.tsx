"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import UnitThumbnailPicker from "@/components/teacher/UnitThumbnailPicker";
import {
  getPageList,
  normalizeContentData,
  isV3,
  isV4,
} from "@/lib/unit-adapter";
import { computeLessonBoundaries } from "@/lib/timeline";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import { renderCriterionLabel, getCriterionColor } from "@/lib/frameworks/render-helpers";
import type { FrameworkId } from "@/lib/frameworks/adapter";
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

// CRITERION_COLORS removed — now uses getCriterionColor() from render-helpers via FrameworkAdapter

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
  const [userId, setUserId] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  // QUARANTINED (3 Apr 2026) — Knowledge feedback disabled
  // const [showFeedback, setShowFeedback] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
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
      try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;
      setUserId(currentUserId);

      const { data } = await supabase
        .from("units")
        .select("*")
        .eq("id", unitId)
        .maybeSingle();
      setUnit(data);
      // Load thumbnail_url (may not exist if migration 052 not applied)
      setThumbnailUrl(data?.thumbnail_url ?? null);

      // Fetch ALL teacher's classes + which ones have this unit assigned + terms + versions
      const [classesRes, classUnitsRes, termsRes, versionsRes] = await Promise.all([
        supabase.from("classes").select("id, name, code, is_archived").order("name"),
        supabase.from("class_units").select("class_id, nm_config, term_id, forked_at").eq("unit_id", unitId),
        fetch("/api/teacher/school-calendar").then((r) => (r.ok ? r.json() : Promise.resolve({ terms: [] }))),
        fetch(`/api/teacher/units/versions?unitId=${unitId}`).then((r) => (r.ok ? r.json() : Promise.resolve(null))).catch(() => null),
      ]);

      // Fetch student counts only for assigned classes (scoped query, not unbounded)
      // Uses junction-first + legacy-fallback pattern (Lesson Learned #22)
      const assignedClassIds = (classUnitsRes.data || []).map((cu: { class_id: string }) => cu.class_id);
      let studentsRes: { data: { class_id: string }[] | null } = { data: [] };
      if (assignedClassIds.length > 0) {
        try {
          studentsRes = await supabase
            .from("class_students")
            .select("class_id")
            .in("class_id", assignedClassIds)
            .eq("is_active", true);
        } catch (e) {
          console.error("[unit detail] class_students query failed:", e);
        }

        // Legacy fallback: if junction returned null/empty, try students.class_id
        if (!studentsRes.data || studentsRes.data.length === 0) {
          try {
            const legacyRes = await supabase
              .from("students")
              .select("id, class_id")
              .in("class_id", assignedClassIds)
              .not("class_id", "is", null);
            if (legacyRes.data && legacyRes.data.length > 0) {
              studentsRes = { data: legacyRes.data.map((s: { class_id: string }) => ({ class_id: s.class_id })) };
            }
          } catch (e) {
            console.error("[unit detail] legacy students query failed:", e);
          }
        }
      }

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
          isForked: !!cu.forked_at,
          forkedAt: cu.forked_at as string | null,
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

      // Use version data from parallel fetch above
      if (versionsRes) {
        setVersions(versionsRes.versions || []);
        setCurrentVersion(versionsRes.currentVersion ?? 1);
        setForks(versionsRes.forks || []);
      }

      } catch (err) {
        console.error("[unit detail load]", err);
      } finally {
        setLoading(false);
      }
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
      <main className="max-w-6xl mx-auto px-4 py-8">
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
      <main className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-text-secondary">Unit not found.</p>
        <Link href="/teacher/units" className="text-accent-blue text-sm mt-2 inline-block">
          ← Back to units
        </Link>
      </main>
    );
  }

  // Ownership check: is this the teacher's own unit?
  const isOwner = userId != null && (
    (unit as any).author_teacher_id === userId || (unit as any).teacher_id === userId
  );

  async function handleFork() {
    setForking(true);
    try {
      const res = await fetch("/api/teacher/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fork", unitId }),
      });
      if (res.ok) {
        const { unitId: newId } = await res.json();
        if (newId) window.location.href = `/teacher/units/${newId}`;
      }
    } catch {
      // silent
    }
    setForking(false);
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
      // TODO FU-M: unit editor should derive framework from unit.curriculum_context or assigned classes
      const editorFramework: FrameworkId = "IB_MYP";
      const label = isJourneyUnit
        ? "Lessons"
        : page.criterion
          ? (() => {
              const r = renderCriterionLabel(page.criterion, editorFramework);
              return r.kind === "label" || r.kind === "implicit"
                ? `${r.short}: ${r.name}` : `Criterion ${page.criterion}`;
            })()
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
    <main className="max-w-6xl mx-auto px-4 py-8">
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

      {/* ── Two-column header: content + thumbnail ── */}
      <div className="flex gap-6 mt-1 mb-4">
        {/* Left: title, description, stats, actions */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">{unit.title}</h1>
          {(unit.description || unit.topic) && (
            <p className="text-[15px] text-text-secondary mt-2 leading-relaxed">
              {unit.description || unit.topic}
            </p>
          )}

          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-3 text-sm text-text-tertiary">
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
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {isOwner ? (
              <>
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
                    onClick={() => window.open(`/teacher/units/${unitId}/preview/${firstPageId}`, "_blank")}
                    className="px-4 py-2 rounded-xl bg-dark-blue text-white font-medium text-sm hover:bg-dark-blue/90 transition-colors shadow-sm flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Preview as Student
                  </button>
                )}
                {(() => {
                  const assigned = allClasses.filter((c) => c.assigned);
                  if (assigned.length > 0) {
                    return (
                      <Link
                        href={`/teacher/units/${unitId}/class/${assigned[0].id}/edit`}
                        className="px-4 py-2 rounded-xl border border-border text-text-primary font-medium text-sm hover:bg-surface-alt transition-colors flex items-center gap-2"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit Unit
                      </Link>
                    );
                  }
                  return null;
                })()}
                {/* Unit Details toggle */}
                <button
                  onClick={() => setShowMeta(!showMeta)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors flex items-center gap-2 ${
                    showMeta
                      ? "border-purple-200 bg-purple-50 text-purple-700"
                      : "border-border text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Details
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`transition-transform ${showMeta ? "rotate-180" : ""}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleFork}
                  disabled={forking}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 00-1.172-2.872L3 3" /><path d="m15 9 6-6" />
                  </svg>
                  {forking ? "Copying..." : "Copy to My Units"}
                </button>
                {firstPageId && (
                  <button
                    onClick={() => window.open(`/teacher/units/${unitId}/preview/${firstPageId}`, "_blank")}
                    className="px-4 py-2 rounded-xl border border-border text-text-primary font-medium text-sm hover:bg-surface-alt transition-colors flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Preview as Student
                  </button>
                )}
                {(unit as any).author_name && (
                  <span className="text-xs text-text-tertiary ml-1">
                    by {(unit as any).author_name}
                    {(unit as any).school_name && ` at ${(unit as any).school_name}`}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Unit Details — expands inline below action bar (owner only) */}
          {isOwner && showMeta && (
            <div className="mt-3">
              <UnitMetadataSection unit={unit} unitId={unitId} />
            </div>
          )}
        </div>

        {/* Right: thumbnail */}
        <div className="hidden sm:block flex-shrink-0 w-56">
          {isOwner ? (
            <UnitThumbnailPicker
              unitId={unitId}
              unitTitle={unit.title}
              currentThumbnailUrl={thumbnailUrl}
              onThumbnailChange={setThumbnailUrl}
            />
          ) : thumbnailUrl ? (
            <img src={thumbnailUrl} alt={unit.title} className="w-full rounded-xl object-cover" />
          ) : null}
        </div>
      </div>

      {/* ── Class assignment — horizontal row with toggles (owner only) ── */}
      {isOwner && <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Classes</h3>
          <span className="text-xs text-text-tertiary">
            {allClasses.filter((c) => c.assigned).length} of {allClasses.length} assigned
          </span>
        </div>
        {allClasses.length === 0 ? (
          <Link href="/teacher/classes" className="text-xs text-purple-600 hover:text-purple-700">
            Create a class →
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...allClasses].sort((a, b) => (a.assigned === b.assigned ? 0 : a.assigned ? -1 : 1)).map((cls) => (
              <button
                key={cls.id}
                onClick={() => toggleClassAssignment(cls.id, cls.assigned)}
                disabled={togglingClass === cls.id}
                className={`inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg text-sm transition-all ${
                  cls.assigned
                    ? "bg-purple-50 border border-purple-200 hover:bg-purple-100"
                    : "bg-white border border-gray-200 hover:bg-gray-50"
                } ${togglingClass === cls.id ? "opacity-50" : ""}`}
              >
                {/* Mini toggle */}
                <div className={`flex-shrink-0 w-7 h-4 rounded-full transition-colors duration-200 relative ${
                  cls.assigned ? "bg-purple-600" : "bg-gray-300"
                }`}>
                  <div className={`absolute top-[2px] left-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    cls.assigned ? "translate-x-3" : ""
                  }`} />
                </div>
                <span className={`font-medium ${cls.assigned ? "text-purple-700" : "text-text-secondary"}`}>
                  {cls.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* ----------------------------------------------------------------- */}
      {/* Lessons — always visible                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
          {isTimelineUnit ? lessons.length : pages.length}{" "}
          {isTimelineUnit || isJourneyUnit ? "Lessons" : "Pages"}
        </h2>

      {(isTimelineUnit ? (
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
                      page.criterion
                        ? getCriterionColor(page.criterion, "IB_MYP" as FrameworkId)
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

      {pages.length === 0 && lessons.length === 0 && (
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
      </div>

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

// ── SDG names ──
const SDG_NAMES: Record<string, string> = {
  "1": "No Poverty", "2": "Zero Hunger", "3": "Good Health", "4": "Quality Education",
  "5": "Gender Equality", "6": "Clean Water", "7": "Affordable Energy", "8": "Decent Work",
  "9": "Industry & Innovation", "10": "Reduced Inequalities", "11": "Sustainable Cities",
  "12": "Responsible Consumption", "13": "Climate Action", "14": "Life Below Water",
  "15": "Life on Land", "16": "Peace & Justice", "17": "Partnerships",
};

function UnitMetadataSection({ unit, unitId }: { unit: Unit; unitId: string }) {
  const supabase = createClient();

  // ── Materials ──
  const [materials, setMaterials] = useState<Array<{ name: string; quantity_per_student?: string; category?: string; alternatives?: string }>>(
    (unit as any).materials_list || []
  );
  const [newMat, setNewMat] = useState("");

  // ── Learning Outcomes ──
  const [outcomes, setOutcomes] = useState<Array<{ outcome: string; bloom_level?: string; measurable?: boolean }>>(
    (unit as any).learning_outcomes || []
  );
  const [newOutcome, setNewOutcome] = useState("");

  // ── Tags (arrays) ──
  const [sdgTags, setSdgTags] = useState<string[]>((unit as any).sdg_tags || []);
  const [crossLinks, setCrossLinks] = useState<string[]>((unit as any).cross_curricular_links || []);
  const [prereqs, setPrereqs] = useState<string[]>((unit as any).prerequisite_knowledge || []);
  const [newCross, setNewCross] = useState("");
  const [newPrereq, setNewPrereq] = useState("");

  // ── Save state ──
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await supabase.from("units").update({
        materials_list: materials.length > 0 ? materials : null,
        learning_outcomes: outcomes.length > 0 ? outcomes : null,
        sdg_tags: sdgTags.length > 0 ? sdgTags : null,
        cross_curricular_links: crossLinks.length > 0 ? crossLinks : null,
        prerequisite_knowledge: prereqs.length > 0 ? prereqs : null,
      }).eq("id", unitId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silent
    }
    setSaving(false);
  }

  return (
    <div className="mb-6 p-5 rounded-xl border border-border bg-white space-y-5">
      {/* ── Materials ── */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-2 block">Materials & Resources</label>
        {materials.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {materials.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-text-primary">{m.name}</span>
                {m.quantity_per_student && <span className="text-xs text-text-tertiary">×{m.quantity_per_student}/student</span>}
                {m.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{m.category}</span>}
                <button onClick={() => setMaterials(materials.filter((_, j) => j !== i))} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newMat} onChange={(e) => setNewMat(e.target.value)} placeholder="Add material (e.g. MDF sheets)"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
            onKeyDown={(e) => { if (e.key === "Enter" && newMat.trim()) { setMaterials([...materials, { name: newMat.trim() }]); setNewMat(""); } }} />
          <button onClick={() => { if (newMat.trim()) { setMaterials([...materials, { name: newMat.trim() }]); setNewMat(""); } }}
            className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50">Add</button>
        </div>
      </div>

      {/* ── Learning Outcomes ── */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-2 block">Learning Outcomes</label>
        {outcomes.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {outcomes.map((o, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-text-primary">{o.outcome}</span>
                {o.bloom_level && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{o.bloom_level}</span>}
                <button onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newOutcome} onChange={(e) => setNewOutcome(e.target.value)} placeholder="Add learning outcome"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
            onKeyDown={(e) => { if (e.key === "Enter" && newOutcome.trim()) { setOutcomes([...outcomes, { outcome: newOutcome.trim() }]); setNewOutcome(""); } }} />
          <button onClick={() => { if (newOutcome.trim()) { setOutcomes([...outcomes, { outcome: newOutcome.trim() }]); setNewOutcome(""); } }}
            className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50">Add</button>
        </div>
      </div>

      {/* ── SDG Tags ── */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-2 block">UN Sustainable Development Goals</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Array.from({ length: 17 }, (_, i) => String(i + 1)).map((sdg) => (
            <button key={sdg} onClick={() => setSdgTags(sdgTags.includes(sdg) ? sdgTags.filter((s) => s !== sdg) : [...sdgTags, sdg])}
              className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-colors ${
                sdgTags.includes(sdg)
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
              title={SDG_NAMES[sdg]}
            >
              SDG {sdg}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cross-Curricular Links ── */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-2 block">Cross-Curricular Links</label>
        {crossLinks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {crossLinks.map((l, i) => (
              <span key={i} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                {l} <button onClick={() => setCrossLinks(crossLinks.filter((_, j) => j !== i))} className="text-blue-400 hover:text-blue-600">✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newCross} onChange={(e) => setNewCross(e.target.value)} placeholder="e.g. Mathematics, Science, Visual Arts"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
            onKeyDown={(e) => { if (e.key === "Enter" && newCross.trim()) { setCrossLinks([...crossLinks, newCross.trim()]); setNewCross(""); } }} />
          <button onClick={() => { if (newCross.trim()) { setCrossLinks([...crossLinks, newCross.trim()]); setNewCross(""); } }}
            className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50">Add</button>
        </div>
      </div>

      {/* ── Prerequisite Knowledge ── */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-2 block">Prerequisite Knowledge</label>
        {prereqs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {prereqs.map((p, i) => (
              <span key={i} className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                {p} <button onClick={() => setPrereqs(prereqs.filter((_, j) => j !== i))} className="text-amber-400 hover:text-amber-600">✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newPrereq} onChange={(e) => setNewPrereq(e.target.value)} placeholder="e.g. Basic measurement skills"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
            onKeyDown={(e) => { if (e.key === "Enter" && newPrereq.trim()) { setPrereqs([...prereqs, newPrereq.trim()]); setNewPrereq(""); } }} />
          <button onClick={() => { if (newPrereq.trim()) { setPrereqs([...prereqs, newPrereq.trim()]); setNewPrereq(""); } }}
            className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50">Add</button>
        </div>
      </div>

      {/* ── Save button ── */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
          {saving ? "Saving..." : "Save Details"}
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
      </div>
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
  const [expanded, setExpanded] = useState(false);
  const hasDetails = subtitle || (activityHints.length > 0) || workshopPhases || (criterionTags.length > 0);

  // Strip the phase prefix from title if it duplicates the phase header
  // e.g. "Launch & Investigate — What Makes a Racer Fast? — Racer Analysis" → "Racer Analysis & First-Draft Design Brief"
  const parts = title.split(" — ");
  const shortTitle = parts.length >= 3 ? parts.slice(2).join(" — ") : (parts.length === 2 ? parts[1] : title);

  return (
    <div
      className={`rounded-lg border bg-white transition-colors ${expanded ? "border-purple-200" : "border-border hover:border-gray-300"}`}
    >
      {/* Collapsed row — always visible */}
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${hasDetails ? "cursor-pointer" : "cursor-default"}`}
      >
        {/* Lesson number badge */}
        {badgeId && badgeColor ? (
          <div
            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: badgeColor }}
          >
            {badgeId}
          </div>
        ) : (
          <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-[11px] font-semibold text-text-tertiary">
            {lessonNumber}
          </div>
        )}

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-text-primary truncate">{shortTitle}</span>

        {/* Right side: duration + criterion pips + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {minutes != null && (
            <span className="text-xs text-text-tertiary">{minutes}m</span>
          )}
          {criterionTags.length > 0 && (
            <div className="flex items-center gap-0.5">
              {criterionTags.map((tag) => (
                <div
                  key={tag}
                  className="w-3 h-1.5 rounded-full"
                  style={{ backgroundColor: getCriterionColor(tag, "IB_MYP" as FrameworkId) }}
                />
              ))}
            </div>
          )}
          {extensionCount != null && extensionCount > 0 && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-green-50 text-green-700">{extensionCount} ext</span>
          )}
          {hasDetails && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100 ml-9">
          {subtitle && (
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">{subtitle}</p>
          )}

          {workshopPhases && (
            <div className="mt-2">
              <MiniPhaseBar phases={{
                opening: workshopPhases.opening.durationMinutes,
                miniLesson: workshopPhases.miniLesson.durationMinutes,
                workTime: workshopPhases.workTime.durationMinutes,
                debrief: workshopPhases.debrief.durationMinutes,
              }} />
            </div>
          )}

          {activityHints.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {activityHints.map((hint, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-text-tertiary border border-gray-100">
                  {hint}
                </span>
              ))}
            </div>
          )}

          {criterionTags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {criterionTags.map((tag) => {
                const r = renderCriterionLabel(tag, "IB_MYP" as FrameworkId);
                const label = r.kind === "label" || r.kind === "implicit"
                  ? `${r.short}: ${r.name}` : tag;
                return (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{
                    backgroundColor: getCriterionColor(tag, "IB_MYP" as FrameworkId) + "18",
                    borderColor: getCriterionColor(tag, "IB_MYP" as FrameworkId) + "40",
                    color: getCriterionColor(tag, "IB_MYP" as FrameworkId),
                  }}>
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
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
