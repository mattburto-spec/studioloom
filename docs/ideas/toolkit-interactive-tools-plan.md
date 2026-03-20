# Interactive Toolkit Tools — Master Build Plan

> Goal: Make every tool in the toolkit a best-in-class thinking experience that students and teachers want to come back to. Not worksheets. Not templates. Thinking tools.
>
> Created: 17 March 2026
> Reference: `docs/education-ai-patterns.md`, `docs/ideas/toolkit-design-spec.md`

---

## The Insight That Changes Everything

Not all 42 tools should be interactive the same way. The toolkit has **four fundamentally different interaction shapes**, and forcing the wrong shape on a tool makes it worse, not better. The plan below groups every tool by its natural interaction shape, then designs the best possible experience for each shape.

---

## Four Interaction Shapes

### Shape 1: Step Sequence (SCAMPER pattern)
**What it is:** Student works through a defined series of steps/perspectives. Each step is a new lens on the same challenge. AI adapts prompts per step, effort-gated nudges after each idea.

**Why it works:** The structure prevents blank-page paralysis. The student always knows "what to think about next" without being told "what to think." Each step feels like a mini-challenge — completable in 2-3 minutes — creating momentum.

**All 5 education AI patterns apply.** This is the richest interaction shape.

**UX signature:** Step rail on left (or top on mobile), active step highlighted, collapsible example, input-first hierarchy, prompt cards unlocked after first idea, thinking depth meter.

**Tools that fit this shape:**
| Tool | Steps | Phase Tone | Notes |
|------|-------|------------|-------|
| **SCAMPER** | 7 (S-C-A-M-P-E-R) | Ideation (divergent) | DONE — reference implementation |
| **Six Thinking Hats** | 6 (White-Red-Black-Yellow-Green-Blue) | Mixed — each hat has its own tone | Unique: each step CHANGES the feedback rules. White = facts only, Red = emotion OK, Black = critical OK, Yellow = optimistic, Green = creative (divergent), Blue = process (meta). This is the most sophisticated AI prompt routing in the toolkit. |
| **PMI Chart** | 3 (Plus-Minus-Interesting) | Evaluation (convergent) | Shorter than SCAMPER. "Interesting" column is the magic — push students to find things that are NEITHER good nor bad. AI nudges should especially target the I column. |
| **Empathy Map** | 4 (Says-Thinks-Does-Feels) | Research (depth) | Each quadrant is a step. AI nudges push for specificity: "What exact words would they use?" not "What do they think?" The FEELS step should push for contradictions — people feel multiple things at once. |
| **Reverse Brainstorming** | 3 (Worsen → Invert → Refine) | Ideation (divergent then convergent) | Step 1 is wild ideation ("How would you make this WORSE?"). Step 2 flips each bad idea. Step 3 refines. The AI tone must shift between steps — Step 1 is pure chaos encouragement, Step 3 is convergent. |
| **Five Whys** | 5 (Why? x5) | Analysis (depth) | Each step is "Why?" asked of the previous answer. AI should detect if the student is going SIDEWAYS (restating the same thing) vs DEEPER (finding root cause). Nudge: "That sounds like the same level — can you go one layer deeper?" |
| **Before & After** | 2 (Before → After) | Evaluation (reflective) | Simple but powerful. Step 1: describe the situation before your design. Step 2: describe after. AI nudge pushes for SPECIFICITY in both — vague "it's better" is low effort. Who specifically benefits? How do we measure the change? |

### Shape 2: Canvas (spatial/visual thinking)
**What it is:** Student fills in regions of a structured visual framework. The framework itself IS the thinking tool — the spatial layout forces relationships between ideas. AI provides contextual prompts per region and cross-region insights.

**Why it works:** Spatial layout externalizes thinking. Seeing ideas side by side (not in a list) reveals gaps, tensions, and connections the student wouldn't notice otherwise. Research: visual + spatial encoding is 2-6x more memorable than text lists (Paivio's dual coding theory).

**Education AI patterns:** Effort-gating, Socratic nudge, micro-feedback apply. Staged cognitive load works differently — it's about which region to fill first, not prompt difficulty. Soft gating: suggest a fill order but don't enforce it.

**UX signature:** Visual canvas with defined regions (not freeform — that's Miro's job). Each region is a text input. Subtle colour coding per region. "Suggested order" dots (1, 2, 3...) but student can fill in any order. AI "connections" panel that lights up after 3+ regions filled, showing patterns across regions.

