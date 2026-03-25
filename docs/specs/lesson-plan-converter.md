# Lesson Plan Converter — Feature Spec

**Created:** 21 March 2026 | **Author:** Matt + Claude | **Status:** Ready for build

---

## Problem Statement

Teachers switching to StudioLoom have years of existing lesson plans in Word, PDF, and PowerPoint formats. Currently, the only way to create units is through the conversational wizard (building from scratch) or uploading documents to the knowledge base (which analyses them for RAG retrieval but doesn't convert them into teachable units). Teachers need a path that says "I already have stuff — just convert it." Without this, onboarding friction is high and teachers default to their existing workflow instead of adopting StudioLoom.

## Goals

1. **Reduce unit creation time by 70%** for teachers with existing materials — a 6-unit scheme of work should import in under 10 minutes, not 2+ hours of wizard conversations
2. **Preserve teacher intent** — the converted unit should feel like "my lesson plan, enhanced" not "a robot rewrote my lesson plan"
3. **Feed the intelligence system** — every import enriches the teacher's style profile, knowledge base, and timing model (the same passive learning that happens today via the knowledge base pipeline)
4. **Support all three file formats** — PDF, DOCX, PPTX with graceful handling of formatting quirks

## Non-Goals

- **Not replacing the wizard** — the wizard is for teachers building from scratch or exploring new approaches. The converter is for teachers with existing materials. Different entry points, same output format.
- **Not a 1:1 format preserving import** — we're converting to StudioLoom's page/content_data schema with Workshop Model timing, not rendering the original document inside the platform
- **Not handling handwritten/scanned lesson plans** — OCR on handwritten notes is unreliable. Typed documents only.
- **Not auto-assigning to classes** — the converter produces a unit template. Teacher assigns it to classes afterward (existing flow).
- **Not converting non-lesson documents** — schemes of work, rubrics, and safety docs go through the existing knowledge base upload pipeline. The converter specifically handles lesson plans and unit plans.

## User Stories

### Teacher with existing materials
- As a teacher, I want to upload my existing lesson plan document and get a StudioLoom unit back, so that I don't have to rebuild everything from scratch
- As a teacher, I want to review what the AI extracted before it generates the full unit, so that I can correct misinterpretations of my intent
- As a teacher, I want to choose whether my upload becomes a full unit or a single lesson added to an existing unit, so that I can incrementally build units from individual lesson files
- As a teacher, I want the converter to preserve my activities, timing, and teaching approach while adding StudioLoom enhancements (scaffolding, extensions, Workshop Model timing), so that it still feels like my lesson

### Teacher discovering the feature
- As a teacher on the units page, I want to see an "Import" button next to "Create Unit", so that I know importing is an option
- As a teacher in the wizard, I want "Import existing lesson plan" as a first-step option, so that I don't have to go through the conversational flow when I already have materials

## Requirements

### Must-Have (P0)

**1. File upload + extraction**
- Accept PDF, DOCX, PPTX (max 20MB)
- Extract text, structure, headings, timing annotations, activity descriptions
- Reuse existing `extractDocument()` from knowledge pipeline
- Show upload progress with file name and type icon
- Acceptance: Given a 15-page DOCX lesson plan, when uploaded, then text extraction completes in <5 seconds

**2. AI analysis + skeleton generation**
- Run Pass 0 classification to confirm it's a lesson plan (reject non-lesson documents with helpful redirect to knowledge base upload)
- Run Pass 1 structure extraction: identify individual lessons, activities, timing, materials, learning objectives
- Generate a `TimelineSkeleton` from the extracted structure — same format the wizard produces
- Map extracted activities to StudioLoom page types (strand, context, skill, reflection)
- Infer criterion mapping from learning objectives and activity types
- Acceptance: Given a 6-lesson unit plan, when analysed, then the skeleton shows 6 lessons with titles, timing, and criterion tags matching the source document

**3. Skeleton review screen**
- Show the extracted skeleton to the teacher before full generation
- Display: lesson titles, timing, criterion tags, key activities (read from source)
- Allow teacher to edit lesson titles, reorder lessons, remove lessons, adjust timing
- Allow teacher to correct criterion mapping
- "Looks good — generate" button triggers full page generation
- Acceptance: Given a skeleton with 6 lessons, when teacher edits lesson 3 title and removes lesson 6, then the modified skeleton is used for generation

**4. Full unit generation from skeleton**
- Generate full `PageContent[]` for each lesson using the same generation pipeline as the wizard
- Inject the original lesson plan text as context (so the AI preserves the teacher's activities, not inventing new ones)
- Apply Workshop Model timing validation + auto-repair
- Generate extensions for each lesson
- Add scaffolding tiers (ELL support, extension challenges)
- Acceptance: Given an approved skeleton, when generated, then each page contains the teacher's original activities enhanced with StudioLoom scaffolding, timing phases, and response types

**5. Two entry points**
- "Import" button on `/teacher/units` page (standalone flow)
- "Import existing lesson plan" option in wizard Step 1 (alongside "Build for Me" / "Build with Me")
- Both entry points lead to the same converter flow
- Acceptance: Given a teacher on either the units page or wizard, when they choose import, then they see the same upload → review → generate flow

**6. Single lesson import mode**
- Teacher can choose "Add to existing unit" instead of "Create new unit"
- Shows a unit picker (list of teacher's existing units)
- Generates a single page and appends it to the selected unit
- Acceptance: Given a single-lesson PDF, when teacher chooses "Add to existing unit" and selects Unit X, then the lesson appears as a new page in Unit X

**7. Feed the intelligence system**
- Upload triggers `onLessonUploaded()` for teacher style profile learning
- Extracted text is chunked and embedded into knowledge base (same as existing upload pipeline)
- Original document stored as knowledge base item with `source_category: 'lesson_plan'`
- Acceptance: Given a converted lesson plan, when the teacher generates future units, then the knowledge base includes chunks from the imported document

### Nice-to-Have (P1)

**8. Batch import**
- Upload multiple files at once (e.g., a folder of 12 lesson plans = one unit)
- Auto-detect lesson order from filenames or content (Lesson 1, Lesson 2, etc.)
- Show batch progress with per-file status

**9. Scheme of work import**
- Detect when a single document contains an entire scheme of work (multiple units)
- Split into individual units with teacher confirmation
- Generate separate unit skeletons per detected unit

**10. Smart activity mapping**
- Detect specific activity types in the source (group discussion, individual research, practical task, design brief, peer review)
- Map to StudioLoom response types (text, upload, canvas, Decision Matrix, PMI, etc.)
- Suggest toolkit tools that match the activity intent

**11. Side-by-side comparison view**
- After generation, show original document alongside the StudioLoom version
- Highlight what was preserved, what was enhanced, and what was added
- Teacher can toggle between "original" and "enhanced" views

**11b. Activity extraction for block library**
- During ingestion (both converter and knowledge base upload), tag individual activities as reusable blocks
- Each extracted activity gets: title, description, suggested duration, response type, source document reference, design phase tag
- Stored as queryable records (lightweight `activity_library` view or filtered query on lesson_profiles)
- Available in the lesson editor's "Import from..." modal alongside activities from the teacher's own units
- AI-assisted search: teacher types "gallery walk critique" → embedding search across both sources (own units + extracted from uploads)
- This means even uploading a textbook with one great activity makes that activity available as a draggable block
- Key: extraction happens automatically during existing Pass 0/1 analysis — no extra teacher effort

### Future Considerations (P2)

**12. Google Docs / Slides import** — OAuth connection to pull directly from Google Drive
**13. Template library** — converted units shared anonymously to help other teachers ("lessons like yours")
**14. Iterative refinement** — teacher marks sections as "keep exactly as-is" vs "enhance freely" before generation
**15. Multi-file merge** — combine a lesson plan PDF + a rubric DOCX + a resource PPTX into one unit

## Technical Design

### Architecture

The converter reuses 80%+ of existing infrastructure:

```
Upload → extractDocument() → Pass 0 Classification
                                    ↓
                            [lesson_plan detected]
                                    ↓
                        NEW: extractLessonStructure()
                        (AI call to parse lessons, activities, timing)
                                    ↓
                  ┌─────────────────┴─────────────────┐
                  ↓                                   ↓
    NEW: buildSkeletonFromExtraction()    NEW: extractActivitiesAsBlocks()
    (Maps extracted structure →           (Tags individual activities for
     TimelineSkeleton)                     the reusable block library)
                  ↓                                   ↓
    Teacher reviews + edits skeleton       Activity library (queryable
                  ↓                        via "Import from..." in editor)
    EXISTING: generateUnit() pipeline
    (with original text injected as context)
                  ↓
    EXISTING: validateLessonTiming()
    EXISTING: save to units table
```

**Dual output:** Every upload produces both a convertible unit AND a set of tagged activity blocks. Even if the teacher doesn't convert the full document, the individual activities become available in the lesson editor's import search.

### New Components Needed

| Component | Type | ~Lines | Purpose |
|-----------|------|--------|---------|
| `LessonPlanConverter.tsx` | Page | ~400 | Main converter flow (upload → review → generate) |
| `SkeletonReview.tsx` | Component | ~300 | Editable skeleton display with drag-reorder |
| `extractLessonStructure()` | Lib function | ~150 | AI call to parse lesson structure from document text |
| `buildSkeletonFromExtraction()` | Lib function | ~100 | Maps extraction output → TimelineSkeleton format |
| `/api/teacher/convert-lesson/route.ts` | API route | ~200 | Orchestrates extraction → skeleton → generation |

### AI Prompts

**Extraction prompt** (Sonnet, ~2k tokens output):
```
You are analysing a teacher's existing lesson plan document.
Extract the following structure:
- Individual lessons (title, duration, learning objective)
- Activities within each lesson (description, type, duration, materials)
- Overall unit topic, grade level, subject area
- Any assessment methods mentioned
- Any differentiation/scaffolding mentioned

The teacher wrote this lesson plan — preserve their language and intent.
Do NOT invent activities that aren't in the document.
If timing isn't specified, estimate based on activity descriptions.
```

**Generation context injection:**
When generating pages from the skeleton, the existing generation prompt is augmented with:
```
CONTEXT: This unit is being converted from the teacher's existing lesson plan.
The original lesson plan text for this lesson is:
---
[extracted text for this specific lesson]
---
PRESERVE the teacher's original activities and teaching approach.
ENHANCE with: Workshop Model timing, scaffolding tiers, extensions, response types.
Do NOT replace the teacher's activities with generic alternatives.
```

### Data Flow

1. **Upload** → `FormData` with file + mode (`full_unit` | `single_lesson`) + optional `targetUnitId`
2. **Extract** → Reuse `extractDocument()` → raw text + structure
3. **Classify** → Reuse Pass 0 → confirm `lesson_plan` type
4. **Structure** → NEW `extractLessonStructure()` → structured lessons array
5. **Skeleton** → NEW `buildSkeletonFromExtraction()` → `TimelineSkeleton`
6. **Review** → Teacher edits skeleton in browser
7. **Generate** → Existing `generateUnit()` with original text injected per lesson
8. **Validate** → Existing `validateLessonTiming()` + auto-repair
9. **Save** → Existing unit save flow
10. **Index** → Existing knowledge base chunking + embedding (background)

## UI Flow

### Entry Point A: Units Page
```
[Units Page]
  ┌─────────────┐  ┌──────────────┐
  │ + Create Unit │  │ ↑ Import Plan │
  └─────────────┘  └──────────────┘
                         ↓
                   [Converter Flow]
```

### Entry Point B: Wizard Step 1
```
[Wizard Step 1: How do you want to build?]
  ○ Build for Me (AI generates from your topic)
  ○ Build with Me (conversational, collaborative)
  ○ Import Existing Lesson Plan ← NEW
```

### Converter Flow (3 screens)
```
Screen 1: Upload
  ┌──────────────────────────────────┐
  │  📄 Drop your lesson plan here   │
  │  PDF, DOCX, or PPTX (max 20MB)  │
  │                                   │
  │  ○ Create new unit                │
  │  ○ Add to existing unit → [pick]  │
  └──────────────────────────────────┘
  [Analysing... extracting lessons...]

Screen 2: Review Skeleton
  ┌──────────────────────────────────┐
  │ We found 6 lessons in your plan: │
  │                                   │
  │ 1. Introduction to Sustainable   │
  │    Design (45 min) [A] [edit]    │
  │ 2. Research Methods (50 min)     │
  │    [A] [B] [edit]                │
  │ 3. ...                           │
  │                                   │
  │ [+ Add lesson] [Reorder]         │
  │                                   │
  │ Topic: Sustainable Design        │
  │ Grade: Year 9  Duration: 6 weeks │
  │ [edit metadata]                  │
  │                                   │
  │ [← Back]  [Generate Unit →]      │
  └──────────────────────────────────┘

Screen 3: Generation (reuse existing wizard Step 7)
  [Generating pages... progress per lesson]
  [Review + edit each page]
  [Save Unit]
```

## Success Metrics

### Leading (1-2 weeks post-launch)
- **Adoption:** 30%+ of new units created via import (vs wizard) within first month
- **Completion rate:** 80%+ of started imports result in a saved unit (not abandoned mid-flow)
- **Time to unit:** <10 minutes from upload to saved unit (vs ~30+ min via wizard)

### Lagging (1-3 months)
- **Teacher retention:** Teachers who import existing plans are 2x more likely to create a second unit
- **Knowledge base growth:** 3x more lesson plans in the knowledge base (imports also feed RAG)
- **Teacher style profile richness:** Imported plans provide richer style signals than wizard conversations

## Open Questions

- **[Engineering]** Should the extraction AI call be Sonnet or Haiku? Sonnet is more accurate but slower + more expensive. For a one-time import, Sonnet seems right.
- **[Design]** Should the skeleton review screen reuse the existing `JourneyLessonCard` component or have a simpler custom view? The wizard's skeleton review is quite heavy — the converter might want a lighter touch.
- **[Matt]** How much should the AI "enhance" vs "preserve"? Current design says preserve activities + add scaffolding/timing/extensions. But some teachers may want minimal changes. Should there be a "faithfulness" slider?

## Timeline

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 | File upload + extraction + skeleton generation | 2 days |
| Phase 2 | Skeleton review UI + editing | 1.5 days |
| Phase 3 | Generation with context injection + validation | 1.5 days |
| Phase 4 | Two entry points (units page + wizard) + single lesson mode | 1 day |
| Phase 5 | Intelligence system wiring (knowledge base + teacher profile) | 0.5 day |
| **Total** | | **~6.5 days** |

## Dependencies

- Existing `extractDocument()` function (knowledge pipeline) — already built
- Existing `generateUnit()` pipeline — already built
- Existing `validateLessonTiming()` — already built
- Existing `BatchUpload` component for drag-drop UI — can adapt
- Teacher style profile service — already built

## Appendix: Supported Document Structures

### What the converter handles well
- Numbered/titled lessons with clear boundaries ("Lesson 1: Introduction", "Week 2: Research")
- Activity descriptions with timing annotations ("15 min group discussion")
- Learning objectives/intentions at lesson or unit level
- Materials lists, vocabulary lists, key questions

### What requires teacher intervention
- Unlabelled sections (AI will guess lesson boundaries, teacher confirms)
- Missing timing (AI estimates from activity descriptions)
- Ambiguous criterion mapping (AI suggests, teacher confirms)
- Mixed content (lesson plan + rubric + resources in one document — converter takes the lesson plan parts, suggests uploading the rest to knowledge base)
