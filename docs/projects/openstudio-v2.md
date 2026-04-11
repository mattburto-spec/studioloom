# Project: Open Studio v2 — Mentor-Guided Project Planning
*The Journey Engine's first complex consumer — where a mentor negotiates a real project plan with a real student.*

**Created:** 6 April 2026
**Status:** READY — spec complete, depends on Journey Engine
**Depends on:** Journey Engine (§§2-5, rendering modes, branching), Dimensions3 (Block Library for MiniSkills/resources), Timetable & Scheduling (semester dates, session counts)
**Companion docs:** `docs/specs/journey-engine-spec.md` (engine), `docs/open studio/open-studio-experience-design.md` (Phase 2-4 experience design), `docs/open studio/open-studio-spec.md` (v1 mechanism)
**Sibling project:** [`open-studio-mode.md`](open-studio-mode.md) — specs the **runtime studio experience** after planning (desk view, three-touch pattern, reflection drawer, critic corner, escalation ladder). v2 negotiates the plan; Mode is where the work happens. Build Open Studio Mode ⇒ must read v1 + v2 + Mode together.
**Supersedes:** `docs/projects/openstudio.md` (v2 idea doc — absorbed into this spec)

---

## 1. What This Is

Open Studio v1 is "do your thing and I'll check on you." It works, but the moment between "teacher unlocks you" and "you're productively working" is a cliff. Students hear "you can do anything" and freeze, or they start something wildly unrealistic, or they pick something safe and boring.

Open Studio v2 adds a **Mentor-Guided Planning Journey** — a structured conversation where the AI mentor helps each student figure out their project, timeframe, deliverables, milestones, knowledge gaps, and resources. The mentor doesn't just collect data (that's Discovery's job). The mentor **negotiates** — pushing back on unrealistic timelines, challenging vague goals, suggesting MiniSkill lessons for knowledge gaps, and producing an actionable plan that the teacher reviews before the student begins working.

This is the Journey Engine's first complex consumer. Where Discovery collects a profile through card sorts and sliders, the Planning Journey requires Sonnet-level reasoning at multiple points: evaluating whether a student's proposed timeline is realistic given their remaining sessions, identifying which knowledge gaps could be filled with existing MiniSkill blocks versus which need teacher intervention, and synthesizing all constraints into a coherent plan the teacher can approve with one click.

---

## 2. Why This Is a Separate Project

The Journey Engine provides: block types, rendering, branching, state machine, profile read/write, lesson editor integration.

This project adds:

1. **External data injection** — teacher-set parameters (semester end date, minimum check-ins, student capability level, unlock conditions) flow into the journey as live constraints the mentor reasons about
2. **Sonnet-level reasoning blocks** — journey blocks where the AI doesn't just reflect on student input but actively evaluates, challenges, and synthesizes. These require custom prompt engineering beyond template reactions
3. **Negotiation dynamics** — the mentor must push back, not just acknowledge. "You said you'll build a full app in 4 sessions — let's be honest about what's possible" is fundamentally different from "Great choice!" This requires a distinct AI interaction pattern not covered by the Journey Engine's standard block types
4. **Teacher approval workflow** — the journey produces a plan that enters a review queue. The teacher approves, modifies, or sends back with notes. The student can't start working until the plan is approved. This is a new system interaction, not just profile data
5. **Adaptive scaffolding recommendations** — based on the student's profile + plan, the system suggests specific MiniSkill blocks or resources. These suggestions require cross-referencing the Block Library, the student's `learning_profile`, and the teacher's available resources
6. **Ongoing plan tracking** — the plan isn't fire-and-forget. Milestones feed into check-in journeys during the Working phase. The mentor references the plan during drift detection. Session-over-session progress data flows back into the plan's health score

---

## 3. The Planning Journey — Detailed Flow

### 3.1 Teacher Setup (before student sees anything)

When a teacher unlocks Open Studio for a student (or a group), they set parameters that become journey constraints:

