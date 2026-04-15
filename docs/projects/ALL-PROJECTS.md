# StudioLoom — Master Project Index

> **Single source of truth for all projects, features, and ideas.**
> Visual dashboard: [projects/dashboard.html](dashboard.html)
> Last updated: 15 April 2026 (ShipReady Phase 1B COMPLETE — teacher onboarding flow live. Migrations 083 + 084 applied to prod; 4-step `/teacher/welcome` wizard + 3 welcome APIs + teacher layout first-login redirect + admin remove-teacher FK cascades. Branded Supabase auth email templates (invite / confirm-signup / magic-link / reset-password) in `supabase/email-templates/`, pasted into Supabase Dashboard. Dimensions3 declared SHIPPED 15 Apr 2026; polish moved to backlog. Next: Phase 1C (Content Safety Teacher Controls).)

---

## Status Legend

| Status | Meaning |
|--------|---------|
| 🔴 **ACTIVE** | Currently in development |
| 🟢 **READY** | Spec complete, ready to build |
| 🔵 **PLANNED** | Designed, committed timeline |
| 💡 **IDEA** | Vision captured, not yet specced |
| ✅ **COMPLETE** | Built, tested, deployed |
| ⚫ **SUPERSEDED** | Replaced by newer approach |
| 🔬 **RESEARCH** | Vision doc complete, open questions |

---

## 🚧 Current Focus — April 2026

**🎯 ACTIVE BUILD PLAN: [`ship-ready-build-plan.md`](ship-ready-build-plan.md)** (15 Apr 2026) — 2-phase plan to get students into StudioLoom. Phase 1: Ship-Ready (teacher onboarding, safety controls, auth bridge, co-teacher support, polish). Phase 2: Pilot Sprint (recruit teachers, SLP quick unblock, skills library, school entity). Dimensions3 declared DONE — stop polishing, start shipping.

**QUARANTINE PARTIALLY LIFTED (9 Apr 2026):** Generation pipeline wired to wizard routes — `generate-unit` and wizard page un-quarantined. Remaining quarantined routes (timeline, journey, regenerate-page, convert-lesson) stay sealed — replaced by Dimensions3 pipeline. Knowledge pipeline still quarantined. Full register: `docs/quarantine.md`.

**Still working:** Manual unit creation, lesson editor, Teaching Mode, Design Assistant, Open Studio, toolkit, student experience, safety badges, gallery, pace feedback, Smart Insights. **AI unit generation restored** — 3-lane wizard (Express/Guided/Architect) now calls Dimensions3 pipeline.

**Current build:** Dimensions3 — **v2 COMPLETION SPEC SIGNED OFF (10 Apr 2026).** Previous Phases A–E built the Dimensions3 foundation (510+ tests, migrations 060–064). Deep audit + re-read of master spec revealed the v1 system had significant gaps: Content Safety (§17), 7 operational automation systems (§9.3), 7 of 12 admin tabs, Bug Reporting System, and several sandboxes were missing or thin. Also discovered the "Stage 5b Curriculum Matching" item from v1 was a misconception — pipeline is 7 stages (0–6), curriculum mapping happens at render time via FrameworkAdapter (§14.1).

**v2 Completion Spec:** [`dimensions3-completion-spec.md`](dimensions3-completion-spec.md) — 8 phases, 12 mandatory Matt checkpoints, ~21–25 days estimated. Execution discipline section, per-sub-task verification, rollback protocols per phase. All 12 open questions from this session resolved (model ID, system teacher, cost alerts, journey blocks, retention, blocklist, bug reporting default, ZH-Hans moderation, class_id gap, proposal notifications, NSFW classifier, is_sandbox flag).

**Status (14 Apr 2026):** Phases 0, 1.1, 1.5, 1.6, 1.7, 2, 3R, 4, 5, 6 all COMPLETE. **GOV-1 COMPLETE (14 Apr 2026)** — 4 sub-phases, 11 commits pushed. Data-classification taxonomy + schema classification, feature-flags + vendors registries, 2 drift scanners, change-triggers.yaml, doc-manifest schema bump, admin panel at `/admin/controls/registries`, quarterly staleness cron. See Complete section for full details. Checkpoints 1.2, 2.1, 2.2, 3.1, 3.2, 4.1 all PASSED. **Checkpoint 5.1 CLOSED at 9/11 (14 Apr 2026):** Steps 1–5 (client + server moderation end-to-end), Step 8 (ingestion upload → `moderation_hold`), Step 9 (alert feed → RLS visibility) all verified. Steps 6–7 (NSFW.js image moderation) deferred — require test image fixtures. Steps 10–11 code-verified. **Step 9 surfaced a class_id × RLS silent-filter bug + test-data teacher-auth mismatch**; wider audit filed 10 architectural limitations as FU-N..W. **Phase 6 deliverables:** 6A teacher safety alert feed at `/teacher/safety/alerts` with filters, severity grouping, acknowledge/escalate/false-positive actions + API route with RLS-gated query; 6B nav badge showing unreviewed critical count; 6C ingestion pipeline safety scan calling `moderate-and-log` across 15 endpoints. Nav longest-prefix fix so Alerts and Badges don't both highlight (`a1c88f2`). Working tree cleaned (`e5c4d3a`). **Baseline: 1254 tests passing, 8 skipped.** Critical path: 0 ✅ → 1 ✅ → 2 ✅ → 3R ✅ → 4 ✅ → 5 ✅ → 6 ✅ → 7-Pre ✅ → 7. **Phase 7-Pre COMPLETE (14 Apr 2026)** — Registry infra sprint: schema-registry.yaml (72 tables), api-registry.yaml (266 routes), ai-call-sites.yaml (47 LLM calls). Three sync scripts under `scripts/registry/`. Two P1/P2 follow-ups filed (FU-X RLS gaps, FU-Y Groq/Gemini drift). **FU-X RESOLVED (14 Apr 2026)** — migration 075 RLS + idempotent guards + scan-rls-coverage.py scanner. **FU-N RESOLVED (14 Apr 2026)** — migration 078 dual-visibility RLS (Lesson #29 UNION), writer audit (17 sites), manual smoke protocol. Filed FU-GG RESOLVED (nm-assessment classId fix), FU-HH (P2 RLS test harness), FU-II (P3 writer pattern), FU-EE (P2 no migration-applied log), FU-FF (P3 undocumented RLS-as-deny-all on 3 tables), FU-KK (P2 ingestion pipeline "system" sentinel). **Library Phase A (14 Apr 2026):** multipart file upload on ingest + import routes, library landing page with drag-drop + intent-guard (scheme_of_work → import redirect). Filed FU-Library-B1 (P1 wire handleAccept), FU-Library-B2 (P2 retire legacy import routes), FU-Library-B3 (P3 relocate extractDocument). **Ingestion sandbox PDF fix (15 Apr 2026):** Replaced `pdf-parse` v2 (depends on `@napi-rs/canvas` native binary — only darwin-arm64 installed, crashes on Vercel Linux) with `pdfjs-dist/legacy` direct usage. Improved upload error alert to show detail message. Commit `b9208d4` pushed. **Next:** Phase 7A.

**Post-Dimensions3 priority order:** [`post-dimensions3-priority-order.md`](post-dimensions3-priority-order.md) — 6-tier dependency-sequenced build plan for everything after D3 ships (11 Apr 2026).

---

## 🔴 Active Projects

