/**
 * PATCH /api/teacher/labs/[id]/machines
 *
 * Reassign a machine from this lab (URL-scoped for namespace clarity)
 * to a target lab (body). Per parent brief §3.2.
 *
 * Body: { machineProfileId: string, targetLabId: string }
 *
 * Preflight Phase 8-2.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  reassignMachineToLab,
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

interface ReassignBody {
  machineProfileId?: unknown;
  targetLabId?: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const { id: sourceLabId } = await params;

  let body: ReassignBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.machineProfileId !== "string" || !body.machineProfileId) {
    return privateJson(
      { error: "`machineProfileId` is required (string)." },
      400
    );
  }
  if (typeof body.targetLabId !== "string" || !body.targetLabId) {
    return privateJson(
      { error: "`targetLabId` is required (string)." },
      400
    );
  }

  const admin = createAdminClient();
  const result = await reassignMachineToLab(admin, {
    teacherId: user.id,
    sourceLabId,
    machineProfileId: body.machineProfileId,
    targetLabId: body.targetLabId,
  });

  if (isOrchestrationError(result)) {
    return privateJson(
      { error: result.error.message },
      result.error.status
    );
  }
  return privateJson(result);
}
