# StudioLoom — IB Project Companion Expansion

## Vision

Expand StudioLoom from an MYP Design-specific platform into a universal IB project companion that supports student-led, long-term projects across the IB continuum. When a teacher logs in, they select their programme context — MYP Design, Personal Project, PYP Inquiry, Extended Essay — and StudioLoom adapts its interface, process stages, assessment criteria, and AI assistant behaviour accordingly.

The core thesis: every IB long-term project shares the same fundamental needs — planning, process documentation, reflection, evidence collection, supervisor feedback, and criterion-based assessment. ManageBac handles the administrative compliance layer. Toddle handles teacher planning and family communication. Nobody owns the student-facing experience. StudioLoom becomes the tool students actually open.

---

## Market Context

### The Gap

IB schools currently cobble together ManageBac worksheets + Google Docs/Sites + Toddle/Seesaw + printed handbooks to manage student project workflows. The student experience is fragmented and uninspiring. ManageBac's PP and EE modules are form-filling exercises. Toddle is focused on teacher planning and portfolios, not structured student project management.

### Addressable Market

- **PYP:** 1,000+ schools on Toddle alone; thousands more worldwide running inquiry-based units
- **MYP Personal Project:** 1,178 schools across 123 countries submitted PP results in May 2025; over 103,000 MYP students participated in assessments
- **DP Extended Essay:** Every IB Diploma candidate (200,000+ students/year) must complete an EE
- **MYP Design:** Current StudioLoom target (already in progress)

### Competitors

| Platform | Strength | Weakness |
|---|---|---|
| **ManageBac** | Full IB SIS, admin workflows, eCoursework submission | Student UX is form fields and text boxes; no engagement layer |
| **Toddle** | Teacher planning, AI lesson tools, family communication, 30K+ PYP educators | Not built for structured student project management; limited MYP/DP support |
| **RevisionDojo** | EE supervision dashboards and analytics | DP-only; layered on top of existing workflows rather than rethinking them |
| **Seesaw** | Simple student portfolio tool | No IB alignment, no project structure, declining relevance |

### StudioLoom's Position

A student-facing project companion that sits alongside ManageBac (not replacing it). Schools keep ManageBac for compliance, reporting, and eCoursework submission. Students use StudioLoom for the actual work of planning, documenting, reflecting, and staying organised. Teachers use StudioLoom's dashboard for real-time visibility into student progress and formative feedback.

---

## Programme Modes

### How It Works

On login, the teacher selects or creates a class with a programme type. Students joining via class code inherit that programme's process framework, assessment criteria, portfolio structure, and AI assistant personality.

### Mode 1: MYP Design (Current)

- **Process:** Inquiring & Analysing → Developing Ideas → Creating the Solution → Evaluating
- **Assessment:** Criteria A–D (max 8 each, 32 total)
- **Portfolio:** Design-focused with sketches, prototypes, testing evidence
- **AI assistant:** Design process coaching, criterion-specific feedback
- **Status:** Active development

### Mode 2: MYP Personal Project (First Expansion)

- **Process:** Investigating → Planning → Taking Action → Reflecting
- **Assessment:** Criteria A–D (Investigating, Planning, Taking Action, Reflecting — max 8 each, 24 total)
- **Duration:** ~25 hours over several months
- **Key features needed:**
  - Process journal with rich media (photos, videos, links, files)
  - ATL skills self-assessment and tagging (Research, Communication, Self-Management, Thinking, Social)
  - Supervisor meeting log and feedback loop
  - Success criteria builder for the product/outcome
  - Academic honesty declaration workflow
  - Timeline/milestone tracker with deadlines
- **AI assistant:** Prompts reflections, helps refine research questions, suggests ATL skill connections, flags when process journal entries are thin
- **Why first:** Same age group as MYP Design, same schools, natural cross-sell. Teachers at NIS already manage PP — immediate internal testing opportunity.

### Mode 3: PYP Inquiry

- **Process:** Flexible/configurable inquiry cycle (e.g. Tuning In → Finding Out → Sorting Out → Going Further → Making Conclusions → Taking Action)
- **Assessment:** Teacher-defined formative; aligns to Inquiry Learning Progressions (ILPs) and ATL skills
- **Duration:** Unit-length (typically 6–8 weeks)
- **Key features needed:**
  - Age-appropriate UI (drag-drop, visual, minimal text input for younger students)
  - "Wonder wall" — student questions and wonderings that evolve over the unit
  - Simple evidence capture (photo/drawing upload, voice recording, short text)
  - Layered portfolio pages: student work layer + reflection layer + ATL skills layer + teacher observation layer
  - Transdisciplinary theme and key concept tagging
  - Class-level inquiry board view for the teacher
- **AI assistant:** Gentler tone, question-prompting rather than feedback-giving, supports ELL students with sentence starters and vocabulary scaffolds
- **Consideration:** PYP kids (ages 5–11) need a fundamentally different interaction model. Younger students may need parent/teacher mediation. Consider a simplified "junior mode" for early years vs. upper PYP.

### Mode 4: DP Extended Essay (Future)

