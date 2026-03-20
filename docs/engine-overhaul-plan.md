# StudioLoom Engine Overhaul Plan

*Created: 20 March 2026 — based on full codebase audit*
*Estimated effort: 2–3 focused days across 3 phases*
*Goal: C+ (62) → B+ (78)*

---

## Phase 1: Stop the Bleeding (Day 1 morning)

These are the things that will bite you in production or block deploys.

### 1.1 Fix TypeScript compilation (57 errors → 0)

**Why:** Broken build means Vercel deploys could silently fail or produce runtime errors that tsc would have caught.

**The errors fall into 5 buckets:**

| Bucket | Count | Fix |
|--------|-------|-----|
| Missing `avgStudentAge` on grade profiles | 4 | Add the field to all 4 `GradeTimingProfile` defaults in `src/lib/ai/model-config-defaults.ts` |
| `UsageEntry` type missing fields | 9 routes | Add `tool`, `toolId`, `sessionId` to the `UsageEntry` interface in `src/lib/usage-tracking.ts` |
| AI call signature mismatches | 3 routes | `journey-map`, `systems-map`, `user-persona` routes pass 6 args where function expects 1 object — update to match |
| `DiscoveryStep` type missing `"complete"` | 1 | Add `"complete"` to the union in the Open Studio types |
| Missing `@types/uuid` + lucide-react | 2 | `npm install --save-dev @types/uuid && npm install lucide-react` |

**Verification:** `npx tsc --noEmit` returns 0 errors.

### 1.2 Rate limit student login

**Why:** `/api/auth/student-login` has zero rate limiting. Brute-forceable with automated requests against the nanoid token space.

**Fix:** Add the existing `rateLimit()` utility with IP-based limiting (10 attempts/min, 50/hour). ~8 lines of code. Pattern already exists in design-assistant route.

**File:** `src/app/api/auth/student-login/route.ts`

### 1.3 Add security headers

**Why:** No CSP, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy. Basic OWASP hygiene.

**Fix:** Create `next.config.js` headers section (or add to existing):

```js
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }];
}
```

CSP deferred — needs careful allow-listing of Supabase, Anthropic, Vercel domains. Add as Phase 3 task.

---

## Phase 2: Collapse the Duplication (Day 1 afternoon + Day 2)

This is where the real leverage is. One refactoring pass eliminates ~3,000 lines and makes every future toolkit tool a 30-minute job.

### 2.1 Extract shared toolkit API helpers

**Create:** `src/lib/toolkit/shared-api.ts`

This file provides 5 functions that every toolkit route currently copy-pastes:

```typescript
// 1. callHaiku() — currently copied 17 times (608 lines wasted)
export async function callHaiku(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ToolkitAIResult>

// 2. validateToolkitRequest() — validation + rate limiting (160 lines wasted)
export async function validateToolkitRequest(
  request: NextRequest,
  validActions: string[]
): Promise<{ body: ToolkitRequestBody; error?: NextResponse }>

// 3. parseToolkitJSON() — JSON parse + regex fallback (288 lines wasted)
export function parseToolkitJSON<T>(
  text: string,
  fallbackShape: T
): T

// 4. toolkitErrorResponse() — consistent error format (40 lines wasted)
export function toolkitErrorResponse(
  toolName: string,
  error: unknown
): NextResponse

// 5. logToolkitUsage() — usage logging + optional Sentry (480 lines wasted)
export function logToolkitUsage(
  endpoint: string,
  result: ToolkitAIResult,
  metadata: Record<string, unknown>
): void
```

**Create:** `src/lib/toolkit/prompt-helpers.ts`

```typescript
// Shared difficulty staging — currently duplicated in every tool's prompt builder
export function buildDifficultyInstruction(ideaCount: number): string

// Shared effort strategy — identical across all nudge prompts
export function buildEffortStrategy(effortLevel: string): string
```

**Create:** `src/lib/toolkit/types.ts`

```typescript
export interface ToolkitRequestBody { ... }
export interface ToolkitAIResult { ... }
export type EffortLevel = 'low' | 'medium' | 'high';
```

### 2.2 Rewrite all 12 toolkit API routes to use shared helpers

