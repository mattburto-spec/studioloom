import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
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
  class_id: string;
}

interface ClassUnitRow {
  class_id: string;
  unit_id: string;
  units: {
    id: string;
    title: string;
    content_data: UnitContentData;
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
export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teacherId = user.id;

  // 1. Fetch all classes for this teacher
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, code")
    .eq("teacher_id", teacherId)
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

  // 2-4: Parallel queries
  const [classUnitsRes, studentsRes, progressRes] = await Promise.all([
    // Active class_units with unit title + content_data
    supabase
      .from("class_units")
      .select("class_id, unit_id, units!inner(id, title, content_data)")
      .in("class_id", classIds)
      .eq("is_active", true),
    // All students in teacher's classes
    supabase
      .from("students")
      .select("id, username, display_name, class_id")
      .in("class_id", classIds),
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
  ]);

  const classUnits = (classUnitsRes.data || []) as unknown as ClassUnitRow[];
  const students = (studentsRes.data || []) as StudentRow[];

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

      return {
        unitId: cu.unit_id,
        unitTitle: info.title,
        totalPages: info.totalPages,
        completedCount,
        inProgressCount,
        notStartedCount: Math.max(0, notStartedCount),
        completionPct,
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
}
