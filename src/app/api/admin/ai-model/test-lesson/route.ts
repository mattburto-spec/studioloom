import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveConfigFromOverrides } from "@/lib/ai/model-config";
import {
  JOURNEY_SYSTEM_PROMPT,
  buildJourneyPrompt,
  getGradeTimingProfile,
  buildTimingBlock,
  calculateUsableTime,
} from "@/lib/ai/prompts";
import type { TimingContext } from "@/lib/ai/prompts";
import { validateLessonTiming } from "@/lib/ai/timing-validation";
import type { GeneratedLesson } from "@/lib/ai/timing-validation";
import { buildLessonGenerationTool } from "@/lib/ai/schemas";
import type { AIModelConfig } from "@/types/ai-model-config";
import type { LessonJourneyInput } from "@/types";
import Anthropic from "@anthropic-ai/sdk";
import { buildUnitTypeSystemPrompt, UNIT_TYPES } from "@/lib/ai/unit-types";
import type { UnitType } from "@/lib/ai/unit-types";
import { getCriterionKeys } from "@/lib/constants";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "mattburto@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

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
 * POST /api/admin/ai-model/test-lesson
 * Generate a single full lesson page using the provided (unsaved) config.
 * Returns complete page content with sections, scaffolding, response types, etc.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { config, testInput } = body as {
      config: AIModelConfig;
      testInput: {
        topic: string;
        gradeLevel: string;
        endGoal: string;
        lessonType?: string;
        lessonLengthMinutes?: number;
        curriculumFramework?: string;
        assessmentCriteria?: string[];
        unitType?: UnitType;
      };
    };

    const resolvedConfig = resolveConfigFromOverrides(config);
    const lessonLengthMinutes = testInput.lessonLengthMinutes || 50;
    const unitType: UnitType = testInput.unitType || "design";
    const criteria = testInput.assessmentCriteria || getCriterionKeys(unitType);
    const framework = testInput.curriculumFramework || "IB_MYP";

    // Build a minimal journey input for a single lesson
    const input: LessonJourneyInput = {
      title: `Test: ${testInput.topic}`,
      gradeLevel: testInput.gradeLevel,
      endGoal: testInput.endGoal,
      durationWeeks: 1,
      lessonsPerWeek: 1,
      lessonLengthMinutes,
      topic: testInput.topic,
      globalContext: "Scientific and technical innovation",
      keyConcept: "Systems",
      relatedConcepts: ["Function", "Form"],
      statementOfInquiry: `Exploring how ${testInput.topic} can be designed to meet user needs.`,
      atlSkills: ["Thinking", "Communication"],
      specificSkills: [],
      resourceUrls: [],
      specialRequirements: "",
      assessmentCriteria: criteria,
      curriculumFramework: framework,
    };

    const lessonId = "L01";

    // Build a simple outline context if lesson type is specified
    const selectedOutline = testInput.lessonType
      ? {
          approach: "Test Lesson",
          description: `Single ${testInput.lessonType} lesson for testing`,
          strengths: [],
          lessonPlan: [
            {
              lessonId,
              title: `${testInput.topic} — ${testInput.lessonType}`,
              summary: `A ${testInput.lessonType} lesson exploring ${testInput.topic}`,
              primaryFocus: testInput.lessonType.charAt(0).toUpperCase() + testInput.lessonType.slice(1),
              criterionTags: criteria,
            },
          ],
        }
      : null;

    // Get timing from config
    const timingProfile = getGradeTimingProfile(testInput.gradeLevel, resolvedConfig.timingProfiles);
    const timingBlock = buildTimingBlock(timingProfile, lessonLengthMinutes);

    // Build the user prompt using the journey prompt builder with framework
    const userPrompt = buildJourneyPrompt([lessonId], input, {
      selectedOutline,
      totalLessons: 1,
      framework,
    });

    // Use platform API key directly for admin test
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No ANTHROPIC_API_KEY configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const tool = buildLessonGenerationTool([lessonId]);

    const startTime = Date.now();

    // Use unit-type-aware system prompt instead of hardcoded JOURNEY_SYSTEM_PROMPT
    const systemPrompt = unitType === "design"
      ? JOURNEY_SYSTEM_PROMPT  // Preserve existing Design prompt for backward compat
      : buildUnitTypeSystemPrompt(unitType);

    // Note: thinking cannot be used with tool_choice, so we disable it here
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: systemPrompt + "\n\n" + timingBlock,
      messages: [{ role: "user", content: userPrompt }],
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    });

    const elapsed = Date.now() - startTime;

    // Extract thinking
    const thinkingContent = response.content.find(c => c.type === "thinking");
    const thinking = thinkingContent && thinkingContent.type === "thinking" ? thinkingContent.thinking : null;

    // Extract tool use result (structured JSON)
    const toolUseContent = response.content.find(c => c.type === "tool_use");
    let lesson = null;
    if (toolUseContent && toolUseContent.type === "tool_use") {
      const toolInput = toolUseContent.input as Record<string, unknown>;
      lesson = toolInput[lessonId] || toolInput;
    }

    // --- Timing validation + auto-repair ---
    let timingValidation = null;
    let repairedLesson = lesson;
    if (lesson) {
      const timingCtx: TimingContext = {
        periodMinutes: lessonLengthMinutes,
        isWorkshop: false,
        transitionMinutes: 3,
        setupMinutes: 0,
        cleanupMinutes: 0,
        gradeProfile: timingProfile,
      };
      const result = validateLessonTiming(
        lesson as GeneratedLesson,
        timingProfile,
        timingCtx
      );
      timingValidation = {
        valid: result.valid,
        issues: result.issues,
        stats: result.stats,
      };
      // Use the auto-repaired lesson (fixes missing phases, over-cap instruction, etc.)
      repairedLesson = result.repairedLesson;
    }

    return NextResponse.json({
      lesson: repairedLesson,
      lessonRaw: lesson, // Original AI output for comparison
      thinking,
      elapsed,
      tokensUsed: response.usage,
      timingValidation,
      unitType,
      unitTypeLabel: UNIT_TYPES[unitType].label,
      configApplied: {
        timingProfile,
        generationEmphasis: resolvedConfig.generationEmphasis,
      },
    });
  } catch (err) {
    console.error("[admin/ai-model/test-lesson] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test lesson generation failed" },
      { status: 500 }
    );
  }
}
