/**
 * Asserts the shape of migration 20260501123401_phase_3_1_permission_helpers.sql.
 *
 * Phase: Access Model v2 Phase 3.1 (Class Roles & Permissions — Postgres helpers)
 *
 * Three SECURITY DEFINER permission helpers consumed by the can() helper
 * (TypeScript) and eventually by RLS policies on adjacent tables:
 *
 *   has_class_role(class_id, required_role?)
 *   has_school_responsibility(school_id, required_type?)
 *   has_student_mentorship(student_id, required_programme?)
 *
 * SECURITY DEFINER pre-empts the recursion class that bit Phase 1.4 CS-2
 * (classes ↔ class_students cycle, broken via public.is_teacher_of_class).
 * Lessons #62 + #64.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260501123401';

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
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
}

const HELPERS = [
  {
    name: 'has_class_role',
    secondArgName: '_required_role',
    sourceTable: 'class_members',
    actorColumn: 'member_user_id',
    activeColumn: 'removed_at',
    optionalColumn: 'role',
  },
  {
    name: 'has_school_responsibility',
    secondArgName: '_required_type',
    sourceTable: 'school_responsibilities',
    actorColumn: 'teacher_id',
    activeColumn: 'deleted_at',
    optionalColumn: 'responsibility_type',
  },
  {
    name: 'has_student_mentorship',
    secondArgName: '_required_programme',
    sourceTable: 'student_mentors',
    actorColumn: 'mentor_user_id',
    activeColumn: 'deleted_at',
    optionalColumn: 'programme',
  },
] as const;

describe('Migration: 20260501123401_phase_3_1_permission_helpers', () => {
  const sql = loadMigration('_phase_3_1_permission_helpers.sql');
  const downSql = loadMigration('_phase_3_1_permission_helpers.down.sql');

  // ---- Per-helper shape ----

  for (const h of HELPERS) {
    describe(`public.${h.name}`, () => {
      it('declares the function with two UUID/TEXT args, second nullable-default', () => {
        // CREATE OR REPLACE FUNCTION public.NAME(_x UUID, _y TEXT DEFAULT NULL)
        const re = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${h.name}\\s*\\(\\s*_\\w+\\s+UUID,\\s*${h.secondArgName}\\s+TEXT\\s+DEFAULT\\s+NULL\\s*\\)`,
          'i'
        );
        expect(sql).toMatch(re);
      });

      it('is SECURITY DEFINER + STABLE + search_path locked', () => {
        // We need all three modifiers attached to THIS function block.
        // Find the block from CREATE FUNCTION to its terminating $$;
        const blockRe = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${h.name}[\\s\\S]+?\\$\\$;`,
          'i'
        );
        const block = sql.match(blockRe);
        expect(block, `function block for ${h.name} not found`).toBeTruthy();
        expect(block![0]).toMatch(/LANGUAGE\s+sql/i);
        expect(block![0]).toMatch(/STABLE/i);
        expect(block![0]).toMatch(/SECURITY\s+DEFINER/i);
        expect(block![0]).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/i);
      });

      it('queries the source table with EXISTS + auth.uid() + active filter + optional second-arg filter', () => {
        const blockRe = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${h.name}[\\s\\S]+?\\$\\$;`,
          'i'
        );
        const block = sql.match(blockRe)![0];
        expect(block).toMatch(new RegExp(`SELECT\\s+EXISTS`, 'i'));
        expect(block).toContain(`FROM ${h.sourceTable}`);
        expect(block).toContain(`${h.actorColumn} = auth.uid()`);
        expect(block).toContain(`${h.activeColumn} IS NULL`);
        // Optional second-arg pattern: (_X IS NULL OR column = _X)
        expect(block).toMatch(
          new RegExp(
            `\\(\\s*${h.secondArgName}\\s+IS\\s+NULL\\s+OR\\s+${h.optionalColumn}\\s*=\\s*${h.secondArgName}\\s*\\)`,
            'i'
          )
        );
      });

      it('REVOKEs EXECUTE FROM PUBLIC and GRANTs to authenticated + service_role', () => {
        expect(sql).toContain(
          `REVOKE EXECUTE ON FUNCTION public.${h.name}(UUID, TEXT) FROM PUBLIC;`
        );
        expect(sql).toContain(
          `GRANT EXECUTE ON FUNCTION public.${h.name}(UUID, TEXT) TO authenticated, service_role;`
        );
      });
    });
  }

  // ---- Cross-cutting ----

  it('contains a Phase 0.8a backfill assertion before declaring success', () => {
    // The DO block guards Phase 3 against silent prod gaps where an active
    // class lacks a lead_teacher class_members row. Per brief §8 risk.
    expect(sql).toMatch(/Phase 0\.8a backfill gap/i);
    expect(sql).toMatch(/lead_teacher/);
    expect(sql).toMatch(/RAISE EXCEPTION[\s\S]+lead_teacher/i);
  });

  it('uses pg_proc + pg_namespace existence checks in the sanity DO block (Lesson #62)', () => {
    // Lesson #62 — prefer pg_catalog over information_schema for cross-schema work.
    expect(sql).toMatch(/FROM pg_proc p/);
    expect(sql).toMatch(/JOIN pg_namespace n ON n\.oid = p\.pronamespace/);
    // Each helper appears in an existence check
    for (const h of HELPERS) {
      expect(sql).toContain(`p.proname = '${h.name}'`);
    }
  });

  it('paired down migration drops all 3 helpers with IF EXISTS', () => {
    expect(downSql).toContain(
      'DROP FUNCTION IF EXISTS public.has_class_role(UUID, TEXT);'
    );
    expect(downSql).toContain(
      'DROP FUNCTION IF EXISTS public.has_school_responsibility(UUID, TEXT);'
    );
    expect(downSql).toContain(
      'DROP FUNCTION IF EXISTS public.has_student_mentorship(UUID, TEXT);'
    );
  });
});
