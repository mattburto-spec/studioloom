import { describe, it, expect, vi } from "vitest";
import { getStudentArchetype } from "../archetype-resolver";

// Mock-builder for a SupabaseClient.from() chain returning the
// supplied data/error for `.maybeSingle()`. Per-table results are
// passed as a Record keyed by table name.
function makeDb(
  per: Record<
    string,
    { data?: unknown; error?: unknown; throws?: boolean }
  >,
): unknown {
  return {
    from(table: string) {
      const entry = per[table];
      if (entry?.throws) {
        return {
          select: () => {
            throw new Error(`table ${table} does not exist`);
          },
        };
      }
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({
          data: entry?.data ?? null,
          error: entry?.error ?? null,
        }),
      };
      return builder;
    },
  };
}

describe("getStudentArchetype", () => {
  it("returns archetype_id from project_specs when present (step 1)", async () => {
    const db = makeDb({
      project_specs: { data: { archetype_id: "toy-design" } },
      student_unit_product_briefs: { data: { archetype_id: "architecture-interior" } },
      choice_card_selections: {
        data: {
          action_resolved: { type: "set-archetype", payload: { archetypeId: "app-digital-tool" } },
        },
      },
    });
    const result = await getStudentArchetype("s1", "u1", db as never);
    expect(result).toBe("toy-design");
  });

  it("falls through to student_unit_product_briefs when project_specs is empty (step 2)", async () => {
    const db = makeDb({
      project_specs: { data: null },
      student_unit_product_briefs: { data: { archetype_id: "architecture-interior" } },
      choice_card_selections: {
        data: {
          action_resolved: { type: "set-archetype", payload: { archetypeId: "app-digital-tool" } },
        },
      },
    });
    const result = await getStudentArchetype("s1", "u1", db as never);
    expect(result).toBe("architecture-interior");
  });

  it("falls through to choice_card_selections when both earlier sources are empty (step 3)", async () => {
    const db = makeDb({
      project_specs: { data: null },
      student_unit_product_briefs: { data: null },
      choice_card_selections: {
        data: {
          action_resolved: { type: "set-archetype", payload: { archetypeId: "app-digital-tool" } },
        },
      },
    });
    const result = await getStudentArchetype("s1", "u1", db as never);
    expect(result).toBe("app-digital-tool");
  });

  it("returns null when no source has an archetype set", async () => {
    const db = makeDb({
      project_specs: { data: null },
      student_unit_product_briefs: { data: null },
      choice_card_selections: { data: null },
    });
    const result = await getStudentArchetype("s1", "u1", db as never);
    expect(result).toBeNull();
  });

  it("silently skips project_specs when the table throws (table doesn't exist yet)", async () => {
    const db = makeDb({
      project_specs: { throws: true },
      student_unit_product_briefs: { data: { archetype_id: "toy-design" } },
      choice_card_selections: { data: null },
    });
    const result = await getStudentArchetype("s1", "u1", db as never);
    expect(result).toBe("toy-design");
  });

  it("ignores choice_card_selections rows where action_resolved is not a set-archetype shape", async () => {
    const db = makeDb({
      project_specs: { data: null },
      student_unit_product_briefs: { data: null },
      choice_card_selections: {
        // Pitch-your-own action — no archetypeId.
        data: { action_resolved: { type: "pitch-to-teacher" } },
      },
    });
    const result = await getStudentArchetype("s1", "u1", db as never);
    expect(result).toBeNull();
  });

  it("ignores choice_card_selections rows missing payload.archetypeId", async () => {
    const db = makeDb({
      project_specs: { data: null },
      student_unit_product_briefs: { data: null },
      choice_card_selections: {
        data: { action_resolved: { type: "set-archetype", payload: {} } },
      },
    });
    const result = await getStudentArchetype("s1", "u1", db as never);
    expect(result).toBeNull();
  });

  // Negative-control sanity: the precedence must matter. If the helper
  // skipped step 1 silently, this would return architecture-interior
  // instead of toy-design.
  it("[negative control] step 1 wins over step 2 when both have data", async () => {
    const db = makeDb({
      project_specs: { data: { archetype_id: "toy-design" } },
      student_unit_product_briefs: { data: { archetype_id: "architecture-interior" } },
      choice_card_selections: { data: null },
    });
    const result = await getStudentArchetype("s1", "u1", db as never);
    expect(result).toBe("toy-design");
    expect(result).not.toBe("architecture-interior");
  });
});
