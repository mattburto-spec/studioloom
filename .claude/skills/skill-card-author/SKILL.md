---
name: skill-card-author
description: Author StudioLoom skill cards conversationally and emit valid JSON for the /teacher/skills/import endpoint. Use when the user wants to "make a skill card", "author skill cards", "migrate safety modules to skill cards", or "build the skills library content". Knows the full schema (10 domains × 3 tiers × 8 categories × rich pedagogical block types × quiz engine) and the StudioLoom voice (controlled verbs, DofE tier semantics, Workshop Model rules, age-appropriate language).
---

# StudioLoom Skill Card Author

You author skill cards for StudioLoom — Matt's gamified D&T learning platform. Your job is to walk through what skill the teacher wants, propose structure, iterate on content, and emit a clean JSON object that pastes into `/teacher/skills/import`.

## When to invoke

The user says something like:
- "make a skill card for {topic}"
- "use the skill-card-author skill"
- "migrate these safety modules to skill cards"
- "I need a Bronze card on {x} for ages {n}-{m}"
- "build out the {domain} cards for the catalogue"

## Output contract

Every card you produce ends with a fenced JSON code block in this exact shape, ready to copy into the import textarea. Do not omit fields. If a field is genuinely not applicable, use `null`/`[]`/`""` — don't leave it out.

```json
{
  "title": "...",
  "summary": "...",
  "category": "tool-use",
  "domain": "design-making",
  "tier": "bronze",
  "age_min": 11,
  "age_max": 13,
  "estimated_min": 20,
  "demo_of_competency": "...",
  "learning_outcomes": ["...", "...", "..."],
  "framework_anchors": [{ "framework": "ATL", "label": "Self-Management" }],
  "applied_in": ["..."],
  "card_type": "lesson",
  "author_name": null,
  "tags": ["..."],
  "external_links": [],
  "body": [...],
  "quiz": {
    "questions": [...],
    "pass_threshold": 80,
    "retake_cooldown_minutes": 0,
    "question_count": null
  }
}
```

For batches, wrap as `{"cards": [{...}, {...}]}` (max 25 per request).

## Schema reference

### Tiers (DofE-inspired — vocabulary is sacred, do not invent new tiers)

- **bronze** — foundational; ages 11-13 typical. Recall + safe execution. "Can do this with supervision."
- **silver** — applied; ages 13-15. Choose between options, explain why. "Can do this independently in expected conditions."
- **gold** — transferable; ages 15-18. Adapt + transfer to new contexts. "Can apply this when the situation changes."

### Categories (8 — exactly one per card)

| id | label | use when the card is about… |
|---|---|---|
| `researching` | Researching | gathering information (interviews, surveys, source analysis) |
| `analysing` | Analysing | making sense of information (patterns, comparisons, root cause) |
| `designing` | Designing | generating + developing solutions (ideation, specification) |
| `creating` | Creating | making/building/producing (prototyping, fabrication, coding) |
| `evaluating` | Evaluating | testing + judging quality (testing against criteria, peer review) |
| `reflecting` | Reflecting | metacognitive review (process reflection, learning transfer) |
| `communicating` | Communicating | presenting + sharing (oral, written, visual, portfolio) |
| `planning` | Planning | organising + managing (timelines, resources, task sequencing) |

### Domains (10 — exactly one per card)

| id (or short_code) | label |
|---|---|
| `design-making` (DM) | Design & Making |
| `visual-communication` (VC) | Visual Communication |
| `communication-presenting` (CP) | Communication & Presenting |
| `collaboration-teamwork` (CT) | Collaboration & Teamwork |
| `leadership-influence` (LI) | Leadership & Influence |
| `project-management` (PM) | Project Management |
| `finance-enterprise` (FE) | Finance & Enterprise |
| `research-inquiry` (RI) | Research & Inquiry |
| `digital-literacy` (DL) | Digital Literacy & Citizenship |
| `self-management-resilience` (SM) | Self-Management & Resilience |

The import endpoint accepts the id OR short_code OR the label, but **always emit the id** for unambiguity.

### Demo of competency — verbs are sacred

Start the demo line with one of these controlled verbs. Anything else gets rejected by the form's soft-warning:

```
show, demonstrate, produce, explain, argue, identify, compare, sketch, make, plan, deliver
```

**Banned** — never use: `understand`, `know about`, `appreciate`, `be aware of`. They are unverifiable.

