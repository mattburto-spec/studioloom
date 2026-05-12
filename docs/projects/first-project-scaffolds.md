# First-Project Scaffolds — Inventory & Roadmap

**Created:** 11 May 2026 (from cross-model brainstorm + Matt review during G9 Lesson 1 design session)
**Canonical principle:** [A11 in design-guidelines.md](../design-guidelines.md) — *Scaffolds Are Earnable and Fadeable*
**Companion to:** [Open Studio v2](./openstudio-v2.md)

---

## The frame

Scaffolds for a student's first project should do three things differently from later-project scaffolds:

1. **Lower activation energy** — the blank canvas is the enemy on Day 1.
2. **Make one or two good moves obvious** — novices don't know which moves count.
3. **Teach the platform's metalanguage by doing** — students learn the vocabulary through use, not through being told.

Over-scaffolding (every tool at every moment) reverts the platform to worksheets — the ManageBac failure mode in reverse. Under-scaffolding leaves novices paralyzed. The trick is making each scaffold **earnable** and **fadeable**: the student graduates out of a scaffold once they've used it well a few times, the graduation itself emits a `learning_event`, and `learning_events` feed the Open Studio access decision. The first project, then, isn't just a project — it's where the platform earns the right to disappear.

---

## Inventory

### Framing the brief

- **Brief Decomposer** — Student pastes the teacher's brief; mentor AI extracts audience, constraints, success criteria, and surfaces tacit assumptions. Output is "brief in my own words" plus 3–5 clarifying questions. Lands in `learning_events` as the canonical project frame.
  *Note: structurally inverse to the Project Spec block (student writes vs. AI extracts). Fits a teacher-set-brief unit type.*
- **Mentor Lens Cards** — The student's matched designer offers 2–3 ways of seeing the problem (Rams: *less, better*. Munari: *play, observe.*). Student commits to one or two as their orientation.
  *Hooks directly into the Designer Mentor System spec.*
- **Stakeholder Sketch** — Quick visual map: who is this for, who's affected, whose knowledge do I need.
  *Overlaps with Project Spec Slot 6 (test user / audience) — revisit after first cohort usage data.*

### Inquiry

- **Question Ladder** — Turns "I wonder…" prompts into researchable questions, then sorts them into *ask someone* / *look up* / *try and see*.
- **Existing Solutions Audit** — Find 3 existing things; structured capture of what works, what doesn't, what's missing. Forces a baseline before designing.
  *Already covered by Criterion A research in the existing PPT scaffold — duplicate for design units in current form.*
- **Source Capture with Annotation Prompts** — Every source asks "what did this tell me? what does it leave out?" Builds the habit of critical reading.

### Ideation

- **Divergent Mode** — Quantity-first sketching with AI prompts that push past the obvious; explicitly suspends quality judgment.
- **Constraint Cards** — Drawn constraints force pivots ("must fit in a pocket"; "costs $5"; "no electronics").
- **SCAMPER in Context** — Applied to whatever idea is on the canvas, not abstractly.
  *SCAMPER tool exists; this is about better contextual injection from the student's current project state.*
- **Mood-board to Brief** — Visual capture with the mentor helping articulate why these images matter for this problem.

### Choosing

- **Decision Matrix from Brief** — Pulls criteria directly from the decomposed brief; student weights and scores.
  *Decision Matrix tool exists; this is about brief-aware seeding.*
- **Mentor Counterpoint** — "What would your designer choose, and why?" Offered as opinion, not prescription.
  *Designer Mentor System dependency.*
- **Tradeoff Articulator** — Student names what they're giving up by picking X. Trains the habit of seeing design as choice-making rather than answer-finding.

### Planning

- **Reverse Timeline** — Work backwards from the due date, visual.
  *Existing student-dashboard timeline already does the visual; the principle is the live one.*
- **Skills Audit → Learning Plan** — Chosen solution generates skills required; cross-referenced with their Skills Library state; surfaces skill cards to complete before they get blocked.
- **Material / Resource List** — Generated from the proposed solution, school-context aware.
- **Checkpoint Plan** — When do I want feedback, from whom (mentor / teacher / peer).

