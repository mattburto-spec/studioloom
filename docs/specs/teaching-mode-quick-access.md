# Teaching Mode Quick-Access Toolbar — Feature Spec

*Created: 21 March 2026*

## The Problem

Teachers in front of a class can't dig through menus. Every second spent clicking is a second of lost classroom momentum. The current Teaching Mode has good bones (3-column layout, phase timer, student grid, notes) but **everything lives in the right sidebar behind collapsible sections**. There's no quick-access layer for the things teachers reach for 20 times per lesson.

## What World-Class Looks Like

After studying Nearpod, ClassPoint, Pear Deck, and SMART iQ:

| Product | Key Pattern | What StudioLoom Can Learn |
|---------|------------|--------------------------|
| **Nearpod** | "On the Fly" dropdown — teachers insert polls, timers, collaborate boards mid-lesson without leaving the flow. Quick Launch for instant activities. | **Activity insertion should be 1 click, not a page navigation.** |
| **ClassPoint** | Persistent teaching toolbar overlaid on slides — timer, name picker, annotations, browser, all accessible without leaving slideshow. | **Toolbar should float over everything, always visible, never hidden.** |
| **Pear Deck** | Teacher sees private student responses while projecting anonymous answers to class. Split view: control on laptop, display on projector. | **StudioLoom already has this pattern (dashboard + projector). Lean into it harder.** |
| **SMART iQ** | Split-screen mode — activity + whiteboard side by side. Timer widget lives on top of everything. | **Timer should be extractable as a floating widget, not locked in the center column.** |

### The Universal Pattern

World-class teaching tools all share one UX principle: **everything the teacher touches more than 3 times per lesson should be accessible in ≤1 click from any state.** No scrolling, no expanding, no navigating to another page.

## What's Missing in StudioLoom Teaching Mode

### 1. Quick Edit (Lesson Content)
**Current:** No way to edit lesson content from Teaching Mode. Teacher has to leave, go to unit builder, find the page, edit, come back.
**Need:** One-click inline edit for the things that change mid-class:
- Edit the opening hook ("that hook didn't land, let me rephrase")
- Tweak a prompt ("students aren't understanding the question")
- Adjust a timer duration ("they need 5 more minutes")
- Add/edit a teacher note ("remember to mention X next time")

### 2. Time Representation
**Current:** PhaseTimer exists but it's a full component locked in the center column. No quick way to:
- Drop a simple countdown timer ("you have 5 minutes for this")
- See total elapsed class time
- See time remaining in the period
- Quickly adjust phase time without going through full timer controls

### 3. Quick Activity Insert
**Current:** Lesson activities are pre-generated. No way to inject something spontaneous.
**Need:** "On the Fly" activities that appear on students' screens instantly:
- Quick poll ("thumbs up/thumbs down", "1-5 scale")
- Exit ticket (single open-ended question)
- Think-pair-share prompt
- Show-me (students hold up their work / upload a photo)
- Collaborate board (shared brainstorm space)

### 4. Classroom Tools (from existing roadmap)
Already identified in roadmap Phase 4 — these belong in the quick-access toolbar:
- Random student picker (spin wheel or card draw)
- Ad-hoc countdown timer
- Group maker (random groups of 2/3/4)
- Noise meter (mic-based, the "wow" feature)

---

## Proposed Design: The Teaching Toolbar

A **floating horizontal toolbar** at the bottom of the Teaching Mode screen (above the fold, always visible). Think of it like a macOS Dock or a game HUD — the tools you need at your fingertips, not buried in panels.

