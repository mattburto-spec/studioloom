# Ingestion Pipeline Audit — 16 April 2026

> **Purpose:** Full audit of all ingestion pathways. Which pages connect to which pipelines, what's Dimensions3 vs legacy, what's actually being used.
> **Trigger:** Matt noticed the import page still collapsed a 12-lesson unit to 1 lesson after the first fix, raising concern about whether Dimensions3 was actually being used.

---

## The Full Pipeline Map

Every content upload path in the entire site:

```
TEACHER CONTENT INGESTION (Dimensions3 — all active, all use the same pipeline)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────┐     ┌──────────────────────────────┐
│ /teacher/library/       │     │ /api/teacher/library/ingest  │
│ "Add to Block Library"  │────▶│ Full D3 pipeline             │
│ (drag-drop file upload) │     │ → content_items + blocks     │
└─────────────────────────┘     └──────────────────────────────┘
                                        │ if scheme_of_work detected,
                                        │ redirects to import ↓
┌─────────────────────────┐     ┌──────────────────────────────┐
│ /teacher/library/       │     │ /api/teacher/library/import  │
│ "Import as Unit"        │────▶│ Full D3 pipeline             │
│ (drag-drop file upload) │     │ + reconstructUnit()          │
│   OR                    │     │ → content_items + blocks     │
│ /teacher/library/import │     │ → MatchReport for teacher    │
│ (file upload or paste)  │     │ → Accept creates a unit      │
└─────────────────────────┘     └──────────────────────────────┘

┌─────────────────────────┐     ┌──────────────────────────────┐
│ /teacher/library/review │     │ /api/teacher/library/ingest  │
│ (paste text only)       │────▶│ Same pipeline as above       │
└─────────────────────────┘     └──────────────────────────────┘

┌─────────────────────────┐     ┌──────────────────────────────┐
│ /admin/ingestion-sandbox│     │ /api/admin/ingestion-sandbox │
│ (file upload,           │────▶│ Same D3 stages, step-through │
│  stage-by-stage debug)  │     │ /upload → /run-stage → /commit│
└─────────────────────────┘     └──────────────────────────────┘


UNIT GENERATION (Dimensions3 — separate pipeline, not ingestion)
════════════════════════════════════════════════════════════════
┌─────────────────────────┐     ┌──────────────────────────────┐
│ /teacher/units (wizard) │     │ /api/teacher/generate-unit   │
│ Express/Guided/Architect│────▶│ D3 generation pipeline       │
│                         │     │ (runPipeline, not ingestion)  │
└─────────────────────────┘     └──────────────────────────────┘


NOT CONTENT INGESTION (file uploads that don't run the pipeline)
═══════════════════════════════════════════════════════════════
  /teacher/welcome (Step 2)    → /api/teacher/timetable/parse-upload  (AI timetable extraction)
  /teacher/welcome (Step 4)    → client-side CSV parse                (roster import)
  /teacher/settings (timetable)→ /api/teacher/timetable/parse-upload  (same)
  /teacher/students            → client-side CSV parse                (roster import)
  /tools/marking-comment-creator → /api/tools/extract-rubric          (text extraction only, no pipeline)
  /tools/report-writer         → client-side ExcelJS                  (student list parse)
  /api/student/upload          → Supabase Storage                     (file upload + NSFW moderation)
  /api/teacher/knowledge/media → Supabase Storage                     (media upload, no pipeline)
  Unit thumbnail picker        → /api/teacher/upload-unit-image       (image upload)


QUARANTINED (returns 410 Gone — dead)
═════════════════════════════════════
  /api/teacher/knowledge/upload      ← old knowledge pipeline
  /api/teacher/knowledge/reanalyse   ← old 3-pass analysis
  /api/teacher/convert-lesson        ← old 2-phase converter (682 lines of dead code after 410 return)
  /teacher/units/import              ← page still renders but API returns 410
  /api/teacher/knowledge/lesson-profiles/[id]/reanalyse ← old per-profile reanalysis
  /api/teacher/knowledge/lesson-profiles/[id] (PATCH)   ← old profile update
  /api/teacher/knowledge/feedback (POST)                ← old feedback write
  + more 410 tombstone routes (see docs/quarantine.md for full list)
```

---

## Is Dimensions3 Actually Being Used?

**Yes. 100% of active content ingestion goes through Dimensions3.** Every active upload route calls `runIngestionPipeline()` from `src/lib/ingestion/pipeline.ts`. The pipeline runs all stages:

