# Ingestion System — Sub-Project Summary (v2)

**Project name:** `ingestion-pipeline`

**Two pipelines, one shared AI layer.**

---

## Pipeline 1: Teacher Content Ingestion

Structured, high-quality source material. Units, textbooks, rubrics, activity specs, exemplars, reference images, safety docs. Processed once, consumed many times. The AI uses this as its **knowledge base** — it needs to deeply understand the curriculum content to give students meaningful feedback against it.

**Key jobs:** chunk and index text for RAG, extract rubric criteria into structured data, tag by subject/strand/level, generate embeddings for semantic search, link to MYP criteria and design stages.

---

## Pipeline 2: Student Work Ingestion

Messy, varied, real-world. Photos of prototypes under bad lighting, shaky video of mechanisms, handwritten sketches on graph paper, half-finished CAD screenshots, audio reflections mumbled in a workshop.

**This is the hard problem.** The AI needs to:

- Interpret low-quality images (enhance, correct lighting/perspective, identify what's being shown)
- Read handwritten annotations on sketches
- Understand what stage of the design process this represents
- Compare against teacher-uploaded exemplars and rubric criteria from Pipeline 1
- Give feedback that's specific to *this* student's work against *that* teacher's expectations

**The five-stage pipeline remains:** intake → processing → enrichment → versioning → routing. But processing is significantly harder here — image enhancement, OCR on handwriting, and visual interpretation before the AI can even begin enrichment.

---

## Shared AI Context

The critical link: when a student submits a blurry photo of a sketch, the AI pulls from Pipeline 1 to know what good looks like, and from Pipeline 2's version history to know where this student has been. The feedback loop is:

**Teacher content** (what's expected) + **student work history** (where they've been) + **current submission** (what they're showing now) = **contextual feedback**

---

## Schema

### Student Work Tables

```
work_items
  id, student_id, school_id, activity_id,
  module (e.g. 'studioloom', 'jkids'),
  design_stage, status

work_versions
  id, work_item_id, version_number,
  submitted_at, submission_type

work_assets
  id, work_version_id, asset_type,
  storage_path, thumbnail_path,
  mime_type, file_size,
  extracted_text, ai_tags,
  processing_status
```

### Teacher Content Tables

```
content_items
  id, school_id, teacher_id, module,
  content_type (unit/rubric/exemplar/reference),
  subject, strand, level

content_assets
  id, content_item_id, asset_type,
  storage_path, extracted_text,
  embeddings_status, chunk_count
```

---

## Build Order

1. Schema for both pipelines
2. Teacher content intake + RAG indexing (this feeds everything)
3. Student work intake + basic storage
4. Image processing/enhancement layer
5. AI feedback loop connecting both pipelines

**Teacher pipeline first** — the AI can't give good feedback on student work until it knows what it's evaluating against.

---

## Why It's Foundational

- Cross-module portfolios (StudioLoom, Jkids, PYP, PP, DP all feed the same system)
- Longitudinal AI context (feedback references past versions and growth over time)
- Physical-digital bridge (photos of workshop projects → tagged, versioned, triggering XP)
- Consistent analytics across all apps on the OS
- Marketplace-ready (third-party content enters through the same teacher pipeline)
