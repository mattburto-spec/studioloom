# StudioLoom AI Reasoning Model — Summary & Gap Analysis

Last updated: March 13, 2026

---

## The Elevator Pitch

StudioLoom uses a 5-layer AI system that doesn't just generate lesson plans — it learns from every lesson taught and gets smarter over time. Each layer serves a different user at a different moment:

1. **Teachers create** → AI generates pedagogically-sound units
2. **Teachers teach** → Feedback flows back to improve future generation
3. **Students learn** → AI mentor asks Socratic questions (never gives answers)
4. **System validates** → Every generated unit is scored against 10 pedagogy principles
5. **Community grows** → Cross-teacher patterns make AI better for everyone (future)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TEACHER CREATES A UNIT                          │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐    │
│  │ Teaching  │   │ Framework│   │   RAG    │   │  Feedback    │    │
│  │ Context   │   │  Vocab   │   │ Chunks   │   │  from Past   │    │
│  │ (school,  │   │ (MYP vs  │   │ (similar │   │  Lessons     │    │
│  │ equipment)│   │ GCSE vs  │   │ lessons) │   │  (Layer 2)   │    │
│  │           │   │ PLTW...) │   │          │   │              │    │
│  └─────┬─────┘   └─────┬────┘   └─────┬────┘   └──────┬───────┘    │
│        └────────────────┴──────────────┴───────────────┘            │
│                              │                                      │
│                    ┌─────────▼──────────┐                           │
│                    │   LAYER 1          │                           │
│                    │   Unit Generation  │                           │
│                    │   (Sonnet)         │                           │
│                    │                    │                           │
│                    │ Goal → 3 Outlines  │                           │
│                    │ → Skeleton Review  │                           │
│                    │ → Per-Lesson Gen   │                           │
│                    └─────────┬──────────┘                           │
│                              │                                      │
│                    ┌─────────▼──────────┐                           │
│                    │   LAYER 4          │                           │
│                    │   Quality Check    │                           │
│                    │   (Haiku, ~2s)     │                           │
│                    │                    │                           │
│                    │ 10 pedagogy        │                           │
│                    │ principles scored  │                           │
│                    │ 0-10 each          │                           │
│                    └─────────┬──────────┘                           │
│                              │                                      │
│                    ┌─────────▼──────────┐                           │
│                    │   TEACHER REVIEWS  │                           │
│                    │   Quality badge    │                           │
│                    │   + warnings       │                           │
│                    │   + principle      │                           │
│                    │     scores         │                           │
│                    └─────────┬──────────┘                           │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│ TEACHER TEACHES  │ │ STUDENT WORKS   │ │ UNIT SAVED       │
│                  │ │                 │ │                  │
│  ┌────────────┐  │ │ ┌─────────────┐ │ │ ┌──────────────┐ │
│  │  LAYER 2   │  │ │ │  LAYER 3    │ │ │ │ quality_report│ │
│  │  Feedback  │  │ │ │  Socratic   │ │ │ │ JSONB stored │ │
│  │  Loop      │  │ │ │  Mentor     │ │ │ │ on unit      │ │
│  │            │  │ │ │  (Haiku)    │ │ │ └──────────────┘ │
│  │ "Timing    │  │ │ │             │ │ │                  │
│  │  was too   │  │ │ │ Asks ONE    │ │ │ ┌──────────────┐ │
│  │  long on   │  │ │ │ question,   │ │ │ │ teacher_id   │ │
│  │  activity  │  │ │ │ NEVER gives │ │ │ │ tracked      │ │
│  │  3"        │  │ │ │ answers     │ │ │ └──────────────┘ │
│  │            │  │ │ │             │ │ └──────────────────┘
│  │ Boosts/    │  │ │ │ Bloom's     │ │
│  │ penalises  │  │ │ │ adaptive    │ │
│  │ RAG chunk  │  │ │ │ (1→6)      │ │
│  │ quality    │  │ │ │             │ │
│  └─────┬──────┘  │ │ │ 3-strike   │ │
│        │         │ │ │ effort     │ │
│        │ feeds   │ │ │ gating     │ │
│        │ back    │ │ └─────────────┘ │
│        │ into    │ │                 │
│        ▼         │ │                 │
│  ┌────────────┐  │ └─────────────────┘
│  │ Future     │  │
│  │ generation │  │
│  │ prompts    │  │
│  │ get richer │  │
│  └────────────┘  │
└──────────────────┘

