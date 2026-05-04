# Lesson Content Style Guide

**Status:** v2 draft — supersedes v1. Establishes baseline standards for activity prompts, lesson intros, and supporting content. Apply to all new units; retro-apply when units are revisited.

**Why this exists:** AI generation + 13 months of ad-hoc edits produced units where prompts were walls of text mixing inconsistent markdown, oversized tables, and packed multi-task instructions into single activities. Students see less than the editor implies because the renderer drops headings and tables silently. This guide is the contract that keeps content readable, scannable, accessible, and consistent — for students reading the lesson, for the AI generation pipeline producing new lessons, and for international-school procurement audits that increasingly check WCAG 2.1 AA conformance.

**What changed v1→v2:** added reading-time + Lexile guidance per year band; split renderer constraints into FIX (renderer-v2 backlog) vs LIVE WITH (kept dropped on purpose); added accessibility & inclusivity section; clarified scaffolding-tab vs activity-prompt boundary using Mayer's contiguity principle; added media-use guidance grounded in Mayer's multimedia principles; named the AI tutor "guide don't tell" rule.

---

## Audience: who is reading this?

StudioLoom serves students aged 11-18 across IB MYP, GCSE, A-Level, IGCSE, ACARA, and PLTW, with a heavy international-school user base. Authors must write for that range, and most readers are not native English speakers.

- **Year 7-8 (ages 11-13):** Lexile 700-1010L target. Reading speed 100-150 wpm if ESL, 150-200 wpm native. A 200-word prompt = 1-2 minutes of reading. Treat reading time as the binding length constraint.
- **Year 9-10 (ages 14-16):** Lexile 925-1185L. Sentence complexity can rise. 200-word prompts feel short for sustained-work activities.
- **Year 11-12 (ages 16-18):** Lexile 1185-1385L. Multi-paragraph instructions are fine; concept density matters more than word ceiling.

If you don't know the year band of the unit you're authoring, assume Year 8 and write for the lower middle.

---

## What students actually see (renderer contract)

The student lesson renderer is currently restrictive. The "Today" column is what ships now; "Target" is what the renderer-v2 work will support. Author against the Today column; track FIX items so you don't have to retrofit the guide later.

| Element         | Markdown                       | Today | Target |
|-----------------|--------------------------------|-------|--------|
| Paragraph       | plain text + blank line        | ✅    | ✅     |
| Bold            | `**bold**`                     | ✅    | ✅     |
| Italic          | `*italic*` or `_italic_`       | ✅    | ✅     |
| Bulleted list   | `- item` / `* item`            | ✅    | ✅     |
| Numbered list   | `1. item`                      | ✅    | ✅     |
| Link            | `[label](url)`                 | ✅    | ✅ + descriptive-text lint |
| H3              | `### subhead`                  | ❌ DROPPED | ✅ FIX — max one per prompt |
| Table           | `\| col \| col \|`             | ❌ DROPPED to one line | ✅ FIX — 2-3 cols, ≤4 rows, mobile-responsive (cards on <600px) |
| Definition list | `term : definition`            | ❌ DROPPED | ✅ FIX — for criteria-style content |
| Inline code     | `` `code` ``                   | ❌ DROPPED | ✅ FIX — for technical units |
| H1 / H2         | `#` / `##`                     | ❌ DROPPED | ❌ KEEP DROPPED — activity title already provides structure |
| Code block      | ` ``` ... ``` `                | ❌ DROPPED | Optional per unit type — off by default |
| Image           | `![alt](url)`                  | ❌ DROPPED | ❌ KEEP DROPPED — use media field (alt-text required) |

The Edit / Preview toggle in the activity editor uses this exact renderer. What you see in Preview is what students see — full stop.

If a heading or table renders as garbage in Preview today, the answer is to restructure the prompt. Once renderer-v2 ships h3 + simple tables + definition lists, this guide updates and the rules around tables/h3 relax to the limits in the Target column.

---

## Activity prompts

### Length

- **Target reading time: ≤30 seconds**, capped at half the activity's estimated student time. A 12-minute activity should not need a 4-minute prompt to set up.
- **Soft cap:** 200 words for Year 7-10, 280 words for Year 11-12. If a Y11 prompt needs more, the task is probably too big — split.
- **Paragraph length:** 1-3 sentences for Y7-10, up to 4 for Y11-12. Long paragraphs become walls of text on student screens. Break by intent: orient → instruct → constrain → prompt for response.
- **Steps spanning more than ~50 words combined:** numbered list, not narrative. Students skim.
- **Sentence complexity:** average sentence length ≤20 words. If you're using semicolons or em-dash chains, you're writing for adults.
- **Lexile band:** match the unit's year group (see Audience above). The activity editor will surface a Flesch-Kincaid / Lexile estimate once renderer-v2 ships.