| Parameter | Source | How the Mentor Uses It |
|-----------|--------|----------------------|
| **Semester/term end date** | School Calendar (migration 037) | Calculates remaining sessions. "You have 12 sessions — that's roughly 8 hours of working time." |
| **Remaining Open Studio sessions** | Timetable cycle engine + class_units schedule | Hard constraint on planning. The mentor cannot approve a plan that requires more sessions than available. |
| **Minimum teacher check-ins** | Teacher sets per student (e.g., 3 for capable students, 6 for those needing support) | Built into milestone plan. "Your teacher wants to see you at least [N] times — let's schedule those as milestones." |
| **Student capability tier** | Teacher sets: `autonomous` / `supported` / `scaffolded` | Controls mentor pushback intensity and scaffolding suggestions. `scaffolded` students get more structured prompts, shorter planning segments, more concrete deliverable suggestions. |
| **Unit context** | Unit type (Design/Service/PP/Inquiry), unit title, criterion expectations | Frames the conversation. Service projects need stakeholder identification. Design projects need materials planning. |
| **Custom constraints** | Teacher free-text (e.g., "Must include user testing", "Budget max $50", "No 3D printing this term") | Injected into mentor's system prompt. The mentor weaves these into the conversation naturally. |

These parameters are stored on a new `open_studio_plans` table (see §7) and injected into the journey as `context_data`.

### 3.2 The Planning Stations

The Planning Journey is a branching journey built from Journey Blocks. It adapts based on the student's Discovery profile (if it exists), the teacher's parameters, and the student's responses in real time.

**Station 1: The Anchor (1-2 blocks, ~3 min)**

Purpose: ground the student in reality before dreaming.

- **Block 1a: Time Reality** (`reveal` type) — the mentor shows the student their actual remaining time. Not abstract ("you have a few weeks") but concrete: "You have 11 sessions left. Each session is about 45 minutes of working time. That's 8 hours and 15 minutes total. Your last session is June 12th — that's your presentation day."
  - Data source: timetable cycle engine + school calendar
  - The reveal visualization shows a timeline with session dots, holidays greyed out, and the end date highlighted

- **Block 1b: Profile Recall** (`reveal` type, conditional) — if the student has Discovery profile data, the mentor surfaces it: "I remember from your Discovery — you're a Maker who cares about [interest]. You said you were worried about [fear]. Let's keep that in mind."
  - Skipped if no Discovery profile exists
  - Reads from `learning_profile.strengths`, `.interests`, `.readiness`

**Station 2: Vision of Done (2-3 blocks, ~5 min)**

Purpose: make the endpoint concrete and emotional before planning backward.

- **Block 2a: Imagine the Presentation** (`text_prompt` type) — "Close your eyes for a second. It's June 12th. You're standing in front of your class presenting your finished project. What does the audience see? What are you showing them? What's the reaction?"
  - Effort-gated (minimum 20 words, excludes filler)
  - AI reflection (Sonnet): evaluates specificity. Vague answers ("they see my project") get pushed: "Can you be more specific? Is it something they hold? Something on a screen? Something they walk through?"

- **Block 2b: Deliverables Extraction** (`dialogue_choice` + AI, Sonnet) — the mentor extracts concrete deliverables from the student's vision. "So it sounds like you're making [X]. To present that, you'd need: [list]. Does that sound right, or am I missing something?"
  - Sonnet reasons about what the student described and proposes a deliverables list
  - Student confirms, modifies, or adds via dialogue choices + free text
  - Writes to: `plan.deliverables[]`

- **Block 2c: Success Criteria** (`text_prompt` type) — "How will you know if this actually worked? Not just 'it looks good' — what specifically would make you proud?"
  - Effort-gated
  - AI extracts measurable criteria where possible ("3 user tests completed", "working prototype that holds weight")
  - Writes to: `plan.success_criteria[]`

**Station 3: Backward Planning (3-4 blocks, ~8 min)**

Purpose: work backward from presentation day to today, creating realistic milestones.

