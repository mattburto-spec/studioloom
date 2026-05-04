# Lever 1 sub-phase 1C — Backfill DRY-RUN report

**Generated:** 2026-05-04T02:22:15.298Z
**Source:** `scripts/backfill/lever-1-split-prompts-dryrun.ts` (read-only)
**Brief:** [lesson-quality-lever-1-slot-fields.md](lesson-quality-lever-1-slot-fields.md)

---

## Summary

- **Total rows scanned:** 62
- **Distinct fingerprints:** 62 (must match pre-1B baseline of 62)
- **Clean splits:** 13 (21%)
- **needs_review:** 49 (79%)

**Stop trigger:** ≥25% needs_review per the brief. Currently 79% — 🚨 STOP, iterate the heuristic.

## needs_review breakdown by reason

| Reason | Count |
|---|---|
| no-signal-verb | 43 |
| single-sentence | 6 |

## Per-author breakdown

| Author (teacher_id prefix) | Total | Clean | needs_review | % needs_review |
|---|---|---|---|---|
| `3ac01f99` | 55 | 13 | 42 | 76% |
| `0f610a0b` | 7 | 0 | 7 | 100% |

## Char count distribution (clean splits only)

| Slot | Min | Median | p90 | Max | Cap | Violations |
|---|---|---|---|---|---|---|
| framing | 24 | 84 | 124 | 142 | 200 | 0 |
| task | 538 | 831 | 1055 | 1077 | 800 | 9 |
| success_signal | 64 | 126 | 203 | 447 | 200 | 2 |

Cap violations are **informational** — Lever 1 does not enforce the v2 length caps on backfilled rows. Teachers tune oversize splits in the editor on their own time. Lever 2 lints will surface them.

## Sample clean splits (10)

### Sample 1 — `Scaffolded Challenge (Must/Should/Could)` (id `81127de6`)

**Original prompt** (1030 chars):

> # Your Challenge: Must / Should / Could
> 
> You will work through a three-tier challenge. All three levels are visible to you from the start, so you can see where you're headed.
> 
> **Must** (Complete this first)  
> Build a bridge that spans 20 centimeters. Use any materials provided. Test that it reaches across the gap without collapsing.
> 
> **Should** (Push yourself here)  
> Make your bridge strong enough to hold a 200-gram weight without breaking or sagging significantly. Test it carefully and record your result.
> 
> **Could** (Extension challenge)  
> Optimize your bridge design for…

**Split:**

- **framing** (84 chars): Your Challenge: Must / Should / Could

You will work through a three-tier challenge.
- **task** (831 chars): All three levels are visible to you from the start, so you can see where you're headed. **Must** (Complete this first)  
Build a bridge that spans 20 centimeters. Use any materials provided. Test that it reaches across the gap without collapsing. **Should** (Push yourself here)  
Make your bridge strong enough to hold a 200-gram weight without breaking or sagging significantly. Test it carefully a…
- **success_signal** (107 chars): You decide when you're ready to move up a level—but make sure each tier is truly complete before advancing.

### Sample 2 — `Mystery Material` (id `0d72c240`)

**Original prompt** (1206 chars):

> **Mystery Material Investigation**
> 
> You will receive an unknown material to examine. Your task is to identify its properties and deduce its possible uses.
> 
> **Step 1: Examine the material**
> 
> Handle the sample carefully and gather observations:
> - Touch: What does the surface feel like? (smooth, rough, textured)
> - Weight: How heavy or light is it compared to its size?
> - Flexibility: Can you bend it? Does it stretch or spring back?
> - Strength: Can you tear it easily? Does it resist force?
> - Appearance: Describe its color, pattern, and structure
> 
> **Step 2: Record propertie…

**Split:**

- **framing** (84 chars): **Mystery Material Investigation**

You will receive an unknown material to examine.
- **task** (1053 chars): Your task is to identify its properties and deduce its possible uses. **Step 1: Examine the material**