**Tools that fit this shape:**
| Tool | Regions | Phase Tone | Notes |
|------|---------|------------|-------|
| **SWOT Analysis** | 4 quadrants (Strengths, Weaknesses, Opportunities, Threats) | Analysis (convergent) | Classic 2x2 grid. AI should push students to move from INTERNAL (S/W) to EXTERNAL (O/T) — most students struggle with external factors. Cross-region insight: "Your strength in X could address the threat of Y." |
| **Fishbone Diagram** | Spine + 6 bones (Materials, Methods, People, Environment, Equipment, Management) | Analysis (root cause) | Visual is the tool. The "head" is the problem, bones are cause categories. AI suggests which bone to explore next based on what's empty. Nudge: "You've focused on Materials — what about the People involved?" |
| **Stakeholder Map** | 2x2 grid (Power × Interest) | Research (mapping) | Students drag/place stakeholders on axes. AI prompts: "Who have you missed? Is there someone who has LOW power but could become influential?" Push for completeness, not depth per stakeholder. |
| **Impact/Effort Matrix** | 2x2 grid (Impact × Effort) | Evaluation (prioritization) | Students place their ideas on the grid. AI insight: "You've clustered everything in Quick Wins — are you underestimating effort, or are your ideas genuinely low-effort?" Push for honesty in placement. |
| **Lotus Diagram** | 9 boxes (1 center + 8 surrounding, each expanding to 8 more) | Ideation (divergent, structured) | Most cognitively demanding ideation tool. Start with center, expand to 8 themes, then 8 sub-ideas per theme = 64 ideas. AI should encourage QUANTITY in the outer rings. Staged load: fill center first, then inner 8, then expansion is optional (but rewarded). |
| **Affinity Diagram** | Freeform clusters with headings | Analysis (synthesis) | Student enters individual data points (research notes, observations). Then groups them into clusters. AI suggests groupings: "These three notes seem related — do you see a theme?" Student names the cluster. This is DISCOVERY — the AI suggests, student decides. |
| **Feedback Capture Grid** | 3 columns (I Like / I Wish / I Wonder) + What If? | Evaluation (structured feedback) | Similar to PMI but framed as feedback on someone else's design. AI nudges specificity: "'I like the colour' → what specifically about the colour works? The contrast? The mood? The brand fit?" |
| **Systems Map** | Nodes + connections (directed graph) | Analysis (systems thinking) | Most complex canvas. Students add elements and draw connections (flows, feedback loops). AI detects: "You have a one-way flow from A → B → C. Is there any feedback loop? Does C affect A?" Push for systems thinking, not linear chains. |
| **Journey Map** | Timeline with rows (Stages, Actions, Thoughts, Feelings, Pain Points, Opportunities) | Research (empathy + analysis) | Horizontal timeline, each stage has multiple rows. AI nudge per stage: "What's the EMOTION at this moment?" Push students beyond actions to feelings. Highlight pain points → opportunity connections. |
| **User Persona Card** | Structured card (Name, Age, Background, Goals, Frustrations, Quote, Day-in-the-life) | Research (empathy) | AI detects stereotyping: "Your persona sounds very generic. What makes THIS person different from the average user? What's their specific weird habit?" Push for specificity that makes the persona feel real. |

### Shape 3: Comparison Engine (structured decision-making)
**What it is:** Student compares multiple options against criteria. The tool forces rigorous, explicit trade-off thinking. AI helps define criteria and challenges scoring, but the student makes all judgments.

**Why it works:** Removes gut-feeling bias. Makes trade-offs visible. Students learn that "best" doesn't exist — only "best FOR [criteria]." This is the hardest lesson in design and the one that separates good designers from everyone else.

**Education AI patterns:** Effort-gating applies to REASONING (students must justify scores, not just click numbers). Socratic nudge targets scoring inconsistencies. Micro-feedback on reasoning quality. Soft gating: prompt for justification before allowing submission of bare numbers.

**UX signature:** Table/grid with editable cells. Criteria column on left, options across top. Scoring via sliders or number input. "Justify" button per cell that expands a mini text input for reasoning. Summary row auto-calculates. AI insight panel below shows scoring patterns and challenges assumptions.

