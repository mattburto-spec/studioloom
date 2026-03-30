# Unified Upload Architecture — Feature Spec

**Created:** 30 March 2026 | **Author:** Matt + Claude | **Status:** Ready for review

---

## Problem Statement

StudioLoom has two separate upload paths that accept the same file types (PDF, DOCX, PPTX) but produce different outputs:

1. **Knowledge Library** (`/teacher/knowledge` → Upload button) — Analyses the document for RAG retrieval, chunks it, embeds it, creates a LessonProfile. The document feeds the intelligence system but doesn't become a teachable unit.

2. **Lesson Converter** (`/teacher/units/import`) — Extracts lesson structure, generates a skeleton, then produces a full editable StudioLoom unit with Workshop Model timing, scaffolding, and extensions.

Both are fully built (~3,100 LOC converter + existing knowledge pipeline). But a teacher uploading "my Year 10 Biomimicry scheme of work" has no idea which path to choose. Worse, the converter isn't even wired into the navigation yet — it exists at a standalone URL with no entry points.

**The confusion will only grow** as we add activity extraction (P1), batch import, and the lesson editor's "Import from..." search. We need one upload experience that routes intelligently.

## Design Principle

**One upload, multiple outputs.** The teacher uploads a file once. The system decides what it can do with it and offers choices. The teacher never has to understand StudioLoom's internal architecture (knowledge base vs units vs activity library) to get value from their upload.

## Architecture: Knowledge-First, Convert-on-Demand

Every uploaded document goes through the knowledge pipeline first (this already works). Lesson plans and unit plans then get a **"Convert to Unit"** action on their knowledge card. This is Option 2 from the earlier discussion.

### Why Knowledge-First

