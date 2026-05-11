# Applied Migrations — Interim Log

**Purpose:** Bridge log of migrations applied to prod between 11 May 2026 (start of the prod-migration-backlog audit) and the moment Phase E of the audit creates the `public.applied_migrations` tracking table.

**Why this exists:** Prod has no application-level migration tracking table. The audit is building one (Phase E), but the audit will take days to complete. Migrations applied DURING the audit window must be recorded somewhere so the audit doesn't have to chase its own tail. This file is that "somewhere".

**Lifecycle:**
1. Every prod-apply between now and Phase E completion appends a row here in the **same session** as the apply.
2. At Phase E, the tracking table is created and rows from this file are bulk-imported as `INSERT INTO public.applied_migrations`.
3. At Phase G, this file is deleted. CLAUDE.md references to it are removed.

**Discipline starts:** 11 May 2026 ~09:30 UTC.

## How to log an apply

Every prod-apply must add a row to the table below in the SAME session as the apply. The row contains: timestamp (UTC), migration filename (no path, no extension), who applied it ('matt' / 'matt+claude' / 'backfill-script'), source ('manual'=Supabase SQL Editor / 'cli'=supabase migrate / 'hand-patch'=ad-hoc SQL not from a migration file), and a one-line note.

When Phase E lands, the equivalent SQL for each row will be:

```sql
INSERT INTO public.applied_migrations (name, applied_at, applied_by, source, notes)
VALUES (
  '<migration_name>',
  '<timestamp UTC>',
  '<applied_by>',
  '<source>',
  '<note>'
);
```

## Trigger phrases

- *"log this migration apply"* — add a row to this file for the most recently applied migration in the session.
- *"backfill applied_migrations"* — at Phase E time, convert every row in this file into the equivalent INSERT statement against the live tracker.

## Log

| # | Applied at (UTC) | Migration filename | Applied by | Source | Notes |
|---|---|---|---|---|---|
| 1 | 2026-05-11T08:30Z | `20260511085324_handpatch_handle_new_teacher_skip_students_search_path` | matt+claude | hand-patch | Hand-applied via Supabase SQL Editor during student-creation incident. SQL identical to the codified migration file. Verified via probe — function body contains user_type guard + public.teachers + search_path + EXCEPTION. |

## Notes

- **Audit Phase A through D work does NOT modify prod.** Only Phase D (Apply) runs migrations against prod; Phase D appends rows here.
- **Hand-patches count.** Any ad-hoc SQL applied to prod (even if not from a migration file) gets a row here with `source = 'hand-patch'` and a note explaining what it was.
- **Don't worry about ordering.** Phase E will sort by `applied_at` when bulk-inserting.
- **Don't delete rows from this file** until Phase E migration completes. The truth doc + this log together are the only record of prod-apply state.
