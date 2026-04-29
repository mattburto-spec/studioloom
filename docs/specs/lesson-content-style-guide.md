# Lesson Content Style Guide

**Status:** v1 — establishes baseline standards for activity prompts, lesson intros, and supporting content. Apply to all new units; retro-apply when units are revisited.

**Why this exists:** AI generation + 13 months of ad-hoc edits produced units where prompts were walls of text mixing inconsistent markdown, oversized tables, and packed multi-task instructions into single activities. Students see less than the editor implies because the renderer drops headings and tables silently. This guide is the contract that keeps content readable, scannable, and consistent — both for students reading the lesson and for the AI generation pipeline producing new lessons.

---

## What students actually see (renderer contract)

The student lesson renderer ([`MarkdownPrompt`](../../src/components/student/MarkdownPrompt.tsx)) is **deliberately restrictive**. Only these elements render:

| Element       | Markdown                       | Renders? |
|---------------|--------------------------------|----------|
| Paragraph     | plain text + blank line        | ✅       |
| Bold          | `**bold**`                     | ✅       |
| Italic        | `*italic*` or `_italic_`       | ✅       |
| Bulleted list | `- item` / `* item`            | ✅       |
| Numbered list | `1. item`                      | ✅       |
| Link          | `[label](url)`                 | ✅ (opens new tab) |
| Heading       | `# H1` / `## H2` / `### H3`    | ❌ DROPPED |
| Table         | `\| col \| col \|`             | ❌ DROPPED to one line of pipe text |
| Code block    | <code>```</code>               | ❌ DROPPED |
| Image         | `![alt](url)`                  | ❌ DROPPED (use `media.url` field on activity instead) |
| Inline code   | `` `code` ``                   | ❌ DROPPED |

**The Edit / Preview toggle in the activity editor uses this exact renderer.** What you see in Preview is what students see — full stop.

If a heading or table gets rendered as garbage in Preview, the answer is to restructure the prompt, not to add support for that element. The renderer is restrictive on purpose: prompts should be short and scannable, not micro-documents.

---

## Activity prompts

### Length

- **Hard limit: ~200 words per prompt.** If a prompt is longer, split it into multiple activities or move scaffolding into the Scaffolding tab.
- **Paragraph length: 1–3 sentences.** Long paragraphs become walls of text on student screens. Break by intent: orient → instruct → constrain → prompt for response.
- **Steps that span more than ~50 words combined: numbered list, not narrative.** Students skim.

### Structure

A clean prompt has, at most, three parts:

1. **One-sentence framing** — what students are doing and why it matters today.
2. **The actual task** — direct, imperative. Bulleted/numbered list if there are multiple steps.
3. **What to record/produce** — explicit success signal so students know when they're done.

Example — bad (current state):
```
**Sustained Work Block — 22 minutes.** You'll move through two connected tasks. Manage your own time. -- ## TASK 1 — Balance & Wheel Investigation (12 min) Using the sample racers and ramp at your table, investigate how **centre of mass** and **wheel type** affect performance. **Step 1 — Run your tests:** Test each of the three sample racers (set up by your teacher). For each one, roll it down the ramp and observe carefully. **Step 2 — Record in the PMI table:** | Racer | Configuration | + Plus | - Minus | 💡 Interesting | |--|--|--|--|--| | Racer A | Heavy rear weight | | | | | Racer B | Centred weight, light wheels | | | | …
```
↑ One activity packs two tasks, three steps each, plus a 4-column table the renderer drops. Students see a wall of pipes.

Example — good (split into two activities, table moved to a worksheet link or per-row sub-prompts):
```
Activity 1 — Balance & Wheel Investigation (12 min)

Roll each of the three sample racers down the ramp. For each, record:

- **Plus** — what worked
- **Minus** — what limited performance
- **Interesting** — anything unexpected

