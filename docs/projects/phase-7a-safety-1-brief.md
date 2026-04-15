# Phase 7A-Safety-1 Brief — FU-X Closeout + RLS-Coverage Scanner

> **Goal:** Close FU-X (3 unprotected tables) in prod + code + registries, and add the structural guard that prevents recurrence: a sync-schema-registry check that flags any table lacking RLS.
> **Context:** Migration 075 already contains the RLS enable + policies for `usage_rollups`, `system_alerts`, `library_health_flags` (committed in `9ff1a38`, bundled with `cost_rollups`). Schema-registry already reflects the policies. Remaining work is prod-apply verification + FU-X removal from P1 list + scanner hardening.
> **Estimated effort:** 0.5–1 day
> **Checkpoint:** 7A-Safety-1 Checkpoint — prod-applied, teacher-token queries verified, scanner rejects no-RLS tables

---

## Pre-flight checklist (Code: do these FIRST, report before writing ANY code)

1. `git status` — clean tree, on `main`, HEAD at `3fdea77` (or later).
2. `npm test` — capture baseline (expected: 1150 tests, 0 failures, 8 skipped).
3. Confirm migration 075 application state in prod. Two signals:
   - (a) Query `information_schema.tables` on prod for `cost_rollups` existence (table created in 075 alongside the RLS fix) — if exists, 075 is applied.
   - (b) Query `pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE c.relname IN ('usage_rollups','system_alerts','library_health_flags')` with `c.relrowsecurity` — if all three show `t`, fix is live.
   - If either signal says not-applied: STOP, report to Matt before proceeding (applying the migration is a separate decision).