### Structure

A clean prompt has at most three parts:
1. One-sentence framing — what students are doing and why it matters today.
2. The actual task — direct, imperative. Bulleted/numbered list if multiple steps.
3. What to record/produce — explicit success signal so students know when they're done.

Bad example (current state — 130 words packed into one activity):

> **Sustained Work Block — 22 minutes.** You'll move through two connected tasks. Manage your own time. -- ## TASK 1 — Balance & Wheel Investigation (12 min) Using the sample racers and ramp at your table, investigate how **centre of mass** and **wheel type** affect performance. **Step 1 — Run your tests:** Test each of the three sample racers... **Step 2 — Record in the PMI table:** | Racer | Configuration | + Plus | - Minus | 💡 Interesting | ... [continues for 100+ more words]

One activity packing two tasks, three steps each, plus a 4-column table the renderer drops. Students see a wall of pipes.

Good (split into two activities, table replaced by structured list):

> Activity 1 — Balance & Wheel Investigation (12 min)
>
> Roll each of the three sample racers down the ramp. For each, record:
> - **Plus** — what worked
> - **Minus** — what limited performance
> - **Interesting** — anything unexpected
>
> Compare across the three configurations and write one sentence: which was fastest, and why?

Same intent, ~60 words, no dropped markdown.

### What does NOT belong in the prompt
- **Multi-row data tables** — once renderer-v2 ships table support, ≤3-column criteria/comparison tables are fine in prompts. Five-row data-collection tables go to a worksheet (linked via the media or attachments field), not the prompt.
- **H1/H2 headings** — silently dropped today, kept dropped on purpose. Activity titles and phase labels provide structure.
- **Multiple connected tasks** — split. The phase + activity number gives students structure already.
- **Meta-instructions** ("You'll move through two connected tasks. Manage your own time.") — teacher-side framing belongs in Mini-Lesson Focus, lesson Why this matters, or scaffolding, not the prompt.
- **Idioms, slang, culture-specific references** — break Google Translate and lock out non-native speakers. Replace "knock it out of the park" with "do well". Replace "homecoming game" with a culturally neutral example.
- **Answers to the task itself.** AI-generated prompts especially leak this — apply Khanmigo's principle: guide the thinking, never reveal the answer. If the prompt tells the student what they should conclude, the activity is broken.

### Voice
- Address the student directly: "Roll each racer" not "Students will roll each racer".
- Active voice. Imperative for instructions, present-continuous for what's happening.
- Direct over performatively polite. "Please" is fine occasionally; don't sprinkle it as filler.
- Conversational where it doesn't undermine clarity ("you", "we", "your team") — Mayer's personalization principle: conversational tone outperforms formal tone for learning outcomes.
- No `**emphasis**` on every other word. Bold is for the thing they should remember, not visual texture. Mayer's signaling principle: highlight the essential, not the decorative.

---

## Lesson-level fields

These render above the activity list on the student page.

### learningGoal (Why this matters)
- One paragraph, 2-4 sentences.
- Frames the day in terms of student value. Plain text with light bold.
- Mayer's pre-training principle: introduce any new term here that the activities will use, so working memory isn't doing two jobs in the first activity.
- No drop hazards.

### success_criteria (Learning Objectives)
- Bulleted list of 2-5 short statements, ideally student-voice ("I can…").
- One breath per item — aim for ≤20 words, hard cap 25.
- One verb per criterion. "I can compare and evaluate three bridge designs" → split: "I can compare three bridge designs" + "I can evaluate which bridge handles load best".
- Borrow EL Education's named-protocol pattern where it fits — e.g., "I can give Kind, Specific, Helpful feedback on a peer's prototype" beats "I can give good feedback".

### introduction.text
- Optional bridging paragraph between lesson goal and first activity.
- Same rules as activity prompts: ≤100 words, ≤3 sentences/paragraph.

### introduction.media
- Use this field for hero video/image — not embedded `![alt](url)` in the prompt.
- Video: paste YouTube/Vimeo URL; renderer auto-converts to embed.
- **Alt text required** for images. Describe the visual content, not the filename ("racer on ramp showing centre of mass over rear axle" — not "image1.jpg").
- Apply Mayer's multimedia principle: add an image/video when it shows something words can't (process, motion, spatial relationship). Don't add decorative imagery — Mayer's coherence principle says decoration costs attention.

---

## Scaffolding tab vs activity prompt

This is a contiguity decision. Mayer's spatial contiguity principle: related content belongs adjacent. Therefore:

- **In the prompt** — anything a student needs to start the task. Framing, steps, success signal, and one-line definitions of any new term used.
- **In scaffolding** — depth a student may need: longer worked examples, optional readings, sentence stems for ELL students, troubleshooting trees, vocabulary banks, recap of prior lessons.
- **Not in scaffolding** — the actual task. If a student has to open scaffolding to know what to do, the prompt is broken.

