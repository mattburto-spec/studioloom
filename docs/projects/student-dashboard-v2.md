# Student Dashboard v2 — Build Tracker

Redesign of the student-facing `/dashboard` using the Bold design language
from `docs/newlook/PYPX Student Dashboard/student_bold.jsx`.
Shipped behind `sl_v2=1` cookie at `/dashboard/v2` during build.

## Phase status

| Phase | Scope | Status | Commit |
|-------|-------|--------|--------|
| 0 | Pre-flight audit + decisions | ✅ Done | — |
| 1 | Scaffold at `/dashboard/v2`, mock data | ✅ Done | `b89e89d` |
| 2 | Wire TopNav + hero greeting to session | ✅ Done | `b2a8d12` |
| 3A | Wire hero unit identity (title, subtitle, class, color, image, %) | ✅ Done | `a88b330` + `934ddfe` |
| 3B | Wire hero current task (activity block) + lesson progress + due | ✅ Done | _(this commit)_ |
| 3C | Teacher note — **deferred to end-of-project**, see below | ⏸ Deferred | — |
| 4 | Wire Priority queue | ✅ Done | _(this commit)_ |
| 5 | Wire Units grid | ✅ Done | _(this commit)_ |
| 6 | Wire Badges | ⏳ Planned | — |
| 7 | Wire Feedback section | ⏳ Planned | — |
| 8 | Cutover `/dashboard` → v2, remove opt-out hatch | ⏳ Planned | — |

## End-of-project TODO list

Items Matt has flagged to handle before or during Phase 8 cutover.

- [ ] **General notes/comments system** to replace the hero's "teacher note"
      slot. Must be bidirectional (teacher AND student can post), and designed
      to break out of 1:1 silos — "get students out of the silo, make things
      more public". Scope TBD — could anchor to unit, lesson, block, or class.
      Feeds the hero card + likely a "notes" tab on unit detail.
- [ ] **Element reordering pass** — Matt flagged that he may want to reorder
      hero / priority / units / badges / feedback after seeing them wired.
      Review once all sections are live on real data.
- [ ] Pill nav routing (My work / Units / Badges / Journal / Resources) —
      currently dead links. Decide whether these become real routes or
      in-page tabs before cutover.
- [ ] Search button functionality.
- [ ] Bell/notifications count — tie to insights/priority queue.
- [ ] **Snooze button (priority queue)** — currently a visual stub. Wire up
      so overdue items can be snoozed. Matt wants to play with this with
      students — potential behaviour experiment around deferral/avoidance.
      Needs a `snoozed_until` column on the relevant source table and a
      filter in `/api/student/insights`.
- [ ] **Focus mode** — a "Focus" button on the hero (or elsewhere) that
      hides everything except the current next step (the activity block
      title + continue button). Removes the priority queue, units grid,
      badges, feedback. Student gets a minimal single-task view to avoid
      overwhelm. Exit button returns to full dashboard. _(Matt, 22 Apr 2026)_
- [ ] Remove the `pathname === "/dashboard/v2"` opt-out escape hatch from
      `(student)/layout.tsx` (introduced in Phase 1, tagged with a
      "remove at Phase 8 cutover" comment).
- [ ] Drop the `sl_v2` cookie gate — v2 becomes the default `/dashboard`.
- [ ] Keep old `/dashboard` as `_legacy` for one week post-cutover, then delete.
- [ ] Theme system — Phase 1 hardcoded the Bold cream palette. Decide whether
      to honor student `theme_id` (Option a from Phase 0), slot Bold in as a
      new theme (Option c), or retire themes entirely.
- [ ] Responsive pass (mobile + tablet) — Phase 1–7 were desktop-only.
- [ ] Accessibility audit (contrast, focus states, keyboard nav).

## Key product decisions (captured during build)

- **Hero framing:** project management, not activity feed. "Current task"
  means the specific activity block in the current lesson, "task progress"
  means progress through that lesson's blocks. Don't say "phase".
  _(Matt, 22 Apr 2026)_
- **Notes system:** notes card on hero is deferred because the right model
  is a general bidirectional notes system, not a teacher-only feature.
  _(Matt, 22 Apr 2026)_
- **Open Studio placement:** no inline "Open Studio available" marker on
  regular unit cards. Instead, when a student has Open Studio enabled, it
  becomes **its own card in the grid** (treated like a class). If it's the
  primary thing they're working on, it takes the **hero card** slot.
  Rationale: mixing OS state into unit cards confuses students; a separate
  card is cleaner. Not for v1 build — wire when the separate-card treatment
  is designed. _(Matt, 22 Apr 2026)_
- **Per-card due dates:** dropped from unit grid cards for v1. Matt will
  wire due dates into cards as part of the assessment/grading work. Due
  info stays visible via the priority queue. _(Matt, 22 Apr 2026)_