**Before (scamper/route.ts — 389 lines):**
- Lines 1–18: imports (duplicated)
- Lines 20–26: TOOLKIT_LIMITS (duplicated)
- Lines 40–53: RequestBody interface (duplicated)
- Lines 158–195: callHaiku function (duplicated)
- Lines 197–227: validation + rate limiting (duplicated)
- Lines 253–272: JSON parse fallback (duplicated)
- Lines 274–280, 328–334, 368–374: logUsage calls (duplicated)
- Lines 380–388: error handling (duplicated)

**After (~120–180 lines):**
- Tool-specific config (steps/hats/columns)
- Tool-specific prompt builders (the unique pedagogical rules)
- POST handler using shared helpers

**Target routes (12 files):**

| Route | Current lines | Target lines |
|-------|-------------|-------------|
| `tools/scamper/route.ts` | 389 | ~150 |
| `tools/six-hats/route.ts` | 411 | ~160 |
| `tools/pmi/route.ts` | 383 | ~140 |
| `tools/five-whys/route.ts` | 350 | ~140 |
| `tools/empathy-map/route.ts` | ~400 | ~150 |
| `tools/decision-matrix/route.ts` | ~350 | ~150 |
| `tools/how-might-we/route.ts` | ~400 | ~160 |
| `tools/reverse-brainstorm/route.ts` | ~393 | ~140 |
| `tools/swot-analysis/route.ts` | ~414 | ~150 |
| `tools/stakeholder-map/route.ts` | ~416 | ~160 |
| `tools/lotus-diagram/route.ts` | ~400 | ~150 |
| `tools/affinity-diagram/route.ts` | ~350 | ~130 |

**Estimated savings:** ~2,800 lines removed. Sentry added to all 12 tools for free.

### 2.3 Extract shared student auth helper

**Create:** `src/lib/auth/verify-student.ts`

```typescript
export async function getAuthenticatedStudent(
  request: NextRequest
): Promise<{ studentId: string; error?: NextResponse }>
```

Currently 9 student API routes each reimplement the same token-checking logic inline (~15 lines each = 135 duplicated lines). Extract once, import everywhere.

**Update routes:**
- `student/open-studio/status/route.ts`
- `student/open-studio/session/route.ts`
- `student/open-studio/check-in/route.ts`
- `student/nm-assessment/route.ts`
- `student/nm-checkpoint/[pageId]/route.ts`
- `student/tool-sessions/route.ts`
- `student/tool-sessions/[id]/route.ts`
- `student/design-assistant/route.ts`
- `student/responses/route.ts`

### 2.4 Widen adoption of verify-teacher-unit helper

The `src/lib/auth/verify-teacher-unit.ts` helper has 3 excellent functions (`verifyTeacherHasUnit`, `getNmConfigForClassUnit`, `verifyTeacherOwnsClass`) but only 3 NM routes use them. At least 10 other teacher routes do ownership checks from scratch.

**Update routes to use the helper:**
- `teacher/generate-journey/route.ts`
- `teacher/generate-unit/route.ts`
- `teacher/regenerate-page/route.ts`
- `teacher/teach/live-status/route.ts`
- `teacher/open-studio/status/route.ts`
- `teacher/units/[unitId]/...` routes (several)

---

## Phase 3: Structural Improvements (Day 2 afternoon + Day 3)

These improve long-term maintainability and performance. Lower urgency than Phase 1–2 but important for scaling.

### 3.1 Split ResponseInput god component

**File:** `src/components/student/ResponseInput.tsx` (846 lines)

**Split into:**

| New component | Responsibility | Estimated lines |
|---------------|---------------|----------------|
| `ResponseInput.tsx` (slimmed) | Orchestrator — picks the right input type | ~150 |
| `TextResponseInput.tsx` | MonitoredTextarea + sentence starters + effort tags | ~200 |
| `FileUploadInput.tsx` | Upload, preview, file type validation | ~150 |
| `VoiceInput.tsx` | Recording, playback, transcription | ~120 |
| `ToolkitResponseInput.tsx` | Dynamic imports for 13 toolkit tools | ~180 |

### 3.2 Split admin AI model page

**File:** `src/app/admin/ai-model/page.tsx` (1,752 lines)

