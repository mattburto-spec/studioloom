# Session Changelog

> Rolling log of changes across sessions. Each `saveme` appends an entry. Read the last 5 entries for quick cross-session context.

---

## 2026-05-16 (PM, earlier) — Trigger fix + cleanup: 53 phantom student-shape teacher rows (Lesson #92, Lesson #65 redux)

**Context:** Session opened to start `FU-SEC-TEACHER-LAYOUT-FAIL-OPEN` (P1) — the morning saveme had filed it after Matt found a student rendering the teacher chrome in /teacher/classes. Mid-pre-flight Matt opened /admin/teachers to spot-check the diagnostic and found 56 teacher rows instead of ~3 — 53 of them were synthetic-email shapes (`student-<uuid>@students.studioloom.local`). Same shape as the original Lesson #65 leak (1 May). Layout work was paused; the active production data integrity issue took precedence. (Block C `set_active_unit` security session — entry below — happened in parallel and shipped ~30 min later.)

### Diagnostic walk
- **Q1** (function definition in prod) — `pg_get_functiondef('public.handle_new_teacher()'::regprocedure)` showed the 11 May handpatch body: `user_type='student'` guard on `raw_app_meta_data`, search_path locked, `public.teachers` schema-qualified, EXCEPTION-WHEN-others. Function looked correct.
- **Q2** (applied_migrations tracker) — handpatch row landed 2026-05-11 08:30 UTC. No migration drift; the handpatch was on disk in prod.
- **Q3** (scope + dates) — 53 phantom rows, ALL post-handpatch. Earliest 2026-05-11 08:39 (+9 minutes after handpatch landed), latest 2026-05-14 23:54. Bug was firing immediately after the handpatch unblocked student creation.
- **Q4** (smoking gun — auth.users metadata for 5 phantom rows) — BOTH `raw_app_meta_data.user_type` and `raw_user_meta_data.user_type` were `'student'` at query time. So the data IS correctly written eventually. But the trigger fired and created the phantom row anyway.
- **Q5** (FK safety enumeration across all 17 columns pointing at teachers(id)) — `Success. No rows returned.` Phantoms are pure orphans.

### Root cause (Lesson #92)
Supabase Auth (gotrue) doesn't INSERT auth.users with `app_metadata` set in one go. It does INSERT-then-UPDATE:
1. INSERT auth.users with `raw_app_meta_data = '{}'`
2. AFTER INSERT trigger fires — sees empty `raw_app_meta_data`, the user_type guard misses, INSERTs phantom teacher row
3. UPDATE auth.users SET `raw_app_meta_data = '{user_type: "student", ...}'` — invisible to the trigger

`raw_user_meta_data` IS populated in the original INSERT (the sibling `handle_new_user_profile` trigger has worked all along because it reads `raw_user_meta_data`). The handpatch read the wrong bucket. The mocked-admin-client tests never exercised the real gotrue path, so the bug stayed latent for 2 weeks.

### What shipped (5 commits, branch `claude/vigilant-kepler-ec859c`)
- **Mig `20260516044909_fix_handle_new_teacher_check_user_metadata_bucket`** — one-line guard change: `IF (NEW.raw_app_meta_data->>'user_type') = 'student' OR (NEW.raw_user_meta_data->>'user_type') = 'student' THEN`. Sanity DO-block extended to assert BOTH bucket checks present. Applied to prod 16 May; `applied_migrations` row logged in the same SQL Editor session per Lesson #83.
- **Mig `20260516050159_cleanup_phantom_student_teacher_rows`** — single DO-block with belt-and-braces: pre-count via RAISE NOTICE, FK-safety re-asserted INSIDE migration body across all 17 columns (any non-zero → RAISE EXCEPTION + rollback), filter is hardcoded synthetic-email pattern, GET DIAGNOSTICS captures rows-deleted, post-condition asserts zero phantoms remain (rolls back if not). Applied to prod 16 May; deleted 53; `/admin/teachers` now shows 3 real teachers.
- **`src/lib/access-v2/__tests__/migration-handle-new-teacher-bucket-fix.test.ts`** — 22 source-static assertions covering both migrations. NC mutation proven load-bearing: removing the `raw_user_meta_data` guard breaks 2 specific tests.
- **`docs/lessons-learned.md`** — Lesson #92 banked (full diagnosis + root cause + 4 operational rules + filed-with summary). Lesson #65 amended with a 16 May update note + audit checklist step 4 ("verify the bucket you're reading IS populated at trigger time").
- **`docs/security/security-plan.md`** — new "Surfaced 2026-05-16" tracking-table section: Lesson #92 trigger fix marked DONE, `FU-AUTH-TRIGGER-AUDIT-METADATA-BUCKETS` (P2) filed to sweep every other AFTER INSERT trigger on auth.users for the same wrong-bucket pattern.

### Smoke results
- ✅ Trigger fix in prod: provisioned a fresh student "test999" via `/teacher/classes/[classId]` Add Student modal → student appears in class normally → `phantom_count_before === phantom_count_after === 53` (no new phantom). Latest phantom still from 14 May 23:54 (the moment before the fix landed in the chain).
- ✅ Cleanup in prod: DO-block printed `pre-count = 53 → deleted 53 → post=0` → `/admin/teachers` refreshed to show 3 real teachers as expected.
- ✅ Local: 6442 → 6464 passing (+22 net, exactly the new shape tests). No regressions.

### Systems touched
- **Schema:** `public.handle_new_teacher()` function body replaced (single → dual bucket guard); 53 rows DELETEd from `public.teachers`. No table/column/RLS changes.
- **Code (added):** the test file under `src/lib/access-v2/__tests__/`. No app-code changes.
- **Docs:** `docs/lessons-learned.md` (Lesson #92 + Lesson #65 amendment), `docs/security/security-plan.md` (Lesson #92 entry + FU-AUTH-TRIGGER-AUDIT-METADATA-BUCKETS), this changelog entry.
- **Registries:** api-registry / ai-call-sites / vendors / RLS all re-scanned, no drift. feature-flags drift report pre-existing (21 registered vs 30 code env vars), not from this session. Scanner-report JSON timestamps refreshed.
- No new API routes, no new AI call sites, no new feature flags, no new vendors, no WIRING.yaml entries affected (auth-system is downstream of the trigger but its `key_files` don't reference the function name directly).

### Footguns banked (again)
- **Edit-tool absolute paths to the wrong worktree.** Mid-Block-C I wrote 3 Edit calls targeting `/Users/matt/CWORK/questerra/docs/...` (the main worktree) instead of `/Users/matt/CWORK/questerra/.claude/worktrees/vigilant-kepler-ec859c/docs/...` (this session's worktree). Caught when `git status` showed the test file as untracked but the docs files as not-modified, then `grep -c "Lesson #92"` confirmed the edits had landed in the main worktree. Recovery: confirmed via `git -C /Users/matt/CWORK/questerra diff` that the main worktree had NO pre-existing modifications to those files (only my accidental edits), reverted via `git -C /Users/matt/CWORK/questerra checkout --`, re-applied with the correct prefixed paths. Cost: ~5 min. This is the EXACT footgun banked in the morning saveme — re-banked here so the lesson keeps surfacing until tooling closes it. Lesson candidate: when working in a session worktree, prefer relative paths from `pwd`, or pre-flight every Edit call by greping `pwd` to confirm the path.

### Surfaced (still TODO, picks up next session)
- **`FU-SEC-TEACHER-LAYOUT-FAIL-OPEN`** — the original morning task. Layout audit was complete (6 layouts surveyed, TeacherLayout + SchoolLayout identified as fail-open, AdminLayout identified as the gold-standard fail-closed reference) but no code touched. Pickup ready: re-read [`docs/security/security-plan.md`](security/security-plan.md) §FU-SEC-TEACHER-LAYOUT-FAIL-OPEN, apply the AdminLayout state-machine pattern (`checking | teacher | redirecting`) to TeacherLayout + SchoolLayout, redirect missing-teacher-row to `/dashboard?wrong_role=1` (mirrors middleware Phase 6.3b convention), add source-static shape tests, smoke as Scott. Estimated ~1–2h.
- **`FU-AUTH-TRIGGER-AUDIT-METADATA-BUCKETS`** (P2) — sweep every other AFTER INSERT trigger on auth.users (e.g. `handle_new_user_profile`, and any others enumerated via `information_schema.triggers`). Known good: `handle_new_user_profile` reads `raw_user_meta_data` (verified). Estimated ~1h.

### Next
- Open PR for branch `claude/vigilant-kepler-ec859c` (5 commits, 2 migrations + 1 test file + 2 doc updates + this changelog entry).
- Pick up `FU-SEC-TEACHER-LAYOUT-FAIL-OPEN` in a fresh worktree (cleaner separation from this PR).

---

## 2026-05-16 (afternoon) — Block C: set_active_unit unit-ownership gate ([PR #323](https://github.com/mattburto-spec/studioloom/pull/323), closes [FU-SEC-SET-ACTIVE-UNIT-MISSING-UNIT-OWNERSHIP-CHECK](security/security-plan.md))

**Context:** Adversarial probing of the Block A/B `set_active_unit` SECURITY DEFINER function (PR #319, earlier same day) revealed that the function only authorized on `class_uuid` (via `is_teacher_of_class`) but did NOT check anything about `target_unit_uuid`. Any authenticated teacher could attach any unit_id (including foreign teachers' private unpublished units) to one of their own classes, bypassing the fork flow + fork_count attribution + publish gate. Live exploit was attempted but obstructed by Matt being the only teacher with units in this prod instance — the test inadvertently picked one of his own units and returned 204 as a no-op self-activation. Gap was provable from migration source alone. Filed as `FU-SEC-SET-ACTIVE-UNIT-MISSING-UNIT-OWNERSHIP-CHECK` (P1) via PR [#321](https://github.com/mattburto-spec/studioloom/pull/321) + sister-to `FU-SEC-TEACHER-LAYOUT-FAIL-OPEN` from the same probe session.

### What shipped

- **Migration `20260516052310_set_active_unit_unit_ownership_check`** — `CREATE OR REPLACE FUNCTION public.set_active_unit(uuid, uuid)` with a SECOND `IF NOT EXISTS` auth gate inserted between the existing `is_teacher_of_class` check and the deactivate-others UPDATE. Design picked via Cowork sign-off: **Option B — authored-or-published.** Caller must own the target unit (`units.author_teacher_id = auth.uid()`) OR the unit must be `is_published = true`. Matches the existing fork-from-library affordance: published units can be attached directly; private/unpublished units owned by other teachers are blocked. Both gates raise SQLSTATE 42501. Preserves SECURITY DEFINER + `search_path = public, pg_temp` lockdown + `REVOKE ALL FROM PUBLIC` / `GRANT EXECUTE TO authenticated` + INSERT-ON-CONFLICT mutation shape. Lesson #66 sanity DO-block extended with 3 new LIKE assertions for the gate's load-bearing pieces (`author_teacher_id = auth.uid()`, `is_published = true`, "cannot attach unit" RAISE EXCEPTION message). `applied_migrations` row logged in same Supabase SQL Editor session per Lesson #83.
- **Down.sql** — `CREATE OR REPLACE` restoring the prior (single-gate) function body with a warning header documenting that rollback re-opens the privilege escalation gap.
- **No app-code change.** The wrapper at `src/lib/classes/active-unit.ts` already surfaces SQLSTATE 42501 via its discriminated-union return; the existing `toastForRpcCode("42501")` text covers both gates ("You don't have permission to change the active unit on this class").

### Systems touched

- New: `supabase/migrations/20260516052310_set_active_unit_unit_ownership_check.sql` + `.down.sql`, `src/lib/classes/__tests__/migration-set-active-unit-unit-ownership-check.test.ts` (new 28-test file)
- Modified: `src/lib/classes/__tests__/active-unit.test.ts` (+1 test for the gate-2 error path), `docs/schema-registry.yaml` (new `spec_drift` entry on `class_units`), `docs/security/security-plan.md` (FU marked DONE in tracking table)
- No new API routes, no new feature flags, no new vendors, no RLS changes.

### Pre-flight audit (deliverable g)

Grepped the entire `supabase/migrations/` tree for SECURITY DEFINER functions that INSERT/UPDATE `class_units`. **Zero sibling DEFINER functions need the same gate retrofitted.** `set_active_unit` is the only SECURITY DEFINER function that mutates `class_units`. Other class_units writes are: a non-DEFINER `update_class_units_updated_at` trigger (runs in caller's privilege context, subject to RLS), a one-time historical UPDATE in migration 011, and ALTER TABLE column adds. All other DEFINER functions in the codebase (`is_teacher_of_class`, `is_teacher_of_student`, `current_teacher_school_id`, `handle_new_teacher`, `classes_seed_lead_teacher_membership`, `phase_5_2_atomic_ai_budget_increment`, `bump_student_seen_comment_at_rpc`, `sync_tile_feedback_from_comment`) operate on tables OTHER than `class_units`. Single-function fix, no sibling FU opened.

### Tests

- Local: 6442 → 6471 passing (+29 net).
  - New file `migration-set-active-unit-unit-ownership-check.test.ts` — 28 tests covering: function signature + safety preserved (5), gate 1 still present (2), gate 2 unit ownership shape including Option-B-confirming `OR` assertion (5), statement order gate1→gate2→deactivate→INSERT (3), permissions hardening preserved (3), Lesson #66 sanity DO-block extended (5), NC mutation removes gate 2 (1), down.sql preserves prior body without gate 2 pieces (4).
  - Extended `active-unit.test.ts` — +1 test exercising the gate-2 42501 error path with the new "cannot attach unit" message.
- NC pattern: in-memory mutation removes the new gate's IF NOT EXISTS block, asserts the regex no longer matches the mutated SQL, re-reads file from disk to confirm untouched.

### Prod verification

After Matt applied both SQL blocks (function CREATE OR REPLACE + applied_migrations INSERT), a `pg_get_functiondef` query confirmed `GATE 2 PRESENT — Block C live`. All four load-bearing pieces (`is_teacher_of_class`, `author_teacher_id = auth.uid()`, `is_published = true`, "cannot attach unit") survived the CREATE OR REPLACE. Live happy-path UI smoke + live console exploit test against a non-existent unit_uuid were offered as belt-and-braces but not requested before close.

### Footguns banked

- **Multi-line SQL comment text breaks single-line regex assertions.** The down.sql warning text "RE-OPENS the privilege escalation gap" wrapped at 80 cols with `--` continuation, so the test regex needed `\s+(?:--\s+)?` between "escalation" and "gap" to match. Caught by the first test run + fixed in-place before commit. Worth remembering for any future migration-shape test that asserts comment text. Not a true new Lesson — falls under existing Lesson #67 (regex assertions need to match the actual file shape).
- **`gh pr merge --squash --delete-branch` continues to fail locally when main is checked out elsewhere.** Third time this session. Workaround (delete remote branch via `gh api -X DELETE`) is now a reflexive cleanup step.

### Surfaced (still open from earlier today)

- **`FU-SEC-TEACHER-LAYOUT-FAIL-OPEN` (P1)** — TeacherLayout fails open when teacher-row lookup returns PGRST116, rendering teacher chrome + leaking class codes to logged-in students. Sister FU to Block C from the same 16 May probe session, distinct surface (page-level vs function-body). Paste-able prompt provided to start a fresh focused session.

### Active-unit work — fully shipped

Three blocks, three PRs, three migrations, all merged + applied to prod + smoke-validated + bookkeeped:

| Block | PR | Migration | What |
|---|---|---|---|
| A | [#319](https://github.com/mattburto-spec/studioloom/pull/319) | `20260515214045` | Partial unique index `class_units_one_active_per_class` |
| B | [#319](https://github.com/mattburto-spec/studioloom/pull/319) | `20260515220845` | `public.set_active_unit` SECURITY DEFINER helper + TS wrapper + caller refactor |
| C | [#323](https://github.com/mattburto-spec/studioloom/pull/323) | `20260516052310` | Unit-ownership gate added to `set_active_unit` (closes `FU-SEC-SET-ACTIVE-UNIT-MISSING-UNIT-OWNERSHIP-CHECK`) |

The DB-level invariant "exactly one active unit per class, attached only by its rightful caller" is now enforceable, enforced, and used. Downstream resolver work (`/teacher/classes/[classId]` → active-unit redirect, cockpit current-unit, class chip rail, student-side surface routing per decisions-log line 5) unblocks.

---

## 2026-05-16 — One active unit per class enforced at DB level ([PR #319](https://github.com/mattburto-spec/studioloom/pull/319))

**Context:** Implementation of the decision logged in [docs/decisions-log.md](decisions-log.md) line 7 dated 16 May 2026 — "One active unit per class enforced at DB level". Pre-Block-A audit confirmed prod was clean (zero classes with multiple `is_active=true` rows on `class_units`) so reconciliation was unnecessary. Three-block phased build (constraint → atomic helper → caller refactor), each with its own Matt Checkpoint and STOP AND REPORT gate per [build-methodology.md](build-methodology.md).

### What shipped

- **Migration `20260515214045_class_units_one_active_per_class`** — partial unique index `class_units(class_id) WHERE is_active = true`. Applied to prod; `applied_migrations` row logged in same Supabase session per Lesson #83.
- **Migration `20260515220845_set_active_unit_function`** — `public.set_active_unit(class_uuid, target_unit_uuid)` SECURITY DEFINER function. Deactivates other active rows + activates target via `INSERT ON CONFLICT (class_id, unit_id) DO UPDATE SET is_active = true`, all in one implicit transaction so the partial unique never sees a 2-active window. `search_path = public, pg_temp` locked per Lesson #64. `is_teacher_of_class(class_uuid)` auth gate inside the function body (raises `42501` on non-teacher) — SECURITY DEFINER bypasses RLS so the gate must live in-body. Lesson #66 sanity DO-block asserts SECURITY DEFINER + search_path lockdown + auth gate via `pg_get_functiondef(oid)` and refuses-to-apply on missing properties. `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`. Applied to prod; `applied_migrations` row logged.
- **TS wrapper** [`src/lib/classes/active-unit.ts`](../src/lib/classes/active-unit.ts) — `setActiveUnit(supabase: SupabaseClient, classId, unitId): Promise<{ ok: true } | { ok: false; error: string; code?: string }>`. Discriminated-union return mirrors the convention in `src/lib/ai/call.ts`. Takes `supabase` as a parameter (matches `src/lib/units/resolve-content.ts` pattern) so the same module serves both client + server callers.
- **Caller refactor (Block B):**
  - [`src/app/teacher/classes/[classId]/page.tsx`](../src/app/teacher/classes/%5BclassId%5D/page.tsx) `toggleUnit` — branches on isActive: activate → `setActiveUnit(...)`, deactivate → narrow `.update({ is_active: false })`. Optimistic state in the activate branch flips both target row to true AND any other-active rows to false (mirrors RPC semantics — without this the UI shows ghost double-active until re-fetch).
  - [`src/app/teacher/units/[unitId]/page.tsx`](../src/app/teacher/units/%5BunitId%5D/page.tsx) `toggleClassAssignment` — same pattern. Optimistic state stays class-flat (the `allClasses[]` shape doesn't surface other units in target classes, so deactivate-others is a conceptual no-op on this surface — documented inline).
  - Both pages: snapshot-rollback on failure, fixed-position red toast banner mapped from SQLSTATE (`42501` → permission denied copy, `23505` → race condition copy, default → generic), 4.5s auto-hide via `useEffect`.

### Systems touched

- Modified: `src/app/teacher/classes/[classId]/page.tsx` (~+90 lines net), `src/app/teacher/units/[unitId]/page.tsx` (~+79 lines net), `src/app/teacher/units/[unitId]/__tests__/class-units-sync.test.ts` (rewritten 4 → 15 tests)
- New: `src/lib/classes/` directory, `src/lib/classes/active-unit.ts` (TS wrapper), `src/lib/classes/__tests__/active-unit.test.ts` (6 wrapper-mock tests), `src/lib/classes/__tests__/migration-set-active-unit-function.test.ts` (19 migration shape + NC tests), 2 migration `.sql` + 2 `.down.sql` files
- Schema: `class_units` gains the partial unique index; new `public.set_active_unit(uuid, uuid)` function in `public` schema. Schema-registry updated with new index + spec_drift entry.
- No new API routes, no new AI call sites, no new feature flags, no new vendors. Registry scanners reconfirmed clean (only incidental scanner-output reorderings).

### Tests

- Local: 6406 → 6442 passing (+36 net across the three blocks; +25 in Block A's helper phase, +11 in Block B's caller phase from the rewritten class-units-sync test).
- Two new NC tests assert that the deactivate-others UPDATE in the SQL migration AND the `setActiveUnit(...)` call in both pages are load-bearing — meta-mutation pattern (load source, mutate in-memory, assert regex no longer matches, re-read from disk to confirm file untouched).
- Migration shape test asserts SECURITY DEFINER + search_path lockdown + 42501 auth gate + INSERT-ON-CONFLICT shape + permissions hardening + Lesson #66 sanity DO-block presence.

### Smoke results

- ✅ Sequentially activate three units on the same class → "Current Units (1)" UI shows only the latest active unit; the other two move to Unit History. The `(1)` counter is the constraint manifesting at the UI surface.
- ✅ Reactivate a Unit History entry → atomically deactivates the previously-active unit; UI updates correctly. Hard-refresh confirmed DB state matches UI.
- ✅ Network tab on activations shows `204` from the RPC (success for `RETURNS void`); CORS preflight `200`. **Zero `23505` violations** observed across all test activations.
- ⏭️ Error path (force a 42501 toast) was not exercised end-to-end via the UI — the auth gate is verified by the migration shape test (`42501` SQLSTATE present), the wrapper unit test (`42501` propagates to `result.code`), and the toast string is regex-tested as a constant in both pages.

### Footguns banked

- **Absolute paths to the wrong worktree.** Mid-Block-B I used `/Users/matt/CWORK/questerra/src/...` (the main worktree) instead of `/Users/matt/CWORK/questerra/.claude/worktrees/fervent-shirley-b7949a/src/...` (this session's worktree) in 4 consecutive Edit calls. The Edit tool reported success each time (it was writing the files, just to the wrong tree). Caught when `git commit` reported "nothing to commit". Recovery: reverted the accidental edits in the main worktree (`git checkout -- <file>` on the one affected file, leaving Matt's other modifications alone), then re-applied in the session worktree using the correct prefix path. Lesson candidate: when working in a session worktree, always include the `.claude/worktrees/<name>/` prefix in absolute Edit paths; alternatively use relative paths from `pwd`. Cost: ~5 min of confusion + one `git checkout --` cleanup.
- **`gh pr merge --squash --delete-branch` fails locally when main is checked out in a sibling worktree** — same footgun banked from 15 May evening. The merge succeeded on GitHub (squash commit `3740b3ce` landed on origin/main); the local fast-forward + branch deletion failed with `'main' is already used by worktree at '...'`. Workaround: explicit branch deletion via `gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/<branch>`. CLAUDE.md already notes this; pattern is now seen twice.

### Surfaced (but not closed) this session

- **`FU-SEC-TEACHER-LAYOUT-FAIL-OPEN` (P1)** — filed in [security-plan.md](security/security-plan.md) tracking table. While testing the Block B error path, Matt logged into Firefox as student "Scott" and pasted a `/teacher/classes/[classId]` URL into a new tab; the page rendered the full teacher chrome including class codes for all 4 of his enrolled classes. Diagnosis: `TeacherLayout` logs the PGRST116 from the `teachers` table lookup but proceeds to render instead of redirecting. RLS scoping is correct (Phase 1.4 CS-1 student-side `classes` policy returns enrolled classes only); the leak is page-level UI. Bidirectional impersonation pathway via leaked code + classmate username re-opens the attack class [studioloom#308](https://github.com/mattburto-spec/studioloom/pull/308) closed. Real-world exposure ~zero (no real students yet); must be closed before any pilot. Flagged as next-session work; explicitly NOT bundled into Block B's saveme.

### Next

- Security investigation session for `FU-SEC-TEACHER-LAYOUT-FAIL-OPEN` — paste-able prompt provided at session end.

---

## 2026-05-15 (evening) — Class Hub consolidation: Attention tab folded into New Metrics ([PR #316](https://github.com/mattburto-spec/studioloom/pull/316))

**Context:** Pickup from a stranded handoff (`docs/handoff/claude__fold-attention-into-nm-tab.md` — the previous worktree was deleted mid-session before any code was written). The plan was already concrete: drop the Attention tab and mount `UnitAttentionPanel` inside the New Metrics tab so teachers have one surface for "who needs me this lesson + what are they being assessed on" rather than two adjacent tabs.

### What shipped
- `HubTab` union and `TABS` array in `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` drop the `"attention"` entry. URL parser adds an `?tab=attention` → `metrics` backward-compat redirect (alongside the existing `safety` → `badges` and `open-studio` → `studio` shims).
- New Metrics tab body reordered to: collapsible `<details>`-wrapped `NMElementsPanel` (open by default for fresh classes, collapsed once any element is configured — summary line shows N-of-12 count) → `UnitAttentionPanel` → `NMResultsPanel` → checkpoint-helper card.
- `UnitAttentionPanel` deliberately rendered OUTSIDE the `globalNmEnabled` gate. Journal / Kanban / Calibration signals don't depend on the NM competency picker, so the panel should still surface for schools that haven't enabled NM.
- Dead `activeTab === "attention"` block removed.

### Systems touched
- Modified: `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` (3 surgical edits — type, TABS, parser; one body restructure; one block deletion; net -14 lines)
- Test rewires: `src/components/teacher/__tests__/UnitAttentionPanel.test.ts` Class Hub wiring `describe` block flipped — now asserts `attention` removed from union/TABS, panel mounts inside metrics block, parser redirects `attention` → `metrics`
- Test allowance bump: `src/components/nm/__tests__/NMElementsPanel.test.ts` distance regex 800 → 1500 chars to accommodate the new `<details>`/`<summary>` markup between `activeTab === "metrics"` and `<NMElementsPanel>`
- No schema, no API, no AI call changes, no migrations

### Tests
- Targeted vitest run `src/components/teacher src/components/nm src/lib/unit-tools/attention`: 522/522 pass
- `tsc --noEmit` introduces zero new errors in touched files (pre-existing pipeline/adapter test errors unrelated)

### Saveme deltas (this entry)
- `docs/api-registry.yaml`: scanner rewrite of three `notes: null` rows (stale `student_briefs` "unknown table" warnings — `student_briefs` was added to schema-registry recently, scanner caught up). Not from this session, but the scanner is unconditional so it's bundled.
- `docs/ai-call-sites.yaml`: clean (no diff)
- `docs/scanner-reports/feature-flags.json`: status `drift` — pre-existing FU-CC/FU-DD long-tail, unchanged from morning
- `docs/scanner-reports/vendors.json`: status `ok`
- `docs/scanner-reports/rls-coverage.json`: status `clean`
- Migration drift: manual-mode SQL printed (no `DATABASE_URL`); no migrations applied this session so even if `applied_migrations` is mid-backfill (FU-PROD-MIGRATION-BACKLOG-AUDIT P1), nothing new is at stake from this session

### Process notes
- The handoff file lived in the main worktree (`/Users/matt/CWORK/questerra/docs/handoff/...`) but wasn't checked into git, so the new branch in a fresh worktree couldn't see it. I had to walk all sibling worktrees with `ls docs/handoff/` before finding it. Worth being explicit in future: handoffs are session-scoped artefacts, not committed by default — pickup needs to know which worktree wrote it.
- `gh pr merge --squash --delete-branch` failed the local fast-forward (main is checked out in `unruffled-edison-719dd4` worktree). Merge succeeded on GitHub (commit `34892cb1`); the remote branch was deleted explicitly via `gh api -X DELETE`. Same class of foot-gun as worktree-cwd issues: gh's merge-and-cleanup assumes main is available locally.

### Stale handoff cleanup
The old handoff `docs/handoff/claude__fold-attention-into-nm-tab.md` in the main worktree is now obsolete (the work is shipped). Matt to delete at convenience — it's untracked and worktree-local so it won't auto-clean.

---

## 2026-05-15 (PM) — Video suggestions: hardcoded-model CI fix + teacher search-criteria controls (2 PRs to main)

**Context:** Continuation of the morning 15 May session. Matt opened Gmail and surfaced 8+ CI failure notifications for PRs that had merged earlier in the day (including PRs #281/#282/#285 from this session). Investigation found a single root cause + a related architectural gap. Plus Matt asked for runtime control over the suggest-videos search criteria.

### CI red — root cause + recovery
Earlier today, `src/lib/video-suggestions/build-query.ts` (PR #281) hardcoded `"claude-haiku-4-5-20251001"` as a top-level constant. That tripped the wiring-lock guard test at `src/lib/frameworks/__tests__/render-path-fixtures.test.ts:no hardcoded model IDs in production code (5.13)` — the test scans `src/` for the canonical model strings outside `models.ts`. My auto-merge with `--auto --squash` merged anyway because CI is not a required check on this repo; the failure propagated post-merge to every subsequent PR on main until a separate Claude session patched `build-query.ts` to use `MODELS.HAIKU` (~03:46 UTC). CI green on main has held since.

**Companion fix shipped: [PR #307](https://github.com/mattburto-spec/studioloom/pull/307)** — `rerank.ts` still had `claude-sonnet-4-6` as a literal (a different Sonnet version, NOT the platform's `MODELS.SONNET = claude-sonnet-4-20250514`). The guard test only checks specific model-ID strings so it didn't fire, but the literal was a latent runtime risk (potential 404 if the version doesn't route) and an architectural inconsistency. Swapped to `MODELS.SONNET` with a comment noting that if Sonnet 4.6 is genuinely wanted long-term, add `MODELS.SONNET_LATEST` in `models.ts` first.

**Lesson banked:** auto-merge with `--auto --squash` does NOT block on CI when CI isn't a required status check. Either (a) make CI required on the repo, or (b) before merging anything with new model strings in non-test files, manually verify the wiring-lock guard passes. The guard catches the two specific hardcoded model IDs the platform has historically standardised on, but not arbitrary new ones — needs broadening if `MODELS.SONNET_LATEST` lands.

**Worktree slip mid-saveme:** I ran `git add -A && git commit` from the main worktree's shell cwd while another Claude session had `feat-class-dj-deezer-art-source` checked out there. The commit captured two of their untracked WIP docs onto someone else's branch. Recovered with `git reset HEAD~1` — no data lost. New memory saved: **"cd into the worktree before git operations"** — sanity-check with `git log --oneline -1` before commit, never trust the main worktree as a default cwd.

### Teacher search-criteria controls ([PR #310](https://github.com/mattburto-spec/studioloom/pull/310))
Always-visible controls bar at the top of the "✨ Suggest videos" modal:

- **Duration** pills — Short (<4 min) / Medium (4-20 min, default) / Long (>20 min) / Any (no filter). Maps to YouTube's `videoDuration` param; `any` skips the filter so post-fetch `maxDurationSeconds` is the only ceiling.
- **How many** pills — 3 (default) / 5 / 10. Larger counts pull bigger candidate pools (`searchLimit = max(10, count * 3)`), bump the re-ranker `maxTokens` budget linearly, and slice picks defensively so the model can't overshoot.
- **Extra keywords** text field — appended verbatim to the YouTube query as positive terms (e.g. "animation primary school").
- **Exclude keywords** text field — split on whitespace/comma and each term prefixed with `-` for YouTube's negation syntax (e.g. "music shorts" → `-music -shorts`).

Both keyword fields ALSO surface in the re-ranker prompt context so Claude understands the teacher's preferences when ranking — belt-and-braces (YouTube filter + AI awareness). Controls are sticky across opens within a session. New "Search with these settings" button re-runs with current control values + accumulated excluded-IDs.

New `composeFinalQuery` pure helper does the query composition; extracted so it's easy to unit-test. Tool schema `maxItems` bumped 3 → 10 to allow count=10. Defensive `picks.slice(0, count)` belt-and-braces against model overshoot. Metadata includes `requestedCount` for breakdown attribution.

### Systems touched
- Modified: `src/lib/video-suggestions/types.ts` (+4 fields on SuggestionContext), `build-query.ts` (composeFinalQuery helper, ~30 LOC), `fetch-youtube.ts` (DurationBucket type, optional duration param), `rerank.ts` (count threading, model-ID constant swap, picks slice), `route.ts` (body parser + allowlist validation + composeFinalQuery + searchLimit bump), `VideoSuggestionsModal.tsx` (controls UI + state + body pass-through)
- No new files, no migrations
- AI call sites unchanged (still 2 callsites via `callAnthropicMessages` at endpoint strings `teacher/suggest-videos:query` + `:rerank`)

### Open items (unchanged from morning saveme)
- **Matt — provision `YOUTUBE_API_KEY`** in Vercel + `.env.local` (route returns 503 until set)
- **Matt — provide 5-10 channel allowlist seed** for re-ranker boost (not blocking)
- **PR #276 close-out** — design brief, decisions baked into code, could close as superseded

### Tests
- `src/lib/video-suggestions`: 24 → 64 (+40)
  - 8 new `composeFinalQuery` pure-helper tests
  - 4 `composeRerankPrompt` count + teacher-keyword surface tests
  - 28 source-static wiring assertions across fetch-youtube / rerank / route / modal
- Model-ID guard (render-path-fixtures) still green
- tsc clean for all touched files

### Memory updates this session
- New feedback memory: **"cd into the worktree before git operations"** — shell cwd does NOT follow `git worktree add`; sanity-check with `git log --oneline -1` before commit
- (Earlier today) new feedback memory: **"Don't offer Vercel preview verification"** — Matt tests himself; never say "ping me to check the URL"

---

## 2026-05-15 — Unit Briefs Phase F arc complete (locks + per-student authoring + choice-card templates + AI assist)

**Context:** Phase A–E shipped a teacher-only Brief & Constraints surface (13–14 May). Phase F closes the loop by adding three unifying capabilities on top: per-field LOCK MODEL, STUDENT AUTHORING via a new `student_briefs` table, and CHOICE-CARD BRIEF TEMPLATES (G8 case). All three render through one unified `BriefDrawer` via the new `computeEffectiveBrief` 3-source merge. Plus AI assist (Haiku tool-use), Student-briefs teacher review tab, lock-all/open-all bulk actions, and the saveme to land it all.

### Phases shipped (10 PRs)
- **F.A — Schema migration ([PR #284](https://github.com/mattburto-spec/studioloom/pull/284))** — `20260514221522_briefs_phase_f_locks_and_student_briefs.sql` applied to prod. Adds `unit_briefs.locks JSONB`, 3 brief-template columns on `choice_cards` (`brief_text`, `brief_constraints`, `brief_locks`), new `student_briefs` table with UNIQUE(student_id, unit_id) + RLS policy `student_briefs_teacher_read` (class-enrollment chain) + 2 indexes + updated_at trigger. Sanity-check DO block asserts all columns/policies/triggers post-apply.
- **F.B — LockToggle UI on teacher editor (#284)** — `LockToggle` component per field on `UnitBriefEditor`. Initial dual-variant (compact/full) later collapsed to single high-contrast purple pill in the polish PR.
- **F.C — Choice-card brief-template editor ([PR #286](https://github.com/mattburto-spec/studioloom/pull/286))** — `ChoiceCardBriefTemplateEditor` embedded in the choice-card editor. Validators extracted to `src/lib/unit-brief/validators.ts` (`validateConstraints`, `validateLocks`, `coerceConstraints`, `coerceLocks`, `GENERIC_CONSTRAINTS`). Teacher choice-card PATCH route accepts brief-template fields; new GET drives the editor.
- **Hotfix — coerce-on-read for legacy JSONB shapes ([PR #291](https://github.com/mattburto-spec/studioloom/pull/291))** — Matt hit "dimensions must be an object" editing CO2 Dragsters constraints. Cause: Phase B swapped `dimensions` string→object app-side without a migration; editor's `{...value}` spread merge round-tripped legacy strings back to server, where new validator rejected them. Fix: `sanitiseDesignData` helper drops wrong-shape fields silently on read so `validateConstraints(coerceConstraints(garbage))` provably always succeeds. Banked as **Lesson #91** ("app-side JSONB shape changes need defensive coerce-on-read AND validate-on-write").
- **F.D — Student authoring + drawer merge logic ([PR #294](https://github.com/mattburto-spec/studioloom/pull/294))** — `computeEffectiveBrief` pure function in `src/lib/unit-brief/effective.ts` does the 3-source merge: locks (card > unit) and value (student > card > teacher > empty). Student `/api/student/unit-brief` GET returns `{ brief, amendments, cardTemplate, studentBrief }`; POST upserts `student_briefs` with partial-patch merge + lock check. `BriefDrawer` rewritten to consume 3 sources separately; locked fields render `<ReadOnlyTextBlock>`, unlocked fields render editable inputs (Editable textarea, DimensionsEditor, MaterialsEditor, RepeaterEditor, TextInputCommit) with a save-status pill + error pill in the sticky header. "Your project" banner appears when `cardTemplate` present.
- **F.E — Teacher Student-briefs review tab ([PR #299](https://github.com/mattburto-spec/studioloom/pull/299))** — `/api/teacher/unit-brief/student-briefs` GET (3-query enrichment: student_briefs + students display names + latest choice_card_selections with labels; `_pitch-your-own` synthetic label). New `StudentBriefsTab` component. Teacher brief page becomes a 2-tab container ("Brief" + "Student briefs").
- **Polish — bigger LockToggle pills + Lock all / Open all ([PR #302](https://github.com/mattburto-spec/studioloom/pull/302))** — LockToggle simplified to single pill (locked = `bg-purple-600 text-white uppercase`, open = `bg-white ring-gray-300`). UnitBriefEditor adds derived state (`lockedCount`, `allLocked`, `noneLocked`) + explainer banner with bulk Lock-all / Open-all buttons + count.
- **AI assist — Haiku tool-use brief proposal ([PR #306](https://github.com/mattburto-spec/studioloom/pull/306))** — New route `/api/teacher/unit-brief/generate` routes through `callAnthropicMessages` with `MODELS.HAIKU` + tool name `propose_brief`. System prompt explains field semantics + catalogue chip ids. User prompt builds from unit metadata + current draft + teacher prompt. Defensive narrows tool_use input (Lesson #39/#42), runs `validateConstraints`, falls back to `coerceConstraints` if invalid — suggestion is always renderable. Portal-mounted `AIBriefAssistModal` (Lesson #89) has prompt textarea + Generate + Regenerate + per-field Apply checkboxes (default ON) + `copyIfSelected` partial-patch helper. Trigger button on `UnitBriefEditor` disabled during saves.
- **F.F — Registry hygiene + saveme (THIS PR)** — schema-registry entries for `unit_briefs.locks`, new `student_briefs` table, `choice_cards.brief_*` columns; WIRING.yaml `unit-briefs` system bumped to v2 with full key_files + change_impacts; Lesson #91 banked; FU-BRIEFS-STUDENT-SELF-AUTHORED closed in platform-followups.

### Systems touched
- **Schema:** `unit_briefs` (+1 column), `choice_cards` (+3 columns), new `student_briefs` table. All via one migration applied to prod 15 May.
- **Code (added):** `src/lib/unit-brief/validators.ts`, `src/lib/unit-brief/effective.ts`, `src/app/api/teacher/unit-brief/generate/route.ts`, `src/app/api/teacher/unit-brief/student-briefs/route.ts`, `src/components/teacher/unit-brief/{LockToggle,AIBriefAssistModal,StudentBriefsTab,ChoiceCardBriefTemplateEditor}.tsx`
- **Code (extended):** `src/types/unit-brief.ts` (locks types + `EffectiveBriefField<T>`), `src/components/teacher/unit-brief/UnitBriefEditor.tsx` (locks state + AI assist trigger + bulk actions), `src/components/student/unit-brief/BriefDrawer.tsx` (3-source merge consumer), `src/app/api/student/unit-brief/route.ts` (cardTemplate + studentBrief), `src/app/teacher/units/[unitId]/brief/page.tsx` (2-tab container), choice-card PATCH/GET routes.
- **Registries:** `docs/schema-registry.yaml` (+1 table entry, 4 columns), `docs/projects/WIRING.yaml` (unit-briefs v1→v2), `docs/api-registry.yaml` + `docs/ai-call-sites.yaml` (auto-synced via scanner — new `teacher/unit-brief-generate` endpoint on Haiku).
- **Docs:** `docs/lessons-learned.md` (Lesson #91), `docs/projects/platform-followups.md` (close FU-BRIEFS-STUDENT-SELF-AUTHORED), this changelog entry.

### Open items
- **FU-BRIEFS-AUDIT-COVERAGE (P3, open)** — 5 audit-skipped POST routes (unit-brief, amendments, diagram, student-brief, generate) need `logAuditEvent` wired on the next audit-tightening sweep.
- **FU-BRIEFS-SERVICE-INQUIRY-ARCHETYPES (P3, open)** — real structured constraints for Service / Inquiry / PP unit types beyond the v1 generic fallback.
- **FU-BRIEFS-CO-TEACHER-READ-POLICY (P3, future)** — explicit co-teacher SELECT policy on `student_briefs` once Access Model v2 lands. V1 relies on service-role reads via `/api/teacher/*` routes.
- **FU-BRIEFS-STUDENT-DIAGRAM-UPLOAD (P3)** — `student_briefs.diagram_url` column reserved, no upload UI shipped; could let students attach their own spec diagram.

---

## 2026-05-15 — Auth security fix: student-classcode-login cross-class bypass ([studioloom#308](https://github.com/mattburto-spec/studioloom/pull/308))

**Context:** Matt reported students could log into a class they weren't enrolled in by entering its classcode + their own initials. Reproduction: G8 student "ER" entered the G9 classcode `SW3NLD` → login succeeded → dashboard showed "G8 Design" in the header (derived from `class_students` junction) while the session's authenticated class was G9. Internally inconsistent session state.

### Root cause
`/api/auth/student-classcode-login` had a 3-level student lookup chain. Levels 1+2 correctly required enrollment (junction table + legacy `students.class_id`). **Level 3 matched only on `(username, author_teacher_id)`** — i.e. "do I share a teacher with this class?" — and on success rewrote `students.class_id` to the spoofed class, corrupting the canonical column for ~50 downstream readers. A code comment on the predicate explicitly argued it was safe ("scope filter, not actor permission gate") — the reasoning held only if a teacher owned exactly one class.

### Fix shipped
- Deleted Level 3 entirely (22 lines removed from `route.ts`)
- Updated route comments to document the new 2-level enrollment-required chain and the security rationale
- Upgraded test mock to route students-table queries by first `.eq()` column (so Level 2 vs the removed Level 3 query shapes can be distinguished in tests)
- Added regression test wired to the exact SW3NLD scenario — asserts an orphan-shaped student matching the Level 3 pattern returns 401 instead of authenticating. Will flip red if anyone ever re-introduces a username-only fallback.
- Tests: 9 → 10 in `student-classcode-login/__tests__/route.test.ts`. All 12 auth route tests pass.

### Prod data repair
Audit found 6 students with corrupted `students.class_id` from past Level 3 firings (one as recent as the day before Matt reported it). Repaired via targeted UPDATE that re-synced the legacy column to each student's single active `class_students` enrollment:
- `sy`, `ez`, `er`, `ej`, `eb` — all had `students.class_id = b97888a4-...` (G9 class) but were actually enrolled in their real G8 class
- `hh` — opposite direction (corrupted to G8, actually enrolled in G9)

BEFORE state captured for rollback. Post-repair verify query returned 0 rows = no remaining drift between `students.class_id` and `class_students` enrollment.

### Systems touched
- Modified: `src/app/api/auth/student-classcode-login/route.ts` (-22 lines, +8 comment lines), `src/app/api/auth/student-classcode-login/__tests__/route.test.ts` (+41 lines)
- No migration. No schema change. No registry impact.
- New entries: lessons-learned #90 (auth fallbacks must verify membership in the specific target), decisions-log (delete Level 3 vs patch it)

### Open items
- None — bug closed, prod repaired, regression test in place.
- Long-term hygiene: deprecate `students.class_id` entirely once Access Model v2 cutover stabilises. Already tracked elsewhere; not blocked on this fix.

---

## 2026-05-15 — Lesson editor authoring polish + AI video suggestions v1 (5 PRs to main)

**Context:** Matt's three-item ask at the top of the session: (1) process journal questions weren't editable in the unit editor, (2) couldn't bold/bullet text in the unit editor, (3) wanted AI-suggested videos based on activity content. All three shipped in this session — five PRs landed on main, plus one open design brief.

### 1. Editable process journal questions ([PR #271](https://github.com/mattburto-spec/studioloom/pull/271))
Teachers can now edit the **label / placeholder / helper / required** flag on each prompt of a structured-prompts block (Process Journal, Strategy Canvas, Self-Reread, Final Reflection). Edits affect only the block being edited; preset arrays remain the defaults at block-creation time. Add/remove prompts deferred — presets are pedagogically tuned and rarely need structural change. New `updatePromptAt(index, patch)` helper performs immutable patches. Source-static test asserts the editor wiring + immutability invariants. Tests: 12 → 17 in `lis-d-editor-wiring.test.ts`.

### 2. Markdown toolbar — slot fields ([PR #274](https://github.com/mattburto-spec/studioloom/pull/274))
**Key finding pre-build:** the renderer (`MarkdownPrompt` via `react-markdown@10.1.0`) already supports `<strong>`, `<em>`, `<ul>`, `<ol>`, `<a>` end-to-end via allow-list (`p`/`strong`/`em`/`ul`/`ol`/`li`/`a` + `unwrapDisallowed`). The gap was purely the authoring UX — teachers had no way to discover the syntax. So this PR is a small toolbar (B / I / • / 1. / 🔗) above each of the three activity-prompt textareas, wrapping the selection with markdown syntax. Zero new deps. Pure helpers in `markdown-toolbar-helpers.ts` (`applyInlineWrap`, `applyLinePrefix`, `applyLink`) split out so unit tests are `.test.ts` not `.test.tsx` — vite import-analyser chokes on JSX from a TS test. 19 new pure-helper tests + 5 source-static wiring assertions.

### 3. Markdown toolbar — wider surfaces + Lesson Intro polish ([PR #275](https://github.com/mattburto-spec/studioloom/pull/275))
Extended the toolbar pattern to **LessonIntroEditor "Why this matters"** + **KeyCalloutEditor intro paragraph + each bullet body**. Skipped intentionally: lesson-intro Success criteria (list-per-line, no prose formatting expected), KeyCalloutEditor title (uses draft-on-blur for the magazine layout), bullet term/hint (single-line labels). New `RichTextarea` primitive wraps toolbar + textarea + own ref so future surfaces become a one-liner. **Lesson intro authoring room:** Matt's screenshot showed "Why this matters" clipping content below the visible area — bumped rows 3 → 5 + `resize-y` + `min-h-[5em]` on both textareas. Avoided shipping autogrow JS. Tests: 254 → 265 (+11 source-static).

### 4. AI video suggestions backend ([PR #281](https://github.com/mattburto-spec/studioloom/pull/281))
New route `POST /api/teacher/suggest-videos` — teachers click "Suggest videos" → backend returns up to 3 short embeddable video candidates. Pipeline: **Haiku 4.5** query builder (compresses block context → 6-10 word YouTube query) → **YouTube Data API v3** `search.list` + `videos.list` (safeSearch=strict, videoEmbeddable=true, videoDuration=medium, duration ≤ 20min) → **Sonnet 4.6** re-ranker (tool-use for structured JSON, hallucination guard matches picks back to input set). Both AI calls go through `callAnthropicMessages` with distinct endpoint strings (`teacher/suggest-videos:query` + `:rerank`) so the `/admin/ai-budget` breakdown view can attribute cost per phase. teacherId attribution triggers BYOK chain via `resolveCredentials`. Failure modes mapped to conventional HTTP statuses (400 / 401 / 403 / 429 / 502 / 503). Heuristic fallback when Haiku unavailable so route degrades gracefully. 24 new unit tests covering ISO 8601 duration parsing, thumbnail fallbacks, merge/filter logic, query sanitisation, prompt composition, hallucination guard. New env var `YOUTUBE_API_KEY` (registered in `feature-flags.yaml`, optional — route returns 503 when unset).

### 5. AI video suggestions UI ([PR #282](https://github.com/mattburto-spec/studioloom/pull/282))
**✨ Suggest videos with AI** button on every Activity Block Media tab → modal with 3 cards (embedded YouTube iframe via `toEmbedUrl`, title, channel, duration, AI-written caption) → Attach button writes `{ type: "video", url }` into `activity.media` (existing field, no schema change). Auto-runs on open. HTTP-status-scoped error states (503 / 429 / 400 / generic). "↻ Suggest different videos" accumulates `excludeVideoIds` so successive clicks fan out instead of repeating. `LessonEditor` threads `unitTitle` (coerced `null → undefined` at the boundary) to ActivityBlock so the AI gets unit context. Tests: 265 → 275 (+10 source-static wiring assertions).

### Design brief (open) — [PR #276](https://github.com/mattburto-spec/studioloom/pull/276)
`docs/projects/ai-video-suggestions-brief.md` — the decision doc that drove the v1 build. Matt's resolved decisions baked into the code: platform-paid, embeddable-only, grade from `unit.grade_level`, type tags off in v1. **Still pending:** Matt to provide a 5-10 channel allowlist seed for the re-ranker boost (not blocking — feature works without it). PR #276 itself is now historical reference — its "open questions" are answered.

### Systems touched
- New: `src/lib/video-suggestions/` (types, build-query, fetch-youtube, rerank), `src/lib/ai/markdown-toolbar-helpers.ts`, `src/components/teacher/lesson-editor/MarkdownToolbar.tsx`, `RichTextarea.tsx`, `VideoSuggestionsModal.tsx`, `src/app/api/teacher/suggest-videos/route.ts`, `docs/projects/ai-video-suggestions-brief.md`
- Modified: `ActivityBlock.tsx` (per-prompt editor + toolbar wiring + Suggest videos button + `unitTitle` prop), `SlotFieldEditor.tsx` (toolbar above each slot, extracted `SlotField` sub-component with own ref), `LessonIntroEditor.tsx` (RichTextarea + larger textareas), `KeyCalloutEditor.tsx` (RichTextarea on intro + bullet bodies), `LessonEditor.tsx` (thread `unitTitle`), `docs/feature-flags.yaml` (+`YOUTUBE_API_KEY` entry)
- AI call sites added: 2 (both via `callAnthropicMessages`, no new direct callers — chokepoint discipline maintained)
- New API route: 1 (`POST /api/teacher/suggest-videos`, gated by `requireTeacher`)

### Open items
- **Channel allowlist seed** — Matt to provide 5-10 trusted channels (Crash Course, Veritasium, etc.) for the re-ranker boost. Wire into `src/lib/video-suggestions/rerank.ts` system prompt as a soft preference once received.
- **Smoke test** — Matt to provision `YOUTUBE_API_KEY` in Vercel env vars + `.env.local`, then exercise the full flow on Vercel preview (open unit → Media tab → Suggest → preview cards → Attach → verify URL persists into `activity.media`). The route returns 503 with a friendly "ask Matt to configure" message until the key is in env. Per the new "Don't offer Vercel preview verification" memory: Matt tests this himself, no Claude verification.
- **PR #276 close-out** — either close as superseded or merge as historical record. Matt's call.

### Tests
- `src/components/teacher/lesson-editor`: 235 → 275 (+40)
- `src/lib/video-suggestions`: 0 → 24 (+24)
- tsc clean for all touched files across all 5 PRs

### Memory updated
- New feedback memory: **"Don't offer Vercel preview verification"** — after pushing a PR don't say "ping me to check the URL" or "I'll verify on preview"; Matt tests himself. Sharpens the existing "Don't gate on Matt's manual testing" memory.

---

## 2026-05-14 (PM) — Student feedback banner orphan-grade fix (PR #267)

**Context:** Matt smoke landed on the Class 4 — Studio (15 May) lesson page as the student. The green "Your teacher left feedback on 3 tiles on this lesson" banner was visible despite the page having **no activity tiles** (he'd deleted test blocks earlier).

**Root cause:** when a teacher deletes activity blocks from a lesson, the associated `student_tile_grades` rows stay behind. Schema doesn't cascade on tile deletion because tiles live inside `content_data` JSONB, not a separate FK-able table. The student banner counted ANY grade matching `(student_id, unit_id, page_id)` regardless of whether the `tile_id` still existed in the resolved page.

**Fix (server-side so all consumers benefit):**
- `loadTileFeedbackThreads()` accepts an optional `validTileIds: Set<string> | null` whitelist. Drops grades whose `tile_id` isn't in the set BEFORE querying turns. Backwards-compatible (null = legacy "return all" behaviour).
- `/api/student/tile-feedback` resolves the rendered page content (class_students → class_units → `resolveClassUnitContent` → `extractTilesFromPage`) and passes the live tile-ID set.
- Resolution wrapped in try/catch with `validTileIds = null` fallback — any resolution failure falls through to the legacy behaviour (worst case: pre-fix orphan banner; never blocks the lesson load).

**Tests:** 31/31 green across loader + route tests. Added 4 source-static guards each.

**Not fixed (deferred):** the orphan rows themselves stay in the DB. Benign post-fix (loader silently filters), but accumulate over time. Future migration could `DELETE` grades whose `tile_id` is no longer in current content. Not urgent — storage cost trivial, no UX impact post-fix.

**Systems touched:** student-feedback-loader (`src/lib/grading/tile-feedback-loader.ts`), `/api/student/tile-feedback` route.

---

## 2026-05-14 — Class DJ smoke polish (4 PRs to main)

Live smoke caught four gaps in the freshly-shipped Class DJ block. All four fixed and merged to main in the same session.

**Setup recap:** Class DJ Phase 7 closed yesterday — full pipeline from teacher launch → student mood/energy/veto vote → algorithmic Suggest 3 (mood-aggregation + k-means split detection + Pareto+MMR selection bracketed by LLM candidate-pool + narration) → teacher Pick → fairness-ledger update. First-time live smoke surfaced the work captured here.

**PR [#259](https://github.com/mattburto-spec/studioloom/pull/259)** (`acf067f`) — wire per-instance `ClassDjConfig` through to `/api/student/class-dj/suggest`. The route was hardcoded to `gateMinVotes = 3`, ignoring the teacher's `ClassDjConfigPanel` setting in the lesson editor. Solo-student smoke couldn't reach Suggest because the UI showed gate-met state at the configured threshold but the server rejected with 412 ("Need at least 3 votes, currently 1"). Server now accepts `{ gateMinVotes, maxSuggestions }` in body (clamped [1,10] / [1,3]); `ClassDjBlock` + `ClassDjTeacherControls` + `ResponseInput` plumb `section.classDjConfig` through.

**PR [#261](https://github.com/mattburto-spec/studioloom/pull/261)** (`ece7469`) — lower editor `GATE_MIN` 2→1. The lesson-editor `ClassDjConfigPanel` enforced brief §7's original `2–10` range and rejected `1`, so even after #259 wired config through, the field wouldn't accept the solo-student threshold. Now matches server clamp.

**PR [#263](https://github.com/mattburto-spec/studioloom/pull/263)** (`95c677a`) — `ClassDjSuggestionView` polish based on smoke feedback. Dropped the green "Open on Spotify ↗" button (schools don't want students leaving the lesson player; clashed visually with violet palette anyway — `spotify_url` still persists server-side for teacher use). Added a **participation dot-grid** (one violet dot per enrolled student, filled = voted; degrades to numeric badge above 50) replacing the "1 of 26 voted" text. Added **per-card mood pills** (`mood_tags.slice(0, 3)`) + **5-segment energy meter**. All three changes anti-strategic-voting safe per brief §11 Q9 — they describe the algorithm's classification of the *suggestion*, not the room's vote distribution.

**PR [#264](https://github.com/mattburto-spec/studioloom/pull/264)** (`8ec7487`) — compact teacher controls rewrite. Teaching Mode right-aside is 320px wide → ~250-260px effective render after parent + card padding. Previous controls stuffed two 3-col grids (suggestion cards + Pick buttons) + 5-col histograms into that space and got cut off. New `ClassDjTeacherControls` restructures around a sidebar-native compact panel: always-visible status strip (round badge + live timer + participation count), state-aware primary handle (▶ Start / 🎯 Suggest / ▶ Run again), secondary handle (End round early, always visible during LIVE), vertical suggestion pick list (40×40 thumb + name + tiny Pick → per row, replaces 3-col grid), collapsible "Show class mood" wrapping the existing `ClassDjLiveTeacherView` histograms (default closed). Students unaffected — main lesson player keeps the rich `ClassDjSuggestionView` 3-col grid.

**Verified:** Matt confirmed live mid-session — solo-student vote → Suggest fires → 3 picks render with dot-grid + mood/energy infographics + no Spotify button.

**Architecture clarification (Q from Matt, captured in session):** Class DJ scoping has three reset layers — (1) **per-round** (votes + suggestions wiped each Run again, keyed by `(class_id, unit_id, page_id, activity_id, class_round_index)`); (2) **per-block-instance** (new Class DJ block in any lesson = new `activity_id` = fresh "armed" state, no history visible); (3) **per-class persistent** (`class_dj_fairness_ledger` keyed `(class_id, student_id)` survives forever — served_score / voice_weight / seed_pickup_count carry across rounds + blocks + lessons until teacher resets; `class_dj_veto_overrides` keyed `(class_id, veto_text)` same scope).

**Tests:** 87/87 passing on the three class-dj component suites (no new tests filed; existing source-static wiring assertions still match the new structure). tsc clean for all touched files.

**No new migrations, no new AI call sites, no new vendors, no new feature flags. Registry drift caught by saveme:** api-registry picked up `class_units` as a table read on `/api/student/class-for-unit/[unitId]` (correct — 2-step query lookup).

**Open FUs filed during session (not yet in trackers):**
- `FU-CLASS-DJ-CONFIG-SERVER-RESOLVE` (P2) — server should resolve config from `unit.content_data` instead of trusting client body (current pattern lets a tampering student pass `gateMinVotes=1`; fine for Phase 6 since teacher owns the UI, tighten before pilot scale).

---

## 2026-05-13 / 14 — TFL.3 marking-page polish loop (C.6 + C.7 + 4 hotfixes)

**Context:** Pass C inbox shipped on 12 May (changelog entry below). 13 May Matt drove ~10 hours of smoke through the marking surfaces and surfaced a sequence of UX gaps + bugs. Each landed as a small focused PR (no batching). Same source-static-test discipline as the inbox build.

**What shipped (12 PRs across the marking surface):**
- **C.6.1 row-level Send (#245, 58d5643)** — one-click ✓ Send button on each row chip when state=ai_draft. **Reverted within hours** because it was "blind send" — teacher couldn't see student response before clicking. Regression guard added against the data-testid returning.
- **C.6.2 focus panel (#246, 50b0d92)** — master-detail panel at top of /teacher/marking. Prev/next traverses cohort one student at a time. Response left, AI draft right (editable, tweak buttons under it), Send & next + Skip below. Mirrors inbox C.2 layout but scoped to one class×tile. Row chip click loads student into the focus panel.
- **C.7 prompt tightening (#249, 97ec259)** — AI default 60-100w → 30-55w, 2 sentences MAX, locked positive-then-suggestion structure. "Shorter" directive rewritten to preserve BOTH halves (was collapsing to a single bland sentence). PROMPT_VERSION bumps v2.1.0→v2.2.0 + v1.0.0→v1.1.0.
- **C.7.1 Inspiration Board rendering + AI normalisation (#252, 9193ee7)** — IB JSON wasn't rendering in the focus panel + the AI was receiving raw JSON instead of student commentary. New `summariseInspirationBoardForAI()` flattens IB → readable text. Wired into all 3 AI routes (prescore, draft-followup, regenerate-draft).
- **C.7.2 IB link-card fallback (#255, 827a304)** — non-image URLs (student-pinned articles like d2ziran.com/article-...htm) rendered as broken `<img>` + 403'd CORS-error in DevTools. New `isLikelyImageUrl()` heuristic + onError fallback → renders a purple link card with hostname instead. Zero broken-image icons.
- **ai-prescore batch parallelisation (#256, b54e5f5)** — serial for-await loop → chunked Promise.all (CHUNK_SIZE=6). 24-student batch: ~60s → ~12-15s. Per-student error isolation preserved.
- **Student IB hydration fix (#258, fb9156f)** — student lesson view showed "0/5 uploaded" despite saved IB in DB. Root cause: `useState(() => parseValue(value))` lazy init only ran on mount; async server response → never re-hydrated. Fix: useEffect([value]) with useRef-guarded short-circuit to avoid clobber loops on user edits.
- **AI suggest skip-already-sent + inbox-loader sent-comment guard (#260, eec9f0a)** — re-running AI suggest on already-graded tile silently wiped confirmed=true + put all 47 sent students back into inbox as "AI drafted". Two fixes: (a) marking page filters to ungraded submitters by default; button label shows 3-way breakdown ("3 ungraded · 21 sent"); (b) inbox-loader requires no prior sent comment for the "drafted" bucket.
- **Focus panel counter fix (#265, 1aeab85)** — counter stuck at "1 of 24" no matter how far through. Root cause: bucket-rank sort moved done students to bottom → advanceToNext always landed at index 0 in re-sorted list. Fix: drop the sort; stable parent order; counter ticks 1/24 → 2/24 → 3/24.

**Telemetry/data:**
- New PROMPT_VERSION strings ready for /admin/ai-budget breakdown if Matt wants to compare cost/length before/after.
- All 4 AI helper paths (ai-prescore, ai-followup, regenerate-draft) now route Inspiration Board responses through the flattening helper — substantially better AI quality on IB tiles (the AI was previously grading JSON structure).

**Follow-ups filed today (3 new, 1 resolved):**
- ✅ `TFL3-FU-STUDENT-IB-IMAGES-MISSING` (P1) — resolved by the hydration fix above
- `TFL3-FU-STUDENTS-FALLING-BEHIND` (P1, new) — Matt asked: *"how do i catch the students falling behind?"* Cross-cutting; deserves its own focused brief. v1 scope captured: dashboard "Needs attention" panel + per-class badge + 48h threshold + nudge action. **Trigger phrase: "falling behind" / "students behind"**
- `TFL3-FU-INBOX-BULK-ACTIONS` (P2, new) — bulk-select on inbox for skip / mark resolved. v1 scope captured; deferred until real usage shows the pain.

**No new migrations this session.** Pure app work + prompt-string edits. Prompts can be reverted at any time without DB impact.

**Tests:** ~115/115 marking + 65/65 grading + 28/28 integrity + 22/22 marking-focus-panel green. tsc strict clean on all touched files.

**Systems touched:** teacher-marking-page (focus panel + filters), teacher-inbox (loader filter), grading-ai-prescore (parallel + prompts), grading-ai-followup (IB flatten), grading-regenerate-draft (IB flatten + prompts), student-inspiration-board (hydration), inspiration-board-preview (link cards).

Live smoke caught four gaps in the freshly-shipped Class DJ block. All four fixed and merged to main in the same session.

**Setup recap:** Class DJ Phase 7 closed yesterday — full pipeline from teacher launch → student mood/energy/veto vote → algorithmic Suggest 3 (mood-aggregation + k-means split detection + Pareto+MMR selection bracketed by LLM candidate-pool + narration) → teacher Pick → fairness-ledger update. First-time live smoke surfaced the work captured here.

**PR [#259](https://github.com/mattburto-spec/studioloom/pull/259)** (`acf067f`) — wire per-instance `ClassDjConfig` through to `/api/student/class-dj/suggest`. The route was hardcoded to `gateMinVotes = 3`, ignoring the teacher's `ClassDjConfigPanel` setting in the lesson editor. Solo-student smoke couldn't reach Suggest because the UI showed gate-met state at the configured threshold but the server rejected with 412 ("Need at least 3 votes, currently 1"). Server now accepts `{ gateMinVotes, maxSuggestions }` in body (clamped [1,10] / [1,3]); `ClassDjBlock` + `ClassDjTeacherControls` + `ResponseInput` plumb `section.classDjConfig` through.

**PR [#261](https://github.com/mattburto-spec/studioloom/pull/261)** (`ece7469`) — lower editor `GATE_MIN` 2→1. The lesson-editor `ClassDjConfigPanel` enforced brief §7's original `2–10` range and rejected `1`, so even after #259 wired config through, the field wouldn't accept the solo-student threshold. Now matches server clamp.

**PR [#263](https://github.com/mattburto-spec/studioloom/pull/263)** (`95c677a`) — `ClassDjSuggestionView` polish based on smoke feedback. Dropped the green "Open on Spotify ↗" button (schools don't want students leaving the lesson player; clashed visually with violet palette anyway — `spotify_url` still persists server-side for teacher use). Added a **participation dot-grid** (one violet dot per enrolled student, filled = voted; degrades to numeric badge above 50) replacing the "1 of 26 voted" text. Added **per-card mood pills** (`mood_tags.slice(0, 3)`) + **5-segment energy meter**. All three changes anti-strategic-voting safe per brief §11 Q9 — they describe the algorithm's classification of the *suggestion*, not the room's vote distribution.

**PR [#264](https://github.com/mattburto-spec/studioloom/pull/264)** (`8ec7487`) — compact teacher controls rewrite. Teaching Mode right-aside is 320px wide → ~250-260px effective render after parent + card padding. Previous controls stuffed two 3-col grids (suggestion cards + Pick buttons) + 5-col histograms into that space and got cut off. New `ClassDjTeacherControls` restructures around a sidebar-native compact panel: always-visible status strip (round badge + live timer + participation count), state-aware primary handle (▶ Start / 🎯 Suggest / ▶ Run again), secondary handle (End round early, always visible during LIVE), vertical suggestion pick list (40×40 thumb + name + tiny Pick → per row, replaces 3-col grid), collapsible "Show class mood" wrapping the existing `ClassDjLiveTeacherView` histograms (default closed). Students unaffected — main lesson player keeps the rich `ClassDjSuggestionView` 3-col grid.

**Verified:** Matt confirmed live mid-session — solo-student vote → Suggest fires → 3 picks render with dot-grid + mood/energy infographics + no Spotify button.

**Architecture clarification (Q from Matt, captured in session):** Class DJ scoping has three reset layers — (1) **per-round** (votes + suggestions wiped each Run again, keyed by `(class_id, unit_id, page_id, activity_id, class_round_index)`); (2) **per-block-instance** (new Class DJ block in any lesson = new `activity_id` = fresh "armed" state, no history visible); (3) **per-class persistent** (`class_dj_fairness_ledger` keyed `(class_id, student_id)` survives forever — served_score / voice_weight / seed_pickup_count carry across rounds + blocks + lessons until teacher resets; `class_dj_veto_overrides` keyed `(class_id, veto_text)` same scope).

**Tests:** 87/87 passing on the three class-dj component suites (no new tests filed; existing source-static wiring assertions still match the new structure). tsc clean for all touched files.

**No new migrations, no new AI call sites, no new vendors, no new feature flags. Registry drift caught by saveme:** api-registry picked up `class_units` as a table read on `/api/student/class-for-unit/[unitId]` (correct — 2-step query lookup).

**Open FUs filed during session (not yet in trackers):**
- `FU-CLASS-DJ-CONFIG-SERVER-RESOLVE` (P2) — server should resolve config from `unit.content_data` instead of trusting client body (current pattern lets a tampering student pass `gateMinVotes=1`; fine for Phase 6 since teacher owns the UI, tighten before pilot scale).

---

## 2026-05-14 — Teaching Mode whole-class view (real lesson location per student)

Closes a busy-teacher gap that surfaced live: after a partial-completion class, students return spread across L1/L2/L3. Teaching Mode used to scope its student list to the selected lesson — so opening today's L2 hid the L1 stragglers behind a "not_started" pill. The teacher had to switch between Unit Overview and per-lesson view to see what was actually happening.

**Change:** the student list always shows the whole class. Each row now reports the student's *actual* current lesson via a small badge (e.g. `L1 · User Profile`) — purple when matching the teacher's selected lesson, neutral grey otherwise. Default sort is "Lesson" (by current location, ascending), so L1 stragglers cluster at the top of the panel. The lesson dropdown still drives mini-lesson / projector / phase timer context — it just no longer filters the student list.

**Pace cohort upgrade (bonus):** pace z-score is now computed per-current-lesson. Each student is compared against peers on the SAME lesson rather than the global class — strictly more accurate when the cohort is split across lessons. Cohorts <5 stay unscored (existing minCohortSize guarantee).

**Shipped:** PR [#247](https://github.com/mattburto-spec/studioloom/pull/247) merged at `ba2429c`. 3 files changed (+198 / −154):
- `src/app/api/teacher/teach/live-status/route.ts` — always fetches all unit progress rows; per-student `currentLessonId / currentLessonIndex / currentLessonTitle` from most-recent `updated_at` row; pace bucketed by current lesson.
- `src/app/teacher/teach/[unitId]/page.tsx` — fetch URL drops `pageId`; `StudentLiveStatus` type extended; new "Lesson" sort (default); lesson badge rendered on each row.
- `src/components/teach/CheckInRow.tsx` — drop redundant `&& cohortStats` gate (paceZ presence already implies a valid ≥5 cohort).

**Verified:** Matt confirmed live in G8 session post-merge — badges render, sort clusters by lesson, dropdown no longer hides students.

**Registry drift caught by saveme:** api-registry picked up two changes — a previously-missing student route `/api/student/class-for-unit/[unitId]` (from PR #244, not registered) + the live-status route's new table reads (`class_units`, `units`).

**No migrations, no new flags, no new vendors. Tests touched: 0 regressions.**

---

## 2026-05-14 — Unit Briefs Foundation shipped end-to-end (Phases A–E + smoke fix)

Closes `FU-PLATFORM-BRIEF-AND-CONSTRAINTS-SURFACE` — the "students forget the brief by week 4" problem. New unit-level Brief & Constraints surface: teacher authors prose + Design constraints (H×W×D + materials whitelist with catalogue chips + custom additions + budget + audience + must-include/must-avoid) + spec diagram + amendment stack ("v2.0 add LEDs"). Students see a persistent **purple "📋 Brief v1.<N>" chip in the LessonSidebar** (between unit title and Project Board button) on every `/unit/[unitId]/*` page; clicking opens a portal-mounted slide-in drawer with the full brief, diagram, constraints card, and amendments oldest-first as the evolution story.

**Phases shipped (8 PRs):**
- **Phase A** (PR #233) — schema (2 tables + 1 type) + RLS + types + tests (Checkpoint A signed off 13/13)
- **Hotfix** (PR #234) — `units.unit_type` prod-drift Lesson #83 trap; switched to `select("*")` per Lesson #24
- **Phase B** (PR #233) — teacher editor + API routes + 3 UI components + audit-skip annotations
- **Smoke polish** (PR #235) — persistent SaveStatusPill, custom-materials free-text, structured H×W×D dimensions
- **Phase B.5** (PR #237) — spec diagram upload (1 column migration + storage proxy + DiagramUploader UI)
- **Phase C** (PR #238) — student API + BriefChip + BriefDrawer
- **Phase C smoke fix** (PR #240) — moved chip to LessonSidebar + portal-mounted drawer (Lesson #89 banked)
- **Phase D** (PR #241) — refetch-on-drawer-open so amendments added mid-session show up
- **Phase E** (this PR) — schema-registry + WIRING entries + Lesson #89 + changelog

**Numbers:**
- 3 new migrations (`unit_briefs_table` + `unit_brief_amendments_table` + `unit_briefs_diagram_url`) — all applied to prod with `applied_migrations` tracker rows logged
- 2 new tables — schema-registry +2 (`unit_briefs`, `unit_brief_amendments`)
- 7 new API routes — api-registry +7 (teacher: `/unit-brief` GET+POST, `/unit-brief/amendments` GET+POST, `/unit-brief/diagram` POST+DELETE; student: `/unit-brief` GET)
- 1 new system in WIRING (`unit-briefs`) — `complete`, depends_on units + classes + class_units + class_students + students + auth-system + content-forking; affects student-unit-chrome + teacher-unit-editor + lesson-sidebar
- 1 new lesson banked — Lesson #89 (`position: fixed` trapped by transformed ancestors → portal to `document.body`)
- 3 follow-ups filed: `FU-BRIEFS-STUDENT-SELF-AUTHORED` (P2 Phase F), `FU-BRIEFS-SERVICE-INQUIRY-ARCHETYPES` (P3), `FU-BRIEFS-AUDIT-COVERAGE` (P3 — 3 POST routes audit-skipped for now)
- Tests: 5709 → ~6035 passing (+326 net across the build, 0 regressions, 11 skipped)
- 2 surgical pre-flight catches: schema-registry's `platform_admins` table didn't exist (used v2 `user_profiles.is_platform_admin` pattern instead); audit-coverage scanner caught Phase B's missing skip annotations

**Spec drift / pre-flight wins:** Phase A pre-flight grep caught the brief's RLS spec referencing a non-existent `platform_admins` table; pre-flight registry cross-check found `user_profiles` listed `status: dropped` despite migrations still depending on it. Both flagged in the ASSUMPTIONS block, resolved in the migration body.

**Methodology bites:** (1) Lesson #83 bit me on `units.unit_type` — I trusted schema-registry instead of probing prod first, so PR #233 shipped with a column reference that 400'd on prod (migration 051 never applied). Mea culpa — fixed in #234 with `select("*")`. (2) Phase C smoke fix surfaced Lesson #89 — the drawer mounted inside BoldTopNav's transformed-ancestor chain trapped `position: fixed`. Portal fix is now the canonical pattern for any drawer/modal in the codebase.

---

## 2026-05-13 — Class DJ Activity Block built end-to-end (Phases 0–7)

The first **live-timed-parallel** Activity Block in StudioLoom. 60-second classroom music vote — students drop a mood/energy/veto/seed, deterministic 5-stage algorithm (MusicFX quadratic boost + k-means split detection + Pareto+MMR selection) bracketed by LLM at the seams (Stage 3 candidate-pool + Stage 5 narration). Spotify Web API enrichment drops hallucinations + explicit hits + blocklist matches. Per-class fairness ledger with EMA on `served_score` + clamped `voice_weight` prevents any single student's preferences from always winning. Hybrid tally disclosure: face-grid for students, full mood/energy histograms for teachers (anti-strategic-voting per Zou-Meir-Parkes 2015). Persistent-veto sunset (30-day window + teacher override panel) prevents the constraint set growing into an unwinnable region by week 10.

**Phases shipped:**
- Phase 0 — pre-flight close-out (LIS.D test fix + 8 forgotten migration tracker rows backfilled + 4 cross-cutting findings)
- Phase 1 — algorithm simulator + locked constants doc + 6 canonical captured-truth scenarios (M-DJ-1A SIGNED OFF)
- Phase 2 — schema (5 new tables) + RLS + activity_blocks library seed (applied to prod)
- Phase 3 — lesson editor integration (RESPONSE_TYPES + ClassDjConfigPanel + ActivitySection.classDjConfig)
- Phase 4 — vote/state API + student UI + useClassDjPolling hook + ResponseInput dispatch
- Phase 5 — AI candidate pool + Spotify enrichment + Stage 4 ranker + Stage 5 narration + suggestion view
- Phase 6 — teacher controls + Teaching Mode cockpit per-section dispatch + constraints panel
- Phase 7 — live-blocks pattern doc + registry sync + changelog (this entry)

**New systems registered in WIRING.yaml (5):** `class-dj-block` (new) + `lesson-editor` / `lesson-player` / `teaching-mode` / `ai-call-sites` (the 4 systems Phase 0 audit caught as missing despite brief §10 citing them as deps — Lesson #54 in action).

**Numbers:**
- 10 new API routes (4 student + 6 teacher) — api-registry 476 → 486
- 2 new AI call sites — ai-call-sites 22 → 24 (`student/class-dj-candidates` + `student/class-dj-narrate`, both Haiku, both teacherId-attributed)
- 5 new tables — schema-registry 123 → 128
- 1 new vendor — Spotify (metadata-only egress, no student PII)
- 2 new env vars — `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`
- 16 new code files (~3000 LOC) + 5 wiring test files (~210 source-static tests)
- Tests: 5718 → 5883 passing (+165 net, 0 regressions, 11 skipped)
- Estimated effort 3.5–4.5 days; actual 1 day (post-research synthesis sped the algorithm + decision-locking)

**Algorithm spec locked:** `docs/specs/class-dj-algorithm.md` — 13 constants (σ, MMR λ, EMA α, etc.), each cited (MusicFX 1998 / Pol.is 2021 / Stratigi 2021 / Brams-Fishburn 1983 / Maene FAccT 2025). 6 canonical scenarios with captured-truth assertions per Lesson #38.

**Pattern doc shipped:** `docs/specs/live-blocks-pattern.md` — template for the next live block (live-exit-ticket, live-crit, live-do-now, live-brainstorm). Codifies: per-section dispatch site (Teaching Mode + ResponseInput), 1s/2s role-aware polling discipline, sha256(class_id||class_round_index||suggest_count) PRNG seed, LLM-brackets-deterministic algorithm pattern, 5-table schema shape, fallback-tolerant Stage 5. Next live block estimated 1.5–2 days (vs Class DJ's 3.5).

**Cross-cutting follow-ups filed:**
- `FU-CLASS-DJ-CLASSID-RESOLUTION` (P2) — lesson page sources classId from student's active enrollment (platform-level concern, blocks every future live block).
- `FU-ACTIVITY-BLOCK-RESPONSE-TYPES-PICKER-SYNC` (P2) — lesson editor picker missing 8 active types that ARE rendered conditionally (pre-existing drift, not Class DJ-introduced).
- `FU-DJ-TEACHER-SUGGEST` (P3) — teacher cockpit Suggest button calls /api/student/.../suggest; works via shared cookie but needs cleaner teacher-only auth path.
- `FU-DJ-PROJECTOR-MIRROR` (P3) — projector page doesn't yet highlight the picked suggestion (polling lands but no dedicated highlight pane).
- `FU-DJ-REALTIME`, `FU-DJ-TEACHER-DASHBOARD`, `FU-DJ-STARTER-SURVEY`, `FU-DJ-PLAYED-FEEDBACK`, `FU-DJ-FAIRNESS-TUNING`, `FU-DJ-SELFLAUNCH`, `FU-DJ-APPLE-MUSIC`, `FU-DJ-PROJECTOR-ART`, `FU-DJ-CROSS-CLASS-TRENDS`, `FU-DJ-CLASS-PROFILE` — listed in brief §14.

**Lessons banked during the build:**
- Lesson #54 ack — WIRING.yaml citing 4 deps that didn't exist; Phase 7 registry sync now fills them.
- Lesson #83 ack — 8 forgotten applied_migrations tracker rows surfaced during Phase 0 drift check, backfilled inline.
- Schema drift on `activity_blocks` — Phase 2 INSERT failed on prod because `content_fingerprint NOT NULL` (added migration 068) wasn't in the column list I authored from migration 060. Lesson #54 family — read EVERY ALTER TABLE since the create migration, not just the create.
- Spotify Web API `\b` regex limitation on artists with leading special chars (e.g. `$uicideboy$`); current blocklist uses canonical names only — caught during Phase 5 truth capture.

**Next:** 🛑 Matt Checkpoint M-DJ-1 — live smoke with a real class. Drop the block at the start of a lesson, launch from Teaching Mode, 3+ students vote across 2+ devices, AI suggests, deterministic re-roll demonstrates reproducibility, verdict on suggestion quality + split-room handling + fairness perception across 2–3 consecutive rounds. Sign-off → merge to main → Matt pushes.

---

## 2026-05-13 (evening) — Teaching Mode Phase 1: CheckInRow + pace signals + doing-card surfacing + prod incident hotfix

**Context:** Long single session covering the design + build + ship of Teaching Mode's "check-in row" + a prod regression that wasn't mine + the doing-card pedagogical layer. Three named lessons banked (#87, #88).

**1. Phase 1 — CheckInRow + pace signals (PRs #221 → #222 revert → #224 reship).** Surfaces ≤3 students above the timer in Teaching Mode who need a teacher check-in. Three deterministic signals — *stuck* (existing `needsHelp`), *falling behind* (paceZ < −1.0 vs in-progress cohort), *absent-ish* (not_started && !isOnline). Per-chip snooze persists for the lesson, resets on lesson change. **No migration** — extends `/api/teacher/teach/live-status` to also return `paceZ` per student + `cohortStats` in summary (median/mean/stddev/n); reuses existing `responseCount`, zero new DB queries. New `src/lib/teaching-mode/pace.ts` pure module + 8 unit tests with hand-computed expected values (caught a brief arithmetic slip — Lesson #38 in action). Phase brief: `docs/projects/teaching-mode-checkin-row-phase-1-brief.md`. WIRING `teach-mode` entry refreshed + stale `key_files` paths fixed + dep-ref typo (`teaching-mode` → `teach-mode`) closed.

**2. PRs #225 + #227 + #228 — three rounds of smoke polish from Matt's G8 + G9 design science prep.**
- #225: empty state ("👀 Check-in — no students need attention right now") + relaxed visibility gate so the row appears whenever a class has touched the lesson, not just during live typing
- #227: cap stuck signal at 30m + drop misleading "X of N responses" copy → "slower than peers" + switch Phase Timer to compact mode (≈80px vs ≈200px)
- #228: **page-scoped online detection** (real fix for the "551m" stuck rendering — `isOnline` was unit-wide, conflated with page-level `lastActive`) + new `scaleWorkshopPhases` helper + 7 unit tests; Teaching Mode now scales baked phase durations to `teacher_profiles.typical_period_minutes` at render time (no content_data mutation). For Matt's 45-min-baked unit on a 60-min school setting: phases now render as 7/13/33/7.

**3. PR #230 — Doing-card surface.** Each student's current First Move "doing" kanban card title now shows under their name in the student grid (📌 Doing: <title>) and inside the check-in chip (`"Scott — idle 4m · Wheel design"`). Lets the teacher pivot from "are you working?" to "how's the wheel going?" — informed attention vs surveillance. Cheap query via `student_unit_kanban.doing_count > 0` index. Bridges the gap between StudioLoom and the external tools where most studio work happens (Onshape, hand tools, paper).

**4. Prod incident (PR #222 revert + PR #223 hotfix) — Next.js dynamic-route slug conflict.** Direct-to-main parallel "first-move" work shipped two sibling routes with mismatched slug names: `[unitId]/route.ts` (GET) + `[activityId]/commit/route.ts` (POST). Next.js can't resolve a path slot with two different dynamic names → route manifest reload fails → cross-route request hanging at Vercel's 900s function limit → teacher app SSR-rendered topnav but content below didn't hydrate. **PR #222 reverted my Phase 1** as a debugging move to clear it as a suspect; symptom persisted, confirming it wasn't mine. **PR #223** restructured the POST route to `commit/[activityId]` (literal segment before slug → no conflict). Single client call-site updated. Two lessons banked.

**5. Lessons banked:**
- **#87 — Next.js sibling dynamic-route segments must share a slug name; mismatched siblings break ROUTING ALL ROUTES.** CI green ≠ deploy-safe for routing changes. Filed `FU-CI-NEXT-ROUTING-SMOKE` (P1).
- **#88 — Revert-first when uncertain is correct even when wrong.** The PR #221 revert took ~5 minutes round-trip and disproved my code as the cause; subsequent diagnosis was on firmer ground.

**Test count:** 5631 → 5666+ (+8 pace, +7 scale-phases, +20 carried in from upstream PRs). Tests entered the session at 5631 (Phase 1 baseline) and the relevant /lib/teaching-mode subtree now stands at 24 tests across 3 files.

**Migrations applied to prod this session:** none (Phase 1 was deliberately no-migration — derives everything from existing `student_progress` + `student_unit_kanban`).

**Systems touched:** `teach-mode` (refreshed + key_files corrected + dep typo closed in WIRING), new file paths `src/lib/teaching-mode/{pace,scale-phases}.ts` + `src/components/teach/CheckInRow.tsx`.

**Known follow-ups filed inline:** `FU-TEACH-PACE-PER-ACTIVITY` (P2, new `activity_events` table for "stuck on inspiration-board 18m" specificity), `FU-TEACH-CHECKIN-AI-COPY` (P3, Haiku-suggested check-in questions), `FU-TEACH-RESPONSE-QUALITY` (P3, length/on-topic tie-breaker), `FU-TEACH-SNOOZE-PERSIST` (P3, DB-backed snoozes if needed), `FU-TEACH-DOING-CARD-STALE` (P3, auto-clear or visual cue for yesterday's commitments).

**PR sequence (7 merged to main):** #221 (Phase 1) → #222 (revert) → #223 (slug hotfix) → #224 (Phase 1 reship) → #225 (empty state) → #227 (smoke polish) → #228 (page-scoped online + period scaling) → #230 (doing card).

---

## 2026-05-12 — Unit Briefs Foundation phase brief drafted (planning only, no code)

**Context:** End-of-day planning session after the Product Brief / Pitch / Choice Cards day saveme merged. Matt raised the "students forget the brief by week 4" problem — design briefs and constraints get buried in PPT, lesson 1 cards, or docs. After a thinking-shape conversation, banked architectural decisions and wrote a phase brief for the foundational build.

**What's in this saveme:**
- `docs/projects/platform-followups.md` — new FU `FU-PLATFORM-BRIEF-AND-CONSTRAINTS-SURFACE` (MEDIUM) capturing the three-layer architecture (unit-level source + persistent student chip + optional activity-block reminder), three decisions Matt banked (Path 1 new tables, Design-only v1, append-only amendments), three architectural questions to answer before building, explicit "what NOT to build" list.
- `docs/projects/unit-briefs-foundation-brief.md` — full phase brief (~600 lines) covering 5 sub-phases A–E with named Matt Checkpoints, pre-flight ritual referencing Lessons #4/#24/#38/#41/#43-46/#54/#83/#86, registry cross-check table covering all 7 registries, full migration SQL (2 tables: `unit_briefs` + `unit_brief_amendments`) with RLS policies mirroring the Project Spec v2 pattern, stop triggers + don't-stop-for lists, three open questions deferred to pre-Phase-B, expected test delta ~+46, follow-ups likely to surface.

**Decisions banked (Matt, 12 May 2026):**
1. **Path 1** (new tables `unit_briefs` + `unit_brief_amendments`), not JSONB-on-units. Constraint shapes will diverge across unit types; structured tables are cleaner long-term.
2. **Design-only v1** — Service / Inquiry / PP get prose-only fallback. Real archetype schemas wait for actual use case.
3. **Amendments instead of edit-badges** — iteration is part of design ("v2.0 add LEDs to your microbit robot"). Append-only stack mirrors real client RFI / change-order behaviour. Version pill on the chip (`📋 Brief v1.2`) is self-documenting; no per-student tracking needed.

**Sub-phase plan (5 sub-phases, ~2-3 days):**
- A — Schema + types (½ day, +8 tests)
- B — Teacher editor + API (1 day, +18 tests)
- C — Student chip + drawer (½ day, +12 tests)
- D — Amendments lifecycle (½ day, +8 tests)
- E — Registry hygiene + saveme (30 min)

**Worktree plan:** Fresh `questerra-briefs` on branch `unit-briefs-foundation`. First commit on the new branch will cherry-pick this saveme's deliverables (FU + brief).

**Registry drift swept:** scanner picked up a small api-registry change unrelated to this work — one route's `tables_read` list gained `student_unit_kanban`. Carried in the commit.

**Systems touched (planning only — no code yet):** none. Brief is a planning artifact; the build phase will register `unit-briefs` as a new system in WIRING.yaml during Phase E.

**No code, no tests, no migrations changed.** Test count unchanged (~5631 baseline). Build starts in a fresh worktree on Matt's next session.

---

## 2026-05-13 — Preflight quantity (Option A) + Tier 2 per-class lesson scheduling + onboarding skip fix + relaxed DELETE gate + Teach-Mode edit-lesson shortcut

**Context:** Single long session that knocked out 5 unrelated wins driven by smoke-feedback from Matt's actual G8/G9 teaching — none of them blockers individually, all of them friction Matt hit during class.

**1. Preflight quantity (Option A) end-to-end — 6 commits + migration `20260513051223_fabrication_jobs_quantity` applied to prod.** Bug report: "students often want N copies of the same file (4 wheels, 2 axles) but the upload form is one-file-one-job — they submit 4 identical jobs and the teacher approves them 4 times." Added `quantity INT NOT NULL DEFAULT 1 CHECK (1..20)` to `fabrication_jobs`. Threaded the field through `validateUploadRequest` (Phase 2, +6 unit tests in `orchestration.test.ts`), the student upload form (Phase 3, −/[N]/+ stepper between preferred-color and the file dropzone with a purple "× N copies" chip when N > 1), and every render layer downstream (Phase 4): `FabJobRow` + `FabJobDetail` + `QueueRow` + `HistoryJobRow` + `StudentJobRow` raw shapes, selects, mappers, and a purple × N chip on `/fab/queue` (3 spots) + `/fab/jobs/[jobId]` (prominent banner "× N copies requested — print/cut all before marking complete") + `/teacher/preflight` queue + `/teacher/preflight/jobs/[jobId]` + `/teacher/students/[studentId]` Fabrication tab + `/fabrication` student overview. Tests +6 (orchestration validation), test fixture amended for `quantity: 1` default. All 409 fabrication lib tests green, tsc baseline 266 preserved. Multi-file uploads deliberately deferred ("keep it like this for now" — bigger architecture change, no demand signal yet). Commit chain `2c04345 → 01e5d87`.

**2. Tier 2 per-class lesson scheduling — `class_unit_lesson_schedule` table + editor page + Teaching Mode auto-jump.** Bug report: "I've written dates into lesson titles but Teaching Mode always opens to lesson 1." Migration `20260513034648_class_unit_lesson_schedule` adds per-class lesson dates (separate from `class_unit_planning_tasks` because the same unit may be taught to multiple cohorts at different paces). New `pickTodaysLessonId` helper (pure function, full unit tests) picks the lesson scheduled for today, or the closest past/future if today is empty. New `/teacher/classes/[classId]/schedule/[unitId]` schedule editor page. Teaching Mode now resolves the lesson to open via this helper. 5 commits `746d24c → 7897ec9`.

**3. Edit-lesson shortcut in Teaching Mode header** (`3ddb191`) — single icon button in the Teaching Mode header that deep-links to the class-local lesson editor for the currently-displayed lesson. Removes the 3-click round-trip Matt was doing every time a typo surfaced mid-class.

**4. Relaxed DELETE gate for orphaned students** — `verifyTeacherCanManageStudent` was nuking T2's active student if T1 (a former teacher) tried to hard-delete via their own /teacher/students surface. Relaxed gate (commits `8ea8ff0`, `3d9badb`, `cc0f9b8`) checks `class_students` for active enrollments — allows hard-delete only when the student has zero active classes anywhere. Mock harness extended with 4 new chains; 4 new tests for the relaxed-gate paths. CI break from the new mock shape resolved in `cc0f9b8`.

**5. Onboarding "nothing to share" skip fix** (`8aac95b`) — Learning Differences page in Studio Setup had a "skip" button that wasn't visually weighted equal to the option buttons, so students felt they had to pick one. Restyled to equal-weight pill so students who don't have a learning difference can move on without false-positives.

**Test count:** ~4868 → ~4874 (+6 from Preflight quantity validation + scheduling helper tests).

**Migrations applied to prod:** `20260513034648_class_unit_lesson_schedule`, `20260513051223_fabrication_jobs_quantity`. Both need `applied_migrations` tracker rows logged.

**RLS coverage:** 130 → 131 tables (added `class_unit_lesson_schedule` with full policies, 126/131 with-policies).

**Decisions banked:**
- Quantity is a display value, not a filter axis — no RLS or index changes. Scanner still scans the single source file; lab tech prints N copies and marks the single job complete.
- Per-class lesson scheduling is the right shape (not title-parsing) — same unit may be taught to multiple cohorts at different paces.
- Relaxed DELETE gate philosophy: a teacher can hard-delete a student only when that student has zero active class enrollments anywhere. Orphan cleanup yes; cross-teacher data destruction no.

**Follow-ups filed:** None new — multi-file Preflight uploads explicitly deferred ("keep like this for now").

**Afternoon follow-ups (post-saveme, same day):** 4 small journal-card fixes after Matt's class-day smoke surfaced cascading issues with the journal block scaffolding:

- **`1b53e48` — dropped per-block sentence starters from JOURNAL_PROMPTS.** Matt's call: defer sentence-starter scaffolding to a future cross-block system rather than authoring chips per preset. `sentenceStarters` field on `StructuredPrompt` stays for forward compat. Tests updated to ASSERT absence (regression guard).
- **`690ad87` — Phase C: criterion-based target backfill in MultiQuestionResponse adapter.** Found that prompts are SNAPSHOTTED into the activity block JSONB at create-time (`BlockPalette.tsx:235`), so journal blocks created before `a840a85` (this morning's `targetChars` shipping) still rendered 0/80. New `CRITERION_TARGET_DEFAULTS` map (DO=40, NOTICE=40, DECIDE=50, NEXT=30) provides fallback when the criterion tag is present but `targetChars` is not. Adapter extracted to `adapter.ts` sibling per Lesson #71 (pure logic in `.tsx` files isn't unit-testable in this repo's vitest config — vite chokes on JSX during import-analysis). 7 unit tests covering full precedence ladder.
- **`c0ac4d1` — Phase C-2: id-based target backfill.** Matt's lesson-1 example exposed an even older journal block predating LIS.D's criterion tags — neither `targetChars` nor `criterion` present. Added `ID_TARGET_DEFAULTS` keyed on prompt ids (`did`/`noticed`/`decided`/`next`) as a third-tier fallback. False-positive risk nil — those ids are journal-specific. 2 more tests; 9 total.
- **`85c587b` — sticky-complete guard in /api/student/progress.** Pre-existing bug Matt surfaced returning to a completed Lesson 1 to add more text — sidebar green tick disappeared. Root cause: `usePageResponses.ts:202` defaults autosave to `status: "in_progress"`, silently overwriting `"complete"` on every keystroke. Fix at the API: if incoming status would write `"in_progress"` AND the existing row is already `"complete"`, drop status from the upsert payload. Sticky semantics — only explicit "Complete & continue" + future "unmark" UI (none today) + teacher override can change a `"complete"` row's status. Applied to both page_id path and page_number fallback path.

**Final precedence ladder for journal target characters (lock for any future edit):**
1. `sp.targetChars` (explicit author override)
2. `CRITERION_TARGET_DEFAULTS[sp.criterion]` (Phase C)
3. `ID_TARGET_DEFAULTS[sp.id]` (Phase C-2)
4. `DEFAULT_TARGET` (80) — generic fallback
Capped by `softCharCap` throughout.

**Lesson banked:** Activity-block prompts are seeded into JSONB at create-time, NOT pulled live from the file. Any per-prompt-data change to a preset only affects FUTURE blocks. For existing blocks, the renderer needs a backfill path (criterion-key + id-key fallback maps) — design renderers to degrade gracefully when authoring fields are missing on older data.

**Lesson banked:** Worktree drift caught — this worktree (`/Users/matt/CWORK/questerra`) silently moved from `main` to `class-dj-block` mid-session. The Phase C fixes were committed/pushed cleanly because each `git push origin main` was running from another worktree (`.claude/worktrees/intelligent-thompson-2d91ab` is at `1b53e48`). Need to verify branch before commits in long sessions — `git rev-parse --abbrev-ref HEAD` at the start of each commit cycle.

---

## 2026-05-12 — Product Brief archetype expansion + Pitch-to-teacher workflow + Choice Cards re-pick (~10 PRs)

**Context:** Day-of-class polish session driven by Matt's G8 / G9 lesson needs. Started with "scale back v1 for tomorrow's class", drifted into "v1 is actually a mashup of three concerns" (already shipped previous session as the v2 split), and resolved here with: more archetypes for Product Brief (so students who aren't building toys/buildings have a home), a pitch-to-teacher workflow for the Other/Pitch-your-own archetype (so students with off-piste ideas don't get blocked), the matching Choice Cards "Pitch your own" entry-point + "Change my mind" affordance, and a clean retirement of v1 to stop confusing students.

**What shipped (~10 PRs in this branch's parent):**

1. **Product Brief — 4 new archetypes** added to `PRODUCT_BRIEF_ARCHETYPES`: Film/Video, Fashion/Wearable, Event/Service/Performance, Other/Pitch-your-own. Parallel-shipped a 5th: App/Digital Tool. Total 7 archetypes covering most G8 Design Mentor unit choices.
2. **Pitch-to-teacher workflow (Other archetype)** — added 5 pitch_* columns to `student_unit_product_briefs` via migration `20260512044835_product_brief_pitch_workflow.sql`:
   - `pitch_text` TEXT (2000-char cap)
   - `pitch_status` TEXT (`pending` | `approved` | `revise` | `rejected`, partial CHECK)
   - `pitch_teacher_note` TEXT (teacher feedback when revise/reject)
   - `pitch_decided_at` TIMESTAMPTZ
   - `pitch_decided_by` UUID FK → teachers
   - Partial index on (`pitch_status`) WHERE status IN (`pending`, `revise`)
3. **`PitchGate` sub-component** inside `ProductBriefResponse.tsx` — gates the 8-slot walker behind pitch approval. Status pill (Pending / Revise / Approved / Rejected). Teacher note rendered inline when revise/reject. State machine: null → pending → approved | revise | rejected. POST auto-flips null/revise → pending; refuses edit if approved/rejected (409).
4. **`POST/GET /api/teacher/product-brief-pitch`** — teacher decides (approve / revise / reject) with optional note. Uses `verifyTeacherCanManageStudent`. GET returns pending+revise queue across all teacher's classes. `// audit-skip:` rationale added (pedagogical action in pilot).
5. **`/teacher/pitches` page** — review queue with 3-button decision UI per card. Linked from teacher nav.
6. **Choice Cards `_pitch-your-own` entry-point card** — front-end already special-cased the sentinel; missing FK seed row was the bug. Hot-fix migration `20260512053424_seed_pitch_your_own_choice_card.sql` INSERTs the placeholder choice card row (with rollback safety guard).
7. **Choice Cards "Change my mind" affordance** — `ChoiceCardsBlock.tsx` now renders "← Change my mind" beside the picked confirmation. Local `setSelection(null)` only — no downstream cascade.
8. **v1 Project Spec retirement** — old unified block hidden from the editor + student render. v2 (3-block split) is the only spec surface now.
9. **Reopen-to-revise links** on all 4 completion summary cards (Product Brief, User Profile, Success Criteria, retired v1) — students can re-enter after "Finish & see summary" instead of being locked out until teacher deletes the row.
10. **Image-upload PII fix (PR #211)** — `formatAnswer` for image kind now emits `[Photo: <caption>]` instead of `[Photo] <URL>`. Root cause: 12-digit segments in unit UUIDs were matching the CN-landline PII regex when summaries posted to `student_progress.responses`. Marking page was 400-rejecting submissions. Lesson banked: don't moderate system-generated content as if it were user text.
11. **Materials chip catalogue** expanded from 6 → 12 entries (balsa, pine, 3mm ply, resin, cardboard, foamcore, 3D-print PLA, fabric, metal sheet, polymer clay, papier-mâché, mixed media).
12. **Misc UX polish** — "Race day" → "Project end" timeline label fix, term sync, Grade→Marking tab redirect, removed orphan "Continue to Timeline" CTA, top-nav infinite-loop hotfix via `useSpecBridge` ref pattern (banked as a hook in PR #184).

**Migrations applied to prod (2 this session):**
- `20260512044835_product_brief_pitch_workflow.sql` — 5 pitch_* columns + CHECK + partial index
- `20260512053424_seed_pitch_your_own_choice_card.sql` — FK seed for sentinel (with rollback guard)

**Tests:** ~5337 → ~5631 (+294 net across the day, including parallel TFL.3 Pass C work). tsc strict clean. PII allowlist updated for new prompt paths.

**Architecture decisions banked:**
1. **Loose coupling over cascade** — Choice Cards picks DON'T propagate into Product Brief / User Profile / Success Criteria. If a student changes their mind, their existing slot answers stay. Cost: occasional mismatch (student picked Toy, answered slots, then re-picked Building). Benefit: no event web, no rollback flows, no test matrix explosion. Matt's instinct ("I don't want to make things too dependent and start complicating the connections") validated. Filed `FU-PLATFORM-CHOICE-CARDS-DOWNSTREAM-CASCADE` (P3) — DO NOT build the cascade; ship soft warning only if Case 3 (re-pick after slot writes) bites in real classroom use.
2. **Sentinels in code need rows in tables** — `_pitch-your-own` ID was special-cased in TS but had no FK target. Postgres doesn't care about your TypeScript. Always seed the row when shipping a code-level sentinel that gets persisted.
3. **Don't moderate system-generated content as user text** — URLs, UUIDs, IDs, timestamps all look like PII to regex moderators. Strip them from the moderation payload, or moderate the user-controlled portion only.

**Follow-ups filed/updated (in `platform-followups.md`):**
- `FU-PLATFORM-CHOICE-CARDS-DOWNSTREAM-CASCADE` (P3) — downgraded to "ship soft warning only if Case 3 bites"
- `FU-PLATFORM-BLOCK-USAGE-HISTORY` (P3) — Matt's meta request: per-teacher usage telemetry on which blocks get picked + how often
- `FU-PLATFORM-FULL-ANONYMISER-MODE` (P3) — teacher-toggle to strip student identifying inputs at submit time
- `FU-PRODUCT-BRIEF-AI-PITCH-SCAFFOLD` (P2) — AI-assisted pitch drafting helper (deferred from this build to keep v1 class-usable today)
- `FU-PRODUCT-BRIEF-PITCH-REJECT-CLEANUP` (P3) — what happens to slot answers if pitch rejected after partial fill
- `FU-PRODUCT-BRIEF-AI-PITCH-EVAL` (P3) — auto-flag obviously-off-piste pitches for teacher review

**Systems touched:** project-spec-block (extended), choice-cards (extended with re-pick), teacher-pitches (new page + route), security (audit-skip annotation + PII regex lesson).

**Test posture at end of day:** ~5631 tests green. 2 migrations applied to prod. v1 Project Spec retired. v2 (3-block split) is the production spec surface.

---

## 2026-05-12 — TFL.3 Pass C complete (Teacher Marking Inbox end-to-end)

**Context:** Closed the TFL.3 Pass C brief end-to-end across a single session. The Teacher Marking Inbox at `/teacher/inbox` is now the daily-driver approve-and-go surface for teachers; the legacy `/teacher/marking` cohort heatmap stays as the deep-dive (one click away via "Open in marking page →").

**Sub-phases shipped (8 PRs):**
- **C.1** — Inbox surface + loader + nav rewire (PRs #193 / #195)
- **C.2** — Master-detail layout, sanitized response render, one-click approve, low-confidence warning chip (PR #198)
- **C.3** — Reply-draft AI helper + route + inbox auto-fires on reply_waiting (PR #204)
- **C.3.1** — Sentinel UX fix (Mark resolved button replaces Approve), relative timestamps, oldest-first sort
- **C.3.2** — 60s auto-refresh + marking page activePageId preservation (PR #206)
- **C.3.3** — Server-side persistent Mark resolved via migration `20260512023440_student_tile_grades_resolved_at` (resolved_at + resolved_by columns + partial index). Migration applied to prod + logged in `applied_migrations`. (PR #210)
- **C.4** — Four tweak buttons (Shorter / Warmer / Sharper / + Ask) with new `regenerateDraft` helper + `/api/teacher/grading/regenerate-draft` route. PII round-trip (real → placeholder → real) preserves the redaction discipline. (PR #213)
- **C.5** — TopNav Marking badge + `/api/teacher/inbox/count` endpoint. Amber tone when reply_waiting, purple-tint otherwise. 60s tab-aware polling shared with the inbox page. (PR #214)

**New helpers under `src/lib/grading/`:**
- `inbox-loader.ts` — 90-day window, 200-item HARD_CAP, state derivation (reply_waiting / drafted / no_draft), resolved_at re-surface filter
- `ai-followup.ts` — 3 sentiment-keyed prompts (got_it / not_sure / pushback) + NO_FOLLOWUP_SENTINEL fast-path
- `regenerate-draft.ts` — 4 directive prompts for tweak buttons
- `relative-time.ts` — compact "now / 5m / 3h / yest. / 3d / 8 May / May '25" formatter for queue rows

**New routes (all `requireTeacher` + ownership-checked):**
- `GET /api/teacher/inbox/items` — full item list
- `GET /api/teacher/inbox/count` — { total, replyWaiting } chip data
- `POST /api/teacher/grading/draft-followup` — Haiku-drafted follow-up
- `POST /api/teacher/grading/regenerate-draft` — tweak-button regeneration
- `POST /api/teacher/grading/resolve-thread` — persistent Mark resolved (writes resolved_at + audit log)

**Migration applied:** `20260512023440_student_tile_grades_resolved_at` (resolved_at TIMESTAMPTZ + resolved_by UUID FK + partial index). Logged to `public.applied_migrations`.

**Tests added:** ~140 new source-static assertions across 8 test files. Broader sweep landed at 841/841 green pre-C.5, 831/831 with C.5 in (count varies as suites get added/touched). tsc strict clean on all touched files.

**PII discipline:** all 4 new prompt-construction paths (`ai-followup.ts`, `regenerate-draft.ts` + their routes) added to `REDACTION_ALLOWLIST` in `no-pii-in-ai-prompts.test.ts` with dated justifications.

**Decisions banked:**
- Mark resolved → Skip semantics for got_it sentinel (purple "Mark resolved" button), distinct from Approve & send (emerald) and low-confidence Approve (amber).
- Resolution persistence: started localStorage (PR #208, abandoned + closed), promoted to DB column when cross-device case landed in Matt's feedback within minutes of v1 ship.
- Tweak directives stored client-side only (followupDrafts / draftEdits) — no persistence beyond session. Reload restores the AI's original draft.
- Marking nav badge polls a thin /count endpoint, NOT the full /items endpoint — 60s × N teachers shouldn't burn the loader query that often.
- Oldest-first sort across all 3 buckets (not newest-first for reply_waiting). Backlog floats to top so it gets cleared.

**Follow-ups filed (3 new in `grading-followups.md`):**
- `TFL3-FU-INBOX-COHORT-COMPARISON` (P3) — class-level pattern view inside the inbox
- `TFL3-FU-ASK-TEMPLATES` (P3) — preset chips for the + Ask flow once usage data shows recurring instructions
- `TFL3-FU-INBOX-PUSH-ESCALATION` (P3) — Resend / bell escalation when reply_waiting count or item age crosses a threshold

**Systems touched:** teacher-inbox (new), grading (extended), teacher-dashboard-v2 (nav badge), security (PII allowlist additions).

---

## 2026-05-11/12 — Project Spec v2 split (3 new blocks + shared library)

**Context:** After v1 unified Project Spec shipped (11 May), Matt's observation that the 7 Qs were a mashup of three concerns (product / user / success criteria) drove a phase brief for splitting into three focused blocks. Built end-to-end the same evening per `docs/projects/project-spec-v2-split-brief.md`.

**What shipped (5 PRs):**

1. **PR #188 — Phase A (schema + types)**
   - 3 new tables, all parallel + additive (no FK between them, no v1 changes):
     - `student_unit_product_briefs` (9 slots, archetype-driven)
     - `student_unit_user_profiles` (8 slots, universal)
     - `student_unit_success_criteria` (5 slots, universal)
   - `ResponseType` union extended with `"product-brief" | "user-profile" | "success-criteria"`
   - RESPONSE_TYPE_LABELS / ICON (🧰/👤/🎯) / TINT entries
   - All 3 migrations applied to prod via Supabase SQL editor

2. **PR #191 — Phase B+C (shared library + Product Brief block)**
   - **Phase B refactor:** v1's 800-line `ProjectSpecResponse.tsx` → **301 lines** (-62%) by extracting:
     - `src/lib/project-spec/format.ts` — `isValueNonEmpty`, `computeLengthHint`, `formatAnswer`, `buildSummary` (generic across slot counts via `SummaryEntry[]` array)
     - `src/components/student/project-spec/shared/SlotInput.tsx` — 5-input dispatcher (later +2: multi-chip-picker, image-upload)
     - `src/components/student/project-spec/shared/SlotWalker.tsx` — parameterised walker shell (`headerLabel` + `totalSlots` props)
     - `src/components/student/project-spec/shared/ArchetypePicker.tsx` — Q0 chip picker
     - `src/components/student/project-spec/shared/useSpecBridge.ts` — PR #184 ref pattern bottled into a reusable hook (banked critical lesson)
   - **Phase C:** Product Brief block (🧰) — 9 slots, archetype-driven via `PRODUCT_BRIEF_ARCHETYPES`. New `multi-chip-picker` input kind for Constraints slot (6 chips, cap 3). Slots: name / pitch / mechanism / primary material / secondary material / scale / constraints / precedents / technical risks.

3. **PR #194 — Phase D (User Profile + image upload)**
   - New private storage bucket `user-profile-photos` with service-role RLS (migration `20260511221713`, Option B from brief §12.4 — dedicated bucket not shared with `responses`).
   - New `image-upload` SlotInputType variant + ImageUploadInput sub-component (10MB cap, file picker, thumbnail + Replace + Remove + inline caption).
   - User Profile block (👤) — 8 slots, universal. Slots: name+relationship / age band / context / problem / alternatives (2-field) / unique value / **optional photo** / optional quote.
   - Photo upload route `/api/student/user-profile/upload-photo` (FormData, moderates via `moderateAndLog`, returns proxy URL).
   - `SlotWalker` gained optional `onUploadImage` callback — pure UI dispatcher, block owns the POST.

4. **Phase E+F PR (this commit) — Success Criteria + registries**
   - Success Criteria block (🎯) — 5 slots, universal. Slots: observable success signal / measurement protocol (chip picker) / test setup (4-field where/when/how long/who watches) / failure mode / iteration trigger.
   - 3 new entries in `schema-registry.yaml` documenting product_briefs / user_profiles / success_criteria tables (RLS policies, columns, writers, readers, applied_via).
   - `WIRING.yaml` `project-spec-block` system bumped to currentVersion: 2 — now documents the whole v1 + v2 family (4 tables, 4 components, 4 API routes, 5 migrations).
   - `api-registry.yaml` auto-synced via `scan-api-routes.py --apply`.
   - 9 follow-ups filed in `project-spec-v2-followups.md`.

**Architecture decisions banked:**
- **Three separate tables, not one with sub-types.** Each block evolves independently. Future blocks can add slots without coordinating.
- **Shared library extraction.** Walker / picker / dispatcher / hook live in one place; 4 consumers (v1 + 3 v2 blocks) compose them.
- **Image upload via callback pattern.** SlotInput stays pure UI; block component owns the POST endpoint. Different blocks can upload to different buckets.
- **useSpecBridge hook bakes Lesson #82.** Ref-captured onChange — never put a callback prop in a useEffect dep array unless the parent guarantees stable identity.
- **v1 frozen + coexisting.** Both v1 and v2 in BlockPalette during pilot. v1 retired via `FU-PSV2-V1-DEPRECATION` (P3) after 90 days of zero new inserts.

**Test posture:** 5370 → 5385 (4 new tests added by Phase D unrelated work; v2 build added no regressions). tsc strict clean across every commit. `verify-no-collision.sh` clean for all 4 migrations.

**Code stats (v2 surface):**
- 5 shared files (~700 lines) — extracted from v1's 800-line component
- 3 v2 slot-definition files (~600 lines combined)
- 3 v2 components (~700 lines combined)
- 4 v2 API routes (~600 lines combined)
- 4 v2 migrations (~400 lines combined)

**Open follow-ups (9):** aggregated student view (P3), per-block AI mentor (P2), user-photo moderation policy (P2), Class Gallery user-research surfacing (P2), cross-block sync (P3), v1 deprecation (P3), archetypes 3-6 (P3), archetype versioning (P3), teacher RLS via Access v2 (P2).

---

## 2026-05-11 — Project Spec Block v1 (lesson-page activity for G9 first session)

**Context:** Matt's G9 design class opens StudioLoom for the first time on 12 May 2026 (14 sessions, 12 May → 16 June). Original brief scoped 7 phases including timeline/kanban auto-seeding and AI mentor pass. Matt scaled back at scope-review: "all seems very complicated. can we scale back the scope of the block for tomorrows class. dont want to wreck timeline or kanban in rushing this." Final v1 scope: lesson-page activity card, own table, own API, no kanban/timeline writes, no AI calls, two archetypes hardcoded in TS.

**What shipped (4 commits on `claude/festive-pike-64401d` worktree):**
1. **Migration `20260511083114_student_unit_project_specs`** — new table, one row per (student, unit). 7 JSONB slot columns + archetype_id (kebab-case string, no FK). UNIQUE(student_id, unit_id). Single teacher-SELECT RLS policy via `class_units` join (Lesson #4 — students bypass RLS via service-role API). Down migration has safety guard: refuses if any archetype_id is set. `verify-no-collision.sh` clean.
2. **Component + types + dispatch** — `"project-spec"` added to `ResponseType` union; `RESPONSE_TYPE_LABELS`/`RESPONSE_ICON` (📐)/`RESPONSE_TINT` (#7C3AED) wired. `ARCHETYPES` registry with Toy (🧸) + Architecture (🏛️) and full slot copy from the brief. 5 input types: text, text-multifield, chip-picker, size-reference, number-pair. `ProjectSpecResponse` (~620 LOC) renders 3 phases: archetype picker → walker (Q1-Q7 with skip, length nudge, examples drawer, progress bar) → read-only Project Card. Dispatched from `ResponseInput.tsx` when `responseType === "project-spec" && unitId`.
3. **API + BlockPalette + follow-ups** — `/api/student/project-spec` GET (returns empty initial if no row) + POST (partial-patch upsert, server-merge to preserve unspecified fields, `completed: true` sets `completed_at = now()`). Validates archetype_id against `ARCHETYPES` registry. BlockPalette entry in Response category so Matt can drag-drop into tomorrow's lesson. 9 follow-ups filed in `project-spec-followups.md` covering everything cut from the original brief.
4. **Registries** — api-registry scanner auto-picked up GET + POST; schema-registry entry added for `student_unit_project_specs` (also flagged spec_drift in the kanban + timeline entries: they claim a `students_manage_own` policy that doesn't exist in the actual migration); WIRING.yaml gained `project-spec-block` system entry.

**Architecture decision:** Mirrored the `structured-prompts` (AG.1) pattern as precedent rather than building a new mount mechanism. Same dispatch shape, same auth pattern, same persistence boundary (own table, own API). Students use token sessions; teacher RLS via `class_units` join (mirrors AG.2.1 kanban). Archetype copy lives in TS source (`src/lib/project-spec/archetypes.ts`) not a DB table — keeps v1 to a single migration. Archetype IDs are stable kebab-case strings and load-bearing once student rows reference them.

**Test posture:** Tests 5337 → 5337 (stable). tsc strict clean across all modified files (`src/types/index.ts`, `ActivityBlock.tsx`, `ResponseInput.tsx`, `BlockPalette.tsx`, `archetypes.ts`, `ProjectSpecResponse.tsx`, API route).

**Dev-server smoke** (this worktree, no `.env.local` Supabase keys): server starts clean, homepage renders, `/api/student/project-spec` compiles + reachable + hits `requireStudentSession` correctly (500 because no Supabase env, not a code bug). End-to-end student smoke deferred to Vercel-preview by Matt after migration applied + push.

**Cut from v1 (filed as FUs):** mentor sharpening pass (Haiku), teacher RLS via Access Model v2 (`class_members`), auto-seed kanban from slots 4 + 6, auto-seed timeline success anchor from slot 7, archetypes 3-6 (Film / App / Fashion / Event-Service), generic-words nudge detector, free-text Q0 AI classifier, teacher archetype editor (CMS), archetype versioning strategy, class_id backfill. See `docs/projects/project-spec-followups.md`.

**Pre-merge needs from Matt:** (1) apply migration `20260511083114_student_unit_project_specs.sql` to prod Supabase; (2) `git push` to trigger Vercel deploy; (3) drag Project Spec block into tomorrow's G9 lesson via the BlockPalette; (4) smoke as a test student before class.

**Worktree:** `/Users/matt/CWORK/questerra/.claude/worktrees/festive-pike-64401d`, branch `claude/festive-pike-64401d`. 4 commits ahead of `origin/main`, not pushed (Matt pushes from terminal).

**Worktree notes from saveme reminder:** Main worktree at `/Users/matt/CWORK/questerra` still has 13 modified + 4 untracked files from prior unsaved session — flagged in pre-flight, untouched by this session. Worth a `saveme` from whoever owns that state.

---

## 2026-05-11 (PM) — Summative Lessons reconciled as B′ (presentation moves on Task System); DEFERRED to next semester

**Context:** Matt opened a new session to scope a "Summative Lessons" feature — distinct lesson type with menu icon/colour + inline rubric + per-criterion scoring on the lesson page. Wanted a master spec drafted at `docs/projects/summative-lessons.md` with phases + checkpoints per build-methodology.

**Stop trigger fired during audit-before-touch.** Found that the work Matt was describing has substantial pre-existing architecture under a different name:

- Task System Architecture brief signed off 5 May 2026 — explicitly rejected a "summative as lesson type" framing ("Supersedes... the would-be `summative-tasks.md` brief I almost wrote on 4 May") in favour of summative as a `task_type` discriminator on unified `assessment_tasks`
- Migration `20260505032750_task_system_v1_schema.sql` applied to prod: `assessment_tasks` + `task_lesson_links` + `task_criterion_weights` + `submissions` (with `draft→submitted→graded→returned` state machine, exactly what Matt specced) + `grade_entries` — all 5 tables live
- TG.0C (Tasks panel sidebar + Quick-Check inline formative form) MERGED to main
- TG.0D (5-tab summative project-task drawer) BUILT, awaiting smoke

**Audit also found:** active LIS worktree (`questerra-lis`, `lesson-input-surfaces-integration` branch) editing the student lesson renderer right now — collides with the proposed inline-rubric work. Flagged as coordination concern.

**Resolution path:** ran a self-contained reconciliation prompt by Cowork + Gemini independently (same pattern as 4-5 May Task System review + 9 May Procurement audit). Both reviewers independently picked **Option B = keep locked architecture, deliver visibility/inline-rubric/accessibility as presentation moves on top**. Cowork refined to **B′ = B + three named presentation moves**:

- **B′(a)** — Lesson menu visual differentiation (icon + colour, accessibility satisfied) when row has `task_lesson_links` entry pointing at summative task. Sibling to TG.0E.
- **B′(b)** — Inline rubric + score inputs on the lesson page (TG.0F redesigned to render inside the lesson view, not standalone `/(student)/tasks/[taskId]/submit`).
- **B′(c)** — "Where does this happen?" first question in TG.0D drawer + auto-create-lesson writer path for single-lesson summatives.

Deepest reasons both reviewers cited: UbD explicitly stages assessment design (Stage 2) BEFORE lesson design (Stage 3) — Option A collapses them, reinforcing the coverage-teaching anti-pattern UbD was written to fix; every major LMS (Toddle, ManageBac, Canvas, Schoology, Seesaw, Schoolbox) keeps assessment as a first-class entity separate from lessons; Option A degenerates `task_lesson_links` to a self-pointer + reinvents Option B with a worse entry point; A and C both let first-year MYP teachers skip the GRASPS scaffold, calcifying the habit MYP coordinators spend years trying to undo.

**Matt accepted B′ and DEFERRED to next semester** — rest of current semester is formative-only testing in StudioLoom. Estimate when picked up: ~3–4 days. No schema change. No throwaway. Sequence: smoke + merge TG.0D, then B′(c) as TG.0D follow-up, then B′(a) (possibly with TG.0E), then B′(b) (after LIS merge).

**What was recorded (5 surfaces touched):**
- NEW `docs/projects/summative-lessons.md` — primary record with TL;DR, B′ moves, what's NOT changing, when to pick up, coordination concerns, reading order. Trigger phrase "continue summative lessons" or "summative" documented inline.
- NEW `docs/projects/summative-lessons-reviews-2026-05-11.md` — full verbatim Cowork + Gemini reviews + convergence/divergence tables. Load-bearing source material; preserve verbatim.
- EDIT `docs/projects/ALL-PROJECTS.md` — new entry under 🔵 Planned (just above Skills Library).
- EDIT `docs/projects/task-system-architecture.md` — added "Amendment — Summative Lessons (B′) presentation moves (11 May 2026)" section after Final Notes so future readers of the locked brief see B′ exists.
- EDIT `docs/decisions-log.md` — appended dated entry capturing the conflict + reviews + the methodology lesson (this is the stop-trigger pattern working as designed).

**Systems affected:** None at code level (no schema, no API, no AI calls, no migrations). Documentation + decision-log only.

**Tests:** No code changes. Test suite unchanged.

**Registry sync:** api-registry picked up one drift — new `/api/teacher/upload-image` route exists in main but wasn't in the registry (from a prior unsynced session, not from this session). Committed via saveme.

**Methodology note banked:** this session is the stop-trigger pattern from build-methodology.md working as designed. Pre-flight audit-before-touch surfaced architecture conflict; paused before drafting; used independent review (Cowork + Gemini, same pattern as prior sessions) to resolve. Cost to pause: ~30 min. Cost to skip: a wasted spec contradicting locked architecture + 3–5 days TG.0D throwaway. The audit-before-touch is the saving grace.

**Pending verification:** when picking up B′ next semester, screen-share Toddle's actual summative task UX as a rationalisation-root check (Cowork's specific recommendation). If Matt's mental model is "Toddle's summatives are a kind of LE," that's the rationalisation root and worth surfacing. Toddle's actual pattern (Tasks separate from LEs) is the strongest external validation for B′.

**Unrelated WIP in main worktree (NOT touched this session):** dashboard.html + privacy-first-positioning.md modifications + untracked world-class-procurement-readiness.md from prior procurement-readiness work. Left alone for whoever owns that work to saveme.

---

## 2026-05-11 — Tap-a-word reliability: Path A (provider) + Path B (markdown root cause) + Lesson #82

**Context:** Matt: "tap a word is still buggy. we need to get to the bottom of it. sometimes need to click 4 times with 4 different outcomes (no popup / quick popup gone / loading then gone / works)." Despite multiple rounds of defensive patching since 27 April, the popover was still flaky in prod. This session traced the bug to its structural root cause and shipped both a defensive workaround and the actual fix.

**Investigation timeline (round 25 diagnostic methodology):**
1. **Existing console.debug logs were silent in prod** — gated on `NODE_ENV !== "production"`. Couldn't see anything from studioloom.org.
2. **Built a localStorage-gated logger** (`debug.ts`, commit `16fac5a`). Set `localStorage.setItem("tap-a-word-debug", "1")`, refresh, ALL tap-a-word events log via `console.log` (visible in default Info filter).
3. **First trace (commit `c9ce573`)** — added `TappableText` lifecycle logs (mount / unmount / popover-state-changed) plus per-instance IDs. Pinned the bug as "popover unmounts with no dismiss reason" — meaning openWord wasn't being nulled by the close flow.
4. **Second trace (commit `3b26b22`)** — added `console.trace()` on TappableText unmount. Showed the call stack reached React's scheduler (`postMessage` + `unstable_scheduleCallback`), confirming a deferred state update was triggering the unmount, not a synchronous click handler.
5. **Code inspection of MarkdownPrompt** — found the smoking gun: inline `components={{ p, strong, em, li, a }}` prop with new function references on every render.

**Path A — defensive (commit `5599314`):** New `TapAWordProvider` lives in `(student)/layout.tsx`. Owns global `openWord`, captured anchor element + cached rect fallback, the `useWordLookup` lifecycle, and renders ONE `<WordPopover>` for the entire student app. `TappableText` becomes a thin renderer that calls `useTapAWord().open()` on click and owns no popover state. `WordPopover` now accepts an optional `anchorEl` (preferred when `.isConnected`) plus a required `anchorRectFallback: DOMRect` (used when the anchor has detached from DOM). Net: the popover survives any parent re-render that destroys the original button, because the popover lives one level above.

**Path B — root cause (commit `2e58127`):** `MarkdownPrompt` was creating brand new `components` object + brand new inline functions for `p`, `strong`, `em`, `li`, `a` on every render. `react-markdown` uses these as React component types via `React.createElement(components[nodeName], props)` — new references mean different component types to React's reconciler → entire subtree unmount/remount cascade. Fix: hoisted all five overrides to module-scope (`MarkdownAnchor`, `MarkdownP`, `MarkdownStrong`, `MarkdownEm`, `MarkdownLi`) and exported two stable `Components` constants (`PLAIN_COMPONENTS`, `TAPPABLE_COMPONENTS`). Pure renderers, close over no state, module-scope is correct.

**Test posture:** 5321 passing throughout (no test changes — the refactor preserves all existing behaviour). tsc clean.

**Decision logged:** "Tap-a-word reliability: Path A AND Path B, shipped together" — see `decisions-log.md`. Trade-off considered: ship just Path B (root cause gone) vs ship both. Picked both: Path A removes the "popover lives in the parent's blast radius" architectural smell permanently; Path B prevents the specific anti-pattern from re-occurring; belt-and-braces is cheap when the second commit is one file.

**Lesson learned:** Lesson #82 — inline component-prop functions to react-markdown destroy the entire markdown subtree on every render. Wider applicability flagged: any library that treats prop values as React component types (react-syntax-highlighter, MDXProvider, slate, prosemirror) is vulnerable to the same anti-pattern. Audit any such props for inline declaration.

**API surface:** zero new routes, zero new AI calls, zero new migrations. Pure refactor. api-registry + ai-call-sites scans clean.

**Diagnostic infrastructure shipped this session, kept in place:** `src/components/student/tap-a-word/debug.ts` (localStorage-gated logger), `TappableText` mount/unmount/popover-state lifecycle logs, `WordPopover` mount/unmount/dismiss-reason logs. Future regressions in this surface will be diagnosable from prod by setting one localStorage key.

**Pending verification (Matt's smoke):** Once Vercel deploys `2e58127`, hard-refresh the lesson page and tap any word. The popover should appear and stay until clicked-outside or Esc. Console with the debug flag enabled should show NO `TappableText unmount` events between page load and dismiss. If unmount cascades still appear, Path B has another instance of the same anti-pattern elsewhere in the lesson page tree to find.

---

## 2026-05-10 — Lesson Input Surfaces (LIS) v1 — 3 new student components + auto-replace + editor UI + Narrative gate fix

**Context:** Visual + interaction upgrade for three text surfaces in the student lesson view (MultiQuestionResponse, RichTextResponse, KeyInformationCallout). Originally designed as a component library in PR #150 (10 May, end-of-day prior); shipped as a 7-sub-phase integration ladder across 11 PRs today (10 May). Closes the design-canvas "★ Picks" artboards Matt referenced at session start.

**Per-sub-phase summary:**

- **LIS.A (#152)** — KeyInformationCallout opt-in via `contentStyle: "key-callout"` + new `bullets[]` schema field on `ActivitySection`. Renders the magazine-style "Worth remembering" callout (brand-spine palette: deep purple → brand purple → brand pink).
- **LIS.A.2 (#155)** — Auto-flip existing `contentStyle: "info"` blocks to the magazine callout. Component now accepts EITHER `bullets[]` (3-card layout) OR `body` (single warm-card fallback). Other content styles (`warning` / `tip` / `practical`) keep their functional colour identities.
- **LIS.A.3 (#157)** — Hoist `section.framing` (Lever 1 slot field) to the magazine title slot when `bulletsTitle` is absent. Tells ComposedPrompt to skip framing in the body so the title doesn't render twice.
- **LIS.B (#159)** — RichTextResponse auto-replaces BOTH `MonitoredTextarea` and `RichTextEditor` for every text response. Integrity-monitoring port via `useIntegrityTracking` hook (handler types widened from `HTMLTextAreaElement` to `HTMLElement` so contenteditable div surfaces can share). Sanitised paste, always-visible toolbar (B/I/UL/OL/quote).
- **LIS.C (#164)** — MultiQuestionResponse stepper as opt-in via new `promptsLayout: "stepper"` field. Full persistence port (composeContent + portfolio API + photo upload + kanban auto-create + integrity tracking) — feature parity with StructuredPromptsResponse. Adapter accepts either `MultiQuestionField[]` (storybook) or `StructuredPromptsConfig` (production). `MultiQuestionField.criterion` made optional with brand-purple fallback.
- **FU tracker (#162)** — Filed `FU-LIS-PORTFOLIO-NARRATIVE-DISPLAY` in new `lesson-input-surfaces-followups.md` tracker file (added to CLAUDE.md per-project trackers section).
- **LIS.D (#167)** — Lesson editor authoring UI: (1) stepper toggle on structured-prompts sections, (2) JOURNAL_PROMPTS preset gains DO/NOTICE/DECIDE/NEXT criterion tags + Process Journal palette entry defaults to stepper, (3) new KeyCalloutEditor with eyebrow/title/intro/bullets[] form, (4) Magazine Callout palette entry with pre-filled sample bullets.
- **Title-input fix (#169)** — KeyCalloutEditor title textarea was stripping spaces / newlines mid-edit (parsed on every keystroke). Switched to local-draft pattern with onBlur commit. Lesson #79 added.
- **LIS.E (#171)** — Closed `FU-LIS-PORTFOLIO-NARRATIVE-DISPLAY`. `buildNarrativeSections` now accepts `portfolioEntries: PortfolioEntry[]` and widens the inclusion gate: section surfaces in /narrative when EITHER `section.portfolioCapture === true` OR a portfolio_entries row exists for the section's `(page_id, section_index)`. Manual Portfolio captures of regular text responses now show in Narrative. Lesson #81 added.
- **Tap-a-word fix (#172)** — KeyInformationCallout bullet bodies + intro + MultiQuestionResponse helper text routed through `<MarkdownPrompt tappable />` so students can tap individual words for dictionary lookups. New `tappable?: boolean` prop (default true). Lesson #80 added.

**Tests:** ~50 source-static dispatch tests added across the LIS surfaces. 0 type errors. 0 regressions on existing test suite.

**Schema additions (all optional, JSONB-additive, no migration):**

- `ActivitySection.bullets?: CalloutBullet[]` — 3-card magazine bullets
- `ActivitySection.bulletsTitle?: string | string[]` — magazine title (array splits one-word-per-line)
- `ActivitySection.bulletsIntro?: string` — short intro paragraph
- `ActivitySection.bulletsEyebrow?: string` — chip text override (default "Worth remembering")
- `ActivitySection.promptsLayout?: "stepper"` — stepper opt-in
- `StructuredPrompt.criterion?: "DO" | "NOTICE" | "DECIDE" | "NEXT"` — optional per-prompt tag
- `ContentStyle` union gains `"key-callout"` value
- `CalloutBullet` interface added (term + hint + body)

**Worktree:** Built in `/Users/matt/CWORK/questerra-lis` on `lesson-input-surfaces-integration` (then short-lived branches per fix). All 11 PRs squash-merged to `origin/main`.

**Pending action:** NONE. All 11 PRs merged. Vercel rolling deploys on each merge. Tracker has 0 open FUs. No data migration needed.

**Systems affected:**

- `lesson-view` (depends_on gains `lesson-input-surfaces`)
- NEW: `lesson-input-surfaces` (system entry added to WIRING.yaml)
- `integrity-monitor-student` (handler types widened in `useIntegrityTracking`)
- `tap-a-word` (new mount surfaces in lesson components)
- `portfolio` (Narrative inclusion gate widened via LIS.E)

**Key decisions banked:**

- Auto-replace vs opt-in: visual-only swaps (LIS.A.2 magazine for info, LIS.B RichTextResponse for text) → auto-replace. Structural UX changes (LIS.C stepper) → opt-in via per-section flag.
- All LIS schema additions are JSONB-additive on `pages.content_data.sections[]` — no SQL migrations, no Supabase touch.
- Read-side filters that gate on per-unit signals (like "any section has portfolioCapture") must cross-reference EVERY mechanism that satisfies the underlying intent — not just the section flag. LIS.E cross-references `portfolio_entries` by `(page_id, section_index)`.
- Tap-a-word is opt-in per surface, not inherited. Every new student-prose render path needs explicit `<MarkdownPrompt tappable />` (or direct `<TappableText>` call).
- Controlled-input text fields with normalised storage need a local draft + boundary commit; aggressive parse-on-every-keystroke clobbers in-progress edits.

**Doc updates this saveme:**

- `docs/projects/ALL-PROJECTS.md` — LIS v1 entry added, complete-count 41 → 42.
- `docs/projects/dashboard.html` — PROJECTS array gets the LIS v1 entry.
- `docs/lessons-learned.md` — +3 lessons (#79 local-draft pattern, #80 tap-a-word inheritance, #81 narrative cross-reference).
- `docs/projects/WIRING.yaml` — new `lesson-input-surfaces` system; `lesson-view` depends_on updated.
- `docs/doc-manifest.yaml` — `lesson-input-surfaces-followups.md` added.
- `docs/changelog.md` — this entry.

---

## 2026-05-09 → 10 May 2026 — Security closure: ALL 20 cowork external-review findings (S1–S7)

**Context:** Cowork delivered an external security review on 9 May 2026 with 20 numbered findings (F-1..F-20) spanning RLS gaps, route-auth holes, ownership-check bypasses, Sentry PII leakage, storage proxy authorization, fab-login timing/lockout, and assorted P3 hardening. This session closed every one of them across 7 sequenced phases (S1–S7), 20 commits, and 2 prod migrations. Every finding now has a closure commit + verification trace in `docs/security/security-plan.md`. Build brief: `docs/projects/security-closure-2026-05-09-brief.md`. Findings doc: `docs/security/external-review-2026-05-09-findings.md`.

**Per-phase summary:**

- **S1 — RLS hardening (`b9dcab0` claim + `7bc963f` body + `b4b99d5` cast fix).** Migration `20260509034943_rls_hardening_external_review` applied to prod. Closes the 4 cross-tenant tables cowork flagged (gallery_rounds + 3 siblings). Includes a TEXT-cast fix for `gallery_rounds.class_id` against `classes.id` UUID. Smoke procedure documented in `docs/security/rls-smoke-2026-05-09.md`.
- **S2 — Units publish ownership gate (`823888f`).** Closes F-5: publish endpoint was tier-gating but not author-gating. Now requires teacher-owns-unit chain via `verifyTeacherHasUnit`.
- **S3 — `requireTeacher` sweep (`9be06b5` … `15ca185`, 14 sub-phases).** Closes F-1/F-2/F-3 (~80 long-tail teacher routes that PR #140 hadn't reached): S3.1 knowledge (11), S3.2 badges (9), S3.3 skills (6), S3.4 activity-cards (5), S3.5 grading (4), S3.6 me (4), S3.7 fabricators (4), S3.8 labs (3), S3.9 gallery (3), S3.10 library (3), S3.11 integrations (3), S3.12 machine-profiles + fabrication (4), S3.13 long-tail (21), S3.14 scanner reports refresh + `58f03a8` sign-off. `scan-role-guards.py` now reports 198/206 covered + 8 allowlisted (clean). `FU-SEC-ROLE-GUARD-SWEEP` CLOSED.
- **S4 — Sentry hardening (`32c949c`).** Closes F-9 + F-10. `beforeSend` now applies a 4-pattern regex + UUID-segment redaction across event message, exception messages, AND breadcrumb URLs (the breadcrumb gap was the F-10 lift). Tests verify the full chain.
- **S5 — Storage proxy per-bucket scoping (`784687e`).** Closes F-11. `/api/storage/[bucket]/[...path]` now runs per-bucket authorization before issuing the signed URL: `responses` → student-owns or teacher-on-class chain (auth.uid → students.user_id → students.id → student_progress / class enrollment); `unit-images` → teacher-owns-unit OR student-enrolled-via-class_units chain; `knowledge-media` → teacher-owns-knowledge OR teacher-on-school chain. Spinoff follow-ups `FU-SEC-UNIT-IMAGES-SCOPING` + `FU-SEC-KNOWLEDGE-MEDIA-SCOPING` rolled into S5 closure.
- **S6 — Fab login hardening (`0582728`).** Closes F-12 + F-13 + F-14. F-12: DUMMY_HASH constant-time `bcrypt.compare` for unknown-email path so success/fail timing matches. F-13: doc reconciliation — Fabricator passwords are bcryptjs (not Argon2id; earlier WIRING/CLAUDE notes were wrong). F-14: 5-fail/15-min lockout via new `failed_login_attempts` + `locked_until` columns on `fabricators` (migration `20260510090841_fabricators_failed_login_lockout`, applied prod). Reset on success.
- **S7 — P3 bundle (`df49623`).** Closes F-15 + F-16 + F-18 + F-19 + F-20. F-16: new audit event type `byok.decrypt_failed` (was previously silent at the `resolveCredentials` boundary). Other items: doc/copy/headers tightening per `external-review-2026-05-09-findings.md`.

**Spinoff follow-ups filed:**

- `FU-SEC-BADGE-ASSIGN-PER-STUDENT` — surfaced during S3.2 review of badge-assignment route shape (defer until per-student badge UX redesign).
- `FU-SEC-REQUEST-ACCESS-TURNSTILE` — surfaced during S3 long-tail review of `/api/teacher/access-request` endpoint (Turnstile / hCaptcha gate, P3).
- (S5 spinoffs `FU-SEC-UNIT-IMAGES-SCOPING` + `FU-SEC-KNOWLEDGE-MEDIA-SCOPING` were both rolled into the S5 closure rather than carried forward.)

**Tests:** 5028 → 5180 (+152 across the 7 phases).

**Scanner state (post-closure, all clean):**

- `scan-rls-coverage.py` — 123/123 tables, 118 with policies, 5 intentional deny-all (clean).
- `scan-role-guards.py` — 198/206 covered + 8 allowlisted (clean).
- `scan-api-routes.py --check-audit-coverage` — 7 covered, 231 skipped (allowlisted), 0 missing.
- `scan-api-routes.py --check-budget-coverage` — 5/5 student AI routes covered (clean).
- `scan-vendors.py` — no drift.
- `scan-feature-flags.py` — pre-existing drift unchanged (RUN_E2E + SENTRY_AUTH_TOKEN + auth.permission_helper_rollout — all known orphan/missing entries from earlier sessions, not session-introduced).

**Key decisions banked:**

- The Phase-1.5 canonical chain `auth.uid → students.user_id → students.id` is THE pattern for all student-data RLS. S5 storage proxy authorization mirrors it column-for-column.
- The storage proxy is the single source of authorization for the 3 private buckets — RLS is the deny-all backstop, the proxy is the live gate.
- Fabricator password hashing is bcryptjs (NOT Argon2id). Doc was wrong; reconciled across CLAUDE.md, WIRING.yaml `auth-system`, `preflight-phase-1b-2-brief.md`, `security-overview.md`.
- Fab lockout is a DB column (`fabricators.failed_login_attempts` + `locked_until`), NOT an in-memory rate limit — survives restarts and works across distributed scanner pods.
- Sentry scrubbing happens in 3 places per event (message + exception + breadcrumb URL) via 4-pattern regex + UUID-segment redaction.

**Pending action:** NONE. All migrations applied, all code on main, all 20 findings closed. Closes the cowork external-review cycle in full.

**Systems affected:** auth-system (S3 sweep, S6 fab login), storage-proxy (S5 per-bucket scoping), audit-log (S7 byok.decrypt_failed event type), preflight-pipeline (S6 fab columns + S3.7 admin routes). WIRING.yaml + dashboard updated; doc-manifest entries added for the 3 new docs (closure brief, findings, RLS smoke) and `last_verified` bumped on the 4 docs touched in S6.

---

## 2026-05-09 (PM) — Privacy-First Positioning + Privacy Posture Page spec revised after pushback round

**Context:** Same-day pushback round on the morning's Privacy-First Positioning draft. Several framings landed too narrow ("design-school GTM"), the workstream sequencing under-weighted the cheapest proof point, and the spec for the privacy posture page didn't acknowledge the honest edges of the story (self-disclosed PII, AI provider egress, IP/behavioural data). Both docs revised in place.

**What changed:**

- `docs/projects/privacy-first-positioning.md` (+88 / −15 lines) — broader framing + reorganised workstreams + new principles.
- `docs/projects/privacy-posture-page-spec.md` (+59 / −15 lines) — honesty additions + presets-first control panel UX + mode-aware defaults.

**Key decisions logged:**

1. **Broader inquiry/capstone positioning, not design-only** — the GTM target widens from "IB design schools" to *every long, identity-touching, sometimes-sensitive student inquiry project*: Personal Project (PP), Extended Essay (EE), PYP Exhibition (PYPX), CAS, plus design. Same minimum-data argument, larger surface. The "design school" framing was leaving signal on the table — IB coordinators running PP/EE/PYPX/CAS are exactly the procurement audience this positioning was meant to reach.
2. **Presets-first control panel UX** — the privacy-posture spec's teacher/admin control surface ships as 3 named presets (Strict / Balanced / Open) up front, with granular per-field advanced controls behind a disclosure. Forces a sane default for the 80% case; preserves power for the 20%. Avoids the failure mode of a 30-checkbox screen that nobody touches.
3. **Anonymous Mode ships first as a hidden flag** — re-sequenced ahead of the public privacy posture page. Ships as an internal flag (no UI surface, no marketing) so the proof point is *real* before it's *claimed*. Lands the demonstrable artifact ~3 weeks earlier than the original plan, and means the privacy posture page can launch with screenshots of an actually-working Anonymous Mode rather than aspirational copy. The brand pillar gets harder to walk back this way.
4. **SOC2 deferred from WS6 to trigger-based** — out of the priority sequence entirely. Activated when a real procurement conversation surfaces it as a blocker, not pre-emptively. ~$15-25k + 3 months elapsed is too much to spend on a checkbox that may not yet be the binding constraint.
5. **Self-disclosed PII honesty principle added** — the privacy posture page now explicitly acknowledges that students sometimes type their real name / school / location into free-text fields the platform never asked for, and AI provider egress means that text reaches Anthropic. The honest framing ("we don't collect, but we don't censor") strengthens the story rather than weakening it — a vendor that names its own edges is more credible than one that papers them.
6. **Mode-aware privacy defaults workstream** — new workstream connecting the privacy posture surface to StudioLoom's existing mode system (Studio / Classroom / Open Studio etc.). Default privacy posture varies by mode, not just by school setting. Captures that "minimum data" looks different in a 1-period structured lesson vs an 8-week Open Studio project.

**Workstream count:** reorganised 6 → 9.

**Files:** 2 docs in `docs/projects/` + this changelog entry.

**Systems affected:** None yet — still planning. Future build will touch the marketing-site, schema-registry data hygiene, security-overview, and the existing mode system.

**Session context:** Docs-only revision pass — no code, no migrations, no schema changes.

---

## 2026-05-09 — Privacy-First Positioning project drafted (PLANNING) + workstream 1 spec wired into trackers

**Context:** Positioning conversation about a minimum-data brand pillar — StudioLoom as the design learning platform with the data footprint of an exercise book, with inquiry-based design pedagogy and minimum-data architecture as equal halves of the product story for the IB → AU → ROW GTM. Concrete trigger was the recent Canvas LMS breach reframing the GTM story; the school IT procurement conversation in 2026 is materially different from where it was when the platform was originally pitched.

**What changed:**

- 2 new docs in `docs/projects/`:
  - `privacy-first-positioning.md` — project doc (PLANNING, 6 workstreams in priority order: privacy posture page + data dictionary, Anonymous Mode localStorage v1, Vendor Approval Kit, in-product trust signals, IB pilot case studies, SOC2 Type 1).
  - `privacy-posture-page-spec.md` — workstream 1 of 6 spec for the public marketing-site page that documents what StudioLoom collects about students, what it doesn't, what reaches AI providers, and how Anonymous Mode further reduces the footprint.
- Tracker updates: `docs/projects/ALL-PROJECTS.md` (new entry under 🔵 Planned), `docs/projects/dashboard.html` (PROJECTS array), `docs/doc-manifest.yaml` (two new entries with `last_verified: 2026-05-09`).

**Systems affected:** None yet — planning stage. Future build will touch the marketing-site (workstreams 1 + 4), schema-registry data hygiene (workstream 1's data dictionary forces an inventory of every field stored about a student), and `security-overview.md` (the privacy story is adjacent to but distinct from the security story; both will need to cross-link once workstream 1 ships). No WIRING.yaml change in this pass — a proper system entry will be added when workstream 1 begins, not while the project is still planning.

**Session context:** Docs-only wiring pass — no code, no migrations, no schema changes.

---

## 2026-05-09 — Pre-filled student login URL via `/login/[classcode]`

**Context:** Cowork-spawned small-phase pickup. Closes the WeChat-share friction Matt's been working around when handing students their class — currently he tells them the 6-char code and they type it twice, once to find the class, once after a typo. This phase adds a sharable URL.

**What shipped:**

- **PR #145** (`prefilled-student-login`) — `/login/[classcode]` page route + form refactor:
  - Extracted the inlined form from `src/app/(auth)/login/page.tsx` into `<StudentLoginForm initialClassCode?>` so both `/login` and `/login/[classcode]` render the same component.
  - New dynamic route `src/app/(auth)/login/[classcode]/page.tsx` — server component reads `params.classcode`, normalises via `normalizeClassCodeFromUrl()` (`.trim().toUpperCase().slice(0,6)` — mirrors the server's `.toUpperCase().trim()` and clamps to the form's 6-char `maxLength`), passes to the form.
  - Pre-fill stays on step 1 (code visible, Next/Enter advances) so a student arriving via WeChat sees what was filled and can correct a mis-shared code rather than auto-advancing past it.
  - "Copy login link" button on the per-class teacher page (`src/app/teacher/classes/[classId]/page.tsx`) next to the existing class-code pill — copies `${origin}/login/${code}` with `navigator.clipboard`, "Copied!" feedback for 2s.
  - **6 new helper tests** in `src/app/(auth)/login/__tests__/class-code-helpers.test.ts` — uppercase, trim, slice, valid pass-through, empty, short. Test suite 5028 → 5034.

- **PR #146** (`copy-login-link-on-classes-index`) — same button on each card on the All Classes index (`src/app/teacher/classes/page.tsx`). Sits next to the existing "Share Code" button. Active classes only — Archived section intentionally omitted (see follow-up below).

**Follow-up filed:**

- `FU-LOGIN-ARCHIVED-CODE-LOCKOUT` (P3) in `docs/projects/access-model-v2-followups.md` — `POST /api/auth/student-classcode-login` doesn't filter `classes.is_archived`, so a stale WeChat link to an archived class still mints a session. Pre-pilot gate. Done-when: archive-aware 401 + audit `failureReason: "class_archived"` + UI hides/disables "Copy login link" on archived cards + test in classcode-login route tests.

**Auth posture unchanged:**

The new page route mints no cookies. Visiting `/login/<anything>` only sets state in the form; the only cookie-minting path remains `POST /api/auth/student-classcode-login`. Confirmed in audit before writing code; no change to the route.

**Surprises caught in pre-flight:**

- Brief said "students still type their own initials" — actual form uses `username` (not initials). Matt confirmed: brief had a wording slip, no rename intended.
- Login form was one inlined `"use client"` component — refactor extraction was the cleanest pre-fill path. Avoided the `?code=` searchParam alternative.
- `(auth)` is a Next.js route group, not a path segment — new route lives at `src/app/(auth)/login/[classcode]/page.tsx` and renders at `/login/<code>`.
- The S1 RLS hardening commit (`99359fa`) that was sitting unpushed on local main got hard-reset off local main by `gh pr merge --squash` during PR #146 cleanup. Confirmed safe on `origin/phase-S1-wip` — Matt's wip-branch backup pattern from the methodology saved it. Worth noting for the next saveme: when `gh pr merge` cleans up, it will reset local main to origin/main if they've diverged, dropping any local-only commits even if they're unrelated to the merged branch.

**Verification:**

- `npm test` 5028 → 5034 (+6 helper tests, 0 regressions, 11 skipped unchanged).
- `tsc --noEmit` errors all pre-existing in `src/lib/pipeline/` + `tests/e2e/checkpoint-1-2-ingestion.test.ts`; nothing new in any touched file.
- Live dev preview confirmed `/login/abc123` → form pre-filled "ABC123" on step 1; `/login` still renders blank.
- Vercel + GitHub Actions both green on both PRs before merge.

**Registries (saveme sync, all 5 unconditional):**

- `api-registry.yaml` — no diff. Page routes (not API) so nothing to register.
- `ai-call-sites.yaml` — no diff. No AI calls touched.
- `feature-flags.yaml` — pre-existing drift unchanged (18 registered / 29 in code — known orphan/missing entries from earlier sessions, not from this work).
- `vendors.yaml` — no drift.
- RLS coverage — clean, no drift.

**Systems affected:** auth-system (only readers — new page route consumes existing classcode-login API), teacher-classes-index (UI), teacher-class-detail (UI). No WIRING.yaml changes.

**Remaining for next session:** Matt's smoke on prod (the "Copy login link" buttons need a real teacher session to verify the WeChat-share UX end-to-end).

---

## 2026-05-09 — Security audit + first fix round (P-1/P-2/P-3/P-5/P-6/P-10)

**Context:** First substantive security-hardening pass since the initial audit. Two PRs already merged to origin/main close six items from `docs/security/security-plan.md`. The session also stood up the canonical `security-overview.md` + `security-plan.md` pair as the durable security source of truth and added a CI scanner for role-guard coverage so the next regression catches itself in PR review rather than leaking to prod.

**What shipped:**

- **PR #140** (`security-fixes-may-9`) — composite security fixes:
  - **P-1** Sentry PII scrubber (`src/lib/security/sentry-pii-filter.ts` + tests) wired into `sentry.client.config.ts` and `sentry.server.config.ts` to redact student names, emails, tokens, and request bodies before events leave the client/server.
  - **P-2** `vendors.yaml` Anthropic categories drift fix — re-aligned with `vendors-taxonomy.md` enum after scanner flagged unauthorized values; closes drift surfaced by `scan-vendors.py`.
  - **P-5** Removed dead `studentDisplayName` argument from feedback prompt builders — closes a latent path to leak student names into AI prompts.
  - **P-6** New `requireTeacher` + `requireStudent` helpers (`src/lib/auth/require-teacher.ts`, `src/lib/auth/require-student.ts`); hardened existing `requireTeacherAuth`; migrated 13 highest-risk teacher routes onto the helper pair.
  - **P-10** New `scripts/registry/scan-role-guards.py` — flags any `/api/teacher/*` or `/api/student/*` route file that doesn't call a recognised auth helper. Outputs `docs/scanner-reports/role-guard-coverage.json` for CI consumption.
  - **Tests:** new `src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts` (CI grep + behavioural assertions); helper tests for both new auth helpers.

- **PR #142** (`P-3`) — Privatised the 3 legacy public storage buckets (`student-uploads`, `unit-images`, `lesson-attachments`):
  - New proxy route `src/app/api/storage/[bucket]/[...path]/route.ts` — auth-gated download endpoint that issues short-lived signed URLs server-side, never exposing the raw bucket.
  - New helper `src/lib/storage/proxy-url.ts` (`buildProxyUrl(bucket, path)`) — single import for callers that previously built `getPublicUrl()` URLs.
  - New writer integrations across legacy upload paths (existing writers untouched; readers swap to proxy).
  - **Migration `20260508232012_privatise_legacy_buckets.sql`** flips `public: true → false` on the 3 buckets and adds service-role-only RLS policies. **Status: pending prod-apply** (deferred per migration discipline — apply before next deploy that depends on it).

**Systems affected:**
- `auth-system` (WIRING) — gains `requireTeacher` / `requireStudent` chokepoints; `requireTeacherAuth` hardened (no behavioural drift, just coverage).
- New `storage-proxy` system at `/api/storage/[bucket]/[...path]` — single read path for all legacy-bucket assets.
- Sentry observability layer — events now PII-scrubbed pre-egress.
- Vendor registry — Anthropic entry back in sync with taxonomy.

**Key decisions banked:**
1. **Placeholder-swap is the canonical pattern** for surfacing student names in AI feedback. Names NEVER reach Anthropic. The reference implementation is `src/lib/tools/report-writer-prompt.ts` (`STUDENT_NAME_PLACEHOLDER` + `restoreStudentName()`). Any new prompt that wants to reason about a named student MUST follow this pattern. The CI grep test in `no-pii-in-ai-prompts.test.ts` is the enforcement floor; future site adds need the placeholder, not the raw name.
2. **Storage proxy pattern** (`/api/storage/[bucket]/[...path]`) is the canonical replacement for direct `getPublicUrl()` usage on legacy buckets. New uploads that need public read should justify it explicitly; default is private + proxy. The proxy keeps signed-URL TTLs server-side and centralises the audit log surface.
3. **`security-overview.md` + `security-plan.md` are paired:** overview = current state (read first for any security-touching work), plan = forward-looking gap closure (P0–P3 with effort estimates and tracking table). Closing a plan item updates both: the overview's relevant section gets the new state, and the plan's tracking table gets the DONE row with date + PR link.

**Pending action:**
- **Apply migration `20260508232012_privatise_legacy_buckets.sql` to prod Supabase.** Deferred per push-and-backup discipline. Apply via Supabase dashboard SQL editor before any prod deploy that exercises the new proxy-only read path. Until applied, the proxy will work but the buckets remain publicly readable — the closure is incomplete.

**Next:** Continue down `security-plan.md` — P-4 (admin-route audit-log coverage), P-7 (rate-limit gaps on token-establishment routes), P-8/P-9 outstanding. Pilot scaling still gated on `FU-PROD-MIGRATION-BACKLOG-AUDIT` (P1, separate concern).

---

## 8 May 2026 (afternoon/evening) — AI Provider Abstraction Phase A SHIPPED — single chokepoint for every Anthropic call

**One-line:** Built `callAnthropicMessages` helper at `src/lib/ai/call.ts` and migrated 30+ direct-callers (18 SDK + 13 HTTP-based) onto it. Phase A complete — every Anthropic Messages API call in production now routes through one file. Phase B (per-feature provider swap to DeepSeek/Qwen/etc.) is now a one-config-line change.

**Triggered by:** Matt asking about a test student burning tokens on the AI Budget admin page (the timezone question). Investigation showed the helper-as-chokepoint was missing despite the existing `withAIBudget` middleware doing partial coverage. Spawned the breakdown-view follow-up first (PR #119, shipped same day), then committed to building the chokepoint properly.

**3 PRs merged + 1 docs PR in flight:**
- **PR #122** (A.1 + A.2 combined, +1497/-2738) — helper at `src/lib/ai/call.ts`, 12 unit tests + NC, 18 SDK direct-callers migrated (8 routes + 7 lib services + 3 pipeline stages). WIRING `ai-provider` corrected (Lesson #54: paper `key_files` pointed at non-existent `providers.ts`/`provider-factory.ts`). Helper extensions: `apiKey?` (config-driven callers), `metadata?` (per-call attribution), `thinking?` (extended thinking for admin sandbox), `supabase?` made optional, `fireLogUsage` hardened with try/catch.
- **PR #129** (A.3, +542/-963) — 13 HTTP fetch sites migrated. Big leverage: `lib/toolkit/shared-api.ts` `callHaiku()` is the single helper used by 25+ toolkit routes (scamper, kanban-ideation, mind-map, etc.) — one file change routes the entire toolkit through helper. Added `skipLogUsage?` to prevent double-logging when `logToolkitUsage` does richer per-tool attribution. design-assistant: `withAIBudget` moved from route into helper via studentId; route catches typed errors instead of wrapping. Open-studio routes (check-in + discovery) now budget-enforced (previously bypassed). Scanner threshold bumped 30%→60% for `dynamic` model count (post-chokepoint reality). WIRING `ai-provider` flips: `partial/0.7 → complete/1`. `ai-call-sites.yaml` collapses 54 → 22 sites (only helper + AnthropicProvider remain).
- **PR #132** (docs, in flight) — CLAUDE.md gets new "AI calls — single chokepoint" instruction section + bold call-out at top of "Code that implements the brain" list. Future sessions writing new AI calls will see the discipline at session start.

**Smoke validated in prod (same day):** Matt confirmed tap-a-word, wizard autoconfig, generate-unit, lesson-editor AI suggestions all working. AI Budget dashboard shows 5 NIS students at 34,740 tokens for the day with healthy attribution. SQL spot-check confirms breakdown rows for migrated endpoints (`student/word-lookup`, `teacher/wizard-suggest`, `lib/toolkit/*`, etc.).

**Behaviour changes worth knowing (flagged for future sessions):**
- Open Studio interactions now count against student daily caps (previously bypassed `withAIBudget`).
- HTTP-based callers' `max_tokens` truncation is now loud (502 with helpful error) — previously silent malformed responses.
- Routes that previously bypassed `logUsage` now write to `ai_usage_log` — token visibility went up. The 5 active students may see slightly higher cap utilization in the breakdown view.
- design-assistant route no longer wraps in `withAIBudget` directly — helper does it. `middleware-retrofit-catalog.test.ts` updated to verify the new pattern.

**Spawned follow-ups (shipped same day):**
- **PR #125** (endpoint normalization) — drop `/api/` prefix from all `endpoint:` strings for breakdown-view consistency. Spawned during smoke when Matt noticed inconsistent grouping; Code shipped while we worked.
- **PR #127** (lesson-editor AI suggestions popover unclip) — separate UI bug; API was working fine, popover was visually broken. Code spawned, shipped while we worked.
- **Cost & Usage rebuild** — task spawned but not started. Will replace the broken (`HTTP 500`) admin/cost-usage page with a unified spend-by-endpoint view that covers all attribution types.

**Open follow-ups (filed in this session):**
- **FU-AI-SCAN-CHOKEPOINT** (P3) — teach `scan-ai-calls.py` to recognise `callAnthropicMessages` as a single chokepoint instead of N dynamic sites. Threshold bumped 30→60% as workaround.
- **FU-CONVERT-LESSON-CACHE** (P3) — convert-lesson lost its prompt-caching beta header during migration. Reinstate via the helper if/when convert-lesson is unquarantined.
- **WIRING.yaml line 1035 parse error** (P3 — pre-existing Lever 1 entry, Lesson #33 unquoted-colons class).
- **`quality-evaluator.ts` hardcodes `"claude-haiku-4-5"`** without date suffix (P3 — should use `MODELS.HAIKU`).

**Files touched (across all merged PRs today):** ~106 files, net **−2,300 lines**. The chokepoint deletes more boilerplate (per-site SDK construction, manual `stop_reason` guards, ad-hoc `logUsage` calls, withAIBudget wrappers) than the helper adds.

**Lessons banked:** #76 (TS narrowing breaks on dead code after early returns), #77 (scanner thresholds expire when chokepoints land), #78 (helper migrations need `skipLogUsage` not partial migration when caller has its own logging discipline). Brought lessons-learned.md to 36 entries.

**Decisions banked:** chokepoint pattern; helper extension policy (justified per real call site, never speculative); withAIBudget moved into helper for design-assistant; endpoint string convention (path-shaped, no `/api/` prefix); scanner threshold bumped post-chokepoint with FU to fix root cause.

**Briefs filed:** 3 new docs at `docs/projects/ai-provider-abstraction-phase-a{,-a2,-a3}-brief.md` — added to doc-manifest.yaml.

**Next:** Phase B is gated entirely on Matt deciding which feature(s) to swap to a cheaper provider (DeepSeek likely). When he does, it's a one-config-line change inside `src/lib/ai/call.ts`. No urgency — chokepoint is the leverage; provider routing is the lever pull.

---

## 7-8 May 2026 — Marathon: kanban drag-and-drop saga, dashboard consolidation, analytics swap, admin session-takeover defenses

**Context:** Two-day session spanning the start of NIS Class 1 (7 May) through Class 2 prep (8 May). Started as a kanban modal-on-drop bugfight, expanded into student dashboard polish, ideation tool build, analytics consolidation, and a series of admin-shell defenses after diagnosing a real auth-cookie collision bug.

20 PRs merged: #96 → #112, #114, #115. Plus one empty-commit deploy trigger (`8c80f28`) and one prod-applied migration (`20260501103415_fix_handle_new_teacher_skip_students` — applied manually via Supabase dashboard).

**Workflow change banked as memory:** auto-merge-PRs-once-green is now the default for fix PRs in this user's environment. Memory file at `~/.claude/projects/-Users-matt-CWORK/memory/feedback_auto_merge_default.md`.

**Concern A — Kanban drag-and-drop saga (rounds 36 → 43):** Started as "modal opens after every kanban card drop." Spent 6 rounds adding progressively-aggressive click-suppression layers that didn't work, then added a `console.trace` (round 36) which revealed framer-motion fired `onDragEnd` twice. Then 4 more rounds chasing different theories before finding the actual cause was at the **persistence layer, not the gesture layer**. PRs #96 (round 37 isDraggingRef — load-bearing), #97 (round 38 viewportPoint — load-bearing), #98–99 (rounds 39+40 phantom guards — proven unnecessary, stripped), **#100 (round 41 — THE actual fix: useKanbanBoard.flushSave was clobbering local state with server response, wiping any drag during save's network roundtrip)**, #101 (round 42 cleanup — strip diagnostics + dead suppression layers, -188 lines), #102 (round 43 lesson nav switched to `window.location.href` hard-nav to dodge Next.js 15 silent soft-nav fail).

**Concern B — Kanban + dashboard new features:**
- #103 Kanban pulse pill in Class Hub Attention tab (`Cards: N · M done` per student, rose if 0).
- #104 Backlog Ideation tool — Socratic Haiku helper at POST `/api/tools/kanban-ideation`. Effort-gated 3-phase modal (description ≥40 chars → 3 rough first ideas → loop with AI nudges). 8 source-static contract tests lock the "AI never lists ideas, only asks questions" pedagogical promise.
- #105 Stack Add/Ideate buttons vertically; rename `✨ Ideate` → `✨ Help me come up with more cards`.
- #106 → #109 Dashboard hero NextActionPill replaces standalone NextActionCard + replaces Focus button. MiddleRow consolidation (drop "Next to unlock", expand "Coming Up" 5+4+3 → 5+7).
- #107 + #108 Content-block visual refresh (Key Information / Pro Tip / Safety Warning / etc.) — gradient bg, colored icon badges, 17-18px body, top accent stripe, hover-lift. ComposedPrompt with tappable=true unchanged → click-for-word-definition still works.

**Concern C — Analytics + admin shell hardening:**
- #110 + #111 Vercel Web Analytics + Speed Insights enabled (Pro plan); Plausible removed.
- #112 Removed "Back to teacher dashboard" from admin user-menu.
- Diagnosed real auth bug: Supabase auth cookie shared across all incognito windows in same Chrome profile → student-classcode-login overwrites admin session. Decoded session cookie via Console — confirmed admin tab was running on a STUDENT JWT.
- #114 Auto-redirect to `/admin/login?reason=session-changed` when whoami returns 401/403.
- #115 Defense in depth — admin layout renders "Verifying admin access…" loading shell until whoami confirms; never flashes admin chrome to unauth'd viewers.
- Migration `20260501103415_fix_handle_new_teacher_skip_students` applied to prod via Supabase SQL editor — guards `handle_new_teacher` trigger to skip student auth users + backfill-deletes 14 leaked `student-{uuid}@students.studioloom.local` rows from teachers table.

**Systems affected:**
- `kanban-system` (rounds 37/38/41 in KanbanBoard.tsx + use-kanban-board.ts; new ideation modal + API)
- `attention-rotation-panel` (kanban pulse pill)
- `student-dashboard-v2` (NextActionPill, MiddleRow consolidation, ContentBlock visual refresh)
- `auth-system` (admin shell defenses, leaked-teachers migration applied)
- `vendors` (Vercel Analytics added, Plausible removed)
- `lesson-navigation` (hard-nav workaround for Next.js 15 soft-nav silent fail)

**Open follow-ups filed:**
- `FU-LESSON-NAV-SOFT-NAV` (P3) — investigate Next.js 15 router.push silent fail when navigating to recently-created dynamic routes; restore SPA-style lesson nav once root cause known.
- Adjacent (pre-existing): registry drift in feature-flags (orphaned `SENTRY_AUTH_TOKEN`, `auth.permission_helper_rollout`; missing `RUN_E2E`).

**Lessons banked:** #74 (instrument before adding more guards in same layer); #75 (when same-layer guards keep failing, look upstream/downstream).

---

## 8 May 2026 — Admin AI Budget per-student token breakdown (3 PRs end-to-end)

**Context:** Matt could see per-student daily totals on `/admin/ai-budget` (e.g. testv22 at 10,005 tokens) but had no way to attribute spend to a feature. He'd just spotted unexpected token use on a test student and couldn't tell whether it was an agent loop, a stuck tab, or a real session. Built end-to-end visibility through three sequential PRs in this session.

**Three PRs shipped + merged to main:**

1. **[PR #116](https://github.com/mattburto-spec/studioloom/pull/116)** — `feat(admin): per-student token breakdown on AI Budget page`
   - New `GET /api/admin/ai-budget/[studentId]/breakdown` route — admin-gated, school-tz day boundary, groups today's `ai_usage_log` by `(endpoint, model)`, returns calls + input/output/total tokens + last_call_at.
   - New helper `src/lib/access-v2/ai-budget/day-boundary.ts` — `startOfDayInTz()` mirrors the SQL formula in `atomic_increment_ai_budget()` so totals reconcile exactly with the cap counter. 9 unit tests cover Asia/Shanghai (no DST), UTC, PST/PDT, AEST, edges around local midnight, invalid tz.
   - UI: chevron + accordion expandable rows on `src/app/admin/ai-budget/page.tsx`, lazy-fetch on expand. **Reconciliation gap callout** rendered inline when `ai_budget_state.tokens_used_today` doesn't match `SUM(ai_usage_log.input + output)` for the day.
   - Test count: 49 → 58 (+9 day-boundary tests).

2. **[PR #119](https://github.com/mattburto-spec/studioloom/pull/119)** — `fix(usage): attribute student tokens in ai_usage_log (bridge for AI Budget breakdown)`
   - Reconciliation gap callout from PR #116 surfaced on every active student → 100% gap. Investigation revealed two distinct bugs:
     - **`word-lookup` and `quest/mentor` use `withAIBudget` for cap enforcement but never call `logUsage` at all** — tokens hit the cap counter but leave no diagnostic trail.
     - **`design-assistant`, `open-studio/check-in`, `open-studio/discovery` call `logUsage` but don't pass `studentId`** → rows land with `student_id=NULL`.
   - Bridge fix: 5 student-facing routes patched (2 added new logUsage calls, 3 added studentId arg to existing calls). Toolkit shared-api skipped on purpose — those routes are public anonymous free tools, no studentId concept exists.
   - **Why a bridge:** Phase A.2 of the AI Provider Abstraction (then in flight) absorbs `logUsage` + `withAIBudget` + stop_reason guard into `callAnthropicMessages()`. This PR's inline calls are superseded by Phase A.2 (and were, cleanly — confirmed end-of-session).

3. **[PR #121](https://github.com/mattburto-spec/studioloom/pull/121)** — `perf(word-lookup): cut input tokens ~25% by stripping schema verbosity`
   - First post-attribution data showed Scott averaging ~940 tokens per word lookup — surprisingly high.
   - Three changes: (a) move all constraints from tool-schema property descriptions into a single `system` prompt, (b) tighten userPrompt to `Word: "X". Context: "..."`, (c) cap `contextSentence` at 200 chars (was 500).
   - **Actual impact:** ~840 → ~750 input tokens per call (~11% reduction, less than the projected 25-30%). Anthropic's tool-call overhead is the residual floor.
   - **Cost reality:** 6 lookups = $0.006. Cap math: pro-tier 100k ÷ 750 = ~133 lookups/student/day. The optimization is more about cap headroom than dollars.
   - Quality preserved by moving "Max 20 words" + L1 native-script rule into the system prompt. 15/15 word-lookup unit tests still pass.

**Confirmation that #121 survived A.2:** read `origin/main:src/app/api/student/word-lookup/route.ts` after Phase A.2 (PR #122 by another session) — minimal tool schema ✅, empty tool description ✅, system prompt with rules ✅, terse userPrompt ✅, 200-char context cap ✅. Phase A.2 migrated the call through `callAnthropicMessages()` and absorbed the inline `logUsage` from PR #119 cleanly. Nothing duplicated, nothing lost.

**Strategic position:** AI cost visibility is now end-to-end and stabilized. The diagnostic surface (per-student × per-feature × token attribution) caught the missing-studentId bug it was designed to catch. Next-level token reduction is a Phase B (provider switching — DeepSeek/Qwen/Moonshot are 5-10x cheaper than Haiku) or Phase C (prompt caching via the central helper) concern, not a tactical patching concern.

**Out of scope (deferred):**
- $ cost column on the breakdown table (`ai_usage_log.estimated_cost_usd` is already populated by `logUsage`; ~10-line UI addition). Matt to call it later if useful.
- Toolkit attribution (kanban-ideation, scamper, etc.) — they're public anonymous free tools and use a separate `logToolkitUsage()` helper. Phase A.2/A.3 will absorb them into `callAnthropicMessages()` automatically.
- Filters / date pickers / charts / historical trends — explicitly out of scope per the original brief.

**Lessons banked:**
- **L#73 (this session)** — `ai_budget_state` (cap counter) and `ai_usage_log` (diagnostic trail) are independent pipelines maintained by separate code paths. Routes can write to one but not both, leaving silent attribution gaps that look like spend-without-explanation. The reconciliation-gap callout is the cheapest invariant check and surfaced this drift on first deploy. Recorded in `docs/lessons-learned.md`.

**Files changed end-to-end across the three PRs (8 total):**
- NEW: `src/lib/access-v2/ai-budget/day-boundary.ts`, `src/lib/access-v2/ai-budget/__tests__/day-boundary.test.ts`, `src/app/api/admin/ai-budget/[studentId]/breakdown/route.ts`
- MODIFIED: `src/app/admin/ai-budget/page.tsx`, `src/app/api/student/word-lookup/route.ts`, `src/app/api/student/quest/mentor/route.ts`, `src/lib/design-assistant/conversation.ts`, `src/app/api/student/open-studio/check-in/route.ts`, `src/app/api/student/open-studio/discovery/route.ts`

**Systems affected:** `ai-budget` (gained admin diagnostic surface), `ai-provider` (absorbed PR #119's bridge attribution into Phase A.2 helper).

**Test count:** Net +9 unit tests (day-boundary). All other changes covered by existing route tests; no regressions.

---

## 8 May 2026 — Preflight Pilot Mode SHIPPED — override + teacher inbox + dev surface + fab flag

**Context:** Matt's student David tried submitting a fab job and got
knocked back by the Preflight scanner, with no escape path and no
visibility for Matt as teacher. This session shipped a temporary
"Pilot Mode" posture closing all three gaps + extending the visibility
through to the fab tech surface.

**What changed (5 PRs to main):**

- **PR #113 — Pilot Mode P1+P2+P3+admin nav (squashed `f945f00`):**
  Migration `20260508021922_fabrication_jobs_pilot_override.sql` adds
  nullable `pilot_override_at TIMESTAMPTZ` + `pilot_override_rule_ids
  TEXT[]`. Applied to prod 8 May. New `src/lib/fabrication/pilot-mode.ts`
  → `PILOT_MODE_ENABLED` constant (`true`). `canSubmit()` accepts
  `pilotMode` + `overrideBlocks` params; bypass returns `pilotOverride.
  ruleIds`. WARN acks still required. `submitJob` writes both override
  columns in same UPDATE. Submit endpoint parses optional
  `{ overrideBlocks }` body. Student UI: amber "Override and proceed"
  panel with explicit confirm checkbox. Teacher view: new first tab
  "Needs attention" — cross-status, surfaces pending rows with rule
  findings + any-status rows with overrides; amber `⚠ Override (N)`
  chip. Dev review: `/admin/preflight/flagged` (platform-admin only) —
  rule histogram + filter chips + signed-URL download. Admin nav adds
  "Preflight" tab between Bug Reports and Audit Log. Tests 4835 → 4868
  (+33 net).
- **PR #117 — Pilot Mode P4 (fab flag, squashed `172e6eb`):**
  `FabJobRow` + `FabJobDetail.job` gain `pilotOverrideAt` +
  `pilotOverrideRuleIds`. Red "⚠ Flagged · may not print" chip on
  incoming + queued fab cards. Prominent red banner above teacher's
  note on `/fab/jobs/[jobId]`. Tests +2.
- **PR #118 — inspect link on incoming cards (squashed `22da297`):**
  Eye icon at top-right of incoming cards so fab can inspect
  override-flagged jobs before Send-to.
- **PR #120 — surface eye + trash on incoming cards (squashed `dc9e019`):**
  Smoke caught corner icons at `ink-3` were missed. Moved both under
  the thumbnail in a small action row. Eye → `ink-1`, trash →
  red-300. Bumped sizes 11→13/14, padding 1→1.5.

**Smoke status:** End-to-end verified with Scott's whale-not-watertight.
stl → override → Needs Attention → admin flagged page (rule histogram
showing R-STL-01 fired+overridden 1).

**Systems affected:** preflight-pipeline (override columns, dev surface,
fab flag), admin (nav tab + route).

**Decisions banked (see decisions-log):** override is a separate
intentional act not ack; WARN acks still required during override;
pilot mode as hardcoded constant not admin_settings flag; dev review
surface is read-only triage; auto-orient deferred until histogram
data justifies the ~2-3d build.

**Lessons banked:** Layout-tabs guardrail test caught a missing TABS
count update post-nav addition. Same-pattern source-static guardrails
are cheap insurance.

---

## 4 May 2026 — Preflight Phase 8-1 audit gap CLOSURE ROUND 2 — 7 same-family fixes + 2 UX bugs

**Context:** Matt's post-Access-v2 Preflight smoke (he'd just finished
Access Model v2 PILOT-READY in a parallel session) caught a series of
same-family Phase 8-1 audit gaps. The original 28 Apr audit doc was
declared CLOSED 12/12 last week — turned out it was complete for the
*scope it audited* (queue + jobs + admin pages) but missed several
sibling routes because they weren't job-listing surfaces. The
contract was right; the audit's net wasn't wide enough.

Today's session caught + fixed all the rest of the misses, validated
each in prod cross-persona, and finalised a lesson for future audit
scope framing.

**What changed:**

- **`/api/fab/machines` school-scoped** (commit `9ddacce`):
  Was filtering machines by `teacher_id = invitingTeacherId` — fab
  invited by Persona A couldn't see machines created by Persona B
  even at the same school. Replaced with `fabricatorSchoolContext`
  scoping by `school_id`. Empty-state copy "your inviting teacher's
  labs" → "your school's labs" across `FabQueueClient.tsx` +
  `fab-queue-helpers.ts` + 1 helper test.

- **Student upload machine-validation school-scoped** (commit
  `f6acdec`): `createUploadJob` in `orchestration.ts:345` was
  validating `profile.teacher_id !== class.teacher_id`. Class owned
  by Persona A, machine created by Persona B → 404 "Machine profile
  not found" on submit when student picked the machine. Replaced
  with `school_id` comparison via `teachers!inner(school_id)` embed
  on the class lookup. System templates (school_id NULL) pass
  through to any school. Test mock fixture updated.

- **All 5 `/api/teacher/fabricators/*` admin routes school-scoped**
  (commit `277f69e`):
  Closes `FU-FAB-INVITE-SCHOOL-SCOPED` + 4 sibling routes
  (PATCH/DELETE deactivate, reset-password, machines/[id] reassign,
  GET list). Same family — all gated on
  `invited_by_teacher_id === user.id`. Replaced with
  `loadSchoolOwnedFabricator` + `findFabricatorByEmail` helpers
  (new). Cross-school → 404 (no existence leak); same-school
  cross-persona → works regardless of which teacher originally
  invited. Invite POST: cross-school existing fab → 409 "belongs
  to another school" (replaces the pre-flat-membership "another
  teacher" hard-block). Machine validation in
  `[id]/machines/route.ts` ALSO swept (school_id check on
  per-machine validation). 7 → 9 invite test cases (added
  cross-school 409 + cross-persona takeover).

- **PostgREST FK embed bug → 2-query rewrite** (commit `19856e8`):
  My initial sweep used `teachers!fabricators_invited_by_teacher_id_fkey(school_id)`
  embed to resolve the inviter's school in one query. Failed at
  prod with "Could not find a relationship between 'fabricators'
  and 'teachers' in the schema cache". Root cause:
  `fabricators.invited_by_teacher_id REFERENCES auth.users(id)`,
  not `teachers(id)` — even though `teachers.id = auth.users.id`
  via mig 001 FK chain, PostgREST embeds need a DIRECT FK between
  the two embedded tables. Indirect chain through auth.users
  doesn't resolve. Rewrote both helpers with a second
  `.from("teachers").eq("id", X).maybeSingle()` lookup — same UUID
  flows through unchanged as a teachers PK.

- **Fab admin actions menu portal-rendered** (commit `40cb10e`):
  The "…" actions dropdown was rendering correctly but clipped by
  the table wrapper's `overflow-hidden` (used to clip rounded-xl
  corners on table contents). Matt reported popup "hidden within
  the box it's nested in". Fix: render via `createPortal` to
  `document.body` with `position:fixed` calculated from the
  button's `getBoundingClientRect`. Click-outside + ESC dismissal
  added (was missing). ARIA roles added.

- **Fab logout 303 redirect** (commit `81f20ab`):
  `/api/fab/logout` returned `{ok:true}` JSON. Logout button uses
  native `<form action="..." method="post">` (zero-JS path), so
  browser navigated to API URL on submit and rendered raw JSON.
  Fix: 303 See Other to `/fab/login`. Standard PRG pattern, no
  JS dependency, no raw JSON visible.

**Verification:**

- ✅ `tsc --noEmit --project tsconfig.check.json` clean throughout
  (one pre-existing unrelated `BugReportButton.tsx` error from
  Access v2 Phase 6 work; not gated in CI).
- ✅ Tests 3494 → 3496 (+2 from new invite cases). Full suite
  3496/3507 across 7 commits, no regressions.
- ✅ All 7 fixes prod-validated cross-persona by Matt:
  visibility, edit, soft-delete, bulk-approval (machines list);
  job submit with specific machine (student upload); reset
  password, deactivate, reactivate (fab admin); actions menu
  visible; logout lands on `/fab/login`.

**Migrations:** None.

**Schema:** No changes. `invited_by_teacher_id` stays as legacy
audit-only column (same pattern as `machine_profiles.teacher_id`
post Phase 8-3). Future cleanup migration could rename to
`created_by_teacher_id` for consistency, but not blocking.

**`FU-FAB-INVITE-SCHOOL-SCOPED` ✅ RESOLVED** with closure note in
`docs/projects/preflight-followups.md` documenting the 5-route
sweep + the new helpers + the lesson on audit scope framing.

**Lessons surfaced + filed:**

- **Audit scope framing matters.** The 28 Apr audit framed scope
  by *feature concept* ("queue + jobs + admin pages") and missed
  `/api/teacher/fabricators/*` + `/api/fab/machines` because they
  don't list jobs. Future similar audits should scope by **route
  prefix** + programmatically grep for the pattern (e.g.,
  `invited_by_teacher_id !==`, `teacher_id !== teacherId`).
  Pattern's mechanical, audit nets should be too.

- **PostgREST embed FK rule.** PostgREST needs a DIRECT FK between
  two tables to embed them. Indirect chains via shared auth ID
  (e.g., `teachers.id = auth.users.id` so referencing `auth.users`
  doesn't let you embed `teachers`) don't work. Always grep
  `<column> REFERENCES` before assuming a lab-pattern embed
  copy-paste will work on a different table.

- **Native form POST + JSON response = ugly UX.** When a button is
  a `<form action="..." method="post">` (zero-JS path), the API
  must return a redirect or HTML response. JSON renders raw to
  the user. Standard PRG (Post/Redirect/Get) is the correct
  pattern.

**Pending after this saveme:** None. Preflight is back on its feet
post Access v2. Last truly-real loose end is running an actual
fabrication submission end-to-end through the pipeline (student
upload → scan → teacher approve → fab pickup → complete) — the
substantive smoke that proves the whole pipeline still works.
Matt deferred this; can be tomorrow or whenever.

**Worktree state at session end:**
`/Users/matt/CWORK/questerra-preflight` on `preflight-active` (in
sync with origin). Top-of-main: `689023d`.

**Systems affected:** `fabrication-fab-orchestration` (new
`loadSchoolOwnedFabricator` + `findFabricatorByEmail` helpers),
`fab-machines-route` (school-scoped), `student-upload-orchestration`
(school-scoped machine validation), `teacher-fabricators-routes`
(5-route sweep + portal'd actions menu UX), `fab-logout-route`
(303 redirect).

---

## 28 Apr 2026 evening — Preflight Phase 8-3 + Phase 8-4 paths 1+2 SHIPPED — audit doc CLOSED 12/12 ✅

**Context:** Continuation of the morning's Phase 8-1 + 8-2 work.
After saveme + handoff at lunch, picked up Phase 8-3
(machine-orchestration rebuild) and ran it through to closure
including Phase 8-4 path 1 (audit cleanup) and path 2 (class-chip
teacher disambiguation on fab queue). Multi-teacher cross-persona
prod smoke validated flat school membership end-to-end. Phase 8
trilogy + 8-4 closure all done in one continuous session.

**What changed:**

- **Phase 8-3-1 migration `20260428074205_machine_profiles_school_scoped`:**
  Mirrors the lab pattern. Backfilled `school_id` from teacher chain
  + lab chain (two-pass UPDATE — first attempt failed with
  `42P01 invalid reference to FROM-clause entry` because Postgres
  UPDATE...FROM can't reference the target alias from a JOIN's ON
  clause; split into two sequential passes). Added
  `created_by_teacher_id` audit-only column (FK to teachers, ON
  DELETE SET NULL). CHECK constraint: non-templates require school_id.
  4 RLS policies replaced with school-scoped versions using
  `current_teacher_school_id()` helper. Indexes swapped: dropped
  `idx_machine_profiles_teacher_id`, `uq_machine_profiles_teacher_name`,
  `idx_machine_profiles_teacher_lab_name_active` (mig 118); added
  `idx_machine_profiles_school_id`, `idx_machine_profiles_created_by`,
  `uq_machine_profiles_lab_name_active` (lab + name unique within
  active non-templates). Migration applied step-by-step to prod, all
  4 verification queries passed.

- **Phase 8-3-2 `machine-orchestration.ts` rewrite:** All 5 public
  functions resolve teacher → school via re-exported
  `loadTeacherSchoolId`, scope ops via `school_id`. Lab ownership
  pierces (3 sites: createMachineProfile, updateMachineProfile.labId
  reassignment, bulkSetApprovalForLab) replaced with
  `loadSchoolOwnedLab`. New helper `loadSchoolOwnedMachine`
  (replaces `loadTeacherOwnedMachine`). Insert payload writes both
  `teacher_id` (legacy NOT NULL column from mig 093 ownership_check)
  AND `created_by_teacher_id` (audit-only). Duplicate-name probe
  rescoped from teacher → lab to match the new `(lab_id, name)
  WHERE is_active` unique index. `MachineProfileRow` shape: dropped
  `teacherId`, added `createdByTeacherId`. Public API unchanged on
  the wire (callers still pass `teacherId`).

- **Phase 8-3-3 tests + MED-3 fold-in:** Full rewrite of
  `machine-orchestration.test.ts` (~600 lines, 36 tests). Mock
  pattern matches `lab-orchestration.test.ts`: handles
  `teachers.maybeSingle()`, school-scoped lab/machine queries,
  `.in()` vs `.eq()` distinguishing. Test cases reframed: "404
  cross-teacher" → "404 cross-school", added "401 orphan teacher".
  Mock bug caught + fixed: `null ?? "school-1"` returned
  `"school-1"` (nullish coalescing fallback) instead of preserving
  explicit null; switched to `"teacherSchoolId" in opts` check.
  MED-3 fold-in: `default-lab/route.ts` rewritten under
  school-scoped contract using `loadTeacherSchoolId` +
  `loadSchoolOwnedLab` + `classes → teachers.school_id` embedded
  join. `lab-setup-helpers.test.ts` machine fixture updated to new
  shape (CI strict tsc excludes test files so this didn't block
  CI but the shape was technically stale).

- **Multi-teacher prod smoke (3 NIS personas, all at school_id
  `636ff4fc-4413-4a8e-a3cd-c6f1e17bd5a1`):** Persona A
  (`mattburto@gmail.com`) creates machine → Persona B
  (`hello@loominary.org`) sees it, edits, soft-deletes, runs bulk
  approval toggle on lab containing A's machines. All confirmed
  cross-teacher. This is the strongest possible proof of flat school
  membership for machines.

- **Phase 8-4 path 1 — audit cleanup (commit `401235d`):**
  - Dropped `AssignClassesToLabModal.tsx` (entire file). Trigger
    button removed at Phase 8.1d-5; modal had no remaining mount
    path. Default-lab API route + `classes.default_lab_id` column
    survive as forward-compat seams.
  - Dropped deprecated `filterMachinesForClass` no-op stub (Phase
    8.1d-5 removed class-to-lab filtering; `groupMachinesByLab` is
    the sole picker grouping helper now). 4 deprecated test cases
    removed.
  - Updated 1 stale storage-path comment in `orchestration.ts`
    (Phase 8-1 made school_id NOT NULL on labs; comment was
    pre-Phase-8-1).
  - **Audit doc updates:** MED-4 PARTIAL → ✅ FIXED (root API
    errors closed by Phase 8-2/8-3, multi-teacher prod-validated;
    full visual rebuild from original brief over-specified for the
    actual gap). LOW-2 PARTIAL → ✅ FIXED (most "teacher_id"
    comments were intentional Phase-8-1-transition context, not
    drift; one storage-path drift fixed).

- **Phase 8-4 path 2 — class-chip teacher disambiguation (commit
  `9824900`):**
  - Real product gap from original 8-4 brief: two NIS teachers
    each have a "Grade 10" → Cynthia can't tell their cards apart
    on the fab queue. Same color, same name.
  - `class-color.ts` extended: `colorForClassName` +
    `colorTintForClassName` accept optional `teacherKey` (trimmed;
    whitespace = ignored). Backward compat preserved for single-arg
    callers. New helper `formatTeacherInitials` ("Matt Burton" →
    "M.B.", "Cynthia" → "C.", "Anna Marie Schmidt" → "A.S.",
    hyphen-aware).
  - `fab-orchestration.ts` extended: queue PostgREST embed becomes
    `classes(name, teachers(display_name, name))`. `FabJobRow`
    gains `teacherInitials: string | null` populated via
    `formatTeacherInitials(teacher.display_name ?? teacher.name)`.
  - `FabQueueClient.tsx`: `<ClassChip>` accepts `teacherInitials`
    prop, threads it as the disambiguation key into color helpers,
    renders inline as `Grade 10 · M.B.` (70% opacity for the
    initials, secondary cue). All 3 mount sites updated.
  - **Skipped per Matt's call:** fabricator-to-machine assignment
    chips. Over-engineered for v1 single-fab schools.

- **Audit doc CLOSED — 12 of 12 findings ✅ FIXED:** HIGH-1/2/3/4,
  MED-1/2/3/4/5/6, LOW-1/2.

**Verification:**

- ✅ Migration applied step-by-step to prod (all 4 verification
  queries passed: 0 non-templates without school_id, 0 with
  mismatched created_by_teacher_id, 4 school-scoped RLS policies,
  3 new indexes).
- ✅ Tests: 2421 → 2433 (+13 from class-color + formatTeacherInitials
  tests; +1 from new orch tests; -1 from removed deprecated picker
  test). Net 2208 → 2433 across the day (+225).
- ✅ tsc strict (`tsc --noEmit --project tsconfig.check.json`)
  clean throughout.
- ✅ CI green on all 4 merge commits today (`8e04aef`, `dafa25d`,
  `5a75ec8`, `740b892`).
- ✅ Multi-teacher cross-persona prod smoke: 4/4 scenarios passed.

**Migration applied to prod:**
`20260428074205_machine_profiles_school_scoped` — see commit
`27709c6` (body) + `daf652a` (backfill UPDATE...FROM split fix).

**Lessons surfaced + filed:**

- **PostgREST embed alias collision** — when appending an embedded
  resource onto a baseSelect that already embeds the same target
  table via the same FK, PostgREST aliases both as
  `parent_target_1` / `parent_target_2` and emits "table name X
  specified more than once". Rule: each query gets exactly one
  embed per (target, FK) pair. Caught at picker-data hotfix.

- **`tsc --noEmit` vs `tsc --noEmit --project tsconfig.check.json`**
  — the latter is what CI uses. The former includes test files with
  pre-existing legacy Mock<Procedure> errors that drown out new
  errors in production code. Use the project's strict config when
  pre-validating before push.

- **Postgres UPDATE...FROM target alias** — can't reference the
  UPDATE target's alias from a JOIN's ON clause inside the FROM
  list. Two-pass UPDATEs are cleaner anyway. Caught at backfill
  apply time.

**Pending after this saveme:** Push origin/main DONE. Phase 8
trilogy + 8-4 trilogy DONE. **Next session:** Access Model v2
Phase 0 (worktree `questerra-access-v2`, branch `access-model-v2`)
or dashboard-v2 polish if queued first. Access v2 spec already
addresses the "3 Matts" identity cleanup that surfaced today via
display_name nulls.

**Worktree state at session end:** `/Users/matt/CWORK/questerra-preflight`
on `preflight-active` (in sync with origin). Top-of-main: `740b892`.

**Side-finding worth banking:** All 3 Matt teacher personas
(`mattburto@gmail.com`, `hello@loominary.org`,
`mattburton@nanjing-school.com`) at school_id `636ff4fc-...` have
`display_name = null` and `name = "Matt"`. Phase 8-4 path 2
disambiguation works correctly under the hood (initials + color
hash both populate from this data) but renders identically across
personas — they all show `Grade 10 · M.` with the same chip color.
Not a bug; consequence of test data. Real NIS pilot with 2+ distinct
teachers will get full disambiguation. Access Model v2 spec
addresses this identity cleanup.

**Systems affected:** `fabrication-machine-orchestration` (rewrite),
`fabrication-fab-orchestration` (FabJobRow extended +
PostgREST embed extended), `fabrication-class-color` (helper API
extended for teacher disambiguation), `default-lab-route`
(school-scoped rewrite — MED-3 fold-in), `LabSetupClient` (dead
code dropped).
---
## 4 May 2026 — Access Model v2 PILOT-READY (Phase 6 closed + Cron wired + npm audit fixed)

**Context:** Final close-out session for Access Model v2. Phases 0–5 had shipped end-April / early-May; Phase 6 (Cutover & Cleanup) was the architectural hygiene pass before pilot. Closed all 7 sub-phases plus shipped the cron wiring + npm audit fixes that surfaced as pre-pilot operational gaps.

**Phase 6 — 7 sub-phases shipped + tagged `v0.6-pilot1`:**

- **§6.0** pre-flight + 5 spec amendments (3-Matts done in 4.3.z, table count 7→5, route count 388→319, ADR-011 retired, est ~4-5d) + scaffold `docs/security/rls-deny-all.md` + 3 ADR scaffolds in sibling Loominary/. §3.3c critical decision RESOLVED: live-status route's student_sessions lookup → student_progress.updated_at > now()-5min.

- **§6.1** legacy student token cleanup. Migration `phase_6_1_drop_student_sessions` (with DO-block sanity asserting 0 rows in students + student_sessions before dropping) applied to prod 4 May. 2 dependent RLS policies on class_students + student_projects replaced with auth.uid()-based equivalents in the same migration. Deleted: requireStudentAuth shim, dual-mode test, legacy login route, SESSION_COOKIE_NAME constant. Migrated 50 callsites to requireStudentSession (38 mechanical via script + 12 manual specials). LTI launch route stubbed as 410 with FU-AV2-LTI-PHASE-6-REWORK filed.

- **§6.2** author_teacher_id cleanup. Audit revealed REAL scope was 8 ownership gates (vs brief's "~40 truly inline") + 17 own-data filters. 8 gates migrated to verifyTeacherHasUnit/verifyTeacherOwnsClass shims (both can()-backed); 5 access-check-skip annotations on look-alike-but-not gates. Side benefit: removed silent author_teacher_id leak in class-units/content GET+PATCH where the try-with-then-fallback-without-author logic let any teacher read any unit on author check failure.

- **§6.3** API versioning seam. Chose Option Z (next.config.ts rewrites) over Option X (literal file moves of 318 routes) — same client-facing outcome for ~30min vs ~3-4h. Both `/api/<domain>/X` and `/api/v1/<domain>/X` now valid simultaneously; 4 mirrored Cache-Control: private header rules under /api/v1/* for auth-cookie-touching domains. ADR-013 promoted to Accepted with full Option X vs Z trade-off. FU-AV2-API-V1-FILESYSTEM-RESHUFFLE filed for the deferred file moves.

- **§6.3b** middleware user_type guard — surfaced when Matt got bounced into the teacher onboarding wizard with a student's UUID as placeholder name after his student-tab login overwrote the teacher session cookie. Both teacher and student logins write the SAME sb-* cookie at studioloom.org; second login stomps first. Pre-fix worst case: student session reaching /teacher/welcome triggered the destructive onboarding flow. Mitigation: middleware now checks `app_metadata.user_type` after the existing presence check; wrong-role sessions redirect to the right area with `?wrong_role=1` flag for a future toast (FU-AV2-WRONG-ROLE-TOAST P3). Underlying single-cookie limitation filed as FU-AV2-CROSS-TAB-ROLE-COLLISION P2.

- **§6.4** audit-coverage CI gate flip. Real audit: 232 mutation routes, 4 covered + 1 skipped + **228 missing**. 3 inline-wires (admin/teachers DELETE+invite POST, admin/teacher-requests PATCH — high-value admin actions get logAuditEvent with soft-sentry failureMode) + 224 categorical bulk-skips via Python script (117 teacher routine pedagogy ops, 36 student learner activity, 32 public free-tools no actor identity, 8 fab operational, 8 admin sandbox, 8 school covered by school_settings_history, 4 auth callbacks, 4 misc admin, etc.). nightly.yml flipped from `--check-audit-coverage` (visibility) to `--check-audit-coverage --fail-on-missing` (gating). 3 new tests (post-Phase-6.4 baseline + clean exit + synthetic-injection mechanism test) replaced the 1 stale "missing > 0 proves the gate would fire" test that became false post-closure.

- **§6.5** RLS-no-policy doc + Phase 5 table classifications. `docs/security/rls-deny-all.md` documents all 5 service-role-only tables with file:line writer/reader callsites (admin_audit_log, ai_model_config, ai_model_config_history, fabricator_sessions, teacher_access_requests). `scripts/registry/scan-rls-coverage.py` extended to read the doc at scan time and classify those tables as `intentional_deny_all` rather than drift. status: clean (was drift_detected); rls_no_policy_count: 0 (was 5); intentional_deny_all_count: 5. Closes FU-FF. Plus: rebuilt 3 stale Phase 5 table entries in schema-registry.yaml (audit_events column-types-only → full classification block; ai_budgets + ai_budget_state status:dropped/columns:{} → applied with full per-column classification — the FU-DD scanner mis-parse class drift).

- **§6.6** ADRs. Old 011-schema-rework.md (radical-pivot exploration, never accepted) marked Superseded with redirect note. 3 new ADRs in sibling Loominary/docs/adr/: 011-school-entity-and-governance.md (Decisions 1–8 baked into Phase 4), 012-audit-log-infrastructure.md (single immutable polymorphic table, 3-mode failure semantics, school_subscription_tier_at_event seam), 013-api-versioning.md (Option Z chosen + alternatives). Loominary ADR README index updated.

- **§6.7** registry sync + Checkpoint A7 + handoff. All 5 scanners re-run + clean (modulo unrelated feature-flags drift on SENTRY_AUTH_TOKEN + auth.permission_helper_rollout + RUN_E2E — pre-existing). WIRING.yaml: student-signin promoted v1→v2 with Phase 6.1 narrative; auth-system stale references cleaned (deleted shim removed from key_files); api-versioning system added; pre-existing ai_budget_state YAML parse error fixed (bash-style brace expansion → proper list). Checkpoint A7 doc + handoff written. Tagged `v0.6-pilot1` on the merge commit (`394c4fb` Phase 6.4–6.7 merged on top of `912ddd8` Phase 6.0–6.3 + `b66f04a` Phase 6.3b hotfix).

**Cron-wire — closes FU-AV2-CRON-SCHEDULER-WIRE (last hard pre-pilot blocker):**

3 GET route handlers at `src/app/api/cron/<job>/route.ts` (cost-alert, scheduled-hard-delete, retention-enforcement) — each validates `Authorization: Bearer ${CRON_SECRET}` then delegates to the existing run() in src/lib/jobs/. Returns { ok, job, result, timestamp } JSON. `vercel.json` declares the 3 crons (cost-alert daily 06:00 UTC, scheduled-hard-delete daily 03:00 UTC, retention-enforcement monthly 1st 04:00 UTC). Middleware allows /api/cron/* through (bearer-secret in handler is the gate). CRON_SECRET registered in feature-flags.yaml as required: true (PILOT-BLOCKING). 15 auth-gate tests (5 cases × 3 routes) verify all auth failure modes + the success path. Note on AI budget reset: there is no separate reset cron — Phase 5.2's atomic_increment_ai_budget() SECURITY DEFINER function performs the reset INLINE on next per-student increment when reset_at < now(). Lazy reset is correct semantics for this use case.

CRON_SECRET set in Vercel by Matt + redeployed. First cron fires daily at 06:00 UTC (cost-alert).

**npm audit fix — 6 vulns → 4 moderate residuals:**

Bucket A (npm audit fix, no breaking changes): closed 2 high-severity advisories — @xmldom/xmldom (4 advisories: DoS via uncontrolled recursion + 3 XML injection paths) + dompurify (4 advisories: ADD_TAGS form bypass, function-based predicate asymmetry, SAFE_FOR_TEMPLATES bypass, prototype pollution XSS).

Bucket B (npm audit fix --force): Next.js 15.3.9 → 15.5.15 closing 7 advisories. Two are SQUARELY relevant to Phase 6 work: SSRF in middleware redirects (Phase 6.3b just shipped wrong-role middleware redirects) + HTTP request smuggling in rewrites (Phase 6.3 just shipped /api/v1/* rewrite seam). Process note: --force also DOWNGRADED exceljs ^4.4.0 → ^3.4.0 creating new transitive vulns in fast-csv + tmp; reverted package.json exceljs to ^4.4.0; final state Next@15.5.15 + exceljs@^4.4.0 with 6 → 4 vulns. Production build with Next 15.5.15 succeeded.

Bucket C filed as FU-DEPS-RESIDUAL-MODERATE-VULNS P3: 4 moderate residuals with no clean upgrade path — postcss <8.5.10 bundled inside Next (no Next version yet bundles a patched postcss; npm audit suggests downgrading to next@9.3.3 which is absurd) + uuid <14.0.0 transitive through exceljs (only exploitable via custom buf parameter on uuid.v3/v5/v6 — we don't use those overloads). Both theoretical for our app.

**Verification across the session:**
- tsc clean throughout
- npm test: 3291 → 3494 passed / 11 skipped (no regressions; +203 net from new tests)
- npm audit: 6 → 4 (post-fix; remaining are upstream-blocked moderates)
- npm run build: production bundle with Next 15.5.15 succeeds
- All 5 registry scanners: clean status
- Migration phase_6_1_drop_student_sessions APPLIED to prod with verified post-state (table gone, 2 legacy policies replaced with auth.uid() equivalents, scanner status: clean)
- Smoke verified on Vercel preview: student lazy-provision via classcode-login → dashboard navigation → no questerra_student_session cookie anywhere; teacher Class Hub loads (single-route exercise of student-snapshot)

**Follow-ups filed during the session:**
- FU-AV2-LTI-PHASE-6-REWORK (P2) — LTI launch stubbed 410, needs Supabase Auth rewrite
- FU-AV2-CROSS-TAB-ROLE-COLLISION (P2) — single-cookie limit deeper fix paths
- FU-AV2-WRONG-ROLE-TOAST (P3) — surface ?wrong_role=1 banner
- FU-AV2-STALE-TIMETABLE-LINK (P3) — Next.js prefetch noise
- FU-STUDENT-PROGRESS-CLIENT-400 (P3) — frontend widget hits stale total_pages column
- FU-AV2-API-V1-FILESYSTEM-RESHUFFLE (P3) — deferred Option X file moves
- FU-DEPS-RESIDUAL-MODERATE-VULNS (P3) — 4 moderate vulns blocked on upstream patches

**Follow-ups closed during the session:**
- FU-FF (RLS-as-deny-all undocumented) ✅ — `docs/security/rls-deny-all.md` + scanner update
- FU-AV2-AUDIT-MISSING-PHASE-6-CATCHUP (P2) ✅ — §6.4 closed it
- FU-AV2-CRON-SCHEDULER-WIRE (P2) ✅ — last hard pre-pilot blocker
- FU-AV2-PHASE-3-CALLSITES-REMAINING (P3) ✅ — §6.2 closed (audit revealed 8 real gates, not ~40)

**Pre-pilot operational state:**
- ✅ All architectural blockers closed
- ✅ CRON_SECRET set + Vercel redeployed
- ⏳ Sentry alerts setup (audit insert failures, cost-alert sends) — post-pilot polish
- ⏳ Pilot smoke checklist when first NIS student lands

**Tag:** `v0.6-pilot1` on merge commit.

---

## 1 May 2026 (PM) — Access Model v2 Phase 3 SHIPPED + APPLIED TO PROD (Class Roles & Permissions)

**Context:** Continued from "Phase 2 CLOSED" earlier today. Picked up the next master-spec phase: Phase 3 Class Roles & Permissions. Pre-flight audit revealed Phase 0.6c + 0.7a schema seams (`class_members`, `school_responsibilities`, `student_mentors`, `audit_events`) were already live in prod from 29 April with RLS scoped reads — Phase 3 is helpers + UI plumbing + callsite migration, not new schema. Drafted 594-line brief end-to-end with 8 §3.8 open questions; Matt signed off all 8 plus picked Compressed scope for the 50-callsite migration.

**Shipped (9 commits on `access-model-v2-phase-3`, all pushed to origin, NOT merged to main):**

- **Phase 3.0 — kill-switch flag (`6dfbae5`)** — Migration `20260501123351_phase_3_0_permission_helper_rollout_flag.sql` adds `auth.permission_helper_rollout` to admin_settings (default true). When false, the can() shim path falls back to legacy helpers — kill-switch for emergency rollback without code revert. Applied to prod 1 May.

- **Phase 3.1 — 3 SECURITY DEFINER Postgres helpers (`3a2e014`)** — Migration `20260501123401_phase_3_1_permission_helpers.sql` adds `has_class_role(uuid, text?)`, `has_school_responsibility(uuid, text?)`, `has_student_mentorship(uuid, text?)`. All STABLE + SECURITY DEFINER + search_path locked + REVOKE FROM PUBLIC + GRANT TO authenticated, service_role. Sanity DO block asserts Phase 0.8a backfill: every active class with teacher_id has a lead_teacher class_members row (returned 0 missing in prod). 15 shape tests pass. Lesson #64 pre-emptive — these helpers will eventually be called from RLS policies on adjacent tables; SECURITY DEFINER avoids the recursion class that bit Phase 1.4 CS-2. Applied to prod 1 May.

- **Phase 3.2 — can() helper + Action enum + 33 unit tests (`864e369`)** — `src/lib/access-v2/permissions/actions.ts` defines Action union (5 scopes — class/unit/student/school/programme), Resource discriminated union, SubscriptionTier, CanOptions. CLASS_ROLE_ACTIONS matrix (6 roles × 14 actions). STUDENT_MENTOR_ACTIONS, PROGRAMME_COORDINATOR_ACTIONS, PLAIN_TEACHER_FALLBACK_ACTIONS sets. `src/lib/access-v2/can.ts` implements the 6-branch resolution: tier gate → platform admin → class scope → student mentor → programme coordinator → plain-teacher fallback (Decision 7 line 140 preserved exactly). 33 unit tests pass first run, covering all 6 branches + cross-cutting (student-actor short-circuit, kill-switch reader, actionScope detection).

- **Phase 3.3 — `/api/teacher/me/scope` endpoint + 8 tests (`7688f97`)** — Returns the union of class-membership / student-mentorship / school-responsibility "hats" the teacher wears. Chip-shaped JSON for dashboard-v2-build to consume. Cache-Control: private, max-age=30 (Lesson #11). PostgREST embed shape normalised (handles both object + array forms).

- **Phase 3.4a — verify-teacher helpers shim through can() (`0cb2371`)** — `verifyTeacherOwnsClass` / `verifyTeacherHasUnit` / `verifyTeacherCanManageStudent` now delegate to can() when the kill-switch flag is true (default). Each maps to its '.edit' action variant — preserves legacy "can this teacher mutate" semantics exactly. Marked @deprecated. New private helper `buildTeacherSessionForShim(teacherId)` synthesizes a TeacherSession from teacherId via teachers + user_profiles lookup. Closes FU-MENTOR-SCOPE on every route that uses these helpers (cross-class mentor scope via has_student_mentorship).

- **Phase 3.4b — classes INSERT trigger (`c3948f5`)** — Migration `20260501130842_phase_3_4b_classes_seed_lead_teacher_trigger.sql` adds AFTER-INSERT trigger on classes that auto-creates a class_members.lead_teacher row from NEW.teacher_id. SECURITY DEFINER + idempotent NOT EXISTS guard. Applied to prod 1 May. Establishes the structural invariant: every classes row with teacher_id IS NOT NULL has a matching active lead_teacher class_members row. Pairs with Phase 0.8a backfill which seeded historical rows.

- **Phase 3.4c — teacher dashboard expansion (`c88d8cf`)** — `/api/teacher/dashboard` GET reads `class_members` instead of `classes.teacher_id`. Co_teacher / dept_head / mentor / lab_tech / observer of a class now see that class on /teacher dashboard. ClassRow shape gains optional `role` field for chip UI. Sort preserves newest-first by classes.created_at via embed. **First user-visible co-teacher capability gain.**

- **Phase 3.4d — units content PATCH uses can()-backed gate (`d01ce1d`)** — Replaces inline `.eq("author_teacher_id", auth.teacherId)` filter with `verifyTeacherHasUnit` pre-check (which delegates to can() via 3.4a). Co_teacher / dept_head can now edit master unit content. Demonstrates the canonical migration pattern for the deferred ~40 mutation gates.

- **Phase 3.4 followups (`e315cd5`)** — 5 followups filed in `access-model-v2-followups.md`:
  - FU-AV2-PHASE-3-CALLSITES-REMAINING P3 (~40 mutation gates)
  - FU-AV2-PHASE-6-DELETE-SHIMS P3 (3 deprecated helpers + flag)
  - FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2 (Phase 4 auto-tag)
  - FU-AV2-PHASE-3-CHIP-UI P2 (dashboard-v2-build consumer)
  - FU-MENTOR-SCOPE ✅ RESOLVED (closed by 3.4a)
  - FU-AV2-PHASE-3-COLUMN-CLASSIFICATION P3 (added later in this session)

- **Phase 3.6 close-out (this saveme):**
  - schema-registry.yaml: 4 Phase 0 entries (audit_events, class_members, school_responsibilities, student_mentors) rewritten from `status: dropped` + `columns: {}` to `status: applied` + full columns + indexes + RLS metadata. FU-DD class drift fix (compound multi-table CREATE TABLE migration confused the scanner; manual rebuild from migration source).
  - WIRING.yaml: `auth-system.future_needs` trimmed (Phase 1.4 client-switch line removed — already shipped 30 Apr). Two new systems added: `class-management` v2 (with class_members data field + Phase 3.4b trigger note) + `permission-helper` v1 (can() helper + 3 Postgres readers + kill-switch flag).
  - feature-flags.yaml: registered `auth.permission_helper_rollout` (16 → 17 flags).
  - api-registry.yaml: rerun scanner — `/api/teacher/me/scope` registered, `/api/teacher/dashboard` tables_read updated to include `class_members` (was `classes`). Total routes: 397 → 398.
  - rls-coverage.json: rerun scanner — 0 no_rls, 5 pre-existing FU-FF rls_enabled_no_policy entries (unchanged from baseline).
  - decisions-log.md: 5 new Phase 3 entries (scope-trim rationale, SECURITY DEFINER pre-emptive, shim-mapping rationale, trigger over callsite seeding, kill-switch default-true, column-classification deferral).

**Tests:** 2830 → 2886 (+56). tsc strict 0 errors throughout. 11 skipped unchanged.

**Migrations applied to prod 1 May:**
- 20260501123351_phase_3_0_permission_helper_rollout_flag.sql
- 20260501123401_phase_3_1_permission_helpers.sql
- 20260501130842_phase_3_4b_classes_seed_lead_teacher_trigger.sql

**Smoke status:** Phase 3.5 ran 1-2 May. **Checkpoint A4 PASS** with 3 mid-smoke hotfix migrations + 2 route fixes captured. Outcome report appended to `docs/projects/access-model-v2-phase-3-smoke.md`.

  - **Phase 3.4e** (`20260501141142_phase_3_4e_classes_class_members_read_policy.sql`) — adds `"Class members read their classes"` SELECT policy on `classes` via `has_class_role(id)`. Closes the PostgREST `classes!inner` embed gap surfaced in Scenario 2 (Teacher 2 saw 6 classes instead of 7).
  - **Phase 3.4f** (`20260501142442_phase_3_4f_is_teacher_of_student_includes_class_members_and_mentors.sql`) — rewrites `is_teacher_of_student(uuid)` to add `has_class_role(cs.class_id)` + `has_student_mentorship(s.id)` OR branches. All 3 students RLS policies inherit fix. Closes FU-MENTOR-SCOPE on every route using the helper.
  - **Phase 3.4g** (route, no migration) — `/api/teacher/me/scope` mid-smoke fix in two pushes. v1 pinned embed FK by constraint name (didn't shake the auto-alias loose); v2 dropped the embed entirely + follow-up `students` lookup by ID with `display_name` fallback to `username`. Original embed `students(name)` was syntactically invalid because `students` table has no `name` column.
  - Mid-smoke `_debug` payload added to `/me/scope` for diagnostic surfacing (commit `d16b285`); removed on close-out (commit `0755d20`).

**FU-MENTOR-SCOPE P1 ✅ resolved** by Phase 3.4f rewrite (every route using `is_teacher_of_student` now grants cross-class mentor access).

**Lesson candidate #66** — when a phase introduces a new junction table + helper functions that read it, audit every existing RLS policy + helper function on adjacent tables for "do they consult the new junction?" — not just the writers + readers of the new table itself. Surfaced 3 instances during Phase 3.5 smoke that the Phase 3 brief's audit hadn't caught.

**Branch state:** `access-model-v2-phase-3` 17 commits ahead of `origin/main`. NOT merged to main per methodology rule 8 — feature branch holds until explicit Checkpoint A4 merge command. Ready for fast-forward.

**Capability live in prod (subject to feature branch deploy):**
- Co_teacher / dept_head / mentor / lab_tech / observer see shared classes on `/teacher` dashboard
- Co_teacher / dept_head can edit master unit content
- Cross-class mentors (`student_mentors` rows) can manage their mentees on every route using verify-teacher helpers — closes FU-MENTOR-SCOPE
- `/api/teacher/me/scope` returns role chips ready for dashboard-v2-build to consume
- Every new class auto-gets a class_members.lead_teacher row via the trigger

**Next:** Checkpoint A4 sign-off → merge to main. Then Phase 4 — School Registration, Settings & Governance (~3 days, master spec §4 line 253).

---

## 1 May 2026 (later) — Phase 2 CLOSED ✅ + Apple scaffold + admin Cache-Control + Phase 1 trigger leak fix

**Context:** Continued from Phase 2.3 saveme. Closed out the remaining Phase 2 sub-phases (2.4 Apple flag scaffold + 2.5 Checkpoint A3) and fixed a pre-existing Phase 1 bug that surfaced during the admin-side smoke.

**Phase 2.4 — Apple OAuth scaffold (`6dd4bb4`):**
- Apple sign-in button + `handleAppleSignIn` handler added to `LoginForm.tsx`, gated by `allowedModes.includes("apple")`.
- 3 layers off by default: env var `NEXT_PUBLIC_AUTH_OAUTH_APPLE_ENABLED=false`, no school has 'apple' in allowed_auth_modes, Supabase provider not configured.
- 2 new helper tests (apple in school allowlist + apple stripped when global flag off).

**Phase 2.5 — Checkpoint A3 ✅ PASS (`700c040` + `6e768cc`):**
- All 8 functional smoke criteria green. Email/password sign-in + teacher invite flow verified during admin smoke.
- Sole open follow-up: `FU-OAUTH-LANDING-FLASH` (P2, cosmetic, deferred).
- Report: `docs/projects/access-model-v2-phase-2-checkpoint-a3.md`.

**/api/admin/* Cache-Control fix (`41e7f3c`):**
- Closed a Lesson #11 gap. `/api/auth/*`, `/api/student/*`, `/api/fab/*` were already `private`; admin routes were missed in Phase 1B-2 hardening.
- `requireAdmin()` calls `supabase.auth.getUser()` which can trigger session refresh + Set-Cookie write-back. Without `private`, Vercel CDN strips Set-Cookie → breaks subsequent auth.

**Phase 1 spillover — handle_new_teacher trigger fix (`7bc19ea` + `2a34191`):**
- During /admin/teachers smoke, ~7 phantom rows with synthetic emails `student-<uuid>@students.studioloom.local` appeared in the teacher list.
- Root cause: `handle_new_teacher` trigger from `001_initial_schema.sql` (~18 months old) blindly inserted into `teachers` on every `auth.users` insert. Phase 1.1d (29 Apr 2026) started provisioning student auth.users — trigger fired and leaked phantom teacher rows.
- Migration `20260501103415_fix_handle_new_teacher_skip_students.sql` applied to prod 1 May 2026:
  - Updated trigger to skip when `raw_app_meta_data->>'user_type' = 'student'`.
  - Backfill DELETE with safety assertion (refused to delete if any leaked row had FK references in classes/units/students — none did).
  - Notice log: `7 leaked teacher rows found`, `0 leaked rows have FK references`, `deleted 7 leaked teacher rows`.
- **Security audit clean** — `buildTeacherSession` routes only on `user_type='teacher'`; `requireAdmin` checks `is_admin=true` which was false on phantoms. Cosmetic only.
- **Lesson #65 logged** — old triggers don't know about new user types; audit auth.users triggers before introducing a new user role.

**Tests:** 2828 → 2830 (+2 from Phase 2.4). tsc strict 0 errors.

**Commits on main:**
- `6dd4bb4` — feat(auth): Phase 2.4 — Apple OAuth feature flag scaffold
- `700c040` — docs(access-v2): Phase 2 Checkpoint A3 report — PARTIAL PASS
- `41e7f3c` — fix(security): /api/admin/* needs Cache-Control: private (Lesson #11)
- `7bc19ea` — claim(migrations): reserve fix_handle_new_teacher_skip_students timestamp
- `2a34191` — fix(migration): handle_new_teacher skips student user_type + cleans leaks
- `6e768cc` — docs(access-v2): Phase 2 Checkpoint A3 ✅ PASS — all 8 criteria green

**Files touched:** `src/app/teacher/login/LoginForm.tsx`, `src/lib/auth/__tests__/allowed-auth-modes.test.ts`, `next.config.ts`, `supabase/migrations/20260501103415_fix_handle_new_teacher_skip_students.{sql,down.sql}`, `docs/projects/access-model-v2-phase-2-checkpoint-a3.md`, `docs/decisions-log.md` (+5 entries), `docs/lessons-learned.md` (+Lesson #65), `docs/changelog.md` (this entry).

**Outstanding:**
- `FU-OAUTH-LANDING-FLASH` P2 — cosmetic, deferred.
- `FU-AZURE-MPN-VERIFICATION` P3 — gated on second-school pilot.
- `FU-LEGAL-LAWYER-REVIEW` P2 — pre-pilot expansion.
- `FU-CUSTOM-AUTH-DOMAIN` P3 — Supabase Pro custom auth domain.
- Google Cloud Console branding fields — Matt to fill in for Google consent screen polish.
- `mattburto@gmail.com` smoke teacher row in prod — still there, soft-delete or label optionally.

**Next:** Phase 3 — Auth Unification (every student → `auth.users`). ~3 days per master spec. Will need its own brief + pre-flight before code.

---

## 1 May 2026 — Phase 2.2 OAuth + Phase 2.3 allowlist BOTH SHIPPED + APPLIED TO PROD ✅

**Context:** Picked up from Phase 2.2 mid-flight handoff (Matt was configuring Google Cloud Console). Closed out 2.2 with Google sign-in button, OAuth consent screen branding (legal pages + Microsoft publisher domain verification), then went straight into Phase 2.3 — the auth-mode allowlist that lets China-locked schools restrict to email_password.

**Phase 2.2 closure:**
- Google sign-in button shipped (`58a442d`) — mirrors Phase 2.1 Microsoft button, calls `signInWithOAuth({ provider: 'google' })`, reuses provider-agnostic `/auth/callback` route.
- Smoke passed with `mattburto@gmail.com` (added to Google Cloud Test Users). New teacher row provisioned.
- Privacy + Terms pages drafted at `/privacy` and `/terms` (`4ae2f0f`) for OAuth consent screen branding requirements. Stamped "Last updated 1 May 2026"; flagged `FU-LEGAL-LAWYER-REVIEW` P2 — not lawyer-vetted yet.
- Microsoft Azure publisher domain verified on `www.studioloom.org` (`27f43c9`) — `studioloom.org` apex 307-redirects to www, Azure refuses to follow redirects during verification, so verification field set to `www`. File hosted at `/public/.well-known/microsoft-identity-association.json`.
- Microsoft consent screen now shows StudioLoom branding (no more "Unverified" label).
- Email correction: `hello@studioloom.org` → `hello@loominary.org` (`0ec0db4`) — Loominary is the umbrella entity, mailbox lives there.
- 4 follow-ups filed: `FU-AZURE-MPN-VERIFICATION` P3, `FU-LEGAL-LAWYER-REVIEW` P2, `FU-CUSTOM-AUTH-DOMAIN` P3, `FU-OAUTH-LANDING-FLASH` P2 (1-2s landing-page flash mid-OAuth, sign-in succeeds, cosmetic).

**Phase 2.3 SHIPPED + APPLIED TO PROD:**
- Migration `20260501045136_allowed_auth_modes.sql` applied to prod Supabase by Matt 1 May 2026.
- `schools.allowed_auth_modes TEXT[] NOT NULL DEFAULT [email_password,google,microsoft]`.
- `classes.allowed_auth_modes TEXT[] NULL` — NULL means inherit from school.
- CHECK constraints include `'apple'` for Phase 2.4 forward-compat. `array_length >= 1` so admins can't write empty allowlists.
- Helper `src/lib/auth/allowed-auth-modes.ts` — `getAllowedAuthModes` (DB) + `resolveAllowedAuthModes` (pure). 11 unit tests covering 4 scope cases + safety-net + apple. Always returns non-empty (email_password fallback).
- Login page split into server `page.tsx` (reads `searchParams`) + client `LoginForm.tsx`. Buttons render conditionally per resolved modes. Amber restriction banner when scope is supplied AND OAuth is unavailable.
- Settings UI deferred to Phase 4 — admin edits via Supabase SQL editor for v1.
- Schema-registry synced. Feature-flags.yaml updated with `NEXT_PUBLIC_AUTH_OAUTH_APPLE_ENABLED`.

**Smoke (1 May 2026 prod):**
- Unscoped login renders all 3 modes (Microsoft, Google, email/password). ✅
- School-scoped (`UPDATE schools SET allowed_auth_modes = ARRAY['email_password']` + load `?school=<uuid>`) → only email/password renders + amber banner shows. ✅
- Class-scoped (same pattern with classes.code) → only email/password renders. ✅

**Tests:** 2817 → 2828 (+11). tsc strict 0 errors throughout.

**Commits on main:**
- `58a442d` — feat(auth): Phase 2.2 — Google OAuth sign-in button
- `4ae2f0f` — feat(legal): privacy + terms pages
- `27f43c9` — chore(azure): host microsoft-identity-association.json
- `e251b80` — docs(access-v2): file Phase 2.2 follow-ups + draft Phase 2.3 sub-brief
- `6698670` — claim(migrations): reserve allowed_auth_modes timestamp
- `756267a` — feat(auth): Phase 2.3 — allowed_auth_modes allowlist (schema + login filtering)
- `0ec0db4` — fix(legal): contact email is hello@loominary.org

**Outstanding from Phase 2:**
- Phase 2.4 — Apple OAuth feature flag scaffold (~1h, no real Apple integration).
- Phase 2.5 — Checkpoint A3 verification + smoke.

**Files touched:** `src/app/teacher/login/page.tsx` (refactored to server component) + `LoginForm.tsx` (new client component); `src/app/(legal)/{layout,privacy,terms}.tsx` (new); `src/lib/auth/allowed-auth-modes.ts` (new) + tests; `public/.well-known/microsoft-identity-association.json` (new); `supabase/migrations/20260501045136_allowed_auth_modes{,.down}.sql` (new); `docs/projects/access-model-v2-phase-2-brief.md` (status updates) + `access-model-v2-phase-2-3-brief.md` (new) + `access-model-v2-followups.md` (new); `docs/feature-flags.yaml` (added apple flag entry); `docs/decisions-log.md` (+10 decisions); `docs/api-registry.yaml` + `docs/ai-call-sites.yaml` + `docs/schema-registry.yaml` (synced).

---

## 30 Apr 2026 (very late) — Phase 2.1 Microsoft OAuth SHIPPED + VERIFIED LIVE + 2 bonus fixes ✅

**Context:** Continued from "All 5 follow-ups closed" earlier. Started Phase 2 (OAuth + email/password for teachers). Phase 2.1 (Microsoft) shipped end-to-end + verified live with Matt's NIS account. Two bugs surfaced + fixed in the same segment.

**Phase 2.1 — Microsoft OAuth (commit `539a173`):**

- `/teacher/login/page.tsx` — added "Sign in with Microsoft" button calling `supabase.auth.signInWithOAuth({ provider: "azure" })`.
- `/auth/callback/route.ts` — extended to handle OAuth code exchange (was previously PKCE-only for password reset). Routes:
  - `type=recovery` → `/teacher/set-password`
  - `type=invite` → `/teacher/set-password?next=/teacher/welcome`
  - First-login OAuth (no teacher row) → provision teachers row + set `app_metadata.user_type='teacher'` → `/teacher/welcome`
  - Existing teacher → `/teacher/dashboard` (or `next` param)
- `provisionTeacherFromOAuth()` helper inside callback. Idempotent (23505 unique-violation = success).
- External setup (Matt did in dashboards): Azure AD app registration as multi-tenant ("Multiple Entra ID tenants" / "Allow all tenants"), client secret minted, Supabase Azure provider configured with `https://login.microsoftonline.com/common`, "Allow same email logins" enabled for identity linking.

**Bug 1 — Phase 0 user_type backfill gap (commit `eb866a7`):**

Phase 0's backfill set `app_metadata.user_type` for students but NOT teachers. So existing teachers (Matt + every other backfilled teacher) had `user_type: null` in their JWT. Phase 1.3's `getActorSession()` returned null → routes using `requireTeacherSession`/`requireStudentSession` would 401. Dashboard rendered because legacy `requireTeacherAuth` only checks `user.id`, but post-CS-2/CS-3 routes that use polymorphic dispatch would silently fail.

**Two-part fix:**
1. **Prod backfill via SQL** — `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"user_type":"teacher"}'::jsonb WHERE id IN (SELECT id FROM teachers) AND user_type missing.` Result: `teachers_missing_user_type: 0` post-update.
2. **Callback patched** to be idempotent — every OAuth login now checks `app_metadata.user_type` and sets it if missing. Future teachers signing in via OAuth (or any auth path that hits the callback) get the claim set automatically.

**Bug 2 — Dashboard hero rendered giant em-dash for classes with no units (commit `3cbd273`):**

`NowHero` rendered `vm.unitTitle` at 100-108px — when `unitTitle` was the fallback `"—"`, the giant em-dash + period looked like colored placeholder bars. Surfaced when Matt's hero showed Period 1 = 9 Design (a class with no class_units rows). Pre-existing bug, not Phase-2-introduced; just exercised for the first time.

**Two-part fix:**
1. `resolveCurrentPeriod()` — falls back to `cls.units[0]` when `entry.unitId` is null but the class has class_units assigned. Mirrors the today endpoint's "first unit per class" choice.
2. `NowHero` — when `vm.unitId` is null, renders explicit empty state ("No unit assigned. / Pick a unit to teach this class — the hero will fill in.") at smaller typography. No more giant em-dash.

**FU-DASHBOARD-HERO-NULL-UNIT-TITLE** filed as ✅ RESOLVED (`b000fcc`).

**State of working tree:** clean (post-saveme). Tests 2817 passed | 11 skipped. Typecheck 0 errors.

**Smoke verified live in prod:**
- Sign in with Microsoft from incognito → `/teacher/dashboard` (existing teacher path)
- DevTools cookies show `sb-cxxbfmnbwihuskaaltlk-auth-token.0/.1` set
- After backfill + re-login: `auth.users.raw_app_meta_data->>'user_type' = 'teacher'`
- Hero now shows "No unit assigned." empty state for 9 Design (correct, since 9 Design has no units assigned)
- Same-email linking confirmed: 1 row per teacher email, `auth_users_id = teacher_id`

**Next:** Phase 2.2 (Google OAuth, ~30 min once Google Cloud Console + Supabase Google provider are configured). Same callback infrastructure; just adds the second button + provider.

---

## 30 Apr 2026 (end-of-day) — All 5 Access-Model-v2 follow-ups closed + UI-INSERT atomic create route shipped ✅

**Context:** Continued from "CS-3 + audit closed" earlier. Cleared the Phase 1.4 follow-up backlog — 4 P3s + 1 P2 closed. Day total: Phase 1 close → Phase 1.4 client-switch (CS-1+CS-2+CS-3) → 5 follow-ups → fully clean state for Phase 2.

**Follow-ups closed this segment:**

- **FU-AV2-UNITS-ROUTE-CLASS-DISPLAY (P3) ✅** — `cf37901`. Three fixes to `/api/student/units` class-picker logic: dropped `students.class_id` legacy fallback, filtered archived classes, recency-ordered enrollments. Smoke verified live: test2's response now shows `class_id: a7afd4f3` (Service LEEDers, active) instead of `82d7fb45` (g9 design, archived).

- **FU-AV2-PHASE-14B-2 (P3) ✅** — `77ad01e`. Mechanical auth-helper swap across 18 GET-only student routes. Replaced `requireStudentAuth` (legacy) with `requireStudentSession` (Supabase Auth). Zero data-path changes — all 18 routes still use admin client for queries. 3 test files updated for the new mock target.

- **FU-AV2-STUDENT-BADGES-COLUMN-TYPE (P3) ✅** — `40a14c5`. Pre-flight verified 4 rows total, all UUID-shaped, zero orphans. ALTER COLUMN TEXT → UUID, ADD FK to students(id) with ON DELETE CASCADE, DROP+CREATE all 3 student_badges policies without `::text` casts. Code callers unchanged (postgres-js auto-coerces string UUIDs).

- **FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2) ✅** — `b35979d`. Built new `POST /api/teacher/students` route: auth + class-ownership check + students INSERT + provisionStudentAuthUserOrThrow + optional class_students enrollment, atomic-ish (rolls back student INSERT on auth failure). Migrated all 5 client-side INSERT call sites + the createStudent/createAndEnroll helpers to use the route via fetch. 11 new route tests. Smoke verified: test student `newtest` created with `user_id` populated immediately + correct school_id + correct author_teacher_id.

- **CS-2 SECURITY DEFINER WITH CHECK fix** — `9c35682`. Surfaced during UI-INSERT smoke that `Teachers manage students` (FOR ALL) was broken for INSERT — `is_teacher_of_student(NEW.id)` returns false for new rows because they're not in the table when WITH CHECK fires. Split FOR ALL into 4 cmd-specific policies: SELECT/UPDATE/DELETE use the SECURITY DEFINER helper (existing-row context); INSERT uses direct `author_teacher_id = auth.uid()` column check (recursion-safe, INSERT-safe). Latent bug from earlier today's CS-2 hotfix; fixed before any real student creation hit it.

**Migrations applied to prod this segment (3):**
- `20260430030419` — units student-read (was applied earlier today, not yet captured in this changelog entry; was part of CS-3)
- `20260430042051` — student_badges TEXT→UUID + FK + policy cleanup
- `20260430053105` — students Teachers WITH CHECK split (4 policies replace 1 FOR ALL)

**State of working tree:** clean (post-saveme commit). Tests 2817 passed | 11 skipped. Typecheck 0 errors.

**Lessons surfaced (not added — observed):** SECURITY DEFINER policies on FOR ALL break INSERT WITH CHECK because the function's internal SELECT runs against pre-INSERT table state. Mitigation: split FOR ALL into per-cmd policies when the policy needs different logic for INSERT vs S/U/D. Captured in the migration's WHY block; consider whether to elevate to formal Lesson #65 if this pattern recurs.

**Day total (3 sessions, one continuous workflow):**
- Phase 1 closed under Option A
- Phase 1.4 client-switch CS-1/CS-2/CS-3 (6/6 Phase 1.4b routes load-bearing under RLS)
- Frontend login swap + student-session dual-mode
- 2 SECURITY DEFINER recursion hotfixes + 1 WITH CHECK split
- Comprehensive RLS audit (zero cycles)
- 18 GET routes auth helper swap
- 1 column type cleanup (TEXT → UUID + FK)
- New atomic POST /api/teacher/students route
- 5 follow-ups closed
- 10 RLS/schema migrations applied to prod
- ~30 commits to main
- Tests: 2792 → 2817 (+25)
- Lesson #64 added
- 0 production regressions

**Next session:** Phase 2 (OAuth Google/Microsoft + email/password for teachers, ~3-4 days). All Phase 1 hygiene closed. Polymorphic `getActorSession()` from Phase 1.3 is the seam Phase 2 plugs into.

---

## 30 Apr 2026 (latest) — Phase 1.4 client-switch CS-3 SHIPPED + comprehensive RLS audit closed ✅

**Context:** Continued from "CS-1 + CS-2" earlier this session. Picked Option B (comprehensive RLS audit before CS-3) to avoid per-route diagnostic surprises.

**Audit (FU-AV2-RLS-SECURITY-DEFINER-AUDIT closed ✅ RESOLVED):**
- Queried pg_policies for every cross-table-subquery pattern across the 21 tables CS-3 routes touch.
- Mapped each: does the subqueried table have a policy that back-references the calling table?
- Verdict: **zero remaining cycles.** The two CS-2 SECURITY DEFINER hotfixes (`students↔class_students`, `classes↔class_students`) closed the only two recursion-prone policy pairs in the system.
- Findings table preserved in the (now-resolved) FU entry as the safety proof.

**CS-3 (4 routes switched to SSR client):**
- `grades` — assessment_records read under "Students read own published assessments" (CS-1).
- `units` — multi-table read across students/class_students/classes/class_units/units/student_progress.
- `safety/pending` — cross-table chain through class_units → unit_badge_requirements → student_badges.
- `insights` — biggest surface (10+ tables). RLS-enforced.

**CS-3 hotfix (1 migration applied to prod): `units` student-read policy.**
- Smoke surfaced empty results from 3 of 4 routes — `units` table only had `Teachers read own or published units`. Students could read only published units. Unpublished assigned units were RLS-blocked.
- Fix: additive `Students read own assigned units` USING `id IN (class_units → class_students → students)`.
- Migration `20260430030419` applied + verified.
- Re-smoke: `grades` returns real `unitTitle: "Arcade Machine Project"`, `units` returns full unit data, `safety/pending` shows real `unit_title`, `insights` unchanged.

**Total Phase 1.4 client-switch state at end of session:**
- 6/6 Phase 1.4b routes use SSR client. Phase 1.5/1.5b/CS-1/CS-3 student-side policies are load-bearing across the entire surface.
- 4 RLS migrations applied to prod (3 CS-1 + 1 CS-3 hotfix). 2 SECURITY DEFINER hotfixes from CS-2 still in place.

**Schema-registry YAML hygiene fix:** earlier today's CS-1 saveme had a Python script that appended spec_drift entries AFTER `spec_drift: []` instead of replacing it — produced invalid YAML at 3 locations (assessment_records, classes, student_badges). Caught when api-scanner failed to parse. Fixed via regex substitution + manual restructure for the `classes` entry (had a separate `changes_in_phase_7a` field interleaved). All scanners now run clean.

**Pre-existing finding documented:** `/api/student/units` route shows wrong class for multi-class units (picks legacy `students.class_id` archived class over active enrollment). Filed FU-AV2-UNITS-ROUTE-CLASS-DISPLAY (P3). Display-layer bug, not a CS-3 regression — pre-existed under admin client.

**Commits this segment:** `e44e883..a958a2b..a958a2b` (CS-3 timestamp claim + units RLS hotfix) + saveme.

**State of working tree:** clean (post-saveme). Tests 2806 passed | 11 skipped. Typecheck 0 errors. Migration collision gate clean.

**Next:** CS-4 (negative control) is now informational only — already verified RLS enforcement via earlier debug instrumentation. CS-5 close-out covered by this saveme. **Phase 1.4 client-switch effectively complete for the 6 Phase 1.4b routes.** Remaining work: 18 GET routes (FU-AV2-PHASE-14B-2 P3 — cosmetic, dual-mode wrapper covers them), Batch B mutation routes, Batch C teacher routes, eventual Phase 6 cutover.

---

## 30 Apr 2026 (later) — Phase 1.4 client-switch CS-1 + CS-2 SHIPPED: RLS load-bearing in prod for the first time ✅

**Context:** Continued from earlier "Phase 1 CLOSED" session. Picked up Phase 1.4 client-switch (FU-AV2-PHASE-14-CLIENT-SWITCH P2) — switch the 6 Phase 1.4b routes from `createAdminClient()` (admin bypass) → `createServerSupabaseClient()` (RLS-respecting). First time RLS would actually carry weight in production traffic; revealed multiple latent bugs from Phase 1.5/1.5b/CS-1 that admin-client testing had masked.

**Pre-flight findings (3 audit findings drove CS-1):**
1. `classes` had no student-side RLS policy. Routes would silently 0-row post-switch.
2. `assessment_records` had no student-side RLS policy. Same.
3. `student_badges_read_own` policy used the **never-functional** `current_setting('app.student_id')` + `request.jwt.claims->>'sub'` pattern. Schema-registry annotated it as canonical chain (`(their)`) but the SQL was broken — Lesson #54 in action. Has been returning 0 rows for every student under every auth path that has ever existed; app-level filtering masked it.

**Sub-phases shipped (all on `main`, no working branch — given no real users):**

- **CS-1 (3 migrations applied to prod):** `classes_student_self_read`, `assessment_records_student_self_read` (draft-filtered), `student_badges_rewrite` (DROP + CREATE with canonical chain). Migration 3 hit a `text = uuid` operator error: `student_badges.student_id` is TEXT not UUID (technical debt from migration 035 — the column was created as `TEXT NOT NULL "nanoid from student_sessions"`, never converted to UUID + FK). Fix: `::text` cast on RHS to mirror the existing teacher policy. Filed FU-AV2-STUDENT-BADGES-COLUMN-TYPE P3 for proper cleanup. 14 shape tests added.

- **CS-2 (2 routes switched + helper refactor):** `me/support-settings`, `me/unit-context` switched to SSR client. Helpers `resolveStudentSettings` + `resolveStudentClassId` refactored with optional `supabase: SupabaseClient` parameter (default `createAdminClient()` — backwards-compatible additive change, same shape as Phase 1.4a's dual-mode wrapper). 5 existing callers (4 teacher routes + 1 student word-lookup) unchanged.

- **Frontend login swap:** `(auth)/login/page.tsx:21` was still POSTing to legacy `/api/auth/student-login`. Phase 1.4b's `requireStudentSession` switch had been **silently 401-ing 6 routes for every browser-based student** since it shipped (because legacy login set only `questerra_student_session` cookie, no sb-* cookies; Phase 1.4 prod-preview tests used cURL with new endpoint directly, never browser→legacy-page→API). One-line swap to `/api/auth/student-classcode-login`. Closes the regression.

- **`student-session` route dual-mode:** When the frontend swap shipped, students bounced back to login. Cause: `(student)/layout.tsx:48` calls `/api/auth/student-session` which was legacy-only — read `questerra_student_session` cookie, 401'd on missing. Same dual-mode pattern as Phase 1.4a's `requireStudentAuth` wrapper applied: try `getStudentSession()` first, fall back to legacy. Bounce loop closed.

- **Two emergency RLS recursion hotfixes (SECURITY DEFINER pattern):**
  - **`students ↔ class_students` cycle.** Teachers manage students subqueries class_students; class_students self-read subqueries students; recursion. Fixed via `public.is_teacher_of_student(uuid)` SECURITY DEFINER helper (migration `20260430010922`).
  - **`classes ↔ class_students` cycle.** CS-1's "Students read own enrolled classes" subqueries class_students; class_students teacher policy (since migration 041) subqueries classes; recursion. Fixed via `public.is_teacher_of_class(uuid)` (migration `20260430015239`).

  Both ran as admin-client-bypassed for years; the moment SSR client touched them, they fired. Filed FU-AV2-RLS-SECURITY-DEFINER-AUDIT P2 for the comprehensive sweep — 6+ Phase 1.5/1.5b/CS-1 policies still have latent recursion potential, will surface as more routes switch.

- **End-to-end smoke verified live in prod:**
  - test2 logs in via classcode-login → sb-* cookies set ✅
  - Dashboard loads + STAYS loaded (no bounce) ✅
  - `me/support-settings`: `{"l1Target":"zh","l1Source":"intake","tapASource":"default"}` — REAL data, not defaults ✅
  - `me/unit-context`: `{"class":{"id":"a7afd4f3","name":"Service LEEDers","code":"QKKL4Q","framework":"IB_MYP"}}` ✅
  - Debug instrumentation confirmed: `classes` query returns 2 rows (test2's enrollments), correctly filtering out `Grade 8 Design` (not enrolled). RLS is enforcing.

**Lessons added: #64 — Cross-table RLS subqueries silently recurse; SECURITY DEFINER for any policy that joins through another RLS-protected table.** Sibling to #38 (verify expected values) + #54 (registries can claim things that aren't true). The new operational rule: every future Access-Model-v2 phase that ships RLS policies must include at least one SSR-client smoke test in the same phase, as a Checkpoint criterion.

**Systems affected:** `auth-system` (still v2; behavior changed under SSR client), `student-experience` (login flow + dashboard render path), `student-pm` (me/support-settings), `unit-system` (me/unit-context).

**Migrations applied to prod (5 across the day):**
- `20260429231118` — classes_student_self_read (CS-1)
- `20260429231124` — assessment_records_student_self_read (CS-1)
- `20260429231130` — student_badges_rewrite (CS-1, with column-type cast workaround)
- `20260430010922` — students↔class_students recursion fix (CS-2 hotfix #1)
- `20260430015239` — classes↔class_students recursion fix (CS-2 hotfix #2)

**Commits to main this session window (~15 commits):** `b2082dc..4ad144e`. Includes both the productive shipping (CS-1 SQL bodies, CS-2 route + helper changes, frontend swap, dual-mode student-session) and the diagnostic detours (debug instrumentation pushed + reverted, emergency hotfix migrations).

**State of working tree:** clean. Tests 2806 passed | 11 skipped (no regression). Typecheck 0 errors. CI green throughout.

**Follow-ups filed today:**
- FU-AV2-STUDENT-BADGES-COLUMN-TYPE (P3) — column should be UUID + FK to students(id), not TEXT
- FU-AV2-RLS-SECURITY-DEFINER-AUDIT (P2) — comprehensive sweep of 6+ remaining cross-table-subquery policies

**Next:** CS-3 (4 routes — grades, units, safety/pending, insights). Will surface more recursion cycles (probably in `assessment_records`, `competency_assessments`, etc.). Each cycle is ~30 min to fix once the pattern is known. Or do the comprehensive SECURITY DEFINER audit pre-emptively (P2 follow-up) and then ship CS-3 cleanly.

---

## 30 Apr 2026 — Access Model v2 Phase 1 CLOSED (Option A): auth path live, RLS pre-positioned, client-switch deferred ✅

**Context:** Two-day session continuing from the Day-1 saveme that shipped Phases 1.1a/1.1b/1.1d/1.2/1.3/1.4a/1.4b/1.5/1.5b on branch. Day 2 applied 8 RLS migrations to prod, then closed Phase 1 with Phase 1.6 cleanup + Phase 1.7 registry hygiene under "Option A" scope (full client-switch deferred to a follow-up rather than absorbed into Phase 1).

**What changed (4 commits across the day, all on `access-model-v2-phase-1`):**

- **Day 2 morning — 8 RLS migrations applied to prod** via Supabase SQL Editor in timestamp order. 4 from Phase 1.5 (3 rewrites of broken policies + 1 additive on `students`); 4 from Phase 1.5b (additive on `class_students`, `student_progress`, `fabrication_jobs` + `fabrication_scan_jobs`, deny-all on `student_sessions`). Verification queries returned expected pg_policies rows for each. `scan-rls-coverage.py` confirmed `student_sessions` + `fabrication_scan_jobs` exited the `rls_enabled_no_policy` drift bucket.

- **Phase 1.6 cleanup (`be2f3c8`):** Dropped the temporary alias pattern (`const auth = { studentId: session.studentId }`) from 3 of the 6 Phase 1.4b routes — `grades`, `me/support-settings`, `me/unit-context` now use `studentId` directly. The other 3 Phase 1.4b routes (`units`, `insights`, `safety/pending`) were never aliased. Also created `docs/security/student-auth-cookie-grace-period.md` documenting dual-auth-path coexistence semantics until Phase 6 cutover (cookie surface during the grace window, stale-token edge case, RLS implications, audit-trail asymmetry).

- **Phase 1.7 registry hygiene (`936fd96`):** WIRING.yaml `auth-system` rewritten to v2 — summary describes polymorphic auth.users + app_metadata.user_type model + dual-mode wrapper grace period; `affects` expanded 4 → 12 systems (every student-* surface that consumes the helper); `key_files` corrected (removed nonexistent `student-session.ts`, added `actor-session.ts`, `provision-student-auth-user.ts`, classcode-login route); `data_fields` adds `students.user_id`. schema-registry.yaml: spec_drift entries on 12 tables touched by Phase 1.5 + 1.5b. dimensions3-followups.md: FU-AV2-PHASE-15B ✅ RESOLVED; new **FU-AV2-PHASE-14-CLIENT-SWITCH (P2)** filed (route migration, supporting-table policies, live RLS harness, cross-class smoke, feature flag). Phase 1 brief §7 split into "Phase 1 close (NOW)" + "Deferred to client-switch follow-up".

- **Saveme registry sync:** scan-api-routes / scan-ai-calls / scan-feature-flags / scan-vendors / scan-rls-coverage all rerun. No new drift introduced by Phase 1 work; pre-existing drifts unchanged (FU-FF flagged tables remain intentionally deny-all; feature-flags drift pre-existing).

**Systems affected:** `auth-system` (v1 → v2). Indirectly: every student-* surface (12 systems in the rewritten `affects` list).

**State of working tree:** clean (post-saveme commit). Tests 2762 passed | 11 skipped (no regression from Day 1 baseline). Typecheck 0 errors. 24+ commits ahead of main, all pushed.

**Decisions logged:** see decisions-log entry "Phase 1 closed under Option A — RLS pre-positioned not load-bearing (30 Apr 2026)". Lessons #62 + #63 added Day 1.

**Next:** merge `access-model-v2-phase-1` → `main` (with `git merge origin/main` first to absorb the school_id NOT NULL hotfix commits). Then Phase 2 (OAuth + email-password for teachers) per `docs/projects/access-model-v2.md`.

---

## 29 Apr 2026 — Bug-report system overhaul: role-hint auth, rich client_context, Sentry, screenshots, dedupe, email, motion polish ✅

**Context:** Matt noticed a student-submitted bug report was tagged
`reporter_role = "teacher"` in the admin panel and asked what could be
improved. The existing `/admin/bug-reports` UI captured only
description / category / page_url / last 5 console.errors and showed a
flat list filtered only by status. Sentry was installed (`@sentry/nextjs`
10.43.0) but never linked to bug reports. No screenshot UX existed despite
the schema having a `screenshot_url` column. No notifications, no
dedupe.

**What changed (one branch on main, ~6 commits, 2 migrations applied to
prod 28–29 Apr):**

- **Role-hint auth fix** (commit `7a30e04`, migration
  `20260428230559_add_bug_report_client_context`): API resolution order
  was always Supabase Auth first → student session second. If a student
  was logged in on a profile that also had a teacher Supabase Auth
  session, every report got tagged "teacher". Frontend now sends
  `role_hint`; API tries the matching source first and falls through
  the other way only if it fails. Hint is verified, not trusted.
- **Rich `client_context` JSONB column** added to `bug_reports`. Captures
  userAgent, platform, language(s), viewport (w/h/DPR), screen, connection
  (effectiveType/downlink/RTT/saveData), hardware (cores/memory/touch),
  release SHA, deploy env, timezone, time-on-page, referrer, route
  context (`{routeKind, unitId, lessonNumber, activityNumber, classId}`
  parsed client-side from `/unit/:id/L:n/A:n`, `/class/:id`, etc.), and
  rolling last-10 runtime events (console.error / console.warn /
  window.error / unhandledrejection — the screenshot Matt sent of an
  unhandledrejection would have been missed by the old console.error-only
  hook).
- **Admin UI overhaul** (`784f3d2`, `4ef85eb`): structured 4-section
  context grid (Page / Browser / Viewport / Network & Hardware) with
  per-row labels that hide on null. Filter bar with free-text search
  across description+page_url+admin_notes plus Status/Category/Role
  button rows with live counts and a one-click "clear filters" link.
  Reporter role shown as a coloured chip on each row card (cyan/purple).
- **Sentry tie-in** (`eebd5ef`, migration `20260429010718`): client calls
  `Sentry.captureMessage` at submit time tagged with `bug_report`,
  `bug_category`, `reporter_role`, `class_id`, `route_kind`. Returned
  `event_id` stored in new `bug_reports.sentry_event_id` column. Admin
  links to the Sentry events search (`NEXT_PUBLIC_SENTRY_ORG_SLUG` /
  `NEXT_PUBLIC_SENTRY_PROJECT_SLUG` env vars narrow the deep-link to a
  specific project).
- **Screenshot capture** (same commit): adds `html-to-image` dep
  (~50 KB gz). Client uses `toJpeg` q=0.8 with dynamically-computed
  `pixelRatio` so longest output dim caps at 1400 px (a 1500×8000
  lesson page becomes ~262×1400 ≈ 200–400 KB JPEG, well under
  Vercel's 4.5 MB body limit). New private `bug-report-screenshots`
  Storage bucket with service-role-only RLS (matches migration 102
  pattern). API uploads decoded base64, stores object path. Admin GET
  batch-mints signed URLs (30 min TTL) so admin UI can render
  screenshots inline. Initial bug: tall preview pushed the textarea
  off the panel — fixed (`c8d2579`) with `max-h-32 object-cover-top`
  + click-to-open-fullsize. Second bug: rAF yield needed before the
  blocking `toJpeg` work or the capture-shimmer never paints
  (`5d5e224`).
- **Email notification on every new report**: fire-and-forget
  `api.resend.com` POST from "StudioLoom <hello@loominary.org>"
  (loominary.org is verified in Resend, reuses existing
  RESEND_API_KEY). Subject `[Bug · category] description-50`,
  body has page URL + admin link + Sentry link. Skips silently
  when `BUG_REPORT_NOTIFY_EMAIL` or `RESEND_API_KEY` are unset.
  Failures logged, never break submission.
- **Client-side dedupe** in admin UI: reports fingerprinted by
  (category | route_kind | first event kind+message). Description
  intentionally NOT in the fingerprint — different students will phrase
  the same bug differently. Row card shows "×N similar" rose badge
  when more than one report shares the fingerprint. No schema work
  (computed over the full 200-row page).
- **Motion polish** (`30a4a4c`, `5d5e224`) via existing framer-motion
  dep, students-only:
  - Idle wiggle: 1.6 s 6-frame jiggle every ~5 s, just enough
    personality without being distracting. Teachers get the static icon.
  - Click splat: multi-blob radial (yellow/pink/green/blue/purple)
    scales 0.4 → 2.4× and fades over 0.55 s, re-keyed via state
    counter so it re-fires on every click.
  - Capture shimmer: 128 px gradient panel with a horizontal shimmer
    sweep, pulsing camera icon, "Capturing screenshot…" headline +
    "Long pages can take a few seconds" subtitle. Two `requestAnimationFrame`
    yields after `setCapturingScreenshot(true)` ensure the shimmer paints
    before `toJpeg`'s synchronous DOM/canvas work blocks the main thread.

**Migrations applied to prod (in order):**
1. `20260428230559_add_bug_report_client_context.sql` — `client_context JSONB NOT NULL DEFAULT '{}'`.
2. `20260429010718_add_bug_report_sentry_and_screenshots.sql` — `sentry_event_id TEXT NULL` + private `bug-report-screenshots` Storage bucket + service-role-only RLS policy.

**Systems affected:** `bug-reporting`, `auth-system` (role-hint resolution
pattern), `governance-registries` (feature-flags + schema-registry
updates).

**Tests:** No new automated tests this session. Verified end-to-end via
Matt's prod smoke — student-tagged role correctly captured, admin UI
renders rich context, screenshot panel sized correctly, capture shimmer
visible during the 2–3 s capture window after the rAF fix.

**Lessons surfaced:**
- For long pages, JPEG q=0.8 with dynamically-scaled `pixelRatio`
  beats PNG by ~10× on file size, comfortably fitting Vercel's
  4.5 MB body limit even on 8000-pixel-tall lesson pages.
- React state updates inside an event handler don't paint before
  subsequent synchronous work in the same async function — explicit
  `requestAnimationFrame` yields are required if the work that
  follows blocks the main thread (e.g. `toJpeg`'s DOM/canvas
  rendering).
- Auth disambiguation should be a hint passed from the client, not
  inferred server-side. Two valid auth sources can coexist in the
  same browser; trust what the user's UI claims they are, then
  verify against that source first.

**Follow-ups (not done — opportunity backlog):**
- "Reply to reporter" — schema has `response` field but no notification
  path. Would close the loop with students. Resend already wired.
- "Send a response" auto-email when admin marks status `fixed`.
- Reporter session correlation (per-browser ID so multiple reports
  from same student/session group together).
- CSV export for batch triage.
- Server-side fingerprint column (currently computed client-side; fine
  at <200 rows).

---

## 29 Apr 2026 — TopNav search palettes wired (teacher + student) + lesson body-content scan ✅

**Context:** The search icon in the dashboard-v2 TopNav had been an inert
visual placeholder since Phase 1 scaffold (24 Apr). Wired it end-to-end —
first for teachers, then mirrored for students once Matt confirmed it
worked, then iterated on student-side scope (added lessons, then widened
lesson search to scan body content after Matt reported missing words he
knew were in his lessons).

**What changed:**

- **Teacher palette** (commit `d9045bf`): new `/api/teacher/search` route
  (3-bucket parallel ilike across `classes` / `class_units → units` /
  `class_students → students`, scoped via `classes.teacher_id`, 6 hits per
  bucket, 2-char min, escaped pattern). New `CommandPalette` component
  with debounced fetch (180 ms), `AbortController` cancellation, grouped
  results, keyboard nav (↑/↓/Enter/Esc), backdrop click. TopNav button +
  global ⌘K/Ctrl+K shortcut with in-input guard.
- **Student palette** (commit `3b6e748`): refactored to share —
  `src/types/search.ts` carries `SearchHit`/`SearchResponse` types, and
  `CommandPalette` moved to `src/components/search/` with a `searchUrl`
  prop (defaults to teacher endpoint). New `/api/student/search` —
  `requireStudentAuth` + service-role client (mirrors `/api/student/units`).
  Resolves student class IDs via `class_students` junction + legacy
  `students.class_id` fallback. v1 returned units only.
- **Lessons bucket** (commit `f84a13a`): added `LessonHit` type +
  `lessons[]` on `SearchResponse`. Student route now loads master units
  in one query, walks each assignment using `resolveClassUnitContent` +
  `getPageList` so lesson hits reflect the forked content the student
  actually sees. Teacher search returns `lessons: []` (not implemented).
  CommandPalette renders the new bucket with an emerald `Lesson` badge.
- **Body-content fix** (commit `9c472c3`): Matt reported lessons not
  finding words he knew existed. Root cause — for v4 (timeline) units
  `v4ToPageList` derives lesson title from just the first core activity's
  title. New `pageSearchText()` helper concatenates every student-visible
  string field (page.title, content.title, learningGoal,
  introduction.text, sections[].prompt + exampleResponse + ELL
  scaffolding, success_criteria, reflection.items, vocabWarmup
  terms/definitions/examples). Excludes `teacher_notes` (private) and AI
  rules (internal). Title hits and body hits collected separately so
  title matches sort first. Bucket cap stays 8.

**Validation:**
- ✅ tsc strict (`tsconfig.check.json`) clean throughout
- ✅ Both endpoints compile + return 401 unauthenticated in dev
- ✅ Teacher + student both working in prod after Vercel deploy (Matt
  confirmed: "ok works")
- ❌ Couldn't visually exercise the modal as a logged-in user in dev
  preview (no creds) — verification was endpoint-level + tsc

**Migrations this session:** None.

**Decisions added (logged inline, not in decisions-log):**
- Class-bucket excluded from student search (students don't have
  per-class pages — everything funnels to `/dashboard`).
- All page types searched (lesson, skill, reflection, context, custom,
  strand) — they're all navigable in the student flow.
- Title-vs-body hit ranking via two arrays + concat at the end (no score
  function) — simpler than a single ranked list.
- Lesson search excludes `teacher_notes` (privacy) and AI rules
  (irrelevant) but includes ELL scaffolding text (vocab a student might
  remember).
- Component placed at `src/components/search/CommandPalette.tsx` (shared
  location); types at `src/types/search.ts`.

**FUs added (informal — not filed in followups doc):**
- **Search perf — content_data refetch per keystroke** P3. Each lesson
  search keystroke (post-debounce) re-fetches `content_data` for every
  assigned unit. Tolerable for typical 3–10 active units; if a power
  user complains of lag, add a client-side cache of unit content per
  palette-open lifecycle.
- **Teacher lesson search** P3. Type system already supports `lessons[]`
  for teachers; `/api/teacher/search` just returns empty. Wire if useful.
- **Search ranking beyond title vs body** P3. Currently title-hit-first
  is the only signal. If body-hit results get noisy (e.g. common words
  matching across many pages), add scoring (term frequency, position).

**FUs resolved this session:** None.

**Systems affected:** New endpoints surface in `api-registry.yaml`
(2 routes added: `/api/teacher/search`, `/api/student/search`). No new
DB writes, no new AI calls, no new vendors, no migrations.

**Drift surfaced (pre-existing, not from this session):**
- `feature-flags.yaml` — orphaned `SENTRY_AUTH_TOKEN` (FU-CC,
  build-time-only), missing `RUN_E2E` (used in `student/word-lookup`
  test gate, not added to registry).
- `rls-coverage` — 7 tables RLS-enabled-no-policies (FU-FF,
  pre-existing pattern likely intentional for several).

**Tests:** Unchanged (search routes have no tests yet — small enough
that endpoint-level smoke + tsc was the bar).

**Cost spent this session:** $0 (no AI calls made or added).

**Pending after this saveme:** None blocking. Next normal work resumes
on whatever queue Matt picks (Access Model v2 Phase 0, dashboard-v2
polish, or new request).

---

## 28 Apr 2026 — Preflight Phase 8-1 schema flip + Round 1 audit + Phase 8-2 SHIPPED + E2E smoke PASS ✅

**Context:** Full day driven by Matt's smoke test of yesterday's
school-scoped lab ownership migration. Started with three prod hotfixes
(student upload Path B `teacher_id` chain, PostgREST schema-cache lost
FK, STL/laser file-type hard-gate), pivoted into a comprehensive
12-finding audit (`docs/projects/preflight-audit-28-apr.md`) after Matt
flagged "im a bit worried after those probs we just had where you had
missed things", landed Round 1 (HIGH-1/2/3/4 + MED-6) before lunch,
discovered Lab Setup page broken (audit MED-4) → built Phase 8-2
properly under the school-scoped contract instead of patching, hit
2 follow-up bugs during smoke (CI strict-typecheck UI debt + PostgREST
duplicate embed), fixed both, ended with full Preflight E2E smoke PASS.

**What changed:**

- **8.1d-37** Student upload Path B validates lab via `school_id` join,
  not removed `teacher_id` (`orchestration.ts:376-391`).
- **8.1d-37 follow-up** Codified `fabrication_jobs.lab_id` FK restoration
  as migration `20260428041707_restore_fabrication_jobs_lab_fk.sql`
  (the previous `DROP TABLE fabrication_labs CASCADE` killed the FK
  constraint; PostgREST schema cache emitted "Could not find a
  relationship" until restored + `NOTIFY pgrst, 'reload schema'`).
- **8.1d-38** Reject incompatible fileType / machine_category at upload
  (stl→3d_printer, svg→laser_cutter; STL on laser cutter previously
  passed).
- **Audit Round 1:**
  - **HIGH-1** server-side school filter on student picker via
    two-query split (templates + school-scoped).
  - **HIGH-2/3/4** `fabricatorSchoolContext` helper + 6 fab-orchestration
    callsite swap (school-scoped instead of single-teacher).
  - **MED-6** Migration 120 fresh-install ordering — IF EXISTS guards.
- **Phase 8-2 lab orchestration + API school-scoped rebuild (3 commits):**
  - `lab-orchestration.ts` full rewrite. New shape:
    `LabRow { id, schoolId, createdByTeacherId, name, description,
    createdAt, updatedAt }`. `is_default` dropped (per-class default
    lives on `classes.default_lab_id`, per-teacher on
    `teachers.default_lab_id`). New helpers `loadTeacherSchoolId`,
    `loadSchoolOwnedLab`. Cross-school → 404 (no existence leak).
  - 4 routes swept: `POST /api/teacher/labs`, `GET .../labs`,
    `PATCH .../labs/[id]`, `DELETE .../labs/[id]`,
    `PATCH .../labs/[id]/machines`. Renamed
    `sourceLabId`/`targetLabId` → `fromLabId`/`toLabId`. DELETE
    response: `{ deletedId, reassigned: { machines, classes, teachers } }`.
  - 26-test orchestration rewrite + route test updates. Mock
    query-builder extended for `.eq()` vs `.in()` distinguishing,
    `teachers.maybeSingle()`, thenable list queries.
- **Phase 8-2 hotfix** UI tsc errors after orchestration rewrite —
  ripped 6 `isDefault` references across `LabSetupClient.tsx` +
  `MachineEditModal.tsx` + `lab-setup-helpers.ts` + 1 test fixture.
  CI strict-typecheck (`tsc --noEmit --project tsconfig.check.json`)
  caught what `npx tsc --noEmit` filtered output didn't surface.
- **Picker-data hotfix (post-Phase-8-2)** Eliminated duplicate
  `fabrication_labs` embed in school-scoped query. The previous
  `${baseSelect}, fabrication_labs!inner(...)` produced two embeds
  via the same `lab_id` FK; PostgREST collided on
  `machine_profiles_fabrication_labs_1`. Each query now has exactly
  one embed.

**Verification:**

- ✅ Tests: 2208 pass / 9 skipped (no regression from baseline).
- ✅ TS strict: `tsc --noEmit --project tsconfig.check.json` clean.
- ✅ CI green on `8e04aef` + `dafa25d` (the two Phase 8-2 + hotfix
  merge commits on main).
- ✅ **Full Preflight E2E smoke PASS** in prod (Matt): student upload
  → scanner → teacher queue → fab pickup → complete.

**Migrations:** No new migrations this session beyond yesterday's
`20260428041707_restore_fabrication_jobs_lab_fk.sql` already shipped.
RLS coverage 89→94 tables / 82→87 with policies (tracks Phase 8-1
schema flip).

**Audit doc state:** 9 ✅ FIXED + 3 OPEN (MED-2 machine-orchestration
~8 stale `teacher_id` sites + MED-3 default-lab route dormant but
broken + MED-5 design call: recommend Option 2 audit-only) + 2 PARTIAL
(MED-4 UI rebuild deferred → Phase 8-4 + LOW-2 comment drift in
machine/fab-orchestration).

**Pending after this saveme:** Push origin/main DONE. Vercel deploy
DONE. **Phase 8-3 next session** — machine-orchestration rebuild,
pre-audited with full call-site list. Then Phase 8-4 (full
LabSetupClient visual rebuild).

**Lessons surfaced:**
- (additive to existing) When running `tsc --noEmit` ahead of pushing,
  use the project's strict CI config (`tsconfig.check.json`) — full
  `tsc --noEmit` includes test files with their own pre-existing Mock
  type errors that drown out new errors in production code.
- PostgREST embed disambiguation: appending an embed onto a baseSelect
  that already includes the same target table via the same FK results
  in alias collision. Rule: each query gets exactly one embed per
  (target, FK) pair.
- Audit-before-touch saved this session. The morning-time audit doc
  (12 findings) directly informed which work was Round 1 / Phase 8-2 /
  Phase 8-3 / Phase 8-4. Without it I would have rebuilt
  lab-orchestration without realising machine-orchestration had the
  same kind of debt.

**Systems affected:** `fabrication-lab-orchestration` (rewrite),
`fabrication-fab-orchestration` (school-scoped sweep),
`fabrication-student-picker` (server-side school filter + embed
hotfix), `fabrication-jobs` (FK restored, fileType/category gate).

**Worktree state at session end:** `/Users/matt/CWORK/questerra-preflight`
on `preflight-active` (in sync with origin). Top-of-main: `dafa25d`.

---

## 28 Apr 2026 PM — Smart tap-a-word defaults + speaker removal + Bug 3 prod verification

**Context:** Late-day polish on the language-scaffolding-redesign work after the morning's Option A unified Support tab landed. Three commits + a prod verification step that closes out today's work on student lesson support.

**Commits (4 today PM, all pushed to origin/main):**
- `ebeb1a1` feat(support): smart default for tap-a-word — ON for ELL≤2 OR L1≠English. Replaces the previous hard-coded `true` default that applied tap-a-word to every student including advanced native English speakers. New `defaultTapAWordEnabled(ell, l1)` helper. Resolver now reads `students.ell_level` + `class_students.ell_level_override`. Resolution table: ELL 1-2 → ON; ELL 3 + L1=en → OFF (clean reading); ELL 3 + L1≠en → ON (translation safety for advanced bilinguals). Defensive: invalid ELL coerces to 1 to err on side of scaffolding. 8 new tests across all ELL × L1 combinations + override-beats-default both directions + per-class ELL flip + null defaults. Support tab UI: explainer panel adds policy footnote; "inherit" option shows actual resolved value not hardcoded "(default: on)" lie.
- `9a126f7` feat(tap-a-word): remove word-level speaker buttons from popover. Per Matt: block-level read-aloud already handles English; single-word L1 audio audience too narrow to justify visual noise. Net -75 lines (popover JSX + inline SpeakerIcon SVG + useTextToSpeech subscription). Hook + tests preserved (exported from barrel) for future re-introduction if learning support specialists want heritage-learner workflows. Cleaner popover: word / definition / translation / example / image only.
- `e30d372` chore(scripts/dev): bank list-class-units.mjs as a reusable DB inspector. Generalised header, moved to scripts/dev/ alongside other one-off diagnostic tools. Sibling check-test-student.mjs deleted (hardcoded UUID, won't be useful again).

**Bug 3 verified in prod (no commit, manual workflow):** Set + reset overrides on 10 Design + Service LEEDers via the new Support tab. SQL inspection confirmed:
  - `class_students.support_settings = '{}'::jsonb` after reset (no orphan nulls)
  - **Service LEEDers self-heal worked** — pre-existing stale `{l1_target_override: null}` row from yesterday's testing flipped to `{}` when the new mergeSupportSettingsForWrite ran on touch. This is the strongest possible proof of Bug 3: the new code doesn't just avoid creating null orphans, it cleans up legacy ones.
  - One remaining test override on 6 Design (archived class) — left in place; harmless because Bug 4 filters archived classes from resolution. Will be cleared automatically when class-architecture-cleanup §1 (auto-unenroll trigger) ships.

**Decisions added (3):** Smart default policy for tap-a-word (ELL≤2 OR L1≠en); word-level speaker buttons removed (block read-aloud already covers English, single-word L1 audience too narrow); per-feature granular split deferred (Matt to consult learning support before locking the matrix design).

**Followup explicitly NOT filed:** the per-feature granular split (definitions / translations / audio / images as separate flags + admin matrix). Matt's call: "seems too much for this site at this point. what we've just built is more than most sites already." Accepted — pulling back scope when something is already strong is good discipline.

**Tests after PM:** 2279 → 2287 (+8 from smart-default tests). 0 failures, 9 skipped, 146 files. tsc clean. No new migrations.

**API surface:** No route changes (smart default + speaker removal are pure logic/UI changes inside existing routes). Registry scan clean.

**Today total tally (AM + PM):** 11 commits (8 AM + 3 PM); +28 tests (2259 → 2287); 1 new project doc filed (deferred); 9 decisions added; 1 lesson learned (#60); Supabase Free → Pro Small. All Bugs 1/1.5/2/3/4 verified end-to-end in prod via SQL.

**Wrap state:** Matt explicitly said "I feel like this wraps up things for now for language support." Treat as a done milestone; next pickup is whatever surfaces from tomorrow's class OR Phase 3 Response Starters when ready.

---

## 28 Apr 2026 — Multi-class context fix + Option A unified Support tab + Class architecture cleanup filed

**Context:** Continuation of the language-scaffolding-redesign Phase 2.5 work. Matt's first prod smoke test of the teacher control panel surfaced 4 bugs around multi-class context resolution. Fixed tactically (5 commits), then surfaced a deeper UX concern ("teachers will find this confusing if settings are in different places") which triggered an Option A unification: per-student Support tab as the single source of truth, with per-class as collapsed accordion. ELL editing also consolidated. Filed remaining architectural work as deferred. Saveme + handoff for the next session (Access Model v2 starting in parallel).

**Commits (8 today, all pushed to origin/main):**
- `79df0aa` fix(auth): student-session — deterministic class selection via ORDER BY enrolled_at DESC (Bug 1)
- `6bdc403` fix(tap-a-word): server-derive classId from unitId via class_units JOIN (Bug 2 — new `resolveStudentClassId` helper, 10 tests, TappableText auto-detects unitId from URL)
- `a6fcfc2` fix(student-nav): topnav class label follows the URL on /unit/[unitId]/... (Bug 1.5 — new `/api/student/me/unit-context` endpoint, layout watches pathname)
- `aa0f113` fix(support-settings): teacher reset deletes JSONB key (not persists null) — Bug 3, new `mergeSupportSettingsForWrite` helper, 7 tests
- `45249d3` test(support-settings): update PATCH null-reset assertion for Bug 3 semantics
- `a1dc37e` fix(student-context): exclude archived classes from session-default + unit-derived class — Bug 4 (new `filterOutArchivedClasses` helper, 3 new tests, regression test for the exact prod scenario)
- `11c2df0` docs(lessons): #60 — side-findings inside touched code belong in the same commit
- `e52105a` feat(teacher): unified per-student Support tab — single source of truth (Option A) — new `/api/teacher/students/[studentId]/support-settings` GET+PATCH, `<StudentSupportSettings />` component (resolution explainer + per-student global form + collapsed per-class accordion), new "Support" tab on `/teacher/students/[studentId]`, `?tab=` URL param honoured, cross-link from per-class teacher page
- `1406e6c` feat(teacher): consolidate ELL editing into the unified Support tab — per-student API accepts `ell_level`, per-class API accepts `ell_level_override`, ELL row added to Support tab UI, inline ELL pills REMOVED from class page (they were silently writing global while reading per-class — broken by coincidence)
- `184dc55` docs(projects): file class-architecture-cleanup as 🟢 READY (deferred behind Access v2)
- (saveme commit pending)

**Test baseline:** 2259 → 2279 (+20 across the day). 0 failures, 9 skipped, 146 files. tsc clean.

**Migrations this session:** None. All changes are pure app code.

**Decisions added (6):** Multi-class context fix shipped tactically (not deferred behind Option B); archived classes filtered at resolve-time not enrollment-time; Option A chosen for support settings unification; inline ELL pills removed (silently inconsistent); class architecture cleanup filed as deferred.

**Lessons added (1):** #60 — side-findings inside touched code belong in the same commit, not "follow-up later." Bit me today: I audited the Bug 1 fix, noted the archived-class gap, deferred it, then Matt hit it 30 minutes later and required commit `a1dc37e` to the same files.

**Projects filed (1):** `docs/projects/class-architecture-cleanup.md` — 4 gaps (archived auto-unenroll P1, student_progress scope decision P2, cohort labels P2, Option B URL-scoped classId P2 ~10-11d). Deferred behind Access Model v2. Trigger phrase: "continue class architecture".

**API surface changes:** +3 routes (per-student support-settings GET/PATCH, unit-context GET); modified word-lookup + me/support-settings to accept unitId; modified per-class single-student PATCH to accept ell_level_override; modified student-session select shape (added is_archived to nested classes select).

**Followups:**
- 🐛 Stale `{l1_target_override: null}` row on Service LEEDers from pre-Bug-3 testing — will self-heal on next teacher edit via new `mergeSupportSettingsForWrite`. Cosmetic.
- 🧪 No dedicated tests for the per-student support-settings endpoint shape — existing tests still pass but new behavior (ELL handling, partial UPDATE, `verifyTeacherCanManageStudent` auth) isn't locked. ~30 min if pulled forward.
- ⚠️ `docs/handoff/main.md` was stale (27 Apr) all session — Access v2 parallel session was given a manual briefing in chat instead. Refreshed as part of this saveme.

**Ops:** Supabase project auto-paused early in the day (Cloudflare 522). Matt upgraded free → Pro Small compute mid-session — restored access + permanent paused-state immunity going forward. Resolved before any user impact.

**Side-finding worth banking but not actioned:** Matt has 3 different teacher accounts in prod with the same display name "Matt" (`mattburto@gmail.com`, `hello@loominary.org`, `mattburton@nanjing-school.com`). Access Model v2 unification will need to handle this — already noted in the parallel-session briefing.

---

## 27 Apr 2026 — Preflight Phase 8.1d-31..35 SHIPPED + smoke 16/16 ✅

**Context:** Continuation of Phase 8.1 fab-dashboard polish. Five
hotfixes across one session, all driven by smoke-test feedback against
prod (studioloom.org). Plus a scanner OOM bump and 5-tier OOM longevity
plan filed to backstop the pre-pilot risk.

**Sub-phases shipped (in order):**

- **8.1d-31** — Fab can permanently delete jobs + styled
  `ConfirmActionModal` (replaces `window.confirm`) + Incoming-row
  filters (search + class chips + conditional file-type chips). New
  `deleteJob()` orchestration helper, `DELETE /api/fab/jobs/[jobId]`
  route, trash button on every card type (Incoming corner / Queued
  5-button row / Now Running header). Two modal intents: `warn`
  (amber, unassign — reversible) and `danger` (red, delete —
  permanent).
- **8.1d-32** — Students can permanently delete their own jobs.
  Mirror of 8.1d-31 but scoped via `student_id` and gated by
  `STUDENT_DELETABLE_STATUSES` (excludes `approved` + `picked_up`).
  New `deleteStudentJob()` + `DELETE /api/student/fabrication/jobs/[jobId]`.
  UI surfaces both on the detail page (next to Withdraw) and as a
  row-level trash icon on `/fabrication` overview. Row layout
  refactored from Link-wraps-everything to overlay-Link + sibling
  content because `<button>` inside `<a>` is invalid HTML.
- **8.1d-33** — Surrogate machine for "Any cutter" jobs picks largest
  bed area (was alphabetical-first). Caught by Matt's smoke: an SVG
  was BLOCKed against an "xTool F1 Ultra" 220×220mm when the same
  lab had an "xTool P3" 600×308mm with plenty of room. PostgREST's
  `.order()` doesn't accept multiplication, so fetch-then-rank in
  Python (lab fleets are small).
- **8.1d-34** — Bed-fit rules (R-SVG-01 + R-STL-06) now check both
  XY orientations. A drawing fits if EITHER as-is OR rotated 90°
  clears the bed — slicers rotate trivially, lab techs rotate parts
  routinely for material economy. STL rotates around Z only (gravity
  stays gravity). Ruleset versions bumped: stl-v1.0.1 → stl-v1.1.0,
  svg-v1.0.0 → svg-v1.1.0 (the SVG bump retroactively closes the
  FU-RULESET-VERSION-AUDIT note from 8.1d-12 content-bbox change).
- **8.1d-35** — Two console-noise sources caught by smoke S3:
  (a) RuleCard's "Learn more in Skills Library" Link gets
  `prefetch={false}` — Next.js's RSC prefetcher was hitting every
  `/skills/fab-R-XXX` stub URL on render and 404-flooding the console
  on a page with 6+ rule cards;
  (b) `useFabricationStatus` polling now stops on 404 (sets
  `cancelled = true` + dispatches a friendlier *"This submission no
  longer exists"* message) so back-button'ing into a deleted job
  doesn't flood every 2s indefinitely. Other 4xx/5xx responses stay
  retry-eligible (transient).

**Ops change — scanner OOM (mid-session):**

- `mount-bracket-130mm.stl` (1.1MB binary, ~23k tris) OOM'd on the
  scanner at 512MB during Matt's smoke. Bumped Fly machine to 1024MB
  via `fly scale memory 1024`, persisted in `fab-scanner/fly.toml`
  (was still saying 256mb — latent footgun for next deploy). 1GB only
  buys ~5× the previous ceiling — proper fix is the 5-tier longevity
  plan filed below.

**New follow-ups filed:**

- `PH9-FU-SCANNER-OOM-T1..T5` (P1–P3) — 5-tier roadmap to retire
  ad-hoc RAM bumps. T1 reject oversized at upload, T2 trimesh
  `process=False` + GC, T3 subprocess isolation per scan (all
  pre-pilot ~2–3 days). T4 numpy-stl for cheap rules, T5 Fly
  Machines size-aware (post-pilot ~4 days). Also escalates the
  original FU-SCANNER-OOM from "resolved at discovery" to
  "partially-resolved → escalated."
- `PH9-FU-FAB-SURROGATE-MULTIPLE-EVAL` (P2) — proper architectural
  fix for category-only scanning: every rule evaluated against
  every machine in the lab+category, BLOCK only when policy says so
  against the full set. Subsumes the originally-filed
  PH9-FU-FAB-SURROGATE-CONSERVATIVE since the same redesign solves
  both false-pass and false-fail directions. ~2 days post-pilot.

**Smoke S0–S15 all PASSED 16/16:**

| | Test | |
|---|---|---|
| S0 | Student deletes stuck file | ✅ |
| S1 | Mount-bracket scans clean on 1GB | ✅ |
| S2 | Detail-page delete mid-flight | ✅ |
| S3 | Detail-page delete terminal state | ✅ |
| S4 | Status gate blocks active-fab delete | ✅ |
| S5 | Fab delete on Incoming card | ✅ |
| S6 | Fab delete on Queued card | ✅ |
| S7 | Fab delete on Now Running | ✅ |
| S8 | Unassign amber modal ≠ Delete red | ✅ |
| S9 | Mark Failed canned chips | ✅ |
| S10 | Incoming search filter | ✅ |
| S11 | File-type chips conditional render | ✅ |
| S12 | Class chips | ✅ |
| S13 | Filters don't affect machine columns | ✅ |
| S14 | Hydration + tab counts + pulse | ✅ |
| S15 | Ghost-job count sanity | ✅ |

**Systems affected:**

- `preflight-pipeline` — 6 new API routes (4 backfilled into
  api-registry from earlier 8.1d-22/24/27 phases that hadn't been
  scanned), 2 orchestration helpers (`deleteJob` fab-side +
  `deleteStudentJob` student-side)
- `preflight-scanner` — surrogate machine semantics changed,
  rotation-aware bed-fit, ruleset versions bumped to 1.1.0,
  Fly memory 512→1024MB

**Commits / merges (origin/main):**

- `cdfdf8b` 8.1d-31 fab delete + filters + modals
- `494e4fd` 8.1d-32 student delete
- `6d8342f` 8.1d-33 + scanner OOM bump + 5-tier plan
- `072d261` 8.1d-34 rotation-aware bed-fit
- `c7c5e0d` 8.1d-35 console noise cleanup

**Fly deploys:** 3 (8.1d-33 surrogate carried the OOM bump,
8.1d-34 rotation, plus implicit redeploys verifying both).

**Tests:** existing 1939 fab tests still green on touched JS surface;
`tsc --noEmit` clean. 24 pytest tests in fab-scanner unaffected by
surrogate ordering or rotation logic (sandbox didn't run; no test
surface changes).

**Registries synced:** api-registry +6 routes (349 → 355).
ai-call-sites no diff (no AI changes). Feature-flags + RLS drift
status unchanged from prior session — both pre-existing
(FU-CC + FU-FF respectively).

**Next:** Phase 8 brief (`preflight-phase-8-brief.md`) still DRAFT
pending Matt sign-off on 6 open questions. Phase 8.1d is a clean
close-out point — full smoke list passed, no open regressions, all
follow-ups filed and prioritized.

---

## 24 Apr 2026 — Skills Library world-class schema upgrade (migration 110) + authoring UI rebuild

**Context:** Matt's goal after reading the research brief + catalogue v1: make the skills library world-class per Digital Promise / Scouts / DofE / IB ATL / CASEL / XQ / Project Zero principles. Decisions locked via Q1–Q10:

- Q1 ✓ Unified schema (safety modules migrate later as separate sprint)
- Q2 ✓ Teacher-ack button for demonstrated (studentwork pipeline deferred)
- Q3 ✓ DofE vocabulary — Bronze / Silver / Gold
- Q4 ✓ Matt authors all content himself
- Q5 ✓ `domain_id` + `category_id` as separate columns (subject × cognitive action)
- Q6 ✓ `card_type` (`lesson` | `routine`) ships now
- Q7 ✓ "Stone prereq" → "Activity block prereq" (Stones is dead vocabulary post-pivot-shelve)
- Q8 ✓ Resources deferred to v2
- Q9 ✓ DM-B1 Workshop Safety Essentials replaced with "Reading a Safety Data Sheet" (catalogue edit pending)
- Q10 ✓ Personal pilot — Matt's own students first

**Migration 110** `skills_library_world_class_schema.sql`:
- New `skill_domains` table — 10 subject-area domains seeded (DM, VC, CP, CT, LI, PM, FE, RI, DL, SM). Orthogonal to `skill_categories` (8 cognitive-action verbs). Short codes match catalogue card ID prefix.
- `skill_cards.difficulty` renamed → `tier` with value map (foundational→bronze, intermediate→silver, advanced→gold). DofE vocabulary verbatim per research-brief principle #3.
- 8 new columns: `domain_id` FK, `age_min`/`age_max`, `framework_anchors` JSONB, `demo_of_competency` text, `learning_outcomes` JSONB, `applied_in` JSONB, `card_type` (lesson/routine), `author_name`.
- New indexes: tier, domain, card_type, age_band.
- 3 existing seed cards backfilled minimally (tier + domain_id = design-making); other new fields default to empty/null — Matt will replace when authoring catalogue.

**Types (`src/types/skills.ts`) fully reshaped:** `SkillTier` replaces `SkillDifficulty`, `SKILL_TIERS` / `SKILL_TIER_LABELS` exported, `FrameworkAnchor` + `CardType` + `CONTROLLED_VERBS` introduced, `SkillDomainRow` added, `SkillCardRow` + payloads extended.

**API routes updated end-to-end:**
- `GET /api/teacher/skills/cards` — filters extended with `domain`, `tier`, `card_type`
- `POST /api/teacher/skills/cards` — validates tier enum, domain FK, age-band sanity (5–25 + min ≤ max), framework anchors shape, card_type enum, outcomes/applied_in as string arrays
- `PATCH /api/teacher/skills/cards/[id]` — all 8 new fields individually patchable
- `POST /api/teacher/skills/cards/[id]/publish` — minimum-publishable gate extended: title + category + **domain** + **tier** + **demo_of_competency** + ≥1 block. Digital Promise "rubric before attempt" enforced.
- `GET /api/teacher/skills/domains` — new lookup endpoint
- `GET /api/student/skills/cards/[slug]` — prereq query uses `tier`

**`SkillCardForm` — full rebuild in 8 numbered sections** (pedagogical order):
1. Identity (title / slug / summary / **author byline**)
2. Taxonomy & Tier (domain, category, tier, **card type toggle**)
3. **Pedagogical contract** — demo-of-competency with controlled-verb soft hint + banned-verb warning, learning outcomes list, framework anchors multi-select with framework-specific datalist suggestions, applied-in contexts list
4. Sizing (estimated min + age min/max)
5. Body (existing block editor + preview toggle)
6. Tags
7. External links
8. Prerequisites (fuzzy search preserved)

Controlled-verb enforcement: typing a demo line triggers a soft amber warning if it doesn't start with one of show/demonstrate/produce/explain/argue/identify/compare/sketch/make/plan/deliver. Datalist suggestions per framework — ATL gets 5 categories, CASEL gets 5 competencies, WEF gets 10 Future of Jobs skills, StudioHabits gets 8 Project Zero habits.

**Viewer updates** — both teacher + student viewers render a new **Pedagogical Contract panel** (indigo) at the top, above the body, showing demo-of-competency + learning outcomes + framework anchors. Digital Promise principle: rubric shown before attempt.

**Teacher list page (`/teacher/skills`):** filters extended (domain + tier + category + card_type + ownership); cards display short_code + tier pill + category pill + age band + author byline.

**Verification:**
- `npx tsc --noEmit` → 0 errors on skills files
- `npx eslint` → 0 errors
- `npm test` → 1854 pass / 8 skip / 0 fail

**Gating:** Migration 110 NOT yet applied to prod. Coordinated code+schema change — Matt applies 110 BEFORE push to main or app breaks (references `tier`, not `difficulty`). Push held in `skills-library` branch.

**Next:**
1. Matt authors 20 Gold cards using the new form
2. Replace DM-B1 → "Reading a Safety Data Sheet" (catalogue edit)
3. Safety module content migration (~3-day separate sprint)
4. Teacher-ack button for `skill.demonstrated` (~half day)
5. First pull-moment — activity block prereq embed (~2 days)
6. Personal pilot with Matt's students

**Systems affected:** `skills-library` (in_progress, schema v0→v1 layered), `schema-registry` (skill_cards entry rewritten + new skill_domains entry), `api-registry` (+1 domains endpoint).

---

## 24 Apr 2026 PM — Preflight Phase 7 Checkpoint 7.1 PASSED 12/12 🎉

**Context:** Closing saveme for Phase 7. Matt ran Phase 7 smoke against
prod on studioloom.org as teacher + `test` student + newly-invited
Fabricator account. S1 + S2 both PASS; S3 skipped as optional/unit-
test-covered. One data-correctness bug caught mid-smoke and hotfixed
before sign-off.

**Smoke outcomes (all PASS):**
- **S1 Happy-path print:** student upload `small-cube-25mm.stl` →
  auto-approved 3D printer → fabricator `/fab/queue` → `/fab/jobs/[jobId]`
  → **Download & pick up** with rewritten filename via
  `buildFabricationDownloadFilename()` → status flipped to `picked_up`
  → action bar switched to Re-download + Mark complete + Mark failed →
  **Mark complete** (printed) with free-text note → student
  `/fabrication/jobs/[jobId]` showed green `LabTechCompletionCard`
  with fabricator note, header flipped to "Printed", scan viewer
  hidden correctly.
- **S2 Failed run:** fabricator **Mark failed** on a second job with
  note "Warped off the bed partway through. Needs a brim / better bed
  adhesion." → student saw red "Your run didn't complete" card + note
  + "Start a fresh submission →" link. **Bug caught:** list view
  (student `/fabrication` + teacher per-student/per-class history)
  showed green "COMPLETED" pill for the same failed job — click-through
  was correct, list was lying. **Fixed Phase 7-5d** — see below.
- **S3 2-fab race:** skipped (optional per brief; race-safety is
  unit-test covered in `pickupJob` conditional UPDATE + post-write
  confirm read).

**Mid-smoke hotfix — Phase 7-5d (commit `433188b`):**
- **Data-correctness bug:** list views rendered the pill from `status`
  alone, ignoring the `completion_status` sub-state introduced in
  Phase 7-5. Fix: shared `fabricationStatusPill(status,
  completionStatus)` helper in `fabrication-history-helpers.ts` is
  now the single source of truth for pill label + colour across
  Preflight. Three list views + three orchestration row-builders
  updated. `completed+failed` → red "RUN FAILED"; `completed+printed`
  → green "PRINTED"; `completed+cut` → green "CUT". Legacy `completed`
  with null `completion_status` (pre-7-5 data) → green "COMPLETED"
  (backwards-compat).
- **Invite email legibility:** teacher `display_name` unset → fallback
  to raw email → Gmail auto-linkified → overrode our inline purple
  header styling with Gmail's default mailto blue (blue-on-purple
  unreadable). Fix: fall back to email local-part ("mattburto") instead
  of full address. Eliminates the auto-link vector entirely.
- Tests: 1939 → **1950** (+11 regression guards across all 3 completion
  branches + legacy fallback + non-terminal-status defensiveness +
  unknown-status graceful degradation + approved/rejected/picked_up
  mappings).
- Merged to main as `d5eb596`. Small rebase conflict in changelog.md
  resolved (parallel Skills Library session commit history).

**Setup gotcha — documented for Phase 8 onwards:**
- `RESEND_API_KEY` was not set on Vercel. StudioLoom teacher-invite
  flow works via `supabase.auth.admin.inviteUserByEmail()` (Supabase's
  own SMTP config holds a separate copy of the Resend key); Preflight
  fab-invite flow does a direct fetch to `api.resend.com` via
  `src/lib/preflight/email.ts` and needs the env var on Vercel
  directly. Resolution: created dedicated `re_...` Resend API key
  (named `preflight-vercel`), added to Vercel Production + Preview
  env vars, redeployed. Known setup step for any future Preflight
  deploy to a new project. Captured in checkpoint report for
  operational-runbook value.

**4 new follow-ups filed (all P2/P3, Phase 9 scope):**
- `PH7-FU-COMPLETION-NOTIFICATIONS` P2 — wire student email on
  pickup/complete/fail. `email.ts` kinds already exist; needs
  orchestration call sites in `pickupJob` / `markComplete` /
  `markFailed`. ~1-2h. Matt flagged during S2: "also later need to be
  able to add a notification for these events".
- `PH7-FU-INLINE-QUEUE-ACTIONS` P2 — Download/Complete/Fail inline on
  queue cards, skip detail page round-trip for triage. Matt's
  observation during S1: "so much empty space on these job cards. you
  could add buttons like 'fail' could also be added. means you don't
  need to click in so many places".
- `PH7-FU-FAB-SCAN-SUMMARY` P2 — rewrite jargon-y "2I (B = blocker,
  W = warning, I = info)" to "Scan passed · 2 info notes, no blockers"
  style. Matt's observation: "not sure what scan summary means. prob
  need to make that more intuitive".
- `PH7-FU-PRE-PICKUP-FAIL` P3 — Reject-without-pickup variant of Fail
  for "this file is wrong, can't run" case.

**Phase 7 totals:**
- 8 commits on `preflight-active` (7-1 through 7-5d), all merged to
  main across two merge commits (`7fefd6e` pre-smoke, `d5eb596`
  hotfix). Plus the saveme + checkpoint-PASS commit landing now.
- Tests: 1854 → **1950** (+96 across Phase 7 including hotfix).
- api-registry: 332 → **337** routes (+5 fab routes).
- No new migrations — Phase 7 was pure app layer on columns already
  existing from migration 095.
- `preflight-pipeline` system in WIRING extended with
  fab-orchestration + 5 fab routes + component files + future_needs
  pointer to Phase 8 brief.

**Next session:** Matt resolves the 6 open questions in the Phase 8
brief (`docs/projects/preflight-phase-8-brief.md` §5). Options: answer
each individually, or fast-track with "all recommended" like Phase 7.
Once resolved, Phase 8-1 (fabrication_labs migration + backfill) opens.

**Systems affected:**
- `preflight-pipeline` (status remains `in-progress` — Phase 7
  complete, Phase 8 pending).
- Documentation: `preflight-phase-7-checkpoint-7-1.md` flipped to
  ✅ PASSED status with full smoke outcomes + hotfix narrative + 4
  new follow-ups.

---

## 24 Apr 2026 AM — Preflight Phase 7 code complete + Phase 8 brief drafted

**Context:** Closing saveme after Phase 7 (Lab Tech Pickup + Completion)
landed on main pre-smoke and the Phase 8 brief was drafted + merged.
Phase 7 is the first Fabricator-facing UI in Preflight. Phase 8 brief
captures the unified visual lab+machine+fab admin that Matt flagged
mid-Phase-7 ("need an easy visual management page... drag and drop,
shows relationships and visual rep of machines, in locations that can
have custom names").

**Phase 7 SHIPPED (code complete, smoke PENDING):**
- 10+ commits on `preflight-active` merged to main as `7fefd6e`
  (pre-smoke merge — explicit Matt call: no active users, no new
  migrations, all additive app layer, safer to land before smoke so
  follow-up fixes go straight to main).
- **7-1** `src/lib/fabrication/fab-orchestration.ts` (~560 lines,
  5 exports: `listFabricatorQueue`, `getFabJobDetail`, `pickupJob`,
  `markComplete`, `markFailed`). Race safety via conditional UPDATE
  + post-write confirm read. §11 Q8 idempotent re-download
  (status=picked_up + self = no-op). Bug caught in build: `.range()`
  called before tab-filter `.eq()` — PostgREST chain returns the
  promise after `.range`. Restructured to filter first, `.order
  + .range` at end. 23 orchestration tests.
- **7-2** 5 API routes (queue/detail/download/complete/fail) all
  `requireFabricatorAuth` + `Cache-Control: private, no-cache`.
  Download = 3-step (detail → pickup → stream bytes with rewritten
  `Content-Disposition` via Phase 6-6k `buildFabricationDownloadFilename()`).
  33 route tests.
- **7-3** `/fab/queue` server shell + `FabQueueClient` (~250 lines).
  4 status tabs (queued/in_progress/completed/failed) + retry. Replaces
  Phase 1B-2 placeholder.
- **7-4** `/fab/jobs/[jobId]` detail page + `LabTechActionBar`
  (Download / Complete / Fail) + canned-note chips modal (4 complete
  presets / 6 fail presets from new `lab-tech-canned-notes.ts`).
- **7-5** Student-side visibility: extended `orchestration.ts:getJobStatus`
  with `completionStatus`/`completionNote`/`completedAt`;
  `LabTechCompletionCard` (green printed/cut + red failed variants)
  renders in `DoneStateView` when `shouldShowCompletionCard(jobStatus)`.
  Phase 7 Checkpoint 7.1 report drafted (12 criteria + 3 smoke scenarios).
- **7-5b** Inclusive-wording sweep after Matt pushback ("not all schools
  have lab techs. Bit of a luxury. In some cases this may be a computer
  setup near the 3d printers/laser cutters that anyone can access as
  its always logged in"). Swept 5 surfaces of user-facing copy "lab tech"
  → "fabricator"/passive voice. Code comments kept as "lab tech" for
  developer readability.
- **7-5c** Missed `/teacher/preflight` header button "Lab techs" →
  "Fabricators" (caught by Matt screenshot).

**Phase 8 brief DRAFTED (`docs/projects/preflight-phase-8-brief.md`):**
- 222 lines. Unified visual lab + machine + fab admin page.
- Ships: `fabrication_labs` table + `machine_profiles.lab_id` FK +
  `classes.default_lab_id` FK, `/teacher/preflight/lab-setup` page,
  machine CRUD from template or scratch, laser operation colour map
  editor, fabricator reassignment, student picker filter by
  `class.default_lab_id`.
- 5 sub-phases (8-1 migration → 8-2 lab CRUD → 8-3 machine CRUD →
  8-4 visual page → 8-5 student filter+smoke). ~2–3 days.
- **Recommends Option B (click-based)** over drag-drop: ~30–50%
  faster ship, accessible out of box, real-world teachers don't
  reorg daily. Drag-drop filed as `PH8-FU-DRAG-DROP` P3 for post-pilot.
- **6 open questions pending Matt sign-off** (entity naming / default-
  location strategy / cross-teacher visibility / who creates labs /
  student-side impact / drag-drop vs click). Recommendations documented.
- Absorbs originally-Phase-9 `PH6-FU-MULTI-LAB-SCOPING` + closes
  `FU-CLASS-MACHINE-LINK` P3. Phase 9 scope reduced to "Analytics + Polish".
- Merged to main as `bca5327` (rebased over 3 parallel Skills Library
  commits; resolved stale untracked skills-library files in main
  worktree that were blocking rebase).

**Testing:**
- `npm test`: 1854 → **1939 passing** (+85) + 8 skipped. No regression.
- `tsc --noEmit`: clean on all new files.
- `scan-api-routes.py`: 332 → **337 routes** (+5 fab routes).
- `scan-ai-calls.py`: no drift.
- `scan-feature-flags.py` / `scan-vendors.py` / `scan-rls-coverage.py`:
  timestamp-only updates to reports, no structural drift.

**Systems affected:**
- `preflight-pipeline` (extended key_files list with fab-orchestration
  + 5 fab routes).
- `api-registry.yaml` (+5 fab routes).
- Follow-ups updated: PH6-FU-MULTI-LAB-SCOPING promoted P2 → Phase 8;
  FU-CLASS-MACHINE-LINK P3 folded into Phase 8-5 scope.

**Next session:** Matt runs Phase 7 Checkpoint 7.1 smoke (3 scenarios:
S1 happy-path print, S2 failed run, optional S3 2-fab race). After
sign-off, Matt resolves the 6 open questions in Phase 8 brief; then
Phase 8-1 (migration + backfill) opens.

---

## 23 Apr 2026 PM — Preflight Phase 6 SHIPPED + Checkpoint 6.1 PASSED 🎉

**Context:** Closing saveme for Phase 6. Matt ran all 4 smoke
scenarios end-to-end on studioloom.org; all PASS. Phase 6 is the
first teacher-facing surface of the Preflight pipeline and also the
closure of the Phase 5 follow-up `PH5-FU-REUPLOAD-POLL-STUCK`
(verified fixed in S2 smoke).

**Checkpoint 6.1 smoke outcomes (all PASS):**
- **S1 Happy path (approve)** — queue → detail → Approve → student
  sees green `TeacherReviewNoteCard` with teacher's note. Scroll-to-
  top fired on action (6-6a). Read-only viewer on approved jobs.
- **S2 Return for revision (CRITICAL)** — queue → detail → Return
  with note → student sees amber card + only the Re-upload button
  (Submit hidden per 6-6c) → student re-uploads → **transition
  clean without hard-refresh**, confirming the layered 6-0 reducer
  auto-unfreeze + 6-5b reset-before-fetch ordering closes
  `PH5-FU-REUPLOAD-POLL-STUCK`.
- **S3 Reject** — terminal red card + "Start a fresh submission →"
  link, `ScanResultsViewer` correctly not rendered (spec §10 Q2).
- **S4 Per-student + per-class history** — 4-metric strips + per-
  student drill-down tables rendered accurately. Class + absolute
  date/time columns visible (6-6n/o). Deep-links + context-aware
  back nav (6-6m) all working.

**This session's additional polish commits (after the morning smoke
kicked off):**

- **6-6m** — context-aware back nav on teacher detail page.
  "← Back to queue" hardcoded destination broke when teachers
  arrived from student Fabrication tab or class Fabrication
  section. Now `router.back()` with queue fallback for bookmarks.
- **6-6n** — per-student Fabrication tab: class chip + absolute
  date/time (new `formatDateTime` helper). Class section expand
  affordance redesigned (Show/Hide text + real chevron SVG +
  purple border when open). 30s AbortController timeout +
  console.error with classId on failure + Retry button.
  Server-side: `HistoryJobRow.className` now populated via
  `classes(name)` join.
- **6-6o** — student's own `/fabrication` overview gained the same
  Class column + absolute date/time treatment. (Teacher side was
  fixed in 6-6n; the student overview was a separate render path
  I'd missed.)
- **PH6-FU-HISTORY-PAGINATION** P2 follow-up filed inline on
  `fetchHistoryJobs` — uncapped history endpoints work at NIS
  pilot scale (~200 jobs/class) but need cap + filters + lazy-
  load for school-deployment scale.

**6 follow-ups filed across Phase 6 (tracked in the checkpoint
report + inline in code):**
- `PH6-FU-PREVIEW-OVERLAY` P2
- `PH6-FU-PREVIEW-PINCH-ZOOM` P3
- `PH6-FU-RULE-MEDIA-EMBEDS` P2
- `PH6-FU-TEACHER-CANNED-NOTES-EDITABLE` P3
- `PH6-FU-MULTI-LAB-SCOPING` P2
- `PH6-FU-HISTORY-PAGINATION` P2

**Resolved:** `PH5-FU-REUPLOAD-POLL-STUCK` P2 — closed in prod by
the layered 6-0 + 6-5b fix.

**Systems affected:** fabrication (student + teacher surfaces +
shared orchestration).

**Totals:** 1668 → 1854 tests (+186). api-registry 310 → 324
(+14 routes). No new migrations.

**Next phase:** Phase 7 (Fabricator Queue + Pickup). Brief to be
drafted on kickoff. Ships `/fab/queue` real build (currently Phase 2
placeholder), Content-Disposition download wiring the 6-6k
`buildFabricationDownloadFilename()` helper, pickup / complete /
fail actions, optional notifications.

---

## 23 Apr 2026 — Skills Library Phase S2A authoring core + student viewer SHIPPED

**Context:** Checkpoint SL-SCHEMA (Phase S1) passed yesterday with migrations 105-108 applied to prod. S2A builds the first user-facing slice: teachers author cards, students read them, views log into `learning_events`. Deliberately does NOT include upload (deferred to S2B) or quiz/completion flow (S3).

**What shipped (in `skills-library` branch, not merged to main):**

- **Migration 109** `skills_library_authoring.sql` — teacher authoring surface:
  - Adds `forked_from uuid REFERENCES skill_cards(id) ON DELETE SET NULL` column (+ partial index). Written by S2B's Fork action; left NULL in S2A.
  - Teacher-write RLS policies on `skill_cards` + `skill_card_tags` + `skill_prerequisites` + `skill_external_links`: INSERT/UPDATE/DELETE scoped to `created_by_teacher_id = auth.uid() AND is_built_in = false`. Mirrors the shape used on `badges` + `activity_blocks`. Service role still bypasses for seeding + built-in management.
  - Not yet applied to prod — Matt applies after checkpoint sign-off.

- **Types (`src/types/skills.ts`)** — 6-variant `Block` discriminated union (prose / callout / checklist / image / video / worked_example), `SkillCardRow`, `SkillCardHydrated` with tags + external_links + prereqs, `SkillEventType` enum, create/update payload shapes. `emptyBlock(type)` factory for the editor. S2B extension points: `uploadPath` optional on image/video blocks (Storage key, overrides url when present).

- **Teacher API (`/api/teacher/skills/`):**
  - `GET /cards` — list built-ins + own drafts + all published, filtered by category/difficulty/ownership (`all`/`mine`/`built_in`). Uses admin client with explicit OR visibility clause (would work under RLS too; admin bypass keeps error surfaces symmetric with rest of /api/teacher/*).
  - `POST /cards` — create draft. Validates slug (lowercase-kebab, 3-80), title (3-200), category (FK check), difficulty enum, body block-type whitelist. Idempotent side inserts for tags + external_links + prereqs.
  - `GET /cards/[id]` — hydrated card (tags + links + prereq titles). Returns `{ card, editable }` — editor bounces to read-only viewer when `editable=false`.
  - `PATCH /cards/[id]` — wholesale replace for tags/links/prereqs when provided; field-level merge for metadata. Built-ins return 403. Enforces `created_by_teacher_id = auth.uid()`.
  - `DELETE /cards/[id]` — hard delete teacher's own non-built-in card. CASCADE handles children.
  - `POST /cards/[id]/publish` — flips `is_published`. `{ action: "unpublish" }` reverses. Enforces minimum publishable content (title + category + difficulty + ≥1 block).
  - `GET /categories` — thin lookup proxy to `skill_categories`.

- **Student API (`/api/student/skills/cards/[slug]`):**
  - Loads published card by slug, hydrates tags + links + prereq titles.
  - Logs `skill.viewed` into `learning_events` with 5-minute dedupe window (prevents tab-switch / remount floods). Dedupe uses `gte created_at cutoff` — older views still count toward state transitions because the derived view takes MAX rank.
  - Returns student's current state from `student_skill_state` view (state + freshness + last_passed_at). Absent row → `untouched`.
  - Uses `requireStudentAuth` (token-cookie → student_sessions table), not Supabase Auth.

- **Components (`src/components/skills/`):**
  - `BlockEditor.tsx` — controlled editor for Block[]. Each variant is a dedicated per-type component (`ProseForm`, `ChecklistForm`, etc.) — pattern sidesteps TS discriminated-union narrowing loss inside nested function closures. Add/move/delete controls + inline delete confirm.
  - `BlockRenderer.tsx` — read-only render for all 6 types. Markdown-lite prose parser (**bold** / *italic* only). YouTube + Vimeo iframe fallback + direct-mp4 video. External URL image; `/api/skills/media/[path]` reserved for S2B uploads.
  - `SkillCardForm.tsx` — shared create/edit shell used by both teacher pages. Metadata + tags + external links + fuzzy prereq search + body editor + preview toggle.
  - `skills.css` — scoped under `.sl-skill-scope` wrapper class so Tailwind-based teacher pages and student `.sl-v2` scope don't fight.

- **Teacher pages:**
  - `/teacher/skills` — library list with category/difficulty/ownership filters, draft/published pills, forked indicator, skeleton loaders, empty state CTA.
  - `/teacher/skills/new` — create flow; posts then redirects to `/edit`.
  - `/teacher/skills/[id]` — read-only viewer (for built-ins + non-editable cases).
  - `/teacher/skills/[id]/edit` — edit form + publish/unpublish toggle + delete with inline confirm. Bounces to `/teacher/skills/[id]` when `editable=false`.

- **Student page:**
  - `/skills/cards/[slug]` — student viewer. Renders body via `BlockRenderer`, shows state + freshness chip (fresh omitted as not interesting), prereq prompt ("Before you start" with chips linking to prereq cards), external resources section, tags footer. Fires view log via the API GET. 404 handled inline.

**Bug notes during build:**

- Pre-existing stash `pre-library-upload: leftover scanner/saveme artifacts` got applied during a `git stash` diagnostic command. Reset 6 conflicted doc files back to HEAD (they're saveme-regenerated artifacts anyway). S2A source files were untouched.
- TypeScript narrowing failure when block-editor forms used closures referencing `block.items` / `block.steps` inside a switch case. Fixed by extracting per-variant form components — TS can't carry narrowing through nested function closures, but each component takes the narrowed variant as its prop type.

**Verification:**

- `npx tsc --noEmit` → zero skills-file errors. Pre-existing codebase-wide errors (fabrication test mocks, useGalleryMultiplayer, multi-lesson-detection tests) untouched.
- `npm test` → 1845 pass / 8 skipped / 0 fail (up from pre-S2A 1845 — no regressions).
- `npx eslint` on S2A files → 4 initial `react/no-unescaped-entities` errors, all fixed with `&apos;`.

**Not in S2A (deferred to S2B):**

- Upload from disk — `skills-media` Supabase Storage bucket + upload API + image/video block toggle.
- Fork action — copy built-in or another teacher's card into an editable draft, sets `forked_from`.

**Checkpoint SL-AUTHOR-A criteria (pending Matt sign-off):**

1. Teacher creates a draft card via `/teacher/skills/new`, sees it in list with Draft pill.
2. Teacher edits body, tags, category, difficulty; saves; reloads → changes persist.
3. Teacher toggles publish → appears as published; can unpublish.
4. Teacher opens built-in card (read-only viewer), no edit controls.
5. Teacher deletes own card → gone from list.
6. Student visits `/skills/cards/[slug]` for a published card → sees full content + state chip.
7. Second visit within 5 min does NOT duplicate `skill.viewed` row in `learning_events`.
8. Student cannot see draft cards (404 on direct slug nav).
9. Prereq chip on student view links to the prereq card.

**Systems touched:** `skills-library` (in_progress → still in_progress, S2A layer added), `api-registry` (+~10 routes), `schema-registry` (skill_cards entry amended, 4 sibling tables' RLS note updated).

**Next:** Checkpoint SL-AUTHOR-A sign-off + migration 109 apply to prod. Then S2B — upload bucket + fork. Then S3 — quiz engine + completion flow.

---

## 23 Apr 2026 — Preflight Phase 6 code COMPLETE + Checkpoint 6.1 smoke IN PROGRESS

**Context:** First teacher-facing surface of the Preflight pipeline.
Ran in `preflight-active` worktree alongside parallel
`dashboard-v2-build` (v2 polish) + a fresh `skills-library` worktree
(Phase S1 schema). Daily merges back to main. Smoke (S1–S4) against
studioloom.org with Matt as teacher + a `test` student account.

**Phase 6 sub-phases shipped (14+ commits, all on main via preflight-active):**

| | |
|---|---|
| 6-0 | reducer auto-unfreeze on revision bump (PH5 fix) |
| 6-1 | teacher action endpoints + queue endpoint + teacher-orchestration lib |
| 6-2 | `/teacher/preflight/jobs/[jobId]` detail page + `readOnly` ScanResultsViewer |
| 6-3 | `/teacher/preflight` queue page with status tabs + counts |
| 6-4 | per-student + per-class fabrication history |
| 6-5 | student `needs_revision` view + `TeacherReviewNoteCard` |
| 6-5b | reset-before-fetch ordering (closes `PH5-FU-REUPLOAD-POLL-STUCK`) |
| 6-6 | Checkpoint 6.1 report draft with ⏳ placeholders |
| 6-6a–l | smoke-feedback polish — see below |

**Smoke-feedback polish sub-phases (a–l):**
- **a** — 4× bigger scan thumb + scroll-to-top on teacher action
- **b** — "Uploading your file" → "Loading your submission" (copy was wrong for nav/return entry paths)
- **c** — hide Submit button on `needs_revision` + `pending_approval` (rude to re-submit unchanged)
- **d** — width + typography consistency pass across all preflight pages (`max-w-6xl`, `text-3xl` h1s, cleaner section headings with coloured accent bars, no emoji)
- **e** — 2-column layout on student status page (content left, preview + history right)
- **f** — click-to-zoom preview lightbox with Esc + backdrop close + body-scroll-lock
- **g** — Preflight tab added to v2 student `BoldTopNav`
- **h** — final width polish on fabricators + submitted + upload pages
- **i** — new `/fabrication` student overview page listing their submissions + `+ New submission` CTA; removed redundant "Back to dashboard" links
- **j** — 2-column layout on teacher detail page; extracted `PreviewCard` into shared component
- **k** — student **withdraw** (`POST /api/.../cancel`) + auto-filename helper (`{student}-{grade}-{unit}.ext`) + button press animations across every preflight button
- **l** — canned-note chip strip (4–7 presets per action kind) in TeacherActionBar modal

**Smoke progress (Matt on studioloom.org):**
- ✅ **S1 Happy path** (approve) — clean end-to-end
- ✅ **S2 Return for revision** — CRITICAL TEST. Reupload
  transition was clean without hard-refresh, confirming the layered
  6-0 (reducer auto-unfreeze) + 6-5b (reset-before-fetch) fix works
  end-to-end. Closes `PH5-FU-REUPLOAD-POLL-STUCK`.
- ✅ **S3 Reject** — red card renders without `ScanResultsViewer`,
  Start Fresh link navigates correctly.
- ⏳ **S4 Per-student + per-class history** — pending.

**5 new follow-ups filed during smoke** (tracked inline + in Checkpoint 6.1 report):
1. `PH6-FU-PREVIEW-OVERLAY` P2 — scanner-driven bounding boxes on
   thumbnail showing WHERE a rule fired. Data already flows through
   `scan_results.rules[].evidence`.
2. `PH6-FU-PREVIEW-PINCH-ZOOM` P3 — wheel/pinch zoom + drag-pan.
3. `PH6-FU-RULE-MEDIA-EMBEDS` P2 — extend rule schema with
   `mediaHints`, render inline image/video below `fix_hint`. Pairs
   with `PH5-FU-PER-RULE-ACKS` + `PH6-FU-PREVIEW-OVERLAY`.
4. `PH6-FU-TEACHER-CANNED-NOTES-EDITABLE` P3 — teacher-editable
   preset list with `/teacher/preflight/settings` management UI.
5. `PH6-FU-MULTI-LAB-SCOPING` P2 — `fabrication_labs` entity for
   schools with 3+ separate design labs (Seoul Foreign School
   model). NIS (1 proximal DT area) works fine with v1. Phase 9+,
   gated on access-model-v2 (FU-O/P/R) shipping first.

**Resolved this session:**
- `PH5-FU-REUPLOAD-POLL-STUCK` P2 — closed via layered Phase 6-0 +
  6-5b fix. Verified in S2 smoke.

**Systems affected:** fabrication (student + teacher surfaces +
shared orchestration), student-dashboard (BoldTopNav nav entry),
api-registry (+14 routes, 310 → 324 total).

**No migrations.** Phase 6 is pure app.

**Tests:** 1668 → 1862 (+194).

**Cross-session interactions (merge friction):** `dashboard-v2-build`
cutover to `/dashboard` + `BoldTopNav` extraction + Skills nav
pill rename produced 2 small conflicts, both resolved in favour of
v2's cleaner discriminated-union nav structure with the Preflight
entry ported. `skills-library` S1 schema (migrations 105-108) ran
in parallel with zero overlap — clean merges.

**Checkpoint 6.1 sign-off pending** S4 verification + flipping
`⏳ DRAFT` → `✅ PASS` in the report header.

---

## 23 Apr 2026 — Skills Library Phase S1 schema foundation SHIPPED + APPLIED to prod

**Context:** Kickoff of the Skills Library project per [`docs/projects/skills-library.md`](projects/skills-library.md) + canonical specs in `docs/specs/skills-library-spec.md` + completion-addendum. The library is the "moat" — one canonical skill card, many embed contexts (library browse, lesson activity blocks, Open Studio capability-gap, crit board, badges). Completions as `learning_events`, not a mutable table.

Phase S1 is **schema foundation only** — no UI, no API routes, no teacher-write policies yet. Deliberately minimal to unlock S2 authoring + S3 library browse.

**What shipped (in the skills-library branch, not merged to main):**

- **Migration 105** `skills_library_schema.sql` — 5 tables:
  - `skill_categories` (8-item lookup seeded: researching, analysing, designing, creating, evaluating, reflecting, communicating, planning)
  - `skill_cards` (canonical content entity, structured-block `body` JSONB, `category_id` FK, `difficulty` enum, `estimated_min`, `is_built_in` + `created_by_teacher_id` for hybrid ownership, `is_published` draft/live)
  - `skill_card_tags` (many-to-many flat tag list)
  - `skill_prerequisites` (directed graph — skill X requires prerequisite Y; CHECK prevents self-reference)
  - `skill_external_links` (video/PDF/doc references with `last_checked_at` + `status` for nightly link-check cron)
  - Auto-bump `updated_at` trigger on skill_cards
  - Baseline RLS: authenticated reads on published rows, author reads on own drafts; writes service-role-only until S2 authoring UI lands

- **Migration 106** `learning_events.sql` — append-only cross-cutting event log:
  - Columns: `id`, `student_id`, `event_type`, `subject_type`, `subject_id`, `payload` (JSONB), `schema_version`, `created_at`
  - Indexes for (student, time), (subject_type, subject_id, time), (event_type), + composite on (subject_type, student_id, subject_id) filtered to skill_card
  - RLS: students read/insert their own only (`auth.uid() = student_id`). No UPDATE/DELETE — append-only by design
  - First consumer: `skill.*` events (viewed, quiz_passed, quiz_failed, refresh_passed, refresh_acknowledged, demonstrated, applied)
  - Future consumers: `stone.*`, `portfolio.*`, `critique.*` — each spec registers its own event vocabulary

- **Migration 107** `student_skill_state_view.sql` — derived current-state per (student, skill):
  - Aggregates `skill.*` events from `learning_events` into a state ladder (untouched → viewed → quiz_passed → demonstrated → applied)
  - Freshness bands: fresh (0-90 days) / cooling (91-180) / stale (>180), anchored to most recent ≥quiz_passed event
  - Row absent = untouched (LEFT JOIN pattern for UI queries)
  - Pure view, no materialisation — re-evaluate at scale in S4+ if perf demands

- **Migration 108** `skills_library_sample_seeds.sql` — 3 sample cards for checkpoint verification:
  - "Ideation sketching: thumbnails" (designing, foundational) — 3 structured blocks + tags
  - "3D Printing: basic setup" (creating, foundational) — with external link to Prusa walkthrough
  - "3D Printing: troubleshooting" (creating, intermediate) — **depends on basics** via `skill_prerequisites` — demonstrates the progression chain the spec promises
  - All three `is_built_in: true` — survive as platform baseline

**Checkpoint SL-SCHEMA criteria (for verification post-apply):**
1. Migrations 105-108 apply cleanly to prod Supabase
2. `SELECT count(*) FROM skill_categories` = 8
3. `SELECT count(*) FROM skill_cards` ≥ 3
4. Manual INSERT on `learning_events` with `event_type='skill.viewed'` → `student_skill_state` returns state='viewed' for that student+skill
5. Prereq chain query demonstrates: a student who has `skill.quiz_passed` on 3D-basics would unlock 3D-troubleshooting as "next up"

**Registries updated:**
- `docs/schema-registry.yaml` — 6 new entries (skill_cards, skill_categories, skill_card_tags, skill_prerequisites, skill_external_links, learning_events; plus student_skill_state view conceptually via schema migration 107)
- `docs/projects/WIRING.yaml` — `skills-library` system status: `planned` → `in_progress`
- `docs/doc-manifest.yaml` — last_verified on touched docs
- `docs/changelog.md` — this entry

**Known deferrals (not in S1 scope, captured for later phases):**
- `estimated_min` added to schema but not yet surfaced in UI (S5)
- Teacher authoring UI → S2
- Quiz engine → S3
- "Next up" query + freshness gating → S4
- `/skills` page upgrade from placeholder → S5
- Radar chart, badge engine, forking, cross-school visibility → all deferred per spec
- No Open Studio capability-gap wiring yet — that's a future phase once Open Studio Mode ships

**Files:**
- NEW: `supabase/migrations/105_skills_library_schema.sql`
- NEW: `supabase/migrations/106_learning_events.sql`
- NEW: `supabase/migrations/107_student_skill_state_view.sql`
- NEW: `supabase/migrations/108_skills_library_sample_seeds.sql`
- MODIFIED: `docs/schema-registry.yaml` (6 new table entries appended)
- MODIFIED: `docs/projects/WIRING.yaml` (skills-library status)
- MODIFIED: `docs/doc-manifest.yaml` (last_verified bumps)
- MODIFIED: `docs/changelog.md` (this entry)

**Systems affected:** `skills-library` (v0 → v0 planning, schema in_progress), `learning-events` (new system effectively created — existed only in spec).

**Commits:** 1 commit on `skills-library` branch (worktree at `/Users/matt/CWORK/skills`). **Not pushed to origin/main** — awaits Matt's review + migration apply to prod Supabase. Push discipline: migrations must be applied to prod before main merge.

**Session context:** Dashboard-v2 polish paused mid-Phase-17 for Matt's strategic shift to Skills Library. Discovered existing canonical specs (skills-library-spec.md + completion-addendum, both 11 Apr 2026) — my earlier student-skills-page.md marked superseded. Worktree created at `/Users/matt/CWORK/skills` on branch `skills-library` (dropping "questerra" prefix per Matt's renaming direction).

---

## 22 Apr 2026 — Student Dashboard v2 (Bold) SHIPPED: Phases 1-8 complete, cutover live

**Context:** End-to-end build and production cutover of a new Bold-design student dashboard, ported from `docs/newlook/PYPX Student Dashboard/student_bold.jsx`. Built phased behind a cookie gate, then promoted to the default `/dashboard` for all students. Ran in parallel with a separate Preflight session in `questerra-preflight/`; git worktrees used to isolate the two sessions after an early cross-contamination incident where Preflight's `git add` swept up uncommitted dashboard changes into commit `a88b330`.

**What shipped (all phases in one day):**
- **Phase 1** (`b89e89d`) — scaffold at `/dashboard/v2` behind `sl_v2=1` cookie gate, all 6 mock sections ported
- **Phase 2** (`b2a8d12`) — TopNav + hero greeting wired to `/api/auth/student-session`
- **Phase 3A** (swept into `a88b330`, fix `934ddfe`) — hero unit identity (title/subtitle/class/color/image) from `/api/student/units`, per-subject color palette mirrored from current dashboard's `SUBJECT_MAP`
- **Phase 3B** (`cfa2a00`) — hero current task card: the specific activity block the student is up to in their current lesson, lesson-level block progress (X/N), real due date. Uses `content.sections[]` + `student_progress.responses` keyed as `activity_<activityId>` or `section_<index>` (mirrors the unit page's own key convention)
- **Phase 4** (`454f98b`) — priority queue classified from `/api/student/insights` per type-based rules (Overdue / Today = top continue_work / Soon = rest by priority, capped at 5). Button navigation via `<Link>` when href present, inert `<button>` in preview mode
- **Phase 4.5** (`97b3046` + `67bacab`) — hero Continue button wired to current task page; mock-flash fix (initial state null → skeletons → real data; fallback to MOCK only on 401/error)
- **Phase 5** (`20f40f7`) — units grid from `/api/student/units` with real colors/images/progress. Open Studio inline marker intentionally dropped per Matt (will be separate card or hero when implemented)
- **Phase 6** (`d913fe8`) — badges from `/api/student/safety/pending` (earned + pending, safety badges are binary → progress always 0, status text via student_status)
- **Phase 7** (`8d6483b`) — Feedback section DROPPED entirely (no backing data; returns when general notes system ships)
- **Phase 8** (`d07ef97`, merge `be5c1d6`) — cutover: `v2/page.tsx` + `DashboardV2Client.tsx` moved to `dashboard/`, renamed `DashboardClient`; old dashboard preserved at `/dashboard-legacy` for 1-week rollback; cookie gate removed; layout escape-hatch condition updated from `/dashboard/v2` → `/dashboard`

**Matt's product decisions captured in tracker (`docs/projects/student-dashboard-v2.md`):**
- Hero = project-management tool, not activity feed. "Current task" = specific activity block, "task progress" = progress through lesson's blocks. Don't use "phase" in student copy.
- Notes system is deferred; when built, must be bidirectional (teacher + student) and NOT siloed 1:1.
- Open Studio gets its own card (or hero) when active — no inline markers on regular unit cards.
- Per-card due dates dropped from grid cards; Matt will wire as part of assessment/grading work.
- Theme system decision deferred; "I'll add more themes later".
- Focus mode (future): hide everything except next step, escape to return to full dashboard.
- Snooze is a behaviour experiment to try with students.

**Phases 9-16 planned & ordered in `docs/projects/student-dashboard-v2.md`:** bell count + pill nav anchors + dead-link cleanup + hide fake teacher note (quick wins); unified header across routes; responsive pass; focus mode; snooze; notes system; legacy cleanup; a11y.

**Infrastructure change:** Three git worktrees now standard:
- `/Users/matt/CWORK/questerra` = main (merge baseline, neither session works here)
- `/Users/matt/CWORK/questerra-dashboard` = dashboard work on branch `dashboard-v2-build`
- `/Users/matt/CWORK/questerra-preflight` = preflight work on branch `preflight-active`
Isolates uncommitted-change bleed between parallel sessions. Documented in both session CLAUDE.md files. Top-level `.claude/launch.json` has entries for all three dev servers (ports 3000 / 3100 / 3200).

**Files touched:**
- NEW: `src/app/(student)/dashboard/DashboardClient.tsx` (1300+ lines)
- NEW: `src/app/(student)/dashboard/page.tsx` (replaces old 391-line page)
- NEW: `src/app/(student)/dashboard-legacy/page.tsx` (archived old dashboard)
- MODIFIED: `src/app/(student)/layout.tsx` — route-aware escape hatch on `/dashboard`
- NEW: `docs/projects/student-dashboard-v2.md` — build tracker + Phase 9-16 ordered plan
- MODIFIED: `CLAUDE.md` — added Student Dashboard v2 section with "continue dashboard" trigger phrase

**Test counts:** no new tests (UI-only work; existing 1409 npm tests untouched). No migrations.

**Commits:** 9 on `dashboard-v2-build`, merged to `main` as merge commit `be5c1d6`. Pushed origin/main. Deployed to prod by Vercel.

**Systems affected:** `student-dashboard` (v1 → v2, Bold redesign).

**Session context:** Matt drove methodical phase-by-phase with checkpoint sign-offs. Used localhost + Vercel preview URLs for verification. Hit two interesting issues: (1) parallel session cross-contamination via shared working tree (fixed via worktrees), (2) mock-data flash before real data on initial page load (fixed via skeleton + null-initial-state pattern). Phase 8 cutover went clean; production `studioloom.org/dashboard` now serves the Bold dashboard for all students.

---

## 21 Apr 2026 — Preflight Phase 2A shipped + Checkpoint 2.1 PASSED (smoke test session)

**Context:** Resume of Phase 2A build after 11 commits landed in prior sessions (`5e00518..262ae0c`). This session ran the prod smoke test validation portion of Checkpoint 2.1 — the criterion-by-criterion sign-off, not new code. One real bug surfaced (OOM on 256MB Fly tier) and was fixed inline.

**What changed:**
- **WIRING.yaml** — `preflight-scanner` status `in-progress` → `deployed`. Summary rewritten to cover Phase 2A completion: Fly.io `preflight-scanner` SYD at 512MB, poll loop via `claim_next_scan_job` RPC, ruleset `stl-v1.0.0`, 116 pytests passing, Checkpoint 2.1 smoke-test evidence.
- **New doc** — `docs/projects/preflight-phase-2a-checkpoint-2-1.md` (~170 lines): 12-criterion pass/fail matrix, prod smoke test evidence on 4 fixtures, 4 follow-ups (FU-SCANNER-OOM, FU-SCANNER-SIDECAR-DRIFT, FU-SCANNER-LEASE-REAPER, FU-SCANNER-EMAIL-VERIFY), commit list.
- **ALL-PROJECTS.md** — Preflight block: status header adds 2A; bullet expanded to cover Phase 2-0b (Gate B — 53 fixtures bucketed) + Phase 2A shipping summary + 4 follow-ups; "Phase 2 next" replaced with "Phase 2B next".
- **Fly infra** — `fly scale memory 512 -a preflight-scanner` applied to both primary + standby machines. Was on `shared-cpu-1x@256MB`, now `shared-cpu-1x@512MB` (~+$3/mo). Root cause: trimesh + matplotlib combined working set exceeds 256MB on ~30k-face meshes; Phase 2A brief §2 prediction ("upgrade when first school reports OOM") proved conservative — we hit it in internal validation.

**Smoke test evidence (prod, 21 Apr):**
- `small-cube-25mm.stl` (known-good) — scan 2.6s, 0 BLOCK/WARN rules, thumbnail uploaded 12.1 KB.
- `seahorse-not-watertight.stl` (known-broken, 29,612 faces) — attempt 1 OOM on 256MB → bumped to 512MB → attempt 2 passed with R-STL-01 BLOCK + R-STL-04 WARN + 2 FYI.
- `chess-pawn-inverted-winding.stl` (authored, 96 faces) — R-STL-02 BLOCK + R-STL-05 BLOCK (sidecar drift logged as FU).
- `whale-not-watertight.stl` (known-broken, 2,086 faces) — R-STL-01 BLOCK + R-STL-04 WARN + 2 FYI.

**Operational learnings:**
- **OOM kill → stuck lease.** When worker is SIGKILLed mid-scan, `fabrication_scan_jobs.locked_by` + `locked_at` never release. The unique index `uq_fabrication_scan_jobs_active_per_revision` then blocks retries forever. Manual clear required (UPDATE status='error', null lease). FU-SCANNER-LEASE-REAPER opened (P2) — needed before horizontal scaling.
- **Fly hobby tier sizing.** Phase 2A brief documented 256MB as starting tier with a "512MB when first school reports OOM" plan. In practice, 29k faces tripped it — suggests 512MB should be the minimum going forward. Brief §2 needs a small update.
- **Dashboard UX gotcha.** Supabase's "Run without RLS" / "Run and enable RLS" popup warned incorrectly on `fabrication_scan_jobs` INSERT — false positive because RLS is enabled with 0 policies (intentional deny-all per migration 096 + FU-FF). Clicked "Run without RLS" to preserve the deny-all pattern.

**Systems affected:** `preflight-scanner` (status change + summary rewrite).
**Registries touched:** WIRING.yaml (1 entry). Other 5 registries: no changes expected (no new migrations, no new API routes, no new AI call sites in this session — pytest is Python-side only).
**Commits:** Zero new code commits this session — Phase 2A code had already landed in prior sessions. This session captured the checkpoint report doc + WIRING status flip + ALL-PROJECTS update.
**Tests:** pytest 116/116 passing locally (83s run). `npm test` baseline unchanged at 1409.

**Next:** Preflight Phase 2B (SVG rule catalogue R-SVG-01..15 — same worker, new `src/rules/svg/` module). R-SVG-07 fixture outstanding but can ship at WARN. Separate brief + session per methodology.

---

## 21 Apr 2026 — Preflight Phase 1B-2 shipped: Fabricator auth + invite + email + student pref

**Context:** Continuation session from 1B-1. Phase brief `docs/projects/preflight-phase-1b-2-brief.md` (commit `b4f4661` on 20 Apr late) organised the work into six surgical sub-tasks. This session executed 1B-2-1 through 1B-2-6 end-to-end plus one preview-caught hotfix.

**Sub-tasks landed (7 commits on origin/main, range `3cd3adc..21401b3`):**
- **1B-2-1** (`3cd3adc`, pre-session) — `src/lib/preflight/email.ts` + `email-templates.ts`. Resend helper with per-`{jobId, kind}` idempotency via `fabrication_jobs.notifications_sent` JSONB **merge** (Lesson #42 — preserve existing keys on update). 4 email kinds: `invite`, `set_password_reset`, `scan_complete`, `pickup_ready`.
- **1B-2-2** (`662f81a`, pre-session) — Fabricator auth primitives. `src/lib/fab/auth.ts` + `token.ts`: Argon2id password hash, opaque 32-byte session tokens (SHA-256 at rest), `requireFabricatorAuth`, `createFabricatorSession({isSetup})`. `/fab/login` + `/api/fab/login` + `/api/fab/logout` with `Cache-Control: private` (Lesson #11). Login rejects `is_setup=true` sessions.
- **1B-2-3** (`fd50641`, pre-session) — `/fab/set-password` + verify/submit API. Consumes `is_setup=true` sessions, rotates to normal session post-save. Initial draft lacked Suspense wrapper → Vercel prerender build failed (`useSearchParams() should be wrapped in a suspense boundary`). See hotfix below.
- **1B-2-4** (`c2e75d9`, pre-session) — `/teacher/preflight/fabricators` admin page + client + 4 API routes (POST/GET `/fabricators`, PATCH/DELETE `/[id]`, PATCH `/[id]/machines`, POST `/[id]/reset-password`). 7 invite-route tests asserting specific payload shapes (Lesson #38). Cross-teacher ownership guard → 409. Resend path `?resend=true`. No hard-delete (405 per D-INVITE-3).
- **1B-2-4 hotfix** (`26e4921`) — `/fab/set-password` Suspense wrapper. Split page into `FabSetPasswordInner` + default export wrapped in `<Suspense>`. Verified via preview (invalid-token branch rendered cleanly, no hooks errors, no console warnings). Caught only on Vercel build; local dev was happy. Pattern already used at `/teacher/set-password` — should have mirrored from the start.
- **1B-2-5** (`4697801`) — `PATCH /api/student/studio-preferences` now accepts `fabricationNotifyEmail: boolean`. Column `students.fabrication_notify_email` already existed from migration 100. Student-visible UI toggle deferred to Phase 2 per D-STUDENT-1. 4 new tests (401 unauthed, 400 non-boolean, 200 true, 200 false) — Lesson #45 scoped (only cover the new field).
- **1B-2-6** (`21401b3`) — Phase wrap-up. api-registry regenerated (296→306 routes; +10 new). Scanner gate bumped 300→400 (legitimate growth — cap was chosen when we had 266). `auth-system` in WIRING extended from dual-auth to triple-auth with `fabricators` + `fabricator_sessions` data_fields + `is_setup` session semantics documented. `preflight-pipeline.key_files` gained 16 new paths. Phase brief completion summary appended. ALL-PROJECTS.md Preflight block updated.

**Hotfix lesson:** Next.js 15 requires `useSearchParams()` inside a `<Suspense>` boundary for static prerender. Our local `npm run dev` tolerated it (different render path); only Vercel's static export exposed it. When adding a new page that uses `useSearchParams`, mirror the `/teacher/set-password` pattern (inner component + Suspense-wrapped export) from the start.

**Push discipline (from memory):** Hotfix pushed mid-phase to unblock Vercel; all remaining commits held until checkpoint 1.1B-2 signed off. `wip` backup branch (phase-1b-2-wip) remained one step behind `main` after each push — no divergence risk.

**Tests:** Baseline 1362 passing + 8 skipped → **1409 passing + 8 skipped** (+47 net across phase). `tsc --noEmit` clean on new files. FU-MM drift unchanged.

**Registries synced this saveme:**
- `docs/api-registry.yaml` — no diff after 1B-2-6's regen (306 routes).
- `docs/ai-call-sites.yaml` — no diff (this phase added no new LLM calls).
- `docs/feature-flags.yaml` — added `NEXT_PUBLIC_SITE_URL` (new config consumer for invite/reset email URLs in 3 routes). Orphaned `SENTRY_AUTH_TOKEN` still present — FU-CC (build-time-only, documented).
- `docs/vendors.yaml` — no drift.
- RLS coverage — 75/82 with policies; 7 no-policy tables are FU-FF intentional deny-all.
- `docs/schema-registry.yaml` — no migrations this phase; no manual edits needed.

**Systems affected (WIRING):** auth-system (triple-auth extension, +2 data_fields tables, +2 key_files, +preflight-pipeline to affects), preflight-pipeline (+16 key_files).

**Known drift carried forward:**
- FU-MM (P3) — TS errors in `adapters.test.ts` + `checkpoint-1-2-ingestion.test.ts`, pre-existing.
- FU-CC (P3) — `SENTRY_AUTH_TOKEN` flagged as orphaned by flags scanner; build-time-only secret, needs annotation on registry side.
- FU-DD (P2) — legacy scanners still strip `version:` header on rewrite. `api-registry.yaml` currently lacks `version:` but none of the registry-version consumers have shipped yet.

**Next session candidates:** Preflight Phase 2 (Python scanner worker on Fly.io — blocked on Gate B fixture bucketing); Dimensions3 Phase 7 (admin landing + controls); Toolkit Redesign v5.

---

## 20 Apr 2026 (late) — Preflight Phase 1B-1 shipped: schema extensions + Storage + AI guardrails

**Context:** Continued same-day from Phase 1A. Brief `docs/projects/preflight-phase-1b-1-brief.md` was prepped earlier in the day (commit `c806d23`); this session executed sub-tasks 1B-1-1 through 1B-1-7 end-to-end. Brief's "Don't stop for" list + Karpathy discipline (Lessons #43–46) kept scope surgical — 6 migrations, all additive, no wandering.

**Sub-tasks landed (7 commits on origin/main):**
- **1B-1-1 mig 098** (`8029efe`, pre-session) — `fabrication_jobs` gains `student_intent JSONB` (pre-check answers: size bucket / units / material / description), `printing_started_at TIMESTAMPTZ` (Fabricator UI sub-state), `notifications_sent JSONB` (email idempotency map).
- **1B-1-2 mig 099** (`eb123a7`, pre-session) — `fabricator_sessions.is_setup BOOLEAN NOT NULL DEFAULT false`. Marks one-time invite / password-reset sessions; `/fab/set-password` will consume setup sessions and rotate to `is_setup=false` normal session. 24h TTL via existing `expires_at`.
- **1B-1-3 mig 100** (`5df4fba`) — `students.fabrication_notify_email BOOLEAN NOT NULL DEFAULT true`. Default=true preserved backward compat — all 6 existing students opted-in on apply. PG 11+ metadata-only ADD COLUMN so safe on hot table.
- **1B-1-4 mig 101** (`30f550d`) — `fabrication_job_revisions.ai_enrichment_cost_usd NUMERIC` (per-scan Haiku spend; NULL = skipped/disabled) + `thumbnail_views JSONB` (shape: `{views: {iso, front, side, top, walls_heatmap, overhangs_heatmap}, annotations: [{view, bbox, rule_id}]}`).
- **1B-1-5 mig 102** (`7be2183`) — 3 private buckets (`fabrication-uploads`, `fabrication-thumbnails`, `fabrication-pickup`) + 3 service-role-only FOR ALL policies on `storage.objects`, scoped by bucket_id. Matches FU-FF deny-all pattern; granular path-based RLS deferred to Phase 2.
- **1B-1-6 mig 103** (`f6ddc1e`) — 3 `admin_settings` keys seeded: `preflight.ai_enrichment_enabled=true` (kill switch), `preflight.ai_enrichment_daily_cap_usd=5.00` (daily spend cap), `preflight.ai_enrichment_tiers_enabled=["tier1"]` (safety-critical only at launch). Scanner worker will read these before every Haiku call; sums today's `fabrication_job_revisions.ai_enrichment_cost_usd` vs cap, emits `system_alerts` on hit.
- **1B-1-7 docs sync** (`7018f41`) — schema-registry (4 tables updated: students +fabrication_notify_email with classification block, fabrication_jobs +3 cols, fabrication_job_revisions +2 cols, fabricator_sessions +is_setup; admin_settings purpose string mentions new keys). WIRING preflight-pipeline data_fields now references all 4 tables + new columns; preflight-scanner depends_on adds `admin_settings`; both systems link the 1B-1 brief. api-registry rerun — no drift (DDL-only phase).

**Push discipline (from memory):** All 7 commits held on `main` locally, backed up to `phase-1b-1-wip` after each commit. Pushed to `origin/main` only after checkpoint 1.1B-1 closed at 1362/8 test baseline match. No `--amend`, no squashing.

**Systems affected (WIRING):** preflight-pipeline (summary + data_fields + docs + key_files + affects), preflight-scanner (summary + depends_on + data_fields + docs).

**Tests:** 1362 passing, 8 skipped, 79 files — exact baseline match from this morning's saveme. DDL-only phase, no new test coverage — pattern consistent with Lesson #38 (verification discipline: explicit assertions via SELECT queries post-apply, not trusting "no error = success").

**Verify queries captured (per sub-task):**
- Column shape assertions (data_type, is_nullable, column_default) — all match spec
- Comment presence — all `COMMENT ON COLUMN` land correctly
- Empty-table non-null counts — all 0 on fresh tables
- Storage: 3 buckets public=false, 3 policies cmd=ALL, `storage.objects.relrowsecurity=true`
- admin_settings: 3 keys present, no key leakage outside preflight.ai_enrichment_*, `updated_at` fresh

**Notable quirks / non-issues:**
- PostgreSQL JSONB normalises `'5.00'::jsonb` → `5` (trailing zeros dropped). Same semantic value, just Postgres's JSONB numeric representation. Flagged in verify output, non-issue.
- `students` existing RLS policy count = 1 pre-existing; unchanged by mig 100 (no new policy added). Verify query (d) confirmed.
- `fabricator_sessions` has 0 policies intentionally (deny-all per FU-FF). Migration 099 didn't add one — correct.

**Pre-existing drift noted (not caused by 1B-1):**
- TypeScript errors in `src/lib/pipeline/adapters/__tests__/adapters.test.ts` + `tests/e2e/checkpoint-1-2-ingestion.test.ts` (5 errors on Dimensions3 type shapes: `DimensionScore.flags`, `bloomLevels`, `blocksUsed`, `CostBreakdown`, `'cc-by'` literal). Confirmed pre-existing via `git stash` check. Vitest runs green (separate transpile path). Filed as **FU-MM (P3)**.

**Registries scanned:** ai-call-sites.py, feature-flags.py (drift status unchanged from morning — SENTRY_AUTH_TOKEN orphan per FU-CC), vendors.py (OK), rls-coverage.py (7 `rls_enabled_no_policy` tables, all intentional per FU-FF — includes our fabricator_sessions + fabrication_scan_jobs from Phase 1A). No new drift introduced.

**Next up:** Phase 1B-2 (teacher Fabricator-invite UI, `/fab/login`, `/fab/set-password`, email dispatch using `notifications_sent` idempotency, student settings toggle) OR Phase 2 (Python scanner worker on Fly.io).

**Commits (this session):** `5df4fba`, `30f550d`, `7be2183`, `f6ddc1e`, `7018f41` — all pushed to origin/main. Plus `8029efe`, `eb123a7` from earlier in the day.

---

## 20 Apr 2026 — Preflight (fabrication submission pipeline) — Phase 0 + Phase 1A shipped

**Context:** New project. Submission pipeline between "student design file" and "lab tech runs it on the 3D printer or laser cutter." Pedagogy/workflow spec at `docs/projects/fabrication-pipeline.md` (734 lines) was already SPEC-ready; this session took it from SPEC to deployed schema. Free public tool + logged-in teacher/student/Fabricator workflow share the same codebase.

**Decisions locked (pre-code):**
- Product name: **Preflight** (domain term of art — Adobe Acrobat Preflight, InDesign live preflight). Pivoted same-day from initial "Bouncer" pick after reconsideration (nightclub vibe, less professional for enterprise sell).
- Lab-tech role: **Fabricator** — own account type + `/fab/login` surface, NOT Supabase Auth. Cookie session pattern matches `student_sessions` (Lesson #4).
- Scanner host: **Fly.io** (Python worker, trimesh for STL, svgpathtools for SVG). ~$5–35/mo envelope. No AI calls — deterministic.
- Retention: raw file deleted 30 days after `completed` or `rejected`; scan results + thumbnails kept indefinitely.
- Rule-override UX moved Phase 8 → Phase 1 (solo-reviewer mitigation). Ambiguous rules ship at WARN not BLOCK.
- No FK to `work_items` (Pipeline 2) in v1 — loose event coupling only.
- Pilot Fabricator: Cynthia (NIS, on-board).
- Gate A (pre-commit): student-named raw fixture files ignored at `fabrication/fixtures/` root via `.gitignore` — only anonymised bucketed files tracked.

**Phase 1A — 10 commits, all on origin/main:**
- Migration 093 `machine_profiles` + 5 indexes + 4 RLS + ownership XOR CHECK. `rule_overrides` JSONB + `is_system_template` flag added (not in spec §7 — documented deviation).
- Migration 094 seeds 12 system-template profiles (6 3DP: Bambu X1C/P1S, Prusa MK4S, Ender 3 V2, Ultimaker S3, Makerbot Replicator+; 6 lasers: Glowforge Pro/Plus, xTool M1/P2/S1, Gweike Cloud Pro). Idempotent `ON CONFLICT WHERE is_system_template DO NOTHING`.
- Migration 095 `fabrication_jobs` + `fabrication_job_revisions` + dual-visibility RLS. Simpler than Lesson #29 — direct `teacher_id` column covers NULL `class_id` fallback without junction UNION.
- Migration 096 `fabrication_scan_jobs` queue + 3 partial indexes. Deny-all RLS (matches FU-FF pattern with `student_sessions`, `ai_model_config`).
- Migration 097 `fabricators` + `fabricator_sessions` + `fabricator_machines` junction. 6 RLS policies. Case-insensitive email via `UNIQUE ON LOWER(email)`.
- Schema-registry: 7 new table entries with `applied_date: 2026-04-20`. WIRING.yaml: 3 new systems (`preflight-pipeline`, `preflight-scanner`, `machine-profiles`) + Lesson #33 fix on pre-existing line 1960. api-registry drift caught (routes 290→296, auth classification refinements).

**Surprises & fixes:**
- Supabase dashboard "Run and enable RLS" popup **mis-parses PL/pgSQL `DECLARE` variable names as table identifiers** — our `rls_enabled` boolean variable was extracted and the dashboard auto-generated `ALTER TABLE rls_enabled ENABLE ROW LEVEL SECURITY`, crashing with 42P01. Popup text itself confirmed the misread ("read and write to `rls_enabled`"). Fix: removed DO verify block from 093, rely on post-apply SELECT queries. Logged as **Lesson #51**.
- CLAUDE.md baseline (1254) had drifted to **1362 passing** over 5 days. Corrected this saveme.
- RLS-coverage scanner: 7 deny-all tables total (5 pre-existing + 2 new from Preflight). All intentional + documented.

**Systems affected:** NEW — `preflight-pipeline`, `preflight-scanner`, `machine-profiles` (all `in-progress`). Registered downstream impact on `teacher-dashboard`, `student-dashboard`, `audit-log`.

**Tests:** 1362 passing / 8 skipped (no regression — DDL-only phase).

**Commits:** `392bb38` (scaffolding), `a5ff71b` (093), `1d68f29` (093 DO fix), `66c53a3` (094 seed), `1b2c0ad` (095), `b367686` (096), `4d42776` (097), `115a3f8` (api drift), `d476283` (WIRING + Lesson #33 fix), `39826d4` (schema-registry).

**Deferred to Phase 1B / Phase 2:**
- Storage buckets + bucket policies + retention cron implementation.
- Teacher Fabricator-invite UI + `/fab/login`.
- Python scanner worker on Fly.io (needs anonymised bucketed fixtures first per Gate B).
- FK hardening on `fabrication_jobs.lab_tech_picked_up_by` → `fabricators(id)`.
- Anonymous RLS explicit verification (dashboard queries used `postgres` role).
- SVG fixture top-up (5 of target 10 — SVG BLOCK rules ship at WARN until fixtures land).

---

## 16 Apr 2026 — Multi-lesson detection fix + Dimensions3 persistence for import pipeline

**Context:** A 12-lesson DOCX unit plan (Product Design Biomimicry) was collapsing into 1 lesson with 3 activities. Root cause: 5-step chain where mammoth only creates `<h>` tags for Word heading styles (not bold text), parseDocument couldn't detect "Week N"/"Lesson N" patterns, extraction produced few blocks, and reconstruction couldn't split them. Additionally, the import route ran the full Dimensions3 pipeline but discarded all results — no content_items, no activity_blocks.

**What changed:**
- **`src/lib/knowledge/extract.ts`** — Bold-heading promotion: when mammoth finds no native heading styles in DOCX HTML, promotes `<strong>` paragraphs to `<h3>` headings (3-120 chars, no terminal punctuation). Two regex patterns: full bold paragraphs + bold-start with short tail.
- **`src/lib/ingestion/parse.ts`** — Broader heading detection: added Week/Day/Session/Period/Lesson/Module/Part/Unit + number patterns to `HEADING_PATTERNS` array and `detectHeading()` function.
- **`src/lib/ingestion/unit-import.ts`** — Title-based lesson boundary splitting: `LESSON_TITLE_RE` detects Lesson/Week/Day/Session/Module/Part/Unit + number in block titles. Preserves original heading text (e.g., "Week 3: Prototyping") instead of generic "Lesson N".
- **`src/app/api/teacher/library/import/route.ts`** — Dimensions3 persistence: import route now persists `content_items` row + `activity_blocks` via `persistModeratedBlocks()`, matching the ingest route pattern. System learns from every import.
- **`tests/e2e/checkpoint-1-2-ingestion.test.ts`** — Word count snapshot updated (3154→3110) for both sandbox and live variants.
- **New test files:** `multi-lesson-detection.test.ts` (12 tests), `bold-heading-promotion.test.ts` (3 tests).

**Systems affected:** knowledge-pipeline (extract.ts bold promotion), unit-conversion (import route persistence + lesson detection), ingestion-pipeline (parse.ts heading patterns, unit-import.ts boundaries).

**Tests:** 1315 passing, 8 skipped (baseline maintained + 18 new tests).

**Commits:** `285b792` — pushed to origin/main.

---

## 15 Apr 2026 — Teacher password recovery: PKCE vs implicit flow split + settings change-password UI

**Context:** Phase 1B shipped the forgot-password / set-password flows earlier today (`353c0c7`). Production smoke test uncovered three stacked bugs in the reset-link round-trip. This session resolved them across four commits.

**What changed:**
- **`src/app/teacher/layout.tsx`** (`ead284b`) — Added `PUBLIC_TEACHER_PATHS` allowlist (`/teacher/login`, `/teacher/welcome`, `/teacher/forgot-password`, `/teacher/set-password`). All three redirect/render checks consult `isPublicTeacherPath()` so bare auth pages render without a session instead of flash-bouncing to login.
- **`src/components/auth/AuthHashForwarder.tsx`** (`ce45e2f` → `680a4de`) — Extended beyond hash-only detection. Now checks for `?code=<uuid>` query (UUID regex) AND hash, then splits routing: hash → `/auth/confirm` (client), PKCE code → `/auth/callback` (server). Catches Supabase Site URL fallback cases where `redirectTo` is not in the allowlist and Supabase silently strips all query params except `code`.
- **`src/app/auth/callback/page.tsx` → `route.ts`** (`680a4de`) — Replaced client page with a Next.js App Router server route handler. Server route uses `createServerSupabaseClient` (cookie access via `@supabase/ssr`) to call `exchangeCodeForSession(code)`. Fixes "PKCE code verifier not found in storage" — the verifier cookie can't be reliably read client-side after the full-page navigation chain (apex→www redirects, cookie scope). Session cookies are written to the redirect response.
- **`src/app/auth/confirm/page.tsx`** (`680a4de`) — New client page for implicit flow. Suspense-wrapped, parses `#access_token=...&refresh_token=...&type=invite` from the URL hash, calls `supabase.auth.setSession()`, routes based on `type`. Also serves as the shared error UI when the server route redirects here with `?error=...`.
- **`src/app/api/admin/teachers/invite/route.ts`** (`680a4de`) — `redirectTo` changed from `/auth/callback` to `/auth/confirm?next=/teacher/welcome`. Invites use implicit flow (admin-issued tokens in hash fragment), so the client hash parser is the right landing.
- **`src/app/auth/callback/route.ts` safeNext fallback** (`314d567`) — Default changed from generic `/teacher/dashboard` to `/teacher/set-password`. PKCE is ONLY used in StudioLoom for forgot-password. If Supabase's Site URL fallback strips the explicit `next=/teacher/set-password` and `type=recovery` params, the user still needs to set a new password — landing on the dashboard leaves them half-authenticated. `routeFor()` still honours explicit `type=recovery` and `type=invite` when present.
- **`src/app/teacher/settings/page.tsx`** (`314d567`) — Added "Account" section to General tab under About StudioLoom. Single "Change password" row with a link to `/teacher/set-password?next=/teacher/settings`. Reuses the existing set-password page; no new change-password flow needed.

**Architectural decision — why two routes, not one:**
Supabase emits two very different auth payloads depending on the flow:
- **PKCE** (`resetPasswordForEmail`, forgot-password flow) — `?code=<uuid>` in query string. Server sees it. Code verifier stored in a server-readable cookie. Exchange MUST happen server-side for `@supabase/ssr` to read the verifier.
- **Implicit** (`admin.inviteUserByEmail`, invite flow) — `#access_token=...&type=invite` in URL hash. Hashes NEVER reach the server. Must be parsed client-side, then `setSession()` called.
Trying to handle both in one route produces silent failures — either "PKCE verifier not found" (client-side PKCE) or empty hash (server-side implicit). The split is the correct long-term pattern.

**Systems affected:** teacher-auth (auth flow routing hardened), teacher-settings (account section added), teacher-layout (public paths allowlist).

**Tests:** 1254 passing, 8 skipped (baseline maintained — no new business logic).

**Commits (this session):** `ead284b`, `ce45e2f`, `680a4de`, `314d567` — all pushed to origin/main.

**Verification:** Fresh forgot-password round-trip now lands at `/teacher/set-password` with a valid session, submits a new password, signs in. Invite round-trip still works via implicit flow through `/auth/confirm`. "Change password" link appears in settings for logged-in teachers.

---

## 15 Apr 2026 — ShipReady Phase 1B COMPLETE: Teacher onboarding + branded auth emails

**What changed (across two sessions, same day):**
- **Migration 083** (`teachers.onboarded_at TIMESTAMPTZ`) — nullable first-login flag. Applied to prod.
- **Migration 084** (FK cascade fixes) — 10 FKs pointing at `teachers(id)` or `auth.users(id)` rewritten. CASCADE on content ownership (units×2, content_items, activity_blocks, generation_runs, gallery_rounds); SET NULL on audit trails (students.author_teacher_id, content_moderation_log.overridden_by, feedback_proposals.resolved_by, feedback_audit_log.resolved_by). 2 sanity asserts at end. Applied to prod. Shipped with wrong table name `feedback_resolution_log`; fixed same-day to `feedback_audit_log`.
- **Teacher Welcome flow** — 3 API routes (`/api/teacher/welcome/create-class`, `/add-roster`, `/complete`) + 4-step wizard page `/teacher/welcome` (name → class → roster → credentials). Wizard step 2 retries class-code collisions up to 5×, step 3 bulk-inserts students + class_students junction with global username dedup, step 4 flips `onboarded_at = now()` idempotently.
- **Teacher layout first-login redirect** — `src/app/teacher/layout.tsx` pushes users with `onboarded_at IS NULL` to `/teacher/welcome`.
- **Starter-path CTAs** on wizard step 4: "Generate with AI" → `/teacher/units/create?classId=X`, "Explore dashboard" → `/teacher/dashboard`.
- **Admin remove-teacher flow** working after migration 084 cleared the FK blocks.
- **Branded Supabase auth email templates** in `supabase/email-templates/` (new folder with README): `invite.html`, `confirm-signup.html`, `magic-link.html`, `reset-password.html`. Each uses StudioLoom brand gradient hero (`#7B2FF2 → #5C16C5 → #4A0FB0`), coral CTA button, 600px table layout, inline styles only, with solid-colour fallbacks for Outlook. Invite includes 4-step preview mirroring the wizard; reset-password has a prominent red security notice above the footer. Pasted into Supabase Dashboard 15 Apr 2026. Versioned in repo so copy stays in sync with the app.

**Systems affected:** teacher-onboarding (new), admin-teachers, auth-email-templates (new). No test impact — flow is Supabase Auth + UI wizard, no new business logic outside the 3 welcome routes.

**Registries synced:** api-registry.yaml gained 5 new routes (welcome×3, admin/teachers DELETE + invite). schema-registry.yaml updated for migrations 083/084 on teachers table. doc-manifest.yaml gained 5 email-template entries.

**Registries NOT committed:** ai-call-sites scanner output reverted — scanner strips 12 hand-curated indirect call sites (regression). Filed as FU-MM (P2).

**Drift noted (pre-existing, not from this session):**
- Feature-flags: `SENTRY_AUTH_TOKEN` orphaned (already FU-CC), `NEXT_PUBLIC_SITE_URL` missing from registry.
- RLS coverage: 4 tables with RLS enabled but no policies (already FU-FF — likely intentional deny-all pattern).

**Commits (this session):** `428a883`, `8c3d823`, `4b8185d` — all pushed to origin/main. Phase 1B commits from earlier today: `95d60dd`, `0e632d2`, `d574a04`, `fa0889f`.

**Tests:** 1254 passing, 8 skipped (baseline maintained).

---

## 15 Apr 2026 — Fix PDF extraction on Vercel (ingestion sandbox)

**What changed:**
- **`src/lib/knowledge/extract.ts`** — Replaced `pdf-parse` v2 (`PDFParse` class) with `pdfjs-dist/legacy/build/pdf.mjs` direct usage. pdf-parse v2 depends on `@napi-rs/canvas` which only has darwin-arm64 binaries; crashes on Vercel's Linux serverless runtime. pdfjs-dist legacy build works headless without canvas.
- **`next.config.ts`** — Added `pdfjs-dist` to `serverExternalPackages`.
- **`src/app/admin/ingestion-sandbox/page.tsx`** — Improved upload error alert to show both `data.error` and `data.message` detail.

**Systems affected:** ingestion-pipeline (upload stage PDF extraction).
**Tests:** 1254 passing (no change).
**Commit:** `b9208d4`. Pushed to origin/main.

---

## 14 Apr 2026 — Sub-phases 7A-7C: Integrity, Admin Tabs, Sandbox, Bug Reports (3 commits)

**What changed:**
- **Migration 080** (`activity_block_versions`) — auto-snapshot trigger on block UPDATE, version history table with RLS.
- **Migration 081** (`unit_version_trigger`) — auto-snapshot on unit UPDATE when `content_data IS DISTINCT FROM`.
- **Migration 082** (`data_removal_log`) — audit table for GDPR-style student data removal.
- **Student data removal script** (`scripts/remove-student-data.ts` + `src/lib/integrity/remove-student-data.ts`) — enumerates 21 tables, dry-run + confirm modes, writes audit row.
- **8 admin tab stubs → real implementations:** Cost & Usage, Quality, Wiring, Teachers, Students, Schools, Bug Reports, Audit Log. Each with dedicated API route using `createAdminClient`.
- **Floating BugReportButton** — mounted in teacher + student layouts, 4-category picker, auto-captures URL + console errors, dual auth (Supabase Auth + student token).
- **Generation Sandbox** (`/admin/generation-sandbox`) — real pipeline or simulator, step-through stage view, timing bars, cost summary, run history.
- **Block interaction viz** (`/admin/library/[blockId]/interactions`) — prerequisite/dependent/same-phase/tag-overlap relationships.
- **Per-format library tabs** (Design/Service/PP/Inquiry) on library page.
- **6 new API routes:** bug-reports (public), admin/cost-usage, admin/teachers, admin/students, admin/schools, admin/audit-log, admin/generation-sandbox/run, admin/generation-sandbox/[runId], admin/library/block-interactions.

**Systems affected:** admin-dashboard (v2→v3), bug-reporting (idea→active v1), activity-blocks (versioning triggers), generation-pipeline (sandbox mode).
**Tests:** 1254 passing (baseline maintained), 0 new TS errors.
**Commits:** `356ff55` (7A), `3500d04` (7B), `4990c6f` (7C). All pushed to origin/main.

---

## 14 Apr 2026 — Phase 7A BUILD: Admin Landing + Settings Backend (6 commits)

**What changed:**
- **Migration 079** (`admin_audit_log`) — audit table for admin actions, RLS deny-all pattern.
- **Settings helper** (`src/lib/admin/settings.ts`) — `loadAdminSettings`, `updateAdminSetting`, `shouldEnforceCostCeilings`, `ADMIN_SETTINGS_DEFAULTS`. Custom error classes for validation.
- **API routes** GET/PATCH `/api/admin/settings` — service_role Supabase client, validates key/value, writes audit row.
- **`/admin/controls` rewritten** — pipeline settings backed by `admin_settings` table (5 controls: stage toggles, cost ceilings, model override, starter patterns). Was AIControlPanel with noop console.log.
- **Pipeline orchestrator** wired to `admin_settings` — `loadAdminSettings()` at run start, stage-disable checks, per-run + daily cost ceilings, model override per stage, starter patterns to Stage 1, sandbox guard, feature-flag fallback.
- **Bug report count** added to admin landing QuickStats via `checkUsageAnalytics()`.
- **12-tab admin nav** scaffold per spec §9.8 + secondary TOOLS_TABS for legacy routes. 8 stub pages created.
- **FU-LL filed** — ai_model_config system redundancy assessment (P2, 17 files).
- `.gitignore` — added `supabase/.temp/`.
- `schema-registry.yaml` — admin_audit_log entry added, admin_settings readers/writers updated.
- Tests: 25 new tests across 5 files, NC verified on 4 tests.

**Systems affected:** orchestrator, admin_settings, admin_audit_log, admin landing, admin layout, usage-analytics, health-checks, stage1-retrieval, schema-registry, gitignore

**Commits:** `4e462df` (FU-LL), `2f982fe` (migration 079 + types), `03ed6d9` (settings helper + API + tests), `8e49cf1` (controls page), `dce6ea3` (orchestrator), `953a987` (bug report count), `871f810` (12-tab nav)

---

## 14 Apr 2026 — Path B closeout: FU-EE + FU-FF filed, migration 074 annotated

**What changed:**
- Filed **FU-EE** (P2): no canonical migration-applied log — pre-flight checks rely on probing for migration-created objects directly.
- Filed **FU-FF** (P3): 3 tables with RLS-as-deny-all pattern undocumented in schema-registry — scanner reports as drift.
- Migration 074 (`074_ingestion_moderation_hold.sql`) annotated in schema-registry indexes list with applied date.
- CLAUDE.md saveme step 5 updated: `refresh-project-dashboard` is a CWORK-level task, not questerra-scoped.
- doc-manifest purpose updated on dimensions3-followups.md to reflect FU-AA..FU-II range.

**Systems affected:** schema-registry, doc-manifest, changelog, followups tracker

---

## 14 Apr 2026 — Path B COMPLETE — FU-X + FU-N closed (Phase 7A-Safety-1 + 7A-Safety-2)

**What changed:**
- **Phase 7A-Safety-1 — FU-X closeout + RLS-coverage scanner** (6 commits):
  - Migration 075 idempotent guards: 6 `DROP POLICY IF EXISTS` added before each `CREATE POLICY`
  - Schema-registry: `applied_date: 2026-04-14` set on `cost_rollups`, `usage_rollups`, `system_alerts`, `library_health_flags`; stale `# FU-X: this table lacks RLS` inline comments removed
  - New scanner `scripts/registry/scan-rls-coverage.py` — parses all migrations for CREATE TABLE, checks each has ENABLE ROW LEVEL SECURITY + at least one CREATE POLICY. Emits `docs/scanner-reports/rls-coverage.json`. 69 tables, all have RLS enabled, 3 with RLS-as-deny-all (no explicit policies: `ai_model_config`, `ai_model_config_history`, `student_sessions`)
  - `docs/change-triggers.yaml`: new `before_creating_a_new_table` trigger requiring RLS + policy on every new table
  - Saveme step 11(g) added for RLS scanner
  - WIRING + doc-manifest wired for scan-rls-coverage.py
- **Phase 7A-Safety-2 — FU-N Option C dual-visibility** (5 commits):
  - Migration 078: dual-visibility RLS on `student_content_moderation_log` — Lesson #29 UNION pattern. SELECT + UPDATE policies now use `class_id IN (teacher's classes) OR (class_id IS NULL AND student_id IN (junction UNION legacy))`. Drop-if-exists guards from day one.
  - 11 SQL-parse tests (`moderation-log-rls-078.test.ts`) asserting policy structure: DROP guards, exactly 2 policies, both UNION arms, WITH CHECK on UPDATE, provenance comment, no destructive ops
  - Manual smoke protocol (`docs/specs/fu-n-manual-smoke-protocol.md`) for prod verification
  - Writer audit (`docs/specs/moderation-log-writer-audit.md`): 17 call sites across 14 routes categorized — 14 always-NULL by design, 3 usually have class_id, 1 garbage-by-bug (nm-assessment "unknown"), 1 direct-insert pattern inconsistency
  - Peer table `content_moderation_log` (migration 067) confirmed unaffected — no class_id column, service-role-only
  - Content-safety WIRING entry bumped from planned/v0 to complete/v2

**Migrations applied to prod:** 074, 076, 077, 078; plus 075 RLS portion (FU-X) earlier on 14 Apr. 075 cost_rollups table NOT applied (deferred).

**Follow-ups filed:** FU-N-followup (P2, Option B admin queue when FU-O lands), FU-GG (P1, nm-assessment "unknown" classId data loss), FU-HH (P2, no live RLS test harness), FU-II (P3, log-client-block direct insert pattern)

**Test baseline:** 1150 → 1161 (+11 new SQL-parse tests)

**Files created:** `supabase/migrations/078_moderation_log_dual_visibility.sql`, `src/lib/content-safety/__tests__/moderation-log-rls-078.test.ts`, `docs/specs/fu-n-manual-smoke-protocol.md`, `docs/specs/moderation-log-writer-audit.md`, `scripts/registry/scan-rls-coverage.py`, `docs/scanner-reports/rls-coverage.json`

**Files modified:** `supabase/migrations/075_cost_rollups_and_rls_fix.sql` (idempotent guards), `docs/schema-registry.yaml` (applied_dates, RLS descriptions, spec_drift entries), `docs/projects/dimensions3-followups.md` (FU-X/FU-N resolved + 4 new follow-ups), `CLAUDE.md` (follow-ups updated, test baseline, saveme step 11g), `docs/projects/ALL-PROJECTS.md` (FU-X/FU-N resolved), `docs/change-triggers.yaml` (new table trigger), `docs/doc-manifest.yaml` (scanner report + script entries), `docs/projects/WIRING.yaml` (scan-rls-coverage.py, content-safety bump)

**Systems affected:** content-safety (dual-visibility RLS), governance-registries (RLS scanner added), schema-registry (applied_dates + spec_drift)

---

## 14 Apr 2026 — GOV-1 Governance Foundation COMPLETE (all 4 sub-phases shipped)

**What changed:**
- **GOV-1.1 — Data-classification taxonomy**: 6-axis per-column classification (`pii`, `student_voice`, `safety_sensitive`, `ai_exportable`, `retention_days`, `basis`) applied to all 69 tables in `schema-registry.yaml`. `docs/data-classification-taxonomy.md` codifies the decision rules.
- **GOV-1.2 — Feature-flag / secret registry**: `docs/feature-flags.yaml` (15 flags + 12 secrets) + `feature-flags-taxonomy.md`. Scanner `scripts/registry/scan-feature-flags.py` diffs against live env var usage.
- **GOV-1.3 — Vendor registry**: `docs/vendors.yaml` (9 vendors — Anthropic, Supabase, Voyage, Vercel, Groq, Gemini, Resend, Sentry, ElevenLabs) with DPA status + 11-category canonical `data_sent` + 8 legal bases. `vendors-taxonomy.md` codifies the enums. Scanner `scripts/registry/scan-vendors.py` diffs against package.json + code.
- **GOV-1.4 — Live drift-detection loop**:
  - 2 new scanners (READ-ONLY, never auto-write): `scan-feature-flags.py`, `scan-vendors.py` → JSON reports in `docs/scanner-reports/`
  - `docs/change-triggers.yaml` (6 triggers mapping change types → required registry updates)
  - `doc-manifest.yaml` schema bump: per-entry `max_age_days` + `last_scanned`
  - `version: 1` field on all 5 registries (schema/api/ai-call-sites/feature-flags/vendors)
  - Admin read-only panel at `/admin/controls/registries` with RED/AMBER/GREEN staleness chips
  - `governance-registries` system added to WIRING.yaml
  - Quarterly self-silencing scheduled task (cron `0 9 1 */3 *`, notifies only if drift)
- **11 commits pushed** to origin/main. Test baseline 1119 → 1150.
- **2 follow-ups filed**: FU-CC (P3, annotate SENTRY_AUTH_TOKEN as build-time-only), FU-DD (P2, scan-api-routes.py + scan-ai-calls.py strip top-level `version: 1` field on rewrite — caught + reverted mid-saveme).
- **1 new lesson logged**: Lesson #47 — adding schema to existing yaml = audit every writer first.
- **8 new decisions logged** covering: per-column 6-axis classification, canonical `data_sent` + legal bases, scanners verify-never-auto-write, change-triggers codified, manifest schema bump, registry version field, scanner JSON shape, SENTRY build-time exception.

**Files created:** `docs/data-classification-taxonomy.md`, `docs/feature-flags.yaml`, `docs/feature-flags-taxonomy.md`, `docs/vendors.yaml`, `docs/vendors-taxonomy.md`, `docs/change-triggers.yaml`, `docs/scanner-reports/feature-flags.json`, `docs/scanner-reports/vendors.json`, `scripts/registry/scan-feature-flags.py`, `scripts/registry/scan-vendors.py`, admin panel at `src/app/admin/controls/registries/`

**Files modified:** `CLAUDE.md` (registries section expanded to 6 registries + saveme step 11 expanded + FU-AA/BB/CC/DD added), `docs/projects/ALL-PROJECTS.md` (GOV-1 marked complete under Core Platform, feature count 40→41), `docs/projects/dashboard.html` (GOV-1 status ready→complete), `docs/projects/dimensions3-followups.md` (FU-CC, FU-DD), `docs/decisions-log.md` (8 new entries + footer to 14 Apr), `docs/lessons-learned.md` (Lesson #47), `docs/doc-manifest.yaml` (4 new entries + summary stats), `docs/projects/WIRING.yaml` (governance-registries system), `docs/schema-registry.yaml` / `api-registry.yaml` / `ai-call-sites.yaml` / `feature-flags.yaml` / `vendors.yaml` (top-level `version: 1` added)

**Systems affected:** governance-registries (new), feature-flags registry, vendors registry, schema-registry (classified), doc-manifest (schema bump), admin panel (registries tab), build-methodology (change-triggers authoritative)

**Session context:** Matt raised the concern that new registry docs were being created without ownership — "where are all these new documents being tracked? I don't want them created then never used." Chose option (b): GOV-1.4 expanded to ship the full automation loop — scanners, change-triggers, manifest schema bump, admin panel, scheduled task — rather than leave registries as orphaned yaml. Adopted all 14 assumptions (A1-A14) including categorized `data_sent`, scanner JSON shape, per-entry `max_age_days`, self-silencing quarterly cron. FU-DD surfaced during saveme when the pre-existing api-routes/ai-calls scanners stripped the new `version: 1` field on rewrite — caught by git diff, reverted with `git checkout`, logged as a P2 follow-up. Lesson #47 codifies the general principle: shared-schema bumps require auditing every writer.

---

## 14 Apr 2026 — Phase 7-Pre COMPLETE: Registry Infrastructure Sprint

**What changed:**
- **3 machine-readable registries created** to prevent spec-vs-reality drift:
  - `docs/schema-registry.yaml` — backfilled from 74 migration files to 69 table entries (columns, RLS, writers, readers, spec drift). 3 dropped tables marked. 3 tables flagged "No RLS" (FU-X). Cross-validated all `.from('table')` calls in src/.
  - `docs/api-registry.yaml` — 266 (path, method) entries scanned from `src/app/api/**/route.ts`. Auth breakdown: teacher 126, student 70, public 33, service-role 12, admin 10, mixed 8, unknown 7. 3 unknown table refs: assessments, on_the_fly_activities, responses.
  - `docs/ai-call-sites.yaml` — 47 LLM call sites via 3-layer detection (20 direct SDK imports, 11 wrapper consumers, 16 HTTP-based). Providers: anthropic 35, voyage 12. FU-5 stop_reason seeded (2 true, 6 false, 39 unknown).
- **3 scanner scripts created** in `scripts/registry/`: `sync-schema-registry.py`, `scan-api-routes.py`, `scan-ai-calls.py`. All support `--apply` flag (dry-run by default) with gate checks.
- **FU-X appended** (P1 — 3 tables unprotected: usage_rollups, system_alerts, library_health_flags).
- **FU-Y appended** (P2 — Groq + Gemini fallbacks never shipped, doc-vs-reality drift).
- **FU-5 expanded** from 13 → 47 call sites, 9 remaining unknown.

**Files created:** `docs/schema-registry.yaml`, `docs/api-registry.yaml`, `docs/ai-call-sites.yaml`, `scripts/registry/sync-schema-registry.py`, `scripts/registry/scan-api-routes.py`, `scripts/registry/scan-ai-calls.py`

**Files modified:** `CLAUDE.md` (Registries section + saveme step 11 + FU-X/FU-Y), `docs/projects/dimensions3-followups.md` (FU-X, FU-Y, FU-5 expansion), `docs/projects/ALL-PROJECTS.md` (Phase 7-Pre status), `docs/changelog.md`, `docs/doc-manifest.yaml`

**Systems affected:** documentation (3 new registries), build-methodology (registry sync baked into saveme), schema-registry (backfilled), api-registry (created), ai-call-sites (created)

**Session context:** Infrastructure sprint before Phase 7 to lock down the "what exists" baseline. Prevents the recurring pattern of discovering spec-vs-reality drift mid-build (e.g., Groq/Gemini listed in Stack but never shipped). All 3 registries now auto-syncable via their scanner scripts during saveme.

---

## 14 Apr 2026 — Phase 6 COMPLETE + Checkpoint 5.1 CLOSED + Architectural Limitations Filing + Cleanup

**What changed:**
- **Phase 6 COMPLETE** (landed in prior conversation, committed but pre-saveme): 6A teacher safety alert feed at `/teacher/safety/alerts` (commit `5e26d55`), 6B critical alert nav badge on teacher layout (commit `fc115d0`), 6C ingestion pipeline upload-level safety scan with `moderation_hold` processing_status (commit `b59752f`). Migration 074 partial index on content_items. Moderation hold UI messaging on both library ingestion pages (commit `c904329`).
- **Checkpoint 5.1 CLOSED at 9/11 (14 Apr 2026):** Step 8 VERIFIED — `content_items.processing_status = 'moderation_hold'` after ingestion safety scan flags content; dedup short-circuit caveat documented (same file_hash skips safety scan — by design). Step 9 PASSED — alert feed returns 19 rows (1 critical + 18 warnings) via RLS-gated query once teacher_id mismatch + NULL class_id bugs were resolved. Steps 6–7 (NSFW.js image moderation) remain deferred — require test image fixtures.
- **Checkpoint 5.1 Step 9 debugging** uncovered two compounding bugs: (1) `class_id = NULL` on all 19 `student_content_moderation_log` rows (source code used `resolvedClassId || ''` fallback passing empty string, RLS silently filtered); (2) after UPDATE to set class_id, test class's `teacher_id` didn't match Matt's gmail auth.uid, RLS still blocked. Resolved by moving rows to Matt's real Grade 7 Design class (`8fe2a1df-...`, owned by gmail uid `0f610a0b-...`) and re-owning the orphaned Grade 8 class (`cb5452be-...`) back to gmail.
- **Nav longest-prefix fix (commit `a1c88f2`):** `pathname.startsWith(item.href)` made both Badges (`/teacher/safety`) and Alerts (`/teacher/safety/alerts`) highlight simultaneously on the Alerts page. Replaced with a longest-prefix match IIFE — only the most specific nav item activates. Also fixes the general case of any parent/child nav overlap.
- **Working-tree cleanup (commit `e5c4d3a`):** deleted stale `next.config.ts.bak`, added `karpathy/` to `.gitignore` (local Karpathy LLM discipline reference, not project content), moved `test-upload-flagged.docx` into `src/__tests__/fixtures/` as a reusable moderation test fixture with a README documenting its role (Checkpoint 5.1 Step 8 / Phase 6C ingestion scan), committed `docs/projects/phase6-instruction-block.md` as a Phase 6 session artifact.
- **Baseline test suite confirmed green:** 1119 passed, 8 skipped (1127 total) — up from 1103 at last saveme (16 new tests from Phase 6 work + today's commits).
- **10 architectural limitations filed as FU-N through FU-W** in dimensions3-followups.md and summarized in ALL-PROJECTS.md:
  - FU-N: NULL class_id silent safety gap (P1 — live safety hole)
  - FU-O: No co-teacher/dept head/admin access model (P1)
  - FU-P: No school/organization entity (P1)
  - FU-Q: Dual student identity class_students vs students.class_id (P2)
  - FU-R: Auth model split teacher Supabase vs student custom tokens (P1)
  - FU-S: Moderation log class-scoped vs ingestion upload-scoped (P2)
  - FU-T: No content ownership transfer (P2)
  - FU-U: Single-tenant URL structure (P3)
  - FU-V: Cross-class student analytics double-counting (P2)
  - FU-W: No immutable audit log (P2)

**Files modified:** `docs/projects/ALL-PROJECTS.md` (Phase 6 follow-ups section added, status line + current-focus paragraph updated to Phase 6 complete + Checkpoint 5.1 closed), `docs/projects/dimensions3-followups.md` (FU-N through FU-W appended, ~230 lines), `docs/doc-manifest.yaml` (followups purpose updated to include FU-N..W summary, last_verified dates updated), `src/app/teacher/layout.tsx` (nav longest-prefix fix), `.gitignore` (karpathy/ excluded)

**Files created:** `src/__tests__/fixtures/test-upload-flagged.docx` (moved from repo root), `src/__tests__/fixtures/README.md` (fixtures dir documentation), `docs/projects/phase6-instruction-block.md` (Phase 6 session artifact)

**Systems affected:** content-safety (Phase 6 shipped, Checkpoint 5.1 closed at 9/11), teacher-dashboard (alert feed + nav badge + longest-prefix highlight fix), ingestion-pipeline (upload-level safety scan verified end-to-end), moderation_logs (silent-filter bug FU-N surfaced), class-membership (FU-O surfaced), rls-policies (FU-O,FU-N surfaced as systemic issues), auth-model (FU-R surfaced as split-lane debt)

**Session context:** Continuation of Phase 6 Teacher Safety Feed build. Phase 6A/6B/6C committed in the lead-up to this saveme. Step 8 passed quickly. Step 9 debugging uncovered the RLS × NULL class_id silent-filter pattern (Lesson #29 instance) AND a teacher-auth mismatch in test data — ultimately resolved by moving the 19 moderation rows to Matt's real Grade 7 class and re-owning the orphaned Grade 8 class to gmail. Wider architectural audit surfaced 10 limitations of the "solo teacher, flat hierarchy, single auth lane" design that will bite when StudioLoom expands to co-taught classes, department deployments, school/MAT tenants, and cross-teacher content sharing. Filed as FU-N through FU-W with design sketches. Sequencing call: FU-N is the only one that needs an immediate hotfix (live safety gap); FU-O+FU-P+FU-R are the "Access Model v2" cluster that gates school-level deployments. Session closed out with nav fix (`a1c88f2`), working-tree cleanup (`e5c4d3a`), and 1119-test green baseline confirmed on Matt's machine — ready to start Phase 7.

---

## 13 Apr 2026 (session 3) — Grading System Overhaul Spec Expansion

**What changed:**
- **Grading spec expanded with 3 new pillars:** (1) Teacher Marking Experience — `/teacher/marking` queue, split-view in-context marking, batch marking flow, criteria coverage heatmap. (2) AI Role in Grading — Haiku pre-scoring with ghost scores, consistency checker, feedback draft generation, class-level insights, integrity-informed grading. All opt-in per class. (3) Student Feedback Experience — notification cards, inline feedback anchored to activities on lesson pages, growth trajectory charts, AI "what to do next" nudges, formative vs summative UI framing.
- **Phases revised:** 5 → 7 phases, estimate 8-12d → 14-18d. New phases: AI-Assisted Grading (Phase 4), Student Feedback Experience (Phase 5). Report Writing → Phase 6, Moderation → Phase 7.
- **10 key decisions added** (up from 5): AI opt-in per class, cross-class marking queue, inline over separate grades page, formative vs summative framing, activity-level anchoring first, AI nudges from teacher feedback, feedback receipt tracking, consistency checker on-demand.
- **ALL-PROJECTS.md updated:** Grading Overhaul added to Planned section with full entry.
- **10 new decisions logged** in decisions-log.md.

**Files modified:** `docs/projects/grading.md`, `docs/projects/ALL-PROJECTS.md`, `docs/projects/dashboard.html`, `docs/projects/WIRING.yaml`, `docs/decisions-log.md`, `docs/doc-manifest.yaml`, `docs/changelog.md`

**Systems affected:** teacher-grading (major spec expansion), student-grade-view (inline feedback design), smart-insights (class-level post-marking insights)

---

## 13 Apr 2026 (session 2) — Checkpoint 5.1 Verification + Bug Fixes + Cost Optimization

**What changed:**
- **Checkpoint 5.1 verification:** 7/11 steps pass. Steps 1-5 verified end-to-end (clean EN/ZH → 'clean', profanity EN/ZH → client block with localized banner, Haiku threat detection → 'flagged'). Steps 10-11 code-verified (failure→pending, NSFW.js fallback). Steps 6-7 deferred (need test images). Steps 8-9 deferred (need Phase 6 Teacher Safety Feed).
- **Bug fix: moderation_status stuck at 'pending'** — `progress/route.ts` had `if (result.moderation.status !== 'clean')` guard that prevented clean results from updating `student_progress`. Removed guard so ALL results write back. Commit `7c73c3a`.
- **Bug fix: missing moderationError banner** — `usePageResponses` returned `moderationError` but student page didn't destructure or render it. Added red banner with localized messages. Commit `532ba47`.
- **Bug fix: NM CompetencyPulse unmoderated** — Reflection text in Melbourne Metrics competency pulse had no client or server moderation. Added `checkClientSide()` before submit + `moderateAndLog()` on `nm-assessment` API route. Commit `80afb61`.
- **Optimization: hash-and-skip** — Autosave fires every ~2s on typing pauses, each triggering Haiku. Added SHA-256 hash comparison — only calls Haiku when content actually changed. Eliminates ~80-90% redundant calls. In-memory cache, resets on server restart (one extra call). Commit `353d366`.
- **FU-6 tracked:** CI lint cleanup added to ALL-PROJECTS.md as P3 follow-up.
- **Framework fix (Supabase):** `UPDATE classes SET framework = 'IB_MYP'` for classes with old `myp_design` / `service_learning` values not in FrameworkAdapter.

**Files modified:** `src/app/api/student/progress/route.ts`, `src/app/(student)/unit/[unitId]/[pageId]/page.tsx`, `src/hooks/usePageResponses.ts`, `src/components/nm/CompetencyPulse.tsx`, `src/app/api/student/nm-assessment/route.ts`

**Systems affected:** content-safety (checkpoint verification, 3 bugs fixed, cost optimization), student-experience (moderation banner visible), nm-assessment (new moderation coverage)

**Session context:** Checkpoint 5.1 verification session. Student-facing testing revealed 3 bugs in Phase 5 wiring that passed code review but failed real-world use. Hash-and-skip added after realizing autosave × Haiku = expensive at classroom scale (30 students × 20-50 saves/textbox/lesson).

---

## 13 Apr 2026 — Dimensions3 Phase 5 Progress: 5A-5D Complete (Content Safety & Moderation), 5E Prep Done

**What changed:**
- **5A (Migration 073):** `student_progress` moderation columns (`moderation_status`, `moderation_flags`, `moderated_at`, `moderation_layer`) + `student_content_moderation_log` table. Shared types with cross-reference tests verifying TypeScript const arrays match SQL CHECK constraints. NC verified. Commit `1e3ba47`.
- **5B (Client text filter):** `checkClientSide()` in `src/lib/content-safety/client-filter.ts`. LDNOOBW blocklists (EN 403 words + ZH 319 words), self-harm supplements (EN 15 + ZH 11), PII regex (email, phone, ID patterns), word-boundary EN matching / substring ZH matching. Log endpoint at `/api/safety/log-client-block`. Defence in depth: client passes through on failure, server catches. 1008 tests. Commit `6584c10`.
- **5C (NSFW.js client image filter):** `checkClientImage()` in `src/lib/content-safety/client-image-filter.ts`. MobileNet v2 via nsfwjs (~4MB WASM), lazy-loaded singleton. Block threshold: `porn + hentai + sexy > 0.6` (configurable via `NEXT_PUBLIC_NSFW_BLOCK_THRESHOLD`). Defence in depth: model load/classify failures → ok:true (passes to server). 11 tests with mocked nsfwjs + browser APIs. NC verified (4 failures on reversed threshold). 1019 tests. Commit `c4200b0`.
- **5D (Server Haiku moderation):** `moderateContent()` in `src/lib/content-safety/server-moderation.ts`. Uses `MODELS.HAIKU` from models.ts, `tool_choice` without `thinking` (API constraint). Bilingual system prompt (EN + ZH-Hans) in `prompts/moderation-system.ts`. `mapFlags()` validates types/severities, maps unknowns to 'other'/'warning'. `deriveStatus()` overrides Haiku's 'overall' field (defence in depth). `pendingResult()` returns status:'pending' on ANY failure — NEVER 'clean'. Lesson #39 applied: stop_reason === 'max_tokens' guard + `parsed.flags ?? []`. 18 tests. NC verified (4 failures). 1037 tests. Commit `87a88d9`.
- **5E Prep (build-phase-prep skill):** Full audit of 8 choke points from WIRING.yaml discovered 4 path errors: GallerySubmitPrompt wrong directory, GalleryFeedbackView wrong component entirely (peer review POST is in GalleryBrowser.tsx), EvidenceCapture wrong directory, ResponseInput not a choke point (renderer that delegates to usePageResponses). Corrected to 7 text + 3 image choke points. Recommended split: 5E-text + 5E-image.
- **WIRING.yaml major corrections:** `wiring_map` rewritten — split into `client_text_choke_points` (7 entries) and `client_image_choke_points` (3 entries) with verified file paths and roles. 4 path errors fixed. ResponseInput removed.
- **Rolldown binding issue (recurring):** `npm install nsfwjs @tensorflow/tfjs` corrupts `@rolldown/binding-linux-arm64-gnu`. Fix: `rm -rf node_modules && npm install`. Recurred 3 times during session.
- **TypeScript fix:** Removed `as const` from `MODERATION_TOOL_SCHEMA` — readonly tuple incompatible with Anthropic SDK mutable `string[]` type.

**Files created:** `src/lib/content-safety/client-image-filter.ts`, `src/lib/content-safety/server-moderation.ts`, `src/lib/content-safety/prompts/moderation-system.ts`, `src/lib/content-safety/__tests__/client-image-filter.test.ts`, `src/lib/content-safety/__tests__/server-moderation.test.ts`

**Systems affected:** `content-safety` (leveled up v1→v2: 3 layers now built — client text, client image, server moderation). WIRING.yaml `wiring_map` corrected (4 path fixes, structural split). `wiring-dashboard.html` and `system-architecture-map.html` synced.

**Test suite:** 948 → 1037 (+89 new across 5A-5D, 0 failures)

**Session context:** Continuation from Phase 4 completion session. Followed build methodology throughout — build-phase-prep skill run before 5D and 5E, pre-flight audits caught wiring path errors before they reached instruction blocks. Key finding: WIRING.yaml wiring_map had 4 incorrect paths that would have caused 5E instruction block to reference non-existent files. Defence-in-depth pattern consistent across all layers: client failures pass through, server failures go to 'pending', never 'clean'.

---

## 12 Apr 2026 — Dimensions3 Phase 4 Complete (Library Health & Operational Automation, Checkpoint 4.1 PASSED)

**What changed:**
- **Edit tracker wiring (§5.5 gap fix from prior session):** `trackEdits()` now called fire-and-forget from the content save route (`src/app/api/teacher/units/[unitId]/content/route.ts`). Snapshots `previousContent` before overwrite, feeds edit-tracker job. Commit `445b1a9`.
- **Migration 072:** 3 new tables (`system_alerts`, `library_health_flags`, `usage_rollups`), 4 new columns on `activity_blocks` (`last_used_at`, `archived_at`, `embedding_generated_at`, `decay_applied_total`), `find_duplicate_blocks()` RPC function using pgvector cosine similarity on halfvec embeddings. Commit `c8b6711`.
- **Library health queries:** 8 typed query functions (`getBlocksBySourceType`, `getCategoryDistribution`, `getStaleBlocks`, `getDuplicateSuspects`, `getLowEfficacyBlocks`, `getOrphanBlocks`, `getEmbeddingHealth`, `getCoverageHeatmap`) with 7 TypeScript interfaces. 19 tests. Commit `10c46d8`.
- **7 ops automation jobs:** Pipeline health monitor, cost alert, quality drift detector, teacher edit tracker, stale data watchdog, smoke tests (6 wiring checks), usage analytics. All write to `system_alerts`. All runnable via `npx tsx -r dotenv/config scripts/ops/run-*.ts dotenv_config_path=.env.local`. 7 tests. Commit `3d413a7`.
- **2 library hygiene jobs:** Weekly (staleness decay capped at -6, duplicate flagging via RPC, low-efficacy flagging, stale embedding detection). Monthly (consolidation proposals >0.95 cosine, orphan archival — never deletes). CLI runner: `npx tsx scripts/run-hygiene.ts <weekly|monthly>`. 8 tests. Commit `aea737a`.
- **Library Health dashboard** (`/admin/library/health`): 8 widgets (source type bars, category distribution, stale blocks table, duplicate suspect pairs, low efficacy table, orphan blocks, embedding health gauge, coverage heatmap). API route at `/api/admin/library/health`. Commit `18a7776`.
- **Pipeline Health dashboard** (`/admin/pipeline/health`): KPI cards (success rate, avg timing, total cost, total runs), stage failure heatmap, cost alert strip, error log, quality drift indicator, recent alerts list. API route at `/api/admin/pipeline/health`. Commit `d4f5e66`.
- **Cost alert email delivery:** `sendCostAlert()` via direct `fetch()` to Resend API (no npm package — Lesson #44). 6-hour debounce via `system_alerts` check. Console.log fallback when `RESEND_API_KEY` not set. 9 tests. Commit `5d6ddfb`.
- **Admin nav update:** Pipeline Health and Library Health tabs added to admin layout. `isActive()` fixed for sub-route matching. Commit `c18c766`.
- **Ops runbook + phase brief:** Full runbook at `docs/projects/dimensions3-ops-runbook.md`. Phase brief at `docs/projects/dimensions3-phase4-brief.md`. Commit `eccce92`.
- **FU-M filed:** Live cost alert email test deferred — requires Resend account setup.

**Verification (Checkpoint 4.1):**
- All 7 ops scripts ran successfully with real data:
  - pipeline-health: 100% success rate, 1 run
  - cost-alert: $0 costs, no thresholds exceeded, debounce working
  - quality-drift: insufficient data (expected with 1 run)
  - edit-tracker: 15 total edits (7 kept, 5 rewritten, 3 deleted)
  - stale-watchdog: 55 stale blocks (expected — `last_used_at` is new column, all NULL)
  - smoke-tests: 6/6 passed
  - usage-analytics: 1 active teacher, 55 blocks, 2 rollups written
- Both dashboards reflect `system_alerts` data correctly
- Email delivery deferred to FU-M (console fallback verified)

**Systems affected:** `generation-pipeline` (edit tracker wired), `admin-dashboard` (leveled up v1→v2, 2 new dashboard pages), `ops-automation` (NEW system — 7 jobs + 2 hygiene + cost alert delivery), `activity_blocks` (4 new columns). WIRING.yaml synced with new `ops-automation` system entry.

**Test suite:** 905 → 948 (+43 new, 0 failures)

**Session context:** Continuation from compacted session where Phase 3R was completed. Edit tracker wiring gap (§5.5) fixed first, then all of Phase 4 built end-to-end. Pre-flight audit discovered `total_cost` is JSONB (not float) and `activity_blocks` missing 4 columns — informed migration design. Build methodology held throughout. Key design decision: Resend via direct `fetch()` instead of npm package (Lesson #44: simplicity first).

---

## 12 Apr 2026 — Dimensions3 Phase 3R Complete (Feedback Loop Remediation, Checkpoints 3.1 + 3.2 PASSED)

**What changed:**
- **Phase 3 Gap Audit:** Honest audit of rushed Phase 3 work identified 10 gaps. Full remediation brief written with pre-flight, stop triggers, checkpoints, per the build methodology that was violated in the initial rush.
- **R1 (signals.ts rewrite):** `getStudentSignals()` now queries real `student_progress` rows via indirect join (`source_unit_id + source_page_id`), replacing dead pre-aggregated columns on `activity_blocks` that were always NULL/0. 3 new tests with NC verification. Page-level granularity documented as acceptable approximation.
- **R2 (CLI script rewrite):** Deleted `run-efficacy-update.mjs` (180 lines, duplicated formula). Created `run-efficacy-update.ts` (88 lines) importing directly from library — single source of truth, zero formula duplication.
- **R3 (ProposalReasoning narrative):** Added `buildNarrative()` to ProposalReasoning.tsx — human-readable explanations alongside bar charts ("5 teacher interactions (80% kept), 3 student uses (33% completion)").
- **R4 (Naming divergence):** Documented spec-vs-code naming differences in types.ts header (requires_matt → requiresManualApproval, accept → approved). Decision: keep code names (scale to multi-admin).
- **R5 (Cascade delete verification):** Migration 070 CASCADE DELETE confirmed working on prod — 0 orphaned proposals/audit rows after block deletion.
- **Backend changes from earlier in session:** Removed auto-approve (spec §5.4), added 7-day rejection suppression, added reasoning JSONB column (migration 071), added audit-log API endpoint.
- **Checkpoint 3.1:** CLI dry-run produced 3 proposals with correct directional ordering (kept 61.3 > deleted 44.3 > rewritten 40.3). completionRate 0.33 confirmed real student_progress join working.
- **Checkpoint 3.2:** Full end-to-end cycle verified: CLI → proposals in DB with reasoning JSONB → UI rendering with narrative + diff → approve (score updated 65→40.3) + reject → audit log entries created.

**Systems affected:** `feedback-system` (signals.ts, efficacy.ts, types.ts, 8 UI components, CLI script, audit-log API), `activity_blocks` (efficacy_score updated via approval). WIRING.yaml synced with 11 new key_files.

**Push status:** 5 commits on main pushed to origin (R3+R4 commit + R1 commit + R2 commit + 2 pre-existing). Migrations 070 + 071 applied to prod.

**Session context:** Continuation from compacted session. Phase 3 initially rushed without methodology — Matt caught it. Full remediation process: re-read build-methodology.md + lessons-learned.md, wrote remediation brief with pre-flight/stop triggers, executed properly with Code agent for R1+R2. Methodology held for remediation. Test suite: 902 → 905 (+3 signal tests).

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

---

### 13 April 2026 — Dimensions3 Phase 5 Start (Content Safety & Moderation)

**What changed:**
- Phase 4 Checkpoint 4.1 formally passed. FU-M filed for deferred Resend email test.
- CI fix: created `tsconfig.check.json` excluding test/script files from CI typecheck, fixed 54 source-level TS strict-mode errors (null guards, type casts — no logic changes), bumped Node 20→22. Commits `968cb86` + `c7b4ce7`.
- Phase 5A COMPLETE: migration 073 (`student_content_moderation_log` table + `student_progress` moderation columns), shared types in `src/lib/content-safety/types.ts`, 32 new tests including cross-reference (types vs CHECK constraints) + NC verification. Commit `1e3ba47`.
- Phase 5B COMPLETE (via Claude Code): client-side text filter (`src/lib/content-safety/client-filter.ts`), LDNOOBW blocklists vendored (EN+ZH), self-harm supplement lists, PII regex (phone EN/CN + email), word-boundary matching for EN, log endpoint at `/api/safety/log-client-block`. Tests pending final count from Code report.
- Created `build-phase-prep` skill at `.claude/skills/build-phase-prep/SKILL.md` — automates the 4 non-negotiable prep steps (test baseline, read spec, read lessons, audit code) plus new Step 5b (full wiring trace with choke point identification).
- Content-safety system added to WIRING.yaml with `wiring_map.client_choke_points` — 8 specific files where `checkClientSide()` needs to be called in Phase 5E. This was a gap: previous audits found 26 API endpoints but didn't trace upstream to the React components/hooks that are the actual wiring targets.
- Full saveme sync: ALL-PROJECTS.md, dashboard.html, wiring-dashboard.html, system-architecture-map.html, WIRING.yaml (94 systems), doc-manifest.yaml, CLAUDE.md, changelog.md.

**Files created:**
- `.claude/skills/build-phase-prep/SKILL.md`
- `tsconfig.check.json`
- `supabase/migrations/073_content_safety.sql` (via Code)
- `src/lib/content-safety/types.ts` (via Code)
- `src/lib/content-safety/__tests__/types.test.ts` (via Code)
- `src/lib/content-safety/__tests__/migration-073.test.ts` (via Code)
- `src/lib/content-safety/client-filter.ts` (via Code)
- `src/lib/content-safety/blocklists/` (via Code)
- `src/app/api/safety/log-client-block/route.ts` (via Code)

**Test counts:** 948 → 980 (after 5A, +32). 5B count pending Code report.

**Systems affected:** `content-safety` (new), `student-experience` (downstream), `admin-dashboard` (wiring-dashboard updated), WIRING.yaml meta (93→94 systems, 12→13 active).

---

### 13 April 2026 — Dimensions3 Phase 5 COMPLETE (5C–5F, Vercel Fix, saveme)

**What changed:**
- Phase 5C COMPLETE (via Code): NSFW.js client image filter — `client-image-filter.ts` with lazy-loaded MobileNet v2, 0.6 combined threshold (porn+hentai+sexy), `fileToImage()` helper, defence-in-depth (model failure → pass to server).
- Phase 5D COMPLETE (via Code): Server Haiku moderation — `server-moderation.ts` with `moderateContent()` for text+images, bilingual prompt (EN+ZH), tool_choice structured output, `deriveStatus()` override logic, all failures→pending.
- Phase 5E COMPLETE (via Code): Client-side wiring — `checkClientSide()` wired into 7 text choke points (usePageResponses, useToolSession, DesignAssistantWidget, GallerySubmitPrompt, GalleryBrowser, EvidenceCapture, useOpenStudio) + `checkClientImage()` into 3 image upload points (UploadInput, QuickCaptureFAB, EvidenceCapture). 1037→1037 tests (wiring, no new tests).
- Phase 5F COMPLETE (via Code, two sub-phases):
  - 5F-a: Created `moderate-and-log.ts` shared wrapper (moderateContent → log non-clean → return allow/deny). Wired into 6 endpoints: progress (fire-and-forget + student_progress columns), tool-sessions POST/PATCH (fire-and-forget), gallery/submit (sync gate), gallery/review (sync gate), upload (sync image gate with Buffer pattern). 1094 tests (+14 from 5F-a NC).
  - 5F-b: Wired remaining 9 endpoints: design-assistant (fire-and-forget), avatar (fire-and-forget image), quest/sharing POST (sync gate), open-studio/session POST+PATCH (fire-and-forget), portfolio (fire-and-forget), quest/evidence (fire-and-forget), quest/milestones (fire-and-forget), quest/contract (fire-and-forget), planning POST+PATCH (fire-and-forget). 1103 tests (+9 from 5F-b NC).
- **Vercel build fix**: nsfwjs ESM entry statically imports model shard files with non-standard `require()`. webpack minifier crashed with `_webpack.WebpackError is not a constructor` (meta-error masking real problem). Fix: `config.module.noParse = /nsfwjs\/dist\/models/;` in next.config.ts. Also pinned next@15.3.9 (CVE fix), @sentry/nextjs@10.43.0. Vercel deploy GREEN.
- Full saveme sync: ALL-PROJECTS.md, dashboard.html, CLAUDE.md (Next.js version 15.3.3→15.3.9), WIRING.yaml (content-safety summary + key_files + future_needs), wiring-dashboard.html, system-architecture-map.html (content-safety v2→v3), doc-manifest.yaml, changelog.md.

**Files created (via Code):**
- `src/lib/content-safety/client-image-filter.ts` (5C)
- `src/lib/content-safety/server-moderation.ts` (5D)
- `src/lib/content-safety/moderate-and-log.ts` (5F-a)
- Associated test files for each

**Files modified (via Code):**
- 15 API route files wired with moderation (5F-a + 5F-b)
- 7 hooks/components wired with client text filter (5E)
- 3 upload components wired with client image filter (5E)
- `next.config.ts` — noParse for nsfwjs, pinned versions
- `package.json` — next@15.3.9, @sentry/nextjs@10.43.0

**Test counts:** 1037 → 1103 (+66 across 5C–5F).

**Systems affected:** `content-safety` (v2→v3, all sub-phases complete), `student-experience` (all submission endpoints now moderated), build config (next.config.ts noParse + version pins).

---

### 22 April 2026 — Preflight scanner thumbnail_path column-writeback fix (Lesson #53)

**What changed:**
- **Bug identified via smoke test:** Checkpoint 3.1 verification showed `thumbnail_path: null` and `thumbnail_rendered: false` even though the scan completed with `status: done`, `attempt_count: 1`, no error. Diagnostic queries confirmed the thumbnail PNG was in storage (5 objects in `fabrication-thumbnails` bucket) and the path existed inside `scan_results->>'thumbnail_path'` JSONB — the denormalised `thumbnail_path` column on `fabrication_job_revisions` was never written. Affected every Phase 2A (STL) and Phase 2B-6 (SVG) scan.
- **Root cause:** `fab-scanner/src/worker/supabase_real.py:write_scan_results()` writes to three tables but the `fabrication_job_revisions` UPDATE only set `scan_results`, `scan_status`, `scan_error`, `scan_completed_at`, `scan_ruleset_version` — never `thumbnail_path`. The Python `ScanResults` dataclass carries the field and `model_dump()` lands it inside the JSONB; the code assumed that was enough, but UI reads the column directly. Pattern bug affecting both STL and SVG paths.
- **Fix:** 8-line change — added `"thumbnail_path": scan_results.get("thumbnail_path")` to the revisions update dict. `.get()` returns None on missing key so scan errors (no thumbnail attempted) still write cleanly.
- **Tests:** new `fab-scanner/tests/test_supabase_real.py` with 3 cases — (a) thumbnail present in JSONB → column gets the value, (b) thumbnail absent → column is None (not KeyError), (c) all three tables get an update in stable order. First unit-test coverage for the real `SupabaseServiceClient`; prior tests only exercised `MockSupabase` via conftest.py, which is why the missing column write was invisible to CI.
- **Deploy:** Fly app `preflight-scanner` redeployed (image `deployment-01KPS282RPKV0BAYAYJN84KKWK`, 208 MB), both machines healthy after rolling update.
- **E2E verification:** Fresh smoke-test SVG scan (`coaster-orange-unmapped.svg`) wrote `thumbnail_path: f3af1426-b10e-4aea-802c-00c6bbb15b87.png` through to the column. Checkpoint 3.1 2B-7 verification can now close.
- **Backfill:** `UPDATE fabrication_job_revisions SET thumbnail_path = scan_results->>'thumbnail_path' WHERE thumbnail_path IS NULL AND scan_results->>'thumbnail_path' IS NOT NULL` returned 11 rows — all orphaned scans from 21 Apr now have column populated. All storage objects still within 30-day retention window so no dead references.
- **Lesson #53 added** to `docs/lessons-learned.md` — "Denormalised columns need explicit writes; stuffing the whole payload in JSONB doesn't fan them out". Captures the JSONB-vs-column drift pattern + the rule that mock-based tests can't validate DB adapter surface.
- **WIRING.yaml preflight-scanner entry updated:** summary rewritten (116 → 245 pytest tests, STL-only → combined `stl-v1.0.0+svg-v1.0.0` ruleset, cairosvg thumbnail rendering), `external_deps` updated (cairo → cairosvg + cairocffi + pillow).

**Files modified:**
- `fab-scanner/src/worker/supabase_real.py` — +7/-1
- `fab-scanner/tests/test_supabase_real.py` — NEW (+126 lines)
- `docs/lessons-learned.md` — Lesson #53 appended
- `docs/projects/WIRING.yaml` — preflight-scanner entry refreshed
- `CLAUDE.md` — status + What's next refreshed
- `docs/projects/ALL-PROJECTS.md` — header "Last updated" block rewritten
- `/Users/matt/CWORK/CLAUDE.md` (master index) — status block rewritten
- `docs/changelog.md` — this entry
- `docs/doc-manifest.yaml` — last_verified bumped for touched docs

**Test counts:** 242 → 245 pytest (+3 new regression tests in `test_supabase_real.py`). `npm test` baseline 1409 untouched (no TS sources changed).

**Commits:** 1 new local commit on `main` (`345cd51`). WIP backup branch `preflight-thumbnail-column-wip` created at same sha. **Pending-push count: 9 → 10.** Hold for Matt's sign-off before pushing per push-discipline memory.

**Systems affected:** `preflight-scanner` (v1 — writeback column correctness fix; now truly end-to-end correct on both STL and SVG paths).

**Session context:** Continued from previous day's Checkpoint 3.1 verification work where the NULL `thumbnail_path` was first observed. Root-caused inside the Python adapter, fixed, tested, deployed, verified, backfilled, documented, and filed as Lesson #53 — all in one session on main. Changelog drift note: entries between 13 Apr and today (22 Apr) are missing — Dimensions3 Phases 7+ and Preflight Phases 1A/1B-1/1B-2/2A/2B-1..6 all shipped in that window without changelog appends. Out of scope to backfill now; project state is captured in ALL-PROJECTS.md + WIRING.yaml + CLAUDE.md master header instead.

---

### 25 April 2026 — Access Model v2 project plan drafted (planning session, no code)

**What changed:**
- New project plan written: `docs/projects/access-model-v2.md` (~430 lines, 11 sections, 6 phases). Architecture spec for unifying StudioLoom's three parallel auth systems (student token + Supabase teacher Auth + Fabricator Argon2id), introducing schools as a first-class entity, audit log, per-student AI budgets, FERPA/GDPR/PIPL data export+delete, and OAuth (Google + Microsoft + email/PW; Apple deferred behind feature flag).
- **8 architecture decisions locked** during the planning session: (1) every student is an `auth.users` row from day one — classcode+name becomes a custom Supabase auth flow rather than a parallel system; (2) flat school membership with no designated admin — any teacher edits school settings under a two-tier rule (low-stakes instant + 7-day revert; high-stakes need 2nd-teacher confirm in 48h); (3) immutable append-only audit_events; (4) `region` column on schools as forward-prep for residency splits; (5) `unit_version_id` on submission-shaped tables for assessment integrity; (6) per-student AI budget (default 100k tokens/day) enforced at route layer; (7) class-level roles via `class_members`, flat at school level — Matt's super-admin sits on a separate `is_platform_admin` flag on `auth.users`; (8) bootstrap grace window of 7 days for single-teacher schools.
- **5 forward-compat schema seams** added to Phase 0 (schema only, no UX): `school_resources` polymorphic table + relations (first consumer = PYP/Service "people, places, things" library); `guardians` + `student_guardians`; SIS columns (`external_id`/`sis_source`/`last_synced_at`) on students+teachers+classes; `consents` table for FERPA/GDPR/PIPL; `schools.status` lifecycle enum.
- **External community member auth (§8.7)** added as future appendix — `community_member` user_type extensibility, invite-only magic-link, time-bounded class-scoped access. First concrete consumer: Mentor Manager for PYP coordinators / G5 teachers / Service Learning leads (annual mentor recruitment + matching workflow).
- **ALL-PROJECTS.md updates:** added "Access Model v2" entry in Planned section; added "Mentor Manager (PYP / G5 / Service Learning)" entry in Ideas Backlog → High Priority Ideas (4-6d, gated on Access Model v2 shipping); marked "Auth / ServiceContext Seam" as superseded by Access Model v2; reconciled Governance GOV-2 entry — components (1) audit log + (2) Access Model v2 + (4) DSR runbook are now subsumed by Access Model v2, GOV-2 reduces to just (3) impersonation/support-view (~1-2d).
- **Governance + scope reconciliation:** Access Model v2 closes FU-O (no co-teacher/dept-head/admin) + FU-P (no school/org entity) + FU-R (auth model split) + FU-Q (dual student identity) + FU-W (no audit log) — five backlog items collapsed into one project. Unblocks `PH6-FU-MULTI-LAB-SCOPING` (Phase 6 Preflight follow-up). Provides the missing `access-model-v2-spec.md` referenced by GOV-2.
- **Phase 0 trigger:** Preflight Phase 8 ships + merges to main, dashboard-v2 polish quiescent. Estimated wait ~1–2 weeks. Worktree (when work begins): `/Users/matt/CWORK/questerra-access-v2` on branch `access-model-v2`. Do not run parallel with Preflight or dashboard-v2 — surface area too large.

**Files created:**
- `docs/projects/access-model-v2.md` (~430 lines) — full project plan with §1 Why Now, §2 Architecture Decisions (7), §3 Scope (28 in-scope items + 9 explicitly deferred), §4 Phase Plan (6 phases, named Matt Checkpoints), §5 Migration Strategy, §6 Risks, §7 Resolved Decisions (8), §8 School Settings & Governance (8.1 inventory, 8.2 4-layer dedup, 8.3 governance model, 8.4 platform super-admin view, 8.5 migration of existing settings, 8.6 forward-compat seams, 8.7 external community member appendix), §9 Impact on Existing Systems (per WIRING.yaml), §10 Pre-Build Checklist, §11 References.

**Files modified:**
- `docs/projects/ALL-PROJECTS.md` — Access Model v2 project entry added; Mentor Manager idea added; Auth / ServiceContext Seam marked superseded; Governance GOV-2 reconciled.
- `docs/doc-manifest.yaml` — new entry for `access-model-v2.md`; bumped `last_verified` on `ALL-PROJECTS.md`.
- `docs/changelog.md` — this entry.

**Test counts:** unchanged (no code changes). `npm test` baseline 1854 untouched. pytest 245 untouched.

**Systems affected:** *None shipped.* Plan documents future work on `auth-system`, `class-management`, `student-progress`, `fabrication-pipeline`, `nm-assessment`, `student-content-moderation-log`, `ingestion-pipeline`, `school-calendar` and four new planned systems (`school-governance`, `school-registration`, `school-library`, `platform-admin-console`). No WIRING.yaml updates this session — planned tables/systems do not enter registries until they're built.

**Registry sync results (saveme step 11):**
- `api-registry.yaml` — drift from prior sessions captured (+182 lines, not from this session). Reviewed and committed.
- `ai-call-sites.yaml` — drift from prior sessions captured (no diff this session). No-op.
- `feature-flags.yaml` — `SENTRY_AUTH_TOKEN` orphan persists (FU-CC, P3 known).
- `vendors.yaml` — status: ok, no drift.
- `rls-coverage.json` — 7 tables with `rls_enabled_no_policy` (FU-FF, P3 known — `ai_model_config`, `ai_model_config_history`, `fabrication_scan_jobs`, `fabricator_sessions`, `student_sessions`, `teacher_access_requests`).

**Session context:** 8-turn planning conversation initiated by Matt asking about adding OAuth (Google/Microsoft/Apple + email+PW) for students in regions outside China while preserving the classcode+name path for Chinese students (PIPL constraint). Conversation widened to "what else should we lock in now while there are zero students" and produced a world-class spec for the broader access model rather than just OAuth. Matt explicitly approved the elegant unified-auth approach over the simpler dual-auth shortcut: *"id rather do the more elegant approach that is better long term. make this world class. there still aren't any students using it."* Matt also locked in the flat-school-governance model (no designated admin, two-tier change rules) over the conventional school_admin role — *"have teachers be able to edit for all teachers for school-wide settings rather than have a single person who is designated admin of school (who would manage that?) or avoid having another separate school login"*. No code touched. Trigger to begin Phase 0 work: Preflight Phase 8 ships + dashboard-v2 polish quiescent.

---

### 24–26 April 2026 — Lesson Bold Sub-Phases 1–3 SHIPPED on branch + language-scaffolding-redesign spec written

**Branch context:** All work on worktree `/Users/matt/CWORK/questerra-lesson-bold`, branch `lesson-bold-build` (new branch off main `6870eac`). Branch pushed to origin. `main` untouched.

**What changed:**

- **Sub-Phase 1: warm-paper Bold token scope + 3 stub components (24 Apr).** Extended `.sl-v2` scoped CSS in `BoldTopNav.tsx` with a nested `.lesson-bold` block carrying warm-paper tokens. Added `src/app/(student)/unit/[unitId]/template.tsx` (server component) loading Manrope + DM Sans + Instrument Serif via `next/font/google` — fixes pre-existing gap where lesson pages silently fell back to system-ui. Stub components `PhaseStrip`, `KeyConcept`, `AutonomyPicker`. Tests 1939 → 1943 (+4).
- **Sub-Phase 2A: LessonHeader + LessonIntro + VideoBlock (24 Apr).** Extracted hero header + learning-goal block + intro media. `pageContent.learningGoal` becomes the italic-serif "Why this matters" line. `pageContent.success_criteria` becomes the 3-up numbered LO strip. Wiring-lock test in `render-path-fixtures.test.ts` rewritten (chip rendering moved into LessonHeader). Tests 1943 → 1944.
- **Sub-Phase 2B: LessonFooter + LessonToolsRail (24 Apr).** Replaced legacy full-bleed Complete & Continue block + 4 floating FAB buttons. Modal panels + QuickCaptureFAB + MobileBottomNav + StudentFeedbackPulse preserved verbatim.
- **Sub-Phase 2C: LessonSidebar warm-paper restyle (24 Apr).** Token-only refactor — sidebar `<aside>` got `lesson-bold` class so warm-paper tokens activate locally.
- **Sub-Phase 3: AutonomyPicker + migration 121 + ActivityCard hint/example gating (24 Apr).** Migration 121 added `student_progress.autonomy_level TEXT CHECK IN ('scaffolded','balanced','independent')` — no DEFAULT, no NOT NULL, no backfill (Lesson #38). 5 helpers gating hints + examples. Lesson #17 retry-without-column on both upsert paths. Tests 1944 → 1952 (+8). NC: flipped `hintsAvailable` to always-true, confirmed test failed at expected line, reverted via Edit (Lesson #41). Migration 121 applied to local dev only — scheduled for rollback in language-scaffolding-redesign Phase 0 (migration 122 DROP COLUMN).
- **5 mockup iterations on the StudioSetup drawer (24–26 Apr).** `docs/newlook/StudioSetupDrawer-mockup.html` v1 → v5. The drawer concept ultimately died in the language-scaffolding-redesign pivot (configuration → invocation).
- **Cowork research session against ~10 platforms (Newsela, Duolingo, Immersive Reader, Read&Write, Lexia, Read Along, Khan, Seesaw, CommonLit, Medley) (26 Apr).** Established the configuration→invocation pattern. Closest reference: Medley Learning's Response Starters panel.
- **Language scaffolding redesign pre-build spec written (26 Apr).** `docs/projects/language-scaffolding-redesign-brief.md` — 594-line spec covering audit findings (caught WIRING `student-learning-support` doc-vs-reality drift on translation / dyslexia / UDL / ADHD focus claims with no code), proposed architecture (Tap-a-word + Response Starters), 6-phase build plan, Q1–Q6 with proposed defaults, cost analysis ($0.0007/student/week, ~$0.25 per 30-student 12-week pilot), migration notes. Matt locked 7 decisions in §0.5: pivot (Q1=a), WIRING fix mid-build (Q2=i), single L1 (Q3), taps_per_100_words fade trigger (Q4), full Phase 1 mount surface, image source Wikimedia + Open Symbols, sandbox threaded from day 1.

**Files created:**
- `src/app/(student)/unit/[unitId]/template.tsx`
- `src/components/student/lesson-bold/{PhaseStrip,KeyConcept,AutonomyPicker,LessonHeader,LessonIntro,VideoBlock,LessonFooter,LessonToolsRail,helpers,index}.tsx`
- `src/components/student/lesson-bold/__tests__/shell.test.tsx`
- `supabase/migrations/121_student_progress_autonomy_level.sql` — applied dev only, scheduled for rollback
- `docs/newlook/StudioSetupDrawer-mockup.html` — 5 historical iterations
- `docs/projects/lesson-bold-brief.md` — Lesson Bold master brief
- `docs/projects/language-scaffolding-redesign-brief.md` — pre-build spec for the next build

**Files modified:**
- `src/components/student/BoldTopNav.tsx` — appended `.sl-v2 .lesson-bold` block
- `src/components/student/LessonSidebar.tsx` — token-only restyle
- `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` — 661 → 565 lines
- `src/components/student/ActivityCard.tsx` — `autonomyLevel` prop + warm-paper hint/example UI
- `src/hooks/usePageResponses.ts` — exposes `autonomyLevel` + setter
- `src/app/api/student/progress/route.ts` — accepts `autonomyLevel` + retry-without-column
- `src/types/index.ts` — `StudentProgress.autonomy_level?` union
- `src/lib/frameworks/__tests__/render-path-fixtures.test.ts` — wiring-lock rewrite

**Test counts:** 1939 → **1952 passed · 8 skipped · 1960 total · 127 files**.

**Commits (all pushed to `origin/lesson-bold-build`):** `e77a313` · `ba8594c` · `537fbdd` · `dbde598` · `6e64ad3` · `ba87542` · `7aa3421` · `a721dcf` · `fb7085d` · `31847bf` · `8e28195` · `6de8a1f` · `c8a194d` · `a8c0907`.

**Systems affected:** `lesson-view` (v1 → v1.5, warm-paper Bold restyle on branch), `student-learning-support` (planned doc-vs-reality drift fix in Phase 0 of redesign), new tracked work `language-scaffolding-redesign`. AutonomyPicker flagged for rollback next session.

**Follow-ups filed:**
- `FU-LS-DRIFT` — WIRING `student-learning-support` entry was claiming complete features that didn't exist (translation, dyslexia fonts, UDL, ADHD focus). Update entry to `status: planned` + `currentVersion: 0` in Phase 0 of language-scaffolding-redesign.

**Session context:** Hybrid build session — Sub-Phases 1–3 of Lesson Bold shipped methodically against a brief written at session start; mid-session pivot triggered by Matt observing that AutonomyPicker felt off; Cowork research session led to invocation-over-configuration thesis; spec for the redesign written + signed off; AutonomyPicker scheduled for rollback. Branch `lesson-bold-build` is push-clean but not yet merged to main — merge happens after language-scaffolding-redesign Phase 0 (rollback) lands cleanly. **Migration 121 in dev only — DROP via migration 122 will land in same Phase 0.** Pending-push count to main: 0 (work is on feature branch).

---

### 26 April 2026 — Session close: lesson-bold-build merged to main + Phase 0 closed + saveme

**What changed:**
- Merged `lesson-bold-build` → `main` (`3c1d626`) bringing 18 commits live: warm-paper Bold restyle (Sub-Phases 1, 2A–2C) + language-scaffolding-redesign Phase 0 (AutonomyPicker rollback, ELL-only ActivityCard gating restored, FU-LS-DRIFT filed, WIRING `student-learning-support` flipped to `status: planned`).
- Migration collisions dodged twice mid-merge: branch's 116/117 collided with Phase 8's school_id_reserved 116/117 + Preflight 8.1d-13/14's 118/119. Final renumber to **121** (ADD `student_progress.autonomy_level`) + **122** (DROP), with 120 left as gap. Migration 122 applied to prod by Matt (no-op since 121 was dev-only — symbolic only). Push-discipline obligation cleared.
- 2 follow-up commits on main: `886c7f7` (renumber fixup) + 2 origin merges absorbing parallel Preflight 8.1d-13/14 work landed during the merge sequence.
- Cleanup: `lesson-bold-build` branch deleted (local + remote). Worktree registration removed. Directory survives at `/Users/matt/CWORK/questerra-lesson-bold/` (~675MB, optional `rm -rf`).
- Significant parallel work landed on main during/after this session: Preflight Phase 8.1d-15..19 (queue filter/sort/bulk-approve, fab queue lifecycle timeline, scanner copy + filename collision fixes), dashboard PYPX Phase 13a-1..4 (exhibition setup CTA, mentor cadence free-text), skills-library Path A (AI assist for skill card authoring), build-discipline v2 (sessionhandover ritual + migration timestamp prefixes). All auto-merged cleanly.

**Saveme sync results (steps 11):**
- `api-registry.yaml` — drift captured: +100 lines (new Phase 8.1d + Path 13a + skills routes from parallel sessions). Committed.
- `ai-call-sites.yaml` — drift captured: +62 lines (new AI calls from skills-library + others). Committed.
- `feature-flags.json` — status: `drift`, 1 orphan = `SENTRY_AUTH_TOKEN` (FU-CC, P3 known build-time-only).
- `vendors.json` — status: `ok`, no drift.
- `rls-coverage.json` — status: `drift_detected`, 7 tables `rls_enabled_no_policy` (FU-FF, P3 known undocumented deny-all pattern). No new tables.
- `schema-registry.yaml` — no edit needed: migrations 121/122 cancel out (column added + dropped before prod ever saw it).

**Files modified:**
- `docs/api-registry.yaml` — +100 lines via scanner
- `docs/ai-call-sites.yaml` — +62 lines via scanner
- `docs/scanner-reports/{feature-flags,rls-coverage,vendors}.json` — drift JSON refreshed
- `docs/changelog.md` — this entry
- `docs/handoff/main.md` — refreshed via step 12

**Test counts:** 2144 passed · 8 skipped · 2152 total · 136 files at last full run (pre-parallel-work). Not re-run after origin/main merges; assume current main is green based on the merge-only nature of incoming commits.

**Pending-push count:** 0 → will be 1 after this saveme commit lands.

**Systems affected:** `lesson-view` (v1 → v1.5 warm-paper restyle SHIPPED), `student-learning-support` (status flipped complete→planned, redesign tracked at `language-scaffolding-redesign-brief.md`). All other systems untouched by this session.

**Trigger for next session:** `go phase 1` or `tap-a-word` — Phase 1 of language-scaffolding-redesign (Tap-a-word v1, definition only, 8 mount surfaces). Spec: `docs/projects/language-scaffolding-redesign-brief.md` §3 Phase 1.

## 26 Apr 2026 PM — Teacher Dashboard Phase 13a-5 + 13b first cut: PYPX cohort dashboard live

**What changed:**
- **Phase 13a polish landed (`56d9359`, `8122ffd`, `10ef1f4`):** mentor check-in cadence dropped from Exhibition setup (per-mentor not per-class — moved to Mentor Manager scope); phase column dropped from student-projects inline editor (output not input); system accounts (`@studioloom.internal`) filtered from mentor picker.
- **Phase 13a-5 SHIPPED (`af4b0a5`):** student projects inline editor at `/teacher/classes/[classId]/exhibition`. ~370-line `StudentProjectsCard` with one row per enrolled student (title · central idea · theme · mentor), auto-save 600ms debounced per row, server-authoritative merge so id flips null→uuid + updated_at land. New endpoint `/api/teacher/teachers/list` seeds the mentor picker (same-school teachers, system accounts filtered).
- **Phase 13b-1 SHIPPED (`05e9c2a`):** new endpoint `/api/teacher/pypx-cohort?classId=X&unitId=Y` returns single payload (cohort metrics + per-student card data). 409 lines. Joins class_units + class_students + students + student_projects + teachers + student_progress.
- **Phase 13b-2 + 13b-3a SHIPPED (`28fc709`):** PypxView rebuilt to consume the cohort API. Hero with class badge, "Exhibition in N days." countdown, COHORT AVG / NEED ATTENTION / AHEAD metrics top-right, 5-segment phase distribution bar at the bottom. Student card grid below with avatar (deterministic colour from id hash) + project title + phase pill + per-student progress bar + mentor pill or red "Unassigned" + status pill (coral ring around needs-attention cards). 622 lines added, 237 removed.
- **Mentor Manager spec drafted (`d441547`):** `docs/projects/mentor-manager.md` — coordinator-meeting draft for sibling project. 1-page coordinator brief on top + engineering appendix below + 3 open questions for the PYP coordinator meeting (~early May 2026).
- **Hotfix during session:** mentor dropdown empty on prod smoke. Diagnostic SQL surfaced 4 teacher rows → 1 with school_id (Matt's loominary), 2 NULL Matt test accounts, 1 system account. Manual SQL backfill set school_id on the test accounts; endpoint patched to filter `@studioloom.internal` accounts.
- **Migration 115 schema-cache fix:** `NOTIFY pgrst, 'reload schema';` after Matt manually applied 115 to prod. Then full migration body re-run via SQL editor when diagnostic confirmed `student_projects` table didn't exist on prod (column did but table didn't — partial apply).

**Heuristics baked in (with sign-off):**
- Progress % = completed pages / unit totalPages (mirrors existing dashboard route).
- Phase = 5-bucket of progress % (0-20 Wonder, 20-40 Find out, 40-60 Make, 60-80 Share, 80+ Reflect). Read-time only — column not written.
- Status = ±15% bands around cohort avg + hard rules (no project title → Needs attention; no activity 7+ days → Needs attention with "Stalled X days" reason).

**Saveme sync results (steps 11):**
- `api-registry.yaml` — drift captured: +44 lines (4 new routes — `pypx-cohort`, `teachers/list`, plus 2 from parallel preflight `fab/jobs/[jobId]/assign-machine` + `fab/machines`). Committed.
- `ai-call-sites.yaml` — re-ran scanner; no diff (no new AI calls this session).
- `feature-flags.json` — status: `drift`, 1 orphan = `SENTRY_AUTH_TOKEN` (FU-CC, P3 known build-time-only). Pre-existing, not from this session.
- `vendors.json` — status: `ok`, no drift.
- `rls-coverage.json` — status: `drift_detected`, 7 tables `rls_enabled_no_policy` (FU-FF, P3 known undocumented deny-all pattern). Pre-existing — student_projects has RLS policies.
- `schema-registry.yaml` — no manual update this session (migration 115 was manually applied to prod earlier in the session via SQL editor; schema-registry should be updated to reflect `class_units.exhibition_config` + `student_projects` but this is a step-12 follow-up — registry uses live introspection mode).

**Files modified (this saveme commit):**
- `docs/api-registry.yaml` — 4 new routes
- `docs/projects/teacher-dashboard-v1.md` — 13a + 13b rows flipped to ✅ Done with full scope summary
- `docs/projects/ALL-PROJECTS.md` — Teacher Dashboard v1 (Bold) entry added under Active Projects
- `docs/projects/WIRING.yaml` — `teacher-dashboard` system bumped to v2 + `pypx-exhibition` system added (+99 → 100 systems)
- `docs/decisions-log.md` — 6 new decisions appended (cadence per-mentor, phase as output, cohort heuristics triple, hero year copy, mentor manager v0 auth, school_resources first consumer)
- `docs/changelog.md` — this entry
- `docs/handoff/dashboard-v2-build.md` — written via step 12

**Test counts:** Not re-run this session (UI work). Branch tests assumed green based on TS-clean + targeted typechecks during build.

**Pending-push count:** 0 → 1 after this saveme commit lands.

**Systems affected:** `teacher-dashboard` (v1 → v2 in_progress, summary rewritten), `pypx-exhibition` (NEW, currentVersion 1 in_progress).

**Trigger for next session:** `dashboard next` or `pypx 13b polish` — Phase 13b-3b (filter chips + view toggle [cards/table/by-phase] + per-student detail page) OR Phase 13c (student PYPX dashboard ~2 days, port `pypx_dashboard.jsx` to real students). Mentor Manager v0 stays parked until coordinator meeting confirms scope.

---

## 27 April 2026 — Tap-a-word Phase 1 SHIPPED end-to-end

**Branch:** `tap-a-word-build` (24 commits) merged into `main` via `b915e02` + `000685c` (gate fix). Pushed to `origin/main` after Checkpoint 1.1 sign-off + prod migration applied.

**What changed (Phase 1 of language-scaffolding-redesign):**
- **Phase 1A (scaffold):** TappableText + WordPopover (createPortal) + useWordLookup hook + tokenize.ts + sandbox + `/api/student/word-lookup` route + migration `20260426140609_word_definitions_cache.sql` + 13 tokenizer tests + 9 route tests. Lesson #39 stop_reason guard + defensive destructure on every Haiku call. Migration: timestamp-prefix discipline (first feature branch to use it end-to-end).
- **Phase 1B (mounts):** MarkdownPrompt `tappable` prop (markdown-aware leaf wrap) + ActivityCard prompts + ELL-1 hint card + LessonIntro + VocabWarmup definition+example + KitMentor speech bubble + DesignAssistantWidget assistant role + CheckInPanel mentor messages. Toolkit-prompt mounts deferred (28 bespoke tools — separate refinement).
- **Phase 1C (seed + verify):** 575-word `scripts/seed-data/design-vocab-500.json` across 10 categories, expanded to 578 (added ergonomics + anthropometrics + biomechanics) + sandbox-aware seed script `scripts/preflight-tap-a-word-seed.mjs` with batched Haiku + cost tracking + gated live E2E test `tests/e2e/word-lookup-live.test.ts` + empirical cold-cache smoke `scripts/cold-cache-smoke.mjs`.
- **Mid-build hotfix (`a6696a8`):** Route gate corrected from `RUN_E2E !== "1"` to `NODE_ENV === "test" && RUN_E2E !== "1"` — dev users now see real definitions instead of `[sandbox]` sentinel text. Lesson #56.
- **Sandbox cache pollution discovered + cleaned:** 5 dev-test taps wrote sentinel rows to shared cache; manually purged. Filed FU-TAP-SANDBOX-POLLUTION (P2). Lesson #57.

**Verification (Checkpoint 1.1):**
- ✅ Sandbox seed pipeline: 10/10 ok end-to-end against prod Supabase, idempotent re-run
- ✅ Live E2E: `RUN_E2E=1 vitest run tests/e2e/word-lookup-live.test.ts` returns real "ergonomics" definition in 1592ms
- ✅ Live seed: 575/575 words processed, $0.5278 one-time, 0 failures
- ✅ Visual smoke: real definitions in popovers across 5 mount surfaces (Matt confirmed)
- ⚠️ Cold-cache empirical: 11.2% hit rate on real lessons → criterion #5 reframed as behavioural ("<20 uncached TAPS per student", measurable post-launch via Phase 4 signals). Lesson #58.

**Migrations:** `20260426140609_word_definitions_cache.sql` applied to dev (26 Apr) + prod (27 Apr). Composite PK `(word, language, context_hash, l1_target)`, RLS read-anon, service-role write.

**Tests:** 2159 → **2181 passed | 9 skipped | 139 files** (+22 tests, +3 files). tsc 0 errors. Build green with `NODE_OPTIONS=--max-old-space-size=4096`.

**Decisions added (5):** route gate fix, cold-cache criterion #5 reframe, sandbox-pollution architectural lesson, migration discipline v2 vindicated, choke-point mount strategy.

**Lessons added (3):** #56 (test-mode vs sandbox-mode conflation), #57 (sandbox writes pollute shared cache), #58 (empirical hit-rate smoke reframes spec criteria).

**FUs added (3):** FU-TAP-SANDBOX-POLLUTION (P2), FU-BUILD-HEAP (P3), FU-AI-CALL-SCANNER-GUARD-DETECTION (P3).

**Systems affected:** `tap-a-word` (NEW, status `planned`, currentVersion 0 — flips to complete/v1 when Phase 5 ships); `student-learning-support` (status stays `planned` until Phase 5).

**Cost spent this session:** ~$0.53 live seed + ~$0.0005 live E2E + ~$0.003 ergonomics rerun = **~$0.535 total**.

**Pending after this saveme:** Apply prod migration (DONE), push origin/main (DONE), Phase 2 (L1 translation + audio + image) awaits next session. Decide whether toolkit-prompt mounts land as a 1B refinement or fold into Phase 2.

---

## 27 April 2026 (PM) — Phase 2 + Phase 2.5 SHIPPED end-to-end

**Branch:** `tap-a-word-phase-2-5-build` (12 commits) merged into `main` via `2f08fb6`. Pushed to `origin/main`. **`student_support_settings` migration apply pending** (Matt-action; SQL given in chat).

**Sub-phases shipped (in order):**
- **Phase 2A — L1 translation slot** (`56b25b1` → `52a3cbe`): Server-side `l1_target` derivation from `learning_profile.languages_at_home[0]`. Dynamic Anthropic prompt + tool schema (max_tokens 250→400). Supports en/zh/ko/ja/es/fr. WIRING `tap-a-word.currentVersion` 0→1.
- **Phase 2B — Audio buttons** (`94fdfee` → `53c6b7c`): Browser SpeechSynthesis. Two micro-buttons (English voice next to word, L1 voice next to translation). `useTextToSpeech` hook + `pickVoice` pure helper. Hidden gracefully when L1 voice missing on device.
- **Phase 2.5 — Teacher control panel** (inserted mid-flight, `e90bb01` → `f758f11`): Per-student + per-class JSONB overrides for `l1_target_override` + `tap_a_word_enabled`. New migration `20260427115409_student_support_settings`. `resolveStudentSettings` server-side precedence chain (class > student > intake > default). Teacher UI page at `/teacher/classes/[classId]/students/support` with inline edit + bulk multi-select + confirmation modal. New `useStudentSupportSettings` page-session-cached client hook. Route returns `{disabled:true}` when teacher gates the student. **Inserted ahead of original Phase 2 sequence after Matt's "real students arriving" trigger.**
- **Phase 2C — Image dictionary** (`4a91f93` → `a48bb7e`): Static curated dictionary (`src/lib/tap-a-word/image-dictionary.json`). `imageForWord(word)` synchronous loader. v0 ships 6-entry seed using Wikimedia Commons `Special:FilePath` URLs (auto-resolves to current CDN). Lazy-load + onError graceful hide.
- **Phase 2D-sample — Toolkit mounts** (`ccd7940` → `25e0095`): TappableText on 3 of 27 toolkit tools (ScamperTool / MindMapTool / BrainstormWebTool — the 3 that render prompt as JSX variable). 24 remaining tools deferred as `FU-TAP-TOOLKIT-FULL-COVERAGE` P3 — they hardcode prompts inline, requiring content-aware refactors. Wait for Phase 4 signal data to prioritise.

**Verification (pre-merge):**
- ✅ Phase 2A — Tests 2181 → 2207 (+26 incl. 12 lang-mapping + 14 route)
- ✅ Phase 2B — Tests 2207 → 2215 (+8 pickVoice)
- ✅ Phase 2.5 — Tests 2215 → 2252 (+37 incl. 18 resolver + 18 API + 1 disabled-path)
- ✅ Phase 2C — Tests 2252 → 2259 (+7 image-dictionary)
- ✅ Phase 2D-sample — Tests unchanged (pure JSX wraps)
- ✅ tsc clean throughout
- ✅ Build green with `NODE_OPTIONS=--max-old-space-size=4096`
- ⚠️ `student_support_settings` migration NOT YET applied to prod — SQL ready for Matt to paste

**Migrations this session:**
- `20260427115409_student_support_settings.sql` — 2 ALTER TABLE ADD COLUMN JSONB DEFAULT '{}'. Idempotent (IF NOT EXISTS). Applied to local dev only at the moment.

**Decisions added (8):** authority model A (student-as-source + teacher-overrides), per-student + per-class scope, Phase 2.5 inserted ahead of 2C/2D, bulk ops with confirmation only (no undo/history for v0), Phase 2D scope deferred to 3-of-27, image dictionary 6-entry v0 seed, sandbox-pollution defensive fix even though gate change made it moot, migration discipline v2 vindicated again.

**Lessons added (1):** #59 (brief estimates can lie when audit hasn't happened yet — for any "N similar items" estimate, sample-audit before locking time).

**FUs added (1):** `FU-TAP-TOOLKIT-FULL-COVERAGE` P3 — wrap remaining 24 toolkit tools after Phase 4 signal data shows priorities.

**FUs resolved (1):** `FU-TAP-SANDBOX-POLLUTION` P2 — defensive fix in Phase 1 closeout.

**Systems affected:** `tap-a-word` (currentVersion 0→1, status stays planned until Phase 5; affects:[+toolkit] for 2D-sample); `student-learning-support` unchanged (still planned until Phase 5 ships full coverage).

**Cost spent this session (Phase 2 work):** $0.0 (all changes are infrastructure + UI; no Anthropic calls fired beyond Phase 1 baseline).

**Pending after this saveme:** (1) Matt applies `student_support_settings` migration to prod; (2) browser-test the teacher control panel; (3) decide Phase 3 (Response Starters) vs Phase 4 (signal infrastructure + unified settings) as next major chunk.

---

### 29 April 2026 — Access Model v2 Phase 0 SHIPPED ON BRANCH (foundation schema + audit pre-reqs)

**What changed:**

All 9 sub-tasks of Access Model v2 Phase 0 (Foundation Schema + Audit Pre-Reqs) shipped on the `access-model-v2` branch in worktree `/Users/matt/CWORK/questerra-access-v2`. 12 migrations + 5 audit-derived security artifacts + 209 new tests. **51 commits ahead of main, not pushed.** Awaiting Matt's manual Supabase apply of remaining 7 migrations + Checkpoint A1 sign-off + branch merge to main.

**Sub-tasks shipped (all DONE):**

- **0.1** schools column expansion — 6 cols: `status` (lifecycle enum), `region`, `bootstrap_expires_at`, `subscription_tier` (monetisation seam), `timezone` (IANA), `default_locale`. Mig `20260428125547`. Tests +13.
- **0.2** user locale columns — `teachers.locale` + `students.locale`. Mig `20260428132944`. Tests +7. **Option A scope** — SIS columns originally planned here narrowed to locale-only after pre-flight audit caught mig 005_lms_integration.sql already had SIS-shaped columns under different names. Canonicalisation deferred to Phase 6.
- **0.3** student/unit school_id gap fill + backfill — `students.school_id` + `units.school_id` (nullable + indexed) + UPDATE FROM teacher chain + `COALESCE(author_teacher_id, teacher_id)` for units. Mig `20260428134250`. Tests +13. NOT NULL tightening deferred to Phase 0.8.
- **0.4** soft-delete + unit_version_id — `deleted_at` on `students/teachers/units` (3 cols) + `unit_version_id` UUID FK `unit_versions(id)` ON DELETE SET NULL on 7 submission-shaped tables (`assessment_records`, `competency_assessments`, `portfolio_entries`, `student_progress`, `gallery_submissions`, `fabrication_jobs`, `student_tool_sessions`). Mig `20260428135317`. Tests +19. Existing `is_archived` patterns on `classes` / `knowledge_items` / `activity_blocks` preserved — harmonisation deferred to Phase 6.
- **0.5** `user_profiles` table (Option B chosen) — id PK FK `auth.users(id) ON DELETE CASCADE` + 6-value `user_type` enum (`student / teacher / fabricator / platform_admin / community_member / guardian`) + `is_platform_admin BOOLEAN`. Auto-create trigger on `auth.users` INSERT alongside existing `handle_new_teacher` trigger. Backfill from existing teachers. RLS: self-read + platform_admin-anywhere; INSERT/UPDATE deny-by-default (trigger + service role only). Mig `20260428142618`. Tests +20.
- **0.6** 7 forward-compat tables across 3 migration pairs:
  - **0.6a** `school_resources` + `school_resource_relations` + `guardians` + `student_guardians` (mig `20260428214009`, +24 tests)
  - **0.6b** `consents` (polymorphic subject, RLS deny-all-Phase-0; mig `20260428214403`, +16 tests)
  - **0.6c** `school_responsibilities` (programme coordinators) + `student_mentors` (cross-program mentorship — resolves FU-MENTOR-SCOPE P1; polymorphic mentor via `auth.users` FK; mig `20260428214735`, +22 tests)
- **0.7** core access tables across 2 migration pairs:
  - **0.7a** `class_members` (6-role enum incl. `mentor`) + `audit_events` (immutable append-only, polymorphic actor_type 7 values, denormalised school+class FKs, monetisation analytics seam, 5 indexes; mig `20260428215923`, +24 tests)
  - **0.7b** `ai_budgets` (polymorphic subject student/class/school) + `ai_budget_state` (per-student running counter; mig `20260428220303`, +19 tests)
- **0.8** backfill split into 0.8a + 0.8b for safer manual application:
  - **0.8a** orphan teachers → personal schools, students/units cascade tail, class_members lead_teacher seed (single DO $$ block with RAISE EXCEPTION on remaining NULLs; mig `20260428221516`, +18 tests)
  - **0.8b** tighten NOT NULL on students/units/classes school_id (with pre-flight RAISE EXCEPTION guards; mig `20260428222049`, +14 tests)
- **0.9** audit-derived non-schema deliverables:
  - api-registry annotation: 7 `/api/tools/*` routes → `auth: public` (closes audit F10; scanner heuristic + gate threshold bumped 40→50)
  - `docs/security/multi-matt-audit-query.md` — read-only diagnostic for 3-Matts + duplicate-name candidates
  - `scripts/security/rotate-encryption-key.ts` + `docs/security/encryption-key-rotation.md` (closes audit F9; per-row decrypt-encrypt-roundtrip-verify with --dry-run)
  - `docs/security/mfa-procedure.md` (closes audit F6 procedurally; Matt enables in Supabase dashboard)
  - `src/lib/access-v2/__tests__/rls-harness/` — RLS test scaffold + 1 starter test (closes audit F14 partially; full coverage = `FU-AV2-RLS-HARNESS-FULL-COVERAGE` P2)

**Plan corrections during execution (filed as inline edits to access-model-v2.md):**
- §3 item #26 rewritten to acknowledge mig 005 SIS prior art (Option A decision)
- §3 Phase 0 column-additions bullet updated to name exact tables for soft-delete + unit_version_id
- §8.6 item 3 full reality-check section with what-vs-what comparison table
- §3 §8.6 expanded from 5 to 7 forward-compat tables (added school_responsibilities + student_mentors)
- §4 Phase 0 user-type bullet updated to ship 6 enum values from day one
- Phase 0 brief sub-task table rows ticked DONE for each completed sub-task
- Supabase boundary note added to Phase 0 brief header (Matt applies migrations + dashboard + prod queries manually, not autonomously)

**Decisions logged (9 entries):** see `docs/decisions-log.md` tail for full text. Highlights: Option B for user_profiles (Supabase recommendation over auth.users direct columns); Option A for SIS columns (mig 005 prior art deferral); 3 soft-delete patterns coexist (don't harmonize in Phase 0); 6-value user_type enum from day one (community_member + guardian match schema seams); 7 forward-compat tables (programme coordinators + student mentors added 28 Apr from cross-program mentorship discovery); class_members.role includes 'mentor'; 0.8a/0.8b split for safer manual application; multi-Matt prod data preserved as 3 separate teacher rows; API versioning + timezone seams added 28 Apr.

**Side-findings filed (5 follow-ups + several closed):**
- `FU-AV2-GUARDIAN-CONTACT-ENCRYPTION` P3 — encrypt guardians.email + phone before parent portal UI
- `FU-AV2-AUDIT-EVENTS-PARTITION` P3 — partition by month when row count justifies (~1M rows)
- `FU-AV2-RLS-HARNESS-FULL-COVERAGE` P2 — extend harness to per-route coverage as Phase 1+ migrates routes
- `FU-AV2-NEW-TEACHER-USER-TYPE-DEFAULT` (Phase 1 fixup — handled when auth unification updates the trigger)
- Earlier in session: `FU-AV2-IT-SUPPORT-USER-TYPE`, `FU-AV2-TEACHER-CROSS-SCHOOL-MOVE`, `FU-AV2-MULTI-SCHOOL-MEMBERSHIPS`, `FU-AV2-HIERARCHICAL-GOVERNANCE`, `FU-AV2-PROGRAMME-COORDINATORS` (filed in §3 deferred list)

**Files created:**
- 12 migration pairs at `supabase/migrations/2026*.sql` + `.down.sql`
- 12 migration shape test files at `src/lib/access-v2/__tests__/migration-*.test.ts`
- `docs/projects/access-model-v2-phase-0-brief.md` (~470 lines master brief for the phase)
- `docs/security/multi-matt-audit-query.md`, `docs/security/mfa-procedure.md`, `docs/security/encryption-key-rotation.md`
- `scripts/security/rotate-encryption-key.ts`
- `src/lib/access-v2/__tests__/rls-harness/{README.md, setup.ts, students.live.test.ts}`

**Files modified:**
- `docs/projects/access-model-v2.md` — extensive plan corrections (Path B chosen, Option B for user_profiles, mig 005 prior art, Option A scope narrowing, soft-delete pattern coexistence, scope expansion for programme coordinators + student mentors, monetisation/timezone/locale/API-versioning forward-compat seams, etc.)
- `docs/api-registry.yaml` — sync after scanner heuristic fix (7 unknown → public)
- `docs/schema-registry.yaml` — sync via sync-schema-registry.py (88 → 108 entries, +20 from Phase 0 tables + columns)
- `docs/ai-call-sites.yaml` — sync (no diff this session)
- `scripts/registry/scan-api-routes.py` — path-based public override for `/api/tools/*` + gate threshold bumped 40→50

**Test counts:** 2433 → **2642 passed** (+209 across all 9 sub-tasks); 9 → 11 skipped (+2 RLS harness live tests skipped without env). Typecheck clean throughout.

**Systems affected:** none "live" — Phase 0 is pure schema + scaffolding. WIRING.yaml `auth-system` entry will update in Phase 1 when the unified `getStudentSession()` helper lands. Schema-registry now records 12 new tables + ~12 column additions.

**Registry sync results (saveme step 11):**
- `api-registry.yaml` — drift captured (the F10 fix + recent route work)
- `ai-call-sites.yaml` — clean
- `feature-flags.yaml` — `SENTRY_AUTH_TOKEN` orphan persists (FU-CC, P3 known)
- `vendors.yaml` — clean, status: ok
- `rls-coverage.json` — 7 RLS-no-policy tables (all pre-existing FU-FF set; zero new from Phase 0)
- `schema-registry.yaml` — 108 entries (+20 from Phase 0)

**Scheduled task gap:** `refresh-project-dashboard` not in scheduled-tasks MCP — same gap as previous saveme runs. Dashboard `PROJECTS` array sync deferred to manual update or master CWORK-level dashboard refresh.

**Session context:** This was the multi-day Phase 0 execution. Started from access-model-v2 plan signed off 25 Apr + IT audit reviewed 28 Apr → restructured plan for Path B (ship-before-pilot) → 9 sub-tasks across 3+ days of work in the questerra-access-v2 worktree. Matt manually applied migrations 0.1–0.5 to prod during execution (per "Supabase actions go through me manually" rule); migrations 0.6+ ship on the branch awaiting his apply. Checkpoint A1 verification ran with **5 PASS / 2 PARTIAL / 3 PENDING-MATT** status; merge to main waits for the 3 PENDING-MATT items (apply remaining migrations, MFA enrol, ENCRYPTION_KEY fire drill).

---

### 29 April 2026 — Access Model v2 Phase 0 APPLIED TO PROD + Checkpoint A1 PASS

**What changed (post-saveme-#1 prod applies):**

Following the saveme commit `64d2afc` that flipped Access Model v2 to "PHASE 0 SHIPPED ON BRANCH", Matt walked through the 12-step prod application + Checkpoint A1 close-out one step at a time. All 12 done.

**Migrations applied to prod** (Supabase project `cxxbfmnbwihuskaaltlk`):
1. ✅ 0.1 schools_v2_columns (already applied earlier in session window)
2. ✅ 0.2 user_locale_columns (already applied)
3. ✅ 0.3 student_unit_school_id (already applied)
4. ✅ 0.4 soft_delete_and_unit_version_refs
5. ✅ 0.5 user_profiles (4 teachers backfilled with user_type='teacher')
6. ✅ 0.6a school_collections_and_guardians (4 tables)
7. ✅ 0.6b consents (1 table + deny-all RLS)
8. ✅ 0.6c school_responsibilities + student_mentors
9. ✅ 0.7a class_members + audit_events
10. ✅ 0.7b ai_budgets_and_state — **mid-apply fix** for Lesson #61 (`WHERE reset_at < now()` rejected by Postgres because `now()` is STABLE not IMMUTABLE; partial predicate dropped, plain b-tree on `reset_at` ships)
11. ✅ 0.8a backfill — **mid-apply data fix** for orphan unit `Arcade Machine Project` (`fd2eaf1d-...`) which had NULL author_teacher_id AND teacher_id. Derived author from class_units chain → set to `mattburto@gmail.com` Matt row (`0f610a0b-...`). Migration ran cleanly afterward: 0 orphans, 26 lead_teacher rows seeded matching 26 classes-with-teacher.
12. ✅ 0.8b NOT NULL tighten on students/units/classes school_id — **mid-apply data fix** for the 26 classes that had NULL school_id (Phase 0 doesn't auto-backfill mig 117's nullable column). Manual UPDATE FROM teacher chain populated all 26. Then 0.8b ran cleanly.

**A1 ops items (Steps 10–12):**
- ✅ Step 10 — Multi-Matt audit query run. Output: 3 Matts at NIS school_id `636ff4fc-...`, no other duplicate-name candidates. Data weights: `mattburto@gmail.com` (13 classes / 6 students / 7 units, oldest), `mattburton@nanjing-school.com` (7/1/3, school email), `hello@loominary.org` (6/0/1, newest). Phase 6 cutover decision: keep all 3 vs merge → deferred per plan.
- ✅ Step 11 — Supabase MFA TOTP **Enabled** at project level (audit F6 satisfied). Per-user enrolment deferred to Phase 2 in-app UI (StudioLoom doesn't have `/auth/mfa/enroll` route yet — Supabase doesn't allow admin-side enrolment). `is_platform_admin=true` set on `mattburton@nanjing-school.com` user_profiles row.
- ✅ Step 12 — ENCRYPTION_KEY rotation script smoke-tested via `--dry-run`. Prod has 0 encrypted rows (no BYOK API keys, no LMS integrations wired pre-pilot). Script connected to prod, queried 3 encrypted columns (ai_settings.encrypted_api_key, teacher_integrations.encrypted_api_token, lti_consumer_secret), reported 0 rows in each, exited `Failed: 0`. Live rotation deferred until first BYOK row exists. Rotation log entry appended to `docs/security/encryption-key-rotation.md`.

**Checkpoint A1 final status: ALL 10 PASS ✅** (was 5 PASS / 2 PARTIAL / 3 PENDING-MATT post-saveme-#1).

**Lessons logged this session:**
- **Lesson #61** (`docs/lessons-learned.md`) — non-IMMUTABLE functions in index predicates are rejected by Postgres. Sibling to Lesson #38: shape-asserting tests catch string presence but not SQL semantic errors. Pair migration shape tests with execution tests against a real Postgres OR audit partial index predicates for `STABLE`/`VOLATILE` functions before declaring "Phase X DONE on branch".

**Bumped commits:**
- `2f87f1b` fix(access-v2): drop non-IMMUTABLE WHERE clause from idx_ai_budget_state_due_reset (mid-apply Lesson #61 fix)

**Branch state:** `access-model-v2` at HEAD (commit added during this session). 53+ commits ahead of `main`. Tree clean. Ready to merge to main via PR. Worktree cleanup deferred — Matt can `git worktree remove ../questerra-access-v2` after merge OR keep for Phase 1.

**Session context:** This was the prod apply + A1 close-out session. Multi-step walkthrough one migration at a time. Two mid-apply hiccups (Lesson #61 SQL bug + orphan data); both diagnosed + fixed inline; both informed Lesson #61 + the data-fix patterns. Now Phase 1 (Auth Unification — every student → auth.users + getStudentSession() helper + route migration) is the next milestone.

---

### 29 April 2026 (later) — Hygiene + Phase 1 brief drafted on branch + registry-consultation discipline codified

**Systems affected:** repository hygiene, admin tooling (bug-reports), build-phase-prep skill, governance (registry consultation discipline), Access Model v2 (Phase 1 brief on feature branch).

**What shipped to main today:**

1. **Bug-report screenshot signed URL TTL** (`d97decd`) — bumped 30 min → 4 hr. Single-admin internal use; URL-leakage trade-off acceptable for the realistic triage workflow.

2. **Repo hygiene Tier 1** (`9b83a71`) — relocated 247 MB of tracked reference material (`3delements/`, `docs/safety/`, `docs/newmetrics/`, `comic/`, `docs/newlook/`, `docs/lesson plans/`) to `/Users/matt/CWORK/_studioloom-reference/` (sibling, not in git). `.gitignore` blocks re-add. 5,307 files removed; 488,798 line deletions. Every future `git worktree add` skips the bulk. Recovered ~3 GiB free across 7 worktrees.

3. **Test fixture relocation** (`5ce589b`) — restored `mburton packaging redesign unit.docx` + `Under Pressure...pdf` from the relocated reference folder to `tests/fixtures/ingestion/`. CI caught they were genuinely needed by `tests/e2e/checkpoint-1-2-ingestion.test.ts`. Net hygiene saving drops from 247 MB → ~230 MB. Lesson logged in decisions-log: my grep audit needs to cover `tests/` not just `src/` + `scripts/`.

4. **FU-REGISTRY-DRIFT-CI filed** (`3007f38`) — P2 follow-up tracking the gap that `build-phase-prep` skill consulted only `WIRING.yaml`, leaving 5 other registries blind. 3-layer recommendation: L1 skill update (done — see #5), L2 pre-commit warn, L3 CI gate.

5. **`build-phase-prep` skill — Step 5c added** — registry consultation now MANDATORY for any phase touching ≥3 files. Lists the 7 registries, requires spot-check against code, requires registry-sync sub-phase in commit plan. Master `CLAUDE.md` "Non-negotiables per phase" gets a 9th item codifying it.

**What landed on `access-model-v2-phase-1` feature branch (NOT pushed to main):**

- `42b2cf7` — Phase 1 brief draft (475 lines) covering 6 sub-phases of auth unification: backfill students → auth.users, custom Supabase classcode+name flow, `getStudentSession()`/`getActorSession()` polymorphic helpers, 3-batch route migration (A: 21 read-only, B: 21 mutation, C: 17 student-touching teacher routes), RLS simplification on 7 tables, negative control + cleanup. Synthetic email format locked: `student-<uuid>@students.studioloom.local`.
- `5be1599` — Registry cross-check amendment. Added §3.7 with 10 verified gaps (numbers grep-confirmed), §4.7 Registry hygiene sub-phase (12 update steps that must land before A2 sign-off), risk #5 covering `student_sessions` RLS-no-policy promotion to load-bearing during the grace period (closes FU-FF P3), Checkpoint A2 extended with explicit registry-sync gate items.

Branch state: `access-model-v2-phase-1` at `5be1599`, 2 commits ahead of `main`, not pushed. Awaiting Matt sign-off on synthetic email format + grace period decisions before §4.1 code starts.

**Registries (this saveme — main-side):**

| File | Action | Result |
|---|---|---|
| `api-registry.yaml` | Rerun scanner — applied | +2 routes (393 → 395; `/api/student/search` newly registered + `bug-reports` tables_read/written shape correction) |
| `ai-call-sites.yaml` | Rerun scanner — applied | No drift |
| `feature-flags.yaml` | Rerun scanner | Drift: `SENTRY_AUTH_TOKEN` orphaned (pre-existing FU-CC P3), `RUN_E2E` missing (test/CI env var, classification question — leave for now) |
| `vendors.yaml` | Rerun scanner | No drift |
| `rls-coverage.json` | Rerun scanner | 7 `rls_enabled_no_policy` (3 known: `ai_model_config*`, `student_sessions` per FU-FF; `fabricator_sessions`, `fabrication_scan_jobs`, `admin_audit_log`, `teacher_access_requests`). Phase 1 §4.5 closes 2 of these |
| `schema-registry.yaml` | Manual review | No new migrations on main this session (Phase 1 migrations come on its own branch) |
| `data-classification-taxonomy.md` | Manual review | No drift. Phase 1 brief §4.7 will add the Synthetic/Opaque Identifiers rule when Phase 1 ships |

**Lessons + decisions:**
- New decision: registry cross-check is a hard gate on phase briefs (logged)
- New decision: repo hygiene Tier 1 (logged)
- New decision: bug-report TTL 30→4hr (logged)
- No new lessons — the WIRING `key_files` drift was Lesson #54 already, applied; the test-grep gap is captured in a decision.

**Commits to main this session window:** `c3c6457..3007f38` (bug-reports fix, hygiene, fixtures, FU added).

**Branch state at saveme:** `main` clean, all today's work pushed. `access-model-v2-phase-1` 2 ahead, local-only, awaiting Phase 1 sign-off.

**Next:** Phase 1 of Access Model v2 (Auth Unification, ~3.5 days incl. registry hygiene). Pre-flight + research spike when Matt says "go" on the brief.

---

### 29 April 2026 (later still) — Access Model v2 Phase 1.1a/1.1b/1.1d/1.2 SHIPPED ON BRANCH + verified in preview

**Branch:** `access-model-v2-phase-1` (8 commits ahead of `main`, pushed)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Test count:** 2642 (Phase 0 baseline) → **2695** (+53 new tests across 1.1a + 1.1b + 1.1d + 1.2)
**Typecheck:** 0 errors

**Sub-phases shipped + state:**

| Sub-phase | What | Prod state |
|---|---|---|
| 1.1a | ALTER TABLE students ADD COLUMN user_id UUID NULL FK auth.users(id) ON DELETE SET NULL + partial index + comment | ✅ Applied to prod via Supabase SQL Editor; verified column + FK + index + comment shape |
| 1.1b | TS backfill script `scripts/access-v2/backfill-student-auth-users.ts` (--dry-run, --rollback flags, idempotent, robust to SDK drift) | ✅ Applied to prod; **7 students backfilled**, 7 auth.users created with synthetic emails + `app_metadata.user_type='student'` + `school_id` + `created_via='phase-1-1-backfill'`, 7 user_profiles auto-created via Phase 0 trigger |
| 1.1d | Shared helper `provisionStudentAuthUser()` at `src/lib/access-v2/provision-student-auth-user.ts` + wires into 3 server-side INSERT routes (LTI launch, welcome/add-roster, integrations/sync) + post-Phase-1.1d miss fix to add school_id on add-roster's parseEntry payload | Pure code; no prod step. Filed FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2) for the 4 client-side UI INSERT sites Phase 1.4 will refactor |
| 1.2 | `POST /api/auth/student-classcode-login` — generateLink + verifyOtp via SSR cookie adapter; per-IP + per-classcode rate limit; lazy-provision fallback for UI-created students; audit_events on every outcome (success/failed/rate_limited); sanitised error logging; Cache-Control: private | ✅ Verified end-to-end in Vercel preview deploy: HTTP 200 happy path + sb-* session cookies set + JWT decoded with `app_metadata.user_type='student'` + 401 failure paths + audit_events rows shaped correctly + ip_address captured |

**Test breakdown (29 new test cases added in this session):**
- `migration-phase-1-1a-student-user-id-column.test.ts` — 8 shape tests
- `provision-student-auth-user.test.ts` — 15 helper tests (pure helpers + happy/skip/reuse/fail paths + throwing variant)
- `student-classcode-login/__tests__/route.test.ts` — 9 route tests (rate limit / 401 / lazy provision fail / generateLink fail / verifyOtp fail / happy + lazy provision)
- `backfill-student-auth-users.test.ts` — 21 backfill tests (refactored to delegate to shared helper; 2 tests updated for new createUser-first semantics)

**Lessons added (`docs/lessons-learned.md`):**
- Lesson #62 — Use `pg_catalog.pg_constraint` for cross-schema FK verification, not `information_schema.constraint_column_usage` (surfaced when 1.1a's `students.user_id` FK to `auth.users(id)` was correctly created but information_schema query falsely reported zero rows; pg_catalog query confirmed the constraint exists with `ON DELETE SET NULL`)

**Side issues handled in parallel by another session (NOT in this branch):**
- `units-school-id-hotfix` (`c2ccb7e`) merged to main — fixes `/api/teacher/units` create case for post-0.8b NOT NULL school_id
- Follow-up cleanup `462cfa8` on main — covers 4 other server-side INSERT sites (units/route.ts fork, convert-lesson, welcome/create-class, welcome/setup-from-timetable)
- Proposal doc `c67dbc1` `access-v2-phase-1-school-id-foldin-proposal.md` reviewed and rejected — fold-in into Phase 1 conflated auth-unification with constraint-compliance bugfixes; recommendation taken to keep them as separate hotfixes on main + a single Phase-1.1d miss fix on this branch (add-roster school_id population)

**Phase 1.2 prod-preview verification results (29 Apr 2026 PM):**
- Test 1 (happy path): HTTP 200 + sb-* cookie + Cache-Control: private + correct response body ✅
- Test 2 (JWT decode): app_metadata.user_type='student' + school_id + created_via all in claims; access_token TTL 3600s; amr method='otp' confirms magiclink flow ✅
- Test 3a (bad classCode): HTTP 401 + Cache-Control: private + body `{"error":"Invalid class code"}` + audit row with failureReason='invalid_class_code' ✅
- Test 3b (bad username): HTTP 401 + Cache-Control: private + body `{"error":"Student not found in this class"}` + audit row with failureReason='student_not_in_class' ✅
- Test 4 (audit_events): 3 rows landed with correct shape; actor_id populated on success / NULL on failure; payload_jsonb shape correct; ip_address from x-forwarded-for ✅
- Test 5 (per-classcode rate limit): skipped (unit-test covered)

**Phase 1 progress:** 4 sub-phases of 7 done. Highest-risk sub-phase (1.2) verified. Remaining: 1.3 helpers (~0.5d), 1.4 route migrations (~1d), 1.5 RLS simplification (~0.5d), 1.6 negative control + cleanup (~0.5d), 1.7 registry hygiene (~0.5d). ~3 days from Checkpoint A2.

**Registries (this saveme):**

| File | Action | Result |
|---|---|---|
| `api-registry.yaml` | Rerun scanner — applied | New route `/api/auth/student-classcode-login` registered earlier in commit `c2a7456` (Phase 1.2). Scanner picked up the route + tests. No new diff this saveme. |
| `ai-call-sites.yaml` | Rerun scanner — applied | No diff |
| `feature-flags.yaml` | Rerun scanner | Pre-existing FU-CC drift (SENTRY_AUTH_TOKEN orphan) + RUN_E2E test env var still missing — known, deferred |
| `vendors.yaml` | Rerun scanner | Status: ok |
| `rls-coverage.json` | Rerun scanner | 7 known `rls_enabled_no_policy` (FU-FF + 6 others) — none new. Phase 1.5 closes 2 of these (student_sessions + fabrication_scan_jobs). |
| `schema-registry.yaml` | Manual review | Phase 1.1a column add documented in migration shape test (`migration-phase-1-1a-student-user-id-column.test.ts`); `students.user_id` writers list expansion to be done in Phase 1.7 registry hygiene — drift acknowledged, deferred (not load-bearing). |
| `data-classification-taxonomy.md` | Manual review | No drift this session. Phase 1.7 registry hygiene adds the Synthetic/Opaque Identifiers rule when Phase 1 closes. |

**Branch state at saveme:** clean. 8 commits ahead of `main`, pushed.

**NEXT:** Matt continues to Phase 1.3 — `getStudentSession()` / `getActorSession()` polymorphic helpers. Pure code, no prod step. Builds on the now-verified architecture.

---

### 29 April 2026 (evening) — Phase 1.3 + 1.4a + 1.4b + 1.5 + 1.5b SHIPPED ON BRANCH; Phase 1.4 verified end-to-end in prod-preview

**Branch:** `access-model-v2-phase-1` (21 commits ahead of `main`, all pushed)
**Test count:** 2695 → **2762** (+67 across the evening session)
**Typecheck:** 0 errors throughout
**Lessons added:** #62 (pg_catalog FK verification), #63 (Vercel preview URLs are deployment-specific)

**Sub-phases shipped + state:**

| Sub-phase | What | State |
|---|---|---|
| 1.3 | Polymorphic actor session helpers (`getStudentSession` / `getActorSession` / `requireStudentSession` / `requireActorSession`) | ✅ Code on branch; 18 tests |
| 1.4a | Dual-mode `requireStudentAuth` wrapper — legacy entry point tries Supabase Auth first, falls back to legacy. All 63 student routes auto-upgraded with zero route file changes. | ✅ Code on branch; 9 tests; **VERIFIED in prod-preview** |
| 1.4b | 6 GET routes explicitly migrated to `requireStudentSession` (grades, units, insights, safety/pending, me/support-settings, me/unit-context) | ✅ Code on branch; **VERIFIED in prod-preview** |
| 1.5 | 4 RLS migrations: students self-read + 3 REWRITES of broken policies (competency_assessments, quest_journeys+milestones+evidence, design_conversations+turns). Pre-flight audit caught that `student_id = auth.uid()` was wrong post-Phase-1.1a (different UUIDs). Rewrites use `auth.uid() → students.user_id → students.id` chain. | ✅ Migrations + 21 shape tests on branch; awaiting Matt's prod apply |
| 1.5b | 4 additive RLS migrations: class_students parallel auth.uid policy, student_progress self-read, fabrication_jobs + fabrication_scan_jobs self-read, student_sessions explicit deny-all (closes FU-FF). | ✅ Migrations + 19 shape tests on branch; awaiting Matt's prod apply |

**Phase 1.4 prod-preview verification (29 Apr evening):**

| Test | URL | Method | Status | Notes |
|---|---|---|---|---|
| 1 | `studioloom-git-...vercel.app/api/auth/student-classcode-login` | POST | 200 ✅ | sb-* cookies set |
| 2 | `studioloom-git-...vercel.app/api/student/units` (Phase 1.4b) | GET via sb-* | 200 ✅ | requireStudentSession reads JWT, dual-mode auth works |
| 3 | `studioloom-git-...vercel.app/api/student/portfolio` (NOT migrated) | GET via sb-* | 200 ✅ | dual-mode wrapper auto-upgrades via legacy `requireStudentAuth` |

**False alarm during verification (Lesson #63 source):** Initial Test 2 attempts returned 401 against the OLD deployment URL (`studioloom-5yfej1l0t-...`). That URL pinned to a Phase-1.2-era build, before Phase 1.4a/b shipped. Switching to the auto-aliased branch URL (`studioloom-git-access-model-v2-phase-1-...`) immediately returned 200. Spent ~30 min adding diagnostic logging (commits 57454af, f0087ea — both reverted in 80d68f6) before realising the URL was stale. Logged as Lesson #63 — Vercel preview URLs are deployment-specific.

**Side cleanup commit (`8b0be68`):** accidentally committed `cookies.txt` (test artifact with valid session token) in 57454af. Removed via `git rm` + appended `.gitignore` entry to block future commits. Repo is private + token is for synthetic test student, blast radius near zero.

**Registries (this saveme):**

| File | Action | Result |
|---|---|---|
| `api-registry.yaml` | Rerun scanner — applied | No new diff (Phase 1.4b helper migration didn't add routes) |
| `ai-call-sites.yaml` | Rerun scanner — applied | No diff |
| `feature-flags.yaml` | Rerun scanner | Pre-existing FU-CC + RUN_E2E drift (known) |
| `vendors.yaml` | Rerun scanner | Status: ok |
| `rls-coverage.json` | Rerun scanner | **Drift dropped from 7 → 5 entries** (student_sessions + fabrication_scan_jobs exited the drift bucket via Phase 1.5b — even though the migrations haven't applied to prod yet, the scanner reads the migration files in the repo). Remaining 5 (admin_audit_log, ai_model_config, ai_model_config_history, fabricator_sessions, teacher_access_requests) are separate concerns or intentional deny-all. |
| `schema-registry.yaml` | Manual review | spec_drift entries for the Phase 1.5 + 1.5b RLS rewrites tracked in Phase 1.7 (registry hygiene sub-phase) |
| `data-classification-taxonomy.md` | Manual review | No drift |

**What's next:**

1. **Matt applies 8 RLS migrations to prod** via Supabase SQL Editor (Phase 1.5: 4 migrations, then Phase 1.5b: 4 migrations, in timestamp order; ~10 sec each). Each is a small SQL paste from the file.
2. **Phase 1.4c** — Batch B (mutations) + Batch C (teacher routes touching students), ~38 routes mechanical migration. Tracked: FU-AV2-PHASE-14B-2 (P3) covers the 18 GET routes too.
3. **Phase 1.4 client-switch** — change routes from `createAdminClient()` to RLS-respecting SSR client. Higher-stakes than helper migration; route-by-route review.
4. **Phase 1.6** — negative control + cleanup (delete legacy fallback, drop alias pattern from 1.4b).
5. **Phase 1.7** — registry hygiene (WIRING auth-system rewrite, schema-registry spec_drift, taxonomies).
6. **Checkpoint A2** — gate criteria + merge to main.

~2 days from Checkpoint A2.

---

## 2026-05-02 — Access Model v2 Phase 4 part 1 SHIPPED + Checkpoint A5a + 6 hotfix commits

**Marathon session.** Phase 4.0 → 4.4d shipped end-to-end. 7 migrations applied to prod. Three-Matts prod-data consolidation. ~300 new tests (2895 → 3189). 50+ commits. Checkpoint A5a passed and merged to main. Two follow-up hotfix passes after smoke testing.

### What landed

**Phase 4.0** — Pre-flight + scaffolds. Active-sessions claimed. Migration `20260502024657_phase_4_0_governance_engine_rollout_flag` (admin_settings kill-switch flag, idempotent, default true). 4 scaffolds: archived-school read-only guard (§3.9 item 16), multi-campus parent-precedence helper (§3.9 item 13), governance type contracts (PayloadV1 + TierResolver per §3.9 item 14), rollout-flag accessor. **i18n primitive verification**: zero matches for next-intl/next-i18next/i18next/useTranslation across src — finding logged, deferred to FU-AV2-PHASE-4-4D-NEXT-INTL.

**Phase 4.1** — Schools seed extension. Migration `20260502025737_phase_4_1_seed_schools_extension` shipped 101 schools across 6 markets (UK indies, Australia AHIGS/GPS, US NAIS, Asia non-China fills, Europe non-UK, MEA + NZ + Canada). Curation-criteria-driven (publicly listed D&T faculty / Matt has on-the-ground intro / teaches a demoable framework). source='imported'. UTF-8 verified.

**Phase 4.2** — `school_domains` + welcome wizard auto-suggest. Migration `20260502031121_phase_4_2_school_domains` adds the table + 2 SECURITY DEFINER functions (`is_free_email_domain` IMMUTABLE with 26-provider blocklist including Chinese providers; `lookup_school_by_domain` STABLE narrow projection callable by anon). 4 RLS policies. New routes: `GET /api/schools/lookup-by-domain` (public), `GET /api/school/[id]/domains` (list), `POST /api/school/[id]/domains` (auto-verify path only — non-matching returns 501 with `requires: phase_4_3_governance_engine`). Welcome wizard banner ships above SchoolPicker when domain match found. **Banner verified end-to-end on prod** with all 3 NIS domains (`nis.org.cn`, `nischina.org`, `nanjing-school.com`).

**Phase 4.3** — Governance engine. Migration `20260502034114_phase_4_3_school_setting_changes` adds `school_setting_changes` ledger + `school_setting_changes_rate_state` rate-state side-table + 2 enums (tier, status) + 4 indexes + 4 RLS policies + `enforce_setting_change_rate_limit` SECURITY DEFINER fn (sliding-hour bucket-per-hour storage; atomic check-then-increment). 3 new TS files: `governance/tier-resolvers.ts` (context-aware classification per §3.8 Q2 — domain-match auto-verify, AI-budget delta >50% escalates to high-stakes, 13 always-high + 14 always-low sets), `governance/setting-change.ts` (propose/confirm/revert helpers with bootstrap-grace + version-stamping + rate-limit + archived-guard + kill-switch composition), `app/api/school/[id]/domains/[domainId]/route.ts` (DELETE wired through governance — single-teacher bootstrap immediate-apply vs multi-teacher pending). 84 new tests.

**Phase 4.3.x** — handle_new_teacher search_path hotfix. Migration `20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path` re-applies `SET search_path = public, pg_temp` + schema-qualified `INSERT INTO public.teachers`. The May-1 rewrite (Lesson #65 fix) accidentally dropped both. Failure mode: `ERROR: relation "teachers" does not exist` for every email/password teacher signup since 1 May. Surfaced 2 May during banner-test smoke. **Lesson #66** filed: SECURITY DEFINER function rewrites must re-apply search_path lockdown. Hot-fix applied to prod via SQL Editor first; migration captures fix in audit trail.

**Phase 4.3.y** — Bug A + B + UX-1 fix-pack. Migration `20260502105711_phase_4_3_y_handle_new_teacher_auto_personal_school` extends trigger to atomically INSERT a personal school per Decision 2 (Phase 0 backfilled existing teachers; trigger now extends to new signups). Personal school: `'{Teacher Name}'s School ({user_id[0:8]})'`, country='ZZ', source='user_submitted', verified=false. Welcome wizard `persistSchoolId` helper fires PATCH `/api/teacher/school` immediately on banner-click + Step 1 Next (Bug B fix — was deferred to wizard step 5 / complete). Copy fix: "What's your first class called?" → "Let's add a class". 20 new tests. **Bug A verified end-to-end on prod** (banner-test-3 trigger created NIS personal school).

**Phase 4.3.z** — Three-Matts prod-data consolidation. Pulled forward from Phase 6 cutover plan. Renamed `mattburto@gmail.com` → "Admin" (both `is_admin=true` + `is_platform_admin=true`); `mattburton@nanjing-school.com` → "Matt Burton" pure teacher (admin flags removed); `hello@loominary.org` → "Loominary (deactivated)" with `teachers.deleted_at = now()` + `auth.users.banned_until = '2099-01-01'`. 26 classes / 11 units / 7 students wiped. 8 orphan student auth.users cleaned. Master-spec risk row line 319 ("Multi-Matt-teacher-account prod data") resolved. Apply discipline learned: Supabase SQL Editor runs in autocommit mode — temp tables don't survive across statements; idempotent statement chains required for prod-data work.

**Phase 4.4a** — Bootstrap auto-close trigger + GET school + read-only settings page skeleton. Migration `20260502122024_phase_4_4a_bootstrap_auto_close_trigger` adds AFTER INSERT trigger on teachers — closes `schools.bootstrap_expires_at` when active count goes 1→2 (conditional UPDATE never reopens per §3.8 Q6). New `GET /api/school/[id]` route returns school + teacher count + pending proposals + 30-day activity feed. New `/school/[id]/settings` page (server component) renders identity / status / 3 conditional banners (archived / bootstrap grace / lone-teacher post-bootstrap) / pending proposals list / activity feed. Editable sections placeholder. 26 new tests.

**Phase 4.4b** — Universal PATCH + editable Identity. NEW `governance/applier.ts` registry maps 22 change_types across 9 setting categories to actual schools column updates (or school_domains insert/delete for domain ops). Pre-wires Phase 4.8 JSONB columns (academic_calendar_jsonb, timetable_skeleton_jsonb, etc.) so 4.8 ships without PATCH-route code change. Universal `PATCH /api/school/[id]/settings` endpoint routes through `proposeSchoolSettingChange` + `applyChange` with status-mapped HTTP responses. `IdentitySection` client component with 6 editable fields, tier-aware UI (Save vs Propose label flip, badge text changes by bootstrap state). 33 new tests.

**Phase 4.4c** — Confirm + revert (interactive governance UI). NEW `POST /api/school/[id]/proposals/[changeId]/confirm` (2nd-teacher confirm) + `POST /api/school/[id]/changes/[changeId]/revert` (7-day-window revert with `before_at_propose` written back). `PendingProposalsList` + `ActivityFeed` client components with self-proposed badges, confirm dialog modal (2-way before/after preview with ARIA), Revert buttons on applied rows within window, status pills, `router.refresh()` on success. 19 new tests.

**Phase 4.4d** — Polish: timezone smart-default in welcome-wizard SchoolPicker `Intl.DateTimeFormat()` auto-detect for fresh school creation. Multi-campus parent breadcrumb on settings header (per-field inheritance badges defer to FU-AV2-PHASE-4-PER-FIELD-INHERITANCE-BADGES alongside Phase 4.8 JSONB columns landing). Confirm dialog 2-way preview (ships material UX win; full live 3-way diff filed as FU-AV2-PHASE-4-3WAY-LIVE-DIFF). i18n primitive bootstrap deferred (FU-AV2-PHASE-4-4D-NEXT-INTL).

**Checkpoint A5a** — passed all sub-criteria. Merged to main via fast-forward worktree pattern. `b82f9f2..0bf1aeb` (47 commits to main).

### Post-merge hotfix passes

**Hotfix 1 (5 commits, `0bf1aeb..9ced53e`)** — surfaced via Matt's smoke testing:
- C1+C2: dirty-check anchor (router.refresh after IdentitySection save) + server-side `.trim()` (prod data hit: NIS schools.city saved as "Nanjing " with trailing space; cleanup SQL ran)
- C3: `/school/me/settings` redirect helper + TopNav avatar dropdown nav links ("My Settings" + "School Settings")
- U1: Country / Timezone / Default locale dropdowns (NEW `option-lists.ts` with 39 countries + 47 timezones + 11 locales)
- U2: Region field hidden from UI (governance-internal scoping; no user-facing purpose v1)
- D1: stale "coming in 4.4b" copy replaced
- 3 FUs filed: FU-AV2-PHASE-4-DOMAIN-UI, FU-AV2-WELCOME-CALENDAR-PREVIEW, FU-AV2-WELCOME-STEP5-CTAS (P2 — Matt is moving away from AI-generated units)

**Hotfix 2 (1 commit, `9ced53e..b2b9bed`)** — settings page rendered bare without TopNav (stuck-page UX). NEW `src/app/school/layout.tsx` mirrors `/teacher/layout.tsx` structure (TeacherShell + auth + welcome-wizard guard). Slight duplication; FU-AV2-LAYOUT-DEDUP filed.

### Numbers

- **Tests:** 2895 → 3189 (+294 new, 0 regressions)
- **tsc strict:** clean throughout
- **Migrations:** 7 applied to prod (all verified by Matt)
- **Routes:** ~14 new (Phase 4.2 + 4.3 + 4.4a/b/c)
- **Commits to main:** 53 (47 from Phase 4.4d branch + 5 hotfix commits + 1 TopNav hotfix commit)
- **Branch:** access-model-v2-phase-4-part-2 cut from main for Phase 4 part 2 (4.5/4.6/4.7/4.8/4.9)

### Lessons logged this session

- **Lesson #66** — SECURITY DEFINER function rewrites must re-apply search_path lockdown. Sibling of #64 (RLS recursion) and #65 (assumption-baked triggers). Operational rule: read existing `pg_get_functiondef` before rewriting; diff new vs old to confirm safety properties survive; sanity DO-block asserts every property; smoke via Supabase Auth admin API not direct SQL Editor INSERT.

### Decisions logged this session

12 §3.8 sign-offs + 6 §3.9 future-proofing additions + Phase 4.4 4-pass split + 4.4c/4.4d UX scope decisions. See decisions-log entries dated 2026-05-02.

### What's next

**Phase 4 part 2 on `access-model-v2-phase-4-part-2`** — 4.5 (school_merge_requests + 90-day redirect cascade) + 4.6 (School Library browse + Request-to-Use flow) + 4.7 (super-admin /admin/school/[id]) + 4.8 (settings bubble-up JSONB columns) + 4.9 (department + dept_head triggers) → Checkpoint A5b → final Phase 4 close. Estimated 5-7 days.

**Pending hygiene FUs** (from this saveme):
- `FU-AV2-API-REGISTRY-DYNAMIC-ROUTES` P3 — api-registry.yaml scanner missed Phase 4 dynamic [id] routes (~14 routes); manual sync deferred
- `FU-AV2-SCHEMA-REGISTRY-PHASE-4-TABLES` P3 — schema-registry.yaml manual entries for 3 new tables (school_domains / school_setting_changes / school_setting_changes_rate_state) + new columns on schools deferred
- `FU-AV2-WIRING-PHASE-4-SYSTEMS` P3 — WIRING.yaml needs `school-governance` + `school-library` system entries; updates to auth-system + permission-helper + class-management impact lists deferred
- `FU-AV2-LAYOUT-DEDUP` P3 — `/school/layout.tsx` and `/teacher/layout.tsx` share ~80% logic; refactor when next layout-touching work happens

**RLS coverage:** clean. 108 → 111 tables (+3 from Phase 4); all 3 new tables have RLS + policies. 5 pre-existing rls_no_policy entries unchanged.



## 2026-05-02 PM — Access Model v2 Phase 4 part 2 PLAN UPDATE (4.8b freemium seams + 4.7b tier-aware membership + Decision 8 amendment)

**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Branch:** `access-model-v2-phase-4-part-2`
**Session type:** Plan-only — no code touched, no migrations applied. Pure spec/decision work after Checkpoint A5a ship + 4.8b mid-phase freemium seam audit.

**What changed**

Two audits ran post-A5a, two sub-phase additions approved:

1. **4.8b freemium-build seam bake-in** (~0.75 day, slot between 4.8 and 4.9). 9-seam audit confirmed 5 seams already in place (`schools.subscription_tier` 5-tier enum, `audit_events.action TEXT` open string, `ai_budgets`/`ai_budget_state` cascade, `can(actor, action, resource, { requiresTier })`, `/api/public/*` boundary). 1 deferred to Phase 5 (`withAIBudget()` middleware per master spec line 269). Remaining 6 seams folded into 4.8b: `teachers.subscription_tier` enum (mirrors schools), `stripe_customer_id` × 2 nullable cols, `actor.plan` on ActorSession with cascade resolution (teacher tier → school tier → free), `plan-gates.ts` pass-through helpers wired into 3 chokepoints (welcome/create-class, welcome/setup-from-timetable, teacher/students enrollment), `requires_plan` field on feature-flags.yaml schema, public-route boundary one-pager doc. Out of scope: Stripe SDK/webhook/UI, plan-limit count queries, tier-feature matrix decisions, trial state machine — defer to post-access-v2 freemium build (~6.75 eng days because foundations are baked here). Hard rule: no Stripe checkout until tier-feature matrix is signed.

2. **4.7b tier-aware membership amendment** (~3.75 days, 4 sub-sub-phases + Matt-checkpoint, slot between 4.7 and 4.8). 2nd-pass review (Gemini + CWORK independent reports) surfaced verification gap on free tier: anyone signing up with school-domain email auto-joins → reads 6 RLS leak surfaces. CWORK audit caught 2 surfaces missed in initial scope: `student_mentors_school_teacher_read` (mig `20260428214735` — direct student-ID enumeration via mentor↔student joins) and `school_resources_school_read` + `guardians_school_read` (mig `20260428214009` — parent PII when populated by Mentor Manager). Decision 8 amended: flat governance with 2-teacher confirm applies WITHIN school-tier schools that have ≥2 verified school_admin members; single-school_admin schools follow bootstrap rules indefinitely. `school_admin` role implementation = a value in `school_responsibilities.responsibility_type` (no new table). Free/pro = personal school siloed; school-tier = invite-only. Sub-sub-phases:
   - **4.7b-0 ops** (~0.25d): flip NIS `subscription_tier` `'pilot'` → `'school'` BEFORE any 4.7b code.
   - **4.7b-1** (~1d): `'school_admin'` enum value + `SCHOOL_ADMIN_ACTIONS` matrix + `is_school_admin()` SECURITY DEFINER helper + INSERT-policy hardening (prevent self-promotion; allow during bootstrap-grace OR existing admin OR platform admin).
   - **4.7b-2** (~1.5d): NEW `school_invitations` table (mig 089 `teacher_access_requests` is INSUFFICIENT — waitlist with TEXT `school` field, no `school_id` FK / token / `invited_by`). Domain-match banner rewrite (target school-tier → "ask IT" + request POST, never auto-join). Auto-join code path actively dismantled. Invite-acceptance endpoint. Upgrade-path reusing `schools.merged_into_id` from §4.5.
   - **Matt-checkpoint**: smoke invite-flow end-to-end before sweeping policies.
   - **4.7b-3** (~1d): tier-gate 6 leak surfaces (settings governance / audit log / library / teacher directory / student_mentors / school_resources+guardians).

**Execution-order reorder under Option A**: 4.6 ships AFTER 4.7b. Library at free tier exposes other teachers' unit titles + content — bigger leak than the 6 existing surfaces. Build it gated from day one. Trade-off: reduces school-library QA window pre-pilot; mitigated by gated-from-day-one design.

**2 new FUs filed**:
- `FU-FREEMIUM-SCHOOL-DOWNGRADE-OWNERSHIP` P2 — school-tier-lapse split flow (ownership of shared students/classes/library when school downgrades free). Defer until real downgrade case arrives.
- `FU-WELCOME-WIZARD-STUDENT-EMAIL-GUARD` P2 — student `@school-domain` emails can teacher-signup at flagged domains; tier-aware membership fixes only AFTER target school is `'school'` tier; needs role gate even after 4.7b lands. Should land before 2nd-school onboarding.

**Estimate impact**: Phase 4 ~12.25 → ~17 days. Close ~13–14 May → ~17–18 May 2026.

**Files modified** (5 plan docs, ~520 lines added):
- `docs/projects/access-model-v2-phase-4-brief.md` — §3.8 item 13 (Decision 8 amendment), §4.7b spec (4 sub-sub-phases + Matt-checkpoint with full SQL/RLS/stop-triggers), §4.8b spec (added in earlier turn), §9 Estimate table updated, §11 sign-off addendums (4.8b + 4.7b)
- `docs/projects/access-model-v2.md` — Decision 8 line 336 amended with full text + teacher-leaves-school content rule corollary
- `docs/decisions-log.md` — 2 new entries (4.8b + Decision 8 amendment)
- `docs/projects/access-model-v2-followups.md` — 4 new FUs (FU-FREEMIUM-CAN-PATTERN-ADR P3, FU-FREEMIUM-CALLSITE-PLAN-AUDIT P3, FU-FREEMIUM-SCHOOL-DOWNGRADE-OWNERSHIP P2, FU-WELCOME-WIZARD-STUDENT-EMAIL-GUARD P2)
- `docs/handoff/main.md` — refreshed for next-session pickup with new execution order + 4.7b-0 ops prerequisite

**Registries**: scanner sweep no-op (no new code/migrations/routes/AI-calls/vendors this session). JSON report timestamps refreshed.

**Tests**: unchanged (3189/11). tsc strict: unchanged (0 errors). Vercel: no deploys this session.

**Next session pickup**: handoff/main.md is the entry point. Phase 4 part 2 begins with 4.5 (school_merge_requests). 4.7b-0 ops flip can run any time after 4.5 lands — before 4.7b-1 code.


## 2026-05-03 — Access Model v2 Phase 4 part 2 SHIPPED + Checkpoint A5b PASS

**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Branch:** `access-model-v2-phase-4-part-2` → merging to `main`
**Session type:** Marathon implementation. 9 sub-phases shipped end-to-end + smoke-verified on prod + Checkpoint A5b PASS.

**What shipped**

All 9 Phase 4 part 2 sub-phases complete, applied, and smoke-verified:

- **4.5 — `school_merge_requests` + 90-day redirect cascade** (mig `20260502210353`, commit `f864172`). Platform-admin-mediated merges with 15-table cascade (audit-derived from brief's 12 — caught Preflight surfaces + guardians via Lesson #54 grep). Per-table audit_events row + summary row per merge.
- **4.7 — Platform super-admin `/admin/school/[id]` + view-as URL** (commit `d0d8035`, hotfix `ea2cf6e`). HMAC-SHA256 signed view-as tokens (5-min TTL); middleware blocks mutations when `?as_token=` present. 7-tab detail page; replaces paper-only `/admin/schools` stub. Hotfix corrected `classes.deleted_at` → `is_archived` (mig 033 schema, not the soft-delete pattern).
- **4.7b-0 — NIS tier flip ops** (manual SQL): NIS `subscription_tier` `'pilot'` → `'school'`. Pre-requisite for tier-aware membership tests. Plus Gmail-Matt detached from NIS (`school_id = NULL`) per master-spec separation invariant.
- **4.7b-1 — school_admin role + INSERT-policy hardening** (mig `20260502215604`, commit `0b756b3`). New value in `school_responsibilities.responsibility_type` enum; `is_school_admin()` + `can_grant_school_admin()` SECURITY DEFINER helpers; INSERT policy with 3-branch grant rule (platform admin / existing admin / bootstrap-grace).
- **4.7b-2 — invite flow + auto-join dismantle** (mig `20260502221646`, commit `8fe3a77`). NEW `school_invitations` table (DB-stored token for revocability); extended `lookup_school_by_domain` to return tier; tier-aware welcome wizard banner (school-tier → "ask IT to invite you"); `teacher_access_requests.school_id` FK added (mig 089 was waitlist, not invite infra — caught via CWORK Q4 audit).
- **4.7b-3 — tier-gate 4 RLS leak surfaces** (mig `20260502223059`, commit `0380102`). NEW `current_teacher_school_tier_school_id()` SECURITY DEFINER helper; DROP+CREATE on 4 policies (audit_events / student_mentors / school_resources / guardians) to gate by school-tier school. Implicit tier-awareness for free/pro: alone in personal school = naturally siloed.
- **4.6 — School library + Request-to-Use flow** (mig `20260502224119`, commit `f177ce9`). NEW `unit_use_requests` table; `units.forked_from_author_id` (existing `units.forked_from` from mig 007 reused — caught via Lesson #54 grep, would've duplicated). Author-controlled fork with attribution; library naturally tier-appropriate via existing `school_id` filter (no explicit tier-gate needed). The curriculum-library moat.
- **4.8 — Schools settings bubble-up columns** (mig `20260502230242`, commit `57f001c`). 8 new columns on schools (academic_calendar_jsonb, timetable_skeleton_jsonb, frameworks_in_use_jsonb, default_grading_scale, notification_branding_jsonb, safeguarding_contacts_jsonb, content_sharing_default, default_student_ai_budget). Closes Phase 4.4b paper-only gap (applier registry referenced columns that didn't exist). Calendar backfilled from `school_calendar_terms` (NIS got 2 terms backfilled). `teachers.school_profile` source skipped — column doesn't exist (Lesson #54 again).
- **4.8b — Freemium-build seam bake-in** (mig `20260502231455`, commit `ef7ca66`). `teachers.subscription_tier` enum mirroring schools; `stripe_customer_id` × 2 (nullable, unique-when-set partial indexes); `actor.plan` cascade resolution on ActorSession (teacher tier → school tier → free); `plan-gates.ts` pass-through helpers wired into 3 chokepoints (welcome/create-class, welcome/setup-from-timetable, teacher/students enrollment); `requires_plan` field documented in feature-flags-taxonomy + 1 exemplar; public-route boundary doc.
- **4.9 — Department + dept_head auto-tag triggers** (mig `20260502233618`, commit `1177cdf`). `class_members.source` (NEW — caught Lesson #54 4th time this phase — brief assumed it existed); `classes.department` + `school_responsibilities.department`; CHECK enum extended 8 → 9 values (added `dept_head`); 4 SECURITY DEFINER triggers (responsibility insert / responsibility revoke / class insert / class department change resync). All 4 triggers verified end-to-end on prod via UPDATE → resync → revoke flow.

**Checkpoint A5b — PASS**

`docs/projects/access-model-v2-phase-4-checkpoint-a5b.md` written. All criteria green:
- 11 commits to feature branch + 8 migrations applied to prod + 1 ops change
- 3189 → 3291 tests (+102 new, 0 regressions, tsc strict 0 errors)
- All RLS coverage clean; all SECURITY DEFINER helpers locked search_path per Lesson #66
- 8 sub-phase smokes all green on prod
- Documentation complete (this changelog + handoff + A5b doc)

**Decisions made during execution** (captured in decisions-log):

- 4.5 cascade list grew 12 → 15 tables (audit-derived from grep, not brief)
- 4.6 reused existing `units.forked_from` instead of brief's specced `forked_from_unit_id` (column duplication caught)
- 4.8 skipped `teachers.school_profile` backfill source (column doesn't exist)
- 4.9 added `class_members.source` column (brief assumed it existed)
- 4.8b shipped `requires_plan` schema-only + 1 exemplar; deferred per-flag annotation to FU pending tier-feature matrix decisions
- Gmail-Matt detached from NIS (per master-spec separation; `school_id = NULL`)
- `starter` tier kept dormant in CHECK enum (collapse risks audit_events CHECK rewrite)
- Library tier-gate is implicit via existing `school_id` filter (no new RLS policy needed)

**Lesson #67 candidate**: brief-vs-schema audit at PHASE start, not sub-phase start. Phase 4 part 2 caught the same gap pattern in 4 different sub-phases (Lesson #54 + #59 each time). 30-min phase-start audit would've caught all 4 in one batch. Filing as proposed addition to lessons-learned.md.

**FUs filed during part 2: 9 new** (FU-FREEMIUM-CAN-PATTERN-ADR P3, FU-FREEMIUM-CALLSITE-PLAN-AUDIT P3, FU-FREEMIUM-SCHOOL-DOWNGRADE-OWNERSHIP P2, FU-WELCOME-WIZARD-STUDENT-EMAIL-GUARD P2, FU-AV2-IMPERSONATION-RENDER-WIRING P3, FU-AV2-TEACHER-DIRECTORY-ROUTE-GATE P3, FU-FREEMIUM-FLAGS-PLAN-ANNOTATION P3, FU-AV2-DEPT-HEAD-UI P2, FU-AV2-DEPT-BACKFILL-FROM-NAME P3).

**FUs CLOSED**: FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2 (data model + triggers shipped in 4.9).

**Migrations applied to prod**:
1. `20260502210353_phase_4_5_school_merge_requests.sql`
2. `20260502215604_phase_4_7b_1_school_admin_role.sql`
3. `20260502221646_phase_4_7b_2_school_invitations.sql`
4. `20260502223059_phase_4_7b_3_tier_gate_leak_surfaces.sql`
5. `20260502224119_phase_4_6_unit_use_requests.sql`
6. `20260502230242_phase_4_8_schools_settings_columns.sql`
7. `20260502231455_phase_4_8b_freemium_seams.sql`
8. `20260502233618_phase_4_9_dept_head_triggers.sql`

Plus the NIS tier flip + Gmail-Matt detach as ops changes.

**RLS coverage**: clean. 111 → 114 tables (+3 from part 2: school_merge_requests, school_invitations, unit_use_requests). All have RLS + policies.

**Next**: Phase 5 (Privacy & Compliance — audit log infrastructure + AI budget cascade + data export/delete + retention cron + cost-alert + Sentry PII scrub) → Phase 6 (Cutover & Cleanup) → Checkpoint A7 PILOT-READY. Total to PILOT-READY ~5-6 days.

---

## 2026-05-04 — Access Model v2 Phase 5 SHIPPED + Checkpoint A6 READY (~150 min, 9 commits)

**Branch**: `access-model-v2-phase-5` (10 commits ahead of `v0.4-phase-4-closed`, local-only — awaiting Matt's manual smoke before merge).

**Sub-phases shipped**: 5.0 (scaffolds + runbook skeleton) → 5.1 (logAuditEvent wrapper, 3-mode failure, 12 retrofits) → 5.1d (audit-coverage CI gate, visibility-only) → 5.2 (AI budget cascade resolver + atomic SQL helper) → 5.3 (withAIBudget middleware + 3 student AI routes wired) → 5.3d (budget-coverage CI gate, gating from day one) → 5.4 (data-subject endpoints + scheduled_deletions table) → 5.5 (retention cron + scheduled-hard-delete cron) → 5.6 (teacher audit-log view) → 5.7 (cost-alert + Sentry PII scrub runbooks) → 5.8 (registry sync + close-out).

**Tests**: 3291 → **3495** (+204), 11 skipped. tsc strict 0 errors throughout.

**Migrations**: 2 (`phase_5_2_atomic_ai_budget_increment` applied to prod; `phase_5_4_scheduled_deletions` PENDING apply by Matt).

**Q1–Q7 resolutions** (signed off 3 May 2026 PM): tier defaults code-constants + admin_settings runtime override; 3-mode audit failure semantics ('throw' / 'soft-warn' / 'soft-sentry'); Q3+Q6 collapsed into the budget-coverage scanner; per-table cascade fan-out; `scheduled_deletions` table (not query-based); budget-coverage CI gate gating from day one; strict timestamp-based retention with held-row + indefinite-column guards.

**FUs filed during Phase 5 (4 new)**: FU-AV2-AI-BUDGET-EXHAUSTED-EMAIL P3, FU-AV2-AI-BUDGET-WIRE-TOOL-SESSIONS-AND-OTHER-AI P2, FU-AV2-AUDIT-MISSING-PHASE-6-CATCHUP P2 (228 inherited routes, Phase 6 cutover natural seam), FU-AV2-CRON-SCHEDULER-WIRE P2 (pre-pilot — needed before first DSR delete).

**Brief vs. reality drift recorded**: brief named 4 routes for §5.3; `safety/check-requirements` is GET-only (no AI) → 3 wired. Brief named 9 retrofit sites for §5.1; grep found 12 (Phase 4.6's `unit-use-requests.ts` × 2 missed; folded in per Lesson #60). Brief said `can.ts:96` TODO emits audit; redesigned as no-emit with comment (per-permission-check audit would explode the table).

**Coverage scanners (new)**: `audit-coverage` visibility-only (4 covered + 1 skipped + 228 inherited); `ai-budget-coverage` gating from day one (3/3 covered).

**Lessons applied**: #34/#38/#39/#41/#43-46/#54/#59/#60/#61/#64/#66 throughout. Two NCs caught real test weaknesses (regex breadth in §5.2 migration test, action-string mutation in §5.4 delete-student).

**Pending Matt actions before A6 sign-off + merge**:
1. Apply migration `20260503143034_phase_5_4_scheduled_deletions.sql` to prod
2. Smoke-test `/api/v1/student/[id]/export` + DELETE on a test student
3. Cost-alert fire drill per `docs/security/cost-alert-fire-drill.md`
4. Sentry PII scrub verification per `docs/security/sentry-pii-scrub-procedure.md`
5. Sign off Checkpoint A6 + merge to main + tag `v0.5-phase-5-closed`

**Next**: Phase 6 (Cutover & Cleanup — `/api/v1/*` rename pass, ADRs 003/011/012/013, registry sync, RLS-no-policy doc, 3-Matts merge decision, ~2-3 days, Checkpoint A7 PILOT-READY).

---

## 4 May 2026 (late night CST) — Lever 1 (slot fields) SHIPPED + merged to main

**Session goal:** Refactor activity prompts from a single markdown blob into three structured fields — `framing` / `task` / `success_signal` — across schema → AI generation → editor → renderer → ~9 downstream readers. The Toddle pattern. Structural unlock for Levers 2–5 (lints, voice/personality, exemplar contrast, sequencing intuition).

**Outcome:** ✅ ALL 9 SUB-PHASES SHIPPED + merged to main as PR #17 at `5373ea7`. Smoke verified live on studioloom.org with three-box `SlotFieldEditor` rendering correctly, char-count caps working (200/800/200), seeded values pre-filled, hybrid composition (muted framing → bold task → 🎯 success_signal) on student preview.

**Commits (11 on feature branch + 2 merges + 1 PR-merge):**

| Commit | Sub-phase | Notes |
|---|---|---|
| `ebfd217` | 1A | brief + ALL-PROJECTS entry (9-sub-phase plan, named checkpoint) |
| `78b58af` | 1B | migration `20260504020826_activity_three_field_prompt.sql` adds `framing`/`task`/`success_signal`/`backfill_needs_review` to `activity_blocks`; APPLIED TO PROD; sandbox INSERT/SELECT verified |
| `d537f97` | 1C-rev | AI-rewrite Teaching Moves to v2 shape via Sonnet 4.5 `tool_use`; 55 rows reseeded with 100% v2 coverage; content_fingerprint stable |
| `13b22d3` | 1D | API read/write 3 fields + per-field validation (200/800/200 caps) + `X-Lever-1-Deprecated` response header; +33 tests |
| `d1c8cdd` | 1E | `ComposedPrompt` renderer (hybrid spec) + ActivityCard mount + PDF mount; +19 tests |
| `c942283` | 1F | three-box `SlotFieldEditor` in lesson-editor + Preview composes via student renderer; +5 tests |
| `0b632ae` | 1G | AI generation rewrite — 3 schemas (page/journey/timeline) + system prompts + stage3 + output-adapter + pipeline + dual ActivityBlock types; +19 tests; pattern bug per Lesson #39 — fixed all 3 schema sites in one commit |
| `4e4101c` | 1H | sweep ~9 components + ~7 helpers (lesson-tiles, edit-tracker, knowledge/chunk, timing-validation, infer-bloom, activity-library, design-assistant) to use `composedPromptText`; CLOSED 1G validator regression in BOTH `validateGeneratedPages` + `validateTimelineActivities` (would have rejected every v2 generation); widened helper to structural `SlotBearing` shape; +24 tests |
| `d2f784b` | 1I | registry sync (api-registry, ai-call-sites, schema-registry, WIRING) + 2 WIRING drift items fixed (`activity-blocks.key_files` pointed to non-existent `src/lib/blocks/block-{service,ranking}.ts`; `unit-editor.key_files` pointed to non-existent `src/lib/hooks/useLessonEditor.ts`) |
| `50ddc1a` | seed | `scripts/lever-1/seed-test-unit.sql` smoke fixture (3 lessons × 4 sections covering full v2 / legacy-only / partial-slots / content-only) |
| `91600d2` | seed | pre-fill seed for `mattburton@nanjing-school.com` + full `https://studioloom.org/...` URLs in output |
| `28abf78` | FU | `FU-LESSON-EDITOR-AUTO-PINNED-SKILL` (P2) filed in `dimensions3-followups.md` |
| `235d597`, `2b39994` | merge | feature branch resolved 2 rounds of conflicts with main (preflight session committing in parallel) |
| `5373ea7` | PR #17 merge to main | Lever 1 lands |

**Tests:** 3494 → 3630 (+136, 0 regressions, tsc strict clean throughout).

**Migration on prod:** `20260504020826_activity_three_field_prompt.sql` — applied during 1B, sandbox-verified with INSERT/SELECT exact-value assertions.

**Smoke walkthrough (live on studioloom.org):**
- ✅ Phase 0.5 lesson editor mounted on seeded class-assigned unit
- ✅ Three labelled textareas (Framing / Task / Success signal) — NOT one big prompt textarea
- ✅ Char counts visible (108/200, 245/800, 57/200) per cap config
- ✅ All three slots prefilled with seeded values
- ✅ Legacy-only section (L1.S2) renders via MarkdownPrompt fallback
- ✅ Partial-slots section (L2.S3) composes correctly with the gap
- ✅ Content-only sections (L1.S3 / L3.S1) render with `contentStyle` warning/practical
- ✅ Tile labels read framing first sentence
- ✅ Hybrid composition on student preview (muted/bold/🎯)

**Follow-ups filed during this session:**
- `FU-LESSON-EDITOR-AUTO-PINNED-SKILL` (P2) — lesson editor mounts a default "3D Printing: basic setup" skill on freshly-seeded lessons regardless of class topic. Not Lever 1 territory; picks up alongside Phase 0.5 editor cleanup.
- `FU-PROD-MIGRATION-BACKLOG-AUDIT` (P1, informal — should be promoted to formal FU) — surfaced during seed: prod is missing migration 051 (`unit_type`) + much of Access Model v2 schema (`school_id`, `code`, etc.). Repo migrations have drifted hard from prod. Sister to existing FU-EE.
- `FU-LEVER-1-SEED-IDEMPOTENT` (P3) — seed script's units INSERT lacks `WHERE NOT EXISTS` guard; re-running creates duplicate units (Matt got 2 during smoke). Trivial fix.

**Lessons added to `docs/lessons-learned.md`:**
- **#67** — Tool-schema changes need matching validator changes; pattern-bug companion to #39 + #54
- **#68** — Repo migration files ≠ applied prod schema; probe `information_schema.columns` before any seed/INSERT
- **#69** — Triggers can hang seed scripts; bypass with `SET LOCAL session_replication_role = 'replica'` for fixtures
- **#70** — When smoke surface IS deployed UI, push to feature branch → Vercel preview → smoke → main (don't let push-discipline starve a legitimate smoke)

**Decisions logged in `docs/decisions-log.md`:**
- Three structured slots, not one blob (Toddle pattern; structural unlock for Levers 2–5)
- Composed-prompt-from-slots pattern preserved through transition (legacy `prompt` NOT NULL kept; 1J cleanup gated on 30-day soak)
- AI rewrite via Sonnet `tool_use` over heuristic split for Teaching Moves backfill
- `composedPromptText` widened to structural `SlotBearing` shape
- Validator strategy: accept slots OR legacy, compose `prompt` from slots for back-compat
- Smoke-via-Vercel-preview when checkpoint surface is deployed UI

**Systems affected:**
- `activity-blocks` — 4 new columns, 55 rows reseeded, key_files updated in WIRING
- `unit-editor` — `SlotFieldEditor` replaces single-textarea prompt block; key_files updated in WIRING
- `generation-pipeline` — 3 schemas (page/journey/timeline) + system prompts + stage3 + output-adapter all rewired for slot fields
- `lesson-pulse` (read-side) — composes via `composedPromptText` (no algorithm change)
- `grading` — tile titles compose via `composedPromptText`
- `knowledge-pipeline` — `chunkUnitPage` composes activity text from slots for RAG
- `student-renderer` (`ActivityCard`, `ExportPagePdf`) — hybrid `ComposedPrompt` mounts

**WIRING updates:** `activity-blocks` + `unit-editor` entries refreshed (file paths, summary, change_impacts, future_needs). Schema-registry `activity_blocks` columns + 2 dated `spec_drift` entries.

**What's next (Matt to choose):**
1. **Lever 0 — Manual Unit Builder + AI Wizard Deprecation** — port the rigorous CBCI + Structure-of-Process + Paul-Elder unit planner from studioloom.org/unitplanner; deprecate the existing 3-lane wizard once the new builder writes three-slot output natively. ~5–7 days, brief pending.
2. **`FU-PROD-MIGRATION-BACKLOG-AUDIT`** (P1) — surfaced during smoke; prod is missing migration 051 + much of Access Model v2 schema. Worth auditing what's actually applied vs what code assumes before next push.
3. **Levers 2–5** (lints, voice/personality, exemplar contrast, sequencing intuition) — all unlocked by Lever 1's structured payload, can land any time.

---

## 4 May 2026 (late evening CST) — Lever-MM (NM block category in unit editor) SHIPPED + merged to main

**Session goal:** Move New Metrics configuration out of the awkward class-settings Metrics tab and into the Phase 0.5 lesson editor's block palette as a new "New Metrics" category. Click an element → chip lands at top of current lesson card. Class-settings tab keeps results panel but loses the config wizard.

**Outcome:** ✅ ALL 7 SUB-PHASES SHIPPED + merged to main as PR #19 at `7a91e08`. Built ahead of Matt's Wednesday-class deadline (1-day buffer).

**Commits (8 on feature branch + 1 PR-merge):**

| Commit | Sub-phase | Notes |
|---|---|---|
| `d58e7ca` | MM.0A | brief + design sign-off (1=A chip-on-lesson, 2=A selector-in-palette-header, 3=tab-stays-as-results) + `FU-NM-SCHOOL-ADMIN-CENTRALIZATION` (P2) filed |
| `8ed0199` | MM.0B | `"new_metrics"` BlockCategory + gold-dot CATEGORIES entry + `buildNmElementBlocks` factory + LessonEditor fetches nm_config + passes via customBlocks. Click kill-switch on NM blocks (throwing create() stub guards against junk-section creation through the regular onAddBlock path) |
| `6b0995e` | MM.0C | click-to-add (idempotent + bootstraps enabled flag + competencies/elements arrays) + chip strip at top of lesson card + × remove (zombie-pageId guard). PaletteBlock refactored to be NM-aware: skip create() probe for NM blocks (which throws), draggable={!isNmBlock}, "✓ added" / "+ add" badge state |
| `141f0a5` | MM.0D | competency selector inside the New Metrics accordion + activeCategories filter fix so the accordion stays visible when competency has no elements (otherwise the selector becomes inaccessible — caught during build) |
| `f50968a` | MM.0E | NMConfigPanel unmounted from class-settings tab + banner pointing teachers to the editor + NMResultsPanel preserved. NMConfigPanel.tsx file kept in repo for potential reuse |
| `cbb6184` | MM.0F | refactor pure logic out of React for testability: `lib/nm/checkpoint-ops.ts` (addCheckpoint / removeCheckpoint / setCompetency, immutable, reference-equal no-op for idempotency detection) + extract `buildNmElementBlocks` into pure `nm-element-blocks.ts` (vitest can't transform JSX-bearing .tsx in default config; pure .ts is testable). +30 tests covering all idempotency, zombie-pageId guards, orphan-element rules, round-trip behaviour |
| `0fee582` | MM.0G | WIRING.yaml unit-editor entry refreshed (key_files +4, depends_on/affects +nm-system, future_needs lists Lever-MM v2 candidates, change_impacts notes `lib/nm/checkpoint-ops.ts` is the canonical contract) |
| `7a91e08` | PR #19 merge | Lever-MM lands on main |

**Tests:** 3630 → 3660 (+30, 0 regressions, tsc strict clean throughout).

**No migration.** Existing `class_units.nm_config` JSONB column reused.
**No new API routes.** Existing `/api/teacher/nm-config` POST reused.
**No new tables.**

**Smoke walkthrough plan** (against Vercel preview that built from PR #19):
- Editor → Blocks pane → "New Metrics" gold-dot accordion visible (when `use_new_metrics === true`)
- Inside accordion: competency selector + element list with "+ add" badges
- Click element → chip with 🎯 + element name + × at top of lesson card; reload persists
- Click × → chip removes + persists
- Switch to a competency with no elements → empty-state hint; existing chips remain
- Class-settings Metrics tab → renamed banner + NMResultsPanel only (no config wizard)
- Disable `use_new_metrics` → category disappears from palette + class-settings shows disabled-state card

(Smoke verified by Matt before merge — said "merge" so we shipped.)

**Stop triggers verified NOT tripped:**
- ✓ Privacy gate intact (only renders when `use_new_metrics === true`)
- ✓ No silent save failures (try/catch with revert + console.error)
- ✓ No zombie pageIds (deleted when elements would go empty — covered by 2 tests)
- ✓ Idempotent add (covered by reference-equal no-op test)
- ✓ Student-facing surfaces unchanged (same `nm_config.checkpoints` shape, untouched code paths)
- ✓ Test count UP (+30), not down

**Lessons banked:** see #71 (Pure logic extraction from .tsx for vitest testability — recurring pattern, documented for future cases).

**Decisions logged:** see Lever-MM section in decisions-log.md.

**Follow-ups filed:**
- `FU-NM-SCHOOL-ADMIN-CENTRALIZATION` (P2) — school-level toggle + principal-facing centralised dashboard. Real product capability, multi-day, gated on Access Model v2 Phase 6 closure (school-admin role).
- `FU-LEVER-MM-DRAG-AND-DROP` (P3, informal) — drag-and-drop NM elements onto lesson tiles instead of click-only. Out of scope for v1, click-only sufficed.
- `FU-LEVER-MM-MULTI-COMPETENCY` (P3, informal) — multi-competency-per-unit. v1 supports one; would require expanding the selector to multi-select + filter logic on element list.

**Systems affected:**
- `unit-editor` — gained New Metrics block category + chip strip + competency selector. `BlockPalette.tsx` split into 3 modules (.tsx + .types.ts + nm-element-blocks.ts).
- `nm-system` — now READ + WRITTEN from the lesson editor (was read-only before). Pure state-transition module at `lib/nm/checkpoint-ops.ts` is the canonical contract for `nm_config` mutations.

**WIRING updates:** `unit-editor` entry — depends_on/affects gain "nm-system"; key_files +4; future_needs lists v2 candidates; change_impacts notes the canonical-contract module.

**What's next (Matt to choose):**
1. Use Lever-MM in Wednesday's class (the actual deadline that motivated this)
2. **Lever 0 — Manual Unit Builder + AI Wizard Deprecation** (still pending, brief due) — port studioloom.org/unitplanner
3. `FU-NM-SCHOOL-ADMIN-CENTRALIZATION` (P2) — needs Access Model v2 Phase 6 first
4. `FU-PROD-MIGRATION-BACKLOG-AUDIT` (P1) — Lever 1 surfaced this; still open
5. **Levers 2–5** (lints, voice/personality, exemplar contrast, sequencing intuition)

**Build velocity:** ~5 hours wall-clock from brief sign-off to merged PR. The pure-logic-extraction pattern (Lesson #71) added ~30 minutes but bought 30 tests of regression coverage on the hairy state transitions — net positive given the data is per-class and Wednesday classes will be writing to it.

---

## 5 May 2026 (early morning CST) — Lever-MM smoke gap + Tasks v1 prototype + Task System Architecture brief — all merged to main

**Session goal:** Close out Lever-MM's preview-banner gap, then run the architectural-decision conversation that the next-big-thing build needs (tasks-grading + Lever 0 + ManageBac export + structured-vs-inquiry boundary). Land verdict in a Claude Design probe + a unified architectural brief.

**Outcome:** ✅ THREE PRs MERGED to main. Documentation-heavy session — locks the architectural decision moment for the next ~16-day build phase without any code change.

**Commits / PRs (this session):**

| Commit / PR | Scope |
|---|---|
| `35ecc9d` | Preview banner — read-only NM checkpoint display in teacher preview (closes Matt's smoke-gap question post-Lever-MM merge) |
| PR #21 → `1972dda` | Tasks v1 prototype — Claude Design handoff bundle landed at `docs/prototypes/tasks-v1/` with verdict (split surfaces, unified data) and three named friction moments |
| PR #23 → `2a948a3` | Task System Architecture brief — 855-line architectural decision moment locking schema + UX direction |

**Tests:** 3660 → 3700 (+40, parallel-session work absorbed; 0 regressions from this session — pure docs).

**Architectural decisions banked in `decisions-log.md`** (see entries dated 5 May 2026):

1. Unified `assessment_tasks` primitive over separate summative_tasks
2. SPLIT teacher UI surfaces (inline-row formative + 5-tab summative)
3. NM checkpoints stay PARALLEL to assessment_tasks
4. ManageBac as EXPORT-NOT-INTEGRATION
5. Three-layer architecture (shared infra + Layer 2 PM tools + mode-specific concrete)
6. Polymorphic `submissions.source_kind` for inquiry-mode future-proofing
7. G1 grading code rolls forward (not ripped out), parented to tasks via `task_id` FK

**Independent reviews completed:** Cowork + Gemini both confirmed Option A (unified data primitive). Cowork pushed back on spec details — 7 spec corrections applied (submissions split out, weight on criterion-task edge, page_ids → join table, JSONB config for type-specific, version-based resubmissions, cross-unit support, peer/self deferred).

**Tasks v1 prototype outputs:**
- 3 artboards in one HTML canvas (unified surface, split surfaces, decision panel)
- Decision panel argues from 3 named teacher-friction moments (Ms. Okafor 11:42am, Mr. Patel Sunday 8pm, first-year MYP teacher writing GRASPS)
- Verbatim verdict: *"Ship split surfaces. Underneath, both still write to assessment_tasks. The discriminator earns its keep at query time, not at create time."*
- Located at `docs/prototypes/tasks-v1/`, matches existing `docs/prototypes/grading-v2/` pattern

**Task System Architecture brief contents:**
- 855 lines covering: scope (in/out), three-layer architecture, Tasks v1 verdict, Cowork/Gemini review summary, full SQL schema with all 7 corrections applied, teacher UI (split surfaces), student UI (submission with self-assessment gate), ManageBac export (file-as-artifact pattern), NM-stays-parallel rationale, backfill plan for ~62 existing single-grade rows, G1 disposition (roll forward with task_id FK), 11-phase sequence (TG.0A-K), pre-flight ritual (Lessons #67-#71 cited), 7 open questions for sign-off, reading order
- Replaces `docs/projects/grading-phase-g1-brief.md` (G1 was a 3-day cut that explicitly sidestepped the assessment_tasks question)
- Sister briefs flagged as placeholder: `docs/projects/inquiry-mode-architecture.md` (PYP/PP/Service), `docs/projects/pm-tools-layer.md` (Layer 2), `docs/projects/manual-unit-designer.md` (Lever 0)

**Build estimate:** ~16 days end-to-end. After **TG.0B (schema lock)**, Lever 0 (manual unit designer) can start in parallel — both consume the locked schema.

**Systems affected:** None directly (pure docs). Future-affected when build phases ship: `unit-editor` (gains Tasks panel sidebar), `grading-system` (G1 roll-forward with task FK), new `tasks-system` system to register, `manage-bac-export` adapter.

**Follow-ups filed during this session (informal in conversation, not yet in dimensions3-followups.md):**

- `FU-INQUIRY-MODE-BRIEF` — sister architectural brief for PYP / PP / Service / capstones. Multi-week project.
- `FU-LAYER-2-PM-TOOLS-BRIEF` — Layer 2 cross-mode PM tools (evidence log, milestone tracker, etc.). Built incrementally.
- `FU-MANUAL-UNIT-DESIGNER-BRIEF` — Lever 0. Already on Matt's stated priority list.
- `FU-TG-DND-LINKING` (P3) — drag-and-drop section-to-task linking instead of click-to-link.

**No new lessons banked this session** — the architectural conversation surfaced design-decisions, not lessons-learned discoveries. Lessons #67-#71 from earlier today (Lever 1 + Lever-MM) remain the latest.

**What's next (Matt to decide):**
1. Get sign-off on the brief's 7 open questions (most are "yes per conversation; confirm")
2. Move into TG.0B schema migration (~1 day; gates Lever 0)
3. After TG.0B: Lever 0 build + tasks-grading build run in parallel

**Build velocity for the day** (counting Lever 1 + Lever-MM + Tasks v1 prototype + Task System Architecture brief): two complete features end-to-end (Lever 1 schema-through-readers + Lever-MM block category) + one design probe + one architectural decision moment locked. ~12-14 hours wall-clock. Net tests +166. Three PRs to main. Zero regressions.

## 8 May 2026 (afternoon CST) — Admin Cost & Usage rebuild + Report Writer PII anonymization

**Three small PRs landed:**

| Commit / PR | Scope |
|---|---|
| [`b48fbfa`](https://github.com/mattburto-spec/studioloom/pull/133) → PR #133 | `feat(admin): rebuild Cost & Usage as spend-by-endpoint view` — replaced broken per-teacher view (was reading empty `cost_rollups`, 500ing) with unified spend-by-endpoint surface pulling from `ai_usage_log`. Period selector adds **today** (Asia/Shanghai timezone boundary). 4 KPI cards, 4-card attribution split (student/teacher/anonymous/lib), sortable endpoint table with attribution chips. JS aggregation under 50k row cap; documented next move is a SECURITY DEFINER GROUP BY RPC if volume exceeds. |
| [`9259185`](https://github.com/mattburto-spec/studioloom/pull/134) → PR #134 | `fix(tools): anonymize student names before sending Report Writer prompts to Anthropic` — substitute teacher-provided name with `Student` placeholder before prompt goes to Anthropic, restore on response with capital-S whole-word replace. Audit confirmed only 2 of ~35 AI call sites were leaking names (both Report Writer routes); design assistant, mentor, toolkit tools, lesson editor AI fields, etc. already send no names. |
| [`f45edf7`](https://github.com/mattburto-spec/studioloom/pull/136) → PR #136 | `chore(usage): drop student firstName from bulk Report Writer ai_usage_log metadata` — companion to #134; `metadata.batchStudent` was only useful for per-student debugging in batch runs and isn't worth the PII footprint in our own logs. |

**Findings logged but no code action needed:**

- **Lib attribution = 0% on Cost & Usage** — Explore audit confirmed all `src/lib/{ingestion,pipeline,knowledge,...}` callsites correctly use `lib/` prefix and skip teacher/student attribution. The 0% just reflects no unit-builds or ingestion ran during the 7d window (pilot + kanban + admin work doesn't trigger them). Infrastructure is correct.
- **`/api/teacher/wizard-suggest` shows old `/api/` prefix** — pre-PR-#125 historical rows still in the 7d window. PR #125's commit message explicitly says "Older rows in ai_usage_log are left as-is — historical only." By design.

**Decisions banked** (`docs/decisions-log.md`):
- Anthropic privacy stance: of ~35 AI call sites, Report Writer is the only one that needed name anonymization. The substitute-then-restore pattern (placeholder outbound, regex replace on response) is the canonical approach when teacher-provided PII has to round-trip through an LLM.
- Cost & Usage v1: JS aggregation under 50k row cap is sufficient at current volumes; defer SECURITY DEFINER GROUP BY RPC until volume forces it. Surface a `truncated` flag in the response so the UI can warn if the cap is hit.

**Lessons learned:** None banked — all session work was within established patterns.

**Tests:** No net change (these are small route-level changes; no new test files added).

**Cleanup:** Stale `task-system-architecture-oq-resolution` remote branch deleted — its one unique commit was already on main under a different SHA (rebase showed it as a skipped cherry-pick), and its Vercel preview was timing out at 45min on the build flake. No code lost.

**Registry sync (this saveme):**
- `api-registry.yaml` updated — `/api/admin/cost-usage` now reads `ai_usage_log` (was reading the empty `cost_rollups` + `generation_runs` + `admin_settings`).
- `vendors.yaml` Anthropic entry got a notes addendum documenting the Report Writer substitute/restore pattern.
- `ai-call-sites.yaml`: no diff (callsite endpoints unchanged).
- `feature-flags.json`: drift unchanged from last session (FU-CC tracks `SENTRY_AUTH_TOKEN` orphan; `RUN_E2E` missing is a known no-op CI flag).
- `vendors.json`: ok. `rls-coverage.json`: clean.

**Systems affected:** `cost-usage-admin` (rebuilt) + `report-writer` (anonymization). No system-level pivots; WIRING.yaml unchanged.

## 11 May 2026 (afternoon CST) — Student-creation incident closed + prod-migration-backlog audit scoped

**Incident:** Teacher add-student via `/teacher/classes/[classId]` returned 500 with `Failed to provision student auth — please retry`. Traced through Vercel logs → Supabase auth logs → `relation "teachers" does not exist (SQLSTATE 42P01)`. Root cause: `handle_new_teacher` trigger in prod was running migration-001's buggy version (unqualified `teachers`, no `search_path`, no `EXCEPTION` block). Three repo migrations that fixed this (`20260501103415`, `20260502102745`, `20260502105711`) had never been applied to prod. Bug went undetected for 12 days — every auth.users INSERT since Phase 1.1d on 29 April was failing silently because the client modal swallowed the 500 with `if (!res.ok) return`.

**Mitigation:** Hand-patched `handle_new_teacher` in prod via Supabase SQL Editor (~08:30 UTC) — replaced with the full safe version (student `user_type` guard + `public.teachers` qualifier + `SET search_path = public, pg_temp` + `EXCEPTION WHEN others`). Verified by adding student "MC" successfully. Cleanly codified as new repo migration so prod and repo agree.

**PR shipped:**
- [`#178`](https://github.com/mattburto-spec/studioloom/pull/178) `fix: unblock student creation (codify trigger hotfix + surface server errors)` — two commits:
  - `86a2ba9` New migration `20260511085324_handpatch_handle_new_teacher_skip_students_search_path.sql` — the SQL applied by hand, with `DO $$` sanity check asserting all four safety properties.
  - `ec58b2a` `fix(teacher/classes): surface server error on failed single-add student` — the single-add modal at `src/app/teacher/classes/[classId]/page.tsx` was the only of three add-student callsites that silently swallowed errors. Added `addError` state + red banner display, clears on input change, mode switch, modal close.

**Discovery during the trace — severity upgraded:** Probed `supabase_migrations.schema_migrations` to find what was applied; the table doesn't exist. Only Supabase's internal trackers (`auth.schema_migrations`, `storage.migrations`, `realtime.schema_migrations`) exist. **Prod has NO application-level migration tracking at all.** Migrations in `supabase/migrations/*.sql` have been applied by hand for 18 months with no record. Every future migration is gambling on assumed prior state. Existing follow-up `FU-PROD-MIGRATION-BACKLOG-AUDIT` (P1) upgraded from "registry might be wrong" to "we have no idea what's applied".

**Bucket 3 verification (data check post-hotfix):**
- Students created since 29 Apr with `user_id IS NULL`: **0 rows** — no stuck students from the broken window.
- Prod `handle_new_teacher` body re-probed: confirmed patched version live.

**Audit brief filed:** [`docs/projects/prod-migration-backlog-audit-brief.md`](projects/prod-migration-backlog-audit-brief.md) — 7-phase plan (A Enumerate → B Probe → C Categorise → D Apply → E Tracking table → F Tooling → G Close-out), named Matt Checkpoints, fresh worktree recommended (`questerra-migration-audit`), `public.applied_migrations` table proposed as end-state so this drift class cannot recur.

**Decisions banked** (`docs/decisions-log.md`): none new — applying existing build-methodology discipline to the audit.

**Lessons banked** (`docs/lessons-learned.md`):
- **Lesson #83** — Prod has NO application migration tracking table; assume nothing about applied state. Generalises Lessons #65 (old triggers don't know about new user types) and #66 (re-apply search_path lockdown on every function rewrite) — both of those fixes silently failed to land in prod for the same reason. Adds probe-first discipline + the end-state design for a tracking table.

**Tests:** No net change in this session — Bucket 2 change to `page.tsx` is small enough to merit code review over new test infrastructure; recommended manual smoke is in the PR test plan.

**Registry sync (this saveme):**
- `api-registry.yaml`: 1 new route picked up (`/api/teacher/upload-image` from PR #174, prior session).
- `ai-call-sites.yaml`: no diff.
- `feature-flags.json`: drift unchanged from last session.
- `vendors.json`: ok. `rls-coverage.json`: clean (124/124).
- `schema-registry.yaml`: NOT touched — `handle_new_teacher` is a function not a table, no row to update. Migration 20260511085324 noted in `dimensions3-followups.md` under FU-PROD-MIGRATION-BACKLOG-AUDIT instead.

**Systems affected:** `auth-system` (handle_new_teacher trigger fixed). No WIRING.yaml change — system entry is current.

**What's next:** Audit per the brief. Open questions for Matt at the bottom of the brief — answer before Phase A begins. Recommend dedicated session in fresh worktree, half-day to full-day block.

## 11 May 2026 (evening CST) — Prod migration backlog audit CLOSED in one session

**Outcome:** All 7 phases (A→G) of `prod-migration-backlog-audit-brief.md` shipped in a single session, same-day as the morning's student-creation incident. Audit revealed drift was **1 missing admin_settings row**, not "~10+ missing migrations" as originally feared.

**Phases:**
- **A — Enumerate:** 83 migrations since 1 Apr 2026 catalogued with one probe SQL each. Truth doc at [`docs/projects/prod-migration-backlog-audit-2026-05-11-truth.md`](projects/prod-migration-backlog-audit-2026-05-11-truth.md). Checkpoint A.1 PASSED.
- **B — Probe:** Single CTE with 83 UNION-ALL probes run in Supabase SQL Editor (no RLS). 77/83 returned true on first run. 4 false-negatives investigated via re-probe ([`prod-migration-backlog-audit-2026-05-11-probes-review.sql`](projects/prod-migration-backlog-audit-2026-05-11-probes-review.sql)) — 3 were probe-name bugs (missed `'auth.'` / `'school.'` prefixes on admin_settings keys) or stale-policy-on-dropped-table; only 1 genuine APPLY remained.
- **C — Categorise:** 76 APPLIED, 4 SKIP-EQUIVALENT (#5 labs renamed, #43/#53/#54 superseded by #83 handpatch), 2 RETIRE (#33 policy on dropped table, #48 empty stub), 1 APPLY (#49 governance_engine_rollout). Checkpoint B.1 + C.1 PASSED combined.
- **D — Apply:** Single INSERT for `admin_settings('school.governance_engine_rollout','true'::jsonb)`. Verified live.
- **E — Tracker:** Created `public.applied_migrations` table (name PK, applied_at, applied_by, source CHECK enum, notes), RLS platform-admin-only. Backfilled 81 rows (79 backfill + 1 hand-patch + 1 manual). Verified via `phase_e_source_breakdown` SELECT.
- **F — Tooling:**
  - New `scripts/migrations/check-applied.sh` — diffs repo migrations against tracker. Dual-mode (psql with `DATABASE_URL`, or print-SQL fallback). Hardcodes 2 retired migrations.
  - `scripts/migrations/new-migration.sh` extended with apply-reminder banner printing the INSERT INTO applied_migrations template after every mint.
- **G — Close-out:**
  - `CLAUDE.md` "Migration discipline" section gets permanent 3-mandate block (per-apply INSERT, saveme drift check, trigger phrases).
  - Saveme step 11(h) added — runs `check-applied.sh` every saveme.
  - "Prod migration backlog audit — active build plan" section removed from CLAUDE.md (audit closed).
  - FU-PROD-MIGRATION-BACKLOG-AUDIT marked ✅ RESOLVED.
  - Filed FU-AUDIT-PASS4-CLASSES-DEFAULT-LAB (P3) for small Pass 4 gap in fabrication_labs backfill.
  - Filed FU-MIGRATION-CI-CHECK (P2) for optional GitHub Action PR-time drift block (last 1% of bulletproofing).
  - Interim apply log deleted; tracker table is now authoritative.

**Result:** the bug class that started this session — *"repo migration silently fails to land in prod; gap detected 12 days later via user error"* — is now structurally prevented. Future Claude sessions read the CLAUDE.md mandate, log every apply, saveme catches any misses, and the optional FU-MIGRATION-CI-CHECK can add CI enforcement when needed.

**PR #178 — 9 commits, merged to main this session.** Pre-merge collision check confirmed safe.

**Decisions banked** (`docs/decisions-log.md`): none new — applied existing build-methodology discipline.

**Lessons banked** (`docs/lessons-learned.md`): Lesson #83 from morning incident already covers this.

**Tests:** No npm test changes; tooling changes are bash + SQL. Verified by running `check-applied.sh` (clean) + `verify-no-collision.sh` (no collisions) before merge.

**Registry sync (this saveme):**
- All scanners already run in earlier saveme this session; no new code changes between then and now.
- `schema-registry.yaml` will pick up `public.applied_migrations` table in next saveme run (manual addition pending).

**Systems affected:** `migration-discipline` (new tracker table + 2 scripts). WIRING.yaml could get a new entry for this in next saveme; deferred since it's tooling not application surface.

**What's next:** Optional FU-MIGRATION-CI-CHECK (P2, ~1-2 hr GitHub Action). Otherwise, audit is fully closed. Return to ordinary build work — Lever 0 / Lever 2-5 / Open Studio v2 / etc.

## 12 May 2026 (CST) — Choice Cards Activity Block v1 SHIPPED end-to-end

**Context:** Matt deferred G8's StudioLoom debut by one class to ship this properly. G8 cohort picks one of 6 project briefs for the unit kickoff. Reusable Activity Block — future consumers: pathway choices, designer mentors, themes, constraints, group roles. Crucially **decoupled from any specific downstream consumer** — `on_pick_action` JSONB is a structured event payload subscribers register for at runtime. Project Spec block doesn't exist yet (and isn't part of this scope) — v1 set-archetype actions are logged to `learning_events` but unconsumed.

**Pre-flight findings** (all greenlit):
- Block registration pattern: `BLOCK_LIBRARY` array in `BlockPalette.tsx` — copied the v2 Project Spec sibling shape (product-brief/user-profile/success-criteria).
- Student dispatch: NOT a switch — series of `responseType === "..."` JSX branches in `ResponseInput.tsx`. Added a new branch after the success-criteria block.
- `learning_events` table exists (migration 106) — used for the `choice-card.picked` event row. **`FU-LEARNING-EVENTS-TABLE` NOT filed** (table exists).
- Image upload coupling — `upload-image` requires `unitId`, but Choice Cards are LIBRARY-scoped. Built a parallel route `/api/teacher/upload-choice-card-image` per decision (b).
- 266 baseline tsc errors — Phase 1–9 added zero net.

**10 commits shipped across 9 phases:**
- Phase 1 — schema migration `20260512012304_choice_cards_and_selections.sql`: 2 tables (choice_cards TEXT slug PK, choice_card_selections UUID PK), 3 RLS policies (library readable to all authenticated; teacher SELECT on selections via class_units→unit_id join; students access via service-role per Lesson #4), 4 indexes (GIN on tags + 3 lookup), updated_at trigger.
- Phase 2 — `ResponseType` union extension, `ChoiceCardsBlockConfig` interface in `BlockPalette.types.ts`, `BLOCK_LIBRARY` palette entry (collaboration/opening), 3 `Record<ResponseType,...>` maps in `ActivityBlock.tsx` filled with `choice-cards` entries.
- Phase 3a — dispatch wiring in `ResponseInput.tsx` + props thread-through in `ActivityCard.tsx`, stub `ChoiceCardsBlock`.
- Phase 4 — 5 API routes: student pick (POST), student selection (GET), teacher library (GET), teacher create (POST), teacher patch (PATCH). All gated via `requireStudentSession` / `requireTeacher`. Pitch-your-own sentinel `_pitch-your-own` handled in-route.
- Phase 3b — full Framer Motion deck: grid auto-fit min-260px, rotateY 180° flip (preserve-3d + backfaceVisibility), hover lift -8px + 1° rotate, reduced-motion crossfade fallback, focus mode on pick (chosen 1.05x, others 0.35 opacity 0.92 scale), 'Pitch your own' dashed 7th card, ARIA radiogroup, keyboard Enter/Space to flip. Bundled an extra route — `/api/student/choice-cards/deck` — missed in Phase 4 (student deck-fetch via service-role since choice_cards RLS grants TO authenticated and students use token sessions).
- Phase 5 — `ChoiceCardsConfigPanel.tsx` (layout chips Grid functional + Fan/Stack greyed, single/multi selection, pitch-your-own toggle, selected cards chip list with hover-remove) + `ChoiceCardsLibraryPicker.tsx` modal (search + 7-tag filter chips + multi-select + inline create-card form with 7 action-type options + JSON payload field).
- Phase 6 — parallel image upload route `/api/teacher/upload-choice-card-image` (no unitId, writes to `unit-images/choice-cards/{timestamp}.jpg`) + sibling `ChoiceCardImageUploadButton` integrated into the create-card form.
- Phase 7 — seed migration `20260512015124_seed_choice_cards_g8_briefs.sql`: 6 G8 brief cards (designer-mentor, studio-theme, scaffold — ships_to_platform; 1m2-space, desktop-object, board-game — physical making). All image_url NULL; emoji + bg_color fallback. Matt uploads real images this week.
- Phase 8 — `src/lib/choice-cards/action-dispatcher.ts`: typed `ChoiceCardAction` discriminated union (7 types), `parseChoiceCardAction` loose coercion, in-memory subscriber registry (`registerChoiceCardSubscriber`), `dispatchCardAction` (writes `learning_events` row + notifies subscribers). Pick route wired to dispatch after selection write.
- Phase 9 — registry sync: api-registry +7 routes (458→465), schema-registry +2 tables, WIRING +1 system (`choice-cards-block`), `docs/projects/choice-cards-followups.md` filed.

**Decisions banked:**
- Card slug TEXT primary key (not UUID) for human-readable handles like `g8-brief-designer-mentor`. UUID selection-row PK bridges to `learning_events.subject_id`.
- `learning_events` subject_type=`choice_card_selection`, subject_id=selection.id (uuid), card slug in payload. Keeps learning_events schema clean.
- Decoupled from Project Spec by design — dispatcher is the seam.
- Parallel image upload route, not extension — Choice Cards are library-scoped not unit-scoped.
- Students access via service-role API (Lesson #4 — token sessions, not Supabase auth.uid). No student-side RLS policies needed.
- Lesson #29 NULL class_id fallback NOT needed for `choice_card_selections` — teacher policy routes through `unit_id`, not `class_id`.

**Tests:** Baseline 5457 passing / 11 skipped / 0 failing (npm test before Phase 1). No new tests added in v1 — `FU-CCB-PROJECT-SPEC-WIRE` follow-up will gain its own tests when wired. Tsc baseline preserved (266 pre-existing errors throughout).

**Migrations pending prod apply** (Matt's call):
- `20260512012304_choice_cards_and_selections.sql`
- `20260512015124_seed_choice_cards_g8_briefs.sql`

After applying, remember to `INSERT INTO public.applied_migrations` for both (Lesson #83).

**Follow-ups filed** ([`choice-cards-followups.md`](projects/choice-cards-followups.md)):
- FU-CCB-PROJECT-SPEC-WIRE (P1) — subscribe to `set-archetype` when Project Spec block ships.
- FU-CCB-AI-IMAGE-GEN (P2)
- FU-CCB-MULTI-PICK (P2)
- FU-CCB-LAYOUT-FAN-STACK (P3)
- FU-CCB-INLINE-CARD-EDIT (P3)
- FU-CCB-CHANGE-PICK-TOGGLE (P3)

**Systems affected:** new `choice-cards-block` system (complete). Tangential: `lesson-editor` + `student-response-input` gained new branches.

**What's next:** Phase 10 — Matt Checkpoint smoke. After Matt applies migrations to prod + smoke-walks teacher unit-builder + student pick flow, push to origin/main. Then upload real card images via the lesson editor library picker.

## 12 May 2026 (CST) — Archetype-Aware Block Infrastructure + Inspiration Board v1 SHIPPED

**Context:** G8 cohort starts using Inspiration Board in Lesson 2 (next G8 class after the deferred debut). Bundled two units in one brief because they prove each other — Inspiration Board is the first archetype-aware block, and the universal infrastructure (`archetype_overrides` + `getArchetypeAwareContent` + `getStudentArchetype`) gets exercised in production from day 1 instead of sitting as a feature in search of a use case.

**Pre-flight findings:**
- Foundational docs (first-project-scaffolds.md + A11 + 3 strategy docs) were stashed at session start — popped them as Phase 0 so the brief's references resolved on main.
- `ActivitySection` lives at `src/types/index.ts:383` (JSONB-additive — no SQL migration needed).
- Student dispatch confirmed at `src/components/student/ResponseInput.tsx`.
- `/api/student/upload/route.ts` exists with the right shape (image moderation gate + responses bucket + proxy URL) — reused instead of building a parallel.
- `student_unit_product_briefs.archetype_id` is already shipped (Project Spec v2 Phase A) — added it as step 2 of `getStudentArchetype` (the "committed" source between the hypothetical project_specs and choice_card_selections).
- Existing `resolveChoiceCardPickForUnit` + `extractArchetypeId` in `src/lib/choice-cards/resolve-for-unit.ts` overlapped with the brief's proposed resolver — wrote the new resolver to compose existing primitives + 3-step fallback.
- Canonical response-save pattern audited: existing blocks call `onChange(JSON.stringify(state))` and lesson autosave persists to `student_progress.responses`. Inspiration Board follows this — no dedicated board-state route in v1.

**9 commits shipped across 8 phases (commits e07b2bc..c4619cc):**
- **Phase 0 — `3f7f919`:** Pop stashed docs (A10 + A11 in design-guidelines, first-project-scaffolds.md, 3 strategy docs).
- **Phase 1 — `870d574`:** Universal infrastructure. `ActivitySection.archetype_overrides` field, `getArchetypeAwareContent` reader (with `getArchetypeAwareContentByChain` for card-slug-first lookups), `getStudentArchetype` 3-step resolver, A12 in design-guidelines.md, 11 unit tests covering precedence + edge cases + negative control.
- **Phase 2 — `5ab5718`:** Block registration. ResponseType union extension, `InspirationBoardConfig` interface, BLOCK_LIBRARY palette entry (Response/opening, 🖼️) with 6 universal archetype overrides + 3 G8 card-slug overrides seeded, 3 LABEL/ICON/TINT records updated.
- **Phase 3a — `6804805`:** Dispatch + stub. `ResponseInputProps` gains `inspirationBoardConfig` + `section` (the full ActivitySection — needed for archetype_overrides reads in archetype-aware blocks). ActivityCard threads both. Stub component for clean tsc through Phase 4.
- **Phase 4 — `4c78bf2`:** GET `/api/student/archetype/[unitId]` — canonical client-facing read endpoint, Cache-Control private/60s.
- **Phase 3b — `e9d06a6`:** Full Pinterest-style component (~470 lines). CSS-columns masonry (no new deps), Framer Motion Reorder for drag, per-card commentary + optional steal note, locked synthesis card until min items, mark-complete gate, reduced-motion + ARIA, archetype-aware framing/task/success_signal via `getArchetypeAwareContent`.
- **Phase 5 — `97a2eb4`:** Teacher config UX. Reusable `ArchetypeOverridesEditor` (drop-in for any archetype-aware block) + Inspiration-Board-specific `InspirationBoardConfigPanel` (6 toggles + min/max + embedded overrides editor). Mounted in ActivityBlock.tsx alongside ChoiceCardsConfigPanel.
- **Phase 6 — `c4619cc`:** Resolver unit tests. 8 tests covering all 3 fallback branches + null + table-doesn't-exist + non-set-archetype actions + missing payload + negative-control precedence.
- **Phase 7 — this commit:** Registry sync + 8 follow-ups filed + WIRING +2 systems + changelog entry.

**Decisions banked:**
- Universal infrastructure landed alongside the first consumer rather than as a separate "platform" build. Avoids "feature in search of a use case" trap.
- Lazy resolve everywhere — `getStudentArchetype` is called on mount by archetype-aware blocks, never pushed by upstream sources. Same seam as Product Brief's lazy archetype pre-fill from Choice Cards last build.
- `getArchetypeAwareContent` MERGES override over base on a field-by-field basis (override.task wins, override.framing falls back to base if undefined) — partial overrides are first-class.
- Card-slug-keyed overrides exist in v1 seed data but DON'T fire yet (FU-IB-CARD-SLUG-LOOKUP P2) — only archetype-level keys match. The 3 G8 brief-specific overrides are dormant until that helper ships.
- Storage: existing autosave pattern (JSON blob in `student_progress.responses`) for v1. Dedicated table deferred (FU-IB-DEDICATED-TABLE P2).
- Image upload: reuse existing `/api/student/upload` rather than building parallel. Already has Phase 5F image moderation gate + private bucket.

**Tests:** Baseline 5543 passing / 11 skipped / 0 failing. After Phase 1: +11 archetype-aware tests. After Phase 6: +8 resolver tests. Net **+19 tests, 0 failing.** Tsc baseline preserved (266 pre-existing errors throughout).

**Migrations pending prod apply:** _None._ This build is JSONB-additive — no SQL migration in scope (per brief).

**Follow-ups filed** ([`inspiration-board-followups.md`](projects/inspiration-board-followups.md)):
- FU-IB-AI-PATTERN-SUGGESTION (P2)
- FU-IB-COMPETITOR-SCAN (P3)
- FU-IB-PINTEREST-IMPORT (P3)
- FU-IB-REUSE-FROM-PORTFOLIO (P3)
- FU-IB-CARD-SLUG-LOOKUP (P2) — known v1 limitation; G8 card-slug overrides currently dormant
- FU-IB-COMPONENT-TESTS (P2) — Framer/DOM-heavy smoke deferred
- FU-IB-DEDICATED-TABLE (P2)
- FU-AAB-OVERRIDE-VERSION-DRIFT (P2)
- FU-AAB-PROJECT-SPEC-FALLBACK (P1, conditional — activates when project_specs table ships)

**Systems affected:** 2 NEW (`archetype-aware-blocks` complete + `inspiration-board-block` complete). Tangential: `lesson-editor` + `student-response-input` gained new branches.

**What's next:** Phase 8 — Matt Checkpoint smoke. Smoke as student: pick a Choice Card → open lesson with Inspiration Board block → verify task copy adapts to archetype → upload 3+ images + synthesise → verify state hydrates on reload. Then push.

## 12 May 2026 (CST) — First Move Activity Block v1 SHIPPED

**Context:** Studio-open orientation block for G9 CO2 Racers Lesson 3 onward (the studio-model lessons 2-6 + 8-13 per the agency unit's §4.2 envelope). Pulls together three live signals — design philosophy from Class 1 Strategy Canvas, last journal NEXT prompt, and the student's current `this_class` Kanban lane — into a single hero card. Student picks one card + writes a one-sentence commitment → Start moves the chosen card to Doing (demoting any existing Doing card back to this_class so WIP=1 is preserved) and logs a `first-move.committed` learning_event. Reusable: drop one at the top of every studio lesson, no per-lesson authoring.

**Pre-flight findings:**
- Strategy Canvas + Process Journal both store in `student_progress.responses` as composed-markdown via STRATEGY_CANVAS_PROMPTS / JOURNAL_PROMPTS presets. Use `parseComposedContent` to round-trip the answers out.
- Kanban via existing `student_unit_kanban.cards` JSONB.
- **No `end_date` on `units` table** → deferred race-day countdown to `FU-FM-RACE-DAY-COUNTDOWN`.
- Tree clean ✓.
- Baseline 5631 passing / 11 skipped / 0 failing.

**8 commits across 8 phases (commits 6588dbd..140dd9a + 8b1abdb..c4619cc — full numbering below):**
- **Phase 1 — `6588dbd`:** GET `/api/student/first-move/[unitId]` consolidated payload route. Returns designPhilosophy, lastJournalNext + updatedAt, thisClassCards, lastDoneCard.
- **Phase 2 — `37271d5`:** POST `/api/student/first-move/[activityId]/commit`. Validates commitment (5-200 chars), demotes any current `doing` card to `this_class`, moves chosen card to `doing`, writes whole-state via existing kanban upsert with validateKanbanState + recomputeCounts, emits `first-move.committed` learning_event.
- **Phase 3 — `5049eb4`:** Block registration. ResponseType union extension, `FirstMoveConfig` interface (minCommitmentWords, requireCardChoice, showDesignPhilosophy, showWhereLeftOff), BLOCK_LIBRARY palette entry (Response/opening, ⚡ icon, 5 min), 3 LABEL/ICON/TINT records updated. Tint #F59E0B (amber-500).
- **Phase 4 — `5a91c19`:** Dispatch wiring + stub. ResponseInputProps gains firstMoveConfig, ActivityCard threads it.
- **Phase 5 — `8b1abdb`:** Full ~310-line component. Hero scrim (philosophy or "not yet set" fallback) → Where you left off (last NEXT prompt + relative time + last done card) → Today's options (pill-buttons for this_class cards, single-select) → Today I will… (input + word counter against minCommitmentWords + 200-char cap) → Start studio → button (enables only when commitment + card chosen). Committed state collapses to a green ✓ strip showing the commitment + which card moved.
- **Phase 6 — `140dd9a`:** Teacher config panel. 4 knobs + an explainer paragraph.
- **Phase 7 — `<this round>`:** Refactored route handlers to delegate logic to `src/lib/first-move/payload-builder.ts` (pure helpers). 16 unit tests covering extractDesignPhilosophy + extractLastJournalNext + extractKanbanSummary + swapKanbanForFirstMove (including newest-non-empty-wins semantics, non-string defence, WIP-swap precedence, negative-control card-count preservation).
- **Phase 8 — this commit:** Registry sync + WIRING +1 system + first-move-followups.md + this changelog entry + fix to origin's unquoted YAML in schema-registry.yaml line 9700.

**Decisions banked:**
- Pure helpers separated from route handlers so tests don't mock Supabase.
- WIP swap is opinionated: any current `doing` card is auto-demoted to `this_class` when student picks a new one via First Move. Preserves WIP=1 invariant the kanban reducer assumes. Filed FU-FM-WIP-LIMIT-OVERRIDE for the wip_limit_doing >= 2 case.
- `learning_events.subject_id` synthesised as `gen_random_uuid()` (activityId is a nanoid8 string, not UUID). activityId stashed in `payload.activityId` for searchability.
- onChange pushes the commitment string into `student_progress.responses` (same canonical pattern as Choice Cards / Inspiration Board) — marking page sees engagement.

**Tests:** Baseline 5631 → after Phase 7 +16 helper tests. Tsc baseline 266 preserved throughout.

**Migrations pending prod apply:** _None._ JSONB-additive only.

**Follow-ups filed** ([`first-move-followups.md`](projects/first-move-followups.md)):
- FU-FM-RACE-DAY-COUNTDOWN (P3)
- FU-FM-AUTO-ARCHETYPE-AWARE (P3)
- FU-FM-TEACHER-DASHBOARD-WIDGET (P2)
- FU-FM-WIP-LIMIT-OVERRIDE (P3)
- FU-FM-NO-PAYLOAD-EMPTY-STATE (P3)

**Systems affected:** 1 NEW (`first-move-block` complete). Tangential: `lesson-editor` + `student-response-input` + `kanban-tool` (read+write integration).

**Hygiene fix:** Origin's PR #216 had an unquoted YAML value (`pitch_status: TEXT (CHECK: null | 'pending' ...)`) in schema-registry.yaml that broke the api-routes scanner. Wrapped in quotes — scanner runs clean now.

**What's next:** Phase 9 — Matt Checkpoint smoke. Drop a First Move block at the top of a G9 CO2 Racers lesson page → log in as a test student with prior Class 1 Strategy Canvas + at least one journal entry + a few this_class cards → verify all three signals render → pick one card → write commitment → Start → verify Kanban move + learning_event row.
