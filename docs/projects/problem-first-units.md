# Problem-first units — strategic direction

**Status:** Hypothesis under test. G7 unit opens 15 May 2026.
**Last updated:** 14 May 2026.
**Author:** Matt + Claude conversation, 14 May 2026 evening.

---

## TL;DR

Design units should *open with a problem*, not with a product type.
Today's Choice Cards say "Design a Board Game" / "Redesign 1m² of
Space" — form-first. The reframe: cards say "Stuff that gets
forgotten" / "Mornings feel chaotic" — *problem-first*. Empathy and
Define become the unit's first 3 lessons. Form is chosen at lesson 6
once the student has done research.

This is being tested with G7 (11 classes, ~30 students) starting
tomorrow as a *deliberately-different second unit* to G8's form-first
opener. **Zero code changes** to ship the test — only the *content*
of the choice cards changes, plus the `on_pick_action` type shifts
from `set-archetype` to `commit-to-friction` (existing resolvers
ignore unknown types; the pick is recorded but nothing fires
downstream until the student reaches Product Brief later).

The strategic ambition this points at — typed agency events, library
/ deck separation, problem-first unit generator, filter-units-by-
problem — is **deferred** until after G7 Class 3 produces signal
(see §8 Decision gates). The whole point of the G7 test is to NOT
commit architecture on prediction.

---

## §1 — Why problem-first

The classic design thinking flow is:

```
Empathise → Define → Ideate → Prototype → Test
```

