# Open Studio — Implementation Plan
*The Quest: How to Build It + The Visual Journey*
*20 March 2026*

---

## Part 1: The Visual Journey — "Your Quest"

### The Concept

Open Studio isn't a settings page. It's a **quest**. The student is the hero. The four phases (Discovery → Planning → Working → Sharing) are chapters of their story. The UI should feel like turning pages of a graphic novel — each student's journey is unique, and the visuals reflect that.

**Visual language:** Comic-book panels with a hand-drawn, slightly gritty illustration style (think Into the Spider-Verse meets Persepolis — bold, expressive, not cutesy). AI-generated hero images at key moments personalize the experience. Framer Motion drives all transitions — panels slide, stack, and reveal.

### The Journey Map

The centrepiece of Open Studio is a **visual journey map** that lives at the top of the student's Open Studio page. It shows where they've been, where they are, and where they're going.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  [DISCOVERY]──────[PLANNING]──────[WORKING]──────[SHARING]          │
│      ✓               ✓              ◉ ──────▶         ○              │
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐  ┌─────────┐   │
│  │ AI art: │  │ AI art: │  │    AI art:           │  │ AI art: │   │
│  │ student │  │ student │  │    student at work   │  │ student │   │
│  │ looking │  │ mapping │  │    (archetype-       │  │ present-│   │
│  │ through │  │ out a   │  │     specific)        │  │ ing to  │   │
│  │ telescope│  │ route   │  │                     │  │ crowd   │   │
│  └─────────┘  └─────────┘  └─────────────────────┘  └─────────┘   │
│                                                                      │
│  "I'm good at    "8 sessions.   "Prototype v2        "2 sessions   │
│   building and    Let's work     is working!"          until show   │
│   I care about    backward..."                         time"        │
│   accessibility"                                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### Panel Transitions (Framer Motion)

Each phase has a **comic panel** feel:

| Transition | Framer Motion Technique | Effect |
|-----------|------------------------|--------|
| **Phase entry** | `layoutId` + `AnimatePresence` | Current phase panel expands to fill the screen, other panels shrink to dots on a progress bar |
| **Evidence submission** | `motion.div` with `scale` spring | Photo/text/voice slides in from bottom like a speech bubble, settles into the evidence timeline |
| **Milestone completion** | `motion.div` with `rotate` + `scale` keyframes | Milestone marker bursts with a satisfying pop, confetti particles (lightweight, CSS-only) |
| **Phase completion** | Shared `layoutId` between panel and full-screen | Panel zooms to fill screen → page-turn wipe → next phase panel slides in from right |
| **AI check-in** | `motion.div` with `y` spring from bottom | AI message appears as a speech bubble attached to a small AI avatar at the bottom-right |
| **Quick Pulse** | `AnimatePresence` with `opacity` + `y` | Emoji row fades in at top of working area, fades out after selection |
| **Journey map scroll** | `useScroll` + `useTransform` | As student scrolls down the page, the journey map at top compresses into a thin progress bar that sticks to the top |

### AI-Generated Panel Art

At 4 key moments, the system generates a personalized comic panel illustration:

| Moment | What's Generated | Prompt Approach |
|--------|-----------------|-----------------|
| **Discovery complete** | Character portrait of the student's "quest hero" — a stylized avatar based on their project archetype | `"Comic panel illustration, [archetype]-themed hero character, bold ink lines, [student's project theme] motif, graphic novel style, no text"` |
| **Planning complete** | The hero looking at a map/blueprint of their journey | `"Comic panel, hero character studying a route map, [project-specific landmarks], hand-drawn style, adventure feeling"` |
| **Mid-point milestone** | The hero in the midst of their work (archetype-specific) | `"Comic panel, [Make: character at workbench with tools / Research: character with magnifying glass and data / Lead: character addressing a group / Serve: character helping someone], dynamic composition, ink and wash style"` |
| **Sharing ready** | The hero on a stage or presenting | `"Comic panel, hero character presenting to an audience, spotlight, confident pose, graphic novel style, celebration mood"` |

