# Ingestion Companion Systems — Sub-Project Summaries

These sub-projects sit alongside the ingestion pipeline and are required for it to function end-to-end. Listed in dependency order.

---

## 1. Storage & Media Service

**Project name:** `storage-media`

**What it is:** Centralised file storage layer that both ingestion pipelines depend on. Handles the physical storage of all uploaded content.

**Responsibilities:**
- Supabase Storage bucket structure (separate buckets for teacher content, student work, processed assets, thumbnails)
- Upload policies and size limits per file type and user role
- Signed URLs for private student work (time-limited, scoped to school)
- CDN delivery for public/shared assets (exemplars, reference images)
- Thumbnail and preview generation triggers
- Lifecycle rules: auto-delete processing artifacts, archive old versions, retention policies per school
- Virus/malware scanning on upload

**Schema:**

```
storage_policies
  id, school_id, max_file_size_mb,
  allowed_mime_types, retention_days,
  archive_after_days
```

**Build order:** First — nothing else works without somewhere to put files.

---

## 2. Processing Queue

**Project name:** `job-queue`

**What it is:** Async job system for all heavy processing triggered by ingestion. Decouples upload from processing so students aren't waiting.

**Responsibilities:**
- Job creation, status tracking, retry logic with exponential backoff
- Dead letter queue for failed jobs (with alerting)
- Priority levels (student submission feedback > batch reprocessing)
- Job types: image enhancement, OCR, transcoding, thumbnail generation, text extraction, embedding generation, AI tagging
- Concurrency limits to manage API costs (especially AI calls)
- Status visible to students ("Your work is being processed...")

**Schema:**

```
jobs
  id, job_type, status (pending/processing/completed/failed),
  payload (jsonb), priority,
  attempts, max_attempts,
  created_at, started_at, completed_at,
  error_message, result (jsonb)
```

**Implementation:** Start with a Supabase `jobs` table + polling Edge Function on a cron. Migrate to a proper queue (pg_boss, BullMQ) only when volume demands it.

**Build order:** Second — needed before any processing or enrichment stage works.

---

## 3. RAG / Knowledge Layer

**Project name:** `knowledge-layer`

**What it is:** The system that makes teacher-uploaded content queryable by AI. Turns static documents into retrievable context for feedback, scaffolding, and mentoring.

**Responsibilities:**
- Text chunking strategy (by section, paragraph, or semantic boundary)
- Embedding generation (OpenAI or Anthropic embeddings)
- Vector storage in pgvector (Supabase extension)
- Retrieval logic: given a student submission + activity context, find the most relevant teacher content chunks
- Context window assembly: pack retrieved chunks + student history into a prompt without exceeding token limits
- Relevance ranking and filtering
- Re-indexing when teacher content is updated
- Cache layer for frequently retrieved content (e.g., the same rubric pulled hundreds of times)

**Schema:**

```
content_chunks
  id, content_asset_id, chunk_index,
  chunk_text, token_count,
  embedding (vector), metadata (jsonb)

retrieval_cache
  id, query_hash, context_key,
  retrieved_chunk_ids, created_at, ttl
```

**Build order:** Third — must exist before AI feedback can reference teacher expectations.

---

## 4. Feedback Engine

**Project name:** `feedback-engine`

**What it is:** The AI system that produces structured, criteria-linked feedback on student work. Not a chatbot — a purpose-built feedback generator with consistent output.

**Responsibilities:**
- Prompt architecture: system prompt + teacher content (from RAG) + student history (from work versions) + current submission
- Structured output schema: criteria ratings, specific observations, actionable next steps, confidence score, suggested design stage
- Scaffolding tier adaptation: different feedback depth/language for different ELL levels
- Feedback modes: quick check-in, deep critique, peer-comparison (anonymised), self-assessment prompt
- Teacher override: teachers can adjust, annotate, or replace AI feedback before students see it
- Feedback history: all feedback stored and linked to the work version that triggered it
- Cost management: token tracking per school, rate limiting, caching for similar submissions

**Schema:**

```
feedback_items
  id, work_version_id, feedback_type,
  generated_by (ai/teacher/peer),
  criteria_ratings (jsonb),
  observations (text), next_steps (text),
  confidence_score, scaffolding_tier,
  teacher_override (jsonb),
  tokens_used, model_used,
  created_at, visible_to_student (boolean)
```

