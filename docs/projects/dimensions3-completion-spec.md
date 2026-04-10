# Dimensions3 Completion Build Spec

**Created:** 10 April 2026 — v2 (execution discipline + cross-check)
**Status:** Build-ready — execution plan to take Dimensions3 from ~67% built to 100% working
**Source:** `docs/projects/dimensions3.md` (master spec, v1.4), `docs/projects/dimensions3-audit.md` (92-item coverage audit), `/tmp/dimensions3-verification.md` (code-level verification)
**Goal:** A fully working Dimensions3 system with the old knowledge/generation pipelines cleanly disconnected. Matt curates the library; no teacher-facing confusion between old and new.

---

## 0. Execution Discipline (Read before every phase — mandatory)

Code must re-read this section at the start of every phase. The last execution failed because phases were marked "done" based on test counts rather than spec coverage.

### 0.1 Hard rules (violation = phase rejected)

1. **No `TODO` comments in committed code.** If it's not done, it's not committed.
2. **No stub implementations without a `@stub` JSDoc and an issue link.** Stubs must be tracked.
3. **No `any` type casts.** If a type is unknown, define it or use `unknown` + narrowing.
4. **No `.skip` or `.only` on tests.** All tests must run.
5. **No disabled ESLint/TypeScript rules** except for a single-line comment with justification.
6. **One sub-task = one commit.** Big batched commits hide skipped work.
7. **Every commit must pass `pnpm lint && pnpm typecheck && pnpm test` locally** before push. No exceptions.
8. **No phase is marked complete until its 🛑 Matt checkpoint passes.** Code running its own tests is not enough.
9. **Re-read the relevant master spec section before starting each sub-task.** Not summaries — the actual spec.
10. **Work on `main` branch, not worktrees.** Previous session lost work to worktree confusion. Use feature branches only for multi-day phases, merge to main daily.

### 0.2 Anti-shortcut watchwords

If Code is tempted to write any of these, STOP and ask Matt:

- "We can add this later" → No. Add it now or spec it as a separate ticket.
- "The test covers the happy path" → Add the error path.
- "This is close enough" → It isn't. Exact spec compliance or document deviation.
- "I'll simulate this for now" → Simulators belong in `/admin/simulator` only, not the real pipeline.
- "The types can be loose" → No.

### 0.3 🛑 Matt checkpoints — what they mean

Every phase has numbered 🛑 checkpoints. At each checkpoint:

1. Code pauses and writes a status message: `"🛑 Checkpoint N.M ready for Matt. To verify: [exact steps]. Expected: [exact result]."`
2. Matt performs the steps manually (clicks UI, uploads file, runs curl, etc.).
3. Matt replies: `checkpoint pass` or `checkpoint fail: [reason]`.
4. Code does NOT proceed until `checkpoint pass` is received.
5. Screenshots or terminal output are attached to the checkpoint as evidence, saved to `docs/projects/dimensions3-checkpoint-evidence/phaseN-checkpointM.md`.

Checkpoints exist because automated tests lie. Matt running through the flow himself is the only real verification.

### 0.4 Phase rollback protocol

If a phase's final checkpoint fails:

1. Code does NOT attempt to "fix forward" by stacking more changes.
2. Code runs `git log --oneline` to identify the phase's commits.
3. Code asks Matt: "Phase N failed at checkpoint M. Options: (a) revert all phase commits to restore last known good state, (b) isolate the failure to sub-task X and re-do just that, (c) accept partial + document gap. Which?"
4. Matt chooses. Code executes. No silent recovery attempts.

### 0.5 Cross-session memory

Each phase completion must:
- Append an entry to `docs/changelog.md` with phase number, date, commits, acceptance outcomes.
- Update `docs/projects/dimensions3.md` status line at top of doc.
- Run `saveme` if 3+ files changed (per CLAUDE.md rule).

If a session is interrupted mid-phase, the next session reads the changelog + this spec + the relevant master spec section BEFORE writing any code.

---

## 0. Context

The audit found the Dimensions3 execution matches the spec at a surface level (routes exist, tables exist, tests pass) but has critical gaps:

1. **The "Pipeline Sandbox" is the §7.6 Simulator, not the real §7.2 Generation Sandbox or §7.3 Ingestion Sandbox.** These three were conflated during build.
2. **Only 1 of 3 sandboxes built.** §7.2 (live step-through debugger), §7.3 (ingestion sandbox), §7.5 (FrameworkAdapter test panel), §7.7 (Block Interaction viz), §7.9 (per-format tabs) all missing.
3. **FrameworkAdapter + render-time criterion mapping missing.** Per §14.1 the pipeline MUST produce neutral content and FrameworkAdapter maps at render time. `mapCriterion()` is not implemented, Stage 4 may bake framework vocabulary into content.
4. **Block Library seeding contradicts the master spec.** §6.5 says "start empty, Matt curates." A `block-library-bootstrap-strategy.md` doc proposed selective backfill — ignore it; the master spec wins.
5. **The old knowledge pipeline is still active.** `analyse.ts` + `knowledge_chunks` + `/api/teacher/knowledge/upload` coexist with the new Dimensions3 ingestion pipeline. Dual-state risk.
6. **Teaching Moves are not seeded into the library.** 56 moves hardcoded in `src/lib/ai/teaching-moves.ts`, never converted to `activity_blocks` rows.
7. **Content Safety & Moderation (§17) entirely missing** — `moderation_status`, `moderation_flags`, `content_moderation_log` table, Layer 1/2 scanning. Spec is explicit this must be enforced from day 1.
8. **Library health, hygiene jobs, pipeline health monitor, write-ahead versioning, cascade deletes** — all missing.
9. **Admin section scoped to 12 tabs in §14.7 — only 5 exist** (library, feedback, pipeline, controls stub, settings stub). Missing: Cost & Usage (per-teacher profitability), Quality, Wiring, Teachers, Students, Schools, Bug Reports, Audit Log.
10. **Bug reporting system missing entirely** (§14.7) — no floating button, no `bug_reports` table, no per-class toggle.
11. **7 operational automation systems (§9.3) missing** — only pipeline health monitor partially exists.
12. **Loominary OS migration seams (§19)** — `content_items` + `content_assets` exist (migration 063); `module` column on blocks + stateless pass enforcement unverified.
13. **Duplicate files** in `src/lib/ingestion/passes/` shadow the real files at `src/lib/ingestion/`.

This spec organises the remaining work into 8 phases. Phase 0 is mandatory first — it gets the old system out of the way. Phases 1–7 can then proceed in order with minimal backtracking.

### Important correction from v1 of this spec

v1 listed "Stage 5b Curriculum Outcome Matching" as a missing pipeline stage. This was wrong. Re-reading master spec §14.1 and §3: **the pipeline has 7 stages (0 through 6), not 8. Curriculum matching happens at render time via FrameworkAdapter, not inside the pipeline.** Stage 4 (Polish) is required to produce neutral text only — no framework-specific criterion labels. Stage 5 (Timing) can attach neutral criterion tags to activities if they're missing. The FrameworkAdapter then maps neutral tags to framework labels at render time in the student UI and grading UI. This spec v2 treats the real gap as "FrameworkAdapter not wired" rather than "missing pipeline stage."

---

## 1. Guiding Rules for Execution

- **Delete, don't comment out.** If code is superseded, remove it. Comments rot.
- **Quarantine before delete** for anything with uncertain reach. A quarantined route returns 410 Gone and logs; after 2 weeks with no incident, delete.
- **One migration per phase, at most.** Numbered 065+. Squash any in-phase changes into one file before merging.
- **Each phase has an acceptance test.** No phase is "done" until its test passes in the real environment (not just unit tests).
- **No new hardcoded sequences.** Every new default gets a `source_type: 'starter'` marker so the feedback loop can replace it.
- **Matt curates the library manually.** No automatic backfill scripts. No bulk import from legacy units.

---

## 2. Phase 0 — Cleanup & Disconnection

**Goal:** Remove the old pipeline's surface area and the naming confusion, so the new pipeline has no ambiguous neighbours. Verify the OS seams (§19) are in place.

**Estimated effort:** 0.5 day.

**Spec sections to re-read:** §6.5 (library seeding), §19 (OS seams), CLAUDE.md §"known issues".

### 2.1 Delete duplicate ingestion files

Verified by agent: `src/lib/ingestion/passes/pass-a-classify.ts` and `pass-b-enrich.ts` are byte-identical copies of `src/lib/ingestion/pass-a.ts` and `pass-b.ts`. Nothing imports from `passes/`.

**Per-sub-task verification:**
- Before delete: run `rg -l "ingestion/passes"` → record output (expect zero already).
- After delete: run `rg -l "ingestion/passes"` → must be zero.
- After delete: run `pnpm typecheck` → must pass.

**Action:**
- Delete `src/lib/ingestion/passes/` directory entirely.

### 2.2 Quarantine the old knowledge/upload route

`src/app/api/teacher/knowledge/upload/route.ts` currently calls `analyse.ts` (old 3-pass analysis) and writes to `knowledge_chunks` + `lesson_profiles`. This is the old pipeline. It was un-quarantined 9 April 2026 prematurely.

**Action:**
- Replace route body with `return QUARANTINE_RESPONSE;` from `@/lib/quarantine` (grep for existing pattern first — do not invent a new constant).
- Add header comment: `// Quarantined 10 Apr 2026. Old knowledge pipeline. Use /api/teacher/knowledge/ingest (Dimensions3). Delete after 14 days if no incidents.`
- Do NOT delete `src/lib/knowledge/analyse.ts` yet — flagged for Phase 7 cleanup.

**Per-sub-task verification:**
- `curl -X POST http://localhost:3000/api/teacher/knowledge/upload` returns HTTP 410.
- Grep for callers of this route in frontend code — any UI button that hits it should be hidden OR show a "migrated to new ingestion" banner.

### 2.3 Rename `/admin/sandbox` → `/admin/simulator`

The current page is the §7.6 Pipeline Simulator. Calling it "sandbox" hides the fact that the real §7.2 Generation Sandbox and §7.3 Ingestion Sandbox don't exist yet.

**Action:**
- Rename route directory: `src/app/admin/sandbox/` → `src/app/admin/simulator/`.
- Update `page.tsx` heading: "Pipeline Sandbox" → "Pipeline Simulator (offline)".
- Update subtitle: *"Offline fixture-based simulator. Validates pipeline wiring. Zero AI calls. For live generation debugging, use Generation Sandbox (built in Phase 7)."*
- Add a yellow banner at top: *"This simulator uses hardcoded fixture data. It does not generate real units."*
- Update every nav link across repo: `rg -l "/admin/sandbox"` → edit each.
- Add a redirect: `/admin/sandbox` → 301 → `/admin/simulator` (Next.js `next.config.js` redirects) so bookmarks still work.

**Per-sub-task verification:**
- Visit `/admin/simulator` → page loads with new heading and banner.
- Visit `/admin/sandbox` → 301 redirects to `/admin/simulator`.
- `rg "/admin/sandbox"` returns only the redirect config entry.

### 2.4 Disconnect legacy schema writes from live routes

Audit confirmed only `knowledge/upload` still writes to `knowledge_chunks` / `lesson_profiles`. Once 2.2 quarantines that route, these tables become read-only from the app.

**Action:**
- Run `rg 'from\("knowledge_chunks"\)|from\("lesson_profiles"\)' src/` → list all callers.
- For each caller: if it's a write, quarantine or delete. If it's a read-only historical query, keep and add comment `// Historical read — legacy pipeline, do not reintroduce writes.`.
- Do NOT drop the tables — historical data may still be useful.

### 2.5 Verify OS migration seams (§19)

Spec §19 requires 4 seams. Audit confirmed `content_items` + `content_assets` exist (migration 063). Verify the remaining two:

**Seam 1 — Stateless pass functions.** Open `src/lib/ingestion/pass-a.ts` and `pass-b.ts`. Confirm:
- Function signature is `(input, config) => Promise<output>` with `config` carrying `supabaseClient`.
- No `createClient()` calls inside the function body.
- No `req` or `NextRequest` parameter.

If violated, refactor. This is a hard requirement — future OS extraction depends on it.

**Seam 2 — `module` column on activity_blocks.** Check migration 060 or a later one added `module TEXT DEFAULT 'studioloom'`. If missing, add migration 065:

```sql
ALTER TABLE activity_blocks ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'studioloom';
CREATE INDEX IF NOT EXISTS idx_blocks_module ON activity_blocks(module);
```

**Seam 3 — content_items table.** Already exists per migration 063. Verify schema matches §19.2 (has `module`, `pass_results`, `file_hash`, `processing_status`). File any gaps as a patch migration.

**Seam 4 — content_assets table.** Already exists per migration 063. Verify `activity_blocks` has `media_asset_ids UUID[]` column. If missing, add to migration 065.

### 2.6 🛑 Matt Checkpoint 0.1 — Cleanup verified

**Code pauses. Writes:**

