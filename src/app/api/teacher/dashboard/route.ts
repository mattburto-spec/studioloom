import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { getPageList } from "@/lib/unit-adapter";
import type {
  DashboardData,
  DashboardClass,
  DashboardUnit,
  StuckStudent,
  ActivityEvent,
  UnmarkedWorkItem,
  DashboardInsight,
} from "@/types/dashboard";
import type { UnitContentData } from "@/types";

async function getAuthenticatedClient(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

interface ClassRow {
  id: string;
  name: string;
  code: string;
  framework?: string;
  /** Phase 3.4c — role this teacher holds on the class (lead_teacher,
   *  co_teacher, dept_head, mentor, lab_tech, observer). Co-teachers
   *  see additional classes here that the legacy classes.teacher_id
   *  filter would have hidden. */
  role?: string;
}

interface StudentRow {
  id: string;
  username: string;
  display_name: string | null;
  class_id: string; // Resolved from class_students junction
}

interface ClassUnitRow {
  class_id: string;
  unit_id: string;
  forked_at: string | null; // non-null = has per-class fork (migration 040)
  nm_config: { enabled?: boolean } | null; // per-class NM config
  units: {
    id: string;
    title: string;
    content_data: UnitContentData;
    nm_config: { enabled?: boolean } | null; // unit-level fallback
  };
}

interface ProgressRow {
  student_id: string;
  unit_id: string;
  page_id: string;
  status: string;
  updated_at: string;
  integrity_metadata?: Record<string, unknown> | null;
}

/**
 * GET: Aggregated dashboard data for the teacher
 */
export const GET = withErrorHandler("teacher/dashboard:GET", async (request: NextRequest) => {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const supabase = (await getAuthenticatedClient(request)).supabase;

  // 1. Fetch all non-archived classes the teacher is a MEMBER of (Phase 3.4c —
  //    expanded from `.eq("teacher_id", teacherId)` to read class_members so
  //    co_teacher / dept_head / mentor / lab_tech / observer see shared
  //    classes too. Phase 0.8a backfilled lead_teacher rows for every
  //    existing class; Phase 3.4b trigger seeds them on new INSERT, so
  //    every owner still sees their classes after this change.).
  //    Sorted client-side post-projection because PostgREST embed-order is
  //    awkward across the join.
  const { data: memberships } = await supabase
    .from("class_members")
    .select(
      "class_id, role, classes!inner(id, name, code, framework, is_archived, created_at)"
    )
    .eq("member_user_id", teacherId)
    .is("removed_at", null);

  type ClassEmbed = {
    id: string;
    name: string;
    code: string;
    framework?: string;
    is_archived?: boolean;
    created_at?: string;
  };
  type ClassWithSort = ClassRow & { _createdAt: string };

  const projected: ClassWithSort[] = [];
  for (const m of memberships ?? []) {
    const cls = (m as { classes: ClassEmbed | ClassEmbed[] }).classes;
    const c = Array.isArray(cls) ? cls[0] : cls;
    if (!c || c.is_archived === true) continue;
    projected.push({
      id: c.id,
      name: c.name,
      code: c.code,
      framework: c.framework,
      role: m.role as string,
      _createdAt: c.created_at ?? "",
    });
  }

  projected.sort((a, b) => b._createdAt.localeCompare(a._createdAt));

  const classes: ClassRow[] = projected.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    framework: p.framework,
    role: p.role,
  }));

  if (!classes || classes.length === 0) {
    const empty: DashboardData = {
      classes: [],
      stuckStudents: [],
      recentActivity: [],
    };
    return NextResponse.json(empty);
  }

  const classIds = classes.map((c: ClassRow) => c.id);

  // 2-4: Parallel queries (including teacher profile for NM global toggle)
  // NOTE: Progress query moved below — needs student IDs which aren't available yet
  const [classUnitsRes, studentsRes, teacherProfileRes] = await Promise.all([
    // Active class_units with unit title (content_data on units only — for page counting)
    // forked_at used for fork detection instead of fetching full content_data JSONB
    supabase
      .from("class_units")
      .select("class_id, unit_id, nm_config, forked_at, units!inner(id, title, content_data, nm_config)")
      .in("class_id", classIds)
      .eq("is_active", true),
    // All students in teacher's classes (via class_students junction — migration 041)
    supabase
      .from("class_students")
      .select("student_id, class_id, students(id, username, display_name)")
      .in("class_id", classIds)
      .eq("is_active", true),
    // Teacher profile — check global NM toggle (stored in teacher_profiles)
    supabase
      .from("teacher_profiles")
      .select("school_context")
      .eq("teacher_id", teacherId)
      .maybeSingle(),
  ]);

  const classUnits = (classUnitsRes.data || []) as unknown as ClassUnitRow[];
  // Map junction rows to StudentRow shape (class_students → students nested)
  const students: StudentRow[] = ((studentsRes.data || []) as any[])
    .filter((row: any) => row.students) // skip if nested student is null
    .map((row: any) => ({
      id: row.students.id,
      username: row.students.username,
      display_name: row.students.display_name,
      class_id: row.class_id, // from junction, not from students table
    }));
  const globalNmEnabled = !!(teacherProfileRes.data as { school_context?: { use_new_metrics?: boolean } } | null)?.school_context?.use_new_metrics;

  // Now fetch progress with actual student IDs (couldn't do in parallel above)
  const studentIds = students.map((s) => s.id);
  const uniqueUnitIds = [...new Set(classUnits.map((cu) => cu.unit_id))];

  // Parallel: progress query + unit metadata (both depend on classUnits being resolved)
  const unitTypeMap = new Map<string, string>();
  const thumbnailMap = new Map<string, string>();
  let progress: ProgressRow[] = [];

  const parallelPromises: Promise<void>[] = [];

  // Progress query (needs student IDs + unit IDs)
  // Try with integrity_metadata first (migration 054), fall back without
  if (studentIds.length > 0 && uniqueUnitIds.length > 0) {
    parallelPromises.push(
      (async () => {
        try {
          const { data, error: err } = await supabase
            .from("student_progress")
            .select("student_id, unit_id, page_id, status, updated_at, integrity_metadata")
            .in("student_id", studentIds)
            .in("unit_id", uniqueUnitIds);
          if (!err && data) {
            progress = data as ProgressRow[];
            return;
          }
        } catch { /* integrity_metadata column may not exist */ }
        // Fallback without integrity_metadata
        const { data } = await supabase
          .from("student_progress")
          .select("student_id, unit_id, page_id, status, updated_at")
          .in("student_id", studentIds)
          .in("unit_id", uniqueUnitIds);
        progress = (data || []) as ProgressRow[];
      })()
    );
  }

  // Unit metadata — separate try/catches so one missing column doesn't block the other
  // (Lesson Learned #19: PostgREST silently fails when selecting non-existent columns)
  if (uniqueUnitIds.length > 0) {
    // unit_type (migration 051)
    parallelPromises.push(
      (async () => {
        try {
          const { data } = await supabase
            .from("units")
            .select("id, unit_type")
            .in("id", uniqueUnitIds);
          if (data) {
            for (const row of data as { id: string; unit_type?: string }[]) {
              if (row.unit_type) unitTypeMap.set(row.id, row.unit_type);
            }
          }
        } catch { /* column may not exist */ }
      })()
    );
    // thumbnail_url (migration 052)
    parallelPromises.push(
      (async () => {
        try {
          const { data } = await supabase
            .from("units")
            .select("id, thumbnail_url")
            .in("id", uniqueUnitIds);
          if (data) {
            for (const row of data as { id: string; thumbnail_url?: string }[]) {
              if (row.thumbnail_url) thumbnailMap.set(row.id, row.thumbnail_url);
            }
          }
        } catch { /* column may not exist */ }
      })()
    );
  }

  await Promise.allSettled(parallelPromises);

  // Build lookup maps
  const studentById = new Map(students.map((s) => [s.id, s]));
  const classById = new Map(classes.map((c: ClassRow) => [c.id, c]));
  const studentsByClass = new Map<string, StudentRow[]>();
  for (const s of students) {
    const arr = studentsByClass.get(s.class_id) || [];
    arr.push(s);
    studentsByClass.set(s.class_id, arr);
  }

  // Build unit lookup (unitId -> { title, totalPages })
  // nmEnabled is per class-unit, not per unit — resolved later
  const unitInfo = new Map<
    string,
    { title: string; totalPages: number; unitType?: string; thumbnailUrl?: string }
  >();
  for (const cu of classUnits) {
    if (!unitInfo.has(cu.unit_id)) {
      const pages = getPageList(cu.units.content_data);
      unitInfo.set(cu.unit_id, {
        title: cu.units.title,
        totalPages: pages.length,
        unitType: unitTypeMap.get(cu.unit_id),
        thumbnailUrl: thumbnailMap.get(cu.unit_id),
      });
    }
  }

  // --- Stuck students ---
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
  const stuckStudents: StuckStudent[] = [];

  for (const p of progress) {
    if (p.status !== "in_progress") continue;
    const updatedMs = new Date(p.updated_at).getTime();
    if (updatedMs >= cutoffMs) continue;

    const student = studentById.get(p.student_id);
    if (!student) continue;
    const cls = classById.get(student.class_id);
    if (!cls) continue;
    const unit = unitInfo.get(p.unit_id);
    if (!unit) continue;

    stuckStudents.push({
      studentId: p.student_id,
      studentName: student.display_name || student.username,
      classId: student.class_id,
      className: cls.name,
      unitId: p.unit_id,
      unitTitle: unit.title,
      lastPageId: p.page_id,
      lastActivity: p.updated_at,
      hoursSinceUpdate: Math.round(
        (Date.now() - updatedMs) / (1000 * 60 * 60)
      ),
    });
  }

  // Sort by oldest first, limit 20
  stuckStudents.sort(
    (a, b) =>
      new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
  );
  stuckStudents.splice(20);

  // --- Recent activity ---
  const sortedProgress = [...progress].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const recentActivity: ActivityEvent[] = sortedProgress
    .slice(0, 20)
    .map((p) => {
      const student = studentById.get(p.student_id);
      const cls = student ? classById.get(student.class_id) : undefined;
      const unit = unitInfo.get(p.unit_id);
      return {
        studentId: p.student_id,
        studentName: student?.display_name || student?.username || "Unknown",
        classId: student?.class_id || "",
        className: cls?.name || "",
        unitId: p.unit_id,
        unitTitle: unit?.title || "",
        pageId: p.page_id,
        status: p.status,
        updatedAt: p.updated_at,
      };
    });

  // --- Open Studio counts ---
  // Query all unlocked Open Studio statuses for students in teacher's classes
  let openStudioByUnit = new Map<string, Set<string>>(); // unitId -> set of student IDs
  if (studentIds.length > 0) {
    const { data: osData } = await supabase
      .from("open_studio_status")
      .select("student_id, unit_id")
      .in("student_id", studentIds)
      .eq("status", "unlocked");
    if (osData) {
      for (const row of osData) {
        const set = openStudioByUnit.get(row.unit_id) || new Set();
        set.add(row.student_id);
        openStudioByUnit.set(row.unit_id, set);
      }
    }
  }

  // --- Badge requirements per unit ---
  const activeUnitIdsForBadges = [...new Set(classUnits.map((cu) => cu.unit_id))];
  const badgeReqByUnit = new Map<string, number>(); // unitId -> count of required badges
  if (activeUnitIdsForBadges.length > 0) {
    const { data: badgeReqs } = await supabase
      .from("unit_badge_requirements")
      .select("unit_id, badge_id")
      .in("unit_id", activeUnitIdsForBadges)
      .eq("is_required", true);
    if (badgeReqs) {
      for (const br of badgeReqs) {
        badgeReqByUnit.set(br.unit_id, (badgeReqByUnit.get(br.unit_id) || 0) + 1);
      }
    }
  }

  // --- Class overview ---
  // Group class_units by class
  const cuByClass = new Map<string, ClassUnitRow[]>();
  for (const cu of classUnits) {
    const arr = cuByClass.get(cu.class_id) || [];
    arr.push(cu);
    cuByClass.set(cu.class_id, arr);
  }

  // Group progress by (unit_id, student_id)
  const progressByUnit = new Map<string, ProgressRow[]>();
  for (const p of progress) {
    const arr = progressByUnit.get(p.unit_id) || [];
    arr.push(p);
    progressByUnit.set(p.unit_id, arr);
  }

  const dashboardClasses: DashboardClass[] = classes.map((cls: ClassRow) => {
    const classStudents = studentsByClass.get(cls.id) || [];
    const classStudentIds = new Set(classStudents.map((s) => s.id));
    const activeUnits = cuByClass.get(cls.id) || [];

    const units: DashboardUnit[] = activeUnits.map((cu) => {
      const info = unitInfo.get(cu.unit_id)!;
      const unitProgress = (progressByUnit.get(cu.unit_id) || []).filter(
        (p) => classStudentIds.has(p.student_id)
      );

      // Count statuses
      let completedCount = 0;
      let inProgressCount = 0;
      for (const p of unitProgress) {
        if (p.status === "complete") completedCount++;
        else if (p.status === "in_progress") inProgressCount++;
      }

      const totalCells = classStudents.length * info.totalPages;
      const notStartedCount = totalCells - completedCount - inProgressCount;
      const completionPct =
        totalCells > 0 ? Math.round((completedCount / totalCells) * 100) : 0;

      // Count Open Studio unlocks for this unit's students in this class
      const osSet = openStudioByUnit.get(cu.unit_id);
      let osCount = 0;
      if (osSet) {
        for (const sid of osSet) {
          if (classStudentIds.has(sid)) osCount++;
        }
      }

      // NM enabled: global toggle must be on, then check class_units.nm_config → units.nm_config
      const nmEnabled = globalNmEnabled && (cu.nm_config?.enabled ?? cu.units.nm_config?.enabled ?? false);

      return {
        unitId: cu.unit_id,
        unitTitle: info.title,
        totalPages: info.totalPages,
        completedCount,
        inProgressCount,
        notStartedCount: Math.max(0, notStartedCount),
        completionPct,
        openStudioCount: osCount,
        nmEnabled: !!nmEnabled,
        badgeRequirementCount: badgeReqByUnit.get(cu.unit_id) || 0,
        isForked: !!cu.forked_at,
        unitType: unitInfo.get(cu.unit_id)?.unitType || undefined,
        thumbnailUrl: unitInfo.get(cu.unit_id)?.thumbnailUrl || undefined,
      };
    });

    return {
      id: cls.id,
      name: cls.name,
      code: cls.code,
      framework: cls.framework || "IB_MYP",
      studentCount: classStudents.length,
      units,
    };
  });

  // --- Unmarked work: students with completed pages to review ---
  const unmarkedWorkMap = new Map<string, UnmarkedWorkItem>(); // key: studentId-unitId
  for (const p of progress) {
    if (p.status !== "complete") continue;
    const student = studentById.get(p.student_id);
    if (!student) continue;
    const cls = classById.get(student.class_id);
    if (!cls) continue;
    const unit = unitInfo.get(p.unit_id);
    if (!unit) continue;

    const key = `${p.student_id}-${p.unit_id}`;
    const existing = unmarkedWorkMap.get(key);
    const hasIntegrity = !!(p.integrity_metadata && typeof p.integrity_metadata === "object" && Object.keys(p.integrity_metadata).length > 0);

    if (existing) {
      existing.completedPages++;
      if (new Date(p.updated_at) > new Date(existing.lastCompletedAt)) {
        existing.lastCompletedAt = p.updated_at;
      }
      if (hasIntegrity) existing.hasIntegrityFlags = true;
    } else {
      unmarkedWorkMap.set(key, {
        studentId: p.student_id,
        studentName: student.display_name || student.username,
        classId: student.class_id,
        className: cls.name,
        unitId: p.unit_id,
        unitTitle: unit.title,
        completedPages: 1,
        totalPages: unit.totalPages,
        lastCompletedAt: p.updated_at,
        hasIntegrityFlags: hasIntegrity,
      });
    }
  }

  // Sort by most recently completed, limit 20
  const unmarkedWork = [...unmarkedWorkMap.values()]
    .sort((a, b) => new Date(b.lastCompletedAt).getTime() - new Date(a.lastCompletedAt).getTime())
    .slice(0, 20);

  // --- Smart Insights: priority-sorted mixed alerts ---
  const insights: DashboardInsight[] = [];
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const twoDaysMs = 48 * 60 * 60 * 1000;

  // Track which students completed ALL pages in a unit
  const completedPagesByStudentUnit = new Map<string, number>(); // "sid-uid" -> count
  for (const p of progress) {
    if (p.status !== "complete") continue;
    const key = `${p.student_id}-${p.unit_id}`;
    completedPagesByStudentUnit.set(key, (completedPagesByStudentUnit.get(key) || 0) + 1);
  }

  // Deduplicate: one insight per student-unit per type
  const insightSeen = new Set<string>();

  for (const p of progress) {
    const student = studentById.get(p.student_id);
    if (!student) continue;
    const cls = classById.get(student.class_id);
    if (!cls) continue;
    const unit = unitInfo.get(p.unit_id);
    if (!unit) continue;

    const updatedMs = new Date(p.updated_at).getTime();
    const ageMs = nowMs - updatedMs;
    const studentLabel = student.display_name || student.username;
    const baseHref = `/teacher/units/${p.unit_id}/class/${student.class_id}`;

    // --- Integrity flags on completed work ---
    if (p.status === "complete" && p.integrity_metadata) {
      const meta = p.integrity_metadata as Record<string, unknown>;
      const pasteEvents = meta.pasteEvents as unknown[];
      const hasPastes = Array.isArray(pasteEvents) && pasteEvents.length > 0;
      const keystrokeCount = (meta.keystrokeCount as number) || 0;
      const focusLossCount = (meta.focusLossCount as number) || 0;

      // Red flag: significant paste activity or very low keystrokes with content
      if (hasPastes || keystrokeCount < 20 || focusLossCount > 10) {
        const ikey = `integrity-${p.student_id}-${p.unit_id}`;
        if (!insightSeen.has(ikey)) {
          insightSeen.add(ikey);
          const isSevere = hasPastes && keystrokeCount < 50;
          insights.push({
            type: isSevere ? "integrity_flag" : "integrity_warning",
            priority: isSevere ? 90 : 55,
            title: hasPastes ? "Possible copy-paste detected" : focusLossCount > 10 ? "Frequent tab-switching" : "Very low keystroke count",
            subtitle: `${studentLabel} · ${cls.name} · ${unit.title}`,
            // DT canvas Phase 3.6 cutover: ?tab=progress was the
            // legacy alias for "land on the Progress tab" — the canvas
            // IS the progress view now, so the bare URL is canonical.
            href: baseHref,
            studentName: studentLabel,
            accentColor: isSevere ? "#EF4444" : "#F59E0B",
            timestamp: p.updated_at,
          });
        }
      }
    }

    // --- Stale unmarked work (completed 7+ days ago) ---
    if (p.status === "complete" && ageMs > sevenDaysMs) {
      const skey = `stale-${p.student_id}-${p.unit_id}`;
      if (!insightSeen.has(skey)) {
        insightSeen.add(skey);
        const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        insights.push({
          type: "stale_unmarked",
          priority: Math.min(85, 70 + days), // gets more urgent over time, cap at 85
          title: `Unmarked work — ${days} days`,
          subtitle: `${studentLabel} · ${cls.name} · ${unit.title}`,
          // DT canvas Phase 3.6 cutover: was `${baseHref}?tab=grade`
          // which redirected via the canvas to /teacher/marking. Route
          // directly to skip the redirect hop.
          href: `/teacher/marking?class=${student.class_id}&unit=${p.unit_id}`,
          studentName: studentLabel,
          accentColor: "#F59E0B",
          timestamp: p.updated_at,
        });
      }
    }

    // --- Recent completion (last 48 hours, not stale) ---
    if (p.status === "complete" && ageMs <= twoDaysMs) {
      const rkey = `recent-${p.student_id}-${p.unit_id}`;
      if (!insightSeen.has(rkey)) {
        insightSeen.add(rkey);
        insights.push({
          type: "recent_completion",
          priority: 45,
          title: "New work submitted",
          subtitle: `${studentLabel} · ${cls.name} · ${unit.title}`,
          // DT canvas Phase 3.6 cutover: direct marking URL (was
          // legacy `${baseHref}?tab=grade` canvas-redirect).
          href: `/teacher/marking?class=${student.class_id}&unit=${p.unit_id}`,
          studentName: studentLabel,
          accentColor: "#10B981",
          timestamp: p.updated_at,
        });
      }
    }

    // --- Stuck student (in_progress 48+ hours) ---
    if (p.status === "in_progress" && ageMs > twoDaysMs) {
      const stkey = `stuck-${p.student_id}-${p.unit_id}`;
      if (!insightSeen.has(stkey)) {
        insightSeen.add(stkey);
        const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        insights.push({
          type: "stuck_student",
          priority: 55,
          title: `Stuck for ${days > 0 ? days + "d" : Math.floor(ageMs / 3600000) + "h"}`,
          subtitle: `${studentLabel} · ${cls.name} · ${unit.title}`,
          // Polish (17 May 2026): adds the &student=<id> deep-link
          // qualifier the canvas's legacy ?tab=...&student=...&page=...
          // compat handler picks up to open StudentDrawer on land. Now
          // a "go check on THIS student" insight is one click instead
          // of two (land on canvas → find student → click name).
          href: `${baseHref}?student=${p.student_id}`,
          studentName: studentLabel,
          accentColor: "#6366F1",
          timestamp: p.updated_at,
        });
      }
    }
  }

  // --- Unit complete milestones ---
  for (const [key, count] of completedPagesByStudentUnit) {
    const [sid, uid] = key.split("-");
    const unit = unitInfo.get(uid);
    if (!unit || count < unit.totalPages || unit.totalPages === 0) continue;
    const student = studentById.get(sid);
    if (!student) continue;
    const cls = classById.get(student.class_id);
    if (!cls) continue;

    const uckey = `complete-${sid}-${uid}`;
    if (!insightSeen.has(uckey)) {
      insightSeen.add(uckey);
      insights.push({
        type: "unit_complete",
        priority: 65,
        title: "Finished entire unit",
        subtitle: `${student.display_name || student.username} · ${cls.name} · ${unit.title}`,
        // DT canvas Phase 3.6 cutover: direct marking URL (was
        // legacy `?tab=grade` canvas-redirect).
        href: `/teacher/marking?class=${student.class_id}&unit=${uid}`,
        studentName: student.display_name || student.username,
        accentColor: "#7C3AED",
        timestamp: new Date().toISOString(), // no single timestamp for "all pages done"
      });
    }
  }

  // Sort by priority (desc), then recency (desc). Limit to 20.
  insights.sort((a, b) => b.priority - a.priority || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  insights.splice(20);

  const data: DashboardData = {
    classes: dashboardClasses,
    stuckStudents,
    recentActivity,
    unmarkedWork,
    insights,
  };

  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
});
