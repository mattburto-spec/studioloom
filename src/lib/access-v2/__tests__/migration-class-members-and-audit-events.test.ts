/**
 * Asserts the shape of migration 20260428215923_class_members_and_audit_events.sql.
 *
 * Phase: Access Model v2 Phase 0.7a (load-bearing access infrastructure)
 *
 * Two architectural cornerstones:
 *   - class_members  — class-level role assignments (replaces classes.teacher_id
 *                      direct ownership reads in Phase 6 cutover)
 *   - audit_events   — immutable append-only audit log
 *
 * Phase 0.8 backfills class_members.lead_teacher from existing classes.teacher_id.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428215923';

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

const CLASS_MEMBER_ROLES = [
  'lead_teacher',
  'co_teacher',
  'dept_head',
  'mentor',
  'lab_tech',
  'observer',
] as const;

const ACTOR_TYPES = [
  'student',
  'teacher',
  'fabricator',
  'platform_admin',
  'community_member',
  'guardian',
  'system',
] as const;

describe('Migration: 20260428215923_class_members_and_audit_events', () => {
  const sql = loadMigration('_class_members_and_audit_events.sql');

  // ---- class_members shape ----

  it('creates class_members with class+member CASCADE FKs', () => {
    expect(sql).toMatch(
      /CREATE TABLE class_members[\s\S]+class_id UUID NOT NULL REFERENCES classes\(id\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(
      /member_user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/
    );
  });

  it('class_members.role CHECK enumerates exactly 6 documented values including mentor', () => {
    for (const v of CLASS_MEMBER_ROLES) {
      expect(sql).toContain(`'${v}'`);
    }
    const checkClause = sql.match(
      /role TEXT NOT NULL\s+CHECK\s*\(role IN \([\s\S]+?\)\s*\)/
    );
    expect(checkClause).toBeTruthy();
    const matches = checkClause![0].match(/'\w+'/g) || [];
    expect(matches.length).toBe(6);
  });

  it('class_members has accepted_at NOT NULL DEFAULT now() and removed_at nullable', () => {
    expect(sql).toMatch(/accepted_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
    expect(sql).toMatch(/removed_at TIMESTAMPTZ NULL/);
  });

  it('class_members enforces removed_at >= accepted_at when set', () => {
    expect(sql).toContain(
      'CHECK (removed_at IS NULL OR removed_at >= accepted_at)'
    );
  });

  it('class_members has unique-active partial index on (class, member, role)', () => {
    expect(sql).toContain('idx_class_members_unique_active');
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_class_members_unique_active[\s\S]+ON class_members\(class_id, member_user_id, role\)\s+WHERE removed_at IS NULL/
    );
  });

  it('class_members has class+role lookup index (active only)', () => {
    expect(sql).toContain('idx_class_members_class_role');
    expect(sql).toMatch(
      /idx_class_members_class_role[\s\S]+ON class_members\(class_id, role\)\s+WHERE removed_at IS NULL/
    );
  });

  it('class_members has reverse user-side lookup index (active only)', () => {
    expect(sql).toContain('idx_class_members_user');
    expect(sql).toMatch(
      /idx_class_members_user[\s\S]+ON class_members\(member_user_id\)\s+WHERE removed_at IS NULL/
    );
  });

  // ---- audit_events shape ----

  it('audit_events.actor_id REFERENCES auth.users with ON DELETE SET NULL (system events allow NULL actor)', () => {
    expect(sql).toMatch(
      /actor_id UUID NULL REFERENCES auth\.users\(id\) ON DELETE SET NULL/
    );
  });

  it('audit_events.actor_type CHECK enumerates exactly 7 values (6 user_types + system)', () => {
    for (const v of ACTOR_TYPES) {
      expect(sql).toContain(`'${v}'`);
    }
    const checkClause = sql.match(
      /actor_type TEXT NOT NULL\s+CHECK\s*\(actor_type IN \([\s\S]+?\)\s*\)/
    );
    expect(checkClause).toBeTruthy();
    const matches = checkClause![0].match(/'\w+'/g) || [];
    expect(matches.length).toBe(7);
  });

  it('audit_events has impersonated_by FK auth.users for support-flow tracking', () => {
    expect(sql).toMatch(
      /impersonated_by UUID NULL REFERENCES auth\.users\(id\) ON DELETE SET NULL/
    );
  });

  it('audit_events has denormalised school_id + class_id for filter performance', () => {
    expect(sql).toMatch(
      /school_id UUID NULL REFERENCES schools\(id\) ON DELETE SET NULL/
    );
    expect(sql).toMatch(
      /class_id UUID NULL REFERENCES classes\(id\) ON DELETE SET NULL/
    );
  });

  it('audit_events has severity CHECK with 3 values + info default', () => {
    expect(sql).toMatch(
      /severity TEXT NOT NULL DEFAULT 'info'[\s\S]+CHECK \(severity IN \('info','warn','critical'\)\)/
    );
  });

  it('audit_events captures school_subscription_tier_at_event for monetisation analytics', () => {
    expect(sql).toContain('school_subscription_tier_at_event');
    expect(sql).toContain(
      "school_subscription_tier_at_event IN\n      ('pilot','free','starter','pro','school')"
    );
  });

  it('audit_events has ip_address INET + user_agent TEXT', () => {
    expect(sql).toMatch(/ip_address INET NULL/);
    expect(sql).toMatch(/user_agent TEXT NULL/);
  });

  it('audit_events has 5 indexes (recent / actor / school / action / severity)', () => {
    expect(sql).toContain('idx_audit_events_created');
    expect(sql).toContain('idx_audit_events_actor_created');
    expect(sql).toContain('idx_audit_events_school_created');
    expect(sql).toContain('idx_audit_events_action_created');
    expect(sql).toContain('idx_audit_events_severity_created');
  });

  // ---- RLS ----

  it('enables RLS on both tables', () => {
    expect(sql).toContain('ALTER TABLE class_members ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY');
  });

  it('class_members has self-read + school-teacher-read SELECT policies', () => {
    expect(sql).toContain('class_members_self_read');
    expect(sql).toMatch(/USING \(member_user_id = auth\.uid\(\)\)/);
    expect(sql).toContain('class_members_school_teacher_read');
  });

  it('audit_events has actor-self-read + school-teacher-read SELECT policies', () => {
    expect(sql).toContain('audit_events_actor_self_read');
    expect(sql).toMatch(/USING \(actor_id = auth\.uid\(\)\)/);
    expect(sql).toContain('audit_events_school_teacher_read');
  });

  it('audit_events has NO UPDATE/DELETE policies (immutable by design)', () => {
    // audit_events specifically — we look for FOR UPDATE / FOR DELETE
    // anywhere in the migration that mentions audit_events policies.
    // Since CREATE POLICY blocks reference the table, easiest check:
    // policies on audit_events all say FOR SELECT (or no FOR keyword
    // = FOR ALL, which we avoid).
    expect(sql).not.toMatch(/CREATE POLICY[^;]+ON audit_events FOR UPDATE/i);
    expect(sql).not.toMatch(/CREATE POLICY[^;]+ON audit_events FOR DELETE/i);
    expect(sql).not.toMatch(/CREATE POLICY[^;]+ON audit_events FOR ALL/i);
  });

  it('creates exactly 4 SELECT policies total (2 per table) — no INSERT/UPDATE/DELETE', () => {
    const policyCount = (sql.match(/CREATE POLICY/g) || []).length;
    expect(policyCount).toBe(4);
    expect(sql).not.toMatch(/FOR INSERT/i);
    expect(sql).not.toMatch(/FOR UPDATE/i);
    expect(sql).not.toMatch(/FOR DELETE/i);
  });

  it('audit_events has COMMENT explaining immutability', () => {
    expect(sql).toContain('COMMENT ON TABLE audit_events');
    expect(sql).toMatch(/append-only|immutab/i);
  });

  // ---- Sanity check ----

  it('contains DO $$ block validating both tables', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain("table_name = 'class_members'");
    expect(sql).toContain("table_name = 'audit_events'");
  });

  // ---- Destructive guard ----

  it('contains no top-level DROP TABLE / DELETE / TRUNCATE', () => {
    expect(sql).not.toMatch(/^\s*DROP TABLE\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428215923_class_members_and_audit_events down script', () => {
  const sql = loadMigration('_class_members_and_audit_events.down.sql');

  it('drops both tables CASCADE', () => {
    expect(sql).toContain('DROP TABLE IF EXISTS audit_events CASCADE');
    expect(sql).toContain('DROP TABLE IF EXISTS class_members CASCADE');
  });
});
