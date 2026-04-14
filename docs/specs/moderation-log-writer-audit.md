# Writer Audit: student_content_moderation_log

> **Date:** 2026-04-14
> **Context:** Phase 7A-Safety-2 (FU-N Option C dual-visibility fix)
> **Purpose:** Document every call site that writes to `student_content_moderation_log`, categorize class_id behavior, identify bugs and pattern inconsistencies.

---

## Summary

- **17 call sites** across **14 routes**
- **1 shared helper:** `moderateAndLog()` in `src/lib/content-safety/moderate-and-log.ts` (used by 16 sites)
- **1 direct insert:** `src/app/api/safety/log-client-block/route.ts` (pattern inconsistency → FU-II)
- **class_id behavior:** `moderateAndLog()` writes `class_id: context.classId || null` — empty string `''` coerces to `null`

## Writer categories

### Category A — Always NULL by design (12 routes, 14 call sites)

These routes don't resolve class context — they pass `classId: ''` which becomes `NULL` via `|| null`. This is the expected case that FU-N Option C (dual-visibility policy) accommodates. **No code changes needed.**

| # | File | Line | classId | Context |
|---|------|------|---------|---------|
| 1 | `src/app/api/student/upload/route.ts` | 48 | `''` → NULL | Image upload |
| 2 | `src/app/api/student/portfolio/route.ts` | 64 | `''` → NULL | Portfolio text |
| 3 | `src/app/api/student/avatar/route.ts` | 63 | `''` → NULL | Avatar upload |
| 4 | `src/app/api/student/planning/route.ts` | 69 | `''` → NULL | Planning task POST |
| 5 | `src/app/api/student/planning/route.ts` | 182 | `''` → NULL | Planning task PATCH |
| 6 | `src/app/api/student/design-assistant/route.ts` | 138 | `''` → NULL | Design assistant conversation |
| 7 | `src/app/api/student/tool-sessions/route.ts` | 133 | `''` → NULL | Tool session POST |
| 8 | `src/app/api/student/tool-sessions/[id]/route.ts` | 146 | `''` → NULL | Tool session PATCH |
| 9 | `src/app/api/student/open-studio/session/route.ts` | 94 | `''` → NULL | Open Studio session POST |
| 10 | `src/app/api/student/open-studio/session/route.ts` | 174 | `''` → NULL | Open Studio session PATCH |
| 11 | `src/app/api/student/quest/milestones/route.ts` | 236 | `''` → NULL | Quest milestone |
| 12 | `src/app/api/student/quest/evidence/route.ts` | 177 | `''` → NULL | Quest evidence |
| 13 | `src/app/api/student/quest/sharing/route.ts` | 67 | `''` → NULL | Quest sharing |
| 14 | `src/app/api/student/quest/contract/route.ts` | 200 | `''` → NULL | Quest contract |

### Category B — Usually has class_id (3 routes)

These routes resolve class_id from DB context. When the lookup succeeds, the row is visible via the `class_id IN (...)` primary path. When it fails, the row falls back to NULL → dual-visibility path.

| # | File | Line | classId | Context |
|---|------|------|---------|---------|
| 15 | `src/app/api/student/progress/route.ts` | 218 | `resolvedClassId \|\| ''` | Student progress (resolved from class_units) |
| 16 | `src/app/api/student/gallery/submit/route.ts` | 144 | `round.class_id \|\| ''` | Gallery submission (from gallery_rounds) |
| 17 | `src/app/api/student/gallery/review/route.ts` | 168 | `round.class_id \|\| ''` | Gallery peer review (from gallery_rounds) |

### Category C — Sometimes garbage by bug (1 route) → FU-GG

| # | File | Line | classId | Context |
|---|------|------|---------|---------|
| 18 | `src/app/api/student/nm-assessment/route.ts` | 184 | `classId \|\| "unknown"` | NM self-assessment |

**Bug:** When the class_students + legacy lookup fails, `classId` is `null`, and the fallback `"unknown"` is not a valid UUID. The FK constraint `REFERENCES classes(id)` rejects it, the DB insert fails, and the try/catch in `moderateAndLog()` swallows the error. **The moderation event is silently lost.**

**Fix:** Change line 184 from `classId || "unknown"` to `classId || ''` (or `classId ?? ''`). One-line change. Filed as **FU-GG (P1)**.

### Category D — Sometimes NULL by design, direct insert (1 route) → FU-II

| # | File | Line | classId | Context |
|---|------|------|---------|---------|
| 19 | `src/app/api/safety/log-client-block/route.ts` | 33 | `classId \|\| null` | Client-side text block log |

**Pattern inconsistency:** This is the only route that writes directly to `student_content_moderation_log` via `.from(...).insert(...)` instead of using the shared `moderateAndLog()` helper. It also uses a zero-UUID fallback for `student_id` (`"00000000-0000-0000-0000-000000000000"`).

**Reason may be intentional:** The client-block logger runs in a fire-and-forget path from the client-side text filter — no server-side moderation call is needed (the client already blocked the content), so `moderateAndLog()` would add unnecessary overhead. Needs audit. Filed as **FU-II (P3)**.

---

## Peer table: content_moderation_log (migration 067)

`content_moderation_log` is the **teacher-side/ingestion** moderation table. It has:
- **No `class_id` column** — keyed by `block_id REFERENCES activity_blocks(id)`
- **Service-role-only policy:** `USING (false) WITH CHECK (false)`
- **No FU-N-peer issue** — no class_id path to break, and no non-service-role access at all

---

## Key takeaways

1. **14 of 19 call sites write NULL class_id** — this is the dominant pattern, and it's by design (Option C accommodates it)
2. **The nm-assessment "unknown" fallback (FU-GG) is an active P1 data-loss bug** — moderation events from NM assessments where the class lookup fails are silently dropped
3. **The log-client-block direct insert (FU-II) is a pattern inconsistency** — likely intentional but worth auditing
4. **No writer is "always NULL by bug"** — all NULL-class_id writers are NULL by design (they don't have class context available)
