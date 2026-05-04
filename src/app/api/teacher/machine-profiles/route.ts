// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * /api/teacher/machine-profiles
 *   GET  — list this teacher's machines + all system templates
 *   POST — create a new machine (from template or from scratch)
 *
 * Auth: teacher (Supabase Auth). Cross-teacher visibility scoped out.
 * System templates are always visible + read-only.
 *
 * Preflight Phase 8-3.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  createMachineProfile,
  listMyMachines,
  isOrchestrationError,
  type MachineCategory,
  type OperationColorMap,
} from "@/lib/fabrication/machine-orchestration";

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
// GET
// -----------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "true";

  const admin = createAdminClient();
  const result = await listMyMachines(admin, {
    teacherId: user.id,
    includeInactive,
  });
  if (isOrchestrationError(result)) {
    return privateJson({ error: result.error.message }, result.error.status);
  }
  return privateJson(result);
}

// -----------------------------------------------------------------
// POST
// -----------------------------------------------------------------

interface CreateMachineBody {
  fromTemplateId?: unknown;
  labId?: unknown;
  name?: unknown;
  machineCategory?: unknown;
  machineBrand?: unknown;
  machineModel?: unknown;
  bedSizeXMm?: unknown;
  bedSizeYMm?: unknown;
  bedSizeZMm?: unknown;
  nozzleDiameterMm?: unknown;
  kerfMm?: unknown;
  minFeatureMm?: unknown;
  requiresTeacherApproval?: unknown;
  operationColorMap?: unknown;
  notes?: unknown;
  supportedMaterials?: unknown;
  supportsAutoSupports?: unknown;
  maxPrintTimeMin?: unknown;
}

export async function POST(request: NextRequest) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  let body: CreateMachineBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.labId !== "string" || !body.labId) {
    return privateJson({ error: "`labId` is required." }, 400);
  }

  const admin = createAdminClient();
  const result = await createMachineProfile(admin, {
    teacherId: user.id,
    fromTemplateId:
      typeof body.fromTemplateId === "string" ? body.fromTemplateId : undefined,
    labId: body.labId,
    name: typeof body.name === "string" ? body.name : "",
    machineCategory: body.machineCategory as MachineCategory | undefined,
    machineBrand:
      typeof body.machineBrand === "string" || body.machineBrand === null
        ? (body.machineBrand as string | null)
        : undefined,
    machineModel:
      typeof body.machineModel === "string" || body.machineModel === null
        ? (body.machineModel as string | null)
        : undefined,
    bedSizeXMm:
      typeof body.bedSizeXMm === "number" ? body.bedSizeXMm : undefined,
    bedSizeYMm:
      typeof body.bedSizeYMm === "number" ? body.bedSizeYMm : undefined,
    bedSizeZMm:
      body.bedSizeZMm === null
        ? null
        : typeof body.bedSizeZMm === "number"
          ? body.bedSizeZMm
          : undefined,
    nozzleDiameterMm:
      body.nozzleDiameterMm === null
        ? null
        : typeof body.nozzleDiameterMm === "number"
          ? body.nozzleDiameterMm
          : undefined,
    kerfMm:
      body.kerfMm === null
        ? null
        : typeof body.kerfMm === "number"
          ? body.kerfMm
          : undefined,
    minFeatureMm:
      body.minFeatureMm === null
        ? null
        : typeof body.minFeatureMm === "number"
          ? body.minFeatureMm
          : undefined,
    requiresTeacherApproval:
      typeof body.requiresTeacherApproval === "boolean"
        ? body.requiresTeacherApproval
        : undefined,
    operationColorMap:
      body.operationColorMap === null
        ? null
        : (body.operationColorMap as OperationColorMap | undefined),
    notes:
      typeof body.notes === "string" || body.notes === null
        ? (body.notes as string | null)
        : undefined,
    supportedMaterials: body.supportedMaterials,
    supportsAutoSupports:
      body.supportsAutoSupports === null
        ? null
        : typeof body.supportsAutoSupports === "boolean"
          ? body.supportsAutoSupports
          : undefined,
    maxPrintTimeMin:
      body.maxPrintTimeMin === null
        ? null
        : typeof body.maxPrintTimeMin === "number"
          ? body.maxPrintTimeMin
          : undefined,
  });

  if (isOrchestrationError(result)) {
    return privateJson({ error: result.error.message }, result.error.status);
  }
  return privateJson(result, 201);
}
