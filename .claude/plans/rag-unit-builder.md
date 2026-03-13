# RAG-Enhanced AI Unit Builder — Implementation Plan

## Overview
Transform the existing AI Unit Builder from a single-shot generation tool into a world-class, learning system that gets smarter with every unit created. Teachers upload their existing lesson plans, the system ingests and indexes them, and future generations draw on the best examples from across the teacher community.

## Architecture Summary

```
INGEST → EMBED → STORE → RETRIEVE → GENERATE → FEEDBACK → IMPROVE
```

- **Embedding model**: Voyage 3.5 (1024-dim, $0.06/1M tokens, 200M free)
- **Vector store**: Supabase pgvector with halfvec(1024) + HNSW index
- **Hybrid search**: Vector similarity (70%) + BM25 keyword (30%)
- **Quality scoring**: Fork count, teacher ratings, edit distance, usage signals
- **Generation**: 3 distinct unit outline options using persona/constraint variation

---

## Phase A: Database & Embedding Infrastructure

### Step 1: Supabase migration — pgvector + knowledge base table

Create `supabase/migrations/010_knowledge_base.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source tracking
  source_type TEXT NOT NULL CHECK (source_type IN ('uploaded_plan', 'created_unit', 'activity_template')),
  source_id TEXT,                    -- unit ID or upload ID
  source_filename TEXT,              -- original file name for uploads
  teacher_id UUID REFERENCES auth.users(id),

  -- Content
  content TEXT NOT NULL,             -- the chunk text
  context_preamble TEXT,             -- contextual enrichment (Anthropic method)

  -- Structured metadata for filtering
  criterion TEXT CHECK (criterion IN ('A', 'B', 'C', 'D', NULL)),
  page_id TEXT,                      -- A1, B2, etc (if from a unit page)
  grade_level TEXT,
  subject_area TEXT,                 -- product-design, digital-design, electronics, etc
  topic TEXT,
  global_context TEXT,
  key_concept TEXT,
  content_type TEXT CHECK (content_type IN ('activity', 'instruction', 'assessment', 'vocabulary', 'overview', 'reflection')),

  -- Quality signals
  quality_score FLOAT DEFAULT 0.5,
  fork_count INT DEFAULT 0,
  teacher_rating FLOAT,
  times_retrieved INT DEFAULT 0,
  times_used INT DEFAULT 0,         -- how often this chunk was included in a generation that was accepted

  -- Embedding
  embedding halfvec(1024),

  -- Full-text search
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

  -- Visibility
  is_public BOOLEAN DEFAULT false,   -- shared with community or private to teacher

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast vector search
CREATE INDEX knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING hnsw (embedding halfvec_cosine_ops);

-- Full-text search index (for BM25 component)
CREATE INDEX knowledge_chunks_fts_idx
  ON knowledge_chunks
  USING gin (fts);

-- Metadata filter indexes
CREATE INDEX knowledge_chunks_criterion_idx ON knowledge_chunks (criterion);
CREATE INDEX knowledge_chunks_grade_idx ON knowledge_chunks (grade_level);
CREATE INDEX knowledge_chunks_teacher_idx ON knowledge_chunks (teacher_id);
CREATE INDEX knowledge_chunks_source_idx ON knowledge_chunks (source_type, source_id);
CREATE INDEX knowledge_chunks_public_idx ON knowledge_chunks (is_public) WHERE is_public = true;

-- Hybrid search RPC function
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding halfvec(1024),
  query_text TEXT DEFAULT '',
  match_count INT DEFAULT 10,
  similarity_weight FLOAT DEFAULT 0.7,
  quality_weight FLOAT DEFAULT 0.3,
  filter_criterion TEXT DEFAULT NULL,
  filter_grade TEXT DEFAULT NULL,
  filter_teacher_id UUID DEFAULT NULL,
  include_public BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  context_preamble TEXT,
  metadata JSONB,
  similarity FLOAT,
  quality_score FLOAT,
  final_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH vector_results AS (
    SELECT
      kc.id,
      kc.content,
      kc.context_preamble,
      jsonb_build_object(
        'source_type', kc.source_type,
        'criterion', kc.criterion,
        'page_id', kc.page_id,
        'grade_level', kc.grade_level,
        'subject_area', kc.subject_area,
        'topic', kc.topic,
        'global_context', kc.global_context,
        'content_type', kc.content_type,
        'fork_count', kc.fork_count,
        'teacher_rating', kc.teacher_rating
      ) AS metadata,
      1 - (kc.embedding <=> query_embedding) AS similarity,
      kc.quality_score,
      -- BM25 component via full-text rank
      CASE WHEN query_text != '' THEN
        ts_rank_cd(kc.fts, plainto_tsquery('english', query_text))
      ELSE 0 END AS text_rank
    FROM knowledge_chunks kc
    WHERE
      (filter_criterion IS NULL OR kc.criterion = filter_criterion)
      AND (filter_grade IS NULL OR kc.grade_level = filter_grade)
      AND (
        (filter_teacher_id IS NOT NULL AND kc.teacher_id = filter_teacher_id)
        OR (include_public AND kc.is_public = true)
      )
  )
  SELECT
    vr.id,
    vr.content,
    vr.context_preamble,
    vr.metadata,
    vr.similarity,
    vr.quality_score,
    (similarity_weight * (0.8 * vr.similarity + 0.2 * LEAST(vr.text_rank, 1.0)))
    + (quality_weight * COALESCE(vr.quality_score, 0.5)) AS final_score
  FROM vector_results vr
  ORDER BY final_score DESC
  LIMIT match_count;
$$;

-- Track upload history
CREATE TABLE knowledge_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,     -- pdf, docx, pptx
  file_size INT,
  chunk_count INT DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Step 2: Voyage AI embedding utility

Create `src/lib/ai/embeddings.ts`:
- `embedText(text: string): Promise<number[]>` — single text embedding via Voyage 3.5
- `embedBatch(texts: string[]): Promise<number[][]>` — batch embedding (up to 128 at once)
- Uses teacher's stored Voyage API key, or falls back to app-level key
- Endpoint: `https://api.voyageai.com/v1/embeddings`, model: `voyage-3.5`
- Returns 1024-dimension vectors

