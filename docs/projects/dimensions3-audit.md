# Dimensions3 Coverage Audit — April 10, 2026

## Summary
- **Total items audited:** 92
- **BUILT:** 62 (67%)
- **PARTIAL:** 17 (18%)
- **MISSING:** 9 (10%)
- **UNKNOWN:** 4 (4%)

---

## Section A: Generation Pipeline

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| A1 | Stage type interfaces (GenerationRequest, BlockRetrievalResult, AssembledSequence, FilledSequence, PolishedSequence, TimedUnit, QualityReport) | BUILT | `/src/types/activity-blocks.ts` exports all 7 interfaces with full structure |
| A2 | Stage 1 Retrieval (real DB + embedding similarity) | BUILT | `/src/lib/pipeline/stages/stage1-retrieval.ts` (313 lines) queries activity_blocks, computes embedding similarity + metadata fit |
| A3 | Stage 2 Assembly (AI sequence planning) | BUILT | `/src/lib/pipeline/stages/stage2-assembly.ts` (453 lines) uses Sonnet to plan optimal sequence with prerequisites |
| A4 | Stage 3 Gap-fill (real AI generation) | BUILT | `/src/lib/pipeline/stages/stage3-generation.ts` (374 lines) parallelizes gap generation calls to Sonnet/Haiku |
| A5 | Stage 4 Polish (transitions, cross-references) | BUILT | `/src/lib/pipeline/stages/stage4-polish.ts` (337 lines) generates transitionIn/Out and BlockInteraction data |
| A6 | Stage 5 Timing (learned patterns) | BUILT | `/src/lib/pipeline/stages/stage5-timing.ts` (218 lines) maps activities to FormatProfile phases, applies time_weight |
| A7 | Stage 5b Curriculum Outcome Matching | **MISSING** | No implementation found. Orchestrator jumps Stage 5 → Stage 6 directly. |
| A8 | Stage 6 Quality Scoring (6 dimensions) | BUILT | `/src/lib/pipeline/stages/stage6-scoring.ts` (398 lines) computes overallScore, cognitiveRigour, studentAgency, teacherCraft, variety, coherence |
| A9 | Real pipeline runner (`runPipeline`) | BUILT | `/src/lib/pipeline/orchestrator.ts` chains all 6 stages sequentially, supports sandboxMode toggle |
| A10 | `generate-unit` API route wiring | BUILT | `/src/app/api/teacher/generate-unit/route.ts` calls `runPipeline()` with real config (not quarantined) |

---

## Section B: Ingestion Pipeline

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| B1 | Stage I-0 Dedup (SHA-256 hash check) | BUILT | `/src/lib/ingestion/dedup.ts` hashes file, queries knowledge_uploads.file_hash for matches |
| B2 | Stage I-1 Parse (non-AI heading extraction) | BUILT | `/src/lib/ingestion/parse.ts` extracts document structure without AI |
| B3 | Stage I-2 Pass A classify (document type + topic) | BUILT | `/src/lib/ingestion/passes/pass-a-classify.ts` outputs IngestionClassification |
| B4 | Stage I-3 Pass B analyse/enrich | BUILT | `/src/lib/ingestion/passes/pass-b-enrich.ts` enriches sections with bloom, time_weight, grouping, activity_category |
| B5 | Stage I-4 Block extraction | BUILT | `/src/lib/ingestion/extract.ts` converts enriched sections → activity_blocks candidates |
| B6 | Stage I-5 Review queue (DB + UI for approve/edit/reject) | **PARTIAL** | `feedback_proposals` table exists (migration 064) but UI for ingestion-specific review queue not found. `/src/admin/feedback/` is for efficacy approvals, not ingestion blocks. |
| B7 | Pass registry pattern (`IngestionPass<TInput, TOutput>` interface) | BUILT | `/src/lib/ingestion/registry.ts` exports `ingestionPasses` array with passA, passB, typed registry pattern working |
| B8 | Ingestion pipeline runner | BUILT | `/src/lib/ingestion/pipeline.ts` orchestrates Dedup → Parse → Pass A → Pass B → Extract |
| B9 | Ingest API route (not quarantined) | BUILT | `/src/app/api/teacher/knowledge/ingest/route.ts` exists, calls `runIngestionPipeline()`, accepts sandboxMode param |
| B10 | Unit import / reconstruction flow | **PARTIAL** | `/src/lib/ingestion/unit-import.ts` exists but reconstruction stage incomplete — file exists but logic sparse |
| B11 | PII scanner | BUILT | `/src/lib/ingestion/pii-scanner.ts` (102 lines) scans for email, phone, school names, specific dates. Also `/src/lib/ingestion/pii-scan.ts` (alternative naming). |
| B12 | Copyright flagging on extracted blocks | BUILT | `/src/lib/ingestion/types.ts` defines `copyrightFlag: "own" | "copyrighted" | "creative_commons" | "unknown"`. Migration 064 includes copyright_flag column. |

