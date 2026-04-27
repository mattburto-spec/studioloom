import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupSandbox } from "@/lib/ai/sandbox/word-lookup-sandbox";
import { MODELS } from "@/lib/ai/models";

/**
 * POST /api/student/word-lookup
 *
 * Body: { word: string, contextSentence?: string }
 * Returns: { definition: string, exampleSentence: string | null }
 *
 * Resolution path:
 *   1. requireStudentAuth (token cookie → student_sessions)
 *   2. Validate word (2–50 chars, lowercased + trimmed)
 *   3. Cache lookup in word_definitions (Phase 1: language='en',
 *      context_hash='', l1_target='en')
 *   4. On cache miss + RUN_E2E !== "1": sandbox lookup, upsert, return
 *   5. On cache miss + RUN_E2E === "1": live Anthropic Haiku 4.5 call
 *      with Lesson #39 stop_reason guard + defensive destructure
 *
 * The cache is shared across all students (no PII in definitions).
 *
 * Phase 1 SCOPE: definition + example only. L1 translation, audio, image
 * land in Phase 2.
 */

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };
const MAX_TOKENS = 250;
const MODEL = MODELS.HAIKU;
const TOOL_NAME = "word_definition";

interface WordLookupBody {
  word?: unknown;
  contextSentence?: unknown;
}

export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  let body: WordLookupBody | null = null;
  try {
    body = (await request.json()) as WordLookupBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400, headers: CACHE_HEADERS });
  }

  const rawWord = typeof body?.word === "string" ? body.word.trim().toLowerCase() : "";
  const contextSentence =
    typeof body?.contextSentence === "string" ? body.contextSentence.trim().slice(0, 500) : "";

  if (!rawWord || rawWord.length < 2 || rawWord.length > 50) {
    return NextResponse.json(
      { error: "word must be 2–50 chars" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const supabase = createAdminClient();

  // Phase 1 cache key: word + 'en' + '' + 'en'
  const { data: cached } = await supabase
    .from("word_definitions")
    .select("definition, example_sentence")
    .eq("word", rawWord)
    .eq("language", "en")
    .eq("context_hash", "")
    .eq("l1_target", "en")
    .maybeSingle();

  if (cached) {
    return NextResponse.json(
      {
        definition: cached.definition,
        exampleSentence: cached.example_sentence ?? null,
      },
      { headers: CACHE_HEADERS }
    );
  }

  // Sandbox bypass: unit tests + dev runs do NOT consume the API key.
  if (process.env.RUN_E2E !== "1") {
    const sandbox = lookupSandbox(rawWord);
    await supabase.from("word_definitions").upsert({
      word: rawWord,
      language: "en",
      context_hash: "",
      l1_target: "en",
      definition: sandbox.definition,
      example_sentence: sandbox.example,
    });
    return NextResponse.json(
      { definition: sandbox.definition, exampleSentence: sandbox.example },
      { headers: CACHE_HEADERS }
    );
  }

  // Live Anthropic path (RUN_E2E=1 only — Phase 5 E2E gate exercises this).
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  // Lesson #26: compact required fields ordered first in tool schema.
  // Both fields are short (≤20 words each) — single-word inputs, low collision risk.
  const tool: Anthropic.Tool = {
    name: TOOL_NAME,
    description:
      "Return a student-friendly definition and an example sentence for an English word.",
    input_schema: {
      type: "object" as const,
      properties: {
        definition: {
          type: "string",
          description:
            "One short sentence in plain language a 12-year-old understands. Max 20 words.",
        },
        example: {
          type: "string",
          description: "One sentence using the word naturally. Max 20 words.",
        },
      },
      required: ["definition", "example"],
    },
  };

  const userPrompt =
    `Define the word "${rawWord}" for a secondary-school student in design class. ` +
    (contextSentence ? `It appeared in this sentence: "${contextSentence}". ` : "") +
    `Give the definition that fits this context, then a short example sentence.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: [tool],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: userPrompt }],
  });

  // Lesson #39: stop_reason guard immediately after create.
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `[/api/student/word-lookup] Anthropic truncated at max_tokens=${MAX_TOKENS} ` +
        `(output_tokens=${response.usage.output_tokens}, model=${MODEL}, tool=${TOOL_NAME}, word="${rawWord}"). ` +
        `Bump MAX_TOKENS or shorten input.`
    );
  }

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    return NextResponse.json(
      { error: "model did not return a tool_use block" },
      { status: 502, headers: CACHE_HEADERS }
    );
  }

  // Lesson #39 + #42: defensive destructure on every required field, even though
  // the schema marks them required. Schema enforcement is training-time, not runtime.
  const input = block.input as { definition?: unknown; example?: unknown } | null;
  const definition = typeof input?.definition === "string" ? input.definition : "";
  const example = typeof input?.example === "string" ? input.example : "";

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
    l1_target: "en",
    definition,
    example_sentence: example || null,
  });

  return NextResponse.json(
    { definition, exampleSentence: example || null },
    { headers: CACHE_HEADERS }
  );
}
