# Session Summary — Open Studio &amp; Skills Library

**Session date:** April 2026
**Purpose:** Two connected design threads for Loominary, prepared for review in Cowork.

---

## What's in this folder

Seven artifacts produced across two interlocking threads. Read this summary first; the rest is available for depth as needed.

### Thread A — Open Studio mode &amp; the student dashboard

The student-facing experience for learners who have earned the right to self-direct. How to scaffold without nagging, how to capture intent and reflection without compliance overhead, and how to do all of this without a chatbot.

| File | What it is |
|---|---|
| `open-studio-mode-spec.md` | Formal spec — principles, three-touch pattern, AI behaviour, escalation ladder, UX layout, integration points, open questions. |
| `open-studio-wireframe.html` | Visual wireframe of the desk view and the reflection drawer. Two states side-by-side with annotations. |
| `open-studio-reference-prototypes.html` | Eight reference patterns borrowed from Scrum, Strava, Figma, Focusmate, Notion, Destiny, studio crits, and Duolingo. Each shown with notes on how it applies under the no-chatbot constraint. |
| `student-dashboard.html` | Composed dashboard layering the three highest-leverage patterns (crit board, Stone with prerequisites, daily template journal). Zero AI in the loop. |

### Thread B — Skills library

The content layer that powers everything in Thread A. Skill cards are the canonical unit; everything else surfaces them in different contexts.

| File | What it is |
|---|---|
| `skills-library-design-note.md` | Base spec — anatomy of a skill card, schema, embed contexts, quiz design, badges, authoring phases, maintenance, cross-school sharing as moat. |
| `skills-library-completion-addendum.md` | Extension — completion state model, freshness layer, context-aware gating, refresh mode, categories, the strength radar chart, privacy &amp; wellbeing rules. |
| `strength-chart-prototype.html` | Working prototype of the radar chart showing three students with different shapes, the state ladder, and the same skill card behaving three different ways via context-aware gating. |

---

## The thread connecting both

The two threads are not separable. Open Studio promises silence and trust; the only way to deliver scaffolding inside that promise is to have a rich, navigable, human-authored skill library that surfaces *contextually*. Strip the library out and Open Studio becomes either nagging (push notifications) or empty (no help when stuck). Strip Open Studio out and the library becomes a passive reference no student opens.

The bridge is **structural surfacing without generation**. Every help moment in the dashboard — Stone prerequisites, crit board pins, journal wikilinks, blocker hints, capability-gap recommendations — resolves to a skill card via a join, not via a model. This is what makes the no-chatbot constraint workable rather than limiting.

---

## Key design decisions captured this session

**On the student experience**

- No student-facing chatbot at launch. All help surfaces are curated, human-authored, navigable artefacts. AI features can layer on later as opt-in upgrades once the safety story is settled.
- Open Studio is earned, not assigned. Loss conditions are teacher-triggered only; the AI never revokes status itself.
- Three-touch pattern: arrival intent (~10s) → passive evidence → departure reflection (~60s). Everything else is uninterrupted work.
- The reflection drawer is the one place the contract is enforced. Cannot be dismissed. It is the price of admission for tomorrow's Open Studio.
- Continuity is the main UX job of the desk view. The bench should look exactly as the student left it.
- Escalation ladder is graduated and always ends with a human. AI surfaces signals; teachers decide interventions.

**On the skills library**

- The library is the moat. Fifteen years of teacher-authored material is the asset competitors structurally cannot copy.
- One canonical card, many embed contexts. Authored once; referenced from library, lessons, Stones, Open Studio, crit board, badges.
- Tags over hierarchy. Folder structures break with curriculum changes; tag graphs survive them.
- Skill completions are `learning_events`, never their own table. Current state is a derived view. Aligns with the existing append-only commitment and means skill records survive school transfers automatically.
- Quizzes must be gradable without a model. Six question types (MC single/multi, true/false, image identification, ordering, matching) cover almost any practical skill without ever needing free-text evaluation.
- Mastery is *derived from real work* — Stone completions where the skill was a prerequisite — not from test-taking alone.
- The strength radar chart is computed on view, never stored. State score × freshness factor × category weight, normalised per axis.

**On wellbeing and trust**

- No streaks, no hearts, no notification guilt. Duolingo studied as cautionary, not aspirational.
- No peer-to-peer chart visibility. The chart is a mirror, not a scoreboard.
- No "incomplete" framing. An empty chart in week one is a starting point, not a deficit.
- Decay surfaced contextually only. Never push notifications about skill decay.
- Teacher visibility is the safety valve for serious chart concerns, not the system itself.

---

## Workshop project scope — next week

The base spec's "must have" slice for the workshop project, with the addendum's additions folded in:

**Must have**