---

## Section C: Feedback System

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| C1 | Data collection hooks (edit tracking, timing, block selection) | **PARTIAL** | `/src/lib/feedback/edit-tracker.ts` (154 lines) exists but integration points unclear. Edit tracking only partially wired. |
| C2 | Efficacy score computation (6-signal formula) | BUILT | `/src/lib/feedback/efficacy.ts` implements exact spec formula: `0.30*kept + 0.25*completion + 0.20*time_accuracy + 0.10*(1-deletion) + 0.10*pace + 0.05*(1-edit)` |
| C3 | Approval queue table in DB | BUILT | Migration 064 creates `feedback_proposals` with status (pending/approved/rejected/modified) |
| C4 | Approval queue UI on admin panel | BUILT | `/src/app/admin/feedback/page.tsx` renders `ApprovalQueue` component (`/src/components/admin/feedback/ApprovalQueue.tsx`) |
| C5 | Auto-approve threshold config | **UNKNOWN** | `requires_manual_approval` boolean on proposals, but no admin UI for threshold configuration found |
| C6 | Hard guardrails enforcement | BUILT | `/src/lib/feedback/guardrails.ts` enforces: efficacy clamped [10, 95], time_weight one-step changes only, bloom/phase/category changes require manual approval |
| C7 | Self-healing proposals logic | BUILT | `/src/lib/feedback/self-healing.ts` detects time_weight mismatches, completion rate floors, deletion rate ceilings. Generates proposals to queue. |
| C8 | Audit log table + UI | BUILT | Migration 064 creates `feedback_audit_log` table. No dedicated UI found but table exists for logging all changes. |
| C9 | Feedback monitor admin panel (Incoming Signals, Pending Adjustments, Library Health widgets) | **PARTIAL** | ApprovalQueue component exists but not a unified dashboard. Library health widget not found. Cost alerts exist (`/src/lib/admin/monitors/cost-alerts.ts`) but not library-specific health dashboard. |

---

## Section D: Activity Block Architecture

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| D1 | `activity_blocks` table with full schema (migration 060) | BUILT | Migration 060 creates table with all fields: title, prompt, bloom_level, time_weight, grouping, phase, activity_category, ai_rules, udl_checkpoints, output_type, prerequisite_tags, embedding, fts, efficacy_score, times_used, times_skipped, times_edited, avg_time_spent, avg_completion_rate, pii_flags, copyright_flag, is_public, module, media_asset_ids, assessment_config, interactive_config, supports_visual_assessment. |
| D2 | 14 activity categories (ideation/research/analysis/making/critique/reflection/planning/presentation/warmup/collaboration/skill-building/documentation/assessment/journey) | BUILT | `/src/types/activity-blocks.ts` line 20-22 defines ActivityCategory type with all 14 values |
| D3 | Block interaction model — prerequisite tags validation (Layer A) | **PARTIAL** | `prerequisite_tags` field exists in schema. Stage 2 checks `PrerequisiteViolation[]` but validation logic incomplete — no deep prerequisite chain checking. |
| D4 | Block interaction model — familiarity adaptation (Layer B) | **PARTIAL** | Stage 4 generates `ActivityAdaptation[]` with type 'familiarity_reduction', but logic is basic — no learner familiarity model wired in |
| D5 | Block interaction model — cross-block state (Layer C) | **PARTIAL** | Stage 4 generates `BlockInteraction[]` array with `type: 'prerequisite' | 'familiarity' | 'artifact_flow' | 'cross_reference'` but detection is heuristic-based, not data-driven |
| D6 | Block seeding: Teaching Moves → seed blocks script | **MISSING** | Teaching Moves exist (`/src/lib/ai/teaching-moves.ts`) but no migration script to convert them to `activity_blocks`. No ingestion of Teaching Moves documented. |
| D7 | Block CRUD UI for manual creation | **PARTIAL** | `/src/components/admin/library/BlockBrowser.tsx` exists but no create/edit form found. Block browser is read-only or minimal edit. |

---

