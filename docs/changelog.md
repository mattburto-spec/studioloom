# Session Changelog

> Rolling log of changes across sessions. Each `saveme` appends an entry. Read the last 5 entries for quick cross-session context.

---

## 11 Apr 2026 — Dimensions3 Phases 1.6 + 1.7 Complete (Checkpoint 1.2 PASSED), Build Methodology Captured

**What changed:**
- **Phase 1.6 (Disconnect Old Knowledge UI):** Aggressive cleanup given zero users — old `/teacher/knowledge/*` directory deleted entirely (no redirects), Dimensions3 pages relocated to `/teacher/library/*` namespace, `BatchUpload.tsx` deleted, `/teacher/library/import` endpoint wired to real reconstruction. Commits `e7b020b` (relocation) + `242e587` (cleanup).
- **Phase 1.7 (Checkpoint 1.2 — Automated E2E Gate):** First Dimensions3 phase with a real automated gate protecting it. Three commits on `main`: `20fe163` fix Pass A + Pass B `max_tokens` truncation, `691bdf4` Checkpoint 1.2 automated E2E test, `cd5f9d4` spec §3.7 amend.
  - **Pass A bug:** `max_tokens: 2000` → returned `outputTokens: 2000` exactly (hit cap), `sections: undefined`, downstream crash. Fix: bump to 8000, add `stop_reason` guard, defensive `?? []`.
  - **Pass B bug (predicted by FU-5 audit, surfaced one stage downstream):** Identical pattern at `pass-b.ts:182` with `max_tokens: 4000`. Fix: bump 4000→16000 (Sonnet 4 supports 64K out, no ceiling concern), same guard + fallback.
  - **Lesson #39 written** including new rule: "When fixing a `stop_reason`/defensive-destructure bug at one AI call site, audit and fix ALL sites with the same shape on the same critical path in the same phase, don't wait for the follow-up." Born from getting bitten twice in one phase.
  - **Test variants:** α sandbox DOCX (tight, deterministic) + β live DOCX [`RUN_E2E=1`] (narrow range for AI-wobble fields, loose substring for classification text) + β live PDF [`RUN_E2E=1`] + structural completeness check on every block. 4/4 passing. Total suite: 615 passed | 2 skipped (no `RUN_E2E`), 617 passed (with `RUN_E2E=1`). Baseline cost/time recorded as comments not asserts.
  - **Spec §3.7 amended:** Automated E2E test promoted to canonical Checkpoint 1.2 gate, 9-step manual walkthrough demoted to optional pre-push UI smoke.
  - **Assertion policy locked:** β TIGHT for structural/enum/numeric, β NARROW RANGE for AI-judgment fields (block count 11–15, observed 12/13/14 over N=3), β LOOSE substring for classification text, internal consistency invariants TIGHT.
- **Build methodology captured (`docs/build-methodology.md`):** 17-section reference doc covering scaffolding-as-first-class, phased-with-checkpoints discipline, pre-flight ritual, stop triggers, verify=expected values, audit-then-fix patterns, capture-truth-from-real-runs, push discipline, follow-up tracking, lessons-as-running-artifact. Meta-rule: prefer the discipline even when not explicitly asked. CLAUDE.md updated with new "How we build — PHASED WITH CHECKPOINTS" section + per-phase trigger so it loads in every session.
- **Phase 1.6 follow-up (FU-5) burndown:** Original 10 sites, Pass B removed in 1.7, 9 remaining. Active sites for future maintenance pass: `moderate.ts:175`, `test-lesson/route.ts:151`. Quarantined sites (`anthropic.ts`) wait for Dimensions2 rebuild.

**Systems affected:** `knowledge-pipeline` (truncation fixes, automated gate), `activity-blocks` (review queue UI relocated). WIRING.yaml + wiring-dashboard.html synced.

**Push status:** All 5 Phase 1.6/1.7 commits live on `origin/main`, Vercel prod deploy green, post-deploy sanity check passed (615 passed | 2 skipped baseline). Backup branches `phase-1.6-wip` and `phase-1-7-wip` on origin.

**Session context:** Continuation from prior compacted session. Phase 1.7 demonstrated the methodology end-to-end: stop trigger tripped at block-count delta >30%, paused for review, false-tight classification corrected via narrow-range policy, two truncation bugs caught before they shipped, doctrine written. First fully methodology-disciplined phase. Matt explicitly happy to continue methodically.

---

## 10 Apr 2026 — Dimensions3 Phases 0 + 1.1 + 1.5 Complete, Deployed to Prod

**What changed:**
- **Phase 0 Checkpoint 0.1:** Resolved 33 ambiguous `student_progress.class_id` rows via unit→class intersection with enrollment-recency tiebreaker. 32 backfilled, 1 orphan deleted. Final ambiguity count = 0.
- **Phase 1.1 (Teaching Moves Seed):** 55 moves from `scripts/seed-data/teaching-moves-rewritten.json` seeded to `activity_blocks` as `system@studioloom.internal` (dedicated system teacher). Tagged `source_type='community'`, `module='studioloom'`, `efficacy_score=65`. Validator relaxed to allow student-as-teacher moves (role-reversal-critique, peer-teach-back).
- **Phase 1.5 (Hardening Checklist):** All 10 items shipped and deployed to Vercel prod — cosine dedup 0.92 (voyage-3.5), PPTX + image extraction, strand/level fields (Pass A), Haiku moderation (fail-safe to 'pending'), PII scan wired, copyright_flag enum reuse (audit doc referenced wrong column name `is_copyright_flagged`), moderation migration now not deferred, dryRun mode, per-run cost tracking, content_fingerprint idempotency (sha256 normalised title+body+source_type, UNIQUE, ON CONFLICT DO UPDATE/NOTHING).
- **Migrations applied to prod:** 067 (`moderation_status` + `content_moderation_log` + RLS audit) and 068 (`content_fingerprint TEXT UNIQUE` + backfill).
- **Push discipline protocol established:** don't push to `origin/main` until checkpoint signed off AND migration applied to prod Supabase. Backup pattern: `git push origin main:phase-1.5-wip` (wip branch doesn't trigger Vercel prod deploy).

**Bug found + fixed manually + logged:**
- **Migration 067 grandfather backfill failed silently** — all 55 seed rows landed in `moderation_status='pending'` instead of `'grandfathered'`. Suspected root cause: `ADD COLUMN DEFAULT 'pending'` silently overrode subsequent conditional UPDATE in the same migration. Fixed in prod via corrective UPDATE. **Repo version of 067 is still broken** — logged as follow-up for audit + migration 069 safety net + Lesson #38.

**Lessons learned added:**
- #36 Data-backfill migrations need edge-case SQL, not just a simple UPDATE (student_progress 33-row incident)
- #37 Verify queries must be part of acceptance criteria for data migrations
- #38 pending — Migration 067 `ADD COLUMN DEFAULT` + conditional UPDATE order-of-operations bug (post-mortem blocked on Code audit)

**Systems affected:**
- `activity_blocks` (moderation_status, content_fingerprint, strand, level, copyright_flag)
- `content_moderation_log` (new audit table)
- `student_progress` (class_id now fully populated)
- Ingestion pipeline (PPTX, PII, moderation, dedup, fingerprint)
- Teacher Dashboard `/teacher/units` (render delay surfaced — not a regression, just slow hydration)

