# StudioLoom Ship-Ready Build Plan
> **Goal:** Get students into StudioLoom. Another teacher (not Matt) can create a class, assign a unit, and have students working through lessons with AI mentoring.
>
> Created: 15 April 2026
> Status: NOT STARTED

---

## Phase 1: Ship-Ready (3-4 weeks)

### 1A. Declare Dimensions3 Done (0 days)
- Mark Dimensions3 complete in ALL-PROJECTS.md
- The pipeline works, admin dashboard works — remaining polish is backlog, not blockers
- Status: **COMPLETE** (15 Apr 2026)

### 1B. Teacher Onboarding Flow (3-4 days)
Pilot teachers are **invited personally by Matt** (self-signup removed 15 Apr 2026 — `/teacher/login` is login-only now; new accounts created manually via Supabase Auth dashboard). The flow they need after first login:
- **Welcome flow** — first-login detector (`teachers.onboarded_at` NULL) redirects to `/teacher/welcome`. 4 steps: name → first class (name + framework + period length) → roster paste (names/usernames, bulk-create into `class_students`) → "your class code is X, here are credentials to hand out".
- **Pre-built unit library** — `studioloom content/` doesn't yet contain classroom-tested units. **Deferred to Phase 2C (Skills Library).** For 1B: offer "Generate your first unit with AI" as the starter path (wizard already works) + "Start with a blank unit" fallback.
- **Student credentials view** — printable page listing `class code + student username` list so the teacher can distribute. The student-login path (classCode + username, no email/password) already works via `/api/auth/student-login` — just needs the teacher-facing distribution UI.
- **Success metric:** New teacher (fresh Supabase invite) → first student doing a lesson in under 15 minutes.
- **Decisions locked (15 Apr 2026):**
  - (1) Signup: **invite-only, removed self-signup** ✅ done
  - (2) Library: **deferred to 2C** (no real units to seed)
  - (3) Student model: **teacher creates rows, distributes classCode + username, no email/password** (current behaviour confirmed)
  - (4) Co-teacher: **out of scope** (stays in 1E)
- Status: **COMPLETE** (15 Apr 2026)
  - Migration 083 (`teachers.onboarded_at`) APPLIED to prod
  - Migration 084 (FK cascade fixes for `auth.admin.deleteUser()`) APPLIED to prod — 10 FKs now CASCADE or SET NULL, 2 sanity asserts pass
  - 3 welcome APIs live: `/api/teacher/welcome/create-class`, `/add-roster`, `/complete`
  - 4-step `/teacher/welcome` wizard (name → class → roster → credentials) with starter-path CTAs (Generate with AI / Explore dashboard)
  - Teacher layout redirect on first login (`onboarded_at IS NULL` → `/teacher/welcome`)
  - Branded Supabase auth email templates — invite, confirm-signup, magic-link, reset-password (in `supabase/email-templates/`, pasted into Supabase Dashboard 15 Apr 2026)
  - Admin remove-teacher flow working (guards: no teacher deletion when units/classes > 0, cascade FKs handle the rest)

### 1C. Content Safety Teacher Controls (4-5 days)
Backend exists (Phase 5 content safety, Haiku moderation, NSFW scanning). Missing for pilot:
- **Teacher-facing safety dashboard** — view flagged content, review student AI interactions. `/teacher/safety/alerts` exists from Phase 6A but needs testing with real data.
- **Moderation settings** — teacher can adjust sensitivity per class (strict for younger students)
- **Parent-safe audit trail** — if a parent asks "what did the AI say to my child?", teachers need to show them
- **Depends on:** Nothing — can start immediately
- Status: **NOT STARTED**

### 1D. Auth Bridge (FU-R Minimum) (3-4 days)
Don't rewrite auth. Build the bridge library:
- `getAuthenticatedUser()` → returns `{kind: 'teacher'|'student', id, metadata}`
- Wire into 6 cross-role features (gallery, peer review, bug reports, safety alerts)
- Unblocks co-teacher support later without touching Supabase Auth
- **Depends on:** Nothing — can start immediately
- Status: **NOT STARTED**

### 1E. Co-Teacher Support (FU-O Minimum) (5-6 days)
Department head needs to see what their teachers are doing. Minimum viable:
- **`class_memberships` table** — `(class_id, user_id, role)` where role ∈ {owner, co_teacher, viewer}
- **Rewrite RLS on 8 most-used tables** — classes, units, class_units, students, class_students, student_progress, moderation_logs, lessons. NOT all 34 — just the critical path.
- **"Add co-teacher" button on class settings** — simple email invite
- **Test:** Two teachers see the same class, both can view student progress
- **Depends on:** 1D (auth bridge)
- Status: **NOT STARTED**

