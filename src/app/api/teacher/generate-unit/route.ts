import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { UNIT_SYSTEM_PROMPT, buildRAGCriterionPrompt, getGradeTimingProfile, buildTimingContext, calculateUsableTime, maxInstructionMinutes } from "@/lib/ai/prompts";
import { validateGeneratedPages } from "@/lib/ai/validation";
import { validateLessonTiming } from "@/lib/ai/timing-validation";
import type { UnitWizardInput } from "@/types";
import type { CriterionKey } from "@/lib/constants";
import { onUnitCreated } from "@/lib/teacher-style/profile-service";

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

const VALID_CRITERIA: CriterionKey[] = ["A", "B", "C", "D"];

/**
 * POST /api/teacher/generate-unit
 * Generate pages for a single criterion using the teacher's AI provider.
 *
 * When `stream=true` in the body, returns a Server-Sent Events stream
 * with partial JSON updates and a final complete event.
 *
 * When `stream=false` (default), returns the full JSON response.
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
  const { wizardInput, criterion, selectedOutline, stream: wantStream } = body as {
    wizardInput: UnitWizardInput;
    criterion: CriterionKey;
    selectedOutline?: { approach: string; pages: Record<string, { title: string; summary: string }> } | null;
    stream?: boolean;
  };

  // Validate inputs
  if (!wizardInput || !criterion) {
    return NextResponse.json(
      { error: "wizardInput and criterion are required" },
      { status: 400 }
    );
  }

  if (!VALID_CRITERIA.includes(criterion)) {
    return NextResponse.json(
      { error: "criterion must be A, B, C, or D" },
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
    const provider = createAIProvider(creds.provider, {
      apiEndpoint: creds.apiEndpoint,
      apiKey: creds.apiKey,
      modelName: creds.modelName,
    });

    // Build prompts with RAG context and selected outline
    const { prompt: userPrompt, chunkIds } = await buildRAGCriterionPrompt(
      criterion,
      wizardInput,
      user.id,
      selectedOutline
    );

    // --- Streaming path ---
    if (wantStream && provider.streamCriterionPages) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const gen = provider.streamCriterionPages!(
              criterion,
              wizardInput,
              UNIT_SYSTEM_PROMPT,
              userPrompt
            );

            for await (const event of gen) {
              if (event.type === "partial_json") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "delta", json: event.json })}\n\n`)
                );
              } else if (event.type === "complete") {
                // Validate and send final result
                const validation = validateGeneratedPages(event.pages);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "complete",
                      pages: validation.pages,
                      warnings: validation.errors,
                      criterion,
                      ragChunkIds: chunkIds,
                    })}\n\n`
                  )
                );
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // --- Non-streaming path (default, works with all providers) ---
    const rawPages = await provider.generateCriterionPages(
      criterion,
      wizardInput,
      UNIT_SYSTEM_PROMPT,
      userPrompt
    );

    // Validate output (structural)
    const validation = validateGeneratedPages(rawPages);

    if (Object.keys(validation.pages).length === 0) {
      return NextResponse.json(
        {
          error: "AI generated invalid content. Please try again.",
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    // Timing validation — Workshop Model auto-repair on pages with workshopPhases
    const gradeLevel = wizardInput.gradeLevel || "Year 3 (Grade 8)";
    const profile = getGradeTimingProfile(gradeLevel);
    const timingCtx = buildTimingContext(profile, 60, false); // default 60-min theory
    const timingResults: Record<string, unknown> = {};

    for (const [pid, page] of Object.entries(validation.pages)) {
      if (page && typeof page === "object" && "sections" in page) {
        try {
          const result = validateLessonTiming(
            page as Parameters<typeof validateLessonTiming>[0],
            profile,
            timingCtx
          );
          if (result.issues.length > 0) {
            // Apply repaired workshopPhases back to the page
            const repaired = page as unknown as Record<string, unknown>;
            repaired.workshopPhases = result.repairedLesson.workshopPhases;
            repaired.extensions = result.repairedLesson.extensions;
            timingResults[pid] = { issues: result.issues, stats: result.stats };
          }
        } catch {
          // Timing validation is enhancement, not requirement
        }
      }
    }

    // Signal teacher style profile: unit generated
    onUnitCreated(user.id).catch(() => {}); // non-fatal

    return NextResponse.json({
      pages: validation.pages,
      warnings: validation.errors,
      criterion,
      ragChunkIds: chunkIds,
      timingValidation: Object.keys(timingResults).length > 0 ? timingResults : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
}
