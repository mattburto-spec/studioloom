# Student Gallery API Specification

## Overview
The Student Gallery API provides four endpoints for StudioLoom's Class Gallery & Peer Review feature. Students can browse open gallery rounds, submit their work, review peers' submissions, and receive effort-gated feedback on their own work.

## Database Tables
Built on migration 049_class_gallery.sql:
- `gallery_rounds` — teacher-created critique sessions (open/closed status)
- `gallery_submissions` — student work snapshots shared to a round
- `gallery_reviews` — peer feedback on submissions (unique constraint: one review per reviewer per submission)

## Authentication Pattern
All routes use token-based student auth via `requireStudentAuth` from `@/lib/auth/student`. Students authenticate via cookie token session (SESSION_COOKIE_NAME) → student_sessions table → student_id. This is NOT Supabase Auth.

All DB operations use `createAdminClient()` from `@/lib/supabase/admin` to bypass RLS.

## API Routes

### 1. GET `/api/student/gallery/rounds`
**List all open gallery rounds for the student's enrolled classes.**

**Query Parameters:** None

**Response:** Array of round objects
```json
[
  {
    "id": "uuid",
    "unitId": "string",
    "classId": "string",
    "title": "string",
    "description": "string",
    "reviewFormat": "comment|pmi|two-stars-wish|string",
    "minReviews": number,
    "anonymous": boolean,
    "deadline": "ISO 8601 timestamp|null",
    "hasSubmitted": boolean,
    "reviewsCompleted": number,
    "totalSubmissions": number
  }
]
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized (no valid student session)
- `500` — Server error

**Cache-Control:** `private`

**Logic:**
1. Lookup student's enrolled classes via `class_students` junction (with fallback to legacy `students.class_id`)
2. Query all open rounds for those classes
3. Check if student has submitted to each round
4. Count reviews completed per round
5. Count total submissions per round
6. Return enriched round data

---

### 2. POST `/api/student/gallery/submit`
**Submit work to a gallery round.**

**Body:**
```json
{
  "roundId": "uuid",
  "contextNote": "optional string, e.g., 'I learned about iterative design'",
  "content": { "any": "JSONB structure" }
}
```

**Response:**
```json
{
  "submissionId": "uuid",
  "createdAt": "ISO 8601 timestamp"
}
```

**Status Codes:**
- `200` — Success
- `400` — Round closed, deadline passed, already submitted, or missing required fields
- `401` — Unauthorized
- `403` — Student not enrolled in the round's class
- `404` — Round not found
- `429` — Rate limited (5 submissions/min per student)
- `500` — Server error

**Cache-Control:** `private`

**Rate Limit:** 5 submissions per minute per student

**Validations:**
- Round exists and is open
- Deadline has not passed (if set)
- Student is enrolled in the round's class
- Student has not already submitted to this round
- Content is a valid JSONB object

---

### 3. GET `/api/student/gallery/submissions?roundId=<uuid>`
**Browse all submissions for a round (except student's own).**

**Query Parameters:**
- `roundId` (required) — UUID of the gallery round

**Response:** Array of submission objects (randomized order)
```json
[
  {
    "id": "uuid",
    "contextNote": "string",
    "content": { "any": "JSONB structure" },
    "createdAt": "ISO 8601 timestamp",
    "studentName": "string or 'Anonymous'"
  }
]
```

**Status Codes:**
- `200` — Success
- `400` — Missing roundId query param
- `401` — Unauthorized
- `403` — Student not enrolled in the round's class
- `404` — Round not found
- `500` — Server error

**Cache-Control:** `private`

**Logic:**
1. Verify round exists and student is enrolled in the round's class
2. Query all submissions for the round EXCEPT the student's own
3. If round is not anonymous, lookup student names via `students` table
4. Randomize submission order (Fisher-Yates shuffle) to avoid review bias
5. Transform and return

---

### 4. POST `/api/student/gallery/review`
**Submit a peer review for a submission.**

**Body:**
```json
{
  "submissionId": "uuid",
  "roundId": "uuid",
  "reviewData": { "any": "JSONB structure (format-specific)" }
}
```

**Response:**
```json
{
  "reviewId": "uuid",
  "createdAt": "ISO 8601 timestamp"
}
```

**Status Codes:**
- `200` — Success
- `400` — Missing required fields, self-review attempted, round closed/deadline passed, or already reviewed
- `401` — Unauthorized
- `403` — Student not enrolled in the round's class
- `404` — Submission or round not found
- `429` — Rate limited (20 reviews/min per student)
- `500` — Server error

**Cache-Control:** `private`

**Rate Limit:** 20 reviews per minute per student

**Validations:**
- Submission and round exist
- Round is open and deadline has not passed
- Reviewer is enrolled in the round's class
- Reviewer is NOT the submission author (no self-review)
- This is the reviewer's first review of this submission (unique constraint: submission_id + reviewer_id)

---

### 5. GET `/api/student/gallery/feedback?roundId=<uuid>`
**Get peer reviews received on the student's own submission. EFFORT-GATED.**

**Query Parameters:**
- `roundId` (required) — UUID of the gallery round

**Response (Locked):**
```json
{
  "locked": true,
  "reviewsCompleted": number,
  "minRequired": number
}
```

**Response (Unlocked):**
```json
{
  "locked": false,
  "reviews": [
    {
      "id": "uuid",
      "reviewData": { "any": "JSONB structure" },
      "createdAt": "ISO 8601 timestamp",
      "reviewerName": "string or 'Classmate'"
    }
  ]
}
```

**Status Codes:**
- `200` — Success
- `400` — Missing roundId query param
- `401` — Unauthorized
- `403` — Student not enrolled in the round's class
- `404` — Round not found
- `500` — Server error

**Cache-Control:** `private`

**Effort-Gating Logic:**
1. Count how many reviews the student has completed in this round
2. If count < round.min_reviews, return `{ locked: true, ... }`
3. If count >= min_reviews, return all reviews on student's own submission

**Notes:**
- If student has not submitted to the round, returns `{ locked: false, reviews: [] }` regardless of review count
- Reviewer names shown as-is if round is not anonymous, or "Classmate" if anonymous

---

## Error Response Format

All endpoints return errors as:
```json
{
  "error": "Human-readable error message"
}
```

With appropriate HTTP status codes (400, 401, 403, 404, 429, 500).

---

## Key Design Decisions

### Effort-Gating on Feedback
Students must complete `min_reviews` reviews before seeing feedback on their own submission. This encourages peer engagement and ensures students give feedback before receiving it. Implemented in the feedback endpoint with a `locked` flag and counter.

### Randomized Submission Order
Submissions are shuffled (Fisher-Yates) when listed to prevent students from reviewing the same first few submissions and introduce fairness. Shuffle happens on every request (not persisted).

### Anonymous vs Named Reviews
When `round.anonymous = true`, reviewer names appear as "Classmate" in feedback. Student names in submissions lists also show as "Anonymous". This is fully configurable per round by the teacher.

### Self-Review Prevention
The review endpoint explicitly checks that the reviewer is not the submission author. This is a hard constraint.

### One Review Per Student Per Submission
The `gallery_reviews` table has a unique constraint on (submission_id, reviewer_id). The POST review route checks this before inserting. Attempting to review twice returns a 400 error.

### Class Enrollment Verification
All endpoints verify that the student is enrolled in the round's class via the `class_students` junction table. Falls back to legacy `students.class_id` if no junction entry found (for backward compatibility).

### Rate Limiting
- Submissions: 5/min per student (prevent spam)
- Reviews: 20/min per student (higher limit, expect bulk review sessions)
- Implemented via in-memory sliding window (`src/lib/rate-limit.ts`)

### Cache Control
All responses set `Cache-Control: private` to prevent CDN caching of user-specific data.

---

## Testing Checklist

- [ ] Verify student can list open rounds for their enrolled classes
- [ ] Verify rounds from other classes are hidden
- [ ] Verify student can submit work to a round only once
- [ ] Verify submission deadline is enforced (past deadline = 400 error)
- [ ] Verify student can browse other students' submissions (randomized order)
- [ ] Verify student cannot see their own submission in the browse list
- [ ] Verify student can review another's submission
- [ ] Verify student cannot review the same submission twice
- [ ] Verify student cannot review their own submission
- [ ] Verify effort-gating: student sees "locked" feedback until min_reviews met
- [ ] Verify once unlocked, student sees all peer reviews on their submission
- [ ] Verify anonymous = true hides reviewer/student names
- [ ] Verify anonymous = false shows actual names
- [ ] Verify rate limits (5 submissions/min, 20 reviews/min)
- [ ] Verify class enrollment check via class_students junction
- [ ] Verify legacy fallback to students.class_id works
- [ ] Verify 401 when session expired or no auth cookie
- [ ] Verify 404 when round/submission not found
- [ ] Verify 403 when trying to access round student not enrolled in

---

## Implementation Notes

### Imports
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { rateLimit } from "@/lib/rate-limit";
```

