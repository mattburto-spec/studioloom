# Discovery Engine — Adding a Cognitive Layer (MindPrint-Informed)

**Date:** April 2026  
**Context:** After reviewing MindPrint Learning's research-backed cognitive assessment framework (mindprintlearning.com/assessment-research), exploring how their cognitive domains could enhance the existing Discovery Engine onboarding and mentor matching system.

---

## Reference: MindPrint's Cognitive Domains

MindPrint's assessment (developed via NIH grant at UPenn/CHOP) measures:

- **Complex Reasoning:** Verbal reasoning, abstract reasoning, spatial perception
- **Memory:** Verbal memory, visual memory
- **Executive Functions:** Attention, working memory, flexible thinking
- **Speed:** Processing speed, visual motor speed

Key validation: cognitive skills explain 50%+ of variability in student achievement. Assessment meets ESSA Tier IV evidence standards (Johns Hopkins study). Same battery used by NASA for astronaut cognitive testing.

Notably, their own taxonomy flags spatial perception, abstract reasoning, and flexible thinking as important for **Art, Design, and Engineering** — StudioLoom's exact domain.

---

## Current Discovery Engine: 4-Round / ~8-Room Onboarding

### "Discover Your Design DNA"

| Round | Rooms | What It Measures | Output Vector |
|-------|-------|-----------------|---------------|
| 1. Visual Picks | ~3 screens | Aesthetic gravity — which designs resonate | Aesthetic vector (minimal, ornamental, organic, geometric, raw, playful) |
| 2. Philosophy Pairs | ~2 screens | Design values — trade-offs and priorities | Philosophy vector (function, universal, technology, community, detail, tradition) |
| 3. Material Attraction | 1 screen | Material affinity — tactile/visual draw | Material vector (glass, wood, metal, concrete, textile, digital, mixed) |
| 4. Process Style | 1 screen | How you start a project | Process vector (systematic, intuitive, collaborative, iterative) |

**Matching:** Cosine similarity across all 4 vectors, weighted (aesthetic 0.35, philosophy 0.30, materials 0.20, process 0.15), with heritage bonus (+0.08). Matches to 15–20 real-world designer profiles.

### What this captures well
- **Identity & taste** — who the student wants to be as a designer
- **Cultural affirmation** — heritage matching
- **Design literacy** — exposure to real designers and movements

### What's missing
- **How their brain actually processes design challenges**
- Two students can match the same designer but learn completely differently
- No basis for adapting *how* the mentor communicates, only *who* it channels

---

## Proposed Change: Add Cognitive Rooms

### Principle: Add to the matching, don't replace it

The current rooms measure taste, values, and identity — MindPrint doesn't touch any of that. The cognitive layer adds *how the student's brain works* on top of *who they are as a designer*.

### 3 New Cognitive Rooms (Design-Relevant Subset)

#### Room 8: Spatial Reasoning Challenge
- **Format:** Show a 3D object, ask which unfolded net matches it. 4–5 questions, ~60 seconds.
- **What it predicts:** How the student handles prototyping, technical drawing, 3D visualisation, and spatial relationships in physical builds.
- **Design framing:** "Can you see it before you build it?"

#### Room 9: Flexible Thinking Challenge
- **Format:** Present an everyday object and ask "what else could this be?" or give a design constraint that suddenly changes mid-task.
- **What it predicts:** How they handle iteration, ambiguity in design briefs, pivot moments, and creative reframing.
- **Design framing:** "What happens when the plan changes?"

#### Room 10: Visual Memory Challenge
- **Format:** Briefly show a design detail (joint, pattern, mechanism), hide it, ask them to identify it from similar options.
- **What it predicts:** How well they absorb visual feedback, reference materials, and retain observed techniques from demos.
- **Design framing:** "How sharp is your designer's eye?"

### Critical UX Constraint
These rooms must feel like **puzzles, not tests**. Framed as "how does your designer brain work?" not "let's assess your cognitive ability." The MindPrint research validates the constructs; the implementation should feel nothing like a psychometric assessment.

---

## Updated Room Flow (~11 Rooms)

| Room | Content | Type |
|------|---------|------|
| 1–3 | Visual picks (architecture, products, mixed) | Aesthetic — unchanged |
| 4–5 | "Which matters more?" philosophy pairs | Philosophy — unchanged |
| 6 | Material texture grid | Materials — unchanged |
| 7 | "How would you start?" process scenario | Process — unchanged |
| 8 | Spatial reasoning puzzle | **NEW — Cognitive** |
| 9 | Flexible thinking challenge | **NEW — Cognitive** |
| 10 | Visual memory challenge | **NEW — Cognitive** |
| 11 | Match reveal + Design DNA profile | Reveal — enhanced |

---

## How Cognitive Data Changes the Matching Algorithm

### Current: Cosine similarity determines *which designer*
```
score = (0.35 × aesthetic) + (0.30 × philosophy) + (0.20 × materials) + (0.15 × process) + heritage bonus
```

### Proposed: Cognitive vector determines *how the mentor communicates*

The cognitive scores do **not** change which designer you match with — they change how that designer's AI mentor adapts its pedagogy to you.

| Cognitive Profile | Mentor Adaptation |
|-------------------|-------------------|
| High spatial, low verbal memory | More visual diagrams, fewer written prompts, 3D references over text descriptions |
| Low spatial, high verbal | Step-by-step written instructions, verbal analogies for spatial concepts, more scaffolded technical drawing support |
| High flexible thinking | Open-ended prompts, less structure, "what if?" provocations, comfortable with ambiguity |
| Low flexible thinking | More structured scaffolding, explicit iteration frameworks, gentler constraint changes |
| High visual memory | Can reference prior demos/examples briefly, "remember when we looked at..." |
| Low visual memory | Re-show references inline, more repetition of visual feedback, side-by-side comparisons |

### The unlock
This lets the AI mentor adapt not just its **personality** (Pei vs Ilori) but its **pedagogy** (visual vs verbal scaffolding, structured vs open prompts, detail-first vs big-picture-first).

**No competitor is operating in this space.** EdTech tools either do cognitive assessment (MindPrint) or do design education (generic LMS), but none combine cognitive profiling with design-specific mentor personalisation.

---

## Potential MindPrint Integration Path

If a school already has MindPrint data for their students, StudioLoom could potentially **ingest that profile** to seed the cognitive dimensions rather than running its own mini-assessments. This would:

- Reduce onboarding friction (fewer rooms needed)
- Leverage validated psychometric data
- Create a compelling integration/partnership story
- Differentiate StudioLoom as "the tool that actually uses your assessment data"

This is a future consideration — the in-house mini-assessments are sufficient for pilot and don't create a dependency on an external vendor.

---

## Next Steps

1. **Design the 3 cognitive room UIs** — puzzle-style, playful, ~60 seconds each
2. **Define scoring rubrics** for each cognitive dimension (0–1 normalised)
3. **Build mentor communication adaptation logic** — server-side, maps cognitive profile to prompt modifiers
4. **Create the enhanced Design DNA profile view** — show cognitive traits alongside aesthetic/philosophy traits in the match reveal
5. **Consider whether cognitive traits should subtly influence designer matching** (e.g., high-spatial students might get a slight affinity boost toward architects) — needs careful thought to avoid pigeonholing

---

## Source Reference

- MindPrint Learning: https://www.mindprintlearning.com/assessment-research
- Assessment developed at UPenn Perelman School of Medicine via NIH grant
- Validated by Johns Hopkins (ESSA Tier IV), CAST/NSF, Mathematica
- Same cognitive battery used in NASA Twins Study for spaceflight cognition
