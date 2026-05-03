# Student Data Export Runbook (Manual SQL Stopgap)

**Status:** SKELETON — Phase 5.0 scaffold; full SQL queries land in Phase 5.4.
**Audit reference:** F32 stopgap. Documented procedure for the case where the
`/api/v1/student/[id]/export` endpoint is unavailable when a DSR (Data Subject
Request — FERPA / GDPR / PIPL) lands.
**Last updated:** 3 May 2026 PM CST (skeleton).

---

## When to use this runbook

Use the API endpoint by default:

```
GET /api/v1/student/[id]/export
Authorization: Bearer <teacher-or-admin-token>
```

Use this manual runbook ONLY when:

1. The endpoint is broken / failing in production (e.g. mid-migration), AND
2. A DSR has a legal deadline (GDPR: 30 days from request; PIPL: similar; FERPA: 45 days).

In any other case, prefer the endpoint — it's RLS-checked, audited, and complete.

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
    jsonb_build_object('dsr_id', '<ticket-or-email-ref>', 'reason', '<short-reason>'),
    'warn'
  );
  ```

---

## SQL queries

**TODO — Phase 5.4 fills these in.** Each query produces a JSON-able resultset
matching the `/api/v1/student/[id]/export` response shape.

Sections (placeholder — full queries in Phase 5.4):

1. Student core: `SELECT * FROM students WHERE id = $1`
2. Enrollments: `SELECT * FROM class_students WHERE student_id = $1`
3. Tool sessions: `SELECT * FROM student_tool_sessions WHERE student_id = $1`
4. Submissions / portfolio entries
5. AI conversations + budget state
6. Audit events (as actor and as target)
7. Onboarding profile / learning profile
8. Any other tables flagged `pii: 'student_pii' | 'student_voice' | 'student_generated'`
   in `docs/data-classification-taxonomy.md`

Assemble into a single JSON file:
```bash
{
  "student_id": "...",
  "exported_at": "<ISO timestamp>",
  "exported_by": "<platform_admin id>",
  "sections": { ... }
}
```

---

## Post-export

- [ ] File the exported JSON in the DSR ticket folder.
- [ ] Email the requesting party with the file attached, encrypted at rest in the channel of their choice.
- [ ] Insert a follow-up `audit_events` row with `action='student.data_export.delivered'`.
- [ ] If the export was used because the API was down, file `FU-AV2-EXPORT-API-DEGRADED-{date}` and prioritise fix.

---

## Quarterly verification

Run the runbook against a test student record once per quarter to confirm queries
still work after schema drift. Log result in `docs/security/runbook-verifications.md`
(create on first verification).

Next verification due: **first run after Phase 5.4 ships full queries.**
