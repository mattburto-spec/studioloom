# Open Studio — Experience Design
*Research-backed design for the complete Open Studio journey*
*Draft — 20 March 2026*

---

## What This Document Is

The existing Open Studio spec (`open-studio-spec.md`) covers the **mechanism** — how students unlock, how the AI switches modes, how drift detection works. This document covers the **experience** — what happens once a student is in Open Studio, from "I don't know what to do" to "I presented my project and it changed someone's life."

This is the layer that turns Open Studio from a feature into a **transformative learning experience**.

---

## Research Foundation

This design draws on established models and emerging best practice:

| Source | Key Insight | How It Applies |
|--------|-------------|----------------|
| **Big Picture Learning** (275+ schools globally) | Advisory groups of 15-20 students + Individual Learning Plans co-created with advisor, parents, and community mentors. "Learning team" extends beyond the school. | Open Studio needs a learning plan co-created with the AI and visible to the teacher. Community connections are essential, not optional. |
| **High Tech High** (San Diego) | Students co-design projects, write their own contracts ("this is what I'm responsible for, these are my deadlines, this is what my deliverables look like"), and present at public exhibitions. | Students should write their own project contract. The AI helps them think through it but doesn't write it for them. Exhibition/sharing is a non-negotiable endpoint. |
| **IB MYP Personal Project** | Self-directed inquiry with ATL skills assessment. Scaffolding moves from teacher-directed → student-led over the programme years. Students set their own goals and define their own success criteria. | Open Studio is the MYP Design version of this. The scaffolding gradient from guided → independent is already built into StudioLoom. |
| **Genius Hour / 20% Time** (Google-inspired classroom model) | Process over product. Teacher becomes facilitator/coach. Community engagement (interview experts, present to audiences beyond the classroom). Weekly/bi-weekly structured check-ins. | The AI mentor is the "guide on the ride" — not directing but keeping students honest about progress. |
| **Self-Determination Theory** (Deci & Ryan) | Three pillars: autonomy, competence, relatedness. Students given greater autonomy invest more effort and achieve higher proficiency — but only when they also feel competent and connected. | Discovery phase must build competence ("I can do this") and relatedness ("people care about my project") before autonomy takes full effect. |
| **CCR Passion Toolkit** (6 Victorian schools pilot) | Step-by-step discovery: investigations (short activities to spark curiosity) → explorations (longer activities to build skills) → passion project. Students examine interests, categorize them, narrow to three areas. | Phase 1 (Discovery) should follow this funnel: broad exploration → narrowing → commitment. Not "pick a project on day one." |
| **Early Warning Systems** (ABCs: Attendance, Behaviour, Course performance) | 60% of future dropouts identifiable from 3 indicators in Year 6. Disengagement signals: reduced participation, reduced socialisation, reduced performance. | AI drift detection should track the equivalent signals: reduced submissions, reduced AI interactions, reduced complexity of work. Multiple low-friction check-in methods reduce the chance of silent disengagement. |

---

## The Four Phases of Open Studio

Every Open Studio journey follows the same arc, but the content and timeline are unique to each student.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  DISCOVERY   │───▶│   PLANNING   │───▶│   WORKING    │───▶│   SHARING    │
│  "Who am I?" │    │ "What's the  │    │ "Making it   │    │ "What did I  │
│              │    │  plan?"      │    │  happen"     │    │  learn?"     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
   ~1-2 sessions      ~1-2 sessions      Bulk of time       Final session(s)
