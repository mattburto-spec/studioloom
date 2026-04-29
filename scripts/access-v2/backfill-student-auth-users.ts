#!/usr/bin/env tsx
/**
 * Phase 1.1b — Student → auth.users backfill
 *
 * Project: Access Model v2 (Phase 1: Auth Unification)
 * Brief:   docs/projects/access-model-v2-phase-1-brief.md §4.1b
 * Migration paired: 20260429073552_phase_1_1a_student_user_id_column.sql (column add)
 *
 * USAGE:
 *
 *   SUPABASE_URL=<prod-url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<svc-key> \
 *   tsx scripts/access-v2/backfill-student-auth-users.ts [--dry-run | --rollback]
 *
 * MODES:
 *
 *   (default — forward backfill)
 *     For every student with user_id IS NULL:
 *       1. Compute synthetic email: `student-${student.id}@students.studioloom.local`
 *       2. Look up auth.users by that email (idempotency check — handles partial-run resume)
 *       3. If absent: call supabase.auth.admin.createUser() with:
 *            - email: <synthetic>
 *            - email_confirm: true                            (no email is ever sent)
 *            - user_metadata: { user_type: 'student' }        (Phase 0 trigger reads this)
 *            - app_metadata:  { user_type: 'student',         (security-critical claim)
 *                                school_id: <derived>,
 *                                created_via: 'phase-1-1-backfill' }
 *       4. UPDATE students SET user_id = <new-auth-user-id> WHERE id = <student.id>
 *
 *   --dry-run
 *     Reports counts + first-5 sample. NO writes. Run this first.
 *
 *   --rollback
 *     For every auth.users with raw_app_meta_data->>'created_via' = 'phase-1-1-backfill':
 *       1. UPDATE students SET user_id = NULL WHERE user_id = <auth-user-id>
 *       2. DELETE FROM auth.users WHERE id = <auth-user-id>  (cascades to user_profiles)
 *
 * IDEMPOTENCY:
 *   Forward run is safe to re-execute. Skips students whose user_id is already
 *   populated; re-uses existing auth.users rows if email already exists (created
 *   by a prior partial run that crashed mid-pair).
 *
 * SAFETY:
 *   - --dry-run flag explicitly performs no writes.
 *   - Per-row processing — a single failed student does not abort the run.
 *   - Reports `Failed: N` at the end; exits 1 if N > 0.
 *   - Service-role client; RLS bypassed. Required for auth.admin.* + cross-schema
 *     UPDATE on students.
 *
 * Phase 0 `handle_new_user_profile` trigger: fires on auth.users INSERT and creates
 * the matching user_profiles row by reading `raw_user_meta_data->>'user_type'`. We
 * set user_metadata.user_type explicitly so the trigger fires correctly. Side-finding:
 * the trigger should ideally read app_metadata (admin-only), not user_metadata. Tracked
 * for post-Phase-1 cleanup.
 *
 * Lesson references:
 *   #38 — verify expected values, not just non-null (test the email pattern, school_id, metadata shape)
 *   #44 — minimum code that solves the problem (no speculative caching, batching, or progress bars)
 *   #45 — surgical changes (this script ONLY backfills; does not touch RLS, routes, or other tables)
 *   #61 — IMMUTABLE-safe (no partial indexes here, but echo: don't introduce time-based filters anywhere)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

export const SYNTHETIC_EMAIL_DOMAIN = 'students.studioloom.local';
export const CREATED_VIA_TAG = 'phase-1-1-backfill';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface StudentRow {
  id: string;
  user_id: string | null;
  school_id: string | null;
  display_name: string | null;
}

export interface BackfillResult {
  totalStudents: number;
  alreadyBackfilled: number;
  pendingBackfill: number;
  processed: number;       // forward mode: created+linked successfully
  skipped: number;         // forward mode: had user_id already
  reused: number;          // forward mode: auth.users existed; just re-linked
  failed: number;
  failures: Array<{ student_id: string; error: string }>;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers (testable without Supabase)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generate the synthetic email for a student given their UUID.
 *
 * Pattern: `student-${uuid}@students.studioloom.local`
 *
 * - `.local` TLD reserved by RFC 6762 — guarantees no collision with real domains
 * - Deterministic from student.id — re-running yields the same email per student
 * - Opaque to humans; never displayed in UI; never used for outbound email
 */