> 🛑 Checkpoint 0.1 ready. To verify:
> 1. Visit `/admin/simulator` in browser — confirm heading says "Pipeline Simulator (offline)" with yellow fixture-data banner.
> 2. Visit `/admin/sandbox` — confirm redirects to simulator.
> 3. In Supabase SQL editor, run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'activity_blocks' AND column_name IN ('module', 'media_asset_ids');` — confirm both rows returned.
> 4. Paste screenshot of `/admin/simulator` page into evidence file.
>
> Expected: all 4 pass. Reply `checkpoint pass` or `checkpoint fail: [reason]`.

### 2.9 `student_progress.class_id` migration [NEW — Matt decision 2026-04-10]

The master spec audit flagged `student_progress` missing `class_id` as an architecture gap (multi-class enrollment ambiguity). Matt decided to fix this in Phase 0, before anything downstream assumes the old schema.

**Migration:** `supabase/migrations/065_student_progress_class_id.sql`

```sql
-- Add class_id to student_progress
ALTER TABLE student_progress
  ADD COLUMN class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX idx_student_progress_class ON student_progress(class_id, student_id);

-- Backfill: for each existing row, infer class_id via student → class_students
-- where the student is enrolled in only one class. Rows with ambiguous
-- multi-class enrollment are left NULL and flagged for Matt to resolve manually.
UPDATE student_progress sp
SET class_id = cs.class_id
FROM class_students cs
WHERE sp.student_id = cs.student_id
  AND (
    SELECT COUNT(*) FROM class_students cs2
    WHERE cs2.student_id = sp.student_id
  ) = 1;

-- Count ambiguous rows
SELECT COUNT(*) AS ambiguous_rows
FROM student_progress
WHERE class_id IS NULL
  AND student_id IN (
    SELECT student_id FROM class_students
    GROUP BY student_id HAVING COUNT(*) > 1
  );
