# Handoff — main

**Last session ended:** 2026-05-02T01:55Z (Phase 3 SHIPPED + Checkpoint A4 PASS + chip UI shipped; Phase 4 next)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `b82f9f2` "feat(dashboard): FU-AV2-PHASE-3-CHIP-UI — role badges on /teacher/classes"
**Branch:** `main` — 0 ahead of `origin/main` (fully synced).
**Pending push:** 0.

## What just happened (this session)

Long session covering Access Model v2 Phase 3 end-to-end + the immediate chip-UI follow-up.

- **Phase 3 brief drafted** (594 lines) at `docs/projects/access-model-v2-phase-3-brief.md` — Class Roles & Permissions, ~4 day estimate, 8 §3.8 open questions all signed off.
- **Phases 3.0 → 3.4d shipped** in the access-v2 worktree on branch `access-model-v2-phase-3` — kill-switch flag, 3 SECURITY DEFINER Postgres helpers, `can(actor, action, resource, options?)` TS helper + 33 tests, `/api/teacher/me/scope` endpoint + 8 tests, helper shims delegating through `can()`, classes INSERT trigger, dashboard expansion, units content PATCH gate.
- **Phase 3.5 smoke ran 1-2 May** with 5 scenarios. **Checkpoint A4 PASS.** Three mid-smoke hotfixes captured:
  - 3.4e `classes_class_members_read_policy` (RLS gap on classes embed)
  - 3.4f `is_teacher_of_student_includes_class_members_and_mentors` (helper rewrite — closes FU-MENTOR-SCOPE)
  - 3.4g v2 `/api/teacher/me/scope` route fix (drop students embed, two-query lookup with display_name fallback to username)
- **Phase 3.6 close-out** — schema-registry rewrote 4 Phase 0 entries from `status:dropped` to `status:applied` (FU-DD class drift), WIRING.yaml gained `class-management` v2 + `permission-helper` v1 systems, feature-flags.yaml registered `auth.permission_helper_rollout`, api-registry +1 route, decisions-log +6 entries, changelog +1 session.
- **Fast-forward merge** — `access-model-v2-phase-3` (19 commits) → `main` via throwaway worktree per methodology rule.
- **Chip UI shipped** on dashboard-v2-build worktree — `<RoleChip />` component + `resolveRoleChip()` helper + 8 tests + wired into `/teacher/classes` page (active + archived render locations); `DashboardClass` type updated. Fast-forwarded to main via `git push origin dashboard-v2-build:main`. Closes FU-AV2-PHASE-3-CHIP-UI P2.
- **5 migrations applied to prod 1-2 May:** 3.0 + 3.1 + 3.4b + 3.4e + 3.4f. All sanity-DO-block verified by Matt via SQL output during smoke.
- **FU-MENTOR-SCOPE P1 ✅ RESOLVED** structurally — every route gating via `is_teacher_of_student` now grants cross-class mentor access via Phase 3.4f.

## State of working tree

- `git status --short`: clean.
- Tests: **2895 passed | 11 skipped** in dashboard-v2-build worktree (which is now in sync with main); the access-v2 worktree was at 2887 before chip UI — both at 2895 now.
- Typecheck: 0 errors (only pre-existing BugReportButton type errors remain — unrelated, not Phase 3 / chip work).
- Vercel: prod main deployed green at `studioloom.org` with all of Phase 3 + chip UI live.
- Branches preserved on origin (kept as records, not deleted): `access-model-v2-phase-3`, `dashboard-v2-build`. Both at the same commit as main.

## Next steps — pick up here