### Constants
- `SESSION_COOKIE_NAME` from `@/lib/constants` (used internally by `requireStudentAuth`)

### Auth Pattern
```typescript
const auth = await requireStudentAuth(request);
if (auth.error) return auth.error;
const studentId = auth.studentId;
```

### Rate Limit Pattern
```typescript
const rateLimitResult = rateLimit(
  `gallery-<action>:${studentId}`,
  [{ maxRequests: N, windowMs: milliseconds }]
);

if (!rateLimitResult.allowed) {
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(rateLimitResult.retryAfterMs / 1000))
      }
    }
  );
}
```

### Optional Lookups
Always use `.maybeSingle()` not `.single()` when a row might not exist (e.g., optional submissions, enrollments). `.single()` throws if no rows found.

### Cache Control
Every response should include:
```typescript
headers: { "Cache-Control": "private" }
```

---

## Future Enhancements

1. **AI Feedback Synthesis** — Route reviews through Haiku to generate summary insights for students
2. **Review Format Templates** — Store review structure per round format (comment vs PMI vs two-stars-wish) and validate against schema
3. **Reviewer Analytics** — Track reviewer quality signals (review length, specificity, usefulness rating by author)
4. **Anonymous Reviewer Reputation** — Aggregate quality signals across rounds to rank helpful reviewers
5. **Teacher Moderation** — Flag/hide inappropriate reviews before students see them
6. **Cross-Class Gallery** — Allow reviews from students in other classes (requires additional auth verification)
