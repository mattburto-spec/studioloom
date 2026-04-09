import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { OUTLINE_SYSTEM_PROMPT, buildOutlinePrompt } from "@/lib/ai/prompts";
import { OUTLINE_GENERATION_TOOL } from "@/lib/ai/schemas";
import {
  retrieveContext,
  formatRetrievedContext,
} from "@/lib/knowledge/retrieve";
import {
  retrieveLessonProfiles,
  formatLessonProfiles,
  incrementProfileReferences,
} from "@/lib/knowledge/retrieve-lesson-profiles";
import type { UnitWizardInput } from "@/types";
import { buildPageDefinitions, getCriterionKeys } from "@/lib/constants";

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

export interface OutlineOption {
  approach: string;
  description: string;
  strengths: string[];
  pages: Record<string, { title: string; summary: string }>;
}

/**
 * POST /api/teacher/generate-outlines
 * Generate 3 distinct unit outline options for the teacher to choose from.
 * Uses tool use for structured output when Anthropic provider is active.
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
  const { wizardInput } = body as { wizardInput: UnitWizardInput };

  if (!wizardInput) {
    return NextResponse.json(
      { error: "wizardInput is required" },
      { status: 400 }
    );
  }

  // Resolve AI credentials (teacher key → platform key fallback)
  const creds = await resolveCredentials(supabase, user.id);

  if (!creds) {
    return NextResponse.json(
      { error: "AI provider not configured. Go to Settings to add your API key." },
      { status: 400 }
    );
  }

  try {
    // Retrieve RAG context + lesson profiles in parallel (both are optional enhancements)
    let ragContext = "";
    let lessonContext = "";
    const ragQuery = `${wizardInput.topic} ${wizardInput.title} MYP Design unit ${wizardInput.gradeLevel} ${wizardInput.globalContext}`;
    const profileQuery = `${wizardInput.topic} ${wizardInput.title} MYP Design ${wizardInput.gradeLevel}`;

    const [chunksResult, profilesResult] = await Promise.allSettled([
      retrieveContext({
        query: ragQuery,
        teacherId: user.id,
        includePublic: true,
        maxChunks: 8,
      }),
      retrieveLessonProfiles({
        query: profileQuery,
        gradeLevel: wizardInput.gradeLevel,
        teacherId: user.id,
        maxProfiles: 3,
      }),
    ]);

    if (chunksResult.status === "fulfilled" && chunksResult.value.length > 0) {
      ragContext = formatRetrievedContext(chunksResult.value);
    }
    if (profilesResult.status === "fulfilled" && profilesResult.value.length > 0) {
      lessonContext = formatLessonProfiles(profilesResult.value);
      incrementProfileReferences(profilesResult.value.map((p) => p.id)).catch(() => {});
    }

    // Build prompt — combine lesson profiles + chunk context, pass framework
    const combinedContext = [lessonContext, ragContext].filter(Boolean).join("\n\n---\n\n") || undefined;
    const framework = wizardInput.framework || "IB_MYP";
    const userPrompt = buildOutlinePrompt(wizardInput, combinedContext, wizardInput.curriculumContext, framework);

    // Create provider
    const provider = createAIProvider(creds.provider, {
      apiEndpoint: creds.apiEndpoint,
      apiKey: creds.apiKey,
      modelName: creds.modelName,
    });

    let options: OutlineOption[];

    // Use structured output (tool use) if provider supports it
    if (provider.generateOutlines) {
      const result = await provider.generateOutlines(
        OUTLINE_SYSTEM_PROMPT,
        userPrompt,
        OUTLINE_GENERATION_TOOL
      );
      options = (result.options as OutlineOption[]) || [];
    } else {
      // Fallback: text generation + JSON parse (for OpenAI-compatible providers)
      const endpoint = creds.apiEndpoint.replace(/\/+$/, "");
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          model: creds.modelName,
          messages: [
            { role: "system", content: OUTLINE_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.8,
          max_tokens: 6000,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`AI API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      const responseText = data.choices?.[0]?.message?.content || "";

      const cleaned = responseText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      options = parsed.options || [];
    }

    if (options.length === 0) {
      return NextResponse.json(
        { error: "AI did not generate any outline options." },
        { status: 422 }
      );
    }

    // Validate each option has enough pages (75% of expected total)
    const expectedTotal = buildPageDefinitions(
      wizardInput.selectedCriteria || getCriterionKeys(wizardInput.unitType || "design"),
      wizardInput.criteriaFocus || {},
      wizardInput.unitType || "design"
    ).length;
    const minPages = Math.ceil(expectedTotal * 0.75);
    const validOptions = options.filter(
      (opt) => opt.approach && opt.pages && Object.keys(opt.pages).length >= minPages
    );

    return NextResponse.json({ options: validOptions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Outline generation failed: ${message}` },
      { status: 500 }
    );
  }
}