- [ ] **Phase 4 — School Registration, Settings & Governance (~3 days, master spec §4 line 253)** — the next master-spec phase.
  - 12 sub-items per master spec: seed additional schools (IB/GCSE/ACARA/US independent set), `school_domains` table + auto-suggest, fuzzy-match on create-new-school (trigram > 0.7), `school_merge_requests` + 90-day redirect, `/school/[id]/settings` page (all school-owned fields per §8.1), `school_setting_changes` governance engine (low-stakes vs high-stakes tier), bootstrap grace window (7 days for single-teacher schools), school activity feed + 7-day revert UI, School Library browse (read-only units from same-school teachers — uses Phase 0's `units.school_id`), platform super-admin view at `/admin/school/[id]`, migrate scattered school-level settings up.
  - **Folds in `FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL` P2** — auto-tag `dept_head` into all classes of department (department concept lands here).
  - **Checkpoint A5** with sub-criteria in master spec line 265.
  - **First action:** draft the Phase 4 brief end-to-end (~1-2h) with full 6-registry cross-check (Step 5c), audit before code, surface §3.8-style open questions, STOP for sign-off. Then build sub-phase by sub-phase.
  - Sub-phases will likely shape as: 4.0 pre-flight + decisions, 4.1 schools seeding, 4.2 school_domains + signup auto-suggest, 4.3 governance engine schema + helper, 4.4 `/school/[id]/settings` page, 4.5 school activity feed + revert UI, 4.6 school library browse, 4.7 platform super-admin view, 4.8 dept_head auto-tag (FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL fold-in), 4.9 registry hygiene + close-out.

- [ ] **Pre-pilot polish (~1 day, parallel to Phase 4 if priorities allow)** —
  - `FU-AV2-PHASE-3-RLS-MATRIX-TIGHTNESS` P3 — split students RLS into per-cmd policies matching the can() matrix (mentor.UPDATE blocked at RLS, etc.). Today over-permissive but app-layer can() gates enforce matrix at route level.
  - `FU-AV2-PHASE-3-COLUMN-CLASSIFICATION` P3 — add per-column pii/student_voice/safety_sensitive/ai_exportable/retention_days/basis to the 4 Phase 0 schema-registry entries (audit_events, class_members, school_responsibilities, student_mentors).
  - `FU-LEGAL-LAWYER-REVIEW` P2 — get `/privacy` + `/terms` pages reviewed by an Australian-qualified lawyer. Gated on pilot expansion beyond Matt's own classroom.

- [ ] **Open Phase 3 follow-ups for Phase 6 cutover (don't touch until Phase 6)** —
  - `FU-AV2-PHASE-3-CALLSITES-REMAINING` P3 — ~40 mutation gates still using inline `.eq("teacher_id", X)` filters. Pattern proven in Phase 3.4d (`/api/teacher/units/[unitId]/content`). ~15h mechanical work.
  - `FU-AV2-PHASE-6-DELETE-SHIMS` P3 — 3 deprecated helpers (`verifyTeacherOwnsClass`, `verifyTeacherHasUnit`, `verifyTeacherCanManageStudent`) + kill-switch flag deletion. Depends on callsites-remaining done first.

- [ ] **On demand only (don't proactively schedule)** —
  - `FU-AV2-PARENT-LOGIN` P3 (~5-7d) — guardian portal build when 2nd school asks
  - `FU-CUSTOM-AUTH-DOMAIN` P3 — Supabase Pro custom auth domain `auth.studioloom.org`
  - `FU-AZURE-MPN-VERIFICATION` P3 — Microsoft Partner Network publisher verification (gated on second-school pilot)

## Open questions / blockers

- _None blocking._
- Phase 4 brief is the natural starting point for the next session — ~1-2h to draft end-to-end. Run the 6-registry cross-check (per build-methodology rule 9, added 29 Apr after Phase 1 brief drift) before drafting.
- Test seed cleanup for the chip UI verify: if Matt re-seeded a co_teacher row to verify the chip in prod (per the post-merge SQL snippet in handoff), he should DELETE that row again before Phase 4 work begins so prod data stays clean.

## Key references

- Phase 3 brief: `docs/projects/access-model-v2-phase-3-brief.md`
- Phase 3.5 smoke outcome: `docs/projects/access-model-v2-phase-3-smoke.md` (Checkpoint A4 PASS appended)
- Followups: `docs/projects/access-model-v2-followups.md` — 6 new Phase 3 FUs filed (1 closed: FU-MENTOR-SCOPE)
- Decisions: `docs/decisions-log.md` — 6 new Phase 3 entries
- Changelog: `docs/changelog.md` — 2 new session entries (Phase 3 ship + smoke close)
- Master spec: `docs/projects/access-model-v2.md` — Phase 4 §4 line 253, §8.1-§8.6 governance details
- WIRING.yaml: `class-management` v2 + `permission-helper` v1 (new); `auth-system` v2 (Phase 1.4 future_needs trimmed)
- schema-registry.yaml: 4 Phase 0 entries fixed (was `status: dropped`); spec_drift entries dated 2026-05-01

## Don't forget

- **Phase 3 fully closed + merged.** All 5 migrations applied to prod (3.0 + 3.1 + 3.4b + 3.4e + 3.4f). Don't re-run.
- **Chip UI shipped.** RoleChip renders for non-lead-teacher roles only. Lead_teacher renders nothing (default ownership; chip would be noise).
- **Don't push to main during Phase 4 sub-phase work.** Methodology rule 8 — feature branch holds until Checkpoint A5 sign-off + migrations applied to prod. Use throwaway worktree for the merge per Phase 3 + chip UI patterns.
- **Pre-flight ritual is non-negotiable** before Phase 4 brief: working tree clean, baseline `npm test`, re-read relevant Lessons (especially #54 registry drift + #64 RLS recursion + #66 candidate "audit existing RLS for new-junction consumers" from Phase 3.5 smoke), full 6-registry cross-check.
- **Loominary is the umbrella, StudioLoom is the product.** `hello@loominary.org` is the contact; `studioloom.org` is the user-facing URL.
- **Phase 4's department concept** — when designing the schema for departments, remember `FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL` P2 wants auto-tag-into-classes-of-department (Phase 3 ships dept_head as class-scope role; Phase 4 adds the automation).
