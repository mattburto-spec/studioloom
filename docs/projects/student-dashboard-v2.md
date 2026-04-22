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
| 3B | Wire hero current task (activity block) + lesson progress + due | ✅ Done | `cfa2a00` |
| 3C | Teacher note — **deferred to end-of-project**, see below | ⏸ Deferred | — |
| 4 | Wire Priority queue | ✅ Done | `454f98b` |
| 4.5 | Continue button + mock-flash fix | ✅ Done | `97b3046` + `67bacab` |
| 5 | Wire Units grid | ✅ Done | `20f40f7` |
| 6 | Wire Badges | ✅ Done | `d913fe8` |
| 7 | Feedback section — dropped, no backing data until notes system | ✅ Done (dropped) | `8d6483b` |
| 8 | Cutover `/dashboard` → v2; old kept at `/dashboard-legacy` | ✅ Done | `be5c1d6` |
| 9 | Quick wins — bell count, pill anchors, dead-link cleanup, hide fake teacher note | ✅ Done | _(this commit)_ |
| 10 | Unified student header across all routes | ⏳ Planned | — |
| 11 | Responsive pass (mobile + tablet) | ⏳ Planned | — |
| 12 | Focus mode (hides everything except next step) | ⏳ Planned | — |
| 13 | Snooze button behaviour experiment | ⏳ Planned | — |
| 14 | General bidirectional notes system | ⏳ Planned | — |
| 15 | Delete `/dashboard-legacy` rollback (≥ 2026-04-29) | ⏳ Scheduled | — |
| 16 | Accessibility pass | ⏳ Planned | — |

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
- [x] ~~Remove the `pathname === "/dashboard/v2"` opt-out escape hatch~~ — done
      at Phase 8 cutover; layout still opts out of its shell on `/dashboard`
      because the Bold TopNav replaces the legacy header.
- [x] ~~Drop the `sl_v2` cookie gate~~ — removed at Phase 8 cutover.
- [ ] Delete `/dashboard-legacy` route once one week of stable prod use has
      passed (cutover 2026-04-22). Currently kept as a one-click rollback
      path in case of urgent issues with the Bold dashboard.
- [ ] Theme system — Phase 1 hardcoded the Bold cream palette. Decide whether
      to honor student `theme_id` (Option a from Phase 0), slot Bold in as a
      new theme (Option c), or retire themes entirely.
- [ ] Responsive pass (mobile + tablet) — Phase 1–7 were desktop-only.
- [ ] Accessibility audit (contrast, focus states, keyboard nav).

## Next steps — ordered plan (post-cutover)

When Matt says **"continue dashboard"** or **"dashboard next"**, start from
the top of this list and pick up the first unchecked item. Each item has
a rough size estimate and a scope note.

### Phase 9 — Quick wins (~30 min total) ✅ Done
Small, high-impact polish. Shipped as one batch.

- [x] **9.1 Bell notifications count** — red badge shows count of
  `overdue + today` items, capped at `9+`, hidden at 0. Computed from
  the existing `buckets` state.

- [x] **9.2 Pill nav → in-page anchor scroll** — hero, units, badges
  sections gained stable IDs (`dashboard-hero` / `-units` / `-badges`).
  Pills smooth-scroll to target with 80px offset for the sticky nav.
  `Journal` and `Resources` render with `disabled` + `aria-disabled` +
  dimmed style + "Coming soon" title.

- [x] **9.3 Remove dead "See all X" links** — removed "See all
  upcoming →" and "All badges" buttons. "All messages" already gone
  with the Feedback section in Phase 7.

- [x] **9.4 Hero teacher note — hidden on real data** — `HeroUnit.teacherNote`
  is now `{...} | null`; `buildHeroUnit()` sets it to `null` so real
  students don't see a fake Mr. Griffiths message. Preview/mock path
  still renders the note because `HERO_MOCK.teacherNote` is preserved.
  Note: in the real render path the avatar initials are now derived
  from `teacherNote.from` so Phase 14's notes system can reuse the
  same card as-is when it wires real teacher/student writers.

### Phase 10 — Unified student header (~2 hours)
Biggest single-visit polish. Right now `/dashboard` has the Bold TopNav
but `/unit/*`, `/gallery/*`, `/safety/*`, `/my-tools/*` show the legacy
student-layout header. Pick one and make it consistent everywhere.