**Phase 1.5 follow-ups logged in ALL-PROJECTS.md:**
1. `/teacher/units` initial render delay (P1) — hydration lag, empty squares before cards paint
2. "Unknown" strand/level chips on pre-Phase-1.5 units (P2) — backfill missed units table
3. Migration 067 grandfather bug (P0) — repo broken, needs audit + 069 + Lesson #38
4. Delete junk test units post-Checkpoint 1.2 (P2)

**Session context:**
- Started: continuation from compacted prior session
- Ended: Phase 1.5 signed off + deployed + smoke-tested on prod
- Next session kicks off: Phase 1.6 (disconnect old knowledge UI) → Phase 1.7 (Checkpoint 1.2 E2E test)

---

## 7 Apr 2026 — Dimensions3 Phase C Complete (Generation Pipeline)

**What changed:**
- Dimensions3 Phase C (Generation) completed — all 6 tasks done
- Built 6 real pipeline stages replacing simulator mocks:
  - Stage 1: Block retrieval with 5-factor scoring (vector/efficacy/metadata/text/usage) + embedding fallback
  - Stage 2: Sequence assembly via Sonnet AI call with algorithmic fallback, prerequisite validation
  - Stage 3: Gap generation with parallel Sonnet calls (concurrency 4), FormatProfile-aware prompts
  - Stage 4: Connective tissue — transitions, cross-references, scaffolding progression, interaction map
  - Stage 5: Timing — Workshop Model phases, time_weight allocation, extensions, overflow detection
  - Stage 6: Quality scoring — 5 dimensions (CR/SA/TC/variety/coherence) with unevenness penalty
- Built pipeline orchestrator with sandbox/live modes + generation_runs logging
- FormatProfile pulse weights differ per unit type (service→agency, design→craft)
- Every stage returns CostBreakdown; empty library works gracefully (all gaps → all generated)
- Updated unit-types.ts with FormatProfile type export
- 25 new tests (72 total pipeline tests), build clean
- Committed on main (required manual worktree copy again — `claude/eloquent-morse` branch)

**Files created:** `src/lib/pipeline/stages/` (7 files), `src/lib/pipeline/orchestrator.ts`, `src/lib/pipeline/__tests__/stages.test.ts`

**Files modified:** `src/lib/ai/unit-types.ts` (FormatProfile type added)

**Systems affected:** Generation Pipeline (v1→v2)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md, CLAUDE.md

---

## 7 Apr 2026 — Dimensions3 Phase B Complete (Ingestion Pipeline)

**What changed:**
- Dimensions3 Phase B (Ingestion) completed — all 4 tasks done
- Built expandable ingestion pass registry with Pass A (classify+tag, Haiku) and Pass B (analyse+enrich, Sonnet)
- Block extraction from enriched sections with PII scan (regex) and copyright flags
- Created `content_items` + `content_assets` tables (migration 063, OS Seam 3+4)
- Built review queue UI: teacher approve/edit/reject extracted blocks + bulk approve
- API routes: POST `/api/teacher/knowledge/ingest`, GET/POST/PATCH `/api/teacher/activity-blocks/review`
- All pass functions are pure (OS Seam 1) — Supabase client via PassConfig, no HTTP deps
- 34 new passing tests, 420 total passing, 0 regressions
- Committed Phase A + Phase B to main (were stuck in worktree), pushed to origin
- Created Phase B instructions doc with full paths and git rules to prevent worktree issues
- Saved feedback to memory: Code must use full /questerra/ paths and commit to main, not worktrees

**Files created:** `src/lib/ingestion/` (10 files), `supabase/migrations/063_content_items.sql`, `src/app/teacher/knowledge/review/page.tsx`, `src/components/teacher/knowledge/` (3 files), `src/app/api/teacher/knowledge/ingest/route.ts`, `src/app/api/teacher/activity-blocks/review/route.ts`

**Systems affected:** Knowledge Pipeline (v0→v1, quarantined→active), Generation Pipeline (updated summary)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md, CLAUDE.md

---

## 7 Apr 2026 — Dimensions3 Phase A Complete

**What changed:**
- Dimensions3 Phase A (Foundation) completed — all 7 tasks done
- Migrations applied: Activity Block Library schema (first-class SQL entities with full Dimensions metadata)
- TypeScript types created for all pipeline contracts
- Pipeline simulator built (pure functions, tested via Vitest)
- Backend infrastructure in place
- 92 new passing tests, clean build, 0 regressions (11 pre-existing failures from main)
- Sandbox UI page exists (needs full stack for interactive testing)

**Systems affected:** Generation Pipeline (v0→v1), Activity Block Library (v0→v1), Testing Sandbox

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md

---

## 7 Apr 2026 — Discovery 3D Room Design Prototyping

**What changed:**
- Prototyped 3D room designs for Discovery Engine journey stations using raw Three.js + Kenney GLB asset packs (Furniture Kit + Nature Kit)
- Built v1 prototype (`discovery-rooms-prototype.html`) with floating platform approach — **rejected** by Matt (felt like space, not real locations)
- Built v2 prototype (`discovery-rooms-v2.html`) with 4 grounded room templates:
  - **IndoorRoom** — box room with walls/floor/ceiling/baseboard trim/ceiling lights (Foyer, Workshop, Gallery, Toolkit)
  - **Clearing** — circular ground with tree ring boundary, stars, moonlight (Campfire)
  - **Overlook** — partial enclosure with railing and distant vista (Window, Launchpad)
  - **Passage** — long narrow corridor with repeating arches and end-glow (Crossroads)
- Each station has: station-specific Kenney props, 3-point lighting, fog tinting, emissive crystal accents, ambient particles, animation system
- **Design decisions validated:** Grounded real locations (not floating platforms), nav UI pattern (station pills top-right, progress dots bottom, prev/next arrows), fire glow effect, per-station fog/particles/emissives
- Saved room design feedback to auto-memory for future sessions

**Files created:** `3delements/discovery-rooms-prototype.jsx`, `3delements/discovery-rooms-prototype.html`, `3delements/discovery-rooms-v2.html`

**Systems affected:** 3D Elements / Designville, Discovery Engine (visual layer)

---

## 7 Apr 2026 — Infrastructure & Documentation Overhaul (2 sessions)

**What changed:**

*Session 1 (pre-compaction):*
- Created `docs/projects/WIRING.yaml` — machine-readable system registry (82+ systems) with dependency tracing and impact analysis
- Created `docs/projects/wiring-dashboard.html` — interactive dark-themed dashboard for browsing system dependencies
- Added wiring sync to `saveme` (steps 6-7)
- Audited 3 standing instruction docs for staleness:
  - Updated `docs/education-ai-patterns.md` — refreshed to reflect all 27 complete tools, Dimensions3 ai_rules, Journey Engine patterns (17 Mar → 7 Apr)
  - Updated `docs/design-guidelines.md` — added Section H (Generation Pipeline, 8 guidelines) and Section J (Journey Engine, 5 guidelines), total now 57 (29 Mar → 7 Apr)
  - `docs/research/student-influence-factors.md` — audited, still fresh, no changes needed