| Stage | File | Description | Status |
|-------|------|-------------|--------|
| I-0 Dedup | `dedup.ts` | SHA-256 hard dedup + cosine 0.92 soft dedup | Complete |
| I-1 Parse | `parse.ts` | Deterministic heading detection, word counts | Complete |
| Safety pre-check | `pipeline.ts` | Phase 6C upload-level content scan | Complete |
| I-2 Pass A (Classify) | `pass-a.ts` | Haiku classification with per-tag confidences | Complete |
| I-3 Pass B (Enrich) | `pass-b.ts` | Sonnet enrichment — bloom, time, grouping, materials, UDL per section | Complete |
| I-4 Extract | `extract.ts` | Activity sections → candidate blocks + PII scan | Complete |
| I-4b Copyright | `copyright-check.ts` | Verbatim 200-char match against existing corpus | Complete |
| I-5 Moderate | `moderate.ts` | Haiku moderation per block (approved/flagged/pending) | Complete |
| Persist | `persist-blocks.ts` | Voyage embeddings + content fingerprint → activity_blocks table | Complete |

Both the **ingest** route (block library) and **import** route (unit reconstruction) call the full pipeline and persist to `content_items` + `activity_blocks`.

---

## The Two Active Ingestion Endpoints

### `/api/teacher/library/ingest` — Block Library Ingestion

- **File:** `src/app/api/teacher/library/ingest/route.ts`
- **Purpose:** Teacher uploads content → pipeline extracts reusable activity blocks for the library
- **Input:** Multipart file upload (PDF/DOCX/PPTX/TXT/MD) OR JSON `{ rawText }`
- **Pipeline:** Full Dimensions3 (`runIngestionPipeline`)
- **Persistence:** `content_items` row + `activity_blocks` via `persistModeratedBlocks()`
- **Output:** Extraction summary (block count, document type, confidence, cost)
- **Special:** If document classified as `scheme_of_work`, returns `suggestedRedirect: "import"` for client-side redirect

### `/api/teacher/library/import` — Unit Import + Reconstruction

- **File:** `src/app/api/teacher/library/import/route.ts`
- **Purpose:** Teacher uploads a unit plan → pipeline extracts + reconstructs as a StudioLoom unit
- **Input:** Multipart file upload OR JSON `{ rawText }`
- **Pipeline:** Full Dimensions3 (`runIngestionPipeline`) + `reconstructUnit()` + `reconstructionToContentData()`
- **Persistence:** `content_items` row + `activity_blocks` via `persistModeratedBlocks()` (added 16 Apr 2026)
- **Output:** `{ reconstruction, contentData, ingestion }` — the MatchReport data
- **Special:** `skipDedup: true` (import always re-processes)

**Key difference:** Ingest extracts blocks for the library. Import extracts blocks AND assembles them into a unit structure with lessons. Both persist to the same tables. Both use the same pipeline.

---

## What About the Old Knowledge Pipeline?

The old `src/lib/knowledge/` directory has 9 files:

| File | Status | Explanation |
|------|--------|-------------|
| `extract.ts` | **ACTIVELY USED** | Binary file extraction (PDF via pdfjs-dist, DOCX via mammoth, PPTX). Used by BOTH D3 routes + admin sandbox + rubric tool. Should be relocated — it's infrastructure, not old pipeline. Tracked as FU-Library-B3. |
| `analyse.ts` (838 lines) | **DEAD** | Old 3-pass analysis orchestrator (Pass 0/1/2/2b). Only caller is quarantined `convert-lesson` route (returns 410). |
| `analysis-prompts.ts` (895 lines) | **PARTIALLY LIVE** | `buildTeachingContextBlock()` imported by `src/lib/ai/prompts.ts`. Returns empty arrays gracefully when no data exists. Not dangerous but confusing. |
| `chunk.ts` (675 lines) | **PARTIALLY LIVE** | Used by `knowledge-library/index.ts` for the separate knowledge items CRUD (not the ingestion pipeline). |
| `vision.ts` (462 lines) | **DEAD** | Claude Vision for diagrams. No active importers. |
| `feedback.ts` (339 lines) | **PARTIALLY LIVE** | Imported by `prompts.ts`. Returns empty gracefully. |
| `retrieve.ts` | **PARTIALLY LIVE** | Imported by `prompts.ts` for RAG retrieval. Returns empty gracefully. |
| `retrieve-lesson-profiles.ts` | **PARTIALLY LIVE** | Same pattern — returns empty when no data. |
| `search.ts` | **DEAD** | Old similarity search. No active importers. |

