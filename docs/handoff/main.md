# Handoff — main

**Last session ended:** 2026-05-14T18:00Z
**Worktree:** `/Users/matt/CWORK/questerra-grading` (TFL.3 marking-page polish branch)
**HEAD on origin/main:** `1aeab85` "fix(marking): focus-panel counter ticks 1→2→3 (was stuck at 1 of N) (#265)"

> Supersedes the 13 May full-day handoff. That work (Preflight quantity, Tier 2 scheduling, journal targetChars, sticky-complete) is captured in the existing changelog entries; this handoff covers the parallel TFL.3 marking-page polish session that ran 13-14 May in the `questerra-grading` worktree.

## What just happened (13–14 May 2026 — TFL.3 polish loop)

Matt drove ~10 hours of pilot smoke across the marking surfaces after Pass C inbox shipped on 12 May. Each gap → one focused PR, no batching. The Pass C → C.6 → C.7 chain ended with a clean daily-driver flow:

**Surfaces touched:**
- `/teacher/marking` — gained the focus panel (top-of-page master/detail), tweak buttons, smarter AI suggest filter, stable counter
- `/teacher/inbox` — defensive filter against re-generated drafts re-surfacing as "drafted"
- `src/components/student/inspiration-board/InspirationBoardBlock.tsx` — hydration bug fix (was broken since IB first shipped)
- `src/components/teacher/InspirationBoardPreview.tsx` — link-card fallback for non-image URLs

**Headline shipped (12 PRs):**
1. `#245` C.6.1 row-level Send (reverted within hours — blind-send anti-pattern)
2. `#246` C.6.2 focus panel — master/detail at top of marking page
3. `#249` C.7 prompts — 30-55w + Shorter preserves positive
4. `#252` C.7.1 IB rendering + AI normalisation (flattens IB JSON for AI input)
5. `#255` C.7.2 IB link-card fallback (no more broken-image icons)
6. `#256` ai-prescore parallel batch — 60s → ~15s for 24 students
7. `#258` student IB hydration fix (useState lazy-init bug since shipped)
8. `#260` AI suggest skips already-sent + inbox-loader sent-comment guard
9. `#265` focus panel counter ticks correctly (no bucket re-sort)
+ a handful of class-dj-block fixes that another session shipped in parallel (different worktree, see #244, #250, #253-#264).

See [`docs/changelog.md`](../changelog.md) 13-14 May entry for the full breakdown.

## State of working tree

- Branch: `fix/focus-panel-counter-stable` (PR #265 merged; can delete)
- Worktree: clean; saveme staged the registry sync (1 line in api-registry.yaml) + this handoff + the changelog entry
- Test count this session: ~115 marking + 65 grading + 28 integrity + 22 focus panel — all green where touched. Repo-wide test count not freshly measured this session.
- tsc strict clean on all files I touched. Pre-existing pipeline/scripts errors unchanged.
- **No new migrations.** Pure app + prompts.

## Next steps

- [ ] **Matt smokes the counter fix on live** (#265 just merged) — open focus panel, click Send & next a few times, verify counter ticks 1/24 → 2/24 → 3/24 in sync with progress (used to stay stuck at 1/24).
- [ ] **Pick up `TFL3-FU-STUDENTS-FALLING-BEHIND` (P1)** as the next focused build. Cross-cutting feature — deserves its own brief, NOT a quick patch. Trigger phrase: **"falling behind"** or **"students behind"**. v1 scope captured in `docs/projects/grading-followups.md`:
  - Dashboard "Needs attention" panel (K students behind + thin-response flags + 48h threshold)
  - Per-class card badge
  - One-click "Nudge" + "Open last work" actions
  - Hattie-grounded threshold defaults (~48h inactivity)
- [ ] **Watch the changelog discipline.** This session's work spans 13-14 May but the existing main.md handoff was scoped to a DIFFERENT 13 May session (Preflight quantity + journal targetChars). Two parallel sessions, two non-overlapping bodies of work. If you see git log entries you don't recognize, check the changelog before assuming drift.

## Open questions / blockers

- **`TFL3-FU-STUDENT-IB-IMAGES-MISSING` ✅ resolved 14 May** — was a React useState lazy-init bug in `InspirationBoardBlock.tsx`, NOT a storage proxy / auth issue (initial hypothesis was wrong; the diagnosis sharpened when Matt's DevTools showed zero `/api/storage/responses/...` requests).
- **Prompt iteration trail:** PROMPT_VERSION bumped for ai-prescore (v2.1.0 → v2.2.0) + regenerate-draft (v1.0.0 → v1.1.0). If you want to compare cost/length before/after on /admin/ai-budget, the breakdown view groups by exact PROMPT_VERSION string.
- **Carry forward from 12 May handoff:** Matt has ~8 features shipping today, 0 paying customers. CompliMate GACC 280 deadline ~10 days out. If next session starts with "what's next?", consider gently surfacing the validation gap before listing more StudioLoom builds.

## Trigger phrases

- `falling behind` / `students behind` → start the dashboard "Needs attention" brief
- `continue inbox` / `tfl3` → resume on the 3 P3 inbox FUs (cohort comparison / ask templates / push escalation)
- `bulk inbox` → start the bulk-select feature (P2, deferred)