- [ ] **10.1 Decide unified header direction** — options: (a) install Bold
      TopNav in `(student)/layout.tsx` so every page uses it; (b) keep both
      and style them similarly so the switch is less jarring; (c) strip the
      legacy header entirely, let each page own its chrome. Recommend (a).
- [ ] **10.2 Implement** — move TopNav into the layout (or a shared header
      component it imports). Handle per-route "active pill" state.
- [ ] **10.3 Remove `if (pathname === "/dashboard")` escape hatch** in
      layout.tsx once the shared header is in place.

### Phase 11 — Responsive pass (~3 hours)
Desktop-only right now. Real students use Chromebooks, iPads, phones.

- [ ] **11.1 Hero** — single-column stack under ~900px, drop teacher note
      card to below the task card (or hide).
- [ ] **11.2 Priority queue** — 3-col → single column under ~900px with
      overdue first. Tabs under ~600px?
- [ ] **11.3 Units grid** — 3 → 2 → 1 col at tablet/mobile breakpoints.
- [ ] **11.4 Badges** — 5/7 col grid → stack.
- [ ] **11.5 TopNav** — pill nav collapses to hamburger at mobile.
- [ ] **11.6 Test on real devices** (Matt can bring his iPad / phone).

### Phase 12 — Focus mode (~1-2 hours)
Matt flagged this as a future idea during Phase 3B. Single "Focus" button
on hero. Hides everything except the next step.

- [ ] **12.1 Add Focus button to hero** (next to Continue)
- [ ] **12.2 Local state `focusMode: boolean`** — no persistence needed.
- [ ] **12.3 When true** — render only the hero task card (centered,
      enlarged) + a "Back to dashboard" exit button. Hide TopNav,
      priority queue, units, badges.
- [ ] **12.4 Keyboard escape** — Esc key exits focus mode.

### Phase 13 — Snooze button (~2-3 hours, needs schema change)
Behaviour experiment Matt wants to try with students. Deferral tracking.

- [ ] **13.1 Schema** — decide where `snoozed_until` lives. Probably on
      `student_progress` (per-page) or a new `snoozes` table keyed by
      `(student_id, source_type, source_id)`.
- [ ] **13.2 Migration** — add column/table.
- [ ] **13.3 API** — `POST /api/student/insights/snooze` takes
      `(insightType, sourceId, until)` → writes row.
- [ ] **13.4 Insights filter** — exclude snoozed items from the feed.
- [ ] **13.5 UI** — wire the Snooze button on overdue cards to a snooze
      picker (tomorrow / next week / custom).
- [ ] **13.6 Analytics stub** — log snooze events for Matt to review
      with students.

### Phase 14 — Notes system (bigger, ~3-5 days)
The general bidirectional notes feature. Restores the hero teacher note
card (9.4) and a Feedback section (dropped in Phase 7).

- [ ] **14.1 Spec** — decide anchor model (unit? lesson? block? class?),
      visibility (1:1, class-wide, public), writer roles (teacher +
      student, per Matt's note about breaking silos).
- [ ] **14.2 Schema + migration**
- [ ] **14.3 API** — list, post, edit, delete
- [ ] **14.4 Hero card** — pull latest note for the current unit
- [ ] **14.5 Feedback section** — restore on the dashboard, list view of
      recent notes received
- [ ] **14.6 Notes tab / panel** on unit detail pages

### Phase 15 — Legacy cleanup (~10 min, do 2026-04-29+)
One week post-cutover. Only do if prod has been stable.

- [ ] **15.1 Delete `/dashboard-legacy`** route + page file
- [ ] **15.2 Purge stale TODO notes** about the legacy rollback
- [ ] **15.3 Close the Phase 15 entry** here

### Phase 16 — Accessibility pass (~4 hours)
Last polish before calling v2 shipped-and-done.

- [ ] **16.1 Contrast audit** — hero text on saturated color bg, pill nav,
      ring-progress numbers. Check WCAG AA at minimum.
- [ ] **16.2 Keyboard navigation** — tab order through cards, Enter
      activates Links, Escape closes overlays.
- [ ] **16.3 Focus states** — visible outlines on all interactive elements.
- [ ] **16.4 Screen reader** — alt text on unit images, aria-labels on
      icon-only buttons (bell, search, avatar).

---

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
