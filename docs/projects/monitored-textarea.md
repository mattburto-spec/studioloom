# Project: MonitoredTextarea Pipeline

*Created: 28 March 2026*
*Status: PIPELINE COMPLETE + UI WIRED — migration 054 APPLIED, save timing fixed, RLS fixed (migration 059), Class Hub integrity indicators live, IntegrityReport wired into Progress tab detail modal + standalone grading page evidence panel + Class Hub Grade tab Student Work section. Grading page crash fixed (_tracking_ object keys). Needs: fresh student session verification, Grade tab click-through (parked pending grading redesign).*

## Goal

Wire the existing academic integrity monitoring system end-to-end so teachers can see writing behavior data (paste events, typing patterns, focus time, text snapshots) for student responses on the grading page.

## What Already Exists

| Component | Status | Notes |
|-----------|--------|-------|
| `MonitoredTextarea` | ✅ Built | Silent capture of paste events, keystrokes, deletions, focus loss, text snapshots, word count history |
| `analyzeIntegrity()` | ✅ Built + 12 tests | 6-rule deterministic scoring (0-100). Rules: paste ratio, bulk entry, typing speed, low editing, focus loss, minimal time |
| `IntegrityReport` | ✅ Fixed | Teacher viewer with score badge, flags, writing playback slider, paste log. **lucide-react replaced with inline SVGs** |
| `ResponseInput` integration | ✅ Built | Conditional `enableIntegrityMonitoring` prop switches between plain textarea and MonitoredTextarea |
| Student lesson page wiring | ✅ Complete | `enableIntegrityMonitoring={true}` passed to ActivityCard. `integrityMetadata` state captured via ref + passed to save flow |

## Completed Steps

### Step 1: Migration 054 — Add `integrity_metadata` column ✅ APPLIED
- `supabase/migrations/054_integrity_metadata.sql` created
- Adds `integrity_metadata JSONB DEFAULT NULL` to `student_progress`
- Partial index on `(student_id, unit_id) WHERE integrity_metadata IS NOT NULL`
- **APPLIED 30 Mar 2026**

