# Safety Badge System API

Complete REST API for the safety certification tool. Public endpoints — no authentication required.

## Overview

The safety badge system allows teachers to create class sessions where students complete safety knowledge tests and earn digital badges. The system is entirely public and session-based (uses a 6-character class code for access).

## Endpoints

### 1. List All Badges

```
GET /api/tools/safety/badges
```

**Response:**
```json
{
  "badges": [
    {
      "id": "general-workshop-safety",
      "name": "General Workshop Safety",
      "slug": "general-workshop-safety",
      "description": "Essential workshop safety practices...",
      "category": "safety",
      "tier": 1,
      "color": "#FF6B6B",
      "icon_name": "Shield",
      "is_built_in": true,
      "pass_threshold": 75,
      "expiry_months": 12,
      "retake_cooldown_minutes": 60,
      "question_count": 15,
      "topics": ["Personal Protective Equipment", "Workshop Layout", ...],
      "learn_content": [
        {
          "title": "Personal Protective Equipment (PPE)",
          "content": "...",
          "icon": "🥽"
        }
      ]
    }
  ]
}
```

**Notes:**
- Returns all built-in badges with metadata
- `question_pool` is not included (questions come via `/start-test`)
- No authentication required

---

### 2. Get Single Badge

```
GET /api/tools/safety/badges/:slug
```

**Example:** `GET /api/tools/safety/badges/general-workshop-safety`

**Response:**
```json
{
  "badge": {
    "id": "general-workshop-safety",
    "name": "General Workshop Safety",
    ...
    "learn_content": [...]
  }
}
```

**Status Codes:**
- `200` — Badge found
- `404` — Badge not found

**Notes:**
- Returns a single badge with full learn content
- Used to display badge details before starting a test

---

### 3. Create Teacher Session

```
POST /api/tools/safety/session
Content-Type: application/json
```

**Request Body:**
```json
{
  "teacherEmail": "teacher@school.com",
  "teacherName": "Ms. Smith",
  "className": "Design & Technology 7A",
  "badgeSlugs": ["general-workshop-safety", "laser-cutter-safety"]
}
```

**Response:**
```json
{
  "sessionId": "abc123xyz789",
  "classCode": "ABC123"
}
```

**Status Codes:**
- `201` — Session created
- `400` — Missing required fields
- `429` — Rate limit exceeded (5 sessions per email per 24 hours)

**Notes:**
- Generates a unique 6-character class code (alphanumeric, excludes O/0/I/1/l)
- Class code is shared with students for join access
- `badgeSlugs` is optional — defaults to empty array
- Rate limited to prevent spam

---

### 4. Retrieve Teacher Session

```
GET /api/tools/safety/session?code=ABC123
```

**Response:**
```json
{
  "session": {
    "id": "abc123xyz789",
    "classCode": "ABC123",
    "teacherEmail": "teacher@school.com",
    "teacherName": "Ms. Smith",
    "className": "Design & Technology 7A",
    "createdAt": "2024-03-21T10:30:00Z",
    "badgeSlugs": ["general-workshop-safety"]
  },
  "resultsCount": 5,
  "results": [...]
}
```

**Status Codes:**
- `200` — Session found
- `400` — Missing `code` query param
- `404` — Session not found

**Notes:**
- Publicly accessible — no email verification needed
- Returns session metadata + all results for the session
- Used by teachers to check student progress

---

### 5. Start Test

```
POST /api/tools/safety/start-test
Content-Type: application/json
```

**Request Body:**
```json
{
  "badgeSlug": "general-workshop-safety",
  "studentName": "Alex Chen",
  "sessionId": "abc123xyz789"
}
```

**Response:**
```json
{
  "testId": "test_xyz123",
  "badge": {
    "name": "General Workshop Safety",
    "slug": "general-workshop-safety",
    "description": "...",
    "category": "safety",
    "tier": 1,
    "color": "#FF6B6B",
    "icon_name": "Shield",
    "pass_threshold": 75,
    "expiry_months": 12,
    "question_count": 15,
    "topics": [...]
  },
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "topic": "Personal Protective Equipment",
      "prompt": "Which of the following is NOT necessary...",
      "options": ["Safety glasses", "Closed-toe shoes", ...],
      "difficulty": "easy"
    }
  ],
  "startedAt": "2024-03-21T10:35:00Z"
}
```

**Status Codes:**
- `201` — Test started
- `400` — Missing required fields
- `404` — Badge not found
- `429` — Retake cooldown active (with `minutesRemaining`)

