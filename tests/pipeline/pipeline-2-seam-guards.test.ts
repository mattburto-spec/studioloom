/**
 * Phase 2 sub-task 5.1.5 — Pipeline 2 forward-compat seam guard tests.
 *
 * Three regression locks against already-satisfied Pipeline 2 seams:
 *  1. `IngestionPass<TInput, TOutput>` stays generic in ingestion/types.ts
 *  2. `PassConfig.supabaseClient` stays structurally typed (not the full
 *     SupabaseClient generic) — preserves OS Seam 1
 *  3. `success_look_fors` column in migration 060 stays TEXT[] (plain
 *     strings, not UUIDs / FK refs) — Pipeline 2 vision feedback prompts
 *     consume the raw strings
 *
 * These tests pin behaviour that already exists on `main` so a future
 * Pipeline 1 refactor can't silently narrow any of the seams. If a test
 * fires, read docs/projects/dimensions3-phase-2-brief.md §Pipeline 2
 * Forward-Compat Seam Review before "fixing" it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const INGESTION_TYPES = join(process.cwd(), "src/lib/ingestion/types.ts");
const MIGRATION_060 = join(
  process.cwd(),
  "supabase/migrations/060_activity_blocks.sql"
);

describe("Pipeline 2 forward-compat seam guards (Phase 2 sub-task 5.1.5)", () => {
  it("IngestionPass interface remains generic <TInput, TOutput>", () => {
    const src = readFileSync(INGESTION_TYPES, "utf8");
    expect(
      src.includes("interface IngestionPass<TInput, TOutput>"),
      "IngestionPass interface narrowed — Pipeline 2 needs it to stay generic. See dimensions3-phase-2-brief.md §Pipeline 2 Forward-Compat Seam Review."
    ).toBe(true);
  });

  it("PassConfig.supabaseClient stays structurally typed (OS Seam 1)", () => {
    const src = readFileSync(INGESTION_TYPES, "utf8");

    // Positive: the structural shape must be present verbatim.
    expect(
      src.includes("supabaseClient?: { from: (table: string) => any }"),
      "PassConfig.supabaseClient narrowed to concrete SupabaseClient — breaks OS Seam 1. See dimensions3-phase-2-brief.md §Pipeline 2 Forward-Compat Seam Review."
    ).toBe(true);

    // Negative: the concrete narrowed form must NOT appear.
    // Regex (not .includes) — whitespace-tolerant match catches `supabaseClient:SupabaseClient` and `supabaseClient : SupabaseClient`.
    expect(
      /supabaseClient\s*:\s*SupabaseClient/.test(src),
      "PassConfig.supabaseClient narrowed to concrete SupabaseClient — breaks OS Seam 1. See dimensions3-phase-2-brief.md §Pipeline 2 Forward-Compat Seam Review."
    ).toBe(false);
  });

  it("success_look_fors column in migration 060 stays TEXT[]", () => {
    const src = readFileSync(MIGRATION_060, "utf8");
    expect(
      src.includes("success_look_fors TEXT[]"),
      "success_look_fors changed away from TEXT[] — Pipeline 2 vision feedback prompts depend on plain strings. See dimensions3-phase-2-brief.md §Pipeline 2 Forward-Compat Seam Review."
    ).toBe(true);
  });
});