**Tools that fit this shape:**
| Tool | Mechanism | Phase Tone | Notes |
|------|-----------|------------|-------|
| **Decision Matrix** | Criteria × Options grid with weighted scoring | Evaluation (convergent) | The king of comparison tools. AI challenges: "You gave Option A a 5 for sustainability but didn't explain why. What specific evidence supports that?" Effort-gate on REASONING, not scoring. Students who just click numbers get pushed. Students who explain get celebrated. Also: AI suggests criteria the student may have missed based on their challenge context. |
| **Pairwise Comparison** | Head-to-head matchups (Option A vs B, A vs C, B vs C...) | Evaluation (convergent) | Tournament bracket style. Each matchup asks "Which is better FOR [criterion]?" with mandatory reasoning (1-2 sentences). AI detects inconsistency: "You picked A over B, and B over C, but C over A — that's a cycle. Which comparison are you least sure about?" Beautiful UX opportunity: animated bracket with winners advancing. |
| **Trade-off Sliders** | Paired sliders on opposing values (Cost ↔ Quality, Speed ↔ Thoroughness) | Evaluation (values clarification) | Each slider represents a trade-off pair. Student positions the slider where they think the balance should be. AI challenges: "You've set Cost vs Quality at 70/30 toward quality. What would change if your user couldn't afford that?" Then reveals how their design actually maps to their stated values. Gorgeous UX: smooth sliders with real-time visualization of the trade-off space. |
| **Dot Voting** | Allocation of limited votes across options | Evaluation (prioritization) | Student has N dots (typically 3-5) to distribute across ideas. Constraint forces prioritization. AI post-vote insight: "You spent all 3 dots on similar ideas. Were there any ideas from a completely different angle you considered?" Simple but the constraint is the pedagogy. |

### Shape 4: Guided Composition (structured writing/framing)
**What it is:** Student constructs a specific output (a brief, a statement, a protocol) with AI scaffolding the structure. The tool guides WHAT to include and challenges the quality of each component, but the student writes everything.

**Why it works:** Most students don't know what makes a good design brief or point of view statement. The structure teaches the craft. AI feedback targets the specific weaknesses of each component — vague user descriptions, unmeasurable success criteria, missing constraints.

**Education AI patterns:** Effort-gating on each component. Socratic nudge challenges specificity and completeness. Staged cognitive load: fill in the easy parts first (who, what) then the hard parts (why, constraints, success criteria). Micro-feedback on component quality.

**UX signature:** Sectioned form with clear labels. Each section has a text input + quality indicator (depth dots). Optional "coach" button per section that gives a targeted Socratic nudge for THAT specific component. Final output renders as a polished, shareable document.

**Tools that fit this shape:**
| Tool | Components | Phase Tone | Notes |
|------|-----------|------------|-------|
| **Design Brief** | Context, User, Problem, Constraints, Success Criteria, Timeline | Planning (structured) | The foundation document. AI challenges: "Your success criteria says 'make it better' — better how? For whom? How would you measure it?" Push for measurability and specificity. The brief should feel like a professional document when complete. |
| **Point of View Statement** | [User] needs [need] because [insight] | Define (synthesis) | Deceptively simple — one sentence. But each component must be specific and insightful. AI challenges: "Your user is 'students' — which students? Your need is 'help' — help with what specifically? Your insight is 'they struggle' — what have you observed that tells you this?" The BECAUSE is the hardest part — it requires genuine insight, not assumption. |
| **How Might We** | Problem reframes as opportunity questions | Define → Ideate (bridge) | Student enters a problem statement, then rewrites it as 3-5 "How might we..." questions at different scopes (narrow, medium, broad). AI challenges scope: "That's very broad — 'How might we improve education?' Try zooming in. What specific moment in the experience are you targeting?" Teach the art of framing. |
| **Testing Protocol** | Hypothesis, Method, Sample, Metrics, Duration, Success Threshold | Planning (rigorous) | The most structured composition tool. Each component has explicit quality criteria. AI challenges: "Your sample size is 3 — is that enough to spot a pattern? What would you do if 2 say yes and 1 says no?" Push for rigorous thinking without requiring statistics knowledge. |
| **Design Specification** | Dimensions, Materials, Processes, Tolerances, Finishes | Planning (technical) | Technical writing. AI checks for completeness: "You've specified the material but not the joining method. How are these pieces connected?" Push for manufacturing-ready detail. |
| **Observation Sheet** | Who, Where, When, What they did, What they said, Your interpretation | Research (field notes) | Structured field observation. AI challenges the interpretation column: "You wrote 'they were confused' — what specifically did you observe that told you they were confused? What did their face/body/words actually show?" Teach the difference between observation and inference. |
| **Design Journal** | What I did, What I learned, What I'd change, Next steps | Reflection (growth) | Regular reflection practice. AI detects surface-level entries: "'I made my prototype' — what specific decisions did you make while building it? What surprised you?" Push for LEARNING extraction, not activity logging. The journal should build a growth narrative over time. |
| **Peer Review Protocol** | Strengths (specific), Questions, Suggestions, Priority Action | Evaluation (structured feedback) | Guide for giving peer feedback. AI coaches the feedback QUALITY: "'It looks good' is not helpful feedback. What specifically works well? Name one visual element and explain WHY it works." Teach students to give the kind of feedback professionals give. |

