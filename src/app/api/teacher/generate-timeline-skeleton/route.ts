import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { SKELETON_SYSTEM_PROMPT, buildSkeletonPrompt, buildRAGSkeletonPrompt } from "@/lib/ai/prompts";
import { buildUnitTypeSystemPrompt } from "@/lib/ai/unit-types";
import { getTeachingContext } from "@/lib/ai/teacher-context";
import type { LessonJourneyInput, TimelineOutlineOption } from "@/types";

// Un-quarantined (10 Apr 2026) — Wizard routes restored.

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
    }
  );
}

/**
 * POST /api/teacher/generate-timeline-skeleton
 * Fast skeleton generation — lesson titles, key questions, timing.
 * ~10-15 seconds, ~2-3k output tokens.
 *
 * Body: {
 *   journeyInput: LessonJourneyInput,
 *   selectedOutline: TimelineOutlineOption,
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { journeyInput, selectedOutline, skipRag } = body as {
    journeyInput: LessonJourneyInput;
    selectedOutline: TimelineOutlineOption;
    skipRag?: boolean;
  };

  if (!journeyInput || !selectedOutline) {
    return NextResponse.json(
      { error: "journeyInput and selectedOutline are required" },
      { status: 400 }
    );
  }

  // Apply teacher profile defaults
  try {
    const { data: profile } = await supabase
      .from("teacher_profiles")
      .select("typical_period_minutes")
      .eq("user_id", user.id)
      .single();

    if (profile?.typical_period_minutes && !journeyInput.lessonLengthMinutes) {
      journeyInput.lessonLengthMinutes = profile.typical_period_minutes;
    }
  } catch {
    // Profile lookup is enhancement
  }
  if (!journeyInput.lessonLengthMinutes) journeyInput.lessonLengthMinutes = 50;
  if (!journeyInput.lessonsPerWeek) journeyInput.lessonsPerWeek = 3;

  // Resolve system prompt based on unit type (falls back to Design)
  const unitType = journeyInput.unitType || "design";
  const systemPrompt = unitType !== "design"
    ? buildUnitTypeSystemPrompt(unitType)
    : SKELETON_SYSTEM_PROMPT;

  // Resolve AI credentials
  const creds = await resolveCredentials(supabase, user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "AI provider not configured. Go to Settings to add your API key." },
      { status: 400 }
    );
  }

  const totalLessons = journeyInput.durationWeeks * journeyInput.lessonsPerWeek;

  try {
    const provider = createAIProvider(creds.provider, {
      apiEndpoint: creds.apiEndpoint,
      apiKey: creds.apiKey,
      modelName: creds.modelName,
    });

    if (!provider.generateSkeleton) {
      return NextResponse.json(
        { error: "AI provider does not support skeleton generation" },
        { status: 501 }
      );
    }

    // Fetch teaching context for framework vocab + school context
    const teachingContext = await getTeachingContext(user.id);

    // Build prompt — skip RAG if approach generation already did it
    let userPrompt: string;
    let chunkIds: string[] = [];

    if (skipRag) {
      // Fast path: no RAG retrieval, just build the prompt directly
      userPrompt = buildSkeletonPrompt(journeyInput, selectedOutline);
    } else {
      const ragResult = await buildRAGSkeletonPrompt(
        journeyInput,
        selectedOutline,
        user.id,
        teachingContext
      );
      userPrompt = ragResult.prompt;
      chunkIds = ragResult.chunkIds;
    }

    const skeleton = await provider.generateSkeleton(
      systemPrompt,
      userPrompt,
      totalLessons
    );

    return NextResponse.json({
      skeleton,
      ragChunkIds: chunkIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Skeleton generation failed: ${message}` },
      { status: 500 }
    );
  }
}