Compare across the three configurations and write one sentence: which was fastest, and why?
```
↑ Same intent, ~60 words, no dropped markdown.

### What does NOT belong in the prompt

- **Tables** — drop them to a worksheet, an `### Configure` example, or break into separate per-row activities. Most "tables" in current units are really 2–4 line lists.
- **Headings** — `### TASK 1` is dropped silently. If the prompt is big enough to need a heading, it's too big.
- **Multiple connected tasks** — split into separate activities. The phase + activity number gives students structure already.
- **Meta-instructions** ("You'll move through two connected tasks. Manage your own time.") — this is teacher-side framing. Put it in the Mini-Lesson `Focus` or the lesson `Why this matters`, not in the activity prompt.

### Voice

- Address the student directly: "**Roll each racer**" not "Students will roll each racer".
- Active voice. Imperative for instructions, present-continuous for what's happening.
- Avoid "Please" — direct is more respectful than performatively polite.
- No `**emphasis**` on every other word. Bold is for the *thing they should remember*, not visual texture.

---

## Lesson-level fields

These are separate from activity prompts. The student page renders them above the activity list.

### `learningGoal` (Why this matters)

- One paragraph, **2–4 sentences**.
- Frames the day in terms of student value. "Today we close the loop — wheels and weight are the final pieces of the puzzle." Not bullet lists, not headings. A piece of writing.
- Plain text with light bold. No markdown drop hazards.

### `success_criteria` (Learning Objectives)

- Bulleted list of **2–5 short statements**, ideally student-voice ("I can…").
- Each ≤ 15 words.

### `introduction.text`

- Optional paragraph that bridges from the lesson goal to the first activity.
- Same rules as activity prompts: ≤ 100 words, ≤ 3 sentences per paragraph.

### `introduction.media`

- Use this field for hero video/image — not embedded `![alt](url)` in the prompt.
- Video: paste the YouTube/Vimeo URL; the renderer auto-converts to embed.

---

## Activity scope (when to split)

Split one activity into two when ANY of these fire:

- Prompt > 200 words
- More than ~3 distinct tasks ("first do X, then Y, then write Z")
- Mixes a research task and a production task
- Has more than ~12 minutes of estimated student time
- Contains a table with more than 2 columns

The cost of splitting is one extra activity card. The benefit is each activity gets its own duration, its own response type, its own grading. Scopes that are too big are unparseable for both students and the grading flow.

---

## Markdown formatting cheatsheet

Quick reference for what's safe:

```
A short paragraph framing what we're doing.

Then an imperative task with steps:

1. **First**, do this thing.
2. **Then**, observe what happens.
3. **Finally**, write a one-sentence conclusion.

If you finish early, try the [extension worksheet](https://example.com).
```

Renders cleanly. Scannable in 5 seconds. No silent drops.

---

## AI generation guard rails

When prompting the unit generator, include this guidance verbatim in the system prompt:

> Activity prompts must be ≤ 200 words. Split tasks across multiple activities — never combine "watch then do then reflect" into one prompt. Do not use markdown headings (`#`, `##`, `###`) — the student renderer drops them. Do not use tables — use bulleted lists or split into separate per-row activities. Use bold sparingly, only for the thing the student should remember. Address the student directly in active imperative voice. Each paragraph: 1–3 sentences. If a prompt has more than 3 paragraphs, split into separate activities.

---

## Linting existing units (future)

When we have > 0 units worth keeping, build a one-shot lint script that flags:

- Prompts > 200 words
- Prompts containing `###` or `##` outside code
- Prompts with `|` table syntax
- Prompts with > 3 paragraphs
- Prompts with > 5 instances of `**` (likely emphasis-spamming)
- Activities with `durationMinutes > 15` and prompt < 100 words (probably underspec'd)

Output: per-unit report with line numbers + suggested rewrites via Claude. Teacher approves each rewrite.

---

## Reference

- Student renderer: [`src/components/student/MarkdownPrompt.tsx`](../../src/components/student/MarkdownPrompt.tsx)
- Lesson renderer: [`src/app/(student)/unit/[unitId]/[pageId]/page.tsx`](../../src/app/(student)/unit/%5BunitId%5D/%5BpageId%5D/page.tsx)
- Teacher preview (1:1 with student): `/teacher/units/{unitId}/preview/{pageId}?classId={classId}`
- Editor Edit/Preview toggle: above the prompt textarea on every activity
