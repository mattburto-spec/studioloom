# Own Time — Concept Document

> Mastery-based autonomous learning with AI mentoring.
> Status: Early concept exploration (19 Mar 2026)
> Author: Matt + Claude thinking session

---

## The Idea

Students who demonstrate mastery of required work earn "their own time" — a powerful intrinsic motivator where they pursue self-directed learning with an AI mentor keeping them accountable and a teacher staying informed without being overwhelmed.

**Core insight:** The strongest motivator in a classroom isn't points or badges — it's autonomy. "Finish well, and the rest is yours." But unstructured free time in a classroom fails without sustained mentoring infrastructure. AI fills that gap at scale.

---

## The Problem It Solves

Every teacher knows these failure modes:

- **Fast finishers get busywork.** Extension worksheets, "help your neighbour," or silent reading. These punish speed and quality with boredom.
- **Passion projects fizzle.** Genius Hour, 20% time, PBL enrichment — the teacher sets it up, the student starts enthusiastic, then it dies because nobody has time to mentor 25 different self-directed projects simultaneously.
- **Self-directed learning is invisible.** When a student is exploring something independently, the teacher has no signal about engagement, progress, or whether the student needs help. So they either micromanage or ignore.
- **Mastery-based pacing has no reward.** If students work at their own pace but everyone ends up doing the same thing, there's no incentive structure. Own Time makes mastery the gateway to autonomy.

---

## Two-Phase Strategy

### Phase 1: Own Time inside StudioLoom

Start as a feature within the existing platform. Students earn Own Time by completing unit work to the teacher's satisfaction. The AI mentor operates within the StudioLoom ecosystem, connected to the student's portfolio, the teacher's knowledge base, and the design thinking toolkit.

**Why start here:**
- Existing user base of MYP Design teachers — they already understand the design cycle, they already use the toolkit, they already have classes set up
- The AI patterns are proven (effort-gating, Socratic feedback, staged cognitive load) — they extend naturally from structured tasks to self-directed mentoring
- Portfolio infrastructure already exists — Own Time work feeds into the same timeline
- Teacher dashboard already exists — add a new view, don't build from scratch
- Design thinking is inherently self-directed — "go design something that matters to you" is a natural extension of MYP

**Scope for Phase 1:**
- Teacher approval mechanism (per-student, per-unit)
- Goal-setting conversation (AI-guided, structured)
- AI mentor endpoint (coaching tone, long-term memory)
- Student Own Time workspace
- Teacher pulse dashboard + weekly digests
- Portfolio integration (Own Time entries with distinct visual treatment)

### Phase 2: Own Time as standalone product

If Phase 1 validates the concept, extract it into a standalone site that any teacher in any subject can use. The core loop stays the same (student arrives → AI mentor → goal setting → self-directed work → accountability → teacher updates) but now:

- **Subject-agnostic.** Not just design. A maths student exploring cryptography. An English student writing a novel. A science student designing an experiment.
- **School resource layer.** The school curates an ecosystem: teachers willing to mentor outside their class, community volunteers, physical resources (laser cutter, darkroom, maker space), partnerships (local businesses, universities, museums).
- **AI as connector.** The AI doesn't just coach — it matches. "You're interested in sustainable packaging? Ms. Rivera teaches environmental science and has a materials testing lab. Also, there's a parent volunteer who works in packaging design."
- **Cross-school intelligence.** Over time, the platform learns what kinds of projects succeed, what resources are most valuable, what mentoring patterns work. This feeds back into better goal-setting conversations and resource recommendations.

**What makes this a separate product, not just a feature:**
- Different buyer (school leadership, not individual teachers)
- Different value proposition (school-wide enrichment infrastructure, not subject-specific teaching tool)
- Different onboarding (school admin sets up resource directory, not a teacher creating a unit)
- Potentially different pricing (per-school, not per-teacher)

---

## How Own Time Works (Student Experience)

### Entry: The Approval Moment

The teacher reviews the student's unit work and decides they've met the standard. This is a deliberate human decision — not algorithmic. The teacher taps "Approve for Own Time" on the class dashboard, optionally with a note:

