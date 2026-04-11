# Skills Library — Completion & Strength Addendum

**Status:** Draft v0.1
**Supersedes:** nothing (extends `skills-library-design-note.md`)
**Owner:** Matt

---

## 1. What this addendum adds

The base spec captures *what* skill cards are and *where* they're embedded. This addendum captures *how the system tracks what a student has already done* and *how that history changes the experience next time*. Three new pieces:

A **completion state model** that distinguishes between never-touched, just-read, quiz-passed, teacher-verified, and applied-in-real-work — plus a freshness layer that lets older completions decay gracefully.

A **context-aware gating logic** that decides, on every embed, whether the student needs to do the full card, a quick refresh, or can skip entirely. This is what makes the same card behave appropriately whether it's a Grade 7 student's first encounter or a Grade 10 student revisiting it for the fifth time.

A **strength radar chart** that visualises what a student is actually good at across the framework's categories — derived entirely from completion events, never stored as state. This becomes a navigation tool ("where am I weakest?"), a motivation tool ("look how this filled in over the year"), and a teacher diagnostic tool.

---

## 2. Completion state model

A student's relationship with a skill card is not binary. The model tracks five progressive states plus a freshness layer that applies to all of them.

| State | How it's reached | What it means |
|---|---|---|
| `not_started` | Default | Student has never opened the card |
| `viewed` | Student opens the card and scrolls through | Awareness only |
| `quiz_passed` | Student completes the quiz at threshold | Tested understanding |
| `demonstrated` | Teacher signs off in person (e.g. safety badge) | Practical competence |
| `mastered` | Skill has been a prerequisite for ≥3 successfully completed Stones | Applied competence |

States are progressive — a student moves up but never down. A student at `mastered` doesn't lose mastery if they take a long break; they just become *stale* (see freshness below).

**Mastery is the interesting one.** It's not awarded by passing a quiz. It's derived from real work in the Wayfinder: when a student completes Stones whose prerequisites included this skill, those completions count toward mastery. The threshold (currently 3) is configurable per skill — a high-stakes safety skill might require 5 demonstrated applications, a lightweight skill might require only 1. This ties the library directly to actual practice rather than to test-taking.

### Freshness

Every state has a `last_used_at` timestamp, updated whenever the skill is touched (viewed, quizzed, applied in a Stone, demonstrated to a teacher). From that timestamp, three freshness bands:

| Band | Age | Effect |
|---|---|---|
| `current` | < 90 days | Full credit, skipped on re-encounter |
| `cooling` | 90–180 days | Soft refresh suggested, not enforced |
| `stale` | 180+ days | Refresh prompt on next encounter |

A `mastered` skill that has gone `stale` is still mastered — but the student is gently nudged to refresh it when relevant. Decay rates need calibration with real student data (see open questions).

---

## 3. Context-aware gating

When a student encounters a skill embed (in a lesson, a Stone, an Open Studio recommendation), the system checks three things:

1. The student's current **state** for this skill
2. The student's current **freshness** for this skill
3. The embed's configured **requirement** (none / viewed / quiz_passed / demonstrated)

From those three, it picks one of four actions:

| Student status | Embed requires | Action |
|---|---|---|
| Not started | viewed | **Full card** — read through, mark viewed on scroll |
| Not started | quiz_passed | **Full card + quiz** |
| Viewed (current) | viewed | **Skip** — one-tap acknowledge |
| Quiz_passed (current) | quiz_passed | **Skip silently** |
| Quiz_passed (stale) | quiz_passed | **Refresh** — collapsed card + 3-question quiz |
| Quiz_passed (stale) | viewed | **Refresh** — collapsed card, no quiz |
| Mastered (current) | quiz_passed | **Skip silently** |
| Mastered (stale) | quiz_passed | **Refresh prompt** — student chooses skip or refresh |
| Demonstrated | demonstrated | **Skip** |

This is the heart of the "smart scaffolding" the system needs to provide. The student feels respected — the system isn't making them re-read material they've already mastered. The teacher feels supported — the system isn't letting students skip past skills they haven't earned yet. Same card, four possible behaviours, all driven by structure rather than configuration overhead.

Crucially this happens **without any model in the loop**. It's a series of joins on the `learning_events` table. Auditable, transparent, and the student can always see why a card was presented to them in a particular way ("you passed this quiz in March — would you like to refresh?").

---

## 4. Refresh mode

A refresh is not the same as a full encounter. The interaction shape is deliberately lighter:

- **Collapsed card body.** Only the headlines, callouts, and key visuals — no exposition. The student can expand any section if they need to.
- **Quick quiz.** Three questions drawn at random from the full quiz pool (if a quiz exists). Pass threshold is the same as the full quiz.
- **One-tap acknowledge** as an escape hatch. The student can mark the refresh complete without taking the quick quiz, but this is logged as `skill.refresh_acknowledged` rather than `skill.refresh_passed` so the teacher can see who chose the lighter path.
- **Always under 90 seconds.** If a refresh feels heavy, the system has failed.

Refresh actions are logged as their own learning event types so the Wayfinder can distinguish "passed full quiz on first attempt" from "passed refresh quiz after six months." Both are valid; both tell different stories.

---

## 5. Categories & framework alignment

The strength chart needs *categories* — axes to chart against. The base spec already has tags as the primary classification, but tags are too granular and too unbounded to make a readable chart. A separate, smaller, framework-scoped category set is needed.

A new table:

```sql
skill_categories (
  id              uuid primary key,
  framework_id    uuid references frameworks,
  slug            text,                       -- e.g. 'myp-c-creating'
  name            text,                       -- e.g. 'Creating the Solution'
  description     text,
  display_order   int,
  axis_label      text                        -- short label for the radar chart
)

skill_card_categories (
  skill_id        uuid references skill_cards,
  category_id     uuid references skill_categories,
  weight          numeric default 1.0,        -- how much this skill contributes
  primary key (skill_id, category_id)
)
```

A single skill card can belong to multiple categories with different weights. A soldering skill is mostly Criterion C (Creating) but has a meaningful slice of Criterion D (Evaluating, when you test the joint). Weights default to 1.0 and are normalised at chart-render time.

**Default category sets** ship with each framework:

- **MYP Design:** four categories matching the four MYP Design criteria (Inquiring & Analysing, Developing Ideas, Creating the Solution, Evaluating).
- **PYP:** the transdisciplinary skills categories.
- **DP:** ATL skill categories.
- **General maker / homeschool / freeform:** a phase-based default (Research, Ideation, Prototyping, Testing, Communication, Reflection).

Schools using the framework get the defaults but can override by editing the `skill_categories` set for their school. This is the kind of small but high-leverage configurability that makes the system feel like it actually understands the framework rather than treating it as decoration.

---

## 6. The strength radar chart

A classical radar chart with one axis per category. Each axis shows the student's aggregate strength in that category, computed at view time from learning events.

### Computation

For each category, sum the contribution from every skill the student has any completion state on:

```
contribution(skill) = state_score × freshness_factor × category_weight

state_score:
  viewed         = 0.2
  quiz_passed    = 0.6
  demonstrated   = 0.9
  mastered       = 1.0

freshness_factor:
  current  (< 90 days)   = 1.0
  cooling  (90–180 days) = 0.7
  stale    (180+ days)   = 0.4
```

Then divide by the sum of `category_weight` for all skill cards *in that category* (the maximum possible) to get a 0–1 strength score per axis. Recompute on view; never store.

This formula does several useful things at once:

- **Recent practice counts more than old practice.** A student who quizzed past a skill last week is stronger than one who passed it a year ago.
- **Mastery beats quizzing beats viewing.** The state ladder is reflected in the score, not just in a status badge.
- **Strengths fade gracefully.** A student who hasn't touched electronics in nine months sees their electronics axis shrink — but they can rebuild it by refreshing.
- **The chart fills in over time.** The denominator grows as the library grows, but a student's chart is only ever measured against the current library, so it stays meaningful.

### Where it appears

| Surface | View | Purpose |
|---|---|---|
| Student dashboard | Own chart, small | Self-awareness, motivation |
| Library browse | Own chart with "weakest area" filter | Navigation tool — find skills that strengthen weak spots |
| Open Studio | Own chart + suggested skills to balance | Recommendation surface (still no AI — pure structural query) |
| Teacher dashboard | Per-student chart | Diagnostic |
| Teacher dashboard | Class-aggregate overlay | "Where is this whole class weak?" |
| Parent updates | Optional, student opt-in | Communication |

The chart is **never visible peer-to-peer.** Students cannot see each other's charts. This is deliberate — the chart is for self-awareness and teacher diagnostics, not social comparison. Open Studio's existing peer-help discovery (pattern 03 in the reference prototypes) handles peer-to-peer visibility through *current activity*, not through *measured strength*.

---

## 7. Privacy & wellbeing notes

