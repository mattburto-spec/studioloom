# StudioLoom AI Reasoning Model — Touchpoint Summary

## Part 1: Document Ingestion (What Gets Measured)

When a teacher uploads a document (PDF, DOCX, PPTX), StudioLoom runs a multi-stage analysis pipeline. Here's every touchpoint where data is extracted or measured.

### Stage 1: Text & Visual Extraction
| Touchpoint | What's Measured | File |
|---|---|---|
| Text extraction | Full structured text preserving sections/headings | `lib/knowledge/extract.ts` |
| Visual extraction | Diagrams, charts, images → text descriptions via vision AI | `lib/knowledge/vision.ts` |
| Quality gate | Minimum 50 characters of text or visual content required | `api/teacher/knowledge/upload/route.ts` |

### Stage 2: 3-Pass AI Analysis (creates LessonProfile)
| Pass | Model | What's Measured | Weight |
|---|---|---|---|
| **Pass 1: Structure** | Haiku | Title, subject area, grade level, lesson type, estimated duration, materials list | Foundation — not weighted, all downstream analysis depends on this |
| **Pass 2: Pedagogy** | Sonnet | Scaffolding strategy, cognitive load curve, energy states per phase, pedagogical approach, teacher role per phase | High — drives how future units get structured |
| **Pass 3: Design Teaching** | Sonnet | Criterion alignment (A/B/C/D), strengths, gaps, safety considerations, activity types | High — drives criterion coverage and gap detection |

### Stage 3: Chunking & Embedding
| Touchpoint | What's Measured | File |
|---|---|---|
| Heuristic chunking | Section boundaries, paragraph breaks (200-2000 char target) | `lib/knowledge/chunk.ts` |
| Profile-informed chunking | Aligns chunks to lesson flow phases from Pass 2 analysis | `lib/knowledge/chunk.ts` |
| Context preamble | Pedagogical purpose, teacher role, cognitive level, energy state per chunk | `lib/knowledge/chunk.ts` |
| Embedding | 1024-dim Voyage 3.5 vectors for semantic search | `lib/ai/embeddings.ts` |
| Metadata tagging | Grade level, subject, topic, criterion, source category | `api/teacher/knowledge/upload/route.ts` |

### Stage 4: Quality Signals (ongoing, post-ingestion)
| Signal | How It's Measured | Impact |
|---|---|---|
| `times_retrieved` | Incremented each time chunk appears in RAG results | Boosts future retrieval ranking |
| `times_used` | Incremented when chunk is in a saved unit | Boosts quality score |
| `fork_count` | Incremented when unit containing chunk is forked | Social proof signal |
| `quality_score` | Teacher/student feedback adjusts score (±0.05 to ±0.1) | Directly weights RAG retrieval (30% of final score) |
| Teacher rating | 1-5 satisfaction + would_use_again boolean | Positive = +0.05-0.1, Negative = -0.1 |
| Student understanding | 1-5 understanding + pace perception | Fine-grained signal on actual learning |

---

## Part 2: Unit Generation (What the AI Considers)

When the AI generates a unit, here's every factor it considers, organized by generation stage, with a **relative emphasis weight** (1-10 scale).

### Stage 1: Outline Generation (3 approaches)

| Factor | Weight | Source | Description |
|---|---|---|---|
| End goal / design brief | **10** | Teacher input | The north star — everything backward-maps from this |
| Topic + title | **8** | Teacher input | Defines subject domain |
| Grade level / MYP year | **8** | Teacher input | Drives timing, complexity, scaffolding level |
| Duration (weeks × lessons) | **7** | Teacher input | Constrains scope |
| Assessment criteria (A/B/C/D) | **7** | Teacher input | Must be distributed across the unit |
| Framework vocabulary | **6** | Teaching context | MYP vs GCSE vs PLTW language adaptation |
| Key/related concepts | **5** | Teacher input | Conceptual anchors |
| Global context | **5** | Teacher input | Real-world connection framing |
| Statement of inquiry | **5** | Teacher input | Conceptual understanding target |
| ATL skills | **4** | Teacher input | Skills emphasis |
| RAG knowledge chunks | **5** | Knowledge base | Similar past content as inspiration |
| Lesson profiles | **5** | Knowledge base | Pedagogical patterns from similar uploads |
| Aggregated feedback | **6** | Feedback loop | Real teaching experience — timing, struggles, what worked |
| Teaching context (school, resources) | **4** | Teacher profile | Constraints and opportunities |
| Specific making skills | **4** | Teacher input | Tool/technique requirements |
| Special requirements | **3** | Teacher input | Accessibility, resource constraints |

### Stage 2: Skeleton Generation (lesson-level outline)