- **Block 3a: Milestone Scaffolding** (AI-driven `dialogue_choice`, Sonnet) — the mentor proposes a milestone structure based on unit type, deliverables, and remaining sessions. For a Design unit: "Based on what you're making and the time you have, I'd suggest something like: Sessions 1-3 for research and first prototypes, Sessions 4-7 for building and iterating, Sessions 8-10 for testing and refinement, Session 11 for presentation prep. Does that feel right?"
  - Sonnet reasons about the deliverables, unit type, and session count
  - Accounts for teacher's minimum check-in count (distributes evenly across milestones)
  - Student can adjust via dialogue choices ("I need more time for research", "I want to start building sooner")
  - The mentor pushes back if adjustments are unrealistic: "If you spend 5 sessions on research, you only have 3 for building. Is that enough to make [deliverable]?"
  - Conditional: `scaffolded` students get more concrete milestone suggestions; `autonomous` students get open-ended "what would you put here?"

- **Block 3b: The First Step** (`text_prompt` type) — "What's the very first thing you'll do in your next session? Not 'start research' — something specific enough that I can check if you did it."
  - This grounds abstract planning into immediate action
  - Writes to: `plan.milestones[0].first_action`

- **Block 3c: Risk Check** (`dialogue_choice` type) — "What's the thing most likely to go wrong? What would derail you?"
  - 4 common options + free text: "I might lose motivation", "I might not have the right materials", "I might not know how to do a key skill", "Someone I need might not be available"
  - Conditional branches based on answer:
    - Motivation → mentor discusses accountability strategies
    - Materials → resource identification (Station 4)
    - Skills → knowledge gap identification (Station 5)
    - People → stakeholder planning

**Station 4: Resources & People (2-3 blocks, ~5 min)**

Purpose: identify what the student needs and whether they have access to it.

- **Block 4a: Material/Tool Audit** (`card_sort` type) — cards represent resources relevant to their project type (generated by AI based on deliverables). Student sorts into "Have access" / "Need to get" / "Don't need."
  - For Design units: workshop tools, materials, software, devices
  - For Service units: stakeholder contacts, venue access, transport, budget
  - Writes to: `plan.resources.available[]`, `plan.resources.needed[]`

- **Block 4b: People Map** (`visual_select` type) — "Who could help you with this? Pick anyone who might be useful." Icons represent categories: teacher, classmate, family member, school staff, community expert, online resource.
  - AI follows up on each selection: "You said a family member — who specifically? What would you ask them?"
  - Writes to: `plan.people[]`

- **Block 4c: Gap Alert** (`reveal` + AI, conditional) — if "Need to get" has items, the mentor flags them: "You said you need [X, Y, Z] but don't have them yet. Let's figure out how to get them — or adjust the plan if we can't."
  - Conditional: skipped if no gaps

**Station 5: Knowledge Gaps (2-3 blocks, ~5 min)**

Purpose: identify skills the student needs to learn and recommend MiniSkills or resources.

- **Block 5a: Skills Self-Check** (`slider_scale` type) — sliders for key skills relevant to their project, labelled concretely: "How confident are you with [skill]?" Scale: "Never tried" → "Could teach someone."
  - Skills generated by AI based on deliverables and unit type
  - Reads from: `learning_profile.readiness.self_efficacy` for pre-populated defaults
  - Writes to: `plan.skills_assessment`

- **Block 5b: Gap Recommendations** (`reveal` + AI, Sonnet) — the mentor cross-references low-confidence skills against available MiniSkill blocks in the Block Library and the teacher's resource list. "You said you've never tried [skill]. Here's what I'd recommend: [MiniSkill name] — it's a 15-minute lesson that covers the basics. Want me to add it to your plan?"
  - Queries Block Library for `category: 'skill-building'` blocks matching the skill gap
  - If no MiniSkill exists: "There's no quick lesson for this — you'll need to ask your teacher or find a tutorial. I'll flag this for your teacher."
  - Writes to: `plan.knowledge_gaps[]` with `resolution: 'miniskill' | 'teacher_help' | 'self_directed'`

- **Block 5c: Learning Schedule** (`dialogue_choice` type, conditional) — if MiniSkills were recommended: "When do you want to do these? I'd suggest doing them in your first 2 sessions before you start building."
  - MiniSkills get slotted into early milestones
  - Skipped if no gaps identified

**Station 6: The Contract (1-2 blocks, ~3 min)**

Purpose: synthesize everything into a student-written project contract.