Handle the sample carefully and gather observations:
- Touch: What does the surface feel like? (smooth, rough, textured)
- Weight: How heavy or light is it compared to its size? - Flexibility: Can you bend it? Does it stretch or spring back? - Strength: Can you tear it easily? Does it resist for…
- **success_signal** (64 chars): Be prepared to share your findings and reasoning with the class.

### Sample 3 — `If I Started Again` (id `45f5289f`)

**Original prompt** (1146 chars):

> # If I Started Again
> 
> Imagine you could travel back in time to the beginning of this project with all the knowledge and experience you have now. What would you do differently?
> 
> Write or present your reflection by completing this statement: "If I started this project again, I would..."
> 
> For each change you'd make, explain:
> - **What you would do differently** – Be specific about the action or approach
> - **Why this matters** – What did you learn that makes this change important?
> - **What happened instead** – Briefly describe what you actually did
> 
> Aim for at least three subs…

**Split:**

- **framing** (142 chars): If I Started Again

Imagine you could travel back in time to the beginning of this project with all the knowledge and experience you have now.
- **task** (813 chars): What would you do differently? Write or present your reflection by completing this statement: "If I started this project again, I would..."

For each change you'd make, explain:
- **What you would do differently** – Be specific about the action or approach
- **Why this matters** – What did you learn that makes this change important? - **What happened instead** – Briefly describe what you actually …
- **success_signal** (184 chars): You can present this as a written reflection, a presentation, or even annotate your process journal with "restart notes" highlighting key moments where you'd now take a different path.

### Sample 4 — `Rapid Prototype Sprint` (id `d553c9a9`)

**Original prompt** (892 chars):

> You have exactly 10 minutes to build a rough prototype of your design.
> 
> Your materials:
> - A3 paper
> - Masking tape
> - Scissors
> - Markers
> 
> Set a timer and start building immediately. This is about speed, not perfection. Your prototype doesn't need to be beautiful or complete—it just needs to exist. Use paper to represent different parts of your design. Fold, cut, tape, and sketch quickly. Don't worry about getting it wrong. The timer will keep you moving forward.
> 
> At the end of 10 minutes, stop working. You should have something physical that you can hold up and explain to oth…

**Split:**

- **framing** (70 chars): You have exactly 10 minutes to build a rough prototype of your design.
- **task** (691 chars): Your materials:
- A3 paper
- Masking tape
- Scissors
- Markers

Set a timer and start building immediately. This is about speed, not perfection. Your prototype doesn't need to be beautiful or complete—it just needs to exist. Use paper to represent different parts of your design. Fold, cut, tape, and sketch quickly. Don't worry about getting it wrong. The timer will keep you moving forward. At the …
- **success_signal** (126 chars): Be ready to show what you've made and talk through your thinking, even if your prototype looks nothing like what you imagined.

### Sample 5 — `30-Second Design Challenge` (id `cdb62cde`)

**Original prompt** (643 chars):

> Grab a pencil and paper. You'll tackle three rapid-fire design challenges—30 seconds each. No overthinking, no erasing, just sketch whatever comes to mind.
> 
> **Round 1:** Design a hat for a giraffe. Go!
> 
> (30 seconds)
> 
> **Round 2:** Design a door for a submarine. Go!
> 
> (30 seconds)
> 
> **Round 3:** Design a chair for a ghost. Go!
> 
> (30 seconds)
> 
> Look at your three sketches. Pick your favorite—the one that makes you smile or surprises you most. Turn to a partner and show them what you created. Explain your design in one sentence.
> 
> Remember: weird ideas are welcome here. …

**Split:**

- **framing** (24 chars): Grab a pencil and paper.
- **task** (540 chars): You'll tackle three rapid-fire design challenges—30 seconds each. No overthinking, no erasing, just sketch whatever comes to mind. **Round 1:** Design a hat for a giraffe. Go!

(30 seconds)

**Round 2:** Design a door for a submarine. Go!

(30 seconds)

**Round 3:** Design a chair for a ghost. Go!

(30 seconds)

Look at your three sketches. Pick your favorite—the one that makes you smile or surpri…
- **success_signal** (75 chars): The goal is to get your creative brain moving, not to create a masterpiece.