```

**Write path updates:**
- Every endpoint that writes to `student_progress` must now include `class_id` (derived from the active class session). Grep for `INSERT INTO student_progress` and `.from('student_progress').insert` — update each site.
- Endpoints to update: `/api/student/progress/*`, `/api/student/tool-session`, lesson save handlers, any server action that creates progress rows.

**Ambiguity report:** If the migration leaves > 0 rows with NULL class_id, Phase 0 does NOT complete. Matt must resolve them manually via SQL before Checkpoint 0.1.

### 2.10 Verify `generation_runs.is_sandbox` flag [NEW — Matt decision 2026-04-10]

Phase 7 §9.1 assumes this column exists so sandbox runs don't pollute live analytics. Check first:

```bash
psql -c "\d generation_runs" | grep -i sandbox
```

If missing, add to migration 065 (or a new 066):

```sql
ALTER TABLE generation_runs
  ADD COLUMN is_sandbox BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_generation_runs_sandbox ON generation_runs(is_sandbox, created_at DESC);
```

Update Phase 4 dashboard queries to filter `WHERE is_sandbox = false` on all live metrics.

### 2.7 Phase 0 acceptance

- [ ] `rg "ingestion/passes"` returns 0
- [ ] `rg "/admin/sandbox"` returns only the redirect entry
- [ ] `curl -X POST /api/teacher/knowledge/upload` returns 410
- [ ] `activity_blocks.module` and `activity_blocks.media_asset_ids` columns exist
- [ ] `pass-a.ts` and `pass-b.ts` are stateless (no `createClient()` inside)
- [ ] `student_progress.class_id` column exists, 0 ambiguous NULL rows remain after backfill
- [ ] All `student_progress` INSERT sites include `class_id`
- [ ] `generation_runs.is_sandbox` column verified or added
- [ ] Checkpoint 0.1 passed
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all pass
- [ ] Changelog entry written

### 2.8 Phase 0 rollback

If checkpoint 0.1 fails:
- `git revert` all Phase 0 commits back to last `main` state.
- Re-attempt only the failing sub-task.
- Do not proceed to Phase 1 until cleanup is verifiably complete.

---

## 3. Phase 1 — Ingestion Curation Workflow

**Goal:** Matt can upload curated source material and see it turn into Activity Blocks, via a working Ingestion Sandbox. Teaching Moves get seeded as the library's opening stock.

**Estimated effort:** 3–4 days (increased from v1's 2–3 to cover Matt checkpoints and moderation scan).

**Spec sections to re-read:** §4 (ingestion pipeline), §6.2 (block schema), §6.5 (library seeding), §7.3 (ingestion sandbox), §17.6 Phase A+B items (moderation in ingestion), Appendix A (Teaching Moves review list).

**Prerequisite:** Phase 0 complete. `SYSTEM_TEACHER_ID` env var set.

### 3.1 Teaching Moves seed script

**File:** `scripts/seed-teaching-moves.mjs`

**Detailed behaviour (pseudocode):**

```
1. Load existing rewrites from scripts/seed-data/teaching-moves-rewritten.json (if exists)
2. Import MOVES array from src/lib/ai/teaching-moves.ts (use tsx loader, not parse)
3. For each move:
   a. Check DB: SELECT id FROM activity_blocks WHERE source_type='community' AND title=move.name AND module='studioloom'
   b. If exists AND --force not passed → skip (log "skipped")
   c. If rewrite cached → use cached student-facing prompt
   d. Else → call Sonnet with system prompt from scripts/seed-data/rewrite-prompt.md
      → validate output: non-empty, 2nd person, no "teacher" / "students will", < 400 chars
      → cache to rewrites JSON
   e. Map move fields to block fields (see table below)
   f. Call Voyage AI embed on (title + prompt + example)
   g. Insert into activity_blocks (single-row insert, not batch — easier to debug failures)
   h. Log success with block ID
4. Print summary: N inserted, N skipped, N failed
5. Exit code 0 if all succeed, 1 if any failed
```

**Field mapping table (move → block):**

| Move field | Block field | Transform |
|---|---|---|
| `move.name` | `title` | Direct |
| rewritten prompt | `prompt` | AI pass (3.2) |
| `move.description + "\n\nExample: " + move.example` | `description` | Concat |
| — | `source_type` | literal `'community'` |
| `SYSTEM_TEACHER_ID` env | `teacher_id` | — |
| — | `is_public` | `true` |
| — | `efficacy_score` | `65` |
| — | `times_used` | `0` |
| `move.bloomLevels[0]` | `bloom_level` | Direct |
| `move.grouping` | `grouping` | Direct |
| `move.durationRange` | `time_weight` | `max ≤ 10 → 'quick'`, `max ≤ 20 → 'moderate'`, else `'extended'` |
| `move.durationRange.max` | `typical_duration_minutes` | Direct |
| `move.category` | `activity_category` | Must be one of 14 from §6.3 |
| `move.phases[0]` | `phase` | Format-neutral phase ID |
| `["teaching-move", "seed", ...move.boosts, "energy:" + move.energy]` | `tags` | Array |
| Parsed from `move.prep` | `materials_needed` | Split by comma, trim |
| `move.unitTypes` | `unit_type_tags` | Array |
| — | `module` | literal `'studioloom'` (Seam 2) |
| — | `moderation_status` | literal `'clean'` (seeds pre-vetted) |

**Error handling:**
- On Sonnet failure → log + skip move, continue others, exit 1 at end.
- On Voyage failure → retry 3x with exponential backoff, then skip + exit 1.
- On DB insert failure → log full error + skipped move ID.
- Dry-run flag `--dry-run` prints what would be inserted without writing.

**Idempotency tests:**
- Run twice → second run logs "skipped: already exists" for all 56.
- Run with `--force` → updates existing rows (does not duplicate).

### 3.2 Rewrite-prompt template

**File:** `scripts/seed-data/rewrite-prompt.md`

Contains the exact Sonnet system prompt Matt reviews and edits before running the seed script. Do not inline in the script. Template:

```
You are converting a teacher-facing "teaching move" into a student-facing activity prompt.

RULES:
- Write in second person ("You will...", "Choose a...")
- No meta commentary ("In this activity, students...")
- No framework labels (no "Criterion B", no "AO2")
- Action verbs first
- 60–300 words
- Preserve the pedagogical intent

INPUT:
Name: {name}
Description: {description}
Example: {example}

OUTPUT:
Just the student-facing prompt. No preamble, no explanation.
```

### 3.3 🛑 Matt Checkpoint 1.1 — Seed rewrites reviewed

**Code pauses after running seed with `--dry-run --rewrite-only`** which produces `scripts/seed-data/teaching-moves-rewritten.json` with all 56 AI rewrites but does NOT insert to DB.

> 🛑 Checkpoint 1.1 ready. Review `scripts/seed-data/teaching-moves-rewritten.json`. Spot-check 10 at random. Each should be student-facing, neutral vocabulary, actionable. Edit any that feel off. Reply `checkpoint pass` when satisfied OR `checkpoint fail: edit [IDs]` with guidance.

Only after pass → Code runs the full seed script (without `--dry-run`).

### 3.4 Ingestion Sandbox UI — `/admin/ingestion-sandbox`

**Route:** `src/app/admin/ingestion-sandbox/page.tsx`

**Per §7.3 of master spec.**

**Component tree:**

```
<IngestionSandboxPage>
  <PageHeader title="Ingestion Sandbox" subtitle="Upload → Classify → Enrich → Extract → Approve" />
  <UploadDropZone onUpload={handleFile} accept=".pdf,.docx,.pptx,.txt,.md,image/*" />
  <RunControlBar>
    <Button>Run Full Pipeline</Button>
    <Button>Step</Button>
    <Button>Reset</Button>
    <CostMeter totalCost={state.totalCost} />
  </RunControlBar>
  <PipelinePanels>
    <StagePanel id="dedup" title="Dedup" state={state.dedup} />
    <StagePanel id="parse" title="Parse" state={state.parse} />
    <StagePanel id="passA" title="Pass A — Classify" state={state.passA} cost={state.passA.cost} model={state.passA.model} />
    <StagePanel id="passB" title="Pass B — Enrich" state={state.passB} cost={state.passB.cost} model={state.passB.model} />
    <StagePanel id="extract" title="Extract Blocks" state={state.extract} />
  </PipelinePanels>
  <ReviewQueue candidates={state.candidates} onAccept={} onReject={} onEdit={} />
  <CommitBar acceptedCount={} onCommit={} />
</IngestionSandboxPage>
```

**StagePanel** (shared component) renders:
- Status dot (idle/running/success/warning/error)
- Input JSON (collapsible)
- Output JSON (collapsible)
- Duration ms + cost $
- Model used (dropdown to override for next run)
- "Rerun this stage" button (requires prior stage output still in memory)

**State shape (React useState):**

```ts
interface SandboxState {
  uploadedFile: File | null;
  contentItemId: string | null;  // created by Parse stage
  dedup: StageState;
  parse: StageState;
  passA: StageState;
  passB: StageState;
  extract: StageState;
  candidates: BlockCandidate[];
  totalCost: number;
  error: string | null;
}

interface StageState {
  status: 'idle' | 'running' | 'success' | 'warning' | 'error';
  input: unknown;
  output: unknown;
  durationMs: number;
  cost: number;
  model?: string;
  warnings: string[];
}
```

**Backend routes:**

1. `POST /api/admin/ingestion-sandbox/upload` — accepts file, stores to Supabase Storage, creates `content_items` row, returns `contentItemId`.
2. `POST /api/admin/ingestion-sandbox/run-stage` — body `{ contentItemId, stage, previousOutput? }`. Runs one stage, returns `StageState`. Calls `runIngestionPass(stageId, input, { supabaseClient, dryRun: true })`.
3. `POST /api/admin/ingestion-sandbox/commit` — body `{ contentItemId, acceptedCandidates: BlockCandidate[] }`. Writes approved blocks to `activity_blocks` with embeddings, marks `content_items.processing_status = 'completed'`.

### 3.5 Ingestion pipeline hardening

Before the sandbox can be trusted, verify `src/lib/ingestion/pipeline.ts` handles everything §4 requires:

**Checklist (one commit per fix if gap found):**

- [ ] **Dedup** — `file_hash` SHA-256 check against `content_items`; cosine 0.92 check against existing blocks.
- [ ] **Parse** — handles PDF (pdfjs-dist), DOCX (mammoth), PPTX (parse XML), plain text. Extracts images to `content_assets` (Seam 4).
- [ ] **Pass A classify** — tags `content_type`, `subject`, `strand`, `level`. Confidence score per tag.
- [ ] **Pass B enrich** — extracts candidate blocks with full schema coverage. Calls moderation scan (§17.6 Phase B).
- [ ] **PII scan** — regex for emails, phone numbers, common name patterns. Flags to `pii_flags` on `content_items`.
- [ ] **Copyright flag** — heuristic: verbatim chunks > 200 chars matching known corpora (or high-perplexity exact phrases). Sets `is_copyright_flagged` on `content_items`.
- [ ] **Moderation scan (§17.6)** — runs Haiku moderation on extracted text; populates `moderation_status` on candidate blocks. Blocks with status `flagged` or `blocked` go to a separate review queue, not auto-approved.
- [ ] **dryRun mode** — pipeline returns candidates without writing `activity_blocks`. Uses a flag on the orchestrator function.
- [ ] **Cost tracking** — every pass returns `CostBreakdown` (spec §PB-3). Orchestrator sums.
- [ ] **Idempotency** — same input twice → same block IDs via deterministic hash, not new rows.

Each gap is its own commit. Each commit is green before the next starts.

### 3.6 Disconnect old knowledge pipeline from UI

Grep frontend for buttons/links that hit the old `/api/teacher/knowledge/upload`. Replace with links to `/admin/ingestion-sandbox` or hide entirely depending on whether teachers currently use them (they don't — Matt is the only user).

### 3.7 🛑 Matt Checkpoint 1.2 — End-to-end ingestion

**Code pauses:**

> 🛑 Checkpoint 1.2 ready. Manual test:
> 1. Go to `/admin/ingestion-sandbox`.
> 2. Upload a real teaching resource PDF from `docs/lesson plans/` (pick one you know well).
> 3. Click "Run Full Pipeline".
> 4. Inspect each stage panel — confirm Dedup/Parse/Pass A/Pass B/Extract all show output.
> 5. In the Review Queue, mark 3 candidates Accept, 1 Reject, 1 Edit (change title).
> 6. Click Commit.
> 7. Visit `/admin/library` — confirm 4 new blocks (3 accepted + 1 edited) appear with source `curated`.
> 8. Re-upload the same file — Dedup stage must flag it as duplicate and skip subsequent stages.
> 9. Screenshot each stage panel to evidence file.
>
> Expected: all 9 pass. Reply `checkpoint pass` or `checkpoint fail: [reason]`.

### 3.8 Phase 1 acceptance

- [ ] `scripts/seed-teaching-moves.mjs` inserts 56 blocks; second run inserts 0
- [ ] `/admin/ingestion-sandbox` functional end-to-end
- [ ] All §4 gaps closed (dedup, parse, pass A, pass B, PII, copyright, moderation, dryRun, cost, idempotency)
- [ ] Old knowledge upload UI buttons hidden/redirected
- [ ] Checkpoint 1.1 + 1.2 passed
- [ ] `pnpm lint && typecheck && test` all pass
- [ ] Changelog entry + `saveme` run

### 3.9 Phase 1 rollback

If checkpoint 1.2 fails after multiple attempts:
- `git revert` Phase 1 commits.
- Restore previous state of `/admin/library` (should be empty — Phase 0 doesn't touch it).
- File specific gaps as tickets in `docs/projects/ALL-PROJECTS.md`.
- Do not proceed to Phase 2 — generation needs seeded blocks.

### 3.10 Deferred from Phase 1.5

Items intentionally deferred during Phase 1.5 hardening, with the rationale and the file/seam where they will plug in.

#### Image extraction → `content_assets` (Seam 4)

**Status:** Stub only. `src/lib/ingestion/image-extraction.ts` exports `extractImages()` which returns `[]` and is called from the upload route so the wiring exists.

**What's missing:**
- A `content_assets` table (storage path, mime, source content_item, perceptual hash, alt text, OCR text, embedding for visual search).
- Supabase Storage bucket + RLS.
- Per-format extractors:
  - PDF: `pdfjs-dist` `.getOperatorList()` to walk image XObjects.
  - DOCX: `mammoth`'s `convertImage` callback (already streams base64).
  - PPTX: `officeparser` exposes `media/` zip entries.
- Optional OCR pass (Tesseract.js) for slide screenshots.

**Why deferred:** ~1-2 days of work, requires a new migration + storage bucket, and Matt's current curation flow is text-only. Adding it now would block Phase 1.5 close on infrastructure that no current pipeline stage consumes. When Phase 1.6 (or a dedicated content_assets seam phase) lands, the upload route doesn't need editing — only `image-extraction.ts` gets the real implementation.

**Tracking:** Replaces the §4 spec line "Extracts images to `content_assets` (Seam 4)". When picked up, remove this section and check the §4 box.

---

## 4. Phase 2 — Generation Completeness + FrameworkAdapter

**Goal:** The 7-stage pipeline (0–6) runs end-to-end with real AI calls against the seeded library. Every stage consumes its FormatProfile extension point. Stage 4 produces strictly neutral content. FrameworkAdapter maps neutral → framework at render time in student + grading UI. Wizard lanes all work.

**Estimated effort:** 4–5 days (up from v1's 3–4 because FrameworkAdapter render-time wiring + test panel adds scope).

**Spec sections to re-read:** §3 (6-stage pipeline, Stage-by-Stage contracts), §7.5 (FrameworkAdapter test panel), §14.1 (framework-neutral units), §14.9 (FormatProfile extension points).

**Prerequisite:** Phase 1 complete. Library has 56+ blocks with embeddings.

### 4.1 Confirm pipeline stage count — NO Stage 5b

Per master spec §3, the pipeline is 7 stages (0 through 6). There is no Stage 5b. Earlier audit notes calling for "Stage 5b Curriculum Outcome Matching" were incorrect — curriculum mapping is a RENDER-TIME concern handled by FrameworkAdapter, not a pipeline stage.

**Verify:** Open `src/lib/pipeline/orchestrator.ts` and confirm the call sequence is Stage 0 → 1 → 2 → 3 → 4 → 5 → 6. If an incorrect Stage 5b skeleton was added in the previous session, delete it.

### 4.2 Stage 4 (Polish) — neutral content enforcement

Per §14.1, Stage 4 MUST produce framework-neutral text. No criterion letters, no "AO2", no "Criterion B".

**Action:**
- Open `src/lib/pipeline/stages/stage4-polish.ts`.
- Audit the prompt template for any framework vocabulary (grep the prompt for "Criterion", "AO1..AO4", "MYP", "GCSE").
- Add an output validator: after Sonnet returns, regex-scan for forbidden tokens. If present → log warning + auto-rewrite with a second Haiku pass that strips them.
- Add Stage 4 output field `criterion_tags: string[]` per activity — neutral keys from the 8 in §14.1.

**Unit tests:** `src/lib/pipeline/stages/__tests__/stage4-polish.test.ts`
- Test: prompt template contains no framework vocabulary
- Test: output validator rejects "Criterion B" and rewrites it
- Test: every returned activity has at least one `criterion_tags` entry from the 8 neutral keys

### 4.3 FormatProfile wiring per stage

`FormatProfile` is defined in `src/lib/ai/unit-types.ts` with 4 concrete profiles (Design, Service, PP, Inquiry). Not all stages consume it.

**Per-stage wiring (one commit each, with tests):**

- **Stage 1 (Retrieve):** use `formatProfile.blockRelevance.boost` and `.suppress` when scoring block candidates. Boosted categories get +15% relevance, suppressed get -15%. Test: retrieval with Design profile surfaces different top-5 than Service profile on the same request.
- **Stage 2 (Assemble):** use `formatProfile.sequenceHints.defaultPattern`, `.phaseWeights`, `.requiredPhases`. Test: Service assembly always includes a "reflect" phase at end.
- **Stage 3 (Gap-Fill):** inject `formatProfile.gapGenerationRules.aiPersona` + `.teachingPrinciples` into the Sonnet system prompt. Add `forbiddenPatterns` to a post-generation validator. Test: PP generation never includes "teacher-directed workshop demo".
- **Stage 4 (Polish):** use `formatProfile.connectiveTissue.transitionVocabulary` + `.reflectionStyle` + `.audienceLanguage`. Test: Service Polish uses "your community" audience framing, Design uses "your client".
- **Stage 5 (Timing):** use `formatProfile.timingModifiers.defaultWorkTimeFloor` + `.setupBuffer` + `.reflectionMinimum` (partially wired already per audit — complete it). Test: Service units have reflection ≥ 10 min per lesson; PP units have reflection ≥ 15 min.
- **Stage 6 (Scoring):** use `formatProfile.pulseWeights` to weight CR/SA/TC dimensions. Test: same unit scored under Design vs Service weights produces different Pulse scores.

### 4.4 FrameworkAdapter implementation

Framework definitions exist in `src/lib/frameworks/index.ts` but `mapCriterion()` is not implemented.

**File:** `src/lib/frameworks/adapter.ts` (new)

```ts
export interface FrameworkAdapter {
  mapCriterion(neutralKey: string, framework: string):
    { label: string; key: string; color: string } | null;

  getAllCriteria(framework: string):
    Array<{ neutralKeys: string[]; label: string; key: string; color: string }>;

  reverseMap(frameworkKey: string, framework: string): string[];
}

export const frameworkAdapter: FrameworkAdapter = { /* implementation */ };
```

**Supporting mapping tables** (one file per framework, source-of-truth from `docs/specs/neutral-criterion-taxonomy.md`):

- `src/lib/frameworks/mappings/myp.ts`
- `src/lib/frameworks/mappings/gcse-dt.ts`
- `src/lib/frameworks/mappings/alevel-dt.ts`
- `src/lib/frameworks/mappings/igcse-dt.ts`
- `src/lib/frameworks/mappings/acara.ts`
- `src/lib/frameworks/mappings/pltw.ts`
- `src/lib/frameworks/mappings/nesa.ts`
- `src/lib/frameworks/mappings/victorian.ts`

Each exports a `FrameworkMapping` object matching the 8×8 taxonomy table.

**Unit tests:** `src/lib/frameworks/__tests__/adapter.test.ts` — must cover:
- Every neutral key × every framework pair
- Round-trip: neutralKey → framework key → reverseMap → original neutral key
- Null handling: some keys don't map in some frameworks (e.g., `reflecting` → GCSE returns null, that's allowed)
- Multi-key merge: MYP Criterion A resolves from both `researching` and `analysing`

### 4.5 Render-time wiring

**Student lesson page** (`src/components/student/LessonView.tsx` or wherever criteria render):
- Replace any hardcoded "Criterion B" strings with `frameworkAdapter.mapCriterion(activity.criterion_tags[0], classFramework)?.label`.
- If adapter returns null, omit the criterion badge entirely (don't render "null").

**Grading UI** (teacher-facing):
- Use `frameworkAdapter.getAllCriteria(classFramework)` to drive the grading criteria list.

**Unit editor** (teacher-facing preview):
- Same pattern — always render via adapter.

### 4.6 FrameworkAdapter Test Panel (§7.5)

**Route:** `src/app/admin/framework-adapter/page.tsx`

Matt needs this to verify mappings visually. Per §7.5:

**Components:**

1. **Mapping Matrix** — 8×8 grid: rows = neutral keys, columns = frameworks. Each cell shows resolved label; empty cells in red.
2. **Unit Preview Mode** — select a unit from `/admin/library` (or a test fixture), pick a framework → renders the full student lesson page with adapter applied. Dropdown to switch framework and see re-render instantly.
3. **Batch Validation** — one-click test that calls `mapCriterion` for every neutral×framework pair + `getAllCriteria` for every framework. Outputs green/amber/red report, downloadable as CSV.
4. **Round-Trip Test** — same, but round-trip. Flags any mapping that doesn't return to source.
5. **Grading UI Simulation** — renders the grading page with the chosen framework. Validates criteria count, order, colors.

The Vitest tests from 4.4 run as the automated version. This panel is the visual inspector.

### 4.7 Un-hardcode model IDs — full sweep

**Decision (Matt 2026-04-10, confirmed by grep):** the target string is `claude-sonnet-4-6` — same one `src/lib/ai/anthropic.ts` and other newer code already uses. This is a consistency fix, not a model upgrade. All hardcoded `claude-sonnet-4-20250514` references get replaced.

**Action:**
1. Add `GENERATION_MODEL=claude-sonnet-4-6` to `.env.example` with a comment explaining the pipeline uses this value.
2. Replace every hardcoded `"claude-sonnet-4-20250514"` string with `process.env.GENERATION_MODEL ?? "claude-sonnet-4-6"`.

**Files to update (confirmed via grep 2026-04-10):**

| File | Line(s) | Status |
|------|---------|--------|
| `src/app/api/teacher/generate-unit/route.ts` | 60 | **Update** |
| `src/lib/pipeline/stages/stage2-assembly.ts` | 173 | **Update** |
| `src/lib/pipeline/stages/stage3-generation.ts` | 140 | **Update** |
| `src/lib/pipeline/stages/stage4-polish.ts` | 118 | **Update** |
| `src/lib/ingestion/pass-b.ts` | 23 | **Update** |
| `src/lib/ingestion/passes/pass-b-enrich.ts` | 23 | **DELETE in Phase 0 §2.1** — duplicate file |
| `src/lib/knowledge/analyse.ts` | 76, 709 | **DELETE in Phase 7 §9.16** — quarantined |
| `src/app/admin/settings/page.tsx` | 7, 8 | **Update** — display strings should read from env |
| `src/app/api/admin/ai-model/test-lesson/route.ts` | 152 | **Update** |
| `src/app/api/admin/ai-model/test/route.ts` | 119 | **Update** |
| `src/lib/converter/extract-lesson-structure.ts` | 522 | **Update** |
| `src/app/api/teacher/knowledge/quick-modify/route.ts` | 89 | **Update** (or delete if quarantined alongside knowledge/upload) |

3. **Update `src/lib/usage-tracking.ts`** — it only has pricing for `claude-sonnet-4-20250514`. Add a `claude-sonnet-4-6` entry with current Anthropic pricing ($3 input / $15 output per million tokens, same as Sonnet 4). Keep the old entry for historical cost lookups on old `generation_runs` rows.

4. **Grep verification after update:**
   ```bash
   rg "claude-sonnet-4-20250514" src/
   ```
   Should return zero results except for:
   - `src/lib/knowledge/analyse.ts` (quarantined, deleted in Phase 7 §9.16)
   - `src/lib/ingestion/passes/pass-b-enrich.ts` (deleted in Phase 0 §2.1)
   - `src/lib/usage-tracking.ts` (historical pricing entry — intentional)

5. **Do NOT touch** `src/lib/ai/anthropic.ts` or `src/app/teacher/settings/page.tsx` — they already use `claude-sonnet-4-6` correctly.

**Why this matters:** if the generation pipeline and ingestion pipeline use different models than the rest of the app, per-teacher profitability tracking (Phase 7 §9.9) will have inconsistent cost attribution. Fix it once, centrally, env-var driven.

### 4.8 🛑 Matt Checkpoint 2.1 — FrameworkAdapter visible

> 🛑 Checkpoint 2.1 ready. Manual test:
> 1. Visit `/admin/framework-adapter`.
> 2. Confirm the 8×8 Mapping Matrix renders with no red cells for MYP, GCSE, A-Level.
> 3. In Unit Preview Mode, pick any existing unit and switch framework dropdown through MYP → GCSE → A-Level → ACARA. Confirm criterion labels change, content text does not.
> 4. Click "Batch Validation" → download CSV. Confirm no red rows for the 4 tested frameworks.
> 5. Screenshot the matrix to evidence file.
>
> Reply `checkpoint pass` or `checkpoint fail`.

### 4.9 End-to-end smoke test

**File:** `scripts/e2e-generate-unit.mjs`

- Builds a real `GenerationRequest`: Design unit, Year 9, 6 lessons, IB MYP, topic "sustainable packaging"
- POSTs to `/api/teacher/generate-unit`
- Asserts all 7 stages ran (0, 1, 2, 3, 4, 5, 6 — NOT 5b)
- Asserts at least 3 blocks were retrieved from library (seeded Teaching Moves should match broad topics)
- Asserts every activity has `criterion_tags` of length ≥ 1 from the 8 neutral keys
- Asserts Stage 4 output text contains NO forbidden framework tokens ("Criterion A/B/C/D", "AO1..AO4")
- Asserts cost < $2 per generation
- Asserts `generation_runs` row has all 7 stage results populated
- Asserts unit renders in student UI with correct MYP criterion labels

### 4.10 🛑 Matt Checkpoint 2.2 — Real unit generated end-to-end

> 🛑 Checkpoint 2.2 ready. Manual test:
> 1. Go to `/teacher/units/new` and walk through the Express lane wizard for a Design unit.
> 2. Submit → watch generation run (should complete in < 90s).
> 3. Open the generated unit in editor → confirm 6 lessons, each with activities.
> 4. Open lesson 1 in student preview → confirm criterion badges show MYP vocabulary ("Criterion B" etc.) via adapter.
> 5. Switch class to a GCSE class → same lesson → criterion badges now show "AO2" etc.
> 6. Check `/admin/pipeline` → most recent run shows all 7 stages green.
> 7. Total cost < $2.
> 8. Screenshot the generated unit + both framework renders + the pipeline run.
>
> Reply `checkpoint pass` or `checkpoint fail`.

### 4.11 Phase 2 acceptance

- [ ] No Stage 5b in orchestrator or stage folder
- [ ] Stage 4 output contains no framework vocabulary (enforced by validator)
- [ ] All 6 AI-using stages consume their FormatProfile field
- [ ] `mapCriterion("designing", "IB_MYP")` returns valid descriptor; same for 7 other frameworks
- [ ] `/admin/framework-adapter` page functional
- [ ] E2E script passes
- [ ] Checkpoints 2.1 + 2.2 passed
- [ ] Hardcoded model ID removed from all routes
- [ ] `pnpm lint && typecheck && test` green

### 4.12 Phase 2 rollback

If checkpoint 2.2 fails:
- Keep FrameworkAdapter (4.4) + Test Panel (4.6) — they're independent and valuable.
- Revert FormatProfile wiring commits for the specific stage that broke generation.
- File failure mode in `docs/lessons-learned.md`.

---

## 5. Phase 3 — Feedback Loop Completion

**Goal:** The self-healing feedback loop (Stage 6 → feedback_proposals → approval queue → library update) works end-to-end. Matt can review proposed changes and accept/reject them with confidence, and efficacy scores move based on real teacher edits and student signal — not just Matt clicking buttons.

**Estimated effort:** 2–3 days.

**Execution discipline reminders:**
- Do not build the efficacy job on top of mock data. It must read from real `generation_runs`, real teacher edits, and real `student_progress` rows. If those tables are empty, generate a test unit first and seed signal manually.
- The cascade delete is a one-line fix but it's the foundation of everything else — do it first, verify with a real DELETE, then move on.
- Do not silently coerce efficacy values. If a computation would push a block below 30 or above 100, log it, clamp it, and surface in the approval UI with a warning.
- No "auto-accept" anywhere. Every efficacy change goes through the approval queue. No exceptions for "obvious" cases.

### 5.1 Cascade delete fix

**Migration:** `supabase/migrations/065_feedback_cascade_delete.sql`

```sql
ALTER TABLE feedback_proposals
  DROP CONSTRAINT IF EXISTS feedback_proposals_block_id_fkey,
  ADD CONSTRAINT feedback_proposals_block_id_fkey
    FOREIGN KEY (block_id) REFERENCES activity_blocks(id) ON DELETE CASCADE;

