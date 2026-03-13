# StudioLoom Architecture Notes

## Tech Stack
- Next.js 15 (App Router) at `/Users/matt/CWORK/questerra`
- Supabase (Postgres + Auth + Storage)
- Tailwind CSS v4
- No additional UI framework

## Key Directories
```
src/app/(student)/          — Student-facing pages (dashboard, unit pages)
src/app/(auth)/             — Login pages
src/app/teacher/            — Teacher dashboard, class mgmt, settings
src/app/api/                — API routes (student/*, teacher/*, auth/*)
src/components/student/     — ResponseInput, ExportPagePdf, TextToSpeech, VocabWarmup
src/components/planning/    — PlanningPanel, FloatingTimer, DueDateDisplay
src/components/navigation/  — ProgressBar, SubwayNav
src/lib/                    — Constants, encryption, LMS providers
src/types/index.ts          — All TypeScript types
supabase/migrations/        — SQL migrations (001-005)
```

## Database Tables
- `teachers` — extends Supabase auth.users
- `classes` — teacher_id, name, code, external_class_id, external_provider
- `students` — username, display_name, class_id, ell_level, external_id, external_provider
- `student_sessions` — custom token-based auth (no password)
- `units` — title, description, thumbnail_url, content_data (JSONB)
- `class_units` — links units to classes, locked_pages, page_due_dates, page_settings
- `student_progress` — per page per unit: status, responses (JSONB), time_spent
- `planning_tasks` — student task tracker with target_date, actual_date, time_logged
- `teacher_integrations` — LMS config (provider, subdomain, encrypted token, LTI keys)

## Auth Pattern
- Teachers: Supabase Auth (email/password)
- Students: Custom session tokens — `nanoid(48)` → `student_sessions` table → HTTPOnly cookie
- LTI: OAuth 1.0a HMAC-SHA1 verification for LMS SSO

## Unit Content Structure (v2 — flexible pages)
Units store all page content in `content_data` JSONB field.
**A unit is an ordered list of pages. Each page has a type.**

### Page Types
- **strand** — tied to a criterion (A1, B3, etc.), counts toward assessment
- **context** — intro, background, design brief
- **skill** — tutorial, tool walkthrough, safety training
- **reflection** — self-assessment, peer feedback
- **custom** — whatever the teacher needs

### Key Changes from v1 (fixed 16 pages)
- Units can have any number of pages (4, 8, 20, etc.)
- Teacher picks which criteria to assess, not always A-D
- Pages are reorderable (drag/drop)
- Subway progress bar renders dynamically based on actual pages
- AI builder proposes a page sequence based on selected criteria + duration
- Non-strand pages have no grading weight

### Page Data
Each page has: title, type, criterion (optional, for strand pages), learningGoal, vocabWarmup, introduction, sections[], reflection.
Sections have: prompt, scaffolding (ELL 1/2/3), responseType, exampleResponse.

## MYP Criteria Colors
- A (Inquiring & Analysing): blue #2E86AB
- B (Developing Ideas): green #2DA05E
- C (Creating the Solution): orange #E86F2C
- D (Evaluating): purple #8B2FC9

## Color Scheme
- Dark Blue: #1B3A5C
- Accent Blue: #2E86AB
- Accent Orange: #E86F2C
- Accent Green: #2DA05E
- Accent Purple: #8B2FC9

## Response Types
text, upload (file), voice (MediaRecorder → webm), sketch (canvas drawing tool)
All uploads go to Supabase Storage bucket "responses" at path: `studentId/unitId/pageId/timestamp.ext`
