/**
 * PATCH /api/teacher/gallery/[roundId]/layout
 *
 * Bulk-save canvas positions for submissions in a gallery round.
 * Called by GalleryCanvasView after teacher drags cards (debounced ~600ms).
 *
 * Spec: docs/projects/gallery-v2.md §10 GV2-1
 * Phase 1 of 4 for Gallery v2.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SUBMISSIONS_PER_CALL = 50;
const COORD_MIN = -10000;
const COORD_MAX = 10000;

function getAuthClient(request: NextRequest) {
  return createServerClient(
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
}

function extractRoundId(request: NextRequest): string {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  // /api/teacher/gallery/[roundId]/layout → roundId is second-from-last
  return segments[segments.length - 2];
}

interface LayoutPayload {
  submissions: Array<{ id: string; canvas_x: number; canvas_y: number }>;
}

export async function PATCH(request: NextRequest) {
  const supabase = getAuthClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = extractRoundId(request);
  if (!UUID_RE.test(roundId)) {
    return NextResponse.json({ error: "Invalid round id" }, { status: 400 });
  }

  let body: LayoutPayload;
  try {
    body = (await request.json()) as LayoutPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || !Array.isArray(body.submissions)) {
    return NextResponse.json(
      { error: "submissions array required" },
      { status: 400 }
    );
  }

  if (body.submissions.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  if (body.submissions.length > MAX_SUBMISSIONS_PER_CALL) {
    return NextResponse.json(
      { error: `Too many submissions in one call (max ${MAX_SUBMISSIONS_PER_CALL})` },
      { status: 400 }
    );
  }

  // Validate each entry
  for (const entry of body.submissions) {
    if (!entry || typeof entry.id !== "string" || !UUID_RE.test(entry.id)) {
      return NextResponse.json(
        { error: "Each submission must have a valid uuid id" },
        { status: 400 }
      );
    }
    if (
      typeof entry.canvas_x !== "number" ||
      typeof entry.canvas_y !== "number" ||
      !Number.isFinite(entry.canvas_x) ||
      !Number.isFinite(entry.canvas_y) ||
      entry.canvas_x < COORD_MIN ||
      entry.canvas_x > COORD_MAX ||
      entry.canvas_y < COORD_MIN ||
      entry.canvas_y > COORD_MAX
    ) {
      return NextResponse.json(
        { error: "canvas_x and canvas_y must be finite numbers within [-10000, 10000]" },
        { status: 400 }
      );
    }
  }

  const db = createAdminClient();

  // Verify teacher owns this round
  const { data: round, error: roundError } = await db
    .from("gallery_rounds")
    .select("id")
    .eq("id", roundId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (roundError) {
    console.error("[gallery/[roundId]/layout:PATCH] Round lookup error:", roundError);
    return NextResponse.json({ error: "Failed to verify round" }, { status: 500 });
  }

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 403 });
  }

  // Verify all submissions belong to this round
  const ids = body.submissions.map((s) => s.id);
  const { data: ownedRows, error: ownedError } = await db
    .from("gallery_submissions")
    .select("id")
    .eq("round_id", roundId)
    .in("id", ids);

  if (ownedError) {
    console.error("[gallery/[roundId]/layout:PATCH] Submissions lookup error:", ownedError);
    return NextResponse.json({ error: "Failed to verify submissions" }, { status: 500 });
  }

  const ownedIds = new Set((ownedRows || []).map((r: { id: string }) => r.id));
  if (ownedIds.size !== ids.length) {
    return NextResponse.json(
      { error: "One or more submissions do not belong to this round" },
      { status: 400 }
    );
  }

  // Update each submission's canvas position. There's no single-SQL bulk-update
  // with per-row values via PostgREST, so we issue one UPDATE per submission.
  // The 50-entry cap above bounds the request shape.
  let updated = 0;
  for (const entry of body.submissions) {
    const { error: updateError } = await db
      .from("gallery_submissions")
      .update({ canvas_x: entry.canvas_x, canvas_y: entry.canvas_y })
      .eq("id", entry.id)
      .eq("round_id", roundId);

    if (updateError) {
      console.error(
        "[gallery/[roundId]/layout:PATCH] Update error for submission",
        entry.id,
        updateError
      );
      return NextResponse.json(
        { error: "Failed to save layout", updated },
        { status: 500 }
      );
    }
    updated += 1;
  }

  return NextResponse.json(
    { ok: true, updated },
    { headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" } }
  );
}
