# Project: Student Work Pipeline
**Created: 5 April 2026**
**Status: DESIGN PHASE — not yet building**
**Source docs:** `systems/Ingestion/ingestion-pipeline-summary.md`, `systems/Ingestion/ingestion-companion-systems.md`
**Depends on:** Dimensions3 (Pipeline 1 + Activity Block Library must exist first)
**Loominary OS alignment:** This IS Pipeline 2 from the OS ingestion architecture.

---

## 1. What This Is

The system that ingests, processes, versions, and enriches student work submissions — the messy, real-world artifacts that students produce during design & technology projects. Photos of prototypes under bad fluorescent lighting, shaky video of mechanisms, handwritten sketches on graph paper, half-finished CAD screenshots, audio reflections mumbled in a workshop.

This is the **hard problem**. Pipeline 1 (teacher content, built by Dimensions3) deals with structured, high-quality source material processed once. Pipeline 2 deals with noisy, varied, continuous student output that needs real-time processing and contextual feedback.

### Why It's Foundational

- **The physical-digital bridge.** Design & Technology is a physical subject — students build things with their hands. The platform must understand photos of physical work, not just typed text.
- **Contextual AI feedback.** The AI can only give meaningful feedback when it can compare student work against teacher expectations (Pipeline 1) AND the student's own history (Pipeline 2 versions).
- **Longitudinal portfolio.** Students need versioned work across units, years, and eventually across Loominary apps.
- **Academic integrity.** Image-based submissions need their own integrity signals (metadata analysis, visual similarity, submission timing) alongside the existing text-based MonitoredTextarea.

---

## 2. What StudioLoom Has Today (Gap Analysis)

| Capability | Current State | Gap |
|-----------|--------------|-----|
| **Text responses** | `student_progress.responses` JSONB — flat key-value, no versioning | No history; each save overwrites. `useActivityTracking` captures attempt_number but doesn't store versions. |
| **Image uploads** | Basic Supabase Storage upload via file input response type | No processing, no enhancement, no OCR, no AI interpretation. Raw file stored and displayed. |
| **Sketch/canvas** | HTML5 Canvas capture (Quick Sketch tool, canvas response type) | Saved as base64 PNG in JSONB. No annotation extraction, no version comparison. |
| **Video** | Not supported | No capture, no transcoding, no thumbnail generation. |
| **Audio** | Voice response type exists | Basic recording stored as blob. No transcription, no AI analysis. |
| **Handwriting** | Not supported | Critical gap for DT — students annotate sketches, write specifications on paper, label diagrams. |
| **Version history** | None | Progress overwrites. No "show me how this evolved" capability. |
| **AI feedback on work** | Design Assistant (text chat only) | Cannot look at a photo and give feedback. Cannot compare against exemplars. Cannot reference past versions. |
| **Portfolio** | Auto-pipeline from responses → timeline view | Text-only. No curated visual portfolio. No Behance-style export with images. |

**The single biggest gap:** StudioLoom cannot look at a student's physical work and say anything useful about it. For a Design & Technology platform, this is an existential limitation.

---

## 3. The Five-Stage Pipeline

```
Intake ──→ Processing ──→ Enrichment ──→ Versioning ──→ Routing
Upload     Enhance/OCR    AI Analysis    History        Feedback/Portfolio
           Transcode      Context Link   Comparison     Notification
```

### Stage 1: Intake

Student submits work through any entry point:
- **In-lesson:** response input on activity block (text, image upload, canvas, audio, video)
- **Quick Capture:** photo/note/link from student nav bar
- **Gallery submission:** snapshot of pages for peer review
- **External:** email submission, LMS integration (future)

**What happens:**
- File validated (size limits, mime type whitelist, virus scan)
- Stored in Supabase Storage: `student-work/{school_id}/{student_id}/{unit_id}/{timestamp}_{hash}.{ext}`
- `work_items` row created (or existing row found if updating)
- `work_versions` row created with `version_number` incremented
- `work_assets` row(s) created for each file in the submission
- Processing job queued (Stage 2)
- Student sees immediate confirmation: "Uploaded — processing..."

