import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NMUnitConfig, DEFAULT_NM_CONFIG } from "@/lib/nm/constants";

/**
 * Teacher NM Configuration API
 *
 * GET  /api/teacher/nm-config?unitId={id}
 *   → Fetch nm_config for a unit. Returns the JSONB from the units table.
 *
 * POST /api/teacher/nm-config
 *   → Save nm_config for a unit.
 *   Body: { unitId, config: NMUnitConfig }
 */

function getSupabase(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const accessToken = request.cookies.get("sb-access-token")?.value;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);

  // Verify teacher auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  // Verify teacher owns this unit
  const { data: unit } = await supabase
    .from("units")
    .select("id, nm_config")
    .eq("id", unitId)
    .eq("teacher_id", user.id)
    .single();

  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  // Return nm_config or default if not set
  const config = unit.nm_config || DEFAULT_NM_CONFIG;

  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);

  // Verify teacher auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { unitId, config } = body as {
    unitId: string;
    config: NMUnitConfig;
  };

  if (!unitId || !config) {
    return NextResponse.json(
      { error: "unitId and config are required" },
      { status: 400 }
    );
  }

  // Verify teacher owns this unit
  const { data: existing } = await supabase
    .from("units")
    .select("id")
    .eq("id", unitId)
    .eq("teacher_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  // Update nm_config
  const { data: updated, error } = await supabase
    .from("units")
    .update({ nm_config: config })
    .eq("id", unitId)
    .select("nm_config")
    .single();

  if (error) {
    console.error("[nm-config] Save error:", error);
    return NextResponse.json(
      { error: "Failed to save NM config" },
      { status: 500 }
    );
  }

  return NextResponse.json({ config: updated.nm_config });
}
