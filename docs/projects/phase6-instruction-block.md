# Phase 6 — Teacher Safety Feed + Ingestion Safety Scan

## Instruction Block for Claude Code

```
PHASE 6 — Teacher Safety Feed (§7.4) + Critical Alert Badge (§7.4) + Ingestion Safety Scan (§7.5)
Goal: Complete the teacher-facing content safety layer — alert feed page, nav badge for critical alerts, and safety scan on teacher uploads.

Spec: docs/projects/dimensions3-completion-spec.md lines 1141-1155
Assumptions signed off by Matt 13 Apr 2026.
Pre-flight completed by Code. Corrections applied.

────────────────────────────────────
LESSONS TO RE-READ (full text, not titles)
────────────────────────────────────

1. Lesson #4 (line 27) — Student auth uses token sessions, not Supabase Auth. Phase 6 is teacher-side so uses supabase.auth.getUser(), but know the difference.
2. Lesson #16 (line 59) — No lucide-react in this project. All icons must be inline SVGs.
3. Lesson #22 (line 80) — Junction-first + legacy-fallback for student lookups in teacher APIs.
4. Lesson #29 (line 101) — RLS policies must handle junction tables. student_content_moderation_log RLS filters by class_id IN classes WHERE teacher_id = auth.uid().
5. Lesson #39 (line 153) — max_tokens truncation. Not directly relevant to Phase 6 but if 6C calls Haiku, ensure stop_reason guard exists.
6. Lesson #43 (line 241) — Think before coding. Assumptions block done.
7. Lesson #44 (line 257) — Simplicity first. No speculative abstractions.
8. Lesson #45 (line 273) — Surgical changes. Only touch files this phase requires.

────────────────────────────────────
PRE-FLIGHT — ALREADY DONE
────────────────────────────────────

Pre-flight completed. Key findings (verified by Code):

- Test baseline: 1103 passed, 8 skipped (58 suites, Vitest)
- Auth pattern: Raw `createServerClient` from `@supabase/ssr` with `request.cookies.getAll()` — matches majority of teacher routes. NO FIX NEEDED.
- Draft files exist at expected paths. Both need fixes (listed below).
- RLS policies confirmed on student_content_moderation_log (teacher SELECT + UPDATE).
- Latest migration: 073. Next = 074 (needed for Phase 6C).
- /teacher/safety/page.tsx = Safety Badges (existing, do NOT touch).
- /teacher/safety/alerts/page.tsx = Content Safety Alerts (Phase 6A draft).

Skip the pre-flight steps. Go straight to implementation.

────────────────────────────────────
SUB-TASK 6A: Teacher Safety Alert Feed
────────────────────────────────────

Files to modify:
- src/app/api/teacher/safety/alerts/route.ts (EXISTS — auth pattern OK, no changes needed to API)
- src/app/teacher/safety/alerts/page.tsx (EXISTS — needs 4 fixes below)

6A.1 — Remove dead /api/teacher/units fetch:
Line ~94 in the draft page has a `fetch("/api/teacher/units")` that fetches then does nothing with the result. Remove the entire block.

6A.2 — Fix class dropdown:
The draft calls `/api/teacher/class-profiles` which returns 400 (requires classId param, returns student profiles not class list). Replace with a direct client-side Supabase query:
```typescript
const supabase = createClient(); // from @/lib/supabase/client
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  const { data: classData } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");
  if (classData) setClasses(classData);
}
```
Import `createClient` from `@/lib/supabase/client` at the top.

6A.3 — Add student name resolution:
After fetching alerts, collect unique student_ids, then query the students table:
```typescript
const studentIds = [...new Set(alerts.map(a => a.student_id))];
const { data: students } = await supabase
  .from("students")
  .select("id, name")
  .in("id", studentIds);
const nameMap = new Map(students?.map(s => [s.id, s.name]) || []);
```
Store nameMap in state. Use `nameMap.get(alert.student_id) || alert.student_id.slice(0, 8)` in the render.

6A.4 — Add "Escalate" button for critical alerts:
The draft only shows "Acknowledge" and "False positive". Add an "Escalate" button for critical severity alerts. The API PATCH already handles action='escalated'. Place it first (before Acknowledge) with a red/orange style to indicate severity.

Scope boundary: Do NOT modify the API route (it's correct), the moderation pipeline, client filter, or any student-facing code.

────────────────────────────────────
SUB-TASK 6B: Critical Alert Nav Badge
────────────────────────────────────

Files to modify:
- src/app/teacher/layout.tsx

6B.1 — Add "Alerts" as a SEPARATE nav item in NAV_ITEMS array:
Add after the existing "Badges" entry (line 33):
```typescript
{ href: "/teacher/safety/alerts", label: "Alerts", icon: (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)},
```

6B.2 — Add unreviewed critical alert count:
In the existing `loadTeacher()` useEffect (line 60), after loading teacher data successfully, add:
```typescript
const { count } = await supabase
  .from("student_content_moderation_log")
  .select("id", { count: "exact", head: true })
  .eq("teacher_reviewed", false)
  .eq("severity", "critical");
