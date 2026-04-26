import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";
import { getPageList } from "@/lib/unit-adapter";

/* ──────────────────────────────────────────────────────────────
 * GET /api/teacher/pypx-cohort?classId=…&unitId=…
 *
 * Single read endpoint that powers the rebuilt PYPX teacher view
 * (Phase 13b). Returns the cohort overview the dashboard hero cares
 * about + one row per enrolled student with everything needed to
 * render the student card grid.
 *
 * Joins:
 *   class_units    → exhibition_date + unit content_data (totalPages)
 *   class_students → enrolled student_ids
 *   students       → display_name / username for the avatar + label
 *   student_projects → title / central_idea / theme / mentor_teacher_id
 *   teachers       → mentor display name + initials (only if mentor set)
 *   student_progress → completed-page count + most-recent updated_at
 *
 * Heuristics (per 13b decisions, v1):
 *   - progressPct = completedPages / totalPages * 100
 *   - currentPhase = 5-bucket of progressPct
 *       (0-20 wonder · 20-40 findout · 40-60 make · 60-80 share · 80+ reflect)
 *     This ignores any value already in `student_projects.current_phase` for
 *     v1; once an AI-driven writer lands later, swap the source so the column
 *     overrides the heuristic.
 *   - status:
 *       Ahead             progressPct ≥ cohortAvgPct + 15
 *       Needs attention   progressPct ≤ cohortAvgPct − 15
 *                         OR no project title (always-flag override)
 *                         OR no activity in 7+ days
 *       On track          else
 * ────────────────────────────────────────────────────────────── */

type Phase = "wonder" | "findout" | "make" | "share" | "reflect";
type Status = "on_track" | "needs_attention" | "ahead";

const STATUS_THRESHOLD_PCT = 15;
const STALLED_DAYS = 7;

