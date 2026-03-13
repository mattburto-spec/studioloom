import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";

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
 * POST /api/teacher/activity-cards/generate-modifiers
 *
 * AI-generates card-specific modifier axes for a new or existing activity card.
 * Used during seed and when teachers create custom cards.
 *
 * Body: { name, description, template }
 * Returns: { modifierAxes: ModifierAxis[] }
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
  const { name, description, template } = body;

  if (!name || !description) {
    return NextResponse.json(
      { error: "name and description are required" },
      { status: 400 }
    );
  }

  // Resolve AI credentials
  const credentials = await resolveCredentials(supabase, user.id);
  if (!credentials) {
    return NextResponse.json(
      { error: "No AI provider configured" },
      { status: 400 }
    );
  }

  const provider = createAIProvider(credentials.provider, {
    apiEndpoint: credentials.apiEndpoint,
    apiKey: credentials.apiKey,
    modelName: credentials.modelName,
  });

  const systemPrompt = `You are an expert design education specialist. Your task is to generate meaningful "modifier axes" for a design thinking activity card.

Modifier axes let teachers customise how an activity is run without changing its core pedagogy. Each axis represents one dimension of variation — for example, "Working Medium" (written vs sketched vs digital) or "Collaboration Style" (solo vs pairs vs group rotation).

CRITICAL: Modifiers must be SPECIFIC to this particular activity. Do NOT generate generic axes like "difficulty level" or "time allocated". Instead, think about what a Design teacher would actually want to vary when running this specific activity.

Return valid JSON with this exact structure:
{
  "modifierAxes": [
    {
      "id": "kebab-case-id",
      "label": "Short Label (2-4 words)",
      "description": "One sentence describing what this axis controls",
      "type": "select",
      "options": [
        {
          "value": "kebab-case-value",
          "label": "Short label (2-4 words)",
          "promptDelta": "1-2 sentences describing how to adapt the activity when this option is selected. This text will be injected into an AI prompt that adapts the activity template."
        }
      ],
      "default": "kebab-case-value-of-default"
    }
  ]
}

Rules:
- Generate 2-3 axes maximum
- Each axis should have 2-4 options (for "select" type) or use "toggle" type for on/off
- Options must be mutually exclusive within an axis
- promptDelta should be an instruction to the AI, not a description to the teacher
- Make modifiers pedagogically meaningful — they should change HOW the activity runs
- Return ONLY the JSON — no markdown fences, no explanatory text`;

  const userPrompt = `Generate modifier axes for this activity card:

**Name:** ${name}
**Description:** ${description}
${template ? `**Template sections:**\n${JSON.stringify(template.sections?.slice(0, 2), null, 2)}` : ""}

Think about what a Design teacher would want to vary when running this specific activity. Consider:
- How students record/present their work (medium)
- How students collaborate (individual, pairs, groups)
- Where the input data comes from (teacher-provided, student-generated, peer-sourced)
- How deep or detailed the activity goes
- What format the output takes

Generate 2-3 axes that are highly specific to "${name}".`;

  try {
    let responseText: string;
    if (provider.generateText) {
      responseText = await provider.generateText(systemPrompt, userPrompt, {
        maxTokens: 2048,
        temperature: 0.7,
      });
    } else {
      return NextResponse.json(
        { error: "AI provider does not support text generation" },
        { status: 500 }
      );
    }

    // Parse response
    let jsonStr = responseText.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.modifierAxes || !Array.isArray(parsed.modifierAxes)) {
      throw new Error("Response missing 'modifierAxes' array");
    }

    return NextResponse.json({ modifierAxes: parsed.modifierAxes });
  } catch (err) {
    console.error("[generate-modifiers] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate modifiers" },
      { status: 500 }
    );
  }
}
