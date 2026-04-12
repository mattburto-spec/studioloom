import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { MODELS } from "@/lib/ai/models";
import {
  QUICK_MODIFY_SYSTEM_PROMPT,
  buildQuickModifyPrompt,
} from "@/lib/knowledge/analysis-prompts";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

async function getTeacherId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * POST: Quick-modify a lesson on the fly.
 *
 * Teacher describes the situation ("Friday afternoon, students are tired,
 * need quiet work for last 30 mins") and gets back a ready-to-teach
 * mini-lesson adapted to the context.
 *
 * Body: {
 *   prompt: string;          // What the teacher wants
 *   unit_title?: string;     // Current unit
 *   unit_subject?: string;
 *   unit_grade?: string;
 *   current_criterion?: string;
 *   pages_completed?: string[];
 *   recent_activities?: string[];
 * }
 */
export async function POST(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { prompt, ...context } = body as {
    prompt: string;
    unit_title?: string;
    unit_subject?: string;
    unit_grade?: string;
    current_criterion?: string;
    pages_completed?: string[];
    recent_activities?: string[];
    tools_available?: string[];
  };

  if (!prompt?.trim()) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 }
    );
  }

  try {
    const userPrompt = buildQuickModifyPrompt(prompt, context);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELS.SONNET,
        max_tokens: 4096,
        system: QUICK_MODIFY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    // Extract JSON from response
    const jsonMatch =
      text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      text.match(/(\{[\s\S]*\})/);

    if (!jsonMatch?.[1]) {
      throw new Error("AI response did not contain valid JSON");
    }

    let jsonStr = jsonMatch[1].trim();
    // Fix common AI JSON issues
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
    jsonStr = jsonStr.replace(/\/\/[^\n]*/g, "");

    const result = JSON.parse(jsonStr);

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quick-modify failed";
    return NextResponse.json(
      { error: `Quick-modify failed: ${message}` },
      { status: 500 }
    );
  }
}
