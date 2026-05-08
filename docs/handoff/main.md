# Handoff — main (post 7-8 May 2026 marathon)

**Last session ended:** 2026-05-08T05:30:00Z
**Worktree:** `/Users/matt/CWORK/questerra-tasks`
**HEAD (main):** `bd584b7` at saveme time — saveme PR will advance one commit when merged
**Pending push count:** 0 (everything merged via PRs as it went)

> Supersedes the prior `main.md` handoff (Phase 4 Part 2 — 3 May 2026, access-v2 shipped). That earlier session's narrative is captured in `changelog.md`.

## What just happened (7-8 May 2026 marathon)

20 PRs merged plus one prod-applied migration. Three concern areas:

### A. Kanban drag-and-drop saga (rounds 36 → 43)

- **Root causes found:**
  - Modal-on-drop = framer-motion fires `onDragEnd` twice (round 36 trace caught it; round 37 `isDraggingRef` fixed it).
  - Fly-back = save race in `useKanbanBoard.flushSave` clobbering local state with server response (round 41 fixed via `stateRef.current === snapshot` check).
  - Lesson nav silently no-op'd to recently-created `[pageId]` segments → switched to `window.location.href` hard-nav (round 43).
- **Banked lessons:** #74 (instrument before adding more guards in same layer); #75 (when same-layer guards keep failing, look upstream/downstream).
- **PR span:** #96 → #102 (rounds 37–43 + cleanup).

### B. Kanban + dashboard new features

- **#103** Kanban pulse pill in Class Hub Attention tab (`Cards: N · M done` per student).
- **#104** Backlog Ideation tool — Socratic Haiku helper at `POST /api/tools/kanban-ideation`, multi-phase modal accessed from Backlog `+ Add card` area. 8 source-static contract tests lock the pedagogical promise (AI never lists ideas, only asks questions).
- **#106 → #109** Dashboard hero NextActionPill (replaces Focus button). MiddleRow consolidation (drop "Next to unlock", expand "Coming Up" from md:col-span-3 to md:col-span-7).
- **#107 + #108** Content-block visual refresh (Key Information / Pro Tip / Safety Warning / etc.) — gradient bg, colored icon badges, larger fonts, top accent stripe, hover-lift.

### C. Analytics consolidation + admin shell hardening

- **#110 + #111** Vercel Web Analytics + Speed Insights enabled (Pro plan); Plausible removed.
- **#112** Removed "Back to teacher dashboard" from admin user-menu.
- **#114** Admin shell auto-redirects to `/admin/login?reason=session-changed` when whoami returns 401/403 (catches student-session-takeover from cross-incognito-window cookie jar).
- **#115** Defense in depth — admin layout renders "Verifying admin access…" loading shell until whoami confirms; never flashes admin chrome to unauth'd viewers.
- **Migration applied to prod (manual via Supabase SQL editor):** `20260501103415_fix_handle_new_teacher_skip_students` — guarded `handle_new_teacher` trigger to skip student auth users + backfill-deleted leaked `student-{uuid}@students.studioloom.local` rows from the teachers table.

## State of working tree

Test baseline: 408+ student tests passing. tsc strict clean for files touched.

Origin/main also has commits #113, #116–#127 from a **parallel Preflight session** (Pilot Mode, AI Budget per-student, AI provider abstraction Phase A, etc.) that ran alongside this kanban/dashboard session. Their saveme captured their narrative in PRs #124 + #126.

## Workflow established this session

- **Auto-merge PRs once green is the new default** — saved as memory at `~/.claude/projects/-Users-matt-CWORK/memory/feedback_auto_merge_default.md`. For PRs Claude opens as part of a fix Matt asked for: poll until CI + Vercel green, squash-merge, delete branch — don't ask "want me to merge?" between PR-open and merge.
- **Multi-role testing requires separate Chrome profiles** — incognito windows in the same Chrome session share a single cookie jar. Use `chrome://profile-picker` or different browsers (Chrome / Firefox / Safari) for admin / teacher / student isolation.

## Next steps

- [ ] **Watch for student session-takeover regressions in the admin tab.** Defense-in-depth shipped (#115) but the underlying constraint (Supabase cookie shared across same-domain incognito windows) is unfixed. Long-term option: subdomain split (`admin.studioloom.org` vs `studioloom.org`) — bigger infra change, defer until pilot scaling forces it.
- [ ] **Investigate `FU-LESSON-NAV-SOFT-NAV` (P3).** Next.js 15's `router.push` silently no-ops on recently-created `[pageId]` segments. Round 43 dodged it with hard-nav; restore SPA-style soft-nav once root cause is known. Probable suspects: RSC route cache, prefetch corruption, or known Next.js 15 regression.
- [ ] **Optional cleanup:** `focusMode` state + `FocusOverlay` component in `DashboardClient.tsx` are now unreachable dead code (Focus button removed in #109). ~50 lines to delete.
- [ ] **Optional cleanup: registry drift** — `feature-flags.yaml` shows orphaned `SENTRY_AUTH_TOKEN`, `auth.permission_helper_rollout`; missing `RUN_E2E`. Pre-existing.

## Open questions / blockers

_None blocking._

Telemetry note: the `?reason=session-changed` redirect banner (#114) has no logging. If we start hearing "I keep getting bounced," consider logging redirect events to an audit table to see frequency. Not urgent.
