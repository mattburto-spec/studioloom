/**
 * GET /api/fab/machines
 *
 * Phase 8.1d-22, school-scoped sweep 4 May 2026.
 * Lists the fab's school's active machines — powers the dashboard's
 * Send-to menu (pick which physical machine to assign a category-only
 * job to).
 *
 * Phase 8-1 + flat school membership: previously this route filtered
 * by the inviting teacher's UUID, which broke under the multi-teacher
 * NIS contract — a fab invited by persona A couldn't see machines
 * created by persona B even though they're at the same school. The
 * 28 Apr audit (preflight-audit-28-apr.md) swept the queue + job
 * paths via `fabricatorSchoolContext` but missed this admin-helper
 * route. Caught when Matt set up his second persona's fab and the
 * dashboard reported "No 3D printers in your inviting teacher's
 * labs" despite 18 active machines existing at the school.
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-cache.
 *
 * Response 200:
 *   { machines: [{ id, name, lab_id, lab_name, machine_category }, ...] }
 *
 * Errors: 401, 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fabricatorSchoolContext } from "@/lib/fabrication/fab-orchestration";
import { isOrchestrationError } from "@/lib/fabrication/lab-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

interface FabMachine {
  id: string;
  name: string;
  lab_id: string | null;
  lab_name: string | null;
  machine_category: "3d_printer" | "laser_cutter" | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireFabricatorAuth(request);
  if ("error" in auth) return auth.error;

  const db = createAdminClient();

  // Phase 8-1 / 8-3 school-scoped resolution. Returns null when the
  // fab is missing/inactive OR the inviting teacher has no school
  // (orphan pre-welcome-wizard) — both surface as "no machines"
  // empty state to the UI.
  const ctx = await fabricatorSchoolContext(db, auth.fabricator.id);
  if (ctx === null) {
    return NextResponse.json(
      { machines: [] },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  }
  if (isOrchestrationError(ctx)) {
    return NextResponse.json(
      { error: ctx.error.message },
      { status: ctx.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  // School-scoped: every active non-template machine at this school.
  // Templates excluded — they have school_id IS NULL and the fab
  // dashboard's Send-to menu only routes to physical machines, not
  // templates.
  const result = await db
    .from("machine_profiles")
    .select("id, name, lab_id, machine_category, fabrication_labs(name)")
    .eq("school_id", ctx.schoolId)
    .eq("is_system_template", false)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data, error } = result as {
    data:
      | Array<{
          id: string;
          name: string;
          lab_id: string | null;
          machine_category: string | null;
          fabrication_labs:
            | { name: string | null }
            | { name: string | null }[]
            | null;
        }>
      | null;
    error: { message: string } | null;
  };

  if (error) {
    return NextResponse.json(
      { error: `Machine lookup failed: ${error.message}` },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  const machines: FabMachine[] = (data ?? []).map((m) => {
    const labRow = Array.isArray(m.fabrication_labs)
      ? m.fabrication_labs[0]
      : m.fabrication_labs;
    return {
      id: m.id,
      name: m.name,
      lab_id: m.lab_id,
      lab_name: labRow?.name ?? null,
      machine_category:
        m.machine_category === "3d_printer" || m.machine_category === "laser_cutter"
          ? m.machine_category
          : null,
    };
  });

  return NextResponse.json(
    { machines },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
