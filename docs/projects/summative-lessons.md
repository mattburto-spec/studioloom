# Summative Lessons

> **Status:** 🔵 PLANNED — DEFERRED to next semester (rest of current semester is formative-only testing in StudioLoom).
> **Resolution:** Option B′ (Option B + three presentation moves) — banked 11 May 2026 after independent Cowork + Gemini review.
> **Not a new project, not a schema change.** Reframes the original "Summative Lessons" idea as a UX layer on top of the locked Task System architecture ([`task-system-architecture.md`](task-system-architecture.md)).
> **When you come back:** read this doc top to bottom, then [`task-system-architecture.md`](task-system-architecture.md), then [`summative-lessons-reviews-2026-05-11.md`](summative-lessons-reviews-2026-05-11.md). Trigger phrase: "continue summative lessons" or "summative".

---

## TL;DR for future-you

You came to me on **11 May 2026** wanting to spec a new "Summative Lessons" feature as a distinct lesson type with its own menu treatment, inline rubric panel, and per-criterion scoring on the lesson page.

The audit-before-touch found that the work you were describing is **already largely built or planned under a different name**: the Task System Architecture project (TG.* phases) signed off 5 May 2026, with schema applied to prod and the teacher-side summative UI (TG.0D 5-tab drawer) built awaiting smoke. That architecture deliberately rejected a "summative-as-lesson-type" framing in favour of "summative is a task that *attaches to* one or more lessons."

Independent Cowork + Gemini reviews on 11 May confirmed the 5 May verdict was correct (UbD, every major LMS, teacher cognitive load, schema coherence all point the same direction). You agreed and deferred the work — rest of this semester is formative-only testing.

What's banked: **B′ = three presentation moves layered on top of the locked Task System architecture**, to be picked up when summative scoring would help in StudioLoom (likely next semester, August/September 2026). No schema changes. No throwaway. ~3–4 days additional work.

This doc records what B′ is, why we picked it, and how to pick it up.

---

## The decision in one paragraph

Both Cowork and Gemini independently picked Option B (keep locked Task System architecture; deliver visibility + inline rubric + accessibility as presentation moves on top of `assessment_tasks` + `submissions`). Cowork named the variant **B′** with three concrete moves. Matt accepted B′ + deferred to next semester. Wiggins/McTighe's Understanding by Design stages assessment design (Stage 2) explicitly *before* lesson design (Stage 3) — that's the deepest reason. Every major LMS (Toddle, ManageBac, Canvas, Schoology, Seesaw, Schoolbox) treats assessment as a separate first-class entity from lessons. A "summative as lesson type" framing would invent a paradigm no shipped product has validated and would actively nudge first-year MYP teachers into the coverage-teaching anti-pattern UbD was written to fix.

---

## What B′ actually means — three presentation moves

These are layered on the existing schema (`assessment_tasks` + `task_lesson_links` + `task_criterion_weights` + `submissions` + `grade_entries`, all applied to prod via migration `20260505032750_task_system_v1_schema.sql`).

### B′(a) — Lesson menu visual differentiation for linked summatives

When a lesson has a `task_lesson_links` row pointing at a `summative` task, the lesson menu row renders with the summative icon + colour. Pure presentation. No schema change, no writer-path change. **Colour + icon together** — satisfies the accessibility ask (not colour alone) at the presentation layer. Where it lands: ~½–1 day, can be its own brief or folded into TG.0E.

### B′(b) — Inline rubric + score inputs on the lesson page (TG.0F redesigned)

When a student opens a lesson that's the submission point for a summative, the rubric + per-criterion score inputs render **inside the lesson view** rather than on a separate `/(student)/tasks/[taskId]/submit` route. Activity blocks remain usable inline. Rubric panel + per-criterion score inputs below the blocks. Locked-after-submit + graded banner work the same. **This is TG.0F redesigned, not re-scoped** — the standalone submission route can be folded into the lesson view for the single-lesson case (multi-lesson summatives keep the standalone route as their landing). Where it lands: replaces or extends TG.0F brief. Estimate ~1.5–2 days.

### B′(c) — Single-lesson summative fast path in TG.0D drawer

