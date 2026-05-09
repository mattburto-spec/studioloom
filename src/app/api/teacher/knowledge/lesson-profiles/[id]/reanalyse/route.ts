// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Quarantined 10 Apr 2026 (Phase 0.4). Legacy knowledge pipeline.
// Per-profile reanalysis via 3-pass analyse.ts. Wrote lesson_profiles.
// Delete this file after 14 days (24 Apr 2026) if no incidents.
//
// Original 275-line implementation preserved in git history.

const QUARANTINE_RESPONSE = NextResponse.json(
  {
    error:
      "Legacy lesson-profile reanalyse quarantined — use /api/teacher/knowledge/ingest (Dimensions3). See docs/quarantine.md",
  },
  { status: 410 }
);

export async function POST(
  request: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  return QUARANTINE_RESPONSE;
}