*Session 2 (continuation):*
- **Fix 1:** Slimmed CLAUDE.md from 424 → 147 lines — extracted Key Decisions → `docs/decisions-log.md` (182 entries), Lessons Learned → `docs/lessons-learned.md` (31 entries), resolved issues → `docs/resolved-issues-archive.md`
- **Fix 2:** Created `docs/doc-manifest.yaml` — index of ~217 documentation files with title, purpose, category, freshness dates
- **Fix 3:** Created `docs/changelog.md` (this file) — rolling session log
- **Fix 4:** Added saveme reminder instruction + expanded saveme to 10 steps (added doc-manifest, changelog, saveme-reminder)
- **Full trust audit:** Verified all CLAUDE.md cross-references (fixed 3 wrong paths in AI Brain table: `docs/` → `docs/brain/`), added Documentation Index section (7 routing pointers), fixed doc-manifest gaps (missing open studio files, escaped paths), fixed 4 project name mismatches in dashboard.html
- Mapped 24 knowledge routing paths — all now COVERED or WEAK (no gaps)

**Files created:** decisions-log.md, lessons-learned.md, resolved-issues-archive.md, doc-manifest.yaml, changelog.md, WIRING.yaml, wiring-dashboard.html

**Files modified:** CLAUDE.md (restructured), education-ai-patterns.md, design-guidelines.md, dashboard.html (4 name fixes)

**Systems affected:** Documentation Infrastructure, CLAUDE.md, Project Tracking, Wiring Diagram, Standing Instruction Docs

**Session context:** Matt asked for a meta-audit of documentation systems ("how am I placed? what am I missing to make sure I don't need to keep things in my head?"). Identified 7 gaps, implemented 4 infrastructure fixes, then ran a full trust audit verifying every cross-reference, manifest entry, and knowledge routing path.

---

## 7 Apr 2026 — CI/CD & Monitoring Infrastructure (Session 3, continuation)

**What changed:**