┌──────────────────────────────────────────┐
│   LAYER 5: Community Intelligence        │
│   (FUTURE — not built yet)               │
│                                          │
│   Cross-teacher pattern learning         │
│   "Making activities take 1.5x           │
│    estimated time across 200 teachers"   │
│                                          │
│   Original files NEVER shared.           │
│   Only extracted intelligence.           │
└──────────────────────────────────────────┘
```

---

## Layer-by-Layer Summary (for explaining to others)

### Layer 1: Unit Generation
**Who:** Teachers | **Model:** Sonnet | **Status:** ✅ Complete

The teacher enters an end goal ("Students design sustainable packaging"), and the AI generates a full unit: 3 approach options → teacher picks one → lesson skeleton → per-lesson activities with scaffolding, media, and assessment tags.

The AI is personalised — it knows the teacher's curriculum (MYP vs GCSE vs PLTW), their school context (equipment, class size), and uses the correct vocabulary for their framework. It also retrieves similar lessons from the knowledge base (RAG) and injects feedback from teachers who taught similar content.

### Layer 2: Feedback Loop
**Who:** Teachers + Students | **Status:** ✅ Backend complete, ⚠️ collection UI unwired

After a teacher teaches a generated lesson, they can submit feedback: "timing was too long," "students loved the prototyping activity," "the research phase needs more scaffolding." This feedback:
- Aggregates across all teachers who taught similar content
- Adjusts quality scores on RAG chunks (good lessons get retrieved more)
- Injects real teaching experience into future generation prompts

**This is the moat.** Every lesson taught makes the next generated unit better.

### Layer 3: Student Design Assistant
**Who:** Students | **Model:** Haiku | **Status:** ✅ API complete, ⚠️ no chat UI

A Socratic mentor that helps students think through their design process. Based on Khanmigo research:
- **Never gives answers** — only asks questions
- **One question per response** — forces the student to think
- **Bloom's adaptive** — starts with concrete questions, escalates as student demonstrates capability
- **3-strike effort gating** — if student keeps asking without trying, AI zooms out
- **Framework-aware** — uses correct vocabulary for the teacher's curriculum
- **Activity-aware** — knows what the student is currently working on

### Layer 4: Quality Evaluator
**Who:** System (internal) | **Model:** Haiku | **Status:** ✅ Complete + tested

Every generated unit is automatically scored against 10 pedagogy principles before the teacher sees it. Each principle gets a 0-10 score with specific issues and suggestions. Teachers see a quality badge (green/amber/red) with expandable details.

The 10 principles: iteration, productive failure, diverge-converge, scaffolding fade, process assessment, critique culture, digital-physical balance, differentiation, metacognitive framing, safety culture.

### Layer 5: Community Intelligence
**Who:** System + All Teachers | **Status:** ⏳ Deferred

Cross-teacher pattern learning. "Making activities take 1.5x estimated time across 200 teachers." Original files never shared — only extracted intelligence. Curriculum-scoped retrieval (IB teacher gets IB patterns). Designed but not needed until multiple teachers are on the platform.

---

## Gap Analysis

### Critical Gaps — ✅ ALL RESOLVED (March 13)

| # | Gap | Layer | Resolution |
|---|-----|-------|------------|
| 1 | ~~Feedback UI not wired to pages~~ | 2 | ✅ `TeacherFeedbackForm` mounted on teacher unit detail page. `StudentFeedbackPulse` shown as modal after page completion. |
| 2 | ~~`recordGenerationUsage()` never called~~ | 2 | ✅ `ragChunkIds` captured from all SSE events into WizardState. `recordGenerationUsage()` called fire-and-forget on unit save via `/api/teacher/knowledge/record-usage`. |
| 3 | ~~No student chat widget~~ | 3 | ✅ `DesignAssistantWidget` (floating chat bubble, bottom-left) mounted on student page. Wired to existing API. |

### The Feedback Loop — ✅ CLOSED

```
Teacher creates unit ──→ AI generates ──→ Teacher teaches ──→ Submits feedback
       ▲                                                           │
       └───────────── Feedback enriches next generation ◄──────────┘
```

All components wired: feedback form on teacher unit page, student pulse after page completion, RAG chunk usage recorded on save, aggregated feedback injected into generation prompts.

### The Design Assistant — ✅ VISIBLE

```
Student opens page ──→ Sees lightbulb icon ──→ Asks for help ──→ AI asks guiding question
                                                                      │
                                                                Never gives answers,
                                                                adapts to Bloom's level
```

### Gaps That Can Wait

| # | Gap | Layer | Impact | Why it can wait |
|---|-----|-------|--------|-----------------|
| 5 | **No quality history on re-generation** | 4 | Quality report saved once, not updated on edit | Teachers won't regenerate frequently at first |
| 6 | **No quality dashboard across units** | 4 | Teachers can only see quality during wizard, not on unit list | Nice-to-have, not blocking |
| 7 | **Framework vocab not in per-lesson prompts** | 1 | Per-lesson activity generation doesn't apply framework vocabulary | Teaching context IS injected, vocab is mainly cosmetic |
| 8 | **501 fallbacks in generation routes** | 1 | Non-streaming fallbacks return 501 if provider lacks method | Only affects non-Anthropic providers (none exist yet) |
| 9 | **Community Intelligence** | 5 | No cross-teacher learning | Only matters with multiple teachers |
