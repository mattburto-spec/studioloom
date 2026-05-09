# Feedback Loop Closure v1 — Phase Brief

> Phase tracker: `TFL` (Teacher Feedback Loop)
> Drafted: 8 May 2026
> Branch: `grading-loop-closure-brief` (docs only; build branch will be `grading-feedback-loop-v1`)
> Status: **DRAFT — pre-flight complete, awaiting Matt sign-off on assumption block + Open Questions before TFL.1 starts**
> Parent project: Grading (G1 → G2 → G3 shipped to main as of 8 May 2026)
> Build methodology: [`docs/build-methodology.md`](../build-methodology.md)
> Visual reference: existing `<InlineTeacherFeedback />` in `src/components/grading/TeacherFeedbackPanel.tsx`

---

## 1. Problem framing (Matt's voice)

> Right now feedback works one way: I write a comment, the student reads it, and that's it. There's no way for them to say "I don't understand," no way for me to know if they actually opened it, no way to convert a comment into a thing they actually have to act on. Feedback that students never see — or see but can't respond to — is feedback that doesn't change behaviour. If StudioLoom is going to win on "actually closes the feedback loop" (which is the wedge), v1 needs read-receipts, sentiment-tagged replies, and a way to turn comments into tracked revisions. Berger's three rules ("Be kind. Be specific. Be helpful.") sit quietly above my composer to nudge me toward the kind of feedback worth giving.

---

## 2. Goals

A teacher should be able to:
1. **See whether a student has read each comment.** Soft "unread > 48h" indicator; no blame-y tone.
2. **See the student's reply.** Sentiment-tagged ("Got it" / "Not sure what you mean" / "I'd push back") with optional free-text.
3. **Convert any comment into a tracked revision task.** When the student edits the response and marks addressed, the comment shows "addressed in revision v2" with a snapshot.
4. **See a feedback-acted-on rate per student**, so the dashboard can flag students who never engage with feedback.
5. **Be reminded gently** of Berger's three rules when composing.

A student should be able to:
1. **Reply to a teacher comment in two clicks** with one of three sentiments + optional text.
2. **See clearly which comments are revision tasks** vs. informational comments.
3. **Mark a revision task as addressed** when they've revised their response.

---

## 3. Pre-flight findings

### 3.1 Baseline
- Branch: `grading-loop-closure-brief` off `origin/main` at `ff750e4` (G3 polish merge).
- Working tree: clean.
- `npm test` baseline: **4900 passed | 11 skipped (4911 total)**, 296 test files passed | 2 skipped. Lock this for the phase.
- Migrations applied to prod through `20260508214312_add_score_na.sql` (Polish-3, 8 May).

### 3.2 Lessons re-read
Read in full from [`docs/lessons-learned.md`](../lessons-learned.md):
- **#38** — `ADD COLUMN DEFAULT silently overrides subsequent conditional UPDATEs.` Migration 067 grandfather bug. Verify queries must assert *expected values*, not "non-null". If a column has conditional backfill, ADD without DEFAULT, fill explicitly, then `SET NOT NULL`.
- **#39** — `Silent max_tokens truncation in Anthropic tool_use calls drops required fields without throwing.` *Pattern-bug rule:* if you fix one site of a class of bug, audit and fix all sites in the same phase. Doesn't directly apply to this phase (no AI work) but the pattern-bug discipline applies to RLS, schema, and audit-event writers.
- **#43** — `Think before coding: surface assumptions, don't hide confusion.` 2-3 line assumptions block before any code; ask Matt rather than guess on ambiguous UX.
- **#44** — `Simplicity first: minimum code that solves the problem.` Single replies, no "feature flags for sentiment vocabulary"; no abstract revision-engine.
- **#45** — `Surgical changes: touch only what you must.` This phase touches grading + student-lesson surfaces only. Don't refactor the marking page layout while you're in there. File observations as FU items.
- **#46** — `Goal-driven execution: define success criteria, loop until verified.` Each sub-phase has a named Matt Checkpoint with explicit pass criteria.
- **#54** — `WIRING.yaml entries can claim "complete" features that don't exist.` Audit by grep before trusting any system summary. **Already triggered during this audit — see §3.4.**

### 3.3 Audit-before-touch — comment surfaces in current code

Every existing surface that reads or writes teacher feedback / comments:

| Surface | File | Direction |
|---|---|---|
| Teacher composer + send | `src/app/teacher/marking/page.tsx` (override panel — single-column stack post-Polish-2) | Writes `student_facing_comment` via PUT |
| Service write site | `src/lib/grading/save-tile-grade.ts` | Single chokepoint; writes `student_tile_grades` row + `student_tile_grade_events` audit row in one call |
| Teacher PUT API | `src/app/api/teacher/grading/tile-grades/route.ts` | Body accepts `student_facing_comment`, `score_na`, etc. |
| AI batch writes draft | `src/app/api/teacher/grading/tile-grades/ai-prescore/route.ts` + `src/lib/grading/ai-prescore.ts` | Writes `ai_comment_draft` (G3.1, prompt v2) |
| Student read | `src/app/api/student/tile-comments/route.ts` (GET) | Returns rows where `student_facing_comment` non-empty for (student, unit, page) |
| Student inline render | `src/components/grading/TeacherFeedbackPanel.tsx` exports `useTileFeedback` + `<TeacherFeedbackBanner />` + `<InlineTeacherFeedback />` | Anchored cards below each `<ActivityCard />` + top-of-page banner |
| Student lesson page mount | `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` | Calls `useTileFeedback` + renders banner + inline cards inline with sections |
| Student dashboard bell | `src/app/api/student/recent-feedback/route.ts` + `src/app/(student)/dashboard/DashboardClient.tsx` + `src/components/student/BellCountContext.tsx` + `src/components/student/BoldTopNav.tsx` | Bell shows "feedback" kind notification (emerald, last-14-days window) |
| Past-feedback callout (Synthesize) | `src/app/api/teacher/grading/past-feedback/route.ts` | Reads `assessment_records.data.overall_comment` for prior released grades |
| Release writes overall comment | `src/app/api/teacher/grading/release/route.ts` | Snapshots into `assessment_records.data.overall_comment` |

**Comment data model as it exists today** (after G2.3 + G3 + G3-polish):

```sql
-- student_tile_grades (the row Feedback Loop Closure will extend)
student_facing_comment TEXT       -- visible to student; emerald textarea writes here
ai_comment_draft       TEXT       -- AI draft (Haiku); review-and-edit loop
override_note          TEXT       -- private to teacher
released_at            TIMESTAMPTZ -- snapshot at G1.4 "Release to student"
released_score         SMALLINT
released_criterion_keys TEXT[]
score_na               BOOLEAN NOT NULL DEFAULT false
```