- "Excellent work on Criterion B — you've earned full autonomy."
- "Good enough on the minimum requirements. I'd love to see you push your prototyping skills during Own Time."
- "You're ready. Consider exploring something connected to your Personal Project."

The student sees a notification that feels like an achievement, not a dismissal. The unit view shifts — their completed work is still accessible, but a new "Own Time" space opens.

### Goal Setting: The Structured Start

The AI doesn't open with "what do you want to do?" — that's too open for most teenagers. Instead, it runs a guided goal-setting conversation (similar to the toolkit intro screens, but more conversational):

**Round 1 — Curiosity mapping:**
"You've just finished a unit on sustainable product design. Before we plan anything — what's been on your mind lately? Could be related to what you just studied, could be completely different. What's something you wish you understood better, or something you want to make?"

**Round 2 — Scoping:**
"Interesting — you mentioned wanting to design a better school bag. Let's make that concrete. What specifically bugs you about current school bags? And when you say 'design' — are you thinking sketches, a physical prototype, a digital model, or something else?"

**Round 3 — Time reality check:**
"You have roughly 4 class periods of Own Time before the next unit starts. A full prototype is ambitious for that timeline. What if we aimed for: (a) research + sketches + one material test, or (b) a detailed digital model with material specs? Which feels more exciting?"

**Round 4 — Learning goal articulation:**
"So your plan is: research ergonomic school bags, sketch 3 concepts, and do one material comparison test. Beyond the bag itself — what SKILL are you trying to develop? Are you practising research methods? Prototyping? Material selection? This helps me know how to coach you."

The output is a structured learning plan:
- **Project:** Ergonomic school bag redesign
- **Deliverables:** Research notes, 3 concept sketches, 1 material test
- **Skill focus:** Material selection and testing methodology
- **Timeline:** 4 sessions (~3.5 hours usable time)
- **Success looks like:** "I can justify my material choices with evidence from testing"

This plan is visible to the student, the AI, and the teacher.

### Working: The Mentoring Loop

During Own Time sessions, the student works independently. The AI mentor is always available but doesn't interrupt unless the student hasn't engaged for a while.

**Active mentoring (student initiates):**
Student can ask questions, share progress, upload photos of work, think through problems. The AI uses the same Socratic patterns as the toolkit tools — but with a coaching rather than teaching tone. It knows the student's plan and can reference it:

"You mentioned wanting to test 3 materials. You've tested nylon and canvas — what's your third? And based on what you've found so far, which is winning?"

**Proactive check-ins (AI initiates):**
If a student hasn't interacted in a while (configurable — maybe 15 minutes of a class period), the AI sends a gentle ping:

- "How's the bag research going? Found anything surprising?"
- "You've been quiet — stuck on something, or deep in flow? (If you're in flow, just ignore me.)"
- "Last session you said you'd start sketching today. Have you started, or do you want to talk through your concepts first?"

The tone is crucial: interested mentor, not surveillance system. The AI should feel like that one teacher who actually remembers what you said last week.

**Session wrap-up:**
At the end of each Own Time session (or when the student leaves), the AI prompts a brief reflection:

"Quick check before you go: What did you accomplish today? What's your plan for next time? Anything you're stuck on that we should think about?"

This takes 30 seconds and generates the data that feeds the teacher digest.

### Summary: The Portfolio Entry

Each Own Time project generates a portfolio entry that shows:
- The original learning plan
- Session-by-session progress notes (from wrap-up reflections)
- Any artifacts (photos, files, sketches)
- The student's self-assessment of their skill development
- AI-generated growth narrative ("Over 4 sessions, Alex moved from vague interest in bags to conducting structured material tests and justifying design choices with evidence.")

This is powerful for MYP because it's direct evidence of ATL skills (self-management, research, thinking) in an authentic, self-directed context.

---

## How Own Time Works (Teacher Experience)

### Approval Flow

On the class dashboard, the teacher sees each student's unit progress. When a student meets the bar, the teacher taps "Approve for Own Time." This could be:
- A manual judgment (teacher reviews work and decides)
- Triggered by reaching a grade threshold (teacher sets minimum per unit)
- Available after completing specific activities (teacher marks required tasks)

