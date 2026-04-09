# Teacher Gallery API Routes — Build Summary

**Date:** 26 March 2026
**Feature:** Class Gallery & Peer Review — Teacher-Facing API Routes
**Status:** Complete

## What Was Built

### 1. API Routes
Two route files implementing the complete teacher-facing gallery API:

**File: `src/app/api/teacher/gallery/route.ts`**
- **GET** — List all gallery rounds for a unit+class (with submission counts)
- **POST** — Create a new gallery round with configurable review format and effort-gating

**File: `src/app/api/teacher/gallery/[roundId]/route.ts`**
- **GET** — Monitoring view for a single round (submissions + student names + review progress)
- **PATCH** — Update round settings (status, deadline, minReviews, title, description)
- **DELETE** — Delete a round and cascade to all submissions and reviews

### 2. Type Definitions
Added to `src/types/index.ts`:
- `GalleryStatus` — Union type: "open" | "closed"
- `ReviewFormat` — Union type: "comment" | "pmi" | "two-stars-wish" | string (custom tool_id)
- `GalleryRound` — Round metadata (title, settings, status, deadline)
- `GallerySubmission` — Student work snapshot (student_id, content, context_note)
- `GalleryReview` — Peer feedback (reviewer_id, review_data)
- `GalleryRoundWithStats` — Teacher monitoring view (extends GalleryRound with submissions[] and stats)

### 3. Documentation
**File: `src/app/api/teacher/gallery/GALLERY-API-SPEC.md`**
- Complete API specification with all 5 endpoints
- Database schema (migration 049)
- Request/response examples for each endpoint
- Error codes and handling
- Type definitions
- Usage examples
- Implementation notes referencing Lesson Learned #11 and #12

## Architecture Decisions

### Auth Pattern
**Consistent with existing teacher routes** (badges, NM config, etc.):
- `createServerClient` for auth only (get teacher user ID)
- `createAdminClient` for all database operations (bypasses RLS)
- Teacher ownership verified on every request (`teacher_id` check)
- All mutation responses include `Cache-Control: private` header (Lesson Learned #11)

### Error Handling
- Uses `withErrorHandler` wrapper for consistent error reporting to Sentry
- Structured error responses with HTTP status codes
- Console logging with request context for debugging

### Database Pattern
- Uses `.maybeSingle()` not `.single()` for optional lookups (Lesson Learned #12)
- No nested joins — each query is independent to avoid PostgREST PGRST201 ambiguity
- Cascade deletes handled by database (migration 049)
- Unique constraint on (submission_id, reviewer_id) prevents duplicate reviews

### Design Patterns
1. **Effort-Gating:** `min_reviews` parameter enforces that students must review N peers before seeing feedback on their own work. Enforced at student API level, not here.
2. **Anonymity:** `anonymous` flag stored but semantic enforcement (hiding reviewer identity) happens in student-facing UX.
3. **Flexible Review Formats:** `review_format` can be standard ("comment", "pmi", "two-stars-wish") or custom (tool_id). Allows reuse of any toolkit tool as a feedback mechanism.
4. **Deadline Handling:** Stored as ISO 8601 UTC string. Client applications handle timezone display.

## Files Created/Modified

```
CREATED:
  src/app/api/teacher/gallery/route.ts (149 lines)
  src/app/api/teacher/gallery/[roundId]/route.ts (235 lines)
  src/app/api/teacher/gallery/GALLERY-API-SPEC.md (detailed spec)

MODIFIED:
  src/types/index.ts (added 5 interfaces + 2 type unions)
```

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/teacher/gallery` | List rounds for unit+class |
| POST | `/api/teacher/gallery` | Create new round |
| GET | `/api/teacher/gallery/[roundId]` | Get monitoring view |
| PATCH | `/api/teacher/gallery/[roundId]` | Update round settings |
| DELETE | `/api/teacher/gallery/[roundId]` | Delete round (cascade) |

## Next Steps (Complementary Work)

The complete Class Gallery feature also requires:

**Student-Facing Routes** (not in this build):
- `GET /api/student/gallery/[roundId]` — Fetch round details + submissions (visible to enrolled students)
- `POST /api/student/gallery/[roundId]/submit` — Submit student work
- `POST /api/student/gallery/[submissionId]/review` — Post peer review
- `GET /api/student/gallery/[submissionId]/reviews` — Fetch reviews (effort-gated after min_reviews)

**UI Components** (not in this build):
- Teacher gallery dashboard (list + create UI)
- Gallery monitoring panel (submissions + review progress)
- Student submission interface
- Student review composer (supports multiple review formats)
- Student review reader (effort-gated visibility)

## Testing Checklist

Before deploying, verify:

- [ ] POST creates rounds with correct teacher_id
- [ ] GET lists only own rounds (not other teachers')
- [ ] GET [roundId] joins student names correctly
- [ ] PATCH updates only provided fields
- [ ] DELETE cascades to submissions and reviews
- [ ] All mutation responses have Cache-Control: private
- [ ] Invalid teacher_id returns 404 (not 403)
- [ ] Missing required fields return 400
- [ ] Unauthenticated requests return 401

## Key Lesson References

- **Lesson Learned #11 (Vercel Cache-Control):** Mutation responses must explicitly set `Cache-Control: private` to prevent CDN stripping cookies
- **Lesson Learned #12 (PostgREST PGRST201):** Gallery tables use no nested joins to avoid ambiguous relationship errors after migration 049 creates junction-like structures

## Integration Points

The teacher gallery routes integrate with:
- **Auth:** Supabase Auth via `createServerClient`
- **Verification:** `verifyTeacherHasUnit` helper for unit ownership checks
- **Database:** Supabase with migration 049 (gallery_rounds, gallery_submissions, gallery_reviews tables)
- **Error Handling:** `withErrorHandler` wrapper + Sentry integration

## Deployment Notes

1. Ensure migration 049 (`class_gallery.sql`) is applied to Supabase
2. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Vercel env vars
3. Routes are protected by Supabase Auth — no additional API key management needed
4. All mutation responses include Cache-Control header (no additional Vercel header rules needed)

---

**Spec File Location:** `src/app/api/teacher/gallery/GALLERY-API-SPEC.md`
**Build Time:** ~45 minutes
**Lines of Code:** 384 API routes + types
**Test Coverage:** Ready for e2e testing
