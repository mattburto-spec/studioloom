import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { JOURNEY_OUTLINE_SYSTEM_PROMPT, buildJourneyOutlinePrompt } from "@/lib/ai/prompts";
import { JOURNEY_OUTLINE_TOOL } from "@/lib/ai/schemas";
import {
  retrieveContext,
  formatRetrievedContext,
} from "@/lib/knowledge/retrieve";
import { getTeachingContext, getFrameworkFromContext } from "@/lib/ai/teacher-context";
import { buildFrameworkPromptBlock } from "@/lib/ai/framework-vocabulary";
import { buildTeachingContextBlock } from "@/lib/knowledge/analysis-prompts";
import {
  retrieveLessonProfiles,
  formatLessonProfiles,
  incrementProfileReferences,
} from "@/lib/knowledge/retrieve-lesson-profiles";
import type { LessonJourneyInput, JourneyOutlineOption } from "@/types";

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
 * POST /api/teacher/generate-journey-outlines
 * Generate 3 distinct learning journey outlines for the teacher to choose from.
 *
 * Body: { journeyInput: LessonJourneyInput }
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
  const { journeyInput } = body as { journeyInput: LessonJourneyInput };

  if (!journeyInput?.endGoal) {
    return NextResponse.json(
      { error: "journeyInput with endGoal is required" },
      { status: 400 }
    );
  }

  // Apply teacher profile defaults for lesson length
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
    // Profile lookup is enhancement — use defaults
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

    // Retrieve RAG context (no criterion filter)
    let ragContext = "";
    const query = `${journeyInput.topic} ${journeyInput.title} ${journeyInput.endGoal} ${journeyInput.gradeLevel}`;

    try {
      const chunks = await retrieveContext({
        query,
        gradeLevel: journeyInput.gradeLevel,
        teacherId: user.id,
        includePublic: true,
        maxChunks: 5,
      });

      if (chunks.length > 0) {
        ragContext = formatRetrievedContext(chunks);
      }
    } catch {
      // RAG is enhancement
    }

    // Retrieve lesson profiles
    try {
      const profiles = await retrieveLessonProfiles({
        query,
        gradeLevel: journeyInput.gradeLevel,
        teacherId: user.id,
        maxProfiles: 3,
      });

      if (profiles.length > 0) {
        const profileContext = formatLessonProfiles(profiles);
        ragContext = profileContext + (ragContext ? "\n\n---\n\n" + ragContext : "");
        const profileIds = profiles.map((p) => p.id);
        incrementProfileReferences(profileIds).catch(() => {});
      }
    } catch {
      // Lesson profiles are enhancement
    }

    // Build teaching context + framework vocabulary
    const teachingContext = await getTeachingContext(user.id);
    const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
    const teachingBlock = buildTeachingContextBlock(teachingContext || undefined);
    const teachingContextBlock = (frameworkBlock + teachingBlock).trim() || undefined;

    const userPrompt = buildJourneyOutlinePrompt(journeyInput, ragContext || undefined, teachingContextBlock);

    // Use tool-based generation if available
    if (provider.generateOutlines) {
      const result = await provider.generateOutlines(
        JOURNEY_OUTLINE_SYSTEM_PROMPT,
        userPrompt,
        JOURNEY_OUTLINE_TOOL
      );

      const options = (result as { options?: JourneyOutlineOption[] }).options;
      if (!options || !Array.isArray(options)) {
        return NextResponse.json(
          { error: "AI did not return valid outline options" },
          { status: 422 }
        );
      }

      // Validate each option has the right number of lessons
      const totalLessons = journeyInput.durationWeeks * journeyInput.lessonsPerWeek;
      const validated = options.map((opt) => ({
        ...opt,
        lessonPlan: opt.lessonPlan || [],
      }));

      return NextResponse.json({ options: validated });
    }

    // Fallback: text generation + JSON parse
    if (provider.generateText) {
      const text = await provider.generateText(
        JOURNEY_OUTLINE_SYSTEM_PROMPT,
        userPrompt,
        { maxTokens: 6000, temperature: 0.8 }
      );

      const parsed = JSON.parse(text);
      return NextResponse.json({ options: parsed.options || [] });
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
