import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import {
  SINGLE_TIMELINE_OUTLINE_SYSTEM_PROMPT,
  buildSingleTimelineOutlinePrompt,
} from "@/lib/ai/prompts";
import { SINGLE_TIMELINE_OUTLINE_TOOL } from "@/lib/ai/schemas";
import { getTeachingContext, getFrameworkFromContext } from "@/lib/ai/teacher-context";
import { buildFrameworkPromptBlock } from "@/lib/ai/framework-vocabulary";
import { buildTeachingContextBlock } from "@/lib/knowledge/analysis-prompts";
import {
  retrieveContext,
  formatRetrievedContext,
} from "@/lib/knowledge/retrieve";
import {
  retrieveLessonProfiles,
  formatLessonProfiles,
  incrementProfileReferences,
} from "@/lib/knowledge/retrieve-lesson-profiles";
import { retrieveAggregatedFeedback } from "@/lib/knowledge/feedback";
import { formatFeedbackContext } from "@/lib/ai/prompts";
import type { LessonJourneyInput, TimelineOutlineOption } from "@/types";

// QUARANTINED (3 Apr 2026) — Generation pipeline disabled pending architecture rebuild (Dimensions2).
// See docs/quarantine.md for full rationale.
const QUARANTINE_RESPONSE = NextResponse.json({ error: "Generation pipeline quarantined — pending architecture rebuild. See docs/quarantine.md" }, { status: 410 });

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
 * POST /api/teacher/generate-timeline-outline-single
 * Generate a SINGLE timeline outline approach with a given angle hint.
 * Designed to be called 3x in parallel from the client.
 *
 * Body: {
 *   journeyInput: LessonJourneyInput,
 *   angleHint: string,
 *   avoidApproaches: string[],
 *   index: number  // 0, 1, or 2
 * }
 */
export async function POST(request: NextRequest) {
  return QUARANTINE_RESPONSE;
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { journeyInput, angleHint, avoidApproaches, index } = body as {
    journeyInput: LessonJourneyInput;
    angleHint: string;
    avoidApproaches: string[];
    index: number;
  };

  if (!journeyInput?.endGoal || !angleHint) {
    return NextResponse.json(
      { error: "journeyInput and angleHint are required" },
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

  // Resolve AI credentials
  const creds = await resolveCredentials(supabase, user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "AI provider not configured. Go to Settings to add your API key." },
      { status: 400 }
    );
  }

  try {
    const provider = createAIProvider(creds.provider, {
      apiEndpoint: creds.apiEndpoint,
      apiKey: creds.apiKey,
      modelName: creds.modelName,
    });

    // Retrieve RAG context + feedback (only for first request to save API calls)
    let ragContext = "";
    if (index === 0) {
      const query = `${journeyInput.topic} ${journeyInput.title} ${journeyInput.endGoal} ${journeyInput.gradeLevel}`;
      try {
        const chunks = await retrieveContext({
          query,
          gradeLevel: journeyInput.gradeLevel,
          teacherId: user.id,
          includePublic: true,
          maxChunks: 3,
        });
        if (chunks.length > 0) {
          ragContext = formatRetrievedContext(chunks);
        }
      } catch {
        // RAG is enhancement
      }

      try {
        const profiles = await retrieveLessonProfiles({
          query,
          gradeLevel: journeyInput.gradeLevel,
          teacherId: user.id,
          maxProfiles: 2,
        });
        if (profiles.length > 0) {
          const profileContext = formatLessonProfiles(profiles);
          ragContext = profileContext + (ragContext ? "\n\n---\n\n" + ragContext : "");
          // Inject aggregated feedback from these profiles (Layer 2 → outlines)
          try {
            const profileIds = profiles.map((p) => p.id);
            const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
            if (aggregatedFeedback.length > 0) {
              const feedbackBlock = formatFeedbackContext(aggregatedFeedback);
              ragContext = ragContext + "\n\n---\n\n" + feedbackBlock;
            }
          } catch {
            // Feedback is enhancement
          }
          incrementProfileReferences(profiles.map((p) => p.id)).catch(() => {});
        }
      } catch {
        // Lesson profiles are enhancement
      }
    }

    // Build teaching context + framework vocabulary
    const teachingContext = await getTeachingContext(user.id);
    const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
    const teachingBlock = buildTeachingContextBlock(teachingContext || undefined);
    const teachingContextBlock = (frameworkBlock + teachingBlock).trim() || undefined;

    const userPrompt = buildSingleTimelineOutlinePrompt(
      journeyInput,
      angleHint,
      avoidApproaches,
      ragContext || undefined,
      teachingContextBlock
    );

    // Use tool-based generation
    if (provider.generateOutlines) {
      const result = await provider.generateOutlines(
        SINGLE_TIMELINE_OUTLINE_SYSTEM_PROMPT,
        userPrompt,
        SINGLE_TIMELINE_OUTLINE_TOOL
      );

      // The result comes back as the tool input directly (single option shape)
      const option = result as unknown as TimelineOutlineOption;
      if (!option?.approach || !option?.phases) {
        return NextResponse.json(
          { error: "AI did not return a valid outline option" },
          { status: 422 }
        );
      }

      return NextResponse.json({
        option: { ...option, phases: option.phases || [] },
        index,
      });
    }

    // Fallback: text generation
    if (provider.generateText) {
      const text = await provider.generateText(
        SINGLE_TIMELINE_OUTLINE_SYSTEM_PROMPT,
        userPrompt,
        { maxTokens: 3000, temperature: 0.8 }
      );
      const parsed = JSON.parse(text);
      return NextResponse.json({ option: parsed, index });
    }

    return NextResponse.json(
      { error: "AI provider does not support outline generation" },
      { status: 501 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Outline generation failed: ${message}` },
      { status: 500 }
    );
  }
}
