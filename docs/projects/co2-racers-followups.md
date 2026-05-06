# CO2 Racers Agency Unit — Follow-up Tickets

> Deferred items surfaced during the AG.1–AG.6 build + smoke rounds 1–7
> (5–6 May 2026). NOT blockers for the unit launching with Class 1; pick
> up post-pilot feedback or when explicitly triggered.
>
> See also: build brief at [`docs/units/co2-racers-build-brief.md`](../units/co2-racers-build-brief.md),
> agency-unit pedagogy at [`docs/units/co2-racers-agency-unit.md`](../units/co2-racers-agency-unit.md),
> and the merged PR list (#47–#63 on origin/main).
>
> Created 6 May 2026 after smoke round 7 closed. New entries appended
> chronologically; resolved items moved to the bottom under "Resolved".

---

## FU-AGENCY-AUTH-SMOKE — Test 6 auth + scope guards (cross-account)
**Surfaced:** 6 May 2026, smoke rounds 4–7 (couldn't run without a second teacher account)
**Target phase:** When Matt sets up a second teacher account at NIS or another pilot school
**Severity:** 🟡 MEDIUM (server-side guards already implemented in AG.4.1; this is verification, not implementation)

**Origin:** Test 6 of the AG.1 smoke checklist asks for cross-teacher /
unauthenticated probes against the new endpoints. Matt: *"can you write
test 6 as a follow up... as i dont have another teacher setup yet."*

**What to verify** (the AG.4.1 route + AG.2.3a/AG.3.3 student endpoints
all already enforce these — this is regression-spotting):

1. **Cross-teacher 403 on `/api/teacher/student-attention`**
   - Log in as Teacher A. Get the `classId` of a class owned by Teacher B
     (via DB or a second browser).
   - Visit `/teacher/units/<unitId>/class/<B-classId>?tab=attention`.
   - Expected: panel shows the load-error state with a 403-shaped
     message ("Forbidden: not your class"), or the row data is empty.
     Do NOT expect to see Teacher B's student data.
   - Code path: `requireTeacherAuth` + `verifyTeacherOwnsClass` in
     `src/app/api/teacher/student-attention/route.ts`.

2. **Unauthenticated 401 on student endpoints**
   - Open a private/incognito browser window (no session cookies).
   - Hit each directly:
     - `/api/student/kanban?unitId=<any-uuid>` → 401
     - `/api/student/timeline?unitId=<any-uuid>` → 401
   - Code path: `requireStudentSession` token validation.

3. **Unauthenticated 401 on teacher endpoint**
   - Same incognito window.
   - Hit `/api/teacher/student-attention?unitId=<uuid>&classId=<uuid>`
     → 401.

4. **400 on malformed `unitId` / `classId`**
   - As an authenticated teacher, hit
     `/api/teacher/student-attention?unitId=not-a-uuid&classId=<valid>`
     → 400 with `error: "unitId required and must be UUID"`.
   - Hit with `classId=not-a-uuid` → 400 with the classId-specific
     message.
   - Code path: `UUID_RE` validation block early in the route.

**How to run:** browser DevTools → Network tab → copy a working URL,
modify the params, paste back. Or `curl` from terminal with cookies
captured (`document.cookie` in DevTools console).

**Pass criteria:** 4× 4xx responses, 0 data leaks, 0 stack traces in
the response body.

**Rationale for filing as FU:** the implementation in AG.4.1 + AG.2.3a +
AG.3.3 included these guards from day one (mirrored from existing
`/api/teacher/*` patterns + verified by source-static guards in the
test files). They're tested at the source level — running the actual
HTTP probes is the live-environment confirmation step.

---

_(FU-AGENCY-CALIBRATION-MINIVIEW resolved 6 May 2026 — see Resolved section below.)_

---

## FU-AGENCY-NARRATIVE-PAGE — `/unit/[unitId]/narrative` blank-page route
**Surfaced:** 6 May 2026, smoke round 2 (Matt: "narrative... blank page")
**Target phase:** When the per-unit Narrative needs its own canonical surface
**Severity:** 🟢 LOW (functionality is reachable via the Portfolio panel's Narrative tab — round 5 dual-key fix made it actually work)

**Origin:** The Portfolio panel exposes a **Narrative** tab that mounts
`<NarrativeView>`. There's also a separate route
`src/app/(student)/unit/[unitId]/narrative/page.tsx` that renders the
same view, but nothing on the student-facing UI currently links to it
directly (round 2 dropped the in-page Narrative link from the board
page header). It's reachable only via direct URL today.

**Decision needed:** keep the route or delete it? If kept, design a
proper entry-point — probably a tab strip on the board page (Board /
Narrative / Grades) when there's enough surface to justify it.

---

## FU-AGENCY-BECAUSE-EDITABLE — Edit Three Cs evidence after card moves to Done
**Surfaced:** 6 May 2026, smoke round 1 + comment
**Target phase:** When students start asking
**Severity:** 🟢 LOW

**Origin:** The Kanban Done-card edit view shows the captured `becauseClause`
in a read-only emerald panel (smoke round 1). Editing requires a new
`updateBecauseClause` reducer action. Deferred because v1 captures the
clause at move-to-Done time and that's good enough — students
typically don't need to re-edit their Three Cs evidence after the fact.

**Scope when picked up:**
- Add `updateBecauseClause` action to `src/lib/unit-tools/kanban/reducer.ts`
- Wire `onUpdateBecauseClause` prop through `KanbanBoard` →
  `useKanbanBoard` hook → `KanbanCardModal`
- Replace the read-only div with a textarea + commit-on-blur

---

## FU-AGENCY-JOURNAL-PHOTO-PREVIEW — Surface saved photo in the journal preview block
**Surfaced:** 6 May 2026, smoke round 4
**Target phase:** Post-pilot
**Severity:** 🟢 LOW

**Origin:** When a Process Journal entry is saved with a photo, the
photo persists on the `portfolio_entries` row but the green "Journal
saved" preview block doesn't render it inline. Student can still see
the photo via the Portfolio panel's entry list. Deferred for v1 because
the workaround is already there.

**Scope:** thread `media_url` from `portfolio_entries` back through
`savedValue` (currently just the markdown content). Consider whether
`savedValue` should become a richer `SavedJournalSnapshot` shape or
stay as a plain string with `mediaUrl` as a sibling prop.

---

_(FU-AGENCY-PLANNINGPANEL-CLEANUP resolved 6 May 2026 — see Resolved section below.)_

---

## FU-AGENCY-CLASS-GALLERY-RAIL — Restore Class Gallery rail button when ready
**Surfaced:** 6 May 2026, smoke round 6 (Matt: *"temporarily remove the class gallery button as thats not something i have time for right now"*)
**Target phase:** When Matt's ready to wire the Class Gallery into the agency unit
**Severity:** 🟢 LOW (intentional removal, not a regression)

**Origin:** Round 6 dropped the 4th rail entry (`id: "gallery"`,
`label: "Class Gallery"`, `accent: true`, `onClick: window.open(...)`).
The drop is documented in the new comment at the top of the rail
block. To restore: re-add the entry to the `tools` array in
`src/app/(student)/unit/[unitId]/[pageId]/page.tsx` line ~520.

---

## FU-AGENCY-PPT-EXPORT-RESTORE — Restore PowerPoint export button on Portfolio panel
**Surfaced:** 6 May 2026, smoke round 10 (Matt: *"remove the download as PPT in portfolio view. add it as a follow up later."*)
**Target phase:** When a real teacher / student wants to export the portfolio for an exhibition or report
**Severity:** 🟢 LOW (intentional removal, not a regression)

**Origin:** PortfolioPanel had an ExportPortfolioPpt button (top-right
of the panel header) that generates a .pptx with one slide per entry.
Removed in round 10 because it cluttered the panel UX and isn't part
of the agency-unit pilot scope.

**Restore steps:**
- `src/components/portfolio/PortfolioPanel.tsx`:
  - Re-add `import dynamic from "next/dynamic"`
  - Re-add `const ExportPortfolioPpt = dynamic(() => import("./ExportPortfolioPpt").then((m) => ({ default: m.ExportPortfolioPpt })), { ssr: false, loading: () => null });`
  - Re-add the conditional render block (replace the round-10 doc comment) at line ~140:
    ```tsx
    {!loading && entries.length > 0 && (
      <ExportPortfolioPpt
        entries={entries}
        unitTitle={unitTitle || "Portfolio"}
        studentName={studentName}
      />
    )}
    ```

`src/components/portfolio/ExportPortfolioPpt.tsx` is untouched — the
component still works, just nothing mounts it now.

---

## FU-AGENCY-PACE-PULSE — Reinstate end-of-lesson pace pulse with fewer questions
**Surfaced:** 6 May 2026, smoke round 7 (Matt: *"too many questions"*)
**Target phase:** When the timing model needs the data again
**Severity:** 🟢 LOW (feature pause, not deletion)

**Origin:** Round 7 removed the `setShowFeedbackPulse(true)` trigger from
the lesson page's `onComplete` handler. The `<StudentFeedbackPulse>`
modal still exists (gated on `showFeedbackPulse` state) but nothing
turns it on. Fastest restore: replace 2 lines in `onComplete`. Better
restore: trim the question set first so it's a single-tap emoji.

---

## Resolved

### ✅ FU-AGENCY-CALIBRATION-MINIVIEW (6 May 2026, PR #65)
Built the row-click → modal flow end-to-end. Side-by-side self-rating
chip vs 4 teacher rating buttons (Emerging/Developing/Applying/Extending)
+ per-element comment textarea + auto-close after save. Panel
re-fetches via a refreshKey state so Calibration timestamps + Three Cs
aggregates update immediately. Posts via the existing
/api/teacher/nm-observation route. 25 new tests, tsc strict clean.

### ✅ FU-AGENCY-PLANNINGPANEL-CLEANUP (6 May 2026, PR #66)
Deleted 6 orphaned files after grep audit confirmed no remaining
consumers in `src/`:
- `src/components/planning/PlanningPanel.tsx`
- `src/components/planning/PlanningPanelV2.tsx`
- `src/components/planning/GanttPanel.tsx`
- `src/components/planning/DesignPlanBoard.tsx`
- `src/components/planning/DueDateDisplay.tsx`
- `src/components/planning/FloatingTimer.tsx`
- `src/app/api/student/planning/route.ts` (the only consumer of the
  `planning_tasks` table from app code)

Empty `src/components/planning/` and `src/app/api/student/planning/`
directories removed. `5f-wiring-static.test.ts` updated (planning
route removed from list; expected count 15 → 14).

**`planning_tasks` table left intact in prod** — table still exists
+ has historical data; no migration filed yet. If we want to drop it,
file a separate followup with a migration + Matt sign-off.
