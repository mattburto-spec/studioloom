import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import Anthropic from "@anthropic-ai/sdk";
import { BLOCK_LIBRARY } from "@/components/teacher/lesson-editor/BlockPalette";
import { MODELS } from "@/lib/ai/models";

// ─────────────────────────────────────────────────────────────────
// POST /api/teacher/lesson-editor/suggest
// Returns AI-generated block suggestions for the current lesson
// Uses Haiku 4.5 for speed + low cost (~0.2s, ~$0.001)
// ─────────────────────────────────────────────────────────────────

const HAIKU_MODEL = MODELS.HAIKU;

interface SuggestionRequest {
  unitId: string;
  classId: string;
  context: {
    lessonTitle: string;
    learningGoal: string;
    existingActivities: { prompt: string; responseType?: string; toolId?: string }[];
    workshopPhases?: {
      opening?: { hook?: string };
      miniLesson?: { focus?: string };
      debrief?: { protocol?: string; prompt?: string };
    };
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as SuggestionRequest;
    const { context } = body;

    if (!context) {
      return NextResponse.json(
        { error: "Missing context" },
        { status: 400 }
      );
    }

    // Build available blocks reference for the AI
    const blockCatalog = BLOCK_LIBRARY.map((b) => ({
      id: b.id,
      label: b.label,
      category: b.category,
      description: b.description,
      defaultPhase: b.defaultPhase,
    }));

    // Build the existing activities summary
    const existingStr = context.existingActivities.length > 0
      ? context.existingActivities
          .map((a, i) => `${i + 1}. ${a.prompt || "(empty)"} [${a.responseType || "content"}${a.toolId ? ` → ${a.toolId}` : ""}]`)
          .join("\n")
      : "None — the lesson is empty.";

    const phaseStr = context.workshopPhases
      ? `Opening hook: ${context.workshopPhases.opening?.hook || "(not set)"}
Mini-Lesson focus: ${context.workshopPhases.miniLesson?.focus || "(not set)"}
Debrief: ${context.workshopPhases.debrief?.protocol || "(not set)"} — ${context.workshopPhases.debrief?.prompt || "(not set)"}`
      : "No workshop phases configured.";

    const systemPrompt = `You are a lesson design assistant for MYP Design & Technology teachers.
Given the lesson context below, suggest 2-4 activity blocks that would strengthen this lesson.

RULES:
- Only suggest blocks from the AVAILABLE BLOCKS catalog — use their exact "id" field.
- Each suggestion needs: blockId, reason (1 sentence why it fits), phase (opening/miniLesson/workTime/debrief), and optionally promptOverride (a customised prompt that fits the lesson topic).
- Don't duplicate what's already in the lesson. Fill gaps.
- For an empty lesson, suggest a balanced mix across phases.
- For a lesson with activities, suggest what's MISSING (assessment? collaboration? content blocks?).
- Prefer toolkit tools for the workTime phase when the lesson involves design thinking.
- Always suggest an exit ticket or self-assessment if the debrief phase has no student response.
- Keep reasons SHORT and specific to this lesson's topic.

Respond ONLY with a JSON array (no markdown, no explanation):
[{ "blockId": "...", "reason": "...", "phase": "...", "promptOverride": "..." }]`;

    const userPrompt = `LESSON CONTEXT:
Title: ${context.lessonTitle || "(untitled)"}
Learning Goal: ${context.learningGoal || "(not set)"}

EXISTING ACTIVITIES:
${existingStr}

WORKSHOP PHASES:
${phaseStr}

AVAILABLE BLOCKS:
${JSON.stringify(blockCatalog, null, 2)}

Suggest 2-4 blocks that would make this lesson stronger.`;

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 800,
      messages: [
        { role: "user", content: userPrompt },
      ],
      system: systemPrompt,
    });

    // Extract text from response
    const text =
      message.content[0]?.type === "text" ? message.content[0].text : "";

    // Parse JSON — handle potential markdown wrapping
    let suggestions: unknown[] = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("[lesson-editor/suggest] JSON parse failed:", text);
      suggestions = [];
    }

    // Validate block IDs exist
    const validBlockIds = new Set(BLOCK_LIBRARY.map((b) => b.id));
    const validSuggestions = (suggestions as Array<Record<string, unknown>>).filter(
      (s) => typeof s.blockId === "string" && validBlockIds.has(s.blockId as string)
    );

    return NextResponse.json({ suggestions: validSuggestions });
  } catch (err) {
    console.error("[lesson-editor/suggest]", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