### Sample 6 — `World Café` (id `70686f1b`)

**Original prompt** (1322 chars):

> You will participate in a rotating discussion exploring different aspects of your challenge.
> 
> Your classroom has been set up with three to four discussion tables, each featuring a different question. One person at each table will serve as the table host who remains in place throughout the activity.
> 
> Here's how it works: Spend eight minutes at your first table discussing the question posted there. Dive deep, share ideas, challenge assumptions, and capture key insights on the paper provided. When time is called, everyone except the table host moves clockwise to the next table.
> 
> As yo…

**Split:**

- **framing** (92 chars): You will participate in a rotating discussion exploring different aspects of your challenge.
- **task** (1020 chars): Your classroom has been set up with three to four discussion tables, each featuring a different question. One person at each table will serve as the table host who remains in place throughout the activity. Here's how it works: Spend eight minutes at your first table discussing the question posted there. Dive deep, share ideas, challenge assumptions, and capture key insights on the paper provided. …
- **success_signal** (203 chars): The table host role is crucial: summarize concisely, help newcomers understand where the thinking has been, and keep the conversation moving forward rather than simply repeating what's already been said.

### Sample 7 — `Product Autopsy` (id `57d4b3f6`)

**Original prompt** (1326 chars):

> ## Product Autopsy
> 
> You will carefully disassemble an existing product to discover how it was designed and built.
> 
> **Your task:**
> 
> Choose a product (or use the one provided by your teacher). This might be a broken toaster, phone case, mechanical toy, kitchen tool, or small appliance.
> 
> Disassemble the product methodically. Remove screws, unclip parts, and separate components without forcing or breaking them. Take photos or make notes as you go so you can remember how pieces fit together.
> 
> **As you work, sketch the internal structure.** Draw the major components and how they …

**Split:**

- **framing** (110 chars): Product Autopsy

You will carefully disassemble an existing product to discover how it was designed and built.
- **task** (1055 chars): **Your task:**

Choose a product (or use the one provided by your teacher). This might be a broken toaster, phone case, mechanical toy, kitchen tool, or small appliance. Disassemble the product methodically. Remove screws, unclip parts, and separate components without forcing or breaking them. Take photos or make notes as you go so you can remember how pieces fit together. **As you work, sketch th…
- **success_signal** (149 chars): Be prepared to explain what surprised you most about how the product was constructed and what design choices were particularly clever or problematic.

### Sample 8 — `Empathy Immersion` (id `b26dbbbc`)

**Original prompt** (1266 chars):

> ## Empathy Immersion
> 
> Put yourself directly in the user's shoes through physical simulation. Choose constraints that match the experience you're studying:
> 
> **Select your immersion:**
> - Wear thick gardening gloves or oven mitts for 15 minutes
> - Use a wheelchair to navigate your school or home
> - Block one ear with a headphone or earplug
> - Wear glasses smeared with petroleum jelly to blur your vision
> - Use only your non-dominant hand
> 
> **While experiencing these constraints, attempt everyday tasks:**
> - Open containers and doors
> - Write or type messages
> - Navigate stairs…

**Split:**

- **framing** (89 chars): Empathy Immersion

Put yourself directly in the user's shoes through physical simulation.
- **task** (1077 chars): Choose constraints that match the experience you're studying:

**Select your immersion:**
- Wear thick gardening gloves or oven mitts for 15 minutes
- Use a wheelchair to navigate your school or home
- Block one ear with a headphone or earplug
- Wear glasses smeared with petroleum jelly to blur your vision
- Use only your non-dominant hand

**While experiencing these constraints, attempt everyday …
- **success_signal** (93 chars): The discomfort is the point—direct experience reveals needs that descriptions cannot capture.

### Sample 9 — `Pair Design (Driver/Navigator)` (id `bce59c14`)

**Original prompt** (1113 chars):