---

## Tools That Don't Need Full Interactivity

Some tools are better as **guided templates** (printable/presentable) rather than interactive AI-powered experiences. Building them as interactive would add complexity without adding thinking value.

| Tool | Why template is better | What it gets |
|------|----------------------|--------------|
| **Crazy 8s** | The value IS the time pressure + sketching. Digital input would slow it down. | Timer-only interactive mode: 8 panels, 60-second countdown per panel, camera capture of sketches. No AI — the constraint IS the pedagogy. |
| **Brainstorm Web** | Visual/spatial — better on paper or whiteboard. Digital freeform drawing is worse than paper. | Beautiful printable template. Digital version: structured web with add-node UX (not freeform canvas). |
| **Mind Map** | Same as Brainstorm Web — spatial thinking tools work better physical. Many existing digital mind map tools (Miro, Whimsical) already do this well. | Printable template + "digital capture" mode (photograph your mind map, AI extracts key themes). Optional: simple node-based builder with AI suggesting branches. |
| **Morphological Chart** | Table-based, low AI value. The thinking is in the combinations, not in generating options. | Interactive table builder where student defines attributes + options, then clicks "Generate Combinations" to see random/systematic combinations. Light AI: suggest attributes they might have missed. |
| **Round Robin** | Inherently physical/collaborative. Requires passing paper. Digital would kill the social energy. | Presentation mode timer + instructions only. Not interactive. |
| **Gallery Walk** | Physical movement IS the activity. Standing, walking, writing on sticky notes. | Presentation mode instructions + timer + feedback template. Possibly: digital feedback collection (students scan QR, leave typed feedback). |
| **Mood Board** | Image curation — already done well by Pinterest, Canva, Milanote. Building another mood board tool would be undifferentiated. | Link to existing tools + printable layout template for physical mood boards. |
| **Storyboard** | Sequential drawing — better on paper. Digital drawing tools are a whole product. | Printable panels template. Possibly: photo-based storyboard (capture photos for each panel + caption). |
| **Wireframe Template** | Sketching UI — better on paper or in Figma/Whimsical. | Printable wireframe grid + device templates. |
| **Annotation Template** | Visual markup — needs to overlay on an image/design. | Upload design → overlay structured annotation pins → typed feedback per pin. Light interactivity. |
| **Gantt Planner** | Already exists in the platform's student PM view. Duplicate would confuse. | Link to the platform's planning features. Printable Gantt template for offline use. |
| **Resource Planner** | Table/checklist format. Low AI value. | Interactive checklist builder. Student lists resources needed, checks off as gathered. Simple. |
| **Design Specification** | Included in Shape 4 above — borderline between template and guided composition. | Guided composition for digital. Printable template for physical. |

---

## Build Priority & Sequencing

### Tier 1 — Build Now (highest impact, proven interaction shape)
These tools have the highest usage in classrooms, the clearest interaction patterns, and the most AI value. Each one brings students back because it makes them think harder than paper ever could.