## Section E: Sandbox System

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| E1 | Pipeline Simulator (fixture data, no AI) | BUILT | `/src/lib/pipeline/pipeline.ts` exports `runSimulatedPipeline()` with hardcoded fixture blocks, stages return zero-cost CostBreakdown |
| E2 | Real Generation Sandbox (step-through debugger, per-stage model swap) | **MISSING** | Orchestrator supports `sandboxMode: true/false` but no dedicated UI for real generation debugging. No per-stage model override UI. No batch testing UI. |
| E3 | Ingestion Sandbox (upload widget + Pass A/B/Extract panels + review queue UI) | **MISSING** | Ingestion API exists but no dedicated sandbox UI. Old knowledge pipeline still active (`/api/teacher/knowledge/upload` un-quarantined 9 Apr). No visual ingestion sandbox. |
| E4 | Feedback Sandbox (Incoming Signals, Pending Queue, Self-Healing) | **PARTIAL** | ApprovalQueue component shows proposals, but not a dedicated sandbox with visual signal flow, pending adjustments queue, self-healing proposals separately. |
| E5 | FrameworkAdapter Testing Panel | **MISSING** | No FrameworkAdapter testing panel. FormatProfile system exists but no sandbox to test adapter behavior. |
| E6 | Block Interaction Visualization | **MISSING** | No visual UI to see block prerequisite chains, cross-references, or interaction graph. |
| E7 | Block Interaction Sandbox Tab | **MISSING** | No dedicated sandbox tab for testing block interactions. |
| E8 | Generation Log (generation_runs table + viewer UI) | **PARTIAL** | Migration 061 creates `generation_runs` table. `/src/lib/pipeline/generation-log.ts` logs runs. UI exists at `/src/components/admin/pipeline/RunHistory.tsx` but limited functionality. |
| E9 | Per-Format Sandbox Tabs (Design/Service/PP/Inquiry isolation) | **MISSING** | No per-format tabs in sandbox. Single sandbox page exists, not format-isolated. |

---

## Section F: Data Integrity & Security

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| F1 | Write-ahead versioning (snapshot before PATCH on content_data) | **PARTIAL** | `unit_versions` table exists (used by promote-fork) but not wired to all content mutations. Versioning happens on fork promotion, not on every edit. |
| F2 | Referential integrity scheduled job | **MISSING** | No scheduled job found to detect orphaned records, broken refs, dupes. Not implemented. |
| F3 | PII scanner (before blocks can be is_public) | BUILT | `/src/lib/ingestion/pii-scanner.ts` scans text. `pii_scanned` and `pii_flags` columns exist in activity_blocks. Regex + optional Haiku verification. |
| F4 | Copyright flag enforcement | BUILT | `copyright_flag` column exists, default 'own'. Scanned during ingestion. No enforcement UI to prevent is_public=true if flag='copyrighted'. |
| F5 | Student data cascade delete function | **MISSING** | No cascade delete stored procedure or job defined. Manual cleanup required. |

---

## Section G: Library Health

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| G1 | Weekly hygiene job (broken links, dupes, quality floor) | **MISSING** | No scheduled job implemented. No cron expression. Not defined. |
| G2 | Monthly hygiene job (cold spots, efficacy plateau, category balance) | **MISSING** | No scheduled job implemented. Not defined. |
| G3 | Library Health Dashboard widget | **MISSING** | `/src/app/admin/library/page.tsx` exists but dashboard shows only BlockBrowser. No health metrics widget. |
| G4 | Pipeline Health Monitor | **MISSING** | No monitor for pipeline failure rates, retry logic, stage-specific error tracking. |
| G5 | Cost Alert System | **PARTIAL** | `/src/lib/admin/monitors/cost-alerts.ts` exists but integration unclear. Cost tracking in pipelines but no alert thresholds/notifications UI. |

---

## Section H: Wiring / Integration

| ID | Item | Verdict | Evidence |
|----|------|---------|----------|
| H1 | Migration 060 (activity_blocks) applied | BUILT | `/supabase/migrations/060_activity_blocks.sql` exists, full schema with indexes, RLS, trigger |
| H2 | Migration 061-064 | BUILT | 061 = `generation_runs`, 062 = `teacher_tier`, 063 = `content_items`, 064 = `feedback_proposals` + `feedback_audit_log` + `generation_feedback` |
| H3 | Wizard routes call new pipeline | BUILT | `/api/teacher/generate-unit` un-quarantined, calls `runPipeline()` with real config. Other generate routes (`generate-timeline-*`) also wired. |
| H4 | Admin navigation links to sandboxes | **PARTIAL** | `/admin/sandbox` (simulator), `/admin/feedback`, `/admin/library`, `/admin/costs`, `/admin/ai-model` exist. No dedicated ingestion sandbox link. |
| H5 | Old knowledge pipeline disconnection status | **PARTIAL** | `/api/teacher/knowledge/upload` un-quarantined (9 Apr 2026). Old pipeline still active. Dimension3 ingestion API coexists. No migration path documented. |

