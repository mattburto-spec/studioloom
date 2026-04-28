# Phase 8-1 — Prod-Apply Smoke Checklist

**Audience:** Matt running the migration apply against prod Supabase.
**Pairs with:** [`preflight-phase-8-1-brief.md`](./preflight-phase-8-1-brief.md) §6 success criteria.
**Path:** A — mocked tests + manual RLS smoke (no live test harness — `FU-HH` P2 still tracks that gap).

This is the runbook for applying the Phase 8-1 migrations to prod and
verifying everything in §6's 15-criterion matrix passes. Each section
maps to numbered criteria from the brief.

---

## 0. Pre-apply state check

Before applying anything, confirm prod state matches what the brief
assumes (§6 pre-conditions). Run in Supabase SQL Editor:

```sql
-- Confirm schools table exists (migration 085) + has Nanjing
SELECT id, name, country
FROM schools
WHERE id = '636ff4fc-4413-4a8e-a3cd-c6f1e17bd5a1';
-- Expect: 1 row — Nanjing International School / CN

-- Confirm orphan/schooled/system teacher counts haven't changed
-- since 27 Apr pre-flight (1 system / 3 schooled / 1 distinct school)
SELECT
  COUNT(*) FILTER (WHERE school_id IS NULL AND email NOT LIKE '%@studioloom.internal') AS real_orphans,
  COUNT(*) FILTER (WHERE email LIKE '%@studioloom.internal')                            AS system_sentinels,
  COUNT(*) FILTER (WHERE school_id IS NOT NULL AND email NOT LIKE '%@studioloom.internal') AS schooled_real,
  COUNT(DISTINCT school_id) FILTER (WHERE school_id IS NOT NULL)                       AS distinct_schools
FROM teachers;
-- Expect (as of 27 Apr): real_orphans=0, system_sentinels=1,
-- schooled_real=3, distinct_schools=1.
-- If real_orphans > 0, a new orphan teacher joined since pre-flight
-- — handle them manually before running the backfill, OR rely on
-- the orphan-modal path the brief documents for future onboards.
```

If the numbers don't match, **stop and report**. The migration will
still work but the success criteria's expected counts will be off.

---

## 1. Apply the schema migration

In the Supabase SQL Editor, paste the entire contents of:

```
supabase/migrations/20260427134953_fabrication_labs.sql
```

Click "Run". Expect: success, no errors. If errors:
- `relation "schools" does not exist` → migration 085 hasn't applied. Stop.
- `function update_updated_at_column does not exist` → check
  migrations 001 / 093 / 096 ran. Stop.
- Any RLS / policy syntax error → stop and report.

### Verification queries (criteria #1 — schema applied cleanly)

```sql
-- Table exists with the right columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fabrication_labs'
ORDER BY ordinal_position;
-- Expect: id (uuid, NO), school_id (uuid, NO), created_by_teacher_id (uuid, YES),
--         name (text, NO), description (text, YES), created_at (tz, NO), updated_at (tz, NO)

-- New columns on existing tables
SELECT
  (SELECT 1 FROM information_schema.columns WHERE table_name='machine_profiles' AND column_name='lab_id') AS mp_lab_id_added,
  (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='default_lab_id') AS classes_default_lab_added,
  (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='default_lab_id') AS teachers_default_lab_added;
-- Expect: 1, 1, 1 across all three.

-- Helper function exists with right signature
SELECT prosecdef AS security_definer, provolatile AS volatility
FROM pg_proc
WHERE proname = 'current_teacher_school_id';
-- Expect: 1 row, security_definer=true, volatility='s' (STABLE).

-- 4 RLS policies attached
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'fabrication_labs'::regclass
ORDER BY polname;
-- Expect: 4 rows — one each for SELECT, INSERT, UPDATE, DELETE.
```

---

## 2. Apply the backfill migration

Paste the entire contents of:

```
supabase/migrations/20260427135108_backfill_fabrication_labs.sql
```

Click "Run". The migration's trailing DO block emits NOTICEs to the
log. Expect a final block that looks like:

```
NOTICE:  Phase 8-1 backfill verification:
NOTICE:    fabrication_labs rows created: 1
NOTICE:    real-teacher machines still NULL (expected 0): 0
NOTICE:    real-teacher classes still NULL (expected 0): 0
NOTICE:    real-teacher teachers still NULL (expected 0): 0
NOTICE:    system sentinel accounts intentionally excluded: 1
```

