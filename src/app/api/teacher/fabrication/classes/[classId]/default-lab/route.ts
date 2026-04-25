/**
 * PATCH /api/teacher/fabrication/classes/[classId]/default-lab
 *
 * Phase 8.1d-3 (PH8-FU-CLASS-LAB-ASSIGN). Sets the
 * `classes.default_lab_id` for one class. Body:
 *   { defaultLabId: string }   — assign to this lab
 *   { defaultLabId: null }     — clear the assignment (legacy fallback;
 *                                 student picker will show all machines)
 *
 * Ownership: teacher must own both the class AND the target lab. 404
 * (not 403) for cross-teacher access (Preflight convention).
 *
 * Auth: teacher Supabase Auth.
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

interface PatchBody {
  defaultLabId?: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const { classId } = await params;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  if (
    body.defaultLabId !== null &&
    typeof body.defaultLabId !== "string"
  ) {
    return privateJson(
      { error: "`defaultLabId` must be a lab UUID string or null." },
      400
    );
  }

  const admin = createAdminClient();

  // Ownership check on the class.
  const classResult = await admin
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .maybeSingle();
  if (classResult.error) {
    return privateJson(
      { error: `Class lookup failed: ${classResult.error.message}` },
      500
    );
  }
  if (!classResult.data || classResult.data.teacher_id !== user.id) {
    return privateJson({ error: "Class not found." }, 404);
  }

  // If a lab is being set, ownership-check it too.
  if (typeof body.defaultLabId === "string") {
    const labResult = await admin
      .from("fabrication_labs")
      .select("id, teacher_id")
      .eq("id", body.defaultLabId)
      .maybeSingle();
    if (labResult.error) {
      return privateJson(
        { error: `Lab lookup failed: ${labResult.error.message}` },
        500
      );
    }
    if (!labResult.data || labResult.data.teacher_id !== user.id) {
      return privateJson({ error: "Lab not found." }, 404);
    }
  }

  // Apply the update.
  const update = await admin
    .from("classes")
    .update({ default_lab_id: body.defaultLabId })
    .eq("id", classId)
    .eq("teacher_id", user.id);
  if (update.error) {
    return privateJson(
      { error: `Class update failed: ${update.error.message}` },
      500
    );
  }

  return privateJson({
    classId,
    defaultLabId: body.defaultLabId,
  });
}