function bucketPhase(pct: number): Phase {
  if (pct < 20) return "wonder";
  if (pct < 40) return "findout";
  if (pct < 60) return "make";
  if (pct < 80) return "share";
  return "reflect";
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface CohortStudent {
  id: string;
  displayName: string;
  avatarInitials: string;
  projectTitle: string | null;
  centralIdea: string | null;
  transdisciplinaryTheme: string | null;
  mentorId: string | null;
  mentorName: string | null;
  mentorInitials: string | null;
  progressPct: number;
  completedPages: number;
  totalPages: number;
  currentPhase: Phase;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  status: Status;
  statusReason?: string;
}

interface CohortResponse {
  exhibitionDate: string | null;
  daysUntilExhibition: number | null;
  cohortAvgPct: number;
  needsAttentionCount: number;
  aheadCount: number;
  phaseDistribution: Record<Phase, number>;
  totalStudents: number;
  totalPages: number;
  students: CohortStudent[];
}

export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const unitId = url.searchParams.get("unitId");
  if (!classId || !unitId) {
    return NextResponse.json(
      { error: "classId + unitId required" },
      { status: 400 },
    );
  }

  const owns = await verifyTeacherOwnsClass(auth.teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();

  // ── 1. class_unit row (exhibition_config + unit.content_data for totalPages)
  const { data: classUnit, error: cuErr } = await db
    .from("class_units")
    .select("exhibition_config, units!inner(id, title, content_data)")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .maybeSingle();

  if (cuErr) {
    console.error("[pypx-cohort] class_units", cuErr);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
  if (!classUnit) {
    return NextResponse.json(
      { error: "class_unit not found" },
      { status: 404 },
    );
  }

  const exhibitionConfig = (classUnit.exhibition_config ?? {}) as {
    exhibition_date?: string | null;
  };
  const exhibitionDate = exhibitionConfig.exhibition_date ?? null;

  // Days until exhibition (negative if past)
  let daysUntilExhibition: number | null = null;
  if (exhibitionDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exh = new Date(exhibitionDate + "T00:00:00");
    daysUntilExhibition = Math.round(
      (exh.getTime() - today.getTime()) / 86_400_000,
    );
  }

  // PostgREST returns the joined relation as either an object or array
  // depending on cardinality — units!inner gives us an object here.
  const unitRow = classUnit.units as unknown as {
    id: string;
    title: string;
    content_data: unknown;
  };
  const totalPages = getPageList(
    unitRow.content_data as Parameters<typeof getPageList>[0],
  ).length;

  // ── 2. enrolled students
  const { data: classStudents, error: csErr } = await db
    .from("class_students")
    .select("student_id, students!inner(id, username, display_name)")
    .eq("class_id", classId)
    .eq("is_active", true);

  if (csErr) {
    console.error("[pypx-cohort] class_students", csErr);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }

  const students = (classStudents ?? [])
    .map((row) => {
      const s = row.students as unknown as {
        id: string;
        username: string;
        display_name: string | null;
      } | null;
      if (!s) return null;
      return {
        id: s.id,
        displayName: s.display_name || s.username,
      };
    })
    .filter((s): s is { id: string; displayName: string } => s !== null);

  const studentIds = students.map((s) => s.id);

  // Empty class — return early with clean zero-state response. The UI
  // surfaces an "Enrol students first" empty banner on its own.
  if (studentIds.length === 0) {
    const empty: CohortResponse = {
      exhibitionDate,
      daysUntilExhibition,
      cohortAvgPct: 0,
      needsAttentionCount: 0,
      aheadCount: 0,
      phaseDistribution: { wonder: 0, findout: 0, make: 0, share: 0, reflect: 0 },
      totalStudents: 0,
      totalPages,
      students: [],
    };
    return NextResponse.json(empty);
  }

  // ── 3. parallel: projects, progress rows, mentors
  // Mentor IDs come from the projects fetch — chain rather than parallel.
  const [projectsRes, progressRes] = await Promise.all([
    db
      .from("student_projects")
      .select(
        "student_id, title, central_idea, transdisciplinary_theme, mentor_teacher_id",
      )
      .eq("class_id", classId)
      .eq("unit_id", unitId)
      .in("student_id", studentIds),
    db
      .from("student_progress")
      .select("student_id, page_id, status, updated_at")
      .eq("unit_id", unitId)
      .in("student_id", studentIds),
  ]);

  if (projectsRes.error) {
    console.error("[pypx-cohort] student_projects", projectsRes.error);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
  if (progressRes.error) {
    console.error("[pypx-cohort] student_progress", progressRes.error);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }

  // Index projects by student_id
  const projectByStudent = new Map<
    string,
    {
      title: string | null;
      central_idea: string | null;
      transdisciplinary_theme: string | null;
      mentor_teacher_id: string | null;
    }
  >();
  for (const p of projectsRes.data ?? []) {
    projectByStudent.set(p.student_id, {
      title: p.title as string | null,
      central_idea: p.central_idea as string | null,
      transdisciplinary_theme: p.transdisciplinary_theme as string | null,
      mentor_teacher_id: p.mentor_teacher_id as string | null,
    });
  }

  // Aggregate progress: count completed pages + capture latest updated_at
  // per student. "complete" status = page done; ignore in_progress + others
  // for the headline progressPct (matches the existing dashboard pattern).
  const completedByStudent = new Map<string, number>();
  const lastActivityByStudent = new Map<string, string>();
  for (const row of progressRes.data ?? []) {
    const sid = row.student_id as string;
    if (row.status === "complete") {
      completedByStudent.set(sid, (completedByStudent.get(sid) ?? 0) + 1);
    }
    const ua = row.updated_at as string | null;
    if (ua) {
      const prev = lastActivityByStudent.get(sid);
      if (!prev || ua > prev) lastActivityByStudent.set(sid, ua);
    }
  }

  // Mentor details — fetch teachers in one shot if any project has a
  // mentor assigned.
  const mentorIds = new Set<string>();
  for (const p of projectByStudent.values()) {
    if (p.mentor_teacher_id) mentorIds.add(p.mentor_teacher_id);
  }
  const mentorById = new Map<
    string,
    { name: string; initials: string }
  >();
  if (mentorIds.size > 0) {
    const { data: mentors } = await db
      .from("teachers")
      .select("id, name, display_name")
      .in("id", Array.from(mentorIds));
    for (const m of mentors ?? []) {
      const display =
        (m.display_name as string | null) ||
        (m.name as string | null) ||
        "Unnamed";
      mentorById.set(m.id as string, {
        name: display,
        initials: initialsFor(display),
      });
    }
  }

  // ── 4. compose per-student rows + cohort avg (first pass, no status yet)
  const now = Date.now();
  const cappedTotalPages = Math.max(totalPages, 1); // avoid divide-by-zero

  const partial: Omit<CohortStudent, "status" | "statusReason">[] = students
    .map((s) => {
      const completed = Math.min(
        completedByStudent.get(s.id) ?? 0,
        cappedTotalPages,
      );
      const progressPct = Math.round((completed / cappedTotalPages) * 100);
      const lastActivityAt = lastActivityByStudent.get(s.id) ?? null;
      let daysSinceActivity: number | null = null;
      if (lastActivityAt) {
        daysSinceActivity = Math.floor(
          (now - new Date(lastActivityAt).getTime()) / 86_400_000,
        );
      }
      const project = projectByStudent.get(s.id);
      const mentor = project?.mentor_teacher_id
        ? mentorById.get(project.mentor_teacher_id) ?? null
        : null;

      return {
        id: s.id,
        displayName: s.displayName,
        avatarInitials: initialsFor(s.displayName),
        projectTitle: project?.title ?? null,
        centralIdea: project?.central_idea ?? null,
        transdisciplinaryTheme: project?.transdisciplinary_theme ?? null,
        mentorId: project?.mentor_teacher_id ?? null,
        mentorName: mentor?.name ?? null,
        mentorInitials: mentor?.initials ?? null,
        progressPct,
        completedPages: completed,
        totalPages,
        currentPhase: bucketPhase(progressPct),
        lastActivityAt,
        daysSinceActivity,
      };
    })
    // Stable order matches the inline editor (alphabetical by display name).
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const cohortAvgPct =
    partial.length > 0
      ? Math.round(
          partial.reduce((sum, s) => sum + s.progressPct, 0) / partial.length,
        )
      : 0;

  // ── 5. compute status per student against cohort avg
  const cohort: CohortStudent[] = partial.map((s) => {
    const reasons: string[] = [];
    let status: Status = "on_track";

    // Ahead path first — needs-attention overrides if both apply.
    if (s.progressPct >= cohortAvgPct + STATUS_THRESHOLD_PCT) {
      status = "ahead";
    }

    // Hard rules that flip to needs-attention regardless.
    if (!s.projectTitle) {
      status = "needs_attention";
      reasons.push("No project title yet");
    }
    if (s.progressPct <= cohortAvgPct - STATUS_THRESHOLD_PCT) {
      status = "needs_attention";
      reasons.push(
        `${cohortAvgPct - s.progressPct}% behind cohort average`,
      );
    }
    if (s.daysSinceActivity != null && s.daysSinceActivity >= STALLED_DAYS) {
      status = "needs_attention";
      reasons.push(`Stalled ${s.daysSinceActivity} days`);
    }

    return {
      ...s,
      status,
      ...(reasons.length > 0 ? { statusReason: reasons.join(" · ") } : {}),
    };
  });

  // Counts + phase distribution
  let needsAttentionCount = 0;
  let aheadCount = 0;
  const phaseDistribution: Record<Phase, number> = {
    wonder: 0,
    findout: 0,
    make: 0,
    share: 0,
    reflect: 0,
  };
  for (const s of cohort) {
    if (s.status === "needs_attention") needsAttentionCount++;
    else if (s.status === "ahead") aheadCount++;
    phaseDistribution[s.currentPhase]++;
  }

  const response: CohortResponse = {
    exhibitionDate,
    daysUntilExhibition,
    cohortAvgPct,
    needsAttentionCount,
    aheadCount,
    phaseDistribution,
    totalStudents: cohort.length,
    totalPages,
    students: cohort,
  };

  return NextResponse.json(response);
}
