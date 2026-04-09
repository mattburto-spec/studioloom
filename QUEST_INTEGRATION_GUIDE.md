# Quest Journey System — Integration Guide

**Status:** API routes created (25 Mar 2026)

The core quest journey API routes have been implemented. This guide covers what was built and the next steps for integration.

## What Was Built

### API Routes (4 files, 646 lines)

Created in `/src/app/api/student/quest/`:

1. **`route.ts`** (153 lines) — Journey CRUD
   - `GET /api/student/quest?unitId=...` — fetch journey + milestones + evidence
   - `POST /api/student/quest` — create new journey

2. **`phase/route.ts`** (92 lines) — Phase transitions
   - `POST /api/student/quest/phase` — advance to next phase (with validation)

3. **`mentor/route.ts`** (211 lines) — Mentor selection + AI interactions
   - `PATCH /api/student/quest/mentor` — select mentor (one-time)
   - `POST /api/student/quest/mentor` — send message to mentor (AI + logging)

4. **`evidence/route.ts`** (190 lines) — Evidence CRUD
   - `GET /api/student/quest/evidence?journeyId=...` — list evidence
   - `POST /api/student/quest/evidence` — submit new evidence

**Documentation:** `/api/student/quest/API-DOCS.md` (comprehensive reference)

---

## Key Features Implemented

### Authentication
- Student token-based session auth (`requireStudentAuth`)
- Journey ownership verification on all routes
- No teacher routes created yet (separate PR)

### Rate Limiting
- Journey creation: 5/min, 50/hour
- Phase transitions: 10/min
- Mentor interactions: 15/min, 100/hour
- Evidence submissions: 20/min

### AI Integration
- Claude Haiku (`claude-haiku-4-5-20251001`) for mentor responses
- Max 400 tokens per response (cost-optimised)
- Dynamic system prompts via `buildQuestPrompt()` (phase-aware)
- Interaction logging to `quest_mentor_interactions` table

### Data Validation
- Phase machine validation (enforces linear progression)
- Mentor selection one-time only
- Evidence approval defaults to `false` (teacher approval required)
- Journey ownership checks on all ops

### Error Handling
- Comprehensive try-catch blocks
- Appropriate HTTP status codes (400/401/404/409/500)
- Detailed console logging for debugging

---

## Prerequisite: Supabase Schema

These API routes assume the following Supabase tables exist:

- `quest_journeys` — main journey records
- `quest_milestones` — milestones within a journey
- `quest_evidence` — evidence submissions (approved/unapproved)
- `quest_mentor_interactions` — AI interaction logs
- `student_sessions` — auth tokens (for `requireStudentAuth`)

**Status:** The schema migration has **NOT** been created yet. This is required before the routes are functional.

**Action needed:** Create migration file with schema definition. See `/src/lib/quest/types.ts` for TypeScript interfaces that map to table columns.

---

## Next Steps (Priority Order)

### TIER 0 — Unblock functionality
1. **Create Supabase migration** — defines 5 tables above (copy interfaces from `types.ts`)
   - Include RLS policies if needed
   - Add indexes on `(student_id, unit_id)`, `(journey_id)`, etc.
   - **Estimated time:** 1-2 hours

2. **Test routes end-to-end**
   - Verify GET `/api/student/quest?unitId=X` returns empty when no journey
   - Verify POST `/api/student/quest` creates journey
   - Verify POST `/api/student/quest/phase` advances phase
   - Verify PATCH/POST mentor routes work
   - Verify POST evidence route works
   - **Estimated time:** 1-2 hours

### TIER 1 — Wire into UI
3. **Create React hook** (`useQuestJourney.ts`) — wraps API calls
   - Load journey on mount
   - Provide methods: `createJourney()`, `advancePhase()`, `selectMentor()`, `sendMessage()`, `submitEvidence()`
   - Handle loading/error states
   - **Estimated time:** 1.5 hours

4. **Create student quest pages**
   - `/student/unit/[unitId]/quest/[journeyId]` — main quest view
   - Sub-routes or tabs for: Discovery, Planning, Working, Sharing, Evidence Gallery
   - Mentor character display + chat interface
   - Milestone list + progress tracking
   - **Estimated time:** 3-4 hours

5. **Wire into student unit page**
   - Add "Start Quest" CTA on lesson view
   - Show active journey card on dashboard
   - Link from portfolio to quest evidence
   - **Estimated time:** 1-2 hours

### TIER 2 — Teacher dashboard
6. **Create teacher quest progress view** (separate PR)
   - `/teacher/quest/[classId]` — overview of all students' journeys
   - Student progress cards (phase, health, evidence count)
   - Approve/reject evidence from teacher dashboard
   - Teacher mentor mode (step in as advisor, override AI)
   - **Estimated time:** 3-4 hours

### TIER 3 — Polish
7. **Add quest visualizations**
   - Journey map (4-phase comic strip or timeline)
   - Health score dashboard (momentum/engagement/quality/self-awareness)
   - Evidence gallery with filtering
   - Milestone completion tracker
   - **Estimated time:** 2-3 hours