| # | Tool | Shape | Status | Notes |
|---|------|-------|--------|-------|
| 1 | **Six Thinking Hats** | Step Sequence | ✅ DONE (18 Mar 2026) | Per-hat AI rules (`hatRules` + `hatTone`). Most sophisticated prompt routing in the toolkit. |
| 2 | **PMI Chart** | Step Sequence | ✅ DONE (18 Mar 2026) | First evaluation-phase tool. "Interesting" column has special AI rules for neither-good-nor-bad observations. |
| 3 | **Five Whys** | Step Sequence | ✅ DONE (18 Mar 2026) | Depth detection (sideways vs deeper). Causal chain visualization. Previous-answer context per step. |
| 4 | **Empathy Map** | Step Sequence* | ✅ DONE (18 Mar 2026) | *Used step sequence with 2×2 nav instead of full canvas. Persona field. Feels quadrant pushes contradictions. Quote detection in effort assessment. |
| 5 | **Decision Matrix** | Comparison Engine | 🔜 NEXT | New interaction shape (comparison). Effort-gated reasoning is the killer feature — no more "I gave it a 5 because I like it." |
| 6 | **How Might We** | Guided Composition | 🔜 NEXT | Bridge tool between Define and Ideate phases. Teaches framing — the most underrated design skill. AI scope-challenging is a killer interaction. |

**Tier 1a (Step Sequence) COMPLETE:** SCAMPER + Six Thinking Hats + PMI + Five Whys + Empathy Map = 5 interactive tools. Step Sequence shape is proven and battle-tested across ideation, evaluation, analysis, and research phases.

**Remaining Tier 1:** Decision Matrix (proves Comparison Engine shape) → How Might We (proves Guided Composition shape). These are the two new interaction shapes that need building.

### Tier 2 — Build Next (expand coverage, deepen shapes)
| # | Tool | Shape | Time to Build | Why Next |
|---|------|-------|---------------|----------|
| 7 | **SWOT Analysis** | Canvas | 2-3 days | Canvas shape already built in Empathy Map. SWOT is universal — used outside design too. High search volume. |
| 8 | **Reverse Brainstorming** | Step Sequence | 2-3 days | Unique pedagogical value — thinking about WORSENING is counterintuitive and fun. Students love the "be evil" phase. Dual-tone AI (divergent step 1, convergent step 3). |
| 9 | **Design Brief** | Guided Composition | 3-4 days | Every project needs one. The guided composition shape makes students write briefs they're actually proud of. High teacher value — "my students' briefs are 10x better now." |
| 10 | **Pairwise Comparison** | Comparison Engine | 3-4 days | Comparison shape already built. Tournament bracket UX is beautiful and engaging. AI inconsistency detection is genuinely useful. |
| 11 | **Journey Map** | Canvas | 4-5 days | Complex canvas with timeline dimension. Very high research value. The emotions row is where AI shines — pushing past "they felt OK." |
| 12 | **Point of View Statement** | Guided Composition | 2 days | Quick build. Teaches the most elegant framing technique in design thinking. AI challenges each word of the one-sentence output. |

### Tier 3 — Build Later (complete the set)
| # | Tool | Shape | Why Later |
|---|------|-------|-----------|
| 13 | **Fishbone Diagram** | Canvas | Complex visual, fewer classrooms use it regularly |
| 14 | **Feedback Capture Grid** | Canvas | Similar to PMI, lower priority |
| 15 | **User Persona Card** | Guided Composition | Important but lower AI value |
| 16 | **Trade-off Sliders** | Comparison Engine | Beautiful UX but narrower use case |
| 17 | **Testing Protocol** | Guided Composition | Advanced tool, smaller audience |
| 18 | **Stakeholder Map** | Canvas | Intermediate difficulty, smaller audience |
| 19 | **Lotus Diagram** | Canvas | Complex (64-cell expansion), high cognitive load |
| 20 | **Systems Map** | Canvas | Most complex tool in the set |
| 21 | **Observation Sheet** | Guided Composition | Better as printable in most cases |
| 22 | **Dot Voting** | Comparison Engine | Simple mechanic, lower AI value |
| 23 | **Before & After** | Step Sequence | Simple 2-step, lower priority |
| 24 | **Design Journal** | Guided Composition | Recurring reflection — needs different UX pattern |
| 25 | **Peer Review Protocol** | Guided Composition | Needs peer pairing system |
| 26 | **Affinity Diagram** | Canvas | Needs drag-and-drop clustering |

---

## Interaction Shape Deep Dives

### Step Sequence — Detailed UX Pattern

**Screen flow:** Intro → Working → Summary (same as SCAMPER)

**Intro screen:**
- Challenge input (textarea, same as SCAMPER)
- Brief explainer of the tool (what it is, when to use it)
- Number of steps shown as preview dots
- "Begin" button

