# FU-N Manual Smoke Protocol — Dual-Visibility RLS Verification

> **When:** After migration 078 is applied to prod.
> **Who:** Matt, via Supabase SQL editor + browser.
> **Why:** SQL-parse tests prove the policy SQL is shaped correctly; this smoke proves it actually works in the live DB.

---

## Pre-apply probe (run BEFORE applying 078)

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname='public' AND tablename='student_content_moderation_log'
ORDER BY policyname;
```

Expected: 3 policies — `student_moderation_log_service_all`, `student_moderation_log_teacher_select`, `student_moderation_log_teacher_update`. The SELECT + UPDATE policies should show `class_id IN (...)` with NO `OR` clause (the old shape).

---

## Apply migration 078

Run the full SQL from `supabase/migrations/078_moderation_log_dual_visibility.sql` in the Supabase SQL editor.

---

## Post-apply verify (run AFTER applying 078)

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname='public' AND tablename='student_content_moderation_log'
ORDER BY policyname;
```

Expected: 3 policies. The SELECT + UPDATE policies should now show the UNION subqueries in the `qual` column. Look for `class_id IS NULL AND student_id IN` in both.

---

## Smoke test cases

### Setup: identify test fixtures

```sql
-- Pick a teacher
SELECT id, email FROM auth.users WHERE raw_user_meta_data->>'role' = 'teacher' LIMIT 2;
-- Note T1_ID and T2_ID

-- Pick a student in T1's class (junction path)
SELECT cs.student_id, cs.class_id, c.teacher_id
FROM class_students cs
JOIN classes c ON cs.class_id = c.id
WHERE c.teacher_id = '<T1_ID>'
LIMIT 1;
-- Note S1_ID and C1_ID

-- Pick a student in T2's class (legacy path)
SELECT s.id, s.class_id, c.teacher_id
FROM students s
JOIN classes c ON s.class_id = c.id
WHERE c.teacher_id = '<T2_ID>'
LIMIT 1;
-- Note S2_ID and C2_ID
```

### Test 1: NULL-class_id row visible to correct teacher

```sql
-- Insert a NULL-class_id row for S1 (in T1's class)
INSERT INTO student_content_moderation_log (
  class_id, student_id, content_source, moderation_layer,
  flags, overall_result, severity
) VALUES (
  NULL, '<S1_ID>', 'tool_session', 'server_haiku',
  '[{"type": "profanity", "severity": "warning", "confidence": 0.9}]'::jsonb,
  'flagged', 'warning'
) RETURNING id;
-- Note SMOKE_ROW_ID
```

### Test 2: T1 sees the row, T2 does not

```sql
-- As T1 (set role to authenticated, set auth.uid() to T1_ID)
SET request.jwt.claims = '{"sub": "<T1_ID>", "role": "authenticated"}';
SET role = 'authenticated';

SELECT id, class_id, student_id, content_source
FROM student_content_moderation_log
WHERE id = '<SMOKE_ROW_ID>';
-- EXPECT: 1 row returned

-- Reset
RESET role;

-- As T2
SET request.jwt.claims = '{"sub": "<T2_ID>", "role": "authenticated"}';
SET role = 'authenticated';

SELECT id, class_id, student_id, content_source
FROM student_content_moderation_log
WHERE id = '<SMOKE_ROW_ID>';
-- EXPECT: 0 rows (CRITICAL — cross-teacher negative)

RESET role;
```

### Test 3: class_id path still works (regression check)

```sql
-- Insert a row WITH class_id for S1 in C1
INSERT INTO student_content_moderation_log (
  class_id, student_id, content_source, moderation_layer,
  flags, overall_result, severity
) VALUES (
  '<C1_ID>', '<S1_ID>', 'student_progress', 'server_haiku',
  '[{"type": "violence", "severity": "critical", "confidence": 0.95}]'::jsonb,
  'blocked', 'critical'
) RETURNING id;
-- Note CLASS_ROW_ID

SET request.jwt.claims = '{"sub": "<T1_ID>", "role": "authenticated"}';
SET role = 'authenticated';

SELECT id FROM student_content_moderation_log WHERE id = '<CLASS_ROW_ID>';
-- EXPECT: 1 row

RESET role;
```

### Test 4: Legacy path works (students.class_id)

```sql
-- Insert NULL-class_id row for S2 (in T2's class via legacy path)
INSERT INTO student_content_moderation_log (
  class_id, student_id, content_source, moderation_layer,
  flags, overall_result, severity
) VALUES (
  NULL, '<S2_ID>', 'upload_image', 'server_haiku',
  '[{"type": "sexual", "severity": "critical", "confidence": 0.85}]'::jsonb,
  'blocked', 'critical'
) RETURNING id;
-- Note LEGACY_ROW_ID

SET request.jwt.claims = '{"sub": "<T2_ID>", "role": "authenticated"}';
SET role = 'authenticated';

SELECT id FROM student_content_moderation_log WHERE id = '<LEGACY_ROW_ID>';
-- EXPECT: 1 row (T2 sees it via legacy students.class_id path)

RESET role;

SET request.jwt.claims = '{"sub": "<T1_ID>", "role": "authenticated"}';
SET role = 'authenticated';

SELECT id FROM student_content_moderation_log WHERE id = '<LEGACY_ROW_ID>';
-- EXPECT: 0 rows (T1 cannot see T2's student)

RESET role;
```

### Cleanup

```sql
-- Remove smoke test rows
DELETE FROM student_content_moderation_log
WHERE id IN ('<SMOKE_ROW_ID>', '<CLASS_ROW_ID>', '<LEGACY_ROW_ID>');
```

---

## Pass criteria

- Test 1: Insert succeeds (NULL class_id is allowed by schema)
- Test 2: T1 sees 1 row, T2 sees 0 rows (**critical**)
- Test 3: class_id path returns 1 row (no regression)
- Test 4: Legacy path returns 1 row for T2, 0 rows for T1

## If any test fails

- Test 2 T2 sees rows → policy is over-permissive, STOP, do not proceed
- Test 2 T1 sees 0 rows → UNION subquery isn't matching, check class_students has rows for S1
- Test 3 fails → class_id path broken, regression in 078
- Test 4 fails → legacy path not in UNION, check students.class_id is populated for S2