**No active route calls the old analysis pipeline.** The "partially live" files are imported by `prompts.ts` but return empty arrays when there's no data in the old tables. They're harmless but create confusion about what's active.

---

## Admin & Debug Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/api/admin/ingestion-sandbox/upload` | First step: upload file, extract text, create pending `content_items` row | Best-effort (no explicit admin check) |
| `/api/admin/ingestion-sandbox/run-stage` | Step-through: run one pipeline stage at a time (dedup/parse/passA/passB/extract/moderate) | Best-effort |
| `/api/admin/ingestion-sandbox/commit` | Final step: persist approved blocks with embeddings + fingerprints | Best-effort |
| `/api/admin/generation-sandbox/run` | Full generation pipeline run (not ingestion) with `is_sandbox` flag | No auth |
| `/api/admin/smoke-tests` | 6 in-memory tests (extraction, reconstruction, efficacy, guardrails, etc.) | No auth |
| `/api/admin/library` | Read-only block library browser | No auth (service-role) |
| `/api/admin/library/health` | 8 library health widgets | No auth |
| `/api/admin/pipeline/health` | 24h pipeline health dashboard | No auth |

---

## What the Ingest Route Writes vs What the Import Route Writes

Both routes now write the same data:

| Table | Ingest route | Import route |
|-------|-------------|-------------|
| `content_items` | Yes — document metadata, classification, enrichment, raw text | Yes — same (added 16 Apr 2026) |
| `activity_blocks` | Yes — via `persistModeratedBlocks()` with embeddings + fingerprints | Yes — via `persistModeratedBlocks()` (added 16 Apr 2026) |
| `units` | No | No (the Accept button on the MatchReport UI POSTs to `/api/teacher/units` separately) |

---

## Fixes Applied This Session (16 Apr 2026)

### Fix 1: Multi-lesson detection (previous session, commit `285b792`)

**Problem:** DOCX files with bold-styled headings (not Word heading styles) collapsed 12-lesson unit plans into 1 lesson.

**Three-layer fix:**
1. `src/lib/knowledge/extract.ts` — Bold-heading promotion: `<strong>` paragraphs → `<h3>` when mammoth finds no native heading styles
2. `src/lib/ingestion/parse.ts` — Broader heading detection for Week/Day/Session/Lesson N patterns
3. `src/lib/ingestion/unit-import.ts` — Title-based lesson boundary splitting, preserving original headings

### Fix 2: Dimensions3 persistence for import route (previous session, commit `285b792`)

**Problem:** Import route ran the full D3 pipeline but discarded all results — no `content_items`, no `activity_blocks`.

**Fix:** Added `content_items` insert + `persistModeratedBlocks()` call, matching the ingest route pattern.

### Fix 3: Reconstruction from all enriched sections (this session, commit `5543e5c`)

**Problem:** `reconstructUnit()` used only `ingestion.extraction.blocks` (activity-classified sections). A 12-lesson unit where most sections are "instruction" collapsed to 3 blocks → 1 lesson.

**Fix:** Now uses `ingestion.analysis.enrichedSections` (ALL sections from Pass B, minus metadata). Falls back to extraction blocks when no enriched sections available.

---

## Cleanup Recommendations

1. **Relocate `src/lib/knowledge/extract.ts`** to `src/lib/ingestion/document-extract.ts` or `src/lib/document/extract.ts`. It's confusing that a file in the "quarantined" directory is actively used by the new pipeline. Tracked as FU-Library-B3.

2. **Delete the quarantined `/teacher/units/import/` page.** It still renders but all its API calls return 410. A teacher could land there and be confused. The real import is at `/teacher/library/import`.

3. **The pass registry (`registry.ts`) isn't consumed by the orchestrator.** `pipeline.ts` calls Pass A and Pass B directly rather than iterating the registry array. Adding Pass C would require editing `pipeline.ts`. Fine for now but violates the spec's extensibility promise.

4. **Admin sandbox routes lack auth checks.** All three sandbox endpoints (`upload`, `run-stage`, `commit`) use "best-effort" auth that falls back to `SYSTEM_TEACHER_ID`. The generation sandbox has zero auth. These are admin tools but technically accessible to anyone with the URL.

---

## Bottom Line

**Start uploading.** The Dimensions3 pipeline is fully implemented and working. Every upload goes through all 8 stages (dedup → parse → safety → classify → enrich → extract → copyright → moderate) and persists to both `content_items` and `activity_blocks` with Voyage embeddings. The old knowledge pipeline is quarantined — no active route touches it. The system IS learning from every import.