Add a "Where does this happen?" field as the first question in the existing 5-tab drawer: *Across multiple lessons (I'll link them)* / *In one new lesson I'll add now* / *In an existing lesson*. For "one new lesson" the drawer creates the task **and** a target lesson with the right `task_lesson_links` row in one transaction. Kills the "I have to create lesson and task separately" friction without forking the architecture. Either folded into TG.0D pre-merge OR shipped as a TG.0D follow-up after the existing smoke. Estimate ~½–1 day.

**Combined estimate: ~3–4 days.** Sequence: B′(c) first (small, lands in already-built drawer), then B′(a) (small, low-risk), then B′(b) (bigger, requires lesson renderer surgery).

---

## What this is NOT changing

- **Schema:** `assessment_tasks`, `task_lesson_links`, `task_criterion_weights`, `submissions`, `grade_entries` — frozen. All applied to prod.
- **Submission state machine** `draft → submitted → graded → returned` — frozen. Lives on `submissions.status`.
- **The 5-tab summative drawer** (GRASPS → Submission → Rubric → Timeline → Policy) — keeps working as-is. B′(c) is an amendment, not a rewrite.
- **The decision that summatives ARE tasks, not lesson types** — stays. B′ is presentation only.
- **The TG.0C Tasks panel sidebar** (Quick-Check formative inline form) — merged to main, untouched.
- **The 5 May verdict on unified `assessment_tasks` with `task_type` discriminator** — stands.

---

## What this defers (and where it falls in TG.* sequence)

| TG.* phase | Status as of 11 May | What B′ adds |
|---|---|---|
| TG.0A pre-flight | ✅ Complete | — |
| TG.0B schema migration | ✅ Applied to prod | — |
| TG.0C Tasks panel + Quick-Check inline form | ✅ Merged to main | — |
| TG.0D 5-tab summative drawer | ⏳ Built, awaiting Matt's smoke | B′(c) "Where does this happen?" amendment — fold in pre-smoke OR ship as follow-up |
| TG.0E lesson "Builds toward..." chip | ❌ Not started | B′(a) lesson menu icon + colour might subsume or sit alongside |
| TG.0F student submission page | ❌ Not started | **B′(b) replaces this with inline-in-lesson rendering** |
| TG.0G G1 marking page refactor (task-scoped) | ❌ Not started | Unchanged |
| TG.0H ManageBac export | ❌ Not started | Unchanged |
| TG.0I tests + smoke seed | ❌ Not started | Unchanged |
| TG.0J registry sync | ❌ Not started | Unchanged |
| TG.0K legacy delete | ❌ Not started | Unchanged |

So picking this up means: smoke + merge TG.0D, then build TG.0E (with B′(a)), then build TG.0F-as-B′(b), then continue normal TG.* sequence.

---

## When to pick this up

**Trigger conditions:**

1. Current semester's formative-only testing in StudioLoom surfaces enough confidence that summative scoring would help your teaching (or another teacher's).
2. The active LIS work (lesson input surfaces — `questerra-lis` worktree, `lesson-input-surfaces-integration` branch as of 11 May 2026) has merged. B′(b) touches the same student lesson renderer that LIS is currently editing.
3. TG.0D has been smoked and merged.

**Likely time window:** end of current semester → start of next semester (August/September 2026).

**Trigger phrase:** "continue summative lessons" or just "summative".

---

## Coordination concerns when picking up

- **LIS collision.** B′(b) renders rubric + score inputs inside the lesson view. The `questerra-lis` worktree is editing the same student lesson renderer in May 2026 (key-callout, rich-text, multi-question surfaces). Confirm LIS is merged before starting B′(b). If LIS is still in flight, sequence B′(c) and B′(a) first — they don't touch the renderer.
- **TG.0D smoke status.** If still awaiting smoke when you pick this up, the choice is: fold B′(c) into TG.0D pre-smoke (cleaner first impression, +½ day work) OR smoke TG.0D as-is and ship B′(c) as a follow-up. Smoke-first is the lower-risk path.
- **TG.0E vs B′(a) overlap.** TG.0E ships the "Builds toward..." chip on lesson cards. B′(a) adds icon + colour to the lesson menu row when a `task_lesson_links` entry exists. These are sibling presentation moves — possibly one PR.
- **Skills Library / Per-criterion evidence.** Your original 11 May brief mentioned outputs feeding per-criterion evidence into student profile (Skills Library, cross-unit views). That's a separate downstream concern. `grade_entries.criterion_key` already exists; the read-side aggregation is a Skills Library / student profile feature, not part of B′.

