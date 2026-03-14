# High Impact Teaching Strategies — Gap Analysis for Design

Last updated: March 14, 2026

## Source Research
- Victorian Department of Education HITS (2020 revision) — 10 strategies
- Hattie Visible Learning meta-analyses (2009-2023) — 250+ effect sizes
- Marzano's 9 High-Yield Strategies
- Rosenshine's 10 Principles of Instruction

## Why Design Is Different

Design/Technology is not a standard academic subject. The HITS must be adapted:

1. **Long making blocks are legitimate** — a 40-min hands-on session IS good pedagogy, not poor pacing
2. **Mess is expected** — ideation, prototyping, testing involve productive chaos
3. **The product is not the goal** — the design PROCESS is assessed (MYP Criteria A-D)
4. **Tool skills require explicit teaching** — safety demos before making are non-negotiable
5. **Energy arc differs** — a making lesson has a different rhythm to a research lesson
6. **Iteration is the whole point** — unlike most subjects, doing it again IS the learning

## Design Lesson Types

Not all Design lessons follow the same structure. The AI must recognise and generate for these types:

| Lesson Type | Structure | Core Block | Key HITS |
|---|---|---|---|
| **Research/Investigation** | Review → Mini-lesson → Guided inquiry → Independent → Share findings | 15-25 min | Questioning, Worked Examples |
| **Ideation/Brainstorming** | Review → Stimulus → Divergent (individual) → Convergent (group) → Select | 20-30 min | Collaborative, Multiple Exposures |
| **Skills/Technique Demo** | Review → I Do → We Do → You Do → Practice | 10-15 demo + 20-30 practice | Explicit Teaching, Worked Examples |
| **Extended Making** | Brief review → Safety check → Making (teacher circulating) → Clean-up → Reflection | 30-45 min making | Feedback (verbal), Goals |
| **Testing/Prototyping** | Review → Predict → Test → Record → Analyse → Iterate plan | 20-35 min test cycle | Metacognitive, Questioning |
| **Critique/Evaluation** | Review → Criteria reminder → Gallery walk/peer critique → Self-assess → Goal-set | 20-30 min critique | Feedback, Metacognitive, Goals |

## Coverage Matrix: HITS vs Current AI Model

### ✅ Well Covered

| HITS # | Strategy | Effect Size | Current Coverage |
|--------|----------|------------|-----------------|
| 8 | **Feedback** | d=0.73 | Layer 2 feedback loop, peer critique scored in quality evaluator, teacher/student pulse UI |
| 9 | **Metacognitive Strategies** | d=0.60 | Quality evaluator principle #9, reflection activities required, process journals |
| 10 | **Differentiated Teaching** | d=1.07 (RTI) | 3-tier ELL scaffolding on every activity, structural quality check for coverage |

### ⚠️ Partially Covered

| HITS # | Strategy | Effect Size | What's There | What's Missing |
|--------|----------|------------|-------------|---------------|
| 4 | **Worked Examples** | d=0.57 | Design frameworks referenced (SCAMPER, PMI, etc.) | No exemplar analysis templates, no "what Level 7 looks like" |
| 5 | **Collaborative Learning** | d=0.59 | Critique culture scored in quality evaluator | No collaboration protocols, role cards, or group structure guidance |

### ❌ Gaps

| HITS # | Strategy | Effect Size | Gap Description | Design Adaptation |
|--------|----------|------------|----------------|-------------------|
| 1 | **Setting Goals / Learning Intentions** | d=0.56 | No per-lesson learning intentions or success criteria generated | Process-focused: "I can generate 3+ ideas using SCAMPER" not "I can list 3 causes" |
| 2 | **Structuring Lessons** | d=0.53 | Warmup/core/reflection roles exist but no lesson-type-aware structure | 6 Design lesson types (above) with different structures and timing |
| 3 | **Explicit Teaching** | d=0.57 | No I Do → We Do → You Do sequencing enforced | Critical for tool skills/safety demos; less relevant for ideation lessons |
| 6 | **Multiple Exposures / Spaced Practice** | d=0.71 | Skills taught once, never revisited | Spiral retrieval warm-ups: "recall material properties from Week 2" |
| 7 | **Questioning** | d=0.46 | No teacher questioning banks generated | 3-5 tiered questions per lesson for circulating during work time |

### Additional Hattie/Marzano Gaps (Beyond HITS 10)

| Strategy | Effect Size | Gap | Design Application |
|----------|------------|-----|-------------------|
| **Self-Assessment Prediction** | d=1.44 | Students never predict own rubric level | "Before submitting, predict your Criterion B level and explain why" |
| **Identifying Similarities/Differences** | d=1.61 (Marzano) | No compare/contrast templates for Criterion A | Product analysis frameworks for research phase |
| **Advance Organizers** | d=0.41 | No unit roadmap or "where are we in the design cycle?" | Visual journey map showing progress through unit |