- **Block 6a: Contract Assembly** (`reveal` type, AI-synthesized) — the mentor presents a summary of everything discussed: project description, deliverables, milestones with dates, resources, people, knowledge gaps, risk mitigation, success criteria. Visual: a clean card layout, not a wall of text.
  - Student reviews and can tap any section to edit
  - The mentor highlights any concerns: "Your timeline is tight — you might want a backup plan for [milestone 3]"

- **Block 6b: Commitment Check** (`slider_scale` type) — two sliders:
  - "How excited am I about this project?" (1-10)
  - "How realistic is this plan?" (1-10)
  - If excitement < 5: mentor challenges the project choice ("It sounds like you're not that excited — is there something you'd rather do?")
  - If realism < 5: mentor challenges the plan ("You don't think this plan is realistic — what would you change?")
  - Both must be ≥ 5 to proceed. Otherwise loops back to relevant station.
  - Writes to: `plan.commitment.excitement`, `plan.commitment.realism`

**Station 7: Teacher Handoff (1 block, ~1 min)**

- **Block 7a: Submit for Approval** (`reveal` type) — "Your plan is ready! I'm sending it to your teacher for review. They might approve it, suggest changes, or want to chat with you about it. You'll get a notification when they respond."
  - Plan status changes to `pending_approval`
  - Teacher receives notification with one-click actions: Approve / Approve with Notes / Return for Revision
  - If returned: student re-enters the journey at the relevant station with teacher notes visible

---

## 4. Teacher Approval Workflow

### 4.1 The Review Interface

Teacher sees a plan card in their dashboard (or a dedicated Open Studio tab in Class Hub):

**Plan Summary Card:**
- Student name + avatar
- Project title + one-line description
- Capability tier badge (autonomous / supported / scaffolded)
- Timeline visualization (session dots with milestone markers)
- Deliverables list
- Knowledge gaps flagged (with MiniSkill recommendations or "needs teacher help")
- Risk flag (if any)
- Commitment scores (excitement + realism)
- AI mentor's private assessment (hidden from student): "This plan is realistic but tight. The student underestimated [X]. I'd suggest adding a buffer session before milestone 3."

**Teacher Actions:**

| Action | What Happens |
|--------|-------------|
| **Approve** | Student gets notification, Working phase unlocks, milestones appear on student dashboard, check-in schedule activates |
| **Approve with Notes** | Same as above + teacher's notes appear as a message from the teacher in the student's journey. "Approved! Just make sure you talk to Mr. Chen about workshop access before session 3." |
| **Return for Revision** | Student gets notification with teacher's comments. Journey reopens at the relevant station. Teacher can annotate specific sections: "Your timeline is too ambitious — try extending the building phase by 2 sessions." |
| **Schedule a Chat** | Flags for in-person discussion. Plan stays in pending. Teacher talks to student, then approves or revises. |

### 4.2 Batch Operations

Teachers unlocking Open Studio for a whole class see a queue of incoming plans. Quick-approve for `autonomous` students who consistently produce good plans. Deeper review for `scaffolded` students.

### 4.3 Teacher Override of Plan Parameters

After approval, the teacher can still:
- Adjust milestone dates (drag on timeline)
- Add mandatory check-in points
- Insert MiniSkill blocks at specific milestones
- Add notes to any milestone ("Reminder: workshop only available on Tuesdays")
- Reduce or extend session count if schedule changes

All changes are visible to the student with a "Your teacher adjusted your plan" notification.

---

## 5. Ongoing Plan Integration (Working Phase)

The plan isn't fire-and-forget. It becomes the backbone of the Working phase (v1's existing check-in system, enhanced):

### 5.1 Milestone-Aware Check-Ins

Instead of generic "how's it going?" check-ins, the mentor references the plan:

- Before a milestone: "Your [milestone name] is coming up in 2 sessions. How's it looking?"
- At a milestone: "Today's the day for [milestone]. Did you get it done?" → Yes triggers celebration + next milestone preview. No triggers renegotiation ("What happened? Do we need to adjust the plan?")
- After a missed milestone: "You were supposed to have [X] done by now. Let's figure out what to change."

### 5.2 Check-In Journeys (Window Mode)

Periodic check-ins become micro-journeys (2-3 blocks, window mode, ~2 min):

