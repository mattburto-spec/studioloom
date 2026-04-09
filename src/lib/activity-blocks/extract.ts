/**
 * Activity Block Extraction — Dimensions2 Phase 1B + 1C
 *
 * Extracts reusable Activity Blocks from:
 * - Upload analysis (lesson_flow phases from Pass 2) → Phase 1B
 * - Existing unit content_data (ActivitySections) → Phase 1C
 *
 * Blocks are stored in the activity_blocks table with embeddings
 * for hybrid search retrieval during generation.
 */

import type { CreateActivityBlockParams, BloomLevel, TimeWeight, GroupingStrategy, DesignPhase, LessonStructureRole } from "@/types";
import type { ExtractFromUploadParams, ExtractFromUnitParams, LessonFlowPhase } from "./types";

// ----- Phase 1B: Extract from uploads -----

/**
 * Convert lesson_flow phases from Pass 2 analysis into Activity Block params.
 * Each phase becomes one block. The LLM already did the hard analysis work —
 * we just reshape the output.
 */
export function extractBlocksFromUpload(params: ExtractFromUploadParams): CreateActivityBlockParams[] {
  const { teacherId, uploadId, lessonFlowPhases, unitType } = params;
  const blocks: CreateActivityBlockParams[] = [];

  for (let i = 0; i < lessonFlowPhases.length; i++) {
    const phase = lessonFlowPhases[i];
    if (!phase.title || !phase.description) continue;

    // Skip very short phases that aren't real activities (transitions, etc.)
    if (phase.estimated_minutes !== undefined && phase.estimated_minutes < 2) continue;

    const block: CreateActivityBlockParams = {
      title: phase.title,
      description: phase.pedagogical_purpose || phase.description,
      prompt: buildPromptFromPhase(phase),
      source_type: "extracted",
      source_upload_id: uploadId,
      source_activity_index: i,

      // Map cognitive level to Bloom's
      bloom_level: mapCognitiveToBloom(phase.student_cognitive_level || phase.bloom_level),
      time_weight: mapToTimeWeight(phase.time_weight, phase.estimated_minutes),
      grouping: inferGrouping(phase),
      lesson_structure_role: mapPhaseToRole(phase.phase),
      design_phase: inferDesignPhase(phase, unitType),

      // Resources
      materials_needed: phase.materials_needed || undefined,
      scaffolding: phase.scaffolding_present?.length
        ? { ell1: { hints: phase.scaffolding_present } }
        : undefined,

      // Tags for search
      tags: buildTags(phase),
    };

    blocks.push(block);
  }

  return blocks;
}

// ----- Phase 1C: Extract from existing units -----

/**
 * Convert ActivitySections from unit content_data into Activity Block params.
 * Only extracts sections that have substantive student-facing prompts.
 */
export function extractBlocksFromUnit(params: ExtractFromUnitParams): CreateActivityBlockParams[] {
  const { teacherId, unitId, pages } = params;
  const blocks: CreateActivityBlockParams[] = [];

  for (const page of pages) {
    if (!page.sections) continue;

    for (let i = 0; i < page.sections.length; i++) {
      const section = page.sections[i];
      if (!section.prompt || section.prompt.trim().length < 10) continue;

      // Skip content-only sections (no responseType = informational text)
      // But DO include toolkit-tool sections (they have responseType)
      if (!section.responseType) continue;

      // Skip if this activity already references a source block (avoid duplication)
      if (section.source_block_id) continue;

      const block: CreateActivityBlockParams = {
        title: buildTitleFromPrompt(section.prompt, page.title),
        description: null as unknown as undefined,
        prompt: section.prompt,
        source_type: "generated",
        source_unit_id: unitId,
        source_page_id: page.id,
        source_activity_index: i,

        bloom_level: mapCognitiveToBloom(section.bloom_level) ?? section.bloom_level as BloomLevel | undefined,
        time_weight: mapToTimeWeight(section.timeWeight, section.durationMinutes) ?? undefined,
        grouping: validateGrouping(section.grouping) ?? undefined,
        ai_rules: section.ai_rules as CreateActivityBlockParams["ai_rules"],
        udl_checkpoints: section.udl_checkpoints,
        success_look_fors: section.success_look_fors,

        response_type: section.responseType as CreateActivityBlockParams["response_type"],
        toolkit_tool_id: section.toolId,
        criterion_tags: section.criterionTags,

        scaffolding: section.scaffolding as CreateActivityBlockParams["scaffolding"],
        example_response: section.exampleResponse,
        tags: section.tags,
      };

      blocks.push(block);
    }
  }

  return blocks;
}

// ----- Helpers -----