### Quality Evaluator Prompt Gap
4 of the 10 scored principles are NOT explicitly requested in generation prompts — the AI must infer them:
- **Productive failure** — scored but never named in generation system prompts
- **Critique culture** — scored but not prompted directly
- **Digital + physical balance** — scored but only hinted at indirectly
- **Safety culture** — scored as critical for workshop units but only via content role "warning"

These should be added as explicit generation rules so the AI is told to include them, not just scored on whether it guessed to.

## Implementation Roadmap

### Phase 1: Prompt Enhancement (no schema/DB changes)
**Status: ✅ COMPLETE (March 14, 2026)**
Commit: 4feb1fe — all 4 items implemented as prompt-only changes.

**Impact: HIGH | Effort: LOW**

1. **Learning intentions + success criteria** — add to per-lesson generation prompts
   - Generate 1 learning intention + 2-3 success criteria per lesson
   - Process-focused for Design (tied to design cycle phase, not content recall)
   - Include in activity schema as `learningIntention` and `successCriteria` fields

2. **Lesson-type-aware structure** — add lesson type classification to skeleton generation
   - Skeleton prompt learns to tag each lesson with a type (research/ideation/skills-demo/making/testing/critique)
   - Per-lesson generation gets the type and applies the correct structure template
   - Making lessons get longer core blocks; research lessons get more scaffolded chunks

3. **Explicit generation rules for 4 under-prompted principles**
   - Add "productive failure", "critique culture", "digital+physical balance", "safety culture" as named rules in generation system prompts
   - Align what's scored with what's prompted

4. **Teacher questioning banks**
   - Generate 3-5 questions per lesson at 3 levels (recall, analysis, evaluation)
   - Included in teacher notes/sidebar, not shown to students
   - Questions for circulation during making time

### Phase 2: Spaced Practice & Self-Assessment (schema additions)

> **✅ Phase 2 COMPLETE** (2026-03-14) — Implemented via prompt-only + schema changes:
> - Skeleton schema extended with `cumulativeVocab` and `cumulativeSkills` per lesson
> - Per-lesson prompts inject spaced retrieval context from all prior lessons
> - Self-assessment prediction triggered at criterion phase boundaries and final lesson
> - Compare/contrast framework guidance injected for research lesson types
> - Quality evaluator structural checks added for spaced retrieval and self-assessment
> - Both TIMELINE and JOURNEY system prompts updated with Phase 2 strategies

**Impact: HIGH | Effort: MEDIUM**

5. **Spaced retrieval warm-ups**
   - Per-lesson prompt gets prior lesson vocabulary/skills/safety rules
   - Generates a 3-5 min retrieval starter that spirals back earlier content
   - "Recall the 3 properties of your chosen material from Lesson 2"
   - Requires skeleton to track cumulative vocabulary/skills list

6. **Self-assessment prediction prompts**
   - Before key submissions (end of each criterion phase), generate a self-prediction activity
   - "Look at the Criterion B rubric. What level do you think you've achieved? Circle it and write 1 sentence explaining why."
   - d=1.44 — highest effect size in all of Hattie's research

7. **Compare/contrast templates for Criterion A**
   - When lesson type is "research/investigation", generate product analysis frameworks
   - Side-by-side comparison templates with guided questions
   - Maps to Marzano's #1 strategy (d=1.61)

### Phase 3: Learning from Uploads (knowledge pipeline enhancement)
**Impact: MEDIUM | Effort: MEDIUM**

8. **Extract lesson structure patterns from uploaded plans**
   - When teachers upload lesson plans, extract: lesson type, timing per phase, structure pattern
   - Store as structured metadata on lesson profiles
   - Feed into generation: "Teachers who uploaded similar lessons used 35-min making blocks"

9. **Extract questioning patterns from uploaded materials**
   - Identify teacher questions in uploaded docs
   - Use as exemplars for question bank generation

### Phase 4: Quality Evaluator Expansion
**Impact: MEDIUM | Effort: LOW**

10. **Add HITS-aligned quality principles**
    - `learning_intentions` — does every lesson have clear LI + SC?
    - `spaced_practice` — are earlier skills/vocab revisited in later lessons?
    - `lesson_structure_fit` — does the structure match the lesson type?
    - `questioning_depth` — are questions at multiple cognitive levels?

11. **Score explicit teaching sequence for skills lessons**
    - For lessons tagged as "skills-demo" or "making", check for demo→guided→independent sequence
