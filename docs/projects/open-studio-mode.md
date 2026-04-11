# Project: Open Studio Mode — Studio Desk, Three-Touch Pattern, No-Chatbot Scaffolding

**Created:** 11 April 2026
**Status:** PLANNED — spec written, build scheduled for w/c 14 April 2026
**Priority:** P1
**Estimate:** TBD (depends on Skills Library workshop progress — much of the "structural surfacing" work reuses that join)
**Owner:** Matt
**Companion to:** [`openstudio-v2.md`](openstudio-v2.md) (Mentor-Guided Project Planning Journey)

**Canonical specs:**
- [`docs/open studio/open-studio-mode-spec.md`](../open studio/open-studio-mode-spec.md) — full spec: principles, three-touch pattern, AI behaviour, escalation ladder, UX layout, integration points, open questions

## ⚠️ Required reading before build (MANDATORY)

**When Matt says "let's start Open Studio Mode", read every file in this list before writing any code or scaffolding any component.** This project is the runtime layer of an experience whose plan (v2) and first draft (v1) already exist. Building without reading them risks duplicating, contradicting, or undermining decisions already made.

**Open Studio trilogy (all three — they cover different layers of the same experience):**
1. [`docs/projects/open-studio-mode.md`](open-studio-mode.md) — this doc (runtime studio)
2. [`docs/projects/openstudio-v2.md`](openstudio-v2.md) — Mentor-Guided Project Planning Journey (the plan this mode executes against)
3. [`docs/projects/openstudio.md`](openstudio.md) — original v2 idea doc (superseded but has the early architectural framing)

**Canonical specs:**
4. [`docs/open studio/open-studio-mode-spec.md`](../open%20studio/open-studio-mode-spec.md) — the full Mode spec (principles, three-touch, AI behaviour, escalation ladder, UX, integration, open questions)
5. [`docs/open studio/open-studio-spec.md`](../open%20studio/open-studio-spec.md) — v1 mechanism doc
6. [`docs/open studio/open-studio-experience-design.md`](../open%20studio/open-studio-experience-design.md) — the Phase 2-4 experience design (4-phase arc, AI mentor discovery, health score model)
7. [`docs/open studio/open-studio-feature-spec.md`](../open%20studio/open-studio-feature-spec.md) — feature-level spec
8. [`docs/open studio/open-studio-design.md`](../open%20studio/open-studio-design.md) — design notes
9. [`docs/open studio/open-studio-implementation-plan.md`](../open%20studio/open-studio-implementation-plan.md) — v1 implementation notes

