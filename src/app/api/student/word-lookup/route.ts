// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupSandbox } from "@/lib/ai/sandbox/word-lookup-sandbox";
import { MODELS } from "@/lib/ai/models";
import { l1DisplayLabel, type L1Target } from "@/lib/tap-a-word/language-mapping";
import { resolveStudentSettings } from "@/lib/student-support/resolve-settings";
import { resolveStudentClassId } from "@/lib/student-support/resolve-class-id";
import { withAIBudget } from "@/lib/access-v2/ai-budget/middleware";

/**
 * POST /api/student/word-lookup
 *
 * Body: { word: string, contextSentence?: string }
 * Returns: { definition: string, exampleSentence: string | null, l1Translation: string | null, l1Target: 'en'|'zh'|'ko'|'ja'|'es'|'fr' }
 *
 * Resolution path:
 *   1. requireStudentSession (Supabase Auth via sb-* cookies)
 *   2. Validate word (2–50 chars, lowercased + trimmed)
 *   3. Resolve l1Target SERVER-SIDE from `students.learning_profile.languages_at_home[0]`
 *      via `resolveL1Target` mapping. Defaults to 'en' (no translation slot).
 *      Server-derived (not body-derived) for security: client can't spoof their L1.
 *   4. Cache lookup in word_definitions keyed on (word, language='en', context_hash='', l1_target)
 *   5. On cache hit: return cached definition + l1_translation (may be NULL if l1_target='en')
 *   6. On cache miss in tests (NODE_ENV='test' AND RUN_E2E !== '1'): sandbox lookup,
 *      RETURNS only — does NOT upsert (Lesson #57 / FU-TAP-SANDBOX-POLLUTION resolved)
 *   7. On cache miss in dev/prod (or RUN_E2E=1 in tests): live Anthropic Haiku 4.5 call.
 *      Tool schema dynamically includes `l1_translation` field iff l1_target !== 'en'.
 *      max_tokens: 250 (en-only) or 400 (with translation).
 *      Lesson #39 stop_reason guard + defensive destructure on every required field.
 *      Upserts the resulting (definition, example, l1_translation) row to the shared cache.
 *
 * The cache is shared across all students (definitions are public-domain content).
 * Phase 1 cache rows have l1_target='en' and l1_translation=NULL — backward-compatible
 * for English-only students.
 *
 * Phase 2A SCOPE: definition + example + L1 translation. Audio (browser TTS) and
 * image (static dictionary) land in Phase 2B/2C and are pure client-side.
 */

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };
const MAX_TOKENS_EN_ONLY = 250;
const MAX_TOKENS_WITH_L1 = 400;
const MODEL = MODELS.HAIKU;
const TOOL_NAME = "word_definition";

interface WordLookupBody {
  word?: unknown;
  contextSentence?: unknown;
  /** Phase 2.5: optional class context for per-class override resolution. */
  classId?: unknown;
  /**
   * Bug 2: optional unit context. When the caller is on a lesson page they
   * usually know the unitId but not the classId — server derives the
   * (verified) classId via class_units × class_students. classId wins over
   * unitId when both are sent (caller was specific).
   */
  unitId?: unknown;
}