**Build order:** Fourth — depends on both ingestion pipelines and the knowledge layer.

---

## 5. Moderation & Safety Layer

**Project name:** `moderation`

**What it is:** Content screening for all student-uploaded material before it reaches teacher queues, AI processing, or public-facing views.

**Responsibilities:**
- Image safety screening (inappropriate content, violence, personal information visible in photos)
- Text moderation (submissions, reflections, comments)
- AI-generated work detection (flag suspected AI-written text with confidence score)
- Plagiarism detection (cross-reference against other student submissions within school)
- PII detection in uploads (student accidentally photographs ID card, phone number on whiteboard, etc.)
- School-configurable policies (strictness levels, auto-block vs. flag-for-review)
- Moderation queue for flagged content with teacher review workflow
- Audit log of all moderation decisions

**Schema:**

```
moderation_results
  id, asset_id, check_type,
  result (pass/flag/block),
  confidence, details (jsonb),
  reviewed_by, review_decision,
  created_at

moderation_policies
  id, school_id, check_type,
  strictness (low/medium/high),
  action (auto_block/flag/log_only)
```

**Build order:** Fifth — must be in place before any student content is visible to others or processed by AI.

---

## 6. Notification Service

**Project name:** `notifications`

**What it is:** Generic OS-level service for delivering messages to users based on system events. The ingestion pipeline is its heaviest consumer.

**Responsibilities:**
- Event subscription: modules register which events trigger which notifications
- Channel support: in-app, email, push (mobile), parent digest
- Templates: per-event-type, per-role, per-language
- Preferences: users control what they receive and how
- Batching/digest: don't spam teachers with 30 individual submission alerts — batch into "12 new submissions in Period 3"
- Delivery tracking: sent, delivered, read
- School-configurable quiet hours

**Key ingestion-triggered notifications:**
- `work.submitted` → teacher: "New submission from [student] for [activity]"
- `feedback.ready` → student: "AI feedback on your [work] is ready"
- `work.overdue` → student + parent: "[Activity] submission overdue"
- `moderation.flagged` → teacher: "Submission flagged for review"
- `work.versioned` → teacher: "[Student] submitted revision #3"

**Schema:**

```
notification_templates
  id, event_type, role, channel,
  subject_template, body_template, language

notification_preferences
  id, user_id, event_type, channel,
  enabled, digest_frequency

notification_log
  id, user_id, event_type, channel,
  status (queued/sent/delivered/read),
  sent_at, read_at
```

**Build order:** Sixth — valuable from day one of pilot but not blocking for core functionality.

---

## 7. Portfolio Renderer

**Project name:** `portfolio`

**What it is:** The presentation layer that queries ingested work and assembles it into meaningful views for different audiences.

**Responsibilities:**
- Student view: timeline of work across all modules, version history with growth narrative, AI feedback trail, badges/XP earned
- Teacher view: class-wide progress, submission status grid, comparative analysis, assessment overview
- Parent view: curated highlights, progress summary, upcoming deadlines
- Export: PDF portfolio generation for end-of-year, college applications, or student-led conferences
- Gallery mode: anonymised exemplar showcase (opt-in) for peer learning
- Cross-module aggregation: pulls from StudioLoom, Jkids, future apps through the same work_items schema
- Customisable layout: students can curate which pieces appear in their public portfolio

**Schema:**

```
portfolio_config
  id, student_id, school_id,
  layout_preferences (jsonb),
  visibility (private/class/school/public)

portfolio_entries
  id, portfolio_config_id, work_item_id,
  display_order, student_caption,
  featured (boolean)
```

**Build order:** Seventh — the payoff layer. Depends on everything above being in place.

---

## Dependency Map

```
storage-media (1)
  └── job-queue (2)
       ├── ingestion-pipeline (teacher + student)
       │    ├── knowledge-layer (3)
       │    │    └── feedback-engine (4)
       │    └── moderation (5)
       ├── notifications (6)
       └── portfolio (7)
```

All systems share the OS-level concerns: auth, RBAC, school_id multi-tenancy, event bus, feature flags.
