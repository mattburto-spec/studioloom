# Student Data Export Runbook (Manual SQL Stopgap)

**Status:** v1 — fleshed out 3 May 2026 PM (Phase 5.4).
**Audit reference:** F32 stopgap. Documented procedure for the case where the
`/api/v1/student/[id]/export` endpoint is unavailable when a DSR (Data Subject
Request — FERPA / GDPR / PIPL) lands.
**Endpoint:** `GET /api/v1/student/[id]/export` (Phase 5.4).

---

## When to use this runbook

Use the API endpoint by default:

```
GET /api/v1/student/[id]/export
Cookie: <teacher or admin session>
```

Use this manual runbook ONLY when:

1. The endpoint is broken / failing in production (e.g. mid-migration), AND
2. A DSR has a legal deadline (GDPR: 30 days from request; PIPL: similar; FERPA: 45 days).

In any other case, prefer the endpoint — it's RLS-checked, audited, and complete.

The runbook covers the same 12 sections as the v1 endpoint manifest plus the
sections explicitly excluded from v1 (FU-AV2-EXPORT-COMPLETE-COVERAGE P2).

---

## Pre-checks (before running queries)

- [ ] DSR is verified — request comes from the legal student / parent / authorized representative.
- [ ] Student ID resolved and confirmed (full UUID + display name + class enrollment).
- [ ] `audit_events` row recorded BEFORE running the queries:
  ```sql
  INSERT INTO audit_events (actor_id, actor_type, action, target_table, target_id, payload_jsonb, severity)
  VALUES (
    '<your-platform-admin-user-id>',
    'platform_admin',
    'student.data_export.manual_runbook_invoked',
    'students',
    '<student-id>',
    jsonb_build_object(
      'dsr_id', '<ticket-or-email-ref>',
      'reason', '<why-runbook-instead-of-endpoint>'
    ),
    'warn'
  );
  ```

---

## SQL queries

Run each block as a separate query in Supabase SQL Editor. Save each result
set as a section of the final JSON. The endpoint produces an equivalent
shape: `{ student_id, exported_at, schema_version: 1, sections: { ... } }`.

### Section 1 — `student` (core record)
```sql
SELECT * FROM students WHERE id = '<student-id>';
```

### Section 2 — `enrollments` (class memberships)
```sql
SELECT * FROM class_students WHERE student_id = '<student-id>';
```

### Section 3 — `ai_budget_state` (token usage record)
```sql
SELECT * FROM ai_budget_state WHERE student_id = '<student-id>';
```

### Section 4 — `progress` (lesson progress)
```sql
SELECT * FROM student_progress WHERE student_id = '<student-id>';
```

### Section 5 — `tool_sessions` (toolkit work)
```sql
SELECT * FROM student_tool_sessions WHERE student_id = '<student-id>';
```

### Section 6 — `assessments` (grades + feedback)
```sql
SELECT * FROM assessment_records WHERE student_id = '<student-id>';
```

### Section 7 — `competency_assessments` (Melbourne Metrics observations)
```sql
SELECT * FROM competency_assessments WHERE student_id = '<student-id>';
```

### Section 8 — `gallery_submissions` (peer review)
```sql
SELECT * FROM gallery_submissions WHERE student_id = '<student-id>';
```

### Section 9 — `portfolio_entries`
```sql
SELECT * FROM portfolio_entries WHERE student_id = '<student-id>';
```

### Section 10 — `design_conversations` (Socratic mentor conversations)
```sql
SELECT * FROM design_conversations WHERE student_id = '<student-id>';
```

### Section 11 — `design_conversation_turns` (per-turn content of conversations)
```sql
SELECT t.*
FROM design_conversation_turns t
JOIN design_conversations c ON c.id = t.conversation_id
WHERE c.student_id = '<student-id>';
```

### Section 12 — `audit_events` (the student as actor + as target)
```sql
SELECT * FROM audit_events
WHERE actor_id = '<student-id>'
   OR (target_table = 'students' AND target_id = '<student-id>')
ORDER BY created_at DESC;
```

---

## Excluded from v1 endpoint (FU-AV2-EXPORT-COMPLETE-COVERAGE P2)

The following tables also reference the student. They are NOT in the v1
endpoint manifest — include them in a manual export when the DSR scope
requires full coverage.

