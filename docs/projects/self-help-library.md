# Self-Help Skill Library

**Status:** SUPERSEDED — absorbed into [`skills-library.md`](skills-library.md) (11 April 2026). Kept for historical reference.
**Estimate:** 6-8 days
**Effort:** Medium

> **If you're here to build the skills library:** start at [`skills-library.md`](skills-library.md). This idea doc was the early framing; the full spec is now in [`../specs/skills-library-spec.md`](../specs/skills-library-spec.md) + [`../specs/skills-library-completion-addendum.md`](../specs/skills-library-completion-addendum.md). The new spec is much bigger: canonical skill cards with state ladder, freshness, context-aware gating, radar chart, six embed contexts, and cross-school sharing as moat.

## What is it

A searchable, browsable library of micro-lessons and how-to guides that students access independently during units. Examples: "Using a caliper," "Writing a design brief," "How to give peer feedback," "Testing prototypes," "Reading technical drawings," "Group brainstorm ground rules," "How to take portfolio photos."

Each guide is:
- 2-5 minutes to read/watch
- Standalone (no prerequisite knowledge required)
- Skill-focused, not assessment
- Optionally AI-generated from teacher uploads or hand-curated
- Linkable from lesson scaffolding (e.g., activity says "See our guide: Using a caliper")
- Taggable by framework (MYP Design, GCSE DT, ACARA, etc.)
- Searchable by skill name, keyword, or activity type

## Why it matters

**Student autonomy:** "How do I use this?" → find answer in 2 min, not hand-raised to teacher.
**Teacher efficiency:** Scales the 1:1 help without creating content per-class.
**Curriculum coherence:** Same guides across all units → students get consistent method-teaching.
**Differentiation:** Struggling students bookmark guides; advanced students skip them.

## What already exists

- **Toolkit tools** (27 interactive): Problem-finding, ideation, analysis, critique methods. Not how-to guides; more interactive/generative.
- **Safety badges** (migration 035): Knowledge verification via quiz, not guides.
- **Knowledge base RAG**: Lesson plan uploads with 3-pass analysis. Not structured skill guides.
- **ELL scaffolding** (3-tier): Sentence starters, guided prompts. Not standalone guides.
- **MiniSkills concept** (docs/projects/miniskills.md): Micro-units assignable to individual students. Overlaps but different scope (MiniSkills are mini-units with assessment, Library is reference-only).

## Architecture

**Data model:**
- `skill_guides` table: id, title, description, content JSONB, creator (teacher or system), created_at, tags JSONB (skills, frameworks, activity_types), visibility (public/teacher-only/private), embedding (for search)
- `student_skill_bookmarks` (optional phase 2): student_id, skill_id, bookmarked_at (allows "save for later")

**Two sources:**
1. **AI-generated from uploads** (Pass 2 analysis): Knowledge pipeline extracts isolated "how to do X" sections from uploaded lesson plans/textbooks as skill guides. Strip context, generalize, re-title. Requires Pass 2 output including extracted methods/procedures.
2. **Hand-curated by teacher** (future UI): Teacher creates guide via modal form. Content editor (Slate or TipTap with embedded video/image support).

**Student UI:**
- `/student/skill-library` page: search bar + filter pills (by framework, by activity type). Grid of skill cards with preview text + video thumbnail (if available) + "Bookmark" button.
- `/student/skill-library/[skillId]` detail page: full content + related skills section + "Back to library" button.
- Floating "?" help button on lesson pages with smart suggestions (if current activity matches tagged skills, show top 2 relevant guides).

**Teacher UI:**
- `/teacher/skill-library` management page: list all guides (AI-generated + hand-created) + create button + visibility toggles + bulk operations.
- Searchable guide picker in lesson editor: when a teacher is scaffolding an activity, they can insert a "See guide: [skillId]" link via modal picker.

## Connection to existing systems

- **Dimensions3 Activity Block Library:** Skill guides are metadata that travels WITH blocks. Each block can reference 0-N related guides (e.g., "Prototyping block" links to "Testing prototypes guide"). Blocks and guides stored separately but linked via tags.
- **Discovery Engine:** Mode 2 (Service/PP) could show relevant guides in context (e.g., after S4 problem-finding, suggest "How to write a design brief" guide).
- **Design Assistant:** "I don't know how to..." → Design Assistant suggests relevant guides instead of AI-generated answer.

## Relationship to Dimensions3

Guides are not part of the core pipeline (Phases A-E) but are a **Phase F enhancement** — a teaching support layer that feeds on existing data. Requires Pass 2 analysis to extract methods/procedures in a structured way. Low priority until ingestion pipeline is live and producing guides naturally as a side-effect.

## Build phases

**Phase 1 (2-3 days):** Data model + teacher create UI + student library page + basic search (keyword matching, not embedding).
**Phase 2 (3-4 days):** AI guide generation from Pass 2 output + embedding search + floating help suggestions + guide picker in lesson editor.
**Phase 3 (future):** Community guide sharing + voting system + teacher library marketplace.

## Metrics

- Guides created (system + hand-created)
- Guide views per skill
- Bookmark rate
- Time to answer student "how do I" questions (baseline via teaching mode logging → with guides)
- Guide quality (teacher ratings in picker)

## Notes

- No assessment attached to guides (unlike safety badges) — they're reference, not gated.
- Avoid the "giant pile of YouTube links" problem: guides are curated, searchable, framework-aware.
- Teacher control: can make guides private (visible to their classes only) or public (institution-wide).
