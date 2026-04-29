/**
 * Unit tests for Phase 1.1b backfill script.
 *
 * Mocks the Supabase client. Covers:
 *   - syntheticEmailFor() — pure helper
 *   - buildAuthUserPayload() — pure helper, exact metadata shape
 *   - processStudent() — single-row state machine (create / reuse / skip / fail)
 *   - runForwardBackfill() — driver behaviour (counts + idempotency)
 *   - dry-run safety (no writes)
 *   - runRollback() — undo path
 *
 * Pattern: assert EXPECTED VALUES literally (Lesson #38). The exact synthetic
 * email format, the exact metadata shape, the exact CREATED_VIA_TAG — all
 * checked by string equality. A rename in either direction must update the test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CREATED_VIA_TAG,
  SYNTHETIC_EMAIL_DOMAIN,
  buildAuthUserPayload,
  processStudent,
  runForwardBackfill,
  runRollback,
  syntheticEmailFor,
  type StudentRow,
} from '../backfill-student-auth-users';

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────

describe('syntheticEmailFor', () => {
  it('produces the documented format', () => {
    expect(syntheticEmailFor('abc-123')).toBe(
      'student-abc-123@students.studioloom.local'
    );
  });

  it('uses the documented .local TLD (RFC 6762)', () => {
    expect(syntheticEmailFor('x').endsWith('.local')).toBe(true);
  });

  it('uses the canonical domain constant', () => {
    expect(SYNTHETIC_EMAIL_DOMAIN).toBe('students.studioloom.local');
  });

  it('throws on missing or non-string studentId', () => {
    // @ts-expect-error — testing runtime guard
    expect(() => syntheticEmailFor(null)).toThrow(/invalid studentId/);
    // @ts-expect-error
    expect(() => syntheticEmailFor(undefined)).toThrow(/invalid studentId/);
    expect(() => syntheticEmailFor('')).toThrow(/invalid studentId/);
  });

  it('is deterministic — same input yields same output', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(syntheticEmailFor(id)).toBe(syntheticEmailFor(id));
  });
});

describe('buildAuthUserPayload', () => {
  it('builds the exact documented payload shape (Lesson #38 — expected values)', () => {
    const payload = buildAuthUserPayload({
      id: 'stu-1',
      school_id: 'sch-1',
    });

    expect(payload).toEqual({
      email: 'student-stu-1@students.studioloom.local',
      email_confirm: true,
      user_metadata: {
        user_type: 'student',
      },
      app_metadata: {
        user_type: 'student',
        school_id: 'sch-1',
        created_via: 'phase-1-1-backfill',
      },
    });
  });

  it('handles null school_id (orphan students kept for visibility)', () => {
    const payload = buildAuthUserPayload({ id: 'orphan', school_id: null });
    expect(payload.app_metadata.school_id).toBeNull();
  });

  it('uses CREATED_VIA_TAG constant exposed by module', () => {
    expect(CREATED_VIA_TAG).toBe('phase-1-1-backfill');
    const payload = buildAuthUserPayload({ id: 'a', school_id: 'b' });
    expect(payload.app_metadata.created_via).toBe(CREATED_VIA_TAG);
  });

  it('sets email_confirm to true (no outbound email expected)', () => {
    const payload = buildAuthUserPayload({ id: 'a', school_id: 'b' });
    expect(payload.email_confirm).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mocked Supabase client builder
// ─────────────────────────────────────────────────────────────────────────

interface MockState {
  students: StudentRow[];
  authUsers: Array<{ id: string; email: string; app_metadata: Record<string, unknown> }>;
}

function buildMockSupabase(state: MockState) {
  const calls = {
    listUsers: 0,
    createUser: 0,
    deleteUser: 0,
    studentSelect: 0,
    studentUpdate: 0,
  };

  const mock = {
    from: vi.fn((table: string) => {
      if (table !== 'students') {
        throw new Error(`Mock: unexpected table=${table}`);
      }
      return {
        select: vi.fn((_cols: string) => {
          calls.studentSelect += 1;
          return {
            order: vi.fn(() => Promise.resolve({ data: state.students, error: null })),
          };
        }),
        update: vi.fn((patch: Partial<StudentRow>) => {
          calls.studentUpdate += 1;
          return {
            eq: vi.fn((col: string, val: string) => {
              if (col === 'id') {
                const target = state.students.find((s) => s.id === val);
                if (target) {
                  Object.assign(target, patch);
                }
              } else if (col === 'user_id') {
                // Rollback path: NULL all matching student.user_id
                for (const s of state.students) {
                  if (s.user_id === val) Object.assign(s, patch);
                }
              }
              return Promise.resolve({ error: null });
            }),
          };
        }),
      };
    }),
    auth: {
      admin: {
        listUsers: vi.fn(() => {
          calls.listUsers += 1;
          return Promise.resolve({
            data: { users: state.authUsers },
            error: null,
          });
        }),
        createUser: vi.fn((payload: { email: string; app_metadata: Record<string, unknown> }) => {
          calls.createUser += 1;
          const newUser = {
            id: `auth-${state.authUsers.length + 1}`,
            email: payload.email,
            app_metadata: payload.app_metadata,
          };
          state.authUsers.push(newUser);
          return Promise.resolve({ data: { user: newUser }, error: null });
        }),
        deleteUser: vi.fn((id: string) => {
          calls.deleteUser += 1;
          state.authUsers = state.authUsers.filter((u) => u.id !== id);
          return Promise.resolve({ error: null });
        }),
      },
    },
  };

  return { client: mock as never, calls, state };
}

// ─────────────────────────────────────────────────────────────────────────
// processStudent
// ─────────────────────────────────────────────────────────────────────────

describe('processStudent', () => {
  let mock: ReturnType<typeof buildMockSupabase>;

  beforeEach(() => {
    mock = buildMockSupabase({
      students: [
        { id: 'stu-1', user_id: null, school_id: 'sch-1', display_name: 'A' },
        { id: 'stu-2', user_id: 'auth-existing', school_id: 'sch-1', display_name: 'B' },
      ],
      authUsers: [],
    });
  });

  it('creates auth.users + links student.user_id when both are absent', async () => {
    const out = await processStudent(mock.client, mock.state.students[0], { dryRun: false });
    expect(out).toEqual({ kind: 'created', userId: 'auth-1' });
    expect(mock.calls.createUser).toBe(1);
    expect(mock.calls.studentUpdate).toBe(1);
    expect(mock.state.students[0].user_id).toBe('auth-1');
    expect(mock.state.authUsers[0].email).toBe(
      'student-stu-1@students.studioloom.local'
    );
  });

  it('skips when student.user_id is already set', async () => {
    const out = await processStudent(mock.client, mock.state.students[1], { dryRun: false });
    expect(out).toEqual({ kind: 'skipped', reason: 'already_linked' });
    expect(mock.calls.createUser).toBe(0);
    expect(mock.calls.studentUpdate).toBe(0);
  });

  it('reuses an existing auth.users row when email already exists (resume path)', async () => {
    // Seed: auth.users row exists with the synthetic email but student.user_id is still NULL.
    // This is the "previous run crashed mid-pair" case.
    mock.state.authUsers.push({
      id: 'auth-resumed',
      email: 'student-stu-1@students.studioloom.local',
      app_metadata: { user_type: 'student', created_via: 'phase-1-1-backfill' },
    });

    const out = await processStudent(mock.client, mock.state.students[0], { dryRun: false });
    expect(out).toEqual({ kind: 'reused', userId: 'auth-resumed' });
    expect(mock.calls.createUser).toBe(0);   // did NOT create a duplicate
    expect(mock.calls.studentUpdate).toBe(1); // DID re-link
    expect(mock.state.students[0].user_id).toBe('auth-resumed');
  });

  it('dry-run performs no writes', async () => {
    const out = await processStudent(mock.client, mock.state.students[0], { dryRun: true });
    expect(out.kind).toBe('created');
    expect(mock.calls.createUser).toBe(0);
    expect(mock.calls.studentUpdate).toBe(0);
  });

  it('reports failure when createUser returns an error (continues; no throw)', async () => {
    mock.client.auth.admin.createUser = vi.fn(() =>
      Promise.resolve({
        data: { user: null },
        error: { message: 'duplicate email' },
      })
    );

    const out = await processStudent(mock.client, mock.state.students[0], { dryRun: false });
    expect(out.kind).toBe('failed');
    if (out.kind === 'failed') {
      expect(out.error).toMatch(/createUser: duplicate email/);
    }
  });

  it('reports failure when student UPDATE fails', async () => {
    // Override: mock.from('students').update().eq() to return an error.
    mock.client.from = vi.fn((table: string) => {
      if (table !== 'students') throw new Error('unexpected table');
      return {
        select: vi.fn(),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: 'rls denied' } })),
        })),
      };
    });

    const out = await processStudent(mock.client, mock.state.students[0], { dryRun: false });
    expect(out.kind).toBe('failed');
    if (out.kind === 'failed') {
      expect(out.error).toMatch(/update students.user_id: rls denied/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// runForwardBackfill
// ─────────────────────────────────────────────────────────────────────────

describe('runForwardBackfill', () => {
  it('reports counts correctly and writes nothing in dry-run', async () => {
    const mock = buildMockSupabase({
      students: [
        { id: 'stu-1', user_id: null, school_id: 'sch-1', display_name: 'A' },
        { id: 'stu-2', user_id: null, school_id: 'sch-1', display_name: 'B' },
        { id: 'stu-3', user_id: 'auth-pre', school_id: 'sch-1', display_name: 'C' },
      ],
      authUsers: [],
    });

    const result = await runForwardBackfill(mock.client, { dryRun: true });
    expect(result.totalStudents).toBe(3);
    expect(result.alreadyBackfilled).toBe(1);
    expect(result.pendingBackfill).toBe(2);
    expect(result.processed).toBe(0); // dry-run doesn't increment processed
    expect(mock.calls.createUser).toBe(0);
    expect(mock.calls.studentUpdate).toBe(0);
  });

  it('processes each pending student in live mode and reports correct totals', async () => {
    const mock = buildMockSupabase({
      students: [
        { id: 'stu-1', user_id: null, school_id: 'sch-1', display_name: 'A' },
        { id: 'stu-2', user_id: null, school_id: null, display_name: 'B (orphan)' },
        { id: 'stu-3', user_id: 'auth-pre', school_id: 'sch-1', display_name: 'C' },
      ],
      authUsers: [],
    });

    const result = await runForwardBackfill(mock.client, { dryRun: false });
    expect(result.totalStudents).toBe(3);
    expect(result.alreadyBackfilled).toBe(1);
    expect(result.pendingBackfill).toBe(2);
    expect(result.processed).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.reused).toBe(0);
    expect(result.failed).toBe(0);
    expect(mock.calls.createUser).toBe(2);
  });

  it('is idempotent — re-running on a fully-backfilled state is a no-op', async () => {
    const mock = buildMockSupabase({
      students: [
        { id: 'stu-1', user_id: 'auth-1', school_id: 'sch-1', display_name: 'A' },
        { id: 'stu-2', user_id: 'auth-2', school_id: 'sch-1', display_name: 'B' },
      ],
      authUsers: [
        { id: 'auth-1', email: 'student-stu-1@students.studioloom.local', app_metadata: {} },
        { id: 'auth-2', email: 'student-stu-2@students.studioloom.local', app_metadata: {} },
      ],
    });

    const result = await runForwardBackfill(mock.client, { dryRun: false });
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.failed).toBe(0);
    expect(mock.calls.createUser).toBe(0);
    expect(mock.calls.studentUpdate).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// runRollback
// ─────────────────────────────────────────────────────────────────────────

describe('runRollback', () => {
  it('deletes auth.users tagged with the phase tag and NULLs matching student.user_id', async () => {
    const mock = buildMockSupabase({
      students: [
        { id: 'stu-1', user_id: 'auth-1', school_id: 'sch-1', display_name: 'A' },
        { id: 'stu-2', user_id: 'auth-pre', school_id: 'sch-1', display_name: 'B' },
      ],
      authUsers: [
        {
          id: 'auth-1',
          email: 'student-stu-1@students.studioloom.local',
          app_metadata: { user_type: 'student', created_via: 'phase-1-1-backfill' },
        },
        {
          id: 'auth-pre',
          email: 'pre-existing@example.com',
          app_metadata: { user_type: 'teacher' }, // NOT created by this script
        },
      ],
    });

    const result = await runRollback(mock.client, { dryRun: false });
    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(0);
    expect(mock.state.authUsers.find((u) => u.id === 'auth-1')).toBeUndefined();
    expect(mock.state.authUsers.find((u) => u.id === 'auth-pre')).toBeDefined();
    expect(mock.state.students[0].user_id).toBeNull();
    expect(mock.state.students[1].user_id).toBe('auth-pre'); // untouched
  });

  it('dry-run rollback performs no writes', async () => {
    const mock = buildMockSupabase({
      students: [{ id: 'stu-1', user_id: 'auth-1', school_id: 'sch-1', display_name: 'A' }],
      authUsers: [
        {
          id: 'auth-1',
          email: 'student-stu-1@students.studioloom.local',
          app_metadata: { created_via: 'phase-1-1-backfill' },
        },
      ],
    });

    const result = await runRollback(mock.client, { dryRun: true });
    expect(result.deleted).toBe(0);
    expect(mock.calls.deleteUser).toBe(0);
  });

  it('only targets auth.users with created_via=phase-1-1-backfill (does not delete other backfills)', async () => {
    const mock = buildMockSupabase({
      students: [],
      authUsers: [
        { id: 'p1', email: 'a', app_metadata: { created_via: 'phase-1-1-backfill' } },
        { id: 'p2', email: 'b', app_metadata: { created_via: 'phase-2-something-else' } },
        { id: 'p3', email: 'c', app_metadata: {} },
      ],
    });

    const result = await runRollback(mock.client, { dryRun: false });
    expect(result.deleted).toBe(1);
    expect(mock.state.authUsers.find((u) => u.id === 'p1')).toBeUndefined();
    expect(mock.state.authUsers.find((u) => u.id === 'p2')).toBeDefined();
    expect(mock.state.authUsers.find((u) => u.id === 'p3')).toBeDefined();
  });
});
