# Lesson Quality — Lever 1: Slot Fields

**Status:** 1A–1I SHIPPED (4 May 2026). Branch holds 9 commits, awaiting Matt Checkpoint 1.1 + push.
**Worktree:** `/Users/matt/CWORK/questerra`
**Branch:** `lesson-quality-lever-1-slot-fields` (off `main` @ `51ed550`, 9 commits ahead — unpushed per push-discipline rule until Matt Checkpoint 1.1 PASSES + migration verified on prod)
**Baseline tests:** 3494 → 3624 (+130 across 1A–1I, 0 regressions, tsc strict clean)
**Migration:** `20260504020826_activity_three_field_prompt.sql` APPLIED TO PROD (1B) + 55 teaching moves AI-rewritten + reseeded with v2 shape (1C).
**Style-guide contract:** [`docs/specs/lesson-content-style-guide-v2-draft.md`](../specs/lesson-content-style-guide-v2-draft.md) (v2 draft, supersedes v1)
**Audit reported in chat:** 30 Apr 2026 + re-flighted 4 May post-Access-v2 merge

### Sub-phase status

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 1A — brief + ALL-PROJECTS | ✅ shipped | `ebfd217` | 9-sub-phase plan with checkpoints |
| 1B — migration (4 cols) + schema-registry | ✅ shipped + APPLIED PROD | `78b58af` | sandbox INSERT/SELECT verified exact values |
| 1C-revised — AI-rewrite Teaching Moves to v2 | ✅ shipped | `d537f97` | 55 rows, 100% v2 coverage, content_fingerprint stable |
| 1D — API read/write 3 fields + validation + deprecation header | ✅ shipped | `13b22d3` | 33 new tests; X-Lever-1-Deprecated response header |
| 1E — ComposedPrompt renderer + ActivityCard + PDF mount | ✅ shipped | `d1c8cdd` | hybrid spec (muted framing + bold task + 🎯 success_signal) |
| 1F — three-box slot editor + Preview composes via renderer | ✅ shipped | `c942283` | SlotFieldEditor with per-field char counts |
| 1G — AI generation rewrite (3 schemas + pipeline + adapter) | ✅ shipped | `0b632ae` | +19 tests; pattern bug per Lesson #39 — fixed all 3 schema sites |
| 1H — sweep section.prompt readers + close 1G validator regression | ✅ shipped | `4e4101c` | +24 tests; closed audit step 7; widened helper to SlotBearing; closed 1G validator regression in BOTH validateGeneratedPages + validateTimelineActivities |
| 1I — registry sync + WIRING drift fixes | ✅ shipped | (this commit) | 2 WIRING.yaml drift items fixed; activity-blocks + unit-editor entries refreshed; schema-registry 1H drift entry appended |
| Matt Checkpoint 1.1 | ⏳ pending | — | full smoke before push |

---

## What this is

Refactor the activity prompt from a single markdown blob into three structured fields:

- `framing` — one-sentence orient: what students are doing and why it matters today
- `task` — the direct imperative body (the actual work students do)
- `success_signal` — what students produce/record/submit so they know when they're done

The student renderer composes them. The AI generator fills three small fields instead of one big one. The editor surfaces three input boxes with per-field validation. **This is the Toddle pattern and the structural unlock for Levers 2–5** (lints, voice/personality, exemplar contrast, sequencing intuition — all need a structured payload to operate on).

Surface coverage:

| Surface | Storage | What changes |
|---|---|---|
| **A. Live activity instances** | `units.content_data` JSONB → `pages[].content.sections[].prompt` | TypeScript shape extension. NO migration. NO backfill (zero units in prod). New units born compliant. |
| **B. Library template entries** | `activity_blocks` table → `prompt TEXT NOT NULL` | Real ALTER TABLE migration. Backfill 62 existing rows via heuristic. |

Legacy `prompt` column stays for the entire transition window. Removal is **out of scope** for this lever — gated behind 30 days of green prod dashboard health, gets its own future phase.

---

## Why

