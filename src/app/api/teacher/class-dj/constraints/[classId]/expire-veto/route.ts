// audit-skip: routine teacher constraint maintenance; full record persisted to class_dj_veto_overrides
/**
 * POST /api/teacher/class-dj/constraints/[classId]/expire-veto
 *
 * Teacher manually expires a persistent veto. Inserts a row into
 * class_dj_veto_overrides keyed on (class_id, veto_text); the §3.3
 * persistent-veto query joins against this table and filters out
 * overridden vetoes.
 *
 * Brief: docs/projects/class-dj-block-brief.md §3.3 + §5.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";

interface ExpireBody {
  veto: string;
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ classId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { classId } = await ctx.params;
  let body: ExpireBody;
  try {
    body = (await request.json()) as ExpireBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.veto !== "string" || body.veto.trim().length === 0) {
    return NextResponse.json({ error: "veto must be a non-empty string" }, { status: 400 });
  }
  const vetoText = body.veto.toLowerCase().trim().slice(0, 80);

  const db = createAdminClient();

  const { data: isTeacher } = await db.rpc("has_class_role", { _class_id: classId });
  if (!isTeacher) {
    return NextResponse.json({ error: "Forbidden — not a teacher of this class" }, { status: 403 });
  }

  const { error: insertErr } = await db.from("class_dj_veto_overrides").insert({
    class_id: classId,
    veto_text: vetoText,
    expired_by: `teacher:${teacherId}`,
  });

  // 23505 unique-violation → already overridden, treat as idempotent success.
  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, already_overridden: true });
    }
    console.error("[class-dj/expire-veto] insert failed", insertErr);
    return NextResponse.json({ error: "Failed to record veto override" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, already_overridden: false });
}
