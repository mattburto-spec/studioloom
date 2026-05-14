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
Define become the unit's first 3 lessons. Form is chosen at lesson 7
once the student has done research.

This is being tested with G7 (10 classes, ~30 students) starting
tomorrow as a *deliberately-different second unit* to G8's form-first
opener. **Zero code changes** to ship the test — only the *content*
of the choice cards changes, plus the `on_pick_action` type shifts
from `set-archetype` to `commit-to-friction` (existing resolvers
ignore unknown types; the pick is recorded but nothing fires
downstream until the student reaches Product Brief later).

The strategic ambition this points at — typed agency events, library
/ deck separation, problem-first unit generator, filter-units-by-
problem — is **deferred** until after G7 Class 3 produces signal.
The whole point of the G7 test is to NOT commit architecture on
prediction.

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
type* emitted differs. (Not building this distinction yet; just
naming it so we recognise it when we hit it.)

---

## §2 — The G7 test plan

10 classes, ~30 students. Materials available: paper / card /
modelling clay / 3D printing / lasercutter / micro:bits / Figma.

| Class | Activity | What this tests |
|---|---|---|
| 1 | **Notice & sort** — students photograph 5 frictions they see over the next 24h | Can they spot mid-level friction? |
| 2 | **Friction picker** — share observations, then pick from 10 problem cards (or "pitch your own") | Does the card UI carry the new framing? |
| 3 | **Empathy work** — interview / observe 1 person who experiences the chosen friction | **PIVOT METRIC fires here** |
| 4 | **Define** — refine into a sharp problem statement ("[user] needs [way to X] because [insight]") | Can they hold problem ≠ solution? |
| 5–6 | **Ideate across multiple forms** — sketch 10 solutions in DIFFERENT forms (tool / service / space / experience) | Are they free of form-attachment? |
| 7 | **Product Brief** — NOW pick the form. Existing archetype picker. | Does form-emerging-from-problem feel natural? |
| 8–9 | Prototype + Success Criteria | Standard from here |
| 10 | Test + reflect | — |

**Engineering invariant:** No new blocks, no schema changes, no event
type changes. The Choice Cards block carries the new framing purely
through new card content. Product Brief sits at lesson 7 instead of
lesson 2.

---

## §3 — Pedagogical signals to watch for (credit: Gemini)

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

If 20%+ pivot → framing is real, scope next architecture move.
If <20% pivot → framing needs heavier scaffolding (longer empathy,
more concrete starting prompts) before re-testing.

---

## §4 — Scaffolds added vs the naive plan

Gemini's strongest substantive pushback: a G7 facing an infinite
solution space will freeze. Form-first removes cognitive load by
bounding the solution space; problem-first reintroduces that load
unless we scaffold.

**Mitigation:** in lessons 5–6 (Ideate), bound the medium explicitly.
Don't say *"solve this however you want."* Say *"solve this using
cardboard, micro:bits, or Figma — pick one for your first sketch."*
This is not compromising problem-first; it's scaffolding the Ideate
phase the way we should have been doing anyway.

---

## §5 — What's deferred (and why)

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
not before.

---

## §6 — The bug that started this conversation

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

## §7 — Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 14 May 2026 | Open G7 with problem-first cards, not form-first | Reframe matches design discipline; first test of the framing |
| 14 May 2026 | Zero code changes to ship the test | Engineering test: if existing block carries new framing, framing validated independently of arch |
| 14 May 2026 | Defer event registry, library/deck, authoring UI | Monomorphism — wait for second event type |
| 14 May 2026 | New `commit-to-friction` action type, ignored by existing resolvers | Smallest possible schema change; pick is recorded but inert until consumed |
| 14 May 2026 | Add medium constraint to Ideate (Gemini scaffold note) | Avoid cognitive-load freeze on infinite solution space |
| 14 May 2026 | 20% Pivot Metric as Class 3 success signal | Measurable; falsifiable; turns vibe into data |
| 14 May 2026 | Cowork audit prompt deferred to post-Class 3 | Strategic itch deferred until data informs it |

---

## §8 — How to come back to this doc

After G7 Class 3, re-read §3 (signals) with your notes from class.
If 20%+ pivoted, run Cowork's audit prompt (saved in this session's
transcript). The audit produces a report at
`docs/projects/choice-cards-audit-report.md` that scopes the next
phase brief — most likely event-layer hardening (item 1 in §5).

If <20% pivoted, return to §3 — diagnose which failure mode dominated
(Trojan Horse → scaffold Empathy harder; Scope Chasm → seed cards
need to lean more concrete; or something else).

The G7 unit IS the research instrument. The architecture choices
downstream of it are not made in this doc.
