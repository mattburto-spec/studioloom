/**
 * buildStudentExport — Phase 5.4.
 *
 * Returns a single JSON dump of all student-owned data for FERPA / GDPR
 * / PIPL right-to-access requests. Driven by a static manifest of tables
 * known to contain student PII or student-voice content.
 *
 * Coverage v1 (12 tables): students, class_students, student_progress,
 * student_tool_sessions, design_conversations, design_conversation_turns,
 * assessment_records, competency_assessments, gallery_submissions,
 * portfolio_entries, ai_budget_state, audit_events.
 *
 * NOT covered in v1 (filed as FU-AV2-EXPORT-COMPLETE-COVERAGE P2 —
 * pilot can run with the high-value 12 + manual SQL runbook for the rest):
 *   quest_journeys / quest_milestones / quest_evidence /
 *   quest_mentor_interactions, discovery_sessions, open_studio_*,
 *   planning_tasks, student_projects, student_badges,
 *   safety_certifications, skill_quiz_attempts, learning_events,
 *   fabrication_jobs (Preflight pipeline), ai_usage_log,
 *   student_content_moderation_log, student_mentors, bug_reports.
 *
 * The manifest is deliberately static + greppable. Auto-derivation from
 * data-classification-taxonomy.md is also FU (separate from the coverage
 * extension).
 *
 * Read-time soft cap: 10 MB JSON. Larger sets get truncated with a
 * per-table `truncated: true` marker. Streaming + chunking is FU.
 *
 * Auth + audit are the route's responsibility; this function is pure data
 * assembly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const SOFT_CAP_BYTES = 10 * 1024 * 1024; // 10 MB

interface SectionSpec {
  /** Section key in the output JSON. */
  key: string;
  /** Supabase table name. */
  table: string;
  /** Column to filter on. */
  filterColumn: string;
}

/**
 * v1 manifest. Order matters for the size-cap walk: highest-value sections
 * appear earliest so they're guaranteed to land before truncation kicks in.
 */
const STUDENT_DATA_SECTIONS: SectionSpec[] = [
  { key: "student", table: "students", filterColumn: "id" },
  { key: "enrollments", table: "class_students", filterColumn: "student_id" },
  { key: "ai_budget_state", table: "ai_budget_state", filterColumn: "student_id" },
  { key: "progress", table: "student_progress", filterColumn: "student_id" },
  { key: "tool_sessions", table: "student_tool_sessions", filterColumn: "student_id" },
  { key: "assessments", table: "assessment_records", filterColumn: "student_id" },
  { key: "competency_assessments", table: "competency_assessments", filterColumn: "student_id" },
  { key: "gallery_submissions", table: "gallery_submissions", filterColumn: "student_id" },
  { key: "portfolio_entries", table: "portfolio_entries", filterColumn: "student_id" },
  { key: "design_conversations", table: "design_conversations", filterColumn: "student_id" },
];

export interface StudentExportSection {
  rows: unknown[];
  count: number;
  truncated?: boolean;
  error?: string;
}

export interface StudentExportPayload {
  student_id: string;
  exported_at: string; // ISO timestamp UTC
  schema_version: number;
  /** v1 = 12 sections (10 manifest + design_conversation_turns + audit_events) */
  sections: Record<string, StudentExportSection>;
  /** Sections explicitly NOT covered in v1 (consult runbook). */
  excluded_sections: string[];
  /** Set when total payload size exceeded SOFT_CAP_BYTES. */
  size_capped?: boolean;
}

const EXCLUDED_FROM_V1 = [
  "quest_journeys",
  "quest_milestones",
  "quest_evidence",
  "quest_mentor_interactions",
  "discovery_sessions",
  "open_studio_profiles",
  "open_studio_sessions",
  "open_studio_status",
  "planning_tasks",
  "student_projects",
  "student_badges",
  "safety_certifications",
  "skill_quiz_attempts",
  "learning_events",
  "fabrication_jobs",
  "ai_usage_log",
  "student_content_moderation_log",
  "student_mentors",
  "bug_reports",
];

