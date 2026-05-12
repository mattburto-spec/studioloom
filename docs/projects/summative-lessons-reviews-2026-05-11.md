# Summative Lessons — Architecture Review Archive (11 May 2026)

> Verbatim text of the Cowork + Gemini independent reviews that resolved the "Summative Lessons vs Task System" reconciliation question on 11 May 2026. Both reviews pulled in response to the same prompt, run independently without contact. The synthesis + decision lives in [`summative-lessons.md`](summative-lessons.md). This file is the load-bearing source material for that decision — preserve verbatim.

## Context the reviewers had

The reviewers received a self-contained prompt covering:

1. **5 May 2026 locked architecture** — their own prior review confirmed Option A: unified `assessment_tasks` table with `task_type` discriminator, split teacher UX surfaces (inline-row formative vs 5-tab summative project drawer with GRASPS), polymorphic `submissions` table, weight on criterion-task edge, version-based resubmissions. Industry pattern confirmed across Canvas, Schoology, ManageBac, Toddle.

2. **Shipped state** — migration `20260505032750_task_system_v1_schema.sql` applied to prod; TG.0C (Tasks panel sidebar + Quick-Check inline formative form) MERGED to main; TG.0D (5-tab summative project-task drawer) BUILT, awaiting smoke before merge; TG.0E/0F/0G/0H not yet built.

3. **Matt's new "Summative Lessons" proposal (11 May 2026)** —
   - Summative is a special TYPE of lesson, not nested inside an existing lesson
   - Appears in left-hand lesson menu with visual differentiation (colour + icon, accessibility)
   - Page layout: instructions → rubric panel → activity blocks inline → per-criterion score inputs + comments
   - Multi-criteria rubric default; single score/comment is the simple fallback
   - SCORES only on summative lessons; formative stays feedback-only
   - Submission states: draft → submitted → graded → returned. Locked blocks + graded banner once submitted
   - Outputs feed per-criterion evidence into student profile

4. **Three reconciliation options** —
   - **A** Reverse the 5 May verdict (summative-as-lesson-type; tear up TG.0D)
   - **B** Keep locked architecture, treat "Summative Lessons" as UX framing
   - **C** Hybrid: TG.0D for multi-lesson + new "Summative Lesson" surface for single-lesson

5. **Asked of both reviewers** — industry pattern check, pedagogical research (UbD, Hattie, Black & Wiliam), teacher cognitive load (Ms. Okafor + Mr. Patel personas), single-lesson vs multi-lesson, schema implications, sunk-cost honesty (TG.0D), and a one-pick recommendation.

Both independently picked **Option B**. Cowork refined it to **B′ = Option B + three named presentation moves**. Gemini's "Compromise" mapped to the same shape.

---

## Gemini Review

This is a classic product-engineering friction point: confusing choreography (UX/presentation) with ontology (data model/architecture).

Matt is observing a real UX friction—teachers and students need a clear, chronological place to interact with summatives, and they need it to be highly visible—but he is proposing an architectural solution that breaks the pedagogical foundation of your platform.

Here is the direct read on your three options, addressing your specific questions, followed by a firm recommendation.

### 1. Industry Pattern Check
**Verdict: Option A is not an industry pattern. Option B is.**

- **Canvas / Schoology:** They use "Assignments" (Tasks) and "Pages" (Lessons). You sequence them in "Modules" (the timeline). An Assignment is not a type of Page; it is a distinct entity that lives in the timeline alongside Pages.
- **ManageBac:** Strictly separates "Tasks" from "Lessons/Experiences". Tasks live in the gradebook and unit planner. You can link them, but a Task is never a Lesson.
- **Toddle:** Toddle's unit planner places "Assessment Tasks" in the chronological flow of "Learning Experiences". It looks like Matt's left-hand menu, but under the hood, an Assessment Task is a distinct entity (Option B).

If you make Summative a "Lesson Type" (Option A), you are inventing a paradigm that runs counter to how every major LMS structures its database.

### 2. Pedagogical Research
**Verdict: Option A is a pedagogical misframing. The 5 May verdict was correct.**

- **Wiggins & McTighe (Understanding by Design):** UbD is the gold standard for MYP. It demands Backward Design: Stage 1 (Objectives) → Stage 2 (Assessment Evidence) → Stage 3 (Learning Plan). Option A forces the teacher to create the assessment as part of the learning plan timeline (Stage 3). This nudges teachers to see assessment as "what we do on Friday" rather than "the evidence we are designing the whole unit to capture." Option B preserves the UbD separation: you create the Task (Stage 2), then link it to Lessons (Stage 3).
- **Black & Wiliam:** The 5 May framing holds. Formative and summative are purposes, not different species of events. A summative task evaluates; a lesson delivers instruction. Conflating them damages the mental model.

