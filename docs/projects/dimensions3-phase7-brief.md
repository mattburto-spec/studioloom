# Dimensions3 Phase 7 Brief — Admin Landing + Controls + Sandboxes

> **Goal:** Every admin tab loads real data. Every sandbox runs real scenarios. Matt can walk all 12 tabs and the full E2E trip without "Coming soon" or manual SQL.
> **Spec:** `docs/projects/dimensions3-completion-spec.md` §9 (lines 1291–1520)
> **Estimated remaining effort:** 5–7 days (7A foundation already shipped)
> **Checkpoints:** 7.1 (12 tabs walkthrough), 7.2 (full E2E trip)

---

## State of play (14 Apr 2026)

**7A — Admin foundation (DONE, pushed to origin/main):**
- Migration 077 `admin_settings` + helper + `/api/admin/settings` routes + 8 tests
- `/admin/controls` rebuilt as pipeline settings UI (§9.15)
- Pipeline orchestrator reads admin_settings at run start (7A-4)
- Migration 079 `admin_audit_log` + contract tests
- 12-tab admin nav scaffold + stub pages for all 8 new tabs (7A-6)
- Bug report count on admin landing page (7A-5, reading from existing bug_reports table)

**Infrastructure already in place (from earlier phases / 7A):**
- Migration 075 `cost_rollups` table exists (4 categories: ingestion/generation/student_api/teacher_api)
- Migration 076 `bug_reports` + `classes.bug_reporting_enabled` toggle
- Migration 077 `admin_settings` seeded
- Migration 079 `admin_audit_log`
- Routes scaffolded: `/admin/{cost-usage,quality,wiring,teachers,students,schools,bug-reports,audit-log}` all exist as "Coming soon" stubs
- `/admin/simulator` exists (renamed from sandbox in Phase 0)
- `/admin/ingestion-sandbox` exists (Phase 1)
- `/admin/framework-adapter` exists (Phase 2 §4.6)
- `/admin/library` exists — needs per-format tabs
- `/admin/test-sandbox` exists but is NOT the Generation Sandbox

**Not yet built (the rest of Phase 7):**
- 8 tabs are stubs (Cost & Usage, Quality, Wiring, Teachers, Students, Schools, Bug Reports, Audit Log)
- Bug Reporting capture UI (floating button, quick-choice menu, mini-form) — table exists, ingress does not
- Generation Sandbox route (`/admin/generation-sandbox`) — distinct from simulator + test-sandbox
- Per-format sandbox tabs on `/admin/library` (§9.6)
- Block Interaction Visualization (`/admin/library/[blockId]/interactions`)
- 6 E2E flow tests (real fixtures, Wiring tab)
- Admin landing page polish (traffic lights + sparklines)
- §9.16 legacy knowledge file deletion (14-day burn-in required first — defer to separate task)

---

## Pre-flight checklist (Code: do these FIRST, report before writing ANY code)

1. `git status` — clean tree, on `main`, expected HEAD is `d1eddf6` (7A-saveme) or later
2. `npm test` — capture baseline (expected: 1161 tests passing, 8 skipped per CLAUDE.md)
3. Confirm migration numbering — next migration is 080
4. Grep for existing usage of `cost_rollups`, `bug_reports`, `admin_audit_log`, `admin_settings` — list all read/write sites
5. Confirm `/admin/page.tsx` (landing) currently shows: bug report count (7A-5) + whatever else. List what's there.
6. Confirm layout/nav: `src/app/admin/layout.tsx` has the 12-tab nav from 7A-6. Verify each link.
7. Check `cost_rollups` for any existing rows — if empty, identify whether Phase 4 rollup jobs run in prod or if we need seed fixtures for checkpoint 7.1
8. Check `/admin/library/page.tsx` — current format filter mechanism (if any), so 7J additions don't conflict
9. Confirm FU-DD status — scanners still strip `version: 1` from registries on rewrite. If we're adding a new registry-version consumer in Phase 7, FU-DD must be fixed first. List the consumers.
10. Check that `/admin/framework-adapter` is linked from the landing page (spec §9.3 says "verify it's linked")
11. **STOP AND REPORT** all findings before proceeding to 7B.

---

## Lessons to re-read before coding

