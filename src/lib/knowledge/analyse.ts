/**
 * Lesson Intelligence Analysis Orchestrator
 *
 * Runs 3-pass AI analysis on uploaded documents to produce
 * deep pedagogical intelligence (LessonProfile).
 *
 * Pass 1: Structure (Haiku — fast, cheap)
 * Pass 2: Pedagogy (Sonnet — reasoning depth)
 * Pass 3: Design Teaching (Sonnet — contextual reasoning)
 * Merge: Deterministic combination of all 3 passes
 */

import type {
  LessonProfile,
  Pass1Structure,
  Pass2Pedagogy,
  Pass3DesignTeaching,
  AnalysisResult,
  LessonFlowPhase,
  EnergyState,
} from "@/types/lesson-intelligence";

import type { PartialTeachingContext } from "@/types/lesson-intelligence";

import {
  ANALYSIS_PROMPT_VERSION,
  PASS1_SYSTEM_PROMPT,
  PASS2_SYSTEM_PROMPT,
  PASS3_SYSTEM_PROMPT,
  buildPass1Prompt,
  buildPass2Prompt,
  buildPass3Prompt,
  buildTeachingContextBlock,
} from "./analysis-prompts";

/* ================================================================
   AI CALL HELPERS
   ================================================================ */

interface AICallOptions {
  system: string;
  prompt: string;
  model: "haiku" | "sonnet";
  maxTokens?: number;
}

/**
 * Call the AI provider and parse JSON output.
 * Uses the app-level Anthropic API key (same as unit generation).
 */