export async function buildStudentExport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  studentId: string,
): Promise<StudentExportPayload> {
  const sections: Record<string, StudentExportSection> = {};
  let runningSize = 0;
  let sizeCapped = false;

  // Walk the manifest. Track running JSON size after each section; once
  // we cross SOFT_CAP_BYTES, subsequent sections record `truncated: true`
  // with a 0-row payload.
  for (const spec of STUDENT_DATA_SECTIONS) {
    if (sizeCapped) {
      sections[spec.key] = { rows: [], count: 0, truncated: true };
      continue;
    }

    try {
      const { data, error } = await supabase
        .from(spec.table)
        .select("*")
        .eq(spec.filterColumn, studentId);

      if (error) {
        sections[spec.key] = {
          rows: [],
          count: 0,
          error: error.message,
        };
        continue;
      }

      const rows = (data ?? []) as unknown[];
      const sectionPayload: StudentExportSection = {
        rows,
        count: rows.length,
      };
      const sectionSize = JSON.stringify(sectionPayload).length;
      if (runningSize + sectionSize > SOFT_CAP_BYTES) {
        sectionPayload.truncated = true;
        sectionPayload.rows = [];
        sizeCapped = true;
      } else {
        runningSize += sectionSize;
      }
      sections[spec.key] = sectionPayload;
    } catch (err) {
      sections[spec.key] = {
        rows: [],
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // design_conversation_turns — joined by conversation_id, not student_id.
  // Pull conversation IDs from the conversations section we just loaded.
  if (!sizeCapped) {
    try {
      const conversationIds = extractConversationIds(sections["design_conversations"]);
      if (conversationIds.length > 0) {
        const { data, error } = await supabase
          .from("design_conversation_turns")
          .select("*")
          .in("conversation_id", conversationIds);

        if (error) {
          sections["design_conversation_turns"] = {
            rows: [],
            count: 0,
            error: error.message,
          };
        } else {
          const rows = (data ?? []) as unknown[];
          const payload: StudentExportSection = { rows, count: rows.length };
          const size = JSON.stringify(payload).length;
          if (runningSize + size > SOFT_CAP_BYTES) {
            payload.truncated = true;
            payload.rows = [];
            sizeCapped = true;
          } else {
            runningSize += size;
          }
          sections["design_conversation_turns"] = payload;
        }
      } else {
        sections["design_conversation_turns"] = { rows: [], count: 0 };
      }
    } catch (err) {
      sections["design_conversation_turns"] = {
        rows: [],
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    sections["design_conversation_turns"] = { rows: [], count: 0, truncated: true };
  }

  // audit_events — special: the student appears as actor_id OR target_id.
  // Two queries combined; deduped by id.
  if (!sizeCapped) {
    try {
      const [actorRes, targetRes] = await Promise.all([
        supabase.from("audit_events").select("*").eq("actor_id", studentId),
        supabase
          .from("audit_events")
          .select("*")
          .eq("target_table", "students")
          .eq("target_id", studentId),
      ]);

      const errMsg =
        actorRes.error?.message ?? targetRes.error?.message ?? null;
      if (errMsg) {
        sections["audit_events"] = { rows: [], count: 0, error: errMsg };
      } else {
        const seen = new Set<string>();
        const rows: unknown[] = [];
        for (const r of [
          ...((actorRes.data ?? []) as Array<{ id: string }>),
          ...((targetRes.data ?? []) as Array<{ id: string }>),
        ]) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            rows.push(r);
          }
        }
        const payload: StudentExportSection = { rows, count: rows.length };
        const size = JSON.stringify(payload).length;
        if (runningSize + size > SOFT_CAP_BYTES) {
          payload.truncated = true;
          payload.rows = [];
          sizeCapped = true;
        } else {
          runningSize += size;
        }
        sections["audit_events"] = payload;
      }
    } catch (err) {
      sections["audit_events"] = {
        rows: [],
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    sections["audit_events"] = { rows: [], count: 0, truncated: true };
  }

  const out: StudentExportPayload = {
    student_id: studentId,
    exported_at: new Date().toISOString(),
    schema_version: 1,
    sections,
    excluded_sections: EXCLUDED_FROM_V1,
  };
  if (sizeCapped) {
    out.size_capped = true;
  }
  return out;
}

function extractConversationIds(section: StudentExportSection | undefined): string[] {
  if (!section) return [];
  return (section.rows as Array<{ id?: string }>)
    .map((r) => r?.id)
    .filter((id): id is string => typeof id === "string");
}
