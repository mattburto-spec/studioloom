# Project: Inclusive

**Goal:** Make StudioLoom genuinely useful for students with learning difficulties — ADHD, dyslexia, anxiety, autism, dyscalculia — without creating any extra work for teachers.

**Core principle:** Everything is automatic or one-click. Teachers don't build "the accessible version" — every lesson IS the accessible version, adapted per student by AI. The teacher sees one lesson. Each student sees their version of it.

**Status:** Planned (29 Mar 2026)
**Estimated total:** ~18-24 hours across 5 phases
**Project file:** `docs/projects/inclusive.md`

---

## What Already Exists

StudioLoom has more inclusive infrastructure than most edtech platforms already:

| Feature | Where | Status |
|---------|-------|--------|
| Learning profile (ADHD, dyslexia, anxiety, autism, dyscalculia) | `StudentIntakeSurvey.tsx` → `students.learning_profile` | Collected, stored |
| AI mentor tone adaptation per difficulty | Open Studio check-ins + Design Assistant | Built (non-critical hints) |
| Workshop Model cognitive load validation | `timing-validation.ts` — 8 rules, 1+age cap | Enforced on all lessons |
| Age-based scaffolding guidance | `prompts.ts` — profiles for ages 11-18 | In all generation prompts |
| 3 mentor personalities (student choice) | `mentors.ts` — Kit/Sage/Spark | Complete |
| 4 visual themes (student choice) | `themes.ts` — Clean/Bold/Warm/Dark | Complete |
| ELL level field on student record | `students.ell_level` + class override | Stored, not yet used |
| Teacher class profile overview | `ClassProfileOverview.tsx` | Shows aggregate learning needs |

**Gap:** Data is collected and AI hints exist, but there's no systematic per-student content adaptation, no cognitive load scoring of generated content, no UDL options, and no accessibility features beyond AI tone changes.

---

## Phase 1: Cognitive Load Scorer (~3-4 hrs)

Automatically analyse every generated lesson for cognitive demands. This runs silently during generation — teacher sees a small indicator, student sees nothing (adaptations happen in later phases).

### What to build
- **`analyzeCognitiveLoad(page: PageContent): CognitiveLoadReport`** — pure function that scores a lesson page across 5 dimensions:
  1. **Reading load** — Flesch-Kincaid grade level of all text content (instructions, scaffolding, activity descriptions). Flag if >2 grades above target age.
  2. **Working memory demand** — count of simultaneous variables/steps per activity. Multi-step tasks without checkpoints = high load.
  3. **Task switching frequency** — how many times the student must change mode (read→write→draw→discuss) without a transition.
  4. **Sustained attention required** — longest unbroken task duration. Flag if >1+age minutes without a checkpoint.
  5. **Abstract vs concrete ratio** — proportion of activities requiring abstract reasoning (analysis, evaluation, synthesis) vs concrete (making, drawing, sorting).

- **Overall score:** 1-5 (1=very accessible, 5=very demanding). Computed as weighted average.
- **Per-activity flags:** each activity gets a load badge (🟢 low / 🟡 medium / 🔴 high).
- **Auto-suggestions:** "This lesson has 3 consecutive high-load activities — consider adding a movement break" (shown to teacher only, in lesson editor sidebar).

### Where it runs
- Post-generation validation (alongside timing validation) — auto-runs on every generated lesson
- Lesson editor sidebar — live cognitive load indicator updates as teacher edits
- NOT visible to students

### Key files
- New: `src/lib/ai/cognitive-load.ts`
- Modify: generation routes (add `analyzeCognitiveLoad()` call after `validateLessonTiming()`)
- Modify: lesson editor sidebar (add CognitiveLoadIndicator component)

---

## Phase 2: Auto-Adaptive Content Layer (~5-6 hrs)

The big one. When a student with learning difficulties loads a lesson page, the content automatically adapts based on their profile. Zero teacher work — the AI does it at render time (cached per student per page).

### Adaptations by learning difference

**ADHD:**
- Break long text blocks into smaller chunks (max 3 sentences per block)
- Add micro-checkpoints ("✓ Done? Move to the next part") between activities
- Highlight the ONE thing to focus on right now (dim surrounding content)
- Shorter activity descriptions (AI rewrites verbose instructions to be punchier)
- Timer visibility — show time remaining prominently (already in Workshop Model)
- Movement break suggestions between high-cognitive activities

