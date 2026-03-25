# Quest Journey API Routes

Core API routes for the StudioLoom quest journey system. All student routes use token-based session auth (`requireStudentAuth`). All routes return `NextResponse.json()` with appropriate HTTP status codes.

## Route Structure

```
/api/student/quest/
├── route.ts              — Journey CRUD (GET/POST)
├── phase/route.ts        — Phase transitions (POST)
├── mentor/route.ts       — Mentor selection & AI interactions (PATCH/POST)
└── evidence/route.ts     — Evidence CRUD (GET/POST)
```

## Routes

### `GET /api/student/quest?unitId=...`
Fetch student's quest journey for a unit.

**Query params:**
- `unitId` (required) — unit to fetch journey for

**Response:**
```json
{
  "journey": { QuestJourney } | null,
  "milestones": [{ QuestMilestone }],
  "evidence": [{ QuestEvidence }]
}
```

Returns empty arrays if journey doesn't exist yet.

---

### `POST /api/student/quest`
Create a new quest journey for a unit.

**Rate limit:** 5 per minute, 50 per hour

**Body:**
```json
{
  "unitId": "string",
  "frameworkId": "string",
  "classId": "string?" // optional, falls back to student's class
}
```

**Responses:**
- `201` — Journey created: `{ "journey": { QuestJourney } }`
- `400` — Missing unitId or frameworkId
- `409` — Journey already exists for this unit

---

### `POST /api/student/quest/phase`
Advance quest journey to next phase.

**Rate limit:** 10 per minute

**Body:**
```json
{
  "journeyId": "string",
  "targetPhase": "discovery" | "planning" | "working" | "sharing" | "completed"
}
```

**Responses:**
- `200` — Phase advanced: `{ "journey": { QuestJourney } }`
- `400` — Invalid transition (e.g., can't skip phases)
- `404` — Journey not found

**Phase machine:** Transitions must follow the linear path:
`not_started` → `discovery` → `planning` → `working` → `sharing` → `completed`

---

### `PATCH /api/student/quest/mentor`
Select a mentor for the quest journey.

**Body:**
```json
{
  "journeyId": "string",
  "mentorId": "kit" | "sage" | "river" | "spark" | "haven"
}
```

**Responses:**
- `200` — Mentor selected: `{ "journey": { QuestJourney } }`
- `400` — Invalid mentorId
- `404` — Journey not found
- `409` — Mentor already selected (can only select once)

---

### `POST /api/student/quest/mentor`
Send message to mentor (AI interaction).

Calls Claude Haiku with phase-specific context from journey, milestones, and recent evidence. Uses `buildQuestPrompt` for system prompt construction.

**Rate limit:** 15 per minute, 100 per hour

**Body:**
```json
{
  "journeyId": "string",
  "message": "string?",
  "interactionType": "discovery_step" | "check_in" | "help_request" | "drift_check" | "documentation_nudge" | "alignment_check" | "milestone_review" | "celebration" | "contract_coaching" | "planning_help"
}
```

**Responses:**
- `200` — `{ "response": "string", "interaction": { QuestMentorInteraction } }`
- `404` — Journey not found

**Note:** `message` is optional (empty string if triggering interaction type directly).

---

### `GET /api/student/quest/evidence?journeyId=...`
List evidence for a journey.

**Query params:**
- `journeyId` (required) — journey to fetch evidence for
- `milestoneId` (optional) — filter by specific milestone

**Response:**
```json
{
  "evidence": [{ QuestEvidence }]
}
```

---

### `POST /api/student/quest/evidence`
Submit new evidence for a journey.

Evidence defaults to `approved_by_teacher = false`. Teacher must explicitly approve for portfolio inclusion.

**Rate limit:** 20 per minute

**Body:**
```json
{
  "journeyId": "string",
  "milestoneId": "string?",
  "type": "photo" | "voice" | "text" | "file" | "link" | "reflection" | "tool_session" | "ai_conversation",
  "content": "string?",        // for text, reflection, link
  "fileUrl": "string?",        // for file, photo, voice, tool_session, ai_conversation
  "fileType": "string?"        // e.g. "image/jpeg", "audio/webm"
}
```

**Responses:**
- `201` — Evidence created: `{ "evidence": { QuestEvidence } }`
- `400` — Missing journeyId or type
- `404` — Journey not found

---

## Auth Pattern

All routes use `requireStudentAuth(request)`:

```typescript
const auth = await requireStudentAuth(request);
if (auth.error) return auth.error;
const studentId = auth.studentId;
```

Returns `{ studentId }` on success or `{ error: NextResponse }` on failure (401 Unauthorized).

Students authenticate via `SESSION_COOKIE_NAME` cookie → `student_sessions` table → `student_id`. This is **not** Supabase Auth — it's a custom token system using nanoid(48) tokens with 7-day TTL.

---

## Rate Limiting

All routes use the `rateLimit(key, windows[])` utility:

```typescript
await rateLimit(`quest-create:${studentId}`, [
  { windowMs: 60_000, max: 5 },      // 5 per minute
  { windowMs: 3_600_000, max: 50 },  // 50 per hour
]);
```

Returns 429 Too Many Requests if limit exceeded.

---

## Error Responses

All endpoints follow these patterns:

```json
{ "error": "string" }  // with status code (400, 401, 404, 409, 500)
```

**Common status codes:**
- `200` — Success (with data)
- `201` — Created
- `400` — Bad request (missing params, invalid values)
- `401` — Unauthorized (invalid/expired session)
- `404` — Not found (journey, mentor, etc.)
- `409` — Conflict (duplicate, already exists)
- `500` — Server error (database, AI API, etc.)

---

## Database Tables

Routes interact with these Supabase tables:

- `quest_journeys` — Main journey records
- `quest_milestones` — Milestones within a journey
- `quest_evidence` — Evidence submissions
- `quest_mentor_interactions` — AI interaction logs
- `student_sessions` — Auth tokens

All tables use `createAdminClient()` (service role) to bypass RLS for auth table operations.

---

## AI Integration (Mentor Route)

The mentor route calls Claude Haiku:
- **Model:** `claude-haiku-4-5-20251001`
- **Max tokens:** 400
- **Rate limit:** 15/min, 100/hr per student

System prompt is built dynamically by `buildQuestPrompt()` which includes:
- Current journey phase
- Recent milestones
- Recent evidence
- Interaction type rules
- Student message context

---

## Usage Examples

### Create a quest journey
```bash
POST /api/student/quest
{
  "unitId": "unit-123",
  "frameworkId": "ib-myp",
  "classId": "class-456"
}
```

### Fetch journey + milestones + evidence
```bash
GET /api/student/quest?unitId=unit-123
```

### Advance to planning phase
```bash
POST /api/student/quest/phase
{
  "journeyId": "journey-789",
  "targetPhase": "planning"
}
```

### Select mentor
```bash
PATCH /api/student/quest/mentor
{
  "journeyId": "journey-789",
  "mentorId": "kit"
}
```

### Ask mentor for help
```bash
POST /api/student/quest/mentor
{
  "journeyId": "journey-789",
  "message": "I'm stuck on how to start my prototype",
  "interactionType": "help_request"
}
```

### Submit evidence
```bash
POST /api/student/quest/evidence
{
  "journeyId": "journey-789",
  "milestoneId": "milestone-111",
  "type": "reflection",
  "content": "Today I learned that prototyping with cardboard is faster than CAD..."
}
```
