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
  Pass0Classification,
  RubricProfile,
  SafetyProfile,
  ExemplarProfile,
  ContentProfile,
  AnalysisResult,
  LessonFlowPhase,
  EnergyState,
  CognitiveLevel,
  CognitiveLoadCurve,
} from "@/types/lesson-intelligence";

import type { PartialTeachingContext } from "@/types/lesson-intelligence";
import { MODELS } from "@/lib/ai/models";
import { callAnthropicMessages } from "@/lib/ai/call";

import {
  ANALYSIS_PROMPT_VERSION,
  PASS0_SYSTEM_PROMPT,
  PASS1_SYSTEM_PROMPT,
  PASS2_SYSTEM_PROMPT,
  PASS2R_SYSTEM_PROMPT,
  PASS2S_SYSTEM_PROMPT,
  PASS2E_SYSTEM_PROMPT,
  PASS2T_SYSTEM_PROMPT,
  PASS3_SYSTEM_PROMPT,
  buildPass0Prompt,
  buildPass1Prompt,
  buildPass2Prompt,
  buildPass2RPrompt,
  buildPass2SPrompt,
  buildPass2EPrompt,
  buildPass2TPrompt,
  buildPass3Prompt,
  buildDimensionsPrompt,
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
      ? MODELS.HAIKU
      : MODELS.SONNET;

  const callResult = await callAnthropicMessages({
    endpoint: "lib/knowledge/analyse",
    model: modelId,
    maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  if (!callResult.ok) {
    if (callResult.reason === "truncated") {
      console.warn(`[callAI] WARNING: Response truncated (max_tokens reached) for model ${modelId}.`);
      throw new Error(`AI analysis failed: response truncated (max_tokens=${maxTokens})`);
    }
    if (callResult.reason === "no_credentials") {
      throw new Error("AI analysis failed: AI service not configured");
    }
    if (callResult.reason === "api_error") throw callResult.error;
    throw new Error(`AI analysis failed: ${callResult.reason}`);
  }

  const response = callResult.response;
  const textBlock = response.content?.[0];
  const text = textBlock?.type === "text" ? textBlock.text : "";

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
    maxTokens: 8192,
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

/**
 * Pass 2b: Dimensions fields extraction (fallback).
 * Lightweight Haiku call to extract ONLY udl_coverage, bloom_distribution, grouping_analysis
 * when Pass 2 omitted them due to token limits or truncation.
 * Non-blocking: if it fails, returns empty object.
 */
/** Extended Dimensions result including per-section data and cognitive load */
interface DimensionsResult extends Partial<Pick<Pass2Pedagogy, 'udl_coverage' | 'bloom_distribution' | 'grouping_analysis'>> {
  cognitive_load_curve?: CognitiveLoadCurve;
  section_dimensions?: Array<{
    section_index: number;
    bloom_level: CognitiveLevel;
    time_weight: "quick" | "moderate" | "extended" | "flexible";
  }>;
}

async function extractDimensionsFields(
  extractedText: string,
  pass1: Pass1Structure,
  pass2: Pass2Pedagogy
): Promise<DimensionsResult> {
  try {
    const result = await callAI<DimensionsResult>({
      system: `You are a curriculum analyst specialising in UDL (Universal Design for Learning), Bloom's taxonomy, cognitive load analysis, and student grouping patterns. Analyse the document and extract learning design dimensions. Be precise and evidence-based. Even non-lesson documents (rubrics, safety guides, schemes of work) have cognitive load curves and per-section complexity — assess them.`,
      prompt: buildDimensionsPrompt(extractedText, pass1),
      model: "haiku",
      maxTokens: 3072,
    });

    return result;
  } catch (error) {
    // Non-critical — if extraction fails, return empty
    console.log("[analyse] Pass 2b Dimensions extraction failed (non-critical):", error instanceof Error ? error.message : String(error));
    return {};
  }
}

/**
 * Pass 0: Source classification.
 * Fast pass using Haiku — detects document type and routes to appropriate pipeline.
 */
export async function analysePass0(
  textPreview: string,
  filename: string,
  sourceCategory?: string
): Promise<Pass0Classification> {
  return callAI<Pass0Classification>({
    system: PASS0_SYSTEM_PROMPT,
    prompt: buildPass0Prompt(textPreview, filename, sourceCategory),
    model: "haiku",
    maxTokens: 1000,
  });
}

/**
 * Pass 2R: Rubric analysis.
 * Deep pass using Sonnet — extracts criteria, descriptors, command verbs.
 */
export async function analyseRubric(
  extractedText: string,
  pass1: Pass1Structure
): Promise<RubricProfile> {
  return callAI<RubricProfile>({
    system: PASS2R_SYSTEM_PROMPT,
    prompt: buildPass2RPrompt(extractedText, pass1),
    model: "sonnet",
    maxTokens: 4000,
  });
}

/**
 * Pass 2S: Safety analysis.
 * Fast pass using Haiku — extracts equipment, hazards, PPE, procedures.
 */
export async function analyseSafety(
  extractedText: string,
  pass1: Pass1Structure
): Promise<SafetyProfile> {
  return callAI<SafetyProfile>({
    system: PASS2S_SYSTEM_PROMPT,
    prompt: buildPass2SPrompt(extractedText, pass1),
    model: "haiku",
    maxTokens: 2500,
  });
}

/**
 * Pass 2E: Exemplar analysis.
 * Deep pass using Sonnet — analyses student work quality.
 */
export async function analyseExemplar(
  extractedText: string,
  pass1: Pass1Structure
): Promise<ExemplarProfile> {
  return callAI<ExemplarProfile>({
    system: PASS2E_SYSTEM_PROMPT,
    prompt: buildPass2EPrompt(extractedText, pass1),
    model: "sonnet",
    maxTokens: 2500,
  });
}

/**
 * Pass 2T: Content analysis.
 * Fast pass using Haiku — extracts concepts, vocabulary, difficulty, prerequisites.
 */
export async function analyseContent(
  extractedText: string,
  pass1: Pass1Structure
): Promise<ContentProfile> {
  return callAI<ContentProfile>({
    system: PASS2T_SYSTEM_PROMPT,
    prompt: buildPass2TPrompt(extractedText, pass1),
    model: "haiku",
    maxTokens: 2000,
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
  // Dimensions v2 diagnostic logging — check what Pass 2 actually returned
  console.log("[mergeIntoProfile] Dimensions v2 fields from Pass 2:", {
    has_udl: !!pass2.udl_coverage,
    has_bloom: !!pass2.bloom_distribution,
    has_grouping: !!pass2.grouping_analysis,
    udl_keys: pass2.udl_coverage ? Object.keys(pass2.udl_coverage) : "MISSING",
    bloom_keys: pass2.bloom_distribution ? Object.keys(pass2.bloom_distribution) : "MISSING",
    grouping_keys: pass2.grouping_analysis ? Object.keys(pass2.grouping_analysis) : "MISSING",
  });
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

    // Dimensions v2: UDL, Bloom, Grouping (from Pass 2)
    udl_coverage: pass2.udl_coverage ?? undefined,
    bloom_distribution: pass2.bloom_distribution ?? undefined,
    grouping_analysis: pass2.grouping_analysis ?? undefined,

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
   HELPER: Create minimal placeholder profile for type-specific pipelines
   ================================================================ */

/**
 * For type-specific pipelines (rubric, safety, exemplar, content, scope, lightweight),
 * create a minimal LessonProfile as a placeholder to satisfy the interface.
 * The real analysis is in the type-specific profile objects.
 */
function createPlaceholderProfile(
  pass1: Pass1Structure,
  analysisType: string
): LessonProfile {
  return {
    // Identity
    title: pass1.title,
    subject_area: pass1.subject_area,
    grade_level: pass1.grade_level,
    estimated_duration_minutes: pass1.estimated_duration_minutes,
    lesson_type: pass1.lesson_type,

    // Minimal placeholder data
    criteria_analysis: [],
    lesson_flow: pass1.sections.map((section) => ({
      phase: "independent_work",
      title: section.title,
      description: section.content_summary,
      estimated_minutes: section.estimated_minutes,
      activity_type: section.activity_type ?? "unknown",
      pedagogical_purpose: `Part of ${analysisType}`,
      teacher_role: "facilitating",
      student_cognitive_level: "understand",
      scaffolding_present: [],
      scaffolding_removed: [],
      energy_state: "calm_focus",
      materials_needed: section.materials_mentioned,
      tools_required: section.tools_mentioned,
    })),

    pedagogical_approach: {
      primary: analysisType,
      reasoning: `This is a ${analysisType} document, analysed for type-specific properties.`,
    },
    scaffolding_strategy: {
      model: "none-detected",
      how_supports_are_introduced: "",
      how_supports_are_removed: "",
      reasoning: "",
    },
    cognitive_load_curve: {
      description: "Not assessed for this document type",
      peak_moment: "",
      recovery_moment: "",
    },
    classroom_management: {
      noise_level_curve: "",
      movement_required: false,
      grouping_progression: "",
      the_5_and_5: "",
    },

    strengths: [],
    gaps: [],
    complexity_level: pass1.sections.length > 0 ? "proficient" : "introductory",

    prerequisites: [],
    skills_developed: [],
    energy_and_sequencing: {
      starts_as: "calm_focus",
      ends_as: "calm_focus",
      ideal_follows: "",
      avoid_after: "",
    },

    // Provenance
    analysis_version: ANALYSIS_PROMPT_VERSION,
    analysis_model: MODELS.HAIKU, // lightweight pipeline uses Haiku
    analysis_timestamp: new Date().toISOString(),
  };
}

/**
 * Apply per-section bloom_level and time_weight from Dimensions extraction
 * to the profile's lesson_flow array. Matches by section_index.
 */
function applySectionDimensions(profile: LessonProfile, dims: DimensionsResult): void {
  if (!dims.section_dimensions?.length || !profile.lesson_flow?.length) return;

  for (const sd of dims.section_dimensions) {
    const phase = profile.lesson_flow[sd.section_index];
    if (!phase) continue;

    // Validate bloom_level is a real CognitiveLevel
    const validBlooms: CognitiveLevel[] = ["remember", "understand", "apply", "analyse", "evaluate", "create"];
    if (sd.bloom_level && validBlooms.includes(sd.bloom_level as CognitiveLevel)) {
      phase.bloom_level = sd.bloom_level as CognitiveLevel;
    }

    // Validate time_weight
    const validWeights = ["quick", "moderate", "extended", "flexible"] as const;
    if (sd.time_weight && (validWeights as readonly string[]).includes(sd.time_weight)) {
      phase.time_weight = sd.time_weight as typeof validWeights[number];
    }
  }
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
  /** User-selected category hint for Pass 0 classification */
  sourceCategory?: string;
  /** Callback for progress updates */
  onProgress?: (stage: AnalysisStage, message: string) => void;
}

export type AnalysisStage =
  | "pass0_classify"
  | "pass1_structure"
  | "pass2_type_specific"
  | "pass2_pedagogy"
  | "pass3_design_teaching"
  | "merging"
  | "complete"
  | "error";

/**
 * Run document analysis with Pass 0 classification and type-specific pipelines.
 *
 * Flow:
 * 1. Pass 0: Classify document type → select pipeline
 * 2. Pass 1: Extract structure (all pipelines)
 * 3. Pass 2 variant based on pipeline:
 *    - lesson: Pass 2 (pedagogy) + Pass 3 (design teaching) → full merge
 *    - rubric: Pass 2R (rubric analysis) → RubricProfile
 *    - safety: Pass 2S (safety analysis) → SafetyProfile
 *    - exemplar: Pass 2E (exemplar analysis) → ExemplarProfile
 *    - content: Pass 2T (content analysis) → ContentProfile
 *    - scope: Pass 1 only → Pass1Structure
 *    - lightweight: Pass 1 only → Pass1Structure
 *
 * Returns the complete AnalysisResult with all intermediate outputs
 * and the appropriate typed profile.
 */
export async function analyseDocument(
  options: AnalyseDocumentOptions
): Promise<AnalysisResult> {
  const {
    extractedText,
    filename,
    teachingContext,
    sourceCategory,
    onProgress,
  } = options;

  // Truncate very long documents to avoid token limits
  // Keep first 12000 chars (~3000 tokens) — enough for most lesson plans
  const text =
    extractedText.length > 12000
      ? extractedText.slice(0, 12000) + "\n\n[... document truncated for analysis ...]"
      : extractedText;

  // Preview for Pass 0: first 2000 chars
  const textPreview =
    text.length > 2000 ? text.slice(0, 2000) + "\n\n[...]" : text;

  // ─── Pass 0: Classify document type ───
  onProgress?.("pass0_classify", "Detecting document type...");
  const pass0 = await analysePass0(textPreview, filename, sourceCategory);

  // ─── Pass 1: Extract structure (all pipelines) ───
  onProgress?.("pass1_structure", "Extracting document structure...");
  const pass1 = await analysePass1(text, filename, teachingContext);

  // ─── Route to type-specific pipeline ───
  const pipeline = pass0.recommended_pipeline;

  // Declare these to satisfy TypeScript
  let pass2: Pass2Pedagogy | null = null;
  let pass3: Pass3DesignTeaching | null = null;
  let rubricProfile: RubricProfile | undefined;
  let safetyProfile: SafetyProfile | undefined;
  let exemplarProfile: ExemplarProfile | undefined;
  let contentProfile: ContentProfile | undefined;
  let profile: LessonProfile;

  if (pipeline === "lesson") {
    // Full 3-pass lesson analysis
    onProgress?.(
      "pass2_pedagogy",
      "Analysing pedagogical approach..."
    );
    pass2 = await analysePass2(text, pass1, teachingContext);

    // Pass 2b: Check if Dimensions fields are missing and extract if needed
    const hasMissingDimensions =
      !pass2.udl_coverage ||
      !pass2.bloom_distribution ||
      !pass2.grouping_analysis;

    let lessonDimensionsResult: DimensionsResult = {};
    if (hasMissingDimensions) {
      onProgress?.("pass2_pedagogy", "Extracting UDL & Bloom data...");
      lessonDimensionsResult = await extractDimensionsFields(
        text,
        pass1,
        pass2
      );
      // Merge Pass 2b results back into pass2 (udl, bloom, grouping only)
      if (lessonDimensionsResult.udl_coverage) pass2.udl_coverage = lessonDimensionsResult.udl_coverage;
      if (lessonDimensionsResult.bloom_distribution) pass2.bloom_distribution = lessonDimensionsResult.bloom_distribution;
      if (lessonDimensionsResult.grouping_analysis) pass2.grouping_analysis = lessonDimensionsResult.grouping_analysis;
      console.log("[analyse] Pass 2b Dimensions filled:", {
        had_missing: hasMissingDimensions,
        now_has_udl: !!pass2.udl_coverage,
        now_has_bloom: !!pass2.bloom_distribution,
        now_has_grouping: !!pass2.grouping_analysis,
        has_section_dims: !!lessonDimensionsResult.section_dimensions?.length,
        has_cog_load: !!lessonDimensionsResult.cognitive_load_curve,
      });
    }

    onProgress?.(
      "pass3_design_teaching",
      "Assessing workshop reality..."
    );
    pass3 = await analysePass3(
      text,
      pass1,
      pass2,
      teachingContext
    );

    onProgress?.("merging", "Building lesson intelligence profile...");
    const analysisModel = MODELS.SONNET;
    profile = mergeIntoProfile(pass1, pass2, pass3, analysisModel);

    // Apply per-section dimensions to lesson flow if available from Pass 2b
    applySectionDimensions(profile, lessonDimensionsResult);
    // If Pass 2 cognitive load was empty but Pass 2b has it, use it
    if (lessonDimensionsResult.cognitive_load_curve?.description &&
        (!profile.cognitive_load_curve?.description || profile.cognitive_load_curve.description === "")) {
      profile.cognitive_load_curve = lessonDimensionsResult.cognitive_load_curve;
    }
  } else if (pipeline === "rubric") {
    // Rubric-specific analysis
    onProgress?.("pass2_type_specific", "Analysing rubric criteria...");
    rubricProfile = await analyseRubric(text, pass1);

    // Create a minimal LessonProfile as placeholder
    profile = createPlaceholderProfile(pass1, "rubric analysis");
  } else if (pipeline === "safety") {
    // Safety-specific analysis
    onProgress?.("pass2_type_specific", "Analysing safety procedures...");
    safetyProfile = await analyseSafety(text, pass1);

    profile = createPlaceholderProfile(pass1, "safety documentation");
  } else if (pipeline === "exemplar") {
    // Exemplar analysis
    onProgress?.("pass2_type_specific", "Analysing student work exemplar...");
    exemplarProfile = await analyseExemplar(text, pass1);

    profile = createPlaceholderProfile(pass1, "student exemplar");
  } else if (pipeline === "content") {
    // Content analysis
    onProgress?.("pass2_type_specific", "Analysing content and concepts...");
    contentProfile = await analyseContent(text, pass1);

    profile = createPlaceholderProfile(pass1, "reference content");
  } else if (pipeline === "scope" || pipeline === "lightweight") {
    // Pass 1 only
    onProgress?.("merging", "Preparing analysis results...");

    profile = createPlaceholderProfile(
      pass1,
      pipeline === "scope" ? "scheme of work" : "resource handout"
    );
  } else {
    throw new Error(`Unknown pipeline: ${pipeline}`);
  }

  // ─── Universal Dimensions extraction for ALL pipelines ───
  // If profile doesn't have bloom_distribution yet, run the lightweight extraction
  // This covers non-lesson pipelines (scope, lightweight, rubric, safety, exemplar, content)
  // and also acts as a safety net for lesson pipeline if Pass 2b somehow failed
  if (!profile.bloom_distribution) {
    try {
      onProgress?.("pass2_pedagogy", "Extracting Bloom & UDL data...");
      const dimensionsResult = await extractDimensionsFields(
        text,
        pass1,
        pass2 || ({} as Pass2Pedagogy)
      );
      if (dimensionsResult.bloom_distribution) {
        profile.bloom_distribution = dimensionsResult.bloom_distribution;
      }
      if (dimensionsResult.udl_coverage) {
        profile.udl_coverage = dimensionsResult.udl_coverage;
      }
      if (dimensionsResult.grouping_analysis) {
        profile.grouping_analysis = dimensionsResult.grouping_analysis;
      }
      // Apply cognitive load curve if profile has placeholder
      if (dimensionsResult.cognitive_load_curve?.description &&
          (!profile.cognitive_load_curve?.description || profile.cognitive_load_curve.description === "Not assessed for this document type")) {
        profile.cognitive_load_curve = dimensionsResult.cognitive_load_curve;
      }
      // Apply per-section bloom/timeWeight
      applySectionDimensions(profile, dimensionsResult);

      console.log("[analyse] Universal Dimensions extraction:", {
        pipeline,
        got_bloom: !!dimensionsResult.bloom_distribution,
        got_udl: !!dimensionsResult.udl_coverage,
        got_grouping: !!dimensionsResult.grouping_analysis,
        got_cog_load: !!dimensionsResult.cognitive_load_curve?.description,
        got_section_dims: !!dimensionsResult.section_dimensions?.length,
      });
    } catch (err) {
      // Non-critical — cards still render without Dimensions data
      console.log("[analyse] Universal Dimensions extraction failed (non-critical):", err instanceof Error ? err.message : String(err));
    }
  }

  onProgress?.("complete", "Analysis complete");

  return {
    pass0,
    pipeline,
    pass1,
    pass2: pass2!,
    pass3: pass3!,
    profile,
    rubricProfile,
    safetyProfile,
    exemplarProfile,
    contentProfile,
  };
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
  teachingContext?: PartialTeachingContext,
  sourceCategory?: string
): Promise<AnalysisResult> {
  return analyseDocument({
    extractedText: rawText,
    filename,
    teachingContext,
    sourceCategory,
    onProgress,
  });
}
