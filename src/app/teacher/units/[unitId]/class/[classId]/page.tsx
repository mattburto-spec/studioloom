"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
// Phase 3.6 Step 4 cutover sweep — orphan imports dropped. The canvas
// re-mounts these components inside their respective drawers (NM* via
// MetricsDrawer, BadgesTab via SafetyDrawer, OpenStudioClassView via
// OpenStudioDrawer, LessonSchedule will land in the still-homeless
// Settings re-homing follow-up). Surface-level imports here would just
// pin tsc to dead code on this file.
//
// Still imported from @/components/nm: ObservationSnap (mounted at the
// bottom of the page for the row-kebab + metrics-dot "Record NM
// observation" triggers — the only NM surface that lives on the canvas
// proper, not behind a drawer).
import { ObservationSnap } from "@/components/nm";
import type { ScheduleOverrides } from "@/components/teacher/LessonSchedule";
import type { NMUnitConfig } from "@/lib/nm/constants";
import { DEFAULT_NM_CONFIG, AGENCY_ELEMENTS } from "@/lib/nm/constants";
import { getPageList } from "@/lib/unit-adapter";
import type { Unit, UnitPage, UnitContentData, StudentProgress } from "@/types";
import type { AssessmentRecordRow } from "@/types/assessment";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";
import { worstIntegrityLevel } from "@/lib/integrity/analyze-integrity";
import StudentDrawer from "@/components/teacher/class-hub/StudentDrawer";
import StudentRosterDrawer from "@/components/teacher/class-hub/StudentRosterDrawer";
import SafetyDrawer from "@/components/teacher/class-hub/SafetyDrawer";
import OpenStudioDrawer from "@/components/teacher/class-hub/OpenStudioDrawer";
import MetricsDrawer from "@/components/teacher/class-hub/MetricsDrawer";
import ChangeUnitModal from "@/components/teacher/class-hub/ChangeUnitModal";
import GalleryDrawer from "@/components/teacher/class-hub/GalleryDrawer";
import ClassShareChips from "@/components/teacher/class-hub/ClassShareChips";
import KebabMenu, { type KebabMenuSection } from "@/components/teacher/class-hub/KebabMenu";

// ---------------------------------------------------------------------------
// DT Class Canvas — single unified per-class surface for the teacher.
// ---------------------------------------------------------------------------
// Replaces the 7-tab Class Hub (16 May 2026 rebuild — see audit Section F /
// Phase 3.1). Layout: canvas-header + canvas-grid (main column + 360px
// sticky side rail). Main column = lesson hero (3.3), student grid (3.1),
// gallery strip (3.5). Side rail = Marking / Open Studio / Class Metrics /
// Safety summary cards (3.2). Kebab on the header carries class + unit
// actions (3.4). Surfaces previously living on Students / Gallery / Open
// Studio / New Metrics / Badges / Settings tabs now open as drawers /
// sub-routes wired through the side-rail card CTAs and the kebab.
// URL: /teacher/units/[unitId]/class/[classId]
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Progress tab types
// ---------------------------------------------------------------------------

interface ProgressCell {
  status: "not_started" | "in_progress" | "complete";
  hasResponses: boolean;
  timeSpent: number;
  hasIntegrityData: boolean;
  /**
   * Worst integrity level across all sections in this page's response
   * metadata. Round 8 (6 May 2026): the dot used to render whenever
   * data was collected (always blue), which made every actively-used
   * lesson look "flagged". Now only dots when there's a real concern.
   *   - "high" or null  → no dot (green/clean)
   *   - "medium"        → amber dot (warning)
   *   - "low"           → rose dot (concern)
   */
  integrityLevel: "high" | "medium" | "low" | null;
}

type GradingStatus = "ungraded" | "draft" | "published";
type StudentProgressMap = Record<string, Record<string, ProgressCell>>;

// ---------------------------------------------------------------------------
// Student grid — filter chip definitions + today-dot helpers (Phase 3.1).
// Kept at module scope so subsequent sub-phases (3.2 side rail, 3.5 gallery)
// can reuse the helpers without refactoring + so unit tests can import.
// ---------------------------------------------------------------------------
const STUDENT_FILTERS = [
  { id: "all", label: "All students" },
  { id: "marking", label: "Marking due" },
  { id: "flagged", label: "Flagged" },
  { id: "studio", label: "In Open Studio" },
] as const;
type StudentFilterId = (typeof STUDENT_FILTERS)[number]["id"];
type MarkingKind = "graded" | "draft" | "to_mark" | "clear" | "none";

// G10 sign-off: green = active in last 24h, yellow = last 3 days, red = ≥3 days.
function todayDotClass(lastActiveISO: string | null): string {
  if (!lastActiveISO) return "bg-gray-300";
  const ageMs = Date.now() - new Date(lastActiveISO).getTime();
  const dayMs = 86_400_000;
  if (ageMs < dayMs) return "bg-emerald-500";
  if (ageMs < 3 * dayMs) return "bg-amber-400";
  return "bg-rose-500";
}

function todayDotLabel(lastActiveISO: string | null): string {
  if (!lastActiveISO) return "No activity yet";
  const ageMs = Date.now() - new Date(lastActiveISO).getTime();
  const dayMs = 86_400_000;
  if (ageMs < dayMs) return "Active in the last 24 hours";
  if (ageMs < 3 * dayMs) return "Active in the last 3 days";
  return "Inactive for 3+ days";
}

// Phase 3.6 Step 3 — avatar initials that don't collide.
// Smoke from Phase 3.1 + Phase 3.2 showed two students with usernames
// starting "H" (e.g. HH + HP) both rendering as a single "H" avatar —
// indistinguishable at a glance. This helper widens to 2 chars when
// available and prefers the first letter of each word when the
// display_name has multiple words.
//   "Henry Park"     → HP
//   "Bea Martinez"   → BM
//   "Aiden Chen"     → AC
//   "Alex"           → AL  (single-word display_name)
//   "HH" / "hh"      → HH  (username fallback)
//   "z"              → Z   (single-char username)
//   ""               → ?
export function studentInitials(displayName: string | null | undefined, username: string | null | undefined): string {
  const dn = (displayName ?? "").trim();
  if (dn) {
    const words = dn.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return dn.slice(0, 2).toUpperCase();
  }
  const un = (username ?? "").trim();
  if (un) return un.slice(0, 2).toUpperCase();
  return "?";
}

function lastActiveLabel(iso: string | null): string {
  if (!iso) return "never active";
  const ageMs = Date.now() - new Date(iso).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ageMs < hour) return `${Math.max(1, Math.round(ageMs / minute))} min ago`;
  if (ageMs < day) return `${Math.round(ageMs / hour)} hr ago`;
  return `${Math.round(ageMs / day)} d ago`;
}

