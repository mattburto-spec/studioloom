// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/suggest-videos
 *
 * Returns up to 3 video candidates for a teacher-authored activity
 * block. Pipeline: Haiku → YouTube → Sonnet re-rank → JSON response.
 *
 * Brief: docs/projects/ai-video-suggestions-brief.md
 * Sub-phase 1 (this route) — sub-phase 2 will wire it into the
 * Activity Block Media tab.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireTeacher } from "@/lib/auth/require-teacher";
import {
  buildSearchQuery,
  composeFinalQuery,
} from "@/lib/video-suggestions/build-query";
import {
  fetchYouTubeVideos,
  type DurationBucket,
} from "@/lib/video-suggestions/fetch-youtube";
import { rerankWithClaude } from "@/lib/video-suggestions/rerank";
import type {
  SuggestVideosResponse,
  SuggestionContext,
} from "@/lib/video-suggestions/types";

export const runtime = "nodejs";

function createSupabaseServer(request: NextRequest) {
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
    },
  );
}

const VALID_DURATIONS: ReadonlyArray<DurationBucket> = [
  "short",
  "medium",
  "long",
  "any",
];
const VALID_COUNTS = new Set([3, 5, 10]);

/** Light input parser — keeps the route resilient against extra fields. */
function parseContext(body: unknown): SuggestionContext | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const duration =
    typeof b.duration === "string" &&
    (VALID_DURATIONS as ReadonlyArray<string>).includes(b.duration)
      ? (b.duration as DurationBucket)
      : undefined;
  const count =
    typeof b.count === "number" && VALID_COUNTS.has(b.count)
      ? (b.count as 3 | 5 | 10)
      : undefined;

  const ctx: SuggestionContext = {
    framing: typeof b.framing === "string" ? b.framing : undefined,
    task: typeof b.task === "string" ? b.task : undefined,
    success_signal:
      typeof b.success_signal === "string" ? b.success_signal : undefined,
    unitTitle: typeof b.unitTitle === "string" ? b.unitTitle : undefined,
    subject: typeof b.subject === "string" ? b.subject : undefined,
    gradeLevel: typeof b.gradeLevel === "string" ? b.gradeLevel : undefined,
    excludeVideoIds: Array.isArray(b.excludeVideoIds)
      ? b.excludeVideoIds.filter((v): v is string => typeof v === "string")
      : undefined,
    duration,
    extraKeywords:
      typeof b.extraKeywords === "string" ? b.extraKeywords : undefined,
    excludeKeywords:
      typeof b.excludeKeywords === "string" ? b.excludeKeywords : undefined,
    count,
  };
  // Require at least one signal field so we have something to search on.
  if (!ctx.framing && !ctx.task && !ctx.success_signal && !ctx.unitTitle) {
    return null;
  }
  return ctx;
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeKey) {
    return NextResponse.json(
      { error: "video suggestions not configured (missing YOUTUBE_API_KEY)" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const ctx = parseContext(body);
  if (!ctx) {
    return NextResponse.json(
      {
        error:
          "at least one of framing, task, success_signal, or unitTitle is required",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServer(request);

  try {
    // Phase 1 — query builder.
    const { query: aiQuery, source: querySource } = await buildSearchQuery(
      ctx,
      { supabase, teacherId },
    );
    // Compose with teacher's optional extra / exclude keywords. Keeps
    // the AI prompt stable while honouring overrides at the YouTube
    // query layer.
    const finalQuery = composeFinalQuery(
      aiQuery,
      ctx.extraKeywords,
      ctx.excludeKeywords,
    );
    console.log(
      `[suggest-videos] query=${JSON.stringify(finalQuery)} source=${querySource}`,
    );

    const count = ctx.count ?? 3;
    // Need a candidate pool ~3x the requested count so the re-ranker
    // has room to reject clickbait / off-topic. Floor at 10 so the
    // 3-pick default behaves like before.
    const searchLimit = Math.max(10, count * 3);

    // Phase 2 — YouTube fetch with a 10s hard cap.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    let rawItems;
    try {
      rawItems = await fetchYouTubeVideos(finalQuery, {
        apiKey: youtubeKey,
        searchLimit,
        duration: ctx.duration,
        excludeVideoIds: ctx.excludeVideoIds,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    console.log(`[suggest-videos] youtube returned ${rawItems.length} items`);

    if (rawItems.length === 0) {
      const response: SuggestVideosResponse = {
        candidates: [],
        note: "no embeddable videos matched the query",
      };
      return NextResponse.json(response);
    }

    // Phase 3 — re-rank into final {count}.
    const { candidates, note } = await rerankWithClaude(ctx, rawItems, {
      supabase,
      teacherId,
      count,
    });
    console.log(`[suggest-videos] surfaced ${candidates.length} candidates`);

    const response: SuggestVideosResponse = {
      candidates,
      ...(note ? { note } : {}),
    };
    return NextResponse.json(response);
  } catch (err) {
    // Specific reasons bubble up from the rerank step via Error.reason.
    const reason = (err as { reason?: string })?.reason;
    if (reason === "over_cap") {
      return NextResponse.json(
        { error: "AI budget cap reached — try again tomorrow" },
        { status: 429 },
      );
    }
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[suggest-videos] error:", message);
    return NextResponse.json(
      { error: "video suggestions temporarily unavailable" },
      { status: 502 },
    );
  }
}
