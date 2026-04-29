# Access Model v2 Phase 1 — §4.0 Fold-In Proposal

**Audit input:** `docs/projects/units-school-id-investigation-29-apr.md`
**Hotfix shipped:** branch `units-school-id-hotfix` (commit `c2ccb7e`) — covers `/api/teacher/units` create case ONLY
**Drafted:** 29 April 2026
**Target reader:** Phase 1 author / next session in `/Users/matt/CWORK/questerra-access-v2`

---

## Why this exists

On 29 April 2026, the JSON-import flow surfaced a `null value in column "school_id" of relation "units" violates not-null constraint` error during smoke. Migration 0.8b tightened `school_id` NOT NULL on `units`, `students`, AND `classes` — but the codebase has 14 INSERT sites that don't supply the value. **Only one** of those sites (the `/api/teacher/units` create case) has been hotfixed today; the other 13 are silent trip-mines.

The full investigation lives in [`units-school-id-investigation-29-apr.md`](units-school-id-investigation-29-apr.md). It identifies all 14 sites, RLS impact (none — units RLS doesn't reference school_id), and recommends the fix scope.

**Decision (29 Apr 2026, signed off by Matt):** the broad fix belongs INSIDE Phase 1, not as a parallel hotfix. Phase 1 already audits this surface (§4.4 Batch C touches student-reading routes; §4.5 simplifies RLS on student-touched tables) and uses the canonical helper this fix needs (`getActorSession()` returning `{ schoolId }`).

This document proposes the new sub-phase `§4.0 — Audit and fix all post-0.8b INSERT sites`, drafted as a clean copy-paste into the Phase 1 brief at `/Users/matt/CWORK/questerra-access-v2/docs/projects/access-model-v2-phase-1-brief.md`.

---

## Suggested insertion point

Insert as **§4.0** in the Phase 1 brief, ahead of §4.1. Rationale:

1. The 14 broken sites block any teacher-driven unit/class/student creation in prod TODAY. Phase 1 takes ~3.5 days; leaving 13 silent trip-mines for that window is unacceptable.
2. §4.0 has zero dependencies on the rest of Phase 1 — the fix is "supply school_id to insert payloads," which is auth-orthogonal. It can land before §4.1's `students.user_id` backfill.
3. By doing this first, Phase 1's later sub-phases (Batch C in §4.4) can call the new helper directly when they refactor — instead of finding inline `loadTeacherSchoolId` calls and having to clean them up.
4. Updating §1 estimate: +0.5 day (~14 sites × 5 minutes each + uniform test pattern).

---

## Proposed §4.0 brief content

> ### 4.0 Audit + fix post-0.8b INSERT sites
>
> **Goal:** Bring every `units` / `classes` / `students` INSERT writer into compliance with the post-Phase-0.8b NOT NULL constraint on `school_id`. Eliminate 13 silent trip-mines surfaced on 29 Apr 2026.
>
> **Audit input:** [`docs/projects/units-school-id-investigation-29-apr.md`](units-school-id-investigation-29-apr.md) §3 — full site list with line numbers.
>
> **Already done:** `/api/teacher/units` POST `action: "create"` (commit `c2ccb7e` on `units-school-id-hotfix` branch — landed before Phase 1 §4.0 starts; the inline `loadTeacherSchoolId`-equivalent lookup in that route gets ripped out and replaced with `requireActorSession().schoolId` after §4.3 ships, per the `TODO(access-v2 §4.0)` tag in route.ts).
>
> **13 sites to fix in this sub-phase:**
>
> | # | File | Line | Table | Notes |
> |---|------|------|-------|-------|
> | 1 | `src/app/api/teacher/units/route.ts` | 296 | units | Fork case |
> | 2 | `src/app/api/teacher/convert-lesson/route.ts` | 312 | units | Lesson-plan converter |
> | 3 | `src/app/teacher/units/page.tsx` | 321 | units | Client-side; **also missing `author_teacher_id`** — patch all three columns or verify if dead code |
> | 4 | `src/app/teacher/units/create/page.tsx` | 946 | units | Wizard primary save (client) |
> | 5 | `src/app/teacher/units/create/page.tsx` | 955 | units | Wizard retry-without-unit_type (client; same payload ref as #4) |
> | 6 | `src/app/teacher/classes/page.tsx` | 155 | classes | Classes-list "New class" form (client) |
> | 7 | `src/app/teacher/settings/page.tsx` | 1805 | classes | Settings → unmapped-class create (client) |
> | 8 | `src/app/teacher/dashboard-legacy/page.tsx` | 81 | classes | Legacy dashboard create (slated for removal post-2026-04-29 cutover; **maybe just delete instead of fixing**) |
> | 9 | `src/app/api/teacher/welcome/create-class/route.ts` | ~35 | classes | Onboarding wizard (server) |
> | 10 | `src/app/api/teacher/welcome/setup-from-timetable/route.ts` | 141 | classes | Onboarding bulk-create from timetable (server, loops) |
> | 11 | `src/app/teacher/classes/[classId]/page.tsx` | 318 | students | Single student add (client) |
> | 12 | `src/app/teacher/classes/[classId]/page.tsx` | 407 | students | Bulk student add (client) |
> | 13 | `src/app/api/teacher/integrations/sync/route.ts` | 137 | students | LMS roster sync (server) |
> | 14 | `src/app/api/auth/lti/launch/route.ts` | ~200 | students | LTI launch student auto-provisioning (server) |
>
> Total: 14 sites, of which 1 is already hotfixed. **13 remain.**
>
> **Pattern:**
>
> *Server-side (routes):* import `loadTeacherSchoolId` from `src/lib/fabrication/lab-orchestration.ts`. Read once at the top of the handler; pass into the insert payload. Once §4.3 lands, replace inline calls with `requireActorSession().schoolId` — Phase 1's helper composes this naturally.
>
> *Client-side (pages):* call the existing `current_teacher_school_id()` Postgres function via `supabase.rpc('current_teacher_school_id')`. The function is GRANTed to `authenticated`; client-side Supabase client can call it directly. Returns `{ data: <uuid>, error }`. Same one-time-at-top pattern as the route handlers.
>
> *Sister-table considerations:*
> - `students` inserts (#11–#14) ALSO need `students.user_id` populated post-Phase 1.4 (auth.users row creation for new students). §4.0 only adds `school_id` here; §4.1's backfill is one-shot, but **NEW students minted after Phase 1 ships need `auth.admin.createUser()` calls in those same 4 sites**. Flagged below in §4.0c.
> - `classes` inserts have no analogous user_id concern — `classes.school_id` is the only post-0.8b field they're missing.
>
> **Sub-steps:**
>
> #### 4.0a — Fix the 4 server-side routes (~30 min)
>
> Sites #1, #2, #9, #10, #13, #14 (6 server-side routes — counting #1 fork case + 5 truly server-only routes). For each: import `loadTeacherSchoolId`, call once, drop into payload. Test pattern: source-static asserting `school_id` is in the literal — see commit `c2ccb7e`'s test file as a template (`src/app/api/teacher/units/__tests__/route.test.ts`).
>
> #### 4.0b — Fix the 7 client-side pages (~45 min)
>
> Sites #3, #4, #5, #6, #7, #8, #11, #12. (Note: §4.0b might also drop #8 entirely if the dashboard-legacy cutover deadline of 2026-04-29 has passed — verify before fixing.)
>
> Add `supabase.rpc('current_teacher_school_id')` call before each `.insert()` form-submit; bail with form-error UI if it returns null. Test pattern: render-test the form, mock RPC, assert `school_id` is in the dispatched insert.
>
> #### 4.0c — File P1 follow-up for student new-row creation
>
> Add **`FU-AV2-NEW-STUDENT-AUTHUSERS`** (P1) to `docs/projects/dimensions3-followups.md`. Spec: when a new student is rostered post-Phase-1 (sites #11–#14), the route must ALSO create an `auth.users` row via `supabase.auth.admin.createUser()` with synthetic email + `app_metadata.user_type = 'student'`, then populate `students.user_id` from the returned id. Phase 1's §4.1 backfill is one-shot; §4.2 covers login but not new-student creation.
>
> Estimate to fix: ~2 hours, but **not in §4.0 scope**. §4.0 only ensures `school_id` lands so the inserts don't 500. The auth.users + user_id wiring is naturally Phase 1.6 cleanup or Phase 6 cutover work.
>
> Don't gate Checkpoint A2 on this — file as a tracked follow-up.
>
> #### 4.0d — Schema-registry drift sync
>
> [`docs/schema-registry.yaml`](../schema-registry.yaml) currently lists `units.school_id`, `students.school_id`, `classes.school_id` all as `UUID NULL`. Tightened to `UUID NOT NULL` on prod 28 Apr (mig 0.8b). Update all three entries; add dated `spec_drift` entries explaining the gap.
>
> This drift sync was already on Phase 1's §4.7 hygiene list (see brief §3.7 finding #9) — fold §4.0d into §4.7 rather than duplicating.
>
> **Tests:**
>
> - Per-site source-static guard (5 lines each, ~13 new tests).
> - At least one route-level integration test stub for the LTI launch flow (#14) — that's the highest-stakes site (zero current coverage; auto-provisions students from external LTI tools).
>
> **Stop trigger:**
>
> Any of:
> - A site doesn't fit the uniform pattern (e.g., the insert isn't `await`ed and runs in a fire-and-forget context that can't get the helper return value cleanly).
> - The dashboard-legacy site (#8) turns out to still be live in prod despite the cutover deadline — escalate before fixing.
> - Site #3 (units/page.tsx:321) can't be fixed simply because it's missing `author_teacher_id` — needs a separate bugfix decision (fix the missing author too, or delete the dead code path?).
>
> **Estimate:** 0.5 day. (Add to §9 total: 3.5 → 4 days.)
>
> ---

---

## Cross-references the Phase 1 brief should add

- **§3.6 Risk surface:** add row 6 — "13 silent trip-mines on classes/students INSERTs from Phase 0.8b. Mitigation: §4.0 closes them before §4.1 backfill runs."
- **§3.7 Registry cross-check findings:** find #9 (`schema-registry.yaml` `students.user_id`) is already there. Append parallel rows for `units.school_id`, `students.school_id`, `classes.school_id` drift — Phase 0 left all three as `UUID NULL` in the registry despite the prod tighten.
- **§5 Don't-stop-for list:** add — "The 4 student-insert sites (§4.0 #11–#14) lack `auth.users` row creation. Don't fix in Phase 1; file as `FU-AV2-NEW-STUDENT-AUTHUSERS` per §4.0c."
- **§7 Checkpoint A2:** add a "Code" criterion — `grep -rn "school_id" src/app/teacher/classes src/app/teacher/students src/app/api/teacher/welcome` shows `school_id` populated at every insert site (zero false positives in non-test files).
- **§11 References:** add `docs/projects/units-school-id-investigation-29-apr.md` and the hotfix commit SHA.

---

## What stays out of Phase 1 §4.0

- **`/teacher/units/page.tsx:321` author_teacher_id missing-on-insert.** Separate bug. Either delete the route as dead code or escalate to Matt before fixing — the create flow there may bypass the wizard entirely and never get hit in real flows. Investigate before patching.
- **dashboard-legacy/page.tsx:81 fix.** If Matt has cut over to Bold dashboard at `/dashboard` and `/dashboard-legacy` is dead post-2026-04-29 (per master CLAUDE.md), §4.0b should DELETE the file rather than fix it. Verify cutover status first.
- **`student_sessions` RLS work.** Already tracked in §4.5 + §4.7 finding #5. Independent of school_id audit.
- **Audit log on insert mutations.** Phase 5 work; out of scope.

---

## What §4.0 unblocks for the rest of Phase 1

- **§4.4 Batch C — 17 teacher routes touching student tables.** With §4.0 done, those routes can swap to `requireActorSession()` confident that no INSERT site is silently broken. The Batch C work focuses purely on auth-helper migration, not constraint compliance.
- **§4.5 RLS simplification.** With every INSERT supplying `school_id`, future Phase 5+ school-scoped RLS predicates on units/classes/students are immediately sound — no orphan rows to handle.
- **Checkpoint A2 prod smoke.** Phase 1's smoke includes "teacher loads class hub → all students visible; opens one student profile → loads." If §4.0 doesn't land first, the smoke could randomly hit a broken classes/students INSERT path.

---

## Phase 1 author — what to do with this doc

1. Read `units-school-id-investigation-29-apr.md` (the audit) end-to-end.
2. Pull the proposed §4.0 content above into `access-model-v2-phase-1-brief.md` (insert ahead of §4.1; renumber subsequent sub-phases as needed, or keep as 4.0 to avoid renumbering).
3. Update §1 estimate (+0.5 day) and §3.7 registry findings (parallel rows for the 3 tables).
4. Update §5/§7/§11 per the cross-references above.
5. Sign off the §2 pre-flight checklist; START with §4.0a (server-side routes — fastest, lowest risk).
6. The hotfix on branch `units-school-id-hotfix` (commit `c2ccb7e`) is **NOT yet merged to main** as of this doc's drafting. If §4.0 starts before that branch merges, fold the hotfix INTO §4.0a's first commit (the route already has the right pattern + a working test). If the hotfix has merged by then, just leave it — §4.0a only needs to handle the 5 remaining server-side sites and §4.0b handles the 7 client-side ones.

---

## Open questions for Matt before §4.0 starts

1. **dashboard-legacy/page.tsx:81 — fix or delete?** Per master CLAUDE.md the Bold dashboard cutover deadline was 2026-04-29 (today). Has it cut over? If yes, just delete the file rather than fixing the broken insert.
2. **units/page.tsx:321 — patch all 3 missing columns or skip?** This is the 1 site that's missing `school_id` AND `author_teacher_id` AND `teacher_id`. It may be dead code (units list "Create from JSON" — overlaps with the JSON import flow now in `/teacher/library/import`). Verify it's reachable before patching.
3. **§4.0c — file FU-AV2-NEW-STUDENT-AUTHUSERS as P1 or P2?** The 4 student-insert sites need `auth.users` row creation post-Phase-1 for new students. P1 if you're rostering many new students before Phase 6 cutover; P2 if the 1-shot backfill covers all current pilot students and new-student volume is low until Phase 6 closes the loop.

---

## Hotfix lineage

```
main (b83ba57) → JSON import shipped 29 Apr AM
              → lesson-editor warm-paper rebuild (a80f849)
              → units-school-id-hotfix (c2ccb7e) ← NOT YET MERGED
              → access-v2 Phase 1 §4.0 ← absorbs the rest
              → access-v2 Phase 1 §4.4+ ← refactors hotfix's inline lookup
                 to use requireActorSession().schoolId
              → main ← Phase 1 merges back
```