### Toolbar Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  ⏱ 12:34  │  ▶ Phase  │  ✏️ Edit  │  ⚡ Activity  │  🎲 Tools  │  📺 Project │
│  elapsed   │  timer    │  lesson   │  on-the-fly   │  classroom  │  to screen  │
└────────────────────────────────────────────────────────────────────┘
```

Each button opens a **popover panel** (not a modal, not a page navigation). Popover floats above the toolbar and dismisses on click-outside.

### 1. Clock / Time (`⏱`)

**Always visible** in the toolbar — no click needed.

- **Elapsed time**: how long class has been running (starts when teacher opens Teaching Mode, or manual start)
- **Period remaining**: calculated from school schedule if configured, otherwise manual "period ends at" input
- **Phase progress**: compact mini-bar showing current workshop phase with time left

**Popover (on click):**
- Quick countdown timer: tap preset buttons (1m, 2m, 3m, 5m, 10m, custom)
- Timer appears on both teacher dashboard AND projector view simultaneously
- Optional: timer visible on student screens too (toggle)
- Stop/pause/reset controls
- Multiple simultaneous timers (e.g., "group timer" + "phase timer")

### 2. Phase Timer (`▶`)

**Shows current phase name + time remaining** in the toolbar.

- Click to expand full PhaseTimer controls (play/pause/skip/reset)
- One-click phase skip (teacher decides "opening is done, move to mini-lesson")
- Syncs with projector view via postMessage

### 3. Quick Edit (`✏️`)

**Popover with inline-editable fields for the current lesson:**

- **Opening Hook** — textarea, edit in place, save
- **Learning Goal** — textarea
- **Mini-Lesson Focus** — textarea
- **Debrief Prompt** — textarea
- **Teacher Notes** — free-form, persisted per-lesson
- **Phase Durations** — quick +/- buttons (±1 min, ±5 min) per phase

Changes save immediately (debounced auto-save to DB). Green checkmark flash on save.

**Key constraint:** These edits modify the unit's `content_data` JSONB in the database. This means changes are permanent (for next time you teach this lesson too). Add a visual indicator: "Changes save to lesson" with an undo option.

### 4. On-the-Fly Activity (`⚡`)

**Popover with activity templates — one tap to deploy to student screens:**

| Activity | What Students See | Data Collected |
|----------|------------------|----------------|
| **Quick Poll** | 2-5 option buttons (teacher types options or uses presets: thumbs up/down, 1-5 scale, A/B/C/D, agree/disagree) | Per-student responses, live aggregate bar chart on teacher + projector |
| **Exit Ticket** | Single open-ended text input with the teacher's prompt | Responses stream in on teacher dashboard |
| **Show Me** | Camera/upload button ("Show your work") | Photos appear in teacher grid |
| **Think-Pair-Share** | Prompt + partner assignment + shared response area | Text responses + pair feedback |
| **Collaborate Board** | Shared sticky-note board (all students post simultaneously) | All posts with student names |
| **Quick Reflection** | 1-3 sentence reflection with sentence starters | Text responses, effort-gated |

**How it works:**
1. Teacher taps activity type
2. Popover shows a minimal form (just the prompt text + any options)
3. Teacher taps "Push to Students"
4. Activity appears as a modal/overlay on all connected student screens
5. Responses stream back in real-time on the teacher dashboard
6. Teacher taps "Close Activity" to dismiss from student screens
7. Responses auto-save to the lesson's activity log (JSONB, queryable later)

**Technical:** New API route `POST /api/teacher/teach/on-the-fly` creates an activity record. Student pages poll or subscribe (WebSocket upgrade later) for active on-the-fly activities. Student UI renders the activity as a floating modal.

### 5. Classroom Tools (`🎲`)

**Popover with instant classroom management tools:**

- **Random Picker**: Enter student names (auto-loaded from class roster) → spin animation → selected student highlighted. Options: "Pick again", "Remove from pool" (so same student isn't picked twice). Wheel spin or card flip animation.
- **Group Maker**: Slider for group size (2/3/4/5) → generates random groups → display on teacher + projector. Option: "Balanced" (mixes ability levels if data available).
- **Countdown Timer**: Separate from phase timer. Presets: 30s, 1m, 2m, 3m, 5m, 10m, custom. Shows on projector. Optional sound/vibration at zero.
- **Noise Meter**: Uses browser `getUserMedia` mic API. Visual meter (green → yellow → red). Threshold configurable. Shows on projector. The "wow" feature — students self-regulate when they see it.
- **Stopwatch**: Count up from 0. For timed activities where duration isn't predetermined.

### 6. Project to Screen (`📺`)

**Quick projection controls:**

- Push current phase content to projector
- Push a specific activity or prompt to projector
- Push the on-the-fly activity results to projector
- Toggle "student names visible" on projector (for anonymous vs. named responses)
- Blank/freeze projector (for private teacher moments)

---

## Implementation Phases

### Phase 1: Toolbar + Time + Classroom Tools (~3-4 days)
- Floating toolbar component at bottom of Teaching Mode
- Clock (elapsed time + period remaining)
- Quick countdown timer (presets + custom)
- Random student picker (from class roster)
- Group maker
- Stopwatch
- All tools project to projector via postMessage

### Phase 2: Quick Edit (~2 days)
- Inline edit popover for current lesson fields
- Debounced auto-save to `content_data` JSONB
- Undo support (keep previous value for 30s)
- Phase duration quick-adjust (+/- buttons)

### Phase 3: On-the-Fly Activities (~4-5 days)
- Database: `on_the_fly_activities` table (teacher_id, class_id, unit_id, page_id, type, prompt, options, responses JSONB, status, timestamps)
- Teacher API: create/close/get-responses
- Student polling: check for active on-the-fly activity every 5s
- Student UI: floating modal overlay for each activity type
- Teacher UI: real-time response streaming in popover
- Projector: live aggregate display (poll bar chart, response count, collaborate board)

### Phase 4: Noise Meter + Polish (~2 days)
- Browser mic access via getUserMedia
- Volume level processing + threshold detection
- Visual meter component (SVG arc or bar)
- Projector view integration
- Sound/animation at threshold breach

**Total estimate: ~11-13 days**

---

## Design Principles

1. **1-click or it doesn't exist.** If a teacher has to click twice to start a timer, they'll use their phone instead. Every tool must be accessible in a single tap from the toolbar.

2. **Popovers, not modals.** Modals block the view. Popovers float above the content so the teacher can still see the student grid while adjusting a timer or writing a poll question.

3. **Always sync to projector.** Anything visual (timer, poll results, random picker animation, noise meter) should automatically appear on the projector view. Teachers shouldn't have to think about "how do I show this to the class."

4. **Fire and forget.** Push an activity, see responses come in, close it. No multi-step wizards. No configuration screens. The teacher is standing in front of 25 students — every interaction must be completable in under 5 seconds.

5. **Persist everything.** Every on-the-fly activity, every timer used, every edit made — logged to the lesson's activity log. This data feeds into post-lesson reflection and future lesson improvement.

---

## Competitive Position

| Feature | Nearpod | ClassPoint | Pear Deck | **StudioLoom** |
|---------|---------|------------|-----------|---------------|
| Floating toolbar | ❌ (top menu) | ✅ (overlay) | ❌ | ✅ (planned) |
| On-the-fly activities | ✅ (3 types) | ✅ (8 types) | ❌ | ✅ (6 types planned) |
| Timer as widget | ✅ | ✅ | ❌ | ✅ (planned, multi-timer) |
| Random picker | ❌ | ✅ | ❌ | ✅ (planned) |
| Group maker | ❌ | ❌ | ❌ | ✅ (planned) |
| Noise meter | ❌ | ❌ | ❌ | ✅ (planned — differentiator) |
| Live student grid | ✅ | ❌ | ✅ | ✅ (built) |
| Phase-aware timing | ❌ | ❌ | ❌ | ✅ (built — Workshop Model) |
| Quick lesson edit | ❌ | ❌ | ❌ | ✅ (planned — differentiator) |
| Projector sync | ✅ | ✅ (in PPT) | ✅ | ✅ (built) |
| AI-powered activities | ✅ (limited) | ✅ (quiz gen) | ❌ | ✅ (future — AI generates poll questions from lesson content) |

**StudioLoom's unique advantages:**
- **Workshop Model phase awareness** — no other tool structures the lesson into pedagogically-backed phases with timing
- **Quick edit** — no other tool lets you edit lesson content from the teaching view
- **Noise meter** — surprisingly nobody has this built in (teachers currently use separate apps like Bouncy Balls or Too Noisy)
- **On-the-fly + student grid combined** — see who responded, who's stuck, who needs help, all in one view
- **AI context** — future: "Generate a poll question about what we just covered" using the lesson's learning goal + content

---

## Open Questions

1. **Real-time vs polling for on-the-fly activities?** Current Teaching Mode uses 8s polling. On-the-fly activities need faster feedback (responses should appear within 1-2s). Options: (a) reduce poll interval to 2s when activity is active, (b) Supabase Realtime subscription, (c) Server-Sent Events. Recommendation: start with 2s polling, upgrade to Realtime later.

2. **Toolbar position: bottom or top?** Bottom (like macOS Dock) keeps it out of the header and near the student grid. Top toolbar (like ClassPoint) is more traditional. Recommendation: bottom — it's different, and the top is already crowded with the header bar.

3. **Mobile teaching?** iPad teachers exist. The floating toolbar needs to work at tablet width. Recommendation: toolbar collapses to a FAB with radial menu on screens <1024px.

4. **Noise meter privacy?** Browser mic access will trigger a permission prompt. Some schools may block mic access. Need graceful fallback ("Noise meter unavailable — mic access required"). Never record or transmit audio — only process volume levels locally.

5. **On-the-fly activity storage?** Where do responses live? Options: (a) new table `on_the_fly_activities` with responses JSONB, (b) append to existing lesson activity log, (c) both. Recommendation: new table for clean separation, with a link to the lesson for context.
