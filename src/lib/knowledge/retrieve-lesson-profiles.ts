/**
 * Lesson Profile retrieval layer for RAG-enhanced unit generation.
 *
 * Unlike chunk retrieval (which returns text snippets), this returns
 * structured pedagogical intelligence — how good teachers scaffold,
 * manage energy, handle timing, and sequence activities.
 *
 * Uses the `match_lesson_profiles` RPC (migration 018) for hybrid search:
 * 50% vector similarity + 10% text rank + 15% verified + 15% times_referenced + 10% rating
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { embedText } from "../ai/embeddings";
import type { LessonProfile } from "@/types/lesson-intelligence";

export interface RetrievedLessonProfile {
  id: string;
  title: string;
  subject_area: string;
  grade_level: string;
  lesson_type: string;
  profile_data: LessonProfile;
  similarity: number;
  text_rank: number;
  final_score: number;
  teacher_verified: boolean;
  teacher_quality_rating: number | null;
  times_referenced: number;
}

export interface LessonProfileRetrievalParams {
  /** Natural language query describing what to retrieve */
  query: string;
  /** Filter by subject area */
  subjectArea?: string;
  /** Filter by grade level */
  gradeLevel?: string;
  /** Filter by criteria covered (e.g., ["A", "B"]) */
  criteria?: string[];
  /** Filter by pedagogical approach */
  approach?: string;
  /** Prioritise this teacher's profiles */
  teacherId?: string;
  /** Only return verified profiles */
  onlyVerified?: boolean;
  /** Max profiles to return */
  maxProfiles?: number;
  // ─── Dimensions v2 optional filters (client-side post-filtering) ───
  /** Filter by dominant Bloom's level in the profile */
  dominantBloom?: string;
  /** Filter to profiles that address a UDL principle */
  udlPrinciple?: "engagement" | "representation" | "action_expression";
}

/**
 * Retrieve relevant lesson profiles for unit generation.
 * Returns structured pedagogical blueprints, not just text.
 */
export async function retrieveLessonProfiles(
  params: LessonProfileRetrievalParams
): Promise<RetrievedLessonProfile[]> {
  const {
    query,
    subjectArea,
    gradeLevel,
    criteria,
    approach,
    teacherId,
    onlyVerified = false,
    maxProfiles = 5,
  } = params;

  // Generate query embedding
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch (err) {
    console.warn("[retrieve-profiles] Embedding failed, returning empty:", err);
    return [];
  }

  // Call the hybrid search RPC
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc("match_lesson_profiles", {
    query_embedding: `[${queryEmbedding.join(",")}]`,
    query_text: query,
    match_count: maxProfiles,
    filter_subject: subjectArea || null,
    filter_grade: gradeLevel || null,
    filter_criteria: criteria || null,
    filter_approach: approach || null,
    filter_teacher_id: teacherId || null,
    only_verified: onlyVerified,
  });

  if (error) {
    console.error("[retrieve-profiles] Search failed:", error);
    return [];
  }

  let results = (data || []) as RetrievedLessonProfile[];

  // ─── Dimensions v2: client-side post-filtering on profile_data ───
  if (params.dominantBloom) {
    results = results.filter((p) => {
      const bd = p.profile_data.bloom_distribution;
      if (!bd?.dominant_level) return true; // don't exclude un-tagged profiles
      return bd.dominant_level.toLowerCase().includes(params.dominantBloom!.toLowerCase());
    });
  }
  if (params.udlPrinciple) {
    results = results.filter((p) => {
      const udl = p.profile_data.udl_coverage;
      if (!udl) return true; // don't exclude un-tagged profiles
      const arr = udl[params.udlPrinciple!];
      return arr && arr.length > 0;
    });
  }

  return results;
}

/**
 * Format retrieved lesson profiles into a prompt context block.
 *
 * Unlike chunk formatting (which pastes raw text), this extracts
 * structured teaching intelligence: pedagogical approach, scaffolding
 * strategies, lesson flow patterns, timing, and identified gaps.
 */