-- Same for feedback_audit_log.block_id if applicable
ALTER TABLE feedback_audit_log
  DROP CONSTRAINT IF EXISTS feedback_audit_log_block_id_fkey,
  ADD CONSTRAINT feedback_audit_log_block_id_fkey
    FOREIGN KEY (block_id) REFERENCES activity_blocks(id) ON DELETE CASCADE;
```

### 5.2 Efficacy score update job

**File:** `src/lib/feedback/update-efficacy.ts`

Per master spec §5.2, efficacy is computed from:
```
efficacy = 0.30*kept + 0.25*completion + 0.20*time_accuracy
         + 0.10*(1-deletion) + 0.10*pace + 0.05*(1-edit)
```

**Signal sources (each must be real, none may be mocked):**

| Variable | Source | Default when no data |
|----------|--------|----------------------|
| `kept` | 1 − (count of teacher removals of this block in `feedback_audit_log` / count of times block appeared in generated units) | 0.5 |
| `completion` | avg `student_progress.is_completed` for activities backed by this block | 0.5 |
| `time_accuracy` | 1 − abs(actual_duration − declared_duration) / declared_duration, clamped to [0,1] | 0.5 |
| `deletion` | count of `feedback_audit_log.action='delete'` / total usage | 0 |
| `pace` | avg normalized lesson pace from `lesson_pulse` table if present | 0.5 |
| `edit` | avg edit-distance ratio of teacher rewrites vs original block text | 0 |

**Required behaviours:**
1. Only update blocks that have ≥ 3 usages (below that, efficacy stays at bootstrap value).
2. Write computed score to `feedback_proposals`, NOT directly to `activity_blocks.efficacy_score`.
3. Each proposal includes a `reasoning` JSONB with the six input values so the approval UI can show why.
4. Guardrail: if proposed change is > ±15 points, tag proposal with `requires_matt: true`.

**Trigger:** Nightly cron via `scripts/run-efficacy-update.mjs` (document in `docs/projects/dimensions3-testing-plan.md`). No Vercel cron yet — Matt runs it manually until Phase 4 wires the scheduler.

### 5.3 🛑 Matt Checkpoint 3.1 — Proposal sanity

**STOP. Matt reviews the first batch of real proposals before any are accepted.**

Matt does:
1. Generate 2 test units using real Teaching Moves.
2. As a teacher, delete some activities and reorder others.
3. Run `node scripts/run-efficacy-update.mjs` manually.
4. Open `/admin/feedback` and look at the first 5 proposals.
5. For each, verify the `reasoning` JSONB matches Matt's expectation of why that block scored high/low.

**Fail conditions:**
- Reasoning doesn't explain the proposed delta.
- Proposals exist for blocks with < 3 usages.
- A proposal writes directly to `activity_blocks` (it should only write to `feedback_proposals`).

If any fail, fix before continuing.

### 5.4 Admin feedback UI enrichment

`src/app/admin/feedback/page.tsx` currently renders `ApprovalQueue`. Per master spec §7.4, it must show:

**Required sub-components:**
- `<FeedbackDiff>` — before/after block JSON, side-by-side, with changed fields highlighted.
- `<ProposalReasoning>` — reads the `reasoning` JSONB from §5.2 and renders human-readable explanation ("Kept in 2/8 units — teachers removed it for being too long").
- `<GuardrailWarning>` — if `requires_matt` is true, red banner; if efficacy would cross 30 or 70 (tier boundary), amber banner.
- `<BatchActions>` — select multiple proposals, accept/reject as batch. Batch reject requires a reason.
- `<AuditLogTab>` — shows every accept/reject decision with who, when, why.

**Behaviour:**
- Accepting a proposal: writes to `activity_blocks.efficacy_score`, writes to `feedback_audit_log` with `action='accept'`, marks proposal `status='accepted'`.
- Rejecting a proposal: writes reason, does not touch `activity_blocks`, marks proposal `status='rejected'`.
- Rejected proposals are NOT regenerated for 7 days (prevents nag loop).

### 5.5 Edit tracker wiring

When a teacher edits a lesson in the unit editor, the edit must be logged with enough detail for §5.2's `edit` and `deletion` signals to work.

**File:** `src/lib/feedback/edit-tracker.ts`

**Hook points:**
- Unit editor save handler (`src/app/teacher/units/[id]/edit/page.tsx`) — diff old vs new content_data, write edit events.
- Lesson editor drag/drop handlers — writes reorder events.
- Any delete-activity action — writes `action='delete'` with `block_id`.

**Schema:** uses existing `feedback_audit_log` table. No new migration.

### 5.6 🛑 Matt Checkpoint 3.2 — Full feedback cycle

**STOP. Matt completes a full feedback cycle before Phase 3 is accepted.**

Matt does:
1. Generates a unit. Note block IDs used.
2. Deletes an activity in the unit editor.
3. Runs efficacy update.
4. Opens `/admin/feedback`, finds the proposal, reads the reasoning, accepts it.
5. Verifies `activity_blocks.efficacy_score` for that block decreased.
6. Verifies `feedback_audit_log` has both the delete event and the accept event.

**Fail conditions:**
- Any step requires manual SQL.
- The reasoning JSON doesn't reference the delete event.
- Accepting doesn't update the block.

### 5.7 Phase 3 acceptance

- [ ] 5.1 Cascade delete fix applied + verified with real DELETE.
- [ ] 5.2 Efficacy job reads real signal, writes to `feedback_proposals` only.
- [ ] 5.3 Matt Checkpoint 3.1 passed.
- [ ] 5.4 Admin UI has all 5 required sub-components.
- [ ] 5.5 Edit tracker logs delete/edit/reorder events.
- [ ] 5.6 Matt Checkpoint 3.2 passed.
- [ ] No efficacy write bypasses the approval queue (grep for direct `activity_blocks.efficacy_score` writes — only the accept handler should touch it).

### 5.8 Phase 3 rollback

If Matt rejects Phase 3:
- Revert migration 065 (cascade) only if it caused data loss (unlikely).
- The efficacy job is additive — disabling it is safe, just stop running the script.
- UI enrichments are purely additive; leave them in place even on rollback so partial work isn't lost.

---

## 6. Phase 4 — Library Health & Operational Automation

**Goal:** The block library doesn't rot. Seven operational automation systems (per master spec §9.3) monitor and self-correct the pipeline. Matt has a live dashboard showing everything at a glance and never has to trust that "things are probably fine".

**Estimated effort:** 3 days (up from 2 — previously missed §9.3).

**Execution discipline reminders:**
- Every widget needs a real SQL query behind it. No hardcoded "demo" data, even temporarily.
- Every automation system must either run on cron OR be manually runnable via a script in `scripts/` — never "runs on first load".
- Cost alerts must fire against real thresholds, not test ones. Set the env vars BEFORE wiring the alert logic so you don't have to refactor later.

### 6.1 Library health dashboard

**Route:** `src/app/admin/library/health/page.tsx`

Per master spec §9. Each widget below is a named SQL query on `activity_blocks` / `generation_runs` / `feedback_audit_log`. All queries live in `src/lib/admin/library-health-queries.ts` (exported, unit-tested, each returns typed rows).

**Widgets + queries:**

| Widget | Query sketch | Shows |
|--------|--------------|-------|
| Blocks by source_type | `SELECT source_type, COUNT(*) FROM activity_blocks GROUP BY source_type` | Stacked bar (community/curated/extracted/teaching_move) |
| Category distribution | `SELECT activity_category, COUNT(*) FROM activity_blocks GROUP BY activity_category` | Horizontal bar with coverage gaps highlighted |
| Stale blocks | `SELECT id, title, last_used_at FROM activity_blocks WHERE last_used_at < now() - interval '90 days' ORDER BY last_used_at ASC` | Sorted list with "mark archived" button |
| Duplicate suspects | Cosine similarity join on embeddings where sim > 0.88 AND sim < 0.92 | Paired block preview + "merge/dismiss" |
| Low efficacy | `SELECT id, title, efficacy_score FROM activity_blocks WHERE efficacy_score < 40 AND usage_count >= 3` | Sortable table |
| Orphan blocks | `SELECT id FROM activity_blocks WHERE activity_category IS NULL OR phase IS NULL OR embedding IS NULL` | Count + repair CTA |
| Embedding health | `SELECT COUNT(*) FROM activity_blocks WHERE embedding IS NULL` | Red if > 0, green if 0 |
| Coverage heatmap | crosstab of phase × activity_category | Identifies slots with < 3 blocks (generation risk) |

**UX:** tab container with the 8 widgets. Each widget refreshes on mount, no auto-polling. "Last refreshed" timestamp per widget.

### 6.2 Weekly hygiene job — `pipeline-hygiene-weekly`

**File:** `src/lib/jobs/library-hygiene-weekly.ts` + `scripts/run-hygiene.mjs weekly`

Runs every Sunday via cron (Vercel Cron or manual):
1. Apply staleness decay: blocks unused 6+ months get `efficacy_score = efficacy_score - 1`, capped at −6 total decay (track in `decay_applied_total`).
2. Flag duplicate suspects into a new `library_health_flags` table (migration 066).
3. Flag low-efficacy blocks (< 40) with `requires_matt_review: true` in `library_health_flags`.
4. Regenerate embeddings for any block whose `title`, `prompt`, or `description` changed since last run (compare to `embedding_generated_at`).
5. Write summary to `system_alerts`: `{"type":"weekly_hygiene","flagged":N,"decayed":N,"reembedded":N}`.

**Migration 066:** `library_health_flags(id, block_id UUID FK CASCADE, flag_type, severity, reason, resolved_at, created_at)`.

### 6.3 Monthly hygiene job — `pipeline-hygiene-monthly`

**File:** `src/lib/jobs/library-hygiene-monthly.ts`

Runs 1st of month:
- **Consolidation pass:** if two blocks have > 0.95 cosine AND both have efficacy < 60, propose merge via `feedback_proposals` (reuses Phase 3 approval queue).
- **Orphan archival:** blocks untouched 12+ months with efficacy < 30 get `archived_at = now()` (NEVER deleted — audit trail).
- **Health summary email** to Matt: counts + top 5 suspect blocks.

### 6.4 Operational automation systems (master spec §9.3)

**This entire sub-section was missing from v1.** Build all seven as named modules under `src/lib/jobs/`. Each has a script in `scripts/` for manual runs.

| # | System | File | Trigger | What it does |
|---|--------|------|---------|--------------|
| 1 | Pipeline Health Monitor | `pipeline-health-monitor.ts` | Every hour | Aggregates last 24h generation runs, computes success rate, writes `system_alerts` if < 95% |
| 2 | Cost Alert | `cost-alert.ts` | Every hour | Sums `generation_runs.total_cost_usd` per day/week/month, fires alerts at $10/$50/$200 |
| 3 | Quality Drift Detector | `quality-drift-detector.ts` | Daily | Compares last 7 days avg Pulse score to prior 30 days; flag if drop > 10% |
| 4 | Teacher Edit Tracker | `teacher-edit-tracker.ts` | Real-time (hook, not cron) | Aggregates edit events into daily buckets for the efficacy job |
| 5 | Stale Data Watchdog | `stale-data-watchdog.ts` | Daily | Finds embeddings > 90 days old, blocks without usage, incomplete teacher profiles |
| 6 | Automated Smoke Tests | `smoke-tests.ts` | Daily | Runs the 6 E2E wiring checks (master §14.8), writes pass/fail to `system_alerts` |
| 7 | Usage Analytics | `usage-analytics.ts` | Nightly | Rolls up per-teacher/per-student usage into `usage_rollups` table for the admin Cost & Usage tab |

**Required:** Each of the 7 must have (a) a script in `scripts/ops/`, (b) a unit test covering its happy path, (c) a row written to `system_alerts` on every run (even "all green"), (d) documentation in `docs/projects/dimensions3-ops-runbook.md`.

### 6.5 Pipeline health dashboard

**Route:** `src/app/admin/pipeline/health/page.tsx`

Reads from the automation systems in 6.4. Widgets:
- Last 24h runs: success rate gauge, avg cost, avg duration, p95 duration
- Stage-by-stage failure heat map (0 → 6, colour-coded)
- Cost alert strip: today / week / month with thresholds
- Error log tail (last 20 `generation_runs` with `status='failed'`)
- Quality drift chart: 7-day rolling Pulse avg over 30 days

### 6.6 Cost alert delivery

**File:** `src/lib/monitoring/cost-alert-delivery.ts`

- On threshold cross: write to `system_alerts`, send email via Resend.
- Env var `COST_ALERT_EMAIL` (defaults to Matt's email).
- Env vars `COST_ALERT_DAILY_USD=10`, `COST_ALERT_WEEKLY_USD=50`, `COST_ALERT_MONTHLY_USD=200`.
- Debounce: don't re-alert for the same threshold within 6 hours.

### 6.7 🛑 Matt Checkpoint 4.1 — All widgets populated, all jobs runnable

**STOP. Matt verifies everything is wired before Phase 4 is accepted.**

Matt does:
1. Opens `/admin/library/health` — every widget has real data (not zeros unless zero is correct).
2. Runs each of the 7 automation scripts manually: `node scripts/ops/pipeline-health-monitor.mjs` etc. Each prints a summary and writes to `system_alerts`.
3. Opens `/admin/pipeline/health` — sees the output from step 2 reflected.
4. Forces a cost alert: temporarily sets `COST_ALERT_DAILY_USD=0.01`, runs a generation, verifies email lands.
5. Restores the threshold.

**Fail conditions:**
- Any widget shows "TODO" or hardcoded data.
- Any of the 7 automation scripts fails to run or doesn't write to `system_alerts`.
- Cost alert debounce doesn't work (sends 5 emails in a minute).

### 6.8 Phase 4 acceptance

- [ ] 6.1 Library health dashboard loads with all 8 widgets populated.
- [ ] 6.2 Weekly hygiene script runs clean and flags expected issues.
- [ ] 6.3 Monthly hygiene script runs and proposes at least one merge when test duplicates exist.
- [ ] 6.4 All 7 operational automation systems exist, have tests, have scripts, are documented.
- [ ] 6.5 Pipeline health dashboard loads.
- [ ] 6.6 Cost alert fires and delivers email.
- [ ] 6.7 Matt Checkpoint 4.1 passed.
- [ ] `docs/projects/dimensions3-ops-runbook.md` exists and lists all 7 systems + scripts.

### 6.9 Phase 4 rollback

If rolled back:
- Migration 066 is additive; leave in place.
- Jobs can be disabled by removing from cron — no data risk.
- Dashboards are read-only; disable routes via env flag.

---

## 7. Phase 5 — Content Safety & Moderation

**Goal:** Implement master spec §17 Layer 1 + Layer 2 moderation from day one. No student content reaches the database unscreened. No teacher safety alerts are lost. This is a legal/compliance requirement — NOT a nice-to-have.

**Estimated effort:** 4–5 days (up from 2–3 after Matt decisions 2026-04-10: +1 day ZH-Hans, +1 day NSFW.js image classifier).

**Why this is its own phase (previously omitted from v1):** Master spec §17 says *"ARCHITECTURAL REQUIREMENT — must be designed during Dimensions3, enforced from day 1."* It was completely missing from v1 and is required before the pipeline can ship to schools.

**Matt decisions baked in:**
- **Blocklist:** LDNOOBW (CC0 licence, multilingual — covers EN and ZH-Hans natively).
- **Languages:** English + Simplified Chinese (ZH-Hans) from day 1. Matt teaches in China; ZH content is day-1 requirement, not deferred.
- **Image moderation:** Client-side NSFW.js (~4MB WASM model, lazy-loaded) + server-side Haiku vision. Both ship with Phase 5, not post-launch.

**Execution discipline reminders:**
- Every student text input goes through moderation before it's persisted. If you find yourself writing `INSERT INTO student_progress` without passing through `moderateContent()`, stop and fix it.
- Do not ship with placeholder blocklists. Use a real list (pull from an accepted open-source profanity/self-harm word list — cite source in code).
- Do not silently fail moderation. If Haiku is down, content is held in a `pending_moderation` queue, not passed through.

### 7.1 Schema — migration 067

**File:** `supabase/migrations/067_content_moderation.sql`

```sql
-- Add moderation fields to student_progress
ALTER TABLE student_progress
  ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'clean'
    CHECK (moderation_status IN ('clean','pending','flagged','blocked')),
  ADD COLUMN moderation_flags JSONB DEFAULT '[]'::jsonb;