- **Quick Pulse** (`slider_scale`): energy + clarity + on-track
- **Evidence Prompt** (`media_capture` or `text_prompt`): "Show me what you're working on" or "What did you accomplish since last check-in?"
- **Mentor Response** (`reveal` + AI): contextual response based on plan progress + evidence

These are standard Journey Engine journeys running in window mode. The mentor character, the plan context, and the milestone awareness are injected as `context_data`.

### 5.3 Plan Health Score

Computed from:
- Milestone completion rate (on time, late, missed)
- Check-in engagement (quality of evidence, response effort)
- Self-reported vs observed alignment (student says 🟢 but evidence says 🟠)
- Consistency of submissions (gaps in evidence = amber signal)

The health score determines:
- Check-in frequency (healthy = every 20-30 min, struggling = every 5-10 min)
- Mentor tone (healthy = light touch, struggling = direct)
- Teacher alerts (red health for 2+ sessions = teacher notification)
- Auto-revocation consideration (critical health for 2 consecutive sessions = gentle step-back to guided mode, per v1 spec)

### 5.4 Plan Revision

Students can request a plan revision at any time ("things changed"). This reopens relevant Planning Journey stations with current plan pre-populated. Major revisions (changing the project entirely) require teacher re-approval. Minor revisions (adjusting a milestone by 1-2 sessions) can be auto-approved with teacher notification.

---

## 6. AI Reasoning Requirements

This is where the project diverges most from standard Journey Engine blocks. Several stations require Sonnet-level reasoning that goes beyond template reactions:

| Station | Reasoning Task | Why Sonnet |
|---------|---------------|-----------|
| 2b Deliverables Extraction | Parse a student's vision description and extract concrete, buildable deliverables. Challenge vague ones. | Needs to understand what's physically makeable and what's hand-wavy |
| 3a Milestone Scaffolding | Propose a realistic session-by-session plan given deliverables + time + unit type + student capability | Multi-constraint optimization. Must account for holidays, teacher check-ins, typical activity durations |
| 3a Pushback | Evaluate whether a student's proposed adjustment is realistic. "5 sessions for research and 3 for building a physical product — is that enough?" | Domain knowledge about how long things actually take in a design classroom |
| 5b Gap Recommendations | Cross-reference student's skill gaps against Block Library, rank by relevance, propose a learning schedule | Retrieval + reasoning + scheduling |
| 6a Contract Assembly | Synthesize 5-6 stations of input into a coherent, readable plan with highlighted concerns | Long-context synthesis with editorial judgment |
| Check-in reasoning | Reference the plan during working-phase check-ins, compare evidence against milestones, decide escalation level | Ongoing contextual awareness across sessions |

**Cost estimate per student:** ~$0.25-0.40 for the Planning Journey (3-5 Sonnet calls + 5-8 Haiku calls). Check-in journeys: ~$0.02 each (Haiku only). Over a 12-session Open Studio: ~$0.50-0.65 total per student.

**Fallback chain:** Sonnet → retry with simplified prompt → Haiku with constrained output → template-based plan (functional but less adaptive).

---

## 7. Data Model

### 7.1 New Table: `open_studio_plans`

```sql
CREATE TABLE open_studio_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  class_id UUID NOT NULL REFERENCES classes(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'in_planning',
  -- 'in_planning' | 'pending_approval' | 'approved' | 'revision_requested' | 'active' | 'completed' | 'abandoned'

  -- Teacher parameters (set at unlock time)
  teacher_params JSONB NOT NULL DEFAULT '{}',
  -- { semester_end: ISO, remaining_sessions: N, min_checkins: N,
  --   capability_tier: 'autonomous'|'supported'|'scaffolded',
  --   custom_constraints: 'text', unlock_date: ISO }

  -- The plan (built during Planning Journey, editable after approval)
  plan_data JSONB NOT NULL DEFAULT '{}',
  -- { project_title, project_description, deliverables[], success_criteria[],
  --   milestones[{ name, target_session, deliverable, status, completed_at }],
  --   resources: { available[], needed[] }, people[],
  --   knowledge_gaps[{ skill, confidence, resolution, miniskill_id? }],
  --   risk: { primary_risk, mitigation },
  --   commitment: { excitement: N, realism: N } }

  -- AI assessment (private, teacher-only)
  ai_assessment JSONB,
  -- { overall: 'realistic'|'ambitious'|'cautious', concerns[], suggestions[] }

  -- Journey reference
  planning_journey_session_id UUID REFERENCES journey_sessions(id),

  -- Health tracking (updated during Working phase)
  health_score JSONB DEFAULT '{"momentum": 1.0, "engagement": 1.0, "quality": 1.0, "self_awareness": 1.0}',
  last_checkin_at TIMESTAMPTZ,
  checkin_count INT DEFAULT 0,

  -- Teacher review
  teacher_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  -- Versioning
  version INT NOT NULL DEFAULT 1,
  revision_history JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_os_plans_student ON open_studio_plans(student_id);
CREATE INDEX idx_os_plans_class ON open_studio_plans(class_id);
CREATE INDEX idx_os_plans_status ON open_studio_plans(status);
```