**Image generation approach:**
- Use the existing Claude/Anthropic pipeline for image generation prompts
- Generate at 512×512, display at panel size (~300×200)
- Cache in Supabase storage — generate once per phase completion
- Fallback: pre-made generic illustrations per archetype (7 sets × 4 phases = 28 illustrations) for when generation fails or is too slow
- **Student can regenerate** if they don't like the image (1 retry)

### Comic Speech Bubbles for AI

All AI interactions in Open Studio use **speech bubble styling** instead of plain chat:

```
     ┌──────────────────────────────┐
     │ Quick check — still feeling  │
     │ good about your direction?   │
     │ Anything to bounce off me?   │
     └──────────┬───────────────────┘
                │
            ┌───┴───┐
            │  🎨   │  ← AI avatar (small, consistent)
            └───────┘
```

- Tail points to AI avatar (bottom-right of screen, persistent but unobtrusive)
- Student responses go in a different-colored bubble (left-aligned, student's color)
- Keeps the comic/quest feel even during functional interactions
- Framer Motion: bubbles spring in with `y` + `opacity` + slight `rotate` for organic feel

---

## Part 2: Implementation Plan

### Architecture Overview

```
Open Studio Experience
├── /student/open-studio/[unitId]        ← Main journey page (new route)
│   ├── JourneyMap.tsx                    ← Visual progress map + panels
│   ├── DiscoveryFlow.tsx                 ← AI-guided discovery conversation
│   ├── PlanningBoard.tsx                 ← Backward planner + contract + timeline
│   ├── WorkingStudio.tsx                 ← Evidence collection + check-ins + pulse
│   ├── SharingPrep.tsx                   ← Portfolio builder + reflection
│   └── QuestBubble.tsx                   ← Comic speech bubble component
├── /teacher/open-studio/[unitId]         ← Teacher journey overview (new route)
│   ├── StudentJourneyView.tsx            ← Per-student timeline + evidence + health
│   ├── MilestoneManager.tsx              ← Drag milestones, set dates
│   ├── ClassJourneyBoard.tsx             ← All students at a glance
│   └── CommunityResourceEditor.tsx       ← Resource library management
├── API routes
│   ├── /api/student/open-studio/discovery    ← Discovery conversation + profile save
│   ├── /api/student/open-studio/plan         ← Contract + milestones CRUD
│   ├── /api/student/open-studio/evidence     ← Photo/voice/text submission
│   ├── /api/student/open-studio/pulse        ← Quick pulse emoji save
│   ├── /api/student/open-studio/panel-art    ← Trigger AI image generation
│   ├── /api/teacher/open-studio/journey      ← View student journeys
│   └── /api/teacher/open-studio/resources    ← Community resource CRUD
├── Database (new tables/columns)
│   ├── open_studio_profiles                  ← Discovery output (strengths, interests, archetype, project statement)
│   ├── open_studio_plans                     ← Contract + milestones
│   ├── open_studio_evidence                  ← Multi-channel evidence log
│   ├── open_studio_pulse                     ← Quick pulse history
│   ├── community_resources                   ← People/places/things library
│   └── open_studio_panel_art                 ← Generated panel image URLs
└── Shared components
    ├── QuestBubble.tsx                       ← Comic speech bubble (reusable)
    ├── JourneyProgress.tsx                   ← Compact progress indicator
    ├── EvidenceCard.tsx                      ← Photo/voice/text display card
    └── MilestoneMarker.tsx                   ← Milestone node for timeline
```

### Sprint Plan

#### Sprint 1: Discovery + Journey Map (~4 days)

**Day 1-2: Database + Discovery API**
- Migration 030: `open_studio_profiles` table (student_id, unit_id, strengths JSONB, interests JSONB, needs_identified JSONB, project_statement TEXT, archetype TEXT, discovery_conversation JSONB, completed_at TIMESTAMPTZ)
- Discovery API route: multi-turn conversation with Claude (Haiku 4.5)
  - System prompt: structured interview following the 5-step Discovery Flow
  - Each turn extracts structured data (strengths, interests) from conversation
  - Final turn produces the profile summary
- Student can re-enter Discovery (edit their profile) at any time

**Day 2-3: Journey Map + Panel Art**
- `JourneyMap.tsx` — horizontal 4-phase progress with comic panels
  - Framer Motion `layoutId` for expand/collapse
  - `useScroll` for sticky compression to thin bar
  - Phase dots: completed (✓), current (◉), future (○)
- `QuestBubble.tsx` — reusable comic speech bubble component
  - Props: `direction` (left/right), `color`, `tail` (boolean), `avatar`
  - Framer Motion entrance: spring `y` + `opacity`
- Panel art generation endpoint (can be placeholder images for Sprint 1)
- Generic archetype illustrations as fallback (commission or generate a set of 28)

**Day 3-4: Discovery UI**
- `DiscoveryFlow.tsx` — conversational UI using QuestBubble
  - Reuses Design Assistant chat pattern but with comic styling
  - AI messages in speech bubbles, student types in input below
  - Progressive profile building: sidebar shows strengths/interests filling in
  - Final screen: project statement + archetype selection confirmation
  - "Begin Planning →" CTA when discovery complete
- Wire into existing Open Studio banner as entry point

#### Sprint 2: Planning + Timeline (~3 days)

**Day 5-6: Planning Backend + Contract**
- Migration 031: `open_studio_plans` table (student_id, unit_id, contract JSONB, milestones JSONB, end_date DATE, remaining_sessions INT, created_at, updated_at)
- Planning API:
  - GET endpoint returns plan + calculated remaining sessions
  - POST/PATCH for contract and milestones
  - AI endpoint for backward planning conversation
- Time calculation logic:
  - Read unit end date from teacher settings
  - Calculate school days remaining (exclude weekends, holidays if entered)
  - Estimate Open Studio sessions remaining based on teacher's schedule

**Day 6-7: Planning UI**
- `PlanningBoard.tsx`:
  - **Vision of Done** section (AI-guided, 2-3 prompts)
  - **Student Contract** form (structured, not free text):
    - What I'm making/doing
    - Who it's for
    - What "done" looks like
    - What help I'll need
  - **Milestone Timeline** — vertical timeline with draggable milestones
    - Pre-populated from archetype template
    - Student adjusts, AI validates ("That's ambitious for 6 sessions...")
    - Each milestone: title, target date, description, status
  - **Resource identification** — "Who/what could help?" (seeds Community Library)
- Framer Motion: milestones animate in staggered from left, contract sections reveal as student completes each one

#### Sprint 3: Working Studio + Evidence (~4 days)

**Day 8-9: Evidence Collection Backend**
- Migration 032: `open_studio_evidence` table (id, student_id, unit_id, session_id, channel TEXT, content JSONB, created_at)
  - Channel types: `photo`, `voice`, `text`, `milestone_check`, `submission`, `reflection`, `ai_conversation`
- Evidence API:
  - POST: accept photo upload (Supabase Storage), text, voice (future), milestone check-off
  - GET: evidence timeline for student or teacher view
- Pulse API: simple emoji + timestamp storage
- Health Score calculation:
  - Runs server-side on each evidence submission
  - Checks: milestone progress, evidence frequency, quality indicators, pulse history
  - Returns: momentum/engagement/quality/self-awareness scores (0-100 each)
  - Stores rolling score on `open_studio_sessions`

**Day 9-10: Working Studio UI**
- `WorkingStudio.tsx` — the main working screen:
  - **Evidence toolbar** (sticky at bottom):
    - 📸 Photo drop (camera/file upload)
    - 💬 Text check-in (quick input)
    - ✅ Milestone check-off (tap to complete)
    - 📎 Work submission (file upload)
    - 📝 Reflection (longer text, AI can prompt)
  - **Evidence timeline** — scrolling feed of submitted evidence, newest at top
    - Each card: `EvidenceCard.tsx` with type icon, content preview, timestamp
    - Photos shown as thumbnails, expandable
    - Framer Motion: new evidence springs in from bottom
  - **Quick Pulse** — periodic emoji bar (🟢🟡🟠🔴) slides in at top
  - **AI check-in** — speech bubble from AI avatar, adaptive frequency

**Day 10-11: Health Score + Adaptive Check-ins**
- Wire health score into `useOpenStudio` hook
- Adaptive check-in frequency based on score thresholds
- Teacher dashboard health indicators:
  - Traffic light per student (green/amber/red)
  - Click to expand: see momentum, engagement, quality, self-awareness breakdown
  - Alert badges for students needing attention

#### Sprint 4: Teacher View + Community + Sharing (~4 days)

**Day 12-13: Teacher Journey View**
- `StudentJourneyView.tsx`:
  - Visual timeline per student (same journey map as student, but with teacher controls)
  - Evidence trail: all submissions in chronological order
  - Health score history (sparkline)
  - Milestone management: drag to adjust dates, mark complete, add notes
  - Session journal: click to expand any session's activity
- `ClassJourneyBoard.tsx`:
  - Grid of all students with:
    - Current phase badge (Discovery/Planning/Working/Sharing)
    - Health traffic light
    - Days until next milestone
    - Alert flags
  - Sort by: health score, phase, milestone proximity

**Day 13-14: Community Resource Library**
- Migration 033: `community_resources` table (id, school_id, type TEXT, name, description, tags JSONB, added_by, approved BOOLEAN, unit_scope TEXT)
- Teacher UI: `CommunityResourceEditor.tsx`
  - Add/edit/remove resources
  - Approve student-submitted resources
  - Tag by category and skill area
- Student UI: resource suggestions appear in Planning and Working phases
  - AI suggests relevant resources from the library
  - Student can add their own (pending teacher approval)

**Day 14-15: Sharing + Portfolio**
- `SharingPrep.tsx`:
  - Auto-generated portfolio page from evidence trail
  - Student edits: reorder, add captions, remove items
  - Final reflection prompt (AI-guided)
  - Shareable link (optional, teacher-controlled)
- Journey completion animation:
  - All 4 panels zoom into view
  - Final panel art generated
  - Confetti burst
  - "Your quest is complete" message

#### Sprint 5: Polish + Panel Art + Cross-Cycle Learning (~3 days)

**Day 16-17: AI Panel Art Generation**
- Wire up image generation for the 4 key moments
- Generate archetype-specific prompts from student's Discovery profile
- Fallback illustration set (7 archetypes × 4 phases = 28 static images)
- Student can regenerate once per phase

**Day 17-18: Cross-Cycle Intelligence**
- AI remembers previous Open Studio profiles across units
- "Last time you discovered..." opening for returning students
- Teacher can see growth patterns across cycles
- Portfolio pages accumulate across units → portfolio timeline

### Total: ~18 days across 5 sprints

---

## Part 3: Key Technical Decisions

### 1. Dedicated Open Studio Route vs. Embedded in Unit Page

**Recommendation: Dedicated route at `/student/open-studio/[unitId]`**

Open Studio is a fundamentally different experience from the guided unit pages. Embedding it in the existing unit page would create UX confusion (am I in guided mode or Open Studio?). A dedicated route with its own visual language (comic panels, quest map) makes the mode switch tangible.

The existing `OpenStudioBanner` on the unit page becomes a **portal** — "Enter Open Studio →" takes you to the full quest experience.

### 2. Image Generation: When and How

**Recommendation: Generate on phase completion, cache permanently**

- Trigger: when a student completes a phase (Discovery, Planning, mid-point milestone, Sharing prep)
- Generation: async job, student sees a "generating your panel..." placeholder
- Storage: Supabase Storage bucket, URL saved in `open_studio_panel_art`
- Fallback: static archetype illustrations (always available, instant)
- Cost: ~$0.04-0.08 per image (4 per journey = ~$0.20-0.32 per student)
- Rate limit: 1 generation + 1 retry per phase per student

### 3. Voice Memos

**Recommendation: Defer to Sprint 6 (post-MVP)**

Web Audio API → client-side recording → upload to Supabase Storage → transcription is a significant feature. For MVP, text and photo are the low-friction channels. Voice can be added later without changing the architecture (it's just another evidence channel type).

### 4. Health Score: Client or Server

**Recommendation: Server-side, computed on evidence submission**

The health score should be authoritative (not gameable by client manipulation). It runs as a lightweight scoring function in the evidence API route. The score is stored on the session record and returned in dashboard API responses.

### 5. Journey Map: Canvas, SVG, or DOM

**Recommendation: DOM + Framer Motion (not Canvas or SVG path)**

Canvas is powerful but hard to make accessible and responsive. SVG paths are elegant but complex to animate. DOM elements with Framer Motion are the simplest approach that gives us:
- Responsive layout (CSS grid/flex)
- Accessible (semantic HTML)
- Rich animations (Framer Motion springs, layout animations)
- Easy to iterate on

The journey map is a horizontal flex row of 4 phase cards. Completed phases have their panel art. Current phase is expanded. Future phases are dimmed.

---

## Part 4: What Makes This "Best Ever"

The gap between existing self-directed learning tools and what we're building:

| Feature | Existing Tools | Open Studio |
|---------|---------------|-------------|
| **Discovery** | "Pick a topic from this list" | AI-guided self-discovery conversation that maps strengths → interests → needs → project |
| **Planning** | Generic project planner | Time-aware backward planning from actual end date, per-student |
| **Progress tracking** | Teacher manually checks in | Multi-channel evidence (photo/text/milestone) with AI health scoring |
| **Mentoring** | Scheduled teacher meetings | AI studio critic with adaptive frequency, archetype-aware prompts |
| **Motivation** | Points and badges | Personalized visual quest with AI-generated comic panels |
| **Community** | None | Resource library of people, places, and past projects |
| **Flexibility** | One project template | 7 archetypes with adapted milestones, check-ins, and quality criteria |
| **Cross-cycle** | Each project is standalone | AI remembers previous journeys, builds on self-knowledge |
| **Sharing** | Optional presentation | Non-negotiable, with auto-generated portfolio |

The visual quest journey is what makes it memorable. Students don't just "complete a project" — they go on a quest, see their story unfold in comic panels, and end with a shareable portfolio that tells their story.

---

## Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Framer Motion | ✅ Installed | Already in package.json from fan menu rebuild |
| Supabase Storage | ✅ Available | Need to create `open-studio-evidence` and `open-studio-art` buckets |
| AI Image Generation | ⚠️ Need to decide | Claude doesn't generate images. Options: DALL-E 3, Stable Diffusion, or pre-made illustrations |
| Web Audio API | 🔜 Defer | Voice memos deferred to post-MVP |
| Existing Open Studio code | ✅ Built | Migration 029, API routes, hooks, components all in place |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI Discovery conversation feels stilted | Medium | High | Extensive prompt engineering + testing with real students. Use the education AI patterns (effort-gating, Socratic). |
| Image generation too slow | Medium | Medium | Generate async, show placeholder, cache permanently. Fallback static illustrations always available. |
| Students skip Discovery ("I already know what to do") | High | Medium | Shortened Discovery path for students with clear ideas — still maps strengths/archetype, just faster. |
| Health score feels like surveillance | Medium | High | Score is teacher-only. Student never sees a number. They see encouragement or concern, not metrics. |
| Comic visual style doesn't land | Low | Medium | Test with 2-3 students before full rollout. Style can be swapped (the architecture is visual-theme-agnostic). |
| Too many evidence channels overwhelm students | Medium | Medium | Start with photo + text only. Add others as students request them. The system accepts all but requires none. |
