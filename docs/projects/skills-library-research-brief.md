# Skills Library — Research Brief

**Created:** 23 April 2026
**Status:** DRAFT — seed document for the Skills Library workshop
**Related:** [`skills-library.md`](skills-library.md), [`miniskills.md`](miniskills.md), [`skills-library-spec.md`](../specs/skills-library-spec.md)

---

## 1. The landscape in one paragraph

The school-age "learn a skill, earn a badge" space is a century old (Scouts, 1909; Duke of Edinburgh's Award, 1956) but its digital, school-embedded form is still shaking out. The most mature adult-and-educator model is **Digital Promise** — a rigorous, competency-based framework where every micro-credential has a single competency, a research-citation, an evidence submission, and a public rubric. For school-age students, the two most intellectually serious efforts are **XQ Math Badging** (23 badges that each count for graduation credit, with performance assessment and resubmission) and the **IB MYP Approaches to Learning** framework (five skill categories interwoven across all subjects). For transferable human skills, **CASEL's five competencies** and the **World Economic Forum's Future of Jobs** top-10 converge on the same short list: analytical thinking, creative thinking, resilience, leadership, self-awareness, empathy, curiosity. The **Scouts' merit-badge grammar** is still the gold standard for "clear requirements a teenager can meet" — every requirement uses a strictly-defined verb (*show*, *demonstrate*, *list*, *make*), and scouts must meet the requirement as stated, no more and no less. No single player owns "broad-transferable skills library for secondary, one-lesson-per-skill, badge on competency." That is the space StudioLoom can move into.

## 2. Players worth studying

### Digital Promise Micro-credentials
*Primarily educator-facing but the model transfers.*

**What they do well.** A tight, publicly-documented design pattern: one micro-credential = one competency; every competency is backed by cited research; evidence is submitted against a rubric published upfront; a subject-matter expert assesses. Learners know exactly what they're being judged on before they start.

**What to steal.**
- Single-competency rule — no "bundle of related skills" hand-waving.
- Rubric published before the student submits. The evidence criterion *is* the skill definition.
- Separate "method backed by research" field on every card — forces the author to explain *why* this is a real skill.

### Scouts (Scouting America + international scouting)
*135+ merit badges, each with a pamphlet written by a topic authority.*

**What they do well.** Requirement language is strict and observable. Verbs have fixed meanings (*show*, *demonstrate*, *make*, *list*, *in the field*, *collect and identify*). A scout meets each requirement "as stated — no more and no less." The pamphlet format separates *introduction* (why this matters) from *requirements* (what to do) from *reference* (how to learn it).

**What to steal.**
- Controlled verb vocabulary on demo-of-competency lines. "Demonstrate" ≠ "describe."
- Required vs. elective split. Eagle requires 13 specific badges; the rest are choice. StudioLoom can mirror this: a small set are pre-requisites for a unit type, the rest are elective for the strength radar chart.
- Authored pamphlet per badge — a constrained format (intro / requirements / reference) is more useful than free-form.

### Duke of Edinburgh's Award (DofE) — Skills Section
*Bronze / Silver / Gold, 3–18 months of commitment, ~1 hour/week outside school.*

**What they do well.** Progressive tiers that reward *sustained practice* rather than test-taking. Bronze-Silver-Gold is a century-old ladder students and parents understand instantly. Skills section explicitly excludes physical and paid activities — forces the skill to be a *learnable interest*, not a hobby that was already happening.

**What to steal.**
- Bronze / Silver / Gold tier naming — don't invent new words. Parents already know what Gold means.
- Each tier demands more time *and* demonstration of broader expertise, not just more hours.
- An external assessor per activity. StudioLoom's equivalent is the teacher sign-off on the demo-of-competency — don't let the quiz be the only gate.

### IB MYP Approaches to Learning (ATL)
*Five categories: Thinking, Research, Social, Communication, Self-Management.*

**What they do well.** A clean five-category taxonomy that is subject-agnostic and already the vocabulary of most international schools. Every MYP unit must identify which ATL skills it develops — skills are embedded in units, not taught as a separate stream.

**What to steal.**
- The five ATL categories map almost perfectly onto the broad-skills the user listed (presenting = Communication; leadership = Social; finance/PM = Self-Management + Thinking). Keep the same top-level grouping so MYP teachers get it for free.
- Skills surface *inside* a unit's summative task, not as a separate activity. The StudioLoom equivalent is surfacing skill cards inside Stone prereqs, not as a side-library.

### CASEL 5 (Collaborative for Academic, Social, and Emotional Learning)
*Self-awareness, self-management, social awareness, relationship skills, responsible decision-making.*

**What they do well.** The research-backbone for every "soft skill" curriculum in US schools. Framework is systemic — it expects SEL to be in the curriculum, the school culture, and the home.

**What to steal.**
- Use CASEL's language for the self-management and collaboration domains verbatim. It's defensible to parents and administrators.
- The *systemic* framing is a useful reminder: skill cards that sit in a library unused won't move the needle. The cards need to be *pulled into* the student's journey at the moment they are needed (Open Studio capability-gap, Stone prereq, teacher assignment).

### XQ Math Badging
*23 badges, each counts for graduation credit, piloting in Kentucky/Idaho/Illinois/BIE schools.*

**What they do well.** Performance assessment as a required component. Students submit artifacts of their work. Feedback-and-resubmission loop is baked in — students are expected to revise and resubmit. Low-floor-high-ceiling: as few prerequisites as possible per badge.

**What to steal.**
- *Resubmission is a feature, not a failure.* The StudioLoom `skill.quiz_failed` → `skill.quiz_passed` event transition should be frictionless and positively framed.
- Performance assessment > quiz. For the Silver/Gold tiers especially, the demo-of-competency should be "show me a thing you made" not "answer these questions."
- Low-prereq graph. A flat badge graph beats a deep tree — students don't want to grind 5 prereqs to get to the one they care about.

### Khan Academy — Mastery Levels
*Attempted → Familiar (70–85%) → Proficient (100% on exercise/quiz) → Mastered (100% on Unit Test/Course Challenge).*

**What they do well.** A four-level state model with clear promotion rules. Spaced repetition and spiralling are baked in — skills decay if untouched. Mastery is *testing-based*, not instructor-sign-off.

**What to steal.**
- Four states, not two. "Done / not done" hides the learning. StudioLoom's state ladder (viewed → quiz_passed → demonstrated → mastered) is already richer than Khan's — keep it.
- Spaced repetition = freshness. The Skills Library spec's 90/180-day freshness bands already do this. Keep the radar chart fade-on-stale behaviour.
- *Avoid the Khan trap:* Khan's mastery is defined by quiz performance alone. StudioLoom should require *demonstration* for Proficient+, not just quiz scores — lesson from Digital Promise.

### Project Zero — Studio Habits of Mind & Thinking Routines
*Eight habits (Develop Craft, Engage & Persist, Envision, Express, Observe, Reflect, Stretch & Explore, Understand Art Worlds) + a library of short thinking routines.*

**What they do well.** Research-grounded, art-studio-origin, maps beautifully onto design education. Thinking routines are *short, transferable mini-strategies* — exactly the right grain-size for StudioLoom skill cards. The eight habits are what *world-class designers* actually do, observed in the wild, not a framework someone made up at a desk.

**What to steal.**
- Several of the eight habits deserve to be first-class StudioLoom skills: *Observe*, *Envision*, *Reflect*, *Stretch & Explore*. These are higher-order than "can you use a mind map" but authorable as cards.
- The *thinking routine* format — a named 3–6 step prompt — is a superb alternative to "watch a video, take a quiz." Routines are gradeable-by-observation and repeatable.

### World Economic Forum — Future of Jobs 2025 (adjacency check)
*Top core skills: analytical thinking, resilience, leadership, creative thinking, self-awareness, tech literacy, empathy, curiosity, talent management, service orientation.*

**What they do well.** Not a school system but a defensible external anchor for *why these skills*. When a parent asks "why is my kid learning about project management instead of more algebra?" the WEF list is a one-page answer.

**What to steal.**
- Use the top-10 list as a *coverage check*. Every skill in the library should map to at least one of these (or to a subject-specific skill like 3D printing, which doesn't need WEF backing). If nothing in the library touches "resilience" or "empathy," you have a gap.

## 3. What these players tell us — distilled design principles

1. **One card = one competency.** No bundles. Every card has a single, testable thing a student can do. *(Digital Promise, XQ)*
2. **Verbs are sacred.** The demo-of-competency uses a strict verb: *show, demonstrate, produce, explain, argue, identify.* Each verb has a fixed meaning across the library. *(Scouts)*
3. **Tiers: Bronze / Silver / Gold.** Don't invent new tier names. Parents, schools, and the DofE have primed the vocabulary for 70 years. *(DofE)*
4. **Demonstration beats quiz.** Quiz gates Bronze; demonstration gates Silver; applied-in-Stone-project gates Gold. *(Digital Promise, XQ, critique of Khan)*
5. **Resubmission is a feature.** Failing a quiz is a stepping-stone, not a penalty. The UI frames re-takes as "refine & retry." *(XQ)*
6. **Freshness matters.** A skill earned in Year 7 and never touched by Year 11 is not *mastered* in any meaningful sense. Fade the radar. *(Khan spaced repetition, DofE 'ongoing commitment')*
7. **Five-category top level.** Thinking / Research / Social / Communication / Self-Management maps onto MYP ATL, CASEL, and the WEF list. Use this as the *meta* taxonomy even if the visible domains are more specific. *(IB ATL, CASEL)*
8. **Cards are pulled, not pushed.** A skill card that a student has to go looking for is inert. The card needs to *arrive* at the moment of need — in a Stone prereq, a crit-board pin, an Open Studio capability gap. *(CASEL systemic principle, Skills Library spec §1)*

## 4. Concrete design moves for the StudioLoom library

1. **Adopt Bronze / Silver / Gold tiering.** 2 skills per tier per domain, 60 cards total. A domain's Gold skill is authored to *build on* its Silver skill.
2. **Controlled verb list on the demo-of-competency field.** Canonical set: `show`, `demonstrate`, `produce`, `explain`, `argue`, `identify`, `compare`, `sketch`, `make`, `plan`. Ban "understand" and "know about" — they are unverifiable.
3. **Three-field card front matter per skill:** `evidence_criterion` (one sentence, uses a controlled verb), `quiz_seeds` (3–5 question concepts), `applied_in` (which Stones / unit types consume it).
4. **Skill state = promotion, not binary.** Keep the existing 5-state ladder (viewed / quiz_passed / demonstrated / applied / mastered) — it is already richer than Khan's. Make sure the *UI* shows the gap between states as concrete next actions, not as a mystery.
5. **Every Silver and Gold card requires a demonstrable artifact.** A photo, a sketch, a sound recording, a 30-second video, a filled-in template. This is the Digital Promise + XQ move. The artifact lives in the student's portfolio; the teacher sign-off is the gate.
6. **Map every card to a WEF / CASEL / ATL anchor** in a `frameworks` field. Makes the library defensible to parents and admin in under a minute. Also enables the strength-radar chart to aggregate by framework category, not just StudioLoom domain.
7. **Ship a "thinking routine" card format for higher-order skills.** *Observe*, *Reflect*, *Stretch & Explore* (Project Zero) do not fit a quiz-based card. Author them as *named routines* — a 3–6 step prompt that the student runs on their own work and submits the filled-in worksheet. This is a second card sub-type alongside the standard lesson+quiz format.
8. **Link-check from day one.** External references rot. The Skills Library spec already calls for this — hold the line. Scouts spend considerable effort maintaining pamphlets; StudioLoom can automate the equivalent.

## 5. Open questions

1. **Badge vs. skill — are they the same thing?** Scouts' merit badges = one-shot achievements. DofE Skills section = sustained commitment. StudioLoom's spec leans toward the Scouts model (earn-once, freshness-decays). Sanity-check this against how Open Studio will consume the library.
2. **Teacher sign-off workflow for demonstrations.** The spec says mastery is derived from Stone completions — but what about Silver-tier demos that are *not* in a Stone (a presenting skill demo'd in Service unit)? Needs a lightweight "teacher ack" path.
3. **Age-appropriate language.** The Gold-tier skills (e.g. *Evaluating a Business Model Canvas*, *Designing a Survey*) are genuinely Y11+ territory. Does the library hide Gold cards from younger students or let them self-challenge? Recommend: show, but warn "usually attempted at Y11+."
4. **Re-issuing a badge when the skill evolves.** If the *3D Printing Workflow* card is v1 in 2026 and v2 in 2028, do students who earned v1 need to re-demo? Scouts handle this by dating the earn; XQ handles it by allowing resubmission. Simplest answer: earns are immutable, freshness is the reminder.
5. **Library governance.** Who decides what becomes a Gold skill? v1: Matt. v2+: needs a teacher council or a pull-request-style review. Consider the Scouts pamphlet-authority model — one subject expert owns the content for each card.
6. **Cross-school sharing as moat.** The spec already frames this as strategic — worth pressure-testing. Scouts' merit-badge library is shared across every troop globally because there is only one Scouting America. StudioLoom's libraries will diverge unless there is a forcing function. Consider a *core set* (60 cards, StudioLoom-owned, every school gets) and a *local set* (teacher-authored, school-owned).

## Sources

- [Digital Promise Micro-credentials framework](https://digitalpromise.org/initiative/micro-credentials/)
- [Evaluating Micro-credentials for Quality — Digital Promise (2025)](https://digitalpromise.org/2025/08/19/evaluating-micro-credentials-for-quality-what-to-look-for/)
- [Scouting America — Merit Badges](https://www.scouting.org/skills/merit-badges/)
- [Merit Badge Requirements (US Scouts)](http://www.usscouts.org/mb/mbindex.asp)
- [Duke of Edinburgh Award — Skills Section](https://www.dofe.org/do/sections/)
- [Summary of DofE Award Requirements](https://www.dukeofed.org/wp-content/uploads/2024/08/Summary-of-Award-Requirements.pdf)
- [IB MYP Approaches to Learning — Toddle guide](https://www.toddleapp.com/learn/blog-post/your-guide-to-approaches-to-learning-skills-in-the-myp/)
- [MYP ATL skills framework appendix](http://romyp.weebly.com/uploads/8/9/0/1/89012760/approachest_to_learning_skills_list.pdf)
- [CASEL Framework — What is the CASEL Framework?](https://casel.org/fundamentals-of-sel/what-is-the-casel-framework/)
- [CASEL SEL Framework 2020](https://casel.org/casel-sel-framework-11-2020/)
- [XQ Math Badging Initiative](https://xqsuperschool.org/resource/xq-math-badging-initiative/)
- [Illinois Math Badging — Education Systems NIU](https://edsystemsniu.org/illinois-math-badges-initiative/)
- [Khan Academy Mastery Levels](https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work)
- [Project Zero — Eight Studio Habits of Mind](https://pz.harvard.edu/resources/eight-habits-of-mind)
- [Project Zero — Thinking Routines](https://pz.harvard.edu/thinking-routines)
- [WEF Future of Jobs Report 2025 — Skills Outlook](https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/)
- [IES REL — Identifying Evidence on Micro-Credentials for Students](https://ies.ed.gov/rel-central/2025/01/identifying-evidence-micro-credentials-students)