**Prototypes (visual references — open in browser before touching UI):**
10. [`docs/open studio/prototypes/open-studio-wireframe.html`](../open%20studio/prototypes/open-studio-wireframe.html) — desk + reflection drawer wireframes with annotations
11. [`docs/open studio/prototypes/open-studio-reference-prototypes.html`](../open%20studio/prototypes/open-studio-reference-prototypes.html) — eight reference patterns (Scrum, Strava, Figma, Focusmate, Notion, Destiny, studio crits, Duolingo)
12. [`docs/open studio/prototypes/student-dashboard-composed.html`](../open%20studio/prototypes/student-dashboard-composed.html) — composed dashboard (crit board + Stone prereqs + daily template journal)
13. [`docs/open studio/prototypes/SESSION-SUMMARY-apr-2026.md`](../open%20studio/prototypes/SESSION-SUMMARY-apr-2026.md) — the decision log from the April design session (captures decisions that aren't in any individual spec)

**Hard dependency — must be in place or partially built first:**
14. [`docs/projects/skills-library.md`](skills-library.md) — Skills Library project
15. [`docs/specs/skills-library-spec.md`](../specs/skills-library-spec.md) — base spec
16. [`docs/specs/skills-library-completion-addendum.md`](../specs/skills-library-completion-addendum.md) — completion/freshness/gating addendum
   > Open Studio Mode's capability-gap surfacing is `required_skills - earned_skills` against `student_skill_state`. Without the library, there is nothing to surface.

**Related architectural context:**
17. [`docs/build-methodology.md`](../build-methodology.md) — phased-with-checkpoints discipline (default for non-trivial work)
18. [`docs/projects/WIRING.yaml`](WIRING.yaml) — find `open-studio-mode` entry and read its `affects` list before changing any downstream system

**After reading, before coding:** write a phase brief per `docs/build-methodology.md` (pre-flight steps, stop triggers, don't-stop-for list, named Matt Checkpoints). Treat sandbox/simulator/dryRun as first-class spec components, not optional scaffolding.

---

**Related prototypes:**
- [`docs/open studio/prototypes/open-studio-wireframe.html`](../open studio/prototypes/open-studio-wireframe.html) — desk view + reflection drawer, two states with annotations
- [`docs/open studio/prototypes/open-studio-reference-prototypes.html`](../open studio/prototypes/open-studio-reference-prototypes.html) — eight reference patterns (Scrum, Strava, Figma, Focusmate, Notion, Destiny, studio crits, Duolingo) with notes under the no-chatbot constraint
- [`docs/open studio/prototypes/student-dashboard-composed.html`](../open studio/prototypes/student-dashboard-composed.html) — dashboard composing the three highest-leverage patterns (crit board, Stone with prerequisites, daily template journal). Zero AI in the loop.

---

## 1. What this is

Open Studio Mode defines *how Open Studio feels moment-to-moment* — the runtime experience, not the project-planning conversation that happens before working begins. Where Open Studio v2 ([`openstudio-v2.md`](openstudio-v2.md)) specs the Mentor-Guided Planning Journey that produces a plan, this project specs **the studio the student sits in afterwards**: the desk view, the three-touch pattern, the silent AI critic in the corner, the reflection drawer on the way out.

The core tension it resolves:
- **Studio posture** demands silence, trust, continuity, minimal interruption.
- **Learner-centred architecture** demands a continuous stream of intent, evidence, and reflection written into the Wayfinder.

Resolution: reframe scaffolding as **rituals the student performs that happen to generate structured data**, not checkpoints the system imposes. Every touchpoint must feel like something the student *gets*, not something they're *giving*.

## 2. Relationship to existing Open Studio projects

| Project | What it covers | Status |
|---|---|---|
| **Open Studio v1** | First working mode: teacher-unlocked, AI critic, 5 interaction types, 3-level drift escalation | ✅ SHIPPED (20 Mar 2026, Migration 029) |
| **Open Studio v2 — Mentor-Guided Project Planning** | The 7-station Planning Journey that produces a project plan, teacher approval, plan health score | 🔵 PLANNED — depends on Journey Engine |
| **Open Studio Mode** (this project) | The runtime studio experience after planning — desk view, three-touch pattern, reflection drawer, escalation ladder, teacher floor-walk dashboard | 🔵 PLANNED — depends on Skills Library for capability-gap surfacing |

These are not competing — they are the *plan*, the *tools*, and the *studio* layers of the same experience. v2 negotiates the plan; Mode is where the work happens; v1 was the first working draft of the latter that this project supersedes in behaviour (but not in data model).

## 3. Key design decisions (already made)

**On the student experience**
- **No student-facing chatbot at launch.** All help surfaces are curated, human-authored, navigable artefacts. AI features layer on later as opt-in upgrades once the safety story is settled.
- **Open Studio is earned, not assigned.** Loss conditions are teacher-triggered only; the AI never revokes status itself.
- **Three-touch pattern:** arrival intent (~10s) → passive evidence → departure reflection (~60s). Everything else is uninterrupted work.
- **The reflection drawer is the one place the contract is enforced.** Cannot be dismissed. It is the price of admission for tomorrow's Open Studio.
- **Continuity is the main UX job of the desk view.** The bench should look exactly as the student left it.
- **Escalation ladder is graduated and always ends with a human.** AI surfaces signals; teachers decide interventions.

**On the AI critic**
- Default posture is silent. Present as small persistent badge in the corner of the desk.
- Triggers: student taps the critic; self-set timer elapses; 20+ min with no evidence; drift signal (3+ sessions same WIP); intent/evidence mismatch at session end; blocker keyword in reflection.
- Tone: questions over answers, name tensions rather than resolve them, attribute to teacher when a directive is needed.

**On the library bridge (no-chatbot scaffolding)**
- Every help moment resolves to a skill card via a join, not a model. This project assumes the Skills Library is in place — capability-gap surfacing is literally `required_skills - earned_skills` against the `student_skill_state` view.

## 4. The three-touch pattern

1. **Arrival intent (~10s)** — single line of intent (*"Today I'll finish wiring the PIR sensor"*), text or voice, auto-linked to nearest active milestone, stored as `intent.declared` learning event.
2. **Passive evidence (session duration)** — no prompts. Work Capture uploads, dock activity, file saves, timer events, critic conversations all streamed to `learning_events`.
3. **Departure reflection (~60s)** — slide-in drawer, three Scrum-style questions (*got done / next / in your way*), voice-first, cannot be dismissed. Morning intent re-shown inline.

## 5. Escalation ladder (softest → firmest)

| Rung | Trigger | Response | Who acts |
|---|---|---|---|
| 0 | Single session, intent unmet | Soft private nudge in reflection drawer | AI |
| 1 | Two consecutive unmet intents | Auto-trigger Recalibration ritual on next arrival | AI → student |
| 2 | Milestone approaching with <30% evidence | Teacher dashboard flag with context | AI → teacher |
| 3 | Milestone missed | Teacher flag escalates; Open Studio *paused* until touchpoint | Teacher |
| 4 | Pattern across multiple milestones | Teacher revokes; returns to guided mode with logged note | Teacher |

Rungs 3 and 4 are teacher actions, never AI actions.

## 6. Dependencies

- **Blocks on:** Skills Library workshop project (capability-gap surfacing resolves to skill cards), `learning_events` schema extensions, existing `student-workspace.jsx` 3D desk prototype
- **Related:** Open Studio v1 (Migration 029 — keep the table, change the behaviour), Open Studio v2 (Planning Journey produces the plan this mode executes against), Recalibration ritual (reused at rung 1), Drift detection (existing specs become §5's backbone), Work Capture Pipeline (passive evidence stream)
- **Unblocks:** Teacher floor-walk dashboard (its own spec), Parent weekly update digest (reflections are the richest content source)

## 7. Workshop scope (next week, if time permits after Skills Library)

**Must have**
- Wire the three-touch data model into `learning_events`: `intent.declared`, `reflection.session_end`, `critic.conversation`, `open_studio.paused`, `open_studio.revoked`
- Intent card component (voice + text, auto-linked to milestone)
- Reflection drawer component (slide-in, non-dismissable, three questions, voice-first)
- Extend existing `student-workspace.jsx` desk view to be the Open Studio default

**Should have**
- Horizon strip (32px thin bar, milestone + days remaining)
- Self-timer with elapsed event hook
- Critic corner placeholder (silent by default)
- Basic capability-gap surfacing from Skills Library (requires the Skills Library join to exist)

**Defer**
- Teacher floor-walk dashboard — large enough to deserve its own spec
- Per-class drift threshold tuning UI
- Parent digest integration
- Critic trigger conditions beyond "student taps" (timer nudge, drift signal, intent mismatch can all layer on later)

## 8. Open questions to resolve in the session

1. **Timebox defaults.** Should the self-timer have a suggested default (e.g. 45 min) or start blank? Risk of nudging toward Pomodoro compliance if defaulted.
2. **Critic corner visibility when idle.** Visible when silent for reassurance, or only when it has something to offer for purer studio posture?
3. **Reflection voice transcription accuracy for ELL students.** Needs testing with the NIS ELL cohort before pilot.
4. **Intent granularity.** Single line vs. allow multiple intents per session. Start with single line; revisit after first pilot.
5. **Parent weekly update integration.** Open Studio reflections are the richest content for the parent digest — confirm in Parent Updates spec.
6. **Drift thresholds.** Session count vs evidence % — which is the better primary signal? Needs real student data to calibrate.
7. **AI critic conversation retention.** Verbatim vs. summarised in the Wayfinder. Verbatim preserves the append-only principle but may create noise.

## 9. Reference patterns studied

Not copied — each informs one specific element:
- **Scrum daily standups** → three-question reflection
- **Strava** → intent + passive capture + post-activity reflection (same three-touch shape)
- **Figma / Linear** → ambient presence without nagging (critic corner, horizon strip)
- **Focusmate** → start-of-session commitment framing (arrival intent card)
- **Notion / Roam daily notes** → lightweight recurring reflection with near-zero friction
- **Destiny pursuits** → self-selected objectives tracked passively (milestones feel chosen, not assigned)
- **Art school / maker studio crits** → real-world analogue for the teacher floor-walk dashboard
- **Duolingo streaks** → cautionary example. Must never tip from motivating into coercive.

Full annotated patterns in [`docs/open studio/prototypes/open-studio-reference-prototypes.html`](../open studio/prototypes/open-studio-reference-prototypes.html).
