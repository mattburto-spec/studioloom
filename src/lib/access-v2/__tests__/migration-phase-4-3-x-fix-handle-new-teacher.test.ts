/**
 * Asserts the shape of migration
 * 20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path.sql.
 *
 * Phase: Access Model v2 mid-Phase-4 hotfix (banner-test smoke surfaced
 * the May-1 regression — see Lesson candidate #66).
 *
 * The May-1 rewrite (20260501103415_fix_handle_new_teacher_skip_students.sql)
 * accidentally dropped two safety properties when adding the user_type
 * guard:
 *   1. SET search_path = public, pg_temp
 *   2. Schema-qualified table reference (public.teachers)
 *
 * Without (1), Supabase Auth's INSERT context can't resolve `teachers`
 * because public isn't in the default search_path → all email/password
 * teacher signups failed with "relation \"teachers\" does not exist."
 *
 * This regression test asserts the fix migration restores both properties.
 * If a future rewrite drops them again, this test catches it before deploy.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260502102745";

function loadMigration(suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find(
    (f) => f.startsWith(TIMESTAMP) && f.endsWith(suffix)
  );
  if (!file) {
    throw new Error(
      `Migration with timestamp ${TIMESTAMP} and suffix ${suffix} not found`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
}

describe("Migration: 20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path", () => {
  const sql = loadMigration("_phase_4_3_x_fix_handle_new_teacher_search_path.sql");

  describe("function body", () => {
    it("declares CREATE OR REPLACE FUNCTION public.handle_new_teacher", () => {
      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.handle_new_teacher\(\)/
      );
    });

    it("is SECURITY DEFINER", () => {
      expect(sql).toMatch(/SECURITY DEFINER/);
    });

    it("locks search_path = public, pg_temp (the missing piece causing the regression)", () => {
      expect(sql).toMatch(/SET search_path = public, pg_temp/);
    });

    it("uses schema-qualified public.teachers (defence-in-depth)", () => {
      expect(sql).toMatch(/INSERT INTO public\.teachers/);
    });

    it("preserves the user_type='student' guard from May-1 fix (Lesson #65)", () => {
      expect(sql).toMatch(/raw_app_meta_data->>'user_type'\)\s*=\s*'student'/);
      expect(sql).toMatch(/RETURN NEW;/);
    });

    it("preserves the COALESCE fallback for name (raw_user_meta_data.name → email local-part)", () => {
      expect(sql).toMatch(/COALESCE\(NEW\.raw_user_meta_data->>'name'/);
      expect(sql).toMatch(/split_part\(NEW\.email, '@', 1\)/);
    });
  });

  describe("sanity DO block", () => {
    it("asserts SET search_path is present in pg_get_functiondef output", () => {
      expect(sql).toMatch(
        /v_def NOT LIKE '%SET search_path = public, pg_temp%'/
      );
    });

    it("asserts public.teachers qualifier is present", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%public\.teachers%'/);
    });

    it("raises on either failure mode (defensive — won't apply if function body is wrong)", () => {
      const block = sql.match(/DO \$\$[\s\S]*?\$\$;/);
      expect(block?.[0]).toMatch(/RAISE EXCEPTION 'Migration failed:/);
    });
  });

  describe("paired DOWN script (kept for bisect, NOT for prod use)", () => {
    const downSql = loadMigration(
      "_phase_4_3_x_fix_handle_new_teacher_search_path.down.sql"
    );

    it("restores the broken May-1 body (without SET search_path)", () => {
      // The DOWN deliberately omits search_path so a future bisect can
      // reproduce the failure mode exactly.
      const fnBody = downSql.match(
        /CREATE OR REPLACE FUNCTION public\.handle_new_teacher[\s\S]*?\$function\$;/
      );
      expect(fnBody?.[0]).not.toMatch(/SET search_path/);
    });

    it("documents the warning that rolling back breaks signups", () => {
      expect(downSql).toMatch(/WARNING/);
      expect(downSql).toMatch(/teacher signups will\s*\n--\s*fail/);
    });
  });
});
