# Platform Follow-up Tickets

> Cross-cutting platform items that don't belong to a single project
> tracker. Things that touch many block types, span teacher + student
> surfaces, or sit between systems. New items land here when they're
> surfaced during a project build but the scope is wider than that
> project.

---

## FU-PLATFORM-BLOCK-USAGE-HISTORY — Per-teacher + per-student block usage analytics
**Surfaced:** 12 May 2026, post-Project-Spec-v2 ship.
**Severity:** 🟡 MEDIUM — small build, real value for teacher self-reflection + onboarding hints.
**Target phase:** A quiet afternoon when Matt wants a "what blocks am I using?" dashboard widget.

**What it adds:**
- **Teacher dashboard widget** — counts of each `responseType` / block id across the teacher's authored units this term. Bar chart, top 5 most-used, "you haven't tried these" prompt for ≤2 blocks. Optional: peer comparison ("classes like yours use X more often") when enough cohorts exist.
- **Student insights row** — per-student "your activity types" — counts of completed activities per `responseType`. Self-reflection signal ("I always reach for written response, never for the kanban").

**Why it's cheap:**
- No new tables. Teacher counts derived from a query over `units.content_data` JSONB grouped by `teacher_id`. Student counts derived from `student_progress.responses` keys grouped by tile_id → activity_id → responseType.
- One dashboard component + one (or two) API routes.

**Why it's valuable:**
- Surfaces unused blocks in the BlockPalette — students of teachers who only use 3 blocks are missing 25+ palette options. Helps Matt (and future onboarding) discover what's available.
- Gives students a "diet of cognitive activities" view — useful for the eventual NM Agency mapping (kanban use, journal use, reflective work).
- Cheap pilot for the "Block telemetry" concept that could later feed Discovery Engine personalisation.

**Definition of done:**
- New API route `/api/teacher/dashboard/block-usage` returning aggregated counts
- New API route `/api/student/insights/block-usage` returning per-student counts
- Dashboard widget in teacher dashboard (Bold v2)
- Insights row added to student insights page
- Bar chart + top 5 + "haven't tried" prompt
- No new tables; pure aggregation over existing data

**Sizing:** ~1 day.

---

## FU-PLATFORM-UNIFIED-GALLERY-PROMOTION — Single "Promote to Class Gallery" action for any block
**Surfaced:** 12 May 2026, post-Project-Spec-v2 ship.
**Severity:** 🔵 P1 — net-new capability that unlocks per-block reuse + cohort-to-cohort knowledge transfer.
**Target phase:** Post-pilot, deserves a build brief like the v2 split got.

**What it adds:**
- One unified action surface in the marking detail pane (and Open Studio submission view) — "Promote to Class Gallery" — works regardless of which block type the student submitted.
- Promoted items appear in the Class Gallery with a block-type-appropriate render (a Project Spec renders differently from a kanban board; both are valid gallery artifacts).
- Per-block consent flow — student must approve "your teacher wants to share this" before the work appears in the gallery for peers.

**Why this is a real project, not a small fix:**
- Each block type produces a different output shape (text / image / kanban state / project spec JSONB / decision matrix / SCAMPER triplets / structured-prompts / …). The gallery needs a **render strategy per block type**.
- **Privacy gating is non-trivial.** A User Profile slot 7 photo of a real 8-year-old needs explicit per-photo consent before being shared with the rest of the class. So does a quote about that user. Current Class Gallery code doesn't track per-photo consent.
- Promotion needs to be reversible (teacher can unpromote; student can withdraw consent).

**What it needs:**
- New table `class_gallery_promotions` (or extend existing gallery table) storing:
  - `student_id`, `unit_id`, `tile_id` (or activity ref), `block_type`
  - `rendered_payload JSONB` — frozen at promotion time so future archetype/slot copy changes don't break gallery rendering
  - `consent_status` (`pending` | `approved` | `withdrawn` | `denied`)
  - `promoted_by_teacher` (teacher_id), `promoted_at`
  - `featured BOOLEAN DEFAULT false` for teacher highlight
- Block-to-gallery renderer registry — `src/lib/gallery/renderers/{project-spec, product-brief, user-profile, success-criteria, kanban, structured-prompts, …}` — each module knows how to format that block's output for gallery display.
- Marking detail pane gets a "Promote" button on any tile.
- Student consent flow — notification on student dashboard, approve/decline, then gallery publishes.
- Gallery UI updates to display promoted items alongside existing types, grouped by block type or chronologically.

**Definition of done:**
- Migration creating `class_gallery_promotions` table + RLS
- 6-8 block renderer modules (one per shipped block type)
- "Promote" button on marking + Open Studio submission views
- Student-side consent inbox + approval flow
- Gallery UI surfaces promoted items
- Tests: a teacher can promote any block, student receives + approves the consent prompt, item appears in gallery
- Build brief authored before code starts (Matt's checkpoint pattern)

**Sizing:** ~1–2 weeks. Spec → schema → renderer registry → consent flow → marking + gallery UI.

**Why it's high value:**
- Class Gallery becomes a real cohort-to-cohort knowledge transfer layer. Year 9 cohort 2026 sees what year 9 cohort 2025 built.
- User Profile work especially valuable across cohorts — empathy research compounds.
- Unlocks the Discovery Engine's "show me what other students did" pattern at scale.
- Gives a unified "share my work" pattern across all blocks, simplifying the student mental model.

---

## Resolved

_None yet._
