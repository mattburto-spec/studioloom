# Handoff — main

**Last session ended:** 2026-05-12T03:30Z
**Worktree:** `/Users/matt/CWORK/questerra-grading` (parallel session — main worktree at `/Users/matt/CWORK/questerra`)
**HEAD on main after merges:** `e2a0caf` "feat(tfl.3 C.4): tweak buttons (Shorter / Warmer / Sharper / + Ask) (#213)" → C.5 PR #214 merging at session close

> Supersedes the prior `main.md` (11 May 2026 PM Summative Lessons B′ scoping). Summative Lessons remains deferred per `docs/projects/summative-lessons.md`.

## What just happened (12 May 2026 session)

Closed the **TFL.3 Pass C** brief end-to-end in a single long session — 8 PRs (#193, #195, #198, #204, #205, #206, #210, #213, #214) covering the entire C.1 → C.5 build plus three smoke-driven polish iterations. The Teacher Marking Inbox at `/teacher/inbox` is now the daily-driver approve-and-go surface. Legacy `/teacher/marking` cohort heatmap stays as the deep-dive (one click away).

**Highlights:**
- **C.3.3** prod migration `20260512023440_student_tile_grades_resolved_at` applied + logged in `applied_migrations`. Cross-device "Mark resolved" via new `resolved_at` + `resolved_by` columns + partial index.
- **C.4** new `regenerateDraft` helper + `/api/teacher/grading/regenerate-draft` route — 4 tweak directives (shorter / warmer / sharper / ask) with PII round-trip (real → placeholder → real).
- **C.5** TopNav Marking badge + `/api/teacher/inbox/count` endpoint — amber when reply_waiting, purple-tint otherwise, 60s tab-aware polling.
- Three smoke-driven hotfixes mid-session: handleApprove silently no-op'd because it read the wrong draft slot (#205); marking page kicked back to Lesson 1 after AI suggest (#206); inbox didn't auto-refresh (#206).
- One approach pivot mid-session: PR #208 (localStorage for Mark resolved) was closed in favour of server-side persistence (PR #210) when Matt flagged the school-laptop ↔ home-laptop case. Migration discipline followed — paused for prod apply before merge.

See `docs/changelog.md` 2026-05-12 entry for the full breakdown.

## State of working tree

- **Branch:** `feat/inbox-c5-dashboard-chip` (PR #214, CI green, awaiting merge at session end)
- **Pending push:** 1 commit (saveme docs — this handoff + changelog + 3 new FUs + registry sync). Will be bundled into #214.
- **Tests:** 831/831 in last broader sweep (grading + teacher + api + components + PII grep)
- **tsc:** strict clean on all touched files (pre-existing pipeline `framing/task/success_signal` errors in stage2/4/6 tests are unchanged and unrelated)
- **Migrations applied to prod this session:** 1 (`20260512023440_student_tile_grades_resolved_at`)
- **Migration tracker:** logged via `applied_migrations` INSERT
- **Worktrees:** main worktree at `/Users/matt/CWORK/questerra` is reserved as the cutover baseline; this session ran in `/Users/matt/CWORK/questerra-grading`

## Next steps

- [ ] **Matt smokes Pass C end-to-end** on live (`studioloom.org/teacher/inbox`):
  - Tweak buttons: click each of Shorter / Warmer / Sharper / + Ask on a drafted item + on a reply_waiting item. Verify the text rewrites + no "Student" leaks back into output (real-name restore should always swap back).
  - Marking badge: open any teacher page → amber pill on "Marking" when reply_waiting exists; purple-tint pill when only drafts; hidden when zero. Hover for tooltip.
  - 60s polling: leave inbox open, have a student submit something fresh; verify it shows up within ~60s without refresh.
  - Cross-device Mark resolved: mark a got-it resolved on laptop A → reload on laptop B (or incognito) → stays gone. Have student send another reply → re-surfaces.
- [ ] **Pick the next inflection point.** Three filed FUs sit at P3 (cohort comparison in inbox, ask-templates, push escalation). All gated on real pilot usage data. Worth waiting for ≥2 weeks of teacher use before picking.
- [ ] **Watch for Pass C regressions** in the first week of real use. The four sub-phases interact tightly (the C.3.1 sentinel UX, C.3.3 resolved_at re-surface, C.4 tweak-state, C.5 count endpoint all share state derivation in inbox-loader.ts).

## Open questions / blockers

_None active._ Pass C is structurally complete. The 3 new follow-ups in `docs/projects/grading-followups.md` are explicitly post-pilot work — they wait on usage data, not on architectural decisions.

## Trigger phrases

- `continue tfl3` / `inbox` → resume on the Pass D backlog (currently the 3 P3 FUs above)
- `continue marking` → resume on the legacy /teacher/marking page (still alive for cohort heatmap; not currently scheduled)
- `summative` → resume the deferred Summative Lessons B′ work (semester boundary)