### 7.2 Profile Integration

The Planning Journey reads from `learning_profile` (Discovery data, previous Open Studio history) and writes to:

- `learning_profile.projects.{unit_id}.plan_summary` — compact plan reference
- `learning_profile.readiness.self_efficacy` — updated by Station 5 skills check
- `learning_profile.signals.planning_quality` — computed from commitment scores + teacher approval rate

The plan itself lives in `open_studio_plans`, not in `learning_profile` — it's too large and too unit-specific for the profile JSONB. The profile gets a summary pointer; the full plan is a first-class entity.

---

## 8. Relationship to Journey Engine

| Journey Engine Provides | This Project Adds |
|------------------------|-------------------|
| Block types (binary_choice, card_sort, slider_scale, text_prompt, dialogue_choice, reveal) | Custom AI reasoning blocks (Sonnet-powered, plan-aware) |
| Conditional branching with conditions against profile data | Conditions against teacher_params and plan_data (external context) |
| State machine with auto-save | Plan versioning and revision workflow |
| 4 rendering modes (fullscreen, embedded, window, modal) | Planning Journey runs fullscreen; check-in journeys run in window mode |
| Character assignment (Kit, etc.) | Same — the mentor character delivers the planning journey |
| Profile read/write via `learning_profile` | Plan data in separate `open_studio_plans` table (too structured for profile JSONB) |
| Lesson editor integration (journey as activity block) | Teacher dashboard integration (plan review queue, health monitoring) |
| Admin journey editor for composition | Planning Journey is system-authored; teacher only sets parameters |

The Planning Journey is a standard Journey Engine journey with one key extension: **blocks that receive `context_data` containing teacher parameters and plan state**. The Journey Engine spec (§8.2) already supports `context_data` on `JourneyActivitySection` — this project uses that mechanism to inject teacher params and real-time plan data into each block's AI prompts.

---

## 9. Build Phases

### Phase A: Teacher Parameter System (~2 days)
- `open_studio_plans` table migration
- Teacher unlock UI extended with parameter form (capability tier, min check-ins, custom constraints)
- Session count calculation from timetable cycle engine + school calendar
- API endpoint: `POST /api/teacher/open-studio/plan-params`

**Exit criteria:** Teacher can unlock a student with parameters. Parameters stored in DB. Session count calculated correctly.

### Phase B: Planning Journey (~5-6 days)
- Build 7 stations as Journey Engine blocks (requires Journey Engine Phase A-B complete)
- Sonnet reasoning blocks: deliverables extraction (2b), milestone scaffolding (3a), gap recommendations (5b), contract assembly (6a)
- Pushback logic: timeline realism checks, commitment gate (excitement + realism ≥ 5)
- Block Library query for MiniSkill recommendations (Station 5b)
- Profile reads (Discovery data) + plan writes
- Walk-through testing with different student profiles and teacher params

**Exit criteria:** Full Planning Journey works end-to-end. Student can complete a realistic plan. AI pushes back on unrealistic plans. MiniSkills recommended for skill gaps.