```

### Phase 1: Discovery — "What lights you up?"

**The problem:** Many students hear "you can do anything" and freeze. They need structured exploration, not infinite freedom.

**The AI mentor's role:** Interview-style discovery conversation. Not a quiz — a genuine exploration.

**Discovery Flow (AI-guided, ~1-2 sessions):**

1. **Strengths Finder** — "What are you naturally good at? What do people come to you for? What feels easy to you that's hard for others?"
   - AI probes across domains: making/building, organising/leading, researching/understanding, creating/designing, connecting/helping
   - Builds a simple strengths profile (stored, feeds into planning)

2. **Interests & Passions Audit** — "What do you do when you have free time? What YouTube rabbit holes do you fall into? What problems in the world annoy you the most?"
   - AI maps responses to broad categories: technology, sustainability, social justice, arts/culture, health/sport, community, entrepreneurship, etc.
   - Cross-references with strengths: "You said you're good at building things AND you care about accessibility — interesting combination..."

3. **Needs Scan** — "Who around you needs help? What's broken in your school/community/family that you could fix? What would make someone's day better?"
   - Shifts from self-focused to outward-focused
   - This is where project ideas start forming naturally
   - AI helps connect needs with strengths: "You mentioned your grandma struggles with [X] and you love 3D printing — could those connect?"

4. **Project Narrowing** — Student examines their top 3 ideas. AI uses a lightweight SWOT or feasibility check:
   - "Can you actually do this in the time you have?"
   - "Who would you need to talk to?"
   - "What resources do you need? Do you have access?"
   - "Which one excites you most when you imagine presenting it?"

5. **Commitment** — Student writes a one-paragraph project statement: what they're doing, who it's for, and why it matters to them. This becomes the anchor for everything.

**Key design principles for Discovery:**
- **Never suggest project ideas directly.** The AI helps the student discover their own. It can offer categories or provocations ("Some students find interesting problems in...") but never "You should do X."
- **Every question should be answerable in 2-3 sentences.** Not essay-length introspection.
- **The Discovery conversation can be revisited.** Some students need to try an idea, realise it's not right, and come back. That's not failure — it's iteration.
- **Discovery outputs a structured profile** that the AI remembers for the rest of the journey: strengths, interests, chosen project, motivation.

---

### Phase 2: Planning — "Work backward from done"

**The problem:** Students set vague goals ("make a website") with no milestones and no deadline awareness.

**The AI mentor's role:** Backward planning coach. Starts from the end and works back to today.

**Critical first step: Time awareness.** Every student's Open Studio starts at a different point in the term. The AI must:
1. Know the unit end date / term end date (from teacher settings)
2. Calculate how many Open Studio sessions the student has remaining
3. Factor in school events, holidays, etc. (if teacher has entered them)
4. Be honest: "You have 8 sessions left. That's about 6 hours of working time. Let's plan for that, not for a fantasy version with infinite time."

**Planning Flow (AI-guided, ~1-2 sessions):**

1. **Vision of Done** — "Imagine you're presenting this finished. What does the audience see? What are you showing them? How do they react?"
   - Makes the endpoint concrete and emotional
   - AI helps translate the vision into tangible deliverables

2. **Milestone Mapping** — Work backward from the presentation date:
   - **Final milestone:** Presentation-ready (1 session before end)
   - **Pre-final:** Testing/feedback/polish (2 sessions before)
   - **Mid-point:** Core work complete, rough but functional
   - **Early:** Research/prototyping/first attempts done
   - **Now:** First concrete step identified

3. **The Student Contract** (inspired by High Tech High) — Student writes:
   - What I'm making / doing / building
   - Who it's for
   - What "done" looks like (specific, observable)
   - My milestones and dates
   - What help I'll need (resources, people, materials)
   - How I'll know if I'm on track

4. **Resource & People Identification** — "Who could help you with this? Is there someone in the school community, your family, or online who knows about this?"
   - Seeds the Community Resource Library (see Phase: Community)
   - AI suggests potential resource types (not specific people): "For a 3D printing project, you might want to talk to: someone who's done 3D printing before, someone who understands the disability you're designing for, a materials expert..."

**Planning outputs:**
- A visual project timeline with milestones (editable by student, visible to teacher)
- A project contract (student-written, stored)
- An identified resources/people list

**Teacher's role in Planning:**
- Teacher sees the plan and milestones on their dashboard
- Can adjust milestone dates (drag to move)
- Can add comments/suggestions
- Can flag unrealistic plans: "This is ambitious — have you talked to [student] about scope?"

---

### Phase 3: Working — "Make it happen (and prove it)"

**The problem:** This is where students are most likely to drift, get stuck, or go silent. The AI needs to know what's happening without being overbearing.

**Core principle: Multiple low-friction evidence channels.** Students shouldn't have to write a report every session. The AI needs diverse signals to assess progress.

**Evidence Channels (student chooses what works for them):**

| Channel | What It Is | Friction Level | Signal to AI |
|---------|-----------|----------------|-------------|
| **Photo drop** | Quick photo of what they're working on (physical prototype, sketch, screen, etc.) | Very low | "Something exists. Work is happening." |
| **Voice memo** | 30-60 second recording: "Today I worked on... Tomorrow I'll..." | Low | Transcribed, analysed for progress and mood |
| **Quick text check-in** | 2-3 sentence update, prompted by AI or unprompted | Low | Keyword analysis for progress markers |
| **Milestone check-off** | Student marks a milestone as complete in their plan | Low | "Major progress. On track or behind?" |
| **Work submission** | Upload of actual work product (document, code, design, video) | Medium | "Substantial deliverable. Quality assessable." |
| **Reflection journal** | Longer written reflection (AI can prompt specific questions) | Medium-High | "Deep thinking happening. Good sign." |
| **AI conversation** | Student asks the AI for help, feedback, or a crit | Varies | "Student is engaged and seeking growth." |

**AI Progress Assessment Model:**

The AI maintains a rolling "health score" for each student's Open Studio session, based on:

1. **Momentum** — Is the student making progress toward milestones?
   - Evidence: milestone check-offs, work submissions, photo drops
   - Green: on-track or ahead. Amber: slightly behind. Red: significantly behind.

2. **Engagement** — Is the student actively participating?
   - Evidence: frequency of any evidence channel, AI interactions initiated
   - Not just "are they present" but "are they thinking?"

3. **Quality trajectory** — Is the work getting better?
   - Evidence: AI assessment of submitted work complexity over time
   - Early work should be rough. Late work should show refinement.

4. **Self-awareness** — Does the student know where they are?
   - Evidence: accuracy of self-check-ins vs actual progress
   - A student who says "I'm on track" when they're behind needs a reality check

**Adaptive Check-In Frequency:**

Instead of a fixed timer, the AI adapts check-in frequency based on the health score:

| Health Score | Check-In Frequency | AI Tone |
|-------------|-------------------|---------|
| Strong (all green) | Every 20-30 min | Light touch: "Looking good. Need anything?" |
| Moderate (some amber) | Every 10-15 min | Supportive: "How's the [specific milestone] going? Can I help?" |
| Concerning (any red) | Every 5-10 min | Direct: "I notice [specific issue]. Let's talk about it." |
| Critical (multiple red) | Continuous availability + teacher flag | Honest: "I'm worried we're off track. Here's what I see..." |

**The "Quick Pulse" — a 10-second check-in:**

Periodically (configurable), the AI presents a single-tap micro-survey:

```
How's it going?
  🟢 Crushing it    🟡 Okay    🟠 Stuck    🔴 Lost