**Key principle:** Intake is instant. Student never waits for processing. The upload response is immediate; everything else happens async.

### Stage 2: Processing

Varies dramatically by asset type. This is where the hard image/media work happens.

**Image processing:**
- Auto-orientation (EXIF metadata)
- Lighting correction (histogram equalization, white balance)
- Perspective correction (detect rectangular objects like sketches/plans, dewarp)
- Thumbnail generation (multiple sizes: 100px, 300px, 800px)
- OCR: printed text extraction (Tesseract or cloud OCR)
- Handwriting recognition: annotation extraction from sketches and plans
- Object detection: what is this a photo of? (prototype, sketch, model, screen, tool, material)
- Quality assessment: is this photo usable? (too blurry, too dark, finger over lens)

**Video processing:**
- Transcoding to web-friendly format (H.264 MP4)
- Thumbnail extraction (key frame selection)
- Audio track extraction → transcription
- Duration metadata

**Audio processing:**
- Transcription (Whisper or similar)
- Duration, volume normalization

**Canvas/sketch processing:**
- SVG vectorization option
- Annotation layer separation (what's drawing vs what's text)

**Text processing:**
- Already handled well by existing system — MonitoredTextarea, integrity analysis
- Stage 2 for text = no-op (pass through to enrichment)

**Output:** Each `work_assets` row updated with `processing_status: 'completed'`, `extracted_text`, `thumbnail_path`, and processing metadata.

### Stage 3: Enrichment

The AI layer. Takes processed assets and adds pedagogical context using Pipeline 1 (teacher content) as the reference frame.

