# Project: Open Studio v2 — Journey-Based Self-Directed Learning
**Created: 3 April 2026**
**Status: SUPERSEDED — absorbed into [`openstudio-v2.md`](openstudio-v2.md) (planning journey) and [`open-studio-mode.md`](open-studio-mode.md) (runtime mode). Kept for historical reference.**
**Depends on: Dimensions3 (Block Library + Journey infrastructure), Discovery Engine**

> **If you're here to build Open Studio Mode:** start at [`open-studio-mode.md`](open-studio-mode.md) — it has the required-reading block. This idea doc is the early architectural thinking that got split into two sibling projects.

---

## What This Is

Open Studio v1 (built 20 Mar 2026) is a teacher-unlocked self-directed working mode with AI check-ins and drift detection. It works, but it's essentially "do your thing and I'll check on you periodically."

Open Studio v2 reimagines this as a structured journey with scaffolding, goal-setting, teacher reporting, and adaptive support — while preserving the self-directed ethos.

## Current State (v1)

- Teacher unlocks Open Studio per student per unit
- AI switches from Socratic tutor to studio critic
- 5 interaction types: student_message, check_in, drift_check, documentation_nudge, alignment_check
- Check-in rotation on configurable interval (5-30 min)
- Drift detection with 3-level escalation → auto-revocation
- Session lifecycle with activity logging, reflection, productivity scoring
- ~2,500 lines across 12 files

## v2 Vision: Journey + Goals + Scaffolding

### The Problem
Students who need Open Studio most (self-directed learners) often need the MOST scaffolding to use it well. The current system detects drift but doesn't proactively build skills. A Year 7 student who's never managed their own time needs a different Open Studio experience than a Year 10 student who's done it 5 times.

### Architecture: Open Studio as a Journey Container

Open Studio becomes a **journey with customizable stations**, similar to how Discovery Engine has 8 stations. But instead of a fixed sequence, Open Studio's journey is:

1. **Goal Setting Station** — student sets session goals (what they'll work on, what they'll produce, time estimate)
2. **Working Phase** — the actual self-directed work with AI check-ins (current v1 behaviour)
3. **Report Back Station** — student documents what they did, reflects on progress, updates goals for next session

The key insight: **the journey blocks between working phases are where scaffolding lives.**

### Scaffolding via Blocks

Teachers can drag appropriate blocks into a student's Open Studio journey:

- **Time Management MiniUnit** — 2-3 short activities teaching planning, prioritisation, time estimation
- **Self-Assessment Block** — structured rubric self-check before starting work
- **Goal-Setting Workshop** — guided activity for writing SMART goals
- **Progress Documentation** — templates for documenting process (design journal, photo log, reflection prompts)
- **Peer Check-In** — structured activity where student shares progress with a partner
- **Real Client Meeting** — (see realclient.md) — scheduled within Open Studio as a working session

### Adaptive Scaffolding

The system suggests scaffolding based on signals:

- **First-time Open Studio user** → auto-suggest Time Management + Goal-Setting blocks
- **Student with history of drift** → auto-suggest shorter check-in intervals + structured documentation
- **Student with high productivity scores** → reduce scaffolding, increase autonomy
- **Student stuck for 2+ sessions** → suggest peer check-in or teacher consult block

Teachers see suggestions but decide what to add. Students see their journey map showing upcoming stations/blocks.

### Discovery Profile Integration

The Discovery Engine's DiscoveryProfile feeds directly into Open Studio personalisation:

- Archetype (Maker/Researcher/Leader/etc.) influences default scaffolding suggestions
- Self-efficacy score from Discovery determines initial check-in frequency
- Working style preference (solo/pair/group) influences suggested blocks
- Fear cards from Discovery inform what kind of encouragement the AI uses

### Teacher Dashboard

Open Studio v2 gives teachers a richer view:

- Per-student journey map (what blocks they've done, where they are, what's next)
- Goal completion tracking (did they finish what they planned?)
- Suggested scaffolding interventions with one-click add
- Session history with productivity trends
- Class-wide patterns (who needs more scaffolding, who's ready for more autonomy)

## Connection to Dimensions3

- Scaffolding blocks are Activity Blocks from the Block Library
- Journey structure uses the same station/state-machine architecture as Discovery
- Block suggestions use the same retrieval + ranking pipeline (Stage 1)
- Student signals feed the feedback loop (Pillar 4)
- Open Studio session data contributes to block efficacy scoring

## Do We Need to Do Anything Now?

**For Dimensions3 build: minimal.**

The main thing is ensuring the Activity Block Library schema supports journey-type blocks. Specifically:

1. **Block category** — ensure `journey` is in the 12 activity categories (it's not currently — ADD IT)
2. **Block sequencing metadata** — journey blocks need `sequence_position` or `journey_stage` fields
3. **Cross-session state** — blocks in a journey need to reference previous session data (already handled by `block_interaction_model` Layer C: cross-block state)
4. **Student-specific block assignment** — currently blocks are per-unit, not per-student. Open Studio needs per-student block assignment. This might need a `student_journey_blocks` junction table (FUTURE — not in Dimensions3 v1)

**Recommendation:** Add `journey` to the activity categories in Dimensions3 Section 5.3. Everything else can wait.

## Build Estimate
~4-5 days once Block Library is live + Discovery Engine journey architecture is proven. Not on critical path — v1 Open Studio works fine for launch.

## Open Questions
1. Can students customise their own Open Studio journey? (drag blocks, reorder, skip)
2. Should scaffolding blocks be required or optional? (teacher choice per student)
3. How do MiniSkills (see miniskills.md) relate? Are they a form of Open Studio scaffolding?
4. Should Open Studio have "levels" of autonomy that students unlock? (Level 1: heavy scaffolding, Level 2: light, Level 3: full freedom)
5. How does Real Client (realclient.md) fit as a scheduled block within Open Studio?