- **#38** — Verify = assert expected values, not just non-null (E2E fixtures must assert real output shape)
- **#39** — Pattern bugs: audit all similar sites (every admin tab, every audit log source, every cost category)
- **#43** — Think before coding: surface assumptions (don't assume seeded data exists — check)
- **#44** — Simplicity first: minimum code that solves the problem (these are admin tools, not consumer UI — readable tables > pretty charts)
- **#45** — Surgical changes: don't improve adjacent code (7A scaffolding is fine, don't refactor)
- **#29** — UNION dual-visibility pattern (relevant if Audit Log crosses RLS boundaries)
- **#47** — Registry-version consumers (relevant to FU-DD before any new version-aware reader)

---

## Sub-phase plan

Each sub-phase is a separate commit. No squashing. Each green before next.

### 7B — Bug Reporting capture + admin triage (§9.13)

**Why first:** Small net-new code (table + stub page exist), high leverage (every subsequent phase can file bugs against it), and it's the most self-contained piece.

- `src/components/bug-report/FloatingButton.tsx` — bottom-right, visible only when `classes.bug_reporting_enabled` is true for current class context, OR always for admins
- `src/components/bug-report/QuickChoiceMenu.tsx` — 4 options: Something's broken / This doesn't look right / I'm confused / Feature request
- `src/components/bug-report/MiniForm.tsx` — description (required) + optional screenshot (html2canvas or clipboard paste API) + auto-capture (URL, user_agent, role, class context, timestamp, last 5 console errors with consent checkbox)
- `POST /api/bug-reports` — writes to `bug_reports`, returns id
- `src/app/admin/bug-reports/page.tsx` — replace stub with real triage UI
  - Filter by class, teacher, status, category
  - Status workflow buttons: New → Investigating → Fixed → Closed
  - Batch actions: close duplicates, merge similar
  - Response textarea → admin_notes + `response` field
  - Status-change triggers in-app notification to reporter (use existing notifications table)
- `src/app/profile/my-reports/page.tsx` — reporter sees their own reports + status updates
- Per-class toggle surfaced in Class Hub settings UI (add toggle row)
- Tests:
  - POST creates row, required fields validated, reporter_role enforced
  - FloatingButton visibility matrix (4 cases: teacher+enabled, teacher+disabled, admin+any, student+enabled)
  - Status transition rules (no skipping states)
- **Verify:** File a real report as yourself → see it in `/admin/bug-reports` → change status → reporter sees update

### 7C — Cost & Usage tab (§9.9)

