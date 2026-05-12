/**
 * GET /api/teacher/inbox/count
 *
 * TFL.3 C.5 — dashboard chip endpoint. Returns the pending inbox
 * counts so the TopNav "Marking" badge can show the teacher how
 * many items are waiting without fetching the full item list every
 * 60s.
 *
 * Auth: requireTeacher.
 *
 * Response:
 *   {
 *     total: number,           // all states (reply_waiting + drafted + no_draft)
 *     replyWaiting: number,    // urgent subset — student is waiting on the teacher
 *   }
 *
 * Implementation note: re-uses loadInboxItems and counts client-side
 * rather than running a direct COUNT() SQL. Re-using keeps the
 * derivation logic in ONE place (states + resolved_at filter +
 * latestStudentReply.sentAt check live in the loader). If perf
 * becomes an issue at scale, a direct COUNT with the same filters
 * is a straight swap.
 */

// audit-skip: read-only counter, no DB writes.
import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadInboxItems } from "@/lib/grading/inbox-loader";

export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  try {
    const db = createAdminClient();
    const items = await loadInboxItems(db, auth.teacherId);
    const total = items.length;
    const replyWaiting = items.filter((i) => i.state === "reply_waiting").length;
    return NextResponse.json(
      { total, replyWaiting },
      {
        headers: {
          // Don't let intermediaries cache — counts are per-teacher
          // + change frequently. Polling client sets its own
          // cache:"no-store" anyway; this is belt + braces.
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load count",
      },
      { status: 500 },
    );
  }
}
