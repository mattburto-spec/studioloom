# Project: ELL — Language Support for Multilingual Learners

**Goal:** Make StudioLoom genuinely usable by students across the full range of English proficiency, without forcing teachers to build "the ELL version." Every lesson should be *one lesson* to the teacher, but render with per-student language scaffolding based on each student's English level.

**Status:** 💡 IDEA / 🔬 RESEARCH — captured 10 April 2026
**Priority:** P1 (international school context — Matt teaches in China, ELL is table stakes)
**Doc:** `docs/projects/ell.md`

---

## Why this matters now

- Matt teaches in an international school in China. A large share of students are multilingual learners working in English as an additional language.
- StudioLoom *already* stores an `ell_level` field on `students` (and a class override), but nothing downstream reads it yet. Data is collected and unused — see [`inclusive.md`](inclusive.md) gap analysis.
- Design & Technology units are text-heavy (briefs, research, rubrics, criteria language, mentor dialogue, toolkit prompts, Kit/Sage/Spark mentor voice, Open Studio check-ins). A student with lower English proficiency currently hits the same wall of text as a native speaker.
- Language access is not a cosmetic feature — it gates whether a student can even *engage* with the design cycle. It sits upstream of every other student-facing system.
- This is also a competitive moat in the international schools market (Toddle, FlashAcademy, etc. address it; StudioLoom currently doesn't).

## What already exists in StudioLoom

| Asset | Where | State |
|---|---|---|
| `students.ell_level` field + class override | student record | Stored, **not read anywhere** |
| Learning profile + `ClassCohortContext` | student/class | Collected |
| AI prompt context injection | `src/lib/ai/prompts.ts` | Could receive ELL level |
| Workshop Model timing (usable time, 1+age rule) | `timing-validation.ts` | Doesn't currently flex for ELL cognitive load |
| Framework-agnostic content model | Activity Blocks | Good seam — language variants are presentation, not content |
| MonitoredTextarea | integrity pipeline | Could distinguish "struggling with language" from "struggling with thinking" |
| Student Learning Profile | Discovery Engine | Could include language-aware profiling |

Gap: no re-leveling, no translation, no chunking, no sentence frames, no word banks, no glossary, no read-aloud, no teacher visibility into which scaffolds each student is receiving.

---

## Research — Medley Learning

Matt flagged Medley as "supposedly doing very cool things around how students can access content in different ways depending on their language level." Findings (surface-level — needs deeper investigation):

**What Medley is**
- Browser extension that sits on the student device and scaffolds *any* classroom content — assigned reading, teacher-generated assignments, student research, digital textbooks. Not a walled garden; it wraps whatever the class is already using.
- Target: secondary multilingual learners in general-ed classrooms (i.e. MLs who spend most of their day alongside native-English peers, not in a dedicated ELD block).

**How it scaffolds (features)**
- **Click-any-word** → student-friendly definition + visual + audio + in-context example that matches the *usage* in the surrounding text (not a generic dictionary).
- **Re-leveling** — rewrites the same text at different English proficiency levels.
- **Automatic chunking** — inserts headers and breaks long passages into digestible sections.
- **In-context definitions** — inline, not a separate glossary lookup.
- **Side-by-side translation** into the student's home language.
- **Read-aloud** — text-to-speech of the re-leveled version.
- **Sentence frames** for students with lower proficiency ("I think ___ because ___"), fading to lighter **sentence stems** as proficiency grows, fading to nothing.
- **Word banks** that match the current task.

**How it decides how much support to give**
- Per-student English proficiency level drives the scaffold depth. Explicit goal: *avoid over-scaffolding* — a more proficient student sees less.
- Teachers can adjust support levels per individual student (manual override on top of the automatic setting).
- Strategically leverages the student's **home language** rather than treating it as a deficit.

**Positioning**
- Same grade-level content, not a dumbed-down parallel track. The quality of the instructional material is preserved; only the *access* adapts.
- Solves the "ML in gen-ed" problem where the content teacher isn't an ELD specialist.

**Sources**
- [Medley Learning — homepage](https://www.medleylearning.com/) *(note: direct fetch blocked from this environment, info from search summary)*
- [Medley Learning — Research](https://www.medleylearning.com/research)
- Comparator context: [Edmentum Multilingual Support](https://www.edmentum.com/solutions/multilingual-access/), [Subject.com Multilingual](https://subject.com/multilingual), [FlashAcademy — EAL/ELL tool for international schools](https://flashacademy.com/blogs/eal-tool-for-international-schools/)

**Open questions about Medley (for deeper research)**
- Does re-leveling happen at ingestion or on-the-fly per student? Caching model?
- What proficiency scale do they use (WIDA, CEFR, custom)?
- How are definitions + visuals generated — model pipeline vs curated?
- Is the browser extension a clue that they *don't* own the content model, and StudioLoom's advantage is that we *do* (so we can embed scaffolds into the content at generation time, not bolt them on)?
- How do they handle assessment — is a re-leveled rubric still "the same" rubric?
- Pricing / distribution — direct to schools, via districts, free tier?

---

## What StudioLoom could do (first-pass design space)

StudioLoom has one structural advantage over a browser extension: we **own the content pipeline end-to-end**. Dimensions3 generates units, Activity Blocks are first-class SQL entities, and every piece of student-facing text passes through our prompts. We can embed language scaffolding *inside* the content model rather than wrapping it at render time.

Candidate capabilities (brainstorm, not a build plan):

1. **ELL-aware content variants on Activity Blocks** — every block has a canonical version plus on-demand re-leveled variants (e.g. 3 tiers mapped to WIDA/CEFR). Generated once, cached, served per student.
2. **Inline glossary + click-any-word** — any student-facing surface (unit brief, criteria, toolkit prompts, mentor dialogue) supports click-to-define with context-aware definitions and visuals. Uses Design Teaching Corpus vocabulary so definitions are *subject-appropriate* (e.g. "iteration" in a design context, not a generic one).
3. **Home-language side-panel** — teacher-configurable set of supported languages per class. Side-by-side translation on demand, never a replacement for the English view.
4. **Sentence frames / stems / word banks baked into toolkit tools** — SCAMPER, Empathy Map, Five Whys etc. adapt their input affordances to student ELL level. High support = frames, mid = stems, high proficiency = empty box. Framework defined in `education-ai-patterns.md` is the natural place to add this as a 6th pattern.
5. **Read-aloud on every student-facing text** — cheap win, accessibility crossover with `inclusive.md`.
6. **Mentor voice adaptation (Kit/Sage/Spark, Designer Mentors)** — mentor language complexity scales with student ELL level the same way tone currently adapts to difficulty hints. Extends existing Open Studio prompt seams.
7. **Integrity signal separation** — MonitoredTextarea should distinguish "paused because stuck on idea" from "paused because stuck on word." Writing playback + ELL level = different teacher alert.
8. **Teacher visibility** — per-student view showing which scaffolds are active, with one-click override. Same ergonomic model as `inclusive.md`: teacher sees one lesson, each student sees their version.
9. **Generation-time language lens** — Dimensions3 generation pipeline takes `ClassCohortContext.ell_distribution` as an input and produces content that is *naturally* accessible at the class's typical proficiency level, before per-student re-leveling even kicks in. "Write the brief so the median student in this class can read it."
10. **Assessment language separation** — criterion language and assessment artefacts are re-leveled *but never reweighted*. A student writing in their home language in a reflection is not penalised on design thinking, only on the communication criterion (and even then, teacher-configurable).

## Relationships to existing projects / systems

- **[`inclusive.md`](inclusive.md)** — deeply overlapping. `inclusive.md` covers ADHD/dyslexia/anxiety/autism/dyscalculia; ELL is a sibling axis. Shared infrastructure (per-student content adaptation, teacher one-click overrides, AI tone layer). Strong case to treat inclusive + ELL as one *Per-Student Rendering Layer* epic.
- **[`i18n.md`](i18n.md)** — different problem. i18n is *interface* localisation (menus, buttons). ELL is *content* language access. Related but not the same; ELL should not be blocked on i18n.
- **Dimensions3 generation pipeline** — need a `languageContext` input on `GenerationRequest`. Re-levelled variants are likely a new pipeline stage (post-polish) or a new pass in the ingestion pipeline.
- **Activity Block Library** — re-levelled variants live on the block. Needs schema change (block_language_variants table, or JSONB column).
- **Student Learning Profile** — add proficiency tracking that updates over time (not just a static `ell_level`). Research foundation: `docs/research/student-influence-factors.md` already has linguistic factors.
- **Journey Engine** — journeys need a language-level field so the Discovery Engine and Open Studio planning journeys scaffold appropriately.
- **Toolkit tools** — all 27 interactive tools need sentence frame / word bank support surfaces. Touches the pattern library in `education-ai-patterns.md`.
- **Designer Mentor System** — mentor language complexity must flex by student ELL level.
- **AI Safety & Content Guardrails** — distress detection must not misfire on language-struggle signals. Content filters must work across supported home languages.
- **MonitoredTextarea** — integrity scoring needs an ELL-aware mode.

## Risks & unknowns

- **Translation quality for subject-specific design vocabulary** — generic MT is bad at "iteration," "affordance," "prototype fidelity." Need the Design Teaching Corpus to seed a subject glossary per supported language.
- **Cost** — re-levelling every block at every tier at generation time is expensive. Lazy on-demand + cache is probably the right model.
- **Which proficiency scale?** Likely WIDA (US) and/or CEFR (international schools). Matt's school context → probably CEFR first.
- **Identity & wellbeing** — students should never feel they're on "the dumb track." UX must make the scaffolding invisible and student-adjustable. See `student-influence-factors.md`.
- **Teacher authoring** — when a teacher writes their own block, do we re-level it automatically, prompt them, or leave it alone?
- **Reading age ≠ ELL level** — a student can be a strong thinker with low English. Frame this as *language access*, not *cognitive load*.

## Next steps (research, not build)

1. Deeper Medley research — request a demo or detailed walkthrough. Specifically investigate their re-leveling model, proficiency scale, and per-student adjustment UX.
2. Survey WIDA vs CEFR — pick one as the canonical scale for StudioLoom (likely CEFR).
3. Audit every student-facing text surface in StudioLoom and classify by language-load risk (unit brief, criteria, mentor dialogue, toolkit prompts, gallery feedback, Open Studio checkin, grading feedback, integrity alerts, Kit dialogue, etc.).
4. Decide whether ELL is a standalone project or merges into `inclusive.md` as the *Per-Student Rendering Layer*.
5. Design spike: what does a single re-levelled Activity Block look like in the DB? Schema sketch.
6. Revisit after Dimensions3 is live so language variants can ride on the same pipeline.

---

*This project was captured because Matt said ELL is "something I need to have language support" and flagged Medley as the thing to research. No build commitment yet — this doc exists so the idea and the Medley research don't get lost.*
