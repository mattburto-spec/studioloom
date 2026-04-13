# Dimensions3 Phase 5 Brief — Content Safety & Moderation

> **Goal:** No student content reaches the database unscreened. No teacher safety alerts are lost. Legal/compliance requirement — NOT a nice-to-have.
> **Spec:** `docs/projects/dimensions3-completion-spec.md` §7 (lines 1051–1198)
> **Estimated effort:** 4–5 days
> **Checkpoint:** 5.1 — Safety end-to-end (EN + ZH + image), 11 sub-steps

---

## Pre-flight checklist (Code: do these FIRST, report before writing ANY code)

1. `git status` — clean tree, on `main`, expected HEAD
2. `npm test` — capture baseline (expected: 948 tests, 0 failures)
3. Verify migration numbering: `ls supabase/migrations/ | tail -3` — next is 073 (spec says 067 but that's consumed)
4. Audit ALL student write endpoints — grep for every route under `src/app/api/student/` that does `.insert()`, `.update()`, or `.upsert()` on any table. List them all. These are the moderation wiring targets.
5. Check existing `src/lib/safety/` — this is Safety Badges (workshop safety), NOT content moderation. Confirm no naming collision.
6. Check existing `src/lib/ingestion/moderate.ts` — this is ingestion-side block moderation. Phase 5 is student-facing. Different scope, but we may want shared types.
7. Check `student_progress` schema — columns `moderation_status` and `moderation_flags` may already exist from migration 067. If so, Phase 5 migration only adds the `content_moderation_log` table.
8. Check if LDNOOBW repo is accessible: `https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words`
9. **STOP AND REPORT** all findings before proceeding.

---

## Lessons to re-read before coding

- **#38** — Verify = assert expected values, not just non-null (migration verify must check value distribution)
- **#39** — Pattern bugs: audit all similar sites (every student write endpoint, not just one)
- **#43** — Think before coding: surface assumptions
- **#44** — Simplicity first: minimum code that solves the problem
- **#45** — Surgical changes: don't improve adjacent code
- **#24** — Never assume column names exist in production

---

## Sub-tasks

### 5A — Migration 073 + shared types
- `supabase/migrations/073_content_safety.sql`
  - Check if `student_progress.moderation_status` and `moderation_flags` already exist (from 067). If yes, skip those ALTERs.
  - CREATE TABLE `content_moderation_log` per spec §7.1
  - Indexes on (class_id, severity, created_at DESC) and (student_id, created_at DESC)
- `src/lib/content-safety/types.ts` — shared types: `ModerationResult`, `ModerationContext`, `FlagType`, `Severity`, `ContentSource`
- Tests: schema structure tests (table exists, columns correct)
- **Verify:** Run migration against local DB, query `content_moderation_log` schema

### 5B — Layer 1: Client-side text filter
- `src/lib/content-safety/client-filter.ts`
  - LDNOOBW blocklist vendored into `src/lib/content-safety/blocklists/ldnoobw-en.json` + `ldnoobw-zh.json`
  - `LICENCE.md` citing CC0
  - Self-harm supplement list (hand-curated, cited)
  - PII regex patterns (phone EN+CN, email, address)
  - Language detection (lightweight, EN vs ZH)
  - `checkClientSide(text: string): { ok: boolean, reason?: string, lang: 'en' | 'zh' | 'other' }`
- Log endpoint: `POST /api/safety/log-client-block` (anonymized — counts only, no content)
- Tests: blocklist matching (EN profanity, ZH profanity, PII patterns, clean text passes, case-insensitive, partial word handling)
- **Verify:** Test against known EN + ZH blocked terms, verify clean text passes

### 5C — Layer 1: Client-side image filter (NSFW.js)
- `src/lib/content-safety/client-image-filter.ts`
  - NSFW.js lazy-loaded (~4MB WASM)
  - `checkClientImage(file: File): Promise<{ ok: boolean, scores: Record<string, number> }>`
  - Block threshold: `porn + hentai + sexy > 0.6` (configurable via env)
  - Fallback: if model fails to load, `ok: true` with warning log (server Layer 2 catches it)
- Tests: mock-based tests for threshold logic, fallback behavior
- **Verify:** Lazy loading works, model doesn't block page render

### 5D — Layer 2: Server-side Haiku moderation
- `src/lib/content-safety/server-moderation.ts`
  - `moderateContent(input: string | Buffer, context: ModerationContext): Promise<ModerationResult>`
  - Bilingual prompt at `src/lib/content-safety/prompts/moderation-system.ts`
  - Uses `claude-haiku-4-5-20251001` (text + vision multimodal)
  - Output: `{ flags: [{ type, severity, confidence, lang }], overall: 'clean'|'flagged'|'blocked' }`
  - **Fallback:** Haiku failure → `moderation_status='pending'`, NEVER 'clean'
  - Image handling: resize to 1024px max before send
  - Severity → action map: info→clean+log, warning→flagged+notify, critical→blocked+notify+log
- Tests: mock Haiku responses for each severity, failure fallback, image resize logic
- **Verify:** Real Haiku call against test text (EN + ZH), verify JSON response shape

### 5E — Wire moderation into ALL student write endpoints
- Audit from pre-flight: wire `moderateContent()` into every student write endpoint
- Expected targets (verify in pre-flight):
  - `/api/student/progress` (text responses)
  - `/api/student/tool-session` (toolkit tool state)
  - `/api/student/gallery/post` (gallery submissions)
  - `/api/student/peer-review` (peer review comments)
  - `/api/student/upload-image` (if exists)
  - Any other student write endpoint found in pre-flight audit
- Each endpoint: call `moderateContent()` before persisting, set `moderation_status` on result, log to `content_moderation_log` if flagged/blocked
- **Verify:** Grep for all student write endpoints — every one routes through moderation. No gaps.

### 5F — Ingestion pipeline safety scan
- Add step to `src/lib/ingestion/pass-a.ts` that calls `moderateContent()` on extracted text
- If flagged/blocked → hold upload with `status='moderation_hold'`
- Surface in admin queue
- Note: `moderate.ts` already handles block-level moderation. This is document-level.
- **Verify:** Upload a test doc with flagged content → held in moderation queue

### 5G — Teacher safety alert feed
- `src/app/teacher/safety/page.tsx` (new page)
  - Per-class filter dropdown
  - List view of `content_moderation_log` rows grouped by severity
  - Actions: Mark false positive, Escalate
  - Critical alerts → red badge on teacher dashboard (can't dismiss without acknowledgment)
- API: `GET /api/teacher/safety/alerts` + `PATCH /api/teacher/safety/alerts/[id]`
- **Verify:** Real alerts from 5D/5E appear in feed, actions work

### 5H — Rollback controls
- `NEXT_PUBLIC_CLIENT_FILTER_ENABLED` env var (default: true)
- `MODERATION_MODE=off|log|enforce` env var (default: enforce)
- Verify both controls work

### 5I — Checkpoint 5.1 preparation
- Run through all 11 checkpoint sub-steps from spec §7.6
- Document results for Matt sign-off

---

## Stop triggers (Code: STOP and report if any of these occur)

1. Pre-flight audit finds > 8 student write endpoints (may indicate scope is larger than expected)
2. `student_progress` schema doesn't have `moderation_status` column (migration history inconsistency)
3. LDNOOBW repo is unavailable or licence has changed from CC0
4. NSFW.js has a breaking API change or the MobileNet v2 variant is discontinued
5. Haiku vision endpoint rejects image input (API contract change)
6. Any student write endpoint has no clear insertion point for moderation call

## Don't stop for

- Minor LDNOOBW word list gaps (supplement later)
- NSFW.js model size being slightly different from spec (~4MB vs actual)
- Language detection not being 100% accurate (it's a hint for the blocklist, not a gate)
- Test count not being exact (±5 from baseline is fine during active development)

---

## Commit plan

1. 5A: Migration + types
2. 5B: Client text filter + blocklists + tests
3. 5C: Client image filter (NSFW.js) + tests
4. 5D: Server moderation (Haiku) + tests
5. 5E: Wire all student endpoints + tests
6. 5F: Ingestion pipeline safety scan
7. 5G: Teacher safety feed UI + API
8. 5H: Rollback controls
9. 5I: Checkpoint prep (if needed as separate commit)

Separate commits. No squashing. Each commit green before next.
