/**
 * RLS Test Harness — fixture helpers.
 *
 * Phase: Access Model v2 Phase 0.9
 *
 * Provides a thin ergonomic layer for live RLS tests:
 *   - getServiceClient()  — admin-bypass client for fixture setup/teardown
 *   - getAuthClient(jwt)  — auth-scoped client to test policies as a user
 *   - createTestSchool()  — disposable school + cleanup hook
 *   - createTestClass()
 *   - createTestStudent()
 *   - createTestTeacher()
 *   - tagFixture()        — every row gets a `__test_run_id` tag in the name
 *                           so cleanup is precise even on failure
 *
 * Tests using this harness should:
 *   1. Call `skipIfNoLiveSupabase()` at the top of the test file
 *   2. Use `withTestRun()` to scope fixtures + automatic cleanup
 *   3. Mint per-user clients with `getAuthClient(token)` to assert policies
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

/**
 * Skip the test file if live-Supabase env vars aren't set.
 * Use in describe.skipIf() or at the top of test setup.
 */
export function shouldSkipLiveSupabase(): boolean {
  return (
    !process.env.SUPABASE_TEST_URL ||
    !process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
  );
}

/**
 * Service-role client. Bypasses RLS — use only for fixture
 * setup/teardown, never to assert policy behaviour.
 */
export function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_TEST_URL;
  const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_TEST_URL + SUPABASE_TEST_SERVICE_ROLE_KEY required for live RLS tests'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Auth-scoped client. RLS policies apply.
 * Pass a JWT or session token minted via mint helpers.
 */
export function getAuthClient(jwt: string): SupabaseClient {
  const url = process.env.SUPABASE_TEST_URL;
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY required for auth-scoped client'
    );
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Generate a unique test-run tag. Every fixture row gets this in its
 * name so cleanup queries can target only this run's fixtures, even
 * if a previous run crashed mid-cleanup.
 *
 * Usage:
 *   const runId = newTestRunId();
 *   const school = await createTestSchool({ runId, name: 'Foo' });
 *   // school.name === '__rlstest_<runId>__Foo'
 *   // Later: cleanup matches by name LIKE '__rlstest_<runId>__%'
 */
export function newTestRunId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

export function tagName(runId: string, name: string): string {
  return `__rlstest_${runId}__${name}`;
}

/**
 * Create a disposable school. Returns the inserted row.
 */
export async function createTestSchool(opts: {
  runId: string;
  name: string;
  country?: string;
}): Promise<{ id: string; name: string; school_id: string }> {
  const client = getServiceClient();
  const taggedName = tagName(opts.runId, opts.name);
  const { data, error } = await client
    .from('schools')
    .insert({
      name: taggedName,
      country: opts.country ?? 'CN',
      source: 'user_submitted',
    })
    .select('id, name')
    .single();
  if (error || !data) {
    throw new Error(
      `createTestSchool failed: ${error?.message ?? 'no row returned'}`
    );
  }
  return { id: data.id, name: data.name, school_id: data.id };
}

/**
 * Create a disposable teacher under the given school.
 *
 * NOTE Phase 0.9: this stub creates a `teachers` row but does NOT mint
 * an auth.users row — that requires Supabase auth admin API and varies
 * per Supabase plan. Phase 1 unifies student auth and Phase 0.9's
 * starter tests use teacher self-read against an auth.uid() that
 * matches teachers.id. For now, tests that need a real teacher session
 * mint a user via supabase.auth.admin.createUser() in test setup.
 */
export async function createTestTeacher(opts: {
  runId: string;
  name: string;
  schoolId: string;
  email?: string;
}): Promise<{ id: string; name: string; school_id: string }> {
  const client = getServiceClient();
  const taggedName = tagName(opts.runId, opts.name);
  const taggedEmail =
    opts.email ?? `__rlstest_${opts.runId}__${opts.name}@test.local`;

  // Create auth.users row first (teachers.id FK references it)
  const { data: authUser, error: authErr } = await client.auth.admin.createUser({
    email: taggedEmail,
    password: randomUUID(), // Throwaway password; tests use admin token paths
    email_confirm: true,
    user_metadata: { name: taggedName },
  });
  if (authErr || !authUser?.user) {
    throw new Error(
      `createTestTeacher: auth user creation failed: ${authErr?.message ?? 'no user'}`
    );
  }

  // The on_auth_user_created trigger (mig 002) auto-inserts into teachers.
  // Update with school_id (the trigger doesn't know which school).
  const { error: updateErr } = await client
    .from('teachers')
    .update({ school_id: opts.schoolId, name: taggedName })
    .eq('id', authUser.user.id);
  if (updateErr) {
    throw new Error(`createTestTeacher: teacher update failed: ${updateErr.message}`);
  }

  return { id: authUser.user.id, name: taggedName, school_id: opts.schoolId };
}

/**
 * Create a disposable class under a teacher.
 */
export async function createTestClass(opts: {
  runId: string;
  name: string;
  teacherId: string;
  schoolId: string;
}): Promise<{ id: string; name: string }> {
  const client = getServiceClient();
  const taggedName = tagName(opts.runId, opts.name);
  const taggedCode = `__rlstest_${opts.runId}_${randomUUID().slice(0, 6)}`;
  const { data, error } = await client
    .from('classes')
    .insert({
      teacher_id: opts.teacherId,
      school_id: opts.schoolId,
      name: taggedName,
      code: taggedCode,
    })
    .select('id, name')
    .single();
  if (error || !data) {
    throw new Error(`createTestClass failed: ${error?.message ?? 'no row'}`);
  }
  return { id: data.id, name: data.name };
}

/**
 * Create a disposable student under a class.
 */
export async function createTestStudent(opts: {
  runId: string;
  name: string;
  classId: string;
  schoolId: string;
}): Promise<{ id: string; name: string }> {
  const client = getServiceClient();
  const taggedName = tagName(opts.runId, opts.name);
  const { data, error } = await client
    .from('students')
    .insert({
      class_id: opts.classId,
      school_id: opts.schoolId,
      username: taggedName,
      display_name: taggedName,
    })
    .select('id, username')
    .single();
  if (error || !data) {
    throw new Error(`createTestStudent failed: ${error?.message ?? 'no row'}`);
  }
  return { id: data.id, name: data.username };
}

/**
 * Cleanup all rows tagged with the given runId. Called automatically
 * by withTestRun(). Idempotent.
 */
export async function cleanupTestRun(runId: string): Promise<void> {
  const client = getServiceClient();
  const tag = `__rlstest_${runId}__`;

  // Order: leaf tables first, then parents
  // students → classes → schools (CASCADE handles class_members,
  // student_mentors, school_resources, etc. since they FK to these)
  await client.from('students').delete().like('username', `${tag}%`);
  await client.from('classes').delete().like('name', `${tag}%`);
  // teachers cleanup via auth.admin (trigger created the row)
  const { data: testTeachers } = await client
    .from('teachers')
    .select('id')
    .like('name', `${tag}%`);
  if (testTeachers) {
    for (const t of testTeachers) {
      await client.auth.admin.deleteUser(t.id);
    }
  }
  await client.from('schools').delete().like('name', `${tag}%`);
}

/**
 * Run a test inside a fresh test-run scope. Creates a runId, calls fn,
 * cleans up afterwards regardless of success/failure.
 */
export async function withTestRun<T>(
  fn: (runId: string) => Promise<T>
): Promise<T> {
  const runId = newTestRunId();
  try {
    return await fn(runId);
  } finally {
    await cleanupTestRun(runId).catch((err) => {
      console.error(`Cleanup failed for runId ${runId}:`, err);
    });
  }
}