// Phase 3.3 — "Today's lesson" derivation. Picks the page the class
// is most likely working on right now:
//   1. The lowest-index page where ANY student is currently
//      in_progress (active focus).
//   2. Fallback: the lowest-index page where NOT ALL students are
//      complete (the next page to teach).
//   3. Final fallback: page 0.
// No schedule fetch — works without a configured timetable. A
// schedule-driven derivation (use today's calendar date → mapped
// page) is a Phase 3.4 follow-up.
function deriveTodaysLessonIndex(
  unitPages: UnitPage[],
  progressMap: Record<string, Record<string, { status: "not_started" | "in_progress" | "complete" }>>,
  studentIds: string[],
): number {
  if (unitPages.length === 0) return 0;
  // Pass 1: any student in_progress
  for (let i = 0; i < unitPages.length; i++) {
    const pageId = unitPages[i].id;
    const anyInProgress = studentIds.some(
      (sid) => progressMap[sid]?.[pageId]?.status === "in_progress",
    );
    if (anyInProgress) return i;
  }
  // Pass 2: first not-all-complete
  for (let i = 0; i < unitPages.length; i++) {
    const pageId = unitPages[i].id;
    const allComplete = studentIds.length > 0 && studentIds.every(
      (sid) => progressMap[sid]?.[pageId]?.status === "complete",
    );
    if (!allComplete) return i;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// (Phase 3.5 Step 1 — GalleryTab function lifted to
// src/components/teacher/class-hub/GalleryDrawer.tsx. Triggered by
// the canvas gallery-strip "Open gallery →" CTA + ?tab=gallery
// legacy compat. The inline function lived here from before the
// canvas rebuild but was orphan from Phase 3.1 Step 2 onward.)

export default function ClassHubPage({
  params,
}: {
  params: Promise<{ unitId: string; classId: string }>;
}) {
  const { unitId, classId } = use(params);
  const router = useRouter();
  // Guard against the legacy ?tab compat handler firing twice (React strict
  // mode double-mount in dev, plus the effect's deps would re-trigger if
  // we depended on `students`). Module-mount-once contract.
  const legacyTabCompatFired = useRef(false);

  // Shared data (loaded once)
  const [unit, setUnit] = useState<Unit | null>(null);
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [classFramework, setClassFramework] = useState<string>("IB_MYP");
  const [students, setStudents] = useState<Array<{ id: string; display_name: string; username: string; graduation_year?: string | null }>>([]);
  const [pages, setPages] = useState<Array<{ id: string; title: string }>>([]);
  const [unitPages, setUnitPages] = useState<UnitPage[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings tab state
  const [nmConfig, setNmConfig] = useState<NMUnitConfig>(DEFAULT_NM_CONFIG);
  const [globalNmEnabled, setGlobalNmEnabled] = useState(false);
  const [terms, setTerms] = useState<Array<{ id: string; academic_year: string; term_name: string; term_order: number; start_date?: string; end_date?: string }>>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [savingTerm, setSavingTerm] = useState(false);
  const [termMessage, setTermMessage] = useState("");
  const [scheduleInfo, setScheduleInfo] = useState<{
    lessonCount: number | null;
    nextClass: { dateISO: string; dayOfWeek: string; cycleDay: number; periodNumber?: number; room?: string; formatted: string; short: string } | null;
    reason?: string;
  } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverrides>({});

  // Student grid state (Phase 3.1)
  const [progressMap, setProgressMap] = useState<StudentProgressMap>({});
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  // Per-student max(updated_at) — derived from the same /student_progress
  // query that builds progressMap, so the Today dot doesn't need its own
  // fetch. Map<studentId, ISO timestamp>.
  const [lastActiveMap, setLastActiveMap] = useState<Record<string, string>>({});
  // Filter chip state for the grid header. Default "all". The "studio"
  // chip currently filters to empty — Open Studio per-student data wires
  // in Phase 3.2 alongside the side-rail card.
  const [studentFilter, setStudentFilter] = useState<StudentFilterId>("all");
  const [gradingStatusMap, setGradingStatusMap] = useState<Record<string, GradingStatus>>({});
  // Per-student draft `assessed_at` ISO timestamp (Phase 3.2 Step 1).
  // Populated alongside gradingStatusMap from the same /api/teacher/assessments
  // response so the Marking side-rail card can show "oldest N days" without
  // a second fetch.
  const [oldestDraftAtMap, setOldestDraftAtMap] = useState<Record<string, string>>({});
  // Open Studio unlock/revoke is managed entirely in the Open Studio tab
  const [badgeRequirements, setBadgeRequirements] = useState<Array<{ badge_id: string; badge_name: string; badge_slug: string; is_required: boolean }>>([]);
  const [badgeStatusMap, setBadgeStatusMap] = useState<Record<string, Array<{ badge_id: string; status: "earned" | "failed" | "not_attempted"; score: number | null }>>>({});
  const [nmObserveStudent, setNmObserveStudent] = useState<{ id: string; name: string } | null>(null);

  // Student Drawer state — `drawerPageId` (Phase 3.1 Step 4) carries an
  // optional pageId qualifier that the drawer's Recent Work section uses
  // to auto-scroll + highlight a specific page entry on mount. Used by:
  //   - legacy ?tab compat (Step 4) when the URL carries &page=... too
  //   - future per-page deep-links (Phase 3.5 gallery / 3.6 cutover)
  // For 3.1 the grid name + progress-bar clicks set drawerStudent with
  // pageId=null (whole-student snapshot). The pageId capability is in
  // place so deep-links don't need a follow-up StudentDrawer refactor.
  const [drawerStudent, setDrawerStudent] = useState<{ id: string; name: string } | null>(null);
  const [drawerPageId, setDrawerPageId] = useState<string | null>(null);

  // Add-student drawer (Phase 3.1 Step 4) — opens the lifted
  // StudentRosterDrawer wrapping the old StudentsTab logic.
  const [rosterDrawerOpen, setRosterDrawerOpen] = useState(false);

  // Side-rail card drawers (Phase 3.2). Each opens via the matching
  // card CTA and mounts the existing tab content as-is inside drawer
  // chrome. Marking is excluded — it routes externally to /teacher/marking.
  const [safetyDrawerOpen, setSafetyDrawerOpen] = useState(false);
  const [openStudioDrawerOpen, setOpenStudioDrawerOpen] = useState(false);

  // Open Studio per-student status (Phase 3.2 Step 3). One fetch on
  // mount populates both:
  //   1. The per-row "Studio" pill in the student grid (replaces the
  //      Step 3 placeholder "—").
  //   2. The side-rail Open Studio card's headline + named student.
  // The OpenStudioDrawer (which wraps OpenStudioClassView) still runs
  // its own fetch on open — necessary to handle grant/revoke mutations
  // without a parent-state plumb. Acceptable: one redundant fetch only
  // when the drawer is opened.
  const [openStudioStatusMap, setOpenStudioStatusMap] = useState<
    Record<string, { status: "locked" | "unlocked" | "revoked"; unlockedAt: string | null }>
  >({});

  // Metrics card + per-row Metrics dots (Phase 3.2 Step 4). Per-student
  // average teacher-observation rating, derived from a single
  // /api/teacher/nm-results fetch (only runs when nmConfig.enabled).
  // The MetricsDrawer (NMResultsPanel + NMElementsPanel) still runs
  // its own fetch on open — same pattern as OpenStudioDrawer.
  const [metricsByStudent, setMetricsByStudent] = useState<
    Record<string, { avgTeacher: number | null; elementCount: number }>
  >({});
  const [metricsByElement, setMetricsByElement] = useState<
    Record<string, number>
  >({});
  const [metricsDrawerOpen, setMetricsDrawerOpen] = useState(false);

  // Change-unit modal (Phase 3.3 Step 2). Triggered by the orange
  // lesson-hero "Change unit" button. Wires the atomic
  // public.set_active_unit RPC via the setActiveUnit helper.
  const [changeUnitModalOpen, setChangeUnitModalOpen] = useState(false);

  // Gallery strip + drawer (Phase 3.5). One fetch on mount populates
  // the strip tiles + the drawer's initial state (drawer still re-fetches
  // on open so mutations stay self-contained — same pattern as
  // OpenStudioDrawer + MetricsDrawer).
  const [galleryRounds, setGalleryRounds] = useState<Array<{
    id: string;
    title?: string | null;
    display_mode?: string | null;
    submission_count?: number | null;
    state?: string | null;
  }>>([]);
  const [galleryDrawerOpen, setGalleryDrawerOpen] = useState(false);

  // -----------------------------------------------------------------------
  // Legacy ?tab=... compat (Phase 3.1 Step 4, G12 sign-off).
  // -----------------------------------------------------------------------
  // The dashboard route + old bookmarks still mint ?tab=progress / grade /
  // students / metrics / badges / gallery / studio / settings URLs (plus
  // the legacy aliases safety / open-studio / attention). Fire once on
  // mount, route to the matching canvas surface where one exists, then
  // drop the param so the URL stops carrying stale tab state.
  //
  // Surfaces that have landed by Phase 3.1 Step 4:
  //   • tab=students            → open StudentRosterDrawer
  //   • tab=grade               → redirect to /teacher/marking
  //   • tab=progress (or none)  → no-op (canvas IS the progress view)
  //
  // Deferred surfaces (no-op until the matching phase ships):
  //   • tab=metrics             → side-rail metrics card (Phase 3.2)
  //   • tab=badges              → side-rail safety card (Phase 3.2)
  //   • tab=gallery             → gallery strip (Phase 3.5)
  //   • tab=studio              → side-rail Open Studio card (Phase 3.2)
  //   • tab=settings            → /teacher/classes/[classId]/settings (Phase 3.4)
  //
  // Legacy aliases (mirrored from the old activeTab initializer):
  //   • tab=safety              → badges (deferred above)
  //   • tab=open-studio         → studio (deferred above)
  //   • tab=attention           → metrics (deferred above)
  //
  // Optional deep-link qualifiers:
  //   • &student=<id>&page=<pageId>  → open StudentDrawer for that
  //     student with the pageId qualifier (works regardless of which
  //     tab= value is set). Phase 3.5 / 3.6 will mint these for
  //     per-page notification deep-links.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (legacyTabCompatFired.current) return;
    // Wait for the roster to load so we can resolve student deep-links
    // to display names. If `students` arrives empty (loader finished but
    // class has no enrolment), fire anyway to clear the URL.
    if (loading) return;
    legacyTabCompatFired.current = true;

    const url = new URL(window.location.href);
    const tab = url.searchParams.get("tab");
    const studentParam = url.searchParams.get("student");
    const pageParam = url.searchParams.get("page");

    // ?tab=grade → external redirect (preserve class+unit context)
    if (tab === "grade") {
      router.replace(`/teacher/marking?class=${classId}&unit=${unitId}`);
      return;
    }

    // ?tab=settings → sub-route lands in Phase 3.4. For 3.1, no-op
    // (drop the param, stay on canvas). The kebab "Class settings…"
    // item from Phase 3.4 will be the canonical entry point.
    // ?tab=metrics / badges / gallery / studio + aliases:
    // Phase 3.2 wired the matching drawers — route legacy URLs into
    // them so deep-links from the dashboard route + old bookmarks
    // land on the right surface.
    //   • students                       → roster drawer (3.1 Step 4)
    //   • metrics / attention            → metrics drawer (3.2 Step 4)
    //   • badges / safety                → safety drawer  (3.2 Step 2)
    //   • studio / open-studio           → OS drawer      (3.2 Step 3)
    //   • gallery                        → gallery drawer (3.5 Step 2)
    //   • settings                       → no-op (Phase 3.4 routes
    //                                       via the kebab "Class
    //                                       settings…" item; standalone
    //                                       /teacher/classes/[id]/settings
    //                                       sub-route is a follow-up)
    // Only one drawer opens — if the URL carries both ?tab=students
    // and ?student=..., students wins to avoid stacking.
    let openedDrawer = false;
    if (tab === "students") {
      setRosterDrawerOpen(true);
      openedDrawer = true;
    } else if (tab === "metrics" || tab === "attention") {
      setMetricsDrawerOpen(true);
      openedDrawer = true;
    } else if (tab === "badges" || tab === "safety") {
      setSafetyDrawerOpen(true);
      openedDrawer = true;
    } else if (tab === "studio" || tab === "open-studio") {
      setOpenStudioDrawerOpen(true);
      openedDrawer = true;
    } else if (tab === "gallery") {
      setGalleryDrawerOpen(true);
      openedDrawer = true;
    }
    const openedRoster = openedDrawer; // backward-compat alias for the
                                        // student-deep-link branch below

    // ?student=<id>&page=<pageId> → open StudentDrawer with pageId
    // (independent of tab=). Skip if we just opened the roster drawer
    // to avoid two drawers stacking.
    if (!openedRoster && studentParam && students.length > 0) {
      const match = students.find((s) => s.id === studentParam);
      if (match) {
        setDrawerStudent({ id: match.id, name: match.display_name || match.username });
        if (pageParam) setDrawerPageId(pageParam);
      }
    }

    // Always drop the tab/student/page params after handling — the
    // canvas is the canonical surface; URL state shouldn't pin to the
    // legacy tab name. Other query params survive.
    if (tab || studentParam || pageParam) {
      url.searchParams.delete("tab");
      url.searchParams.delete("student");
      url.searchParams.delete("page");
      window.history.replaceState({}, "", url.toString());
    }
  }, [loading, students, router, classId, unitId]);

  // -----------------------------------------------------------------------
  // Load shared data (unit, class, students, pages, settings)
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [unitRes, classRes, studentsRes, classUnitRes, termsRes, cohortTermRes] = await Promise.all([
        supabase.from("units").select("*").eq("id", unitId).single(),
        supabase.from("classes").select("name, code, framework").eq("id", classId).single(),
        supabase.from("class_students").select("student_id, students(id, display_name, username, graduation_year)").eq("class_id", classId).eq("is_active", true),
        supabase.from("class_units").select("term_id, schedule_overrides, content_data, forked_at, forked_from_version, nm_config").eq("class_id", classId).eq("unit_id", unitId).single(),
        fetch("/api/teacher/school-calendar").then((r) => (r.ok ? r.json() : Promise.resolve({ terms: [] }))),
        // Class "current cohort" — derived from the most-recent active enrollment
        // that has a term_id set. Mirrors the logic in src/app/teacher/classes/page.tsx.
        // Used below to auto-inherit the unit's term_id when it's null.
        supabase.from("class_students").select("term_id").eq("class_id", classId).eq("is_active", true).not("term_id", "is", null).order("enrolled_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      setUnit(unitRes.data);
      setClassName(classRes.data?.name || "");
      setClassCode(classRes.data?.code || "");
      setClassFramework(classRes.data?.framework || "IB_MYP");

      const enrolledStudents = (studentsRes.data || [])
        .filter((row: any) => row.students)
        .map((row: any) => ({
          id: row.students.id,
          display_name: row.students.display_name || "",
          username: row.students.username || "",
          graduation_year: row.students.graduation_year || null,
        }))
        .sort((a: any, b: any) => (a.display_name || a.username).localeCompare(b.display_name || b.username));
      setStudents(enrolledStudents);

      if (unitRes.data) {
        const resolvedContent = resolveClassUnitContent(
          unitRes.data.content_data as UnitContentData,
          (classUnitRes.data?.content_data as UnitContentData | null) ?? undefined
        );
        const pageList = getPageList(resolvedContent);
        setUnitPages(pageList);
        setPages(
          pageList.map((p: UnitPage, i: number) => ({
            id: p.id,
            title: p.title || p.content?.title || `Page ${i + 1}`,
          }))
        );
      }

      // Settings data
      if (classUnitRes.data) {
        // Auto-inherit unit term_id from the class's current cohort term
        // when unset. This closes the surprise gap where a teacher sets
        // "Semester 2 2025-2026" on the class but the unit's Settings tab
        // shows "— No term assigned —". Fire-and-forget the persist:
        // self-heals on next reload if the PATCH fails.
        let resolvedTermId: string | null = classUnitRes.data.term_id || null;
        const cohortTermId = (cohortTermRes.data?.term_id as string | undefined) || null;
        if (!resolvedTermId && cohortTermId) {
          resolvedTermId = cohortTermId;
          void fetch("/api/teacher/class-units", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ classId, unitId, term_id: cohortTermId }),
          });
        }
        setSelectedTermId(resolvedTermId);
        if (classUnitRes.data.schedule_overrides) {
          setScheduleOverrides(classUnitRes.data.schedule_overrides as ScheduleOverrides);
        }
      }
      if (termsRes?.terms) setTerms(termsRes.terms);

      // NM config
      try {
        const res = await fetch(`/api/teacher/nm-config?unitId=${unitId}&classId=${classId}`);
        if (res.ok) {
          const data = await res.json();
          setNmConfig(data.config || DEFAULT_NM_CONFIG);
          setGlobalNmEnabled(data.globalNmEnabled !== false);
        }
      } catch {
        if (classUnitRes.data?.nm_config) {
          setNmConfig(classUnitRes.data.nm_config as NMUnitConfig);
        } else if (unitRes.data?.nm_config) {
          setNmConfig(unitRes.data.nm_config as NMUnitConfig);
        }
      }

      setLoading(false);
    }
    load();
  }, [unitId, classId]);

  // -----------------------------------------------------------------------
  // Load progress data (lazy — only when Progress tab is active)
  // -----------------------------------------------------------------------
  const loadProgressData = useCallback(async () => {
    if (progressLoaded || progressLoading) return;
    setProgressLoading(true);

    const supabase = createClient();
    const studentIds = students.map((s) => s.id);

    if (studentIds.length > 0) {
      const { data: progress } = await supabase
        .from("student_progress")
        .select("*")
        .eq("unit_id", unitId)
        .in("student_id", studentIds);

      const map: StudentProgressMap = {};
      const lastActive: Record<string, string> = {};
      (progress || []).forEach((p: StudentProgress) => {
        if (!map[p.student_id]) map[p.student_id] = {};
        const raw = p as unknown as Record<string, unknown>;
        const integrityMeta = raw.integrity_metadata;
        const hasIntegrityData =
          integrityMeta !== null &&
          integrityMeta !== undefined &&
          typeof integrityMeta === "object" &&
          Object.keys(integrityMeta as Record<string, unknown>).length > 0;
        // Round 8 — compute the worst level across all sections so the
        // dot only renders for actual concerns, not "we collected data".
        const integrityLevel = hasIntegrityData
          ? worstIntegrityLevel(
              integrityMeta as Record<string, IntegrityMetadata>
            )
          : null;
        map[p.student_id][p.page_id] = {
          status: p.status as "not_started" | "in_progress" | "complete",
          hasResponses:
            p.responses !== null &&
            typeof p.responses === "object" &&
            Object.keys(p.responses as Record<string, unknown>).length > 0,
          timeSpent: p.time_spent || 0,
          hasIntegrityData,
          integrityLevel,
        };
        // Track per-student max(updated_at) for the Today dot. Skip if
        // the row doesn't carry the column (defensive against shape drift).
        const updatedAt = raw.updated_at;
        if (typeof updatedAt === "string") {
          const existing = lastActive[p.student_id];
          if (!existing || updatedAt > existing) {
            lastActive[p.student_id] = updatedAt;
          }
        }
      });
      setProgressMap(map);
      setLastActiveMap(lastActive);
    }

    // Grading status — feeds both the per-row Marking pill and the
    // side-rail Marking summary card (Phase 3.2 Step 1). Capturing the
    // per-row `assessed_at` for draft rows lets the card show "oldest
    // N days" without a second fetch.
    try {
      const assessRes = await fetch(`/api/teacher/assessments?classId=${classId}&unitId=${unitId}`);
      if (assessRes.ok) {
        const { assessments } = (await assessRes.json()) as { assessments: AssessmentRecordRow[] };
        const statusMap: Record<string, GradingStatus> = {};
        const oldestDraft: Record<string, string> = {};
        for (const a of assessments) {
          statusMap[a.student_id] = a.is_draft ? "draft" : "published";
          if (a.is_draft && a.assessed_at) oldestDraft[a.student_id] = a.assessed_at;
        }
        setGradingStatusMap(statusMap);
        setOldestDraftAtMap(oldestDraft);
      }
    } catch { /* non-critical */ }

    // Open Studio per-student status — feeds both the per-row Studio
    // pill in the grid and the side-rail Open Studio card. The
    // OpenStudioDrawer (Step 3) still runs its own fetch on open
    // to manage mutations independently.
    try {
      const osRes = await fetch(`/api/teacher/open-studio/status?unitId=${unitId}&classId=${classId}`);
      if (osRes.ok) {
        const { students: rows } = (await osRes.json()) as {
          students: Array<{ student: { id: string }; openStudio: { status: "locked" | "unlocked" | "revoked"; unlocked_at: string | null } | null }>;
        };
        const osMap: Record<string, { status: "locked" | "unlocked" | "revoked"; unlockedAt: string | null }> = {};
        for (const row of rows) {
          if (row.openStudio) {
            osMap[row.student.id] = {
              status: row.openStudio.status,
              unlockedAt: row.openStudio.unlocked_at,
            };
          }
        }
        setOpenStudioStatusMap(osMap);
      }
    } catch { /* non-critical */ }

    // Badge requirements + status
    try {
      const badgeRes = await fetch(`/api/teacher/badges/class-status?classId=${classId}&unitId=${unitId}`);
      if (badgeRes.ok) {
        const badgeData = await badgeRes.json();
        setBadgeRequirements(badgeData.requirements || []);
        setBadgeStatusMap(badgeData.student_status || {});
      }
    } catch { /* non-critical */ }

    // Gallery rounds (Phase 3.5) — feeds the strip tiles. GalleryDrawer
    // also fetches independently on open so the New Round flow stays
    // self-contained.
    try {
      const galRes = await fetch(`/api/teacher/gallery?unitId=${unitId}&classId=${classId}`);
      if (galRes.ok) {
        const galData = await galRes.json();
        setGalleryRounds(galData.rounds || []);
      }
    } catch { /* non-critical */ }

    // NM per-student aggregate (Phase 3.2 Step 4) — only fetched when
    // NM tracking is enabled for this class-unit. Feeds the side-rail
    // Metrics card (avg + strongest/weakest) AND the per-row 4-dot
    // metrics indicator in the student grid.
    if (nmConfig?.enabled) {
      try {
        const nmRes = await fetch(`/api/teacher/nm-results?unitId=${unitId}&classId=${classId}`);
        if (nmRes.ok) {
          const { assessments } = (await nmRes.json()) as {
            assessments: Array<{
              student_id: string;
              element: string;
              source: "student_self" | "teacher_observation";
              rating: number;
              created_at: string;
            }>;
          };
          // Latest teacher rating per (student, element)
          const latest = new Map<string, { rating: number; createdAt: string }>();
          for (const a of assessments) {
            if (a.source !== "teacher_observation") continue;
            const key = `${a.student_id}::${a.element}`;
            const cur = latest.get(key);
            if (!cur || a.created_at > cur.createdAt) {
              latest.set(key, { rating: a.rating, createdAt: a.created_at });
            }
          }
          // Aggregate per student + per element
          const byStudent: Record<string, { sum: number; count: number }> = {};
          const elementTotals: Record<string, { sum: number; count: number }> = {};
          latest.forEach(({ rating }, key) => {
            const [studentId, elementId] = key.split("::");
            const sBucket = byStudent[studentId] ||= { sum: 0, count: 0 };
            sBucket.sum += rating;
            sBucket.count += 1;
            const eBucket = elementTotals[elementId] ||= { sum: 0, count: 0 };
            eBucket.sum += rating;
            eBucket.count += 1;
          });
          const studentMap: Record<string, { avgTeacher: number | null; elementCount: number }> = {};
          for (const s of students) {
            const b = byStudent[s.id];
            studentMap[s.id] = b
              ? { avgTeacher: b.sum / b.count, elementCount: b.count }
              : { avgTeacher: null, elementCount: 0 };
          }
          const elementAvgs: Record<string, number> = {};
          for (const [el, b] of Object.entries(elementTotals)) {
            elementAvgs[el] = b.sum / b.count;
          }
          setMetricsByStudent(studentMap);
          setMetricsByElement(elementAvgs);
        }
      } catch { /* non-critical */ }
    }

    setProgressLoading(false);
    setProgressLoaded(true);
  }, [students, unitId, classId, progressLoaded, progressLoading, nmConfig?.enabled]);

  // DT canvas (Phase 3.1) — student grid is always-mounted in the main
  // column, so progress data loads unconditionally once the shared loader
  // has resolved the roster. No tab gate any more.
  useEffect(() => {
    if (!loading && students.length > 0 && !progressLoaded) {
      loadProgressData();
    }
  }, [loading, students, progressLoaded, loadProgressData]);

  // -----------------------------------------------------------------------
  // Schedule loading (for Settings tab)
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function loadSchedule() {
      const term = terms.find((t) => t.id === selectedTermId) as any;
      if (!term?.start_date || !term?.end_date) { setScheduleInfo(null); return; }

      setScheduleLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const fromDate = term.start_date > today ? term.start_date : today;

        const [countRes, nextRes] = await Promise.all([
          fetch(`/api/teacher/schedule/lessons?classId=${classId}&mode=count&from=${term.start_date}&to=${term.end_date}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/teacher/schedule/lessons?classId=${classId}&mode=next&from=${fromDate}&count=1`).then((r) => (r.ok ? r.json() : null)),
        ]);

        const nextLesson = nextRes?.lessons?.[0] || null;
        setScheduleInfo({
          lessonCount: countRes?.lessonCount ?? null,
          nextClass: nextLesson ? {
            dateISO: nextLesson.dateISO, dayOfWeek: nextLesson.dayOfWeek, cycleDay: nextLesson.cycleDay,
            periodNumber: nextLesson.periodNumber, room: nextLesson.room,
            formatted: `${nextLesson.dayOfWeek} ${nextLesson.dateISO} (Day ${nextLesson.cycleDay}${nextLesson.periodNumber ? `, P${nextLesson.periodNumber}` : ""})`,
            short: `Day ${nextLesson.cycleDay}${nextLesson.periodNumber ? `, P${nextLesson.periodNumber}` : ""} — ${nextLesson.dayOfWeek?.slice(0, 3)}`,
          } : null,
          reason: nextRes?.lessons?.length === 0 ? "no_meetings" : undefined,
        });
      } catch { setScheduleInfo(null); }
      finally { setScheduleLoading(false); }
    }
    loadSchedule();
  }, [selectedTermId, classId, terms]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  async function handleTermChange(termId: string | null) {
    setSelectedTermId(termId);
    setSavingTerm(true);
    setTermMessage("");
    try {
      const res = await fetch("/api/teacher/class-units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, unitId, term_id: termId }),
      });
      if (!res.ok) { const data = await res.json(); setTermMessage(data.error || "Failed to save term"); return; }
      setTermMessage("Term assigned!");
      setTimeout(() => setTermMessage(""), 3000);
    } catch { setTermMessage("Network error. Please try again."); }
    finally { setSavingTerm(false); }
  }

  // ─── Phase 3.4 Step 4: row kebab "Remove from class" handler ─────────
  // Lightweight handler — window.confirm + the existing
  // DELETE /api/teacher/class-students endpoint (server handles
  // deactivation + session invalidation). Matches the existing flow
  // inside StudentRosterDrawer; lifted to the parent here so the row
  // kebab can fire it without round-tripping the drawer.
  async function removeStudentFromClassRow(studentId: string, studentName: string) {
    const ok = typeof window !== "undefined"
      ? window.confirm(`Remove ${studentName} from this class?`)
      : false;
    if (!ok) return;
    try {
      const res = await fetch("/api/teacher/class-students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, classId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[removeStudentFromClassRow]", data.error || res.statusText);
        return;
      }
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch (e) {
      console.error("[removeStudentFromClassRow]", e);
    }
  }

  // ─── G9 sign-off (16 May 2026) ────────────────────────────────────────
  // The old inline per-cell student-detail modal + its loader + the
  // 4 dead progress-grid helpers (getStudentCompletion, getPageCompletion,
  // getStatusColor, getStatusIcon) were removed when the Progress tab
  // JSX went away. Per-cell drill-down now flows through StudentDrawer
  // with an optional pageId qualifier (see drawerPageId state above
  // + StudentDrawer pageId prop). The grid's name + progress-bar clicks
  // open the drawer for a whole-student snapshot; pageId-scoped opens
  // come from legacy ?tab=... deep-links (parsed below) and future
  // per-page UIs (Phase 3.5 gallery / 3.6 cutover).
  // ──────────────────────────────────────────────────────────────────────

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-32 bg-gray-50 rounded-xl" />
        </div>
      </main>
    );
  }

  if (!unit) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-text-secondary">Unit not found.</p>
        <Link href="/teacher/units" className="text-accent-blue text-sm mt-2 inline-block">← Back to units</Link>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-4">
        <Link href="/teacher/dashboard" className="hover:text-text-primary transition">Dashboard</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <Link href={`/teacher/classes/${classId}`} className="hover:text-text-primary transition">{className}</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="text-text-primary font-medium truncate max-w-[200px]">{unit.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm font-bold flex-shrink-0">
              {className.charAt(0).toUpperCase()}
            </div>
            {className}
            <span className="text-text-tertiary font-normal">·</span>
            <span className="text-text-secondary font-normal truncate max-w-[300px]">{unit.title}</span>
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {students.length} student{students.length !== 1 ? "s" : ""} · {pages.length} page{pages.length !== 1 ? "s" : ""}
          </p>
          {/* Phase 3.6 Step 2 — busy-teacher share row. Class code +
              student join link as click-to-copy chips so a mid-lesson
              "type this code / open this link" hand-off doesn't need
              the kebab → StudentRosterDrawer → class-code reveal three-
              click dance. */}
          <ClassShareChips classCode={classCode} />
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/teacher/teach/${unitId}?classId=${classId}`}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Teach
          </Link>
          <Link
            href={`/teacher/units/${unitId}/class/${classId}/edit`}
            className="px-4 py-2 rounded-xl border border-border text-text-primary font-medium text-sm hover:bg-surface-alt transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </Link>
          {/* Change unit — relocated from inside the lesson hero (Phase
              3.3 Step 2 had it absolute-positioned top-right of the
              orange card, which overlapped the outline column text on
              real data). Now lives in the header so the hero stays
              clean + the action is visible even in the empty state. */}
          <button
            type="button"
            data-testid="canvas-header-change-unit"
            title="Pick a different unit for this class"
            onClick={() => setChangeUnitModalOpen(true)}
            className="px-4 py-2 rounded-xl border border-border text-text-primary font-medium text-sm hover:bg-surface-alt transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3 4 7l4 4" />
              <path d="M4 7h16" />
              <path d="m16 21 4-4-4-4" />
              <path d="M20 17H4" />
            </svg>
            Change unit
          </button>
          {/* Canvas-header kebab (Phase 3.4 Step 1 — Unit section).
              Class section + stubs land in Step 2. Mockup view 2,
              kebab-menu block (~line 1478). */}
          {(() => {
            const previewPageId = unitPages[0]?.id;
            const unitSection: KebabMenuSection = {
              label: `Unit · ${unit.title}`,
              items: [
                {
                  testId: "kebab-unit-edit",
                  label: "Edit unit",
                  icon: <span aria-hidden>✎</span>,
                  href: `/teacher/units/${unitId}/class/${classId}/edit`,
                },
                {
                  testId: "kebab-unit-view-as-student",
                  label: "View as student",
                  icon: <span aria-hidden>👁</span>,
                  href: previewPageId
                    ? `/teacher/units/${unitId}/preview/${previewPageId}?classId=${classId}`
                    : undefined,
                  newTab: true,
                  disabled: !previewPageId,
                  conditional: previewPageId ? undefined : "no pages",
                },
                {
                  testId: "kebab-unit-change",
                  label: "Change unit…",
                  icon: <span aria-hidden>↔</span>,
                  onClick: () => setChangeUnitModalOpen(true),
                },
                {
                  testId: "kebab-unit-past",
                  label: "Past units on this class",
                  icon: <span aria-hidden>⌛</span>,
                  href: `/teacher/classes/${classId}/units`,
                },
              ],
            };
            // Phase 3.4 Step 2 — Class section. Per Matt G3 sign-off,
            // Roll over / Duplicate / Archive / Delete all ship as
            // greyed stubs in 3.4. Each has its own UX work waiting in
            // a follow-up phase. Class settings links to the existing
            // per-class-unit settings page (due dates + page settings
            // already lives there — the deleted Settings tab's term
            // picker + LessonSchedule content is a separate follow-up,
            // tracked in the Phase 3.4 STOP AND REPORT).
            const classSection: KebabMenuSection = {
              label: `Class · ${className}`,
              items: [
                {
                  testId: "kebab-class-settings",
                  label: "Class settings…",
                  icon: <span aria-hidden>⚙</span>,
                  href: `/teacher/classes/${classId}/settings/${unitId}`,
                },
                {
                  testId: "kebab-class-rollover",
                  label: "Roll over to next semester…",
                  icon: <span aria-hidden>↻</span>,
                  disabled: true,
                  conditional: "coming soon",
                },
                {
                  testId: "kebab-class-duplicate",
                  label: "Duplicate class",
                  icon: <span aria-hidden>⎘</span>,
                  disabled: true,
                  conditional: "coming soon",
                },
                {
                  testId: "kebab-class-archive",
                  label: "Archive class",
                  icon: <span aria-hidden>▤</span>,
                  disabled: true,
                  conditional: "coming soon",
                },
                {
                  testId: "kebab-class-delete",
                  label: "Delete permanently",
                  icon: <span aria-hidden>🗑</span>,
                  disabled: true,
                  danger: true,
                  conditional: "if archived",
                },
              ],
            };
            return (
              <KebabMenu
                testId="canvas-header-kebab"
                triggerAriaLabel="Class and unit actions"
                sections={[unitSection, classSection]}
                align="right"
                trigger={
                  <span className="w-10 h-10 rounded-xl border border-border text-text-secondary hover:bg-surface-alt flex items-center justify-center transition">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="5" r="1.2" />
                      <circle cx="12" cy="12" r="1.2" />
                      <circle cx="12" cy="19" r="1.2" />
                    </svg>
                  </span>
                }
              />
            );
          })()}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CANVAS GRID — main column (lesson hero + student grid + gallery) */}
      {/*               + 360px sticky side rail (Marking / Open Studio / */}
      {/*               Class Metrics / Safety summary cards).             */}
      {/* Each section starts as an empty placeholder; subsequent Phase    */}
      {/* 3.x sub-phases fill them in (3.1 = student grid, 3.2 = side     */}
      {/* rail, 3.3 = lesson hero, 3.5 = gallery strip).                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        data-testid="dt-canvas-grid"
        className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start"
      >
        {/* MAIN COLUMN */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Today's lesson hero (Phase 3.3) — orange card per mockup
              view 2 .lesson-card (lines 1502-1527). Picks the page
              the class is most likely working on right now (see
              deriveTodaysLessonIndex). Outline pulls from the page's
              workshopPhases when present; otherwise a friendly
              "no Workshop Model timing yet" empty state. ▶ Teach CTA
              links to /teacher/teach/[unitId]?classId=[classId] with
              the today's page pre-selected. Change unit affordance
              opens ChangeUnitModal (Step 2). */}
          {unitPages.length === 0 ? (
            <section
              data-testid="canvas-lesson-hero"
              data-empty="no-pages"
              className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-sm text-orange-900"
            >
              No pages in this unit yet. Open <strong>Edit</strong> in the header to add one.
            </section>
          ) : (() => {
            const studentIds = students.map((s) => s.id);
            const todayIdx = deriveTodaysLessonIndex(unitPages, progressMap, studentIds);
            const todayPage = unitPages[todayIdx];
            const wp = todayPage?.content?.workshopPhases;
            const totalMin = wp
              ? (wp.opening?.durationMinutes ?? 0) +
                (wp.miniLesson?.durationMinutes ?? 0) +
                (wp.workTime?.durationMinutes ?? 0) +
                (wp.debrief?.durationMinutes ?? 0)
              : null;
            // Outline rows — only render phases that have non-zero
            // durations. Mockup style: time chip + bold phase name
            // + focus/protocol detail.
            const outlineRows: Array<{ minutes: number; name: string; detail: string }> = [];
            if (wp) {
              if (wp.opening?.durationMinutes) {
                outlineRows.push({
                  minutes: wp.opening.durationMinutes,
                  name: wp.opening.phaseName || "Opening",
                  detail: wp.opening.hook || "Hook + activate prior knowledge.",
                });
              }
              if (wp.miniLesson?.durationMinutes) {
                outlineRows.push({
                  minutes: wp.miniLesson.durationMinutes,
                  name: wp.miniLesson.phaseName || "Mini-lesson",
                  detail: wp.miniLesson.focus || "Direct instruction on today's focus.",
                });
              }
              if (wp.workTime?.durationMinutes) {
                outlineRows.push({
                  minutes: wp.workTime.durationMinutes,
                  name: wp.workTime.phaseName || "Studio time",
                  detail: wp.workTime.focus || "Sustained independent + collaborative work.",
                });
              }
              if (wp.debrief?.durationMinutes) {
                outlineRows.push({
                  minutes: wp.debrief.durationMinutes,
                  name: wp.debrief.phaseName || "Share",
                  detail: wp.debrief.protocol || wp.debrief.prompt || "Structured share-out + reflection.",
                });
              }
            }
            return (
              <section
                data-testid="canvas-lesson-hero"
                data-today-index={todayIdx}
                className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Change unit affordance was here in Phase 3.3 Step 2 as
                    an absolute-positioned pill — it overlapped the outline
                    column text on real lesson data. Moved into the canvas
                    header next to Edit + kebab so the hero stays clean
                    and the action remains visible when the hero is in
                    its empty state. testid renamed canvas-header-change-unit. */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 p-6">
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full bg-white/20">
                      Today · Lesson {todayIdx + 1} of {unitPages.length}
                    </span>
                    <h2
                      data-testid="lesson-hero-title"
                      className="mt-3 text-2xl sm:text-3xl font-bold leading-tight"
                    >
                      {todayPage?.title || todayPage?.content?.title || `Page ${todayIdx + 1}`}
                    </h2>
                    <div className="mt-2 text-sm text-white/85">
                      <strong className="font-semibold">Workshop Model</strong>
                      {totalMin != null && totalMin > 0 && (
                        <> · {totalMin} min</>
                      )}
                    </div>
                    <Link
                      data-testid="lesson-hero-teach-cta"
                      href={`/teacher/teach/${unitId}?classId=${classId}&page=${encodeURIComponent(todayPage?.id ?? "")}`}
                      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-text-primary text-sm font-semibold shadow-sm hover:bg-white/95 transition"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Teach
                    </Link>
                  </div>
                  {/* Outline — right column on lg+, stacks below on small */}
                  <div className="lg:border-l lg:border-white/25 lg:pl-7 flex flex-col gap-3 justify-center">
                    {outlineRows.length === 0 ? (
                      <p
                        data-testid="lesson-hero-outline-empty"
                        className="text-xs text-white/80 leading-relaxed"
                      >
                        No Workshop Model timing on this page yet.
                        Open <strong>Edit</strong> to add opening / mini-lesson / work
                        time / debrief phases.
                      </p>
                    ) : (
                      outlineRows.map((row, i) => (
                        <div
                          key={i}
                          data-testid="lesson-hero-outline-row"
                          className="flex items-start gap-3"
                        >
                          <span className="flex-shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 min-w-[44px] text-center">
                            {row.minutes} min
                          </span>
                          <div className="text-xs leading-relaxed">
                            <strong className="font-semibold">{row.name}.</strong>{" "}
                            <span className="text-white/85">{row.detail}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Student grid — the heart of the canvas. Replaces the old
              Progress tab's student × page matrix with a per-student-row
              composite: Today dot, Unit %, Marking pill, Open Studio
              pill (Phase 3.2 data), Metrics dots (Phase 3.2 data),
              Badges count, row-menu (Phase 3.4 actions). Mockup view 2,
              .student-grid-wrap block (lines ~1530–1777). */}
          <section
            data-testid="canvas-student-grid"
            className="bg-white rounded-2xl border border-border overflow-hidden"
          >
            {/* Header — title count + filter chips + Add student (Step 4) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-border">
              <div className="text-base font-semibold text-text-primary">
                Students <span className="text-text-tertiary font-normal ml-1">· {students.length}</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1" role="group" aria-label="Student filter">
                  {STUDENT_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      data-testid={`student-filter-${f.id}`}
                      onClick={() => setStudentFilter(f.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        studentFilter === f.id
                          ? "bg-text-primary text-white"
                          : "bg-surface-alt text-text-secondary hover:bg-gray-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {/* + Add student → opens StudentRosterDrawer (Phase 3.1
                    Step 4 — lifted from the old Students tab). Drawer
                    handles Add Existing / Create New / edit / remove +
                    class-code reveal. */}
                <button
                  type="button"
                  data-testid="student-grid-add-student"
                  onClick={() => setRosterDrawerOpen(true)}
                  title="Manage roster — add, edit, or remove students"
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-text-primary text-white hover:opacity-90 transition flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Add student
                </button>
              </div>
            </div>

            {/* Column header row — hidden on narrow screens (the row layout
                stacks naturally there). Tracks the row template below. */}
            <div className="hidden md:grid grid-cols-[28px_minmax(0,1fr)_56px_120px_88px_88px_100px_72px_28px] gap-3 px-5 py-2 bg-surface-alt text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
              <div />
              <div className="text-left">Student</div>
              <div className="text-center">Today</div>
              <div className="text-center">Unit</div>
              <div className="text-center">Marking</div>
              <div className="text-center">Studio</div>
              <div className="text-center">Metrics</div>
              <div className="text-center">Badges</div>
              <div />
            </div>

            {/* Rows */}
            {(() => {
              if (progressLoading && !progressLoaded) {
                return (
                  <div className="px-5 py-8" data-testid="student-grid-loading">
                    <div className="animate-pulse space-y-3">
                      <div className="h-10 bg-gray-100 rounded" />
                      <div className="h-10 bg-gray-100 rounded" />
                      <div className="h-10 bg-gray-100 rounded" />
                    </div>
                  </div>
                );
              }
              if (students.length === 0) {
                return (
                  <div className="px-5 py-12 text-center text-sm text-text-secondary" data-testid="student-grid-empty-roster">
                    No students enrolled in this class yet.
                  </div>
                );
              }

              // Per-row derived values + the filter chip predicate.
              const rows = students.map((student) => {
                const studentName = student.display_name || student.username;
                const initials = studentInitials(student.display_name, student.username);
                const pages = progressMap[student.id] || {};
                const completed = Object.values(pages).filter((c) => c.status === "complete").length;
                const percent = unitPages.length > 0 ? Math.round((completed / unitPages.length) * 100) : 0;
                const lastActive = lastActiveMap[student.id] || null;
                const todayClass = todayDotClass(lastActive);
                const todayLabel = todayDotLabel(lastActive);

                // Per-row aggregate of the worst integrity level across
                // all pages. Surfaces inline next to the name. Preserves
                // the `cell?.integrityLevel === "low" | "medium"` shape
                // that integrity-dot-logic.test.ts source-static guards
                // lock against (Step 5 unskips those once shape matches).
                let worstLevel: "low" | "medium" | null = null;
                unitPages.forEach((p) => {
                  const lvl = pages[p.id]?.integrityLevel;
                  if (lvl === "low") worstLevel = "low";
                  else if (lvl === "medium" && worstLevel !== "low") worstLevel = "medium";
                });
                const cell: { integrityLevel: "low" | "medium" | null } = { integrityLevel: worstLevel };

                const gradeStatus = gradingStatusMap[student.id];
                let marking: MarkingKind;
                if (gradeStatus === "published") marking = "graded";
                else if (gradeStatus === "draft") marking = "draft";
                else if (completed > 0) marking = "to_mark";
                else if (unitPages.length === 0) marking = "none";
                else marking = "clear";

                const badgeStatuses = badgeStatusMap[student.id] || [];
                const badgesEarned = badgeStatuses.filter((b) => b.status === "earned").length;
                const badgeTotal = badgeRequirements.length;

                return { student, studentName, initials, percent, lastActive, todayClass, todayLabel, cell, marking, badgesEarned, badgeTotal };
              });

              const filtered = rows.filter(({ student, marking, cell, lastActive }) => {
                switch (studentFilter) {
                  case "all":
                    return true;
                  case "marking":
                    return marking === "draft" || marking === "to_mark";
                  case "flagged":
                    // Low-integrity OR red Today dot (inactive ≥3 days)
                    return cell?.integrityLevel === "low" || todayDotClass(lastActive) === "bg-rose-500";
                  case "studio":
                    // Open Studio per-student data wires in Phase 3.2.
                    // Filter currently matches nothing — empty-state
                    // copy below tells teachers what's coming.
                    void student;
                    return false;
                  default:
                    return true;
                }
              });

              if (filtered.length === 0) {
                const filterLabel = STUDENT_FILTERS.find((f) => f.id === studentFilter)?.label ?? "filter";
                return (
                  <div className="px-5 py-12 text-center text-sm text-text-secondary" data-testid="student-grid-empty-filtered">
                    {studentFilter === "studio" ? (
                      <>Open Studio counts wire in Phase 3.2. No data to filter on yet.</>
                    ) : (
                      <>No students match the &ldquo;{filterLabel}&rdquo; filter.</>
                    )}
                  </div>
                );
              }

              return filtered.map(({ student, studentName, initials, percent, lastActive, todayClass, todayLabel, cell, marking, badgesEarned, badgeTotal }) => (
                <div
                  key={student.id}
                  data-testid={`student-row-${student.id}`}
                  className="group grid grid-cols-[28px_minmax(0,1fr)_56px_120px_88px_88px_100px_72px_28px] gap-3 px-5 py-3.5 border-b border-border last:border-0 hover:bg-surface-alt items-center"
                >
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-surface-alt text-[11px] font-semibold text-text-secondary flex items-center justify-center">
                    {initials}
                  </div>

                  {/* Name + last-active + inline integrity dot */}
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setDrawerStudent({ id: student.id, name: studentName })}
                      className="text-sm font-medium text-text-primary hover:text-purple-700 transition text-left truncate flex items-center gap-1.5"
                    >
                      <span className="truncate">{studentName}</span>
                      {cell?.integrityLevel === "low" && (
                        <span
                          data-testid={`student-row-${student.id}-integrity-low`}
                          className="inline-block w-2 h-2 rounded-full bg-rose-500 ring-1 ring-white flex-shrink-0"
                          title="Integrity concern flagged — open to review"
                        />
                      )}
                      {cell?.integrityLevel === "medium" && (
                        <span
                          data-testid={`student-row-${student.id}-integrity-medium`}
                          className="inline-block w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white flex-shrink-0"
                          title="Integrity warning — minor concern, open to review"
                        />
                      )}
                    </button>
                    <div className="text-[11px] text-text-tertiary mt-0.5">
                      {lastActiveLabel(lastActive)}
                    </div>
                  </div>

                  {/* Today dot */}
                  <div className="flex justify-center">
                    <span
                      data-testid={`student-row-${student.id}-today`}
                      className={`inline-block w-2.5 h-2.5 rounded-full ${todayClass}`}
                      title={todayLabel}
                    />
                  </div>

                  {/* Unit progress bar + % — clicking opens StudentDrawer
                      for that student (whole-student snapshot, no pageId
                      qualifier). Per-page deep-links come via legacy
                      ?tab=...&page=... or future per-page surfaces. */}
                  <button
                    type="button"
                    data-testid={`student-row-${student.id}-progress`}
                    onClick={() => {
                      setDrawerPageId(null);
                      setDrawerStudent({ id: student.id, name: studentName });
                    }}
                    title={`Open ${studentName}'s snapshot`}
                    className="flex flex-col gap-1 w-full hover:opacity-80 transition"
                  >
                    <div className="w-full h-1.5 rounded-full bg-surface-alt overflow-hidden">
                      <div
                        className="h-full bg-accent-green transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-[11px] font-medium text-text-secondary text-center">{percent}%</div>
                  </button>

                  {/* Marking pill */}
                  <div className="flex justify-center">
                    {marking === "graded" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">graded</span>}
                    {marking === "draft" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">draft</span>}
                    {marking === "to_mark" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">to mark</span>}
                    {marking === "clear" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-alt text-text-secondary font-medium">clear</span>}
                    {marking === "none" && <span className="text-xs text-text-tertiary">—</span>}
                  </div>

                  {/* Open Studio pill — Phase 3.2 Step 3 wires from
                      openStudioStatusMap (populated alongside progress
                      data via the per-class status fetch). Only show
                      "In Studio" badge for unlocked students; locked +
                      revoked + no-record all collapse to the —. */}
                  <div
                    className="flex justify-center"
                    data-testid={`student-row-${student.id}-studio`}
                  >
                    {openStudioStatusMap[student.id]?.status === "unlocked" ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">
                        In Studio
                      </span>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </div>

                  {/* Metrics dots — Phase 3.2 Step 4 fills 4 bars from
                      the student's avg teacher rating (1-4 scale).
                      Mockup convention: empty bar (bg-surface-alt) /
                      mid (bg-amber-300) / full (bg-emerald-500).
                      Clickable when NM is enabled — opens ObservationSnap
                      to record an observation right from the row
                      (re-attaches the NM trigger lost when the old
                      Progress-tab "NM" pill went away). */}
                  {(() => {
                    const m = metricsByStudent[student.id];
                    const avg = m?.avgTeacher;
                    const dots = [0, 1, 2, 3].map((i) => {
                      if (avg == null) return "empty" as const;
                      if (avg >= i + 1) return "full" as const;
                      if (avg >= i + 0.5) return "mid" as const;
                      return "empty" as const;
                    });
                    const canObserve = nmConfig?.enabled === true;
                    const inner = (
                      <span
                        data-testid={`student-row-${student.id}-metrics`}
                        className="inline-flex gap-0.5"
                        title={canObserve
                          ? avg != null
                            ? `Avg ${avg.toFixed(1)}/4 — click to record observation`
                            : "No observations yet — click to record one"
                          : "Enable New Metrics on this class to track competencies"}
                      >
                        {dots.map((kind, i) => (
                          <span
                            key={i}
                            className={`inline-block w-3 h-1.5 rounded-sm ${
                              kind === "full"
                                ? "bg-emerald-500"
                                : kind === "mid"
                                  ? "bg-amber-300"
                                  : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </span>
                    );
                    return (
                      <div className="flex justify-center">
                        {canObserve ? (
                          <button
                            type="button"
                            onClick={() => setNmObserveStudent({ id: student.id, name: studentName })}
                            className="hover:opacity-70 transition"
                          >
                            {inner}
                          </button>
                        ) : (
                          inner
                        )}
                      </div>
                    );
                  })()}

                  {/* Badge count */}
                  <div className="flex justify-center">
                    {badgeTotal > 0 ? (
                      <span className="text-xs font-medium text-text-secondary inline-flex items-center gap-1">
                        <span aria-hidden>★</span> {badgesEarned}/{badgeTotal}
                      </span>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </div>

                  {/* Row kebab (Phase 3.4 Step 4) — hover-revealed
                      menu of per-student actions. Reset code is a
                      greyed stub (no API surface yet — follow-up).
                      Each row owns its own KebabMenu instance; the
                      component is lightweight so per-row mount cost
                      is negligible. */}
                  <div className="opacity-0 group-hover:opacity-100 transition">
                    {(() => {
                      const rowItems: KebabMenuSection["items"] = [
                        {
                          testId: `row-action-${student.id}-snapshot`,
                          label: "Open snapshot",
                          icon: <span aria-hidden>👤</span>,
                          onClick: () => {
                            setDrawerPageId(null);
                            setDrawerStudent({ id: student.id, name: studentName });
                          },
                        },
                      ];
                      if (nmConfig?.enabled === true) {
                        rowItems.push({
                          testId: `row-action-${student.id}-observe`,
                          label: "Record NM observation",
                          icon: <span aria-hidden>📊</span>,
                          onClick: () => setNmObserveStudent({ id: student.id, name: studentName }),
                        });
                      }
                      rowItems.push({
                        testId: `row-action-${student.id}-reset-code`,
                        label: "Reset student code",
                        icon: <span aria-hidden>↻</span>,
                        disabled: true,
                        conditional: "coming soon",
                      });
                      rowItems.push({
                        testId: `row-action-${student.id}-remove`,
                        label: "Remove from class",
                        icon: <span aria-hidden>🗑</span>,
                        danger: true,
                        onClick: () => removeStudentFromClassRow(student.id, studentName),
                      });
                      return (
                        <KebabMenu
                          testId={`student-row-${student.id}-menu`}
                          triggerAriaLabel={`Actions for ${studentName}`}
                          sections={[{ items: rowItems }]}
                          align="right"
                          trigger={
                            <span
                              title={`Actions for ${studentName}`}
                              className="w-6 h-6 rounded-full text-text-tertiary hover:bg-surface-alt flex items-center justify-center"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <circle cx="5" cy="12" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="19" cy="12" r="1.5" />
                              </svg>
                            </span>
                          }
                        />
                      );
                    })()}
                  </div>
                </div>
              ));
            })()}
          </section>

          {/* Gallery strip (Phase 3.5 Step 2) — recent-work tile row +
              "Open gallery →" link. Tiles render the most recent 6
              rounds with rotating gradient backgrounds (matches mockup
              .gallery-tile palette). Click any tile or the CTA →
              opens GalleryDrawer. Empty state shows 6 dashed
              placeholder tiles + a friendlier "Create your first
              round" prompt. */}
          <section
            data-testid="canvas-gallery-strip"
            className="bg-white rounded-2xl border border-border p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-text-primary">
                Pin-Up Gallery
                <span className="text-text-tertiary font-normal ml-1.5">
                  · {galleryRounds.length} {galleryRounds.length === 1 ? "round" : "rounds"}
                </span>
              </div>
              <button
                type="button"
                data-testid="gallery-strip-open-cta"
                onClick={() => setGalleryDrawerOpen(true)}
                className="text-xs font-medium text-text-secondary hover:text-text-primary transition"
              >
                Open gallery →
              </button>
            </div>
            {galleryRounds.length === 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    data-testid="gallery-strip-tile-empty"
                    className="aspect-square rounded-lg border-2 border-dashed border-border bg-surface-alt/30"
                  />
                ))}
                <p className="col-span-3 sm:col-span-6 text-xs text-text-secondary text-center mt-1">
                  No pin-up rounds yet.{" "}
                  <button
                    type="button"
                    onClick={() => setGalleryDrawerOpen(true)}
                    className="text-purple-600 hover:underline font-medium"
                  >
                    Create your first round →
                  </button>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {galleryRounds.slice(0, 6).map((round, i) => {
                  // Rotate through the mockup's 4 tile gradients
                  const palettes = [
                    "bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-700",
                    "bg-gradient-to-br from-orange-100 to-amber-200 text-orange-700",
                    "bg-gradient-to-br from-violet-100 to-indigo-200 text-violet-700",
                    "bg-gradient-to-br from-rose-100 to-pink-200 text-rose-700",
                  ];
                  const palette = palettes[i % palettes.length];
                  const initial = (round.title || "•").charAt(0).toUpperCase();
                  return (
                    <button
                      key={round.id}
                      type="button"
                      data-testid={`gallery-strip-tile-${round.id}`}
                      onClick={() => setGalleryDrawerOpen(true)}
                      title={round.title || "Untitled round"}
                      className={`aspect-square rounded-lg ${palette} flex items-center justify-center text-lg font-bold hover:scale-[1.02] hover:shadow-sm transition`}
                    >
                      {initial}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* SIDE RAIL — Phase 3.2 fills each card with summary count + sub
            + CTA. Empty cards in 3.1 so the layout doesn't reflow on the
            3.2 land. Sticky positioning matches the mockup's
            .canvas-side rule (top: 130px). */}
        <aside
          data-testid="canvas-side-rail"
          className="flex flex-col gap-4 lg:sticky lg:top-32"
        >
          {/* MARKING QUEUE — re-uses gradingStatusMap + oldestDraftAtMap
              already loaded for the per-row Marking pill. CTA links out
              to the canonical /teacher/marking surface with class+unit
              context (skips the picker steps). No new fetches. */}
          {(() => {
            let toMarkCount = 0;
            let draftCount = 0;
            let oldestDraftAt: string | null = null;
            for (const s of students) {
              const status = gradingStatusMap[s.id];
              if (status === "draft") {
                draftCount += 1;
                const ts = oldestDraftAtMap[s.id];
                if (ts && (!oldestDraftAt || ts < oldestDraftAt)) oldestDraftAt = ts;
              } else if (status !== "published") {
                // No assessment row OR ungraded — counts as "to mark" only if
                // the student has completed at least one page (otherwise
                // there's nothing to mark yet).
                const pages = progressMap[s.id] || {};
                const completed = Object.values(pages).filter((c) => c.status === "complete").length;
                if (completed > 0) toMarkCount += 1;
              }
            }
            const total = toMarkCount + draftCount;
            const oldestDays = oldestDraftAt
              ? Math.max(0, Math.floor((Date.now() - new Date(oldestDraftAt).getTime()) / 86_400_000))
              : null;
            return (
              <div
                data-testid="canvas-rail-card-marking"
                className="bg-white rounded-2xl border border-border p-5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Marking queue
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    data-testid="rail-marking-count"
                    className={`text-2xl font-bold ${total > 0 ? "text-text-primary" : "text-text-tertiary"}`}
                  >
                    {total}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {total === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {total === 0 ? (
                    "All clear — nothing to mark."
                  ) : (
                    <>
                      {draftCount > 0 && `${draftCount} draft`}
                      {draftCount > 0 && toMarkCount > 0 && " · "}
                      {toMarkCount > 0 && `${toMarkCount} awaiting`}
                      {oldestDays != null && draftCount > 0 && (
                        <> · oldest {oldestDays === 0 ? "today" : `${oldestDays}d`}</>
                      )}
                    </>
                  )}
                </div>
                <Link
                  data-testid="rail-marking-cta"
                  href={`/teacher/marking?class=${classId}&unit=${unitId}`}
                  className="mt-3 inline-flex items-center justify-center w-full px-3 py-2 rounded-lg bg-surface-alt text-text-primary hover:bg-text-primary hover:text-white transition text-xs font-medium"
                >
                  Open marking →
                </Link>
              </div>
            );
          })()}

          {/* OPEN STUDIO — re-uses openStudioStatusMap loaded inside
              loadProgressData. CTA opens OpenStudioDrawer wrapping
              OpenStudioClassView (full unlock/revoke/check-in UI). */}
          {(() => {
            const unlocked = students.filter(
              (s) => openStudioStatusMap[s.id]?.status === "unlocked",
            );
            const firstName = unlocked[0]
              ? unlocked[0].display_name || unlocked[0].username
              : null;
            return (
              <div
                data-testid="canvas-rail-card-studio"
                className="bg-white rounded-2xl border border-border p-5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Open Studio
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    data-testid="rail-studio-count"
                    className={`text-2xl font-bold ${unlocked.length > 0 ? "text-violet-600" : "text-text-tertiary"}`}
                  >
                    {unlocked.length}
                  </span>
                  <span className="text-xs text-text-secondary">
                    in studio mode
                  </span>
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {unlocked.length === 0
                    ? "No one in self-directed mode yet."
                    : unlocked.length === 1
                      ? `${firstName} is working independently.`
                      : `${firstName} + ${unlocked.length - 1} more.`}
                </div>
                <button
                  type="button"
                  data-testid="rail-studio-cta"
                  onClick={() => setOpenStudioDrawerOpen(true)}
                  className="mt-3 inline-flex items-center justify-center w-full px-3 py-2 rounded-lg bg-surface-alt text-text-primary hover:bg-text-primary hover:text-white transition text-xs font-medium"
                >
                  {unlocked.length === 0 ? "Manage Open Studio →" : "View plans →"}
                </button>
              </div>
            );
          })()}

          {/* CLASS METRICS — re-uses metricsByStudent + metricsByElement
              loaded inside loadProgressData (only fires when nmConfig
              is enabled). Card shows class avg + strongest/weakest
              element one-liner. CTA opens MetricsDrawer stacking
              NMElementsPanel + UnitAttentionPanel + NMResultsPanel. */}
          {(() => {
            if (!globalNmEnabled || !nmConfig?.enabled) {
              return (
                <div
                  data-testid="canvas-rail-card-metrics"
                  className="bg-white rounded-2xl border border-border p-5"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Class metrics · this unit
                  </div>
                  <div
                    data-testid="rail-metrics-count"
                    className="mt-2 text-2xl font-bold text-text-tertiary"
                  >
                    —
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    New Metrics is off for this {globalNmEnabled ? "unit" : "class"}.
                  </div>
                  <button
                    type="button"
                    data-testid="rail-metrics-cta"
                    onClick={() => setMetricsDrawerOpen(true)}
                    className="mt-3 inline-flex items-center justify-center w-full px-3 py-2 rounded-lg bg-surface-alt text-text-primary hover:bg-text-primary hover:text-white transition text-xs font-medium"
                  >
                    Configure metrics →
                  </button>
                </div>
              );
            }
            const avgs = Object.values(metricsByStudent)
              .map((m) => m.avgTeacher)
              .filter((v): v is number => v != null);
            const classAvg = avgs.length > 0
              ? avgs.reduce((a, b) => a + b, 0) / avgs.length
              : null;
            // Strongest / weakest by per-element class avg
            const entries = Object.entries(metricsByElement);
            entries.sort((a, b) => b[1] - a[1]);
            const strongest = entries[0]?.[0];
            const weakest = entries[entries.length - 1]?.[0];
            // Map element IDs → human-readable names (AGENCY_ELEMENTS
            // is the v1 source). Fallback to the id when not found.
            function elName(id: string | undefined): string {
              if (!id) return "—";
              const el = AGENCY_ELEMENTS.find((e) => e.id === id);
              return el?.name ?? id;
            }
            return (
              <div
                data-testid="canvas-rail-card-metrics"
                className="bg-white rounded-2xl border border-border p-5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Class metrics · this unit
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    data-testid="rail-metrics-count"
                    className={`text-2xl font-bold ${classAvg != null ? "text-blue-600" : "text-text-tertiary"}`}
                  >
                    {classAvg != null ? classAvg.toFixed(1) : "—"}
                  </span>
                  <span className="text-xs text-text-secondary">/ 4 avg</span>
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {classAvg == null
                    ? "No observations recorded yet."
                    : entries.length === 1
                      ? `${elName(strongest)} only`
                      : `${elName(strongest)} strongest · ${elName(weakest)} weakest`}
                </div>
                <button
                  type="button"
                  data-testid="rail-metrics-cta"
                  onClick={() => setMetricsDrawerOpen(true)}
                  className="mt-3 inline-flex items-center justify-center w-full px-3 py-2 rounded-lg bg-surface-alt text-text-primary hover:bg-text-primary hover:text-white transition text-xs font-medium"
                >
                  {classAvg == null ? "Score students now →" : "Open metrics →"}
                </button>
              </div>
            );
          })()}

          {/* SAFETY & BADGES — re-uses badgeRequirements +
              badgeStatusMap already loaded for the per-row Badge
              count. CTA opens SafetyDrawer wrapping BadgesTab. No new
              fetches. */}
          {(() => {
            const totalReq = badgeRequirements.length;
            let workshopReady = 0;
            let needsAssessment: string | null = null;
            if (totalReq > 0) {
              for (const s of students) {
                const statuses = badgeStatusMap[s.id] || [];
                const allEarned =
                  statuses.length === totalReq &&
                  statuses.every((b) => b.status === "earned");
                if (allEarned) {
                  workshopReady += 1;
                } else if (!needsAssessment) {
                  needsAssessment = s.display_name || s.username;
                }
              }
            }
            return (
              <div
                data-testid="canvas-rail-card-safety"
                className="bg-white rounded-2xl border border-border p-5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Safety &amp; badges
                </div>
                {totalReq === 0 ? (
                  <>
                    <div
                      data-testid="rail-safety-count"
                      className="mt-2 text-2xl font-bold text-text-tertiary"
                    >
                      —
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      No badges required for this unit.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span
                        data-testid="rail-safety-count"
                        className={`text-2xl font-bold ${
                          workshopReady === students.length && students.length > 0
                            ? "text-emerald-600"
                            : "text-text-primary"
                        }`}
                      >
                        {workshopReady}/{students.length}
                      </span>
                      <span className="text-xs text-text-secondary">
                        workshop ready
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {needsAssessment
                        ? `${needsAssessment} needs assessment`
                        : students.length === 0
                          ? "No students enrolled yet."
                          : "All students badged up."}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  data-testid="rail-safety-cta"
                  onClick={() => setSafetyDrawerOpen(true)}
                  className="mt-3 inline-flex items-center justify-center w-full px-3 py-2 rounded-lg bg-surface-alt text-text-primary hover:bg-text-primary hover:text-white transition text-xs font-medium"
                >
                  Manage badges →
                </button>
              </div>
            );
          })()}
        </aside>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Student Drawer (Phase 3.1) — pageId qualifier carried through for */}
      {/* per-page deep-links from legacy ?tab=...&page=... compat + future */}
      {/* per-page UIs (Phase 3.5 gallery, 3.6 cutover).                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {drawerStudent && (
        <StudentDrawer
          studentId={drawerStudent.id}
          studentName={drawerStudent.name}
          unitId={unitId}
          classId={classId}
          pageId={drawerPageId}
          onClose={() => {
            setDrawerStudent(null);
            setDrawerPageId(null);
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Student Roster Drawer (Phase 3.1 Step 4) — lifted from old        */}
      {/* StudentsTab. Triggered by the student-grid "+ Add student"       */}
      {/* button. Handles Add Existing / Create New + edit + remove + class*/}
      {/* code reveal.                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {rosterDrawerOpen && (
        <StudentRosterDrawer
          classId={classId}
          classCode={classCode}
          className={className}
          students={students}
          setStudents={setStudents}
          onClose={() => setRosterDrawerOpen(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Safety Drawer (Phase 3.2 Step 2) — wraps BadgesTab. Triggered by */}
      {/* the side-rail "Safety & badges" card CTA.                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {safetyDrawerOpen && (
        <SafetyDrawer
          unitId={unitId}
          classId={classId}
          students={students.map((s) => ({ id: s.id, display_name: s.display_name, username: s.username }))}
          onClose={() => setSafetyDrawerOpen(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Open Studio Drawer (Phase 3.2 Step 3) — wraps OpenStudioClassView */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {openStudioDrawerOpen && (
        <OpenStudioDrawer
          unitId={unitId}
          classId={classId}
          onClose={() => setOpenStudioDrawerOpen(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Metrics Drawer (Phase 3.2 Step 4) — wraps NMElementsPanel +       */}
      {/* UnitAttentionPanel + NMResultsPanel.                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {metricsDrawerOpen && (
        <MetricsDrawer
          unitId={unitId}
          classId={classId}
          globalNmEnabled={globalNmEnabled}
          nmConfig={nmConfig}
          onNmConfigChange={async (next) => {
            const previous = nmConfig;
            setNmConfig(next);
            try {
              const res = await fetch("/api/teacher/nm-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ unitId, classId, config: next }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
            } catch (err) {
              console.error("[MetricsDrawer.onNmConfigChange] save failed:", err);
              setNmConfig(previous);
              throw err;
            }
          }}
          onClose={() => setMetricsDrawerOpen(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Change Unit Modal (Phase 3.3 Step 2) — wires the atomic           */}
      {/* public.set_active_unit RPC via setActiveUnit helper. Triggered    */}
      {/* by the orange lesson-hero "Change unit" button.                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {changeUnitModalOpen && (
        <ChangeUnitModal
          classId={classId}
          currentUnitId={unitId}
          className={className}
          onClose={() => setChangeUnitModalOpen(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Gallery Drawer (Phase 3.5) — Pin-Up Gallery management.            */}
      {/* Triggered by the canvas gallery strip "Open gallery →" CTA + the  */}
      {/* legacy ?tab=gallery compat handler.                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {galleryDrawerOpen && (
        <GalleryDrawer
          unitId={unitId}
          classId={classId}
          unitPages={unitPages}
          onClose={() => setGalleryDrawerOpen(false)}
        />
      )}

      {/* NM Observation Snap modal */}
      {nmObserveStudent && nmConfig?.enabled && (
        <ObservationSnap
          studentId={nmObserveStudent.id}
          studentName={nmObserveStudent.name}
          unitId={unitId}
          classId={classId}
          elements={
            AGENCY_ELEMENTS
              .filter((e) => nmConfig.elements.includes(e.id))
              .map((e) => ({ id: e.id, name: e.name, definition: e.definition, color: e.color, studentDescription: e.studentDescription }))
          }
          onComplete={() => setNmObserveStudent(null)}
          onClose={() => setNmObserveStudent(null)}
        />
      )}
    </main>
  );
}

