# Teacher Dashboard v1 (Bold) — Build Tracker

Redesign of `/teacher/dashboard` using the Bold design language from
[`docs/newlook/PYPX Student Dashboard/teacher_bold.jsx`](../newlook/PYPX%20Student%20Dashboard/teacher_bold.jsx)
— same type system and aesthetic as the shipped student dashboard
(`student_bold.jsx`), so teacher + student stay visually consistent.

Shipped behind `tl_v2=1` cookie at `/teacher/dashboard/v2` during build,
then cut over (same playbook as student-dashboard-v2).

**Worktree:** `/Users/matt/CWORK/questerra-dashboard` on `dashboard-v2-build`.
Commits land on this branch and merge to main per phase.

## Design pick

**Bold.** Rejected alternatives:
- `teacher_redesign.jsx` (cockpit/dense) — breaks student/teacher visual
  parity.
- `teacher_editorial.jsx` (magazine/serif) — same reason + harder to
  cram dense data into editorial rhythm.

Bold's sections (in render order): `TopNav` · `NowHero` · `TodayRail`
(4 periods) · `Insights` (4 cards) · `UnitsGrid` · `Admin`.

## Source → target mapping

| Bold section | Mock data (`teacher_bold.jsx`) | Real data source | Gap |
|---|---|---|---|
| TopNav scope chip | `PROGRAMS` (4 cross-program) | `data.classes[].framework` | Mocks show programs; adapt to class-filter. No schema change. |
| NowHero | `NEXT` (period, room, startsIn, phasePct, ready/students, ungraded) | Join of `LessonSchedule` + `class_units` + `student_progress` + `unmarkedWork` | **New endpoint required.** `/api/teacher/dashboard/current-period` — cross-references today's timetable slot with unit phase % + ungraded count for that class-unit. |
| TodayRail | `SCHEDULE` (4 periods) | Same endpoint, extended | Return full day, not just current slot. |
| Insights (4 cards) | `INSIGHTS` aggregated: `5 students stuck`, `15 pieces waiting`, `↓62% keystroke`, `↑38% surge` | `data.insights` + `stuckStudents` + `unmarkedWork` | **Aggregation gap.** Current `DashboardInsight` is per-item. Bold wants grouped counts. Add `/api/teacher/dashboard/insights-aggregated` OR a reducer on the client. Start with client-side reducer — cheaper. |
| UnitsGrid | `UNITS` with `img/badges/progress/due` | `data.classes[].units` — has `thumbnailUrl`, `isForked`, `unitType`, `badgeRequirementCount`, `completionPct` | Clean map. No schema change. `due` needs `class_units.end_date` or similar — may already exist. |
| Admin | `ADMIN` counts (pending invites, settings) | Various | Low priority — keep stub for v1 cutover, wire in Phase 5. |

## Phase plan

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Pre-flight audit + verify current-period data availability | ✅ Done |
| 1 | Scaffold `/teacher/dashboard/v2` behind `tl_v2=1`, Bold palette, mock data, one component per section | ✅ Done |
| 2 | Wire TopNav + welcome header to `useTeacher()` + `/api/teacher/dashboard` | ✅ Done |
| 3A | `NowHero` — wire class/unit/period/phase% (reused `/api/teacher/schedule/today`, no new endpoint needed) | ✅ Done |
| 3B | `NowHero` — wire student count + ungraded count pills (ready/unready ratio deferred — needs per-student page progress) | ✅ Done |
| 4 | `TodayRail` — real today's entries rendered as cards with state (live/next/upcoming/done) | ✅ Done |
| 5 | `Insights` — client-side reducer mapping 6 `InsightType`s → 4 Bold buckets (Act/Grade/Watch/Celebrate) | ✅ Done |
| 6 | `UnitsGrid` — wire from `data.classes[].units`, badges (fork/ungraded/NM), thumbnail, completion % | ✅ Done |
| 7 | `Admin` — empty-class housekeeping list with per-class "Assign unit" link (invites / safety / drafts deferred — not cheaply derivable) | ✅ Done |
| 8 | Cutover `/teacher/dashboard` → Bold shell, move old to `/teacher/dashboard-legacy`, drop `tl_v2` cookie gate + enable/disable routes | ✅ Done |
| 9 | Loading skeleton + per-section empty states + 0-classes welcome hero (mock fallback fully removed) | ✅ Done |
| 9b | Refresh button + error boundary (deferred — non-blocking) | ⏳ Planned |
| 10 | Responsive pass (tablet first — teachers use iPads for Teaching Mode) | ⏳ Planned |
| 11 | Accessibility pass | ⏳ Planned |
| 12 | Delete `/teacher/dashboard-legacy` (scheduled for ≥ 2026-05-01, 1 week after cutover on 2026-04-24) | ⏳ Planned |

## Open questions (decide during Phase 0)

1. **Scope chip behavior.** Current data has `framework` per class, no "program" concept. Options: (a) hide scope chip for v1, (b) make it class-filter ("All classes / 7 Design / 10 Design …"), (c) framework-filter ("All / MYP / GCSE …"). Recommend **(b)** — matches what teachers actually want.
2. **NowHero fallback when no class is scheduled now.** Show "next class later today" / "no class today" / empty-state CTA? The mock assumes a class is always imminent.
3. **Insights aggregation granularity.** Bold mock says `5 students stuck` (count). Current `DashboardInsight` is per-item. Is client-side grouping by `type` sufficient, or do we need server-side aggregation for counts like `↓62% keystroke drop`? Recommend client-side grouping for v1; server-side aggregation if needed in Phase 5.
4. **Onboarding path.** Current dashboard has a `WelcomeOnboarding` component for teachers with 0 classes. Port as-is or redesign in Bold? Recommend port as-is — rare first-run state, not worth blocking on.
5. **Teaching Mode button wiring.** Mock has "Start teaching" button. Should it go straight to `/teacher/teach/[unitId]` or offer a quick "launch class" chooser if there are multiple live periods?

## Pre-flight checklist (Phase 0 gate)

Before Phase 1 starts:
- [ ] `git status` clean on `dashboard-v2-build`
- [ ] `npm test` baseline captured
- [ ] Confirm `LessonSchedule` + `TimetableGrid` data is populated for Matt's own classes (if empty, NowHero has nothing to render — block Phase 3 until seeded)
- [ ] Decide open questions 1-5 above
- [ ] Create `src/components/teacher-dashboard-v2/` folder with `README.md` noting v1 nature + removal plan

## Next steps

When Matt says **"continue teacher dashboard"** or **"teacher next"**:
1. Read this tracker.
2. Find the first phase with status ⏳ Planned.
3. Draft a Phase X brief using the `build-phase-prep` skill.
4. After each phase ships + smoke-tests pass, flip to ✅ Done in this
   tracker and commit in the same PR.
