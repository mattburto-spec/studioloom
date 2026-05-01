# Phase 3 — Smoke Playbook (Checkpoint A4 prep)

**Project:** Access Model v2 Phase 3 — Class Roles & Permissions
**Brief:** [`access-model-v2-phase-3-brief.md`](./access-model-v2-phase-3-brief.md) §3.5 + §7
**Branch:** `access-model-v2-phase-3` (NOT merged to main)
**Prod-preview URL:** `https://studioloom-git-access-model-v2-phase-3-mattburto-spec.vercel.app`
**Migrations applied to prod:** ✅ 3.0 + 3.1 + 3.4b (verified by Matt 1 May 2026)

---

## Pre-flight (one-time setup)

Phase 3 ships co-teacher / mentor / dept_head capability via class_members + student_mentors rows. NIS prod has 0 of these rows (only Phase 0.8a-backfilled lead_teacher rows). To smoke the new capabilities, you'll need to seed test rows.

### Step 1 — pick test fixtures

You need 2 teacher accounts you can sign in as (e.g., your `mattburton@nanjing-school.com` and `hello@loominary.org` — both Phase 2 OAuth-provisioned). Decide:

- **Class A** — owned by Teacher 1 (you've been signing in as this for Phase 2 smoke)
- **Class B** — owned by Teacher 2 (different from the lead-teacher of Class A)
- **Student S** — enrolled in Class A (any student in your test data works)

Run this in Supabase SQL editor to confirm your fixtures:

```sql
-- Confirm 2 distinct teachers + at least 2 active classes between them
SELECT t.id, t.email, t.school_id, COUNT(DISTINCT c.id) AS classes
FROM teachers t
LEFT JOIN classes c ON c.teacher_id = t.id AND c.is_archived IS NOT TRUE
WHERE t.school_id IS NOT NULL
GROUP BY t.id, t.email, t.school_id
ORDER BY classes DESC LIMIT 5;

-- Pick a student in one of these classes
SELECT s.id, s.username, cs.class_id, c.name AS class_name
FROM students s
JOIN class_students cs ON cs.student_id = s.id AND cs.is_active = true
JOIN classes c ON c.id = cs.class_id AND c.is_archived IS NOT TRUE
LIMIT 5;
```

Note down: `TEACHER_1_USER_ID`, `TEACHER_2_USER_ID`, `CLASS_A_ID`, `CLASS_B_ID`, `STUDENT_ID`.

### Step 2 — seed a co_teacher membership

Make Teacher 2 a co_teacher of Class A:

```sql
INSERT INTO class_members (class_id, member_user_id, role, accepted_at)
VALUES ('<CLASS_A_ID>', '<TEACHER_2_USER_ID>', 'co_teacher', now())
ON CONFLICT DO NOTHING;
```

### Step 3 — seed a student_mentors row (cross-class mentor scope)

Make Teacher 2 the mentor for Student S (who's in Class A, owned by Teacher 1 — Teacher 2 is NOT a class member, just a per-student mentor):

```sql
-- Remove the co_teacher row from Step 2 first if you want to test pure-mentor isolation:
-- DELETE FROM class_members WHERE class_id = '<CLASS_A_ID>' AND member_user_id = '<TEACHER_2_USER_ID>';

INSERT INTO student_mentors (student_id, mentor_user_id, programme)
VALUES ('<STUDENT_ID>', '<TEACHER_2_USER_ID>', 'pp')
ON CONFLICT DO NOTHING;
```

### Step 4 — verify seeded state

```sql
SELECT 'class_members' AS source, class_id::text AS scope, member_user_id::text AS member, role
FROM class_members
WHERE removed_at IS NULL AND member_user_id IN ('<TEACHER_1_USER_ID>', '<TEACHER_2_USER_ID>')
UNION ALL
SELECT 'student_mentors', student_id::text, mentor_user_id::text, programme
FROM student_mentors
WHERE deleted_at IS NULL AND mentor_user_id IN ('<TEACHER_1_USER_ID>', '<TEACHER_2_USER_ID>')
ORDER BY 1, 2;
```

Expected rows: Teacher 1 lead_teacher of Class A + Class B (Phase 0.8a backfill); Teacher 2 lead_teacher of Class B (backfill) + co_teacher of Class A (Step 2) + mentor of Student S (Step 3).

---

## Smoke scenarios — 5 scenarios, ~15 min total

Sign in as the listed teacher, hit the URL, confirm expected behaviour. **Use the prod-preview branch alias URL** (Lesson #63 — not the deployment-pinned URL).

### Scenario 1 — Baseline: lead_teacher full access (regression check)

- Sign in as **Teacher 1**.
- Navigate to `/teacher` dashboard.
- **Expect:** Class A + Class B both visible.
- Click into a unit on Class A, edit lesson content, save.
- **Expect:** Save succeeds. Author still passes the helper.
- **Pass:** ✅ / ❌ (note any regression)

### Scenario 2 — Co_teacher: shared class visibility + edit capability ⭐ (the headline gain)

- Sign in as **Teacher 2** (the co_teacher of Class A from Step 2).
- Navigate to `/teacher` dashboard.
- **Expect:** Class B visible (lead_teacher own). Class A **also** visible (co_teacher seeded).
- Click into Class A. Try to edit a unit's master content (PATCH `/api/teacher/units/[unitId]/content`).
- **Expect:** Edit succeeds even though Teacher 2 is NOT the unit author — co_teacher of a class containing the unit grants `unit.edit` per the matrix.
- Try to delete Class A (UI delete button if surfaced).
- **Expect:** **403 / fail.** Co_teacher does NOT have `class.delete` per the matrix (lead_teacher only).
- **Pass:** ✅ / ❌

### Scenario 3 — Mentor: cross-class student visibility (closes FU-MENTOR-SCOPE)

If you removed the co_teacher row in Step 3 (pure-mentor isolation test):

- Sign in as **Teacher 2** (the mentor of Student S, NOT a member of Class A).
- Navigate to `/teacher` dashboard.
- **Expect:** Class A NOT visible (not a class member). Class B visible (lead_teacher own).
- Visit Student S's profile via the mentor entry-point (e.g. directly via URL `/teacher/students/<STUDENT_ID>`).
- **Expect:** Student S visible (student_mentors row grants `student.view`).
- Try to message the student (if UI surfaces this).
- **Expect:** Succeeds (`student.message` in mentor matrix).
- Try to edit student support settings.
- **Expect:** **403 / fail** (mentor matrix does NOT include `student.edit`).
- **Pass:** ✅ / ❌

If you kept BOTH the co_teacher and mentor rows: Teacher 2 sees Class A on dashboard (via co_teacher) AND can view/message Student S (via mentor or via class — both paths grant `student.view`). Combined-scope OK.

### Scenario 4 — Non-member: 404 / empty visibility

- Stay signed in as **Teacher 2** (with co_teacher + mentor rows).
- Pick a class neither teacher is a member of. If you don't have one, create a third teacher account or accept that the negative control is mostly RLS-trust at this stage.
- Try to visit that class's URL directly.
- **Expect:** 404 / empty data. RLS + can() reject.
- **Pass:** ✅ / ❌ / ⏭️ skip (acceptable — covered by Phase 3.2 unit tests)

### Scenario 5 — `/api/teacher/me/scope` shape

- Stay signed in as **Teacher 2**.
- Open the URL `https://<branch-alias>/api/teacher/me/scope` in browser or `curl -b cookies.txt` it.
- **Expect:** JSON shape with at least:
  ```json
  {
    "scopes": [
      { "scope": "class:<B>", "role": "lead_teacher", "class_name": "..." },
      { "scope": "class:<A>", "role": "co_teacher", "class_name": "..." },
      { "scope": "student:<S>", "role": "mentor", "programme": "pp", "student_name": "..." }
    ],
    "fetched_at": "..."
  }
  ```
- **Verify:** Cache-Control header is `private, max-age=30` (browser DevTools Network tab or `curl -i`).
- **Pass:** ✅ / ❌

---

## Cleanup (after smoke)

```sql
-- Remove the test rows so prod data stays clean:
DELETE FROM class_members
  WHERE class_id = '<CLASS_A_ID>'
    AND member_user_id = '<TEACHER_2_USER_ID>'
    AND role = 'co_teacher';

DELETE FROM student_mentors
  WHERE student_id = '<STUDENT_ID>'
    AND mentor_user_id = '<TEACHER_2_USER_ID>';
```

---

## Pass criteria for Checkpoint A4

All 5 scenarios PASS (or 4 PASS + Scenario 4 ⏭️ skipped as covered by unit tests). Vercel logs during smoke show zero `Invalid session` or RLS-policy errors. No regression on existing teacher functionality (Scenario 1 PASS).

If any scenario fails, **flip the kill-switch flag** to fall back to legacy behaviour without deploy:

```sql
UPDATE admin_settings SET value = 'false'::jsonb
WHERE key = 'auth.permission_helper_rollout';
```

Then file an issue + report. Phase 3.5 status: blocked until resolved.

---

## On PASS

1. Reply to Claude with "Checkpoint A4 PASS" + which scenarios passed.
2. Claude merges `access-model-v2-phase-3` → `main` via fast-forward (after running `verify-no-collision.sh`).
3. Phase 3 closed. Phase 4 (School Registration, Settings & Governance) is the next master-spec phase.