**Request Body (without sessionId):**
```json
{
  "badgeSlug": "general-workshop-safety",
  "studentName": "Alex Chen"
}
```

**Notes:**
- `sessionId` is optional — omit for standalone tool use
- If `sessionId` provided, checks retake cooldown
- Retake cooldown: defaults 60 minutes per badge
- Questions are shuffled and stripped of correct answers
- Stores test reference in DB for grading

---

### 6. Submit Test

```
POST /api/tools/safety/submit-test
Content-Type: application/json
```

**Request Body:**
```json
{
  "testId": "test_xyz123",
  "badgeSlug": "general-workshop-safety",
  "studentName": "Alex Chen",
  "sessionId": "abc123xyz789",
  "answers": [
    {
      "questionId": "q1",
      "selected": "Gloves at all times"
    },
    {
      "questionId": "q2",
      "selected": false
    },
    {
      "questionId": "q5",
      "selected": ["A", "B"]
    }
  ],
  "timeTakenSeconds": 420
}
```

**Response:**
```json
{
  "score": 87,
  "passed": true,
  "threshold": 75,
  "results": [
    {
      "questionId": "q1",
      "correct": true,
      "explanation": "While gloves are important for certain tasks..."
    },
    {
      "questionId": "q2",
      "correct": false,
      "explanation": "Emergency exits must ALWAYS remain clear..."
    }
  ],
  "badgeAwarded": true
}
```

**Status Codes:**
- `200` — Test graded
- `400` — Missing required fields
- `404` — Badge not found

**Notes:**
- `sessionId` is optional
- Answers: `selected` value matches question type (string, boolean, or array)
- Returns score (0-100) and whether student passed (≥ threshold)
- Results include explanation for each question
- If `sessionId` provided, stores result in DB
- If student is authenticated (token cookie), awards badge to student profile
- Badge expiry computed based on `badge.expiry_months`

---

### 7. Teacher Results Dashboard

```
GET /api/tools/safety/results?sessionId=abc123xyz789&email=teacher@school.com
```

**Response:**
```json
{
  "session": {
    "id": "abc123xyz789",
    "classCode": "ABC123",
    "teacherEmail": "teacher@school.com",
    "teacherName": "Ms. Smith",
    "className": "Design & Technology 7A",
    "createdAt": "2024-03-21T10:30:00Z"
  },
  "results": [
    {
      "id": "result_1",
      "testId": "test_xyz123",
      "sessionId": "abc123xyz789",
      "studentName": "Alex Chen",
      "badgeSlug": "general-workshop-safety",
      "score": 87,
      "passed": true,
      "timeTakenSeconds": 420,
      "answers": [...],
      "results": [...],
      "createdAt": "2024-03-21T10:45:00Z"
    }
  ],
  "summary": {
    "totalAttempts": 5,
    "passedCount": 4,
    "averageScore": 82,
    "byBadge": {
      "general-workshop-safety": {
        "attempts": 5,
        "passed": 4,
        "avgScore": 82
      }
    }
  }
}
```

**Status Codes:**
- `200` — Results retrieved
- `400` — Missing `sessionId` or `email`
- `403` — Email doesn't match session teacher
- `404` — Session not found

**Notes:**
- Simple verification: email must match `session.teacher_email`
- Returns all results for the session
- Includes summary: total attempts, pass rate, average score
- Grouped by badge slug for analytics

---

## Usage Flows

### Free Tool (Standalone)

1. **Student joins with teacher-provided code:**
   ```
   GET /api/tools/safety/session?code=ABC123
   ```

2. **Student selects a badge and starts test:**
   ```
   POST /api/tools/safety/start-test
   { "badgeSlug": "...", "studentName": "..." }
   ```

3. **Student completes and submits:**
   ```
   POST /api/tools/safety/submit-test
   { "testId": "...", "badgeSlug": "...", "answers": [...], "timeTakenSeconds": 420 }
   ```

4. **Student sees results (score, passed, feedback)**

### Teacher Session (with Class Code)

1. **Teacher creates session:**
   ```
   POST /api/tools/safety/session
   { "teacherEmail": "...", "teacherName": "...", "className": "..." }
   ```
   → Returns `classCode` (e.g., "ABC123") to share with students

2. **Teacher shares code with class**

3. **Students join and complete tests (same as above, but with optional `sessionId`)**

