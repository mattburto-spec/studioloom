/**
 * SCAFFOLD — Phase 5.4
 *
 * Builds a single JSON dump of all student-owned data for FERPA/GDPR/PIPL DSR.
 * Reads every column tagged in data-classification-taxonomy.md as:
 *   pii: 'student_pii' | 'student_voice' | 'student_generated'
 *
 * Returns nested JSON: {
 *   student: {...}, enrollments: [...], submissions: [...], tool_sessions: [...],
 *   audit_events: [...], ai_budget_state: {...}, ...
 * }
 *
 * Read-time cap: 10MB JSON. Larger sets stream + chunk (Phase 5.4 implements simple cap;
 * streaming is FU if a real DSR exceeds).
 *
 * Manual SQL stopgap path documented at docs/security/student-data-export-runbook.md
 * (audit F32 — exists in case the endpoint isn't ready for the first DSR).
 */

export interface StudentExportPayload {
  student: Record<string, unknown>;
  // Filled in Phase 5.4 — see brief §5.4
  [key: string]: unknown;
}

export async function buildStudentExport(
  _supabase: unknown,
  _studentId: string,
): Promise<StudentExportPayload> {
  throw new Error(
    "[scaffold] buildStudentExport not implemented — see docs/projects/access-model-v2-phase-5-brief.md §5.4",
  );
}