```

This gives the AI a self-reported signal alongside its observational data. Consistent mismatches (student says 🟢, evidence says 🔴) trigger a deeper conversation.

**Working Phase — Teacher View:**

The teacher dashboard for the Working phase should show:

1. **Journey Board** — visual timeline per student showing milestones (completed, upcoming, overdue), with the current date marker
2. **Health indicators** — traffic light per student (momentum, engagement, quality)
3. **Alert flags** — students who need human attention (AI escalated, behind schedule, no evidence in 2+ sessions)
4. **Session journal** — click into any student to see their evidence trail: photos, voice memos, text check-ins, AI conversation summaries
5. **Milestone management** — teacher can adjust dates, add milestones, mark as complete on behalf of student

---

### Phase 4: Sharing — "Show your work, reflect, grow"

**The problem:** Students finish (or don't) and move on without reflection or community impact.

**Sharing is not optional.** Every Open Studio project, regardless of completion state, ends with some form of sharing. This is backed by High Tech High's exhibition model: presentations of learning to peers, family, and community.

**Sharing Options (scaled by project scope):**

| Format | When to Use | Description |
|--------|-------------|-------------|
| **Lightning talk** (2-3 min) | Default for all projects | Quick presentation to class: what I did, what I learned, what I'd do differently |
| **Exhibition piece** | Larger projects with physical/digital outputs | Displayed in class/school with a process statement |
| **Demo day** | Tech/making projects | Live demonstration of the working product |
| **Portfolio page** | All projects | Auto-generated from Open Studio evidence trail, editable by student |
| **Community presentation** | Projects with external stakeholders | Present back to the person/group the project was designed for |

**AI's role in Sharing:**
- Helps student prepare: "You have 3 minutes. What are the three things your audience MUST know?"
- Generates a draft portfolio page from the evidence trail (student edits)
- Prompts final reflection: "What did you learn about yourself as a designer? What would you do differently? What's next?"

**Post-sharing:** The reflection and portfolio page feed back into the student's profile for the next unit. The AI remembers: "Last time in Open Studio, you discovered you're great at user research but struggle with time management. Let's plan around that this time."

---

## The Community Layer

**Why this matters:** The best self-directed learning programmes (Big Picture Learning, Genius Hour best practice, High Tech High) all emphasize connections beyond the classroom. Students who work in isolation produce weaker work.

### Community Resource Library

A school-wide (or class-wide) collection of people, places, and things that can help with projects.

**Resource Types:**

| Type | Examples | Who Adds |
|------|----------|----------|
| **People — School** | Other teachers with relevant expertise, older students who've done similar projects, school technicians | Teacher, students |
| **People — Community** | Parents with relevant jobs/skills, local business owners, alumni | Teacher, students (with approval) |
| **People — Online** | YouTube channels, online communities, relevant professionals (LinkedIn, etc.) | AI suggestions, student contributions |
| **Places** | Maker spaces, libraries, community centres, businesses that allow visits | Teacher |
| **Things** | Equipment, software, materials available at school or locally | Teacher |
| **Past Projects** | Previous Open Studio projects (with student permission) that serve as inspiration or cautionary tales | System (auto-collected) |

**How it works:**
- Teacher seeds the library at the start of term (takes 15 min)
- Students add resources they discover (approved by teacher)
- AI can suggest relevant resources from the library: "For your accessibility project, [Teacher X] has experience with inclusive design, and [Student Y from last year] built a similar tool"
- Resources are tagged by category, skill area, and availability

### Peer Connection

- Students working on similar themes can be flagged to each other: "Did you know [Student A] is also working on a sustainability project? You might want to compare notes."
- Peer feedback sessions: structured crit sessions (already part of the toolkit — Empathy Map, Six Thinking Hats could be used in pairs)
- NOT mandatory collaboration — Open Studio is about independence, but isolation is counterproductive

---

## Flexibility Across Project Types

Open Studio must work for radically different projects. The system should never assume a specific output format.

### Project Archetypes (AI uses these to adapt its mentoring):

| Archetype | Example | Key AI Focus |
|-----------|---------|-------------|
| **Make** | 3D print a device for a disabled friend, build an arcade machine, sew a garment | Materials/tools access, prototyping iterations, testing with users |
| **Research** | Investigate microplastics in the school creek, study gaming habits | Methodology, data collection, analysis, presentation of findings |
| **Lead** | Organise a school event, start a club, run a campaign | Planning, delegation, stakeholder management, reflection on leadership |
| **Serve** | Volunteer programme, care packages for homeless, peer tutoring | Needs assessment, logistics, impact measurement, ethical reflection |
| **Create** | Film a documentary, write a graphic novel, compose music | Creative process, feedback loops, audience consideration, technical skills |
| **Solve** | Design a better school bag, fix the canteen queue system, improve recycling | Problem definition, user research, ideation, prototyping, testing |
| **Entrepreneurship** | Start a small business, create a product, build a brand | Market research, business planning, financial literacy, pitching |

The AI identifies the archetype from the Discovery phase and adjusts:
- **Check-in questions** (a Make project gets "Can I see a photo of where you're at?" while a Research project gets "What data have you collected so far?")
- **Milestone templates** (pre-populated but editable — a Make project has "Materials gathered → First prototype → User test → Iteration → Final" while a Lead project has "Team formed → Plan approved → Event date set → Rehearsal → Event → Debrief")
- **Quality criteria** (what "good" looks like varies by archetype)
- **Resource suggestions** (different community resources per archetype)

---

## Implementation Roadmap

### Phase A — Foundation (builds on existing Open Studio code)
*~3-4 days*

1. **Discovery Conversation Flow** — AI-guided interview stored as structured profile
   - New API endpoint: `/api/student/open-studio/discovery`
   - Profile fields: strengths[], interests[], needs_identified[], project_statement, archetype
   - UI: conversational chat interface within the Open Studio banner area (reuse Design Assistant chat pattern)

2. **Project Contract & Timeline**
   - Student writes contract (structured form, not free text)
   - Timeline with milestones (reuse/adapt DesignPlanBoard or build new)
   - Teacher can view and adjust milestones
   - AI knows the end date and remaining sessions

3. **Quick Pulse micro-survey**
   - Single-tap emoji check-in (🟢🟡🟠🔴)
   - Shown at configurable intervals alongside existing check-in system
   - Stored in session activity log

### Phase B — Evidence & Monitoring
*~3-4 days*

4. **Multi-channel evidence collection**
   - Photo drop (camera/upload button on Open Studio banner)
   - Voice memo (Web Audio API → transcription via Whisper or similar)
   - Text check-in (existing, enhance with structured prompts)
   - Milestone check-off (tap to complete on timeline)

5. **AI Health Score model**
   - Rolling assessment of momentum, engagement, quality, self-awareness
   - Adaptive check-in frequency based on health score
   - Teacher dashboard health indicators (traffic light per student)

6. **Student Journey View (teacher side)**
   - Timeline visualization per student
   - Evidence trail (photos, memos, check-ins, submissions)
   - Milestone status (completed, upcoming, overdue)
   - Session journal (click to expand)

### Phase C — Community & Sharing
*~2-3 days*

7. **Community Resource Library**
   - Database table: `community_resources` (type, name, description, tags, added_by, approved)
   - Teacher seeds + student contributes (with approval)
   - AI suggests relevant resources during Working phase

8. **Sharing & Portfolio**
   - Auto-generated portfolio page from evidence trail
   - Student edits and polishes
   - Final reflection prompt
   - Shareable link (optional)

### Phase D — Polish & Intelligence
*~2-3 days*

9. **Cross-project learning**
   - AI remembers previous Open Studio profiles
   - "Last time you struggled with X — let's plan around that"
   - Teacher can see growth across units

10. **Peer connections**
    - Flag students with similar themes
    - Optional peer crit sessions using existing toolkit tools

---

## Open Questions

1. **Voice memos:** Whisper API for transcription? Or keep it simpler with text-only for MVP?
2. **Photo analysis:** Should the AI analyse submitted photos (vision model) to assess progress, or just store them as evidence?
3. **Community resources:** School-wide or per-class? School-wide is more powerful but harder to manage.
4. **Past project gallery:** Requires opt-in from previous students. Privacy policy implications?
5. **Offline work:** Many Make/Serve/Lead projects happen outside school. How do we capture evidence of work done offline? (Photo drop is the answer for most, but worth considering.)
6. **Parent visibility:** Should parents be able to see the journey/timeline? Big Picture Learning includes parents in the learning team.

---

## Design Principles (additions to existing Open Studio spec)

1. **Discovery before direction.** Never let a student start Planning without completing Discovery. A student who says "I already know what I want to do" still goes through a shortened Discovery to confirm and deepen their understanding of why.

2. **The AI never suggests projects.** It helps students discover their own. Offering categories or provocations is fine. "You should build a..." is not.

3. **Multiple evidence channels, student choice.** Some students are writers. Some are photographers. Some are talkers. The system accepts all of them. No single channel is required.

4. **Time honesty from day one.** The AI tells students exactly how many sessions they have. It helps them plan for reality, not fantasy. "You have 6 sessions. That's a prototype, not a polished product — and that's okay."

5. **Sharing is non-negotiable.** Every project ends with some form of presentation, even if the project isn't "done." Incomplete work with honest reflection is more valuable than a polished project with no learning.

6. **Community enriches, isolation impoverishes.** The system should actively connect students to people and resources. A student working alone for 8 weeks is a failure of the system, not a feature.

7. **The teacher is always in the loop.** The AI handles day-to-day mentoring. The teacher handles big decisions, human moments, and community connections. The dashboard should give teachers signal, not noise.

8. **Archetype-aware, not archetype-rigid.** Projects often span archetypes (a "Make" project might include "Research" and "Lead" elements). The AI adapts, doesn't constrain.

9. **Growth across cycles.** Open Studio gets better the second time. The AI remembers what worked and what didn't. Students build on their previous self-knowledge.

10. **Flexibility is the feature.** The same system works for "3D print a prosthetic hand" and "organize a school cleanup day" and "write a graphic novel" and "start a tutoring service." If it only works for one type of project, it's not Open Studio — it's a template.

---

## Sources

- [Big Picture Learning — Advisory Approach](https://bpea.school/our-advisory-approach/)
- [Big Picture Learning — How It Works](https://www.nextschool.org/how-big-picture/)
- [High Tech High — Project Based Learning](https://hthgse.edu/professional-development/pbl/)
- [High Tech High — Student Projects](https://www.hightechhigh.org/student-work/projects/)
- [IB MYP Personal Project](https://www.ibo.org/programmes/middle-years-programme/assessment-and-exams/personal-project/)
- [Cultivating Student Agency with the MYP Personal Project](https://mssphillips.wordpress.com/2021/11/17/cultivating-student-agency-with-the-myp-personal-project/)
- [CCR Passion Toolkit](https://curriculumredesign.org/passion-project-based-learning/)
- [AMLE — Implementing Genius Projects in Middle Grades](https://www.amle.org/research-to-practice-implementing-genius-projects-in-the-middle-grades/)
- [Genius Hour Challenges & Solutions](https://www.differentiatedteaching.com/genius-hour-in-the-classroom/)
- [NYSED — Instructors as "Guide on the Ride"](https://www.nysed.gov/edtech/lawrence-public-schools-instructors-guide-ride-implementing-genius-hour-and-focusing-student)
- [Frontiers — AI and Learner Autonomy Meta-Analysis](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1738751/full)
- [Evidence-Based Mentoring — AI in Mentoring](https://www.evidencebasedmentoring.org/mentor-in-the-loop-is-there-a-role-for-ai-in-mentoring-relationships/)
- [NCIEA — Self-Directed Learning Assessment](https://www.nciea.org/blog/instructing-assessing-21st-century-skills-a-focus-on-self-directed-learning/)
- [Frontline Education — Early Warning Indicators](https://www.frontlineeducation.com/analytics-software/student-performance-data/the-high-cost-of-dropouts-the-value-of-early-warning-indicators-to-identify-students-at-risk-of-disengagement/)
- [Panorama Education — Early Warning Systems](https://www.panoramaed.com/blog/what-a-districtwide-early-warning-system-should-look-like)
- [Cult of Pedagogy — Backward Design Basics](https://www.cultofpedagogy.com/backward-design-basics/)
- [PowerSchool — Helping Students Discover Strengths](https://www.powerschool.com/blog/how-to-help-students-discover-strengths/)
- [KaiPod Learning — 25 Self-Directed Learning Activities](https://www.kaipodlearning.com/25-self-directed-learning-activities-youll-want-to-try/)
