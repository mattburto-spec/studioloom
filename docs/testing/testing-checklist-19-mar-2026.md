# Testing Checklist — 19 March 2026 Session

Everything built this session needs testing before it's production-ready. Work through these in order.

---

## 1. Run Automated Tests

```bash
npm run test
```

**New test files to verify pass:**
- `src/lib/integrity/__tests__/analyze-integrity.test.ts` (12 tests)
- `src/lib/ai/__tests__/timing-validation.test.ts` (11 tests)

**Existing tests should still pass:**
- `src/lib/ai/__tests__/prompts.snapshot.test.ts`
- `src/lib/ai/__tests__/framework-vocabulary.test.ts`
- `src/lib/ai/__tests__/design-assistant-toolkit-suggestions.test.ts`

---

## 2. Academic Integrity System

### MonitoredTextarea Component
- [ ] Render a `ResponseInput` with `enableIntegrityMonitoring={true}`
- [ ] Type text normally — verify `onIntegrityUpdate` fires with correct `IntegrityMetadata` shape
- [ ] Paste text from clipboard — verify `pasteEvents` array captures content + length + timestamp
- [ ] Switch to another tab and back — verify `focusLossCount` increments
- [ ] Wait 30+ seconds while typing — verify `snapshots` array grows (new snapshot every 30s)
- [ ] Verify the textarea looks identical to the regular textarea (no visible monitoring indicators)
- [ ] Verify `keystrokeCount` and `deletionCount` track correctly (type + backspace)

### Integrity Analysis Engine
- [ ] Unit tests pass (covered by automated tests above)
- [ ] Test edge case: empty text (0 characters) — should not crash, returns valid score
- [ ] Test edge case: huge paste (>1000 chars pasted at once) — should flag as concern
- [ ] Verify score clamping: stack all flags, confirm score stays 0-100

### Teacher Integrity Report
- [ ] Render `IntegrityReport` with sample metadata (all snapshots populated)
- [ ] Score badge shows correct color (green ≥70, amber 40-69, red <40)
- [ ] Playback slider scrubs through snapshots — textarea updates as slider moves
- [ ] Timestamp below slider shows relative time (mm:ss from start)
- [ ] Word count + character count update per snapshot
- [ ] Paste log expands/collapses on click
- [ ] Paste entries show relative timestamp + character count + content preview
- [ ] "No snapshots captured" message shows when snapshots array is empty

### ResponseInput Integration
- [ ] `enableIntegrityMonitoring={false}` (default) — renders normal textarea, no monitoring
- [ ] `enableIntegrityMonitoring={true}` — renders MonitoredTextarea
- [ ] Other response types unaffected (upload, voice, link, toolkit tools)

---

## 3. Timing Validation Pipeline

### Schema Changes
- [ ] Generate a lesson via the admin test sandbox — verify the response includes `workshopPhases` object with opening/miniLesson/workTime/debrief
- [ ] Verify `extensions` array appears in generated lessons (2-3 items)
- [ ] If AI doesn't output workshopPhases, the validation still works (auto-creates default phases)

### Admin Test-Lesson Route
- [ ] Hit `POST /api/admin/ai-model/test-lesson` — verify response includes `timingValidation` object
- [ ] `timingValidation.valid` is boolean
- [ ] `timingValidation.issues` is array of `{ code, severity, message, autoFixed }`
- [ ] `timingValidation.stats` includes `usableMinutes`, `workTimePercent`, `instructionCap`
- [ ] `lesson` in response is the auto-repaired version
- [ ] `lessonRaw` in response is the original AI output (for comparison)
- [ ] If miniLesson duration exceeds 1+age cap, verify it's auto-repaired down

### Journey Generation Route
- [ ] Generate journey pages via `POST /api/teacher/generate-journey`
- [ ] Response includes `timingValidation` object (only if pages have workshopPhases)
- [ ] Each page in `timingValidation` shows `{ valid, issueCount, autoFixed }`
- [ ] Pages without workshopPhases are skipped (no error)
- [ ] Repaired pages are returned in the `pages` object (not the raw versions)

---

## 4. Student Toolkit Persistence Layer

### Prerequisites
- [ ] Apply migration: `supabase db push` (creates `student_tool_sessions` table)
- [ ] Verify table exists: `SELECT * FROM student_tool_sessions LIMIT 1;`
- [ ] Verify RLS policies are active
- [ ] Verify `update_tool_session_timestamp` trigger fires on UPDATE

### API Routes
- [ ] `POST /api/student/tool-sessions` with valid student token — creates session, returns sessionId
- [ ] `POST` with missing student token — returns 401
- [ ] `POST` with `mode: "embedded"` but no `unitId` — returns validation error
- [ ] `GET /api/student/tool-sessions?toolId=scamper&unitId=X&pageId=Y` — returns existing in_progress session
- [ ] `GET` with no matching session — returns empty/null
- [ ] `PATCH /api/student/tool-sessions/[id]` with `{ state: {...} }` — updates state
- [ ] `PATCH` with `{ status: "completed" }` — sets completed_at timestamp
- [ ] `PATCH` by wrong student — returns 403

### useToolSession Hook
- [ ] Wire into one toolkit tool (e.g., SCAMPER embedded mode)
- [ ] First interaction creates session (lazy creation — no session on mount)
- [ ] Subsequent interactions debounce-save (500ms)
- [ ] `saveStatus` transitions: idle → saving → saved → idle
- [ ] Close browser, reopen — session resumes from saved state
- [ ] Complete tool → session status set to "completed"
- [ ] `resetSession` creates new session with version+1

---

## 5. Build Verification

- [ ] `npx tsc --noEmit` — zero errors in files touched this session (pre-existing toolkit tool errors are separate)
- [ ] `npm run build` — Next.js build succeeds (or only fails on pre-existing issues)
- [ ] No new lint warnings in touched files

---

## 6. Integration Points (Wire After Testing)

These are NOT built yet but are the next steps after the above passes:

- [ ] **Wire MonitoredTextarea into submission flow** — store `integrityMetadata` in `student_progress.responses` JSONB when student submits
- [ ] **Add integrity badge to teacher grading view** — show score badge on each response in grading dashboard
- [ ] **Wire useToolSession into existing toolkit tool components** — replace the current `onSave`/`onComplete` pattern in ResponseInput toolkit blocks
- [ ] **Batch Upload component integration** — wire `BatchUpload.tsx` into the knowledge upload page at `/teacher/knowledge`