8. **Edge cases + error recovery**
   - What happens if student skips phases manually (admin override?)
   - What happens if mentor selection is buggy
   - Timeout/retry logic for AI calls
   - **Estimated time:** 1-2 hours

---

## Code Quality Checklist

- [x] Auth pattern matches project conventions (`requireStudentAuth`)
- [x] Rate limiting on all user-input routes
- [x] Error responses follow project pattern
- [x] TypeScript types imported from `@/lib/quest/types`
- [x] Supabase queries use `.maybeSingle()` / `.single()` appropriately
- [x] AI integration uses Haiku (not Sonnet) for cost
- [x] All PATCH/POST routes validate ownership
- [x] Console logging for debugging
- [x] Comments explain non-obvious logic
- [x] Routes are independent (no hidden dependencies)

---

## API Testing (Quick Manual Tests)

### Test 1: Create journey
```bash
curl -X POST http://localhost:3000/api/student/quest \
  -H "Content-Type: application/json" \
  -b "session_token=..." \
  -d '{
    "unitId": "unit-123",
    "frameworkId": "ib-myp",
    "classId": "class-456"
  }'
```

Expected: 201 Created with journey object

### Test 2: Fetch journey
```bash
curl http://localhost:3000/api/student/quest?unitId=unit-123 \
  -b "session_token=..."
```

Expected: 200 OK with journey + milestones + evidence

### Test 3: Send mentor message
```bash
curl -X POST http://localhost:3000/api/student/quest/mentor \
  -H "Content-Type: application/json" \
  -b "session_token=..." \
  -d '{
    "journeyId": "journey-123",
    "message": "Help! I am stuck",
    "interactionType": "help_request"
  }'
```

Expected: 200 OK with AI response + interaction log

---

## Architecture Notes

### Why These Routes?
- **Four separate routes** instead of one monolithic endpoint keeps concerns separated
- Each route is independently deployable and testable
- Rate limits are per-route (different usage patterns)
- Easy to add teacher routes later without disrupting student routes

### Student Auth Pattern
Uses `SESSION_COOKIE_NAME` cookie → `student_sessions` table lookup, NOT Supabase Auth. This is deliberate:
- Simple student onboarding (no email verification needed)
- 7-day token TTL is sufficient for a school term
- No dependency on Supabase Auth user creation
- Matches existing StudioLoom student auth pattern

### AI Integration
- Haiku (not Sonnet) for cost efficiency
- 400 token max is appropriate for mentor responses (not essays)
- System prompt is rebuilt per request (no caching) — necessary because context changes with each interaction
- Interaction logging creates a full conversation transcript useful for teacher review later

### Evidence Approval Workflow
- Students submit evidence (`approved_by_teacher = false`)
- Teachers view unapproved evidence on their dashboard
- Teachers approve/reject/comment via separate route (not yet built)
- Approved evidence surfaces in student portfolio
- This separation prevents data leakage (unvetted submissions don't appear publicly)

---

## Known Limitations (MVP)

1. **No teacher routes yet** — can't view progress, approve evidence, intervene
2. **No milestone auto-creation** — teacher creates milestones manually (or student adds via UI later)
3. **No evidence analysis AI** — `ai_analysis` JSONB field is empty (placeholder for future)
4. **No health score computation** — health score static on creation (will be updated per check-in)
5. **No session expiry** — quest sessions don't auto-expire after unit completion (need cleanup job)
6. **No conflict resolution** — two simultaneous requests could double-increment counters (use transactions later)

---

## Files Created

```
/src/app/api/student/quest/
├── route.ts              153 lines   — GET/POST journey CRUD
├── phase/route.ts        92 lines    — POST phase transition
├── mentor/route.ts       211 lines   — PATCH mentor select + POST AI mentor
├── evidence/route.ts     190 lines   — GET/POST evidence
└── API-DOCS.md          (comprehensive reference)
```

**Total new code:** 646 lines (routes) + docs

---

## Related Files (Already Exists)

Library support already in place:

- `/src/lib/quest/types.ts` — 160 lines, all 8 interfaces + types
- `/src/lib/quest/mentors.ts` — 5 mentor definitions + `getMentor()` helper
- `/src/lib/quest/phase-machine.ts` — phase transition validation
- `/src/lib/quest/build-quest-prompt.ts` — system prompt builder for AI
- `/src/lib/auth/student.ts` — `requireStudentAuth()` helper
- `/src/lib/rate-limit.ts` — rate limiting utility

No new library files needed for core functionality.

---

## Questions Before Proceeding

- Should quest journeys auto-delete after unit completion? (Keep forever for portfolio?)
- Should students be able to see OTHER students' quests? (No — privacy)
- Should teachers auto-become mentors when they enter Open Studio mode? (Yes, with override)
- Should health score updates happen on-demand or via background job? (On-demand via check-in)

---

## Deployment

No special deployment steps needed. Routes follow Next.js App Router conventions and will be automatically bundled by Vercel.

**Checklist:**
- [x] All imports resolvable
- [x] No circular dependencies
- [x] TypeScript types correct
- [x] Rate limiting keys unique
- [x] Auth pattern matches existing code
- [ ] Supabase migration created (BLOCKER)
- [ ] E2E tested with real DB (BLOCKER)