**Working screen (per step):**
```
┌─────────────────────────────────────────────┐
│  Step indicator (1 of N, clickable rail)      │
│                                               │
│  [Letter/Icon]  Step Name                     │
│  Step description (1-2 lines)                 │
│  ▶ See an example (collapsible)               │
│                                               │
│  ┌─────────────────────────────┐ ┌──────┐   │
│  │ Textarea (primary action)    │ │ +Add │   │
│  └─────────────────────────────┘ └──────┘   │
│                                               │
│  [Micro-feedback toast — auto-dismiss 3s]     │
│                                               │
│  ── Thinking Prompts (unlocked after 1st) ──  │
│  [Deal prompt card] [Reshuffle]               │
│  [Dealt cards...]                             │
│                                               │
│  ── Your Ideas ──────────────────────────── │
│  [Idea card with depth dots] [Idea card...]   │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │ AI Nudge bubble (acknowledgment +     │    │
│  │ Socratic question)                     │    │
│  └──────────────────────────────────────┘    │
│                                               │
│  [← Previous]  [Thinking Depth Meter]  [Next →]│
└─────────────────────────────────────────────┘
```

**Summary screen:**
- All ideas organized by step
- Depth dots on each idea
- AI-generated cross-step insights (themes, connections, patterns)
- Export options: copy all, print, save to portfolio

### Canvas — Detailed UX Pattern

**Screen flow:** Intro → Canvas → Insights

**Intro screen:**
- Challenge/topic input
- Brief explainer
- Preview of the canvas shape (miniature visual)
- "Begin" button

**Canvas screen:**
```
┌──────────────────────────────────────────────────┐
│  Challenge context bar (sticky)                    │
│                                                    │
│  ┌──────────────┬──────────────┐                  │
│  │   Region A    │   Region B    │                  │
│  │  [label]      │  [label]      │                  │
│  │               │               │                  │
│  │  [textarea]   │  [textarea]   │                  │
│  │  [ideas...]   │  [ideas...]   │                  │
│  │  ── + Add ──  │  ── + Add ──  │                  │
│  ├──────────────┼──────────────┤                  │
│  │   Region C    │   Region D    │                  │
│  │  [label]      │  [label]      │                  │
│  │               │               │                  │
│  │  [textarea]   │  [textarea]   │                  │
│  │  [ideas...]   │  [ideas...]   │                  │
│  │  ── + Add ──  │  ── + Add ──  │                  │
│  └──────────────┴──────────────┘                  │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │ AI Connections Panel (appears after 3+ items)│   │
│  │ "Your strength in materials could address    │   │
│  │  the threat of rising costs..."              │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  [Suggested fill order: 1→2→3→4]  [View Insights] │
└──────────────────────────────────────────────────┘
```

**Key UX decisions for Canvas:**
- Each region is independently expandable (accordion on mobile)
- Ideas are added per-region (not global)
- AI nudge appears contextually within the region being edited
- Cross-region AI insights appear in a separate panel below (not inline — would clutter)
- Suggested fill order shown as subtle numbered badges, but student can fill any order
- Depth dots per idea, per region
- Micro-feedback toast per idea submission (same as SCAMPER)

**Canvas AI endpoints (new):**
```typescript
POST /api/tools/{tool-name}
Actions:
  "nudge"    — effort-gated feedback on an idea in a specific region
  "suggest"  — suggest which region to fill next (based on what's empty/thin)
  "connect"  — find cross-region patterns and connections
  "insights" — full summary analysis of the completed canvas
```

### Comparison Engine — Detailed UX Pattern

**Screen flow:** Setup → Compare → Insights

**Setup screen:**
- Enter design challenge
- Add options to compare (2-5, each with a name + brief description)
- Add criteria (3-7, each with a name + weight slider 1-5)
- AI suggests criteria the student may have missed: "For a product used outdoors, have you considered weather resistance?"
- "Start Comparing" button

**Compare screen:**
```
┌───────────────────────────────────────────────────┐
│  Criteria: [Criteria Name]  Weight: ●●●○○          │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Option A  │  │ Option B  │  │ Option C  │         │
│  │           │  │           │  │           │         │
│  │  [1-5     │  │  [1-5     │  │  [1-5     │         │
│  │  slider]  │  │  slider]  │  │  slider]  │         │
│  │           │  │           │  │           │         │
│  │  "Why?"   │  │  "Why?"   │  │  "Why?"   │         │
│  │  [reason  │  │  [reason  │  │  [reason  │         │
│  │  input]   │  │  input]   │  │  input]   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  [AI Nudge: "You scored Option A and B the same     │
│   for durability. What's the tiebreaker?"]          │
│                                                     │
│  [← Previous Criteria]  [Next Criteria →]           │
└───────────────────────────────────────────────────┘
```