### 1F. Polish & Deploy Check (2 days)
- End-to-end walkthrough as fresh teacher: sign up → create class → assign unit → generate join code → student joins → student does lesson → teacher sees progress
- Fix whatever breaks
- Verify studioloom.org loads correctly, SSL works, Supabase connection stable
- **Depends on:** 1B-1E complete
- Status: **NOT STARTED**

---

## Phase 2: Pilot Sprint (2-3 weeks)

### 2A. Recruit Pilot Teachers (ongoing, starts during Phase 1)
- 3-5 MYP Design teachers Matt knows personally
- Offer free access for a term
- Set up shared Slack/WeChat group for feedback
- Status: **NOT STARTED**

### 2B. Student Learning Profile — Quick Unblock (2-3 days)
Intake survey exists (migration 048, API route, JSONB column). Extend:
- One computed dimension: design confidence → scaffolding tier (low/medium/high)
- Wire into AI mentoring — Haiku reads scaffold tier and adjusts response complexity
- ~15% of full SLP Phase A but delivers core value proposition
- **Depends on:** 1F complete
- **Existing code:** `learning_profile` JSONB on students table, `/api/student/learning-profile/` routes
- Status: **NOT STARTED**

### 2C. Skills Library — Quick Unblock (3-4 days)
`knowledge_items` table exists with full search infrastructure. Build teacher UX:
- "Save to Library" button on unit page
- Teacher library page to browse/tag/search their resources
- Link resources to units so students see them in Open Studio
- Skip capability-gap surfacing — just make library browseable
- **Depends on:** 1F complete
- **Existing code:** `knowledge_items` table (migration 017), `/teacher/library/` pages, `/admin/library/` browser
- Status: **NOT STARTED**

### 2D. School Entity (FU-P Minimum) (3-4 days)
Needed before selling to a school:
- `schools` table — `(id, name, domain, framework_default)`
- `school_memberships` — `(school_id, user_id, role)` where role ∈ {admin, teacher}
- Add nullable `school_id` to `classes`
- School admin page: see all classes across the school
- "Create school" flow in onboarding
- **Depends on:** 1E (co-teacher support)
- Status: **NOT STARTED**

### 2E. Feedback Loop (ongoing)
- Weekly check-in with pilot teachers
- Track: what features do they actually use? What breaks? What do they ask for?
- **This data determines Phase 3.** Don't plan Phase 3 until you have it.
- Status: **NOT STARTED**

---

## Weekly Schedule

| Week | Tasks | Milestone |
|------|-------|-----------|
| **1** | 1A (declare D3 done) + 1B (teacher onboarding) + 1C (safety controls) | New teacher can sign up and assign a unit |
| **2** | 1D (auth bridge) + 1E start (class_memberships migration + RLS) | Cross-role features work |
| **3** | 1E finish (co-teacher UI) + 1F (polish + deploy check) | Co-teacher tested, end-to-end flow verified |
| **4** | 2A (recruit pilots) + 2B (SLP quick unblock) + 2C (skills library) | AI adapts to student profile, library browseable |
| **5** | 2D (school entity) + pilot onboarding | First non-Matt teachers using the platform |
| **6+** | 2E (feedback loop) — fix what real users find | Data-driven roadmap |

---

## What NOT to Build (Until Pilot Feedback Says Otherwise)

- ❌ More admin dashboard polish
- ❌ More governance scanners or registries
- ❌ Dimensions3 Phase 7 remaining stubs
- ❌ Full SLP Phase A (11 days) — do the 2-day quick unblock instead
- ❌ Discovery Engine polish
- ❌ 3D Elements
- ❌ Gamification / student levels
- ❌ CompliMate, Seedlings, or any other project
- ❌ Any parked project

Everything stays in backlog until real teacher feedback says it matters.

---

## Key Dependencies

```
1A (declare D3 done)
  └─ no deps

1B (onboarding) ──────────────────┐
1C (safety controls) ─────────────┤
1D (auth bridge) ─── 1E (co-teacher) ─── 1F (polish)
                                                │
                     2A (recruit)               │
                                                │
                     2B (SLP) ──────────────────┘
                     2C (skills library) ───────┘
                     2D (school entity) ← 1E
                     2E (feedback loop) ← pilots live
```

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 15 Apr 2026 | Dimensions3 declared done — stop polishing | Pipeline works, admin works, no customers using it |
| 15 Apr 2026 | Auth bridge over auth rewrite | 3-4 days vs weeks; unblocks co-teacher without risk |
| 15 Apr 2026 | RLS rewrite on 8 tables only | Full 34-table rewrite is weeks; 8 covers the critical path |
| 15 Apr 2026 | SLP quick unblock (2d) over full Phase A (11d) | One dimension is enough to demo adaptive scaffolding |
| 15 Apr 2026 | Skills library UX over capability-gap engine | Teachers need to see their content; gap analysis can wait |
| 15 Apr 2026 | CompliMate + Seedlings deferred | Students in StudioLoom first, then other projects |