> **Pair Design: Driver and Navigator**
> 
> You will work in pairs to complete this design task, switching roles every 5 minutes.
> 
> **Role 1: The Driver**
> You hold the pencil, marker, or building materials. Your job is to draw, sketch, or construct exactly what your partner tells you—nothing more, nothing less. You cannot add your own ideas or interpretations while in this role. Follow the instructions precisely as they're given.
> 
> **Role 2: The Navigator**
> You give clear verbal instructions to guide your partner's work. You cannot touch the materials or draw anything yourself. Descri…

**Split:**

- **framing** (124 chars): **Pair Design: Driver and Navigator**

You will work in pairs to complete this design task, switching roles every 5 minutes.
- **task** (538 chars): **Role 1: The Driver**
You hold the pencil, marker, or building materials. Your job is to draw, sketch, or construct exactly what your partner tells you—nothing more, nothing less. You cannot add your own ideas or interpretations while in this role. Follow the instructions precisely as they're given. **Role 2: The Navigator**
You give clear verbal instructions to guide your partner's work. You can…
- **success_signal** (447 chars): Be specific: instead of "make it bigger," say "draw a circle about 5 centimeters across."

**How it works:**
- Decide who starts as Driver and who starts as Navigator
- Set a timer for 5 minutes
- Navigator guides, Driver executes
- When the timer rings, swap roles immediately
- Continue until the design is complete

This method ensures both partners contribute equally and helps you practice giving and following precise technical instructions.

### Sample 10 — `Odd One Out` (id `10dab492`)

**Original prompt** (880 chars):

> Look at the four items in front of you. Your task is to decide which one is the odd one out.
> 
> Here's the catch: there's no single correct answer. What matters is your reasoning.
> 
> You might notice that three items share a material, while one doesn't. Or perhaps three serve a similar purpose, but one stands apart. Maybe three use the same construction technique. The pattern you spot depends on how you look at the problem.
> 
> Once you've made your choice, explain why you selected it. What makes your chosen item different from the others? What do the other three have in common that exclu…

**Split:**

- **framing** (39 chars): Look at the four items in front of you.
- **task** (718 chars): Your task is to decide which one is the odd one out. Here's the catch: there's no single correct answer. What matters is your reasoning. You might notice that three items share a material, while one doesn't. Or perhaps three serve a similar purpose, but one stands apart. Maybe three use the same construction technique. The pattern you spot depends on how you look at the problem. Once you've made y…
- **success_signal** (117 chars): This isn't about finding the "right" answer—it's about developing your eye for patterns, differences, and categories.

## Sample needs_review (5)

### needs_review 1 — `Stakeholder Speed Dating` (id `01ab3063`, reason `no-signal-verb`)

**Original prompt** (1258 chars):

> **Stakeholder Speed Dating**
> 
> You will role-play as a specific stakeholder with a unique perspective on the design problem. Your teacher will assign you a role—this might be a user, manufacturer, shop owner, environmentalist, parent, child, community member, or another person affected by the design.
> 
> Prepare 3–5 questions that your stakeholder would genuinely care about. Think about what matters most to the person you're representing. What are their concerns? What do they need to know? What benefits or problems would they focus on?
> 
> When the timer starts, you have exactly 3 minutes…

**Best-effort split** (preserved for teacher review in editor):

- **framing**: **Stakeholder Speed Dating**

You will role-play as a specific stakeholder with a unique perspective on the design problem.
- **task**: Your teacher will assign you a role—this might be a user, manufacturer, shop owner, environmentalist, parent, child, community member, or another person affected by the design. Prepare 3–5 questions that your stakeholder would genuinely care about. Think about what matters most to the person you're representing. What are their concerns? What do they need to know? What benefits or problems would th…
- **success_signal**: _(null)_

### needs_review 2 — `Process Timeline` (id `ca769340`, reason `no-signal-verb`)

**Original prompt** (932 chars):

> Draw a timeline of your design work from start to finish. Mark these key moments along the path:
> 
> - **Your starting point**: What problem or idea launched this project?
> - **Decision points**: Where did you choose between different options or approaches?
> - **Stuck moments**: Where did progress slow or stop? What was blocking you?
> - **Pivots**: Where did you change direction? What made you shift course?
> - **Breakthroughs**: When did things suddenly click or become clearer?
> - **Current position**: Where are you right now in the process?
> 
> At each marked point, add a brief note ex…