- **Process:** Topic exploration → Research question → Research & reading → Writing → Reflection sessions (RPPF) → Viva voce
- **Assessment:** Criteria A–E (Focus & Method, Knowledge & Understanding, Critical Thinking, Presentation, Engagement — max 34 points)
- **Duration:** ~40 hours over 12+ months
- **Key features needed:**
  - Research log and source management (integrate with citation tools)
  - RPPF reflection scaffolding (3 formal reflections: initial, interim, final/viva voce)
  - Draft management with version history
  - Supervisor feedback on single draft (IB rule: supervisors read and comment on one draft only)
  - Word count tracker
  - Subject-specific guidance references
- **AI assistant:** Research methodology support, reflection depth coaching, helps students articulate their engagement with the topic. Must respect IB academic honesty boundaries — assists with process, never writes content.
- **Note:** The EE guide is being updated for May 2027 first assessment with new criteria and an interdisciplinary pathway option. Build to the new spec.

---

## Shared Architecture

### What Already Exists in StudioLoom (Reusable)

- Auth system with class codes (teacher creates class → students join with code)
- Teacher dashboard with student progress overview
- Supabase backend (auth, database, storage, realtime)
- AI assistant infrastructure (Anthropic API integration)
- ELL/UDL support features
- Gamification layer (XP, achievements, streaks)
- Kanban board (adaptable to any process stages)
- Gantt/timeline view

### Core Data Model Extension

The key insight is that every programme mode shares the same underlying entities:

```
Project
├── programme_type (myp_design | personal_project | pyp_inquiry | extended_essay)
├── process_stages[] (configured per programme)
├── milestones[] (deadlines, checkpoints)
├── portfolio_entries[]
│   ├── evidence (files, photos, links, text)
│   ├── reflections[]
│   ├── skill_tags[] (ATL skills, ILP indicators)
│   ├── teacher_feedback[]
│   └── criterion_alignment[]
├── supervisor_meetings[]
└── assessment (criterion scores + comments)
```

Each programme mode configures:
- Which process stages are available and what they're called
- Which assessment criteria apply and their descriptors
- Which skill frameworks are taggable (ATL categories, ILP indicators)
- UI complexity level (junior vs. standard vs. advanced)
- AI assistant behaviour profile

### Portfolio Layer System

Each portfolio page/entry has stackable layers:

1. **Evidence layer** — the student's actual work (what they made/found/did)
2. **Reflection layer** — what they learned, challenges faced, decisions made
3. **Skills layer** — ATL skills demonstrated, self-assessment
4. **Feedback layer** — teacher/supervisor comments, formative notes
5. **Assessment layer** — criterion alignment, scores (visible to teacher only until published)

For PYP, layers 1–3 are simplified (visual, drag-drop, stickers/stamps). For EE, layers expand to include source citations, draft versions, and formal RPPF reflections.

---

## Rollout Strategy

### Phase 1: Personal Project Mode (Next Priority)

- Add programme_type to class creation flow
- Build PP-specific process stages and criteria
- Extend portfolio with process journal functionality
- Add ATL skills tagging
- Add supervisor meeting log
- Adapt AI assistant prompts for PP context
- Internal pilot at NIS with PP coordinators

### Phase 2: PYP Inquiry Mode

- Design junior-friendly UI variant
- Build configurable inquiry cycle stages
- Add wonder wall and class inquiry board
- Implement layered portfolio for younger learners
- Simplify evidence capture (camera-first, voice notes)
- Partner with PYP colleague for co-design and testing

### Phase 3: Extended Essay Mode

- Build research log and source management
- Implement RPPF scaffolding and formal reflection workflow
- Add draft management with version history and word count
- Build to updated May 2027 EE guide spec
- Ensure AI assistant respects academic honesty boundaries

### Phase 4: Cross-Programme Features

- Coordinator dashboard (overview across all programme types in a school)
- Analytics and reporting (ATL skill development over time, engagement metrics)
- ManageBac data export/sync (if API access is available)
- Parent/family view for PYP

---

## Key Differentiators

1. **Student-first UX** — gamified, engaging, designed for students to want to open it (not just compliance)
2. **AI-powered reflection coaching** — contextual prompts that deepen student thinking without writing for them
3. **Unified platform across IB programmes** — one tool that grows with the student from PYP through DP
4. **Layered portfolios** — rich, multi-dimensional evidence of learning, not just flat uploads
5. **Real project management tools** — Kanban, timelines, milestones adapted for student use, not just worksheets
6. **ELL/UDL built in** — not bolted on; supports the full diversity of IB classrooms

---

## Open Questions

- Should the PYP mode support both classroom teacher use (whole class inquiry) and specialist teacher use (standalone subject inquiries)?
- What's the minimum viable PYP age? Can we support Grade 3+ (age 8+) independently, with Grade 1–2 requiring teacher mediation?
- Is there appetite for a Community Project mode (MYP service-learning, group-based) as a variant of PP?
- How tightly should we integrate with ManageBac? Light export (PDF/CSV) vs. API sync vs. staying fully independent?
- Does the gamification layer make sense for EE students, or does it need a more mature engagement model for DP?
- Pricing model: per-teacher, per-school, or per-programme? Freemium with limited students?
