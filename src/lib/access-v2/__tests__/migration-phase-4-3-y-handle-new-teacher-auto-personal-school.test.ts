/**
 * Asserts the shape of migration
 * 20260502105711_phase_4_3_y_handle_new_teacher_auto_personal_school.sql.
 *
 * Phase: Access Model v2 mid-Phase-4 hotfix Bug A (Decision 2 implementation gap).
 *
 * Master spec Decision 2 (signed off 25 Apr): "AUTO-CREATE personal school
 * per teacher during Phase 0 backfill. Every teacher gets school_id
 * populated from day one."
 *
 * Phase 0 did this for existing teachers. The May-1 + May-2 fixes to
 * handle_new_teacher did NOT extend the pattern to new teachers post-Phase-0.
 * This migration closes that gap by extending the trigger to create a
 * personal school in the same transaction.
 *
 * Regression coverage: this test asserts the trigger preserves Lesson #65
 * (student guard), Lesson #66 (search_path lockdown + public.teachers
 * qualifier), Decision 2 (auto-creates personal school), AND uses
 * country='ZZ' (ISO 3166 unknown territory — won't collide with real
 * countries) + source='user_submitted' (existing enum value).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260502105711";

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

describe("Migration: 20260502105711_phase_4_3_y_handle_new_teacher_auto_personal_school", () => {
  const sql = loadMigration(
    "_phase_4_3_y_handle_new_teacher_auto_personal_school.sql"
  );

  describe("function preserves prior safety properties (regression coverage)", () => {
    it("declares CREATE OR REPLACE FUNCTION public.handle_new_teacher", () => {
      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.handle_new_teacher\(\)/
      );
    });

    it("preserves SECURITY DEFINER + locked search_path (Lesson #66)", () => {
      expect(sql).toMatch(/SECURITY DEFINER/);
      expect(sql).toMatch(/SET search_path = public, pg_temp/);
    });

    it("preserves user_type='student' guard (Lesson #65)", () => {
      expect(sql).toMatch(/raw_app_meta_data->>'user_type'\)\s*=\s*'student'/);
    });

    it("preserves schema-qualified public.teachers (Lesson #66 defence-in-depth)", () => {
      expect(sql).toMatch(/INSERT INTO public\.teachers/);
    });
  });

  describe("Decision 2 — auto-create personal school", () => {
    it("inserts into public.schools in the same trigger body", () => {
      expect(sql).toMatch(/INSERT INTO public\.schools/);
    });

    it("captures the new school_id for the teachers insert", () => {
      expect(sql).toMatch(/RETURNING id INTO v_personal_school_id/);
      expect(sql).toMatch(
        /INSERT INTO public\.teachers \(id, name, email, school_id\)/
      );
    });

    it("uses country='ZZ' (ISO 3166 'unknown territory' — application-assigned)", () => {
      const block = sql.match(/INSERT INTO public\.schools[\s\S]*?RETURNING/);
      expect(block?.[0]).toMatch(/'ZZ'/);
    });

    it("uses source='user_submitted' (existing enum value, no CHECK constraint change needed)", () => {
      const block = sql.match(/INSERT INTO public\.schools[\s\S]*?RETURNING/);
      expect(block?.[0]).toMatch(/'user_submitted'/);
    });

    it("school name includes 8-char user_id suffix to avoid (normalized_name, country) collisions", () => {
      expect(sql).toMatch(/substr\(NEW\.id::text, 1, 8\)/);
    });

    it("verified=false on personal schools (only real schools should be marked verified)", () => {
      const block = sql.match(/INSERT INTO public\.schools[\s\S]*?RETURNING/);
      expect(block?.[0]).toMatch(/false/);
    });

    it("created_by = NEW.id — personal school is owned by the teacher", () => {
      const block = sql.match(/INSERT INTO public\.schools[\s\S]*?RETURNING/);
      expect(block?.[0]).toMatch(/NEW\.id/);
    });
  });

  describe("name fallback (preserves COALESCE pattern)", () => {
    it("uses raw_user_meta_data.name → email-local-part fallback for both teachers + schools", () => {
      expect(sql).toMatch(
        /COALESCE\(\s*NEW\.raw_user_meta_data->>'name',\s*split_part\(NEW\.email, '@', 1\)\s*\)/
      );
    });

    it("computes the name once into v_teacher_name (not duplicated logic)", () => {
      expect(sql).toMatch(/v_teacher_name TEXT;/);
      expect(sql).toMatch(/v_teacher_name :=/);
    });
  });

  describe("sanity DO block — defensive assertions", () => {
    it("asserts SET search_path is present (Lesson #66 regression catch)", () => {
      expect(sql).toMatch(
        /v_def NOT LIKE '%SET search_path = public, pg_temp%'/
      );
    });

    it("asserts public.teachers qualifier is present", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%public\.teachers%'/);
    });

    it("asserts public.schools is referenced (Decision 2 verified)", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%public\.schools%'/);
    });

    it("asserts user_type guard is present (Lesson #65 regression catch)", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%user_type%'/);
    });

    it("raises with descriptive errors on each missing property", () => {
      const block = sql.match(/DO \$\$[\s\S]*?\$\$;/);
      expect(block?.[0]).toMatch(/Lesson #66 regression/);
      expect(block?.[0]).toMatch(/Lesson #65 regression/);
      expect(block?.[0]).toMatch(/Decision 2/);
    });
  });

  describe("paired DOWN script", () => {
    const downSql = loadMigration(
      "_phase_4_3_y_handle_new_teacher_auto_personal_school.down.sql"
    );

    it("restores May-2 body (search_path lockdown preserved, no auto-personal-school logic)", () => {
      expect(downSql).toMatch(/SET search_path = public, pg_temp/);
      expect(downSql).not.toMatch(/INSERT INTO public\.schools/);
    });

    it("includes WARNING about /teacher/welcome step-3 breaking on rollback", () => {
      expect(downSql).toMatch(/WARNING/);
      expect(downSql).toMatch(/Teacher missing school context/);
    });
  });
});