Default rule: a student who reads only the prompt should be able to start the task. Scaffolding is opt-in support, not required pre-reading.

---

## Activity scope (when to split)

Split one activity into two when ANY of these fire:
- Prompt > 200 words (Y7-10) or 280 words (Y11-12)
- Reading time of prompt > half the activity duration
- More than ~3 distinct tasks ("first do X, then Y, then write Z")
- Mixes a research task and a production task
- More than ~12 minutes of estimated student time
- Contains a table with more than 3 columns or 4 rows
- Mixes individual and group work
- Mixes physical-world action and digital-tool action

The cost of splitting is one extra activity card. The benefit is each activity gets its own duration, response type, and grading. Scopes that are too big are unparseable for both students and the grading flow.

---

## Accessibility & inclusivity

Non-negotiable before publishing a unit. These are also procurement gates — international schools increasingly run WCAG 2.1 AA audits before approving classroom tools.

- **Alt text** on every `introduction.media` image. Describes the content, not the file. Empty alt (`alt=""`) is acceptable only for purely decorative images — and decorative images should not be in `introduction.media` in the first place.
- **Descriptive link text.** `[the IB MYP Design Cycle](url)`, never `[click here](url)` or bare URLs. Screen readers announce link text out of context — "click here" is meaningless when extracted.
- **No color-only meaning.** "The red box" is fine if there's also a label or icon. "Click the red one" without other cues fails for color-blind users.
- **Plain language for translatability.** Short sentences, common verbs, no idioms, no contractions in instructions ("do not" beats "don't" in a translated prompt). Most non-English-medium families and students run prompts through machine translation; idioms break.
- **Inclusive examples.** Names across cultures (Aisha, Diego, Wei, Priya — not just James and Sarah). Design briefs that don't assume a specific cultural context (food, sports, holidays). Don't assume gender of professionals ("the engineer reviews her drawings" / "their drawings" instead of always "his").
- **No flashing or auto-playing media.** WCAG 2.1 AA: content that flashes >3 times per second is a seizure trigger. Auto-playing video disorients students with attention or processing differences.
- **Reading level visible to authors.** Activity editor surfaces FK / Lexile estimate (renderer-v2 work). Authors should target the unit's year band before publishing.

Reference: [CAST UDL Guidelines 3.0](https://udlguidelines.cast.org/) — multiple means of representation is the principle these rules implement.

---

## AI generation guard rails

When prompting the unit generator, include this guidance verbatim:

> Activity prompts must be ≤200 words for Year 7-10, ≤280 words for Year 11-12. Target reading time is 30 seconds, capped at half the activity duration. Match the unit's Lexile band: Y7-8 700-1010L, Y9-10 925-1185L, Y11-12 1185-1385L. Average sentence length ≤20 words.
>
> Split tasks across multiple activities — never combine "watch then do then reflect" into one prompt. A prompt has at most three parts: one-sentence framing, the task, what to record.
>
> Do not use `#` or `##` headings (the student renderer drops them). `### h3` is acceptable, max one per prompt. Tables are allowed only with ≤3 columns and ≤4 rows; longer datasets become worksheets in the media field.
>
> Use bold sparingly, only for the thing the student should remember. Address the student directly in active imperative voice. Each paragraph: 1-3 sentences (Y7-10) or up to 4 (Y11-12).
>
> No idioms, slang, contractions in instructions, or culture-specific references. Names in examples should span cultures (e.g. Aisha, Diego, Wei, Priya). Don't assume gender of professionals.
>
> Every image in the `introduction.media` field requires alt text describing content (not filename). Link text must describe the destination — never "click here". A student reading only the prompt should be able to start the task; depth goes in the scaffolding tab.
>
> Never reveal the answer in a prompt — guide the thinking, don't replace it. If the prompt tells the student what they should conclude, the activity is broken.

---

## Renderer-v2 backlog (tracked separately)

To unblock items above, the renderer needs:
- `### h3` support, max one per prompt
- Simple table support (2-3 col, ≤4 rows, mobile-responsive — cards on <600px)
- Definition list support (`term : definition`)
- Inline `code` support
- Alt-text linting on `introduction.media` (block publish if missing for images)
- Descriptive-link-text linting on `[label](url)` (warn on "click here", "here", bare URLs)
- Reading-level readout in the activity editor (FK or Lexile estimate)
- Flashing/autoplay guard on embedded media

When renderer-v2 ships, this guide updates: tables/h3/definition lists move from "DROPPED" to "allowed within these limits", and the editor enforces the alt-text + link-text + reading-level rules at publish time instead of at review time.
