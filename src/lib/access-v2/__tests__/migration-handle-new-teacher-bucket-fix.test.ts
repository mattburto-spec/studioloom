/**
 * Migration shape test: 16 May 2026 trigger-bucket fix + phantom-row cleanup.
 *
 * Two paired migrations land together:
 *   - 20260516044909_fix_handle_new_teacher_check_user_metadata_bucket.sql
 *     Fixes the gotrue late-binding hole: the user_type='student' guard
 *     in handle_new_teacher must check BOTH raw_app_meta_data AND
 *     raw_user_meta_data because gotrue's INSERT lands with empty
 *     raw_app_meta_data, then UPDATEs it (the AFTER INSERT trigger
 *     never sees the UPDATE). Lesson #92.
 *
 *   - 20260516050159_cleanup_phantom_student_teacher_rows.sql
 *     Deletes the 53 phantom teacher rows accumulated 11–14 May before
 *     the trigger fix landed. Belt-and-braces with FK-safety re-assertion
 *     across all 17 columns pointing at teachers(id).
 *
 * Both migrations applied to prod 16 May 2026; smoke verified.
 *
 * This test is source-static: it asserts the migration BODIES contain the
 * load-bearing properties. Catches any future maintainer who:
 *   - Reverts the dual-bucket guard (re-opens Lesson #92)
 *   - Drops a safety property from the trigger (search_path, schema-qual,
 *     EXCEPTION-WHEN-others)
 *   - Broadens the cleanup filter from the synthetic-email pattern
 *   - Strips the FK-safety re-assertion from the cleanup
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TRIGGER_FIX_TIMESTAMP = '20260516044909';
const CLEANUP_TIMESTAMP = '20260516050159';

function loadMigration(timestamp: string, suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find(
    (f) => f.startsWith(timestamp) && f.endsWith(suffix)
  );
  if (!file) {
    throw new Error(
      `Migration with timestamp ${timestamp} and suffix ${suffix} not found`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
}

describe('Migration: 20260516044909_fix_handle_new_teacher_check_user_metadata_bucket', () => {
  const sql = loadMigration(
    TRIGGER_FIX_TIMESTAMP,
    '_fix_handle_new_teacher_check_user_metadata_bucket.sql'
  );

  // ---- The Lesson #92 fix ----

  it('checks raw_user_meta_data for user_type (the load-bearing fix)', () => {
    // gotrue late-binds raw_app_meta_data via a follow-up UPDATE that the
    // AFTER INSERT trigger never sees. raw_user_meta_data IS populated in
    // the original INSERT — that's why the sibling handle_new_user_profile
    // trigger has been working.
    expect(sql).toMatch(/NEW\.raw_user_meta_data->>'user_type'/);
  });

  it('still checks raw_app_meta_data as forward-compat fallback', () => {
    // Belt-and-braces: a future caller might set ONLY app_metadata.
    expect(sql).toMatch(/NEW\.raw_app_meta_data->>'user_type'/);
  });

  it("guards on user_type === 'student' in BOTH buckets via OR", () => {
    // The literal shape we expect — both buckets in a single OR'd guard.
    const guardRegex =
      /\(NEW\.raw_app_meta_data->>'user_type'\)\s*=\s*'student'\s+OR\s+\(NEW\.raw_user_meta_data->>'user_type'\)\s*=\s*'student'/;
    expect(sql).toMatch(guardRegex);
  });

  // ---- Preserved safety properties (Lessons #65, #66) ----

  it('preserves SET search_path lockdown (Lesson #66)', () => {
    expect(sql).toMatch(/SET search_path\s*=\s*public,\s*pg_temp/);
  });

  it('preserves schema-qualified public.teachers writes (Lesson #66)', () => {
    expect(sql).toMatch(/INSERT INTO public\.teachers/);
  });

  it('preserves SECURITY DEFINER + plpgsql', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('LANGUAGE plpgsql');
  });

  it('preserves EXCEPTION WHEN others to keep auth.users INSERTs unblocked', () => {
    expect(sql).toMatch(/EXCEPTION\s+WHEN others/);
  });

  // ---- Sanity DO-block at end of migration enforces both bucket checks ----

  it('sanity DO-block fails apply if raw_user_meta_data guard missing (Lesson #92)', () => {
    // Asserts the migration carries its own self-check that the new bucket
    // guard landed. If a future maintainer rewrites the function and
    // forgets the new guard, the migration RAISE EXCEPTIONs at apply time.
    expect(sql).toMatch(
      /raw_user_meta_data guard missing.*Lesson #92/i
    );
  });

  it('sanity DO-block also enforces raw_app_meta_data guard', () => {
    expect(sql).toMatch(/raw_app_meta_data guard missing/i);
  });
});

describe('Migration: 20260516050159_cleanup_phantom_student_teacher_rows', () => {
  const sql = loadMigration(
    CLEANUP_TIMESTAMP,
    '_cleanup_phantom_student_teacher_rows.sql'
  );

  // ---- Filter narrowness ----

  it('DELETEs only rows matching the synthetic-email pattern', () => {
    // The filter MUST be 'student-%@students.studioloom.local' (matches
    // syntheticEmailForStudentId in provision-student-auth-user.ts).
    // Anything broader risks deleting real teachers.
    expect(sql).toMatch(
      /DELETE FROM public\.teachers\s+WHERE email LIKE 'student-%@students\.studioloom\.local'/
    );
  });

  // ---- FK-safety re-assertion (Lesson #65 pattern, all 17 columns) ----

  // CASCADE columns — deleting children would silently destroy real data
  it('FK-safety re-asserts CASCADE column: classes.teacher_id', () => {
    expect(sql).toMatch(
      /classes WHERE teacher_id\s*=\s*t\.id/
    );
  });

  it('FK-safety re-asserts CASCADE column: ingestion_corrections.teacher_id', () => {
    expect(sql).toMatch(
      /ingestion_corrections WHERE teacher_id\s*=\s*t\.id/
    );
  });

  it('FK-safety re-asserts CASCADE column: school_invitations.invited_by', () => {
    expect(sql).toMatch(
      /school_invitations WHERE invited_by\s*=\s*t\.id/
    );
  });

  it('FK-safety re-asserts CASCADE column: school_responsibilities.teacher_id', () => {
    expect(sql).toMatch(
      /school_responsibilities WHERE teacher_id\s*=\s*t\.id/
    );
  });

  it('FK-safety re-asserts CASCADE column: teacher_integrations.teacher_id', () => {
    expect(sql).toMatch(
      /teacher_integrations WHERE teacher_id\s*=\s*t\.id/
    );
  });

  // SET NULL columns — flag if any phantom was used as a real activity ref
  it('FK-safety re-asserts SET NULL column: students.author_teacher_id', () => {
    // The most semantically meaningful one: who created this student.
    expect(sql).toMatch(
      /students WHERE author_teacher_id\s*=\s*t\.id/
    );
  });

  it('FK-safety re-asserts all 17 enumerated FK columns', () => {
    // Quick belt-and-braces — count "WHERE.*=.*t\.id" subqueries inside
    // the FK-safety block. Should be exactly 17 (the full enumeration
    // from information_schema.referential_constraints).
    const fkSafetyBlockMatch = sql.match(
      /SELECT COUNT\(\*\) INTO v_fk_refs[\s\S]*?\)\s*;/
    );
    expect(fkSafetyBlockMatch).not.toBeNull();
    const block = fkSafetyBlockMatch![0];
    const subqueries = block.match(/WHERE\s+\w+\s*=\s*t\.id/g) || [];
    expect(subqueries).toHaveLength(17);
  });

  it('FK-safety RAISE EXCEPTIONs (rolls back) if any refs found', () => {
    expect(sql).toMatch(
      /IF v_fk_refs > 0 THEN[\s\S]*?RAISE EXCEPTION/
    );
  });

  // ---- Audit trail + post-condition ----

  it('captures pre-count via RAISE NOTICE before deleting', () => {
    expect(sql).toMatch(/pre-count\s*=\s*%/);
  });

  it('captures rows-deleted via GET DIAGNOSTICS', () => {
    expect(sql).toContain('GET DIAGNOSTICS v_deleted = ROW_COUNT');
  });

  it('post-condition asserts zero phantoms remain or rolls back', () => {
    expect(sql).toMatch(
      /v_post_count <> 0[\s\S]*?RAISE EXCEPTION/
    );
  });

  it('idempotent: early-returns harmlessly if pre-count is 0', () => {
    expect(sql).toMatch(/IF v_pre_count = 0 THEN[\s\S]*?RETURN/);
  });
});
