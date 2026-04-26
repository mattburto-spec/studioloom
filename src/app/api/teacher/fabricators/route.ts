/**
 * /api/teacher/fabricators
 *   GET  — list fabricators the current teacher has invited
 *   POST — invite a new fabricator (creates INVITE_PENDING row + is_setup session + emails link)
 *
 * Auth: teacher (Supabase Auth). Fabricators are scoped by invited_by_teacher_id
 * so teachers only see their own invitees. School-level sharing lands with
 * FU-P (school entity) post Phase 1B-2.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createFabricatorSession,
  FAB_PRIVATE_CACHE_HEADERS,
} from "@/lib/fab/auth";
import { sendFabricationEmail } from "@/lib/preflight/email";
import { renderInviteEmail } from "@/lib/preflight/email-templates";

const INVITE_PENDING = "INVITE_PENDING";

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

// -----------------------------------------------------------------
// GET — list current teacher's fabricators + their machine assignments
// -----------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const admin = createAdminClient();

  const { data: fabricators, error: fabError } = await admin
    .from("fabricators")
    .select("id, email, display_name, is_active, created_at, last_login_at, password_hash")
    .eq("invited_by_teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (fabError) {
    return privateJson({ error: `List failed: ${fabError.message}` }, 500);
  }

  const ids = (fabricators ?? []).map((f) => f.id);
  const { data: machines } = ids.length
    ? await admin
        .from("fabricator_machines")
        .select("fabricator_id, machine_profiles(id, name, machine_category)")
        .in("fabricator_id", ids)
    : { data: [] };

  type MachineRow = {
    fabricator_id: string;
    // Supabase nested select returns arrays (cardinality unknown at query time)
    machine_profiles: { id: string; name: string; machine_category: string }[];
  };
  const byFab = new Map<string, Array<{ id: string; name: string; machine_category: string }>>();
  for (const row of (machines ?? []) as unknown as MachineRow[]) {
    const mps = Array.isArray(row.machine_profiles) ? row.machine_profiles : [row.machine_profiles];
    const list = byFab.get(row.fabricator_id) ?? [];
    for (const mp of mps) {
      if (mp) list.push(mp);
    }
    byFab.set(row.fabricator_id, list);
  }

  const result = (fabricators ?? []).map((f) => ({
    id: f.id,
    email: f.email,
    display_name: f.display_name,
    is_active: f.is_active,
    created_at: f.created_at,
    last_login_at: f.last_login_at,
    invite_pending: f.password_hash === INVITE_PENDING,
    machines: byFab.get(f.id) ?? [],
  }));

  return privateJson({ fabricators: result });
}

// -----------------------------------------------------------------
// POST — invite a new fabricator
// -----------------------------------------------------------------

interface InviteBody {
  email?: unknown;
  displayName?: unknown;
  machineIds?: unknown;
  resend?: unknown; // ?resend=true semantics — re-invite an existing fabricator
}

export async function POST(request: NextRequest) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const machineIds = Array.isArray(body.machineIds)
    ? body.machineIds.filter((id): id is string => typeof id === "string")
    : [];
  const resend = body.resend === true;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return privateJson({ error: "Valid email address required" }, 400);
  }
  if (!displayName) {
    return privateJson({ error: "Display name required" }, 400);
  }
  // Phase 8.1d-9: machineIds is now OPTIONAL. Fabricators see ALL
  // jobs from their inviting teacher (queue scopes by teacher_id).
  // The fabricator_machines junction is deprecated as a visibility
  // mechanism; kept in schema for future opt-in restrictions
  // (PH9-FU-FAB-MACHINE-RESTRICT). Empty machineIds → no junction
  // rows are inserted (no harm, the queue ignores them anyway).

  const admin = createAdminClient();

  // Look up the current teacher's display name for the email copy.
  const { data: teacherRow } = await admin
    .from("teachers")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  // Prefer the teacher's display name. If unset, fall back to the
  // local-part of their email (everything before the @) rather than
  // the full address — Gmail auto-linkifies raw emails, which overrides
  // our inline header styling and renders blue-on-purple (Phase 7-5d).
  const teacherDisplayName =
    teacherRow?.display_name?.trim() ||
    teacherRow?.email?.split("@")[0] ||
    "Your teacher";

  // Find an existing fabricator owned by this teacher with the same email.
  const { data: existing } = await admin
    .from("fabricators")
    .select("id, invited_by_teacher_id, password_hash")
    .ilike("email", email)
    .maybeSingle();

  let fabricatorId: string;

  if (existing) {
    if (existing.invited_by_teacher_id !== user.id) {
      // Another teacher owns this fabricator — don't let the second teacher
      // reassign or overwrite. School-level sharing is FU-P scope.
      return privateJson(
        { error: "A fabricator with that email already belongs to another teacher." },
        409
      );
    }
    if (!resend) {
      return privateJson(
        {
          error: "A fabricator with that email already exists. Re-send the invite?",
          existing: { id: existing.id },
          hint: "Retry with resend=true to send a fresh invite link.",
        },
        409
      );
    }
    // Resend path: reset password to INVITE_PENDING and clear old setup sessions.
    const { error: updateError } = await admin
      .from("fabricators")
      .update({ password_hash: INVITE_PENDING, is_active: true })
      .eq("id", existing.id);
    if (updateError) {
      return privateJson({ error: `Reset failed: ${updateError.message}` }, 500);
    }
    await admin
      .from("fabricator_sessions")
      .delete()
      .eq("fabricator_id", existing.id)
      .eq("is_setup", true);
    fabricatorId = existing.id;
  } else {
    // Fresh insert. Case-insensitive UNIQUE on email protects us from races.
    const { data: inserted, error: insertError } = await admin
      .from("fabricators")
      .insert({
        email,
        display_name: displayName,
        password_hash: INVITE_PENDING,
        is_active: true,
        invited_by_teacher_id: user.id,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      return privateJson(
        { error: `Invite failed: ${insertError?.message ?? "no row"}` },
        500
      );
    }
    fabricatorId = inserted.id;
  }

  // Phase 8.1d-9: drop any prior junction rows (deprecated as a
  // visibility mechanism; might still exist from older invite flows
  // before Phase 8.1d-9 — clean them up so they don't mislead future
  // PH9-FU-FAB-MACHINE-RESTRICT work into thinking they're meaningful).
  await admin
    .from("fabricator_machines")
    .delete()
    .eq("fabricator_id", fabricatorId);

  // Insert junction rows ONLY if the caller explicitly supplied them
  // (legacy clients still might). The queue + pickup orchestration
  // ignore these rows. Empty machineIds → no inserts; that's the
  // expected v1 default.
  if (machineIds.length > 0) {
    const machineRows = machineIds.map((machineId) => ({
      fabricator_id: fabricatorId,
      machine_profile_id: machineId,
      assigned_by_teacher_id: user.id,
    }));
    const { error: machineError } = await admin
      .from("fabricator_machines")
      .insert(machineRows);
    if (machineError) {
      return privateJson(
        { error: `Machine assignment failed: ${machineError.message}` },
        500
      );
    }
  }

  // Create the is_setup invite session.
  const session = await createFabricatorSession({
    fabricatorId,
    isSetup: true,
    supabase: admin,
  });

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "https://studioloom.org";
  const setPasswordUrl = `${siteUrl.replace(/\/$/, "")}/fab/set-password?token=${encodeURIComponent(session.rawToken)}`;

  // Send the email via the 1B-2-1 helper (idempotency skipped for invite kind).
  const emailResult = await sendFabricationEmail({
    jobId: null,
    kind: "invite",
    to: email,
    subject: `You've been invited to StudioLoom Preflight`,
    html: renderInviteEmail({
      setPasswordUrl,
      displayName,
      teacherDisplayName,
    }),
    supabase: admin,
  });

  return privateJson({
    ok: true,
    fabricator: { id: fabricatorId, email, display_name: displayName },
    email: emailResult,
  });
}