async function callAI<T>(options: AICallOptions): Promise<T> {
  const { system, prompt, model, maxTokens = 4096 } = options;

  // Map model shorthand to actual model IDs
  const modelId =
    model === "haiku"
      ? "claude-haiku-4-5-20251001"
      : "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `AI analysis failed (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  const text =
    data.content?.[0]?.type === "text" ? data.content[0].text : "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch?.[1]) {
    throw new Error("AI response did not contain valid JSON");
  }

  let jsonStr = jsonMatch[1].trim();

  // Fix common AI JSON issues:
  // 1. Trailing commas before ] or }
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
  // 2. Single-line // comments
  jsonStr = jsonStr.replace(/\/\/[^\n]*/g, "");
  // 3. Truncated output — try to close unclosed braces/brackets
  const openBraces = (jsonStr.match(/{/g) || []).length;
  const closeBraces = (jsonStr.match(/}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += "}";

  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    // Log a snippet for debugging
    console.error("[analyse] JSON parse failed. First 500 chars:", jsonStr.slice(0, 500));
    console.error("[analyse] Last 200 chars:", jsonStr.slice(-200));
    throw new Error(
      `Failed to parse AI JSON output: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/* ================================================================
   3-PASS ANALYSIS
   ================================================================ */

/**
 * Pass 1: Structure extraction.
 * Fast pass using Haiku — extracts what's in the document.
 */
export async function analysePass1(
  extractedText: string,
  filename: string,
  teachingContext?: PartialTeachingContext
): Promise<Pass1Structure> {
  const contextBlock = buildTeachingContextBlock(teachingContext);
  return callAI<Pass1Structure>({
    system: PASS1_SYSTEM_PROMPT + contextBlock,
    prompt: buildPass1Prompt(extractedText, filename),
    model: "haiku",
    maxTokens: 3000,
  });
}

/**
 * Pass 2: Pedagogical analysis.
 * Deep pass using Sonnet — analyses WHY the lesson works.
 */
export async function analysePass2(
  extractedText: string,
  pass1: Pass1Structure,
  teachingContext?: PartialTeachingContext
): Promise<Pass2Pedagogy> {
  const contextBlock = buildTeachingContextBlock(teachingContext);
  return callAI<Pass2Pedagogy>({
    system: PASS2_SYSTEM_PROMPT + contextBlock,
    prompt: buildPass2Prompt(extractedText, pass1),
    model: "sonnet",
    maxTokens: 6000,
  });
}

/**
 * Pass 3: Design teaching & workshop intelligence.
 * Deep pass using Sonnet — analyses practical workshop reality.
 */
export async function analysePass3(
  extractedText: string,
  pass1: Pass1Structure,
  pass2: Pass2Pedagogy,
  teachingContext?: PartialTeachingContext
): Promise<Pass3DesignTeaching> {
  const contextBlock = buildTeachingContextBlock(teachingContext);
  return callAI<Pass3DesignTeaching>({
    system: PASS3_SYSTEM_PROMPT + contextBlock,
    prompt: buildPass3Prompt(extractedText, pass1, pass2),
    model: "sonnet",
    maxTokens: 5000,
  });
}

/* ================================================================
   PROFILE MERGER
   Deterministic combination of all 3 passes into LessonProfile
   ================================================================ */

/**
 * Merge outputs from all 3 passes into the final LessonProfile.
 * This is deterministic — no AI call needed.
 */
export function mergeIntoProfile(
  pass1: Pass1Structure,
  pass2: Pass2Pedagogy,
  pass3: Pass3DesignTeaching,
  analysisModel: string
): LessonProfile {
  // Build the lesson flow by combining Pass 1 sections with Pass 2 pedagogy and Pass 3 workshop data
  const lessonFlow: LessonFlowPhase[] = pass1.sections.map((section) => {
    // Find matching pedagogical analysis from Pass 2
    const pedagogy = pass2.phase_analysis.find(
      (p) => p.section_title === section.title
    );

    // Find matching workshop analysis from Pass 3
    const workshop = pass3.workshop_analysis.find(
      (w) => w.section_title === section.title
    );

    // Find any timing adjustment from Pass 3
    const timing = pass3.timing_adjustments.find(
      (t) => t.section_title === section.title
    );

    return {
      phase: pedagogy?.phase ?? "independent_work",
      title: section.title,
      description: section.content_summary,
      estimated_minutes: timing?.adjusted_minutes ?? section.estimated_minutes,
      activity_type: section.activity_type ?? "unknown",

      // Teaching intelligence (from Pass 2)
      pedagogical_purpose: pedagogy?.pedagogical_purpose ?? "",
      teacher_role: pedagogy?.teacher_role ?? "circulating",
      student_cognitive_level: pedagogy?.student_cognitive_level ?? "apply",
      scaffolding_present: pedagogy?.scaffolding_present ?? [],
      scaffolding_removed: pedagogy?.scaffolding_removed ?? [],
      check_for_understanding: pedagogy?.check_for_understanding,
      differentiation: pedagogy?.differentiation,

      // Workshop specifics (from Pass 1 + Pass 3)
      materials_needed:
        section.materials_mentioned.length > 0
          ? section.materials_mentioned
          : undefined,
      tools_required:
        section.tools_mentioned.length > 0
          ? section.tools_mentioned
          : undefined,
      tool_setup_time_minutes: workshop?.setup_time_minutes || undefined,
      cleanup_time_minutes: workshop?.cleanup_time_minutes || undefined,
      safety_considerations:
        workshop?.safety_considerations?.length
          ? workshop.safety_considerations
          : undefined,
      station_rotation:
        workshop?.station_rotation?.stations
          ? {
              stations: workshop.station_rotation.stations,
              minutes_per_station:
                workshop.station_rotation.minutes_per_station ?? 0,
              what_others_do:
                workshop.station_rotation.what_others_do ?? "",
              rotation_management:
                workshop.station_rotation.rotation_management ?? "",
            }
          : undefined,

      // Energy & transitions
      energy_state: (pedagogy?.energy_state ?? "calm_focus") as EnergyState,
      transition_from_previous: pedagogy?.transition_notes,
    } satisfies LessonFlowPhase;
  });

  // Calculate total duration including Pass 3 timing adjustments
  const totalDuration = lessonFlow.reduce(
    (sum, phase) => sum + phase.estimated_minutes,
    0
  );

  const profile: LessonProfile = {
    // Identity
    title: pass1.title,
    subject_area: pass1.subject_area,
    grade_level: pass1.grade_level,
    estimated_duration_minutes: totalDuration || pass1.estimated_duration_minutes,
    lesson_type: pass1.lesson_type,

    // Curriculum alignment (from Pass 2)
    criteria_analysis: pass2.criteria_analysis,

    // Lesson flow (merged from all passes)
    lesson_flow: lessonFlow,

    // Pedagogical DNA (from Pass 2)
    pedagogical_approach: pass2.pedagogical_approach,
    scaffolding_strategy: pass2.scaffolding_strategy,
    cognitive_load_curve: pass2.cognitive_load_curve,

    // Classroom management (from Pass 3)
    classroom_management: pass3.classroom_management,

    // Quality analysis (from Pass 2)
    strengths: pass2.strengths,
    gaps: pass2.gaps,
    complexity_level: pass2.complexity_level,

    // Sequencing intelligence (from Pass 3)
    prerequisites: pass3.prerequisites,
    skills_developed: pass3.skills_developed,
    energy_and_sequencing: pass3.energy_and_sequencing,
    narrative_role: pass3.narrative_role ?? undefined,

    // Provenance
    analysis_version: ANALYSIS_PROMPT_VERSION,
    analysis_model: analysisModel,
    analysis_timestamp: new Date().toISOString(),
  };

  return profile;
}

/* ================================================================
   MAIN ORCHESTRATOR
   ================================================================ */

export interface AnalyseDocumentOptions {
  /** Extracted text from the document */
  extractedText: string;
  /** Original filename */
  filename: string;
  /** Model to use for deep analysis passes (2 and 3). Default: "sonnet" */
  deepModel?: "sonnet";
  /** Teacher's school context and preferences — enriches analysis prompts */
  teachingContext?: PartialTeachingContext;
  /** Callback for progress updates */
  onProgress?: (stage: AnalysisStage, message: string) => void;
}

export type AnalysisStage =
  | "extracting"
  | "pass1_structure"
  | "pass2_pedagogy"
  | "pass3_design_teaching"
  | "merging"
  | "complete"
  | "error";

/**
 * Run full 3-pass analysis on an extracted document.
 * Returns the complete AnalysisResult with all intermediate outputs
 * and the merged LessonProfile.
 */
export async function analyseDocument(
  options: AnalyseDocumentOptions
): Promise<AnalysisResult> {
  const { extractedText, filename, teachingContext, onProgress } = options;

  // Truncate very long documents to avoid token limits
  // Keep first 12000 chars (~3000 tokens) — enough for most lesson plans
  const text =
    extractedText.length > 12000
      ? extractedText.slice(0, 12000) + "\n\n[... document truncated for analysis ...]"
      : extractedText;

  // Pass 1: Structure
  onProgress?.("pass1_structure", "Extracting lesson structure...");
  const pass1 = await analysePass1(text, filename, teachingContext);

  // Pass 2: Pedagogy
  onProgress?.("pass2_pedagogy", "Analysing pedagogical approach...");
  const pass2 = await analysePass2(text, pass1, teachingContext);

  // Pass 3: Design Teaching
  onProgress?.("pass3_design_teaching", "Assessing workshop reality...");
  const pass3 = await analysePass3(text, pass1, pass2, teachingContext);

  // Merge
  onProgress?.("merging", "Building lesson intelligence profile...");
  const analysisModel = "claude-sonnet-4-20250514";
  const profile = mergeIntoProfile(pass1, pass2, pass3, analysisModel);

  onProgress?.("complete", "Analysis complete");

  return { pass1, pass2, pass3, profile };
}

/* ================================================================
   RE-ANALYSIS
   For when prompts improve — re-analyse with preserved raw text
   ================================================================ */

/**
 * Re-analyse a previously analysed document using the latest prompts.
 * Uses the preserved raw_extracted_text from the lesson profile record.
 */
export async function reanalyseDocument(
  rawText: string,
  filename: string,
  onProgress?: (stage: AnalysisStage, message: string) => void,
  teachingContext?: PartialTeachingContext
): Promise<AnalysisResult> {
  return analyseDocument({
    extractedText: rawText,
    filename,
    teachingContext,
    onProgress,
  });
}
