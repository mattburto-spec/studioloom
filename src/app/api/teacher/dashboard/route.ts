import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getPageList } from "@/lib/unit-adapter";
import type {
  DashboardData,
  DashboardClass,
  DashboardUnit,
  StuckStudent,
  ActivityEvent,
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
}

/**
 * GET: Aggregated dashboard data for the teacher
 */
export const GET = withErrorHandler("teacher/dashboard:GET", async (request: NextRequest) => {
  const { supabase, user } = await getAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teacherId = user.id;

  // 1. Fetch all non-archived classes for this teacher
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, code")
    .eq("teacher_id", teacherId)
    .neq("is_archived", true)
    .order("created_at", { ascending: false });

  if (!classes || classes.length === 0) {
    const empty: DashboardData = {
      classes: [],
      stuckStudents: [],
      recentActivity: [],
    };
    return NextResponse.json(empty);
  }

  const classIds = classes.map((c: ClassRow) => c.id);

  // 2-5: Parallel queries (including teacher profile for NM global toggle)
  const [classUnitsRes, studentsRes, progressRes, teacherProfileRes] = await Promise.all([
    // Active class_units with unit title + content_data
    supabase
      .from("class_units")
      .select("class_id, unit_id, nm_config, content_data, units!inner(id, title, content_data, nm_config)")
      .in("class_id", classIds)
      .eq("is_active", true),
    // All students in teacher's classes (via class_students junction — migration 041)
    supabase
      .from("class_students")
      .select("student_id, class_id, students(id, username, display_name)")
      .in("class_id", classIds)
      .eq("is_active", true),
    // All progress for students in these classes (no responses JSONB — just metadata)
    supabase
      .from("student_progress")
      .select("student_id, unit_id, page_id, status, updated_at")
      .in(
        "student_id",
        // We need student IDs, but we don't have them yet in this parallel query.
        // Instead, we'll filter progress after fetching students.
        // Use a broad query — RLS already scopes to teacher's students.
        []
      ),
    // Teacher profile — check global NM toggle (stored in teacher_profiles)
    supabase
      .from("teacher_profiles")
      .select("school_context")
      .eq("teacher_id", teacherId)
      .single(),
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
  let progress: ProgressRow[] = [];
  if (studentIds.length > 0) {
    const activeUnitIds = [
      ...new Set(classUnits.map((cu) => cu.unit_id)),
    ];
    if (activeUnitIds.length > 0) {
      const { data: progressData } = await supabase
        .from("student_progress")
        .select("student_id, unit_id, page_id, status, updated_at")
        .in("student_id", studentIds)
        .in("unit_id", activeUnitIds);
      progress = (progressData || []) as ProgressRow[];
    }
  }

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
    { title: string; totalPages: number }
  >();
  for (const cu of classUnits) {
    if (!unitInfo.has(cu.unit_id)) {
      const pages = getPageList(cu.units.content_data);
      unitInfo.set(cu.unit_id, {
        title: cu.units.title,
        totalPages: pages.length,
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
        isForked: !!(cu as Record<string, unknown>).content_data,
      };
    });

    return {
      id: cls.id,
      name: cls.name,
      code: cls.code,
      studentCount: classStudents.length,
      units,
    };
  });

  const data: DashboardData = {
    classes: dashboardClasses,
    stuckStudents,
    recentActivity,
  };

  return NextResponse.json(data);
});
