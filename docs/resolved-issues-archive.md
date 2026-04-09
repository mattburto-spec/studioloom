# Resolved Issues Archive

Extracted from CLAUDE.md on 7 Apr 2026. These issues are resolved and kept here for historical reference. Active issues remain in CLAUDE.md.

## Resolved

**Cleanup completed (25-28 Mar 2026):**
- ~~Remove temp debug panel from student lesson page~~ **DONE 28 Mar 2026**
- ~~Remove diagnostic `console.log` from `src/app/api/student/unit/route.ts`~~ **DONE 28 Mar 2026**
- NMConfigPanel checkpoint validation added (blocks save if no checkpoints placed) **DONE 28 Mar 2026**
- `getStudentId()` changed from `.single()` to `.maybeSingle()` (prevents 500 on corrupted sessions) **DONE 28 Mar 2026**
- Migration 056 applied (NM RLS policies updated for class_students junction) **DONE 28 Mar 2026**

**Cookie persistence on Vercel (23 Mar 2026):**
- ~~**Student login cookie not persisting on Vercel**~~ **FIXED 23 Mar 2026**
  - Fixed Vercel CDN stripping `Set-Cookie` headers by setting `Cache-Control: private, no-cache, no-store, must-revalidate` on auth routes
  - Fixed PostgREST PGRST201 ambiguity (class_students junction) by rewriting `student-session/route.ts` to query tables separately, no nested joins

**Dashboard layout (27 Mar 2026):**
- ~~**Dashboard 3-button layout needs visual testing**~~ Dashboard cards redesigned 27 Mar 2026 with photo thumbnails + type badges

**Class-local editor (22 Mar 2026):**
- **Class-local editor initial load had 404** — Fixed by changing `.single()` to `.maybeSingle()` on class_units query. Added ownership check fallback. **Deployed 22 Mar 2026**

**Academic integrity (19 Mar 2026):**
- ~~**No academic integrity safeguards beyond portfolio process documentation**~~ **BUILT 19 Mar 2026**
  - MonitoredTextarea + analyzeIntegrity + IntegrityReport implemented
  - Note: Needs testing + wiring into submission flow (this is a build-time resolution, not fully complete)

**Skeleton generation robustness (19-20 Mar 2026):**
- ~~**Skeleton generation "AI response missing lessons array" intermittent failure**~~ **HARDENED 19+20 Mar 2026**
  - `anthropic.ts` `generateSkeleton()` tries multiple nesting patterns
  - Dynamic max_tokens scaling (4096 → up to 8192 based on lesson count)
  - Added stop_reason, model, usage stats logging
  - Note: Error with "Got keys: []" still occurred on 20 Mar — should monitor server logs

**Toolkit wiring (26 Mar 2026):**
- ~~**useToolSession hook built but not yet wired into any toolkit tool component**~~ **WIRED 26 Mar 2026 — all 24 tools connected**

**Middleware routing (17 Mar 2026):**
- ~~**`/toolkit` was missing from middleware public routes, causing auth redirects for unauthenticated visitors**~~ **FIXED 17 Mar 2026**

## Migration Status Log

**Migration 025 (usage tracking)** — **CONFIRMED APPLIED 24 Mar 2026.** `ai_usage_log` table exists. Usage tracking is live.

**Migration 028 (student tool sessions)** — Status unknown, needs check.

**Migration 029 (Open Studio)** — APPLIED 20 Mar 2026.

**Migration 030 (NM)** — APPLIED 20 Mar 2026.

**Migration 032 (NM page_id UUID→TEXT fix)** — **CONFIRMED APPLIED 21 Mar 2026.**

**Migration 033 (unit-as-template architecture)** — **CONFIRMED APPLIED 21 Mar 2026.**

**Migration 035 (safety_badges)** — **CONFIRMED APPLIED 21 Mar 2026.**

**Migration 036 (student pace feedback — nullable columns)** — **CONFIRMED APPLIED 21 Mar 2026.**

**Migration 037 (school calendar + term_id + schedule_overrides on class_units)** — **CONFIRMED APPLIED 24 Mar 2026.** `school_calendar_terms` table + `class_units.term_id` + `class_units.schedule_overrides` all exist. All scheduling UI unblocked.

**Migration 038 (timetable + class_meetings)** — **CONFIRMED APPLIED 21 Mar 2026.**

**Migration 040 (unit forking)** — **CONFIRMED APPLIED 22 Mar 2026.**

**Migration 041 (student-class junction)** — **CONFIRMED APPLIED 23 Mar 2026** (discovered in use).

**Migration 047 (discovery_sessions)** — **CONFIRMED APPLIED 26 Mar 2026.**

**Migration 048 (learning_profile JSONB on students)** — **CONFIRMED APPLIED 26 Mar 2026.**

**Migration 049 (class_gallery — gallery_rounds, gallery_submissions, gallery_reviews)** — **CONFIRMED APPLIED 26 Mar 2026.**

**Migration 050 (studio_preferences — mentor_id + theme_id on students)** — **CONFIRMED APPLIED 27 Mar 2026.**

**Migration 051 (unit_type + curriculum_context on units)** — **CONFIRMED APPLIED 27 Mar 2026.**

**Migration 052 (unit thumbnail — `thumbnail_url TEXT` on units)** — **CONFIRMED APPLIED 29 Mar 2026.**

**Migration 053 (performance — composite indexes on high-traffic queries)** — **CONFIRMED APPLIED 28 Mar 2026.**

**Migration 054 (integrity_metadata JSONB on student_progress)** — **CONFIRMED APPLIED 30 Mar 2026.**

**Migration 055 (class framework — `framework TEXT DEFAULT 'IB_MYP'` on classes)** — **CONFIRMED APPLIED 28 Mar 2026.**

**Migration 056 (NM RLS junction fix — competency_assessments policies updated for class_students)** — **CONFIRMED APPLIED 28 Mar 2026.**

**Migration 057 (Project Dimensions Phase 0 — activity/page schema extensions)** — **CONFIRMED APPLIED 30 Mar 2026.**

**Migration 058 (knowledge_chunks enrichment — bloom_level, grouping, udl_checkpoints columns)** — **CONFIRMED APPLIED 30 Mar 2026.**

**Migration 059 (student_progress + planning_tasks RLS junction fix — UNION of class_students + legacy students.class_id paths)** — **CONFIRMED APPLIED 30 Mar 2026.**

---
*Last updated: 7 Apr 2026*
