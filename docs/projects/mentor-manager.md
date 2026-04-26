# Mentor Manager — Project Plan

**Status:** Draft, awaiting PYP coordinator feedback (meeting ~early May 2026)
**Owner:** Matt
**Initial scope:** PYPX Exhibition v0 → expand to Service Learning + Personal Project later
**Estimated build:** v0 ~3–5 days (no auth changes); full version +2–3 days post Access Model v2

---

## 1. The problem (for the coordinator)

Every year the PYP team:

- recruits ~15–25 mentors from staff, parents, alumni, professionals
- pairs each Year 5/6 student with a mentor based on the student's exhibition topic
- relies on email threads, spreadsheets, and the coordinator's memory to track who said yes, who declined, who showed up, who was great, who not to invite back
- repeats this from scratch the following year because the data lives in someone's head or last year's mailbox

**Mentor Manager replaces that with a single tool.** Year-on-year continuity, no more "wait, who did Sophia have last year?".

## 2. What it does (v0)

| Section | What the coordinator does there |
|---|---|
| **Mentor pool** | One row per person ever invited. Name, email, expertise tags, year-by-year status (active / declined / maybe / do-not-contact). Search + filter by year, source, expertise. |
| **Mentor detail** | Past mentees by year + topic, coordinator's private notes ("brilliant with shy kids", "doesn't reply to email"), full contact info, languages, location, bio. |
| **Invitations** | Send "Will you mentor in 2026?" emails using the existing email system. Track sent / opened / responded. Bulk send. |
| **Pair students with mentors** | On the Exhibition setup page (already built), the mentor picker pulls from "Active for 2026" mentors instead of "all teachers". |
| **Meeting log** *(optional v0)* | Coordinator logs check-ins per pair: did it happen, how long, brief note. |

## 3. Three open questions for the coordinator

These are the highest-leverage things to decide together — much cheaper to answer in the room than refactor later.

1. **Do mentors need their own login?**
   - v0 says no — coordinator records everything (you got a "yes" by phone, you tick the box).
   - v1 says yes — mentor logs in to confirm a meeting, see their student's project, write a reflection at year-end.
   - Trade-off: v0 ships in a week; v1 needs the broader Access Model v2 work that's already on the roadmap.

2. **Who can edit the mentor pool?**
   - Just you (PYP coordinator)?
   - You + Year 5/6 teachers?
   - Anyone on the teaching staff?

3. **Year boundaries.**
   - When does someone become a "2026 mentor" vs a "2025 mentor"? Opt-in per year, or active until they explicitly opt out?
   - Does an "active" mentor in 2026 stay visible in 2027 by default, or do you want a clean slate every year?

## 4. What's NOT in v0

Deliberately scoped out for the coordinator demo. These all become viable post Access Model v2:

- Mentor login / self-service (decline / accept invitations via web)
- Student-facing mentor profile (student dashboard shows their mentor's bio + next meeting)
- Auto-pairing / matching algorithm
- Mentor reflections / end-of-year survey
- SMS / WeChat invitations (email only via Resend in v0)
- Calendar integration

---

## Engineering appendix

### Data model sketch

```sql
-- mentors: long-lived person records
CREATE TABLE mentors (
  id              UUID PK,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE,
  phone           TEXT,
  source          TEXT,             -- 'parent' | 'alumni' | 'staff' | 'community'
  expertise_tags  TEXT[],
  bio             TEXT,
  affiliation     TEXT,             -- "Johnson & Johnson", "Year 5 parent of Lily Chen", etc.
  languages       TEXT[],
  preferred_contact TEXT,           -- 'email' | 'wechat' | 'phone'
  do_not_contact  BOOLEAN DEFAULT FALSE,
  status_by_year  JSONB,            -- { "2026": "active", "2025": "declined", "2024": "active" }
  internal_notes  TEXT,             -- coordinator-private
  created_at, updated_at
);

-- mentor_assignments: mentor ↔ student_project per year
CREATE TABLE mentor_assignments (
  id                 UUID PK,
  mentor_id          UUID FK mentors,
  student_project_id UUID FK student_projects,
  year               INT,
  status             TEXT,          -- 'proposed' | 'accepted' | 'declined' | 'completed'
  topic_summary      TEXT,
  coordinator_notes  TEXT,
  created_at, updated_at
);

-- mentor_meetings: meeting log per assignment
CREATE TABLE mentor_meetings (
  id            UUID PK,
  assignment_id UUID FK,
  scheduled_at  TIMESTAMPTZ,
  met           BOOLEAN,
  duration_min  INT,
  notes         TEXT,
  created_at
);

-- mentor_invitations: outbound email log
CREATE TABLE mentor_invitations (
  id              UUID PK,
  mentor_id       UUID FK,
  year            INT,
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  response        TEXT,            -- 'yes' | 'no' | 'maybe'
  reminder_count  INT
);
```

RLS: teacher full CRUD on all tables; service role bypass for email-send pipeline.

### Auth strategy

- **v0 (no auth changes):** coordinator-only via existing teacher auth. Mentors are passive records — the coordinator manually records every interaction. Unblocks the demo, gets real usage feedback. **Buildable in 3–5 days.**
- **v1 (post Access Model v2 — FU-O/P/R cluster):** mentors get accounts via the planned `community_members` polymorphic auth seam. Mentors log in to confirm meetings, see their student's project, write reflections. Students see their mentor's profile. **+2–3 days on top of Access Model v2 landing.**

### Relationship to `school_resources`

The Access Model v2 spec includes a polymorphic `school_resources` table for "people, places, things". Mentor Manager is the **first concrete consumer** of the people-resource schema. Build standalone (`mentors` table) for v0; when `school_resources` lands, migrate by treating `mentors` as a typed view over `school_resources` with a `mentors_resource_id` FK.

Same pattern as Activity Blocks: ship the consumer that proves the shape, then extract the abstraction.

### Existing dependencies

- `student_projects.mentor_teacher_id` (migration 115) — currently FK to `teachers.id`. Backward-compat for staff-mentors. Add a sibling `mentor_id` FK to `mentors` later, OR collapse to a single polymorphic `mentor_ref` (mentor_type + mentor_id) when Access Model v2 lands.
- Resend email helper (already wired for fab-scanner notifications) — reusable for invitations with no new vendor work.
- Existing email opt-out preference on students table — extend pattern to mentors (`do_not_contact` column).

### Build phases (v0)

| Phase | Scope | Days |
|---|---|---|
| 0 | Migration: 4 tables + RLS + indexes | 0.5 |
| 1 | API routes (CRUD + send-invitation) | 0.5 |
| 2 | `/teacher/mentors` pool view + add/edit modal | 1 |
| 3 | Mentor detail page (history, notes, invite button) | 0.5 |
| 4 | Wire mentor picker on Exhibition setup → active mentors | 0.5 |
| 5 | Optional: meetings log + bulk invite | 1 |

**Total: 3–5 days.**

### Don't build before the meeting

Walk into the meeting with this spec + a clickable mockup (Claude design prompt is below — feeds into claude.ai). **Don't build before the meeting.** The coordinator will have strong opinions about workflow that are cheaper to get right by sketching together than to refactor after the fact.

After the meeting → cut a `mentor-manager-build` worktree, follow the build-methodology pre-flight ritual, ship Phases 0–4 in 3–4 days.

### Post-build hooks

Once shipped, Mentor Manager unlocks:

- **Service Learning** consumer — same data model, different program. Just needs a "program" filter on the pool.
- **Personal Project** consumer — supervisor pairs are structurally identical.
- **Open Studio v2** — the mentor-pool side of community-resource lookup for student projects.
- **`school_resources` extraction** — when a 2nd or 3rd consumer surfaces, the abstraction earns its keep.
