/**
 * Tests for src/lib/access-v2/data-subject/export-student.ts (Phase 5.4).
 *
 * Coverage:
 *   - Manifest sections all queried with correct (table, filter_column, value)
 *   - design_conversation_turns joined via conversation_id (not student_id)
 *   - audit_events deduped across actor_id + target_table/id queries
 *   - error per section captured in section.error (other sections continue)
 *   - excluded_sections list present + matches v1 manifest
 *   - schema_version: 1
 *   - 10 MB soft cap → later sections marked truncated:true with rows:[]
 */

import { describe, it, expect } from "vitest";
import { buildStudentExport } from "../export-student";

interface MockState {
  // Per-table data
  students?: Array<Record<string, unknown>>;
  class_students?: Array<Record<string, unknown>>;
  ai_budget_state?: Array<Record<string, unknown>>;
  student_progress?: Array<Record<string, unknown>>;
  student_tool_sessions?: Array<Record<string, unknown>>;
  assessment_records?: Array<Record<string, unknown>>;
  competency_assessments?: Array<Record<string, unknown>>;
  gallery_submissions?: Array<Record<string, unknown>>;
  portfolio_entries?: Array<Record<string, unknown>>;
  design_conversations?: Array<{ id: string }>;
  design_conversation_turns?: Array<Record<string, unknown>>;
  audit_events_actor?: Array<{ id: string; [k: string]: unknown }>;
  audit_events_target?: Array<{ id: string; [k: string]: unknown }>;
  // Force errors
  errorOn?: Set<string>;
  // Capture
  queries?: Array<{ table: string; filterColumn?: string; in?: string[] }>;
}

