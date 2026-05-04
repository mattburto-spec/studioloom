/**
 * Asserts the shape of migration
 * 20260502122024_phase_4_4a_bootstrap_auto_close_trigger.sql.
 *
 * Phase: Access Model v2 Phase 4.4a (governance bootstrap closure).
 *
 * The trigger fires on teachers AFTER INSERT. When a school's active
 * teacher count goes 1 → 2, it sets schools.bootstrap_expires_at = now()
 * IF AND ONLY IF the window is currently open (NULL or future). Once
 * closed, never reopens (Q6 sign-off — prevents invite-fire gaming).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260502122024";

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

describe("Migration: 20260502122024_phase_4_4a_bootstrap_auto_close_trigger", () => {
  const sql = loadMigration("_phase_4_4a_bootstrap_auto_close_trigger.sql");

  describe("trigger function", () => {
    it("declares CREATE OR REPLACE FUNCTION public.tg_close_bootstrap_on_second_teacher", () => {
      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.tg_close_bootstrap_on_second_teacher\(\)/
      );
    });

    it("is SECURITY DEFINER (Lesson #64 — needs to UPDATE schools across RLS)", () => {
      expect(sql).toMatch(/SECURITY DEFINER/);
    });

    it("locks search_path = public, pg_temp (Lesson #66)", () => {
      expect(sql).toMatch(/SET search_path = public, pg_temp/);
    });

    it("guards on NEW.school_id IS NULL (skip if no school attached)", () => {
      expect(sql).toMatch(/IF NEW\.school_id IS NULL/);
    });

    it("guards on NEW.deleted_at IS NOT NULL (skip soft-deleted teacher inserts)", () => {
      expect(sql).toMatch(/IF NEW\.deleted_at IS NOT NULL/);
    });

    it("counts ACTIVE teachers (deleted_at IS NULL) per school", () => {
      // The function body itself uses $function$ as delimiter — match
      // through the closing $function$; (semi) so we capture the body, not
      // just the header that ends at the opening $function$.
      expect(sql).toMatch(
        /SELECT COUNT\(\*\) INTO v_active_teacher_count[\s\S]*?WHERE school_id = NEW\.school_id[\s\S]*?AND deleted_at IS NULL/
      );
    });

    it("only fires update when count is exactly 2 (the 1→2 boundary)", () => {
      expect(sql).toMatch(/IF v_active_teacher_count = 2/);
    });

    it("only updates when bootstrap_expires_at is NULL or in the future (Q6: never reopens)", () => {
      const block = sql.match(
        /UPDATE public\.schools[\s\S]*?WHERE id = NEW\.school_id[\s\S]*?AND \(bootstrap_expires_at IS NULL OR bootstrap_expires_at > now\(\)\)/
      );
      expect(block).toBeTruthy();
    });

    it("REVOKEs from PUBLIC then GRANTs to authenticated, service_role", () => {
      expect(sql).toMatch(
        /REVOKE EXECUTE ON FUNCTION public\.tg_close_bootstrap_on_second_teacher\(\)\s*FROM PUBLIC/
      );
      expect(sql).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.tg_close_bootstrap_on_second_teacher\(\)\s*TO authenticated, service_role/
      );
    });
  });

  describe("trigger declaration", () => {
    it("DROPs trigger if exists then CREATEs (idempotent rerun)", () => {
      expect(sql).toMatch(
        /DROP TRIGGER IF EXISTS tg_teachers_close_bootstrap_on_insert ON public\.teachers/
      );
      expect(sql).toMatch(
        /CREATE TRIGGER tg_teachers_close_bootstrap_on_insert/
      );
    });

    it("fires AFTER INSERT FOR EACH ROW on teachers", () => {
      expect(sql).toMatch(
        /CREATE TRIGGER[\s\S]*AFTER INSERT ON public\.teachers[\s\S]*FOR EACH ROW/
      );
    });

    it("calls the close-bootstrap function", () => {
      expect(sql).toMatch(
        /EXECUTE FUNCTION public\.tg_close_bootstrap_on_second_teacher\(\)/
      );
    });
  });

  describe("sanity DO block", () => {
    it("asserts function exists in pg_proc", () => {
      expect(sql).toMatch(
        /pg_proc[\s\S]*proname = 'tg_close_bootstrap_on_second_teacher'/
      );
    });

    it("asserts trigger exists in pg_trigger", () => {
      expect(sql).toMatch(
        /pg_trigger[\s\S]*tgname = 'tg_teachers_close_bootstrap_on_insert'/
      );
    });

    it("asserts search_path lockdown via pg_get_functiondef (Lesson #66 regression catch)", () => {
      expect(sql).toMatch(
        /v_def NOT LIKE '%SET search_path = public, pg_temp%'/
      );
      expect(sql).toMatch(/Lesson #66/);
    });
  });

  describe("paired DOWN script", () => {
    const downSql = loadMigration(
      "_phase_4_4a_bootstrap_auto_close_trigger.down.sql"
    );

    it("drops trigger first, then function (correct dependency order)", () => {
      const dropTrigger = downSql.indexOf("DROP TRIGGER IF EXISTS");
      const dropFunction = downSql.indexOf("DROP FUNCTION IF EXISTS");
      expect(dropTrigger).toBeGreaterThan(-1);
      expect(dropFunction).toBeGreaterThan(dropTrigger);
    });

    it("uses IF EXISTS — idempotent rollback", () => {
      expect(downSql).toMatch(/DROP TRIGGER IF EXISTS/);
      expect(downSql).toMatch(/DROP FUNCTION IF EXISTS/);
    });
  });
});