A strength chart is a powerful tool but can become a source of anxiety if mishandled. A few design constraints:

- **No public ranking.** Ever. Students never see each other's charts and never see where they sit relative to peers. The chart is a mirror, not a scoreboard.
- **No "incomplete" framing.** A small chart in week one is not a deficit; it is a starting point. Visual language matters — empty axes should look like *room to grow*, not *failure*.
- **No notifications about chart shrinkage.** A skill going stale should be surfaced *contextually* (when the student encounters that area again), not pushed via notification ("your electronics is fading!"). Pushing decay alerts would tip the system into Duolingo territory.
- **Teacher visibility is the safety valve.** A teacher should be able to spot a chart that's worryingly empty across the board and intervene with a real conversation, not let the chart do the work of pastoral care.
- **Student opt-in for parent visibility.** Some students don't want their parents seeing the chart. The default should be off; the student decides per parent update digest.

---

## 8. Schema additions

Two existing changes to the base spec, plus the new categories tables shown in §5.

The `learning_events` types expand to cover the new completion shapes:

```
skill.viewed
skill.quiz_passed
skill.quiz_failed
skill.refresh_passed
skill.refresh_acknowledged
skill.demonstrated
skill.applied              -- written when a Stone completes that listed this skill as a prereq
```

A derived view computes current state per student per skill:

```sql
create view student_skill_state as
select
  student_id,
  skill_id,
  highest_state,            -- not_started | viewed | quiz_passed | demonstrated | mastered
  last_used_at,
  freshness                 -- current | cooling | stale
from ( ... aggregate query over learning_events ... )
```

A second derived view computes per-student per-category strength scores for the radar chart. Both views are cheap enough to compute on read for v1; if they get expensive at scale, materialise overnight via pg_cron.

---

## 9. Open questions

1. **Mastery threshold.** Is 3 successful Stone applications the right number, or does it need to vary by skill type? Probably both — default of 3, configurable per skill.
2. **Freshness band edges.** 90 / 180 days is a guess. Subjects vary — soldering muscle memory fades fast, design vocabulary doesn't. Might need per-category decay curves eventually.
3. **State score weights.** Is `quiz_passed = 0.6` and `demonstrated = 0.9` the right gap? Worth piloting and tuning.
4. **Refresh question count.** Three is a guess. Could be configurable per quiz; could vary with how stale the skill is (one question if cooling, three if stale).
5. **What counts as "applied" for mastery?** Currently: Stone completion where this skill was listed as a prereq. Should it require a teacher review of the Stone's work capture too, to avoid mastery from sloppy work? Probably yes for high-stakes skills, no for everything.
6. **Multi-framework cards.** A skill that maps to both MYP and PYP categories — does it have weights in both, or do schools fork to translate? Probably weights, with a UI to manage them.
7. **Chart axis count.** Four feels small, eight feels crowded. MYP Design happens to have four criteria so it's clean for the bootstrap, but a flexible renderer is probably needed before long.
8. **Decay visibility on the chart itself.** Should stale areas show as a faded outline ring outside the current strength fill, so students see what they *had* vs what they *currently have*? Visually rich but possibly confusing.
9. **First-encounter floor.** Should every student see at least a baseline non-zero chart so day one doesn't feel demoralising? Or is honesty better?

---

## 10. Notes for the workshop project scope

The base spec's workshop scope (schema, authoring UI, library browse, Stone prereq integration, link-check) does not need to grow much to absorb most of this addendum. Specifically:

**Add to "must have":**
- Completion state computation as a derived view over `learning_events`. The states themselves write naturally from existing actions.
- Basic context-aware gating: at minimum, "skip if recently viewed" so students aren't forced to re-read material they just looked at. Full state-aware gating can come later.

**Add to "should have":**
- Categories table and the framework default for MYP Design.
- Refresh mode (collapsed card view + skip option). Skip the quick quiz logic in v1; just collapsed-card + acknowledge.

**Defer to a later project:**
- The radar chart visualisation. It is the most visually exciting piece but it depends on having enough completion data to look meaningful. Build it once the library has been used for a few weeks and there's real data to visualise. Shipping an empty chart on day one is worse than shipping no chart.
- Mastery derivation from Stone completions. Wait until Stones are more mature.
- Class-aggregate teacher view of the chart.

The thing to *get right* in the workshop project is the **event types and the derived state view**. Everything else in this addendum builds on those. If the data model captures the right shape from day one, the chart and the gating logic and the refresh mode can all be added later without rework.