| Factor | Weight | Source | Description |
|---|---|---|---|
| Selected approach | **9** | Teacher choice | The chosen outline drives all structure |
| End goal backward mapping | **9** | Prompt rule | Learning intentions chain backward from end goal |
| Lesson type classification | **8** | HITS Phase 1 | 6 types: research, ideation, skills-demo, making, testing, critique |
| Learning intention per lesson | **8** | HITS Phase 1 | Process-focused, observable, backward-mapped |
| Success criteria per lesson | **8** | HITS Phase 1 | 2-3 observable criteria per LI |
| Cumulative vocab tracking | **6** | HITS Phase 2 | Powers spaced retrieval in later lessons |
| Cumulative skills tracking | **6** | HITS Phase 2 | Powers spaced retrieval in later lessons |
| Phase labels | **6** | Outline | Groups lessons into coherent phases |
| Criterion distribution | **7** | Prompt rule | Every criterion must appear, balanced across lessons |
| Narrative arc | **5** | Prompt rule | Emotional/intellectual flow of the unit |
| Bloom's progression | **5** | System prompt | Remember → Create over the unit |
| Scaffolding fade | **5** | System prompt | Heavy → Moderate → Minimal support arc |

### Stage 3: Per-Lesson Activity Generation

| Factor | Weight | Source | Description |
|---|---|---|---|
| Lesson skeleton context | **9** | Stage 2 output | Title, key question, timing, phase, criteria |
| Lesson type guidance | **8** | HITS Phase 1 | Type-specific structure (e.g. I Do/We Do/You Do for skills-demo) |
| Learning intention + SC | **8** | Stage 2 output | Activities must demonstrate these criteria |
| Grade-aware timing profile | **8** | Timing intelligence | Per-type max durations by MYP year |
| Spaced retrieval context | **7** | HITS Phase 2 | Prior vocab/skills injected for warm-up spiralling |
| Self-assessment prediction | **7** | HITS Phase 2 | Triggered at criterion boundaries (d=1.44) |
| Compare/contrast templates | **7** | HITS Phase 2 | Triggered for research lessons (d=1.61) |
| Neighboring lessons | **6** | Skeleton | Previous/next lesson for continuity |
| ELL scaffolding (3 tiers) | **6** | System prompt | ell1 (max), ell2 (moderate), ell3 (extension) |
| Teacher notes / questioning | **6** | HITS Phase 1 | 2-3 circulation questions at different cognitive levels |
| Productive failure | **5** | HITS Phase 1 | At least one safe-to-fail activity |
| Critique culture | **5** | HITS Phase 1 | Peer feedback every ~3 lessons |
| Digital + physical balance | **5** | HITS Phase 1 | Interleave screen and hands-on |
| Safety culture | **5** | HITS Phase 1 | Non-negotiable for making/testing |
| Activity card library | **4** | Database | Suggested activity templates to incorporate |
| RAG knowledge chunks | **5** | Knowledge base | Similar content for inspiration |
| Lesson profiles | **5** | Knowledge base | Pedagogical patterns from uploads |
| Aggregated feedback | **6** | Feedback loop | Real-world timing, struggles, what worked |
| Portfolio capture points | **4** | System prompt | 1-2 substantive activities per lesson |
| Content blocks (info/warning/tip) | **3** | System prompt | Safety warnings, key concepts, context |
| Media integration | **3** | System prompt | Images, videos, external tool links |
| Response type variety | **4** | System prompt | text, upload, voice, decision-matrix, pmi, etc. |

### Stage 4: Quality Evaluation (post-generation)

| Principle | Weight | Effect Size | What's Checked |
|---|---|---|---|
| Iteration | **7** | — | Students revise/improve based on feedback |
| Productive failure | **6** | d=0.82 | Safe spaces to fail and learn |
| Diverge-converge | **6** | — | Brainstorm before narrowing down |
| Scaffolding fade | **7** | d=0.82 | Support decreases across unit |
| Process assessment | **7** | — | Process assessed, not just final product |
| Critique culture | **6** | d=0.73 | Peer/self feedback embedded |
| Digital-physical balance | **5** | d=0.57 | Mix of digital and hands-on |
| Differentiation | **7** | — | ELL scaffolds, multiple entry points |
| Metacognitive framing | **6** | — | Students reflect on HOW they think |
| Safety culture | **5** | — | Safety woven naturally |

**Structural checks (fallback evaluator):**

