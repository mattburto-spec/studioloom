# RLS Deny-All Tables — Intentional Service-Role-Only Access

> **Status:** Active (Phase 6.5, 4 May 2026).
>
> Closes **FU-FF**. Documents the 5 tables that have RLS enabled but no explicit policy — accessed exclusively from server-side admin paths via the `service_role` key, which bypasses RLS by design.

## Why "RLS enabled, no policy" is sometimes correct

Postgres RLS works as follows:

- `ALTER TABLE x ENABLE ROW LEVEL SECURITY;` switches the table to deny-by-default for non-superuser roles.
- A `CREATE POLICY` statement opens specific access patterns to authenticated/anon roles.
- The `service_role` key (used by `createAdminClient()` in our codebase) bypasses RLS entirely — it's the Postgres equivalent of a privileged backend account.

For tables that should ONLY be accessed via service-role (admin operational data, opaque-token session tables, append-only history), the *correct* posture is:

- RLS enabled (locks out the `anon` and `authenticated` roles).
- No policy (no path opens up for client-side access).
- Service-role-only access from a small, audited set of server-side files.

`scan-rls-coverage.py` flags this as `rls_enabled_no_policy` because in MOST cases that pattern is a missed RLS policy — a real security gap. The 5 tables below are the documented exceptions. The scanner now treats them as `intentional_deny_all` (Phase 6.5 update) and they don't surface as drift.

## The 5 tables

| Table | Why no SELECT policy | Service-role write paths | Service-role read paths |
|---|---|---|---|
| `admin_audit_log` | Pre-Phase-5 admin audit channel (mig 079); writes are platform-admin only via the `src/lib/admin/settings.ts` helper. Reads are admin-only via `/api/admin/audit-log`. | [`src/lib/admin/settings.ts:143`](../../src/lib/admin/settings.ts) | [`src/app/api/admin/audit-log/route.ts:31`](../../src/app/api/admin/audit-log/route.ts) |
| `ai_model_config` | Runtime model selection + ceiling configuration consumed by `quality-evaluator`. Writes are admin-only via the AIControlPanel UI; reads happen on every quality-eval pass. Not RLS-readable because there's no client-side legitimate consumer. | [`src/lib/ai/model-config.ts:102`](../../src/lib/ai/model-config.ts) (writes via `/admin/ai-model` UI) | [`src/lib/ai/model-config.ts:150`](../../src/lib/ai/model-config.ts), [`src/lib/ai/quality-evaluator.ts:135`](../../src/lib/ai/quality-evaluator.ts) |
| `ai_model_config_history` | Append-only history of `ai_model_config` changes. Same access pattern: written when admin modifies the live config, read by the AIControlPanel diff view. | [`src/lib/ai/model-config.ts:160`](../../src/lib/ai/model-config.ts) | (admin UI only — no runtime reader) |
| `fabricator_sessions` | Opaque-token session table for the Fabricator (lab tech) auth domain. Same pattern as the dropped `student_sessions` table — bearer tokens that NEVER reach the client outside the cookie. Writes on login/setup; reads on session validation; deletes on logout/teacher-revoke. | [`src/lib/fab/auth.ts:66`](../../src/lib/fab/auth.ts) (login), [`src/lib/fab/auth.ts:156`](../../src/lib/fab/auth.ts) (refresh), [`src/app/api/fab/set-password/submit/route.ts:95`](../../src/app/api/fab/set-password/submit/route.ts), [`src/app/api/teacher/fabricators/[id]/route.ts:86`](../../src/app/api/teacher/fabricators/[id]/route.ts) (teacher revoke) | [`src/lib/fab/auth.ts:198`](../../src/lib/fab/auth.ts), [`src/lib/fab/auth.ts:228`](../../src/lib/fab/auth.ts) |
| `teacher_access_requests` | Phase 4.7b-2 waitlist for school-admins to onboard new teachers. Public-facing write path is `POST /api/teacher/welcome/request-school-access` (anonymous, gated by Cloudflare Turnstile). Reads + status updates are admin-only via `/admin/school/[id]` surface. | [`src/app/api/teacher/welcome/request-school-access/route.ts:93,115`](../../src/app/api/teacher/welcome/request-school-access/route.ts), [`src/app/api/teacher/request-access/route.ts:49,63,86`](../../src/app/api/teacher/request-access/route.ts) | [`src/app/api/admin/teacher-requests/route.ts:20`](../../src/app/api/admin/teacher-requests/route.ts) (admin queue) |

(Reduced from 7 since the Phase 4 audit — `student_sessions` was dropped in Phase 6.1, and `fabrication_scan_jobs` got an explicit policy earlier.)

## Scanner allowlist update

`scripts/registry/scan-rls-coverage.py` now reads this document at scan time, parses the table list above, and classifies those tables as `intentional_deny_all` rather than `rls_enabled_no_policy`. The drift JSON at `docs/scanner-reports/rls-coverage.json` separates the two categories.

If you ADD a table to the allowlist: add a row to the table above + run `python3 scripts/registry/scan-rls-coverage.py` to verify it's now classified as `intentional_deny_all`.

If you REMOVE a table from the allowlist (because a legitimate non-service-role consumer materialised): remove the row, write the explicit RLS policy via a new migration, and re-run the scanner to confirm 0 drift.

## Review cadence

Quarterly review by the maintainer:

1. For each table on this list, has a legitimate non-service-role consumer materialised since the last review? (e.g., teacher self-service for their own `teacher_access_requests` history?)
2. If yes: write the explicit RLS policy via a new migration, remove the row from this doc, re-run the scanner.
3. If no: confirm the writer/reader paths above are still accurate (a moved file or new caller would invalidate the audit).

Last reviewed: 2026-05-04 (Phase 6.5 initial pass).

## Related

- `scripts/registry/scan-rls-coverage.py` — the scanner that consumes this doc.
- `docs/scanner-reports/rls-coverage.json` — the drift report; `intentional_deny_all` counts should match the table count above.
- `docs/projects/access-model-v2-phase-6-brief.md` §6.5a — the spec for this work.
- ADR-012 (audit-log infrastructure) for the parallel `audit_events` table that DOES have explicit RLS — different design (per-actor read access).
