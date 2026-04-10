# Dimensions3 — Follow-up Tickets

> Items surfaced during Phase 1.x checkpoints that are NOT blockers for the
> phase they were found in, but should be picked up before Dimensions3 is
> declared complete. Each entry: short title, when surfaced, symptom,
> suspected cause, suggested investigation, target phase.

---

## FU-1 — `/teacher/units` initial render delay
**Surfaced:** Phase 1.5 checkpoint sign-off (10 Apr 2026)
**Target phase:** Phase 1.7+

**Symptom:** Initial page paint shows empty unit cards ("empty squares")
for a visibly long delay before unit data hydrates in. Eventually renders
correctly.

**What we know:**
- Network tab: `units?select=*` returns 200 with ~133 kB in ~32 ms — the
  fetch itself is fast.
- The delay is between response receipt and DOM render.
- May be a pre-existing issue OR a Phase 1.5 hydration regression. Has
  not been profiled yet.

**Investigation steps:**
1. Profile the page with the React Profiler in Chrome DevTools — capture
   the time between fetch resolution and the unit card paint.
2. Compare against the pre-Phase-1.5 baseline:
   `git checkout 9e2d045~1 -- src/app/teacher/units` (the commit before
   the Phase 1.5 series began).
3. Look for: heavy synchronous work in a render path, a large client
   bundle being parsed, or a useEffect chain that gates the visible
   state on multiple sequential awaits.

**Definition of done:** Either (a) confirmed pre-existing and ticketed
separately for a perf pass, or (b) regression bisected to a specific
Phase 1.5 commit and reverted/fixed.

---

## FU-2 — "Unknown" strand/level chips on pre-Phase-1.5 units
**Surfaced:** Phase 1.5 checkpoint sign-off (10 Apr 2026)
**Target phase:** Phase 1.7+

**Symptom:** Units created before Phase 1.5 show `"Unknown" "Unknown"`
chips where the strand and level should be displayed.

**Cause:** Phase 1.5 item 3 (commit `0d686e4`) added strand and level
fields via Pass A enrichment, but the backfill only touched
`activity_blocks`, not `units`. The unit card render code displays
`"Unknown"` as a fallback when the field is missing.

**Two ways to fix — pick one:**

**Option A — Hide the chips when the value is missing.**
- Cheaper, no migration.
- Edit the unit card render code to check for truthy strand/level before
  rendering the chip element.
- Downside: pre-1.5 units stay unlabelled forever unless they're
  re-ingested.

**Option B — Backfill `units` with derived strand/level.**
- New migration that walks each unit's `content_data` and runs the same
  classification logic Pass A uses (or a SQL approximation).
- Risk: classification needs an LLM call to be accurate; a SQL backfill
  will be a heuristic at best.
- Better: a one-off `scripts/backfill-unit-strand-level.mjs` that calls
  Pass A for each unit and writes the result back.

**Recommendation:** Start with Option A in Phase 1.7 (15 minute fix),
schedule Option B as part of the Phase 1.6 disconnect of the old
knowledge UI (since we'll be touching the unit data model anyway).

---