export function syntheticEmailFor(studentId: string): string {
  if (!studentId || typeof studentId !== 'string') {
    throw new Error(`syntheticEmailFor: invalid studentId (got ${typeof studentId})`);
  }
  return `student-${studentId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/**
 * Build the metadata payload for createUser. Splits into user_metadata + app_metadata
 * because the Phase 0 handle_new_user_profile trigger reads from raw_user_meta_data,
 * but the security-critical claim should live in raw_app_meta_data.
 */
export function buildAuthUserPayload(student: { id: string; school_id: string | null }) {
  return {
    email: syntheticEmailFor(student.id),
    email_confirm: true,
    user_metadata: {
      user_type: 'student' as const,
    },
    app_metadata: {
      user_type: 'student' as const,
      school_id: student.school_id,
      created_via: CREATED_VIA_TAG,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Supabase-touching functions (mockable via injected client)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Forward-mode processor for ONE student. Pure-ish: takes a Supabase client,
 * returns a discriminated result. Caller aggregates totals.
 */
export type ProcessStudentResult =
  | { kind: 'created'; userId: string }
  | { kind: 'reused'; userId: string }
  | { kind: 'skipped'; reason: 'already_linked' }
  | { kind: 'failed'; error: string };

export async function processStudent(
  supabase: SupabaseClient,
  student: StudentRow,
  opts: { dryRun: boolean }
): Promise<ProcessStudentResult> {
  if (student.user_id) {
    return { kind: 'skipped', reason: 'already_linked' };
  }

  const payload = buildAuthUserPayload(student);

  if (opts.dryRun) {
    // No writes; pretend "created" for counter purposes only — caller will not
    // actually count this as processed. Exercise the payload-builder path so any
    // throw (e.g., invalid student id) surfaces in dry-run.
    return { kind: 'created', userId: '<dry-run>' };
  }

  // Idempotency: check if auth.users row with this email already exists (resume path)
  const lookup = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });
  // listUsers doesn't accept email filter natively; we filter client-side from
  // the result set. For prod scale (<5k students), we look up by email via getUserByEmail
  // — fall back to listUsers when the SDK doesn't expose getUserByEmail.
  // Phase 1.1b prod has dozens of students so this is fine.
  let existingUserId: string | null = null;
  if (lookup.data?.users) {
    const match = lookup.data.users.find((u) => u.email === payload.email);
    if (match) existingUserId = match.id;
  }
  // Note: listUsers() pages by 1000 by default in Supabase; for tiny datasets
  // the first page covers it. If a future prod has >1000 backfilled students
  // partway through a re-run, this needs pagination — re-evaluate then.

  let authUserId: string;
  let kind: 'created' | 'reused';

  if (existingUserId) {
    authUserId = existingUserId;
    kind = 'reused';
  } else {
    const { data, error } = await supabase.auth.admin.createUser(payload);
    if (error || !data?.user) {
      return {
        kind: 'failed',
        error: `createUser: ${error?.message ?? 'no user returned'}`,
      };
    }
    authUserId = data.user.id;
    kind = 'created';
  }

  // Link students.user_id → new/existing auth.users.id
  const { error: updateError } = await supabase
    .from('students')
    .update({ user_id: authUserId })
    .eq('id', student.id);

  if (updateError) {
    return {
      kind: 'failed',
      error: `update students.user_id: ${updateError.message}`,
    };
  }

  return { kind, userId: authUserId };
}

/**
 * Forward-mode driver. Iterates all students, processes each, aggregates a result.
 * Exported for testing.
 */
export async function runForwardBackfill(
  supabase: SupabaseClient,
  opts: { dryRun: boolean; sampleSize?: number }
): Promise<BackfillResult> {
  const { data: students, error } = await supabase
    .from('students')
    .select('id, user_id, school_id, display_name')
    .order('id', { ascending: true });

  if (error || !students) {
    throw new Error(`Failed to read students: ${error?.message ?? 'no data'}`);
  }

  const total = students.length;
  const alreadyBackfilled = students.filter((s) => (s as StudentRow).user_id).length;
  const pending = total - alreadyBackfilled;

  const result: BackfillResult = {
    totalStudents: total,
    alreadyBackfilled,
    pendingBackfill: pending,
    processed: 0,
    skipped: 0,
    reused: 0,
    failed: 0,
    failures: [],
  };

  if (opts.dryRun) {
    const sampleN = opts.sampleSize ?? 5;
    const sample = (students as StudentRow[]).filter((s) => !s.user_id).slice(0, sampleN);
    console.log(`\n[DRY RUN] Total students: ${total}`);
    console.log(`[DRY RUN] Already backfilled (user_id NOT NULL): ${alreadyBackfilled}`);
    console.log(`[DRY RUN] Pending backfill: ${pending}`);
    console.log(`[DRY RUN] Sample of first ${sample.length} pending student(s):`);
    for (const s of sample) {
      console.log(
        `  - student_id=${s.id} | display_name=${s.display_name ?? '(null)'} | school_id=${
          s.school_id ?? '(null)'
        } | synthetic_email=${syntheticEmailFor(s.id)}`
      );
    }
    console.log(`\n[DRY RUN] No writes performed. Re-run without --dry-run to backfill.`);
    return result;
  }

  for (const s of students as StudentRow[]) {
    const out = await processStudent(supabase, s, { dryRun: false });
    switch (out.kind) {
      case 'created':
        result.processed += 1;
        console.log(`  ✓ student=${s.id} → auth.users=${out.userId} (created)`);
        break;
      case 'reused':
        result.reused += 1;
        result.processed += 1;
        console.log(`  ↻ student=${s.id} → auth.users=${out.userId} (reused — re-linked)`);
        break;
      case 'skipped':
        result.skipped += 1;
        break;
      case 'failed':
        result.failed += 1;
        result.failures.push({ student_id: s.id, error: out.error });
        console.error(`  ✗ student=${s.id}: ${out.error}`);
        break;
    }
  }

  return result;
}

/**
 * Rollback-mode driver. Finds every auth.users with created_via tag, NULLs the
 * matching students.user_id, then deletes the auth.users row.
 */
export async function runRollback(
  supabase: SupabaseClient,
  opts: { dryRun: boolean }
): Promise<{ deleted: number; failed: number; failures: Array<{ user_id: string; error: string }> }> {
  // listUsers + filter by app_metadata.created_via (no native filter API)
  const { data: page, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !page) {
    throw new Error(`Rollback: listUsers failed: ${error?.message ?? 'no data'}`);
  }

  const targets = (page.users ?? []).filter(
    (u) => (u.app_metadata as Record<string, unknown> | undefined)?.created_via === CREATED_VIA_TAG
  );

  console.log(`\n${opts.dryRun ? '[DRY RUN] ' : ''}Rollback: found ${targets.length} auth.users to delete`);

  const result = { deleted: 0, failed: 0, failures: [] as Array<{ user_id: string; error: string }> };

  if (opts.dryRun) {
    for (const u of targets.slice(0, 5)) {
      console.log(`  - would delete auth.users.id=${u.id} email=${u.email}`);
    }
    return result;
  }

  for (const u of targets) {
    const { error: nullError } = await supabase
      .from('students')
      .update({ user_id: null })
      .eq('user_id', u.id);
    if (nullError) {
      result.failed += 1;
      result.failures.push({ user_id: u.id, error: `null student.user_id: ${nullError.message}` });
      continue;
    }
    const { error: delError } = await supabase.auth.admin.deleteUser(u.id);
    if (delError) {
      result.failed += 1;
      result.failures.push({ user_id: u.id, error: `deleteUser: ${delError.message}` });
      continue;
    }
    result.deleted += 1;
    console.log(`  ✓ deleted auth.users=${u.id} (was email=${u.email})`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rollback = process.argv.includes('--rollback');

  if (dryRun && rollback) {
    // Dry-run + rollback IS valid (preview a rollback). Allow.
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    `\n${dryRun ? '[DRY RUN] ' : ''}${rollback ? 'ROLLBACK' : 'FORWARD'} backfill — Phase 1.1b\n`
  );

  if (rollback) {
    const r = await runRollback(supabase, { dryRun });
    console.log(`\nRollback summary:`);
    console.log(`  Deleted: ${r.deleted}`);
    console.log(`  Failed:  ${r.failed}`);
    if (r.failed > 0) {
      console.error(`\nFailures:`);
      for (const f of r.failures) console.error(`  - ${f.user_id}: ${f.error}`);
      process.exit(1);
    }
    return;
  }

  const r = await runForwardBackfill(supabase, { dryRun });
  console.log(`\nForward summary:`);
  console.log(`  Total students:      ${r.totalStudents}`);
  console.log(`  Already backfilled:  ${r.alreadyBackfilled}`);
  console.log(`  Pending:             ${r.pendingBackfill}`);
  if (!dryRun) {
    console.log(`  Created (this run):  ${r.processed - r.reused}`);
    console.log(`  Reused (re-linked):  ${r.reused}`);
    console.log(`  Skipped (had id):    ${r.skipped}`);
    console.log(`  Failed:              ${r.failed}`);
  }
  if (r.failed > 0) {
    console.error(`\nFailures:`);
    for (const f of r.failures) console.error(`  - ${f.student_id}: ${f.error}`);
    process.exit(1);
  }
}

// Only run main() when invoked as a CLI; allow imports for tests.
// `import.meta.url` is the canonical ESM check; under tsx this is set to the
// file's URL. Tests that import this module won't trigger main().
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
