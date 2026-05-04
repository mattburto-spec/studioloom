# Handoff — preflight-active

**Last session ended:** 2026-05-04T05:30:00Z
**Worktree:** `/Users/matt/CWORK/questerra-preflight`
**HEAD:** `81f20ab` "fix(preflight): /api/fab/logout — 303 redirect to /fab/login (was raw JSON)"
**Top of main (post Round 2 closure):** `689023d`

## What just happened

- **Phase 8-1 audit gap CLOSURE ROUND 2 SHIPPED.** Matt's
  post-Access-v2 Preflight smoke caught 7 same-family Phase 8-1
  audit gaps + 2 UX bugs. The 28 Apr audit doc was complete for
  the *scope it audited* (queue+jobs+admin pages) but missed
  sibling routes that don't list jobs. Today's session closed all
  the rest in 7 PRs to main, all prod-validated cross-persona.

- **All fixes:**
  1. `/api/fab/machines` school-scoped (commit `9ddacce`)
  2. Student upload validation school-scoped (`f6acdec`)
  3. All 5 `/api/teacher/fabricators/*` admin routes
     school-scoped (closes `FU-FAB-INVITE-SCHOOL-SCOPED` + 4
     siblings — invite, list, deactivate, reset-password,
     machines reassign) — commit `277f69e`
  4. PostgREST embed → 2-query rewrite (`19856e8`) — fabricators
     FK references `auth.users` not `teachers`, embed couldn't
     resolve
  5. Fab admin actions menu portal-rendered (`40cb10e`) — escape
     table `overflow-hidden` clipping, click-outside + ESC
     dismissal added
  6. Fab logout 303 redirect (`81f20ab`) — was returning raw JSON
     to the browser via native form POST

- **New helpers in `fab-orchestration.ts`:**
  - `loadSchoolOwnedFabricator(db, schoolId, fabricatorId)`
  - `findFabricatorByEmail(db, email)` — returns fab + inviter
    school for the cross-school 409 disambiguation in invite

- **Tests 3494 → 3496** (+2 from new invite cases). 0 migrations.
  tsc strict clean throughout. CI green throughout.

- **`FU-FAB-INVITE-SCHOOL-SCOPED` ✅ RESOLVED** with closure note
  in `docs/projects/preflight-followups.md` documenting the
  5-route sweep + new helpers + audit-scope lesson.

## State of working tree

- Branch `preflight-active` clean + in sync with origin.
- Top-of-main `689023d` (PR #16 merge, fab logout 303 redirect).
- Tests: **3496 pass / 11 skipped**. tsc strict clean.
- One pre-existing unrelated `BugReportButton.tsx` TS error from
  Access v2 Phase 6 work (html-to-image module type) — not gated
  in CI, surfaces only on full `tsc --noEmit`.

## Next steps

- [ ] **Run actual fabrication submission E2E** — last truly-real
      loose end. Student upload → scanner → teacher approve → fab
      pickup → complete. Today's smoke validated each access-control
      path in isolation (cross-persona admin operations) but didn't
      run a real job through the full pipeline post Access v2 +
      post today's 7 fixes. ~10 min if everything works; longer if
      something else surfaces.

- [ ] **Optional:** consolidate the ~15 inline FUs scattered across
      ALL-PROJECTS.md / dashboard / changelog into
      `preflight-followups.md`. Mechanical cleanup pass; not
      blocking.

- [ ] **Pivot options after E2E smoke:**
  - **Access Model v2 is PILOT-READY** (Phase 6 closed in parallel
    session 4 May, tagged `v0.6-pilot1`). Pre-pilot operational
    polish (Sentry alerts, pilot smoke checklist) is the next
    natural pickup if not already actioned in another session.
  - **Dashboard-v2 polish** — earlier queued work; not touched
    today. Worktree at `questerra-dashboard` on
    `dashboard-v2-build`.
  - **CompliMate / Seedlings** — non-StudioLoom priorities per the
    master index. Complete-Mate has the 1 June GACC deadline pulling.

## Open questions / blockers

- **None blocking.** The session arc — post-Access-v2 smoke →
  audit gap closure round 2 — was a complete loop. Preflight is
  back on its feet, all access checks proven cross-persona under
  flat school membership. The fabrication submission E2E is the
  natural next pickup but isn't blocking anything else.

- **Lesson worth banking** for whoever runs the next audit pass:
  scope by **route prefix**, not feature concept. The 28 Apr audit
  framed scope as "queue + jobs + admin pages" and missed
  `/api/teacher/fabricators/*` + `/api/fab/machines` because
  those don't list jobs. Programmatic grep for
  `invited_by_teacher_id !==` + `teacher_id !== teacherId`
  surfaces every site mechanically.

- **PostgREST embed gotcha**: `fabricators.invited_by_teacher_id
  REFERENCES auth.users(id)` not `teachers(id)`, even though
  `teachers.id = auth.users.id` via mig 001 FK chain. Indirect
  chains don't work for PostgREST embeds — need a direct FK
  between embedded tables. Always grep `<column> REFERENCES`
  before assuming a lab-pattern embed copies clean to a different
  table.

- **3 Matts caveat** still applies (all 3 NIS personas have
  `display_name = null`, `name = "Matt"`). Phase 8-4 path 2
  disambiguation works under the hood but renders identically.
  Real NIS pilot with distinct teacher names will surface full
  disambiguation. Access Model v2's auth unification spec
  addresses this identity cleanup in its design.
