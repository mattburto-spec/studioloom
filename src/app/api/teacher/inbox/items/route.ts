/**
 * GET /api/teacher/inbox/items
 *
 * TFL.3 / Pass C sub-phase C.1. Returns the prioritised inbox items
 * for the requesting teacher's classes.
 *
 * Auth: requireTeacher (mandatory per security-overview.md — bare
 * auth.getUser() would let a student JWT hit this route).
 *
 * Output: `{ items: InboxItem[] }`. See inbox-loader.ts for the full
 * shape contract.
 *
 * Performance: typical teacher with 3 classes × 24 students × 6
 * lessons × 5 tiles returns at most ~50 items (hard-capped at 200
 * pre-filter in the loader; UI trims to 50). Single round-trip.
 */

// audit-skip: routine teacher inbox read, no audit value

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadInboxItems } from "@/lib/grading/inbox-loader";

export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  const db = createAdminClient();

  try {
    const items = await loadInboxItems(db, auth.teacherId);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load inbox items",
      },
      { status: 500 },
    );
  }
}
