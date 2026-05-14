# Handoff — main

**Last session ended:** 2026-05-14T19:00Z
**Worktree:** `/Users/matt/CWORK/questerra-grading`
**HEAD on origin/main (pre-#267):** `1aeab85` "fix(marking): focus-panel counter ticks 1→2→3"
**Pending merge:** PR #267 — student feedback banner orphan-grade fix + saveme bundle

> Supersedes the 14 May 18:00Z handoff. Single small PR since then.

## What just happened (14 May 2026 PM)

Matt smoked the student lesson view on Class 4 — Studio (15 May): green "Your teacher left feedback on 3 tiles" banner showed up on a page with no tiles (he'd deleted test blocks earlier). Diagnosed it as orphan `student_tile_grades` rows that stayed behind when teacher deleted activity blocks (no cascade — tiles live in `content_data` JSONB, no FK).

**Shipped:** PR #267 — server-side fix.
- `loadTileFeedbackThreads()` accepts optional `validTileIds: Set<string> | null` whitelist
- `/api/student/tile-feedback` resolves the current page content + passes the live tile-ID set
- Try/catch fallback to legacy behaviour on resolution failure (never blocks lesson load)
- 31/31 green across loader + route tests; tsc strict clean

**Saveme bundled into the same PR:**
- changelog entry for the orphan-grade fix
- 5-registry resync (1-line api-registry diff, 3-line scanner-reports refresh, no policy changes)
- this handoff doc

## State of working tree

- Branch: `fix/feedback-banner-orphan-grades` (PR #267, CI running at handoff)
- Test deltas: +8 source-static assertions (tile-feedback loader + route)
- tsc strict clean on touched files
- **No new migrations**

## Next steps

- [ ] **Matt smokes #267 once deployed** — open Class 4 — Studio (15 May) as the student → banner should disappear (or show accurate count for any tiles that still exist)
- [ ] **Pick up `TFL3-FU-STUDENTS-FALLING-BEHIND` (P1)** as the next focused build. Cross-cutting feature; deserves its own brief (dashboard "Needs attention" panel + per-class badge + 48h threshold + nudge action). v1 scope already captured in `docs/projects/grading-followups.md`. **Trigger phrase: "falling behind" / "students behind"**

## Open questions / blockers

- **Deferred:** orphan-grade DB cleanup migration. Loader filters them out now, but rows accumulate over time. Future `DELETE` migration could prune grades whose `tile_id` isn't in current page content. Not urgent — storage cost trivial, no UX impact post-fix.
- **Carry forward:** 8+ features shipped today in StudioLoom, 0 paying customers across Matt's project portfolio. CompliMate GACC 280 deadline ~10 days out. If next session opens with "what's next?", consider surfacing the validation gap before listing more StudioLoom builds.

## Trigger phrases

- `falling behind` / `students behind` → start the dashboard "Needs attention" brief
- `continue inbox` / `tfl3` → resume the 3 P3 inbox FUs (cohort comparison / ask templates / push escalation)
- `bulk inbox` → start the bulk-select feature (P2, deferred)
- `orphan cleanup` → write the cleanup migration that drops stale tile-feedback grades
