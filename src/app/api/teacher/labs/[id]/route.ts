// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * /api/teacher/labs/[id]
 *   PATCH  — rename / edit a lab (any teacher at the school can)
 *   DELETE — delete a lab with optional reassignTo target
 *
 * Auth: teacher (Supabase Auth). Visibility + writes scoped by
 * `fabrication_labs.school_id = teacher.school_id` (revised 28 Apr
 * from teacher-scoped per Phase 8-1 Q3 flip).
 *
 * Preflight Phase 8-2 (revised 28 Apr).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  updateLab,
  deleteLab,
  isOrchestrationError,
} from "@/lib/fabrication/lab-orchestration";

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
// PATCH — rename / edit / set default
// -----------------------------------------------------------------

interface UpdateLabBody {
  name?: unknown;
  description?: unknown;
  // Phase 8-2 (revised 28 Apr): isDefault dropped along with the
  // per-lab default flag. See lab-orchestration.ts header.
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const { id: labId } = await params;

  let body: UpdateLabBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const admin = createAdminClient();
  const result = await updateLab(admin, {
    teacherId: user.id,
    labId,
    name: typeof body.name === "string" ? body.name : undefined,
    description:
      typeof body.description === "string" || body.description === null
        ? body.description
        : undefined,
  });

  if (isOrchestrationError(result)) {
    return privateJson(
      { error: result.error.message },
      result.error.status
    );
  }
  return privateJson(result);
}

// -----------------------------------------------------------------
// DELETE — delete with optional reassignTo
// -----------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const { id: labId } = await params;

  // reassignTo passes via query string for DELETEs. (No body convention;
  // Next.js routes still accept JSON body on DELETE but clients often
  // strip it. Query string is the safest path.)
  const reassignToParam = request.nextUrl.searchParams.get("reassignTo");
  const reassignTo = reassignToParam || undefined;

  const admin = createAdminClient();
  const result = await deleteLab(admin, {
    teacherId: user.id,
    labId,
    reassignTo,
  });

  if (isOrchestrationError(result)) {
    return privateJson(
      { error: result.error.message },
      result.error.status
    );
  }
  return privateJson(result);
}