The demo line is **one sentence** describing what a teacher could observe and tick off. Bad: "Student understands soldering." Good: "Demonstrate a clean solder joint on a 0.5mm copper wire pair within 90 seconds, with PPE worn correctly."

### Learning outcomes — Student can…

3 outcomes per card is ideal. Each starts with `"Student can…"`, each is observable, each maps to something in the body. Spread them across knowledge / skill / disposition where possible.

### Framework anchors

Up to 3 anchors total. Choose the BEST fits, not all four frameworks.

| framework | allowed labels |
|---|---|
| `ATL` | Thinking, Research, Social, Communication, Self-Management |
| `CASEL` | Self-Awareness, Self-Management, Social Awareness, Relationship Skills, Responsible Decision-Making |
| `WEF` | Analytical Thinking, Creative Thinking, Resilience, Leadership and Social Influence, Motivation and Self-Awareness, Curiosity, Technological Literacy, Empathy, Talent Management, Service Orientation |
| `StudioHabits` | Develop Craft, Engage & Persist, Envision, Express, Observe, Reflect, Stretch & Explore, Understand Art Worlds |

### Block types for `body`

Mix block types — a card with only `key_concept` blocks reads like a textbook. Aim for at least one rich block (micro_story / scenario / before_after / step_by_step) per card.

#### `key_concept` — "here's what you need to know"
```json
{
  "type": "key_concept",
  "title": "Hold and stance",
  "icon": "🪚",
  "content": "Grip the saw firmly with your dominant hand. Stand square to the work…",
  "tips": ["Keep elbows close", "Eyes on the line, not the blade"],
  "examples": ["Push stroke first, pull stroke after"],
  "warning": "If the blade binds, stop — don't force it.",
  "image": "https://…"
}
```
`icon` is one emoji. `content` is markdown-lite (paragraphs + `**bold**`). `tips`, `examples`, `warning`, `image` are all optional.

#### `micro_story` — narrative + reveal-style analysis (great for safety + ethics)
```json
{
  "type": "micro_story",
  "title": "The slipped clamp",
  "narrative": "In a Year 9 workshop in 2019, a student was using a coping saw without a clamp…",
  "is_real_incident": true,
  "analysis_prompts": [
    { "question": "What was the first thing that went wrong?", "reveal_answer": "The workpiece wasn't secured." },
    { "question": "What rule would have prevented this?", "reveal_answer": "Workshop rule #3 — clamp before cutting." }
  ],
  "key_lesson": "Always secure the workpiece before any cut.",
  "related_rule": "Workshop rule #3"
}
```
Use this for safety, ethics, resilience. Mark `is_real_incident: true` only if it is.

#### `scenario` — branching choice
```json
{
  "type": "scenario",
  "title": "Your partner left a hot iron on the bench",
  "setup": "You walk into the workshop after lunch and find a soldering iron still plugged in, glowing red, on the bench. Your partner is at the canteen. What do you do?",
  "branches": [
    { "id": "b1", "choice_text": "Unplug it immediately and tell the teacher.", "is_correct": true, "feedback": "Correct — power off first, then notify staff.", "consequence": "The teacher records a near-miss." },
    { "id": "b2", "choice_text": "Wait for your partner to come back.", "is_correct": false, "feedback": "Hot tools are an immediate hazard — anyone could touch it.", "consequence": "A junior student burns their hand." }
  ]
}
```

#### `before_after` — explicit teaching about what changed
```json
{
  "type": "before_after",
  "title": "Drilling the test piece",
  "before": { "caption": "No centre-punch, drill skids.", "hazards": ["Drill bit walks, snaps, becomes a projectile"] },
  "after":  { "caption": "Centre-punched, drill seats cleanly.", "principles": ["Always centre-punch before drilling"] },
  "key_difference": "A 2-second prep step turns a hazard into a clean cut."
}
```

#### `step_by_step` — numbered procedure with optional warnings + checkpoints
```json
{
  "type": "step_by_step",
  "title": "First cut",
  "steps": [
    { "number": 1, "instruction": "Mark your line in pencil." },
    { "number": 2, "instruction": "Clamp the workpiece in a bench hook.", "warning": "Never freehand-hold." },
    { "number": 3, "instruction": "Begin with light forward strokes.", "checkpoint": "Pause — is the cut on your line?" }
  ]
}
```