-- New table for incident tracking
CREATE TABLE content_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_source TEXT NOT NULL, -- 'student_text' | 'student_image' | 'teacher_upload' | 'ai_chat' | 'gallery_post' | 'peer_review'
  content_ref_id UUID,          -- FK to student_progress / submissions / etc (polymorphic)
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  flag_type TEXT NOT NULL,      -- 'profanity' | 'bullying' | 'self_harm_risk' | 'sexual' | 'violence' | 'pii' | 'other'
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  content_snippet TEXT,          -- redacted preview
  full_content_ref TEXT,         -- pointer only (never store full flagged content here)
  model_response JSONB,          -- Haiku response
  teacher_notified_at TIMESTAMPTZ,
  teacher_acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,               -- 'false_positive' | 'actioned' | 'escalated'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_moderation_log_class ON content_moderation_log(class_id, severity, created_at DESC);
CREATE INDEX idx_moderation_log_student ON content_moderation_log(student_id, created_at DESC);
```

### 7.2 Layer 1 — Client-side filter (text + image)

**Text filter — file:** `src/lib/safety/client-filter.ts`

- **Blocklist source:** LDNOOBW (CC0). Download from https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words — vendor into `src/lib/safety/blocklists/ldnoobw-en.json` and `ldnoobw-zh.json`. Cite licence in a sibling `LICENCE.md`.
- **Self-harm terms:** supplement LDNOOBW with a curated self-harm term list for EN + ZH-Hans (crisis-prevention vocabulary, not profanity). Source: hand-curated from published eating-disorder / self-harm safety guides, cited inline.
- **PII patterns:** regex for phone (EN + CN formats), email, physical address patterns.
- **Language detection:** lightweight `franc-min` (~50KB) or similar to pick EN vs ZH blocklist per input.
- **API:** `checkClientSide(text: string): { ok: boolean, reason?: string, lang: 'en' | 'zh' | 'other' }`
- Hook into every student text submission component. Non-negotiable.
- Blocked content shows a soft message in the student's language: *"This content can't be submitted. If you think this is a mistake, talk to your teacher."* / *"此内容无法提交。如有疑问请联系老师。"*
- Logs an `info`-severity row to `content_moderation_log` via `/api/safety/log-client-block` (anonymized — we track counts, not content).

**Image filter — file:** `src/lib/safety/client-image-filter.ts`

- **Model:** NSFW.js (https://github.com/infinitered/nsfwjs), MobileNet v2 variant (~4.2MB gzipped). Lazy-loaded only on pages with upload inputs.
- **Categories:** neutral, drawing, sexy, porn, hentai. Block if `porn + hentai + sexy > 0.6`. Values tunable via `NSFW_BLOCK_THRESHOLD` env var.
- **API:** `checkClientImage(file: File): Promise<{ ok: boolean, scores: Record<string, number> }>`
- **UX:** runs before upload. On block, shows gentle message and does not submit. On pass, submission continues to server where Haiku vision does Layer 2 check.
- **Fallback:** if model fails to load (e.g., slow network), `ok: true` with a warning log; server-side Layer 2 will catch it.

### 7.3 Layer 2 — Server-side Haiku moderation

**File:** `src/lib/safety/server-moderation.ts`

- Function: `moderateContent(input: string | ImageBuffer, context: ModerationContext): Promise<ModerationResult>`
- Uses `claude-haiku-4-5-20251001` (text + vision multimodal).
- **Bilingual prompt:** system prompt instructs Haiku to moderate content in any language, with explicit EN + ZH-Hans examples of each flag type. Prompt template at `src/lib/safety/prompts/moderation-system.ts`. Context includes `detected_lang` from Layer 1 so Haiku knows which norms to apply.
- Output JSON schema: `{ flags: [{ type, severity, confidence, lang }], overall: 'clean'|'flagged'|'blocked' }`
- **Fallback behaviour:** if Haiku call fails → persist content with `moderation_status='pending'`, write `info` row to `content_moderation_log`, queue for retry. NEVER pass content through as 'clean' on API failure.
- Called from every student write endpoint: `/api/student/progress`, `/api/student/tool-session`, `/api/student/gallery/post`, `/api/student/peer-review`, `/api/student/upload-image`.
- **Image endpoint specifics:** receives image bytes → sends to Haiku vision with moderation prompt → returns same JSON shape. Large images resized to 1024px max before send to control cost.
- Severity → action map:
  - `info` → persist as 'clean', log only
  - `warning` → persist as 'flagged', notify teacher
  - `critical` → persist as 'blocked' (content nulled, reference kept), notify teacher + log + `teacher_notified_at` set

### 7.4 Teacher safety alert feed

**Route:** `src/app/teacher/safety/page.tsx` (new)

- Per-class filter dropdown.
- List view of `content_moderation_log` rows for the teacher's classes, grouped by severity.
- Actions: Mark false positive / Contact student (templated email) / Escalate (sends to admin).
- Critical alerts surface as a red badge on teacher dashboard that cannot be dismissed without acknowledgment (sets `teacher_acknowledged_at`).

### 7.5 Ingestion pipeline safety scan

Pass A of the ingestion pipeline (from Phase 1) must include a content safety scan on teacher-uploaded materials. Rationale: teachers can accidentally upload materials with inappropriate content (images in old PDFs, etc).

**Action:** Add step to `src/lib/ingestion/pass-a.ts` that calls `moderateContent()` on extracted text. If `flagged`/`blocked`, the whole upload is held with `status='moderation_hold'` and surfaces in the admin queue.

### 7.6 🛑 Matt Checkpoint 5.1 — Safety end-to-end (EN + ZH + image)

**STOP. Matt verifies moderation works across all streams, both languages, and images.**

Matt does:
1. As a student, submits a clean English response → status = 'clean'.
2. Submits a clean Simplified Chinese response → status = 'clean', detected_lang = 'zh'.
3. Submits an EN response with a test profanity word → client-side block shows, content never reaches server.
4. Submits a ZH response with a test profanity word → client-side block shows in Chinese.
5. Submits a response Haiku flags as 'warning' (EN) → persists as 'flagged', teacher dashboard shows alert.
6. Submits an image that passes NSFW.js client check but Haiku vision flags → server blocks, teacher notified.
7. Submits an image NSFW.js blocks client-side → never reaches server.
8. Uploads a test teacher document containing flagged content → ingestion holds it in moderation queue.
9. Opens `/teacher/safety` → sees alerts from steps 5 and 6, marks one false positive → log row updates.
10. Simulates Haiku being down (mock failure) → content goes to `pending`, not `clean`.
11. Simulates NSFW.js failing to load → images still go through server-side Haiku vision check (defence in depth).

**Fail conditions:**
- Any student write endpoint bypasses `moderateContent()`.
- Client-side block logs content itself (privacy violation).
- Teacher can dismiss a critical alert without acknowledgment.
- Haiku failure causes silent pass-through.

### 7.7 Phase 5 acceptance

- [ ] 7.1 Migration 067 applied.
- [ ] 7.2 Client text filter blocks LDNOOBW terms in EN AND ZH-Hans on every student text input.
- [ ] 7.2 Client image filter (NSFW.js) blocks porn/hentai/sexy above threshold before upload.
- [ ] 7.3 Server moderation runs on every student write endpoint with real Haiku calls (bilingual prompt).
- [ ] 7.3 Server image moderation uses Haiku vision on uploaded images.
- [ ] 7.4 Teacher safety feed exists, shows real alerts from both languages and image flags, supports actions.
- [ ] 7.5 Ingestion pass-a includes safety scan.
- [ ] 7.6 Matt Checkpoint 5.1 passed — all 11 sub-steps.
- [ ] Grep for `INSERT INTO student_progress` / student write endpoints — every one routes through moderation.
- [ ] `src/lib/safety/blocklists/LICENCE.md` cites LDNOOBW CC0.

### 7.8 Phase 5 rollback

- Migration 067 is additive; can remain in place.
- Client filter is toggleable via `NEXT_PUBLIC_CLIENT_FILTER_ENABLED` env var (default: true).
- Server moderation has a `MODERATION_MODE=off|log|enforce` env var (default: enforce). Rolling back to `log` is safe for debugging; never ship with `off`.

---

## 8. Phase 6 — Integrity & Versioning

**Goal:** No silent data mutations. Every write to activity_blocks or units is versioned. Student data can be removed on request without breaking history.

**Estimated effort:** 1.5 days.

**Execution discipline reminders:**
- Triggers must be written so that a version is ALWAYS captured on UPDATE, never conditionally. If you find yourself adding `IF`s to skip versioning for "small changes", stop — every change is versioned.
- Student data removal is destructive. Dry-run first, always. The script must refuse to run without a `--confirm` flag.
- Do NOT delete history. Archival ≠ deletion. A student being removed from the system means their identity is anonymized; aggregate metrics stay.

### 8.1 Write-ahead unit versioning

Currently, `units.content_data` JSONB is overwritten on each edit. Per master spec §8, every write should snapshot the previous version.

**Migration:** `supabase/migrations/068_unit_versions.sql` (067 was consumed by content moderation)

```sql
CREATE TABLE unit_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  content_data JSONB NOT NULL,
  edited_by UUID REFERENCES teachers(id),
  edit_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, version_number)
);

