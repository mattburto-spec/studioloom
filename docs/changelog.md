# Session Changelog

> Rolling log of changes across sessions. Each `saveme` appends an entry. Read the last 5 entries for quick cross-session context.

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
