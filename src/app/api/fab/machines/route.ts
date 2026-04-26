/**
 * GET /api/fab/machines
 *
 * Phase 8.1d-22. Lists the inviting teacher's active machines —
 * powers the dashboard's Send-to menu (pick which physical machine
 * to assign a category-only job to).
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-cache (machines change infrequently but the
 *        dashboard re-fetches on every assign so the menu's
 *        always current).
 *
 * Response 200:
 *   { machines: [{ id, name, lab_id, lab_name, machine_category }, ...] }
 *
 * Errors: 401, 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fabricatorInvitingTeacherId } from "@/lib/fabrication/fab-orchestration";

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

  const teacherId = await fabricatorInvitingTeacherId(db, auth.fabricator.id);
  if (teacherId !== null && typeof teacherId === "object") {
    return NextResponse.json(
      { error: teacherId.error.message },
      { status: teacherId.error.status, headers: NO_CACHE_HEADERS }
    );
  }
  if (!teacherId) {
    return NextResponse.json(
      { machines: [] },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  }

  const result = await db
    .from("machine_profiles")
    .select("id, name, lab_id, machine_category, fabrication_labs(name)")
    .eq("teacher_id", teacherId)
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