export async function POST(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if (auth instanceof NextResponse) return auth;

  let body: WordLookupBody | null = null;
  try {
    body = (await request.json()) as WordLookupBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400, headers: CACHE_HEADERS });
  }

  const rawWord = typeof body?.word === "string" ? body.word.trim().toLowerCase() : "";
  const contextSentence =
    typeof body?.contextSentence === "string" ? body.contextSentence.trim().slice(0, 500) : "";
  const rawClassId = typeof body?.classId === "string" ? body.classId : undefined;
  const rawUnitId = typeof body?.unitId === "string" ? body.unitId : undefined;

  if (!rawWord || rawWord.length < 2 || rawWord.length > 50) {
    return NextResponse.json(
      { error: "word must be 2–50 chars" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  // Bug 2: server-derive classId from (classId | unitId) so per-class
  // overrides apply correctly even when the client only knows the unit.
  // Returns undefined when neither input resolves to an enrollment — the
  // resolver then falls back to per-student + intake + default.
  const classId = await resolveStudentClassId({
    studentId: auth.studentId,
    classId: rawClassId,
    unitId: rawUnitId,
  });

  // Phase 2.5: resolver walks the override precedence chain
  // (class > student > intake > default) and returns both l1Target +
  // tapAWordEnabled. Replaces the direct learning_profile read.
  const settings = await resolveStudentSettings(auth.studentId, classId);
  const l1Target: L1Target = settings.l1Target;

  // Phase 2.5 server-side gate (defensive — UI gates first via
  // useStudentSupportSettings, but server is source of truth in case the
  // client check is bypassed).
  if (!settings.tapAWordEnabled) {
    return NextResponse.json(
      { disabled: true, l1Target, reason: settings.tapASource },
      { status: 200, headers: CACHE_HEADERS }
    );
  }

  const supabase = createAdminClient();

  // Cache lookup keyed on the resolved l1_target.
  // Phase 1 rows are l1_target='en' / l1_translation=NULL — those serve English-only students.
  // Phase 2 introduces non-'en' rows with populated l1_translation.
  const { data: cached } = await supabase
    .from("word_definitions")
    .select("definition, example_sentence, l1_translation")
    .eq("word", rawWord)
    .eq("language", "en")
    .eq("context_hash", "")
    .eq("l1_target", l1Target)
    .maybeSingle();

  if (cached) {
    return NextResponse.json(
      {
        definition: cached.definition,
        exampleSentence: cached.example_sentence ?? null,
        l1Translation: cached.l1_translation ?? null,
        l1Target,
      },
      { headers: CACHE_HEADERS }
    );
  }

  // Sandbox bypass: ONLY in vitest unit tests. See Lesson #56 (gate design)
  // and Lesson #57 (sandbox is read-only — no upsert here, FU resolved).
  if (process.env.NODE_ENV === "test" && process.env.RUN_E2E !== "1") {
    const sandbox = lookupSandbox(rawWord, l1Target);
    return NextResponse.json(
      {
        definition: sandbox.definition,
        exampleSentence: sandbox.example,
        l1Translation: sandbox.l1Translation,
        l1Target,
      },
      { headers: CACHE_HEADERS }
    );
  }

  // Live Anthropic path (default in dev + prod; gated to RUN_E2E=1 in tests).
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  // Dynamic tool schema (Lesson #26: compact required fields ordered first).
  // L1 translation field added only when target ≠ 'en' — cleaner than asking
  // the model to leave a field empty.
  const wantsL1 = l1Target !== "en";
  const properties: Record<string, { type: string; description: string }> = {
    definition: {
      type: "string",
      description:
        "One short sentence in plain language a 12-year-old understands. Max 20 words.",
    },
    example: {
      type: "string",
      description: "One sentence using the word naturally. Max 20 words.",
    },
  };
  const required: string[] = ["definition", "example"];
  if (wantsL1) {
    properties.l1_translation = {
      type: "string",
      description: `The single-word ${l1DisplayLabel(l1Target)} translation of "${rawWord}" (no parenthetical alternatives, no romanisation, just the native-script translation).`,
    };
    required.push("l1_translation");
  }

  const tool: Anthropic.Tool = {
    name: TOOL_NAME,
    description:
      "Return a student-friendly definition + example sentence for an English word" +
      (wantsL1 ? `, plus a ${l1DisplayLabel(l1Target)} translation.` : "."),
    input_schema: {
      type: "object" as const,
      properties,
      required,
    },
  };

  const userPrompt =
    `Define the word "${rawWord}" for a secondary-school student in design class. ` +
    (contextSentence ? `It appeared in this sentence: "${contextSentence}". ` : "") +
    `Give the definition that fits this context, then a short example sentence.` +
    (wantsL1
      ? ` Also provide the ${l1DisplayLabel(l1Target)} translation of the word "${rawWord}" itself (single word, native script).`
      : "");

  const maxTokens = wantsL1 ? MAX_TOKENS_WITH_L1 : MAX_TOKENS_EN_ONLY;

  // Phase 5.3 — wrap the Anthropic call in withAIBudget. Budget cap is
  // resolved via the cascade (student > class > school > column > tier);
  // truncation (Lesson #39) is handled by the wrapper without billing.
  const budgetResult = await withAIBudget(supabase, auth.studentId, async () => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      tools: [tool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: userPrompt }],
    });
    return {
      result: response,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        stop_reason: response.stop_reason ?? "end_turn",
      },
    };
  });

  if (!budgetResult.ok) {
    if (budgetResult.reason === "over_cap") {
      return NextResponse.json(
        {
          error: "budget_exceeded",
          cap: budgetResult.cap,
          used: budgetResult.used,
          reset_at: budgetResult.resetAt,
        },
        { status: 429, headers: CACHE_HEADERS }
      );
    }
    // 'truncated' — model hit max_tokens. Return 502 (Lesson #39 — don't bill, surface).
    return NextResponse.json(
      {
        error: "model_truncated",
        message: `Anthropic truncated at max_tokens=${maxTokens} (model=${MODEL}, tool=${TOOL_NAME}, word="${rawWord}", l1Target=${l1Target}). Bump MAX_TOKENS or shorten input.`,
      },
      { status: 502, headers: CACHE_HEADERS }
    );
  }

  const response = budgetResult.result;
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    return NextResponse.json(
      { error: "model did not return a tool_use block" },
      { status: 502, headers: CACHE_HEADERS }
    );
  }

  // Lesson #39 + #42: defensive destructure on every required field, even when
  // the schema marks them required. Schema enforcement is training-time, not runtime.
  const input = block.input as
    | { definition?: unknown; example?: unknown; l1_translation?: unknown }
    | null;
  const definition = typeof input?.definition === "string" ? input.definition : "";
  const example = typeof input?.example === "string" ? input.example : "";
  const l1Translation =
    wantsL1 && typeof input?.l1_translation === "string" ? input.l1_translation : null;

  if (!definition) {
    return NextResponse.json(
      { error: "model returned empty definition" },
      { status: 502, headers: CACHE_HEADERS }
    );
  }

  await supabase.from("word_definitions").upsert({
    word: rawWord,
    language: "en",
    context_hash: "",
    l1_target: l1Target,
    definition,
    example_sentence: example || null,
    l1_translation: l1Translation,
  });

  return NextResponse.json(
    {
      definition,
      exampleSentence: example || null,
      l1Translation,
      l1Target,
    },
    { headers: CACHE_HEADERS }
  );
}