The key: the teacher controls the gate. AI cannot auto-approve.

### Pulse Dashboard

A quick-scan view across all students currently in Own Time:

| Student | Project | Sessions | Status | Last Active |
|---------|---------|----------|--------|-------------|
| Alex K. | School bag redesign | 3/4 | On track | Today |
| Priya M. | Sustainable packaging | 2/4 | Needs check-in | 3 days ago |
| Tom W. | (No goal set) | 0/4 | Not started | — |

**Status indicators:**
- **On track** (green) — student is engaged, making progress, reflections show depth
- **Needs check-in** (amber) — student hasn't engaged recently, or reflections are thin
- **Not started** (red) — approved but hasn't set goals or begun work
- **Exceptional** (purple) — student is exceeding their own goals, might be worth showcasing

### Weekly Digest

AI-generated summary, per student, delivered to the teacher's dashboard (or email):

> **Alex K. — School bag redesign (Session 3 of 4)**
> Completed material testing on nylon, canvas, and recycled PET fabric. Showed strong analytical thinking in comparing tensile strength vs. weight. Identified PET as preferred material but noted cost concerns. Started concept sketches — first two are functional but lack aesthetic consideration. I nudged him toward looking at existing high-end bag designs for inspiration.
> **Engagement: High | Skill growth: Material testing methodology (strong), Aesthetic design (emerging)**

The teacher reads the amber/red ones carefully and skims the green ones. Five minutes gives them a picture of 25 students' independent work.

### Intervention Points

The teacher can:
- **Message a student** through the platform (appears alongside AI messages)
- **Adjust the plan** ("I see you're struggling with material testing — come talk to me next class and I'll show you the lab equipment")
- **Revoke Own Time** if a student is genuinely disengaged (returns them to unit work or extension tasks)
- **Showcase** a student's project to the class ("Alex, can you show everyone your material test results?")

---

## The School Resource Layer (Phase 2 Expansion)

This is what transforms Own Time from a classroom feature into school-wide infrastructure.

### What a school sets up

**Teacher expertise directory:**
Teachers opt in with their skills and availability. Not just their subject — their actual expertise.
- "Ms. Chen — ceramics, material experimentation, kiln operation. Available Tuesdays Period 5."
- "Mr. Torres — architecture, CAD, 3D printing. Available by appointment."
- "Dr. Patel — data analysis, statistics, experimental design. Happy to review student experiments."

**Community member profiles:**
School-vetted volunteers with background checks and availability windows.
- "Sarah L. — Product designer at Dyson. Can do 30-min video calls monthly."
- "James K. — Carpenter, school parent. Available in the maker space Wednesdays after school."

**Physical resources:**
- "Design Lab — laser cutter, 3D printer, CNC router. Book through Ms. Chen."
- "Science Lab 3 — materials testing equipment. Book through Dr. Patel."
- "Community Garden — sustainable design projects. Contact Mr. Williams."

**Partnerships:**
- "Local makerspace — free student membership for Own Time projects"
- "University of X — mentoring program for Year 10+ students"
- "Museum of Design — student exhibition opportunity each semester"

### How the AI uses resources

The AI mentor has access to the school's resource directory and can make contextual suggestions:

"You're stuck on how to test your material's water resistance. Did you know the science lab has a materials testing rig? Dr. Patel said she's happy to help students with experimental design. Want me to help you draft what you'd say to her?"

This is the killer feature: **the AI holds the complete map of the school's ecosystem in a way no single teacher can.** It connects students to resources they didn't know existed.

### Safeguarding

- All community members are vetted and added by school admin (never self-service)
- AI suggests connections but never directly connects students with external adults
- The suggestion always goes through the student's teacher: "I've suggested Alex talk to Sarah L. about packaging design. Would you like to facilitate that introduction?"
- All interactions are logged and visible to relevant staff
- Community members interact through the platform, not private channels

---

## AI Architecture Considerations

### Own Time Mentor vs. Design Assistant