If any "real-teacher … still NULL" count is > 0, **stop and report**
— that's a backfill correctness bug that should be fixed before any
8-2 work.

### Verification queries (criteria #2-#9)

```sql
-- #4 PASS 1: one Default lab created for Nanjing
SELECT id, school_id, name, created_by_teacher_id
FROM fabrication_labs;
-- Expect: 1 row, school_id=Nanjing UUID, name='Default lab',
-- created_by_teacher_id = Matt's earliest persona.

-- #5 PASS 2: every real-teacher non-template machine has a lab
SELECT COUNT(*) AS unassigned_real_machines
FROM machine_profiles mp
JOIN teachers t ON t.id = mp.teacher_id
WHERE mp.is_system_template = false
  AND mp.lab_id IS NULL
  AND t.school_id IS NOT NULL
  AND t.email NOT LIKE '%@studioloom.internal';
-- Expect: 0

-- #6 PASS 3: every real teacher with a school has a default
SELECT COUNT(*) AS teachers_without_default
FROM teachers
WHERE school_id IS NOT NULL
  AND email NOT LIKE '%@studioloom.internal'
  AND default_lab_id IS NULL;
-- Expect: 0

-- #7 PASS 4: every class owned by such a teacher has a default
SELECT COUNT(*) AS classes_without_default
FROM classes c
JOIN teachers t ON t.id = c.teacher_id
WHERE c.default_lab_id IS NULL
  AND t.email NOT LIKE '%@studioloom.internal'
  AND t.default_lab_id IS NOT NULL;
-- Expect: 0

-- #8 system-sentinel preservation
SELECT id, email, school_id, default_lab_id
FROM teachers
WHERE email LIKE '%@studioloom.internal';
-- Expect: 1 row, school_id=NULL, default_lab_id=NULL.
-- AND no fabrication_labs row should reference this teacher's id
SELECT COUNT(*)
FROM fabrication_labs fl
JOIN teachers t ON t.id = fl.created_by_teacher_id
WHERE t.email LIKE '%@studioloom.internal';
-- Expect: 0

-- #9 idempotency: re-run the backfill in a transaction we'll roll back
BEGIN;
-- (paste the entire backfill SQL here)
-- The verification block should still report 1 lab / 0 orphans /
-- 1 system excluded — same as the first run.
-- Then check no new lab rows were created:
SELECT COUNT(*) FROM fabrication_labs;
-- Expect: still 1
ROLLBACK;
```

---

## 3. Cross-school RLS smoke (criteria #10-#12)

This is the **manual UI smoke** — the part path A trades off against
building the live test harness. Three browser sessions needed:

### Setup (one-time, 5 min)

1. As Matt (logged in to studioloom.org):
   - Sign up a fresh test account: `test-teacher-A@example.com`
   - Pick "Nanjing International School" in the welcome wizard
2. Sign up a second test account: `test-teacher-B@example.com`
   - In welcome wizard, pick **"NIST International School"** (Bangkok,
     `ac7b575b-f439-4db1-8e46-039bc9f02726`) — different school
3. Verify with SQL:
   ```sql
   SELECT id, email, school_id FROM teachers
   WHERE email IN ('test-teacher-A@example.com', 'test-teacher-B@example.com');
   ```

If you can't / don't want to use the welcome wizard, set school_id
manually:

```sql
UPDATE teachers SET school_id = '636ff4fc-4413-4a8e-a3cd-c6f1e17bd5a1'
WHERE email = 'test-teacher-A@example.com';

UPDATE teachers SET school_id = 'ac7b575b-f439-4db1-8e46-039bc9f02726'
WHERE email = 'test-teacher-B@example.com';
```

### #11 — Same-school flat sharing

1. Sign in as **Matt** on browser 1.
2. Sign in as **Test Teacher A** (Nanjing) on browser 2.
3. Both should see the same fabrication_labs row when querying via
   the API surface 8-2 will expose. Until 8-2 ships, we can verify
   the RLS predicate by impersonating each teacher in SQL Editor:

```sql
-- Simulate auth.uid() = Matt
SET LOCAL request.jwt.claim.sub = '0f610a0b-1471-4cb6-82a1-7a4bae48f67c';
SET LOCAL ROLE authenticated;
SELECT id, school_id, name FROM fabrication_labs;
RESET ROLE;
RESET request.jwt.claim.sub;
-- Expect: 1 row (Nanjing's Default lab)

-- Simulate auth.uid() = Test Teacher A (also Nanjing)
SET LOCAL request.jwt.claim.sub = '<test-teacher-A-uuid>';
SET LOCAL ROLE authenticated;
SELECT id, school_id, name FROM fabrication_labs;
RESET ROLE;
RESET request.jwt.claim.sub;
-- Expect: SAME 1 row (flat membership — both at Nanjing see the same lab)
```

### #10 — Cross-school invisibility

```sql
-- Simulate auth.uid() = Test Teacher B (NIST Bangkok)
SET LOCAL request.jwt.claim.sub = '<test-teacher-B-uuid>';
SET LOCAL ROLE authenticated;
SELECT id, school_id, name FROM fabrication_labs;
RESET ROLE;
RESET request.jwt.claim.sub;
-- Expect: 0 rows (RLS filters silently — no "permission denied" error,
-- just empty result. NIST teacher cannot see Nanjing's labs.)
```

```sql
-- Test Teacher B tries to INSERT a lab claiming Nanjing's school_id
SET LOCAL request.jwt.claim.sub = '<test-teacher-B-uuid>';
SET LOCAL ROLE authenticated;
INSERT INTO fabrication_labs (school_id, name)
VALUES ('636ff4fc-4413-4a8e-a3cd-c6f1e17bd5a1', 'Sneaky lab')
RETURNING id;
RESET ROLE;
RESET request.jwt.claim.sub;
-- Expect: ERROR — "new row violates row-level security policy".
-- The WITH CHECK on INSERT rejects writes claiming a school the
-- caller doesn't belong to.
```

```sql
-- Test Teacher B tries to UPDATE Matt's lab (same predicate path)
SET LOCAL request.jwt.claim.sub = '<test-teacher-B-uuid>';
SET LOCAL ROLE authenticated;
UPDATE fabrication_labs SET name = 'Hijacked'
WHERE school_id = '636ff4fc-4413-4a8e-a3cd-c6f1e17bd5a1';
RESET ROLE;
RESET request.jwt.claim.sub;
-- Expect: 0 rows updated (RLS USING filters out the row before
-- the update can apply).
```

### #12 — Orphan + sentinel denial

```sql
-- Simulate auth.uid() = system sentinel (school_id IS NULL)
SET LOCAL request.jwt.claim.sub = '3ac01f99-26cf-45be-b95f-8a4d1541b913';
SET LOCAL ROLE authenticated;
SELECT id FROM fabrication_labs;
RESET ROLE;
RESET request.jwt.claim.sub;
-- Expect: 0 rows. current_teacher_school_id() returns NULL → policy
-- predicate `school_id = NULL` evaluates to NULL → row filtered.
```

---

## 4. Phase 7 regression check (criterion #13)

Quick smoke through the full pipeline to confirm nothing broke:

1. As a student, upload an STL.
2. As Matt teacher, approve it.
3. As Cynthia fab, pick it up + mark complete.
4. Confirm the student's status page shows green completion.

If any step hangs, errors, or shows wrong data — **stop and report**.

---

## 5. Sign-off

When all criteria pass:

1. Update the brief §4 success criteria checkboxes (mark all green).
2. Tell Claude: **"8-1 done, open 8-2"** (or just say "8-2").
3. Claude merges `preflight-active` to `main` (4 commits land at once).
4. Claude opens the 8-2 sub-brief.

If any criterion fails:

1. Don't merge. Claude debugs from `preflight-active`.
2. Fixes go on the same branch.
3. Re-apply migrations to a fresh DB locally to verify the fix
   before another prod try.

---

## 6. Rollback path (if all goes wrong post-apply)

Both migrations have rollbacks. Apply in reverse order:

```sql
-- Backfill rollback is a no-op (data lives in the table being dropped)
-- Schema rollback drops everything in the right order
```

Paste the contents of `20260427134953_fabrication_labs.down.sql` —
this drops policies → function → columns → table. After rollback, all
3 new columns disappear from `machine_profiles` / `classes` / `teachers`,
the helper function is gone, the table is gone, and prod is back to
pre-Phase-8-1 state. Phase 7 still works identically.

If you've already created any "real" labs (named beyond "Default
lab") via 8-2 UI before rollback, those rows die with the table —
they're not preserved. That's why this rollback only makes sense as
an immediate-incident response, not as a long-term backout strategy.
