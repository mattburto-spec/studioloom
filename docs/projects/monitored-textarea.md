# Project: MonitoredTextarea Pipeline

*Created: 28 March 2026*
*Status: CODE COMPLETE — awaiting migration 054 apply + e2e testing*

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

### Step 1: Migration 054 — Add `integrity_metadata` column ✅ DONE
- `supabase/migrations/054_integrity_metadata.sql` created
- Adds `integrity_metadata JSONB DEFAULT NULL` to `student_progress`
- Partial index on `(student_id, unit_id) WHERE integrity_metadata IS NOT NULL`
- **NOT YET APPLIED** — run in Supabase SQL editor

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

## Test Checklist

- [ ] **Apply migration 054** in Supabase SQL editor
- [ ] Student writes text on lesson page → MonitoredTextarea captures metadata
- [ ] Student saves/auto-saves → integrity_metadata stored in student_progress
- [ ] Teacher opens grading page → selects student → opens evidence panel
- [ ] Evidence panel shows responses + IntegrityReport with score, flags, playback
- [ ] IntegrityReport playback slider scrubs through text snapshots
- [ ] Paste log shows if student pasted content
- [ ] Score badge colors match thresholds (green/amber/red)
- [ ] Build succeeds (no lucide-react imports) ✅ Verified via `tsc --noEmit`