The current Design Assistant is:
- Reactive (responds when asked)
- Scoped to a single activity or page
- Short context (300-token responses, current conversation only)
- Socratic within a structured task

The Own Time Mentor needs to be:
- Both reactive and proactive (checks in on its own)
- Scoped to a project over multiple sessions
- Long context (remembers previous sessions, references the learning plan)
- Coaching across unstructured, self-directed work
- Aware of the school resource layer (Phase 2)

### Memory Architecture

The mentor needs persistent memory across sessions:

```
own_time_session
├── student_id
├── unit_id (what they earned it from)
├── learning_plan (structured JSON from goal-setting)
├── sessions[] (array of session records)
│   ├── date
│   ├── conversation_history (full AI/student messages)
│   ├── wrap_up_reflection (student's end-of-session notes)
│   └── ai_session_summary (AI's assessment of the session)
├── artifacts[] (photos, files, links)
├── status (active, completed, paused, revoked)
├── teacher_notes[] (teacher's comments/interventions)
└── portfolio_entry_id (link to generated portfolio entry)
```

The AI loads the learning plan + previous session summaries (not full transcripts — too long) at the start of each session. This gives it continuity without blowing the context window.

### Proactive Check-In System

The AI doesn't literally ping a student on a timer. Instead:

1. At session start, the AI loads context and prepares a check-in message based on where the student left off
2. If the student doesn't interact within X minutes, the UI surfaces the check-in as a gentle notification
3. The student can engage or dismiss
4. Check-in frequency adapts: high engagement → less frequent, low engagement → more frequent

This is similar to how Duolingo's streak notifications work — gentle, persistent, escalating.

### Teacher Digest Generation

A scheduled process (or on-demand) that:
1. Loads all Own Time sessions for a class
2. For each student, summarises recent session data using Haiku
3. Computes engagement signals (frequency, reflection depth, goal progress)
4. Generates the pulse dashboard status + weekly narrative
5. Flags students needing teacher attention

Token budget: ~200 tokens per student summary × 25 students = 5,000 tokens per class. Cheap enough to run weekly on Haiku.

---

## How It Connects to Existing StudioLoom

### What already exists that we'd leverage

| Existing feature | How Own Time uses it |
|---|---|
| Student auth (token sessions) | Same auth, no new login |
| Portfolio timeline | Own Time entries as a new entry type |
| Design thinking toolkit | Students can use any toolkit tool during Own Time |
| Design Assistant AI patterns | Effort-gating, Socratic feedback extend to mentor |
| Teacher dashboard | New "Own Time" tab alongside existing views |
| AI usage tracking | Same logging, new `context: 'own_time'` tag |
| Knowledge base | Teacher's resources available to mentor |
| Rate limiting | Same infrastructure, maybe different limits |

### What's new

| New component | Effort estimate |
|---|---|
| Teacher approval mechanism | 1-2 days |
| Goal-setting conversation flow | 3-4 days |
| Own Time mentor AI endpoint | 3-4 days |
| Session persistence layer | 2-3 days |
| Proactive check-in system | 2-3 days |
| Teacher pulse dashboard | 2-3 days |
| Teacher digest generation | 2-3 days |
| Portfolio integration | 1-2 days |
| Student Own Time workspace UI | 3-4 days |
| **Total Phase 1 estimate** | **~20-28 days** |

### Database additions

```sql
-- Own Time approval
ALTER TABLE student_enrollments ADD COLUMN own_time_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE student_enrollments ADD COLUMN own_time_approved_at TIMESTAMPTZ;
ALTER TABLE student_enrollments ADD COLUMN own_time_teacher_note TEXT;

-- Own Time sessions
CREATE TABLE own_time_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  unit_id UUID REFERENCES units(id),  -- what they earned it from
  learning_plan JSONB NOT NULL,       -- structured goal from AI conversation
  status TEXT DEFAULT 'active',       -- active, completed, paused, revoked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE own_time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES own_time_projects(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  conversation JSONB DEFAULT '[]',    -- message history
  reflection TEXT,                     -- end-of-session student reflection
  ai_summary TEXT,                     -- AI-generated session summary
  engagement_score SMALLINT           -- computed engagement signal (1-5)
);

CREATE TABLE own_time_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES own_time_projects(id),
  session_id UUID REFERENCES own_time_sessions(id),
  type TEXT NOT NULL,                  -- photo, file, link, sketch
  url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher digests
CREATE TABLE own_time_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id),
  class_id UUID,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  content JSONB NOT NULL              -- per-student summaries
);
```

