# TypeScript Errors & Auth Patterns Audit — StudioLoom (20 Mar 2026)

## TypeScript Errors Summary

**Total Errors:** 57 from `tsc --noEmit` output

### Error Categories

| Category | Count | Examples |
|----------|-------|----------|
| **Missing/Incorrect Object Properties** | 24 | `lessonType` not in `TimingContext`, `tool`/`toolId`/`sessionId` not in `UsageEntry`, missing `avgStudentAge` in `GradeTimingProfile`, `retryAfter` should be `retryAfterMs`, missing NM element properties (`definition`, `color`) |
| **Type Mismatches** | 12 | `DiscoveryStep` vs string literals, `NextRequest` not assignable to string, missing `catch` property (void), property type incompatibilities |
| **Missing Dependencies** | 8 | `@types/uuid` not found (2 routes), `lucide-react` not found (2 components), implicit `any` types |
| **Function/Method Signature Mismatches** | 6 | `Expected 1 argument got 6` (3 routes with AI service calls), `.single()` not matching overloads |
| **Import/Declaration Errors** | 7 | Missing type declarations, property doesn't exist on empty object `{}` |

### Critical Issues by File

**Highest Impact:**
1. `src/lib/ai/model-config-defaults.ts` — All 4 grade profiles missing `avgStudentAge` (blocks timing system)
2. `src/app/api/tools/*` routes — 9 routes have `UsageEntry` type mismatch (`tool`/`toolId`/`sessionId` properties incorrect)
3. `src/app/api/tools/{journey-map,systems-map,user-persona}/route.ts` — 3 routes: signature mismatch on AI calls (6 args vs 1)
4. `src/app/api/student/open-studio/discovery/route.ts` — Type mismatch on `DiscoveryStep` (has `"complete"` but type expects only 5 phases)

**Low Impact (Missing optional types):**
5. Missing `@types/uuid` — 2 routes (runtime works, TS error only)
6. Missing `lucide-react` — 2 components (icon library, optional)

## Auth Patterns Audit

**Total API Routes:** 99 (47 teacher + 10 student + 28 tools + 3 admin + 1 legacy own-time + 10 auth routes)

### Pattern Distribution

```
┌─────────────────────────────────────────────────────────────┐
│ Auth Pattern Usage Across 99 API Routes                     │
├─────────────────────────────────────────────────────────────┤
│ createServerClient (SSR Supabase auth)      │ 47 routes    │
│ createAdminClient (bypass RLS)              │ 21 routes    │
│ verify-teacher-unit helper                 │ 3 routes     │
│ Inline student auth (getStudentId)         │ 9 routes     │
│ No shared student auth helper              │ — (GAP)      │
└─────────────────────────────────────────────────────────────┘
```

### Detailed Breakdown

#### Teacher Routes (22 total)

| Pattern | Routes | Status |
|---------|--------|--------|
| `createServerClient` + `auth.getUser()` | 19 | Standard pattern — teacher auth via Supabase Auth |
| `createServerClient` + `verifyTeacherHasUnit()` | 3 | **NM routes ONLY** — uses helper for unit access + NM config fallback |
| `createAdminClient` only | ~6-8 (mixed use) | Some routes use both SSR + admin (e.g., NM observation) |

**Files using verify-teacher-unit helper:**
- `src/app/api/teacher/nm-config/route.ts`
- `src/app/api/teacher/nm-observation/route.ts`
- `src/app/api/teacher/nm-results/route.ts`

#### Student Routes (10 total)

| Pattern | Routes | Issue |
|---------|--------|-------|
| Inline `getStudentId()` + `createAdminClient` | 9 | **DUPLICATE CODE — each route reimplements token auth** |
| No centralized helper | — | **GAP: no `getStudentId` in `/lib/auth/`** |

**Routes with inline getStudentId:**
1. `src/app/api/student/avatar/route.ts`
2. `src/app/api/student/design-assistant/route.ts`
3. `src/app/api/student/nm-assessment/route.ts`
4. `src/app/api/student/nm-checkpoint/[pageId]/route.ts`
5. `src/app/api/student/open-studio/check-in/route.ts`
6. `src/app/api/student/open-studio/discovery/route.ts`
7. `src/app/api/student/open-studio/session/route.ts`
8. `src/app/api/student/planning/route.ts`
9. `src/app/api/student/portfolio/route.ts` (+ 1 more with tool sessions)

**Code duplication example:**
```typescript
// Repeated in 9 student routes:
async function getStudentId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  return session?.student_id || null;
}
```

#### Tools Routes (28 total)

Most use a single shared pattern internally (Haiku + usage logging), but **API route auth is inconsistent:**
- Some check `USAGE_API_KEY` (custom key auth)
- Some use no auth at all (public endpoints)
- Some use student token auth