- `src/app/admin/cost-usage/page.tsx` — replace stub
  - Per-model spend: daily / weekly / monthly from `cost_rollups`
  - **Per-teacher profitability table** with all 4 categories populated (ingestion, generation, student_api, teacher_api)
    - Row: teacher name, 7d/30d/all-time totals, cost per unit generated, cost per active student, trend arrow
    - Green/amber/red outlier chips
    - If any category is NULL for a teacher, flag as data gap (don't pretend the category exists for that teacher with $0 — say "no data" vs "$0")
  - Budget alert strip reading from Phase 4 §6.6 thresholds in `admin_settings`
  - Drill-down: click teacher → per-model breakdown → individual API call log (read from `generation_runs`, `ingestion_runs`, `student_api_calls`, `teacher_api_calls`)
  - Export to CSV
- If `cost_rollups` is empty in staging, write a one-shot seed fixture for checkpoint demo (document it as test-only)
- Tests: outlier threshold logic, CSV export shape, 4-category completeness check
- **Verify:** Open as admin, expand one teacher row, see 4 real categories with non-zero numbers (or explicit "no data" chip)

### 7D — Teachers / Students / Schools browse tabs (§9.12)

- `/admin/teachers` — list: profile status, usage stats, last active, style completeness, units created, link to detail
- `/admin/students` — anonymized roster (hash replaces name), enrollment status, progress overview, learning profile completion
  - Critical: actually apply hashing at query level, not just CSS-hide the column
- `/admin/schools` — school → class → teacher hierarchy, framework distribution, calendar sync status
  - If FU-P (no school/org entity) is still unresolved, this tab shows class-level aggregate with a "School entity not modelled" banner + counts grouped by `school_name` string field if one exists
- Pagination on all three (cursor-based)
- Tests: anonymization correctness (no PII leaks in network payload), pagination edge cases
- **Verify:** Open `/admin/students` network tab → confirm student names are NOT in response payload

### 7E — Audit Log tab (§9.14)

- `src/app/admin/audit-log/page.tsx` — replace stub
- Reads from all five sources via UNION query:
  1. `feedback_audit_log`
  2. `data_removal_log`
  3. `library_health_flags`
  4. `student_content_moderation_log` (teacher actions only — filter)
  5. `admin_audit_log` (migration 079)
- Filterable by actor, action_type, date range
- Export to CSV
- Tests: UNION query correctness (no row duplication), filter combinations, CSV column parity across sources
- **Verify:** Change a setting in `/admin/controls` → audit log shows the change within 5s

### 7F — Quality tab (§9.10)

- `src/app/admin/quality/page.tsx` — replace stub
- Pulse score trend (30/90 days) — query `lessons.pulse_score` history or `lesson_pulse_snapshots` if that table exists
- Drift detection feed — reads from Phase 4 §6.4 system 3 (drift detector); if that system isn't wired to a table, mark the section "awaiting Phase 4 system 3" rather than faking it
- Before/after comparisons for recently-accepted feedback proposals — read `feedback_proposals` with `status='accepted'` and show pre/post content snippets
- Block efficacy trends (top 10 movers up/down from `activity_blocks.efficacy_score` + history if tracked)
- Tests: date range bucketing, efficacy delta computation
- **Verify:** Accept a feedback proposal → appears in "recently accepted" section

### 7G — Wiring tab + 6 E2E fixtures (§9.11)

**Biggest sub-phase.** 6 real end-to-end tests, not mocks.

- `src/app/admin/wiring/page.tsx` — replace stub
- Each of 6 tests: last run timestamp, pass/fail, simple SVG flow diagram with red X on broken links, "Run now" button
- The 6 tests:
  1. Ingestion → Library (upload test doc → verify blocks in `activity_blocks`)
  2. Library → Generation (generate test unit → verify blocks retrieved in Stage 1)
  3. Generation → Delivery (open generated unit in student view → verify content renders)
  4. Delivery → Tracking (student interaction → verify `student_progress` row saved)
  5. Tracking → Feedback (edit a block in editor → verify `feedback_proposals` row + efficacy updated)
  6. Feedback → Library (check block with edits → verify `activity_blocks.efficacy_score` reflects changes)
- Fixture accounts: dedicated test_teacher_id and test_student_id (seeded, NOT real data)
- `POST /api/admin/wiring/run/:testId` — idempotent, cleans up its own test rows
- Run via Phase 4 §6.4 system 6 daily + manual button
- Tests:
  - Each fixture runs standalone and cleans up
  - Assertions check real output values (Lesson #38 — not just non-null)
  - Failure surfaces a specific broken link, not a generic "failed"
- **Verify:** All 6 green on first run; break a link manually (e.g. revoke teacher access) → see red X on the right stage

### 7H — Generation Sandbox (§9.1)

- `src/app/admin/generation-sandbox/page.tsx` — NEW route (distinct from `/admin/simulator` and `/admin/test-sandbox`)
- Real `GenerationRequest` form (same shape as wizard)
- Calls `runPipeline()` with `sandboxMode: false` but writes `test: true` to `generation_runs`
- Step-through controls: Pause After Stage N, Replay Stage N, Inject Input, Skip Stage
- Per-stage view: input JSON (editable), output JSON, AI prompt used, cost, duration, errors, token counts
- Download run as JSON
- "Open in Pipeline Simulator" button (for offline re-run with fixtures)
- Backend:
  - `POST /api/admin/generation-sandbox/run` with `{ request, pauseAfter }`
  - `POST /api/admin/generation-sandbox/replay-stage` with `{ runId, stage, modifiedInput }`
  - `GET /api/admin/generation-sandbox/:runId`
- Tests: pause/replay state machine, test-run filter in analytics (runs with `test: true` don't appear in cost dashboards)
- **Verify:** Pause at Stage 3, modify input, replay → downstream stages see modified data

### 7I — Simulator polish + regression harness (§9.2)

- Verify `/admin/simulator` route currently functional; add regression test suite button: "Run all fixtures" → reports pass/fail per fixture
- Used for testing new FormatProfiles before shipping
- Tests: fixture-diff correctness
- **Verify:** All fixtures currently saved run green; add a new FormatProfile fixture → runs green after wiring

### 7J — Per-format sandbox tabs on /admin/library (§9.6)

- Add tab bar to `/admin/library`: Design / Service / Personal Project / Inquiry / All
- Each tab filters blocks by `format_profile_id`
- Each tab has a "Preview retrieval" button that runs Stage 1 retrieval against that format only
- Tests: filter correctness, Stage 1 retrieval scoping
- **Verify:** Click Service tab → see only Service-format blocks; click Preview Retrieval → output matches Stage 1 output for a sample request

### 7K — Block Interaction Visualization (§9.5)

- `src/app/admin/library/[blockId]/interactions/page.tsx`
- Graph view (react-flow) — block at centre, prerequisites upstream, dependents downstream
- Layer B view: familiarity adaptations (novice/experienced variants)
- Layer C view: cross-reference highlights
- Link from any block detail page via "Show interactions"
- Tests: graph topology correctness for a known block, cycle detection
- **Verify:** Open a block with known prereqs → graph renders correctly; navigate upstream/downstream by clicking nodes

### 7L — Admin landing polish (§9.7)

- `src/app/admin/page.tsx` — replace current minimal landing
- Health strip: traffic lights for Pipeline, Library, Cost, Quality, Wiring (read from Phase 4 automation signals + Phase 7 Wiring tab results)
- Active alerts row (red badges, click to expand)
- Quick stats: active teachers, active students, units generated, blocks in library, open bug reports
- 7-day trend sparklines per stat
- Tests: health computation (what makes each light green/amber/red), sparkline data shape
- **Verify:** Manually fail a wiring test → Wiring light turns amber/red on landing within 30s

### 7M — Pre-checkpoint audit + FU-DD fix

Before Checkpoint 7.1:
- Re-run all five registry scanners; fix FU-DD (scanners stripping `version: 1`) in `scan-api-routes.py` and `scan-ai-calls.py` — blocks any future registry-version consumer landing in Phase 7K/7L
- Update `docs/doc-manifest.yaml` for all docs touched in Phase 7
- Grep for any "TODO" or "Coming soon" strings remaining in `/admin/**/*.tsx` — must be zero
- Grep for hard-coded test fixtures masquerading as prod code
- Append Phase 7 decisions to `docs/decisions-log.md`
- Append session entry to `docs/changelog.md`

### 7N — 🛑 Matt Checkpoint 7.1 (all 12 tabs walkthrough)

**STOP. Matt opens every tab per spec §9.17.**

Pass conditions (from spec):
1. `/admin` loads with traffic lights, quick stats, sparklines
2. All 12 tabs load with real data (not TODO)
3. Cost & Usage → expand a teacher row → 4 categories with real numbers
4. Wiring → "Run now" on flow test 1 → passes
5. Enable bug reporting on a test class → floating button appears → file a test report → appears in `/admin/bug-reports`
6. Change a setting in `/admin/controls` → run a generation → verify setting took effect

Fail conditions:
- Any tab shows "Coming soon" or TODO
- Per-teacher profitability missing any of the 4 cost categories
- Bug report button visible when `bug_reporting_enabled = false`
- Settings changes don't affect pipeline

### 7O — 🛑 Matt Checkpoint 7.2 (final end-to-end)

**STOP. Full trip per spec §9.18.**

One teacher uploads a PDF → approves blocks → generates a unit → opens in student view → framework swap MYP↔GCSE → student completes activity with moderation → teacher edits → efficacy job proposes change → admin accepts → cost dashboard shows the spend → wiring shows all 6 green.

**Dimensions3 is complete only when this trip completes without manual SQL, without code edits, and without any TODO surfacing.**

### 7P — §9.16 Delete legacy knowledge files (DEFERRED)

- Do NOT include in the main Phase 7 commit sequence
- Must wait 14 days after Checkpoint 7.2 passes with no incident
- Track as a follow-up with a concrete date
- When the burn-in is clean:
  - Grep for imports of `src/lib/knowledge/{analyse,analysis-prompts,chunk,extract,retrieve,retrieve-lesson-profiles,ingest-unit,vision}.ts`
  - Delete unreferenced files
  - `knowledge_chunks` and `lesson_profiles` tables STAY (historical record)

---

## Stop triggers (Code: STOP and report if any of these occur)

1. Pre-flight finds `cost_rollups` empty in prod/staging — checkpoint 7.1 step 3 needs real numbers; seeding fake data fails the checkpoint
2. Any of the 5 audit sources named in spec §9.14 doesn't exist as a table — naming mismatch between spec and schema
3. Migration 076 `bug_reports` schema diverges from what §9.13 / 7B code expects
4. `cost_rollups` vs `usage_rollups` confusion — spec §9.9 says migration 070 was `usage_rollups`; actual migration 075 is `cost_rollups`. Confirm which is authoritative before building 7C
5. `/admin/test-sandbox` (exists) overlaps with Generation Sandbox (7H) — decide whether to delete test-sandbox or rename
6. Any new registry-version consumer in Phase 7 code while FU-DD is still open (version: 1 will be stripped on next scanner run)
7. FU-P (no school entity) blocks the Schools tab from being meaningful — decide: ship with banner, or defer Schools tab to post-Phase-7

## Don't stop for

- Sparkline library choice (pick one, move on — recharts already in repo)
- Bug report screenshot method — html2canvas vs clipboard paste, either is fine
- Admin CSV export format polish
- Exact shade of green/amber/red in traffic lights
- Graph library in 7K — react-flow is assumed, but cytoscape or d3 are acceptable swaps

---

## Commit plan

One commit per sub-phase. No squashing. Each green before next.

| # | Sub-phase | Est. | Deps |
|---|-----------|------|------|
| 7B | Bug Reporting capture + triage | 1 d | migration 076 (done) |
| 7C | Cost & Usage tab | 0.75 d | cost_rollups (done) |
| 7D | Teachers/Students/Schools browse | 0.5 d | — |
| 7E | Audit Log tab | 0.5 d | admin_audit_log (done) |
| 7F | Quality tab | 0.5 d | Phase 4 drift detector |
| 7G | Wiring tab + 6 E2E | 1 d | — |
| 7H | Generation Sandbox | 0.75 d | — |
| 7I | Simulator regression harness | 0.25 d | existing simulator |
| 7J | Per-format library tabs | 0.25 d | — |
| 7K | Block Interaction Viz | 0.5 d | react-flow |
| 7L | Admin landing polish | 0.5 d | 7B–7G data flowing |
| 7M | Pre-checkpoint audit + FU-DD | 0.25 d | all above green |
| 7N | Checkpoint 7.1 | gated | all above |
| 7O | Checkpoint 7.2 | gated | 7N passed |
| 7P | Legacy knowledge deletion | deferred 14d | 7O + burn-in |

**Total estimated remaining: 6.75 days of build + 2 checkpoints + deferred cleanup.**

Matt pushes to origin himself after each checkpoint signs off. Code commits locally only during sub-phases; `phase-7-wip` backup branch allowed.

---

## Open questions before kickoff

1. **cost_rollups vs usage_rollups naming** — spec §9.9 says "data source: usage_rollups (Phase 4 §6.4 automation system 7)" with migration 070. Actual migration 075 created `cost_rollups` with a comment noting it's DISTINCT from usage_rollups. Need to confirm whether 7C reads `cost_rollups` (cost $$ data) or `usage_rollups` (call counts) or both.
2. **FU-P Schools tab** — do we ship the Schools tab with an honest "no school entity modelled yet" banner (per FU-P still being open in the P1 Access Model v2 cluster), or defer the tab entirely and note on landing page?
3. **test-sandbox disposition** — `/admin/test-sandbox` exists. Is it superseded by Generation Sandbox (7H) and should be deleted, or is it serving a different purpose?
4. **`/admin/feedback` reference in Checkpoint 7.2 step 5** — does this route exist from Phase 3, and does it accept proposals? Pre-flight audit should confirm.
5. **Drift detector in 7F** — confirm Phase 4 §6.4 system 3 is actually wired (not a stub) before building the Quality tab against it.

Code should answer these in the 7B pre-flight report.
