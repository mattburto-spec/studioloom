# Integrity Calibration — Phase 2 (manual procedure)

Run after Phase 1 has shipped to production. Verifies the snapshot-loop fix
landed and gives us a 10-sample feel for whether the score bands match
teacher intuition.

## Setup

1. Open browser devtools on `studioloom.org` (or the Vercel preview URL).
2. In the console, run:
   ```js
   localStorage.setItem("SL_INTEGRITY_DEBUG", "1")
   ```
3. Log in as a test student in a class with at least one lesson that has a
   text-response activity. (Integrity monitoring is on for every text response
   on the standard student lesson page — `enableIntegrityMonitoring={true}`
   is currently hardcoded.)
4. Open the lesson page. Console should remain quiet until the first autosave.

## Smoke checks (do these first)

These confirm Phase 1 actually fixed the bugs in production. Stop and file an
issue if any check fails — don't proceed to calibration on a broken build.

- **Snapshot loop fires.** Type a few characters, then leave the textarea
  focused without typing for ~35 seconds. The next `[integrity-debug]`
  console line should show `snapshotCount: 1` (or higher). Pre-fix this
  always stayed at `0` because the 30s interval got torn down on every
  keystroke. If still 0 after a minute, the fix didn't land.
- **Ref populated before autosave.** Type one character. Within ~3.5s
  (1.5s keystroke debounce + 2s autosave) the console should show
  `hasRef: true`, `keyCount >= 1`, and a non-null `firstKeySample`. If
  `hasRef: false` ever appears alongside `keyCount > 0`, there's still a
  race.
- **No 4592-WPM artifacts.** Paste a 200+ char block, save. Open the
  teacher view and inspect the IntegrityReport. The flags list should NOT
  include "Speed Anomaly" with an absurd WPM. Should include "Paste Heavy"
  and likely "No Editing." Phase 1 rule 3/6 guards prevent the pile-on.

## 5+5 calibration set

Use a single test class + a single lesson page. After each scenario, refresh
the page (so the next scenario starts with a clean MonitoredTextarea), then
open the teacher's IntegrityReport for that response and record the score.

### Clean (expected score >= 70, level "high")

| # | Scenario |
|---|----------|
| 1 | Type a 200-word response over 5+ minutes. Edit a few words as you go. |
| 2 | Type a 100-word response over 2 minutes. No edits. No tab switches. |
| 3 | Type a 50-word response. Switch tabs once, come back, finish. |
| 4 | Type a 300-word response over 10 minutes. Lots of edits. |
| 5 | Type an 80-word response in ~90 seconds. No pauses. |

### Simulated paste (expected score < 40, level "low")

| # | Scenario |
|---|----------|
| 6 | Paste a 200-word response from a doc. Save immediately. |
| 7 | Paste a 50-word response. Save immediately. |
| 8 | Paste a 200-word response, then edit 4-5 words. |
| 9 | Type 20 words, paste 200 words, type 20 more. |
| 10 | Paste a 500-word response. No edits. |

## Recording

Fill in this table after running. Add a "Notes" column for any surprise
flags or scoring oddities.

| # | Length | Expected band | Actual score | Actual flags | Notes |
|---|--------|---------------|--------------|--------------|-------|
| 1 | ~200w  | high (>=70)   |              |              |       |
| 2 | ~100w  | high          |              |              |       |
| 3 | ~50w   | high          |              |              |       |
| 4 | ~300w  | high          |              |              |       |
| 5 | ~80w   | high          |              |              |       |
| 6 | ~200w  | low (<40)     |              |              |       |
| 7 | ~50w   | low           |              |              |       |
| 8 | ~200w  | low           |              |              |       |
| 9 | ~240w  | medium / low  |              |              |       |
| 10| ~500w  | low           |              |              |       |

## Decision

- **8+/10 land in expected band:** ship as-is. Move to Phase 3 planning
  (notifications) once Access Model v2 Phase 0 has landed.
- **5–7/10 match:** tune one rule's threshold. Document the change in a
  short follow-up commit on this branch. Re-run the 10 scenarios.
- **<5/10 match:** re-audit. Either a rule is wrong for the field
  conditions, or there's a still-undiagnosed wiring bug. File a follow-up
  before Phase 3.

## Cleanup

When done, disable the debug log:
```js
localStorage.removeItem("SL_INTEGRITY_DEBUG")
```
The log is a no-op for everyone else; leaving it set on Matt's own browser
is fine.