Form-first units (today's G8 opener) start at Prototype. The student
commits to a product type ("I'll design a board game") before they've
understood any human friction. Empathy and Define get compressed or
skipped.

Problem-first units anchor on a *friction the student noticed in the
world*. The form is what emerges from the design process, not what's
chosen at the start. This matches what design actually is as a
discipline: starting from a problem and letting the form follow.

**Generalisation:** Problem-first is the right opener for Design and
Service Learning units. (Service Learning's canon — Berger-Kaye,
IB CAS — uses "authentic community need" where we use "friction";
1:1 mapping.) It is NOT the right opener for Personal Project /
Personal eXploration units, which are passion-first (internal drive,
not external friction).

Gemini's sharper framing for the dichotomy: **External Constraint vs
Internal Drive**. The Choice Cards UI can serve both — the *event
type* emitted differs. The full taxonomy is in §2.

---

## §2 — Unit opener taxonomy (proposed)

The problem-first framing isn't the only opener. Different unit
*types* need different openers, and naming them now helps us
recognise the right shape for each before we accidentally force
every unit into a Design pattern.

**Proposed taxonomy — four opener types:**

| Opener | Anchor | Unit types that fit | First-lesson activity | Event type emitted |
|---|---|---|---|---|
| **Problem-first** | External Constraint — a friction someone faces | MYP Design, Service Learning | Friction picker (Choice Cards as problem cards) | `commit-to-friction` |
| **Passion-first** | Internal Drive — a personal interest or curiosity | Personal Project, Personal eXploration | Curiosity picker (Choice Cards as passion cards) | `commit-to-passion` |
| **Inquiry-first** | A phenomenon or question worth investigating | Science investigations, Humanities inquiry | Wonder picker (Choice Cards as phenomenon cards) | `commit-to-wonder` |
| **Form-first** | A medium / material / product type to explore | Craft-focused units, technique tutorials | Form picker (Choice Cards as product type cards — today's G8 default) | `set-archetype` |

All four can share the same Choice Cards UI. They differ in:

1. **Event type emitted** on pick (see right column).
2. **What the first 2–3 lessons scaffold** (empathy work vs depth
   research vs investigation vs technique practice).
3. **When and how the *form* gets chosen** — problem-first defers
   form to lesson 6+; form-first locks form at lesson 1; passion-
   and inquiry-first sit between.

**Status: proposed, not built.** Today only `set-archetype`
(form-first) and `commit-to-friction` (problem-first, G7) exist as
event types in code. The other two are named here so we recognise
them when we hit them; they don't have implementations.

**Why naming this now matters:** when a teacher wants to run a
Personal Project unit, the answer isn't "build a 5th archetype in
Product Brief." It's "this is a passion-first opener; it needs
different scaffolding from the start." Naming the taxonomy stops the
wrong shape of architecture before it gets built.

---

## §3 — The G7 test plan

11 classes, ~30 students. Materials available: paper / card /
modelling clay / 3D printing / laser cutter / micro:bits / Figma.

| Class | Activity | What this tests |
|---|---|---|
| 1 | **Notice → pick → HW: interview prep** — jump straight in. Brainstorm frictions in class, pick a card, draft 5 open interview questions | Can they spot mid-level friction? Can they design open questions? |
| 2 | **Empathy interview share-out + live observation** — students bring interview notes; second observation activity in school | **PIVOT METRIC fires here** (see §4) |
| 3 | **Synthesise empathy → "How might we…" statement** | Can they hold problem ≠ solution? |
| 4 | **Ideate** — 10 ideas across DIFFERENT forms (tool / service / space / wearable / experience) | Are they free of form-attachment? |
| 5 | **Narrow + peer critique** | — |
| 6 | **Product Brief — pick the form NOW.** Existing archetype picker. | Does form-emerging-from-problem feel natural? |
| 7–9 | Prototype iterations + Success Criteria (one quick user-test between) | Standard from here |
| 10 | Final test | — |
| 11 | Showcase + reflection | — |

**Engineering invariant:** No new blocks, no schema changes, no
event type changes. The Choice Cards block carries the new framing
purely through new card content. Product Brief sits at lesson 6
instead of lesson 2.

---

## §4 — Pedagogical signals to watch for (credit: Gemini)

These are the *measurable in-class signals* that tell us whether the
framing is working, by end of Class 3.

### Failure modes

- **Trojan Horse Form** (watch Class 2–3). Student picks a friction
  but already has a form in mind secretly. Tell: their interview
  questions are *solution-pitching*, not *friction-investigating*.
  "Would you use an app that..." = failed. Healthy version:
  "Tell me about the worst time this happened. What went wrong
  first?"

- **Scope Chasm** (watch Class 1–2). Frictions noticed are either
  too cosmic ("climate change") or too trivial ("my brother is
  annoying"). Tell: they can't identify a real person to interview.
  Healthy frictions: *mid-level*, *frequent*, *with observable
  workarounds* (e.g., "people drop their phones when carrying too
  many books").

### Success signal

**The 20% Pivot Metric.** By end of Class 3, at least 20% of
students should report a *surprising root cause* they didn't know
about in Class 1. Example: *"I thought mornings were chaotic because
people sleep in, but my interview showed it's actually because three
people share one bathroom mirror."*

If 20%+ pivot → framing is real, scope next architecture move (see
§8 Gate A).
If <20% pivot → framing needs heavier scaffolding (longer empathy,
more concrete starting prompts) before re-testing.

---

## §5 — Scaffolds added vs the naive plan

Gemini's strongest substantive pushback: a G7 facing an infinite
solution space will freeze. Form-first removes cognitive load by
bounding the solution space; problem-first reintroduces that load
unless we scaffold.

**Mitigation:** in lesson 4 (Ideate), bound the medium explicitly.
Don't say *"solve this however you want."* Say *"solve this using
cardboard, micro:bits, or Figma — pick one for your first sketch."*
This is not compromising problem-first; it's scaffolding the Ideate
phase the way we should have been doing anyway.

---

## §6 — What's deferred (and why)

Cowork's earlier critique was correct: we have monomorphism in
production (7 cards, 1 event type, 4 consumers) and the strategic
itch is to build a polymorphic abstraction over it before we have
the second example. Deferred until G7 produces signal:

1. **Event-layer registry** (consolidate `extractArchetypeId`,
   `extractSeedKanban`, `resolveChoiceCardPickForUnit`, etc. into
   one typed module). Small win, but waits for second event type.
2. **Library / deck separation** (formalise the per-block `cardIds[]`
   as a Deck entity, support cross-unit card reuse). Waits for
   actual reuse.
3. **Authoring UI** (`/teacher/choice-cards` editor with AI-assisted
   draft, downstream-impact preview, lint). Waits for second card
   author or 20+ cards in library.
4. **Carry-content versioning** (seed_kanban, seed_slots, payload
   schema versioning). The suggested-not-persisted bug is the small
   version of this; expanding payload without versioning policy
   would multiply that bug class. Don't expand until policy is
   written down.
5. **Unit-level cards** (cards that enrol students in whole units).
   Different event class entirely — capacity-bounded, hard to undo,
   audit-logged. Same UI; different table.
6. **Strategic claims to validate** — filter units by problem domain
   (SDG-style taxonomy), problem-first unit generator. Both
   downstream of having the data model right.

Cowork's audit prompt (draft pasted into chat 14 May) is the audit
to run when we're ready to build (1) and (3). Run AFTER Class 3,
not before. See §8 Gate A.

---

## §7 — The bug that started this conversation

G8 audit (`scripts/dev/audit-card-vs-brief.mjs`) found 4 of 26
students (~15%) ended with a Product Brief archetype that didn't
match their Choice Card pick — without going through the Pitch flow.
Root cause: write-side race in the suggested-not-persisted resolution
pattern. Fix at PR #262 (commit choice-card archetype into the brief
on first save).

**This bug is tactical, not strategic.** Cowork's earlier framing was
right: don't use a load/save race as cover for a rebuild we already
wanted. Ship the fix, measure if the drift rate drops to ~0% after
G7 runs, then re-evaluate.

---

## §8 — Decision gates

Three gates ahead, each with a concrete trigger and a clear if/then
rule. Read this whenever you're tempted to start building
event-registry infrastructure, authoring tools, library/deck
separation, or unit-cards. **None of those happen before Gate A.**

### Gate A — End of G7 Class 3 (target: ~5 days from doc creation)

**Trigger:** You've taught Lessons 1–3 of the G7 problem-first unit.
You have data on the three signals from §4 (Trojan Horse rate,
Scope Chasm rate, 20% Pivot metric).

**If signal is strong** (≥ 20% pivot, low Trojan Horse rate):

- Run Cowork's audit prompt against the codebase (saved in session
  transcript 14 May 2026).
- Consolidate the four scattered resolvers into one event-registry
  module at `src/lib/agency-events/` (or similar).
- Name `commit-to-friction` and `set-archetype` formally in a typed
  discriminated union.
- Pure refactor, no new features. ~1–2 days.

**If signal is weak** (< 20% pivot, high Trojan Horse rate):

- Don't touch architecture.
- Scaffold Empathy harder in G7 Lessons 4+.
- Note the failure mode in §9 decisions log.
- Wait for the next unit run before re-testing.

### Gate B — End of G7 unit (target: ~3 weeks)

**Trigger:** G7 completes the 11-class unit. G8 has parallel data
from its form-first run.

**Compare across cohorts:**

- Quality of student work (rubric-based judgement).
- Engagement / off-task time per cohort.
- Whether students designed forms that *fit their problem* (the real
  test of problem-first).
- How long Empathy + Define took vs the form-first lessons they
  replaced.

**Decision:** Is problem-first the default opener for Design units?

- **If yes**: next unit (G8 term 3 or new G9 cohort) opens
  problem-first by default. Strategy doc §1 promotes from
  "hypothesis under test" to "validated default."
- **If mixed**: build the explicit opener-type selector into the
  unit creation flow. §2 taxonomy becomes a teacher-facing concept
  (teachers pick "problem / passion / inquiry / form" when authoring
  a unit, and the editor scaffolds the first 2–3 lessons
  accordingly).
- **If no**: roll back to form-first as default; keep problem-first
  as an available opener type. Document why.

### Gate C — When triggered by external signal (months out)

**Triggers (any one suffices):**

- A second teacher at NIS wants to author choice cards.
- You're trying to reuse cards across units and the per-block
  `cardIds[]` is too clunky.
- The card library exceeds ~20 cards and visual inspection breaks
  down.
- A new producer block lands (mood picker, theme quiz, mid-unit
  pivot picker).
- A student or teacher requests filtering units by problem domain.

**Action:** Build the things in §6 (deferred). Authoring UI,
library/deck separation, scaffold-as-card with versioning policy,
unit-level cards. Each in response to the specific trigger that
fired — not as one big rebuild.

**Until a trigger fires: don't build any of these.** Cost of
waiting is zero. Cost of building on the wrong frame is weeks of
rework.

---

## §9 — Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 14 May 2026 | Open G7 with problem-first cards, not form-first | Reframe matches design discipline; first test of the framing |
| 14 May 2026 | Zero code changes to ship the test | Engineering test: if existing block carries new framing, framing validated independently of arch |
| 14 May 2026 | Defer event registry, library/deck, authoring UI | Monomorphism — wait for second event type |
| 14 May 2026 | New `commit-to-friction` action type, ignored by existing resolvers | Smallest possible schema change; pick is recorded but inert until consumed |
| 14 May 2026 | Add medium constraint to Ideate (Gemini scaffold note) | Avoid cognitive-load freeze on infinite solution space |
| 14 May 2026 | 20% Pivot Metric as Class 3 success signal | Measurable; falsifiable; turns vibe into data |
| 14 May 2026 | Cowork audit prompt deferred to post-Class 3 (Gate A) | Strategic itch deferred until data informs it |
| 14 May 2026 | Name unit opener taxonomy (problem / passion / inquiry / form) as proposed | Stops the wrong shape of architecture before it's built; cheap to capture, important to remember |
| 14 May 2026 | Three explicit decision gates (A / B / C) with concrete triggers | Future-Matt / future-Claude can read this and know what to wait for |

---

## §10 — How to come back to this doc

**Tuesday-ish (~5 days from now), after G7 Class 3:** read §4
(signals) with your notes from class. Check the 20% Pivot metric.

- If 20%+ pivoted → you're at Gate A "signal strong" path. Run
  Cowork's audit prompt (saved in this session's transcript). The
  audit produces a report at
  `docs/projects/choice-cards-audit-report.md` that scopes the next
  phase brief — most likely event-layer hardening (item 1 in §6).

- If <20% pivoted → you're at Gate A "signal weak" path. Return to
  §4 — diagnose which failure mode dominated (Trojan Horse →
  scaffold Empathy harder; Scope Chasm → seed cards need to lean
  more concrete; or something else). Don't touch architecture; note
  the failure mode in §9 decisions log; wait for next unit run.

**~3 weeks from now, end of G7 unit:** Gate B. Compare G7 problem-
first outcomes to G8 form-first outcomes per the rubric in §8 Gate
B. Decide whether problem-first becomes the default.

**Whenever an external signal fires:** Gate C. Build the specific
deferred item that the trigger calls for. Not the whole list.

The G7 unit IS the research instrument. The architecture choices
downstream of it are not made in this doc — they're made at the
gates, with data.