export function formatLessonProfiles(
  profiles: RetrievedLessonProfile[]
): string {
  if (profiles.length === 0) return "";

  const formatted = profiles.map((p, i) => {
    const profile = p.profile_data;
    const parts: string[] = [];

    parts.push(
      `### Teaching Pattern ${i + 1}: "${profile.title}" (${profile.subject_area}, ${profile.grade_level})`
    );

    // Pedagogical approach
    if (profile.pedagogical_approach) {
      parts.push(`**Approach**: ${profile.pedagogical_approach}`);
    }

    // Lesson flow summary — the key insight
    if (profile.lesson_flow?.length) {
      const flowSummary = profile.lesson_flow
        .map(
          (phase) =>
            `  - ${phase.title} (${phase.estimated_minutes}min, ${phase.phase}): ${phase.pedagogical_purpose || phase.description}`
        )
        .join("\n");
      parts.push(`**Lesson Flow**:\n${flowSummary}`);
    }

    // Scaffolding strategy — how they build up skills
    if (profile.scaffolding_strategy) {
      parts.push(`**Scaffolding**: ${profile.scaffolding_strategy}`);
    }

    // Cognitive load curve — pacing intelligence
    if (profile.cognitive_load_curve) {
      parts.push(`**Cognitive Load Curve**: ${profile.cognitive_load_curve}`);
    }

    // Criteria analysis — what criteria are covered and how
    if (profile.criteria_analysis?.length) {
      const criteriaStr = profile.criteria_analysis
        .map(
          (c) =>
            `  - Criterion ${c.criterion}: ${c.emphasis} emphasis — ${c.skill_development || ""}`
        )
        .join("\n");
      parts.push(`**Criteria Coverage**:\n${criteriaStr}`);
    }

    // Strengths — what makes this lesson good
    if (profile.strengths?.length) {
      parts.push(`**Strengths**: ${profile.strengths.join("; ")}`);
    }

    // Gaps — what to avoid or improve
    if (profile.gaps?.length) {
      parts.push(`**Gaps to Address**: ${profile.gaps.join("; ")}`);
    }

    // Classroom management insights
    if (profile.classroom_management) {
      parts.push(
        `**Classroom Management**: ${profile.classroom_management}`
      );
    }

    // Energy and sequencing
    if (profile.energy_and_sequencing) {
      parts.push(
        `**Energy & Sequencing**: ${profile.energy_and_sequencing}`
      );
    }

    // Dimensions v2: UDL coverage + Bloom distribution
    if (profile.udl_coverage) {
      const { engagement, representation, action_expression, principle_gaps } = profile.udl_coverage;
      const udlParts: string[] = [];
      if (engagement?.length) udlParts.push(`Engagement: ${engagement.join(", ")}`);
      if (representation?.length) udlParts.push(`Representation: ${representation.join(", ")}`);
      if (action_expression?.length) udlParts.push(`Action & Expression: ${action_expression.join(", ")}`);
      if (udlParts.length) {
        parts.push(`**UDL Coverage**: ${udlParts.join(" | ")}${principle_gaps ? ` — Gap: ${principle_gaps}` : ""}`);
      }
    }
    if (profile.bloom_distribution?.dominant_level) {
      parts.push(`**Dominant Bloom Level**: ${profile.bloom_distribution.dominant_level}`);
    }
    if (profile.grouping_analysis?.progression) {
      parts.push(`**Grouping Progression**: ${profile.grouping_analysis.progression}`);
    }

    return parts.join("\n");
  });

  return `## Teaching Patterns from Analysed Lessons
The following are structured teaching patterns extracted from high-quality lesson plans in the knowledge base.
Use these patterns to inform your scaffolding strategy, activity sequencing, timing, and differentiation.
Don't copy them directly — adapt the pedagogical approaches to fit this specific unit.

${formatted.join("\n\n")}`;
}

/**
 * Record that lesson profiles were referenced during generation.
 * Increments `times_referenced` for quality signal tracking.
 */
export async function recordLessonProfileRetrieval(
  profileIds: string[]
): Promise<void> {
  if (profileIds.length === 0) return;

  const supabaseAdmin = createAdminClient();
  for (const id of profileIds) {
    try {
      await supabaseAdmin
        .from("lesson_profiles")
        .update({ times_referenced: supabaseAdmin.rpc("increment_profile_reference", { profile_id: id }) as unknown as number })
        .eq("id", id);
    } catch {
      // Non-critical — don't fail generation
    }
  }
}

/**
 * Simple increment for profile references.
 * Falls back to direct SQL if the RPC doesn't exist.
 */
export async function incrementProfileReferences(
  profileIds: string[]
): Promise<void> {
  if (profileIds.length === 0) return;

  const supabaseAdmin = createAdminClient();
  for (const id of profileIds) {
    try {
      // Direct increment — simpler than RPC
      const { data } = await supabaseAdmin
        .from("lesson_profiles")
        .select("times_referenced")
        .eq("id", id)
        .single();

      if (data) {
        await supabaseAdmin
          .from("lesson_profiles")
          .update({ times_referenced: (data.times_referenced || 0) + 1 })
          .eq("id", id);
      }
    } catch {
      // Non-critical
    }
  }
}
