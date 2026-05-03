// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { NMUnitConfig, DEFAULT_NM_CONFIG } from "@/lib/nm/constants";
import { verifyTeacherHasUnit, getNmConfigForClassUnit } from "@/lib/auth/verify-teacher-unit";

function getAuthClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
}

/**
 * GET  /api/teacher/nm-config?unitId={id}&classId={id}
 *   → Fetch NM config for a unit in a class context.
 *     Reads class_units.nm_config first, falls back to units.nm_config.
 *
 * POST /api/teacher/nm-config
 *   → Save NM config for a unit in a class context.
 *   Body: { unitId, classId, config: NMUnitConfig }
 *     Writes to class_units.nm_config (per-class).
 */

export const GET = withErrorHandler("teacher/nm-config:GET", async (request: NextRequest) => {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");
  const classId = searchParams.get("classId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  // Verify teacher has access to this unit
  const { hasAccess } = await verifyTeacherHasUnit(user.id, unitId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  // Check global NM toggle (stored in teacher_profiles, not teachers)
  const db = createAdminClient();
  const { data: teacherProfile } = await db
    .from("teacher_profiles")
    .select("school_context")
    .eq("teacher_id", user.id)
    .single();
  const globalNmEnabled = !!(teacherProfile?.school_context as { use_new_metrics?: boolean } | null)?.use_new_metrics;

  // If global toggle is off, return disabled config
  if (!globalNmEnabled) {
    return NextResponse.json({ config: { ...DEFAULT_NM_CONFIG, enabled: false }, globalNmEnabled: false });
  }

  // If classId provided, get class-specific config with fallback
  if (classId) {
    const config = await getNmConfigForClassUnit(classId, unitId);
    return NextResponse.json({ config: config || DEFAULT_NM_CONFIG, globalNmEnabled: true });
  }

  // No classId — return unit-level config (backward compat / template view)
  const { data: unit } = await db
    .from("units")
    .select("nm_config")
    .eq("id", unitId)
    .single();

  return NextResponse.json({ config: unit?.nm_config || DEFAULT_NM_CONFIG, globalNmEnabled: true });
});

export const POST = withErrorHandler("teacher/nm-config:POST", async (request: NextRequest) => {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { unitId, classId, config } = body as {
    unitId: string;
    classId?: string;
    config: NMUnitConfig;
  };

  if (!unitId || !config) {
    return NextResponse.json({ error: "unitId and config are required" }, { status: 400 });
  }

  const { hasAccess } = await verifyTeacherHasUnit(user.id, unitId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // If classId provided, write to class_units (per-class config)
  if (classId) {
    const { data: updated, error } = await db
      .from("class_units")
      .update({ nm_config: config })
      .eq("class_id", classId)
      .eq("unit_id", unitId)
      .select("nm_config")
      .single();

    if (error) {
      console.error("[nm-config] Save to class_units error:", error);
      return NextResponse.json({ error: "Failed to save NM config" }, { status: 500 });
    }

    return NextResponse.json({ config: updated?.nm_config || config });
  }

  // No classId — write to units table (template-level, backward compat)
  const { data: updated, error } = await db
    .from("units")
    .update({ nm_config: config })
    .eq("id", unitId)
    .select("nm_config")
    .single();

  if (error) {
    console.error("[nm-config] Save to units error:", error);
    return NextResponse.json({ error: "Failed to save NM config" }, { status: 500 });
  }

  return NextResponse.json({ config: updated?.nm_config || config });
});
