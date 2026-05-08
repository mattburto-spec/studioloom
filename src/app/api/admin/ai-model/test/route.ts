// audit-skip: ephemeral admin sandbox/test surface, no audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveConfigFromOverrides } from "@/lib/ai/model-config";
import { buildSkeletonPrompt, getGradeTimingProfile, buildTimingBlock, SKELETON_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { AIModelConfig } from "@/types/ai-model-config";
import type { LessonJourneyInput, TimelineOutlineOption } from "@/types";
import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "mattburto@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

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
 * POST /api/admin/ai-model/test
 * Generate a test skeleton using the provided (unsaved) config.
 */
export async function POST(request: NextRequest) {
  return QUARANTINE_RESPONSE;
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user! || !user!.email || !ADMIN_EMAILS.includes(user!.email!.toLowerCase())) {
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
        lessonCount?: number;
        lessonLengthMinutes?: number;
        curriculumFramework?: string;
        assessmentCriteria?: string[];
      };
    };

    const resolvedConfig = resolveConfigFromOverrides(config);
    // Default to MYP Design criteria — will be dynamic when unitType is added to skeleton test input
    const criteria = testInput.assessmentCriteria || ["A", "B", "C", "D"];
    const framework = testInput.curriculumFramework || "IB_MYP";

    // Build a minimal input
    const input: LessonJourneyInput = {
      title: `Test: ${testInput.topic}`,
      gradeLevel: testInput.gradeLevel,
      endGoal: testInput.endGoal,
      durationWeeks: 1,
      lessonsPerWeek: testInput.lessonCount || 4,
      lessonLengthMinutes: testInput.lessonLengthMinutes || 50,
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

    // Simple outline for skeleton generation
    const outline: TimelineOutlineOption = {
      approach: "Balanced Design Process",
      description: `A balanced approach to ${testInput.topic} covering research, ideation, making, and evaluation.`,
      strengths: ["Covers full design cycle", "Age-appropriate pacing"],
      estimatedActivityCount: (testInput.lessonCount || 4) * 4,
      phases: [{
        phaseId: "phase-1",
        title: "Full Unit",
        summary: `Complete ${testInput.topic} design unit`,
        estimatedLessons: testInput.lessonCount || 4,
        primaryFocus: "Design process",
        criterionTags: criteria,
      }],
    };

    // Get timing from config
    const timingProfile = getGradeTimingProfile(testInput.gradeLevel, "IB_MYP", resolvedConfig.timingProfiles);
    const timingBlock = buildTimingBlock(timingProfile, testInput.lessonLengthMinutes || 50);

    // Build the prompt
    const userPrompt = buildSkeletonPrompt(input, outline, "");

    const startTime = Date.now();

    const callResult = await callAnthropicMessages({
      endpoint: "/api/admin/ai-model/test",
      teacherId: user!.id,
      model: MODELS.SONNET,
      maxTokens: 16000,
      thinking: { type: "enabled", budget_tokens: 8000 },
      system: SKELETON_SYSTEM_PROMPT + "\n\n" + timingBlock,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Quarantined route — TS narrowing breaks on dead code after early return.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cr = callResult as any;
    if (!cr.ok) {
      if (cr.reason === "no_credentials") {
        return NextResponse.json({ error: "No ANTHROPIC_API_KEY configured" }, { status: 500 });
      }
      if (cr.reason === "truncated") {
        return NextResponse.json({ error: "AI response truncated (max_tokens hit)" }, { status: 502 });
      }
      if (cr.reason === "api_error") throw cr.error;
      return NextResponse.json({ error: `AI call failed: ${cr.reason}` }, { status: 502 });
    }

    const response = cr.response;
    const elapsed = Date.now() - startTime;

    // Extract thinking and text content
    let thinking: string | null = null;
    {
      const thinkingContent = response.content.find((c: { type: string }) => c.type === "thinking");
      if (thinkingContent && "thinking" in (thinkingContent as any)) {
        thinking = ((thinkingContent!) as any as { thinking: string }).thinking;
      }
    }

    let skeleton = null;
    {
      const textContent = response.content.find((c: { type: string }) => c.type === "text");
      if (textContent && "text" in (textContent as any)) {
        let raw = ((textContent!) as any as { text: string }).text.trim();
        // Strip ```json ... ``` wrapping
        if (raw.startsWith("```")) {
          raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
        }
        try {
          skeleton = JSON.parse(raw);
        } catch {
          skeleton = raw;
        }
      }
    }

    return NextResponse.json({
      skeleton,
      thinking,
      elapsed,
      tokensUsed: response.usage,
      configApplied: {
        timingProfile: timingProfile,
        generationEmphasis: resolvedConfig.generationEmphasis,
      },
    });
  } catch (err: unknown) {
    console.error("[admin/ai-model/test] Error:", err);
    let errorMessage = "Test generation failed";
    if (err instanceof Error) {
      errorMessage = (err as Error).message;
    } else if (err) {
      errorMessage = String(err);
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