1. **Every document benefits from knowledge indexing** — even if the teacher also converts it to a unit, the chunks feed RAG and the profile enriches Dimensions data (Bloom's, UDL, grouping). This already happens as a background job in the converter, but making it primary ensures it always completes.

2. **Analysis is already done** — Pass 0 classification, Pass 1 structure, Pass 2 pedagogy (or pipeline equivalent), and now universal Dimensions extraction all run during knowledge upload. The converter can reuse this analysis instead of re-running its own extraction pipeline.

3. **No wasted uploads** — If a teacher uploads a rubric thinking it's a lesson plan, the knowledge library still captures value. In the converter-first model, non-lesson documents get rejected with a redirect.

4. **Single mental model** — "Upload goes to library. Library shows what I uploaded. I can do things with items in my library." This is how Google Drive, Notion, and every file management tool works. Teachers already understand this pattern.

5. **Deduplication** — Currently, if a teacher uploads the same PDF to both knowledge library and converter, it gets analysed twice, chunked twice, embedded twice. Knowledge-first means one copy, one analysis.

### Flow

```
Teacher uploads file (any format, any type)
         │
         ▼
  Knowledge Pipeline (existing)
  Pass 0 → Pass 1 → Pass 2/2b → Pass 3 → Dimensions
  → Chunks → Embeddings → LessonProfile → Knowledge Card
         │
         ▼
  Card appears in Knowledge Library with badges:
  [Lesson Resource] [Prof] [✓ Analysed] [Bloom's bar] [Criteria dots]
         │
         ├── IF Pass 0 says "lesson_plan" or "scope":
         │     Card gets a purple "Convert to Unit ⟶" button
         │
         ├── IF Pass 0 says "rubric":
         │     Card gets "Attach to Unit" action (link rubric to existing unit)
         │
         └── IF anything else (safety, exemplar, content, textbook):
               Card shows analysis badges only (no convert action)
```

### Convert to Unit (on-demand)

When the teacher clicks "Convert to Unit" on a knowledge card:

```
Knowledge Card [Convert to Unit ⟶]
         │
         ▼
  Converter takes EXISTING analysis data:
  - Raw extracted text (already stored on knowledge item as raw_extracted_text)
  - Pass 0 classification (already stored)
  - LessonProfile data (already stored in lesson_profiles)
         │
         ▼
  NEW extraction step (reuses converter's extractLessonStructure):
  - Layout detection (Haiku) — table vs sequential
  - Detailed lesson-by-lesson parsing (Sonnet) — activities, timing, materials
  - Framework detection
  - URL extraction
         │
         ▼
  Skeleton Review Screen (existing converter UI, Screen 2)
  - Edit titles, reorder, adjust timing, review resources
  - [Generate Unit →]
         │
         ▼
  Page Generation (existing converter Phase 2)
  - Parallel generation with original text context injection
  - Workshop Model validation + auto-repair
  - Unit saved to DB
         │
         ▼
  Unit linked back to knowledge item:
  - knowledge_items.converted_unit_id = new unit ID
  - Knowledge card shows "✓ Converted" badge + link to unit
```

### What Changes vs What Stays

| Component | Change needed | Effort |
|-----------|--------------|--------|
| Knowledge upload pipeline | **None** — already works, now with Dimensions | 0 |
| Knowledge card UI | **Add** "Convert to Unit" button when Pass 0 = lesson/scope | 0.5 day |
| Converter extraction API | **Modify** to accept `knowledgeItemId` instead of file upload. Reuse stored `raw_extracted_text` + Pass 0 result. Skip file upload + text extraction. | 1 day |
| Converter review + generation UI | **Reuse as-is** — the 3-screen flow at `/teacher/units/import` becomes Screen 2+3 only (skip upload screen when coming from knowledge card) | 0.5 day |
| Converter standalone upload | **Keep** — `/teacher/units/import` still works for teachers who want the direct path. But the upload screen now also indexes to knowledge library first (background, same as current). | 0.5 day |
| Navigation wiring | **Add** "Import" button on units page + wizard lane selector | 0.5 day |
| Knowledge item schema | **Add** `converted_unit_id` column (nullable UUID FK to units) | Migration, 0.25 day |
| Knowledge card "Converted" badge | **Add** visual indicator when item has been converted | 0.25 day |
| **Total** | | **~3.5 days** |

## Detailed Component Changes

### 1. Knowledge Card — "Convert to Unit" Button

In `KnowledgeItemCard.tsx`, add a purple action button when the item's Pass 0 classification indicates it's a lesson plan or scheme of work:

```
Condition: item.source_category === "lesson_plan" ||
           profile?.pedagogicalApproach includes "scheme of work" ||
           Pass 0 recommended_pipeline === "lesson" || "scope"
```

Button: purple outline, "Convert to Unit ⟶" text. Navigates to `/teacher/units/import?from=knowledge&itemId={id}`.

If the item already has `converted_unit_id`, show "✓ Converted" green badge with link to the unit instead.

### 2. Converter API — Accept Knowledge Item ID

Current Phase 1 (`handleExtraction`) accepts a file upload via FormData. Add a second entry mode:

```typescript
// New: accept knowledgeItemId instead of file
if (formData.has("knowledgeItemId")) {
  // Load from existing knowledge item
  const itemId = formData.get("knowledgeItemId") as string;
  const item = await admin.from("knowledge_items").select("*").eq("id", itemId).single();
  const rawText = item.raw_extracted_text;
  const pass0 = item.pass0_classification; // or re-run if not stored

  // Skip file upload + text extraction
  // Jump directly to extractLessonStructure(rawText, ...)
  // ...rest of Phase 1 is identical
}
```

Key advantage: the expensive text extraction (PDF parsing, DOCX unzipping) is already done. The converter only needs to run the lesson-specific extraction (layout detection + detailed parsing), which is the fast part.

### 3. Converter UI — Skip Upload When From Knowledge

The import page at `/teacher/units/import` reads `?from=knowledge&itemId=X` from URL params. When present:

- Skip Screen 1 (upload) entirely
- Auto-trigger Phase 1 extraction using the knowledge item's stored text
- Jump directly to Screen 2 (skeleton review) when extraction completes
- Show breadcrumb: "Knowledge Library → Convert to Unit"

When accessed directly (no `from` param), the upload screen works as before — but now also triggers a background knowledge indexing job after the converter extraction completes (closing the gap where direct converter uploads didn't feed the knowledge library).

### 4. Converter Standalone Upload — Dual Output

When a teacher uploads directly to `/teacher/units/import` (not from knowledge card):

1. File uploaded → text extracted
2. **NEW:** Background job creates a knowledge item + runs analysis pipeline (async, non-blocking)
3. Converter extraction runs in parallel (lesson structure, skeleton)
4. Teacher reviews skeleton, generates unit
5. Background knowledge indexing completes
6. Knowledge item gets `converted_unit_id` linked to the new unit

This means direct converter uploads ALSO feed the knowledge library. No more "upload to converter but forget to upload to knowledge library" gap.

### 5. Navigation Entry Points

**Units page** (`/teacher/units`):
- Add "Import" button next to "Create Unit" (already spec'd in converter spec, just not wired)

**Wizard mode selector** (`ModeSelector.tsx`):
- Add 4th card: "Import" (↑ icon) — "Upload an existing lesson plan" description
- Routes to `/teacher/units/import`

**Knowledge Library** (`/teacher/knowledge`):
- "Convert to Unit" button on eligible cards (see above)
- Upload dialog: add hint text "Lesson plans can be converted to units after upload"

## What This Enables Later

### Activity Library (P1, no additional architecture needed)

The knowledge analysis pipeline already extracts `lesson_flow` (array of activities with titles, types, durations, materials). With Dimensions v2, each activity gets `bloom_level` and `udl_checkpoints`. This is the data needed for the "Import from..." search in the lesson editor.

The activity library doesn't need a separate table — it's a filtered query on `lesson_profiles.profile_data.lesson_flow[]` with embedding search on activity descriptions. The knowledge-first architecture means every uploaded document automatically populates this searchable activity pool.

### Re-analysis (no new upload needed)

When the analysis pipeline improves (new prompts, new Dimensions fields), knowledge items can be re-analysed from their stored `raw_extracted_text`. No need to ask teachers to re-upload files. The converter can also benefit — "Convert to Unit" always uses the latest analysis.

### Batch Import (P1)

Upload multiple files to knowledge library → each gets analysed → teacher selects multiple "lesson plan" items → "Convert all to unit" → combined skeleton with lessons in order. Knowledge-first means batch import is just multi-select on existing knowledge cards.

## Non-Goals

- **Not merging the two codebases** — The knowledge pipeline (`analyse.ts`) and converter pipeline (`extract-lesson-structure.ts`) do fundamentally different things. Knowledge analysis extracts pedagogical metadata for RAG. Converter extraction parses lesson-by-lesson structure for unit generation. They share `extractDocument()` for text extraction but diverge after that. Merging would create a confusing monolith.

- **Not deprecating direct converter upload** — Some teachers (especially during onboarding) will want the "I have a file, give me a unit" flow without browsing the knowledge library first. The standalone import page stays.

- **Not auto-converting on upload** — The knowledge library should never surprise a teacher by auto-generating a unit they didn't ask for. "Convert to Unit" is always an explicit teacher action.

## Migration

```sql
-- Migration: Add converted_unit_id to knowledge_items
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS converted_unit_id UUID DEFAULT NULL;

-- Optional: index for quick lookup
CREATE INDEX IF NOT EXISTS idx_knowledge_items_converted_unit
  ON knowledge_items(converted_unit_id) WHERE converted_unit_id IS NOT NULL;
```

## Open Questions

1. **Should "Convert to Unit" re-run Pass 0 or trust the stored classification?** Recommendation: trust stored classification. Pass 0 is deterministic for the same text. Only re-run if the analysis version is outdated.

2. **Should the knowledge card show "Convert to Unit" for documents classified as `scope` (scheme of work)?** These are multi-unit documents. The converter currently handles them as single units. Recommendation: yes, show the button. The converter's skeleton review lets the teacher trim lessons. Scheme-of-work splitting (P1 in converter spec) can come later.

3. **Should we store `pass0_classification` on `knowledge_items` for fast filtering?** Currently, Pass 0 result is only in the analysis logs. Adding a `classification` TEXT column would let us filter cards without reading profile_data. Low effort, high value.

---

*This spec supersedes the navigation/entry-point sections of `docs/specs/lesson-plan-converter.md`. The converter's core extraction + generation architecture is unchanged.*
