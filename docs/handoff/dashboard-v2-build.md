# Handoff — dashboard-v2-build

**Last session ended:** 2026-04-26T15:00:00Z
**Worktree:** `/Users/matt/CWORK/questerra-dashboard`
**HEAD:** `28fc709` "feat(pypx): Phase 13b-2/3a — PypxView consumes cohort API + student cards"

## What just happened

- **Phase 13a polish + 13a-5 SHIPPED + merged to main.** Mentor cadence dropped (per-mentor scope, moved to Mentor Manager). Phase column dropped from inline editor (output not input). System accounts filtered from mentor picker. Student-projects inline editor live at `/teacher/classes/[classId]/exhibition` — auto-save 600ms debounced per row, server-authoritative merge.
- **Phase 13b first cut SHIPPED + merged to main.** New endpoint `/api/teacher/pypx-cohort` returns single payload (cohort metrics + per-student card data with progress / phase / status heuristics). PypxView rebuilt: badge + countdown hero + cohort metrics block + 5-segment phase distribution bar + student card grid below. Coral ring on needs-attention cards.
- **Migration 115 forced through to prod.** Schema-cache reload then full body re-run via SQL editor — partial apply had created the column but not the `student_projects` table. Now confirmed both exist + RLS policies in place.
- **Mid-session prod hotfix:** mentor dropdown empty because Matt's other test accounts had NULL school_id. SQL backfill set school_id on `mattburto@gmail.com` + `mattburton@nanjing-school.com` (renamed to "Dr. Lin" + "Mr. Patel" for 13b smoke). Endpoint patched to filter `@studioloom.internal` system accounts.
- **Mentor Manager spec drafted** at `docs/projects/mentor-manager.md` for the upcoming PYP coordinator meeting (~early May 2026). 1-page coordinator brief + engineering appendix + 3 open questions. Don't build before the meeting.

## State of working tree

- Tree: clean
- Branch: synced with `origin/dashboard-v2-build` (HEAD = `28fc709`)
- Pending push count: 0
- Latest 4 commits stacked since the last main-merge are all already on main now (merged in `8ad4645`).
- Tests: not re-run this session (UI work, TS-clean throughout). Last branch baseline: 1939 passed · 8 skipped (pre-13a-5).

## Next steps

- [ ] **Phase 13b-3b polish** — filter chips (All / Needs attention / Ahead / Wonder / Find out / Make / Share / Reflect), view toggle (Cards / Table / By phase), per-student detail page wiring for the "View" button stub. ~half day.
- [ ] **Phase 13c — student PYPX dashboard** (~2 days). Port `docs/newlook/PYPX Student Dashboard/pypx_dashboard.jsx` to real students with real `student_projects` data. ProjectHeader + NextStepHero + PhaseStrip + MilestoneStrip + KitMentor. Bigger of the remaining 13-track items.
- [ ] **Phase 13d — class-frameworks registry cleanup** (~1h). Consolidate the duplicated framework arrays (`welcome/page.tsx`, `classes/page.tsx`, `classes/[classId]/page.tsx`) into a canonical `src/lib/frameworks/class-frameworks.ts`.
- [ ] **Phase 13e — inline assign-unit modal** (~2h). Replace the "Assign unit" button on `/teacher/classes/[classId]` with a modal so teachers don't lose context navigating to `/teacher/units` and back.
- [ ] **Mentor Manager** — only after Matt's PYP coordinator meeting confirms scope. v0 (~3-5 days) is buildable post-meeting; don't pre-build.

## Open questions / blockers

- **Phase derivation source-of-truth.** Current 13b-1 derives `current_phase` heuristically at READ time (5-bucket of progress %). When AI-driven phase writes ship later (Open Studio v2 territory), the column should override the heuristic. Decision pending: which signals trigger an AI-driven phase write? (Reflection journal cadence, photo evidence, peer-review submission, mentor sign-off?) Not blocking 13b-3b polish.
- **Mentor scope architecture.** `student_projects.mentor_teacher_id` FKs to `teachers.id` today. When Mentor Manager ships and mentors include parents/alumni/community members, the FK either becomes a sibling `mentor_id` → `mentors.id` OR collapses to a polymorphic `mentor_ref (type, id)`. Decision deferred to Access Model v2 + Mentor Manager v1 scoping. Not blocking — works fine for staff-only mentors today.
- **Filter chip behavior under empty data.** Cold-start cohort has progress = 0% across all students → all phase chips except "Wonder" filter to empty. If empty filter result: render an info banner ("No students in {phase} phase yet") rather than a literal blank panel. Resolve during 13b-3b build.