**RLS policies on the comment surface:**
- `student_tile_grades`: `Teachers manage tile grades for their classes` (FOR ALL via class-ownership join), `Service role full access tile grades`.
- `student_tile_grade_events`: `Teachers read tile grade events for their classes` (SELECT), `Service role full access tile grade events` (FOR ALL).
- Students do NOT have direct table access (custom session-token auth, not Supabase Auth — Lesson #4). All student reads go through service-role API routes that gate on `requireStudentSession`.

**Surprises caught during audit (worth flagging before designing changes):**
- The student lesson page already has a "seen by student" signal latent in the data: `student_progress.responses` carries the response timestamp via `updated_at`. We don't need a new column to prove "the student visited the page" — but we DO need one to prove "the student saw THIS comment" (i.e., it was rendered after the comment was sent). Distinct concept. See Open Question 2.
- `student_tile_grade_events` is append-only audit. Replies + revision actions belong here (the audit trail is half the value). Already has `source` enum supporting domain-specific values; we'll extend the enum.
- The G3.1 `ai_comment_draft` lives alongside `student_facing_comment` and gets PROMOTED on send. Replies + revisions need their own writers but the same "draft → released" pattern fits. No need to invent.
- `assessment_tasks` (TG.0B, 5 May) is a parallel summative-grading concept — separate table. **Out of scope** for this phase. Per-tile feedback (`student_tile_grades.student_facing_comment`) is the right surface.

### 3.4 Registry cross-check (per skill Step 5c)

Spot-checked seven registries. Findings table:

| Registry | Source/line | Severity | Finding | Action |
|---|---|---|---|---|
| `docs/projects/WIRING.yaml` | 1467 — `teacher-grading` entry | **HIGH** | `data_fields.table: grades` doesn't exist (we use `student_tile_grades` + `assessment_records.data.criterion_scores[]`). `key_files` points at `src/app/teacher/grading/[unitId]/[classId]/page.tsx` — the actual current grading UI is `src/app/teacher/marking/page.tsx`. `summary` describes pre-G1 state. The whole G1+G2+G3 build is uncatalogued in WIRING. **Lesson #54 in action.** | TFL.5 (registry-sync) re-writes `teacher-grading` summary, `data_fields`, `key_files`, `affects` to reflect reality. Adds new system entry `grading-feedback-loop` for replies/receipts/revisions. |
| `docs/projects/WIRING.yaml` | 1471 — `student-grade-view` entry | MEDIUM | Same `data_fields.table: grades` drift. Doesn't acknowledge the inline `<InlineTeacherFeedback />` component on the student lesson page. | TFL.5 — refresh entry. |
| `docs/schema-registry.yaml` | 9290 — `student_tile_grades` entry | MEDIUM | Columns array is missing `ai_comment_draft` (G3.1) and `score_na` (Polish-3). Both shipped on `main` but registry not yet updated. | TFL.5 — add both columns to the entry, plus the three new columns this phase will introduce. |
| `docs/api-registry.yaml` | — | LOW | `/api/student/recent-feedback` (G3 polish) missing. Scanner picks it up on next saveme. | Saveme regen at TFL.5. |
| `docs/ai-call-sites.yaml` | — | MEDIUM | `lib/grading/ai-prescore` (G1.3 + G3.1) is missing entirely. Two prompt versions shipped (`grading.aiprescore.v1.0.0`, `grading.aiprescore.v2.0.0`); registry has zero entries. This phase doesn't change AI calls, but the registry should reflect existing reality before the next AI call lands. | TFL.5 — add the call site. |
| `docs/feature-flags.yaml` | — | none | No flags or env vars added by this phase. | No action. |
| `docs/vendors.yaml` | — | none | Anthropic already covered. No new vendor. | No action. |
| `docs/scanner-reports/rls-coverage.json` | — | clean | 0 drift entries on `student_tile_grades` / `student_tile_grade_events`. | No action. |

**Registry-sync sub-phase (TFL.5) is mandatory** — both for the new schema this phase adds AND for closing the pre-existing drift listed above. Per skill Step 5c rule: "the registries should be accurate as the phase ships."

### 3.5 WIRING.yaml affects-list for systems we'll touch
- `teacher-grading`: `affects: [student-grade-view, lesson-pulse, gamification]` — this phase doesn't change those downstream consumers, but check whether feedback-acted-on rate becomes input to lesson-pulse later (Open Question 11).
- `student-grade-view`: `affects: [student-dashboard, lesson-view]` — bell badge already wired (G3-polish #4).
- `lesson-view`: depends on `student-data, teacher-grading` — inline cards already mounted; reply UI extends existing cards.
- New system `grading-feedback-loop` to be added in TFL.5.

---

## 4. What's IN scope

### TFL.1 — Read receipts (~1 day)
- Schema: `student_tile_grades.student_seen_comment_at TIMESTAMPTZ NULL`. NO DEFAULT (Lesson #38 — backfill explicitly).
- API: extend `GET /api/student/tile-comments` to **also** bump `student_seen_comment_at = now()` for returned rows in the same transaction. (One round-trip per page open. Idempotent.) Alternative: separate POST endpoint — see Open Question 2.
- UI (teacher): on each row in `src/app/teacher/marking/page.tsx`, render an unread/seen indicator next to the existing "Sent" / "Sent ✎" chip. "Unread" copy: small grey dot + tooltip "Sent {ago}, not yet seen."
- **Dot colour ladder (revised 10 May 2026 per Checkpoint 1.1 smoke):**
  - **GREEN (emerald)** = `seen-current` — student has loaded the page since the comment was last edited. No teacher action needed.
  - **AMBER** = `seen-stale` (you edited the comment since they read it) **OR** `unread-stale` (sent > 48h ago and still no receipt). Both states are "nudge worth doing" from the teacher's POV; tooltip disambiguates the reason.
  - **GREY** = `unread-fresh` — comment sent recently (< 48h), student hasn't loaded the page yet. Just waiting.
  - **No dot** = `unsent` — no comment exists on this row.
  - The original brief lumped `seen-stale` with `seen-current` as emerald. Matt's TFL.1 Checkpoint 1.1 smoke surfaced that "I edited and the student hasn't re-seen the new version" should NOT render as a no-action-needed state — the spec is corrected here. Tooltips already disambiguate the two amber sub-states ("Seen the older version" vs "Sent X ago, still unread"). Pinned by static test in `src/app/teacher/marking/__tests__/marking-page-tfl1-static.test.ts`.
- UI (student): no change — implicit on render.
- Migration: `<TIMESTAMP>_add_student_seen_comment_at.sql` (mint via `bash scripts/migrations/new-migration.sh add_student_seen_comment_at` at start of TFL.1).
- **Hotfix migration (10 May 2026, post-Checkpoint 1.1):** `20260509222601_add_bump_student_seen_comment_at_rpc.sql` adds a SECURITY DEFINER PL/pgSQL function `bump_student_seen_comment_at(p_student_id, p_unit_id, p_page_id)` that does `SET student_seen_comment_at = now()`. The route now calls this RPC instead of `.update({ student_seen_comment_at: new Date().toISOString() })`. Both the SET clause and the BEFORE-UPDATE trigger's `updated_at` derive from the same Postgres `now()` — eliminating the JS-vs-DB clock skew that previously left `seen_at` ~150ms behind `updated_at` on a fresh receipt.
- **Matt Checkpoint 1.1:** student opens lesson with comment → check Supabase that `student_seen_comment_at` flipped from null → now(). Teacher row chip shows "seen" pill instead of unread. After 48h with no read, grey dot becomes amber. **Edit comment → dot flips emerald → amber until student re-loads.**

### TFL.2 — Replies + sentiment (~1.5 days)
- Schema: new table `student_tile_grade_replies`:
  ```
  id UUID PRIMARY KEY
  grade_id UUID NOT NULL REFERENCES student_tile_grades(id) ON DELETE CASCADE
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE
  sentiment TEXT NOT NULL CHECK (sentiment IN ('got_it','not_sure','pushback'))
  reply_text TEXT NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  ```
  RLS: append-only; teachers SELECT for their classes (via grade_id → student_tile_grades → class_id → classes.teacher_id). Service-role full access. No student-side RLS (custom auth path).
- API:
  - `POST /api/student/tile-comments/[grade_id]/reply` — body `{ sentiment, reply_text? }`. Auth: `requireStudentSession`. Validates grade.student_id matches session.studentId before insert. Writes reply + an event row (`source='student_reply'`) into `student_tile_grade_events`.
  - Extend `GET /api/student/tile-comments` response shape to include the latest reply per tile so the inline card can show "you replied {ago}: …" state.
  - Extend the marking page's bulk loader to fetch replies (single query, joined; LATEST per grade_id via `DISTINCT ON`).
- UI (student): in `src/components/grading/TeacherFeedbackPanel.tsx` `<InlineTeacherFeedback />`, after the comment text, three sentiment buttons. Click → optional textarea slides down (Framer Motion, 180ms — same as G3.3 transitions per Lesson #45 surgical-change discipline) → "Send reply." After send, card shows "✓ You replied: {sentiment}{ — text…}".
- UI (teacher): override panel in `src/app/teacher/marking/page.tsx` shows the latest reply inline below the "Feedback to {firstName}" textarea. Pill colour matches sentiment: emerald for "got_it", amber for "not_sure", rose for "pushback".
- Migration: `<TIMESTAMP>_student_tile_grade_replies.sql`.
- **Matt Checkpoint 2.1:** student clicks "Not sure what you mean" + types a question + submits → row in `student_tile_grade_replies` + audit event row. Teacher opens the row → reply visible in amber pill below the comment textarea. Teacher can write a clarifying comment + send; student loop continues.

### TFL.3 — Revision tasks (~2 days)
- Schema additions on `student_tile_grades`:
  ```
  revision_requested_at      TIMESTAMPTZ NULL
  revision_addressed_at      TIMESTAMPTZ NULL
  revision_response_snapshot TEXT NULL          -- captured at addressed time
  ```
  No new table. v1 = at most one open revision per (student, tile). When teacher requests revision a second time on the same tile, the prior `revision_addressed_at` is preserved in event log; live row resets `addressed_at = null` and bumps `requested_at = now()`.
- API:
  - `POST /api/teacher/grading/tile-grades/[id]/request-revision` — toggles `revision_requested_at = now()` (or clears if already set). Writes event row (`source='teacher_request_revision'`).
  - `POST /api/student/tile-comments/[grade_id]/mark-addressed` — student-side. Reads current `student_progress.responses[tile_id]` text, writes `revision_addressed_at = now()` + `revision_response_snapshot = <current text>`. Writes event row (`source='student_mark_addressed'`).
  - `GET /api/teacher/grading/feedback-acted-on?class_id=X[&unit_id=Y]` — returns per-student `{ requested: N, addressed: M, rate: M/N }`. Drives the teacher dashboard "feedback acted-on rate" card.
- UI (teacher):
  - `src/app/teacher/marking/page.tsx` — in the override panel, an "Ask for a revision" button next to "Send to student". Click → comment row gets a small "↻ revision requested" badge. When student marks addressed, badge changes to "✓ addressed in revision" with click-to-expand showing the snapshot diff (vs the response text on revision_requested_at).
  - **New summary card** on the marking page header: "Feedback acted-on rate · {N}/{M} ({pct}%)" — clickable, expands to show per-student breakdown. Reuses the existing class-level header row above the tile strip.
- UI (student):
  - `src/components/grading/TeacherFeedbackPanel.tsx` `<InlineTeacherFeedback />` — when `revision_requested_at` is set + not yet addressed, the card gets a stronger emerald border + a "↻ Revise this" header + a "Mark as addressed" button below the response textarea on the lesson page. Clicking the button captures the current response (sanitised, same `sanitizeResponseText` helper from Polish-1) and sends to mark-addressed endpoint.
  - Bell notification: `src/app/api/student/recent-feedback/route.ts` extended — revision tasks bubble to the top of the feedback list with kind = "feedback" + a "↻ revise" prefix in `dueText`. Matches existing bell wiring.
- Migration: `<TIMESTAMP>_grade_revision_tracking.sql`.
- **Matt Checkpoint 3.1:** teacher requests revision on a comment → student sees "↻ Revise this" + "Mark as addressed" button → student edits response + clicks → teacher sees "addressed in revision v2" with snapshot. Dashboard rate card flips from "0/1 (0%)" to "1/1 (100%)".

### TFL.4 — Berger's three rules header (~30 min)
- UI only: `src/app/teacher/marking/page.tsx` — directly above the "Feedback to {firstName}" textarea, a quiet single-line header in muted grey text:
  > **Berger's rules: be kind. be specific. be helpful.**
- No enforcement, no validation, no AI second-reader, no checkboxes. Just norm-setting copy. Stays visible at all times (per Open Question 5).
- No tests beyond a snapshot test that the text exists in the DOM (Lesson #71 — pure-logic-in-tsx isn't testable; this is a string in JSX, snapshot is the right level).
- **Matt Checkpoint 4.1:** smoke — header visible in the override panel, doesn't compete with the textarea visually.

### TFL.5 — Registry sync + loop closure proof (~0.5 day)
- Update `docs/projects/WIRING.yaml`:
  - Rewrite `teacher-grading` entry — fix `data_fields`, `key_files`, `summary`, `affects`. Add `change_impacts` for new feedback-loop columns/tables.
  - Add new system `grading-feedback-loop` (status: complete; depends_on: [teacher-grading, student-grade-view]; affects: [student-dashboard]).
  - Refresh `student-grade-view` entry.
- Update `docs/schema-registry.yaml`:
  - Add `ai_comment_draft`, `score_na`, `student_seen_comment_at`, `revision_requested_at`, `revision_addressed_at`, `revision_response_snapshot` to `student_tile_grades`.
  - Add new `student_tile_grade_replies` table entry.
  - Update `applied_date` and `source_migration` lists.
- Update `docs/ai-call-sites.yaml`:
  - Add `lib/grading/ai-prescore` entry (Haiku, 900 max_tokens, prompt_version `grading.aiprescore.v2.0.0`, fallback chain none, cost category low).
- Run `python3 scripts/registry/scan-api-routes.py --apply` — picks up `recent-feedback`, the new reply / request-revision / mark-addressed / feedback-acted-on routes.
- Run `python3 scripts/registry/scan-ai-calls.py --apply` — picks up the `lib/grading/ai-prescore` call site if scanner finds it.
- Run `python3 scripts/registry/scan-rls-coverage.py` — ensure new `student_tile_grade_replies` table is RLS-clean.
- Update `docs/projects/grading-followups.md` — file `TFL-FU-*` items for anything deferred (e.g., per-class feedback rate, multi-class scoping nuance, optional reply attachments).
- **Matt Checkpoint 5.1:** Loop closure proof — single full cycle (see §10).

---

## 5. What's OUT of scope (named, not designed)

These are deliberately **separate future phases** — name them so future briefs reference the same names:
- **TFL-V2-SELF-ASSESS** — Self-assessment-before-feedback workflow (student rates own response before teacher sees it).
- **TFL-V2-PATTERN-CLUSTER** — Cross-student feedback pattern clustering (Haiku-grouped "all 24 students missed X" insight).
- **TFL-V2-VOICE-VISUAL** — Voice / visual pin annotations (teacher records audio comment OR pins to image region).
- **TFL-V2-AI-SECOND-READER** — AI second-reader for teacher comments (suggests "this might land harsh" or "be more specific" before send).

Code must not silently expand into any of these. If a sub-task surfaces "this would be much cleaner with TFL-V2-X", file as `TFL-FU-<n>` in `docs/projects/grading-followups.md` and continue.

---

## 6. Spec sections to re-read before any code

| Section | Path | Why |
|---|---|---|
| Existing single-write-site | [save-tile-grade.ts](../../src/lib/grading/save-tile-grade.ts) | Replies + revision events extend `student_tile_grade_events`; audit pattern + RLS policies live here |
| Inline feedback rendering | [TeacherFeedbackPanel.tsx](../../src/components/grading/TeacherFeedbackPanel.tsx) | Where TFL.2 + TFL.3 student UI plugs in |
| Teacher override panel | [page.tsx](../../src/app/teacher/marking/page.tsx) lines 1296-1500 (override panel) + 1108-1250 (compact row) | Where TFL.1 chip + TFL.2 reply pill + TFL.3 revision badge land |
| Student session pattern | [actor-session.ts](../../src/lib/access-v2/actor-session.ts) `requireStudentSession` | All TFL.2/3 student-write endpoints gate via this |
| Build methodology | [`docs/build-methodology.md`](../build-methodology.md) | Pre-flight ritual, stop triggers, "don't stop for" list, named checkpoints |
| Education AI patterns | [`docs/education-ai-patterns.md`](../education-ai-patterns.md) | TFL.4 norm-setting parallels the soft-gating pattern; reference if Berger header design questioned |
| Lessons learned | [`docs/lessons-learned.md`](../lessons-learned.md) | #38, #39, #43–46, #54 (read in §3.2) |

---

## 7. Test plan (per sub-phase, Lesson #38 — assert expected values, not non-null)

### TFL.1
- Pure helper `isCommentUnread(sentAt, seenAt, thresholdMs)` extracted to `src/lib/grading/comment-status.ts` (Lesson #71 — pure logic out of `.tsx`). Tests:
  - `seenAt = null, sentAt = 49h ago, threshold = 48h` → returns `true` (unread, past threshold)
  - `seenAt = null, sentAt = 1h ago, threshold = 48h` → returns `false` (unread, within threshold)
  - `seenAt = 1h ago, sentAt = 5h ago` → returns `false` (seen)
  - Boundary: `seenAt = null, sentAt = exactly 48h ago, threshold = 48h` → returns `false` (NOT past — strict greater than)
- Service test: `markCommentSeen(client, { studentId, gradeId })` writes `student_seen_comment_at = expect.any(String)` AND it round-trips by reading back.
- Migration shape test: SQL contains `ADD COLUMN student_seen_comment_at TIMESTAMPTZ` with NO `DEFAULT` clause (Lesson #38 — explicit backfill).

### TFL.2
- Pure helper `classifyReplySentiment(rawTag)` — maps `'got_it'|'not_sure'|'pushback'` to display copy, asserts unknown values throw with the allowed list in the error message.
- Service test: `saveStudentReply(client, { gradeId, studentId, sentiment, replyText })`:
  - Inserts row into `student_tile_grade_replies` with exactly those fields populated.
  - Inserts a paired row into `student_tile_grade_events` with `source = 'student_reply'`.
  - Both writes asserted via captured Supabase mock (existing pattern in `save-tile-grade.test.ts`).
- API auth test: POST without student session → 401 with `{ error: 'Unauthorized' }`.
- API authorisation test: POST with a session whose `studentId` doesn't match the grade's `student_id` → 403 with `{ error: 'You can only reply to feedback addressed to you.' }`.
- Migration shape test: CHECK constraint on sentiment includes exactly `('got_it','not_sure','pushback')`. RLS exists with the expected USING clause.

### TFL.3
- Pure helper `feedbackActedOnRate(rows: { revision_requested_at, revision_addressed_at }[])` → `{ requested: N, addressed: M, rate: M/N }`.
  - 0 requested → `{ requested: 0, addressed: 0, rate: 1 }` (no-op = perfect; explicit choice — see Open Question 9)
  - 5 requested, 3 addressed → `{ requested: 5, addressed: 3, rate: 0.6 }`
  - 5 requested, 5 addressed → `{ requested: 5, addressed: 5, rate: 1 }`
- Snapshot diff helper `diffSnapshot(beforeText, afterText)` returns line-by-line delta — assert exact strings on a 3-line input where line 2 changed.
- Service test for `markRevisionAddressed`:
  - Writes `revision_addressed_at = expect.any(String)` AND `revision_response_snapshot = '<known input>'`.
  - Inserts event row with `source='student_mark_addressed'`.
  - Idempotent: calling twice updates `revision_addressed_at` but doesn't double-insert events (assert event row count = 1 after two calls).
- API negative control: try to `mark-addressed` a grade where `revision_requested_at IS NULL` → 400 `{ error: 'No open revision to address.' }`.
- Migration: same shape rules as TFL.1.

### TFL.4
- Snapshot test: header text contains exactly `"Berger's rules: be kind. be specific. be helpful."` — use exact-match assertion, not `.toContain()` (Lesson #38 — value not presence).

### TFL.5
- No new code tests. Verifications:
  - `bash scripts/migrations/verify-no-collision.sh` exits clean.
  - `python3 scripts/registry/scan-api-routes.py --apply && git diff docs/api-registry.yaml` shows the new routes.
  - `python3 scripts/registry/scan-rls-coverage.py` — `docs/scanner-reports/rls-coverage.json` `drift` array does NOT contain `student_tile_grade_replies`.

### Negative controls (Lesson #38, on every sub-phase)
For each helper test, mutate one expected value, verify the test fails, revert. Document the revert method in the commit message.

---

## 8. Stop triggers

Code stops and reports if:
- Any registry cross-check during a sub-phase reveals **new** drift on the load-bearing path (e.g., `student_tile_grades` columns disagree between repo and prod — Lesson #68).
- A pattern bug surfaces in a write site (Lesson #39): if `save-tile-grade.ts`'s sequential write pattern needs hardening, audit ALL extension writers in TFL.2 + TFL.3 in the same commit.
- The student session check (`requireStudentSession`) reveals a gap when the student's class scope changes mid-session (multi-class students).
- An RLS policy on the new `student_tile_grade_replies` table fails the policy test under `service_role` vs anon — verify the canonical Phase 1.4/1.5 RLS pattern from access-model-v2 is followed.
- Test count drops below baseline (4900) at any sub-task gate.
- A required schema column for a TFL.x sub-phase doesn't exist on prod despite repo migration (Lesson #68 — repo migrations don't equal prod). Verify via Supabase dashboard before authoring the next sub-phase.
- Berger's header text needs validation logic (i.e., scope creep — TFL-V2-AI-SECOND-READER territory) — file as FU and continue with the static text.

---

## 9. Don't stop for

- Pre-existing ESLint warnings on adjacent files (open follow-ups already track these).
- Cosmetic alignment of new pills/badges within ±2px.
- Animation timing micro-adjustments (180ms is the standard; don't tune unless reviewer flags).
- Pre-existing TypeScript `any` in adjacent files (Lesson #45 — surgical changes).
- "This would be cleaner with TFL-V2-X" thoughts — file as `TFL-FU-<n>`, keep moving.
- Stale WIRING entries OUTSIDE this phase's load-bearing path (TFL.5 only fixes what we touched + the pre-existing `teacher-grading` drift; don't pull on threads).
- Browser-quirk renderings of the emoji/icons on the inline cards (file as P3 if surfaced).

---

## 10. Loop closure proof — Matt Checkpoint 5.1 success criterion

At the end of TFL.5, demonstrate **one full cycle** in prod:

1. **Teacher** opens marking page on a real class with student work. Writes a comment on tile A for student S. Clicks **Send to student**.
2. **Student S** logs in. Bell badge shows `+1` feedback. Opens lesson — banner appears, inline emerald card under tile A.
3. Student clicks **"Not sure what you mean"** → textarea slides down → student types `"What do you mean by 'industrial precedent'?"` → clicks **Send reply**.
4. **Teacher** refreshes marking page. Row chip now shows ✓ Sent + amber **"Reply: Not sure"** pill. Override panel shows the student's question inline below the comment textarea.
5. Teacher writes a clarifying comment ("An industrial precedent is an existing factory product you'd want yours to be like — Dyson fan, Apple Watch, etc."). Clicks **Send to student**. Clicks **Ask for a revision** on the same row.
6. **Student S** sees the updated comment (replaces the old; emerald card "↻ Revise this" header now active). Edits their response in the textarea above. Clicks **Mark as addressed**.
7. **Teacher** sees row badge flip from "↻ revision requested" → "✓ addressed in revision v2". Clicks the link → modal shows the snapshot diff. Class header card flips from "Feedback acted-on: 0/1 (0%)" → "1/1 (100%)".
8. Read receipt: comment shows "✓ Seen 3m ago" alongside the chip.

Each step verified by:
- Supabase row inspection (correct `*_at` timestamps, correct enum values, correct `source` on event rows).
- Browser smoke (chip / banner / card states match expectations).
- Two console-event sanity checks: (a) bell count actually bumped, (b) inline card actually re-rendered after reply.

Sign-off = all 8 steps green.

---

## 11. Open questions — RESOLVED (8 May 2026)

Matt approved all 11 recommended defaults. The brief now reads as the
authoritative spec for TFL.1 onward. For the audit trail:

1. **Reply UX:** "Got it" sends instantly; "Not sure" / "Pushback" open a textarea. ✅ default (a).
2. **Read-receipt granularity:** per-page bump on lesson open. ✅ default (a). Promote to per-comment IntersectionObserver only if pilot signal demands it (file as `TFL-FU-PER-COMMENT-RECEIPT` then).
3. **Revision concept:** implicit snapshot at `mark-addressed` time; "v2" is a UI label, not a counter or a side table. ✅ default (a).
4. **Teacher request-revision UI:** inline button next to "Send to student" in the override panel. ✅ default (a).
5. **Berger's rules header:** always visible muted-grey single line above the textarea. ✅ default (a).
6. **Audit log:** extend `student_tile_grade_events.source` CHECK to include `student_reply`, `teacher_request_revision`, `student_mark_addressed`. Migration in TFL.2 (replies) drops in the first new value, TFL.3 (revisions) adds the other two — write the CHECK update once with all three; cheaper than two ALTER passes.
7. **Multi-class students:** feedback-acted-on rate is per (student, class), surfaced on the marking page header (already class-scoped). ✅ default.
8. **Teacher notification of replies:** small "{N} unread replies" pill on the marking page header. No new bell infra. ✅ default.
9. **Zero-requested-revisions display:** hide the card when `requested = 0`. ✅ default (a).
10. **"Pushback" sentiment:** require accompanying text — submit button disabled until ≥1 character entered. ✅ default (c). UX implication: textarea is mandatory for `pushback` (gentle gate), optional for `not_sure`, hidden by default for `got_it`.
11. **Feedback-acted-on rate as input to other systems:** leave alone for v1. No downstream `affects` entry. Revisit when a consumer actually lands.

---

## 12. Pickup snippet for the next session that builds TFL.1

```
Read /Users/matt/CWORK/questerra-grading/docs/projects/feedback-loop-closure-phase-1-brief.md
end-to-end. Begin with §3 pre-flight ritual — confirm baseline still 4900
tests, register the assumption block from §3, get Matt sign-off on Open
Questions §11 BEFORE writing any code. TFL.1 (read receipts) is the first
sub-phase. Migration: add_student_seen_comment_at. STOP after authoring
the assumption block and printing it; wait for Matt before writing SQL.
```
