import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { decrypt } from "@/lib/encryption";
import { createAIProvider } from "@/lib/ai";
import { UNIT_SYSTEM_PROMPT, buildUnitSystemPrompt, getGradeTimingProfile, buildTimingContext } from "@/lib/ai/prompts";
import { buildUnitTypeSystemPrompt, type UnitType } from "@/lib/ai/unit-types";
import { validateGeneratedPages } from "@/lib/ai/validation";
import { validateLessonTiming } from "@/lib/ai/timing-validation";
import { CRITERIA, DEFAULT_MYP_PAGES, type CriterionKey } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import { getActivityLibrarySummary } from "@/lib/activity-library";
import { buildFrameworkPromptBlock } from "@/lib/ai/framework-vocabulary";
import { computeLessonPulse } from "@/lib/layers/lesson-pulse";
import type { PulseActivity } from "@/lib/layers/lesson-pulse";
import {
  retrieveLessonProfiles,
  formatLessonProfiles,
  incrementProfileReferences,
} from "@/lib/knowledge/retrieve-lesson-profiles";

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
 * POST /api/teacher/regenerate-page
 * Regenerate a single page of an existing unit.
 * Body: { unitId, pageId, instruction? }
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
  const { unitId, pageId, instruction } = body as {
    unitId: string;
    pageId: string;
    instruction?: string;
  };

  if (!unitId || !pageId) {
    return NextResponse.json(
      { error: "unitId and pageId are required" },
      { status: 400 }
    );
  }

  // Load unit metadata
  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select(
      "title, topic, grade_level, duration_weeks, global_context, key_concept, content_data, unit_type, curriculum_context, framework"
    )
    .eq("id", unitId)
    .single();

  if (unitError || !unit) {
    return NextResponse.json(
      { error: "Unit not found" },
      { status: 404 }
    );
  }

  // Resolve system prompt based on unit type and framework
  const unitType = (unit.unit_type || "design") as UnitType;
  const framework = (unit as any).framework || "IB_MYP";
  const systemPrompt = unitType !== "design"
    ? buildUnitTypeSystemPrompt(unitType)
    : buildUnitSystemPrompt(framework);

  // Find the page definition from unit data or default MYP pages
  const unitPages = getPageList(unit.content_data);
  const pageDef = unitPages.find((p) => p.id === pageId)
    || DEFAULT_MYP_PAGES.find((p) => p.id === pageId);
  if (!pageDef) {
    return NextResponse.json(
      { error: `Unknown page: ${pageId}` },
      { status: 400 }
    );
  }

  const criterion = (pageDef.criterion || "A") as CriterionKey;
  const criterionInfo = CRITERIA[criterion];

  // Load teacher's AI settings
  const { data: settings } = await supabase
    .from("ai_settings")
    .select("*")
    .eq("teacher_id", user.id)
    .single();

  if (!settings) {
    return NextResponse.json(
      {
        error:
          "AI provider not configured. Go to Settings to add your API key.",
      },
      { status: 400 }
    );
  }

  try {
    const apiKey = decrypt(settings.encrypted_api_key);
    const provider = createAIProvider(settings.provider, {
      apiEndpoint: settings.api_endpoint,
      apiKey,
      modelName: settings.model_name,
    });

    // Build a focused single-page prompt
    const activitySuggestions = getActivityLibrarySummary(criterion);

    // Retrieve lesson profiles for pedagogical context
    let lessonContext = "";
    try {
      const profiles = await retrieveLessonProfiles({
        query: `${unit.title} ${unit.topic || ""} ${criterionInfo.name} ${unit.grade_level || ""}`,
        gradeLevel: unit.grade_level || undefined,
        criteria: [criterion],
        teacherId: user.id,
        maxProfiles: 2,
      });
      if (profiles.length > 0) {
        lessonContext = formatLessonProfiles(profiles) + "\n\n---\n\n";
        incrementProfileReferences(profiles.map((p) => p.id)).catch(() => {});
      }
    } catch {
      // Lesson profiles are enhancement, not requirement
    }

    const frameworkBlock = buildFrameworkPromptBlock(framework);
    const userPrompt = `${frameworkBlock ? `${frameworkBlock}\n\n---\n\n` : ""}${lessonContext}Regenerate ONLY page ${pageId}: "${pageDef.title}" for Criterion ${criterion} (${criterionInfo.name}).

## Unit Context
- Title: ${unit.title}
- Topic: ${unit.topic || "Not specified"}
- Grade Level: ${unit.grade_level || "Not specified"}
- Duration: ${unit.duration_weeks || 6} weeks
- Global Context: ${unit.global_context || "Not specified"}
- Key Concept: ${unit.key_concept || "Not specified"}

## Suggested Activities for Criterion ${criterion}
${activitySuggestions}

${instruction ? `## Teacher Instructions\n${instruction}\n` : ""}
Generate JSON for ONLY this one page. Use the key "${pageId}" in the pages object.
Remember to include ELL scaffolding (ell1, ell2, ell3) for every section.`;

    const rawPages = await provider.generateCriterionPages(
      criterion,
      // Minimal wizard input — the provider just passes it through
      {
        title: unit.title,
        topic: unit.topic || "",
        gradeLevel: unit.grade_level || "Year 3 (Grade 8)",
        durationWeeks: unit.duration_weeks || 6,
        globalContext: unit.global_context || "",
        keyConcept: unit.key_concept || "",
        relatedConcepts: [],
        statementOfInquiry: "",
        selectedCriteria: [criterion],
        criteriaFocus: { [criterion]: "standard" } as Partial<Record<CriterionKey, "standard" | "emphasis" | "light">>,
        atlSkills: [],
        specificSkills: [],
        resourceUrls: [],
        specialRequirements: instruction || "",
        unitType,
      },
      systemPrompt,
      userPrompt
    );

    const validation = validateGeneratedPages(rawPages);
    let page = validation.pages[pageId];

    if (!page) {
      return NextResponse.json(
        {
          error: "AI did not generate the requested page. Please try again.",
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    // Timing validation — Workshop Model auto-repair
    let timingValidation: unknown = undefined;
    try {
      const gradeLevel = unit.grade_level || "Year 3 (Grade 8)";
      const profile = getGradeTimingProfile(gradeLevel, framework);
      const timingCtx = buildTimingContext(profile, 60, false);
      const result = validateLessonTiming(
        page as Parameters<typeof validateLessonTiming>[0],
        profile,
        timingCtx
      );
      if (result.issues.length > 0) {
        const repairedPage = page as unknown as Record<string, unknown>;
        repairedPage.workshopPhases = result.repairedLesson.workshopPhases;
        repairedPage.extensions = result.repairedLesson.extensions;
        timingValidation = { issues: result.issues, stats: result.stats };
      }
    } catch {
      // Timing validation is enhancement, not requirement
    }

    // --- Lesson Pulse scoring ---
    let pulseScore = null;
    try {
      const sections = (page as unknown as { sections?: unknown[] })?.sections;
      if (Array.isArray(sections) && sections.length > 0) {
        pulseScore = computeLessonPulse(sections as PulseActivity[]);
      }
    } catch {
      // Pulse scoring is enhancement, not requirement
    }

    // ── Activity Block usage tracking (Dimensions2) ──
    try {
      const { recordBlockUsageFromPages } = await import("@/lib/activity-blocks");
      const { createAdminClient } = await import("@/lib/supabase/admin");
      await recordBlockUsageFromPages(createAdminClient(), [page as { sections?: Array<{ source_block_id?: string | null }> }]);
    } catch {
      // Block usage tracking is enhancement, not requirement
    }

    return NextResponse.json({
      page,
      pageId,
      warnings: validation.errors,
      timingValidation,
      pulseScore,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Regeneration failed: ${message}` },
      { status: 500 }
    );
  }
}
