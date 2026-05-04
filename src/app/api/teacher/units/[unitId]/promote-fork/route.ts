// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherHasUnit,
} from "@/lib/auth/verify-teacher-unit";
import { saveAsVersion } from "@/lib/units/resolve-content";

// ─────────────────────────────────────────────────────────────────
// POST /api/teacher/units/[unitId]/promote-fork
// Promotes a class fork to the master template:
//   1. Optionally saves current master as a version first
//   2. Copies class_units.content_data → units.content_data
//   3. Resets the class fork (content_data = NULL)
//   4. Other non-forked classes now see the updated master
//   5. Other forked classes are NOT affected
//
// Body: { classId: string, saveVersionFirst: boolean }
// ─────────────────────────────────────────────────────────────────

async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const { unitId } = await params;
    const body = await request.json();
    const { classId, saveVersionFirst } = body as {
      classId: string;
      saveVersionFirst: boolean;
    };

    if (!classId) {
      return NextResponse.json(
        { error: "Missing classId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Phase 6.2 — gate via can()-backed shim. Promote-fork is an
    // ownership-equivalent operation (overwrites master content) so the
    // shim's broader co-teacher capability also grants access here.
    const access = await verifyTeacherHasUnit(auth.teacherId, unitId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const { data: unit, error: unitErr } = await supabase
      .from("units")
      .select("id, content_data, current_version, versions, author_teacher_id")
      .eq("id", unitId)
      .single();

    if (unitErr || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Get the class fork content
    const { data: classUnit } = await supabase
      .from("class_units")
      .select("content_data")
      .eq("unit_id", unitId)
      .eq("class_id", classId)
      .maybeSingle();

    if (!classUnit?.content_data) {
      return NextResponse.json(
        { error: "This class has no customized content to promote" },
        { status: 400 }
      );
    }

    // Step 1: Optionally save current master as a version before overwriting
    let savedVersion: number | null = null;
    if (saveVersionFirst && unit.content_data) {
      // Save via the existing saveAsVersion mechanism, but we need to save
      // the master content, not a class fork. We'll do it manually here.
      const currentVersion = unit.current_version ?? 1;
      const nextVersion = currentVersion + 1;

      const { error: versionError } = await supabase
        .from("unit_versions")
        .insert({
          unit_id: unitId,
          version_number: nextVersion,
          label: `Before promote (auto-saved)`,
          content_data: unit.content_data,
          source_class_id: null, // master content, no source class
        });

      if (versionError) {
        console.error("[promote-fork] failed to save version:", versionError);
        // Non-fatal — continue with promotion
      } else {
        const versions = Array.isArray(unit.versions) ? unit.versions : [];
        versions.push({
          version: nextVersion,
          label: `Before promote (auto-saved)`,
          created_at: new Date().toISOString(),
          source_class_id: null,
        });

        await supabase
          .from("units")
          .update({ versions, current_version: nextVersion })
          .eq("id", unitId);

        savedVersion = nextVersion;
      }
    }

    // Step 2: Copy class fork → master content
    const { error: promoteErr } = await supabase
      .from("units")
      .update({ content_data: classUnit.content_data })
      .eq("id", unitId);

    if (promoteErr) {
      console.error("[promote-fork] failed to update master:", promoteErr);
      return NextResponse.json(
        { error: "Failed to promote fork to master" },
        { status: 500 }
      );
    }

    // Step 3: Clear the class fork
    const { error: resetErr } = await supabase
      .from("class_units")
      .update({
        content_data: null,
        forked_at: null,
        forked_from_version: null,
      })
      .eq("unit_id", unitId)
      .eq("class_id", classId);

    if (resetErr) {
      console.error("[promote-fork] failed to reset fork:", resetErr);
      // Non-fatal — master was already updated
    }

    return NextResponse.json({
      success: true,
      savedVersion,
      message: "Class content promoted to master template",
    });
  } catch (err) {
    console.error("[promote-fork]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { POST };