```sql
-- Quest Engine (Discovery / journey tracking)
SELECT * FROM quest_journeys WHERE student_id = '<student-id>';
SELECT m.* FROM quest_milestones m JOIN quest_journeys j ON j.id = m.journey_id WHERE j.student_id = '<student-id>';
SELECT e.* FROM quest_evidence e JOIN quest_journeys j ON j.id = e.journey_id WHERE j.student_id = '<student-id>';
SELECT i.* FROM quest_mentor_interactions i JOIN quest_journeys j ON j.id = i.journey_id WHERE j.student_id = '<student-id>';

-- Discovery Engine
SELECT * FROM discovery_sessions WHERE student_id = '<student-id>';

-- Open Studio (self-directed mode)
SELECT * FROM open_studio_profiles WHERE student_id = '<student-id>';
SELECT * FROM open_studio_sessions WHERE student_id = '<student-id>';
SELECT * FROM open_studio_status WHERE student_id = '<student-id>';
SELECT * FROM planning_tasks WHERE student_id = '<student-id>';
SELECT * FROM student_projects WHERE student_id = '<student-id>';

-- Badges + safety certifications
SELECT * FROM student_badges WHERE student_id = '<student-id>';
SELECT * FROM safety_certifications WHERE student_id = '<student-id>';
SELECT * FROM skill_quiz_attempts WHERE student_id = '<student-id>';

-- Learning analytics
SELECT * FROM learning_events WHERE student_id = '<student-id>';
SELECT * FROM ai_usage_log WHERE student_id = '<student-id>';

-- Preflight (fabrication submissions)
SELECT * FROM fabrication_jobs WHERE student_id = '<student-id>';

-- Safety / moderation
SELECT * FROM student_content_moderation_log WHERE student_id = '<student-id>';

-- Mentorship relationships
SELECT * FROM student_mentors WHERE student_id = '<student-id>';

-- Bug reports authored by the student (if any)
SELECT * FROM bug_reports WHERE author_user_id = '<student-id>';
```

---

## Final JSON assembly

Pipe each query's result through `jsonb_agg` if running in psql:

```sql
SELECT jsonb_build_object(
  'student_id', '<student-id>',
  'exported_at', now()::text,
  'schema_version', 1,
  'extraction_method', 'manual_sql_runbook',
  'sections', jsonb_build_object(
    'student', (SELECT to_jsonb(s) FROM students s WHERE id = '<student-id>'),
    'enrollments', (SELECT jsonb_agg(to_jsonb(cs)) FROM class_students cs WHERE student_id = '<student-id>'),
    'ai_budget_state', (SELECT to_jsonb(b) FROM ai_budget_state b WHERE student_id = '<student-id>'),
    'progress', (SELECT jsonb_agg(to_jsonb(p)) FROM student_progress p WHERE student_id = '<student-id>'),
    'tool_sessions', (SELECT jsonb_agg(to_jsonb(t)) FROM student_tool_sessions t WHERE student_id = '<student-id>'),
    'assessments', (SELECT jsonb_agg(to_jsonb(a)) FROM assessment_records a WHERE student_id = '<student-id>'),
    'competency_assessments', (SELECT jsonb_agg(to_jsonb(c)) FROM competency_assessments c WHERE student_id = '<student-id>'),
    'gallery_submissions', (SELECT jsonb_agg(to_jsonb(g)) FROM gallery_submissions g WHERE student_id = '<student-id>'),
    'portfolio_entries', (SELECT jsonb_agg(to_jsonb(p)) FROM portfolio_entries p WHERE student_id = '<student-id>'),
    'design_conversations', (SELECT jsonb_agg(to_jsonb(d)) FROM design_conversations d WHERE student_id = '<student-id>'),
    'design_conversation_turns', (
      SELECT jsonb_agg(to_jsonb(t))
      FROM design_conversation_turns t
      JOIN design_conversations c ON c.id = t.conversation_id
      WHERE c.student_id = '<student-id>'
    ),
    'audit_events', (
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC)
      FROM audit_events e
      WHERE actor_id = '<student-id>'
         OR (target_table = 'students' AND target_id = '<student-id>')
    )
  )
);
```

---

## Post-export

- [ ] File the exported JSON in the DSR ticket folder.
- [ ] Email the requesting party with the file attached, encrypted at rest in the channel of their choice.
- [ ] Insert a follow-up `audit_events` row:
  ```sql
  INSERT INTO audit_events (actor_id, actor_type, action, target_table, target_id, payload_jsonb, severity)
  VALUES (
    '<your-platform-admin-user-id>',
    'platform_admin',
    'student.data_export.delivered',
    'students',
    '<student-id>',
    jsonb_build_object('dsr_id', '<ticket-ref>', 'delivery_method', '<email | secure-share>'),
    'warn'
  );
  ```
- [ ] If the export was used because the API was down, file
  `FU-AV2-EXPORT-API-DEGRADED-{date}` and prioritise fix.

---

## Quarterly verification

Run the runbook against a test student record once per quarter to confirm
queries still work after schema drift. Log result in
`docs/security/runbook-verifications.md` (create on first verification).

Next verification due: **first week of August 2026** (one quarter after Phase
5.4 ships).

---

## Schema drift watchlist

Sections likely to add new tables (extend the runbook when these features land):

- **Student Dashboard v2** — any `dashboard_*` student-state tables.
- **Open Studio v2** — `open_studio_plans` (per spec).
- **Journey Engine consumers** — per-journey state tables.
- **Notes system** (FU from Student Dashboard v2 build) — student + teacher notes.

The endpoint manifest (`STUDENT_DATA_SECTIONS` in
`src/lib/access-v2/data-subject/export-student.ts`) is the source of truth
for the v1 endpoint. This runbook should track 1:1 plus the excluded list.