4. **Teacher views results:**
   ```
   GET /api/tools/safety/results?sessionId=...&email=teacher@school.com
   ```

---

## Data Models

### BadgeDefinition

```typescript
interface BadgeDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: "safety" | "skill" | "software";
  tier: number;
  color: string;
  icon_name: string;
  is_built_in: boolean;
  pass_threshold: number; // 0-100
  expiry_months: number; // null = no expiry
  retake_cooldown_minutes: number; // e.g., 60
  question_count: number;
  topics: string[];
  learn_content: LearnCard[];
  question_pool: BadgeQuestion[];
}
```

### BadgeQuestion

```typescript
interface BadgeQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "scenario" | "sequence" | "match";
  topic: string;
  prompt: string;
  image_description?: string;
  options?: string[];
  match_pairs?: Array<{ left: string; right: string }>;
  correct_answer: string | string[] | number[];
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}
```

### SafetySession (in DB)

```typescript
interface SafetySession {
  id: string; // nanoid
  class_code: string; // 6-char code
  teacher_email: string;
  teacher_name: string;
  class_name: string;
  badge_slugs: string[];
  created_at: string; // ISO timestamp
}
```

### SafetyResult (in DB)

```typescript
interface SafetyResult {
  id: string; // uuid
  test_id: string;
  session_id: string;
  student_name: string;
  badge_slug: string;
  score: number; // 0-100
  passed: boolean;
  time_taken_seconds: number;
  answers: Array<{ questionId, selected }>;
  results: Array<{ questionId, correct, explanation }>;
  created_at: string; // ISO timestamp
}
```

---

## Rate Limiting

- **Session Creation:** 5 per email per 24 hours
- **Test Retakes:** Configurable per badge (default: 60 minutes)

---

## Error Handling

All endpoints return structured error responses:

```json
{
  "error": "Human-readable error message",
  "minutesRemaining": 45
}
```

Common HTTP status codes:
- `200` — Success
- `201` — Created
- `400` — Bad request (missing fields, invalid input)
- `403` — Forbidden (email verification failed)
- `404` — Not found
- `429` — Rate limited (too many requests)
- `500` — Server error

---

## Testing

### Example cURL Commands

**Get all badges:**
```bash
curl -X GET http://localhost:3000/api/tools/safety/badges
```

**Create session:**
```bash
curl -X POST http://localhost:3000/api/tools/safety/session \
  -H "Content-Type: application/json" \
  -d '{
    "teacherEmail": "teacher@school.com",
    "teacherName": "Ms. Smith",
    "className": "Design 7A"
  }'
```

**Start test:**
```bash
curl -X POST http://localhost:3000/api/tools/safety/start-test \
  -H "Content-Type: application/json" \
  -d '{
    "badgeSlug": "general-workshop-safety",
    "studentName": "Alex Chen"
  }'
```

**Submit test:**
```bash
curl -X POST http://localhost:3000/api/tools/safety/submit-test \
  -H "Content-Type: application/json" \
  -d '{
    "testId": "test_xyz",
    "badgeSlug": "general-workshop-safety",
    "studentName": "Alex Chen",
    "answers": [
      {"questionId": "q1", "selected": "Option A"}
    ],
    "timeTakenSeconds": 300
  }'
```

**Get results:**
```bash
curl -X GET "http://localhost:3000/api/tools/safety/results?sessionId=abc123&email=teacher@school.com"
```

---

## Implementation Notes

### Built-in Badges

Currently 2 built-in badges:
1. **General Workshop Safety** (15 questions, 75% threshold)
2. **Laser Cutter Safety** (12 questions, 80% threshold)

Additional badges can be added to `BUILT_IN_BADGES` in `src/lib/safety/badge-definitions.ts`.

### Question Randomization

- Questions are shuffled before delivery to prevent cheating
- Same question pool is used for all students
- Questions are drawn without replacement per test

### Grading

- Simple string comparison for true/false and multiple choice
- Array comparison for matching/sequence questions
- Score = (correct count / total questions) × 100
- Pass threshold is per-badge (configurable)

### Authentication

- All endpoints are public — no authentication required
- Session access is via 6-character class code
- Teacher results verification uses email matching
- Optional student token authentication for badge awarding

---

## Future Enhancements

- Custom badge definitions (teacher-created)
- Question bank expansion
- Analytics dashboard (teacher portal)
- Mobile app integration
- Adaptive difficulty (questions adjust based on performance)
- Audio/video support for accessibility
- Integration with student portfolio system
