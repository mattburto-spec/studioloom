// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Quarantined 10 Apr 2026. Old knowledge pipeline.
// Use /api/teacher/knowledge/ingest (Dimensions3).
// Delete this file after 14 days (24 Apr 2026) if no incidents.
//
// History: un-quarantined 9 Apr 2026, re-quarantined 10 Apr 2026 per Phase 0.2
// of docs/projects/dimensions3-completion-spec.md. Full original implementation
// is preserved in git history (pre-10-Apr commits on main) if a rescue is ever needed.

const QUARANTINE_RESPONSE = NextResponse.json(
  {
    error:
      "Legacy knowledge upload quarantined — use /api/teacher/knowledge/ingest (Dimensions3). See docs/quarantine.md",
  },
  { status: 410 }
);

export const maxDuration = 300;

export const POST = withErrorHandler(
  "teacher/knowledge/upload:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    return QUARANTINE_RESPONSE;
  }
);

export const GET = withErrorHandler(
  "teacher/knowledge/upload:GET",
  async (request: NextRequest) => {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    return QUARANTINE_RESPONSE;
  }
);

export const DELETE = withErrorHandler(
  "teacher/knowledge/upload:DELETE",
  async (request: NextRequest) => {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    return QUARANTINE_RESPONSE;
  }
);