**Key UX decisions for Comparison Engine:**
- Navigate ONE CRITERION AT A TIME (not full grid view — too overwhelming for students)
- Each criterion is a "round" — score all options, provide reasoning, then advance
- Full grid summary appears at the end (reveal moment)
- AI challenges scoring: inconsistencies, missing reasoning, suspiciously uniform scores
- Effort-gating on the "Why?" reasoning text, not on the number scores
- "Why?" is required for scores of 1 or 5 (extremes need justification), optional for 2-4

**Insights screen:**
- Full Decision Matrix grid with weighted scores and totals
- Winner highlighted but with nuance: "Option B scores highest overall, but Option A wins on your most important criteria"
- AI identifies: close calls, criteria that swung the result, potential biases
- "What if?" simulator: change a weight and see the result shift (teaches that decisions depend on values)

### Guided Composition — Detailed UX Pattern

**Screen flow:** Intro → Compose → Polish

**Intro screen:**
- Context input (what's this brief/statement for?)
- Brief explainer of the output format
- Preview of the final document structure
- "Start Writing" button

**Compose screen:**
```
┌─────────────────────────────────────────────┐
│  Section: [Section Name]  (2 of 6)           │
│  "What this section needs: [guidance text]"   │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Textarea (generous, 4-6 rows)            │ │
│  │                                           │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  [Depth indicator: ○○○]                       │
│                                               │
│  [🎯 Coach Me] — targeted Socratic nudge      │
│                                               │
│  [AI Nudge bubble when Coach Me clicked]      │
│                                               │
│  [← Previous Section]  [Next Section →]       │
└─────────────────────────────────────────────┘
```

**Key UX decisions for Guided Composition:**
- Sections presented ONE AT A TIME (not a long scrolling form)
- Each section has guidance text explaining what good looks like
- "Coach Me" button is opt-in — AI doesn't nudge automatically (unlike Step Sequence where nudge fires after every idea). The student asks for help when stuck.
- Depth indicator per section (filled circles based on content quality)
- Section navigation shows completion state (empty, in-progress, complete)

**Polish screen:**
- Full document rendered as a polished output (styled card/document)
- Overall quality score (depth dots per section)
- AI "polish pass" — optional button that suggests improvements: "Your constraints section lists budget but not time. Most real projects have both."
- Export: copy text, print as formatted document, save to portfolio
- Share: generate link for teacher review

---

## AI Endpoint Architecture

Each interaction shape gets a standard API with shape-specific actions:

### Step Sequence API: `/api/tools/{tool-name}`
| Action | Purpose | Max tokens |
|--------|---------|------------|
| `prompts` | Generate contextual prompts for current step | 300 |
| `nudge` | Effort-gated feedback after idea submission | 120 |
| `insights` | Cross-step patterns and themes | 400 |

### Canvas API: `/api/tools/{tool-name}`
| Action | Purpose | Max tokens |
|--------|---------|------------|
| `nudge` | Per-region effort-gated feedback | 120 |
| `suggest` | Recommend which region to fill next | 60 |
| `connect` | Cross-region pattern detection | 200 |
| `insights` | Full canvas analysis | 400 |

### Comparison Engine API: `/api/tools/{tool-name}`
| Action | Purpose | Max tokens |
|--------|---------|------------|
| `suggest-criteria` | Suggest criteria student may have missed | 200 |
| `challenge` | Challenge scoring consistency/reasoning | 120 |
| `insights` | Overall decision analysis with "what if" | 400 |

### Guided Composition API: `/api/tools/{tool-name}`
| Action | Purpose | Max tokens |
|--------|---------|------------|
| `coach` | Targeted Socratic nudge for current section | 120 |
| `polish` | Improvement suggestions for completed draft | 300 |
| `quality` | Quality assessment per section | 200 |

**All endpoints use:**
- Haiku 4.5 (fast, cheap, student-facing)
- Effort-gating (client-assessed, sent in request)
- Phase-aware tone (ideation = divergent, evaluation = convergent)
- Structured JSON responses with regex fallback
- Rate limiting (50/min, 500/hour per session)
- Fire-and-forget usage logging

---

## What Makes Students Come Back

The tools alone aren't enough. Students come back because of **three things working together:**

### 1. The "I think better with this" feeling
Every tool should leave the student feeling smarter than they started. Not because the AI told them answers — because the AI pushed them to think harder and they surprised themselves. The micro-feedback (depth dots, thinking meter, acknowledgment messages) makes this visible: "I wrote 8 ideas and 5 of them were deep. I'm getting better at this."

### 2. The portfolio effect
Everything a student creates in the toolkit flows into their portfolio. Over time, they see a body of thinking work that proves their growth. The SCAMPER they did in September looks shallow compared to the Six Thinking Hats they did in December. This growth narrative is what students (and parents, and university admissions) care about.

### 3. The teacher's trust
Teachers recommend tools because they work in classrooms. A teacher who runs Six Thinking Hats with 25 students and sees engaged, focused thinking (instead of the usual "I don't know what to write") will use the toolkit every week. The teacher's consistent use is what brings students back — not gamification, not streaks, not leaderboards. **The tools work so well that teachers make them part of their practice.**

This is why quality matters more than quantity. 6 extraordinary tools that teachers integrate into their weekly routine will beat 42 mediocre ones.

---

## Shared Component Architecture

To build 20+ interactive tools efficiently, we need reusable components:

### Core shared components
| Component | Used by | Purpose |
|-----------|---------|---------|
| `ToolIntro` | All shapes | Challenge input + tool explainer + begin button |
| `ToolSummary` | All shapes | Results view + AI insights + export options |
| `IdeaInput` | Step Sequence, Canvas | Textarea + Add button + micro-feedback |
| `IdeaCard` | Step Sequence, Canvas | Idea display with depth dots + edit/delete |
| `NudgeBubble` | All shapes | AI feedback display (acknowledgment + question) |
| `MicroFeedback` | All shapes | Toast notification (effort-colored, 3s dismiss) |
| `DepthMeter` | Step Sequence, Canvas | Average quality progress bar |
| `PromptCards` | Step Sequence | Deal-a-card system with thinking timer |
| `StepRail` | Step Sequence | Step navigation with completion indicators |
| `CanvasRegion` | Canvas | Labeled region with own idea list + input |
| `ScoringCell` | Comparison Engine | Slider + reasoning input + depth indicator |
| `SectionNav` | Guided Composition | Section navigation with completion state |
| `CoachButton` | Guided Composition | Opt-in AI nudge trigger |
| `ExportPanel` | All shapes | Copy, print, save-to-portfolio actions |

### Shared hooks
| Hook | Purpose |
|------|---------|
| `useEffortAssessment` | Client-side effort detection (assessEffort function) |
| `useMicroFeedback` | Toast state management with auto-dismiss |
| `useToolAI` | Generic fetch wrapper for tool API calls |
| `useToolSession` | Session ID generation + local storage of progress |
| `useThinkingTimer` | 10-second countdown with SVG ring animation |

### Shared API utilities
| Utility | Purpose |
|---------|---------|
| `buildToolRoute` | Standard API route boilerplate (rate limit, validate, log) |
| `buildPhaseAwarePrompt` | Generates system prompt with correct phase tone |
| `parseStructuredResponse` | JSON parse with regex fallback |
| `toolRateLimit` | Standard rate limiting for all tool endpoints |

---

## Timeline Estimate

| Phase | Tools | Duration | Milestone |
|-------|-------|----------|-----------|
| **Foundation** | Extract shared components from SCAMPER | 3-4 days | Reusable component library |
| **Tier 1a** | Six Thinking Hats, PMI, Five Whys, Empathy Map | ✅ DONE | Step Sequence shape proven at scale (5 tools) |
| **Tier 1b** | Decision Matrix | 4-5 days | Comparison Engine shape proven |
| **Tier 1c** | How Might We | 2-3 days | Guided Composition shape proven |
| **Tier 2** | SWOT, Reverse Brainstorm, Design Brief, Pairwise, Journey Map, POV Statement | 15-20 days | Full design cycle coverage |
| **Templates** | Crazy 8s timer, printable templates for non-interactive tools | 5-7 days | Complete toolkit |

**Total: ~40-50 days for the full interactive toolkit.**

The critical path is Tier 1 — proving all four interaction shapes. After that, each new tool in the shape is significantly faster because the components exist.

---

*This plan should be read alongside `docs/education-ai-patterns.md` (the 5 patterns) and `docs/ideas/toolkit-design-spec.md` (the visual/UX spec).*