CREATE INDEX idx_unit_versions_unit ON unit_versions(unit_id, version_number DESC);
```

**Trigger:** Supabase trigger on `units` UPDATE that inserts a row into `unit_versions` with the OLD content.

### 8.2 Block versioning

Same pattern in migration 068: `activity_block_versions` table, trigger on UPDATE of `activity_blocks`. Captures `content`, `efficacy_score`, `metadata`, `embedding_id`.

### 8.3 Student data removal

**File:** `src/lib/integrity/remove-student-data.ts`  
**Script:** `scripts/remove-student-data.mjs --student <uuid> [--confirm]`

Function `removeStudentData(studentId, { dryRun })`:
1. Enumerates all tables that reference the student: `student_progress`, `tool_sessions`, `submissions`, `gallery_posts`, `peer_reviews`, `content_moderation_log`, `student_auth_sessions`.
2. In dry-run: prints the row counts only.
3. With `--confirm`: anonymizes identity fields (sets `student_id = NULL`, replaces `name` with `'[removed]'`), keeps aggregate metrics.
4. Writes audit row to `data_removal_log` (new migration 069) with `removed_by`, `reason`, `row_counts`.
5. Efficacy scores for blocks this student used remain unchanged (the aggregate numbers already factored in their contribution).

**Migration 069:** `data_removal_log(id, removed_student_ref TEXT, removed_by UUID, reason TEXT, row_counts JSONB, created_at TIMESTAMPTZ)`.

### 8.4 🛑 Matt Checkpoint 6.1 — Versioning + removal

**STOP. Matt verifies on real data.**

Matt does:
1. Edits a real unit in the editor → checks `unit_versions` has a row with the prior content.
2. Edits an `activity_block` efficacy via the admin feedback accept flow → checks `activity_block_versions` row.
3. Runs `node scripts/remove-student-data.mjs --student <test_uuid>` (dry-run) → sees row counts, no mutation.
4. Runs again with `--confirm` → student rows anonymized, audit row written.
5. Verifies the generated units that student worked on still load and render.

### 8.5 Phase 6 acceptance

- [ ] 8.1 unit_versions trigger captures every edit.
- [ ] 8.2 activity_block_versions trigger captures every block change.
- [ ] 8.3 Student data removal script works in dry-run and confirm modes.
- [ ] 8.4 Matt Checkpoint 6.1 passed.
- [ ] Grep for direct updates to `units.content_data` outside a transaction that captures a version — should be zero.

### 8.6 Phase 6 rollback

- Migrations 068/069 are additive; safe to leave.
- Triggers can be dropped via `DROP TRIGGER IF EXISTS` if they cause perf issues.
- Removal script is manual-only; never scheduled.

---

## 9. Phase 7 — Observability, Sandboxes, 12 Admin Tabs

**Goal:** All five sandboxes from master spec §7.2–7.9 exist. The full 12-tab admin section from §14.7 is built, including per-teacher profitability and the Bug Reporting System. Six automated E2E wiring checks (§14.8) run daily.

**Estimated effort:** 5–6 days (up from 3 — previously missed 7 admin tabs, bug reporting, profitability tracking, several sandboxes).

**Execution discipline reminders:**
- Each of the 12 admin tabs is its own commit. Do not merge a PR that has only 8 tabs working.
- Do not build fake data views. Each tab reads real data from real tables.
- Per-teacher profitability requires all 4 cost categories wired — if you build it for 3 categories and say "the 4th is coming later", you've violated §14.7.
- The sandboxes are DISTINCT — don't collapse them into one "unified sandbox" to save time. Each one serves a different mental model.

### 9.1 Generation Sandbox (the real one)

**Route:** `src/app/admin/generation-sandbox/page.tsx` — maps to master spec §7.2.

Distinct from `/admin/simulator` (offline fixtures) and from `/admin/ingestion-sandbox` (Phase 1):
- Accepts a real `GenerationRequest` form (same shape as wizard input).
- Calls `runPipeline()` with `sandboxMode: false` but writes `test: true` to `generation_runs` so the run is flagged, not mixed with live runs in analytics.
- Step-through controls: Pause After Stage N, Replay Stage N, Inject Input, Skip Stage.
- Per-stage view: input JSON (editable), output JSON, AI prompt used, cost, duration, errors, token counts.
- Download run as JSON for offline debugging.
- "Open in Pipeline Simulator" button (for re-running the same inputs offline with fixtures).

**Backend:**
- `POST /api/admin/generation-sandbox/run` with `{ request, pauseAfter }`
- `POST /api/admin/generation-sandbox/replay-stage` with `{ runId, stage, modifiedInput }`
- `GET /api/admin/generation-sandbox/:runId` returns full run state

### 9.2 Pipeline Simulator (master spec §7.6)

**Route:** `src/app/admin/simulator/page.tsx` (renamed from `/admin/sandbox` in Phase 0)

- Offline fixture-based runs (no AI calls).
- Load a saved fixture, step through stages, compare against expected output.
- Regression test suite runs all fixtures on demand and reports pass/fail.
- Used for testing new FormatProfiles before shipping.

### 9.3 FrameworkAdapter Test Panel (§7.5)

Already built in Phase 2 (§4.6). Verify it's linked from the admin landing page here.

### 9.4 Ingestion Sandbox

Already built in Phase 1 (§3.4). Verify it's linked from the admin landing page here.

### 9.5 Block Interaction Visualization (master spec §7.7)

Per master spec §6.3 (Block Interaction Model: Layer A prerequisites, Layer B familiarity, Layer C cross-references).

**Route:** `src/app/admin/library/[blockId]/interactions/page.tsx`

- Graph view (react-flow): block at centre, prerequisite blocks upstream, dependent blocks downstream.
- Layer B view: familiarity adaptations (novice/experienced variants).
- Layer C view: cross-reference highlights.
- Link from any block detail page via "Show interactions".

### 9.6 Per-format sandbox tabs (§7.9)

`/admin/library` tab bar: Design / Service / Personal Project / Inquiry / All. Each tab filters block library by `format_profile_id` and runs Stage 1 retrieval against that format only (to preview what the generation pipeline would see).

### 9.7 Admin Dashboard Landing Page (§14.7)

**Route:** `src/app/admin/page.tsx`

- Health strip: green/amber/red traffic lights for Pipeline, Library, Cost, Quality, Wiring (reads from §9.3 Phase 4 automation systems).
- Active alerts row (red badges, click to expand).
- Quick stats: active teachers, active students, units generated, blocks in library, open bug reports.
- 7-day trend sparklines per stat.

### 9.8 The 12 Admin Tabs (master spec §14.7)

Each tab is its own route under `/admin/*`. Below is the definitive list — all 12 must exist and have real content before Phase 7 is accepted.

| # | Tab | Route | Status | Notes |
|---|-----|-------|--------|-------|
| 1 | Pipeline Health | `/admin/pipeline/health` | Built in Phase 4 (§6.5) | Verify link |
| 2 | Block Library | `/admin/library` | Exists; add per-format tabs (§9.6) | Browse, search, efficacy, bulk actions |
| 3 | Sandbox | `/admin/generation-sandbox` + sub-routes | §9.1 | Hub linking all 5 sandboxes |
| 4 | Cost & Usage | `/admin/cost-usage` | NEW — §9.9 | Per-teacher profitability |
| 5 | Quality | `/admin/quality` | NEW — §9.10 | Pulse trends, drift detection |
| 6 | Wiring | `/admin/wiring` | NEW — §9.11 | 6 E2E flow tests (§14.8) |
| 7 | Teachers | `/admin/teachers` | NEW — §9.12 | All teachers, profile status |
| 8 | Students | `/admin/students` | NEW — §9.12 | Anonymized roster |
| 9 | Schools | `/admin/schools` | NEW — §9.12 | School/class overview |
| 10 | Bug Reports | `/admin/bug-reports` | NEW — §9.13 | Full bug reporting system |
| 11 | Audit Log | `/admin/audit-log` | NEW — §9.14 | Admin action log |
| 12 | Settings | `/admin/controls` | Exists but TODO — wire backend | Model selection, flags, sliders |

### 9.9 Cost & Usage tab — per-teacher profitability (master spec §14.7)

**Route:** `src/app/admin/cost-usage/page.tsx`

**Required breakdowns:**
- Per-model spend: daily / weekly / monthly
- **Per-teacher profitability** — 4 cost categories (ingestion, generation, student API, teacher API). Each row: teacher name, 7d/30d/all-time totals, cost per unit generated, cost per active student, trend arrow. Colour: green/amber/red outlier detection.
- Cost-per-generation trend line
- Budget alert strip (reads thresholds from Phase 4 §6.6)
- Drill-down: click a teacher → per-model breakdown → individual API call log with tokens and cost
- Export to CSV

**Data source:** `usage_rollups` table (from Phase 4 §6.4 automation system 7).

**Migration 070:** `usage_rollups(id, teacher_id, category TEXT CHECK IN ('ingestion','generation','student_api','teacher_api'), period TEXT CHECK IN ('day','week','month'), period_start DATE, cost_usd NUMERIC, call_count INT, token_count INT, rolled_up_at TIMESTAMPTZ)`.

### 9.10 Quality tab

**Route:** `src/app/admin/quality/page.tsx`

- Pulse score trend (30/90 days)
- Drift detection (from Phase 4 §6.4 system 3)
- Before/after comparisons for recently-accepted feedback proposals
- Block efficacy trends (top movers up/down)

### 9.11 Wiring tab (§14.8)

**Route:** `src/app/admin/wiring/page.tsx`

Shows status of the 6 E2E flow tests from master spec §14.8. Each test has:
- Last run timestamp
- Result (pass/fail)
- Flow diagram (simple SVG with red X on broken link)
- "Run now" button

**The 6 tests** (run via Phase 4 §6.4 system 6 daily, plus manual):
1. Ingestion → Library (upload test doc → verify blocks)
2. Library → Generation (generate test unit → verify blocks retrieved)
3. Generation → Delivery (open generated unit in student view → verify content renders)
4. Delivery → Tracking (student interaction → verify tracking data saved)
5. Tracking → Feedback (edit a block in editor → verify efficacy updated)
6. Feedback → Library (check block with edits → verify efficacy reflects changes)

Each test has a real fixture. These are NOT mocks — they call the live endpoints with test teacher/student accounts.

### 9.12 Teachers / Students / Schools tabs

Three read-only browse tabs:
- `/admin/teachers` — list with profile status, usage stats, last active, style completeness, units created, link to detail view
- `/admin/students` — anonymized roster (name replaced with hash), enrollment status, progress overview, learning profile completion
- `/admin/schools` — school → class → teacher hierarchy, framework distribution per school, calendar sync status

### 9.13 Bug Reports tab & system (master spec §14.7)

**Migration 071:** `bug_reports(id, reporter_id, reporter_role, class_id, category, description, screenshot_url, page_url, console_errors JSONB, status, admin_notes, response, created_at, updated_at)`.

**Per-class toggle:** `classes.bug_reporting_enabled BOOLEAN DEFAULT false`. Teacher enables via Class Hub settings. Default OFF.

**Floating button:** bottom-right, only visible when `bug_reporting_enabled = true` for the current class context (or for admins always). Hidden otherwise.

**Quick-choice menu:** Something's broken / This doesn't look right / I'm confused / Feature request.

**Mini-form:** one-line description + optional screenshot (browser screen capture API or clipboard paste). Auto-captures URL, browser info, user role, class context, timestamp, last 5 console errors (with consent checkbox).

**Admin tab (`/admin/bug-reports`):**
- Filter by class, teacher, status, category, severity
- Status workflow: New → Investigating → Fixed → Closed
- Batch actions: close duplicates, merge similar
- Response sends in-app notification to reporter (they see status update on next login)
- Reporter sees their own reports under a "My reports" link in their profile

### 9.14 Audit Log tab

**Route:** `src/app/admin/audit-log/page.tsx`

- Reads from `feedback_audit_log`, `data_removal_log`, `library_health_flags`, `content_moderation_log` (teacher actions), and a new general `admin_audit_log` for admin actions (accept/reject proposals, settings changes).
- Filterable by actor, action type, date range.
- Exportable to CSV.

### 9.15 Admin controls — backend wiring

`/admin/controls/page.tsx` has a backend TODO. Wire it to a new `admin_settings` singleton table.

**Migration 072:** `admin_settings(id SERIAL PRIMARY KEY, key TEXT UNIQUE, value JSONB, updated_by UUID, updated_at TIMESTAMPTZ)`. Seed with default rows for:
- `pipeline.stage_enabled` — boolean per stage
- `pipeline.cost_ceiling_per_run_usd` — numeric
- `pipeline.cost_ceiling_per_day_usd` — numeric
- `pipeline.model_override` — JSON per stage
- `pipeline.starter_patterns_enabled` — boolean

Pipeline orchestrator reads these at the start of each run. Changes are audited into `admin_audit_log`.

### 9.16 Delete legacy knowledge files

After Phase 0 quarantined the old pipeline and Phase 7 has been running for 14 days with no incident:
- Grep for any remaining imports of `src/lib/knowledge/analyse.ts`, `analysis-prompts.ts`, `chunk.ts`, `extract.ts`, `retrieve.ts`, `retrieve-lesson-profiles.ts`, `ingest-unit.ts`, `vision.ts`
- Delete unreferenced files.
- `knowledge_chunks` and `lesson_profiles` tables stay as historical record (do NOT drop — they have real data).

### 9.17 🛑 Matt Checkpoint 7.1 — All 12 tabs live

**STOP. Matt opens every tab and kicks the tires.**

Matt does:
1. Opens `/admin` — dashboard loads with traffic lights, quick stats, sparklines.
2. Walks through every tab in order (1–12). For each, verifies the tab loads, has real data (not TODO), and has at least one interactive element that works.
3. Opens Cost & Usage, expands a teacher row → sees 4 categories with real numbers.
4. Opens Wiring → clicks "Run now" on flow test 1 → sees it pass.
5. Enables bug reporting on a test class → sees the floating button appear as that teacher → files a test report → sees it in `/admin/bug-reports`.
6. Changes a setting in `/admin/controls` → runs a generation → verifies the setting took effect.

**Fail conditions:**
- Any tab shows "Coming soon" or "TODO".
- Per-teacher profitability is missing any of the 4 cost categories.
- Bug report button shows when `bug_reporting_enabled = false`.
- Settings changes don't affect pipeline behaviour.

### 9.18 🛑 Matt Checkpoint 7.2 — Final end-to-end

**STOP. This is the final gate.**

Matt does one full end-to-end trip:
1. As a teacher, uploads a new PDF → ingestion sandbox shows stage outputs → approves blocks.
2. Runs the generation wizard → generation sandbox captures the run → resulting unit has real content.
3. Opens the unit in student view → renders correctly under MYP framework → switches framework to GCSE → labels change.
4. Student completes an activity → types flagged content → client filter blocks it → types clean content → persists.
5. Teacher edits the lesson → edit tracker logs it → overnight efficacy job proposes change → Matt accepts in `/admin/feedback`.
6. Checks `/admin/cost-usage` — this teacher's spend is visible with all 4 categories populated.
7. Checks `/admin/wiring` — all 6 E2E tests show green.

**Only after this trip completes without manual SQL, without editing code, and without any "TODO" surfacing is Dimensions3 complete.**

### 9.19 Phase 7 acceptance

- [ ] 9.1–9.6 All five sandboxes work (Generation, Simulator, FrameworkAdapter Test, Ingestion, Block Interaction + per-format tabs).
- [ ] 9.7 Admin landing page with health strip + alerts + quick stats.
- [ ] 9.8 All 12 tabs exist and load real data.
- [ ] 9.9 Per-teacher profitability has all 4 cost categories wired.
- [ ] 9.10 Quality tab reads from drift detector.
- [ ] 9.11 Wiring tab runs the 6 E2E tests.
- [ ] 9.12 Teachers/Students/Schools tabs browseable.
- [ ] 9.13 Bug Reporting System works end-to-end with per-class toggle.
- [ ] 9.14 Audit log reads from all audit sources.
- [ ] 9.15 Admin settings persist and affect pipeline.
- [ ] 9.16 Legacy knowledge files deleted (after 14-day burn-in).
- [ ] 9.17 Matt Checkpoint 7.1 passed.
- [ ] 9.18 Matt Checkpoint 7.2 passed.

### 9.20 Phase 7 rollback

- New tabs are additive routes; disable via navigation flag if broken.
- Migrations 070–072 are additive.
- Do NOT delete legacy knowledge files until burn-in is complete — rollback is keeping them around.

---

## 10. Phase Sequencing & Effort Summary

| Phase | Scope | Effort | Depends on |
|-------|-------|--------|------------|
| 0 | Cleanup & Disconnection | 0.5 d | — |
| 1 | Ingestion Curation Workflow | 2–3 d | Phase 0 |
| 2 | Generation Completeness + FrameworkAdapter | 3–4 d | Phase 1 (needs seed blocks) |
| 3 | Feedback Loop Completion | 2–3 d | Phase 2 (needs live runs) |
| 4 | Library Health + 7 Automation Systems | 3 d | Phase 1, 3 |
| 5 | **Content Safety & Moderation (NEW)** | 2–3 d | Phase 0; can run parallel with 2–4 |
| 6 | Integrity & Versioning | 1.5 d | — (parallel with 4–5) |
| 7 | Observability, Sandboxes, 12 Admin Tabs | 5–6 d | Phase 2, 3, 4, 5, 6 |

**Total:** ~19–23 working days (up from v1's 14–16 — v1 missed Content Safety, 7 automation systems, and 7 admin tabs).

**Critical path:** 0 → 1 → 2 → 3 → 4 → 7. Phases 5 and 6 run in parallel with 4 once Phase 2 is done.

**Matt checkpoint count:** 0.1, 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 5.1, 6.1, 7.1, 7.2 — **12 mandatory stops.**

---

## 11. Final Acceptance — "Dimensions3 Complete"

Dimensions3 is considered 100% built when all of the following are true:

1. **No old-system surface area.** Grep for `knowledge_chunks` writes, `analyse.ts` imports, `/admin/sandbox` — all zero.
2. **All 7 pipeline stages exist and run** (0 Input, 1 Retrieve, 2 Assemble, 3 Gap-Fill, 4 Polish, 5 Timing, 6 Score) with real AI calls via the wizard. **There is no Stage 5b** — curriculum mapping happens at render time via FrameworkAdapter.
3. **56 Teaching Moves + N curated blocks** exist in `activity_blocks` with embeddings, `source_type='community'`, efficacy 65.
4. **All 5 sandboxes work** — Ingestion Sandbox, Generation Sandbox, Pipeline Simulator, FrameworkAdapter Test Panel, Block Interaction Visualization.
5. **FrameworkAdapter renders neutral content** in at least MYP, GCSE, and A-Level — switching framework changes labels without re-generating.
6. **Feedback loop cycles end-to-end** — generate a unit, collect signal from real edits/deletes, propose efficacy change with reasoning, accept it in the approval queue, block score updates.
7. **All 7 operational automation systems run** and write to `system_alerts` (pipeline health, cost, drift, edit tracker, stale data, smoke tests, usage analytics).
8. **Library health dashboard loads** with all 8 widgets populated from real SQL.
9. **Weekly + monthly hygiene jobs run** successfully from scripts.
10. **Content Safety Layer 1 + Layer 2 enforced** — every student write routes through `moderateContent()`, teacher safety feed works, ingestion pass-a includes safety scan.
11. **Write-ahead versioning active** — editing a unit or block produces a version row via DB trigger.
12. **Student data removal works** in dry-run and confirm modes.
13. **Cascade deletes work** — removing a block cleans up feedback proposals + audit log.
14. **Cost alerts fire** — crossing $10/day threshold emails Matt with debounce.
15. **All 12 admin tabs exist and load real data** — Pipeline Health, Block Library, Sandbox, Cost & Usage, Quality, Wiring, Teachers, Students, Schools, Bug Reports, Audit Log, Settings.
16. **Per-teacher profitability has all 4 cost categories** — ingestion, generation, student API, teacher API.
17. **Bug Reporting System works** — per-class toggle, floating button, admin triage workflow.
18. **6 E2E wiring tests** in `/admin/wiring` run daily and show green.
19. **Admin controls settings persist** and affect pipeline behaviour.
20. **E2E smoke test passes** in the live environment — Matt completes Checkpoint 7.2 without manual SQL.
21. **Dimensions3 README / changelog updated** to reflect "Complete — 100% built".
22. **All 12 Matt checkpoints** signed off in `docs/projects/dimensions3-checkpoint-log.md`.

---

## 12. What We're NOT Doing (Out of Scope)

- **No backfill from legacy units.** Master spec §6.5 overrides `block-library-bootstrap-strategy.md`. Archive that doc with a "superseded" header.
- **No student-facing changes.** Dimensions3 is backend/admin. Student UI unchanged.
- **No multi-tenant work.** Loominary OS extraction is a separate project.
- **No new frameworks.** Stick with the 8 already defined.
- **No Journey Engine integration.** Journey blocks in `activity_blocks` stay as-is; the Journey Engine project handles its own wiring.
- **No 3D Elements integration.** The `r3f_instruction` column stays nullable; 3delements project handles population.

---

## 13. Resolved Decisions (from Matt, 2026-04-10)

All 12 v1 open questions and gaps answered. Decisions baked into the spec:

| # | Question | Decision | Applied in |
|---|----------|----------|------------|
| 1 | Sonnet model ID | `claude-sonnet-4-6` (matches existing code in `anthropic.ts` — consistency fix, not upgrade). 12 files need sweeping. | Phase 2 §4.7 |
| 2 | System teacher UUID | Create one during Phase 1 (seed script's first action) | Phase 1 §3.1 |
| 3 | Cost alert channel | Log-only to `system_alerts` table, no email | Phase 4 §6.6 |
| 4 | Journey blocks in seed | None — all 56 moves are workshop/lesson patterns | Phase 1 §3.1 |
| 5 | Unit version retention | Keep all versions forever, no pruning | Phase 6 §8.1 |
| 6 | Blocklist source | LDNOOBW (CC0) | Phase 5 §7.2 |
| 7 | Bug reporting default | OFF by default, per-class opt-in | Phase 7 §9.13 |
| 8 | ZH-Hans moderation | **Ship with Phase 5** (bilingual day 1, adds ~1 day) | Phase 5 §7.2–7.3 |
| 9 | `student_progress.class_id` | **Add migration in Phase 0** (before anything else) | Phase 0 §2.9 (new) |
| 10 | Proposal notifications | UI only, no email | Phase 3 §5.4 |
| 11 | NSFW image classifier | **Ship with Phase 5** (bundle NSFW.js, adds ~1 day) | Phase 5 §7.2 |
| 12 | `generation_runs.test` flag | Check during Phase 0, add migration if missing | Phase 0 §2.10 (new) |

**Phase effort adjustments from these decisions:**
- Phase 0: +0.5 day for class_id migration + test flag check/migration → **1 day total**
- Phase 5: +2 days for ZH-Hans + NSFW.js → **4–5 days total**
- Total revised estimate: **~21–25 working days**

---

## OLD §13. Open Questions (RESOLVED — kept for audit trail)

1. **Model ID for Sonnet 4.5 generation** — confirm exact string before un-hardcoding in 4.7.
2. **System teacher UUID** — create in Supabase, store in `SYSTEM_TEACHER_ID` env var before 3.1.
3. **Cost alert email channel** — Resend? SendGrid? Or just log to `system_alerts` and check manually?
4. **Journey blocks in seed data** — do any of the 56 Teaching Moves map to the `journey` activity_category, or are all in other categories?
5. **Unit version retention** — keep all versions forever, or prune to last 20?
6. **Client-side blocklist source** — which open-source profanity/self-harm word list to use for Phase 5? (licence matters)
7. **Bug Reporting — class enablement default** — spec says default OFF. Confirm or change to opt-out.
8. **Moderation language coverage** — Phase 5 covers English only at day 1. When is ZH-Hans added (Matt teaches in China)?

Answer these with Matt before starting the relevant phase. Don't block Phase 0 or 1 on them.

---

## 14. Final Cross-Check — v2 spec vs master spec / audit / known problems

This section exists to prove nothing was quietly dropped. Each row below is something from the master spec, the audit, or the known-problems list that I verified is covered somewhere in this v2 completion spec.

### 13.1 Master spec `dimensions3.md` coverage

| Master spec section | Topic | v2 phase coverage |
|----|----|----|
| §3 (Pipeline Stages 0–6) | 7-stage pipeline, no 5b | Phase 2 §4.1 (confirmation) + §4.2–4.3 (FormatProfile wiring) |
| §4 (Ingestion passes) | Pass A classify + Pass B enrich | Phase 1 §3.5 + §3.4 sandbox |
| §5 (Feedback loop + efficacy formula) | Self-healing efficacy | Phase 3 §5.2 formula + §5.4 UI |
| §6.3 (Block Interaction Model) | Layers A/B/C | Phase 7 §9.5 visualization |
| §6.5 (Block Library seeding strategy) | START EMPTY + curate | Phase 1 §3.1 seed + note to archive bootstrap-strategy.md |
| §7.2 (Generation Sandbox) | Step-through real AI | Phase 7 §9.1 |
| §7.3 (Ingestion Sandbox) | Upload → stage outputs | Phase 1 §3.4 |
| §7.5 (FrameworkAdapter Test Panel) | Mapping matrix view | Phase 2 §4.6 |
| §7.6 (Pipeline Simulator) | Offline fixtures | Phase 7 §9.2 |
| §7.7 (Block Interaction Viz) | Graph view | Phase 7 §9.5 |
| §7.9 (Per-Format Sandbox Tabs) | Design/Service/PP/Inquiry | Phase 7 §9.6 |
| §8 (Integrity & Versioning) | Write-ahead, removal | Phase 6 §8.1–8.3 |
| §9 (Library Health, weekly/monthly) | Hygiene jobs | Phase 4 §6.2–6.3 |
| §9.3 (7 Automation Systems) | All seven operations | Phase 4 §6.4 |
| §14.1 (Framework-neutral pipeline) | Neutral keys → render-time mapping | Phase 2 §4.1–4.5 |
| §14.7 (12 Admin Tabs) | Full admin section | Phase 7 §9.8 |
| §14.7 (Per-teacher profitability) | 4 cost categories | Phase 7 §9.9 |
| §14.7 (Bug Reporting System) | Per-class toggle + triage | Phase 7 §9.13 |
| §14.8 (6 E2E wiring tests) | Daily flow health | Phase 7 §9.11 + Phase 4 §6.4 system 6 |
| §14.9 (FormatProfile extension points) | Per-stage wiring | Phase 2 §4.3 |
| §17 (Content Safety & Moderation) | Layer 1 + Layer 2 | **Phase 5 (NEW)** — was missing in v1 |
| §19 (OS Migration Seams) | 4 seams: passes, module, content_items, content_assets | Phase 0 §2.5 verification |

### 13.2 Known problems / audit items

| Issue | Fix location |
|----|----|
| Duplicate `src/lib/ingestion/passes/*` files | Phase 0 §2.1 |
| Old `/api/teacher/knowledge/upload` un-quarantined prematurely | Phase 0 §2.2 |
| Hardcoded `claude-sonnet-4-20250514` in generate-unit route | Phase 2 §4.7 |
| `feedback_proposals.block_id` lacks ON DELETE CASCADE | Phase 3 §5.1 |
| 56 Teaching Moves hardcoded but not seeded into `activity_blocks` | Phase 1 §3.1 |
| `block-library-bootstrap-strategy.md` conflicts with §6.5 (backfill vs empty) | Phase 1 §3.1 note + §11 out-of-scope + archive doc |
| `/admin/sandbox` confusingly named vs real Generation Sandbox | Phase 0 §2.3 + Phase 7 §9.1 |
| `admin/controls` backend TODO | Phase 7 §9.15 |
| `student_progress` missing `class_id` (architecture gap) | **OUT OF SCOPE** — flagged in §11, needs separate design decision |
| No `moderation_status` column | Phase 5 §7.1 |
| No `content_moderation_log` table | Phase 5 §7.1 |
| No `bug_reports` table | Phase 7 §9.13 |
| No `usage_rollups` table for per-teacher profitability | Phase 7 §9.9 |
| No `admin_settings` singleton | Phase 7 §9.15 |
| No `unit_versions` / `activity_block_versions` tables | Phase 6 §8.1–8.2 |
| No `library_health_flags` table | Phase 4 §6.2 |
| No `data_removal_log` table | Phase 6 §8.3 |
| FrameworkAdapter `mapCriterion()` stub not implemented | Phase 2 §4.4 |

### 13.3 Assumptions to verify before starting each phase

These are assumptions baked into the spec that should be sanity-checked before the phase kicks off — not blockers, but "are we sure?" moments:

1. **Phase 0:** That `knowledge_chunks` and `lesson_profiles` still have data worth keeping (if empty, we can drop them earlier).
2. **Phase 1:** That all 56 Teaching Moves in `src/lib/ai/teaching-moves.ts` are current and accurate — no stale entries.
3. **Phase 1:** That Voyage AI embeddings API quota is sufficient for initial seed (56 blocks + future curated blocks).
4. **Phase 2:** That the 8 frameworks in `src/lib/frameworks/index.ts` have accurate criterion lists (especially GCSE which may have changed in 2026 spec updates).
5. **Phase 2:** That all Stage 4 Polish AI calls can actually be made to produce neutral output with prompt-level instructions (vs post-hoc scanning).
6. **Phase 3:** That `feedback_audit_log` already exists with fields needed for the efficacy computation. If not, add migration before §5.2.
7. **Phase 4:** That Vercel Cron is available and configured for the Vercel plan Matt uses.
8. **Phase 5:** That Haiku moderation calls are priced low enough that every student write passing through them is affordable at scale (est: 500 tokens × $1/M = $0.0005 per student write — sustainable).
9. **Phase 5:** That the existing `submissions`, `gallery_posts`, `peer_reviews` tables exist and are not legacy tables themselves.
10. **Phase 6:** That Supabase triggers don't interfere with existing RLS policies on `units` and `activity_blocks`.
11. **Phase 7:** That the admin role check (`is_admin` on teachers or similar) is already in place; if not, add before tab routes.

**Action:** Before each phase starts, re-verify its assumption list with a 5-minute grep / schema check. Update the spec if any assumption is wrong.

### 13.4 Things explicitly deferred (not forgotten, just not Dimensions3)

- **Multi-format FormatProfiles (Service/PP/Inquiry)** — Phase 2 §4.3 wires the extension points but only the Design profile is fleshed out. Service/PP/Inquiry profiles are separate follow-on work.
- **ZH-Hans moderation** — Phase 5 ships English only.
- **Multi-tenant / Loominary OS extraction** — §19 seams are verified but no extraction happens.
- **Journey Engine integration** — `journey` activity_category blocks are preserved but no Journey-specific pipeline work.
- **3D Elements integration** — `r3f_instruction` column remains nullable.
- **Student portfolio versioning** — out of scope; Phase 6 only versions `units` and `activity_blocks`.
- **School-level safety policy UI** — Phase 5 ships with strict defaults; per-school configuration is post-launch.
- **Revenue-side of per-teacher profitability** — Phase 7 §9.9 shows cost only; revenue comes when pricing exists.

### 13.5 Remaining gaps after v2 cross-check

After this pass, these items from master spec / audit are **still not covered** and should be flagged to Matt:

1. **`student_progress.class_id` architecture gap** — acknowledged as out of scope but needs a decision ticket so it's not forgotten.
2. **Same-school architecture (§18)** — intentionally future work, no action.
3. **`generation_runs.test` flag** — v2 assumes this column exists; verify in Phase 7 §9.1 or add migration.
4. **Approval queue notification system** — when a proposal lands, is Matt notified? Currently assumes he checks the UI. Might need email trigger (low priority, flag to Matt).
5. **Phase 5 client-side NSFW image classifier** — master spec §17.2 mentions ~200KB browser-side model; v2 spec covers server-side image moderation but defers the client-side model to "Phase E post-launch" per master spec §17.6. Confirm this is OK with Matt.

**None of these block Phase 0 starting.** They're tracked here so they don't get lost.

---

## 15. Success Measure

Matt's quote from this session: *"i want a fully working system that isn't confused with the old one."*

This spec is successful when:
- Matt can upload a PDF, watch it turn into blocks, approve them, generate a unit that uses those blocks, see the quality report, and trust that no old-pipeline code ran at any point in the flow.
- Every file in `src/lib/knowledge/` (old) is either deleted or clearly marked legacy-only.
- Every file in `src/lib/ingestion/`, `src/lib/pipeline/`, `src/lib/feedback/` (new) is actively used and traceable to a spec section.
- The phrase "Dimensions3" appears once in CLAUDE.md's "What's next" as complete, not as in-progress.