- Schema for skill cards, tags, prerequisites, external links, categories
- Skill completions as `learning_events` (no separate table)
- `student_skill_state` derived view (state + freshness per skill per student)
- Basic authoring UI — markdown-ish editor with structured blocks
- Card view (the leaf experience)
- Library browse with tag filtering
- Stone prerequisite integration — lowest-risk first embed context
- Nightly link-check via pg_cron — ship from day one to avoid retrofitting
- Basic context-aware gating: at minimum, "skip if recently viewed"

**Should have if time permits**

- Categories table seeded with the four MYP Design criteria
- Refresh mode: collapsed card view + acknowledge button (skip the quick quiz logic in v1)
- Quiz engine for MC and true/false only
- Lesson activity block embedding with viewed-level gate
- Open Studio capability-gap surfacing (the join is trivial; the UI is the work)

**Defer to later projects**

- The radar chart visualisation itself — needs real completion data to look meaningful. Empty chart on day one is worse than no chart.
- Mastery derivation from Stone completions — wait until Stones are mature.
- Badge engine — deserves its own spec with teacher sign-off workflow, expiry, visualisation.
- Forking and lineage UI (the schema supports it from day one).
- Cross-school visibility — until there are multiple schools.
- Image identification quiz type, ordering, matching — phase 2.

**Realistic target:** 20–30 high-value skill cards mined from existing PowerPoints, viewable in the library, linkable from Stones, with working link-check. That's a complete loop and an immediately useful product surface.

---

## Open questions to resolve in the Cowork session

These are the calls that benefit most from being made deliberately rather than by default. Grouped by where they live.

**Architecture &amp; mental model**

1. Lesson activity blocks vs Stones — confirm the mental model. The skills library spec assumes lessons are sequences of activity blocks (instructions, prompts, work captures, embedded skill cards) distinct from Stones (the disposable execution layer). Worth verifying against current architecture before building.
2. Tag governance — who decides whether `electronics` and `electronic` and `electrical` are the same tag? Phase 1 = Matt decides; phase 3+ needs a process.

**Calibration (need real student data eventually but worth a starting guess now)**

3. Mastery threshold — default of 3 successful Stone applications. Vary by skill type?
4. State score weights — `viewed=0.2`, `quiz_passed=0.6`, `demonstrated=0.9`, `mastered=1.0`. The gap between quiz_passed and demonstrated is deliberately large; worth a sanity check.
5. Freshness band edges — 90 / 180 days is a guess. Soldering muscle memory fades fast; design vocabulary doesn't. Per-category decay curves eventually?
6. Quiz pass threshold default — 80% is conventional but unexamined.
7. Refresh question count — three is a guess. Could vary with how stale the skill is.

**Design calls**

8. Quiz item types in v1 — start with MC + true/false only, or include image identification from day one?
9. Empty-chart wellbeing — should every student see at least a baseline non-zero chart so day one doesn't feel demoralising? Or is honesty better?
10. Stale visualisation on the chart — show faded outline ring outside the current strength fill, so students see what they *had* vs what they *currently have*? Visually rich but possibly confusing.
11. Critic corner visibility when idle (Open Studio) — visible when silent for reassurance, or only when it has something to offer for purer studio posture?

**Operational**

12. Video hosting — Cloudflare Stream looks like the strong default (cheap, works in China, no ads). Worth confirming bandwidth costs.
13. Demonstrated badge sign-off workflow — teacher walks to the bench and taps a button on their phone, or signs off from the dashboard? Both?
14. ELL voice transcription accuracy for the reflection drawer — needs testing with the NIS ELL cohort before pilot.

---

## Suggested reading order for Cowork

1. **This summary** — orientation
2. **`open-studio-mode-spec.md`** — the most important conceptual document; everything else flows from the principles in §2
3. **`skills-library-design-note.md`** — the base spec for the workshop project
4. **`skills-library-completion-addendum.md`** — the extension that makes the library actually feel intelligent
5. **`student-dashboard.html`** — the visual reference for what the composed experience looks like
6. **`strength-chart-prototype.html`** — the most novel piece, worth seeing rendered
7. **`open-studio-wireframe.html`** — desk and reflection drawer
8. **`open-studio-reference-prototypes.html`** — the eight reference patterns; useful as a design vocabulary for future conversations

---

## What was deliberately *not* decided this session

Worth being explicit about:

- The **badge engine** spec — flagged as deserving its own document. Hooks are in the schema but the workflow isn't designed.
- The **teacher floor-walk dashboard** — mentioned in the Open Studio spec but left as a separate doc to write.
- The **skill card authoring UI** in detail — the experience Matt will live in for years, deserves its own design session closer to build time.
- The **lesson activity block** structure itself — assumed but not specified.
- The **community contributor / marketplace** model — phase 4, long way off, deliberately deferred.
- **AI features as opt-in upgrades** — the path from no-chatbot v1 to AI-enabled later was discussed but not specced.

These are bookmarks, not gaps. Each one is worth its own focused session when its time comes.