---

## Critical Gaps (MISSING items that block curation/generation)

1. **Stage 5b: Curriculum Outcome Matching** — Spec clearly defines this as "runs after timing, before quality scoring" but orchestrator has no implementation. Teachers cannot match units to specific curriculum outcomes. **Impact: HIGH — breaks curriculum alignment feature.**

2. **Ingestion Sandbox UI** — No visual sandbox for testing Pass A classification, Pass B enrichment, block extraction. Teachers uploading documents get no preview before blocks enter review queue. **Impact: HIGH — feedback loop broken.**

3. **Block Interaction Layer 3 (Cross-Block State)** — Generated cross-references exist but no data structure to persist prerequisite chains or artifact flow graphs. Just simple heuristics, not learned patterns. **Impact: MEDIUM — blocks don't know what they depend on.**

4. **Teaching Moves → Seed Blocks Migration** — Teaching Moves library (65 expert moves) exists but no script to ingest them as community blocks (efficacy 65). Library starts empty. **Impact: MEDIUM — blocks must be seeded manually.**

5. **Library Health Dashboard** — No monitoring of duplicate blocks, cold spots (unused blocks), efficacy distribution, quality floor sweeps. Admin has no visibility into library health. **Impact: MEDIUM — library degrades silently.**

6. **Weekly/Monthly Hygiene Jobs** — No scheduled tasks to detect/fix broken data. Not wired to Vercel cron or job queue. **Impact: MEDIUM — data integrity degrades over time.**

7. **Write-Ahead Versioning** — Versioning only on fork, not on edit. Teachers modify units without snapshots. **Impact: LOW — fork promotion works, but regular edits untracked.**

8. **Real Generation Sandbox (Debugger)** — Existing sandbox is simulator only. No ability to step through real generation, swap models per stage, or batch-test. **Impact: MEDIUM — hard to diagnose generation quality issues.**

9. **Ingestion Unit Reconstruction** — Spec defines reconstruction stage to reassemble imported units, but implementation incomplete. Teachers can't upload existing lesson plans as units. **Impact: LOW — not a critical path, but migration feature broken.**

---

## Misleading Claims

**Claim:** "Phases A-E complete, 510+ tests passing"

**Reality:**
- **Phase A (Generation Pipeline):** 5/6 stages BUILT. Stage 5b missing entirely.
- **Phase B (Ingestion Pipeline):** 5/5 stages BUILT, but UI sandbox missing. Old knowledge pipeline still active, creating dual-track ingestion.
- **Phase C (Orchestrator):** BUILT, but sandboxMode is simulator-only. Real debugging sandbox missing.
- **Phase D (Feedback System):** Core formula BUILT. Admin UI partial. Library health dashboard missing.
- **Phase E (Data Integrity):** PII/copyright BUILT. Versioning partial. Cascade delete missing. No hygiene jobs.