---

## Open Questions

1. **Per-unit or cumulative?** Does a student earn Own Time fresh each unit, or does demonstrating mastery once unlock ongoing autonomy? Per-unit is safer (re-earn each time). Cumulative is more motivating (trust builds). Could start per-unit and graduate to cumulative for consistently strong students.

2. **What if the student wants to work on something DURING Own Time that requires materials/resources the school doesn't have?** The AI can help them plan around constraints, but there's a class equity issue — students with resources at home have an advantage in self-directed work.

3. **Collaboration during Own Time?** Can two students who've both earned Own Time work together on a project? This is pedagogically great (collaboration is an ATL skill) but adds complexity (shared goals, shared accountability, shared portfolio entries).

4. **Own Time across subjects (Phase 2)?** If a student earns Own Time in Design, can they work on something that crosses into Science? This is where the standalone model gets interesting — the student's Own Time isn't "owned" by any one subject.

5. **How does this interact with the Personal Project?** MYP Year 5 students do a Personal Project that's self-directed with a supervisor. Own Time could be the training ground — students who've practiced self-directed learning with AI support are better prepared for the PP. Could even have the AI mentor transition into a PP planning assistant.

6. **What's the minimum viable version?** Could we test the concept with just: teacher approval toggle + a simple chat interface with the mentor + a basic digest? No goal-setting wizard, no portfolio integration, no resource layer. See if the core loop works before building everything.

7. **Referring teacher's role — expanded for Phase 2:** When this goes cross-subject, does the maths teacher who sent the student see what they're doing? Or is it the homeroom teacher? Does the student have one mentor teacher for all Own Time, or does it vary by project?

8. **Community member matching (Phase 2):** Who facilitates introductions — the AI, the teacher, or an admin? What's the safeguarding model for connecting students (minors) with external adults?

---

## Competitive Landscape

**What exists today:**
- **Khanmigo / Khan Academy** — mastery-based learning but no self-directed mentoring. Students follow Khan's curriculum, not their own interests.
- **Genius Hour / 20% Time** — the philosophy exists widely but has no digital infrastructure. Teachers wing it with Google Docs and hope.
- **Renzulli Learning** — gifted enrichment platform. Profiles student interests and suggests activities. Closest to this concept but no AI mentoring, no school resource layer, no accountability loop.
- **IB Managebac** — manages the Personal Project workflow but doesn't provide mentoring or self-directed learning support.
- **Passion-Based Learning (PBL) platforms** — mostly content libraries, not mentoring systems.

**What doesn't exist:**
- An AI mentor for self-directed learning that adapts to the student's specific project
- A school resource discovery layer that connects students to people and equipment
- A teacher dashboard that makes 25 simultaneous self-directed projects manageable
- A system that bridges classroom mastery with autonomous learning

This is a genuine gap.

---

## The Bigger Vision (if this works)

Own Time + school resource layer + AI mentoring = **a new category of edtech.**

Not an LMS (doesn't manage content delivery).
Not a tutoring platform (doesn't teach curriculum).
Not a project management tool (doesn't track tasks).

It's a **learning autonomy platform** — infrastructure for self-directed learning at scale, with AI providing the mentoring that no school has enough humans to deliver.

If it works in MYP Design → expand to all MYP subjects → expand to any school with a passion-project or enrichment program → expand to homeschool co-ops, after-school programs, summer camps, libraries.

The school resource layer is the moat. Every school that sets up their ecosystem makes the platform more valuable and harder to leave.

---

*This document captures the state of thinking as of 19 Mar 2026. It's a living document — update as the concept evolves.*
