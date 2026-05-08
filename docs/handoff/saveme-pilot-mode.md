# Handoff — saveme-pilot-mode

**Last session ended:** 2026-05-08T13:00Z
**Worktree:** `/Users/matt/CWORK/questerra-preflight`
**HEAD:** TBD after commit "saveme: post Pilot Mode shipping — registries + docs synced"
**Top of main:** `dc9e019` (PR #120 squashed — surface eye + trash on incoming fab cards)

## What just happened

- **Preflight Pilot Mode SHIPPED end-to-end** across 5 PRs to main:
  - **PR #113** (`f945f00`) — P1 student override + P2 teacher Needs Attention tab + P3 dev review surface + admin nav. Migration `20260508021922_fabrication_jobs_pilot_override.sql` applied to prod.
  - **PR #117** (`172e6eb`) — P4 fab queue + detail flag (red `⚠ Flagged · may not print`).
  - **PR #118** (`22da297`) — Eye icon at top-right of incoming cards.
  - **PR #120** (`dc9e019`) — Eye + trash moved under thumbnail with brighter colours.
- **End-to-end smoke verified on prod:** Scott's whale-not-watertight.stl → override → Needs Attention → admin flagged page (rule histogram shows R-STL-01 fired+overridden 1).
- **Saveme ritual run** — registries synced (api-registry picked up `/api/admin/preflight/flagged`), schema-registry got the 2 new columns, WIRING.yaml + decisions-log + changelog + doc-manifest + ALL-PROJECTS + master index + open-followups-index updated. 3 new follow-ups filed: FU-PILOT-FLAGGED-API-TEST (LOW), FU-PILOT-MODE-FLIP-CRITERIA (MED), FU-PILOT-AUTO-ORIENT (LOW).

## State of working tree

- Branch `saveme-pilot-mode` cut from `origin/main` post-merge — at this point `dc9e019` is in main.
- Tests: **4866 pass / 11 skipped** (last full run on `preflight-incoming-icons-prominent` post-merge; baseline preserved).
- tsc strict clean.
- Migration applied to prod 8 May (additive nullable columns; verified with `information_schema.columns` query).
- Pending push count: depends on commit but expect 1.
- Local-only branches still around: `preflight-pilot-mode`, `preflight-incoming-icons-prominent`, `preflight-fab-override-flag` (all squash-merged + remote-deleted). Safe to `git branch -D` whenever.

## Next steps

- [ ] **Smoke David's flow next class** — first real-student override end-to-end. Watch `/admin/preflight/flagged` rule histogram afterwards.
- [ ] **Watch the histogram over 1–2 weeks** — when the same R-STL-XX fires consistently on files that print fine, file `FU-PILOT-RULE-TUNE-<RULE>` and tighten/relax the rule. R-STL-13 (flat-base) is the main candidate to watch.
- [ ] **Consider flipping `PILOT_MODE_ENABLED` to false** when criteria in `pilot-mode.ts` docstring met (≥100 submissions, override <5%, ruleset tuned, zero "scanner was wrong" stories). See FU-PILOT-MODE-FLIP-CRITERIA.
- [ ] **Auto-orient (FU-PILOT-AUTO-ORIENT)** — only revisit if R-STL-13 dominates the histogram.
- [ ] **Local branch cleanup** — `git branch -D preflight-pilot-mode preflight-incoming-icons-prominent preflight-fab-override-flag` once you're sure they're squashed in main.

## Open questions / blockers

- _None blocking._ Pilot Mode is in pilot. Next time we touch this code, the natural picks are (a) tune a rule based on histogram data, (b) flip the constant, or (c) build auto-orient. All are gated on real pilot data, not engineering work.