---

## Why we didn't reverse the 5 May verdict

Short version (long version in [`summative-lessons-reviews-2026-05-11.md`](summative-lessons-reviews-2026-05-11.md)):

1. **No major LMS treats summative as a lesson type.** Toddle (closest comparable), ManageBac, Canvas, Schoology, Seesaw, Schoolbox — all keep assessment as a separate first-class entity. A summative-as-lesson-type product would be inventing a paradigm no MYP teacher has seen.

2. **UbD explicitly stages assessment before lessons.** Stage 1 (objectives) → Stage 2 (assessment evidence) → Stage 3 (learning plan). Conflating Stages 2 and 3 is the coverage-teaching anti-pattern UbD was written to fix. The TG.0D 5-tab drawer (GRASPS → Submission → Rubric → Timeline → Policy) is the UbD scaffold; "summative as lesson type" forfeits it.

3. **Mr. Patel (Sunday backward-design) gets stuck on Option A.** He wants to write the summative first, but Option A forces him to create a placeholder "Lesson 6" to hold it. He plans forward despite intentions. Option B + B′(c)'s "one new lesson I'll add now" path handles this without inverting architecture.

4. **First-year MYP teacher.** Both Cowork and Gemini flagged this independently: A and C let teachers skip the GRASPS scaffold by picking the simpler surface. That habit ("summative = one lesson with a rubric") is exactly what MYP coordinators spend years trying to undo.

5. **Schema coherence.** Option A degenerates `task_lesson_links` to a self-pointer; when teachers want to extend across two lessons, it reinvents Option B with a worse entry point.

6. **Single-lesson is just multi-lesson with N=1.** Same data shape, different mental model. Fork the surface and you create a path where the easier route avoids better practice.

7. **Accessibility scope-creep check.** "Colour + icon, not colour alone" is satisfied trivially at the presentation layer (B′(a)). It does not justify architecture change.

---

## Reviews archive

Full verbatim text of both independent reviews is at [`summative-lessons-reviews-2026-05-11.md`](summative-lessons-reviews-2026-05-11.md). Preserve it — it's the load-bearing source material if you ever waver on this decision.

---

## Open items / future-FUs

- **FU-SL-SKILLS-EVIDENCE** (P2) — Per-criterion evidence flowing into Skills Library / student profile from `grade_entries`. Read-side aggregation, separate concern from B′. File when Skills Library work picks up.
- **FU-SL-MULTI-CRITERIA-RUBRIC-DEFAULT** (P3) — Original 11 May brief specified multi-criteria rubric as default (not single score). Verify `task_criterion_weights` table writes multiple rows by default in the TG.0D drawer (Tab 3). Spot-check when B′ work starts.
- **FU-SL-LOCKED-BLOCKS-AFTER-SUBMIT** (P2) — Original 11 May brief specified blocks locked + graded banner once submitted. This is TG.0F-as-B′(b) work — confirm `submissions.status` transitions drive UI locking on the lesson page renderer, not just on a separate route. Build into B′(b) brief.

---

## Cross-references

- **Foundation:** [`task-system-architecture.md`](task-system-architecture.md) (5 May 2026, ~900 lines) — the locked architecture this builds on top of
- **TG.0C brief:** [`task-system-tg0c-brief.md`](task-system-tg0c-brief.md) (merged)
- **TG.0D brief:** [`task-system-tg0d-brief.md`](task-system-tg0d-brief.md) (built, awaiting smoke) — B′(c) amends this
- **TG.0A pre-flight report:** [`task-system-tg0a-preflight.md`](task-system-tg0a-preflight.md)
- **Original grading master spec (now superseded by task-system-architecture):** [`grading.md`](grading.md)
- **Reviews archive:** [`summative-lessons-reviews-2026-05-11.md`](summative-lessons-reviews-2026-05-11.md)
- **Neutral criterion taxonomy:** [`../specs/neutral-criterion-taxonomy.md`](../specs/neutral-criterion-taxonomy.md) — the 8-key system that drives `task_criterion_weights.criterion_key`
- **Decision log entry:** see `docs/decisions-log.md` for the 11 May 2026 entry

---

*Doc created 11 May 2026. Updated by future-Matt + Claude when B′ work begins.*
