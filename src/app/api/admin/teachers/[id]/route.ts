/**
 * DELETE /api/admin/teachers/[id]
 *
 * Admin-only endpoint to remove a teacher.
 *
 * Safety model:
 *   1. The `system@studioloom.internal` account is protected (it owns seeded
 *      Teaching Moves and other system-authored content).
 *   2. A teacher cannot be deleted while they still own classes or units —
 *      the admin must reassign or delete those resources first. This keeps
 *      accidental cascade-wipes of real teaching content from being one
 *      click away.
 *   3. For teachers with 0 classes and 0 units, deletion is executed via
 *      Supabase's `auth.admin.deleteUser()`. The `teachers` row + all
 *      tables with FK `ON DELETE CASCADE` to `auth.users(id)` clean up
 *      automatically (knowledge_*, cost_rollups, generation_runs, etc.).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PROTECTED_EMAILS = new Set([
  "system@studioloom.internal",
]);

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load the teacher row (also surfaces non-existent ids as 404).
  const { data: teacher, error: loadErr } = await supabase
    .from("teachers")
    .select("id, email, name")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  // Protect system accounts.
  if (teacher.email && PROTECTED_EMAILS.has(teacher.email.toLowerCase())) {
    return NextResponse.json(
      { error: "System accounts cannot be deleted." },
      { status: 403 }
    );
  }

  // Guard: don't delete teachers who still own content.
  const [{ count: classCount }, { count: unitCount }] = await Promise.all([
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", id),
    supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .eq("author_teacher_id", id),
  ]);

  if ((classCount ?? 0) > 0 || (unitCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          `This teacher still owns ${classCount ?? 0} class(es) and ${unitCount ?? 0} unit(s). ` +
          `Reassign or delete their classes and units before removing the account.`,
        classCount: classCount ?? 0,
        unitCount: unitCount ?? 0,
      },
      { status: 409 }
    );
  }

  // Cascade-delete via Supabase Auth admin API. The teachers row + all
  // tables with FK ON DELETE CASCADE to auth.users(id) clean up automatically.
  const { error: deleteErr } = await supabase.auth.admin.deleteUser(id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: {
      id: teacher.id,
      email: teacher.email,
      name: teacher.name,
    },
  });
}