**What the AI does:**
1. **Identifies design stage.** "This is a prototype photo → student is in the Creating/Making phase."
2. **Compares against teacher expectations.** Pulls relevant content from Pipeline 1 (activity block's `success_look_fors`, rubric criteria, exemplar images) and assesses alignment.
3. **Compares against student history.** Pulls previous versions from `work_versions` to detect progress, regression, or stagnation.
4. **Generates structured observations.** Not feedback (that's Stage 5 — routing) — structured data about what the AI sees: materials identified, techniques observed, annotation content, quality indicators.
5. **Tags with criteria alignment.** Maps observations to specific assessment criteria using the neutral taxonomy from Dimensions3.

**The feedback formula:**
```
Teacher content (what's expected)
  + Student work history (where they've been)
  + Current submission (what they're showing now)
  = Contextual observations (structured data, not prose feedback yet)
```

**Key constraint:** Enrichment produces structured data, NOT student-facing text. The Feedback Engine (companion system) converts observations into appropriate feedback based on scaffolding tier, mentor personality, and teacher overrides.

### Stage 4: Versioning

Every submission creates a new version. The system maintains the full chain.

**Version chain:**
```
work_item (the persistent entity — "Alex's chair prototype")
  └── work_version 1 (rough sketch, 2 Feb)
       └── work_assets: [sketch_photo.jpg]
  └── work_version 2 (cardboard model, 15 Feb)
       └── work_assets: [model_front.jpg, model_side.jpg, model_top.jpg]
  └── work_version 3 (refined prototype, 1 Mar)
       └── work_assets: [prototype.jpg, mechanism_video.mp4, spec_scan.jpg]
```

**What versioning enables:**
- **Growth narrative:** AI can show "Version 1 → Version 3: you've refined the joint mechanism and added a surface finish"
- **Effort evidence:** Timestamp gaps, version count, edit depth — all feed integrity signals
- **Portfolio curation:** Student picks best versions for their portfolio
- **Teacher assessment:** Teacher sees the journey, not just the final product
- **Peer comparison:** Gallery shows snapshot versions, not live work

**Version metadata stored:**
- `submitted_at`, `submission_type` (in_lesson / quick_capture / gallery / external)
- `activity_context` (which activity block, which lesson, which unit)
- `ai_observations` JSONB (Stage 3 enrichment output)
- `integrity_signals` JSONB (submission timing, version delta size, metadata consistency)

### Stage 5: Routing

Processed, enriched, versioned work gets routed to the right destinations:

| Destination | Trigger | What's Sent |
|-------------|---------|-------------|
| **AI Feedback Engine** | Auto (if enabled for this activity) | Observations + teacher content context + student history → structured feedback |
| **Teacher queue** | Auto (new submission notification) | Summary card: student name, activity, version #, thumbnail, AI observations |
| **Portfolio** | Auto (all work enters portfolio timeline) | Version entry with metadata |
| **Gallery** | Student-initiated (gallery round active) | Snapshot of selected version |
| **Peer review** | Gallery round routing | Anonymized submission to reviewer queue |
| **Parent digest** | Scheduled (if enabled) | Curated highlights from the week |
| **Grade book** | Teacher-initiated | Assessment data linked to specific version |

---

## 4. Schema

### Core Tables

```sql
-- The persistent entity: "Alex's chair prototype"
CREATE TABLE work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  school_id UUID,                          -- Nullable until school entity exists
  module TEXT DEFAULT 'studioloom',         -- OS seam
  unit_id UUID,
  activity_id TEXT,                        -- Links to the activity block that prompted this work
  class_id UUID,                           -- Resolves multi-class ambiguity (student_progress gap)
  design_stage TEXT,                       -- Current inferred stage (from latest enrichment)
  status TEXT DEFAULT 'in_progress',       -- in_progress / submitted / assessed / archived
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Each submission is a version
CREATE TABLE work_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  submission_type TEXT NOT NULL,           -- in_lesson / quick_capture / gallery / external
  submission_context JSONB,               -- { lessonPosition, phaseLabel, activityTitle }

  -- Enrichment output (Stage 3)
  ai_observations JSONB,                  -- Structured observations from AI enrichment
  criteria_alignment JSONB,               -- { criterionKey: { score, evidence, confidence } }
  design_stage_detected TEXT,             -- AI's assessment of which design phase this represents

  -- Integrity signals
  integrity_signals JSONB,                -- { timeSinceLastVersion, versionDeltaSize, metadataConsistency }

  -- Teacher interaction
  teacher_feedback JSONB,                 -- Teacher's own observations/comments (not AI)
  teacher_reviewed_at TIMESTAMPTZ,

  UNIQUE(work_item_id, version_number)
);

-- Individual files within a version
CREATE TABLE work_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_version_id UUID REFERENCES work_versions(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,               -- image / video / audio / sketch / document / model_3d
  storage_path TEXT NOT NULL,             -- Supabase Storage path
  thumbnail_path TEXT,                    -- Auto-generated thumbnail(s)
  mime_type TEXT,
  file_size_bytes BIGINT,

  -- Processing output (Stage 2)
  processing_status TEXT DEFAULT 'pending', -- pending / processing / completed / failed
  extracted_text TEXT,                    -- OCR / transcription output
  ai_tags JSONB,                          -- Object detection, material identification, etc.
  quality_assessment JSONB,               -- { usable: bool, issues: ['too_blurry', 'too_dark'] }
  processing_metadata JSONB,              -- Model used, processing time, confidence scores

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_work_items_student ON work_items(student_id);
CREATE INDEX idx_work_items_unit ON work_items(unit_id);
CREATE INDEX idx_work_items_activity ON work_items(activity_id);
CREATE INDEX idx_work_items_class ON work_items(class_id);
CREATE INDEX idx_work_items_module ON work_items(module);
CREATE INDEX idx_work_versions_item ON work_versions(work_item_id);
CREATE INDEX idx_work_versions_submitted ON work_versions(submitted_at);
CREATE INDEX idx_work_assets_version ON work_assets(work_version_id);
CREATE INDEX idx_work_assets_status ON work_assets(processing_status);
```

### Relationship to Existing Tables

```
activity_blocks (Dimensions3)
  ↓ activity_id
work_items
  ↓ work_item_id
work_versions
  ↓ work_version_id
work_assets

content_items (Dimensions3, Pipeline 1)        student_progress (EXISTING — text responses)
  ↓ teacher expectations                         ↓ coexists — text stays in student_progress,
  → AI enrichment context                          rich media goes to work_items
```

**Migration path from `student_progress`:** Student text responses continue to live in `student_progress.responses` JSONB (they work fine there). Rich media submissions (images, video, audio, sketches) flow through the new `work_items` pipeline. Both are linked by `(student_id, unit_id, activity_id)`. The portfolio reads from both sources. Eventually `student_progress.responses` could be replaced by `work_versions` for text too, but that's a future consolidation — not a v1 requirement.

---

## 5. Companion Systems Required

These are the OS-level services that Pipeline 2 depends on, ordered by build priority:

### 5.1 Storage & Media Service (build first)

**Why Pipeline 2 needs it:** Raw student uploads can be large (photos 3-8MB, video 50-500MB). Need bucket policies, signed URLs (student work is private), thumbnail generation, lifecycle rules (archive old versions, delete processing artifacts).

**StudioLoom v1 approach:** Supabase Storage with bucket-per-type structure:
- `student-work-raw/` — original uploads (private, signed URLs)
- `student-work-processed/` — enhanced images, transcoded video (private)
- `student-work-thumbnails/` — auto-generated thumbnails (private, faster access)

**Policies:** 10MB image limit, 100MB video limit, accepted types whitelist. Virus scanning via Supabase Storage built-in (or ClamAV Edge Function).

### 5.2 Processing Queue (build second)

**Why Pipeline 2 needs it:** Image enhancement + OCR + transcription are slow (5-30 seconds per asset). Can't block the student's upload response. Need async processing with retry logic.

**StudioLoom v1 approach:** `jobs` table + Supabase Edge Function on cron (poll every 10s). Job types: `image_enhance`, `ocr`, `transcribe`, `thumbnail`, `ai_enrich`. Priority levels: student feedback > batch reprocessing. Dead letter queue for failed jobs. Student sees processing status badge on their submission.

```sql
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending / processing / completed / failed / dead
  payload JSONB NOT NULL,                 -- { work_asset_id, processing_options }
  priority INT DEFAULT 5,                 -- 1 (highest) to 10 (lowest)
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error_message TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

**Migration to OS:** When the OS job queue (`job-queue` project) is built, swap the polling Edge Function for proper workers. The `processing_jobs` table schema is already compatible with `pg_boss` or BullMQ patterns.

### 5.3 Feedback Engine (build third, after Dimensions3)

**Why it depends on Dimensions3:** The Feedback Engine compares student work against teacher expectations stored in the Activity Block Library. Without Dimensions3's `activity_blocks` table and `content_items`, there's nothing to compare against.

**StudioLoom v1 approach:** Extend the existing Design Assistant with vision capabilities:
- New API route: `/api/student/work-feedback`
- Input: `work_version_id` → pulls latest assets + Pipeline 1 context + version history
- AI call with image input (Claude vision): "Look at this student's prototype photo. The activity asked them to [block.prompt]. The success criteria are [block.success_look_fors]. Their previous version looked like [version N-1 thumbnail]. What specific, actionable feedback would help them improve?"
- Output: structured `{ observations, strengths, nextSteps, criteriaAlignment, confidence }`
- Teacher override before student sees it (configurable per-class)

### 5.4 Moderation (build alongside or after)

**Why Pipeline 2 needs it more than Pipeline 1:** Student uploads are unpredictable. Teacher content is professional by nature. Student photos might accidentally contain faces of minors, personal information on whiteboards, inappropriate content.

**StudioLoom v1 approach:**
- Image safety screening via Claude vision (single cheap call: "Does this image contain faces of identifiable people, personal information, or inappropriate content?")
- Text moderation on extracted text / transcriptions
- PII detection (phone numbers on whiteboards, names on documents)
- Auto-flag, teacher reviews flagged items

---

## 6. Image Processing: The Hard Problem

This deserves its own section because it's the most technically challenging piece and the most differentiating feature for a DT platform.

### 6.1 What Students Actually Submit

From Matt's classroom experience, student photo submissions fall into these categories:

| Type | Challenge | Processing Needed |
|------|-----------|------------------|
| **Prototype photos** | Bad lighting, cluttered workshop background, multiple angles needed | Lighting correction, background separation, multi-image grouping |
| **Sketch scans/photos** | Skewed, shadows from phone, pencil faint on white paper | Perspective correction, contrast enhancement, line detection |
| **Annotated diagrams** | Mix of printed template + handwritten annotations | Separate printed structure from handwriting, OCR both |
| **CAD screenshots** | Clean but need context | Minimal processing, extract dimensions/labels |
| **Material samples** | Close-up photos of textures, joints, finishes | Material identification, quality assessment |
| **Process documentation** | Tool setup, workstation, mid-build | Object detection (tools, materials, safety equipment) |
| **Whiteboard captures** | Group work, planning, brainstorming | Perspective correction, text extraction, diagram recognition |

### 6.2 Processing Stack (v1 — pragmatic)

**Option A: Claude Vision as the processing layer**

Use Claude's vision capabilities for BOTH processing assessment AND enrichment in a single call. Instead of building separate OCR, object detection, and enhancement pipelines, send the raw image to Claude with a structured prompt:

```
Look at this student submission for the activity: [block.prompt]

1. QUALITY: Is this image usable? Rate blur/lighting/framing. Flag if retake needed.
2. CONTENT: What does this show? (prototype/sketch/diagram/material/process)
3. TEXT: Extract any visible text (printed or handwritten).
4. OBSERVATIONS: What can you observe about the student's work?
5. STAGE: What design stage does this represent?
```

**Pros:** Single API call, no separate OCR/vision pipeline, Claude already understands educational context.
**Cons:** Cost per image (~$0.01-0.03 with vision), latency (~3-5s), no image enhancement (output is text, not improved image).

**Option B: Hybrid — Sharp for enhancement + Claude for understanding**

- `sharp` (already installed in StudioLoom) for deterministic processing: resize, thumbnail, orientation fix, basic contrast/brightness normalization
- Claude vision for the understanding layer: what is this, what does it say, how good is it

This is the recommended v1 approach. Sharp handles the mechanical work cheaply and instantly. Claude handles the intelligence work.

### 6.3 Handwriting Recognition

The highest-value hard problem. DT students annotate sketches with dimensions, material names, process notes, design decisions. These annotations are the richest evidence of thinking.

**v1 approach:** Claude vision with explicit handwriting prompt: "This is a student's design sketch. Extract ALL handwritten text, including annotations, labels, dimensions, and notes. Preserve the spatial context (e.g., 'label on left side says..., arrow pointing to joint says...')."

**Quality expectation:** Claude vision handles clean handwriting well, struggles with very messy writing. For v1, this is acceptable — even 70% accuracy on handwriting provides value that 0% doesn't.

**Future:** Dedicated handwriting model (Google Vision API, Azure Computer Vision) for higher accuracy on difficult handwriting. Only invest if Claude vision proves insufficient on real student samples.

---

## 7. Integration Points with Existing StudioLoom

### 7.1 Student Lesson Page

Currently: response inputs (text, upload, canvas) save to `student_progress.responses` JSONB.

**With Pipeline 2:** Upload and canvas response types additionally create `work_items` + `work_versions` entries. The `student_progress` save still happens (backward compatibility), but the canonical version lives in `work_versions`. Dual-write during transition period.

**UI change:** Upload responses show processing status badge, version history expand, and AI feedback card (when available) below the response.

### 7.2 Design Assistant

Currently: text-only Socratic mentor via Haiku 4.5.

**With Pipeline 2:** Design Assistant gains ability to "look at" student's latest work submission. New interaction type: student uploads photo → AI references it alongside the conversation. System prompt extended with work observations from Stage 3 enrichment.

### 7.3 Portfolio

Currently: auto-pipeline from text responses → timeline view.

**With Pipeline 2:** Portfolio becomes a visual-first experience. Each entry can have images, video thumbnails, sketches. Version history shows evolution. Export includes curated visuals.

### 7.4 Grading

Currently: criterion scores (1-8) with text comments per student.

**With Pipeline 2:** Grading page shows visual evidence alongside criteria. Teacher can scrub through versions while assessing. AI observations surface as assessment support (not auto-grades — teacher always decides).

### 7.5 Gallery & Peer Review

Currently: text-based submissions and reviews.

**With Pipeline 2:** Gallery submissions can include processed images with thumbnails. Peer reviewers see enhanced versions. Reviews can reference specific visual elements.

### 7.6 Teaching Mode

Currently: live student grid with status dots and "Needs Help" detection.

**With Pipeline 2:** Teaching Mode shows thumbnail previews of student work in progress. Teacher can see at a glance who's produced what. "Photo submitted" status on student cards.

---

## 8. Build Phases

### Phase 0: Foundation (~3 days)
**Depends on:** Dimensions3 Phase A (activity_blocks table must exist)

- Migration: `work_items`, `work_versions`, `work_assets`, `processing_jobs` tables
- Supabase Storage bucket setup with policies
- Basic upload flow: student submits image → stored → work_item created → work_version created → work_asset created
- Processing status display on student lesson page
- No AI, no processing — just the data pipeline

### Phase 1: Image Processing (~4 days)
**Depends on:** Phase 0

- Sharp integration for deterministic processing (resize, thumbnail, orientation, contrast)
- Processing job runner (Edge Function or server action)
- Claude vision integration for image understanding (single combined call)
- Quality assessment (flag unusable photos)
- Text/handwriting extraction
- Processing status UI (pending → processing → done)
- Version history display on student work

### Phase 2: AI Enrichment & Feedback (~5 days)
**Depends on:** Phase 1 + Dimensions3 (Activity Block Library populated)

- Stage 3 enrichment: AI compares work against activity block expectations
- Version comparison: AI notes changes between submissions
- Feedback Engine v1: structured feedback generation
- Teacher override flow
- Design Assistant vision integration
- Portfolio visual entries

### Phase 3: Full Pipeline (~4 days)
**Depends on:** Phase 2

- Video processing (transcoding, thumbnails, transcription)
- Audio transcription
- Gallery integration (visual submissions)
- Teaching Mode work previews
- Grading page visual evidence
- Processing queue hardening (retry, dead letter, monitoring)

### Phase 4: Polish & Moderation (~3 days)
**Depends on:** Phase 3

- Image moderation (face detection, PII, inappropriate content)
- Bulk reprocessing (re-run enrichment when teacher updates expectations)
- Portfolio export with visuals
- Performance optimization (lazy loading, progressive image rendering)
- Student-facing "retake" suggestions when quality is poor

**Total estimate: ~19 days** (after Dimensions3 is complete)

---

## 9. Cost Model

| Operation | Cost per Unit | Volume Estimate | Monthly Cost (30 students, 3 units) |
|-----------|--------------|-----------------|--------------------------------------|
| Image storage | ~$0.001/image | ~20 images/student/unit | ~$1.80 |
| Sharp processing | Free (server-side) | All images | $0 |
| Claude vision (understanding) | ~$0.02/image | ~20 images/student/unit | ~$36 |
| Claude vision (feedback) | ~$0.03/feedback | ~10 feedbacks/student/unit | ~$27 |
| Transcription (Whisper) | ~$0.006/min | ~5 min audio/student/unit | ~$2.70 |
| Video transcoding | ~$0.01/video | ~3 videos/student/unit | ~$2.70 |
| **Total** | | | **~$70/month** |

Most cost is Claude vision. This scales linearly with student count. At 100 students: ~$230/month. Manageable for a school subscription.

**Cost reduction levers:**
- Cache enrichment for identical/similar images (dedup hash)
- Skip vision for text-only submissions
- Batch processing during off-hours (lower priority)
- Use cheaper vision models for quality assessment, Claude only for enrichment

---

## 10. Open Questions

1. **Should `student_progress` be replaced or augmented?** Current recommendation: augment (dual-write). Full replacement is cleaner but requires migrating all existing student data and all code that reads `student_progress.responses`. Pragmatic approach: new media goes through `work_items`, text stays in `student_progress`, portfolio reads both.

2. **Real-time feedback or batch?** Image processing + AI enrichment takes 5-15 seconds. Should students get instant "AI is looking at your work..." with streaming feedback, or is a notification ("Feedback ready") sufficient? Leaning toward notification — instant creates expectation of speed that's hard to maintain.

3. **Teacher opt-in per activity?** Not all activities need image processing. A text reflection doesn't need vision AI. Should teachers configure which activities enable rich processing? Or process everything and let routing handle it? Leaning toward: process everything (cheap with Sharp), only run AI enrichment when `activity_block.supports_visual_assessment = true`.

4. **Multi-image submissions?** A prototype might need front/side/top photos. How does the UI handle multi-image upload per activity? And how does the AI synthesize multiple angles into a single assessment? Leaning toward: allow up to 5 images per version, AI receives all in a single vision call.

5. **Offline/workshop mode?** Students in workshops often have poor WiFi. Should there be a "capture now, upload later" PWA capability? This is technically a client-side concern but affects the intake pipeline design (batch uploads, conflict resolution on delayed submissions).

---

## 11. Decisions Log

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Augment `student_progress`, don't replace | Migration risk too high for v1. Dual-write is safe. | 5 Apr 2026 |
| 2 | Sharp + Claude Vision hybrid for image processing | Sharp is free and fast for mechanical work. Claude handles the intelligence layer. No need for separate OCR/vision services in v1. | 5 Apr 2026 |
| 3 | Build AFTER Dimensions3 | AI feedback requires activity blocks with `success_look_fors` and teacher content from Pipeline 1. Without something to compare against, vision AI produces generic observations. | 5 Apr 2026 |
| 4 | OS-aligned schema from day 1 | `work_items`/`work_versions`/`work_assets` + `module` column. Zero cost now, clean lift into OS later. | 5 Apr 2026 |
| 5 | Processing queue as simple jobs table | Supabase cron + Edge Function for v1. Migrate to pg_boss/BullMQ when volume demands it. Stateless job handlers (same pattern as Dimensions3 ingestion passes). | 5 Apr 2026 |

---

## 12. Relationship to Other Projects

| Project | Relationship |
|---------|-------------|
| **Dimensions3** | **Hard dependency.** Pipeline 2 enrichment needs Pipeline 1's Activity Block Library to compare student work against teacher expectations. Build Dimensions3 first. |
| **3D Elements** | Student work pipeline processes 3D model files (.stl, .obj) in Phase 3+. `asset_type: 'model_3d'` on `work_assets`. R3F viewer for 3D submissions. |
| **Discovery Engine** | Discovery profile data enhances enrichment context — AI knows student's working style, strengths, and confidence level when interpreting their work. |
| **MonitoredTextarea** | Coexists. Text integrity continues via MonitoredTextarea. Image integrity uses different signals (metadata, timing, visual similarity). Both feed the same teacher integrity dashboard. |
| **Class Gallery** | Gallery submissions become `work_versions` snapshots. Processing pipeline generates proper thumbnails for gallery browse view. |
| **NM / Melbourne Metrics** | Work versions provide evidence for competency assessment. Teacher can link observation ratings to specific work submissions. |