### Phase C: Teacher Approval Workflow (~3 days)
- Plan review interface in Class Hub (Open Studio tab or dedicated page)
- Plan summary card with AI assessment
- 4 teacher actions: Approve / Approve with Notes / Return for Revision / Schedule Chat
- Student notification on approval/revision
- Batch approval for class-wide unlock
- Plan re-entry flow (student returns to journey with teacher notes)

**Exit criteria:** Teacher can review, approve, and annotate plans. Students receive notifications and can revise.

### Phase D: Working Phase Integration (~3-4 days)
- Milestone-aware check-in journeys (window mode, 2-3 blocks each)
- Plan health score computation (momentum, engagement, quality, self-awareness)
- Adaptive check-in frequency based on health
- Teacher health dashboard (traffic lights per student)
- Plan revision flow (student-initiated, auto-approve for minor changes)
- Drift detection enhanced with plan context (v1's drift escalation now references milestones)

**Exit criteria:** Working phase uses plan milestones for check-ins. Health score drives frequency. Teacher sees health dashboard.

### Phase E: Polish + Edge Cases (~2 days)
- Student dashboard plan view (visual timeline with milestones)
- Plan export (summary card for portfolio)
- Edge cases: student changes project entirely (full re-plan), teacher revokes Open Studio mid-plan, semester date changes after plan approval
- Analytics: plan completion rates, revision rates, health score distributions, AI cost tracking

**Exit criteria:** All edge cases handled. Analytics tracked.

**Total estimate: ~15-17 days.** Hard dependency on Journey Engine Phases A-B (interaction types + rendering). Can start Phase A (teacher params) in parallel with Journey Engine.

---

## 10. Example Scenarios

### Scenario 1: Capable Year 10 Maker
- Teacher sets: `autonomous`, 3 minimum check-ins, semester ends June 12, 14 sessions remaining
- Discovery profile: Maker archetype, high self-efficacy in making, interested in furniture design
- Planning Journey: mentor moves quickly, student has clear vision, minimal pushback, plan approved in ~15 min
- Working phase: light check-ins every 25 min, health stays green, 3 milestone check-ins with teacher

### Scenario 2: Struggling Year 7 First-Timer
- Teacher sets: `scaffolded`, 6 minimum check-ins, custom constraint "must include user testing"
- Discovery profile: Creative archetype, low self-efficacy in planning, worried about "not being good enough"
- Planning Journey: mentor goes slower, provides more concrete examples, recommends 2 MiniSkills (time management, user testing basics), pushes back on "I'll make a whole game" → negotiates down to "a playable prototype of level 1"
- Working phase: frequent check-ins (every 10 min), evidence prompts with photo drops, teacher gets amber alerts early, adjusts plan after session 3

### Scenario 3: Service Project Student
- Teacher sets: `supported`, 4 minimum check-ins, unit type Service
- Discovery profile: Leader archetype, interested in food waste
- Planning Journey: extra emphasis on stakeholder identification (Station 4), community impact criteria, service timeline with external dependencies (meeting with cafeteria manager), mentor flags "you need to schedule that meeting THIS WEEK or the whole plan shifts"
- Working phase: check-ins reference external milestones, mentor nudges evidence collection ("did you take notes from the meeting?")

---

## 11. Student Dashboard — Greyscale Unit + Colourful Studio Card

### The Problem with the Current UI

Currently, Open Studio is a small violet strip at the bottom of the existing unit card ("Open Studio" with a lock icon). It's easy to miss, and it communicates "this is a bonus tag on your unit" rather than "your whole working mode has changed."

### The New Design

When a student has Open Studio unlocked for a unit, the dashboard changes in two ways:

**1. The original unit card goes greyscale.** The gradient header, progress ring, and text all desaturate. The card gets a subtle "Guided lessons" label and reduced visual weight. It's still clickable (student can return to guided lessons for reference) but it's clearly secondary now. This communicates: "you've graduated past this."

**2. A new, distinct Open Studio card appears.** This is a separate card in the grid — vibrant, larger, and visually dominant. It's the student's new home for this unit.

### Open Studio Card Design

The Studio card should feel fundamentally different from unit cards:

- **Colour:** rich gradient using the student's chosen theme accent colour (from onboarding). Not the framework gradient (that's the guided unit's identity). The accent colour is personal — this is YOUR studio, not THE unit.
- **Layout:** wider format (spans full row on mobile, double-width on desktop grid if possible) or same grid size but with denser, richer content.
- **Content:**
  - Project title (from the approved plan)
  - Next milestone with date ("Build first prototype — due May 2")
  - Plan health indicator (simple traffic light: green/amber/red)
  - Session count ("Session 4 of 14")
  - Mentor avatar (Kit or assigned character, small)
  - Quick actions: "Enter Studio" (primary, goes to Open Studio working environment), "View Plan" (secondary)
- **Animation:** subtle breathing glow on the border using the accent colour. The card should feel alive compared to the static greyscale unit card next to it.
- **Before plan approval:** the Studio card shows "Planning in progress..." with a progress indicator for the Planning Journey stations, or "Waiting for teacher approval" with a pending badge.
- **Badge/label:** "OPEN STUDIO" in bold, replacing the old violet strip concept entirely.

### Greyscale Unit Card Details

- Apply a CSS `filter: grayscale(0.85) opacity(0.7)` to the entire card.
- On hover: partially restore colour (`grayscale(0.4) opacity(0.9)`) so the student knows it's still interactive.
- Change the status text from "Continue where you left off →" to "Guided lessons — for reference" (or similar wording that reinforces the shift).
- Keep the progress ring and completion percentage visible (student should see they've done X% of guided work).
- The Open Studio strip at the bottom is REMOVED (no longer needed — the Studio card is the indicator).

### Implementation Notes

The student dashboard page (`src/app/(student)/dashboard/page.tsx`) currently renders all units in a single grid. The change:

1. Partition units into two sets: `guidedUnits` (no Open Studio, or Open Studio not yet unlocked) and `studioUnits` (Open Studio unlocked).
2. Studio cards render first (they're the active working context).
3. Greyscale guided cards render below or in a secondary row, possibly under a subtle "Guided Units" divider.
4. If a unit has Open Studio unlocked, it appears in BOTH sets: once as a greyscale guided card and once as a colourful Studio card. The Studio card is the primary; the guided card is reference.
5. The Studio card links to the Open Studio working environment (`/open-studio/[unitId]`). The greyscale card links to the guided lesson page as before.

### Discovery Journey Cards

The same pattern applies to Discovery Journey units (Service/PP/PYPx). Currently these show an indigo-to-purple "Start Discovery Journey" strip. In v2, they should get the same treatment: distinct colourful Discovery card + greyscale unit card. But this can be a later iteration — the Open Studio visual split is higher priority.

---

## 12. Open Questions

1. **Should the Planning Journey be mandatory for all Open Studio students?** Current thinking: yes for first-time Open Studio in any unit. Optional (but recommended) for students who've done Open Studio before. Teacher can force full planning for any student.

2. **Can students start working before teacher approves the plan?** Leaning no — the plan IS the permission to work. But auto-approval after 48 hours if teacher hasn't responded (with notification) prevents blocking.

3. **How does this interact with the existing `open_studio_status` table?** The existing table tracks unlock status. The new `open_studio_plans` table tracks the plan. Status flow: teacher unlocks (status table) → student completes Planning Journey (plans table, status: pending_approval) → teacher approves (plans table, status: approved → active) → student enters Working phase. The v1 check-in system reads from both tables.

4. **Should the mentor's private AI assessment be transparent to the student?** No. The mentor's private assessment ("this plan is ambitious, I'm concerned about milestone 3") is teacher-only information. The student sees the mentor's in-journey pushback but not the summary assessment. Teachers need honest signal without the student feeling judged.

5. **How do MiniSkill recommendations work before the MiniSkill system is built?** Initial version: mentor identifies the gap and recommends "ask your teacher" or "find a tutorial." When MiniSkills exist: mentor queries Block Library and recommends specific blocks that slot into the plan timeline. The gap is flagged either way — the resolution strategy upgrades when MiniSkills ship.

6. **Plan data for portfolio?** The plan itself (goals, milestones, risk assessment) is valuable portfolio evidence — especially for MYP where "planning" is explicitly assessed. A "Plan Summary" card should auto-generate as a portfolio entry when the plan is approved. Milestone completion states update the card throughout. This shows the student's growth in self-management.