**Split into:**

| New component | Responsibility | Estimated lines |
|---------------|---------------|----------------|
| `page.tsx` (slimmed) | Layout + tab routing | ~150 |
| `ModelConfigTab.tsx` | Model selection, emphasis dials | ~400 |
| `TestSandboxTab.tsx` | Skeleton + lesson test sandbox | ~500 |
| `ConfigHistoryTab.tsx` | Config version history | ~200 |
| `MacroDials.tsx` | Camera-style SVG dial controls | ~300 |

### 3.3 Wire Sentry into all API routes

Currently only 4 of 30 toolkit routes have Sentry. After 2.1, the shared `logToolkitUsage()` function will include Sentry capture — so this comes free with the toolkit extraction.

For non-toolkit routes, add a shared error wrapper:

```typescript
// src/lib/api/error-handler.ts
export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>,
  routeName: string
) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      Sentry.captureException(error, { tags: { route: routeName } });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  };
}
```

### 3.4 Fix test infrastructure + add critical path tests

**Step 1:** Fix Vitest — the Rolldown native binding error is likely a Node version or platform mismatch. Investigate and fix so `npm test` actually runs.

**Step 2:** Add tests for the new shared helpers (highest leverage):

| Test file | What it covers | Why it matters |
|-----------|---------------|----------------|
| `src/lib/toolkit/__tests__/shared-api.test.ts` | callHaiku, parseToolkitJSON, validateToolkitRequest | These are called by every tool — one bug breaks 12 routes |
| `src/lib/auth/__tests__/verify-student.test.ts` | Student token auth helper | Auth bugs = security bugs |
| `src/lib/auth/__tests__/verify-teacher-unit.test.ts` | Teacher ownership checks | Auth bugs = security bugs |

**Step 3 (stretch):** Add integration tests for 2 critical API flows:
- Student login → get token → access tool session → auto-save
- Teacher create unit → generate skeleton → validate timing

### 3.5 Start a real component library

**Create:** `src/components/ui/` with extracted patterns:

| Component | Extracted from | Usage count |
|-----------|---------------|-------------|
| `Button.tsx` | ~30 one-off button implementations | Universal |
| `Modal.tsx` | ~15 custom modal wrappers | Universal |
| `Card.tsx` | ~20 card variants | Universal |
| `Badge.tsx` | Difficulty badges, status pills, NM badges | ~25 uses |
| `LoadingSpinner.tsx` | ~10 inline spinner implementations | Universal |

This is a stretch goal. The duplication is annoying but not ship-blocking. Start small (Button + Modal), expand as you touch components.

---

## Execution Order

```
Day 1 Morning (Phase 1 — Stop the Bleeding)
├── 1.1 Fix 57 TypeScript errors (~1 hour)
├── 1.2 Rate limit student login (~15 min)
└── 1.3 Add security headers (~15 min)

Day 1 Afternoon (Phase 2 — Core Extraction)
├── 2.1 Create shared toolkit helpers (~1.5 hours)
│   ├── src/lib/toolkit/shared-api.ts
│   ├── src/lib/toolkit/prompt-helpers.ts
│   └── src/lib/toolkit/types.ts
└── 2.2 Rewrite first 4 toolkit routes as proof (~2 hours)
    ├── scamper (reference implementation)
    ├── six-hats
    ├── pmi
    └── five-whys

Day 2 Morning (Phase 2 — Finish Extraction)
├── 2.2 continued: Rewrite remaining 8 toolkit routes (~3 hours)
├── 2.3 Extract student auth helper (~30 min)
└── 2.4 Widen teacher auth helper adoption (~1 hour)

Day 2 Afternoon + Day 3 (Phase 3 — Structure)
├── 3.1 Split ResponseInput (~2 hours)
├── 3.2 Split admin AI model page (~2 hours)
├── 3.3 Wire Sentry everywhere (~1 hour, mostly free from 2.1)
├── 3.4 Fix test infra + add shared helper tests (~2 hours)
└── 3.5 Start ui/ component library (~2 hours, stretch)
```

---

## Verification Checklist

After each phase, run these checks:

### Phase 1 Complete ✅ (21 Mar 2026)
- [x] `npx tsc --noEmit` returns 0 errors (50 errors fixed)
- [x] Student login route has rate limiting (10/min, 50/hour per IP)
- [x] Security headers added to next.config.ts (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] Pushed to GitHub, Vercel build passed

### Phase 2 Complete ✅ (21 Mar 2026)
- [x] All **25** toolkit routes use `callHaiku` from `shared-api.ts` (was 12 in original plan — discovered 13 more routes)
- [x] All 25 toolkit routes use `validateToolkitRequest` from `shared-api.ts`
- [x] All 25 toolkit routes use `parseToolkitJSON` from `shared-api.ts`
- [x] All **17** student routes use `requireStudentAuth`/`getStudentId` from `src/lib/auth/student.ts`
- [x] `requireTeacherAuth()` added to `verify-teacher-unit.ts`, adopted by 6 worst-offending teacher routes
- [x] Total: 53 files changed, **-2,462 net lines** (2,636 insertions, 5,098 deletions)
- [x] `npx tsc --noEmit` passes clean
- [ ] **TODO:** Manual test toolkit tools on Vercel after Phase 2 push

### Phase 3 Complete ✅ (21 Mar 2026)
- [x] ResponseInput.tsx slimmed to 186 lines (was 843). Split into 5 files: ResponseInput (orchestrator), UploadInput, VoiceInput, LinkInput, ToolkitResponseInput (data-driven lookup map)
- [x] Admin AI model page.tsx slimmed to 282 lines (was 1,752). Split into 7 files: page (layout), config-helpers, SliderRow, CategoryPanel, TimingPanel, TestResultsView, TestSandbox
- [x] `withErrorHandler()` created in `src/lib/api/error-handler.ts`, wired into 12 high-priority routes (design-assistant, progress, portfolio, open-studio/session, teacher/profile, dashboard, knowledge/upload, generate-unit, generate-journey, teach/live-status, open-studio/status, nm-config). Toolkit routes get Sentry via shared-api.ts.
- [x] Test files written: `src/lib/toolkit/__tests__/shared-api.test.ts` (14 tests), `src/lib/api/__tests__/error-handler.test.ts` (4 tests). NOTE: Vitest 4.x requires rolldown native binary not available in VM — tests ready to run on Matt's machine
- [x] ui/ component library started: Button (variants/sizes/loading/icon), Modal (backdrop/escape/focus trap/aria), Badge (6 variants/2 sizes), LoadingSpinner (3 sizes/optional label), WaveDivider. Barrel export at `src/components/ui/index.ts`
- [x] `npx tsc --noEmit` passes clean
- [ ] **TODO:** `npm test` on Matt's machine (Vitest needs native binary)
- [ ] **TODO:** Manual test toolkit tools + ResponseInput on Vercel after push

---

## What This Doesn't Cover (Parked for Later)

These came up in the audit but aren't worth tackling in a 2–3 day sprint:

| Item | Why parked |
|------|-----------|
| **Server-side rendering for teacher pages** | Big architectural shift. Works fine as client-only for now. Revisit when SEO matters. |
| **Content Security Policy (CSP)** | Needs careful domain allow-listing. Easy to break things. Do it when you have a staging environment. |
| **Inline style cleanup** | The dark toolkit theme legitimately needs inline styles. The rest is cosmetic debt, not functional. |
| **Data fetching layer (SWR/React Query)** | Would improve UX with caching + deduplication but requires touching every page. Do it if you rebuild the student experience. |
| **Full component library** | Start with Button + Modal in Phase 3.5, expand organically. Don't design a system you don't need yet. |
| **Integration test suite** | Need the unit tests working first. Build integration tests around real user flows once Phase 3.4 is stable. |

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| TypeScript errors | 57 | 0 |
| Toolkit route avg lines | ~390 | ~150 |
| Total lines removed | — | ~3,000 |
| callHaiku copies | 17 | 1 |
| Student auth implementations | 9 | 1 |
| Routes with Sentry | 4 | 30+ |
| Routes with rate limiting | ~15 | ~25 |
| Test files | 7 | 10+ |
| Time to add new toolkit tool | ~2 hours | ~30 min |
| Audit score | C+ (62) | B+ (~78) |