**Best-effort split** (preserved for teacher review in editor):

- **framing**: Draw a timeline of your design work from start to finish.
- **task**: Mark these key moments along the path:

- **Your starting point**: What problem or idea launched this project? - **Decision points**: Where did you choose between different options or approaches? - **Stuck moments**: Where did progress slow or stop? What was blocking you? - **Pivots**: Where did you change direction? What made you shift course? - **Breakthroughs**: When did things suddenly click o…
- **success_signal**: _(null)_

### needs_review 3 — `Silent Brainstorm (Brainwriting)` (id `7c4e02d6`, reason `no-signal-verb`)

**Original prompt** (959 chars):

> **Silent Brainstorm**
> 
> You will generate ideas individually and in complete silence for the next 5 minutes.
> 
> Grab a stack of sticky notes. Write one idea per note—be specific and legible. Don't filter yourself; get as many ideas down as possible. No discussion, no looking at others' work, just write.
> 
> When time is called, bring your notes to the designated wall or board space. Post them in a cluster, but don't organize yet.
> 
> Next, you'll have 5 minutes to silently read everyone's ideas. Walk around. As you read, start grouping similar ideas together. Move sticky notes into clus…

**Best-effort split** (preserved for teacher review in editor):

- **framing**: **Silent Brainstorm**

You will generate ideas individually and in complete silence for the next 5 minutes.
- **task**: Grab a stack of sticky notes. Write one idea per note—be specific and legible. Don't filter yourself; get as many ideas down as possible. No discussion, no looking at others' work, just write. When time is called, bring your notes to the designated wall or board space. Post them in a cluster, but don't organize yet. Next, you'll have 5 minutes to silently read everyone's ideas. Walk around. As you…
- **success_signal**: _(null)_

### needs_review 4 — `Activity: Descriptive drawings` (id `9af1c386`, reason `single-sentence`)

**Original prompt** (169 chars):

> Students create detailed presentation drawings that show garment structure, stitching, collars, cuffs, fabric weight, and patterning—suitable for design option drawings.

**Best-effort split** (preserved for teacher review in editor):

- **framing**: _(null)_
- **task**: Students create detailed presentation drawings that show garment structure, stitching, collars, cuffs, fabric weight, and patterning—suitable for design option drawings.
- **success_signal**: _(null)_

### needs_review 5 — `Sentence Starters Wall` (id `45f898e1`, reason `no-signal-verb`)

**Original prompt** (1058 chars):

> **Sentence Starters Wall**
> 
> Look at the sentence starters posted on the wall—they're designed to help you articulate your thinking during this phase of work.
> 
> Use these phrases to:
> - Jump-start your contributions during group discussions
> - Structure your written reflections and explanations
> - Push your thinking further when you feel stuck
> - Build on classmates' ideas more effectively
> 
> Choose starters that match what you're trying to express. You don't need to use them word-for-word; adapt them to fit your actual thoughts. The goal is to help you communicate complex ideas mo…

**Best-effort split** (preserved for teacher review in editor):

- **framing**: **Sentence Starters Wall**

Look at the sentence starters posted on the wall—they're designed to help you articulate your thinking during this phase of work.
- **task**: Use these phrases to:
- Jump-start your contributions during group discussions
- Structure your written reflections and explanations
- Push your thinking further when you feel stuck
- Build on classmates' ideas more effectively

Choose starters that match what you're trying to express. You don't need to use them word-for-word; adapt them to fit your actual thoughts. The goal is to help you communi…
- **success_signal**: _(null)_

---

## Apply this backfill

After Matt reviews this report and signs off:

```
npx tsx scripts/backfill/lever-1-split-prompts-apply.ts
```

The apply script:
- Re-reads all rows + re-runs the same heuristic (idempotent)
- UPDATEs `framing`, `task`, `success_signal`, `backfill_needs_review` on each row
- DOES NOT touch `prompt`, `content_fingerprint`, or any other column
- Prints a per-row diff before writing