### Dimensions3 — Generation Pipeline Rebuild (v2 Completion Build)
- **Status:** ✅ SHIPPED — DECLARED DONE 15 Apr 2026. Pipeline works, admin dashboard live, all 12 tabs implemented, content safety operational. Remaining items (Phase 7B/C polish, NSFW image moderation fixtures, FU-N..W architectural debt) moved to backlog. Per [`ship-ready-build-plan.md`](ship-ready-build-plan.md) Phase 1A — stop polishing, start shipping students.
- **Priority:** TIER 0 P0 | **Est:** 21–25 days (v2) | **Docs:** [dimensions3.md](dimensions3.md) (master spec) + [dimensions3-completion-spec.md](dimensions3-completion-spec.md) (v2 build plan, 10 Apr 2026)
- 6-stage compartmentalized pipeline, Activity Block Library (first-class SQL), 2-pass ingestion, sandbox debugger, feedback loop with approval queue. No hardcoded sequences — system learns from usage. All 9 open questions RESOLVED. Testing plan ready ([dimensions3-testing-plan.md](dimensions3-testing-plan.md)). **Phase A COMPLETE:** migrations, types, pipeline simulator, backend infra (92 tests). **Phase B COMPLETE:** ingestion pipeline, pass registry, block extraction, PII scan, review queue UI (34 tests). **Phase C COMPLETE:** 6-stage generation pipeline — retrieval, assembly, gap-fill, polish, timing, scoring. Orchestrator with sandbox/live modes. FormatProfile-aware. 420+ tests. **Phase D COMPLETE:** Feedback system — edit tracker, efficacy scoring, approval queue with guardrails, self-healing proposals. 60 new tests. **Phase E COMPLETE (9 Apr 2026):** Admin dashboard (health strip with traffic lights, quick stats with sparklines, alerts feed), tab navigation + 4 key tabs (Pipeline Health, Block Library, Cost & Usage, Settings), unit import flow (upload → reconstruct → match report), 13 smoke tests across 6 E2E flows, 6 operational monitors (pipeline health, cost alerts, quality drift, edit tracker summary, stale watchdog, usage analytics). 30 files, 2440 lines. **WIRING COMPLETE (9 Apr 2026):** Input adapter (UnitWizardInput → GenerationRequest), output adapter (TimedUnit → UnitContentDataV2), un-quarantined generate-unit route (calls runPipeline), un-quarantined wizard page (single pipeline call instead of per-criterion streaming), 34 adapter tests. 5 files, 817 lines. Supabase migrations 060-064 applied. **Phase 1.1 COMPLETE (10 Apr 2026):** 55 teaching moves seeded to activity_blocks as system teacher. **Phase 1.5 COMPLETE + PUSHED (10 Apr 2026):** 10-item hardening checklist done — cosine dedup 0.92, PPTX ingestion, strand/level fields, Haiku moderation, PII scan, copyright flag reuse, migrations 067+068 applied (moderation_status + content_fingerprint UNIQUE), dryRun mode, cost tracking, idempotency via fingerprint. Deployed to Vercel prod. **Phase 1.6 COMPLETE + PUSHED (11 Apr 2026):** Disconnected old knowledge UI, relocated Dimensions3 pages to `/teacher/library/*`, deleted `BatchUpload.tsx`, wired `/teacher/library/import` endpoint to real reconstruction. Aggressive cleanup (zero users) — no redirects, no breadcrumbs. Commits `e7b020b` + `242e587`. **Phase 1.7 COMPLETE + PUSHED (11 Apr 2026):** Checkpoint 1.2 passed with first automated E2E gate. Fixed Pass A + Pass B silent `max_tokens` truncation bugs (2000→8000, 4000→16000, stop_reason guards, defensive `?? []`). Wrote Lesson #39 including "fix all similar sites in same phase" rule. New E2E test file `tests/e2e/checkpoint-1-2-ingestion.test.ts` — α sandbox DOCX (tight) + β live DOCX (narrow range + loose text) + β live PDF, 4/4 green, 617 passed total with `RUN_E2E=1`. Spec §3.7 amended: automated test is canonical gate, 9-step manual is optional pre-push smoke. Commits `20fe163` + `691bdf4` + `cd5f9d4`. First Dimensions3 phase with real automated gate protecting it.

  **Phase 2 COMPLETE + PUSHED (12 Apr 2026):** Generation Completeness + FrameworkAdapter. Checkpoints 2.1 and 2.2 both passed. 7/7 E2E tests green ($0.16, 73s). Key deliverables: FrameworkAdapter 8×8 neutral criterion matrix with discriminated-union `toLabel` (8 frameworks × 8 neutral keys), render-helpers (`renderCriterionLabel` absorbing 3 input shapes, `collectCriterionChips` with partition dedup), `normalizeCriterionScores` 4-shape absorber fixing H.1 dual-shape bug (grades page typed `Record<string, CriterionScore>` while server writes `CriterionScore[]`), student lesson page + grades page wired to FrameworkAdapter, teacher grading pages regression-locked, admin test panel at `/admin/framework-adapter`, model ID centralization (42 hardcoded sites → `MODELS.SONNET`/`MODELS.HAIKU`), mocked-AI integration test (7 tests, 3ms), gated E2E test (`checkpoint-2-2-generation.test.ts`). Lesson #42 written. FU-A through FU-L filed. 862 → 891 tests (+29). 37 commits pushed to origin/main.

  **Phase 3 REMEDIATION COMPLETE (12 Apr 2026):** Feedback Loop Completion. Checkpoints 3.1 + 3.2 passed. R1: `signals.ts` rewritten — `getStudentSignals()` now queries real `student_progress` rows via indirect join (`source_unit_id + source_page_id`), replacing dead pre-aggregated columns. 3 new tests (905 total). R2: CLI script rewritten as `.ts` with library imports (single source of truth, no duplicated formula). R3: `ProposalReasoning.tsx` enhanced with `buildNarrative()` for human-readable signal explanations. R4: Naming divergence documented (`requires_matt` → `requiresManualApproval`, `accept` → `approved`). R5: CASCADE DELETE verified on prod (migration 070). Auto-approve removed per spec §5.4, replaced by 7-day rejection suppression. End-to-end verified: CLI → proposals → UI review → approve (score updated 65→40.3) + reject → audit log. Remediation brief at [`dimensions3-phase3-remediation.md`](dimensions3-phase3-remediation.md).

  **Phase 4 COMPLETE (12 Apr 2026):** Library Health & Operational Automation. Checkpoint 4.1 passed. Migration 072: 3 new tables (system_alerts, library_health_flags, usage_rollups), 4 new columns on activity_blocks (last_used_at, archived_at, embedding_generated_at, decay_applied_total), find_duplicate_blocks RPC (pgvector cosine similarity). 8 typed library health queries (source type, category distribution, stale blocks, duplicate suspects, low efficacy, orphans, embedding health, coverage heatmap). 7 ops automation jobs (pipeline-health, cost-alert, quality-drift, edit-tracker, stale-watchdog, smoke-tests, usage-analytics) — all write to system_alerts, all runnable via `npx tsx -r dotenv/config scripts/ops/run-*.ts`. 2 library hygiene jobs (weekly: staleness decay, duplicate flagging, low-efficacy flagging; monthly: consolidation proposals, orphan archival — never deletes). Library Health dashboard (8 widgets at `/admin/library/health`). Pipeline Health dashboard (KPI cards, stage failure heatmap, cost alert strip, error log, quality drift indicator, recent alerts at `/admin/pipeline/health`). Cost alert email delivery via Resend API with 6h debounce (console fallback when no API key). Edit tracker wired to content save route (fire-and-forget). Ops runbook at [`dimensions3-ops-runbook.md`](dimensions3-ops-runbook.md). Phase brief at [`dimensions3-phase4-brief.md`](dimensions3-phase4-brief.md). 905→948 tests (+43). FU-M filed for live email test.

  **Phase 1.5 Follow-ups** (tracked in [`dimensions3-followups.md`](dimensions3-followups.md)):
  1. 🐛 **FU-1: `/teacher/units` initial render delay** — units load returns 200 with 133 kB but cards render as empty squares for several seconds before hydrating. Not a schema regression (query succeeds). Logged in dimensions3-followups.md with suggested investigation. *Priority: P1.*
  2. 🐛 **FU-2: "Unknown" strand/level chips on pre-Phase-1.5 units** — Pass A added strand/level fields but backfill only applied to activity_blocks, not units. Either hide chips when value missing OR backfill units table. Logged in dimensions3-followups.md. *Priority: P2.*
  3. ✅ **Migration 067 grandfather backfill bug — FIXED IN REPO + PROD (commit `2bfe8e0`, migration 069 applied).** Root cause confirmed: `ADD COLUMN DEFAULT 'pending'` filled every row at ALTER time, the conditional grandfather UPDATE then matched zero rows because of `WHERE moderation_status IS NULL`, and the old verify block only checked for NULLs so it passed cleanly. Fix: (a) 067 rewritten — column added WITHOUT DEFAULT, (b) migration 069 as idempotent safety net, (c) Lesson #38 written. Repo unblocked for fresh-database bootstraps.
  4. 🧹 **Delete junk test units from prod** — existing units in `/teacher/units` are all disposable test content from the last few weeks. Delete once Dimensions3 generation pipeline is confirmed producing real units end-to-end (post-Checkpoint 1.2 — now unblocked). *Priority: P2.*
  5. 🔍 **FU-5: `max_tokens` silent truncation audit** — 9 remaining sites in codebase with same anti-pattern shape as Pass A/B (Pass B removed in Phase 1.7, original count 10). Most are in quarantined generation pipeline (`anthropic.ts`) slated for rebuild. Active sites worth patching in future maintenance pass: `moderate.ts:175`, `test-lesson/route.ts:151`. Logged in [`dimensions3-followups.md`](dimensions3-followups.md). *Priority: P2.*
  6. 🧹 **FU-6: CI lint cleanup** — GitHub Actions lint step failing with hundreds of pre-existing ESLint errors (`no-explicit-any`, unused imports, unescaped entities, missing deps in hooks, etc.). None from Phase 5 changes — all legacy. Vercel deploys fine (doesn't gate on lint). Fix: batch lint pass or add `--max-warnings` to CI config. *Priority: P3.*

  **Sub-phase 7A-7C COMPLETE + PUSHED (14 Apr 2026):** Integrity & Versioning + 8 Admin Tab Implementations + Bug Report Button + Generation Sandbox + Block Interaction Viz + Library Tabs. 3 commits (`356ff55`, `3500d04`, `4990c6f`). Migrations 080-082 (activity_block_versions auto-trigger, unit_versions auto-trigger, data_removal_log). Student data removal script (21 tables, dry-run + confirm modes). 8 admin tab stubs replaced with real implementations: Cost & Usage (per-teacher profitability, daily trends, budget alerts), Quality (efficacy stats, drift alerts, feedback proposals), Wiring (6 E2E flow tests), Teachers (browse), Students (anonymized roster), Schools (class list by teacher), Bug Reports (triage workflow), Audit Log (4-source combined view + CSV). Floating BugReportButton in teacher + student layouts (auto-captures URL, console errors). Generation Sandbox (`/admin/generation-sandbox`) with real pipeline execution + simulator toggle + step-through stage view. Block interaction visualization (`/admin/library/[blockId]/interactions`). Per-format library tabs (Design/Service/PP/Inquiry). 6 new API routes. 1254 tests passing, 0 new TS errors.

  **Phase 6 + Checkpoint 5.1 Follow-ups — Architectural Limitations** (surfaced 14 Apr 2026, tracked in [`dimensions3-followups.md`](dimensions3-followups.md)):
  Surfaced while debugging why `/teacher/safety/alerts` showed zero rows despite 19 flagged `moderation_logs` rows. Root cause was class_id NULL + teacher ownership mismatch. Wider audit identified 10 design limitations that will bite during expansion.
  1. 🚨 **FU-N: NULL class_id silent safety gap** — RLS filters `class_id IN (teacher's classes)` so any moderation event with `class_id IS NULL` is invisible. Applies to Discovery Engine, Open Studio planning, library uploads, standalone tool use — any context where student exists but class hasn't been resolved. *Priority: P1 (silent safety hole).*
  2. 🚨 **FU-O: No co-teacher / dept head / school admin access** — every RLS policy hardcodes `teacher_id = auth.uid()`. Blocks co-taught classes, dept-head oversight, subs, school admins, content handover. Needs `class_memberships` + role system. *Priority: P1 (hard blocker for school sales).*
  3. 🚨 **FU-P: No school/organization entity** — flat `teacher→class→student` hierarchy. No shared curriculum, no school-level policy, no MAT/district deployment, no per-school billing. *Priority: P1 (table stakes for school sales).*
  4. 🚨 **FU-R: Auth model split** — teachers use Supabase Auth, students use custom token sessions (Migration 028). Every cross-role feature (peer review, gallery, group work) needs bridging code. Supabase Anonymous Auth may have matured enough to consolidate. *Priority: P1.*
  5. 🐛 **FU-Q: Dual student identity** — `class_students` junction AND `students.class_id` both exist; Lesson #22 "junction-first-fallback" tax is paid by every teacher API. *Priority: P2.*
  6. 🐛 **FU-S: Moderation log class-scoped, ingestion upload-scoped** — `content_items.processing_status='moderation_hold'` has no class_id. When a held block is approved + assigned to classes later, no audit link back to the held upload. Safeguarding can't trace exposure. *Priority: P2.*
  7. 🐛 **FU-T: No content ownership transfer** — teacher leaves → content stranded. No "transfer to replacement teacher" or "archive to school library." Depends on FU-P. *Priority: P2.*
  8. 🐛 **FU-V: Cross-class student analytics double-count** — profile is global per-student but teachers view via class junction. A student in 3 classes gets counted 3× or needs DISTINCT hack. Dimensions3 feedback loop will hit this immediately. *Priority: P2.*
  9. 🐛 **FU-W: No immutable audit log** — RLS allows teachers to UPDATE their own rows; no history of who changed what. Surfaced because Step 9 debugging required a manual `UPDATE classes SET teacher_id=...` with zero trail. *Priority: P2.*
  10. 🧹 **FU-U: Single-tenant URL structure** — no `/school/*` or `/org/*` namespace. Retrofit gets harder the longer we wait. Depends on FU-P. *Priority: P3.*

### Lesson Pulse Phase 2
- **Priority:** P0 | **Est:** 4-5 days | **Doc:** [lesson-pulse.md](lesson-pulse.md)
- Phase 1 COMPLETE (47 tests, validated 4.4–4.8 on 3 real lessons). Context Injection COMPLETE. Teaching Moves Library COMPLETE (65 moves, 29 tests). **Next:** Voice/Personality Layer, Sequencing Intuition. Note: generation wiring in 4 routes is quarantined — Pulse code preserved for Dimensions3 reuse.

### MYPflex — Framework-Flexible Assessment
- **Priority:** P0 | **Est:** 2 days remaining | **Doc:** [mypflex.md](mypflex.md)
- Phases 1-3 COMPLETE. Migration 055 APPLIED. Framework selector on classes, adaptive grading UI (buttons for discrete, sliders for %). Phase 4 (future-proofing) pending. **Unblocks non-MYP teacher adoption.**

### MonitoredTextarea Pipeline
- **Priority:** P0 | **Est:** <1 day | **Doc:** [monitored-textarea.md](monitored-textarea.md)
- Pipeline COMPLETE + UI WIRED. Migrations 054+059 APPLIED. Save timing + RLS fixed. Integrity indicators on Class Hub. IntegrityReport on grading page. **Needs:** fresh student session verification.

### Student Work Pipeline
- **Priority:** P1 | **Est:** 19 days | **Doc:** [studentwork.md](studentwork.md)
- OS Pipeline 2: 5-stage pipeline (intake → processing → enrichment → versioning → routing) for student photo/video/audio/sketch. Sharp + Claude Vision hybrid. AI enrichment compares against teacher expectations. OS-aligned schema. Depends on Dimensions3. 4 build phases.

### Work Capture Pipeline — AI Mentor Feedback on Student Work
- **Priority:** P1 | **Est:** TBD | **Doc:** [studioloom-work-capture-spec.md](studioloom-work-capture-spec.md)
- Composable `<WorkCapture />` component that embeds throughout StudioLoom. Students photograph/upload drawings, sketches, and physical prototypes; AI provides context-aware formative feedback using "What I notice / What I wonder" language. Framework-agnostic prompt templates. Image Readability Score (IRS) gates feedback depth. Dual-lens assessment (concept vs presentation scored separately). Annotation reading + mismatch detection. Multi-image support (2-4 per upload). 6 embedding points (design cycle, SCAMPER, portfolio, Open Studio, peer feedback, quick ping). No direct competitor exists. Spec v1.5 Final (6 Apr 2026).

### Designer Mentor System — Personalised AI Mentoring via Real Designers
- **Priority:** P1 | **Est:** TBD | **Doc:** [studioloom-designer-mentor-spec.md](studioloom-designer-mentor-spec.md) (full spec), [studioloom-mentor-model-prompts.md](studioloom-mentor-model-prompts.md) (3D model prompts)
- Complete personalised mentoring system: 20 real-world designers as AI mentors (I.M. Pei, Zaha Hadid, Tadao Ando, Kéré, Barragán, Dieter Rams, Charlotte Perriand, Hella Jongerius, Jony Ive, Yinka Ilori, Yamamoto, Iris van Herpen, Paula Scher, Kenya Hara, David Carson, Charles & Ray Eames, Eileen Gray, Neri Oxman, Virgil Abloh, Nendo). 16 sections: 5-dimension trait taxonomy (aesthetic/philosophy/material/process/cultural), "Discover Your Design DNA" visual onboarding (4-5 rounds), weighted cosine similarity matching algorithm, AI persona system with per-mentor voice/vocabulary/beliefs/blind spots, 20 full persona YAML profiles, DB schema (4 tables), IP/legal framing, admin analytics/tuning, 11 platform applications (Critique Table, Speed Crit, Peer Review Through Mentor Eyes, "What Would ___ Do?", Design Debate, mentor-narrated portfolios, provocations, Stuck Button, annotations, Lineage Map), content safety (6 risk categories), 20 dashboard themes (CSS custom properties per mentor), 3D character pipeline (*Another World* flat-shaded style, 80-300 polygons, silhouette identity), full model prompts for all 20 characters. Spec v1.0 (Apr 2026). Ties into Work Capture Pipeline, 3D Elements/Designville, Discovery Engine, Open Studio.

### Journey Engine — Modular Interactive Experiences
- **Priority:** P1 | **Est:** 17-22 days | **Doc:** [journey-engine-spec.md](../specs/journey-engine-spec.md)
- Extracts Discovery Engine's proven interaction grammar into a reusable system. Journey Blocks (atomic interaction primitives: binary choice, card sort, sliders, scene explore, text prompt, etc.) composed into named Journeys of any length (2 min check-in to 60 min profiling). Character-neutral and scene-neutral — presentation (character, R3F scene, voice) applied at journey level, infinitely swappable. Conditional branching with path validation. Student profile (`learning_profile` JSONB) as central data hub — every journey writes, every AI system reads. 4 rendering modes: fullscreen, embedded in lessons, floating window, modal overlay. R3F animated scenes (Blender → .glb pipeline, Another World art style). Lesson editor shows saved journeys (not individual blocks) as a second category alongside Activity Blocks. Admin node-graph editor for journey composition; teacher authoring later. Discovery Engine becomes the reference journey ("Student Discovery"). 5 build phases (A-E). Depends on Dimensions3 (Activity Block schema), 3D Elements (R3F renderer).

### StudentDash — Studio Desk Workspace
- **Priority:** P1 | **Est:** TBD | **Doc:** [studentdash.md](studentdash.md) + source files: [../dashboard/studio-desk-session-summary.docx](../dashboard/studio-desk-session-summary.docx), [../dashboard/studio-desk-references.docx](../dashboard/studio-desk-references.docx), [../dashboard/student-workspace.jsx](../dashboard/student-workspace.jsx) (Prototype v1 — dark scene), [../dashboard/r3f-motion-sample.html](../dashboard/r3f-motion-sample.html) (Prototype v2 — Miro-bench variant)
- Reimagining the student dashboard as a *workspace*, not an LMS homepage. After exploring 7 directions (Studio Desk, Map/Trail, Portfolio-First, Focus/Zen, Card-Based, Mood-Responsive, Messy Desk), **Studio Desk chosen** (10 Apr 2026). **TWO prototypes now built:** (1) dark 3D desk scene (v1, student-workspace.jsx) with 5 frosted-glass cards; (2) flat Miro-style wood bench (v2, r3f-motion-sample.html) with 1 embedded R3F accent (low-poly boombox speaker top-right, draggable with fixed camera so perspective never changes), 1 clickable 3D hex-medal badge bottom-right (hover glow via emissive + pointLight + CSS radial), and 3 draggable student-content cards (Current Unit / Next Step / Feedback from teacher) with single-corner rotate + single-corner resize + snap-to-stack (nearest within 140px → offset +26/+22 + 2°) via shared registry ref. **Neither prototype committed** — v2 is cheaper to ship (one Canvas, flat 2D CSS, responsive) and contains reusable primitives worth keeping: flat workbench recipe, fixed-camera R3F anchor pattern, hover-glow 3D badge pattern, single-corner card interaction, snap-to-stack via registry ref, student-action cards > unit thumbnails, **Focus Mode toggle (iOS-pill switch that fades everything except the Next Step card which springs to centre at 1.35× scale; restores exact prior state via savedRef snapshot when toggled off)**. Student testing should compare v1 (feels like a place) vs v2 (feels like a workspace). **Key decision — Growth over Gamification:** Apple-ring "close the loop" energy rejected; instead the student's actual project grows on the desk (e.g. Bluetooth speaker slowly assembling — raw materials → housing → components → finished object). Ties abstract process evidence to concrete thing being made. **Map parked as secondary mode** (mode flip or translucent underside). 6 design references captured (Miro/FigJam, Things 3, Forest, Animal Crossing, Minecraft Edu, Notion Gallery). 10 open questions parked (originals 1-6 + v2-specific 7-10: per-unit 3D object swap, 3D accent clustering, touch snap-to-stack ergonomics, non-card bench objects). Depends on/connects to 3D Elements, Journey Engine, Designer Mentor, Student Learning Profile, Work Capture Pipeline.

### 3D Elements / Designville
- **Priority:** P2 (research) | **Est:** 32 days | **Doc:** [3delements.md](3delements.md)
- 7 capability layers (R3F scenes, asset library, tutorial engine, narrative/quests, multiplayer gallery, gamification, sound). Augmentation-first. Project doc complete (~840 lines). 10 open questions. Build starts after Dimensions3 core.
- **Render Modes Plan integrated (7 Apr 2026):** Rendering architecture now two orthogonal dimensions — 5 render presets (Showcase/Designville/Workshop/Tutorial/Print) × 5 UI container modes (Fullscreen/Embedded/Floating/Modal/PiP). All presets share one .glb asset pipeline. Render preset build order: Workshop → Designville → Tutorial → Showcase → Print. Source: `docs/StudioLoom-3D-Render-Modes-Plan.docx`.
- **Room design prototyped (7 Apr 2026):** 4 room templates (IndoorRoom, Clearing, Overlook, Passage) built with raw Three.js + Kenney GLB assets. Decision: grounded real locations, NOT floating platforms — each station should feel like a real place. Nav UI pattern validated (station pills top-right, progress dots bottom, prev/next arrows). Fire glow, fog tinting, emissive accents, ambient particles all validated. Prototypes: `3delements/discovery-rooms-prototype.html` (v1 — floating platforms, rejected), `3delements/discovery-rooms-v2.html` (v2 — grounded rooms, approved direction).

---

## 🟢 Ready to Build

### School Readiness — Enterprise Requirements
- **Phase:** Pre-Pilot to Pre-Scale | **Est:** 37-50 days | **Doc:** [school-readiness.md](school-readiness.md)
- 17 items across 3 tiers. Pre-Pilot (~12-17d): SSO, RBAC, Multi-Tenancy, Class polish, Teacher Dashboard. Pre-Launch (~15-21d): Analytics, Export, Privacy, Accessibility, Moderation, Notifications, Audit. Pre-Scale (~10-12d): Microsoft SSO, Google Classroom Sync, Admin Analytics, Offline, Backup.
- **Related:** [governance-systems-plan.md](governance-systems-plan.md) is the operational/registry view of the same problem — school-readiness = feature scope, governance-plan = runbooks + registries that wrap those features.

### Toolkit Redesign v5
- **Phase:** Phase 6.5 | **Est:** 3-4 days | **Doc:** [toolkit.md](toolkit.md)
- Design APPROVED (prototype: `docs/prototypes/toolkit-redesign-v5.html`). Phase pills as sole filter, structural SVG thumbnails, AI search, neon tab line, INTERACTIVE badge. Replaces current `/toolkit` and `/teacher/toolkit`.

### How-To Video System
- **Phase:** Marketing | **Doc:** [howtovideos.md](howtovideos.md)
- Video tutorial system for teacher onboarding and feature walkthroughs.

---

## 🔵 Planned (spec exists, committed)

### Skills Library
- **Priority:** P1 | **Est:** Workshop project ~4-6 days (must-have slice) | **Doc:** [skills-library.md](skills-library.md)
- Canonical content layer for the "no chatbot at launch" strategy. One authored skill card, many embed contexts — library browse, Stone prerequisites, lesson activity blocks, Open Studio capability-gap surfacing, crit board pins, badges. Schema: `skill_cards` + tags + prerequisites + external links + categories; completions as `learning_events` (never their own table) → `student_skill_state` derived view. Six quiz types, all gradable without a model (MC, T/F, image identification, ordering, matching). Mastery derived from real work — Stone completions where the skill was a prereq — not from quizzes alone. Context-aware gating (state × freshness × embed requirement → full card / refresh / skip). Strength radar chart computed on view from state_score × freshness_factor × category_weight. **Strategic frame: the library is the moat — 15 years of teacher-authored material competitors cannot copy.** Workshop target: 20-30 high-value cards mined from existing PowerPoints, linkable from Stones, with nightly link-check. Specs at [`../specs/skills-library-spec.md`](../specs/skills-library-spec.md) + [`../specs/skills-library-completion-addendum.md`](../specs/skills-library-completion-addendum.md). Supersedes `self-help-library.md` idea. Unblocks Open Studio Mode capability-gap surfacing, future Badge Engine, Safety Badge consolidation. Created 11 Apr 2026.

### Open Studio Mode — Studio Desk, Three-Touch Pattern, No-Chatbot Scaffolding
- **Priority:** P1 | **Est:** TBD (much reuses Skills Library joins) | **Doc:** [open-studio-mode.md](open-studio-mode.md)
- Specs *how Open Studio feels moment-to-moment* — the runtime studio, not the planning journey. Sibling to Open Studio v2 (which specs the plan) and successor in behaviour to v1 (which was the first working draft of the runtime). **Three-touch pattern:** arrival intent (~10s) → passive evidence (session) → departure reflection (~60s, cannot be dismissed — price of admission for tomorrow). **AI critic in the corner:** silent by default, speaks only on invite / timer elapse / 20-min no-evidence / drift signal / intent-evidence mismatch / blocker keyword. **Escalation ladder:** 5 rungs, rungs 3-4 always teacher actions, AI never revokes. **UX:** horizon strip + intent card + desk (existing `student-workspace.jsx` 3D scene) + self-timer + critic corner + reflection drawer. **No student-facing chatbot at launch** — every help moment resolves to a skill card via a join, not a model. Depends on Skills Library for capability-gap surfacing (`required_skills - earned_skills`). Spec at [`../open studio/open-studio-mode-spec.md`](../open studio/open-studio-mode-spec.md), wireframes + reference prototypes + composed dashboard in [`../open studio/prototypes/`](../open studio/prototypes/). Unblocks teacher floor-walk dashboard (its own spec), parent weekly update digest. Created 11 Apr 2026.

### Open Studio v2 — Mentor-Guided Project Planning
- **Priority:** P1 | **Est:** 15-17 days | **Doc:** [openstudio-v2.md](openstudio-v2.md)
- Journey Engine's first complex consumer. AI mentor negotiates a real project plan with each student: project, timeframe, deliverables, milestones, knowledge gaps (MiniSkill recommendations), resources. 7-station Planning Journey with Sonnet-level reasoning (pushback on unrealistic timelines, deliverables extraction, constraint synthesis). Teacher sets parameters at unlock (capability tier, min check-ins, custom constraints, semester end). Teacher approval workflow (approve / notes / return for revision). Plan becomes backbone of Working phase — milestone-aware check-ins, health score, adaptive frequency. Depends on Journey Engine (Phases A-B), Timetable & Scheduling. Supersedes `openstudio.md` idea doc.

### Student Learning Profile — Unified Schema
- **Priority:** P0 | **Est:** 21-25 days | **Doc:** [../specs/student-learning-profile-schema.md](../specs/student-learning-profile-schema.md)
- Consolidates three overlapping profile specs (discovery-intelligence-layer, student-learning-intelligence, cognitive-layer) into one canonical `student_learning_profile` table. **7 sections** (identity, cognitive, current_state, wellbeing, passive_signals, **social**, **custom**) + computed `pedagogy_preferences`. Single writer class per section enforced via SECURITY DEFINER (now 7 writer classes). Section-level visibility (identity/cognitive/current_state/pedagogy student-visible; wellbeing/passive_signals/social teacher-only). Separate `student_project_history` + `student_learning_events` + `profile_dimensions` + `profile_synthesis_jobs` tables. **4 phases: A (schema + Identity + SDT + passive signals + dimension registry + creative_voice, 11d), B (trajectory + divergence + PeerInteractionWorker + TrajectorySnapshotJob, 5d), C (teacher UI + nudges + group view, 4d), D (narrative + export + Designer Mentor matcher hook + cleanup, 5d).** Feature flag `student_profile_v1`, hard cutover. **Option 2 stress-test extensions (10 Apr 2026):** added SDT motivational_state (autonomy/competence/relatedness/purpose), social layer with group work support (collaboration_orientation, critique quality, peer_influences, group_history, current_groups), dimension registry (`profile_dimensions` + `profile.custom` JSONB slot for future journey blocks to declare new dimensions without migrations), creative_voice (1024-d aesthetic_embedding for Designer Mentor matching), trajectory_snapshots (compressed termly/drift/manual snapshots for 6-year student arc). +6d cost. **5 blocking open questions** before Phase A ships: multi-class teacher RLS (OQ-2, resolved), COPPA (OQ-4, resolved), synthesis trigger (OQ-9, resolved), **HMAC salt scope for peer anonymisation (OQ-13)**, **group FERPA RLS tightening (OQ-14)**, **Discovery SDT tag audit (OQ-15)**. Unblocks: Designer Mentor matching, Discovery Cognitive Layer, Open Studio v2 plan health, adaptive AI scaffolding, group-project AI mentoring, motivation-aware scaffolding, long-horizon student UX. Spec created 10 Apr 2026, option-2 extension 10 Apr 2026.

### Profile Consumers — Using the Student Learning Profile
- **Priority:** P1 | **Est:** ~31-42 days (Control Plane 10-12d + 8 sequenceable consumers 21-30d) | **Doc:** [profile-consumers.md](profile-consumers.md)
- Tracks the consumer-side of the Student Learning Profile: every downstream system that should read the profile and adapt. SLP is a *capture* system — this is the *use* system. **All consumers ship OFF by default. Mandatory Control Plane prerequisite (10-12d):** admin dashboard toggle registry per consumer (enabled/cohort scope/field allowlist/fallback/observability/kill switch/audit) + extensive sandbox (profile picker, 15-profile seed library, side-by-side profile-aware vs profile-naive diff, field influence trace, scenario runner, golden-snapshot regression, privacy-safe mode, observability debugger, rollout simulator). Nothing goes live in production until proven in sandbox. 8 candidate consumers: (1) AI Mentor tone/depth/scaffolding adaptation, (2) Generation Pipeline class-aggregate profile injection, (3) Lesson Rendering per-student scaffolding variants, (4) Open Studio v2 plan health + adaptive check-ins, (5) Discovery Engine return-visit short-circuit (45min → 10-15min), (6) Designer Mentor aesthetic matching (unblocked by creative_voice), (7) Group formation suggestions (needs PeerInteractionWorker), (8) Teacher dashboard profile-surfaced nudges. Cross-cutting: caching contract, observability (which fields drove which output), A/B framework, fallback behaviour, privacy scope enforcement. **Blocks on SLP Phase A minimum.** 5 strategic questions to resolve first: consumer coordination (double-dip risk), ability-grouping perception, teacher opt-out granularity, student visibility, measurement framework. Build order: Control Plane first (10-12d) → AI Mentor (1-2d) → Designer Mentor matching (2-3d) → rest. Created 10 Apr 2026.

### Discovery Engine — Cognitive Layer (MindPrint-Informed)
- **Priority:** P1 | **Est:** TBD | **Doc:** [discovery-engine-cognitive-layer.md](discovery-engine-cognitive-layer.md)
- Adds 3 new cognitive rooms to the "Discover Your Design DNA" onboarding — Spatial Reasoning (3D net puzzle), Flexible Thinking (object reframing / mid-task constraint pivot), Visual Memory (design detail recall). Informed by MindPrint Learning's NIH/UPenn-validated cognitive battery (ESSA Tier IV). MindPrint's own taxonomy flags spatial perception, abstract reasoning, and flexible thinking as key for Art/Design/Engineering — StudioLoom's exact domain. **Design principle:** cognitive rooms don't change *which* designer a student matches with — they change *how* the AI mentor communicates (visual vs verbal scaffolding, structured vs open prompts, repetition for low visual memory, "what if?" provocations for high flexible thinking). Puzzle-framed, ~60 seconds each, never feels like a test. Unlocks per-student pedagogy adaptation on top of per-mentor personality. Future path: ingest existing MindPrint profiles from schools that already use the assessment. Next steps: design 3 room UIs, scoring rubrics (0-1 normalised), mentor prompt-modifier logic, enhanced Design DNA profile reveal. Ties into Discovery Engine, Designer Mentor System, Journey Engine, Student Learning Profile.

### Grading System Overhaul — Multi-Task Assessment, AI-Assisted Marking & Student Feedback
- **Priority:** P1 | **Est:** 14-18 days (7 phases) | **Doc:** [grading.md](grading.md)
- Replaces single-grade-per-unit with multi-task assessment model. **Three new pillars added (13 Apr 2026):** (1) **Teacher Marking Experience** — `/teacher/marking` queue aggregating all pending work across classes, split-view in-context marking (student work left / rubric+scoring right), batch marking flow with prev/next, criteria coverage heatmap on Class Hub; (2) **AI Role in Grading** — Haiku pre-scoring with confidence (ghost scores teacher confirms/overrides), consistency checker ("you gave similar work different scores"), per-task feedback draft generation, class-level insights post-marking, integrity-informed grading signals, all opt-in per class; (3) **Student Feedback Experience** — notification cards on dashboard when work returned, inline feedback anchored to specific activities on lesson pages, growth trajectory charts per criterion, AI "What to do next" nudges linking to toolkit tools, formative (coaching) vs summative (milestone) UI framing. 10 key decisions. 7 phases: data model → lesson editor → grading UI + marking queue → AI-assisted grading → student feedback → report writing → moderation & analytics. Depends on Dimensions3, MYPflex (DONE), MonitoredTextarea (DONE), Phase 0.5 Editor (DONE).

### Governance — Phase GOV-2: Multi-School Enablement
- **Priority:** P0 (school deployment gate) | **Est:** 7-8 days | **Doc:** [governance-systems-plan.md](governance-systems-plan.md)
- Four systems. (1) **Audit log** (closes FU-W) — `audit_log` table with `actor_id`, `impersonated_by`, `action`, `target_table`, `target_id`, `class_id`, `meta`, `severity`; instrument ~20 critical write sites (PII, grades, safety, moderation); admin sub-tab in 7I. (2) **Access Model v2** (closes FU-O/P/R) — `schools` + `school_memberships` + `class_memberships` with role enum (owner/admin/dept_head/teacher/co_teacher/ta/observer); RLS rewritten across ~30 tables to use membership joins; needs own spec (`access-model-v2-spec.md`) before build (+1d). (3) **Impersonation / support-view** — middleware wraps auth context with `acting_as`; every write logs `actor + impersonated_by`; red banner; 60min timeout; teachers only (not students). (4) **DSR runbook** — `scripts/dsr/export.ts` + `scripts/dsr/delete.ts` reading data-classification registry to walk PII tables; 30-day legal SLA; sub-processor notify list. Depends on GOV-1.1 (classification). Blocks: any multi-school deployment. Created 14 Apr 2026.

### Governance — Phase GOV-3: Production Hardening
- **Priority:** P1 | **Est:** 3-4 days | **Doc:** [governance-systems-plan.md](governance-systems-plan.md)
- Five systems before first real school goes live. (1) **Error tracking** — `@sentry/nextjs` integration tagging errors with `teacher_id | student_id | class_id | route | ai_call_site | cost_category`; alert rules; audit-log bridge for SEV1 events. (2) **Incident response playbook** — `docs/runbooks/incidents.md` with severity defs, on-call (Matt), comms templates, per-system rollback checklists, post-incident-review template. (3) **Migration rollback procedure** — every future migration gets a paired `.down.sql`; retroactive down migrations for last 10 (075–077 priority); pre-flight-audit check. (4) **Backup/restore runbook** — quarterly drill; first drill within a month; verify a known row in a restored Supabase snapshot. (5) **Release/deployment log** — `docs/releases.md` append-only per deploy (commits + migrations + flags + schema); saveme step 12 appends automatically when migrations shipped. Created 14 Apr 2026.

### Governance — Phase GOV-4: Quality Instrumentation
- **Priority:** P2 | **Est:** 3 days | **Doc:** [governance-systems-plan.md](governance-systems-plan.md)
- Turn prototype into real product. (1) **Accessibility conformance log** — `docs/accessibility.yaml` per route with status (audited/partial/gap/n/a), WCAG level, audited_date, known_issues list; run `design:accessibility-review` skill on top 20 routes first; defer long tail. (2) **User-research registry** — `docs/research/log.yaml` with id/date/method/n/segment/transcripts/findings/linked_decisions/status; hooks into `design:research-synthesis` + `product-management:synthesize-research` skills. (3) **A/B test / experiment registry** — `docs/experiments.yaml` with hypothesis/metric/segment/variants/allocation/result/decision; variants read from feature-flag registry so allocation is first-class. Created 14 Apr 2026.

### Governance — Phase GOV-5: SaaS Hygiene
- **Priority:** P3 | **Est:** 1-2 days | **Doc:** [governance-systems-plan.md](governance-systems-plan.md)
- Nice-to-have when whitespace appears. (1) **SLA definitions** — `docs/sla.md` with uptime target (99.5% year one), per-endpoint-class response-time targets, maintenance window policy, incident-comms SLA. (2) **Parent communication log** — schema + UI tracking parent emails, consent forms, data-request history per student; gates any "parents view portfolio" feature. (3) **Standards coverage matrix** — explicit YAML per framework × neutral criterion showing toolkit coverage, Teaching Moves coverage, exemplar coverage; reveals thin content areas; extends FrameworkAdapter. Created 14 Apr 2026.

### Year Planner & Curriculum Connection
- **Priority:** P1 | **Est:** 5-7 days | **Doc:** `docs/specs/year-planner-spec.md`
- Week-based grid (all classes × all units across academic year). Drag-to-move. Lesson count from cycle engine. Curriculum coverage overlay. Depends on timetable (COMPLETE).

### Planning Tools / Student PM
- **Phase:** 1 | **Est:** 5 days | **Doc:** `docs/specs/planning-tools-ux-spec.md`
- Student kanban with MYP Design Cycle phases. Keyboard-first, mobile-first. AI suggestions. Due dates tied to timetable.

### Gamification / Student Levels
- **Phase:** 1 | **Est:** 8-10 days
- Designer Level system (quality-weighted, not volume). Composite from criteria scores, toolkit depth, badges, reflections, Open Studio, NM, portfolio. No public leaderboard (ages 11-16). Depends on grading + all subsystems.

### Intelligence Profiles (Teacher & Student)
- **Phase:** 3.5 | **Est:** 8-10 days | **Doc:** `docs/student-learning-intelligence.md`
- Teacher profile: learns style from edits, feedback, pacing. Student profile: 4-phase build from Discovery + toolkit + pace + progress. Cached 200-300 token summary for AI. Identity-safe.

### Lesson Plan Converter
- **Phase:** 2 | **Est:** 5-7 days | **Doc:** `docs/specs/lesson-plan-converter.md`
- Dual output: editable unit + tagged activity blocks. Reuses stored text + Pass 0 result. "Convert to Unit" button on knowledge cards. Depends on Dimensions3 Phase 1+2.

### Unified Upload Architecture
- **Phase:** 2 | **Est:** 3.5 days | **Doc:** `docs/specs/unified-upload-architecture.md`
- Every upload → knowledge pipeline first. Convert-on-demand. Option 2 APPROVED. Build after Dimensions Phase 3-4.

### Student Choice Units
- **Phase:** 4+ | **Est:** 4-5 days | **Doc:** [studentchoice.md](studentchoice.md)
- Students pick from teacher-curated list. AI generates personalized unit. Learning profile influences scaffolding. Requires content library.

### NM Rocket Report
- **Phase:** 6.7 | **Est:** 2-3 days
- Awaiting Melbourne Metrics materials from Matt. Visual report format TBD.

### API Deduplication
- **Phase:** Tech Debt | **Est:** 2 days
- 17× copied `callHaiku()` = ~2,890 wasted lines. Consolidate into single AI service helper. Prerequisite for clean Dimensions3 pipeline. Source: OS service mapping #12 (Feedback Engine) + code audit.

### Auth / ServiceContext Seam
- **Phase:** OS Seam | **Est:** 1-2 days | **Source:** ADR-001, OS Service #3
- Add `requireAuth(role)` helper + tenant-aware `ServiceContext` pattern (product-aware, role-aware) without rebuilding auth. Lightweight architectural seam that makes Makloom extraction cleaner. Not SSO/RBAC (that's in School Readiness) — just clean interfaces over the current student-token + Supabase Auth dual system.

### AI Safety & Content Guardrails
- **Phase:** Pre-Pilot | **Priority:** P1 | **Est:** 10-14 days | **Doc:** [ai-safety.md](ai-safety.md)
- Comprehensive AI safety layer for all 5 student↔AI touchpoints (Design Assistant, toolkit nudges, Discovery Kit, Open Studio, Gallery). Content filter engine (800+ blocked words, l33tspeak/unicode evasion detection, school/class-configurable word lists). PII scanner (student name protection from class roster, email/phone/address detection). Topic guardrails (hardcoded safety floor + school-configurable restricted topics). Distress detection (keyword + behavioural signals from MonitoredTextarea, teacher alert protocol). AI conversation logger (full audit trail). AI output screening (content filter + PII + hallucination guard + tone check). Teacher Safety Dashboard (conversation viewer, flagged queue with severity sorting, policy configuration per class). PII pseudonymisation wrapper for all AI API calls. Competitive parity with Toddle (ISO 42001 features) plus StudioLoom advantages: per-step phase-aware safety, effort-gated AI access, integrity+safety unified signals. Extends existing MonitoredTextarea, integrity scoring, response flags, rate limiting. Required before any school pilot. Supersedes old "Content Safety & Moderation" entry.

---

## 💡 Ideas Backlog

### High Priority Ideas

| Idea | Category | Est. | Notes |
|------|----------|------|-------|
| ~~Open Studio v2 — Journey-Based~~ | ~~Student XP~~ | | **Superseded by Open Studio v2 project below** |
| **ELL — Language Support for Multilingual Learners** 🔬 | Student XP | TBD | Per-student language scaffolding across every student-facing surface, driven by `ell_level` (currently stored but unread). Research includes **Medley Learning** — browser-extension scaffolding with re-leveling, click-any-word definitions + visuals + audio, chunking, sentence frames → stems fade, home-language translation, read-aloud, per-student proficiency-based scaffold depth. StudioLoom advantage: owns the content pipeline end-to-end, so scaffolds can live inside Activity Blocks rather than bolt on at render time. Likely merges with `inclusive.md` as a *Per-Student Rendering Layer* epic. Depends on Dimensions3. Critical for international schools market (Matt teaches in China). Doc: [ell.md](ell.md) |
| **Real Client Journey** | Student XP | 5-7d | AI-simulated client meetings (4 per unit). Cross-meeting memory. Doc: [realclient.md](realclient.md) |
| **MiniSkills** | Student XP | 3-4d | Bite-sized 1-3 lesson micro-units. Badge on completion. Doc: [miniskills.md](miniskills.md) |
| **Monetisation & Tiers** | Business | 7-10d | Stripe, 4 tiers (Free/Starter/Pro/Enterprise). Doc: [monetisation.md](monetisation.md) |
| **Bug Report Button** | Platform | 3-4d | Floating button, per-class toggle, admin workflow. Doc: [bug-button.md](bug-button.md) |
| **Kahoot-Style Quizzes** | Student XP | 3-5d | Live quiz activity type. Start self-paced, add live mode later. |
| **Peer Feedback Stations** | Student XP | 3-4d | Device becomes feedback collection point (QR code). Great for design classrooms. |
| **Student Self-Help Library** | Student XP | 6-8d | Searchable micro-lessons (2-5 min). Doc: [self-help-library.md](self-help-library.md) |
| **Processing Queue / Async Jobs** | Infrastructure | 3-4d | Job queue for AI calls (generation blocks HTTP ~45s). Supabase-native or Bull/Redis. Priority levels, retry, status tracking. OS Service #8. |
| **Better Stack Uptime Monitoring** | Infrastructure | 10 min | Free tier. 2 monitors: site (HTTP 200) + `/api/health` (keyword `"ok":true`). 3-min interval. Push notifications via mobile app. Quiet hours 11pm-6am Nanjing. |

### Medium Priority Ideas

| Idea | Category | Notes |
|------|----------|-------|
| **Lesson Export (PPT/PDF/Worksheet)** | Teacher XP | Export pipeline from unit content. Design: what does a "worksheet" look like per page type? |
| **Teacher Projector/Present Mode** | Teacher XP | Clean high-contrast view for projection. Keyboard nav. Simpler than generating PPTs. |
| **Feature Flag System** | Platform | Simple `isEnabled(flag)` + DB table. Scope: global → class → user. Replaces hardcoded quarantine. PostHog also has flags. OS Service #3. ~1d. |
| **Event Bus (In-Process)** | Infrastructure | Typed publish/subscribe. Start with `events` table + polling. Smart Insights subscribes instead of re-querying. OS Service #9. ~2-3d. |
| **Unified Search** | Platform | Search across units, activities, student work — currently only knowledge chunks. Supabase FTS + pgvector. Permission-aware. OS Service #6. ~3-4d. |
| **AI Context Protocol** | AI/Architecture | Formalize prompt context envelope (user profile, activity, curriculum, constraints). Partially exists but scattered. Versioned prompt templates. OS Service #13. ~2d. |
| **Competitive Free Activities** | Marketing | Design challenges, timed sprints, design battles with peer voting. Ties into free tools funnel. |
| **Core Cards Spanning Multiple Lessons** | Architecture | Activities that span lessons (ongoing research, multi-session builds). `span` property. |
| **More Wizard Variation** | AI/Generation | 3 contextual regenerate buttons: "more hands-on" / "stronger scaffolding" / "real-world connections" |
| **Fun AI Thinking Messages** | UX Polish | Educational puns during generation ("Consulting with Bloom about taxonomy..."). Low effort, high charm. |
| **Textbook Source Flagging** | Knowledge | `source_restriction` field: unrestricted / reference_only / excluded. IP protection. |
| **AI-Generated Diagrams** | AI/Generation | Generate SVGs from concept descriptions. Pre-built templates more reliable than full AI generation. |

### Low Priority / Far Future

| Idea | Category | Notes |
|------|----------|-------|
| **Parent Weekly Updates** | Stakeholder | AI-generated summaries. Email delivery. Privacy controls. Phase 5.5+ | Doc: [parent-updates.md](parent-updates.md) |
| **Multi-Language / i18n** | Platform | Next.js i18n. Per-class language settings. 10-15 days. Post-revenue. Doc: [i18n.md](i18n.md) |
| **VEX Robotics / Engineering Layer** | Expansion | CurriculumProfile for engineering. Toggle on/off per class. |
| **Hardware Packs for Schools** | Business | Partner with suppliers, include materials lists in units. Revisit with traction. |
| **Makloom (Consumer Version)** | Expansion | Sister project (makloom.com). 60-70% code reusable from StudioLoom. No teacher/class structure — self-directed learner experience. Could offer curated resource kits (physical materials) paired with free instructional content. **Inspiration: Craft Club Co** (craftclubco.com) — sell physical kits, include QR code in box linking to free detailed instructional videos (closeup hands-on footage). Good model for public individuals learning design/making skills. Explore: could Makloom partner with suppliers for kits, or curate third-party resources alongside AI-guided project journeys? |
| **Teacher↔Student Messaging** | Communication | 1:1 + class group messaging. Thread on work items. Moderation hooks (minors). OS Service #20. Post-pilot. |

### Parked / Not a Feature

| Item | Category | Notes |
|------|----------|-------|
| Scaffolding for different levels | Enhancement | Types built (ClassCohortContext, StudentLearningProfile), needs wiring + adaptive logic |
| Slow API calls | Performance | Audit slow endpoints. Streaming, caching, model selection, prompt length |
| Photo annotation in portfolio | Enhancement | Phase 3 annotation layer. Quick Capture already handles photo upload |
| Skeleton approach flickering | Bug | State management — keep skeletons visible until real data ready, then crossfade |
| Hesitant to bulk upload | Testing | Need confidence in pipeline consistency before bulk uploading valuable content |

---

## ✅ Complete (41 shipped features)

<details>
<summary><strong>Click to expand all completed projects</strong></summary>

### Core Platform
- **Governance Foundation (GOV-1)** — 4 sub-phases shipped 14 Apr 2026. (1.1) Data-classification taxonomy + 6-axis classification of 72 tables in `schema-registry.yaml`. (1.2) `feature-flags.yaml` (15 flags + 12 secrets) + taxonomy. (1.3) `vendors.yaml` (9 vendors — Anthropic, Supabase, Voyage, Vercel, Groq, Gemini, Resend, Sentry, ElevenLabs) with DPA status + 11-category `data_sent` + 8 legal bases + taxonomy. (1.4) Live drift-detection loop: 2 scanners (`scan-feature-flags.py`, `scan-vendors.py`) with JSON reports, `change-triggers.yaml` (6 triggers), doc-manifest schema bump (`max_age_days` + `last_scanned` per entry), `version: 1` field on all 5 registries, admin read-only panel at `/admin/controls/registries` with staleness chips, `governance-registries` system in WIRING, quarterly self-silencing scheduled task. 11 commits pushed. Docs: [governance-systems-plan.md](governance-systems-plan.md).
- **Unit Forking / Unit-as-Template Architecture** — Copy-on-write per-class content editing. Resolution chain. Version history. Migration 040.
- **Phase 0.5 Lesson Editor** — 12 components (~3,962 lines). Drag-to-reorder, split-pane, Undo/Redo, auto-save, Workshop Model phases. Doc: [uniteditor.md](uniteditor.md)
- **Unit Type Framework Architecture** — 4-dimension model (Type × Programme × Curriculum × Standards). DESIGN/SERVICE/PP/INQUIRY. Dynamic criteria. Migration 051.
- **Lesson Timing Engine** — Workshop Model enforcement. 4-phase structure. 1+age cap. PhaseTimelineBar. 8 validation rules + auto-repair. 4 presets.
- **Project Dimensions v2 (Data Architecture)** — Phases 0-4b COMPLETE. UDL 3×3 (31 checkpoints). timeWeight. bloom_level. ai_rules. Client-side activity tracking. Migrations 057/058.
- **Timetable & Scheduling System** — Rotating cycle engine (5-10 day). iCal import. LessonSchedule. TimetableGrid. Migration 038.
- **School Calendar / Term System** — Per-teacher calendar. 4 templates. Migration 037.
- **Performance Optimizations** — Parallelized generation (3 min → 45s). Tree-shaking. Code-splitting. Polling optimization. Image compression.
- **Student-Class Junction** — Multi-class enrollment. Migration 041. Junction-first + legacy-fallback pattern.

### AI & Generation
- **Admin AI Controls Redesign** — Macro dials + presets + macro/micro toggle. Config history.
- **Lesson Editor AI Assist (# Field)** — AITextField with purple # button. Context-aware suggestions.
- **Cross-Container Drag-and-Drop** — DndContext + DropZone + HTML5 DnD + Framer Motion Reorder.
- **Unit Generation Phases 0-3** — Multi-type wizard. 3-lane selector. Parallelized generation (~4x speedup).
- **Lesson Pulse Phase 1** — 3-dimension scoring (CR/SA/TC). 47 tests. Teaching Moves Library (65 moves). Context Injection.
- **Dimensions3 Spec Finalization** — v1.2. 25 issues fixed. All 9 open questions RESOLVED. Testing plan. Printable doc.

### Student Experience
- **Discovery Engine (8-Station Journey)** — ~9,500 lines. Kit mentor. Archetype scoring. Two modes. Migration 047.
- **Student Onboarding / Studio Setup** — 4-screen character creation. 3 mentors. 4 themes. Migration 050.
- **Student Dashboard Redesign** — Framework-colored cards. Smart subject detection. Multi-class support.
- **Open Studio v1** — Self-directed working. AI studio critic. 5 interaction types. 3-level drift escalation. Migration 029.
- **Student Learning Profile** — 7-system profiling. Wired into Open Studio AI. Glowing banner. Migration 048.
- **Safety Badges** — Workshop safety certification. 5 question types. Unit access gating. Migration 035.
- **Academic Integrity Monitoring** — MonitoredTextarea. 6-rule scoring. IntegrityReport with writing playback. Migrations 054/059.
- **Toolkit (27 Interactive Tools)** — SCAMPER, Six Hats, PMI, Decision Matrix, Five Whys, Empathy Map, + 21 more. All wired with useToolSession persistence. Doc: [toolkit.md](toolkit.md)
- **Toolkit Persistence** — useToolSession hook. Auto-save, session resume, state tracking.

### Teacher Experience
- **Teaching Mode (Live Cockpit)** — 3-column layout. Phase timer. Live student grid. Dark projector view. "Needs Help" detection.
- **Class Gallery & Peer Review** — Pin-up crit system. 3 review formats. Effort-gated feedback. Migration 049.
- **Smart Insights Panel** — Priority-sorted feed. 6 insight types. Server-side computation (no AI calls).
- **Unit Thumbnails (Teacher-Editable)** — Gallery picker (30 Unsplash photos) + upload. Migration 052.
- **Grading System** — Criterion scoring (MYP 1-8, GCSE 0-100%). Comments, tags, targets. IntegrityReport panel. Doc: [grading.md](grading.md)
- **NM / Melbourne Metrics Phase 1** — CompetencyPulse (student 3-point) + ObservationSnap (teacher 4-point). Pop art identity. Migrations 030/032/056. Doc: [new-metrics.md](new-metrics.md)

### Infrastructure & Operations
- **CI/CD & Monitoring (Sprints 1-2)** — GitHub Actions CI (lint + typecheck + build + tests + dashboard sync check on push/PR), nightly audit (2am Nanjing = 6pm UTC, + doc freshness + WIRING health), `/api/health` endpoint (Supabase ping, response time), Sentry fully configured (server + edge + browser + 14 API routes), Vercel env vars set, GitHub Secrets configured. Doc: [automation-build-plan.md](../automation/automation-build-plan.md)
- **Documentation Infrastructure** — CLAUDE.md slimmed (424→147 lines), decisions-log.md (182+ entries), lessons-learned.md (31+ entries), resolved-issues-archive.md, doc-manifest.yaml (~217 files, all verified), changelog.md, WIRING.yaml (92 systems, validated), wiring-dashboard.html, system-architecture-map.html, `saveme` 10-step command, `refresh-project-dashboard` scheduled task, session change detector.
- **Test Infrastructure** — Vitest 4, 17 test files, ~390 tests. Dimensions3 pipeline stage contract tests, AI output validation tests, Lesson Pulse (47 tests), Teaching Moves, timing validation, cycle engine, integrity scoring, framework vocabulary, design assistant, error handler, toolkit API. Test coverage map at `docs/testing/test-coverage-map.md`.

### Marketing & Tools
- **Landing Page** — Story-driven 5-phase journey. CSS mock visuals. Framework trust bar.
- **Design Thinking Toolkit (Public)** — 42 tools at `/toolkit`. Dark theme. Phase pills. SVG thumbnails. AI search.
- **Report Writer (Free Tool)** — Bulk report comments at `/tools/report-writer`. Multi-framework.
- **Competitive Analysis** — StudioLoom vs 5 competitors. 35 features. 3-sheet spreadsheet.
- **QA Testing Dashboard** — 65 test cases. Status buttons. localStorage persistence. JSON export/import.
- **Test Sandbox / Admin** — Framework selector. Single lesson generation. Dynamic max_tokens.

</details>

---

## ⚫ Superseded

- **Dimensions2** — Replaced by Dimensions3. Doc: [dimensions2.md](dimensions2.md) (kept for historical reference)
- **Old Own Time system** — Replaced by Open Studio v1 (Migration 029 drops old tables)
- **Comic Strip Discovery** — Replaced by 8-station Discovery Engine
- **5-mentor system** — Reduced to 3 mentors (Kit/Sage/Spark) for onboarding, Kit-only for Discovery

---

## 📚 Reference & Inspiration

These aren't features — they're design references noted during brainstorming:

- **MakeyMakey lesson flow** — UX inspiration for visually distinct steps, inline media, clear "do this next"
- **Google NotebookLM** — Study: source attribution, AI summaries, "chat with documents" UX
- **MakeMake interactive popups** — Clickable hotspots on images (relates to Phase 3 annotation layer)
- **KJS Publications Engineering Workbook** — Content structure for engineering documentation
- **Textbooks + AI relationship** — Both: textbooks as knowledge inputs, AI generates customized lessons

---

## File Map

| File | Purpose |
|------|---------|
| `docs/projects/ALL-PROJECTS.md` | **This file** — master index |
| `docs/projects/dashboard.html` | Interactive visual dashboard |
| `docs/roadmap.md` | UX philosophy, design principles, phase descriptions |
| `docs/quarantine.md` | Quarantine register (42 sealed entry points) |
| `docs/projects/*.md` | Individual project docs (deep specs) |
| `docs/specs/*.md` | Feature specifications |
| `docs/research/*.md` | Research synthesis docs |
| `docs/design-guidelines.md` | 42 design principles (feeds dashboard Guidelines tab) |
| `CLAUDE.md` | Session context (stack, architecture, decisions, lessons learned) |
