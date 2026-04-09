import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { buildSuggestSystemPrompt, buildSuggestPrompt } from "@/lib/ai/prompts";
import type { SuggestContext } from "@/lib/ai/prompts";
import {
  MYP_GLOBAL_CONTEXTS,
  MYP_KEY_CONCEPTS,
  MYP_RELATED_CONCEPTS_DESIGN,
} from "@/lib/constants";

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

// Valid value maps for case-insensitive server-side validation
// Maps lowercase → exact canonical value so AI responses with wrong casing still match
const gcMap = new Map<string, string>(MYP_GLOBAL_CONTEXTS.map((gc) => [gc.label.toLowerCase(), gc.label]));
const kcMap = new Map<string, string>((MYP_KEY_CONCEPTS as readonly string[]).map((k) => [k.toLowerCase(), k]));
const rcMap = new Map<string, string>((MYP_RELATED_CONCEPTS_DESIGN as readonly string[]).map((r) => [r.toLowerCase(), r]));

interface SuggestResponse {
  globalContext?: string[];
  keyConcept?: string[];
  relatedConcepts?: string[];
  statementOfInquiry?: string;
  criteriaEmphasis?: { criterion: string; direction: string; reason: string }[];
  // Broad suggestion categories (free-form, AI-generated)
  activities?: string[];
  tools?: string[];
  groupwork?: string[];
  resources?: string[];
}

/** Sanitize a free-form string array — trim, dedupe, cap length */
function sanitizeStringArray(arr: unknown, maxItems = 4, maxLen = 60): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim().slice(0, maxLen);
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    result.push(trimmed);
    if (result.length >= maxItems) break;
  }
  return result.length > 0 ? result : undefined;
}

function validateSuggestions(raw: Record<string, unknown>): SuggestResponse {
  const result: SuggestResponse = {};

  if (Array.isArray(raw.globalContext)) {
    result.globalContext = (raw.globalContext as string[])
      .map((v) => gcMap.get(v.toLowerCase()))
      .filter((v): v is string => !!v);
    if (result.globalContext.length === 0) delete result.globalContext;
  }

  if (Array.isArray(raw.keyConcept)) {
    result.keyConcept = (raw.keyConcept as string[])
      .map((v) => kcMap.get(v.toLowerCase()))
      .filter((v): v is string => !!v);
    if (result.keyConcept.length === 0) delete result.keyConcept;
  }

  if (Array.isArray(raw.relatedConcepts)) {
    result.relatedConcepts = (raw.relatedConcepts as string[])
      .map((v) => rcMap.get(v.toLowerCase()))
      .filter((v): v is string => !!v);
    if (result.relatedConcepts.length === 0) delete result.relatedConcepts;
  }

  if (typeof raw.statementOfInquiry === "string" && raw.statementOfInquiry.trim()) {
    result.statementOfInquiry = raw.statementOfInquiry.trim();
  }

  if (Array.isArray(raw.criteriaEmphasis)) {
    // Accept any criterion key (not just A/B/C/D) — other unit types have different criteria
    result.criteriaEmphasis = (raw.criteriaEmphasis as SuggestResponse["criteriaEmphasis"])?.filter(
      (e) =>
        typeof e?.criterion === "string" && e.criterion.length > 0 &&
        ["emphasis", "light"].includes(e?.direction)
    );
    if (result.criteriaEmphasis && result.criteriaEmphasis.length === 0) delete result.criteriaEmphasis;
  }

  // Free-form suggestion categories (AI-generated, sanitized)
  result.activities = sanitizeStringArray(raw.activities, 3);
  result.tools = sanitizeStringArray(raw.tools, 3);
  result.groupwork = sanitizeStringArray(raw.groupwork, 2);
  result.resources = sanitizeStringArray(raw.resources, 2);

  return result;
}

/**
 * POST /api/teacher/wizard-suggest
 * Lightweight, fast AI suggestion endpoint for the wizard.
 * Uses teacher's own key if configured, otherwise falls back to platform key.
 * Body: { tier: 1|2|3, context: SuggestContext }
 */
// Un-quarantined (9 Apr 2026) — Dimensions3 pipeline complete, wizard routes restored.

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tier, context, unitType, framework } = body as { tier: 1 | 2 | 3; context: SuggestContext; unitType?: string; framework?: string };

  if (!tier || !context?.topic) {
    return NextResponse.json({ error: "tier and context.topic are required" }, { status: 400 });
  }

  // Resolve AI credentials (teacher key → platform key fallback)
  const creds = await resolveCredentials(supabase, user.id);

  if (!creds) {
    // No AI available at all — return empty suggestions silently
    return NextResponse.json({ suggestions: {}, tier });
  }

  try {
    const userPrompt = buildSuggestPrompt(tier, context);
    let systemPrompt = buildSuggestSystemPrompt(framework) + "\n\nReturn ONLY valid JSON. No markdown fences, no explanations.";

    // Add unit type context to suggestions
    if (unitType) {
      const typeContext = {
        design: "This is a DESIGN unit. Suggest design tools, materials, techniques, processes, and making activities relevant to this project.",
        service: "This is a SERVICE LEARNING unit. Suggest community contexts, stakeholder types, ethical considerations, documentation methods, reflection frameworks, and impact assessment approaches.",
        personal_project: "This is a PERSONAL PROJECT unit. Suggest research methods, skill-building approaches, presentation formats, ATL skill applications, and process journal strategies.",
        inquiry: "This is an INQUIRY unit. Suggest inquiry questions, exploration methods, thinking routines (See-Think-Wonder, Claim-Support-Question, etc.), evidence-gathering approaches, and authentic sharing formats.",
      }[unitType as string];

      if (typeContext) {
        systemPrompt += `\n\n${typeContext}`;
      }
    }

    let responseText: string;

    if (creds.provider === "anthropic") {
      const client = new Anthropic({ apiKey: creds.apiKey, maxRetries: 1 });
      // Try Haiku first (much faster ~1-2s), fall back to teacher's model if unavailable
      const haikuModel = "claude-3-5-haiku-latest";
      let usedModel = haikuModel;

      let response;
      try {
        response = await client.messages.create({
          model: haikuModel,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          max_tokens: tier === 1 ? 500 : 300,
          temperature: 0.3,
        });
      } catch (haikuErr) {
        // Haiku unavailable — fall back to teacher's configured model
        console.log(`[wizard-suggest] Haiku unavailable (${(haikuErr as Error).message?.slice(0, 80)}), falling back to ${creds.modelName}`);
        usedModel = creds.modelName;
        response = await client.messages.create({
          model: creds.modelName,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          max_tokens: tier === 1 ? 500 : 300,
          temperature: 0.3,
        });
      }

      const textBlock = response.content.find((b) => b.type === "text");
      responseText = textBlock?.type === "text" ? textBlock.text : "";
      console.log(`[wizard-suggest] Used model: ${usedModel}`);
    } else {
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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`AI API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      responseText = data.choices?.[0]?.message?.content || "";
    }

    // Parse and validate
    const cleaned = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const suggestions = validateSuggestions(parsed);
    const keyCount = Object.values(suggestions).flat().length;
    console.log(`[wizard-suggest] tier=${tier} keys=${keyCount}`);

    return NextResponse.json({ suggestions, tier });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[wizard-suggest] Error:", message);
    // Suggestions are non-blocking — return empty rather than error
    return NextResponse.json({ suggestions: {}, tier, warning: message });
  }
}