function buildClient(state: MockState) {
  state.queries = state.queries ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (table: string): any => {
    return {
      select: () => ({
        eq: (col1: string, val1: string) => {
          // audit_events two-eq chain (target_table + target_id)
          if (table === "audit_events" && col1 === "target_table") {
            return {
              eq: (_col2: string, _val2: string) => {
                state.queries!.push({ table: `${table}:target` });
                if (state.errorOn?.has(`${table}:target`)) {
                  return Promise.resolve({
                    data: null,
                    error: { message: "simulated target query failure" },
                  });
                }
                return Promise.resolve({
                  data: state.audit_events_target ?? [],
                  error: null,
                });
              },
            };
          }
          // Single .eq chain
          state.queries!.push({ table, filterColumn: col1 });
          if (state.errorOn?.has(table)) {
            return Promise.resolve({
              data: null,
              error: { message: `simulated ${table} failure` },
            });
          }
          if (table === "audit_events" && col1 === "actor_id") {
            return Promise.resolve({
              data: state.audit_events_actor ?? [],
              error: null,
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (state as any)[table] ?? [];
          return Promise.resolve({ data, error: null });
        },
        in: (_col: string, ids: string[]) => {
          state.queries!.push({ table, in: ids });
          if (state.errorOn?.has(table)) {
            return Promise.resolve({
              data: null,
              error: { message: `simulated ${table} failure` },
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (state as any)[table] ?? [];
          return Promise.resolve({ data, error: null });
        },
      }),
    };
  };
  return { from: handler } as unknown as Parameters<typeof buildStudentExport>[0];
}

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";

describe("buildStudentExport — manifest coverage", () => {
  it("returns student_id + exported_at + schema_version: 1", async () => {
    const supabase = buildClient({});
    const result = await buildStudentExport(supabase, STUDENT_ID);
    expect(result.student_id).toBe(STUDENT_ID);
    expect(result.schema_version).toBe(1);
    expect(result.exported_at).toMatch(/^2\d{3}-\d{2}-\d{2}T/);
  });

  it("queries all 12 v1 sections (10 manifest + design_conversation_turns + audit_events)", async () => {
    const state: MockState = {
      design_conversations: [
        { id: "c1-uuid" },
        { id: "c2-uuid" },
      ],
    };
    const supabase = buildClient(state);
    const result = await buildStudentExport(supabase, STUDENT_ID);

    const expectedSections = [
      "student",
      "enrollments",
      "ai_budget_state",
      "progress",
      "tool_sessions",
      "assessments",
      "competency_assessments",
      "gallery_submissions",
      "portfolio_entries",
      "design_conversations",
      "design_conversation_turns",
      "audit_events",
    ];
    for (const key of expectedSections) {
      expect(result.sections).toHaveProperty(key);
    }
  });

  it("filters each table by the right column (Lesson #38 — assert specific values)", async () => {
    const state: MockState = { design_conversations: [{ id: "c1" }] };
    const supabase = buildClient(state);
    await buildStudentExport(supabase, STUDENT_ID);

    const queries = state.queries!;
    expect(queries).toContainEqual({ table: "students", filterColumn: "id" });
    expect(queries).toContainEqual({ table: "class_students", filterColumn: "student_id" });
    expect(queries).toContainEqual({ table: "ai_budget_state", filterColumn: "student_id" });
    expect(queries).toContainEqual({ table: "student_progress", filterColumn: "student_id" });
    expect(queries).toContainEqual({ table: "student_tool_sessions", filterColumn: "student_id" });
    expect(queries).toContainEqual({ table: "assessment_records", filterColumn: "student_id" });
    expect(queries).toContainEqual({
      table: "competency_assessments",
      filterColumn: "student_id",
    });
    expect(queries).toContainEqual({ table: "gallery_submissions", filterColumn: "student_id" });
    expect(queries).toContainEqual({ table: "portfolio_entries", filterColumn: "student_id" });
    expect(queries).toContainEqual({
      table: "design_conversations",
      filterColumn: "student_id",
    });
  });

  it("design_conversation_turns joined via conversation_id IN (...)", async () => {
    const state: MockState = {
      design_conversations: [{ id: "conv-1" }, { id: "conv-2" }],
    };
    const supabase = buildClient(state);
    await buildStudentExport(supabase, STUDENT_ID);
    const inQuery = state.queries!.find(
      (q) => q.table === "design_conversation_turns" && q.in,
    );
    expect(inQuery).toBeDefined();
    expect(inQuery?.in).toEqual(["conv-1", "conv-2"]);
  });

  it("design_conversation_turns skipped (returns empty section) when no conversations", async () => {
    const state: MockState = { design_conversations: [] };
    const supabase = buildClient(state);
    const result = await buildStudentExport(supabase, STUDENT_ID);
    expect(result.sections.design_conversation_turns).toEqual({
      rows: [],
      count: 0,
    });
  });

  it("audit_events combines actor_id query + target_table/id query, deduped by id", async () => {
    const state: MockState = {
      audit_events_actor: [
        { id: "evt-1", action: "login.success" },
        { id: "evt-2", action: "tool.opened" },
      ],
      audit_events_target: [
        { id: "evt-2", action: "tool.opened" }, // duplicate
        { id: "evt-3", action: "student.deleted.soft" },
      ],
    };
    const supabase = buildClient(state);
    const result = await buildStudentExport(supabase, STUDENT_ID);
    expect(result.sections.audit_events.count).toBe(3); // deduped
    const ids = (result.sections.audit_events.rows as Array<{ id: string }>).map(
      (r) => r.id,
    );
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain("evt-1");
    expect(ids).toContain("evt-2");
    expect(ids).toContain("evt-3");
  });

  it("error in one section captured but other sections continue", async () => {
    const state: MockState = {
      errorOn: new Set(["assessment_records"]),
      students: [{ id: STUDENT_ID, name: "Test" }],
    };
    const supabase = buildClient(state);
    const result = await buildStudentExport(supabase, STUDENT_ID);

    expect(result.sections.assessments.error).toBe(
      "simulated assessment_records failure",
    );
    // student section unaffected
    expect(result.sections.student.count).toBe(1);
    expect(result.sections.audit_events.count).toBe(0);
  });

  it("excluded_sections lists the v2 deferral set (FU-AV2-EXPORT-COMPLETE-COVERAGE)", async () => {
    const supabase = buildClient({});
    const result = await buildStudentExport(supabase, STUDENT_ID);
    expect(result.excluded_sections).toContain("quest_journeys");
    expect(result.excluded_sections).toContain("discovery_sessions");
    expect(result.excluded_sections).toContain("open_studio_sessions");
    expect(result.excluded_sections).toContain("fabrication_jobs");
    expect(result.excluded_sections).toContain("ai_usage_log");
    expect(result.excluded_sections).toContain("student_content_moderation_log");
  });

  it("returns counts matching row arrays (sanity)", async () => {
    const state: MockState = {
      students: [{ id: STUDENT_ID }],
      class_students: [{ class_id: "c1" }, { class_id: "c2" }],
      student_progress: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    };
    const supabase = buildClient(state);
    const result = await buildStudentExport(supabase, STUDENT_ID);
    expect(result.sections.student.count).toBe(1);
    expect(result.sections.enrollments.count).toBe(2);
    expect(result.sections.progress.count).toBe(3);
  });

  it("size cap kicks in when payload exceeds 10MB (sets size_capped + truncated)", async () => {
    // Build a 1MB row, place 11 of them in student_progress
    const bigString = "x".repeat(1_000_000);
    const state: MockState = {
      student_progress: Array.from({ length: 11 }, (_, i) => ({
        id: `row-${i}`,
        big: bigString,
      })),
    };
    const supabase = buildClient(state);
    const result = await buildStudentExport(supabase, STUDENT_ID);
    // student_progress is the 4th section in the manifest; its 11MB payload
    // exceeds the 10MB soft cap → truncated.
    expect(result.size_capped).toBe(true);
    expect(result.sections.progress.truncated).toBe(true);
  });
});