### Always-on meta-scaffolds

- **Stuck Button** — Captures current state, routes to mentor persona for unsticking; emits a `learning_event` teachers can see.
- **Departure Reflection** — Open Studio's three-touch exit point, lightly enforced on first project.
- **Beginner's Permission Slip** — Explicitly permits small scope, names the messy middle as normal. Reduces freeze.
  *Content choice, not a feature. Integrate into welcome copy and lesson framing.*

---

## Prioritization

### Ship now — G9 first cohort (12 May 2026)
- **Beginner's Permission Slip** → woven into Phase 1 Mr. Burton welcome copy (Lesson 1).
- **Tradeoff Articulator** → Phase 4 (timeline) Written Response prompt after timeline placement: *"What did you choose NOT to do because of your 14-lesson budget? Name one thing you're letting go of, and why."*

### Ship with parent system
- **Mentor Lens Cards** → with Designer Mentor System ([studioloom-designer-mentor-spec.md](./studioloom-designer-mentor-spec.md))
- **Mentor Counterpoint** → with Designer Mentor System
- **Brief Decomposer** → with the teacher-set-brief unit type
- **Departure Reflection** → with [Open Studio v2](./openstudio-v2.md)

### Backlog (file as follow-ups when ready)
- **Stuck Button** (P1) — high leverage; standalone feature; emits `learning_event`.
- **Question Ladder** — gated on Skills Library maturity.
- **Skills Audit → Learning Plan** — gated on Skills Library maturity.
- **Source Capture with Annotation Prompts**
- **Divergent Mode** as a standalone block
- **Constraint Cards** block
- **Mood-board to Brief**
- **Decision Matrix from Brief** — extension to the existing Decision Matrix tool.
- **Material / Resource List**
- **Checkpoint Plan**
- **Stakeholder Sketch** — revisit after Project Spec Slot 6 usage data.

---

## Cross-reference to existing systems

| Scaffold | Existing system it depends on / overlaps with |
|---|---|
| Brief Decomposer | Project Spec block (inverse pattern); future teacher-set-brief unit type |
| Mentor Lens Cards | Designer Mentor System spec |
| Stakeholder Sketch | Project Spec Slot 6 (test user / audience) |
| SCAMPER in Context | Existing SCAMPER tool (`tool-scamper`) |
| Decision Matrix from Brief | Existing Decision Matrix tool (`tool-decision-matrix`) |
| Tradeoff Articulator | Written Response block (works as a config of existing block) |
| Reverse Timeline | Existing student-dashboard timeline |
| Mentor Counterpoint | Designer Mentor System spec |
| Stuck Button | `learning_events` table; mentor persona routing |
| Departure Reflection | Open Studio v2 (three-touch exit) |
| Beginner's Permission Slip | Welcome/lesson-intro copy convention |

---

## Implementation discipline

Every scaffold added to the platform must answer:

1. **Earnable how?** What does competence look like in this scaffold? What signal does the student emit when they've outgrown it?
2. **Fadeable how?** What's the explicit fade path — does it disappear, become optional, become a one-tap callable resource?
3. **Learning_event shape?** What gets emitted when the scaffold completes well, and how does it feed downstream decisions (Open Studio access, mentor matching, skill cards)?

Scaffolds that can't answer all three should not ship. The discipline matters more than the inventory.

---

## Follow-up tracker

Items surfaced during build that aren't blockers but should be picked up later. Append-only. Move to a "Resolved" section at the bottom when done.

*(none yet)*

---

## Changelog
- **2026-05-11** — Doc created from cross-model brainstorm during G9 Lesson 1 design session. Principle canonicalized as A11 in design-guidelines.md. Two items pulled into immediate ship: Beginner's Permission Slip (Lesson 1 welcome copy) + Tradeoff Articulator (Lesson 1 Phase 4 Written Response).
