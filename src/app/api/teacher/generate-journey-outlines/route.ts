// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAIProvider } from "@/lib/ai";
import {
  JOURNEY_OUTLINE_SYSTEM_PROMPT,
  SINGLE_JOURNEY_OUTLINE_SYSTEM_PROMPT,
  buildJourneyOutlinePrompt,
  buildSingleJourneyOutlinePrompt,
} from "@/lib/ai/prompts";
import { JOURNEY_OUTLINE_TOOL, SINGLE_JOURNEY_OUTLINE_TOOL } from "@/lib/ai/schemas";
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
import { retrieveAggregatedFeedback } from "@/lib/knowledge/feedback";
import { formatFeedbackContext } from "@/lib/ai/prompts";
import type { LessonJourneyInput, JourneyOutlineOption } from "@/types";

// Un-quarantined (9 Apr 2026) — Dimensions3 pipeline complete, wizard routes restored.

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
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const supabase = createSupabaseServer(request);

  const body = await request.json();
  const { journeyInput, angleHint, avoidApproaches, index } = body as {
    journeyInput: LessonJourneyInput;
    angleHint?: string;
    avoidApproaches?: string[];
    index?: number;
  };
  const singleMode = !!angleHint;

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
      .eq("user_id", teacherId)
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
  const creds = await resolveCredentials(supabase, teacherId);
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
        teacherId: teacherId,
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
        teacherId: teacherId,
        maxProfiles: 3,
      });

      if (profiles.length > 0) {
        const profileContext = formatLessonProfiles(profiles);
        ragContext = profileContext + (ragContext ? "\n\n---\n\n" + ragContext : "");
        const profileIds = profiles.map((p) => p.id);
        // Inject aggregated feedback from these profiles (Layer 2 → outlines)
        try {
          const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
          if (aggregatedFeedback.length > 0) {
            const feedbackBlock = formatFeedbackContext(aggregatedFeedback);
            ragContext = ragContext + "\n\n---\n\n" + feedbackBlock;
          }
        } catch {
          // Feedback is enhancement
        }
        incrementProfileReferences(profileIds).catch(() => {});
      }
    } catch {
      // Lesson profiles are enhancement
    }

    // Build teaching context + framework vocabulary
    const teachingContext = await getTeachingContext(teacherId);
    const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
    const teachingBlock = buildTeachingContextBlock(teachingContext || undefined);
    const teachingContextBlock = (frameworkBlock + teachingBlock).trim() || undefined;

    // Branch: single mode (for "suggest another" feature) vs batch (3 outlines)
    if (singleMode) {
      const userPrompt = buildSingleJourneyOutlinePrompt(
        journeyInput,
        angleHint!,
        avoidApproaches || [],
        ragContext || undefined,
        teachingContextBlock
      );

      if (provider.generateOutlines) {
        const result = await provider.generateOutlines(
          SINGLE_JOURNEY_OUTLINE_SYSTEM_PROMPT,
          userPrompt,
          SINGLE_JOURNEY_OUTLINE_TOOL
        );

        const option = result as unknown as JourneyOutlineOption;
        if (!option?.approach || !option?.lessonPlan) {
          return NextResponse.json(
            { error: "AI did not return a valid outline option" },
            { status: 422 }
          );
        }

        return NextResponse.json({
          option: { ...option, lessonPlan: option.lessonPlan || [] },
          index: index ?? 0,
        });
      }

      if (provider.generateText) {
        const text = await provider.generateText(
          SINGLE_JOURNEY_OUTLINE_SYSTEM_PROMPT,
          userPrompt,
          { maxTokens: 3000, temperature: 0.8 }
        );
        const parsed = JSON.parse(text);
        return NextResponse.json({ option: parsed, index: index ?? 0 });
      }
    } else {
      // Standard batch mode: generate 3 outlines
      const userPrompt = buildJourneyOutlinePrompt(journeyInput, ragContext || undefined, teachingContextBlock);

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

        const validated = options.map((opt) => ({
          ...opt,
          lessonPlan: opt.lessonPlan || [],
        }));

        return NextResponse.json({ options: validated });
      }

      if (provider.generateText) {
        const text = await provider.generateText(
          JOURNEY_OUTLINE_SYSTEM_PROMPT,
          userPrompt,
          { maxTokens: 6000, temperature: 0.8 }
        );

        const parsed = JSON.parse(text);
        return NextResponse.json({ options: parsed.options || [] });
      }
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