### Step 3: Document extraction utilities

Create `src/lib/knowledge/extract.ts`:
- Install `pdf-parse`, `mammoth`, `officeparser`
- `extractFromPDF(buffer: Buffer): Promise<ExtractedDoc>`
- `extractFromDOCX(buffer: Buffer): Promise<ExtractedDoc>`
- `extractFromPPTX(buffer: Buffer): Promise<ExtractedDoc>`
- `ExtractedDoc = { title: string, sections: { heading: string, content: string }[] }`
- Preserves document structure (headings, sections) for intelligent chunking

### Step 4: Chunking pipeline

Create `src/lib/knowledge/chunk.ts`:
- `chunkDocument(doc: ExtractedDoc, metadata: ChunkMetadata): Chunk[]`
- Structure-aware: split at section boundaries, then paragraphs
- Target chunk size: 200-400 tokens (~800-1600 chars)
- Overlap: 50 tokens between adjacent chunks
- Each chunk gets metadata: criterion (if detectable), content_type, grade, subject
- **Contextual enrichment**: Generate a 1-2 sentence preamble per chunk using Claude (describes what the chunk is about in context of the full document)

---

## Phase B: Ingestion Flows

### Step 5: Upload endpoint for teacher lesson plans

Create `src/app/api/teacher/knowledge/upload/route.ts`:
- POST: Accept multipart file upload (PDF, DOCX, PPTX, max 20MB)
- Extract text → chunk → embed → store in `knowledge_chunks`
- Create `knowledge_uploads` record to track status
- Process async (return upload ID immediately, process in background)
- Mark chunks as `is_public: false` by default (teacher's private corpus)

### Step 6: Auto-ingest created units

Create `src/lib/knowledge/ingest-unit.ts`:
- `ingestUnit(unit: Unit, teacherId: string, isPublic: boolean): Promise<void>`
- Called after a teacher saves/publishes a unit
- Chunks each page's content (title + learning goal + section prompts + scaffolding)
- One chunk per page (16 chunks per unit)
- Plus one overview chunk (unit title + topic + statement of inquiry + concepts)
- Metadata auto-populated from unit fields
- Hook into existing unit save flow in the edit page

### Step 7: Teacher knowledge base UI

Create `src/app/teacher/knowledge/page.tsx`:
- **Upload section**: Drag-drop zone for PDF/DOCX/PPTX files
- **Upload history**: List of uploaded files with status (processing/complete/failed), chunk count
- **My corpus stats**: "X chunks from Y uploads + Z created units"
- **Community toggle**: Option to make individual uploads public ("Share with community")
- **Delete upload**: Remove all chunks from a specific upload
- Link from teacher settings or sidebar

---

## Phase C: RAG-Enhanced Generation

### Step 8: Retrieval layer

Create `src/lib/knowledge/retrieve.ts`:
- `retrieveContext(params: RetrievalParams): Promise<RetrievedChunk[]>`
- Params: topic, criterion, grade, teacherId, maxChunks (default 10)
- Builds query embedding from topic + criterion description
- Calls `match_knowledge_chunks` RPC with filters
- Returns ranked chunks with metadata
- **Teacher's own content prioritised**: Retrieves from teacher's private corpus first, fills remaining slots from public corpus

### Step 9: Enhance generation prompts with RAG context

Modify `src/lib/ai/prompts.ts`:
- New function: `buildRAGEnrichedPrompt(criterion, input, retrievedChunks)`
- Injects retrieved chunks as "Reference Examples" section in the user prompt:

```
## Reference Examples from Similar Units
The following are excerpts from high-quality existing units on similar topics.
Use these as inspiration for structure, activity design, and scaffolding —
but create original content tailored to this specific unit.

### Example 1 (from "Sustainable Packaging" — Criterion A, MYP 4)
[chunk content]

### Example 2 (from "Bridge Engineering" — Criterion A, MYP 3)
[chunk content]

...
```

- Modify `generate-unit/route.ts` to call `retrieveContext()` before building prompts
- Modify `regenerate-page/route.ts` similarly

### Step 10: Multi-option generation

Modify the wizard to generate 3 distinct unit outlines before full page generation:

**New flow:**
1. Teacher fills wizard steps 0-3 (same as today)
2. Step 4 becomes "Choose Your Approach":
   - System generates 3 distinct unit outline options (not full pages — just titles + 1-line descriptions for each of the 16 pages)
   - Each option uses a different pedagogical lens:
     - **Option A**: Project-based / hands-on emphasis
     - **Option B**: Inquiry-driven / research-heavy
     - **Option C**: Community/real-world connection emphasis
   - Each option retrieves different RAG chunks (using MMR for diversity)
3. Teacher picks one (or mixes elements from multiple)
4. Step 5: Full page generation using the chosen outline + RAG context
5. Step 6: Review & edit (same as today)

Create `src/app/api/teacher/generate-outlines/route.ts`:
- POST: Takes wizard input, returns 3 outline options
- Each outline: `{ approach: string, description: string, pages: { [pageId]: { title: string, summary: string } } }`
- Uses lower token count (~2000 per option vs ~8000 for full pages)
- Fast — teacher sees options in ~5 seconds

---

## Phase D: Feedback Loop & Quality Improvement

### Step 11: Track generation outcomes

Add columns to `units` table (or create `generation_metadata` table):
- `generated_from`: 'ai' | 'manual' | 'forked'
- `generation_outline_chosen`: which of the 3 options was picked (1, 2, or 3)
- `edit_distance_score`: computed when unit is saved — how much was the generated content modified?
- `rag_chunks_used`: array of chunk IDs that were retrieved during generation

Create `src/lib/knowledge/feedback.ts`:
- `recordGenerationFeedback(unitId, chunksUsed, outlineChosen)` — called on unit save
- `computeEditDistance(original: PageContent, edited: PageContent): number` — measures how much teacher changed
- `updateChunkQuality(chunkId, signal: 'used' | 'retrieved_not_used')` — increments counters
- Quality score formula: `quality_score = 0.7 * old_score + 0.3 * new_signal`
  - Chunk was retrieved AND used → signal = 0.8
  - Chunk was retrieved but NOT used → signal = 0.3
  - Unit containing this chunk was forked → signal = 0.9

### Step 12: Auto-improve quality scores

Create a scheduled function (or trigger):
- When a unit is forked, increment `fork_count` on all chunks from that unit
- When a teacher rates a unit in the browse view, update `teacher_rating` on its chunks
- Periodically recompute `quality_score` based on all signals

---

## Phase E: Polish & Advanced Features

### Step 13: Contextual enrichment pipeline

When chunks are created (upload or unit ingest):
- Use Claude to generate a 1-2 sentence contextual preamble
- Prepend to the chunk text before embedding
- Example: "This is a Criterion B activity from a Year 4 Product Design unit on sustainable packaging. Students use SCAMPER to generate design alternatives."
- Store separately in `context_preamble` column

### Step 14: Knowledge base analytics (teacher dashboard)

Add to teacher settings or dedicated page:
- "Your knowledge base: X private chunks + Y community chunks available"
- "Units generated using your content: Z"
- "Most-referenced uploads" (which of your uploaded plans are most useful)
- "Community contribution" (if they've shared content, show its impact)

### Step 15: Seed the system with starter content

- Pre-populate `knowledge_chunks` with:
  - The 18 existing activity library templates (already structured)
  - 5-10 exemplar units covering different subjects/grades
  - MYP Design guide excerpts (assessment criteria descriptors)
- These are `source_type: 'activity_template'` with `is_public: true`
- Ensures the system works well even before teachers upload anything

---

## Implementation Order & Dependencies

```
Phase A (Infrastructure):  Steps 1-4  — DB, embeddings, extraction, chunking
Phase B (Ingestion):       Steps 5-7  — Upload flow, auto-ingest, UI
Phase C (Generation):      Steps 8-10 — Retrieval, enhanced prompts, multi-option
Phase D (Feedback):        Steps 11-12 — Quality tracking, improvement loop
Phase E (Polish):          Steps 13-15 — Contextual enrichment, analytics, seed data
```

Each phase delivers incrementally:
- After Phase A+B: Teachers can upload lesson plans (value: "your content is safe and indexed")
- After Phase C: Generation quality improves dramatically (value: "AI knows your teaching style")
- After Phase D: System gets smarter over time (value: "it keeps getting better")
- After Phase E: Full polish (value: "world-class experience")

---

## New Dependencies

- `voyageai` or direct API calls (Voyage 3.5 embedding API)
- `pdf-parse` — PDF text extraction
- `mammoth` — DOCX text extraction
- `officeparser` — PPTX text extraction

## Files to Create

- `supabase/migrations/010_knowledge_base.sql`
- `src/lib/ai/embeddings.ts`
- `src/lib/knowledge/extract.ts`
- `src/lib/knowledge/chunk.ts`
- `src/lib/knowledge/ingest-unit.ts`
- `src/lib/knowledge/retrieve.ts`
- `src/lib/knowledge/feedback.ts`
- `src/app/api/teacher/knowledge/upload/route.ts`
- `src/app/api/teacher/generate-outlines/route.ts`
- `src/app/teacher/knowledge/page.tsx`

## Files to Modify

- `src/lib/ai/prompts.ts` — add RAG context injection
- `src/app/api/teacher/generate-unit/route.ts` — add retrieval before generation
- `src/app/api/teacher/regenerate-page/route.ts` — add retrieval before regeneration
- `src/app/teacher/units/create/page.tsx` — add outline selection step
- `src/app/teacher/units/[unitId]/edit/page.tsx` — hook auto-ingest on save
- Teacher settings/sidebar — add knowledge base link

## API Key Requirements

- Voyage AI API key (for embeddings) — teacher configurable or app-level
- Existing AI provider key (Claude/OpenAI) for generation (already configured)
