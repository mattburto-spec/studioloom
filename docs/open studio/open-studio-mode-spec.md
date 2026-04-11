# Open Studio Mode — Specification

**Status:** Draft v0.1
**Owner:** Matt
**Related docs:** Wayfinder, Stones, Recalibration Ritual, Drift Detection, Work Capture Pipeline, Studio Desk UI

---

## 1. Purpose

Open Studio is a mode a student earns, not a mode the teacher assigns by default. It is the Loominary answer to the question: *how do we give learners real autonomy without losing the pedagogical signal that the system is built on?*

The core tension:

- **Studio posture** demands silence, trust, continuity, and minimal interruption.
- **Learner-centred architecture** demands a continuous stream of intent, evidence, and reflection written into the Wayfinder.

Open Studio resolves this by reframing scaffolding. Scaffolding stops being *checkpoints the system imposes* and becomes *rituals the student performs that happen to generate structured data*. Every touchpoint must feel like something the student **gets**, not something they're **giving**.

If any interaction in Open Studio starts feeling like compliance paperwork, the mode has broken its own promise and should either be redesigned or the student should be returned to guided mode.

---

## 2. Principles

1. **Intent before evidence before reflection.** The day is bookended by two short rituals; the middle is uninterrupted work.
2. **Passive evidence over active reporting.** The Work Capture Pipeline, dock activity, and file saves are the primary data stream. Students are not "updating status" — they are working, and the system is watching the bench.
3. **AI is a critic on call, not an instructor on push.** Default posture is silent. It speaks when invited, when a self-set timebox elapses, or when drift is detected.
4. **Escalation is graduated and always ends with a human.** The AI surfaces signals; the teacher decides interventions. The AI never revokes Open Studio status itself.
5. **Absence is surfaced, never punished.** No streaks, no red marks for a quiet day. Patterns matter; single sessions don't.
6. **Continuity is the main UX job.** The desk should look and feel exactly as the student left it last session.

---

## 3. The Three-Touch Pattern

Open Studio days consist of exactly three structured touchpoints. Everything else is work.

### 3.1 Arrival intent (~10 seconds)

On landing, the student writes a single line of intent:

> *"Today I'll finish wiring the PIR sensor."*

- Text field or voice note. Voice preferred on iPad/phone.
- Auto-linked to the nearest active milestone in the Wayfinder.
- Stored as a `learning_event` of type `intent.declared`.
- Dismisses after submission; does not reappear that session.
- Empty submission is allowed but triggers a soft AI prompt: *"Open bench today? That's fine — want to jot a direction anyway?"*

### 3.2 Passive evidence (session duration)

No prompts. The system is watching:

- Work Capture Pipeline uploads (photos, sketches, WIP artefacts)
- Dock actions (file opens, saves, tool launches)
- Self-set timer start/stop events
- Sensor/hardware telemetry where available
- Any interaction with the AI critic

All streamed to `learning_events` with appropriate event types. This is the bulk of the data model's work.

### 3.3 Departure reflection (~60 seconds)

On session end, a drawer slides in. Three Scrum-style questions:

1. **What did you get done?**
2. **What's next?**
3. **What's in your way?**

- Voice preferred, text fallback.
- Drawer cannot be dismissed — it is the price of admission for tomorrow's Open Studio. This is the one place the contract is enforced.
- Stored as `learning_event` of type `reflection.session_end`.
- The morning's `intent.declared` is re-shown inline above the questions so the student can see their own commitment.
- If intent was met, the AI offers a one-line acknowledgement. If not, it asks Recalibration's gentlest question: *"Worth a rethink?"*

---

## 4. AI Behaviour

### 4.1 Default: silent

The AI is present as a small persistent element in the corner of the desk (see §6). It does not initiate conversation unless one of the trigger conditions is met.

### 4.2 Trigger conditions

