# Expert AI-in-Education Systems Audit

**Date:** March 2026
**Auditor:** Claude (AI Systems Consultant)
**Scope:** Full codebase analysis of Questerra/StudioLoom — RAG architecture, prompt engineering, Claude API usage, data pipeline, pedagogical alignment, code quality

---

## 1. Executive Summary

This is a **remarkably sophisticated system for a solo teacher-developer**. Questerra is not a toy project — it implements patterns (hybrid RAG with quality-weighted retrieval, 3-pass pedagogical analysis, Bloom's-adaptive Socratic mentoring, configurable generation emphasis dials) that many funded edtech startups don't achieve. The RAG architecture is genuinely well-designed with dual retrieval (text chunks + structured lesson profiles), and the prompt engineering demonstrates deep understanding of both Claude's capabilities and MYP pedagogy.

**Maturity Level: Advanced Prototype → Early Production.** The AI pipeline is production-grade. The gaps are in operational infrastructure (monitoring, rate limiting, automated testing) and some missing safeguards around academic integrity — which are addressable without architectural changes.

---

## 2. Strengths

### RAG Architecture — Genuinely Impressive
- **Hybrid search** combining vector similarity (Voyage AI `voyage-3.5`, 1024-dim) + BM25 full-text search + quality scoring, with configurable weights. Scoring formula: `(0.7 × (0.8 × vector + 0.2 × BM25)) + (0.3 × quality)` in `supabase/migrations/010_knowledge_base.sql`.
- **Dual retrieval strategy**: text chunks for specific examples AND structured `LessonProfile` objects for pedagogical patterns — retrieved separately via `retrieveContext()` (`src/lib/knowledge/retrieve.ts`) and `retrieveLessonProfiles()` (`src/lib/knowledge/retrieve-lesson-profiles.ts`). Most RAG systems miss this.
- **Analysis-informed chunking** (`chunkDocumentWithProfile()` in `src/lib/knowledge/chunk.ts`) aligns chunk boundaries to lesson phases rather than naive fixed-size splitting. Each chunk carries rich pedagogical metadata (phase type, cognitive level, scaffolding strategies).
- **Quality feedback loop**: chunks accumulate `times_retrieved`, `times_used`, `fork_count`, and `teacher_rating` signals that influence future retrieval ranking. Self-improving knowledge base.
- **HNSW indexing** with cosine distance for vectors + GIN indexing for full-text search. Appropriate index choices for the workload.

### Prompt Engineering — Curriculum-Expert Quality
- **Framework-aware vocabulary** (`src/lib/ai/framework-vocabulary.ts`) adapts terminology across IB MYP, GCSE DT, ACARA, and PLTW — not just labels but command verbs, assessment structures, and design cycle phases.
- **Teacher context injection** (`src/lib/ai/teacher-context.ts`) personalises generation with school name, period length, grade levels taught, and pedagogical preferences.
- **20 configurable generation emphasis dials** (1-10 scale) in `src/types/ai-model-config.ts` — covering everything from `scaffoldingFade` to `critiqueCulture` to `safetyCulture`. Admin-configurable with history tracking in `ai_model_config_history` table.
- **Design Assistant prompt** (`src/lib/ai/design-assistant-prompt.ts`) implements Richard Paul's 6 question types, Bloom's-adaptive complexity, effort-gating with a 3-strike system, and conversation-stage awareness. 300-token cap prevents spoon-feeding.
- **RAG context injection** clearly delineated: lesson profiles first (high-level patterns), then text chunks (specific examples), separated by `---`. Context injected as markdown sections with source attribution.

### Claude API Usage — Architecturally Sound
- **Tool use for structured output** (`src/lib/ai/anthropic.ts`) — forces JSON schema compliance via `tool_choice: { type: "tool", name: tool.name }`. No "please return only JSON" hacking.
- **Provider abstraction** (`src/lib/ai/index.ts`) with fallback chain: Anthropic → Groq (Llama 3.3 70B) → Gemini Flash. Clean factory pattern.
- **Streaming via SSE** for all generation endpoints — progressive JSON deltas reduce perceived latency during 10-30 second generation tasks.
- **Model-appropriate selection**: Sonnet 4 for heavy generation (16K tokens), Haiku 4.5 for fast Socratic responses (300 token cap, ~1-2s), extended thinking for admin testing.
- **Self-healing validation** (`src/lib/ai/validation.ts`) — invalid `responseType` defaults to "text", bad reflection types default to "confidence-slider", missing durations default to 10 minutes. Graceful degradation, not hard failures.
- **Dynamic token allocation**: `maxTokens = max(16000, lessonIds.length * 2500)` scales to content size, preventing over-allocation.

### Pedagogical Design — Evidence-Based
- **10 pedagogy principles** enforced via quality evaluation (`src/lib/ai/quality-evaluator.ts`): iteration, productive failure, diverge-converge, scaffolding fade, process assessment, critique culture, digital-physical balance, differentiation, metacognitive framing, safety culture.
- **Grade-level timing profiles** (`src/lib/ai/model-config-defaults.ts`) cap cognitive load by MYP year: Year 1 gets 12 min max high-cognitive time; Year 5 gets 30 min.
- **3-tier ELL scaffolding** (sentence starters → guided prompts → extension challenges) with 50% coverage targets.
- **The Socratic mentor doesn't give answers** — it asks one question at a time, adapts Bloom's level based on demonstrated capability, and redirects low-effort responses to concrete actions rather than more questions.

### Data Pipeline — Comprehensive
- **8-step ingestion** (`src/app/api/teacher/knowledge/upload/route.ts`): extract → vision → 3-pass AI analysis → lesson profile → chunk → embed → store → library entry. SSE progress streaming throughout.
- **Multi-format support**: PDF, DOCX, PPTX with structural heading preservation.
- **3-pass analysis** separates structure extraction (Haiku), pedagogical analysis (Sonnet), and workshop/design-teaching intelligence (Sonnet) — merged deterministically into a `LessonProfile`.
- **Raw text always preserved** for re-analysis when prompts improve.

### Security & Auth
- **AES-256-GCM encryption** (`src/lib/encryption.ts`) for teacher BYOK API keys — proper IV randomization, authenticated encryption.
- **Student sessions**: HttpOnly, Secure, SameSite=Lax cookies with 7-day TTL.
- **RLS policies** in Supabase enforce data isolation: students read/write own data only, teachers access own students only.
- **`.env.local` properly gitignored** — secrets not in version control.

---

## 3. Critical Gaps

### Gap 1: No Re-Ranking Beyond SQL
Retrieval ranking happens entirely in the `match_knowledge_chunks` RPC function. There is **no application-level re-ranking** — no cross-encoder, no LLM-based relevance scoring, no MMR (Maximal Marginal Relevance) for diversity. For 5-8 chunks this is acceptable, but as the knowledge base grows, retrieval quality will degrade without a re-ranking stage.

**Files**: `src/lib/knowledge/retrieve.ts`, `supabase/migrations/010_knowledge_base.sql`

### Gap 2: No Automated Testing
There are **zero test files** in the repository. No unit tests for chunking logic, no integration tests for the RAG pipeline, no snapshot tests for prompts, no E2E tests for student flows. For a system generating educational content via AI, this is the highest-risk gap — prompt changes could silently degrade output quality.

### Gap 3: No Rate Limiting or Usage Monitoring
Student design assistant requests (`/api/student/design-assistant`) have no rate limiting. A student (or bot) could exhaust API credits. There's no per-student or per-class usage tracking, no cost monitoring dashboard, and no circuit breaker for runaway API spending.

### Gap 4: No Plagiarism or AI-Detection Integration
The system relies on process documentation and portfolio capture to ensure academic integrity, but there's **no automated plagiarism detection** (Turnitin, Copyscape) and no mechanism to detect if a student is pasting AI-generated content into response fields. The Socratic mentor is well-guarded, but free-text response fields are unprotected. (Note: MonitoredTextarea is planned in Phase 6 of the roadmap but not yet built.)

### Gap 5: No Structured Logging or Observability
All error handling logs to `console.error`. There's no Sentry, no structured logging, no request tracing, no alerting. In production, you're flying blind — you won't know if the RAG pipeline is returning poor results, if API calls are failing silently, or if students are hitting errors.

---

## 4. Quick Wins

| # | Item | Effort | Impact |
|---|------|--------|--------|
| QW1 | **Rate limiting** on `/api/student/design-assistant` — in-memory `Map<studentId, timestamp[]>`, 20 req/student/hour | 1-2h | Prevents credit exhaustion |
| QW2 | **Prompt snapshot tests** — `__tests__/prompts/` with snapshots for `buildDesignAssistantSystemPrompt()`, `UNIT_SYSTEM_PROMPT`, `buildRAGCriterionPrompt()` | 2-3h | Prevents silent prompt regressions |
| QW3 | **Sentry integration** — `@sentry/nextjs` wrapping API routes | 1h | Error tracking + alerting |
| QW4 | **Usage tracking table** — `ai_usage_log`: teacher_id, student_id, endpoint, model, input_tokens, output_tokens, timestamp | 1h | Cost visibility |
| QW5 | **Response length heuristic** — flag suspiciously long/complex student responses for teacher review | 30m | Low-effort integrity safeguard |

---

## 5. Advanced Recommendations

### AR1: Cross-Encoder Re-Ranking
After hybrid retrieval, pass the top 15-20 chunks through a cross-encoder (e.g., Cohere `rerank-v3.5` or Voyage AI reranker) to re-score for query relevance. Return top 5. Dramatically improves retrieval precision as the knowledge base scales past ~1000 chunks.

### AR2: Agentic Assessment Workflow
Build a multi-step assessment pipeline:
1. Retrieve relevant rubric strand descriptors
2. Analyse student submission against each strand
3. Generate strand-level feedback with specific evidence
4. Suggest targeted improvements with exemplar references
5. Track feedback patterns across submissions

This would transform the platform from content generation to formative assessment — the highest-value use case for AI in MYP Design. Aligns with the planned Teacher Marking & Grading Assistance in Phase 4.

### AR3: Multi-Modal Student Work Analysis
Use Claude's vision capabilities to analyse student prototype photos, sketches, and CAD screenshots against design specifications. MYP Design is inherently visual — Criterion C (Creating) evidence is almost always photographic. An AI that can look at a student's prototype and say "your joints don't match your technical drawing" would be genuinely transformative.

### AR4: Semantic Chunking with Contextual Headers
Replace the current heuristic chunking with a semantic approach: use an embedding model to detect topic boundaries, then prepend each chunk with a document-level context header (title + section path + surrounding chunk summaries). This is the "contextual retrieval" pattern from Anthropic's research and typically improves retrieval by 20-35%.

### AR5: Teacher Dashboard for AI Insights
Build a dashboard showing:
- Which knowledge base items are most/least retrieved
- Common student misconceptions (aggregated from design assistant conversations)
- Quality score trends across chunks
- Cost per student per unit
- Bloom's level progression per student across conversations

The data model already supports most of this — it's primarily a UI build.

---

## 6. Priority Roadmap

For a single teacher-developer with limited time:

| Priority | Item | Effort | Impact | Why Now |
|----------|------|--------|--------|---------|
| 1 | Usage tracking table (QW4) | 1h | High | Need cost visibility before scaling |
| 2 | Rate limiting (QW1) | 1-2h | High | Prevents credit exhaustion |
| 3 | Sentry integration (QW3) | 1h | High | Need to know when things break |
| 4 | Prompt snapshot tests (QW2) | 2-3h | High | Prevents silent prompt regressions |
| 5 | Response flagging heuristic (QW5) | 30m | Medium | Low-effort integrity safeguard |
| 6 | Teacher AI insights dashboard (AR5) | 1-2 weeks | High | Differentiator; data already exists |
| 7 | Agentic assessment workflow (AR2) | 2-3 weeks | Very High | Highest-value feature gap |
| 8 | Cross-encoder re-ranking (AR1) | 1 week | Medium | Matters when KB exceeds ~1000 chunks |
| 9 | Multi-modal analysis (AR3) | 2 weeks | High | Natural extension of vision extraction |
| 10 | Semantic chunking upgrade (AR4) | 1 week | Medium | Incremental improvement on solid base |

---

## 7. Detailed File Reference

### Core AI Files
| File | Purpose |
|------|---------|
| `src/lib/ai/anthropic.ts` | Anthropic provider — tool use, streaming, validation (387 lines) |
| `src/lib/ai/openai-compatible.ts` | OpenAI-compatible fallback provider (84 lines) |
| `src/lib/ai/index.ts` | Provider factory (42 lines) |
| `src/lib/ai/prompts.ts` | System & generation prompts (~27K tokens) |
| `src/lib/ai/design-assistant-prompt.ts` | Socratic mentor system prompt (258 lines) |
| `src/lib/ai/schemas.ts` | Tool use & structured output schemas |
| `src/lib/ai/resolve-credentials.ts` | API key resolution with fallback chain (89 lines) |
| `src/lib/ai/validation.ts` | Output validation & self-healing (207 lines) |
| `src/lib/ai/framework-vocabulary.ts` | Curriculum-aware terminology (100+ lines) |
| `src/lib/ai/teacher-context.ts` | Teacher context fetcher (76 lines) |
| `src/lib/ai/model-config.ts` | Config loader with 60s cache (187 lines) |
| `src/lib/ai/model-config-defaults.ts` | Hardcoded defaults (316 lines) |
| `src/lib/ai/quality-evaluator.ts` | 10-principle quality weighting |
| `src/lib/ai/embeddings.ts` | Voyage AI embedding client |

### Knowledge Base Files
| File | Purpose |
|------|---------|
| `src/lib/knowledge/chunk.ts` | Chunking strategies (heuristic + analysis-informed) |
| `src/lib/knowledge/retrieve.ts` | Chunk retrieval + hybrid search |
| `src/lib/knowledge/retrieve-lesson-profiles.ts` | Lesson profile retrieval + pedagogical formatting |
| `src/lib/knowledge/extract.ts` | Document extraction (PDF/DOCX/PPTX) |
| `src/lib/knowledge/analyse.ts` | 3-pass AI analysis orchestration |
| `src/lib/knowledge/analysis-prompts.ts` | Teaching context block builder |
| `src/lib/knowledge/feedback.ts` | Quality score updates from feedback |

### Key API Routes
| Route | Model | Purpose |
|-------|-------|---------|
| `/api/teacher/generate-unit` | Sonnet 4 | Criterion page generation (streaming) |
| `/api/teacher/generate-outlines` | Sonnet 4 | Multiple approach options |
| `/api/teacher/generate-journey` | Sonnet 4 | Journey mode lessons |
| `/api/teacher/generate-timeline` | Sonnet 4 | Timeline mode activities |
| `/api/student/design-assistant` | Haiku 4.5 | Socratic mentoring (300 token cap) |
| `/api/teacher/knowledge/upload` | Sonnet 4 + Haiku | Ingestion pipeline (vision + 3-pass analysis) |
| `/api/admin/ai-model/test` | Sonnet 4 | Config testing with extended thinking |

### Database Schema
| Migration | Content |
|-----------|---------|
| `010_knowledge_base.sql` | `knowledge_chunks` table, HNSW index, `match_knowledge_chunks` RPC |
| `018_lesson_intelligence.sql` | `lesson_profiles` + `lesson_feedback` tables, `match_lesson_profiles` RPC |
| `022_design_assistant.sql` | Design assistant conversation schema |
| `024_ai_model_config.sql` | AI model config + history tables |