/** Build a student-facing prompt from a lesson flow phase description */
function buildPromptFromPhase(phase: LessonFlowPhase): string {
  // If the phase has a clear activity description, use it directly
  if (phase.description && phase.description.length > 20) {
    return phase.description;
  }
  return `${phase.title}: ${phase.description || "Complete this activity."}`;
}

/** Build a title from a prompt (first ~60 chars, trimmed to word boundary) */
function buildTitleFromPrompt(prompt: string, pageTitle: string): string {
  // Try to extract a meaningful title from the prompt
  const firstSentence = prompt.split(/[.!?\n]/)[0].trim();
  if (firstSentence.length > 10 && firstSentence.length < 80) {
    return firstSentence;
  }
  // Fall back to page title + index
  return `Activity from ${pageTitle}`.slice(0, 80);
}

/** Map analysis cognitive level strings to BloomLevel type */
function mapCognitiveToBloom(level: string | undefined): BloomLevel | undefined {
  if (!level) return undefined;
  const l = level.toLowerCase().trim();
  const map: Record<string, BloomLevel> = {
    remember: "remember",
    recall: "remember",
    understand: "understand",
    comprehend: "understand",
    apply: "apply",
    application: "apply",
    analyse: "analyze",
    analyze: "analyze",
    analysis: "analyze",
    evaluate: "evaluate",
    evaluation: "evaluate",
    create: "create",
    synthesis: "create",
    synthesize: "create",
  };
  return map[l] || undefined;
}

/** Map time_weight string or estimated_minutes to TimeWeight */
function mapToTimeWeight(weight: string | undefined, minutes: number | undefined): TimeWeight | undefined {
  if (weight) {
    const w = weight.toLowerCase().trim();
    if (["quick", "moderate", "extended", "flexible"].includes(w)) {
      return w as TimeWeight;
    }
  }
  if (minutes !== undefined) {
    if (minutes <= 5) return "quick";
    if (minutes <= 15) return "moderate";
    if (minutes <= 30) return "extended";
    return "extended";
  }
  return undefined;
}

/** Validate grouping string against allowed enum */
function validateGrouping(val: string | undefined): GroupingStrategy | undefined {
  if (!val) return undefined;
  const valid: GroupingStrategy[] = ["individual", "pair", "small_group", "whole_class", "mixed"];
  return valid.includes(val as GroupingStrategy) ? (val as GroupingStrategy) : undefined;
}

/** Infer grouping from phase metadata */
function inferGrouping(phase: LessonFlowPhase): GroupingStrategy | undefined {
  const desc = `${phase.title} ${phase.description} ${phase.activity_type || ""}`.toLowerCase();
  if (/\b(group|team|collaborat|together)\b/.test(desc)) return "small_group";
  if (/\b(pair|partner|buddy)\b/.test(desc)) return "pair";
  if (/\b(individual|independent|solo|on your own)\b/.test(desc)) return "individual";
  if (/\b(class|whole|discuss|share)\b/.test(desc)) return "whole_class";
  return undefined;
}

/** Map analysis phase string to LessonStructureRole */
function mapPhaseToRole(phase: string): LessonStructureRole | undefined {
  const p = phase.toLowerCase();
  if (/introduction|opening|warm|hook|entry/.test(p)) return "opening";
  if (/instruction|direct|guided|mini.?lesson|demo/.test(p)) return "instruction";
  if (/independent|work|practice|core|collaborative|making|hands/.test(p)) return "core";
  if (/reflect|debrief|closure|plenary|wrap|exit/.test(p)) return "reflection";
  return "core"; // default
}

/** Infer design thinking phase from context */
function inferDesignPhase(phase: LessonFlowPhase, unitType?: string): DesignPhase | undefined {
  const text = `${phase.title} ${phase.description} ${phase.activity_type || ""}`.toLowerCase();
  if (/research|discover|investigat|explore|interview|observe|empathy/.test(text)) return "discover";
  if (/define|brief|criteria|problem|specification|need/.test(text)) return "define";
  if (/ideat|brainstorm|generate|concept|sketch|diverge/.test(text)) return "ideate";
  if (/prototype|model|build|make|construct|test.?build|mock/.test(text)) return "prototype";
  if (/test|evaluat|feedback|refine|iterate|improve|assess/.test(text)) return "test";
  return undefined;
}

/** Build search tags from phase metadata */
function buildTags(phase: LessonFlowPhase): string[] {
  const tags: string[] = [];
  if (phase.activity_type) tags.push(phase.activity_type.toLowerCase());
  if (phase.teacher_role) tags.push(phase.teacher_role.toLowerCase());
  if (phase.energy_state) tags.push(phase.energy_state.toLowerCase());
  // Add material-based tags
  if (phase.materials_needed) {
    for (const m of phase.materials_needed) {
      if (m.length < 30) tags.push(m.toLowerCase());
    }
  }
  return [...new Set(tags)]; // deduplicate
}