**Dyslexia:**
- OpenDyslexic font toggle (CSS custom property `--st-font-family`, opt-in via settings)
- Increased line spacing (1.8 instead of 1.5)
- Left-aligned text only (no justified)
- Shorter sentences in instructions (AI rewrites to <15 words per sentence)
- Key terms highlighted with definitions on hover/tap
- No italics (harder to read with dyslexia) — use bold or colour instead

**Anxiety:**
- Remove or soften time pressure language ("You have X minutes" → "Take the time you need")
- Hide countdown timers by default (student can opt to show)
- Reframe error language ("Try again" → "Here's another way to think about it")
- Add "It's OK to..." reassurance micro-copy at activity transitions
- Reduce visible completion metrics (don't show "3/12 activities done" prominently)

**Autism:**
- Explicit step numbering (never assume sequence is obvious)
- Concrete examples for every abstract instruction
- Visual schedules — show what happens in what order before starting
- Sensory warnings for activities involving loud sounds, group work, or physical movement
- Literal language in all instructions (no idioms, metaphors, or ambiguous phrasing)
- Clear "done" criteria per activity (what does "finished" look like)

**Dyscalculia:**
- Visual representations alongside any numerical data
- Avoid number-heavy instructions where a visual alternative exists
- Estimation scaffolding ("about how many?" before exact counting)
- Calculator/tool prompts when numbers are involved

### Architecture
- **`src/lib/inclusive/adapt-content.ts`** — pure function: `adaptContentForStudent(page, learningProfile): AdaptedPage`
- Runs server-side at page load (not client-side — prevents layout shift)
- Results cached in memory (student_id + page_id + profile_hash → adapted content)
- Cache invalidates when: teacher edits content, student updates profile
- Adaptations are additive (never removes content, only restructures/supplements)
- Original content always accessible via "Show original" toggle

### API
- Modify: `src/app/api/student/unit/route.ts` — after content resolution, run adaptation if student has learning_differences
- New: `src/lib/inclusive/adaptations/` — per-difficulty adaptation functions (adhd.ts, dyslexia.ts, anxiety.ts, autism.ts, dyscalculia.ts)

---

## Phase 3: UDL Lesson Editor Blocks (~4-5 hrs)

Universal Design for Learning says: provide multiple means of engagement, representation, and action/expression. Rather than making teachers build 3 versions of every activity, add smart UDL blocks that auto-generate alternatives.

### New activity block types (lesson editor)

1. **"Same Task, Your Way" block** — teacher writes ONE activity. AI generates 3 UDL variants:
   - **Read it** (text instructions, step-by-step)
   - **See it** (visual diagram/flowchart of the same task)
   - **Hear it** (simplified audio-friendly version — shorter sentences, conversational tone)
   - Student picks which version to start with. Can switch anytime. All lead to the same response input.
   - Teacher effort: zero (just use the block type instead of a regular activity block)

2. **"Check Your Understanding" block** — quick comprehension check after a mini-lesson:
   - AI generates 3 difficulty levels from the same content
   - Student gets the level matching their profile confidence (auto-selected, can override)
   - NOT graded — purely for self-checking. Reduces anxiety.

3. **"Worked Example" block** — teacher provides a model/exemplar:
   - AI annotates it with thought-process callouts ("Notice how the designer started with...")
   - For dyslexia: key annotations are highlighted, font adjusted
   - For ADHD: annotations appear one at a time (progressive reveal)
   - For autism: annotations are explicit and literal

4. **"Break" block** — 2-minute movement/mindfulness micro-break:
   - Teacher drops it between high-cognitive activities
   - 3 options auto-rotate: stretch, breathing, doodle prompt
   - Can be auto-inserted by cognitive load scorer (Phase 1) when load >4

### Implementation
- New block types in `ActivityBlockAdd.tsx` template list
- Each block type has a `renderForStudent()` that checks learning profile
- AI generation happens once at lesson save (not per-student-load — too slow)
- Variants stored alongside original in `content_data`

---

## Phase 4: Accessibility Settings Panel (~2-3 hrs)

Student-controlled accessibility options. Available from settings cog (same place as mentor/theme).

### Settings
- **Font:** Default / OpenDyslexic / Large text
- **Spacing:** Normal / Relaxed (increased line-height, paragraph spacing)
- **Motion:** Full / Reduced (respects `prefers-reduced-motion`, disables Framer Motion animations)
- **Timers:** Show / Hide (hides countdown timers, replaces with gentle progress indicators)
- **Reading guide:** Off / Line highlight (translucent bar follows cursor/focus)
- **Colour overlay:** None / Yellow / Blue / Pink / Green (tinted overlay for visual stress, stored as CSS filter)
- **Audio descriptions:** Off / On (text-to-speech for activity instructions via Web Speech API)

### Implementation
- New: `src/lib/student/accessibility.ts` — settings type + defaults
- New column: `students.accessibility_settings JSONB`
- Applied via CSS custom properties on student layout (same pattern as themes)
- Some settings auto-suggested based on learning profile (dyslexia → suggest OpenDyslexic + relaxed spacing) but NEVER auto-applied without student consent

---

## Phase 5: Teacher Intelligence — Class Needs Dashboard (~3-4 hrs)

Upgrade `ClassProfileOverview` from a static summary to an actionable intelligence panel.

### What to show
- **Cognitive load heatmap** — per-lesson load scores across the unit, coloured cells showing where the hard lessons are
- **Accommodation summary** — "5 students have ADHD adaptations active, 2 have dyslexia settings, 1 has anxiety adaptations"
- **Auto-suggestions** — "Lesson 4 has cognitive load 4.8/5 — consider adding a break block before the evaluation activity"
- **Engagement signals** — students with learning difficulties who are falling behind (response rates, time-on-task relative to their baseline, not absolute)

### What NOT to show
- Individual student difficulties (teacher already knows from ClassProfileOverview)
- Comparison between students with/without difficulties (harmful framing)
- Any data that could be used to lower expectations

### Key principle
Teacher sees "here's how to make your lesson better for everyone" — not "here are your special needs students." Universal improvements benefit ALL students. The cognitive load heatmap helps every student, not just those with identified difficulties.

---

## What Makes This Stand Out

1. **Zero teacher work** — no "create accessible version" workflow. Every lesson auto-adapts.
2. **Student agency** — students control their own settings (font, spacing, timers, overlay). Nothing is imposed.
3. **AI does the heavy lifting** — content adaptation, variant generation, cognitive load scoring all happen automatically.
4. **Privacy-first** — learning differences never shown to peers. Adaptations are invisible to other students.
5. **Research-backed** — cognitive load theory, UDL framework, CAST guidelines, dyslexia research (British Dyslexia Association style guide).
6. **Not a bolt-on** — adaptations are woven into the existing content pipeline, not a separate "accessible mode."

### Competitive advantage
- **MagicSchool AI:** No student-level adaptation at all. Teacher-facing only.
- **Khanmigo:** Basic difficulty adjustment but no learning-difference-specific adaptations.
- **Curipod:** No accessibility features beyond standard web compliance.
- **ManageBac/Toddle:** No AI adaptation. Manual IEP tracking only.

StudioLoom would be the first edtech platform where the AI automatically restructures lesson content based on individual student learning profiles, with zero additional teacher effort.

---

## Dependencies
- Learning profile intake survey (✓ exists)
- Workshop Model timing validation (✓ exists)
- Content resolution chain (✓ exists — adaptations slot in after fork resolution)
- Lesson editor block system (✓ exists — add new block types)
- Student settings system (✓ exists — extend with accessibility options)

## Risks
- **Performance:** Per-student content adaptation at page load could be slow. Mitigate with caching + pre-computation at lesson save time.
- **AI quality:** Auto-generated UDL variants may not be pedagogically sound. Mitigate with teacher review option + quality scoring.
- **Scope creep:** Accessibility is a deep field. Mitigate with strict phase gating — each phase is independently useful.
- **Over-adaptation:** Too many changes could make content feel patronising. Mitigate with student control (they choose what helps) and "Show original" escape hatch.

---

## Execution Order

| Priority | Phase | Est | Why first |
|----------|-------|-----|-----------|
| P0 | Phase 4: Accessibility Settings | 2-3 hrs | Quickest win, visible to students immediately |
| P1 | Phase 1: Cognitive Load Scorer | 3-4 hrs | Foundation for everything else |
| P2 | Phase 2: Auto-Adaptive Content | 5-6 hrs | The headline feature |
| P3 | Phase 3: UDL Lesson Editor Blocks | 4-5 hrs | Teacher-facing additions |
| P4 | Phase 5: Teacher Intelligence | 3-4 hrs | Polish layer |