### 3. Teacher Cognitive Load
- **Mr. Patel (Sunday, backward-designing a 6-week unit):** Under Option A, he gets stuck immediately. He wants to write his GRASPS summative first, but to do so, he has to create a dummy "Lesson 6" at the end of his empty timeline just to hold the task. Under Option B, he creates the Task in the drawer, then builds Lessons 1-5, linking them to the Task ("Builds toward...").
- **Ms. Okafor (5-minute window, Y9 single-lesson pitch):** Under Option A, she is happy. She clicks "New Lesson", toggles "Summative", and types. Under Option B (if poorly executed), she is annoyed because she has to create a Task, then create a Lesson, then link them.
- **The Fix:** Option B must be designed so that Ms. Okafor can create a Task from the lesson timeline, which auto-generates the 1:1 link.

### 4. Single-lesson vs Multi-lesson Summatives
A single-lesson summative is just a multi-lesson summative where N = 1.

If you choose Option C (Hybrid), you create a fractured mental model. What happens when Ms. Okafor's single-lesson pitch spills over into a second week? Does she have to migrate her "Summative Lesson" into a "Project Task"?

Having two different surfaces for the exact same data object based solely on duration is a recipe for technical debt and user confusion. One unified Task surface (Option B) that scales from 1 lesson to 10 lessons is strictly more general and robust.

### 5. Schema Implications
Your current schema (`assessment_tasks` + `task_lesson_links`) is perfect.

If you adopt Option A, the schema becomes awkward. You either have to deprecate `task_lesson_links` (breaking multi-lesson summatives entirely) or you have to write hacky middleware that auto-generates a hidden `assessment_task` every time a teacher creates a "Summative Lesson", hardcoding a 1:1 link. Option A actively fights the database you just merged.

### 6. Sunk Cost Honesty
If TG.0D (the 5-tab drawer) was wrong, you should burn it. But it's not wrong. It is the correct architectural manifestation of UbD and IB/MYP pedagogy.

### 7. The Recommendation & Pushback
I am pushing back hard against Matt's framing. You should choose Option B.

Matt is rationalizing a valid UX preference into a destructive architecture call. His core desires are:

1. Summatives need to be highly visible in the chronological flow (left-hand menu).
2. Accessibility requires an icon + color, not just color.
3. The UI needs to support inline grading and rubrics.

None of these require changing a Summative into a Lesson. You can give Matt exactly what he wants in the UI while keeping the 5 May architecture:

**The Compromise (Option B with Matt's UX):** Keep the schema and the TG.0D drawer. However, in the left-hand lesson menu, if a Task is scheduled for a specific date or linked as the primary focus of a lesson, render it in the menu with a distinct icon and color.

- When a student or teacher clicks that item in the left-hand menu, they aren't going to a "Lesson" entity; they are routed to `/(student)/tasks/[taskId]/submit` (TG.0F) or the teacher grading view (TG.0G).
- To the user, it feels like it's part of the chronological lesson flow (solving Matt's UX concern), but under the hood, it remains a distinct `assessment_task` (preserving your architecture and Mr. Patel's backward design).

**Final Verdict:** Do not tear up TG.0D. Do not reverse the 5 May verdict. Tell Matt his UI/UX requirements for visibility, accessibility, and inline grading are spot-on and will be implemented as a view on top of the existing Task architecture, rather than by mutating the definition of a Lesson.

---

## Cowork Review

**Headline.** Option B. The 5 May verdict was right. Matt is rationalising a real UX preference into an unnecessary architecture call — but the UX preference is partly valid, and you can deliver most of what "Summative Lessons" promises without inverting the data model. Call it B′: Option B plus three presentation moves.

### 1. Industry pattern check

No major LMS treats summative as a lesson type. The dominant pattern is: lessons (or pages, LEs, engagements) are content-delivery primitives; assessments are separate first-class entities that link to criteria and optionally to lessons.

**Toddle** specifically — closest comparable to StudioLoom for MYP/PYP — keeps "Assessment Tasks" as a separate entity from "Learning Engagements." Tasks tie to MYP criteria; LEs are the lesson-level objects; Tasks reference LEs as evidence of learning but are not themselves LEs. That is Option B exactly. If Matt has been looking at Toddle and reading "summative is a kind of LE" he is mis-remembering. Worth screen-sharing Toddle's task surface with him before locking the call.

**ManageBac:** Tasks are the assessment primitive, separate from Unit Planner content. Option B exactly. **Canvas / Schoology:** Assignments are first-class, separate from Pages/Lessons; quizzes are still Assignments. **Seesaw:** Activities are separate from journal pages. **Schoolbox:** separate assessment items.

"Summative as a lesson type" is essentially unprecedented in established platforms. Not automatically wrong — but Matt would be inventing a teacher mental model that no shipped product has validated, against the established pattern in every system MYP teachers already know.

### 2. Pedagogical research

Wiggins & McTighe (UbD) explicitly stages assessment design **before** lesson design. Stage 1 = desired results, Stage 2 = assessment evidence, Stage 3 = learning plan. The whole architecture assumes assessments exist as separate planning artifacts that lessons get *built toward*. "Summative as lesson type" collapses Stages 2 and 3 — you cannot backward-design from an artifact that doesn't exist independently. This is not a philosophical quibble: UbD's central critique of "coverage teaching" is exactly the failure mode where teachers plan activities then bolt assessment on at the end. Option A is structurally aligned with the thing UbD was written to fix.

Hattie's HITS treats assessment-for-learning and assessment-of-learning as distinct *purposes*, not distinct objects. Effect sizes attach to the practice, not the artifact shape.

Black & Wiliam — "different purposes for gathering the same evidence" — was correctly applied on 5 May to justify the unified schema (one `assessment_tasks` table). It was **not** being applied to the question of whether summative deserves its own UX surface. Those are independent questions. Schema can be unified while UX surfaces are split. That is what TG.0D does, and it is consistent with B&W.

So the 5 May framing was correct; what Matt is pushing on now is a different question (surface design), and on that question B&W is silent.

### 3. Teacher cognitive load

**Ms. Okafor, 5 min between periods:**
- Option A: open lesson editor → new lesson → toggle type → fill rubric. Too many clicks. Worse: she's grading what she *already taught*, not creating a new lesson — the affordance is wrong from the start.
- Option B: Tasks panel → Quick check (formative) is the fast lane. Project tasks live in the 5-tab drawer but she doesn't touch that path in 5 minutes.
- Option C: same as B with a three-way chooser; marginal cost.

**Mr. Patel, Sunday backward-design:**
- Option A: mental model nudges him lesson-by-lesson. He picks Lesson 6 and marks it summative. He almost never designs the summative *first*. He's planning forward, not backward, despite intentions.
- Option B: he opens unit planner, sees Tasks panel, hits Project task, the 5-tab drawer walks him through GRASPS → Submission → Rubric → Timeline → Policy. The drawer **is** the scaffold. He can write the summative before any lessons exist, then build lessons that connect via "Builds toward…" chips.
- Option C: he picks the surface upfront. Single-lesson path forfeits the scaffold.

For the **first-year MYP teacher who's never written GRASPS**: only Option B teaches better practice. A and C both let the teacher skip the scaffold by picking the simpler surface — which is exactly what a new MYP teacher will do, repeatedly, until they've calcified the "summative = one lesson with a rubric" habit. That habit is precisely what MYP coordinators spend years trying to undo. Building the product to reinforce it is a teaching anti-pattern.

### 4. Single-lesson vs multi-lesson summatives

Single-lesson summatives are real. A Y8 90-min design pitch. A single SVG laser-cut deliverable. A one-period CAD modelling test.

But the data shape is identical: a task with one linked lesson vs N linked lessons. The teacher's mental model differs (one event vs a project) but the underlying assessment is the same primitive. The question is not "do we need different surfaces?" — it's "do single-lesson summatives need to *feel* like part of the lesson?" That is a presentation question, not an architecture question.

The 5-tab drawer with a "Where does this happen?" picker handles both: default to "this lesson" or auto-create a target lesson for single-lesson; link additional lessons for multi-lesson. Same surface, same scaffold, same data.

A separate "Summative Lesson" surface for the simpler case creates a fork where the easier path avoids the better practice. That's the cost.

### 5. Schema implications

Option A keeps the schema but corrupts the writer path: create lesson → toggle type → create task as side effect. `task_lesson_links` degenerates to a self-pointer. What happens when an Option-A teacher wants to extend a summative across two lessons? Either disallow it (wrong — multi-lesson summatives are real) or bolt on "link additional lessons" — which is exactly TG.0E's "Builds toward…" chip in reverse. You have reinvented Option B with a worse entry point.

Option B's schema is the schema it was designed for. No degeneration.

Option C writes the same schema from two surfaces. Fine, but tasks now have a *creation provenance* that affects rendering. That state has to live somewhere. Adding `task_lesson_links.surface_origin` or similar is exactly the kind of UX-driven schema field that ages badly.

Schema doesn't need to change. But A makes the schema less coherent with writer paths; B keeps them coherent; C splits coherence.

### 6. Sunk cost honesty

TG.0D being built isn't a reason to keep it. If A were right, throw it away — 3–5 days lost is cheap compared to teaching teachers the wrong mental model for years. But A isn't right, so this is moot. Merge TG.0D after smoke.

### 7. Recommendation — Option B′ (B plus three presentation moves)

Keep the locked architecture. Matt's instinct that summatives need stronger presence is real. Deliver it through presentation, not architecture:

- **(a) Lesson menu visual differentiation for linked summatives.** If a lesson has a `task_lesson_links` row pointing at a summative task, the lesson menu row shows the summative icon + colour. Pure presentation, no schema, no writer-path change. Colour + icon together — accessibility ask satisfied without expanding scope.

- **(b) Inline rubric + score inputs on the lesson page for student submission.** When a student opens a lesson that's the submission point for a summative, `/(student)/tasks/[taskId]/submit` doesn't have to be a separate route — render inside the lesson view. Activity blocks remain usable inline (Matt's point). Rubric panel + per-criterion score inputs below the blocks. Locked-after-submit + graded banner work the same. This is TG.0F redesigned, not re-scoped.

- **(c) Single-lesson summative fast path in TG.0D.** Add a "Where does this happen?" field as the first question in the 5-tab drawer: *Across multiple lessons (I'll link them)* / *In one new lesson I'll add now* / *In an existing lesson*. For "one new lesson" the drawer creates the task **and** a target lesson with the right links in one transaction. Kills the "I have to create lesson and task separately" friction without forking the architecture.

That delivers visual prominence + inline rubric + single-lesson smoothness — without inverting the data model or breaking UbD staging.

### Push-back on the four conditions flagged in the prompt

- *"Summative as lesson type" is a pedagogical misframing.* **Yes, confirmed.** UbD stages assessment before lessons explicitly because mixing them produces coverage-teaching. Don't invert this in the product.
- *5 May verdict was correct; Matt is rationalising a UX preference.* **Mostly yes.** The UX preference is real and partly valid (visual prominence + inline rubric), but it doesn't require an architecture change to deliver. B′ delivers it without the inversion.
- *Right answer might be none of A/B/C.* **Close.** The right answer is **B + three presentation moves** — a meaningful enough variant to call it B′.
- *Accessibility is being used as scope creep.* **Yes.** Colour + icon differentiation can be added to any list of items regardless of underlying entity type. The accessibility ask is correct and trivial to satisfy; it does not justify architecture change.

### One concrete next step

Before locking the call, pull up Toddle's actual summative task UX in front of Matt — five minutes screen-sharing. If his mental model is "Toddle's summatives are a kind of LE," that's the rationalisation root and worth surfacing. If Toddle confirms the Tasks-separate-from-LEs pattern (which it does), that's the strongest external validation for B′ you'll get.

Merge TG.0D after smoke. Spec B′'s three presentation moves as TG.0D.1 / TG.0F redesign / TG.0D writer-path-improvement. Don't reopen the schema.

---

## Where the reviewers converged

| Question | Cowork | Gemini |
|---|---|---|
| Industry pattern for summative-as-lesson-type | Unprecedented in major LMS | Not an industry pattern |
| UbD framing | Option A collapses Stages 2 and 3 — anti-pattern UbD was written to fix | Option A nudges assessment-as-Friday rather than evidence-design |
| Black & Wiliam framing | Correctly applied 5 May to schema, silent on UX surface | Formative vs summative are purposes, not species |
| Mr. Patel (backward design) | Stuck — plans forward despite intentions | Stuck immediately, has to create dummy Lesson 6 |
| Ms. Okafor (5 min) | Option B's Quick-Check inline is the fast lane | Option B can be designed for fast 1:1 task-from-timeline |
| Single-lesson summative | N=1 case, same primitive, same surface | N=1 case, same data object, same surface |
| Schema implications | Option A degenerates `task_lesson_links`, reinvents B with worse entry | Option A actively fights the database |
| Sunk cost on TG.0D | Merge after smoke — A isn't right so question is moot | Don't tear up TG.0D — it's correct UbD/IB manifestation |
| One-pick recommendation | **Option B′** = B + three named presentation moves | **Option B** + "the Compromise" view-layer treatment |

Independent confirmation. Same answer. The 5 May verdict stands.

## Where they differed

- **Granularity.** Cowork named three concrete presentation moves (B′ a/b/c) with where each lands in TG.*. Gemini described the same shape less specifically as "view-layer treatment."
- **Where each was sharper.** Cowork on the first-year-MYP-teacher cost ("calcify the wrong habit for years") and on Toddle screen-share as the rationalisation-root check. Gemini on the framing ("confusing choreography with ontology") and on Mr. Patel's *immediate* stuck-ness.
- **What each missed.** Both: I didn't tell them about the active LIS worktree editing the student lesson renderer (collides with B′(b)). Gemini missed the GRASPS-scaffold-skip cost that Cowork raised. Cowork missed the choreography-vs-ontology framing.

These deltas are recorded so future-you can see the seams between two independent reads.