#### Admin Routes (3 total)

All use `createServerClient` + email whitelist check:
```typescript
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "mattburto@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

const { data: { user } } = await supabase.auth.getUser();
if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Auth Pattern Comparison

#### Teacher Routes: STANDARDIZED ✅
- **Pattern:** `createServerClient` → `auth.getUser()` → verify teacher owns unit/class
- **Consistency:** ~95% (one consistent pattern)
- **Helper usage:** 3 routes use `verifyTeacherUnit` (new, only for NM)
- **Code smell:** Unit/class ownership checks repeated in most routes (not centralized except NM routes)

#### Student Routes: FRAGMENTED ❌
- **Pattern:** Each route reimplements `getStudentId(token)` inline
- **Consistency:** 0% (no shared helper)
- **Lines of wasted code:** ~9 routes × ~15 lines = **~135 duplicated lines**
- **Risk:** If token validation logic needs to change, 9 files must be updated

#### Tools Routes: MIXED
- **Pattern:** Varies by tool (some public, some API key protected, some student-gated)
- **Consistency:** 50% (half use same pattern, half custom)

### Key Findings

| Finding | Severity | Impact | Recommendation |
|---------|----------|--------|-----------------|
| **No `getStudentId` helper in `/lib/auth/`** | HIGH | 9 routes duplicate token parsing code; maintenance risk | Extract to `src/lib/auth/verify-student.ts` with `getStudentId(request, createAdminClient)` export |
| **`UsageEntry` type has wrong schema** | HIGH | 9 tool routes fail TS check; impacts tracking | Update `UsageEntry` type to match actual usage (add `tool`/`toolId`/`sessionId`) |
| **`TimingContext` missing `lessonType`** | HIGH | 2 generation routes fail TS check | Check if `lessonType` was removed from type; if needed, add it back |
| **`GradeTimingProfile` missing `avgStudentAge`** | HIGH | 4 timing profiles fail TS check; 1+age formula breaks | Add `avgStudentAge: number` to all 4 defaults in model-config-defaults.ts |
| **AI service call signatures (journey-map, systems-map, user-persona)** | MEDIUM | 3 routes fail TS check (6 args vs 1); may work at runtime | Verify actual function signature; either fix routes or fix function definition |
| **Teacher unit/class access checks not centralized** | MEDIUM | Pattern works but repeated ~15 times across teacher routes | Extend `verify-teacher-unit.ts` helper (already exists for NM); apply to 15+ other routes |
| **Missing `@types/uuid`** | LOW | Type error only; runtime works (implicit any) | `npm install --save-dev @types/uuid` |
| **Missing `lucide-react`** | LOW | Type error only; icon imports work at runtime | `npm install lucide-react` |

## Actionable Fixes (Priority Order)

### P0 (Blocks deployment)
1. **Add `avgStudentAge` to `GradeTimingProfile` defaults** — 4 lines in `model-config-defaults.ts`
2. **Fix `UsageEntry` type schema** — update type to include `tool`/`toolId`/`sessionId`
3. **Fix AI call signatures** — verify function defs for journey-map, systems-map, user-persona routes

### P1 (Prevents TS check pass)
4. **Create `src/lib/auth/verify-student.ts`** — centralize `getStudentId` helper; update 9 routes to import instead of defining inline
5. **Fix `DiscoveryStep` type** — ensure it includes `"complete"` or remove that assignment
6. **Install missing types** — `npm install --save-dev @types/uuid && npm install lucide-react`

### P2 (Code quality, no blocker)
7. **Extend `verify-teacher-unit.ts`** — extract unit/class ownership checks used in 15+ teacher routes
8. **Consolidate tools auth** — standardize public vs private vs student-gated tools

## Code Reuse Opportunity: Teacher Auth

**Current state:** `verifyTeacherHasUnit()` exists and is used by 3 NM routes. **Only 3 out of ~22 teacher routes use it.**

**Hidden duplicate:** Most teacher routes repeat this check inline:
```typescript
const { data: { user } } = await supabase.auth.getUser();
const { data: unit } = await db.from("units").eq("id", unitId).eq("author_teacher_id", user.id);
if (!unit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

**Opportunity:** Extend `verify-teacher-unit.ts` with a `middleware`-style helper that wraps entire POST/PATCH handlers. Could reduce ~15 routes by 10-15 lines each.

## Summary

- **Auth patterns are 50% standardized** — teachers follow one pattern, students have 9 variants
- **~135 lines of token parsing code duplicated** across student routes (low-hanging refactor)
- **TypeScript checking reveals deeper schema mismatches** (UsageEntry, TimingContext, GradeTimingProfile) that could surface at runtime
- **NM module is the only teacher feature using centralized auth** (shows the pattern works; should expand it)
