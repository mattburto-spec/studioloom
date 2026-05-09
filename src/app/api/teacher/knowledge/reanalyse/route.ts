// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Quarantined 10 Apr 2026 (Phase 0.4). Legacy knowledge pipeline.
// Bulk-reanalysis via 3-pass analyse.ts. Wrote lesson_profiles + knowledge_chunks.
// Delete this file after 14 days (24 Apr 2026) if no incidents.
//
// Original 416-line implementation preserved in git history.

const QUARANTINE_RESPONSE = NextResponse.json(
  {
    error:
      "Legacy knowledge reanalyse quarantined — use /api/teacher/knowledge/ingest (Dimensions3). See docs/quarantine.md",
  },
  { status: 410 }
);

export const POST = withErrorHandler(
  "teacher/knowledge/reanalyse:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    return QUARANTINE_RESPONSE;
  }
);