| Trigger | AI action |
|---|---|
| Student taps the critic | Responds in critic mode (Socratic, never prescriptive) |
| Self-set timer elapses | One-line check: *"You gave yourself 45 min on wiring — still on it?"* |
| No evidence for 20+ min on an active session | Single ambient nudge: *"Quiet bench — stuck or thinking?"* Dismissible, never repeats same session. |
| Same photo / WIP state across 3+ sessions | Drift signal — routes to teacher dashboard, not student |
| Intent declared but no matching evidence by session end | End-of-session Recalibration offer (see §5) |
| Reflection mentions blocker keyword (stuck, confused, broken, don't know) | Offer to stay in conversation after the reflection drawer closes |

### 4.3 Critic mode tone

The AI in Open Studio is modelled on a studio crit, not a tutor. Every response should prefer:

- Questions over answers
- *"What's making X harder than you expected?"* over *"You should do Y."*
- Naming the tension, not resolving it
- Attribution to the teacher where a genuine directive is needed: *"This is the kind of thing Ms. Chen usually wants you to try first — want me to flag it for her?"*

Reuse the persona templates from the AI mentor / designer matching feature but dial the prescriptiveness down a further notch for Open Studio.

---

## 5. Adaptation & Escalation Ladder

When a student stalls, the system escalates softly. Each rung is separated by time and evidence, not by arbitrary session count.

| Rung | Trigger | Response | Who acts |
|---|---|---|---|
| 0 | Single session, intent unmet | Soft private nudge in reflection drawer | AI |
| 1 | Two consecutive unmet intents | Auto-trigger Recalibration ritual at next arrival | AI → student |
| 2 | Milestone approaching (≤ 2 sessions remaining) with <30% evidence | Teacher dashboard flag with context: last reflections, recent photos, last AI conversation | AI → teacher |
| 3 | Milestone missed | Teacher dashboard flag escalates; Open Studio *paused* (not revoked) until teacher touchpoint | Teacher |
| 4 | Pattern across multiple milestones | Teacher revokes Open Studio; student returns to guided mode; Wayfinder logs the transition with teacher note | Teacher |

**Critical rule:** rungs 3 and 4 are teacher actions, not AI actions. The AI prepares the context (recent reflections, photos, conversation snippets) and surfaces it in the teacher dashboard as a "floor walk" card, not a red alert.

### 5.1 Teacher intervention tools

When a flag surfaces, the teacher has these actions available from the dashboard card:

- **Leave a voice note on the student's desk** — appears as a sticky note on arrival
- **Push a forced checkpoint** — inserts a Stone into the student's flow
- **Rewrite milestone together** — schedules a 1:1, logged as Wayfinder event
- **Pause Open Studio** — student returns to guided mode temporarily, no penalty
- **Revoke Open Studio** — requires teacher note; logged explicitly in Wayfinder

---

## 6. UX / UI Specification

Open Studio must look and feel different from lesson mode within half a second of landing. Lesson mode is linear and guided; Open Studio is spatial and ambient.

### 6.1 Layout regions

```
┌─────────────────────────────────────────────────────────┐
│  HORIZON STRIP — current milestone · days remaining     │ ← thin, quiet, never a burndown chart
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──── INTENT CARD ────┐      ┌── SELF-TIMER ──┐       │
│   │ "Today I'll..."     │      │   45:00        │       │
│   └─────────────────────┘      └────────────────┘       │
│                                                         │
│              ┌─────────────────────┐                    │
│              │                     │                    │
│              │    THE DESK         │  ← last session's  │
│              │  (persistent WIP)   │    photos, notes,  │
│              │                     │    3D workshop     │
│              │                     │    scene, dock     │
│              └─────────────────────┘                    │
│                                                         │
│                                        ┌─────────────┐  │
│                                        │ CRITIC      │  │
│                                        │ (small,     │  │
│                                        │  persistent)│  │
│                                        └─────────────┘  │
└─────────────────────────────────────────────────────────┘

                  ↓ on session end ↓

┌─────────────────────────────────────────────────────────┐
│  REFLECTION DRAWER (slides in, cannot be dismissed)     │
│                                                         │
│  Your intent: "Finish wiring the PIR sensor"            │
│                                                         │
│  • What did you get done?                               │
│  • What's next?                                         │
│  • What's in your way?                                  │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Component spec

- **Horizon strip** — 32px thin bar, warm muted tone, shows *Milestone name · N days*. Tap to expand into full Wayfinder view. Never animated or alarmed; this is a sightline, not a dashboard.
- **Intent card** — appears front-and-centre on arrival, auto-dismisses after submission. Uses the warm dark palette with a slightly raised "paper" texture to feel like a journal entry.
- **The desk** — the existing `student-workspace.jsx` 3D scene, now the default view in Open Studio. All WIP artefacts persist between sessions. Dock visible along the bottom edge.
- **Self-timer** — student runs it themselves, Pomodoro-optional. Elapsed event triggers the AI timebox nudge. Never starts automatically.
- **Critic corner** — small badge, bottom-right, lights up subtly when the AI has an unprompted thought. Never pops open uninvited.
- **Reflection drawer** — slides up from the bottom on session end. The three questions, voice-first. Cannot be dismissed. Closes the loop on the arrival intent.

### 6.3 Visual differentiation from lesson mode

| | Lesson mode | Open Studio |
|---|---|---|
| Layout | Linear, vertical | Spatial, desk-like |
| Tone | Instructional | Ambient |
| AI posture | Instructor, prompts frequently | Critic, silent by default |
| Navigation | Step-by-step | Free-form |
| Palette | Brighter, structured | Warm dark, workshop-lit |
| Typography | Functional | Slightly more editorial |

### 6.4 Mobile / tablet adaptations

- iPad is the likely primary Open Studio device (sketching, photo capture).
- The desk collapses into a vertical stack but keeps the WIP photos pinned to the top.
- Voice is the default for both intent and reflection on touch devices.
- Critic corner becomes a persistent tab bar icon.

---

## 7. Integration with Loominary Core

### 7.1 Wayfinder

All three touchpoints write to the Wayfinder as `learning_events`:

- `intent.declared` — morning intent, linked to milestone ID
- `evidence.captured` — every photo/artefact/file save (already wired via Work Capture Pipeline)
- `reflection.session_end` — the three-question answer set
- `critic.conversation` — any AI critic exchange
- `open_studio.paused` / `open_studio.revoked` — teacher actions

All append-only, all enforced at DB level per existing RLS triggers. Nothing in Open Studio bypasses the append-only guarantee.

### 7.2 Stones

Open Studio does not use Stones directly — students have earned their way out of guided Stone flows. Teacher-pushed forced checkpoints (rung 3) re-insert a Stone temporarily.

### 7.3 Recalibration

Auto-triggered at rung 1 of the escalation ladder. Reuses the existing ritual. Logged as a `recalibration.session` event on the Wayfinder.

### 7.4 Drift detection

The drift detection escalation ladder already specced for Open Studio becomes the backbone of §5. The thresholds (sessions, evidence %) should be tunable per class by the teacher in dashboard settings.

### 7.5 Teacher dashboard

Open Studio introduces a "floor walk" view — a feed of soft flags, not a surveillance grid. Each card shows:

- Student name and photo
- Last reflection text (verbatim, not summarised)
- 2-3 most recent photos from Work Capture
- Suggested action (rung-appropriate)
- One-tap teacher intervention buttons

Design principle: the teacher should feel like they're walking the floor of a studio, not scanning a dashboard of alerts.

---

## 8. Earning & Losing Open Studio

Open Studio is not a default state. Students earn it via process and engagement evidence on guided milestones. The criteria are already specced in the Open Studio earning document; this spec assumes the student has qualified.

**Loss conditions** (teacher-triggered only):

- Pattern of unmet intents across ≥ 2 milestones
- Teacher judgement after a 1:1 conversation
- Student self-request ("I want to go back to guided mode for this project")

Revocation always includes a teacher note and is logged in the Wayfinder. It is not a punishment frame — the note should explain the re-scaffolding as support, not demotion.

---

## 9. Open Questions

1. **Timebox defaults.** Should the self-timer have a suggested default (e.g. 45 min) or start blank? Risk of nudging toward Pomodoro compliance if defaulted.
2. **Critic corner visibility when idle.** Should the critic badge be visible at all when silent, or only appear when it has something to offer? The former is reassuring, the latter is purer studio posture.
3. **Reflection voice transcription accuracy for ELL students.** Needs testing with the NIS ELL cohort before pilot.
4. **Intent granularity.** Single line vs. allow multiple intents per session. Start with single line; revisit after first pilot.
5. **Parent weekly update integration.** Open Studio reflections are probably the richest content for the parent digest — confirm in Parent Updates spec.
6. **Drift thresholds.** Session count vs evidence % — which is the better primary signal? Needs real student data to calibrate.
7. **AI critic conversation retention.** How much of a critic conversation lands in the Wayfinder verbatim vs. summarised? Verbatim preserves the append-only principle but may create noise.

---

## 10. References & Prior Art

Studied for Open Studio's design. Not copied — each informs one specific element.

- **Scrum daily standups** — the three-question reflection ritual comes directly from here.
- **Strava** — intent + passive capture + post-activity reflection. Same three-touch shape as Open Studio, and users enjoy each touch because it gives them something.
- **Figma / Linear** — ambient presence and activity signals without nagging. Reference for the critic corner and horizon strip.
- **Focusmate** — the start-of-session commitment framing. Almost identical to the arrival intent card.
- **Notion / Roam daily notes** — lightweight recurring reflection people actually keep up with because friction is near zero.
- **Bungie's "pursuits" in Destiny** — self-selected objectives tracked passively in the background. Good model for making milestones feel chosen, not assigned.
- **Art school / maker studio crits** — the real-world analogue and mental model for the teacher floor-walk dashboard.
- **Duolingo streaks** — studied as a cautionary example. Open Studio must never tip from motivating into coercive.

---

## 11. Next Steps

1. Wire the three-touch data model into `learning_events` schema (if not already present).
2. Extend the existing `student-workspace.jsx` prototype with the intent card and reflection drawer regions.
3. Draft the teacher floor-walk dashboard as a separate spec — it is large enough to stand alone.
4. Tune drift thresholds against Matt's historical student work archive before first pilot.
5. Pilot with Grade 10 MYP Design cohort once StudioLoom pilot infrastructure (SSO, RBAC, class codes) is in place.