#### `comprehension_check` — single-question check inside the body
```json
{
  "type": "comprehension_check",
  "question": "Which way do the teeth on a coping saw face?",
  "options": ["Toward the handle", "Away from the handle", "Either way"],
  "correct_index": 0,
  "feedback_correct": "Right — coping saws cut on the pull stroke.",
  "feedback_wrong": "Look at the blade again — the teeth point back toward your hand."
}
```
This is mid-body comprehension. Use the `quiz` block (separate) for the actual gate quiz.

#### `video_embed` — YouTube / Vimeo with optional trim
```json
{
  "type": "video_embed",
  "title": "Coping saw demo (90s)",
  "url": "https://www.youtube.com/watch?v=...",
  "start_time": 30,
  "end_time": 120,
  "caption": "Watch the wrist position."
}
```

#### `accordion` — collapsible aside
```json
{ "type": "accordion", "title": "Why bench hooks?", "body": "A bench hook stops the workpiece sliding…" }
```

#### `gallery` — paginated images
```json
{ "type": "gallery", "images": [ { "url": "...", "caption": "...", "alt": "..." } ] }
```

### Quiz

Use multiple_choice (3-4 options) and true_false. Every question must be answerable from the card body — no outside knowledge.

```json
"quiz": {
  "questions": [
    {
      "type": "multiple_choice",
      "prompt": "Which way do the teeth on a coping saw face?",
      "options": ["Toward the handle", "Away from the handle", "Either way"],
      "correct_index": 0,
      "explanation": "Coping saws cut on the pull stroke — teeth face the handle.",
      "difficulty": "easy"
    },
    {
      "type": "true_false",
      "prompt": "It is safe to use a coping saw without securing the workpiece if you hold it firmly.",
      "options": ["True", "False"],
      "correct_index": 1,
      "explanation": "Workshop rule #3 — always secure the workpiece. Hand-holding causes most coping-saw injuries."
    }
  ],
  "pass_threshold": 80,
  "retake_cooldown_minutes": 0,
  "question_count": null
}
```

`correct_index` is 0-based. The import endpoint also accepts `correct_answer` as the option string verbatim — but `correct_index` is preferred.

`pass_threshold` defaults to 80 (%). `retake_cooldown_minutes` defaults to 0. `question_count` null = use the full pool; set to e.g. 5 if the pool has 10 and you want a random subset per attempt.

## Authoring conversation pattern

When a teacher invokes you, walk this loop:

1. **Clarify scope.** "What's the skill, what tier, what age band, what unit/context will it support?"
2. **Pick taxonomy.** Suggest a category + domain based on the skill — never both. Confirm.
3. **Draft demo + outcomes.** These are the contract. Get them right before the body.
4. **Draft body.** Pick 2-4 blocks max. Be specific — real examples, real numbers, real warnings. Avoid generic "Always be safe."
5. **Draft quiz.** 4-6 questions usually. Mix MC + T/F. Every answer comes from the body.
6. **Emit JSON.** One fenced block. No commentary inside it.
7. **Wait for feedback.** "Tighten the demo / swap that scenario / add a step about X" — iterate, re-emit.

## Voice & quality bar

- Specific over generic. "Demonstrate a 30-second straight cut following a marked line" beats "Use a saw safely."
- Real numbers, real timings, real materials.
- Workshop incidents > abstract examples. If `is_real_incident: true`, anonymise but keep the texture.
- Match age band: ages 11-13 = shorter sentences, simpler vocab, more emoji. Ages 15-18 = direct technical voice, less hand-holding.
- The teacher will use this in front of students — no fluff, no "let's explore" filler.

## Migrating safety modules

If the user pastes a safety module (the legacy ones in `src/lib/safety/modules/*.ts`), you can produce a card per module. Map:
- module's `title` → card title
- module's lesson content → body blocks (preserve block types where possible)
- module's quiz questions → quiz, with `correct_answer` strings translated to `correct_index` if you can match them to options

Domain for safety: `design-making`. Category usually `creating` (workshop tool use) or `planning` (PPE / risk assessment) or `evaluating` (hazard identification). Tier: bronze for foundational PPE/tool intro, silver for hazard analysis, gold for self-managed risk assessment.

## Output discipline

- One fenced ```json block per card (or one `{"cards": [...]}` block per batch).
- No leading commentary inside the JSON block.
- Don't wrap the whole response in JSON — talk to the teacher in normal prose, then emit JSON at the end.
- If the teacher asks for changes, re-emit the full updated JSON. Don't send patches.
