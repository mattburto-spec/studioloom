/**
 * /api/teacher/labs
 *   GET  — list this teacher's labs (with machine counts per lab)
 *   POST — create a new lab
 *
 * Auth: teacher (Supabase Auth). All orchestration scoped by
 * `teacher_id = auth.uid()`. Cross-teacher visibility is explicitly
 * OUT of scope v1 per parent brief §5 Q3 — gated on FU-P
 * access-model-v2.
 *
 * Preflight Phase 8-2.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  createLab,
  listMyLabs,
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
// GET — list this teacher's labs with machine counts
// -----------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const admin = createAdminClient();
  const result = await listMyLabs(admin, { teacherId: user.id });
  if (isOrchestrationError(result)) {
    return privateJson(
      { error: result.error.message },
      result.error.status
    );
  }
  return privateJson(result);
}

// -----------------------------------------------------------------
// POST — create a new lab
// -----------------------------------------------------------------

interface CreateLabBody {
  name?: unknown;
  description?: unknown;
  isDefault?: unknown;
}

export async function POST(request: NextRequest) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  let body: CreateLabBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const admin = createAdminClient();
  const result = await createLab(admin, {
    teacherId: user.id,
    name: typeof body.name === "string" ? body.name : "",
    description:
      typeof body.description === "string" || body.description === null
        ? body.description
        : undefined,
    isDefault: body.isDefault === true,
  });

  if (isOrchestrationError(result)) {
    return privateJson(
      { error: result.error.message },
      result.error.status
    );
  }

  return privateJson(result, 201);
}
