/**
 * PATCH /api/teacher/fabricators/[id]/machines
 *
 * Replace the set of machine assignments for a fabricator. The teacher must
 * own the fabricator (invited_by_teacher_id = auth.uid()). Each machineId
 * must be either a system-template profile or owned by this teacher.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";

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

  // Ownership check on the fabricator.
  const { data: fabricator } = await admin
    .from("fabricators")
    .select("id, invited_by_teacher_id")
    .eq("id", id)
    .maybeSingle();

  if (!fabricator || fabricator.invited_by_teacher_id !== user.id) {
    return privateJson({ error: "Not found" }, 404);
  }

  // Validate each machineId — must be system template or teacher-owned.
  const { data: profiles } = await admin
    .from("machine_profiles")
    .select("id, is_system_template, teacher_id")
    .in("id", machineIds);

  const allowedIds = new Set(
    (profiles ?? [])
      .filter(
        (p) =>
          p.is_system_template === true ||
          p.teacher_id === user.id
      )
      .map((p) => p.id)
  );

  const rejected = machineIds.filter((mid) => !allowedIds.has(mid));
  if (rejected.length > 0) {
    return privateJson(
      { error: "One or more machines are not accessible to this teacher.", rejected },
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
