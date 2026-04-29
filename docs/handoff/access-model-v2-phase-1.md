# Handoff — access-model-v2-phase-1

**Last session ended:** 2026-04-30T07:00Z (Day-2 close — applied 8 RLS migrations to prod, shipped Phase 1.6 cleanup + Phase 1.7 registry hygiene under Option A scope, ran saveme)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `936fd96` "chore(access-v2): Phase 1.7 registry hygiene + Checkpoint A2 Option-A amendment" (saveme commit follows on top of this — see git log)
**Branch:** `access-model-v2-phase-1` — 24+ commits ahead of `main`, all pushed to origin

## What just happened (this session)

Day 2 of the long Phase 1 build. Continued from yesterday's saveme with prod migration application + Phase 1 close.

- **8 RLS migrations applied to prod** via Supabase SQL Editor in timestamp order. Phase 1.5 (3 rewrites of broken policies + 1 additive `students_self_read`) + Phase 1.5b (3 additive student-side policies + 1 explicit deny-all on `student_sessions`). Each verified with a pg_policies query showing the rewritten USING clause shape. `scan-rls-coverage.py` confirmed `student_sessions` + `fabrication_scan_jobs` exited the `rls_enabled_no_policy` drift bucket.

- **Picked Option A for Phase 1 close.** Mid-session it became clear that activating the new RLS policies in real route traffic requires (1) authoring student-side policies on supporting tables (`classes`, `units`, `class_units`, etc.) that don't exist yet, and (2) a route-by-route switch from `createAdminClient()` to RLS-respecting SSR client with smoke per surface. Rather than expand Phase 1, deferred client-switch to **FU-AV2-PHASE-14-CLIENT-SWITCH (P2)**. Phase 1 ships with policies pre-positioned + dual-mode wrapper covering all 63 routes; existing app-level filtering remains the active line of defense.

- **Phase 1.6 cleanup (`be2f3c8`).** Dropped the temporary alias pattern (`const auth = { studentId: session.studentId }`) from 3 of the 6 Phase 1.4b routes — `grades`, `me/support-settings`, `me/unit-context` now use `studentId` directly. Wrote `docs/security/student-auth-cookie-grace-period.md` documenting dual-auth-path coexistence semantics until Phase 6 cutover.

- **Phase 1.7 registry hygiene (`936fd96`).** WIRING.yaml `auth-system` rewritten v1→v2 (12 systems in `affects`, `key_files` corrected, `data_fields` includes `students.user_id`, `change_impacts` flags dual-mode-removal hazard). schema-registry.yaml: spec_drift on 12 tables touched by Phase 1.5 + 1.5b. Filed FU-AV2-PHASE-14-CLIENT-SWITCH (P2). Marked FU-AV2-PHASE-15B ✅ RESOLVED. Phase 1 brief §7 split into "Phase 1 close (NOW)" with checked items + "Deferred to client-switch follow-up". wiring-dashboard.html + system-architecture-map.html both synced to v2.

- **Saveme.** All 5 registry scanners rerun (no new drift introduced; pre-existing FU-FF tables remain intentionally deny-all). Changelog + decisions-log + doc-manifest entries appended for Phase 1 work. ALL-PROJECTS.md Access Model v2 entry rewritten to reflect Phase 1 close.

## State of working tree

- `git status --short`: clean (after saveme commit lands)
- Tests: **2762 passed | 11 skipped** (no regression from Day-1 baseline)
- Typecheck: 0 errors (`npx tsc --noEmit --project tsconfig.check.json`)
- Pending push: 0 (everything pushed to origin)
- Active-sessions: row at `/Users/matt/CWORK/.active-sessions.txt` should be removed when this session closes
- Vercel: branch alias URL `https://studioloom-git-access-model-v2-phase-1-mattburto-specs-projects.vercel.app` always points at latest deploy on this branch
- All 8 RLS migrations applied to prod via Supabase SQL Editor (verified each with pg_policies query)

## Next steps — pick up here

Recommended ORDER:

- [ ] **Merge `access-model-v2-phase-1` → `main`.** Branch can't sit forever; the `school_id` NOT NULL hotfix commits on main need to be absorbed. Procedure:
  1. `git fetch origin`
  2. `git merge origin/main` (resolve any conflicts — likely none, but the school_id work touched some of the same files Phase 1 does)
  3. Re-run tests + typecheck after merge: `npm test && npx tsc --noEmit --project tsconfig.check.json`
  4. Push the merge commit
  5. Open PR `access-model-v2-phase-1 → main` (or fast-forward merge if no diverge), request CI green
  6. Land via PR
- [ ] **Phase 2 — OAuth Google/Microsoft + email/password for teachers** (per `docs/projects/access-model-v2.md`, ~3-4 days). The polymorphic `getActorSession()` from Phase 1.3 is the seam Phase 2 plugs into. Trigger phrase to start: "next phase access model v2".
- [ ] **OR — Phase 1.4 client-switch (FU-AV2-PHASE-14-CLIENT-SWITCH P2)** if you'd rather make the policies load-bearing before adding more auth surfaces. Same difficulty, different unblock priority.
- [ ] **OR — switch projects.** Preflight Phase 8-3 is queued; dashboard-v2 has Phases 9-16. Both have build briefs ready.

## Open questions / blockers

- _None blocking._
- **dashboard.html (`docs/projects/dashboard.html`) doesn't yet have a top-level Access Model v2 row** — only the legacy "Auth / ServiceContext Seam" stub. Adding it is a small follow-up — not urgent, the canonical tracker is ALL-PROJECTS.md.
- **API-registry + AI-call-sites scanners ran clean** — no Phase 1 work added new routes or AI calls (everything reused existing helpers).
- **5 RLS-coverage drift entries remain** — `admin_audit_log`, `ai_model_config`, `ai_model_config_history`, `fabricator_sessions`, `teacher_access_requests`. All previously documented as intentional deny-all under FU-FF. Two new ones (`student_sessions` + `fabrication_scan_jobs`) exited the bucket via Phase 1.5b.

## Key references

- Phase 1 brief: `docs/projects/access-model-v2-phase-1-brief.md` (§7 amended for Option A)
- Master spec: `docs/projects/access-model-v2.md`
- New security doc: `docs/security/student-auth-cookie-grace-period.md`
- Registry updates: `docs/projects/WIRING.yaml` (auth-system v2), `docs/schema-registry.yaml` (12 tables with Phase 1 spec_drift)
- Follow-up tracker: `docs/projects/dimensions3-followups.md` — see FU-AV2-PHASE-14-CLIENT-SWITCH (P2, new), FU-AV2-PHASE-15B (✅ RESOLVED)
- Lessons: `docs/lessons-learned.md` — #62 (pg_catalog vs information_schema), #63 (Vercel URLs deployment-specific)
- Decisions: `docs/decisions-log.md` — Phase 1 Option-A entry, dual-mode wrapper rationale, synthetic email format
- Branch alias preview URL: `https://studioloom-git-access-model-v2-phase-1-mattburto-specs-projects.vercel.app`

## Don't forget

- After merge to main: remove `/Users/matt/CWORK/.active-sessions.txt` row for this worktree.
- After merge to main: the worktree at `/Users/matt/CWORK/questerra-access-v2` can stay (it'll automatically track main going forward) — or delete it if you prefer to work in the main `questerra/` worktree for Phase 2.
- Phase 2 unlocks pilot readiness — at that point Matt's outreach pattern resurfaces. Bottleneck is never code.
- The 4 client-side UI INSERT sites (FU-AV2-UI-STUDENT-INSERT-REFACTOR P2) leave students with NULL user_id until first login. Phase 1.2's lazy-provision fallback closes the security gap. Phase 1.4 client-switch (when it picks up) refactors to a server-side route.
- Multi-Matt prod data (3 teacher rows at NIS) preserved — not merged. Phase 6 cutover decision deferred.
