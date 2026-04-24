# teacher-dashboard-v2 (Bold)

Section components for the redesigned teacher dashboard built from
`docs/newlook/PYPX Student Dashboard/teacher_bold.jsx`.

Render at `/teacher/dashboard/v2` during the build phase (gated by
the `tl_v2=1` cookie). Cut over `/teacher/dashboard` → v2 in Phase 8
of the build tracker (`docs/projects/teacher-dashboard-v1.md`).

## Layout

- `styles.ts` — scoped `.tl-v2` CSS + `useScopedStyles` hook. All
  components rely on the CSS variables (`--bg`, `--ink`, `--hair`, …)
  and utility classes (`.display`, `.cap`, `.tnum`, `.card-shadow`, …)
  defined here.
- `icons.tsx` — `<I name="play|chev|arrow|…" />` component lifted from
  `teacher_bold.jsx`.
- `mock-data.ts` — Phase 1 stub data (PROGRAMS, NEXT, SCHEDULE,
  INSIGHTS, UNITS, UNASSIGNED). Replaced with real data wiring in
  Phases 2-7.
- `TopNav.tsx` / `NowHero.tsx` / `TodayRail.tsx` / `Insights.tsx` /
  `UnitsGrid.tsx` / `Admin.tsx` — one section per file, Bold
  structure preserved as-is from the mock.

## Lifecycle

| Phase | Section | Data wired |
|-------|---------|------------|
| 1     | All 6 sections | Mock only |
| 2     | `TopNav` | `useTeacher()`, class list |
| 3A    | `NowHero` | New `/api/teacher/dashboard/current-period` endpoint |
| 3B    | `NowHero` | Ungraded + ready counts |
| 4     | `TodayRail` | Full-day slots |
| 5     | `Insights` | Client-side reducer over `DashboardData.insights` |
| 6     | `UnitsGrid` | `data.classes[].units` |
| 7     | `Admin` | Pending invites, safety alerts |

After cutover (Phase 8), this directory is the production teacher
dashboard — no "v2" in the path, but the folder name stays until
Phase 12 (legacy delete).
