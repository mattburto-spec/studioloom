// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { buildAutoconfigSystemPrompt, buildAutoConfigPrompt } from "@/lib/ai/prompts";
import {
  MYP_GLOBAL_CONTEXTS,
  MYP_KEY_CONCEPTS,
  MYP_RELATED_CONCEPTS_DESIGN,
  DESIGN_SKILLS,
  MYP_ATL_SKILL_CATEGORIES,
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

// Case-insensitive validation maps
const gcMap = new Map<string, string>(MYP_GLOBAL_CONTEXTS.map((gc) => [gc.label.toLowerCase(), gc.label]));
const kcMap = new Map<string, string>((MYP_KEY_CONCEPTS as readonly string[]).map((k) => [k.toLowerCase(), k]));
const rcMap = new Map<string, string>((MYP_RELATED_CONCEPTS_DESIGN as readonly string[]).map((r) => [r.toLowerCase(), r]));
const dsMap = new Map<string, string>((DESIGN_SKILLS as readonly string[]).map((s) => [s.toLowerCase(), s]));
const atlSkills = MYP_ATL_SKILL_CATEGORIES.flatMap((cat) => cat.skills);
const atlMap = new Map<string, string>(atlSkills.map((s) => [s.toLowerCase(), s]));

interface AutoConfigResponse {
  title?: string;
  topic?: string;
  globalContext?: string;
  keyConcept?: string;
  relatedConcepts?: string[];
  statementOfInquiry?: string;
  criteriaFocus?: Record<string, string>;
  atlSkills?: string[];
  specificSkills?: string[];
}

function validateConfig(raw: Record<string, unknown>): AutoConfigResponse {
  const result: AutoConfigResponse = {};

  if (typeof raw.title === "string" && raw.title.trim()) {
    result.title = raw.title.trim();
  }

  if (typeof raw.topic === "string" && raw.topic.trim()) {
    result.topic = raw.topic.trim();
  }

  if (typeof raw.globalContext === "string") {
    const match = gcMap.get(raw.globalContext.toLowerCase());
    if (match) result.globalContext = match;
  }

  if (typeof raw.keyConcept === "string") {
    const match = kcMap.get(raw.keyConcept.toLowerCase());
    if (match) result.keyConcept = match;
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

  if (raw.criteriaFocus && typeof raw.criteriaFocus === "object") {
    const cf = raw.criteriaFocus as Record<string, string>;
    const validValues = ["light", "standard", "emphasis"];
    const validated: Record<string, string> = {};
    // Validate criteria focus values for whatever criteria keys the AI returned
    // (still defaults to A/B/C/D for Design, but accepts any keys for other types)
    for (const key of Object.keys(cf)) {
      const val = cf[key]?.toLowerCase();
      validated[key] = validValues.includes(val || "") ? val! : "standard";
    }
    result.criteriaFocus = validated;
  }

  if (Array.isArray(raw.atlSkills)) {
    result.atlSkills = (raw.atlSkills as string[])
      .map((v) => atlMap.get(v.toLowerCase()))
      .filter((v): v is string => !!v);
    if (result.atlSkills.length === 0) delete result.atlSkills;
  }

  if (Array.isArray(raw.specificSkills)) {
    result.specificSkills = (raw.specificSkills as string[])
      .map((v) => dsMap.get(v.toLowerCase()))
      .filter((v): v is string => !!v);
    if (result.specificSkills.length === 0) delete result.specificSkills;
  }

  return result;
}

/**
 * POST /api/teacher/wizard-autoconfig
 * "Build for Me" mode — AI fills all MYP framework fields at once.
 * Body: { goalText: string, gradeLevel: string, durationWeeks: number, keywords: string[] }
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
  const { goalText, gradeLevel, durationWeeks, keywords, unitType, framework } = body as {
    goalText: string;
    gradeLevel: string;
    durationWeeks: number;
    keywords: string[];
    unitType?: string;
    framework?: string;
  };

  if (!goalText?.trim()) {
    return NextResponse.json({ error: "goalText is required" }, { status: 400 });
  }

  const creds = await resolveCredentials(supabase, user.id);

  if (!creds) {
    return NextResponse.json({ config: {}, warning: "No AI credentials configured" });
  }

  try {
    const userPrompt = buildAutoConfigPrompt(goalText, gradeLevel || "Year 3 (Grade 8)", durationWeeks || 6, keywords || []);
    let systemPrompt = buildAutoconfigSystemPrompt(framework) + "\n\nReturn ONLY valid JSON. No markdown fences, no explanations.";

    // Add unit type context to emphasis suggestions
    if (unitType && unitType !== "design") {
      const typeEmphasisContext = {
        service: "This is a SERVICE LEARNING unit. Emphasis levels should reflect that service units need strong reflection and ethical reasoning. Consider emphasizing criteria that assess community engagement, ethical thinking, and impact documentation.",
        personal_project: "This is a PERSONAL PROJECT unit. Emphasis levels should reflect that PP units focus on ATL skill development and process. Consider emphasizing criteria that assess process documentation and self-management.",
        inquiry: "This is an INQUIRY unit. Emphasis levels should reflect that inquiry units focus on evidence-based thinking and conceptual understanding. Consider emphasizing criteria that assess research quality and thinking skills.",
      }[unitType as string];

      if (typeEmphasisContext) {
        systemPrompt += `\n\n${typeEmphasisContext}`;
      }
    }

    let responseText: string;

    if (creds.provider === "anthropic") {
      const client = new Anthropic({ apiKey: creds.apiKey, maxRetries: 1 });
      const response = await client.messages.create({
        model: creds.modelName,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 500,
        temperature: 0.3,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      responseText = textBlock?.type === "text" ? textBlock.text : "";
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
          max_tokens: 500,
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
    const config = validateConfig(parsed);

    return NextResponse.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ config: {}, warning: message });
  }
}
