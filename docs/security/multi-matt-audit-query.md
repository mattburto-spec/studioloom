# Multi-Matt Prod Data Audit

**Phase:** Access Model v2 Phase 0.9 (audit-derived deliverable)
**Source:** `access-model-v2.md` §6 Risks row + §10 Pre-Build Checklist item 14
**Type:** Read-only diagnostic — does NOT modify prod data

## Why this exists

Three teacher rows in NIS prod have `display_name = NULL` and `name = "Matt"`:

- `0f610a0b — mattburto@gmail.com`
- `e59fb92f — hello@loominary.org`
- `27818389 — mattburton@nanjing-school.com`

Plus one system row (`3ac01f99 — system@studioloom.internal`).

Phase 0.8a's orphan-teacher backfill was designed NOT to silently merge teacher rows with the same display name — each existing teacher row keeps its own `school_id`. That decision was logged in §6 Risks. This audit query surfaces ALL duplicate-name candidates (3 Matts + any others) so the Phase 6 cutover decision ("merge or keep separate?") has the data it needs.

## The audit query

Run in Supabase SQL editor against prod. **Read-only — no UPDATE/DELETE/INSERT.**

```sql
-- Duplicate-name teacher rows: same name, different rows.
-- Output sorted by name, then created_at, so visual scan groups
-- collisions and shows oldest first.
SELECT
  t.id,
  t.name,
  t.display_name,
  t.email,
  t.school_id,
  s.name AS school_name,
  t.created_at,
  -- Count how many other rows share this exact name
  COUNT(*) OVER (PARTITION BY t.name) AS rows_with_same_name,
  -- Class + student counts (data weight per teacher)
  (SELECT COUNT(*) FROM classes c WHERE c.teacher_id = t.id) AS class_count,
  (SELECT COUNT(*) FROM students st JOIN classes c ON c.id = st.class_id WHERE c.teacher_id = t.id) AS student_count,
  (SELECT COUNT(*) FROM units u WHERE u.author_teacher_id = t.id OR u.teacher_id = t.id) AS unit_count
FROM teachers t
LEFT JOIN schools s ON s.id = t.school_id
WHERE t.name IN (
  -- Sub-query: names that appear on more than one teacher row
  SELECT name FROM teachers GROUP BY name HAVING COUNT(*) > 1
)
ORDER BY t.name, t.created_at;
```

## Expected output for NIS prod

Three rows for `name = 'Matt'`:

| id | email | school_id | school_name | rows_with_same_name | class_count | student_count | unit_count |
|---|---|---|---|---|---|---|---|
| `0f610a0b` | `mattburto@gmail.com` | `636ff4fc-...` | NIS | 3 | ? | ? | ? |
| `e59fb92f` | `hello@loominary.org` | `636ff4fc-...` | NIS | 3 | ? | ? | ? |
| `27818389` | `mattburton@nanjing-school.com` | `636ff4fc-...` | NIS | 3 | ? | ? | ? |

Plus possibly other duplicate-name candidates (e.g. test-account names like "Test", "Demo Teacher").

## What to do with the results

The Phase 6 cutover sub-task includes a **3-Matts merge decision**. After applying Phase 0 in prod:

1. Run this query.
2. Inspect the row counts (class_count / student_count / unit_count). The teacher row with the most data is the canonical one to keep.
3. **Decide per group of duplicates:**
   - **Merge:** designate one row as canonical. UPDATE `classes.teacher_id`, `units.author_teacher_id`, `units.teacher_id`, `student_projects.mentor_teacher_id`, `class_members.member_user_id`, `school_responsibilities.teacher_id`, etc. across every reference. Delete the now-empty teacher rows.
   - **Keep separate:** document the reason in `docs/security/multi-account-pattern.md`, add a `display_name` to disambiguate them in the UI.

The merge SQL is **NOT in this file** — write it deliberately per case, after inspecting the data. Each merge is a single-purpose migration with a clear `down.sql`.

## Don't run this until

- Phase 0.8a + 0.8b are applied (teacher rows have `school_id` populated)
- You have a reason to look (Phase 6 cutover decision, or NIS pilot prep)

Read-only is safe to run any time, but the output is only meaningful in the post-Phase-0 state.
