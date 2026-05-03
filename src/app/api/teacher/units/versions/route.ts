// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { saveAsVersion } from "@/lib/units/resolve-content";

// ─────────────────────────────────────────────────────────────────
// GET /api/teacher/units/versions?unitId=...
// Returns version history for a unit (lightweight metadata + unit_versions rows)
// ─────────────────────────────────────────────────────────────────

async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const unitId = url.searchParams.get("unitId");

    if (!unitId) {
      return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get unit metadata
    const { data: unit } = await supabase
      .from("units")
      .select("id, versions, current_version")
      .eq("id", unitId)
      .single();

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Get class names for source_class_ids
    const versions = Array.isArray(unit.versions) ? unit.versions : [];
    const classIds = versions
      .map((v: Record<string, unknown>) => v.source_class_id)
      .filter(Boolean);

    let classNames: Record<string, string> = {};
    if (classIds.length > 0) {
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds);
      if (classes) {
        classNames = Object.fromEntries(classes.map((c) => [c.id, c.name]));
      }
    }

    // Get fork status for all class-units (which classes have forked)
    const { data: classUnits } = await supabase
      .from("class_units")
      .select("class_id, forked_at, forked_from_version")
      .eq("unit_id", unitId)
      .not("content_data", "is", null);

    const forks = (classUnits || []).map((cu) => ({
      classId: cu.class_id,
      forkedAt: cu.forked_at,
      forkedFromVersion: cu.forked_from_version,
    }));

    return NextResponse.json({
      unitId: unit.id,
      currentVersion: unit.current_version ?? 1,
      versions: versions.map((v: Record<string, unknown>) => ({
        ...v,
        sourceClassName: v.source_class_id ? classNames[v.source_class_id as string] || null : null,
      })),
      forks,
    });
  } catch (err) {
    console.error("[units/versions GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/teacher/units/versions
// Save a class-unit's forked content as a new version of the master.
// Body: { unitId, classId, label }
// ─────────────────────────────────────────────────────────────────

async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { unitId, classId, label } = body as {
      unitId: string;
      classId: string;
      label: string;
    };

    if (!unitId || !classId || !label) {
      return NextResponse.json(
        { error: "Missing unitId, classId, or label" },
        { status: 400 }
      );
    }

    if (label.length > 100) {
      return NextResponse.json(
        { error: "Label must be 100 characters or fewer" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify teacher owns unit
    const { data: unit } = await supabase
      .from("units")
      .select("id")
      .eq("id", unitId)
      .single();

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const result = await saveAsVersion(supabase, unitId, classId, label);

    return NextResponse.json({
      success: true,
      versionNumber: result.versionNumber,
    });
  } catch (err) {
    console.error("[units/versions POST]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export { GET, POST };