4. Audit `sync-schema-registry.py` for current RLS-field handling:
   - Does it populate `rls.read` / `rls.write` from source migrations today? (Schema-registry shows RLS fields populated for current tables — confirm it's the scanner, not hand-edits.)
   - Does it flag `ENABLE ROW LEVEL SECURITY` absence? (Expected: no — FU-X proves it doesn't.)
5. Re-read Lesson #29 (RLS-NULL silent-filter pattern) — confirms the class of bug we're hardening against.
6. Re-read Lesson #38 (verify = assert expected values) — our verify queries must assert exact RLS state, not just "table exists."
7. `grep -n "rls_enabled\|ENABLE ROW LEVEL SECURITY\|no-rls\|rls.read" docs/schema-registry.yaml scripts/registry/*.py` — locate every existing RLS touchpoint.
8. **STOP AND REPORT** all findings before writing any code.

---

## Lessons to re-read before coding

- **#29** — RLS-NULL silent filter pattern (structural class of bug we're preventing).
- **#38** — Verify = assert expected values (our prod verify must assert `relrowsecurity=t` on all 3 tables, not just "migration applied").
- **#39** — Pattern bugs: audit all similar sites (when we find 3 no-RLS tables, we must verify there aren't more — the scanner work covers this).
- **#45** — Surgical changes: do not touch cost_rollups policies, only verify the 3 FU-X tables.

---

## Sub-tasks

### 7A-S1-1 — Prod verification (read-only)
- Run on prod via `supabase db execute` or psql:
  - `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('usage_rollups', 'system_alerts', 'library_health_flags');` — assert all three return `t`.
  - Teacher-token query against `system_alerts`: expect 0 rows.
  - Teacher-token query against `library_health_flags`: expect 0 rows.
  - Teacher-token query against `usage_rollups`: expect only rows with `teacher_id = <token teacher>`.
- Capture output verbatim into the STOP AND REPORT.
- **If any assertion fails, STOP** — the migration state in prod disagrees with the code, and we need to resolve that before proceeding.

### 7A-S1-2 — Update schema-registry applied_date
- In `docs/schema-registry.yaml`, set `applied_date: "2026-04-14"` (or actual prod-apply date if known) on:
  - `cost_rollups`
  - `usage_rollups` (add a spec_drift note: "FU-X applied_date confirmed")
  - `system_alerts` (same spec_drift note)
  - `library_health_flags` (same spec_drift note)
- Note: the 69-table null-applied-date backlog is separate — do NOT touch the other 65 entries this phase (FU-AA territory).

### 7A-S1-3 — Close FU-X in followups + CLAUDE.md
- `docs/projects/dimensions3-followups.md` — mark FU-X as ✅ RESOLVED with prod-apply date, link to verification output from 7A-S1-1.
- `CLAUDE.md` — remove FU-X from "🚨 P1 — live data leak" in Known follow-ups. Collapse to a single closed-line entry or drop entirely.
- `docs/projects/ALL-PROJECTS.md` — if FU-X appears in any active project row, mark it closed.

### 7A-S1-4 — RLS-coverage scanner addition
- Extend `scripts/registry/sync-schema-registry.py` (or create a sibling `scan-rls-coverage.py` — choose whichever keeps the existing scanner's mutation contract intact):
  - Parse every `CREATE TABLE ... IF NOT EXISTS <name>` in `supabase/migrations/`.
  - For each such table, search all migrations for a matching `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY` AND at least one `CREATE POLICY ... ON <name>`.
  - Emit JSON report to `docs/scanner-reports/rls-coverage.json` with shape `{registry, timestamp, version: 1, drift: {no_rls: [...], rls_enabled_no_policy: [...]}, stats, status}`.
  - **Do NOT auto-modify schema-registry.yaml** (read-only scanner pattern — see GOV-1.4 Decision "scanners verify, never auto-write").
- Run the scanner once and confirm output:
  - Expect `no_rls: []` after FU-X.
  - Expect `rls_enabled_no_policy: []` (any table with RLS but no policies is a silent denial).
- Commit scanner + its output.

### 7A-S1-5 — change-triggers.yaml update
- Add a new trigger to `docs/change-triggers.yaml`:
  ```yaml
  - name: before-creating-a-new-table
    applies_to: [any migration with CREATE TABLE]
    required_updates:
      - Enable RLS: ALTER TABLE <name> ENABLE ROW LEVEL SECURITY
      - Define at least one CREATE POLICY ON <name>
      - Update schema-registry.yaml via sync-schema-registry.py
    enforcement: planned  # becomes 'automated' when scan-rls-coverage runs in CI
  ```
- Point CLAUDE.md saveme step 11(a) at the new scanner invocation so RLS coverage is verified on every saveme.

### 7A-S1-6 — WIRING.yaml + doc-manifest updates
- Add `scan-rls-coverage.py` (or equivalent) to `governance-registries.key_files` in WIRING.yaml.
- Add `docs/scanner-reports/rls-coverage.json` to doc-manifest.yaml (category: automation, max_age_days: 7).
- Bump `governance-registries` notes to mention the new RLS check.

---

## Success criteria (assert each, with exact values)

- [ ] Prod verification: all 3 FU-X tables return `relrowsecurity=t`.
- [ ] Teacher-token queries: `system_alerts` → 0 rows, `library_health_flags` → 0 rows, `usage_rollups` → only own rows.
- [ ] `npm test` still at 1150 passing (no regression).
- [ ] `scan-rls-coverage.py` runs, emits JSON report with `no_rls: []` and `rls_enabled_no_policy: []`.
- [ ] CLAUDE.md's P1 Known follow-ups list no longer shows FU-X.
- [ ] `docs/change-triggers.yaml` includes the `before-creating-a-new-table` trigger.

---

## Stop triggers (halt and report, don't push through)

- Migration 075 not applied in prod (pre-flight signal mismatch).
- Teacher-token query against `system_alerts` returns ≥1 row (RLS broken or bypassed).
- `scan-rls-coverage.py` finds any table in `no_rls` other than the 3 known-safe cases you can enumerate and explain (if any).
- `npm test` drops below 1150 passing.
- Any scanner you extend strips existing top-level yaml fields on rewrite (FU-DD pattern — caught this once, don't repeat).

## Don't stop for

- Pre-existing `applied_date: null` on the 65 non-FU-X tables (that's FU-AA scope).
- Schema-registry comments referencing old FU-X recommendations (safe to leave — they're historical).
- Any scanner finding on non-FU-X tables that isn't breaking the build.

---

## Checkpoint 7A-Safety-1

After 7A-S1-1 through 7A-S1-6, STOP AND REPORT:
- Pre-flight findings (verbatim).
- Prod verification output (3 queries).
- Scanner output (JSON contents).
- Files modified (git diff --stat).
- npm test final count.
- Commits (separate, not squashed — min 4: verification+registry update, scanner, change-triggers, WIRING+manifest).
- Any FU follow-ups filed.
- Working tree clean status.

Wait for explicit sign-off before starting Phase 7A-Safety-2.