setCriticalAlertCount(count || 0);
```
Add state: `const [criticalAlertCount, setCriticalAlertCount] = useState(0);`

6B.3 — Render the badge:
In the nav rendering (around line 147), when the nav item href is "/teacher/safety/alerts" and criticalAlertCount > 0, render a small red circle with the count next to the label. Use inline styles (no Tailwind classes that might need compilation). The badge MUST NOT be dismissible by navigating away — it stays until teacher acknowledges alerts via the alerts page.

────────────────────────────────────
SUB-TASK 6C: Ingestion Pipeline Safety Scan (§7.5) — OPTION A (simplified)
────────────────────────────────────

Decision: Do NOT log teacher uploads to student_content_moderation_log. Instead, call moderateContent() directly and set processing_status = 'moderation_hold' on the content_items row if flagged/blocked.

Files to create/modify:
- supabase/migrations/074_ingestion_moderation_hold.sql (NEW — add 'moderation_hold' to content_items.processing_status CHECK)
- src/lib/ingestion/pass-a.ts (MODIFY — add safety pre-check)

6C.1 — Migration 074:
```sql
-- Migration 074: Add 'moderation_hold' to content_items processing_status
-- Phase 6C: Ingestion pipeline safety scan

DO $$ BEGIN
  ALTER TABLE content_items
    DROP CONSTRAINT IF EXISTS content_items_processing_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE content_items
  ADD CONSTRAINT content_items_processing_status_check
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'moderation_hold'));
```
IMPORTANT: Before writing this SQL, verify the actual constraint name by running:
```
SELECT conname FROM pg_constraint WHERE conrelid = 'content_items'::regclass AND contype = 'c';
```
Use the real constraint name, not an assumed one.

6C.2 — Add safety pre-check to pass-a.ts:
After text extraction, before the Anthropic section-analysis call:
```typescript
import { moderateContent } from "@/lib/content-safety/server-moderation";

// Safety pre-check on full extracted text
const textSample = extractedText.slice(0, 5000); // Cap at 5000 chars for cost
const modResult = await moderateContent(textSample);
if (modResult.status === 'blocked' || modResult.status === 'flagged') {
  // Hold the upload for admin review
  await supabase
    .from("content_items")
    .update({ processing_status: 'moderation_hold' })
    .eq("id", contentItemId);
  return {
    success: false,
    error: `Upload held for review: content flagged as ${modResult.status}`,
    moderationHold: true,
  };
}
```

If moderateContent fails (API error), it returns status='pending' — proceed normally. Teacher uploads get benefit of the doubt on API failure (different from student content which stays 'pending').

6C.3 — Verify moderateContent() import path and interface:
Read src/lib/content-safety/server-moderation.ts and confirm the function signature. It should accept a string and return { status, flags, ... }. If it requires ModerationContext (studentId etc.), call the raw moderation function directly instead — do NOT pass fake studentIds.

Scope boundary: Do NOT modify moderate.ts (block-level, Stage I-5). Do NOT touch student-facing moderation. The scan is additive.

────────────────────────────────────
TESTS
────────────────────────────────────

Write tests in: src/app/api/teacher/safety/__tests__/alerts.test.ts (new file)

Test 6A (mock supabase client):
1. GET returns alerts array (mock supabase select → [{severity:'critical',...}])
2. GET with class_id param adds .eq("class_id", ...) to query
3. GET with reviewed=true skips .eq("teacher_reviewed", false)
4. PATCH with valid action calls .update({teacher_reviewed:true, teacher_action, teacher_reviewed_at})
5. PATCH with invalid action returns 400
6. PATCH without id returns 400

Test 6C (in existing ingestion test file or new):
7. Safety scan on clean text → pipeline proceeds (moderateContent returns {status:'clean'})
8. Safety scan on flagged text → sets processing_status='moderation_hold', returns early
9. Safety scan on API failure (moderateContent returns {status:'pending'}) → pipeline proceeds

Cross-reference tests:
10. Verify severity CHECK values from migration 073: 'info', 'warning', 'critical'

Negative control:
- Mutate one expected value in test 1 (e.g., change expected array key from 'alerts' to 'items')
- Run tests — verify the mutated test fails
- Revert using Edit tool (files not yet committed)
- Re-run tests — verify green

Expected test count: 1103 + ~10 = ~1113

────────────────────────────────────
VERIFY
────────────────────────────────────

1. npm test — expected: ~1113 passed, all green
2. npx tsc --noEmit --project tsconfig.check.json — 0 errors
3. Verify no lucide-react imports (Lesson #16): grep -r "lucide-react" src/app/teacher/safety/ src/app/teacher/layout.tsx
4. Verify no createServerSupabaseClient used where createServerClient was intended (auth pattern consistency)
5. NC results: state which test was mutated, confirm failure, confirm revert + green

────────────────────────────────────
COMMITS (separate per sub-task)
────────────────────────────────────

Commit 1: "feat: Phase 6A — Teacher safety alert feed with class filter, student names, and severity grouping"
Files: src/app/api/teacher/safety/alerts/route.ts, src/app/teacher/safety/alerts/page.tsx, src/app/api/teacher/safety/__tests__/alerts.test.ts

Commit 2: "feat: Phase 6B — Critical alert badge on teacher nav"
Files: src/app/teacher/layout.tsx

Commit 3: "feat: Phase 6C — Ingestion pipeline upload-level safety scan (Option A)"
Files: supabase/migrations/074_ingestion_moderation_hold.sql, src/lib/ingestion/pass-a.ts, test additions

Do NOT push to origin. Stay on main.

────────────────────────────────────
STOP AND REPORT — list: files created/modified, test count delta, typecheck result, NC results, any surprises.
────────────────────────────────────
```
