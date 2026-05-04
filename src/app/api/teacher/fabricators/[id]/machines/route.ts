// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * PATCH /api/teacher/fabricators/[id]/machines
 *
 * Replace the set of machine assignments for a fabricator.
 *
 * Phase 8-1 + Round 2 audit (4 May 2026): both ownership gates
 * flipped to school-scoped. Any teacher at the same school can
 * reassign machines on any fab at the school. Each machineId must
 * be either a system template (school_id NULL) or a non-template
 * machine at the same school as the calling teacher.
 *
 * Note: Phase 8.1d-9 deprecated the fabricator_machines junction
 * as a visibility mechanism (queue scopes by school + lab now).
 * This route still writes the table for legacy clients but the
 * data isn't load-bearing. PH9-FU-FAB-MACHINE-RESTRICT may revive
 * it post-pilot for opt-in restrictions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  loadTeacherSchoolId,
  isOrchestrationError,
} from "@/lib/fabrication/lab-orchestration";
import { loadSchoolOwnedFabricator } from "@/lib/fabrication/fab-orchestration";

async function getTeacherUser(request: NextRequest) {
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
  return user;
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  let body: { machineIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const machineIds = Array.isArray(body.machineIds)
    ? body.machineIds.filter((mid): mid is string => typeof mid === "string")
    : [];

  if (machineIds.length === 0) {
    return privateJson({ error: "At least one machine must be assigned" }, 400);
  }

  const admin = createAdminClient();

  // School-scoped ownership check on the fabricator + the machines.
  const schoolResult = await loadTeacherSchoolId(admin, user.id);
  if (isOrchestrationError(schoolResult)) {
    return privateJson(
      { error: schoolResult.error.message },
      schoolResult.error.status
    );
  }
  const schoolId = schoolResult.schoolId;

  const fabResult = await loadSchoolOwnedFabricator(admin, schoolId, id);
  if (isOrchestrationError(fabResult)) {
    return privateJson(
      { error: fabResult.error.message },
      fabResult.error.status
    );
  }

  // Validate each machineId — must be a system template (school_id
  // IS NULL by design) OR a non-template machine at the same school
  // as the calling teacher. Phase 8-3 made school_id NOT NULL for
  // non-templates, so the check is uniform.
  const { data: profiles } = await admin
    .from("machine_profiles")
    .select("id, is_system_template, school_id")
    .in("id", machineIds);

  const allowedIds = new Set(
    (profiles ?? [])
      .filter(
        (p) =>
          p.is_system_template === true ||
          p.school_id === schoolId
      )
      .map((p) => p.id)
  );

  const rejected = machineIds.filter((mid) => !allowedIds.has(mid));
  if (rejected.length > 0) {
    return privateJson(
      { error: "One or more machines are not accessible at this school.", rejected },
      400
    );
  }

  // Replace the set.
  await admin
    .from("fabricator_machines")
    .delete()
    .eq("fabricator_id", id);

  const rows = machineIds.map((mid) => ({
    fabricator_id: id,
    machine_profile_id: mid,
    assigned_by_teacher_id: user.id,
  }));
  const { error: insertError } = await admin
    .from("fabricator_machines")
    .insert(rows);
  if (insertError) {
    return privateJson(
      { error: `Assignment failed: ${insertError.message}` },
      500
    );
  }

  return privateJson({ ok: true, machineIds });
}