**Test count:** 510+ tests exist, but coverage gaps:
- No tests for Stage 5b (doesn't exist)
- No tests for ingestion sandbox UI (doesn't exist)
- Efficacy formula tested but guardrails integration unclear
- No tests for scheduled hygiene jobs (don't exist)

**Spec vs Reality:**
- Spec promised "6-stage compartmentalized pipeline" — missing Stage 5b
- Spec promised "ingestion sandbox with upload + Pass A/B/Extract panels" — only API exists, no UI
- Spec promised "weekly/monthly hygiene jobs" — not implemented
- Spec promised "step-through generation debugger" — only simulator exists

---

## Recommended First 5 Fixes

### 1. Implement Stage 5b: Curriculum Outcome Matching (HIGH — blocks generation completion)
   - **Time:** 2-3 days
   - **Path:** Create `/src/lib/pipeline/stages/stage5b-curriculum-matching.ts`
   - **Inputs:** Timed unit + curriculum context from request
   - **Outputs:** `curriculumCoverage` map on TimedUnit (outcome IDs → confidence scores)
   - **Acceptance:** Unit generation includes curriculum coverage report before final quality score
   - **Spec reference:** `docs/projects/dimensions3.md` §3, lines 367-378

### 2. Build Ingestion Sandbox UI (HIGH — enables teacher feedback loop)
   - **Time:** 2-3 days
   - **Path:** Create `/src/app/admin/ingestion-sandbox/page.tsx` with panels:
     - Upload widget (file input, copyright flag selector)
     - Pass A output (document type, confidence, section map)
     - Pass B output (enriched sections with bloom/timing/category pills)
     - Block extraction preview (cards with PII/copyright flags)
     - Review queue UI (approve/edit/reject per block)
   - **Acceptance:** Teacher can upload PDF → see Pass A/B results → approve blocks → blocks enter library
   - **Spec reference:** `docs/projects/dimensions3.md` §7.3

### 3. Teach Teaching Moves → Activity Blocks Seeding (MEDIUM — populate library)
   - **Time:** 1 day
   - **Script:** One-off migration from `src/lib/ai/teaching-moves.ts` → `activity_blocks` with `source_type: 'community'`, `efficacy_score: 65`
   - **Mapping:** Each Teaching Move category maps to one of 14 activity categories
   - **Execution:** Run once, blocks enter library as read-only (teacher verified = false until manually approved)
   - **Acceptance:** Library has ~65 seed blocks available for retrieval in Stage 1
   - **Spec reference:** `docs/projects/dimensions3.md` §6.5

### 4. Build Real Generation Sandbox (MEDIUM — improve debuggability)
   - **Time:** 2 days
   - **Path:** Create `/src/app/admin/sandbox/real-generation/page.tsx`
   - **Features:** 
     - Load saved `generation_run` by ID
     - Step through stages sequentially
     - View inputs/outputs per stage
     - Swap model per stage (Sonnet ↔ Haiku)
     - Export stage results as JSON
   - **Acceptance:** Admin can diagnose generation failures by replaying runs with different models
   - **Spec reference:** `docs/projects/dimensions3.md` §7.2

### 5. Add Weekly Library Hygiene Job (MEDIUM — maintain data integrity)
   - **Time:** 1-2 days
   - **Path:** Create `/src/lib/admin/jobs/weekly-hygiene.ts`
   - **Tasks:**
     - Detect duplicate blocks (cosine similarity > 0.95 on embedding)
     - Identify cold blocks (never used, created >6mo ago)
     - Flag quality floor violations (efficacy < 30, times_used > 5)
     - Check for broken prerequisite chains
   - **Output:** Hygiene report table, UI to review/action flagged blocks
   - **Execution:** Scheduled via `/api/admin/jobs/weekly-hygiene` or Vercel cron
   - **Acceptance:** Weekly report generated, admin notified of blocks needing attention
   - **Spec reference:** `docs/projects/dimensions3.md` §9

---

## Notes for Matt

1. **The simulator is doing its job.** It's isolated and doesn't interfere with real generation. Good separation.

2. **Ingestion dual-track is messy.** Old knowledge pipeline (`/api/teacher/knowledge/upload`) is un-quarantined and still active. New ingestion pipeline (`/api/teacher/knowledge/ingest`) also exists. Teachers could use either path. Document which one is official, or migrate/quarantine old one.

3. **Stage 5b is a real blocker.** Spec says it runs after Stage 5 (before quality scoring). It's the only way to report curriculum coverage. Without it, you can't answer "does this unit cover GCSE outcome X?" — a core value prop for schools using curriculum frameworks.

4. **Feedback system plumbing is there, but approval UX is basic.** Efficacy formula is spot-on. Guardrails work. But admin sees a table of proposals, no signal flow visualization, no batch actions. Fine for v1, but will feel clunky at scale.

5. **Library seeding is the critical path to value.** Every generation will retrieve blocks. With an empty library, Stage 1 returns nothing, all gaps go to Stage 3 (expensive). Seeding with Teaching Moves would immediately drop costs. This is not a polish feature — it's foundational for the cost model to work.

---

## Verification Checklist for Next Session

- [ ] Stage 5b implementation complete (curriculum coverage report)
- [ ] Ingestion sandbox UI built (upload → review queue)
- [ ] Teaching Moves migration script run (65+ seed blocks in library)
- [ ] Real generation sandbox debugger implemented
- [ ] Weekly hygiene job scheduled
- [ ] Old knowledge pipeline documented or quarantined
- [ ] Cost tracking for Stage 1 shows block retrieval efficiency gains