### Step 2: Save integrity metadata alongside responses ✅ DONE
- `usePageResponses.ts` — accepts optional `integrityMetadataRef` param, includes in save payload when non-empty
- `/api/student/progress/route.ts` — accepts `integrityMetadata` in request body, stores as `integrity_metadata` in upsert. **Retry without column if migration 054 not applied (Lesson Learned #17)**
- Student lesson page — `integrityMetadataRef` declared before hook call, synced on every `onIntegrityUpdate` callback, keyed by response key (activity ID or section index)

### Step 3: Fix IntegrityReport lucide-react imports ✅ DONE
- All 9 lucide-react icon imports replaced with inline SVG components
- Icons: ChevronDown, ChevronUp, AlertTriangle, AlertCircle, ClockIcon, TypeIcon, ClipboardIcon, EyeIcon, RotateCwIcon
- Zero lucide-react references remain

### Step 4: Mount IntegrityReport on grading page ✅ DONE
- Grading page imports `IntegrityReport` + `IntegrityMetadata` type + `analyzeIntegrity`
- `evidenceIntegrity` state added alongside `evidenceData`
- `loadEvidence()` extracts `integrity_metadata` from progress record
- Per-response IntegrityReport shown below each response when metadata exists
- Aggregate integrity summary section with score badges + flag counts at bottom of evidence panel
- Also added `activity_` key label support for backfilled activity IDs

## Design Decisions

- **Silent monitoring, not surveillance theatre** — students see a normal textarea, no indicators
- **Deterministic scoring over AI-based** — 6 rules, explainable to parents/admin, no API cost
- **Thresholds:** ≥70 = likely independent (green), 40-69 = review recommended (amber), <40 = flagged (red)
- **Integrity data is advisory, not punitive** — teachers see it as evidence, not as automatic flags
- **Dedicated column over embedded in responses JSONB** — cleaner for querying (e.g., "show all flagged students")
- **Ref-based passing to save hook** — avoids re-renders from integrity metadata state changes triggering saves

## Files Changed

1. `supabase/migrations/054_integrity_metadata.sql` — NEW ✅
2. `src/hooks/usePageResponses.ts` — accept + save integrityMetadata ✅
3. `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` — pass integrityMetadata ref to save flow ✅
4. `src/app/api/student/progress/route.ts` — accept integrityMetadata in payload with retry ✅
5. `src/components/teacher/IntegrityReport.tsx` — replaced lucide-react with inline SVGs ✅
6. `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` — mount IntegrityReport in evidence panel ✅

### Step 5: Fix save timing gap ✅ DONE (30 Mar 2026)
- `MonitoredTextarea.tsx` — added debounced keystroke notify (1.5s) so `integrityMetadataRef.current` is populated before 2s auto-save fires
- 30s monitoring tick now also calls `updateMetrics(true)` to fire callback
- Cleanup for `keystrokeNotifyRef` in useEffect return

### Step 6: Fix RLS for junction-enrolled students ✅ DONE (30 Mar 2026)
- `supabase/migrations/059_student_progress_rls_junction.sql` — rewrites `student_progress` and `planning_tasks` RLS policies with UNION of `class_students` junction + legacy `students.class_id` paths
- **APPLIED 30 Mar 2026** — teacher progress grid now shows data for junction-enrolled students

### Step 7: Add integrity indicators to Class Hub progress grid ✅ DONE (30 Mar 2026)
- `ProgressCell` type extended with `hasIntegrityData: boolean`
- Map builder extracts `integrity_metadata` from progress rows
- Grid cells show blue dot badge when integrity monitoring data exists
- Standalone progress page also fixed with junction-first + legacy-fallback student query

## Files Changed (additional)

7. `src/components/student/MonitoredTextarea.tsx` — debounced keystroke notify for save timing ✅
8. `supabase/migrations/059_student_progress_rls_junction.sql` — NEW, RLS junction fix ✅
9. `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` — Class Hub integrity indicators ✅
10. `src/app/teacher/classes/[classId]/progress/[unitId]/page.tsx` — junction-first query + log cleanup ✅

### Step 8: Wire IntegrityReport into Class Hub detail modal ✅ DONE (30 Mar 2026)
- Class Hub Progress tab: clicking a progress cell opens detail modal with per-response IntegrityReport + aggregate summary badges
- `detailIntegrity` state added, populated from `integrity_metadata` in `loadStudentDetail()`
- `_tracking_` keys filtered from response display
- Aggregate "Writing Integrity Summary" section at bottom of modal

### Step 9: Add Student Work Quick-View to grading pages ✅ DONE (30 Mar 2026)
- **Standalone grading page** (`/teacher/classes/[classId]/grading/[unitId]`): clickable lesson buttons between student header and criterion sections. Green=responses, gray=empty, blue dot=integrity. Click opens evidence slide-out with IntegrityReport.
- **Class Hub Grade tab**: Student Work section with lesson buttons + blue dots. Click-through NOT wired (parked pending grading redesign).
- **Crash fix**: `_tracking_` keys and non-string response values (toolkit JSON, tracking objects) were crashing the evidence panel with "Objects are not valid as a React child." Fixed with filter + safe stringify.

### Files Changed (additional)

11. `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` — IntegrityReport in detail modal + Grade tab Student Work section ✅
12. `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` — Student Work Quick-View + _tracking_ filter + non-string crash fix ✅

## Test Checklist

- [x] **Apply migration 054** in Supabase SQL editor — APPLIED 30 Mar
- [x] **Apply migration 059** (RLS junction fix) — APPLIED 30 Mar
- [x] Teacher progress grid shows colored dots (not all dashes) — VERIFIED 30 Mar
- [ ] Student writes text on lesson page → MonitoredTextarea captures metadata → **new** integrity data appears in Supabase (needs fresh session with debounced notify deployed)
- [x] Teacher opens Class Hub progress tab → blue dots appear on cells with integrity data — VERIFIED 30 Mar
- [x] Teacher clicks progress cell → detail modal shows IntegrityReport (score 15, flags, playback, paste log) — VERIFIED 30 Mar
- [x] Teacher opens standalone grading page → Student Work buttons with blue dots visible — VERIFIED 30 Mar
- [x] Evidence panel shows responses + IntegrityReport with score, flags, playback — VERIFIED 30 Mar
- [x] Paste log shows if student pasted content — VERIFIED 30 Mar (Paste Log (1) visible)
- [x] Score badge colors match thresholds (green/amber/red) — VERIFIED 30 Mar (15% = red "Flagged for Review")
- [x] Grading page doesn't crash on _tracking_ keys or non-string values — FIXED 30 Mar
- [ ] Class Hub Grade tab lesson buttons clickable (PARKED — pending grading redesign)
- [x] Build succeeds (no lucide-react imports) ✅ Verified via `tsc --noEmit`
