// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { getActivityCardById } from "@/lib/activity-cards";
import type { CardTemplate, CardAIHints, ModifierAxis } from "@/types/activity-cards";
import type { ActivityCardApplyRequest } from "@/types/activity-cards";
import { requireTeacher } from "@/lib/auth/require-teacher";

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
 * POST /api/teacher/activity-cards/apply
 *
 * Adapts an activity card using AI based on:
 *  - Selected modifier values
 *  - Optional custom prompt
 *  - Unit context (topic, criterion, adjacent pages, etc.)
 *
 * Returns adapted sections ready for insertion into a unit page.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const supabase = createSupabaseServer(request);

  const body: ActivityCardApplyRequest = await request.json();
  const { cardId, modifiers, customPrompt, context } = body;

  if (!cardId) {
    return NextResponse.json(
      { error: "cardId is required" },
      { status: 400 }
    );
  }

  // Fetch the card
  const card = await getActivityCardById(cardId);
  if (!card) {
    return NextResponse.json(
      { error: "Activity card not found" },
      { status: 404 }
    );
  }

  const template = card.template as CardTemplate;
  const aiHints = card.ai_hints as CardAIHints;

  // Resolve AI credentials
  const credentials = await resolveCredentials(supabase, teacherId);
  if (!credentials) {
    return NextResponse.json(
      { error: "No AI provider configured. Set up AI settings or contact your administrator." },
      { status: 400 }
    );
  }

  const provider = createAIProvider(credentials.provider, {
    apiEndpoint: credentials.apiEndpoint,
    apiKey: credentials.apiKey,
    modelName: credentials.modelName,
  });

  // Build the adaptation prompt
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(card.name, template, aiHints, modifiers, customPrompt, context);

  // Call AI to adapt
  let responseText: string;
  try {
    if (provider.generateText) {
      responseText = await provider.generateText(systemPrompt, userPrompt, {
        maxTokens: 4096,
        temperature: 0.7,
      });
    } else {
      // Fallback: use the page generation method and extract
      return NextResponse.json(
        { error: "AI provider does not support text generation" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[apply] AI generation failed:", err);
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 }
    );
  }

  // Parse the response
  try {
    const parsed = parseAdaptedSections(responseText);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[apply] Parse error:", err);
    // Return original template as fallback
    return NextResponse.json({
      sections: template.sections,
      vocabTerms: template.vocabTerms || [],
      reflection: template.reflection || null,
      adaptationNotes: "AI adaptation failed — original template returned as fallback.",
    });
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `You are an expert design education specialist. Your task is to adapt an activity card template for use in a specific unit context.

You must return valid JSON with this exact structure:
{
  "sections": [
    {
      "prompt": "The adapted activity prompt text",
      "scaffolding": {
        "ell1": { "sentenceStarters": ["..."], "hints": ["..."] },
        "ell2": { "sentenceStarters": ["..."] },
        "ell3": { "extensionPrompts": ["..."] }
      },
      "responseType": "text|upload|voice|link|multi|decision-matrix|pmi|pairwise|trade-off-sliders",
      "exampleResponse": "Optional example of a good student response"
    }
  ],
  "vocabTerms": [
    { "term": "...", "definition": "...", "example": "..." }
  ],
  "reflection": {
    "type": "confidence-slider|checklist|short-response",
    "items": ["..."]
  },
  "adaptationNotes": "Brief note on what was adapted and why"
}

Rules:
- Preserve the core structure and pedagogy of the original activity
- Adapt prompts, examples, and scaffolding to the specific topic and context
- Keep ELL scaffolding at all three levels
- Maintain appropriate response types
- Make adaptations meaningful — don't just find-and-replace words
- If modifier axes are applied, weave their promptDelta instructions into the adapted activity naturally
- Return ONLY the JSON — no markdown fences, no explanatory text`;
}

function buildUserPrompt(
  name: string,
  template: CardTemplate,
  aiHints: CardAIHints,
  modifiers?: Record<string, string | boolean>,
  customPrompt?: string,
  context?: ActivityCardApplyRequest["context"]
): string {
  const parts: string[] = [];

  parts.push(`## Activity: ${name}\n`);
  parts.push(`## Original Template\n\`\`\`json\n${JSON.stringify(template, null, 2)}\n\`\`\`\n`);
  parts.push(`## Adaptation Guidance\n${aiHints.topicAdaptation}\n`);

  // Apply modifier deltas
  if (modifiers && aiHints.modifierAxes) {
    const modifierInstructions: string[] = [];
    for (const axis of aiHints.modifierAxes) {
      const selected = modifiers[axis.id];
      if (selected === undefined) continue;

      if (axis.type === "toggle") {
        if (selected) {
          // Toggle is on — find the promptDelta if options exist, or just note it
          modifierInstructions.push(`[${axis.label}]: Enabled — ${axis.description}`);
        }
      } else if (axis.type === "select" && axis.options) {
        const option = axis.options.find((o: ModifierAxis["options"] extends (infer U)[] | undefined ? U : never) => (o as { value: string }).value === selected);
        if (option && typeof option === "object" && "promptDelta" in option) {
          modifierInstructions.push(`[${axis.label}]: ${(option as { promptDelta: string }).promptDelta}`);
        }
      }
    }

    if (modifierInstructions.length > 0) {
      parts.push(`## Modifier Instructions\n${modifierInstructions.join("\n")}\n`);
    }
  }

  // Add custom prompt
  if (customPrompt) {
    parts.push(`## Teacher's Custom Request\n${customPrompt}\n`);
  }

  // Add unit context
  if (context) {
    const contextParts: string[] = [];
    if (context.unitTopic) contextParts.push(`Unit topic: ${context.unitTopic}`);
    if (context.gradeLevel) contextParts.push(`Grade level: ${context.gradeLevel}`);
    if (context.criterion) contextParts.push(`Assessment criterion: ${context.criterion}`);
    if (context.pageLearningGoal) contextParts.push(`Page learning goal: ${context.pageLearningGoal}`);
    if (context.adjacentPageTitles?.length) {
      contextParts.push(`Adjacent pages: ${context.adjacentPageTitles.join(", ")}`);
    }

    if (contextParts.length > 0) {
      parts.push(`## Unit Context\n${contextParts.join("\n")}\n`);
    }
  }

  parts.push(`Adapt the activity template based on all the information above. Return only the JSON.`);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseAdaptedSections(text: string): {
  sections: unknown[];
  vocabTerms?: unknown[];
  reflection?: unknown;
  adaptationNotes?: string;
} {
  // Try to extract JSON from the response
  let jsonStr = text.trim();

  // Remove markdown fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  if (!parsed.sections || !Array.isArray(parsed.sections)) {
    throw new Error("Response missing 'sections' array");
  }

  return {
    sections: parsed.sections,
    vocabTerms: parsed.vocabTerms || [],
    reflection: parsed.reflection || null,
    adaptationNotes: parsed.adaptationNotes || null,
  };
}
