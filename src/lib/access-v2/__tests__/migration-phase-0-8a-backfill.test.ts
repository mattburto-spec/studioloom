/**
 * Asserts the shape of migration 20260428221516_phase_0_8a_backfill.sql.
 *
 * Phase: Access Model v2 Phase 0.8a (data-changing)
 *
 * Four sequenced backfills:
 *   1. orphan teachers → personal schools (FOR LOOP, RAISE EXCEPTION on remainder)
 *   2. students.school_id orphan tail (UPDATE FROM teacher chain, RAISE EXCEPTION)
 *   3. units.school_id orphan tail (UPDATE FROM COALESCE chain, RAISE EXCEPTION)
 *   4. class_members.lead_teacher seed (idempotent INSERT with NOT EXISTS guard)
 *
 * Plus a WARNING NOTICE if any classes.school_id NULLs remain (these block
 * the 0.8b NOT NULL tighten — surfaces in the apply log so Matt can
 * investigate before applying 0.8b).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428221516';

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

describe('Migration: 20260428221516_phase_0_8a_backfill', () => {
  const sql = loadMigration('_phase_0_8a_backfill.sql');

  // ---- Step 1: Orphan teachers ----

  it('opens with a DO $$ block (single transaction wrapper)', () => {
    expect(sql).toMatch(/^[\s\S]*DO \$\$\s+DECLARE/m);
  });

  it('counts orphan teachers BEFORE and AFTER the cascade', () => {
    expect(sql).toContain('orphan_teachers_before');
    expect(sql).toContain('orphan_teachers_after');
    expect(sql).toMatch(/teachers WHERE school_id IS NULL/);
  });

  it('FOR LOOP creates personal schools with name suffix + CN country + user_submitted source', () => {
    expect(sql).toMatch(/FOR rec IN[\s\S]+SELECT id, name, email FROM teachers WHERE school_id IS NULL/);
    expect(sql).toContain("' (Personal School)'");
    expect(sql).toMatch(/INSERT INTO schools \(name, country, source\)\s+VALUES \(new_school_name, 'CN', 'user_submitted'\)/);
  });

  it('updates teachers.school_id to point to the newly-created personal school', () => {
    expect(sql).toMatch(
      /UPDATE teachers SET school_id = new_school_id WHERE id = rec\.id/
    );
  });

  it('RAISES EXCEPTION if any orphan teachers remain after cascade', () => {
    expect(sql).toMatch(
      /RAISE EXCEPTION 'Phase 0\.8a: % orphan teachers remain/
    );
  });

  // ---- Step 2: students.school_id ----

  it('backfills students.school_id via class.teacher.school_id chain', () => {
    expect(sql).toMatch(
      /UPDATE students s\s+SET school_id = t\.school_id\s+FROM classes c, teachers t/
    );
    expect(sql).toContain('s.class_id = c.id');
    expect(sql).toContain('c.teacher_id = t.id');
    expect(sql).toContain('t.school_id IS NOT NULL');
  });

  it('counts orphan students BEFORE and AFTER', () => {
    expect(sql).toContain('orphan_students_before');
    expect(sql).toContain('orphan_students_after');
  });

  it('RAISES EXCEPTION if any orphan students remain', () => {
    expect(sql).toMatch(
      /RAISE EXCEPTION 'Phase 0\.8a: % orphan students remain/
    );
  });

  // ---- Step 3: units.school_id ----

  it('backfills units.school_id via COALESCE(author_teacher_id, teacher_id) chain', () => {
    expect(sql).toMatch(
      /UPDATE units u\s+SET school_id = t\.school_id\s+FROM teachers t/
    );
    expect(sql).toContain(
      'COALESCE(u.author_teacher_id, u.teacher_id) = t.id'
    );
  });

  it('RAISES EXCEPTION if any orphan units remain', () => {
    expect(sql).toMatch(
      /RAISE EXCEPTION 'Phase 0\.8a: % orphan units remain/
    );
  });

  // ---- Step 4: class_members lead_teacher seed ----

  it('seeds class_members.lead_teacher from classes.teacher_id', () => {
    expect(sql).toMatch(
      /INSERT INTO class_members \(class_id, member_user_id, role, accepted_at\)\s+SELECT\s+c\.id,\s+c\.teacher_id,\s+'lead_teacher'/
    );
  });

  it('seed uses NOT EXISTS guard for idempotency', () => {
    expect(sql).toMatch(
      /NOT EXISTS \([\s\S]+SELECT 1 FROM class_members cm\s+WHERE cm\.class_id = c\.id[\s\S]+cm\.member_user_id = c\.teacher_id[\s\S]+cm\.role = 'lead_teacher'[\s\S]+cm\.removed_at IS NULL/
    );
  });

  it('skips classes with NULL teacher_id', () => {
    expect(sql).toContain('c.teacher_id IS NOT NULL');
  });

  // ---- Final summary + classes.school_id NULL warning ----

  it('emits WARNING NOTICE if classes.school_id NULLs remain (blocks 0.8b)', () => {
    expect(sql).toMatch(
      /WARNING: % classes still have NULL school_id\. Phase 0\.8b NOT NULL tighten will fail/
    );
  });

  it('emits final summary RAISE NOTICE with all counters', () => {
    expect(sql).toContain('[Phase 0.8a] DONE');
    expect(sql).toContain('orphan teachers');
    expect(sql).toContain('schools created');
    expect(sql).toContain('students updated');
    expect(sql).toContain('units updated');
    expect(sql).toContain('class_members seeded');
  });

  // ---- Destructive guard ----

  it('contains no top-level DROP TABLE / DELETE / TRUNCATE outside the DO block', () => {
    // The migration is a single DO $$ block — no top-level DDL.
    expect(sql).not.toMatch(/^\s*DROP TABLE\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
    expect(sql).not.toMatch(/^\s*ALTER\s/im);
  });
});

describe('Migration: 20260428221516_phase_0_8a_backfill down script', () => {
  const sql = loadMigration('_phase_0_8a_backfill.down.sql');

  it('best-effort deletes the seeded class_members rows', () => {
    expect(sql).toContain('DELETE FROM class_members');
    expect(sql).toContain("role = 'lead_teacher'");
    expect(sql).toContain('invited_at IS NULL');
  });

  it('documents that personal-school cascade is NOT reversed (manual cleanup)', () => {
    expect(sql).toMatch(/LIMITATION/i);
    expect(sql).toMatch(/Personal-school[\s\S]+NOT reversed/i);
  });
});
