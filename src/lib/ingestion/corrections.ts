/**
 * Ingestion Corrections — Progressive Learning System
 *
 * Stores teacher corrections to AI classification and injects them
 * as few-shot context into future Pass A/B calls. The AI model itself
 * doesn't learn, but the prompt context around it gets smarter per-teacher.
 */

import type { PassConfig } from "./types";

export interface IngestionCorrection {
  id: string;
  teacher_id: string;
  ai_document_type: string | null;
  ai_subject: string | null;
  ai_grade_level: string | null;
  ai_section_count: number | null;
  corrected_document_type: string | null;
  corrected_subject: string | null;
  corrected_grade_level: string | null;
  corrected_section_count: number | null;
  correction_note: string | null;
  document_title: string | null;
  created_at: string;
}

/** How many recent corrections to fetch for few-shot injection */
const MAX_CORRECTIONS = 10;

/**
 * Fetch recent corrections for a teacher.
 * Failure-safe: returns empty array on any DB error.
 */
export async function fetchTeacherCorrections(
  config: PassConfig
): Promise<IngestionCorrection[]> {
  if (!config.supabaseClient || !config.teacherId) return [];

  try {
    const { data } = await config.supabaseClient
      .from("ingestion_corrections")
      .select("*")
      .eq("teacher_id", config.teacherId)
      .order("created_at", { ascending: false })
      .limit(MAX_CORRECTIONS);

    return (data as IngestionCorrection[] | null) ?? [];
  } catch {
    // Failure-safe: corrections are advisory, never block the pipeline
    return [];
  }
}

/**
 * Store a correction. Called when user modifies classification at checkpoint.
 * Returns the new correction ID, or null on failure.
 */
export async function storeCorrection(
  config: PassConfig,
  correction: {
    aiDocumentType?: string;
    aiSubject?: string;
    aiGradeLevel?: string;
    aiSectionCount?: number;
    correctedDocumentType?: string;
    correctedSubject?: string;
    correctedGradeLevel?: string;
    correctedSectionCount?: number;
    correctionNote?: string;
    documentTitle?: string;
    fileHash?: string;
  }
): Promise<string | null> {
  if (!config.supabaseClient || !config.teacherId) return null;

  try {
    const { data } = await config.supabaseClient
      .from("ingestion_corrections")
      .insert({
        teacher_id: config.teacherId,
        ai_document_type: correction.aiDocumentType ?? null,
        ai_subject: correction.aiSubject ?? null,
        ai_grade_level: correction.aiGradeLevel ?? null,
        ai_section_count: correction.aiSectionCount ?? null,
        corrected_document_type: correction.correctedDocumentType ?? null,
        corrected_subject: correction.correctedSubject ?? null,
        corrected_grade_level: correction.correctedGradeLevel ?? null,
        corrected_section_count: correction.correctedSectionCount ?? null,
        correction_note: correction.correctionNote ?? null,
        document_title: correction.documentTitle ?? null,
        file_hash: correction.fileHash ?? null,
      })
      .select("id")
      .single();

    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a few-shot context block for Pass A from recent corrections.
 * Returns empty string if no relevant corrections exist.
 *
 * Injected into the Pass A classification prompt so the AI sees
 * what this teacher corrected in past imports.
 */
export function buildPassACorrections(corrections: IngestionCorrection[]): string {
  if (corrections.length === 0) return "";

  const relevant = corrections.filter(
    (c) => c.corrected_document_type || c.corrected_subject || c.corrected_grade_level || c.corrected_section_count
  );

  if (relevant.length === 0) return "";

  const examples = relevant.slice(0, 5).map((c) => {
    const parts: string[] = [];
    if (c.document_title) parts.push(`Document: "${c.document_title}"`);
    if (c.corrected_document_type) {
      parts.push(`Type: AI said "${c.ai_document_type}" → correct is "${c.corrected_document_type}"`);
    }
    if (c.corrected_subject) {
      parts.push(`Subject: AI said "${c.ai_subject}" → correct is "${c.corrected_subject}"`);
    }
    if (c.corrected_grade_level) {
      parts.push(`Grade: AI said "${c.ai_grade_level}" → correct is "${c.corrected_grade_level}"`);
    }
    if (c.corrected_section_count) {
      parts.push(`Sections: AI found ${c.ai_section_count} → teacher says there are ${c.corrected_section_count}`);
    }
    if (c.correction_note) {
      parts.push(`Teacher note: "${c.correction_note}"`);
    }
    return parts.join(". ");
  });

  return `\n\nIMPORTANT — This teacher has corrected previous imports. Learn from these corrections:\n${examples.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\nApply these patterns to this document.`;
}

/**
 * Build a few-shot context block for Pass B from recent corrections.
 * Focuses on section count / splitting corrections.
 */
export function buildPassBCorrections(corrections: IngestionCorrection[]): string {
  if (corrections.length === 0) return "";

  const relevant = corrections.filter(
    (c) => c.corrected_section_count || c.correction_note
  );

  if (relevant.length === 0) return "";

  const examples = relevant.slice(0, 3).map((c) => {
    const parts: string[] = [];
    if (c.document_title) parts.push(`"${c.document_title}"`);
    if (c.corrected_section_count && c.ai_section_count) {
      parts.push(`AI produced ${c.ai_section_count} sections but teacher corrected to ${c.corrected_section_count}`);
    }
    if (c.correction_note) {
      parts.push(`Teacher feedback: "${c.correction_note}"`);
    }
    return parts.join(" — ");
  });

  return `\n\nPREVIOUS FEEDBACK from this teacher about section splitting:\n${examples.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\nRespect these preferences — do not over-split or under-split.`;
}
