// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * /api/teacher/machine-profiles/[id]
 *   PATCH  — edit any mutable field (name, spec, colour map, approval toggle)
 *   DELETE — soft-delete (sets is_active = false; 409 if active jobs exist)
 *
 * Auth: teacher (Supabase Auth). Teachers can only mutate their own
 * non-template machines. System templates always 404 on mutate paths.
 *
 * Preflight Phase 8-3.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  updateMachineProfile,
  softDeleteMachineProfile,
  isOrchestrationError,
  type OperationColorMap,
} from "@/lib/fabrication/machine-orchestration";
import { requireTeacher } from "@/lib/auth/require-teacher";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

// -----------------------------------------------------------------
// PATCH
// -----------------------------------------------------------------

interface PatchMachineBody {
  name?: unknown;
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
  labId?: unknown; // Phase 8.1d-4 — move machine between labs
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { id: machineProfileId } = await params;

  let body: PatchMachineBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const admin = createAdminClient();
  const result = await updateMachineProfile(admin, {
    teacherId,
    machineProfileId,
    name: typeof body.name === "string" ? body.name : undefined,
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
    labId: typeof body.labId === "string" ? body.labId : undefined,
  });

  if (isOrchestrationError(result)) {
    return privateJson({ error: result.error.message }, result.error.status);
  }
  return privateJson(result);
}

// -----------------------------------------------------------------
// DELETE — soft delete
// -----------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { id: machineProfileId } = await params;
  const admin = createAdminClient();

  const result = await softDeleteMachineProfile(admin, {
    teacherId,
    machineProfileId,
  });

  if (isOrchestrationError(result)) {
    return privateJson({ error: result.error.message }, result.error.status);
  }
  return privateJson(result);
}
