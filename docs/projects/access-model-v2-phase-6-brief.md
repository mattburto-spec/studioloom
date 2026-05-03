# Access Model v2 — Phase 6 (Cutover & Cleanup) — Brief

**Status:** READY — Q1/Q2/Q3 decisions resolved 4 May 2026 PM. §6.0 may begin **after** Checkpoint A6 signs off + Phase 5 merges to main + the Phase 6 branch is cut from `main`.
**Drafted:** 4 May 2026
**Worktree (planned):** `/Users/matt/CWORK/questerra-access-v2`
**Branch (planned):** `access-model-v2-phase-6` (cut from `main` at the v0.5-phase-5-closed tag once §5 merges)
**Predecessor:** Checkpoint A6 (Phase 5 — Privacy & Compliance)
**Successor checkpoint:** **A7 — PILOT-READY** (paired with §12 parallel-track closure for full pilot GO)
**Master spec:** [`docs/projects/access-model-v2.md`](access-model-v2.md) §4 Phase 6 (lines 278–288) + §3 items 35 (RLS-no-policy), 38 (API versioning) + §6 risks
**Estimate:** ~2–3 days per master spec; **revised after audit to ~4–5 days** (Lesson #59; +1.5–2d from audit-derived scope including 105 `author_teacher_id` cleanups, 46 `requireStudentAuth` callsite migrations, 319-route rename, 228-route audit-coverage catchup).

---

## 1. Goal

Final pre-pilot phase. Removes the legacy code paths that Phases 1–5 made obsolete; lands the `/api/v1/*` versioning seam everywhere; closes the audit-coverage debt; documents the privacy/security surface; tags the pilot baseline.

When this phase closes:

1. **No legacy student-token code paths remain.** `student_sessions` table dropped, `requireStudentAuth` shim deleted, `/api/auth/student-login` + `/api/auth/student-session` Path B gone, `questerra_student_session` cookie reads stripped from middleware. All 46 callsites use the Phase 1 `requireStudentSession` helper directly. Q1 resolution: **clean-slate students wiped first** (test data only), so no migration risk.
2. **No `author_teacher_id` direct-ownership reads remain.** All 105 `.eq("teacher_id"|"author_teacher_id")` callsites route through the Phase 3 `can()` helper. FU-AV2-PHASE-3-CALLSITES-REMAINING P3 absorbs here.
3. **Every existing route lives under `/api/v1/*`.** 319-route rename pass (admin 34 + auth 5 + fab 13 + school 11 + schools 3 + student 63 + teacher 146 + tools 36 + misc 5 = 319 — `/api/v1/student/*` + `/api/v1/teacher/*` already shipped in §5.4 + §5.6, 3 routes total). Legacy aliases live with 90-day expiry comments.
4. **Audit-coverage CI gate flips from visibility-only to gating** (`--fail-on-missing` enabled in nightly.yml). 228 inherited routes triaged: ~50 bulk-skipped (public-tools, admin-sandbox, lib-delegating), ~8 inline-wired (admin-ops), the rest filed as per-route follow-ups OR marked.
5. **RLS-no-policy doc shipped** for the **5** tables (was 7 in spec; corrected per audit) flagged by `scan-rls-coverage.py`. FU-FF closed.
6. **`data-classification-taxonomy.md` covers the 4 new Phase 5 tables** (`audit_events`, `ai_budgets`, `ai_budget_state`, `scheduled_deletions`).
7. **3 ADRs land** — 011 (school + governance), 012 (audit log infrastructure), 013 (API versioning convention) — plus retiring the existing 011-schema-rework as Superseded (Q2 = A; radical pivot was shelved). ADR-003 updated to note Phase 1 student-auth unification + Phase 6 token cleanup.
8. **Pilot baseline tagged** as `v0.x-pilot1` for one-tag rollback.
9. **Checkpoint A7 — PILOT-READY signoff.** Pairs with §12 parallel-track for full pilot GO.

### Why now

- §5 closed the privacy/compliance surface; what remains before pilot is removing the dead-weight from legacy phases (token system, ownership reads, unversioned routes) so the pilot ships on a clean baseline.
- Path B (master spec §1.5) puts every phase before pilot. §6 is the last code-side phase before NIS students log in.
- Without the rename + cleanup, Phase 7+ work would build on top of accumulated cruft; cheaper to clean once than to maintain dual paths forever.

### Non-goals (explicitly out of scope)

- **No new migrations expected.** Phase 6 is delete + rename + document. The only candidate migration is **dropping `student_sessions`** (DROP TABLE statement; one-line mig).
- **No new tables / routes / endpoints.** Pure cutover.
- **No new ADRs beyond the 3 named** (011 / 012 / 013) plus the 011-schema-rework retirement and ADR-003 update. Future ADRs land in their own phases.
- **No partial cleanup.** If a callsite uses `requireStudentAuth` and §6.1 misses it, the type-checker fails — easy stop. Same for `student_sessions` table reads (table won't exist).
- **No DPA / Privacy Notice / China network test / IR runbook / parental consent / break-glass plan.** Those are §12 parallel-track items, owned by Matt outside the v2 worktree. Tracked but not blocking §6 sub-phase work.
- **No live cron scheduling.** `FU-AV2-CRON-SCHEDULER-WIRE P2` is pre-pilot blocker but separate from Phase 6 (needs SUPABASE_SERVICE_ROLE_KEY governance call). Tracked; out of §6 sub-phase scope.

---

## 2. Pre-flight ritual

Before touching any code (after the Phase 6 branch is cut):

- [ ] **Working tree clean.** `git status` shows clean on `access-model-v2-phase-6` branch.
- [ ] **Baseline tests green.** `npm test` reports **3486 passed | 11 skipped (3497 total) across 220 test files** — verified at Phase 5.8 close (commit `0d2c3f6`).
- [ ] **Typecheck clean.** `npx tsc --noEmit --project tsconfig.check.json` exits 0.
- [ ] **Active-sessions row claimed** for `access-model-v2-phase-6` worktree branch in `/Users/matt/CWORK/.active-sessions.txt`. Remove on phase close.
- [ ] **Re-read these Lessons** (numbered per `docs/lessons-learned.md`) before any sub-phase code:
  - **#29 (RLS policies must be updated when adding junction tables — they silently filter rows).** §6.5 RLS-no-policy doc work touches the 5 flagged tables; if any get explicit deny-all policies instead of doc-only treatment, cross-check that no legitimate read path breaks.
  - **#34 (test assumptions drift silently).** Lock 3486 baseline; assert delta after each sub-phase. Phase 6 is high-volume change (319-route rename, 105 callsite migration, 46-callsite shim swap) — cumulative drift risk if not gated tightly.
  - **#38 (assert expected values, not just non-null).** §6.4 audit-coverage catchup must verify each `// audit-skip:` marker has a non-trivial reason (catalog test); §6.6 ADRs assert specific links + dates.
  - **#43 (think before coding — surface assumptions).** Q1/Q2/Q3 already resolved; if any §6 sub-phase surfaces a NEW question (e.g., legacy-alias cookie behaviour ambiguity), STOP and report.
  - **#44 (simplicity first).** No refactor scope creep. §6.3 rename = `git mv` + import path update + alias middleware. Don't combine with logic changes.
  - **#45 (surgical changes — touch only what each sub-task names).** §6.2 cleans 105 sites — no unrelated refactors in the same commits.
  - **#54 (registries can lie — audit by grep).** §6.7 final registry sync MUST spot-check at least one entry in each registry against code reality before tagging.
  - **#59 (brief estimates lie when audit hasn't happened).** Audit done — estimate raised 2-3d → 4-5d. If §6.0 surfaces another scope expansion (e.g., the 46 `requireStudentAuth` callsites have 5 with non-trivial side effects), buffer 0.5d more. **Don't paper over.**
  - **#60 (side-findings belong in the same commit).** If §6.2 grep finds a 106th `author_teacher_id` site discovered mid-edit, fix in the same commit.
  - **#66 (SECURITY DEFINER + locked search_path).** §6.5 RLS work doesn't add new SECURITY DEFINER functions, but if `docs/security/rls-deny-all.md` ends up adding explicit `USING (false)` policies, no new functions required — pure RLS policy migration would still need the search_path discipline if any function changes.
  - **#67-proposed (brief-vs-schema audit at PHASE start).** Already done for Phase 6 (audit findings in §3.5). Pattern locked in.
- [ ] **Read** the audit-derived inventory in §3.3 + §3.4 below. Confirm grep counts before acting.
- [ ] **STOP and report findings.** If any §3 finding has shifted since 4 May 2026 (e.g., callsite count moved; ADR 011 status changed; FU-FF reopened), report before §6.0 starts.

---

## 3. Audit — surface of this phase

Compiled 4 May 2026. Numbers are exact unless marked approximate.

### 3.1 Schema seams already in prod (Phases 0–5)

Phase 6 has no new schema requirements modulo the `student_sessions` DROP. Listed for context:

| Seam | Source | State |
|---|---|---|
| `class_members` table + `can()` helper | Phase 3 | ✅ live; 105 ownership-read callsites still bypass it (§6.2 target) |
| `student_sessions` table | mig 001 + mig 040 | ✅ live; **§6.1 will DROP** (clean-slate students per Q1) |
| `audit_events` + wrapper | Phase 0.7a + Phase 5.1 | ✅ live; 4 routes wrap, 228 mutation routes bypass (§6.4 target) |
| `ai_budgets` + `ai_budget_state` + middleware | Phase 0.7b + Phase 5.2/5.3 | ✅ live; 3 student AI routes wrapped, scanner gating from day one |
| `scheduled_deletions` table | Phase 5.4 (mig 20260503143034) | ✅ applied to prod 4 May; cron NOT scheduled (FU-AV2-CRON-SCHEDULER-WIRE P2) |
| `/api/v1/student/*` + `/api/v1/teacher/*` | Phase 5.4 + 5.6 | ✅ live; 3 routes already at v1 (§6.3 will rename the other 319) |

### 3.2 Migrations expected (Phase 6)

| Migration | Purpose | Sub-phase | Notes |
|---|---|---|---|
| `phase_6_1_drop_student_sessions` | DROP TABLE student_sessions (after clean-slate) | 6.1 | Idempotent (`DROP TABLE IF EXISTS`); RLS irrelevant after drop. Sanity DO-block: post-drop, table doesn't exist. **Q1 clean-slate makes this safe** — no live data to lose. |

**Total: 1 thin migration in Phase 6.**

(No INSERT/UPDATE migrations needed; the dataclass-taxonomy + RLS-no-policy doc work in §6.5 is documentation, not schema.)

### 3.3 Existing routes — Phase 6 dispositions

#### 3.3a Routes to DELETE (§6.1 — legacy student auth)

| Route | Reason |
|---|---|
| `src/app/api/auth/student-login/route.ts` | Replaced by `/api/auth/student-classcode-login` (Phase 1.2 — Supabase magic-link mint). Uses `student_sessions` table directly. |
| `src/app/api/auth/student-session/route.ts` Path B | DELETE the legacy fallback branch. Path A (Phase 1 `requireStudentSession`) stays; Path B (questerra_student_session cookie + student_sessions table) goes. |

#### 3.3b Routes to MIGRATE (§6.1 — `requireStudentAuth` → `requireStudentSession`)

**46 callsite files** (precise count via grep 4 May 2026):

```
src/app/api/auth/student-session/route.ts
src/app/api/discovery/session/route.ts
src/app/api/discovery/reflect/route.ts
src/app/api/student/tool-sessions/route.ts
src/app/api/student/tool-sessions/[id]/route.ts
src/app/api/student/word-lookup/route.ts
src/app/api/student/studio-preferences/route.ts
src/app/api/student/design-assistant/route.ts
src/app/api/student/tile-comments/route.ts
src/app/api/student/progress/route.ts
... (36 more under src/app/api/student/* + src/app/api/discovery/* + src/app/api/safety/*)
```

**Mechanical sweep**: replace import + call shape. The Phase 1 helper has compatible-enough semantics (returns `{ studentId, error: NextResponse | undefined }`) that most sites need only the import change. Sites that destructure `auth.studentId` work as-is. **Type-checker is the gate** — if a callsite breaks, tsc fails.

#### 3.3c Files reading the `student_sessions` table directly (§6.1 cleanup)

```
src/app/api/auth/student-login/route.ts          # DELETED in 3.3a
src/app/api/auth/student-session/route.ts        # Path B branch deleted in 3.3a
src/app/api/auth/lti/launch/route.ts             # Removes student_sessions INSERT
src/app/api/student/word-lookup/route.ts         # Comment-only reference (line 19 docstring)
src/app/api/bug-reports/route.ts                 # Removes student_sessions read
src/app/api/teacher/class-students/route.ts      # Removes student_sessions read
src/app/api/teacher/teach/live-status/route.ts   # Live-status uses student_sessions for "active" detection — needs Phase 1 equivalent OR drops the feature
src/lib/auth/student.ts                          # The shim itself — DELETE entire file
src/lib/access-v2/actor-session.ts               # Phase 1 helper — drops the dual-mode fallback branch
src/lib/integrity/remove-student-data.ts         # Removes student_sessions DELETE statement
```

**Critical decision in §6.1:** `live-status` route uses `student_sessions` to detect "active" students for Teach Mode. Either (a) replace with `auth.users.last_sign_in_at` lookup OR (b) accept feature regression in Phase 6 + file FU-AV2-LIVE-STATUS-REWORK P2. Decide before §6.1 starts.

#### 3.3d Routes to RENAME (§6.3 — `/api/v1/*`)

**319 routes** to rename (322 total — minus 3 already at v1):

| Top-level domain | Route count | Per-domain commit |
|---|---|---|
| `/api/admin/` | 34 | commit 1: `feat(phase-6.3): rename /api/admin/* → /api/v1/admin/*` |
| `/api/auth/` | 5 (post §6.1 deletes) | commit 2: `feat(phase-6.3): rename /api/auth/* → /api/v1/auth/*` |
| `/api/fab/` | 13 | commit 3: `feat(phase-6.3): rename /api/fab/* → /api/v1/fab/*` |
| `/api/school/` + `/api/schools/` | 14 | commit 4: `feat(phase-6.3): rename /api/school(s)/* → /api/v1/school(s)/*` |
| `/api/student/` | 63 | commit 5: `feat(phase-6.3): rename /api/student/* → /api/v1/student/*` |
| `/api/teacher/` | 146 | commit 6: `feat(phase-6.3): rename /api/teacher/* → /api/v1/teacher/*` |
| `/api/tools/` | 36 | commit 7: `feat(phase-6.3): rename /api/tools/* → /api/v1/tools/*` |
| Misc (`/api/bug-reports/`, `/api/discovery/*`, `/api/health/`, `/api/public/*`, `/api/safety/`, `/api/tts/`) | 8 | commit 8: `feat(phase-6.3): rename misc /api/* → /api/v1/*` |
| Legacy alias middleware (one Next.js middleware that 308-redirects `/api/*` → `/api/v1/*`) | n/a | commit 9: `feat(phase-6.3): legacy /api/* → /api/v1/* alias middleware (90-day expiry)` |
| **Total** | **319 + 1 middleware** | **9 commits, one PR** (per Q3) |

**Q3 resolution: one PR + per-domain commits.** Single PR keeps the alias middleware logic + every-route diff together. Per-domain commits make review tractable. One merge = one Vercel redeploy.

**Mechanism:**
1. `git mv src/app/api/<domain>/ src/app/api/v1/<domain>/` per domain.
2. Find-replace import paths in TS code that reference renamed routes (rare — most cross-route references use fetch URLs, not imports).
3. Find-replace fetch URLs in client code: `fetch('/api/<domain>/...')` → `fetch('/api/v1/<domain>/...')`. Grep first, count, batch-replace.
4. Alias middleware in `src/middleware.ts`: detect `/api/*` (not `/api/v1/*`) requests + 308-redirect to `/api/v1/*`. Comment with 90-day expiry date.
5. Run `python3 scripts/registry/scan-api-routes.py --apply` post-rename to refresh `api-registry.yaml`.

### 3.4 NEW routes Phase 6 ships

**Zero.** Phase 6 is delete + rename + document. The 3 §5 routes (export, delete, audit-log view) are the last new routes before pilot.

### 3.5 Brief-vs-schema audit findings (Lesson #67 — done at PHASE start)

| Master-spec claim (lines 278–288) | Reality on `main` (4 May 2026) | Action |
|---|---|---|
| "Decision on 3-Matts merge" (line 285) | ✅ DONE in Phase 4.3.z (2 May). Three accounts consolidated: Admin / Matt Burton / Loominary (deactivated). FU-AV2-CONSOLIDATE-MULTI-MATT closed. | **Brief drops this from Phase 6 scope.** Master-spec lines 64 + 285 amended in §6.0. |
| "RLS-no-policy documentation for the 7 tables" (line 284) | ❌ Reality is **5 tables**: admin_audit_log, ai_model_config, ai_model_config_history, fabricator_sessions, teacher_access_requests. (student_sessions + fabrication_scan_jobs already cleaned up earlier — student_sessions is now also being DROPPED in §6.1 → 4 tables post-§6.1.) | **§6.5 covers 5 tables (4 post-§6.1).** Spec amended in §6.0. |
| "write ADR-011 (school + governance)" (line 282) | ❌ ADR 011 is taken (`011-schema-rework.md`, "Proposed" status, never accepted; from radical-pivot era 8 Apr 2026 — pivot shelved 9 Apr per master CLAUDE.md). | **Q2 = A: retire 011-schema-rework as Superseded; reuse 011 for school+governance.** Phase 6 ADRs become 011 / 012 / 013 as spec said. §6.6 covers. |
| "API versioning rename pass — rename all 388 existing unversioned routes" (line 286) | ❌ Reality is **322 route.ts files** (3 already under v1 from §5.4 + §5.6) → **319 to rename**. | **§6.3 uses 319.** Spec amended in §6.0. |
| "~2–3 days estimate" (line 278) | ❌ Realistic with full audit-derived scope: **~4–5 days**. Master spec predates the 105 author_teacher_id, 46 requireStudentAuth, 228 audit-coverage catchup counts. | **Brief raises estimate explicitly.** Buffer 1d. |

**Audit yield: 5 spec-vs-reality drifts caught BEFORE §6.0 ships.** All addressable as §6.0 spec amendments — no blocker findings.

### 3.6 Registry cross-check (Step 5c per build methodology)

| Registry | State (4 May 2026) | Drift caught | Fix in |
|---|---|---|---|
| `WIRING.yaml` | 3 Phase 5 systems added (audit-log, ai-budget, data-subject-rights) at §5.8. **No `api-versioning` system.** | Add `api-versioning` system in §6.6 (deps: every route; affects: every client fetch). | §6.7 close-out |
| `schema-registry.yaml` | scheduled_deletions added at §5.8. **`student_sessions` entry will become stale post-§6.1 DROP.** | Mark `student_sessions` status='dropped' in §6.7 close-out. | §6.7 close-out |
| `api-registry.yaml` | 426 routes (post-§5.8 sync). Post-§6.3 rename: 426 stays (rename, not add). | `--apply` re-run post-§6.3 to refresh paths. | §6.7 close-out |
| `ai-call-sites.yaml` | Synced at §5.8. No new AI call sites in Phase 6. | `--apply` re-run; expect no diff. | §6.7 close-out |
| `feature-flags.yaml` | Unchanged in Phase 6 (no new flags / env vars). | None. | n/a |
| `vendors.yaml` | Unchanged in Phase 6 (no new vendors). | None. | n/a |
| `data-classification-taxonomy.md` | Phase 5 tables (audit_events, ai_budgets, ai_budget_state, scheduled_deletions) **NOT classified yet**. | **§6.5 classifies all 4 tables**. Each gets a per-column block per the existing format. | §6.5 |
| `rls-coverage.json` | 5 tables flagged `rls_enabled_no_policy`. | **§6.5 ships `docs/security/rls-deny-all.md` documenting intent + service-role access for each.** Update scanner to recognise documented exceptions (FU-FF closure). | §6.5 |

**Spot-checks performed (Lesson #54):**
- WIRING `audit-log.key_files` → all 4 listed files exist (`src/lib/access-v2/audit-log.ts` + tests + scanner + workflow). Clean.
- WIRING `ai-budget.key_files` → all 7 listed files exist. Clean.
- WIRING `data-subject-rights.key_files` → all 8 listed files exist. Clean.
- schema-registry `scheduled_deletions` → 8 columns + writers + readers all match `delete-student.ts` + crons. Clean.
- api-registry post-§5.8 sync → 426 routes, gate threshold bumped to 600 in `scan-api-routes.py`. Clean.

### 3.7 Resolved decisions (signed off by Matt 4 May 2026 PM)

**Q1 — Legacy student token cleanup strategy: clean-slate students.**

- `DELETE FROM students; DELETE FROM student_sessions;` (one-off SQL Editor in §6.1).
- DROP TABLE `student_sessions` via thin migration (§6.1).
- DELETE `requireStudentAuth` shim (`src/lib/auth/student.ts`) entirely.
- Mechanical sweep of 46 callsite files: import + call swap to `requireStudentSession`.
- DELETE `/api/auth/student-login/route.ts` + Path B branch of `/api/auth/student-session/route.ts`.
- Strip `questerra_student_session` cookie from `src/middleware.ts`.
- **Open critical decision (§6.1 sub-question):** `/api/teacher/teach/live-status/route.ts` uses `student_sessions` for "active student" detection — replace with `auth.users.last_sign_in_at` lookup OR accept feature regression + file FU. Matt to decide BEFORE §6.1 ships (low-cost — pick at start of §6.1).

**Q2 = A — Retire ADR-011-schema-rework + reuse number for school+governance.**

- Mark `../Loominary/docs/adr/011-schema-rework.md` status `Superseded`.
- Add a closing note linking to the radical-pivot shelving (master CLAUDE.md "Critical Context: Loominary — Umbrella Brand, StudioLoom v1 is Active Work").
- Write new `011-school-entity-and-governance.md` (school+governance ADR) per Phase 6 spec.
- Phase 6 ADRs: 011 / 012 / 013 land per master spec verbatim.

**Q3 — `/api/v1/*` rename: one PR + per-domain commits.**

- Single PR keeps alias middleware + every-route diff together.
- 8 per-domain commits + 1 alias middleware commit (per §3.3d table).
- Sequential merge of each commit means easier bisect if regression appears.
- One Vercel redeploy on PR merge instead of five.

**Net effect on plan:** all 3 resolutions baked into §4 sub-phases. Estimate stable at 4–5 days (Q1's clean-slate kept §6.1 at 0.5d not 1d; Q2 + Q3 are zero-effort calls).

---

## 4. Sub-phases

Eight sub-phases (6.0 → 6.7). Each ends with a sub-phase commit on `access-model-v2-phase-6`. **No push to origin/main until Checkpoint A7 signs off AND legacy aliases verified live.** Use `phase-6-wip` backup branch for WIP if needed.

### Phase 6.0 — Pre-flight + spec amendments + scaffolds (~0.25 day)

- Cut branch `access-model-v2-phase-6` from `main` at tag `v0.5-phase-5-closed` (after Phase 5 merges).
- Run `npx tsc --noEmit --project tsconfig.check.json`; assert 0 errors.
- Run `bash scripts/migrations/verify-no-collision.sh`; assert clean against origin/main.
- Run `npm test`; assert 3486 passed / 11 skipped baseline.
- **Spec amendments to land in same commit:**
  - Master spec `docs/projects/access-model-v2.md` line 64: drop "+ 3-Matts merge decision" (resolved Phase 4.3.z).
  - Master spec line 284: change "the 7 tables flagged" → "the 5 tables flagged" (with per-table list inline).
  - Master spec line 285: replace entire bullet with "DONE in Phase 4.3.z (Three-Matts prod-data consolidation, 2 May 2026)".
  - Master spec line 286: change "388 existing unversioned routes" → "319 unversioned routes (322 total minus 3 already shipped under /api/v1/* in §5.4 + §5.6)".
  - Master spec line 282: prepend "(011 retired/superseded — see Q2 resolution in Phase 6 brief §3.7)" to clarify ADR numbering.
- Resolve §3.3c critical sub-question: `/api/teacher/teach/live-status/route.ts` strategy (replace OR feature-regress).
- Pre-create scaffolds (empty files / TODO markers):
  - `docs/security/rls-deny-all.md` (§6.5 deliverable skeleton)
  - `docs/security/multi-account-pattern.md` — **NOT created** (3-Matts done; no parallel-system doc needed)
  - `../Loominary/docs/adr/011-school-entity-and-governance.md` (§6.6 — new 011, replaces retired)
  - `../Loominary/docs/adr/012-audit-log-infrastructure.md` (§6.6)
  - `../Loominary/docs/adr/013-api-versioning.md` (§6.6)
- Commit: `chore(phase-6.0): pre-flight + spec amendments + scaffolds`.

### Phase 6.1 — Legacy student token deprecation + clean-slate (~0.5 day)

**Per Q1 resolution:** existing students are test data; full delete + clean-slate avoids dual-path coexistence work.

Sequence:
1. **Operations FIRST (one-off SQL Editor):**
   ```sql
   -- One-off cleanup. Test data only. Idempotent.
   DELETE FROM student_sessions;
   DELETE FROM students WHERE deleted_at IS NULL;
   -- (any FK-cascade dependents auto-clean; verify via Supabase Storage manual sweep
   -- if storage buckets hold student-uploaded artefacts)
   ```
2. **Migration `phase_6_1_drop_student_sessions`** — one-line `DROP TABLE IF EXISTS student_sessions;` + sanity DO-block + paired down (`-- intentional: no rollback; data was wiped`).
3. **Code cleanup:**
   - Delete `src/lib/auth/student.ts` (the `requireStudentAuth` shim).
   - Delete `src/app/api/auth/student-login/route.ts`.
   - Edit `src/app/api/auth/student-session/route.ts` — keep Path A (Phase 1 helper), remove Path B (legacy fallback branch).
   - Delete `src/lib/integrity/remove-student-data.ts` `student_sessions` DELETE statement (single line).
   - Edit `src/lib/access-v2/actor-session.ts` — remove dual-mode fallback branch.
   - Edit `src/middleware.ts` — strip `questerra_student_session` cookie reads.
   - Migrate 46 callsite files: `import { requireStudentAuth } from "@/lib/auth/student"` → `import { requireStudentSession } from "@/lib/access-v2/actor-session"` + adjust call shape (returns `{studentId, error?}` for both — usually a one-line change).
   - Decide live-status route: rewire to `auth.users.last_sign_in_at` OR delete the active-student detection feature OR file FU-AV2-LIVE-STATUS-REWORK P2.
4. **Test impact:** ~5–10 tests will reference `requireStudentAuth` or mock `student_sessions` table — update mocks to point at the Phase 1 helper.
5. **Verify:** `tsc` failures = the gate. If a callsite isn't migrated, tsc catches it.
6. Test count target: 3486 → 3470 (~−16 — some auth-shim tests delete; new tests for the migration shape).
7. Commit: `feat(phase-6.1): legacy student token cleanup — drop student_sessions + delete requireStudentAuth shim + 46 callsite migrations`.

### Phase 6.2 — `author_teacher_id` cleanup (~1–1.5 day)

Closes **FU-AV2-PHASE-3-CALLSITES-REMAINING P3**.

**Pattern (canonical proven in Phase 3.4d):** replace `.eq("teacher_id", actor.id)` and `.eq("author_teacher_id", actor.id)` with `can(actor, '<action>', resource)` calls. The 3 deprecated shims in `src/lib/auth/verify-teacher-unit.ts` already delegate to `can()`; this sub-phase migrates the inline `.eq()` callsites to use the same path.

Audit:
- 105 grep hits across many files.
- Subset: `~40` truly inline (per existing FU note); the rest live inside helper functions that already use `can()` indirectly.
- Per-file pattern: read the file → identify the `.eq` predicate → swap for `can()` call → verify the test still passes.

**Per-domain commits** (mirrors §6.3 strategy):
- `feat(phase-6.2): author_teacher_id cleanup — admin routes`
- `feat(phase-6.2): author_teacher_id cleanup — teacher routes`
- `feat(phase-6.2): author_teacher_id cleanup — student routes (read paths)`
- `feat(phase-6.2): author_teacher_id cleanup — fab routes`
- `feat(phase-6.2): author_teacher_id cleanup — school routes`
- `feat(phase-6.2): author_teacher_id cleanup — lib helpers (final sweep)`

**Don't-stop-for:** if a callsite reveals it ISN'T actually an ownership check (e.g., `.eq("teacher_id", ...)` is filtering a teacher's own dashboard not gating cross-teacher access), leave it alone + add `// access-check-skip: not an ownership predicate` comment for clarity.

Test count target: +20 (each domain gets ~3 sanity tests asserting `can()` is called instead of direct `.eq`).

### Phase 6.3 — `/api/v1/*` rename (~1 day, one PR + per-domain commits per Q3)

Per §3.3d: **319 routes**, 8 per-domain commits + 1 alias middleware commit. Single PR.

Sequence per domain:
1. `git mv src/app/api/<domain>/ src/app/api/v1/<domain>/` (preserves history per file).
2. Grep `fetch.*['"]/api/<domain>/` in `src/` (client code) + replace with `/api/v1/<domain>/`.
3. Grep `fetch.*['"]/api/<domain>/` in tests + replace.
4. Verify `npm test` for the affected domain passes.
5. Commit per the §3.3d table.

After all 8 per-domain commits land:
6. Add legacy alias middleware in `src/middleware.ts`:
   ```typescript
   // Phase 6.3 — 90-day legacy alias. Expires 2026-08-04. Remove after pilot stable.
   if (request.nextUrl.pathname.startsWith("/api/") && !request.nextUrl.pathname.startsWith("/api/v1/")) {
     const newPath = request.nextUrl.pathname.replace(/^\/api\//, "/api/v1/");
     return NextResponse.redirect(new URL(newPath + request.nextUrl.search, request.url), 308);
   }
   ```
7. Test the alias: `curl -I https://<vercel-preview>/api/teacher/dashboard` returns `308` to `/api/v1/teacher/dashboard`.
8. Commit alias middleware.
9. Run `python3 scripts/registry/scan-api-routes.py --apply`; expect 0 net route count change but every route's `file:` field updates.
10. Commit registry refresh: `chore(phase-6.3): refresh api-registry post-rename`.

Test count target: +5 (alias-middleware unit tests assert the redirect logic; plus 3-4 catalog tests for fetch URL migration coverage).

**Stop trigger:** if `npm test` fails on a per-domain commit, STOP — diagnose what client-side code missed the rename. Don't ship the alias middleware to mask a real callsite gap.

### Phase 6.4 — Audit-coverage catchup + flip nightly to gating (~0.5 day)

Closes **FU-AV2-AUDIT-MISSING-PHASE-6-CATCHUP P2**.

Process:
1. Read `docs/scanner-reports/audit-coverage.json` `missing` array (228 routes).
2. **Bulk-skip categorically** (per the FU's suggested triage order):
   - 32 public-tools routes → `// audit-skip: public anonymous free-tool, no actor identity`
   - 8 admin-sandbox routes (`admin/ai-model/*`, `admin/generation-sandbox/*`, `admin/ingestion-sandbox/*`, `admin/smoke-tests/*`) → `// audit-skip: ephemeral admin sandbox/test`
   - 3 lib-delegating routes (already audited inside lib helper) → `// audit-skip: audit row emitted in <lib path>`
   - `admin/settings PATCH` → `// audit-skip: writes to admin_audit_log (mig 079, parallel system)`
   - `admin/teachers/[id] DELETE` + `admin/teachers/invite POST` + `admin/teacher-requests PATCH` → **inline-wire** `logAuditEvent` (high audit value)
3. Categorical sweep of remaining ~180 routes:
   - `teacher-app-data` (117) — bulk skip with `// audit-skip: routine teacher pedagogy ops, low audit value` OR inline-wire selectively (decided per-route during sweep).
   - `student-app-data` (36) — bulk skip with `// audit-skip: routine learner activity, low audit value`.
   - `fabrication-pipeline` (9) — selective audit on lab-tech pickup + completion; rest skipped.
4. Re-run `python3 scripts/registry/scan-api-routes.py --check-audit-coverage`. Confirm `missing: 0`.
5. Edit `.github/workflows/nightly.yml`: change the audit-coverage step from visibility-only to `--check-audit-coverage --fail-on-missing`.
6. Test count target: +10 (catalog tests assert each `// audit-skip:` marker has a non-trivial reason; nightly.yml flag flip tested by integration test).
7. Commit: `feat(phase-6.4): audit-coverage catchup — bulk-skip + inline-wire + flip nightly to gating`.

### Phase 6.5 — RLS-no-policy doc + data-classification taxonomy (~0.5 day)

**Per §3.5 audit + §3.6 registry cross-check:**

#### 6.5a — `docs/security/rls-deny-all.md`

Document intent + service-role access for the **5 tables** flagged by `scan-rls-coverage.py`:

| Table | Why no SELECT policy | Service-role write paths |
|---|---|---|
| `admin_audit_log` | Pre-Phase-5 audit log (mig 079); admin_settings writes only via `src/lib/admin/settings.ts:143` (service-role admin client). | `src/lib/admin/settings.ts` |
| `ai_model_config` | Read at runtime by `src/lib/ai/quality-evaluator.ts:135` via service-role; intentionally not RLS-readable. | quality-evaluator |
| `ai_model_config_history` | Append-only history of ai_model_config; same access pattern. | quality-evaluator |
| `fabricator_sessions` | Opaque-token session table; service-role only via `src/lib/fab/auth.ts`. | fab/auth |
| `teacher_access_requests` | Phase 4.7b-2 waitlist; service-role only via `/api/teacher/welcome/request-school-access` + `/admin/school/[id]` admin surface. | request-school-access route + admin surface |

Plus update `scripts/registry/scan-rls-coverage.py` to recognise documented exceptions (read `docs/security/rls-deny-all.md` for table names; treat them as `documented_no_policy` not `drift`). FU-FF closes.

#### 6.5b — `data-classification-taxonomy.md` updates

Add entries for 4 Phase 5 tables (`audit_events`, `ai_budgets`, `ai_budget_state`, `scheduled_deletions` already added at §5.8 — verify; add the 3 missing).

For each: per-column `pii / student_voice / safety_sensitive / ai_exportable / retention_days / basis` block per existing format.

Test count target: +5 (the taxonomy + RLS doc are markdown; tests verify the doc exists + scanner recognition update works).

Commit: `feat(phase-6.5): RLS-no-policy doc + data-classification taxonomy for Phase 5 tables`.

### Phase 6.6 — ADRs (~0.25 day)

Per Q2 resolution + audit:

1. **Mark `../Loominary/docs/adr/011-schema-rework.md` as `Superseded`** with a closing note linking to the radical-pivot shelving (`../Loominary/CLAUDE.md` "Critical Context" section + master CLAUDE.md "Critical Context: Loominary").
2. **Write new `../Loominary/docs/adr/011-school-entity-and-governance.md`** — captures Decisions 2 (school as first-class entity, no designated admin) + 7 (class-level roles, flat school membership) + 8 (tier-aware membership amendment) + the §8 governance engine.
3. **Write `../Loominary/docs/adr/012-audit-log-infrastructure.md`** — captures Decision 3 (immutable append-only) + Phase 5.1 wrapper design (3-mode failure) + monetisation seam (school_subscription_tier_at_event).
4. **Write `../Loominary/docs/adr/013-api-versioning.md`** — captures master-spec §3 item 38 (`/api/v1/*` prefix) + Phase 6.3 rename + 90-day legacy alias.
5. **Update `../Loominary/docs/adr/003-student-token-auth.md`** — append a "Phase 1 + Phase 6 update" section noting auth unification (every student → auth.users) + token system deprecation. Status remains `Accepted` since the original token-auth model was correct for its era.

Test count target: +0 (ADRs are markdown — no tests).

Commit: `docs(phase-6.6): retire ADR-011 + write ADRs 011/012/013 + update ADR-003`.

### Phase 6.7 — Final registry sync + Checkpoint A7 + tag (~0.25 day)

1. Run all 5 registry scanners (`scan-api-routes.py --apply`, `scan-ai-calls.py --apply`, `scan-feature-flags.py`, `scan-vendors.py`, `scan-rls-coverage.py`). Review diffs; commit.
2. Update `WIRING.yaml`:
   - Add `api-versioning` system (deps: every route file; affects: every client fetch).
   - Mark `student_sessions` references in `auth-system` `data_fields` as REMOVED post-§6.1 (table dropped).
3. Update `schema-registry.yaml`: mark `student_sessions` `status: dropped`, `applied_date: 2026-05-XX`.
4. Run `bash scripts/check-session-changes.sh`; confirm "SAVEME RECOMMENDED"; recommend Matt run `saveme` for the changelog + cross-project sync.
5. Author `docs/projects/access-model-v2-phase-6-checkpoint-a7.md` — PILOT-READY signoff doc:
   - All §1 goal items ticked
   - `npm test` final count + tsc 0 errors + scanner reports clean
   - Vercel preview smoke of 3 representative `/api/v1/*` routes (one teacher, one student, one admin)
   - Legacy alias smoke: `curl /api/teacher/dashboard` returns 308 → `/api/v1/teacher/dashboard`
   - `bash scripts/migrations/verify-no-collision.sh` clean
   - All 4 §6.5 RLS-no-policy tables documented; FU-FF marked closed
   - All 8 §12 parallel-track items linked + status (Matt's manual work; not §6 scope)
   - `FU-AV2-CRON-SCHEDULER-WIRE P2` flagged as **PRE-PILOT BLOCKER** (must close before first NIS student logs in)
6. Author handoff at `docs/handoff/access-model-v2-phase-6.md` — Matt's action checklist for A7 sign-off + merge + tag + first-pilot prep.
7. Update `docs/changelog.md` Phase 6 session entry.
8. Tag merge commit (post-merge to main): `v0.x-pilot1` (the actual `x` decided at merge — likely `v0.6-pilot1`).
9. Update `/Users/matt/CWORK/.active-sessions.txt` row.
10. Commit: `chore(phase-6.7): registry sync + Checkpoint A7 PILOT-READY doc + handoff`.

---

## 5. Don't-stop-for list

Per build-methodology rule 4 (don't paper over surprises) — these are items where stopping would be over-cautious:

- A 47th `requireStudentAuth` callsite found mid-§6.1 — fix in same commit (Lesson #60).
- A 106th `author_teacher_id` site discovered during §6.2 — fix in same commit; per-domain assignment to whichever §6.2 commit covers that file's domain.
- A `fetch('/api/...')` callsite in client code missed by §6.3 grep — fix in the same per-domain commit; the alias middleware is the safety net but explicit URL updates are the right move.
- An audit-coverage `// audit-skip:` marker that needs adjustment after §6.4 sweep — fix inline.
- A `data-classification-taxonomy.md` column field that needs different `basis:` than initially picked — adjust during §6.5.
- An ADR draft requiring a section reorder for clarity — edit in same §6.6 commit.
- A registry diff that surfaces an unrelated drift (e.g., `vendors.yaml` shows a vendor with stale DPA date) — note in `FU-AV2-VENDOR-DPA-DRIFT-{date}` but DON'T pull on the thread (Lesson #45).

---

## 6. Stop triggers

Per build-methodology rule 4 — STOP and report findings before continuing:

- `npm test` regresses below 3486 baseline without explanation → STOP.
- `npx tsc --noEmit --project tsconfig.check.json` fails on any sub-phase commit → STOP.
- `bash scripts/migrations/verify-no-collision.sh` flags collision → STOP.
- §6.1 reveals that `live-status` route's "active student" detection cannot be replaced cleanly (no Phase 1 equivalent for `student_sessions.expires_at < now()` semantic) → STOP, decide between feature-regression vs custom rework with Matt.
- §6.2 callsite migration breaks an existing teacher dashboard query → STOP, the `can()` semantic differs from the original `.eq` filter; surface the difference.
- §6.3 alias middleware breaks an existing client-side fetch (e.g., signed URL with embedded query string mangled by 308 redirect) → STOP, fix the middleware before continuing the rename.
- §6.4 bulk-skip leaves a high-audit-value mutation route uncovered → STOP, inline-wire instead.
- §6.5 RLS-no-policy doc requires adding an explicit deny-all policy that breaks an existing service-role read path → STOP, the policy must allow `service_role` bypass.
- §6.6 ADR draft surfaces a contradiction with an earlier ADR (e.g., ADR-003 + new ADR-011 disagree on auth model) → STOP, reconcile before merge.
- Vercel preview deploy of the renamed routes returns 404 for any `/api/v1/*` call that worked at `/api/*` → STOP, alias middleware OR rename is broken.
- Post-§6.3 alias-middleware smoke shows the 308 lands at the WRONG `/api/v1/*` path → STOP, regex bug in the middleware.

---

## 7. Checkpoint A7 — PILOT-READY gate criteria

Phase 6 closes when ALL pass:

### Code

- [ ] `student_sessions` table dropped from prod (mig `phase_6_1_drop_student_sessions` applied).
- [ ] `src/lib/auth/student.ts` deleted; 46 callsite files swapped to `requireStudentSession`.
- [ ] `/api/auth/student-login` deleted; `/api/auth/student-session` Path B branch deleted.
- [ ] All 105 `author_teacher_id` ownership reads route through `can()` (verified by grep returning 0 hits — modulo `// access-check-skip:` marked exemptions).
- [ ] All 319 routes renamed to `/api/v1/*`. 3 already at v1 (export, delete, audit-log view).
- [ ] Legacy alias middleware live + smoke-tested (308 redirect verified for at least one route per domain).
- [ ] Audit-coverage scanner reports `missing: 0`. nightly.yml flipped to `--fail-on-missing`.
- [ ] `docs/security/rls-deny-all.md` documents all 4 RLS-no-policy tables (post-§6.1 student_sessions drop). FU-FF closed.
- [ ] `data-classification-taxonomy.md` covers all 4 Phase 5 tables.
- [ ] 3 new ADRs land (011 school+governance, 012 audit log, 013 API versioning). 011-schema-rework marked Superseded. ADR-003 updated.
- [ ] Tests updated; **3486 → ~3500 (~+14 net** — §6.1 deletes some shim tests; §6.2/6.3/6.4/6.5 add catalog + alias-middleware + taxonomy verification).
- [ ] `npx tsc --noEmit --project tsconfig.check.json` 0 errors.

### Migrations

- [ ] 1 migration shipped (`phase_6_1_drop_student_sessions`).
- [ ] Sanity DO-block fired correctly at apply time.
- [ ] `bash scripts/migrations/verify-no-collision.sh` clean against `origin/main`.

### Smoke (live in dev or staging)

- [ ] `student-classcode-login` flow works end-to-end (no `student_sessions` table required — Phase 1 `auth.users` path is sole code path).
- [ ] Co-teacher (Phase 3 role) can edit a class via `/api/v1/teacher/...` → `can()` resolves correctly.
- [ ] Legacy alias: `curl -I https://<preview>/api/teacher/dashboard` returns 308 → `/api/v1/teacher/dashboard`.
- [ ] Vercel preview deploy: end-to-end smoke through 3 `/api/v1/*` routes (admin / teacher / student).
- [ ] Audit-coverage scanner returns `missing: 0` against current tree.

### Documentation

- [ ] This brief finalised + linked from `docs/projects/access-model-v2.md` Phase 6 section.
- [ ] `docs/projects/access-model-v2-phase-6-checkpoint-a7.md` written + signed.
- [ ] `docs/changelog.md` Phase 6 session entry.
- [ ] Forward-looking handoff written for first pilot session (post-merge).
- [ ] `docs/projects/access-model-v2-followups.md` updated with any new FUs.

### Operational

- [ ] Migration applied to prod with sanity DO-block green.
- [ ] Active-sessions row updated for next session (post-pilot work).
- [ ] Tag merge commit `v0.x-pilot1` (number decided at merge time).

### **Pre-pilot parallel-track (NOT §6 scope but pairs for full pilot GO)**

Per master-spec §12 — Matt's manual work:
- [ ] DPAs signed (Anthropic ZDR + Supabase + Voyage + Vercel + Sentry + Resend + ElevenLabs)
- [ ] Privacy Notice published at `studioloom.org/privacy`
- [ ] Privacy policy + Terms of Service pages
- [ ] China network test from NIS school WiFi
- [ ] Incident response runbook
- [ ] Parental consent forms
- [ ] Two-engineer break-glass plan
- [ ] Status page configured
- [ ] **`FU-AV2-CRON-SCHEDULER-WIRE P2` closed** — Phase 5.5 crons scheduled (the first DSR delete queues a row that needs the cron to actually delete)
- [ ] **§5.7 cost-alert + Sentry fire drills completed** (carry-over from A6 if not done before merge)

---

## 8. Sub-phase / commit / migration summary (planning view)

| Sub-phase | Goal | Tests Δ | Migrations | Commit (count) |
|---|---|---|---|---|
| 6.0 | Pre-flight + spec amendments + scaffolds | 0 | 0 | 1 |
| 6.1 | Legacy student token cleanup (Q1 clean-slate) | −16 | 1 | 1 |
| 6.2 | author_teacher_id cleanup (105 sites) | +20 | 0 | 6 (per-domain) |
| 6.3 | /api/v1/* rename (319 routes + alias middleware) | +5 | 0 | 9 (8 per-domain + 1 alias + 1 registry refresh) — actually 10 |
| 6.4 | Audit-coverage catchup + nightly flip | +10 | 0 | 1 |
| 6.5 | RLS-no-policy doc + data-classification taxonomy | +5 | 0 | 1 |
| 6.6 | ADRs 011/012/013 + retire 011-schema-rework + update 003 | 0 | 0 | 1 |
| 6.7 | Registry sync + Checkpoint A7 + tag + handoff | 0 | 0 | 1 |
| **Total** | — | **+24 (3486 → ~3510)** | **1** | **22 commits** |

**Estimated effort: ~4–5 days** (audit-derived; master spec said 2–3).

---

## 9. References

- Master spec — Phase 6 section: `docs/projects/access-model-v2.md` lines 278–288
- Phase 5 brief (template): `docs/projects/access-model-v2-phase-5-brief.md`
- Phase 5 checkpoint A6: `docs/projects/access-model-v2-phase-5-checkpoint-a6.md`
- Build methodology: `docs/build-methodology.md`
- Lessons learned: `docs/lessons-learned.md` (re-read #29, #34, #38, #43–46, #54, #59, #60, #66, #67-proposed)
- Followups: `docs/projects/access-model-v2-followups.md` (FU-AV2-PHASE-3-CALLSITES-REMAINING absorbs in §6.2; FU-AV2-AUDIT-MISSING-PHASE-6-CATCHUP absorbs in §6.4; FU-AV2-CRON-SCHEDULER-WIRE pre-pilot blocker)
- Existing ADR-011 (to retire): `../Loominary/docs/adr/011-schema-rework.md`
- Existing ADR-003 (to update): `../Loominary/docs/adr/003-student-token-auth.md`
- Active-sessions tracker: `/Users/matt/CWORK/.active-sessions.txt`
- IT audit (closes F12 at §6.5): `docs/projects/studioloom-it-audit-2026-04-28.docx`