- **GitHub Actions CI** (`.github/workflows/ci.yml`) — lint + typecheck + build on push/PR to main. Requires 3 GitHub Secrets.
- **Nightly Audit** (`.github/workflows/nightly.yml`) — dep audit + typecheck + build at 2am Nanjing (6pm UTC). `workflow_dispatch` for manual trigger.
- **Health Endpoint** (`src/app/api/health/route.ts`) — public `/api/health`, pings Supabase via `createAdminClient()`, returns `{ok, db, timestamp, responseTime}`. No auth required. `Cache-Control: no-store`.
- **Sentry verified fully configured** — `instrumentation.ts` (server+edge), `instrumentation-client.ts` (browser), `global-error.tsx`, `error-handler.ts` (14+ API routes). Only missing piece was `SENTRY_AUTH_TOKEN` for source maps → now added to Vercel.
- **Automation build plan updated** (`docs/automation/automation-build-plan.md`) — Sprints 1-2 marked COMPLETE, Matt's manual action items listed.
- **Manual setup completed by Matt:** Sentry auth token created (Project=Read, Release=Admin), `SENTRY_AUTH_TOKEN` + `NEXT_PUBLIC_SENTRY_DSN` added to Vercel env vars, 3 GitHub Secrets added (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SENTRY_DSN`).
- **Scheduled task created:** `refresh-project-dashboard` — manual-only task that syncs ALL-PROJECTS.md → dashboard.html.

**Files created:** `.github/workflows/ci.yml`, `.github/workflows/nightly.yml`, `src/app/api/health/route.ts`

**Files modified:** `docs/automation/automation-build-plan.md`, `docs/projects/ALL-PROJECTS.md` (39 features, +2 Infrastructure & Operations), `docs/projects/dashboard.html` (+2 complete entries), `CLAUDE.md` (37→39 feature count), `docs/projects/WIRING.yaml` (automation system → v2 complete), `docs/projects/system-architecture-map.html` (automation → v2 complete), `docs/doc-manifest.yaml` (+3 new entries, freshness updates)

**Systems affected:** Automation/CI/CD, Sentry Error Tracking, Health Monitoring, Documentation Infrastructure, Project Tracking

**Session context:** Continuation of infrastructure overhaul. Matt guided through manual Sentry token creation, Vercel env var setup, and GitHub Secrets configuration. Sprints 3-4 (bug report widget, pg_cron) remain for future sessions. Sentry alert rule and Better Stack uptime monitoring are optional remaining manual steps.

---

## 7 Apr 2026 — Test Infrastructure & Build Readiness Audit (Session 4)

**What changed:**

- **Build readiness assessment** — Critical assessment of organizational systems before Dimensions3. Scored 8/10 docs, 6/10 build readiness. Identified 7 gaps, resolved all 5 actionable ones.
- **Test infrastructure audit** — Discovered 15 existing test files (was assumed zero). Added 2 new critical test files: `stage-contracts.test.ts` (30 tests for Dimensions3 pipeline typed contracts) and `validation.test.ts` (27 tests for AI output validation).
- **Fixed 11 pre-existing test failures** — teaching-moves scoring logic (zero-score filter with maxResults), timing-validation debrief min (5→3), lesson-pulse penalty boundary (strict→inclusive) and prompt format changes, stale snapshot deletion. All 389 tests now green.
- **4 automated health check scripts:**
  - `scripts/check-dashboard-sync.ts` — validates ALL-PROJECTS.md ↔ dashboard.html sync
  - `scripts/check-doc-freshness.ts` — validates doc-manifest.yaml paths, dates, staleness (--fix mode)
  - `scripts/check-wiring-health.py` — validates WIRING.yaml parsing, dangling refs, orphans (--trace mode)
  - `scripts/check-session-changes.sh` — git-based saveme reminder trigger
- **CI/nightly enhanced** — ci.yml now runs `npm test` + dashboard sync check; nightly.yml runs all 4 health checks
- **WIRING.yaml battle-tested** — fixed 20 unquoted YAML values, removed 3 dangling references (education-ai-patterns, analytics, development-workflow), expanded to 92 systems
- **doc-manifest.yaml cleaned** — fixed 155/164 unknown dates from file mtime, corrected 5 broken paths, total now 222 entries
- **Test coverage map** — `docs/testing/test-coverage-map.md` maps all 17 test files with Dimensions3 criticality ratings and gap inventory

**Files created:** `src/lib/pipeline/__tests__/stage-contracts.test.ts`, `src/lib/ai/__tests__/validation.test.ts`, `scripts/check-dashboard-sync.ts`, `scripts/check-doc-freshness.ts`, `scripts/check-wiring-health.py`, `scripts/check-session-changes.sh`, `docs/testing/test-coverage-map.md`

**Files modified:** `src/lib/ai/__tests__/teaching-moves.test.ts` (6 test fixes), `src/lib/ai/__tests__/timing-validation.test.ts` (debrief min fix), `src/lib/layers/__tests__/lesson-pulse.test.ts` (penalty + prompt fixes), `.github/workflows/ci.yml` (+test+sync steps), `.github/workflows/nightly.yml` (+4 health checks), `docs/projects/WIRING.yaml` (20 YAML fixes, 3 dangling refs removed, automation entry updated), `docs/doc-manifest.yaml` (155 dates fixed, 5 paths fixed, 5 new entries)

**Systems affected:** Test Infrastructure, Automation/CI/CD, Documentation Infrastructure, WIRING Diagram, Project Tracking

**Session context:** Matt asked "am I ready to build again without going mental?" before starting Dimensions3. Systematic audit revealed test failures, YAML parse errors, doc drift, and missing automation. All resolved — 389/389 tests green, all health checks passing.

---

### 7 April 2026 — 3D Render Modes Plan Integration

**What changed:**
- Integrated `docs/StudioLoom-3D-Render-Modes-Plan.docx` into `docs/projects/3delements.md`
- Section 7 restructured from flat 5-mode list into two-dimensional architecture: 5 render presets (Showcase/Designville/Workshop/Tutorial/Print) × 5 UI container modes (Fullscreen/Embedded/Floating/Modal/PiP)
- Added Section 7A (render presets with stack/asset/camera details), 7B (UI containers, preserved from original), 7C (combination matrix showing typical pairings)
- Layer 1 description updated to reflect two-dimensional rendering
- Phase 0 build plan updated: Workshop render preset first (validates shared asset pipeline)
- Section 3 file table and Section 20 files reference updated to include the docx
- New entry in doc-manifest.yaml for the docx

**Files modified:** `docs/projects/3delements.md`, `docs/projects/ALL-PROJECTS.md`, `docs/projects/dashboard.html`, `docs/doc-manifest.yaml`, `docs/changelog.md`

**Systems affected:** 3D Scenes (rendering architecture), 3D Assets (shared pipeline insight)

**Session context:** Matt asked to find the Render Modes Plan docx and integrate it into the 3D Elements project doc. Key insight from the docx: render presets and UI containers are orthogonal — one .glb asset library feeds all five presets.

---

*Newer entries below this line.*

---

## 9 Apr 2026 — Dimensions3 Wiring Complete (Pipeline → Wizard Routes)

**What changed:**
- Wired Dimensions3 pipeline to existing wizard UI — teachers can generate units again
- W1: Input adapter (`wizardInputToGenerationRequest`) — maps UnitWizardInput → GenerationRequest. Topic, unitType, lessonCount (from durationWeeks), gradeLevel, framework (default IB_MYP), constraints, context, preferences
- W2: Output adapter (`timedUnitToContentData`) — maps TimedUnit → UnitContentDataV2/UnitPage format that lesson editor, Teaching Mode, and student experience expect
- W3: Un-quarantined `/api/teacher/generate-unit/route.ts` — removed 410 early return, now calls `runPipeline()` orchestrator, returns single JSON response (no streaming for v1)
- W4: Un-quarantined wizard page (`/teacher/units/create/page.tsx`) — removed "Being Rebuilt" early return, `generateAll()` now makes single POST instead of per-criterion streaming
- W5: Fixed JSX tag mismatch on units page (quarantine changed `<Link>` → `<span>` but missed closing tag)
- W8: 34 adapter tests (17 input + 17 output) covering minimal/full input, all unit types, edge cases
- Supabase migrations 060-064 applied to production (activity_blocks, generation_runs, teacher_tier, content_items, feedback_proposals)
- Note: W5 (re-enable UI buttons), W6 (remaining quarantined routes), W7 (edit tracking integration) deferred — pipeline works via direct wizard flow

**Files created:** `src/lib/pipeline/adapters/input-adapter.ts`, `src/lib/pipeline/adapters/output-adapter.ts`, `src/lib/pipeline/adapters/__tests__/adapters.test.ts`, `docs/projects/dimensions3-wiring-instructions.md`

**Files modified:** `src/app/api/teacher/generate-unit/route.ts` (un-quarantined), `src/app/teacher/units/create/page.tsx` (un-quarantined), `src/app/teacher/units/page.tsx` (tag fix)

**Systems affected:** Generation Pipeline (wired to wizard), Unit Generation Wizard (un-quarantined), Quarantine (partially lifted)

**Commits:** `2ffe92e` (wiring, 5 files, 817 insertions), `3a43514` (tag fix)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md

---

## 9 Apr 2026 — Dimensions3 Phase E Complete (Admin Dashboard + Polish) — ALL PHASES DONE

**What changed:**
- Dimensions3 Phase E completed — all 5 tasks done. **This completes the entire Dimensions3 build.**
- E1: Unit Import Flow — teacher uploads an existing unit plan, system runs ingestion pipeline + AI reconstruction (Sonnet), produces a Match Report with side-by-side comparison (original vs reconstructed), per-lesson match %, colour-coded diff. Teacher can accept/edit/reject. Files: `src/lib/ingestion/unit-import.ts`, `src/app/teacher/knowledge/import/page.tsx`, `src/components/teacher/knowledge/MatchReport.tsx`, `src/app/api/teacher/knowledge/import/route.ts`.
- E2: Admin Dashboard Landing Page — health strip with 5 traffic lights (Pipeline/Library/Cost/Quality/Wiring), active alerts feed (red badges), quick stats row (active teachers, students, units, blocks, bugs), 7-day trend sparklines. Files: `src/app/admin/page.tsx`, `src/components/admin/dashboard/HealthStrip.tsx`, `QuickStats.tsx`, `AlertsFeed.tsx`, `src/lib/admin/health-checks.ts`, `src/app/api/admin/health/route.ts`.
- E3: Admin Tab Navigation + Key Tabs — updated admin layout with horizontal tab bar linking all sections. 4 fully built tabs: Pipeline Health (recent runs, per-stage success/failure, error log), Block Library (browse/search/filter blocks by category/phase/source, sort by efficacy/usage/date), Cost & Usage (daily/weekly/monthly cost aggregation, per-teacher breakdown), Settings (model selection per tier, guardrail config viewer). Remaining tabs as stubs. Files: `src/app/admin/pipeline/page.tsx`, `library/page.tsx`, `costs/page.tsx`, `settings/page.tsx` + components.
- E4: 13 Smoke Tests — 6 E2E flow tests (ingestion→library, library→generation, generation→delivery, delivery→tracking, tracking→feedback, feedback→library) plus component tests. On-demand trigger via API. Files: `src/lib/__tests__/smoke-tests.test.ts`, `src/app/api/admin/smoke-tests/route.ts`.
- E5: 6 Operational Monitors — pure functions that query the database and return typed results: pipeline health (24h success/failure rate, avg time, cost trend), cost alerts (threshold checks, spike detection), quality drift (Pulse score week-over-week), edit tracker summary (most-edited/deleted blocks, new patterns), stale data watchdog (unscanned blocks, failed runs, orphaned data), usage analytics (active users, generation counts, library growth). All feed into admin dashboard. Files: `src/lib/admin/monitors/` (6 files + index).
- 30 new files, 2440 lines total
- Committed on main (copied from worktree `claude/eloquent-morse`)

**Systems affected:** Admin Dashboard (v0→v1, planned→active), Generation Pipeline (all phases complete)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md, CLAUDE.md

---

## 9 Apr 2026 — Dimensions3 Phase D Complete (Feedback System)

**What changed:**
- Dimensions3 Phase D (Feedback) completed — all 4 tasks done
- D1: Teacher Edit Tracker — diff detection per activity when teacher saves a generated unit. Classifies edits as kept/rewritten/scaffolding_changed/reordered/deleted/added. Stores diffs in generation_feedback table with before/after snapshots and diff percentage. Auto-queues blocks to review queue based on edit thresholds (<20% diff → efficacy 50, 20-60% → efficacy 45, >60% → teacher-authored).
- D2: Efficacy Computation — 6-signal weighted formula (kept_rate 30%, completion_rate 25%, time_accuracy 20%, deletion_rate 10%, pace_score 10%, edit_rate 5%). Batch job aggregating teacher edits + student progress + pace feedback. Outputs proposed score adjustments that enter approval queue.
- D3: Approval Queue UI + Guardrails — Admin UI at `/admin/feedback` with ApprovalQueue and AdjustmentCard components. Hard guardrails: efficacy capped 10-95 per cycle, time_weight max one step change, bloom_level/phase/activity_category changes always require manual approval, max 20% metadata change per cycle. Batch-approve for high-confidence changes. Auto-approve threshold configurable (OFF by default). Full audit log.
- D4: Self-Healing Proposals — Pattern detection for time_weight mismatch (>50% diff across 8+ uses), low completion (<30% across 10+ uses), high deletion (>70% across 5+ uses). Proposals enter approval queue with full evidence.
- Migration 064: generation_feedback, feedback_proposals, feedback_audit_log tables
- 60 new tests, 480+ total passing, build clean
- Committed on main (Code finally used main branch correctly)

**Files created:** `src/lib/feedback/` (6 files: edit-tracker.ts, efficacy.ts, signals.ts, types.ts, guardrails.ts, self-healing.ts), `src/app/admin/feedback/page.tsx`, `src/components/admin/feedback/ApprovalQueue.tsx`, `src/components/admin/feedback/AdjustmentCard.tsx`, `src/app/api/admin/feedback/route.ts`, `supabase/migrations/064_feedback_proposals.sql`

**Systems affected:** Generation Pipeline (v2, feedback loop added), Activity Block Library (efficacy scoring)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md, CLAUDE.md

---

## 10 Apr 2026 — Dimensions3 v2 Completion Spec Signed Off

**What changed:**
- Created `docs/projects/dimensions3-completion-spec.md` (v2, ~1,600 lines) — canonical build plan for completing Dimensions3. Full rewrite of v1 after audit found significant coverage gaps.
- v1 audit findings fixed: (a) removed Stage 5b misconception — curriculum mapping is render-time via FrameworkAdapter, not a pipeline stage; (b) added new Phase 5 for Content Safety (§17 of master spec) — Layer 1 LDNOOBW blocklist + Layer 2 Haiku moderation, NSFW.js image classifier, franc-min language detection, ZH-Hans support, migration 067 for moderation tables; (c) expanded Phase 4 to cover all 7 operational automation systems from §9.3; (d) expanded Phase 7 to build all 12 admin tabs from §14.7 (was 5), 5 distinct sandboxes from §7 (was 1), per-teacher profitability dashboard, new Bug Reporting System.
- Added execution discipline: Guiding Rules §1, 12 mandatory Matt Checkpoints, per-sub-task verification, rollback sections, realistic 21–25 day estimate.
- Phase 0 prerequisites locked in: migration 065 adds `class_id` to student_progress (single-class auto-backfill, multi-class NULL); `is_sandbox` flag on knowledge_uploads + query guard.
- Phase 4.7 model ID sweep: 12 files still on hardcoded `claude-sonnet-4-20250514` → update to `claude-sonnet-4-6` (consistency fix, string already in use by newer code in anthropic.ts). Add pricing entry to usage-tracking.ts. Delete duplicate pass-b-enrich.ts.
- Resolved all 12 open questions via Matt Q&A, logged in §13 of completion spec and appended to decisions-log.md.
- Efficacy formula locked: `0.30*kept + 0.25*completion + 0.20*time_accuracy + 0.10*(1-deletion) + 0.10*pace + 0.05*(1-edit)`.

**Files created:** `docs/projects/dimensions3-completion-spec.md`
**Files modified:** ALL-PROJECTS.md, decisions-log.md, changelog.md, doc-manifest.yaml, auto-memory

**Systems affected:** Dimensions3 Generation Pipeline (v2 plan), Ingestion Pipeline (sandbox flag), Content Moderation (new), student_progress schema (class_id), Admin Dashboard (12 tabs scope), Bug Reporting (new)

**Session context:** Continued from prior session's v2 rewrite. Walked through 12 open questions, verified model ID situation via grep, resolved all decisions, finalised cross-check against master spec + known issues, then saveme. Build ready to kick off. Next: Phase 0 cleanup + migrations 065 & is_sandbox.

---

## 10 Apr 2026 — StudentDash Prototype v2 (Miro-Bench Variant)

**What changed:**
- Built `docs/dashboard/r3f-motion-sample.html` — second StudentDash prototype. Single-file HTML (React 18 + R3F + Framer Motion via esm.sh import map). Flat 2D Miro-style wood workbench filling viewport (tan gradient + turbulence wood grain + hand-placed bench marks + edge vignette).
- One low-poly boombox speaker embedded top-right via fixed-camera R3F anchor pattern — draggable motion.div wrapping a Canvas with fixed camera, so dragging translates the rendered bitmap but the 3D perspective stays identical across the whole screen. ~10 flat-shaded meshes, camera at `[1.6, 3.6, 2.2]` fov 30 looking down onto the top.
- One clickable 3D hex-medal badge bottom-right — low-poly gold hexagonal prism with bevelled face, inset centre disc, 5 raised star-point boxes, red ribbon flap, loop at top. Hover boosts rim/face/star emissive intensities, bumps pointLight 1.0→3.5, fades in blurred CSS radial glow, warms "BADGES" pill label cream→amber, scales 1.06×. Click is placeholder `console.log` ready for real route.
- Three draggable student-content cards: Current Unit (Bluetooth Speaker, lesson 4/7, progress bar), Next Step ("Sketch 3 form variations", ~25 min), Feedback · Ms. Chen (mentor quote + adjustment suggestion).
- Card interaction model: `dragConstraints={constraintsRef}` on `.cards-layer` + `dragElastic: 0.25` for bounce-back, single top-right rotate corner (`↻` glyph, pointer-angle from card centre with ±180° seam unwrap), single bottom-right resize corner (diagonal stripes, x+y delta average, clamped 0.6–1.8×), snap-to-stack on `onDragEnd` (nearest sibling via shared `registry` ref, 140px threshold, +26/+22 offset, +2° rotation, zCounter pops to front), `drag={!cornerActive}` prevents drag-corner conflict.
- Iterations during session: started with 4 rotate corners, dropped to 1 (visual clutter); first used `onWheel` for rotation, replaced with corner grab-and-spin (more discoverable).
- Added Prototype v2 section to `docs/projects/studentdash.md` documenting what was built, interaction model, v1-vs-v2 comparison, 6 reusable primitives worth keeping, what's NOT in v2 (parked features), and 4 new v2-specific open questions.

**Key takeaway:** v2 is cheaper to ship than v1 (one Canvas vs full scene, flat 2D CSS, responsive) and introduces reusable primitives: flat workbench recipe, fixed-camera R3F anchor, hover-glow 3D badge, single-corner card interactions, snap-to-stack via registry ref, student-action cards > unit thumbnails. Neither prototype committed — student testing should compare.

**Files created:** `docs/dashboard/r3f-motion-sample.html`
**Files modified:** `docs/projects/studentdash.md`, `docs/projects/ALL-PROJECTS.md`, `docs/doc-manifest.yaml`, `docs/changelog.md`

**Systems affected:** StudentDash (student-dashboard in WIRING.yaml) — prototype direction expanded, no code changes to live dashboard.

**Session context:** Iterative prototype session. Started from earlier 3D Studio Desk scene, pivoted to flat Miro-style workbench, rebuilt speaker as low-poly R3F boombox, adjusted camera angle to top-down, moved speaker to top-right, replaced card content with student-actionable items, added clickable 3D badge entry point with hover glow. Matt wants to come back to the reusable primitives later — saveme captures what's worth keeping.

---

## 10 Apr 2026 — Student Learning Profile Schema — Option 2 Stress-Test Extension

**What changed:**
- Stress-tested the Student Learning Profile spec against 4 questions (enough data points? world class? flexible for new journey blocks? real needle movers for adolescent design students?). Identified 5 structural gaps.
- Matt chose **option 2** — build all 5 gaps into v1 to avoid a rebuild in 3 months. Explicit callouts: motivation + peers (incl. group work) + "add fields later" extensibility.
- **Gap A — SDT motivational_state** added to `current_state`: autonomy/competence/relatedness/purpose with value/trajectory/confidence/last_signals, 21-day TTL, drives new SDT-based pedagogy rules in `synthesizePedagogyPreferences` §10.4 6b.
- **Gap B — social section** added with group work support: collaboration_orientation (lone_wolf / small_group / connector / adaptive), critique_giving_quality + critique_receiving_quality (bidirectional), help_seeking_pattern, peer_influences[], group_history[], current_groups[]. Cross-student privacy via per-session HMAC peer_student_id hashing for system viewers. New `PeerInteractionWorker` §10.6. New COPPA `social` scope.
- **Gap C — dimension registry** added: new `profile_dimensions` table (§7.6) + `profile.custom` JSONB slot (§8.8) + `<RegisteredDimensionWriter>` dispatcher. Future journey blocks can declare new dimensions without migrations. Synthesis loop (§10.4 6d) discovers registered dimensions and applies their `synthesis_contributions` to pedagogy_preferences. V1 admin-only registration; 2 seeds (metacognition_score, feedback_receptiveness).
- **Gap D — creative_voice** added to identity: 1024-d aesthetic_embedding (rolling mean of Work Capture submissions, 30-day half-life), material_preferences, visual_tags, stated_references, revealed_references (cosine match against designer corpus), voice_confidence. New `CreativeVoiceWorker` §10.7 with surgical `writeCreativeVoice` SECURITY DEFINER grant (only touches identity.creative_voice.*). Directly unblocks Designer Mentor matching via `mentor_matcher` touchpoint.
- **Gap E — trajectory_snapshots[]** added to identity: append-only, 50-cap, 4 triggers (term_end scheduled, drift when archetype Δ > 0.15, manual, project_end). Deterministic notable_delta. New `TrajectorySnapshotJob` §10.8. Gives O(1) long-horizon queries for 6-year student arc.
- **Writer classes:** 5 → 7 (added PeerInteractionWorker, CreativeVoiceWorker, TrajectorySnapshotJob, `<RegisteredDimensionWriter>`).
- **Read API §11:** ProfileReadOptions extended with social/custom sections + includeTrajectory; 9 enforcement rules (was 7) — added cross-student peer hash for system viewers, custom visibility filtering, trajectory gating, mentor_matcher exclusive access to aesthetic_embedding.
- **Requirements §13:** added P0-13 (SDT), P0-14 (social + group work), P0-15 (dimension registry), P0-16 (creative_voice + Designer Mentor unblock), P0-17 (trajectory snapshots).
- **Open questions §15:** added OQ-11 through OQ-15. Three new blockers: OQ-13 HMAC salt scope, OQ-14 group FERPA RLS tightening, OQ-15 Discovery SDT tag audit.
- **Build plan §17:** stretched 15-19d → **21-25d**. Phase A 8→11d, B 3→5d, C 3→4d, D 2-4→5d. Designer Mentor matcher hook lands Day 23.
- **Risks §18:** added 7 new entries (peer privacy leak Critical, group FERPA High, dimension sprawl, creative_voice staleness, SDT signal sparsity, trajectory drift, grant scope creep).
- **Appendix §21:** example profile now shows all new sections; rendered DA prompt includes motivation snapshot + relatedness/purpose guidance.

**Files modified:**
- `docs/specs/student-learning-profile-schema.md` (~2,211 lines, +~1,200 lines of additions)
- `docs/projects/ALL-PROJECTS.md` (SLP entry updated — 12-16d → 21-25d, 7 sections, 5 blockers)
- `docs/projects/dashboard.html` (new P0 ready entry)
- `docs/decisions-log.md` (6 new decisions)
- `docs/doc-manifest.yaml` (last_verified bump)
- `docs/changelog.md` (this entry)

**Systems affected:** Student Learning Profile (spec only, no code); downstream: Designer Mentor System (unblocked via creative_voice), Discovery Engine (needs SDT tag audit), Open Studio v2 (benefits from motivational_state), Journey Engine (enables custom dimension declaration), Work Capture Pipeline (feeds creative_voice embeddings), Class Gallery + Peer Review (feeds PeerInteractionWorker), Teaching Mode (group check-ins feed group_history).

**Session context:** Matt's "do we have enough data points, is this world class, is there flexibility?" stress test revealed that the initial 5-section spec was missing motivation, peer/social dynamics, a runtime extensibility slot, aesthetic fingerprinting, and long-horizon trajectory compression. Option 2 (build it all now, +6d) chosen over option 1 (defer, risk rebuild) because Matt explicitly confirmed motivation + peers + group work + "add fields later" as non-negotiable. Three blocking OQs must resolve before Phase A coding: HMAC salt scope (OQ-13), group FERPA RLS (OQ-14), Discovery SDT tag audit (OQ-15).

---

## 10 Apr 2026 — StudentDash Prototype v2: Focus Mode Added

**What changed:**
- Added a Focus Mode toggle to `docs/dashboard/r3f-motion-sample.html`. iOS-style pill switch in the header-right area alongside the toolbar. Shows "Focus" when off, "Focus on" in amber with sliding knob when on.
- On toggle: Next Step card springs to screen centre at 1.35× scale with rotation zeroed via framer-motion's imperative `animate()`. Every non-essential element (speaker, badge, other two cards, header title) fades to opacity 0 with pointer-events disabled and drag turned off. Toolbar + focus toggle stay visible.
- Off toggle: savedRef snapshot (captured at the moment focus turned on) restores the Next Step card's exact prior x/y/rotate/scale — so user can drag/resize/rotate it to any position, hit focus, hit focus again, and return to the exact prior state. Other elements fade back in with stagger.
- `framer-motion` import expanded to include `animate` function for the imperative motion-value springs.
- Drag, hover, and click are all gated on focusMode so hidden elements can't be interacted with by keyboard/trackpad.
- New CSS: `.focus-toggle`, `.focus-switch` (with sliding knob pseudo-element), `.header-right` wrapper.
- Updated `studentdash.md` Prototype v2 section to add Focus Mode as reusable primitive #7 — "any complex dashboard can have a single 'what matters right now' mode that doesn't destroy state."

**Files modified:** `docs/dashboard/r3f-motion-sample.html`, `docs/projects/studentdash.md`, `docs/projects/ALL-PROJECTS.md`, `docs/projects/dashboard.html`, `docs/doc-manifest.yaml`, `docs/changelog.md`

**Systems affected:** StudentDash prototype only — no live code changes.

**Session context:** Follow-up iteration to the Miro-Bench prototype. Matt asked for a focus toggle so the dashboard can strip down to just "the next step" when a student wants to stop doom-scrolling the desk. Implementation uses imperative `animate()` against existing motion values rather than remounting, so drag state and corner interactions survive the toggle. The savedRef pattern (snapshot → animate away → animate back) is reusable for any "temporary view" mode elsewhere.

---

## 10 Apr 2026 — Student Learning Profile: Unified Schema Spec

**What changed:**
- Created `docs/specs/student-learning-profile-schema.md` (~1000 lines) — canonical build-ready spec consolidating three overlapping profile specs (discovery-intelligence-layer, student-learning-intelligence, cognitive-layer) into one unified `student_learning_profile` table.
- 5 internally-owned sections (identity, cognitive, current_state, wellbeing, passive_signals) + computed `pedagogy_preferences` derived section. Single writer class per section enforced via SECURITY DEFINER + CI grep checks.
- Companion tables: `student_project_history` (immutable per-project rows), `student_learning_events` (audit log).
- 5 writer classes: ProfilingJourneyWriter, CognitivePuzzleWriter, PassiveSignalWorker, TeacherProfileEditor, ProfileSynthesisJob.
- Section-level visibility: identity/cognitive/current_state/pedagogy student-visible; wellbeing/passive_signals teacher-only.
- 4-phase build plan: A schema+writers (5d), B synthesis+read API (4d), C AI prompt injection (3d), D rollout (2-4d). Total 12-16 days. Feature flag `student_profile_v1`, hard cutover migration.
- 10 open questions documented; 3 marked blocking before Phase A: OQ-2 multi-class teacher RLS, OQ-4 COPPA gating, OQ-9 synthesis job trigger.
- Added entry to `docs/projects/ALL-PROJECTS.md` Active Projects (P0).

**Files created:** `docs/specs/student-learning-profile-schema.md`
**Files modified:** `docs/projects/ALL-PROJECTS.md`, `docs/changelog.md`, `docs/doc-manifest.yaml`

**Systems affected:** Touches future Designer Mentor matching, Discovery Cognitive Layer, Open Studio v2 plan health, Design Assistant prompt injection, Journey Engine `learning_profile` writes. No code changes — spec only.

**Session context:** Follow-up to "mindprint" exploration. Matt locked in 4 design decisions via AskUserQuestion (separate history table / computed pedagogy_preferences / section-level visibility / hard cutover) before spec was written. Spec is the next big project — Matt to work through it. Three blocking OQs to be resolved before Phase A coding begins.

---

## 11 Apr 2026 — Skills Library + Open Studio Mode: Project Kickoff + File Reorganization

**What changed:**
- Reviewed 8 workshop artifacts in the temporary `docs/skillsandopenstudio/` bucket (session summary, open studio mode spec, skills library design note + completion addendum, strength chart prototype, open studio wireframe, reference prototypes, composed student dashboard).
- Created two new P1 projects: `docs/projects/skills-library.md` and `docs/projects/open-studio-mode.md`. Added both to `ALL-PROJECTS.md` 🔵 Planned section.
- `open-studio-mode.md` contains a ⚠️ MANDATORY required-reading block listing 18 files — triggered whenever Matt says "start Open Studio Mode". Covers all 3 Open Studio project docs (v1 shipped, v2 planning journey, Mode runtime), 6 canonical specs, 4 prototypes, Skills Library dependency, build methodology.
- `skills-library.md` supersedes the older `self-help-library.md` idea doc. Old doc marked SUPERSEDED with pointer. Old `openstudio.md` also marked SUPERSEDED with pointer to open-studio-mode.md + openstudio-v2.md.
- Added sibling cross-link: `openstudio-v2.md` now references `open-studio-mode.md` as sibling.
- Reorganized workshop files to canonical homes: skills library specs → `docs/specs/`, strength chart prototype → `docs/prototypes/`, open studio mode spec → `docs/open studio/`, open studio prototypes → `docs/open studio/prototypes/`, session summary → `docs/open studio/prototypes/SESSION-SUMMARY-apr-2026.md`. Empty bucket deleted.
- Updated WIRING.yaml: modified `student-open-studio` entry (supersession note, affects list), added new `skills-library` and `open-studio-mode` system entries with full docs/data_fields/affects arrays.
- Synced `dashboard.html` PROJECTS array and `wiring-dashboard.html` SYSTEMS array with new entries.
- Added auto-memory entry `.auto-memory/project_open_studio_mode_required_reading.md` — future sessions will read the required-reading block when Matt says "start Open Studio Mode".
- Appended 4 decisions to `docs/decisions-log.md` (sibling-not-merge, supersession, 4-mechanism lock-in, workshop reorganization rule).
- Added 10 new doc entries to `docs/doc-manifest.yaml`.

**Files created:**
- `docs/projects/skills-library.md`
- `docs/projects/open-studio-mode.md`
- `.auto-memory/project_open_studio_mode_required_reading.md`

**Files modified:** ALL-PROJECTS.md, dashboard.html, wiring-dashboard.html, WIRING.yaml, openstudio-v2.md, openstudio.md, self-help-library.md, decisions-log.md, doc-manifest.yaml, changelog.md, .auto-memory/MEMORY.md

**Files moved (workshop → canonical):** 8 files out of `docs/skillsandopenstudio/` (now deleted) into specs/, prototypes/, open studio/, open studio/prototypes/.

**Systems affected:** `skills-library` (new, planned, v0), `open-studio-mode` (new, planned, v0), `student-open-studio` (v1 noted as superseded-in-behaviour by Mode). Touches future work across learning_events schema (new event types), Journey Engine consumers, and student dashboard UI.

**Session context:** Matt dropped 8 workshop artifacts and asked me to check for related existing projects, start new ones if needed, then organize the files. Key concern: guaranteed context preservation for future sessions — solved with a 4-mechanism lock-in (cross-links + required-reading block + auto-memory trigger + WIRING entries). No code changes — planning and organization only. Both projects remain planned/P1; build starts next week.

## 12 Apr 2026 — Dimensions3 v2 Phase 2: Sub-tasks 5.5–5.9 shipped (FormatProfile wiring + FrameworkAdapter)

**What changed:**
- **5.5 test phase** closed — stage 3 gap-generation rules per-profile tests with mocked AI + 4 fixtures (design/service/PP/inquiry). 6 tests. Commit `e610050`.
- **5.6 design + test** closed — FormatProfile.connectiveTissue added as required field, wired into stage 4 polish prompt (audienceLanguage + reflectionStyle gloss + transitionVocabulary). 5 tests with double-sensitive distinctness gate. Commits `bc46383` + `1991de2`.
- **5.7 design + test** closed — FormatProfile.timingModifiers additively extended to 5 fields (added defaultWorkTimeFloor + reflectionMinimum), wired into stage 5 timing. 5 tests with 3 NC proofs including edge-case sharpness. Commits `fa8e3dc` + `c5fc92f`.
- **5.8 test-only** closed — stage 6 pulseWeights wiring test with 3 synthetic orthogonal profiles ({1,0,0}/{0,1,0}/{0,0,1}) + shared TimedUnit. NC via hardcoded `1/3` collapse to 6.6. Commit `0e101aa`.
- **5.9 FrameworkAdapter build + test** closed — `src/lib/frameworks/adapter.ts` + 8 mapping files + 139 tests + 8×8 JSON fixture cross-check. Discriminated union return type (label | implicit | not_assessed) for 16 gap cells, 0 not_assessed (all implicit roll-ups). 3 exam-prep context overrides. Commits `ccc3d2a` + `4e31363`.

**Files created:**
- `src/lib/frameworks/adapter.ts` (199 lines)
- `src/lib/frameworks/mappings/{myp,gcse,alevel,igcse,acara,pltw,nesa,victorian}.ts` (8 files, 31–56 lines each)
- `src/lib/frameworks/__tests__/adapter.test.ts` (262 lines, 139 tests)
- `tests/fixtures/phase-2/framework-adapter-8x8.json` (208 lines)
- `src/lib/pipeline/stages/__tests__/stage3-gap-generation-rules.test.ts` + 4 stage3 fixtures
- `src/lib/pipeline/stages/__tests__/stage4-polish-connective-tissue.test.ts` + 4 stage4 fixtures
- `src/lib/pipeline/stages/__tests__/stage5-timing-profile-wiring.test.ts`
- `src/lib/pipeline/stages/__tests__/stage6-scoring-pulse-weights-wiring.test.ts`

**Files modified:** `src/lib/ai/unit-types.ts` (connectiveTissue + timingModifiers extensions), `src/lib/pipeline/stages/stage4-polish.ts` (connectiveTissue injection), `src/lib/pipeline/stages/stage5-timing.ts` (work-time floor + reflection minimum wiring), 3 pre-existing stage4 test fixtures thickened with stub connectiveTissue.

**Followups filed (docs/projects/dimensions3-followups.md):**
- FU-A: `pipeline.ts:590-592` simulator stage6 duplicate (from 5.8 pre-flight)
- FU-B: pulseWeights 0.05 drift across all 4 FormatProfiles (from 5.8 pre-flight)
- FU-C: NESA §3.7 analysing spec bug — adapter honours prose intent via Ev extension
- FU-D: IGCSE §3.4 missing reverse table — adapter applies exclusive-key heuristic

**Auto-memory added:**
- `feedback_nc_revert_uncommitted.md` — Use Edit-tool revert, not `git checkout --`, on not-yet-committed NC files
- `feedback_brief_transcription_slips.md` — Pre-flight audits catch ~1 brief slip per sub-task; never skip them
- `project_dimensions3_phase2_progress.md` — Phase 2 current state + next steps

**Test counts:** 673 → 812 (+139 from 5.9; 5.5-5.8 added ~17 to the pre-5.9 baseline). tsc baseline held at 80 throughout.

**Commits:** 7 new commits this session. HEAD `4e31363`, 26 ahead of origin/main. Not pushed — push gated on Matt Checkpoint 2.1 per build-methodology.md.

**Systems affected:** `generation-pipeline` (Stages 3/4/5/6 now consume FormatProfile fields previously ignored), `framework-adapter` (new system — first consumer is 5.10 Admin panel), `format-profiles` (connectiveTissue + timingModifiers extended).

**Session context:** Long session continuing Dimensions3 v2 Phase 2 build after context compaction. Phased-with-checkpoints methodology held throughout. Every sub-task followed pre-flight → design/lock → test → NC → commit cadence. Pre-flight audits caught 5 brief transcription slips in 5.9 alone (baseline drift, vitest glob trap, Group 4 function name, Group 3 length miscount, Group 3a MYP short/full mix-up) — none reached EDITS. Next session starts with 5.10 (Admin panel) pre-flight.

## 12 Apr 2026 — Dimensions3 v2 Phase 2 COMPLETE: Sub-tasks 5.10.4–5.14 shipped + pushed

**What changed:**
- **5.10.4** closed — Student grades page H.1 dual-shape bug fixed (`criterion_scores` typed as array, not Record). New `normalizeCriterionScores` 4-shape absorber at `src/lib/criterion-scores/normalize.ts`. Grades page rewired to FrameworkAdapter (`getCriterionLabels` + `FrameworkId` from `@/lib/frameworks/adapter`). 9 wiring-lock tests (L1-L7 + barrel guards). Import path drift caught in Pre-Edit Mini-Report. Lesson #42 appended. FU-J/K/L filed. Commit `75080df`.
- **5.10.5+5.10.6** combined — 4 teacher grading regression locks (G1-G4) ensuring legacy `getFrameworkCriterion` from `@/lib/constants` survives until FU-E migration. FU-E through FU-I filed. Commit `1353204`.
- **5.11** closed — Admin FrameworkAdapter Test Panel at `/admin/framework-adapter`. 8×8 toLabel matrix + per-framework criterion list grid, color-coded by kind (label/implicit/not_assessed). 147 lines. 1 smoke test. Commit `39b8b9b`.
- **5.13** closed — Model ID centralization. `src/lib/ai/models.ts` with `MODELS.SONNET` + `MODELS.HAIKU` constants. 42 hardcoded sites across 28 files replaced (spec said 12 — 3.5× stale). 2 wiring-lock tests. Commit `801f012`.
- **5.14a** closed — Orchestrator integration tests. 7 tests using `runPipeline()` with `sandboxMode: true` + Proxy-based mock supabase. 3ms execution. Commit `8313eac`.
- **5.14** closed — Checkpoint 2.2 E2E test suite. 1 α test (always runs) + 6 β tests (gated behind `RUN_E2E=1` + `ANTHROPIC_API_KEY`). Matt ran on local machine: 7/7 green, $0.16, 73 seconds. Commit `542e6e1`.
- **Checkpoint 2.1 PASSED** — Full static audit (tests couldn't run in Cowork sandbox due to native rolldown binding). All 22 wiring locks, 139 adapter tests, 5 normalizer tests verified via file reads.
- **Checkpoint 2.2 PASSED** — Matt ran `RUN_E2E=1 ANTHROPIC_API_KEY=... npm test` locally. All 7 E2E tests green. Pipeline produced valid TimedUnit, QualityReport with 5 dimensions, $0.16 cost, 73s wall time.
- **Pushed to origin/main** — Matt pushed after both checkpoints passed.

**Files created:**
- `src/lib/criterion-scores/normalize.ts` (4-shape absorber)
- `src/lib/criterion-scores/__tests__/normalize.test.ts` (5 tests)
- `src/app/admin/framework-adapter/page.tsx` (147 lines)
- `src/lib/ai/models.ts` (MODELS.SONNET + MODELS.HAIKU)
- `tests/pipeline/orchestrator-integration.test.ts` (7 integration tests)
- `tests/e2e/checkpoint-2-2-generation.test.ts` (234 lines, 7 E2E tests)

**Files modified:** `src/app/(student)/unit/[unitId]/grades/page.tsx` (H.1 fix + FrameworkAdapter wiring), `src/lib/frameworks/__tests__/render-path-fixtures.test.ts` (22 total it-blocks across 5 describes), `docs/lessons-learned.md` (#42), `docs/projects/dimensions3-followups.md` (FU-E through FU-L), 28 production files (model ID replacement).

**Followups filed:** FU-E (teacher grading FrameworkAdapter migration), FU-F (legacy CRITERIA cleanup), FU-G (getCriterionColor wrapper), FU-H (strand header FrameworkAdapter wiring), FU-I (null-framework fallback audit), FU-J (scale /8 hardcode), FU-K (student-snapshot shape), FU-L (local type collapse).

**Auto-memory updated:** `project_dimensions3_phase2_progress.md` updated with Phase 2 complete status.

**Test counts:** 812 → 891 (+79 this session). tsc baseline held at 80.

**Commits:** 7 new commits this session (including prior sub-session). Pushed to origin/main after Checkpoint 2.2 sign-off.

**Systems affected:** `framework-adapter` (render-helpers + admin panel + criterion-scores normalizer added), `generation-pipeline` (model ID centralization + E2E checkpoint gate), `student-grade-view` (H.1 dual-shape fix), `ai-provider` (model constants centralized).

**Session context:** Two-part session (context compaction between parts). First part covered 5.5-5.9 (FormatProfile wiring + FrameworkAdapter build). Second part covered 5.10.4-5.14 (render path wiring + model centralization + E2E). Phase 2 is now fully complete. Next: Phase 3 (feedback loop) per completion spec.