Two pain points compound each other:

1. **AI generation produces wall-of-text prompts.** The current schema offers one `prompt: string` field. The LLM has no structural pressure to separate the orient/task/signal beats — it writes one prose blob. The Bad Example in the v2 style guide (130 words packed into one activity, embedded "TASK 1 / TASK 2" headings, table that drops, success signal buried in line 12) is the canonical output.
2. **Quality cannot be measured downstream.** Lints want to assert "this prompt has a success signal". Telemetry wants to flag "this teacher always omits framing". Cross-lesson Pulse repair wants to surgically rewrite just the framing of weak activities. None of that works on a free-text blob.

Toddle has converged on the three-field pattern (framing / task / success criteria). EL Education's lesson architecture is the same — explicit named slots so authors and reviewers can talk about each part separately. We adopt the pattern not because it's prettier, but because it's the **only data shape that makes the next four levers possible**.

---

## Audit summary

Full audit reported in chat (30 Apr) + re-flighted 4 May. Key findings:

- **Two surfaces** hold prompts: `activity_blocks.prompt` (SQL) and `units.content_data...sections[].prompt` (JSONB inside `units`/`class_units`).
- **4 schema sites** in `src/lib/ai/schemas.ts` repeat the same `prompt: { type: "string" }` definition. Pattern bug — must update all four together (Lesson #39).
- **12 API routes** read or write the prompt, plus `/api/teacher/units/[unitId]/content` (PUT) writes the JSONB blob.
- **Critical non-render readers**: `src/lib/ingestion/fingerprint.ts` computes `sha256(title + prompt + source_type)` — the UNIQUE constraint on `activity_blocks.content_fingerprint`. **Changing prompt shape changes the fingerprint.** Backfill must NOT recompute fingerprints, or the UNIQUE constraint sees "new" rows on every existing block. (Lesson #38 territory.)
- **Other downstream readers**: grading tile titles, Pulse repair builder, edit-tracker telemetry, knowledge chunking, PDF export, portfolio narrative, Teaching Mode + projector, wizard preview cards.
- **Re-flight (4 May)**: Access v2 didn't migrate `/api/teacher/activity-blocks/*` to `getTeacherSession` — they remain on `requireTeacherAuth` + `createAdminClient`. No auth-pattern collision. `activity_blocks` did NOT gain `school_id` (it's still teacher-scoped only). The HIGH-collision risk from the 30 Apr report did not materialise.
- **Registry drift (Lesson #54)**: WIRING `unit-editor.key_files` cites a nonexistent path; WIRING `activity-blocks.key_files` cites a nonexistent directory; schema-registry `activity_blocks` has `applied_date: null`, `purpose: null`, RLS `(unknown)`. Fix in 1I.

---

## Scope decisions

### Backfill scope

**Surface A: SKIPPED.** Production query (4 May) confirms 0 units, 0 activities. Matt is creating new units from scratch — they'll be born under the three-field shape via the editor + AI generation.

**Surface B: 62 blocks, 2 distinct authors, avg 961 chars / max 1407.** Backfill via heuristic with `needs_review` flag for ambiguous splits. Small enough to dry-run + iterate fast.

### Renderer composition: Hybrid (Option B)

Three options were considered (full report in chat). **Option B chosen.**

```
Today we close the loop — wheels and weight are the
final pieces of the puzzle.

Roll each of the three sample racers down the ramp.
For each, record:
  • Plus — what worked
  • Minus — what limited performance
  • Interesting — anything unexpected

🎯 Write one sentence: which was fastest, and why?
```

**Spec:**
- **Framing**: regular paragraph, lighter ink (`color: var(--le-ink-2)`), no label. Sits as the lead paragraph.
- **Task**: regular body. Full ink (`color: var(--le-ink)`). Bulleted/numbered lists render normally.
- **Success signal**: prefixed with 🎯 icon + slightly bolder (`font-semibold`). Sits as the closing paragraph.

**Empty-slot behaviour:** if any field is empty, that paragraph just doesn't render — no awkward whitespace, no broken visual.

**Fallback:** if all three are empty (transition window only — pre-backfill activity_blocks dragged into a new unit), fall back to `<MarkdownPrompt text={prompt} />`.

**Why B over A or C:**
- **B over A (labeled blocks):** lighter chrome, reads like a teacher wrote it, doesn't feel form-like. Easy to upgrade to A later if classroom feedback says students miss the success signal.
- **B over C (invisible composition):** the 🎯 affordance gives students a visible "this is what done looks like" cue. C loses the pedagogical handle entirely.

---

## Sub-phase plan

| # | Scope | Verification gate (Lesson #38: assert exact values) |
|---|---|---|
| **1A** | This brief + project entry in ALL-PROJECTS.md. | Brief reviewed by Matt before 1B starts. |
| **1B** | Migration `YYYYMMDDHHMMSS_activity_three_field_prompt.sql`: ALTER TABLE `activity_blocks` ADD COLUMN `framing TEXT, task TEXT, success_signal TEXT` (all nullable). Schema-registry entry updated (also fix the drift items: `applied_date`, `purpose`, `rls`). Sandbox-row INSERT with three fields, SELECT back, assert exact values. | Sandbox row: `INSERT (framing='F', task='T', success_signal='S')` → `SELECT framing, task, success_signal` → assert each = exact value. Migration `verify-no-collision.sh` clean. |
| **1C** | Backfill helper at `scripts/backfill/split-activity-prompts.ts`. Heuristic: sentence-1 → framing; middle → task; trailing sentence containing record/produce/write/show/submit/share → success_signal. Ambiguous → `needs_review = true` (flag stored in a parallel column `backfill_needs_review BOOLEAN DEFAULT false` added in 1B). **Dry-run only first.** Output `docs/projects/lesson-quality-lever-1-backfill-dryrun.md` with: % clean / % needs_review per author, sample 10 actual splits shown verbatim, per-field char counts. **Critical: do NOT recompute `content_fingerprint`.** Apply only after Matt review. | 3 hand-curated test cases asserted with exact split values. Dry-run report shows ≤25% needs_review (stop trigger if higher). After apply: SELECT 3 random blocks, verify split is sane + fingerprint unchanged. |
| **1D** | API surface. Update `/api/teacher/activity-blocks/*` (POST/PATCH) to read+write three fields. Update `/api/teacher/units/[unitId]/content` (PUT) to accept three-field JSONB shape. Server-side per-field validation (length cap matching v2 guide rules). Reads return both legacy `prompt` and the three fields. Writes accept either; `prompt` writes get a deprecation header (`X-Lever-1-Deprecated: prompt-write`). | Test: POST three fields → GET → assert each field exact value. Test: POST legacy `prompt` → response has `X-Lever-1-Deprecated` header → activity has `prompt` set + 3 fields null. Test: per-field length validation rejects oversize payload (≤200 chars framing, ≤800 chars task, ≤200 chars success_signal). |
| **1E** | New `<ComposedPrompt>` component at `src/components/student/ComposedPrompt.tsx`. Renders the three slots with hybrid spec above. Falls back to `<MarkdownPrompt text={prompt}>` only when all three are null. Mount in `ActivityCard.tsx` (3 sites: lines 146, 163, 178), `ExportPagePdf.tsx`. Teacher preview route already uses real `ActivityCard` — covered. | Snapshot test: synthetic `{framing, task, success_signal}` → render → assert HTML structure (3 paragraphs, 🎯 prefix on success). Snapshot: legacy `{prompt: "..."}` only → falls back to MarkdownPrompt. Snapshot: only `{framing, task}` (no success) → renders 2 paragraphs, no orphan 🎯. |
| **1F** | Editor UI. Replace single Edit/Preview prompt block in `ActivityBlock.tsx` with three labeled inputs (Framing / Task / Success Signal). Each shows char count + paragraph count + placeholder copy from v2 guide rule for that slot. Edit/Preview toggle persists at the block level — Preview composes via `<ComposedPrompt>` so teachers see exactly what students see. Replace `titleText = activity.prompt.split("\n")[0]` derivation (line 212) with `activity.framing || activity.task?.split("\n")[0] || activity.prompt?.split("\n")[0]`. | Smoke (in dev): open editor on a class-fork with seeded blocks → drag a (post-backfill) block → 3 boxes populated → edit each → save → refresh → values persist. Per-field counts update live. Preview renders hybrid composition. |
| **1G** | AI generation rewrite. Update **all 4 schema sites** in `src/lib/ai/schemas.ts` (lines 192, 285, 376, 545) to produce three fields. Update `src/lib/pipeline/stages/stage3-generation.ts:115/144` (Dimensions3 path). Update `src/lib/pipeline/adapters/output-adapter.ts:41`. Update `src/lib/ingestion/unit-import.ts:292/313`. Update `src/lib/activity-cards/index.ts:348`. Update system-prompt instructions in `src/lib/ai/prompts.ts:1826/2453` to use the v2 guide's AI Generation Guard Rails block verbatim. **End-to-end verify**: trigger one new unit generation → assert every activity has framing+task+success_signal populated → assert zero hit the legacy fallback. | Real-run capture (Lesson #38 + capture-truth): generate one unit, capture exact field values for 3 activities, lock as test fixtures. After lock: re-run generation, assert generated content matches the locked structure (per-field non-null + non-empty + within length cap). |
| **1H** | Test suite update. Every fixture file in audit step 6 + step 7 referencing `prompt:` updated to three-field shape. Add new tests: `<ComposedPrompt>` 3 snapshots, legacy fallback 1 snapshot, server-side validation 3 cases, fingerprint-stability-through-transition (Lesson #38) 1 case. | Test count delta: +12-20 net (existing fixtures updated, ~12 new tests). All pass. No fixture removed without justification. |
| **1I** | Registry sync. Run all 6 scanners (saveme step 11). Fix WIRING drift: `unit-editor.key_files` path, `activity-blocks.key_files` path. Update WIRING `activity-blocks.summary` if the ranking-weights claim is paper-only (separate audit, not blocking). Schema-registry: add the 3 new columns to `activity_blocks`, fix drift items (`applied_date`, `purpose`, `rls`). API-registry: rerun scanner — should auto-detect the three-field write paths. ai-call-sites: rerun scanner. | `git diff` on each registry file reviewed before commit. Each WIRING drift item has a one-line justification in the commit message. |

**Matt Checkpoint 1.1** between 1H and 1I:

- All sub-phases 1B–1H green (commits separate, no squashing — Karpathy #45)
- Test count delta makes sense
- Backfill report: % clean / % needs_review per author
- One full smoke: create new lesson via UI → three boxes accept input → student preview renders cleanly → trigger AI generation → every new activity has all three fields populated → no legacy fallback triggered
- Migration `verify-no-collision.sh` clean
- Matt signs off in chat → 1I → push to origin/main

---

## Stop triggers

- **1B sandbox verify shows fingerprint drift** on `activity_blocks` after the migration → STOP. The backfill column shape is interfering with the existing UNIQUE constraint somehow.
- **1C dry-run shows >25% `needs_review`** → STOP. Heuristic is too loose for the 62-row dataset; either iterate the heuristic or pivot to "delete + reseed activity_blocks library" (the 55 Teaching Moves seed migration is repeatable).
- **1D request body validation rejects more than expected** in test fixtures → STOP. Either the v2 length caps are wrong or the existing fixtures violate v2 already (which is information we want, not a bug to silence).
- **1G generation produces ANY activity with all three fields null** → STOP, schema didn't propagate to the LLM. Pattern bug — audit all 4 schema sites + stage3-generation + output-adapter + unit-import + activity-cards in the same phase (Lesson #39).
- **1G generation produces fields > the v2 length caps** → STOP, the system-prompt instruction isn't sticking. Don't paper over with post-truncation; report and tune the prompt.
- **`verify-no-collision.sh` flags collision** at any sub-phase → STOP, parallel session minted same timestamp. Coordinate via `.active-sessions.txt`.

## Don't stop for

- Pretty UI polish on the three-box editor (functional first; polish is a later phase)
- Backfill cases the heuristic flags `needs_review` (that's the design — teachers tune in their own time)
- Internationalisation of the field labels (English-only this lever)
- Lever 2 lints (those land in Lever 2 with the renderer-v2 work)
- Removing the `prompt` column (out of scope — 30-day soak gated, future phase)
- Migrating `/api/teacher/activity-blocks/*` to `getTeacherSession` (Access v2 deferred this; not our problem this lever)
- Surface A backfill (no units exist; the renderer fallback handles any future drag-from-library-pre-backfill case for free)

## Lessons re-read before each sub-phase

- **#38** Verify = assert expected values, not just non-null. Every sub-phase's verification gate has a specific exact-value assertion.
- **#39** Pattern bugs: fix all sites in the same phase. The 4 schema sites in `schemas.ts` are exactly this pattern — update all 4 in 1G, no incremental.
- **#42** Dual-shape persistence — frontend types diverging from server writers fails silently. Use canonical `ActivitySection` import everywhere; don't redefine locally.
- **#43-46** Karpathy: state assumptions, simplest minimum, surgical changes, goal-driven verification. Each sub-phase has explicit "done" criteria.
- **#47** Adding schema to existing yaml = audit every writer first. Schema-registry, api-registry, ai-call-sites all get edited; verify scanners preserve the shape.
- **#54** Don't trust WIRING summaries — grep for claimed features. Spot-checked the WIRING drift in audit step 8; fixing in 1I.

## Registries to sync (1I)

| Registry | Sync action |
|---|---|
| `docs/schema-registry.yaml` | Add 3 new columns to `activity_blocks` entry. Fix `applied_date`, `purpose`, `rls.{read,write}` drift. New migration referenced in `source_migration` (or list as a follow-up source). |
| `docs/api-registry.yaml` | Rerun `python3 scripts/registry/scan-api-routes.py --apply`. Routes for `/api/teacher/activity-blocks/*` should auto-detect the three new fields in their payload typings. |
| `docs/ai-call-sites.yaml` | Rerun `python3 scripts/registry/scan-ai-calls.py --apply`. The three-field schema in `schemas.ts` should auto-update the call-site entries. |
| `docs/feature-flags.yaml` | Rerun scanner; no expected change but capture if drift surfaces. |
| `docs/vendors.yaml` | Rerun scanner; no expected change. |
| `docs/projects/WIRING.yaml` | Manual: fix `unit-editor.key_files` and `activity-blocks.key_files` path drift. Update `activity-blocks` summary to mention three-field shape. |
| `docs/scanner-reports/rls-coverage.json` | Rerun `scan-rls-coverage.py` — no expected change since RLS isn't touched, but capture if drift surfaces. |

## Pending-Matt

_Resolved — backfill scope, renderer composition, prod row counts all answered 4 May 2026._

## Push discipline

- Each sub-phase = its own commit. No squashing.
- Don't push to `origin/main` until Matt Checkpoint 1.1 signs off AND the migration is applied to prod Supabase.
- Backup pattern: after each sub-phase, `git push origin lesson-quality-lever-1-slot-fields:lever-1-wip`. Keeps backup without triggering Vercel.
- After Matt Checkpoint 1.1 + prod migration applied: `git push origin main` (fast-forward).

---

## Out of scope (intentional)

- Removing the legacy `prompt` column (gated 30 days post-Lever-1)
- Lever 2 lints (renderer-v2 work — separate project)
- Migrating activity-blocks routes to `getTeacherSession` (Access v2 deferred — not our problem)
- I18n of field labels (English-only)
- Editor polish beyond functional three-box UI
- Surface A backfill (no units exist)
- Renderer-v2 (heading/table/inline-code support — separate backlog item per v2 guide)