| Check | What's Measured | Added |
|---|---|---|
| Reflection activities | At least 1 reflection role activity | Phase 1 |
| Warmup activities | At least 1 warmup role activity | Phase 1 |
| Portfolio captures | At least 1 portfolioCapture: true | Phase 1 |
| Timing variance | Total minutes within ±20% of expected | Phase 1 |
| Age-appropriate durations | Per-type limits by MYP year | Timing intelligence |
| ELL scaffolding coverage | ≥50% of core activities have ell1/ell2 | Phase 1 |
| Teacher notes presence | At least 1 activity with teacherNotes | Phase 1 |
| Safety for making | Safety mention when making/testing detected | Phase 1 |
| Spaced retrieval in warmups | ≥50% of warmups include vocabTerms | **Phase 2** |
| Self-assessment prediction | At least 1 reflection references rubric/prediction | **Phase 2** |

---

## Part 3: Feedback Loop (How the System Learns)

```
Teacher uploads doc → 3-pass analysis → chunks + embeddings → knowledge base
                                                                    ↓
Teacher generates unit ← RAG retrieval (weighted by quality_score) ←┘
        ↓
Teacher teaches the unit → submits feedback (rating, timing, what worked)
        ↓                        ↓
Student completes lessons    quality_score adjusted (±0.05 to ±0.1)
        ↓                        ↓
Student gives feedback     feedback aggregated → injected into future prompts
        ↓
Understanding + pace data → quality_score refined
```

### Feedback Signals and Their Impact

| Signal | Source | Quality Impact | Prompt Impact |
|---|---|---|---|
| Teacher satisfaction (1-5) | Post-teaching form | +0.05 to -0.1 on chunks | Average shown in context |
| Would use again | Teacher form | +0.1 bonus | Indirect (higher retrieval) |
| Actual vs planned duration | Teacher form | None directly | Timing reality injected per-phase |
| What worked well | Teacher form | None directly | Top 3 items injected as context |
| Suggested improvements | Teacher form | None directly | Top 3 items injected as context |
| Student understanding (1-5) | Student pulse | +0.05 to -0.05 on chunks | Average shown in context |
| Student pace perception | Student pulse | Flags if <60% "just right" | Pacing concern injected |
| Student struggles | Student pulse | None directly | Top 3 items injected as context |
| Chunk retrieval count | Automatic | Weights retrieval ranking | Indirect (popular = retrieved more) |
| Chunk usage in saved units | Automatic | Boosts quality score | Indirect |
| Unit fork count | Automatic | Boosts chunk scores | Social proof |

---

## Part 4: Relative Emphasis Map

Here's a visualization of where the AI's "attention" goes during generation, as a percentage of total emphasis:

```
                         RELATIVE EMPHASIS (approximate)
                         ================================

Teacher Input (direct)   ████████████████████████████████░░░  ~35%
  End goal, topic, grade, duration, criteria, concepts

Pedagogical Intelligence ████████████████████████░░░░░░░░░░░  ~25%
  Lesson types, LI/SC, backward mapping, timing profiles

Evidence-Based Strategies██████████████████░░░░░░░░░░░░░░░░░  ~18%
  HITS rules, spaced retrieval, self-assessment, compare/contrast
  Productive failure, critique culture, safety, scaffolding fade

Knowledge Base (RAG)     ████████████░░░░░░░░░░░░░░░░░░░░░░░  ~12%
  Uploaded chunks, lesson profiles, activity cards

Feedback Loop            ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ~7%
  Teacher/student feedback, timing reality, quality scores

Framework Adaptation     ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ~3%
  MYP/GCSE/PLTW vocabulary, assessment language
```

### Key Insight
The feedback loop currently has the lowest emphasis (~7%) because the system is pre-launch with no real teaching data. As teachers use the platform and submit feedback, this percentage will grow significantly — it's designed to become the most valuable differentiator over time. Every lesson taught makes the next generation better.

---

## Part 5: Research Foundation

| Strategy | Effect Size | Where It's Applied | Phase |
|---|---|---|---|
| Self-assessment prediction | d=1.44 | Criterion boundary reflections, final lesson | Phase 2 |
| Compare/contrast (Marzano) | d=1.61 | Research lesson activities | Phase 2 |
| Scaffolding | d=0.82 | Fade across unit, ELL tiers, lesson type structures | Phase 1 |
| Productive failure | d=0.82 | At least 1 safe-to-fail activity per unit | Phase 1 |
| Feedback | d=0.73 | Critique culture every ~3 lessons | Phase 1 |
| Spaced practice | d=0.71 | Vocabulary/skills spiralling in warm-ups | Phase 2 |
| Worked examples | d=0.57 | Digital planning before physical making | Phase 1 |
| Learning intentions | d=0.56-0.75 | Per-lesson, backward-mapped from end goal | Phase 1 |
| Questioning | — | Teacher circulation questions at 3 cognitive levels | Phase 1 |
| Safety culture | — | Non-negotiable for making/testing lessons | Phase 1 |

---

*Last updated: 2026-03-14*
*Covers: HITS Phase 1 + Phase 2 implementation*
