# Open Studio — Feature Spec for StudioLoom

## Overview

Open Studio is an earned autonomy mode within StudioLoom. Students who demonstrate they can self-manage the MYP Design process unlock the ability to work independently, supervised by an AI mentor that shifts from instructor to studio critic.

**Core philosophy:** Open Studio is not a reward — it's a recognition of readiness. Not all students will earn it. Only those who prove they can drive get to drive unsupervised.

---

## 1. Earning Open Studio

### What students are proving

They can self-manage the MYP design process. This is not about accumulating points or XP — it's a licence. You've shown you can drive, so now you can drive unsupervised.

### Unlock Criteria (mix-and-match, not all required)

#### Process Evidence
- Completed at least one full design cycle (Inquiring → Developing → Creating → Evaluating) with documented reflections at each stage
- Maintained their Kanban/Gantt on schedule for X consecutive sessions — proves they can plan and stick to it
- Self-assessed against MYP criteria and their self-assessment was within one band of the teacher's assessment — proves they understand the standard

#### Engagement Evidence
- Responded to AI feedback constructively (not just dismissed or copy-pasted suggestions)
- Logged meaningful journal/reflection entries (AI can flag superficial ones)
- Helped a peer (peer endorsement or documented collaboration)

### Key Design Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Per-unit or permanent? | Per-unit. Resets each project cycle | Stays meaningful; struggling students get a fresh shot |
| Can it be lost? | Yes, but gently | If AI flags student off-track for 2 consecutive sessions → drops to guided mode with "Let's recalibrate" message (not punitive language) |
| Teacher override? | Always available | Grant early for trusted students, revoke if needed. Dashboard toggle |

### UI Concept

Progress shown as a readiness indicator (progress ring or licence card), not a points bar. When unlocked:

> **Open Studio unlocked** — You've shown you can manage your design process independently. Your AI mentor will check in periodically but you choose your direction.

---

## 2. AI Mentor — Two Modes

### Normal Mode (Guided)

| Behaviour | Detail |
|-----------|--------|
| Stance | Proactive — initiates check-ins, suggests next steps |
| Structure | Follows the MYP design cycle sequence |
| Scaffolding | Asks leading questions, provides sentence starters, offers examples |
| Frequency | Checks in every session or after every major task |
| Tone | Supportive tutor / teaching assistant |

### Open Studio Mode

| Behaviour | Detail |
|-----------|--------|
| Stance | Reactive — waits to be asked, mostly observes |
| Structure | Unstructured — student sets their own direction |
| Challenge level | When it does engage, asks harder questions (studio critic, not tutor) |
| Frequency | Light check-ins at intervals (every 15–20 mins, configurable) |
| Tone | Visiting critic / studio technician |

---

## 3. AI Behaviours in Open Studio

### 3a. Periodic Check-in

Brief, non-intrusive. Not surveillance — a light tap on the shoulder.

> "Quick check — still feeling good about your direction? Anything you want to bounce off me?"

If the student says they're fine, the AI backs off. No follow-up interrogation.

**Configurable interval:** Default 15–20 mins. Teacher can adjust per class or per student.

### 3b. Drift Detector

Escalating response when the AI detects stalling or off-task behaviour (no meaningful activity logged, or work unrelated to any stated goal):

| Level | Trigger | AI Action |
|-------|---------|-----------|
| 1 | Mild stall (~10 min no activity) | "Noticed you've been on this for a while — want a fresh perspective?" |
| 2 | Extended stall (~20 min) | "Looks like you might be stuck. Want to talk through where you're headed?" |
| 3 | Sustained (~30 min or pattern) | Silent flag to teacher dashboard. No further student-facing escalation |

### 3c. Critic Mode (when student asks for help)

Instead of answers or step-by-step guidance, the AI shifts to Socratic/design-crit style:

- "What's the strongest part of this? What's the weakest?"
- "If you had to cut one feature, which would it be and why?"
- "How would your target user respond to this?"
- "What would you change if you had twice the time? Half the time?"
- "Which MYP criterion does this decision most directly address?"

### 3d. Documentation Nudge

Self-directed students consistently fail at documenting their process. Periodic gentle reminders:

> "You've made good progress — worth capturing a quick reflection before you move on?"

This also feeds back into the earning system — documented reflections help keep Open Studio unlocked.

### 3e. What the Teacher Sees

Dashboard surfaces a simple Open Studio summary per session:
- What the student worked on (auto-generated from activity)
- Whether the AI flagged anything (drift alerts)
- Confidence score for session productivity
- Quick "needs check-in" indicator

Not surveillance — just enough signal to know who might need a human conversation.

---

## 4. Prompt Engineering Notes

### System prompt structure for Open Studio mode

The AI needs context-switching logic. Key elements:

```
CURRENT MODE: open_studio
STUDENT CONTEXT: {name}, {current_project}, {time_in_session}, {last_activity_timestamp}
OPEN STUDIO RULES:
- Do NOT proactively suggest next steps unless asked
- Do NOT follow the design cycle sequence — student leads
- When asked for help, respond as a design critic, not a tutor
- Use Socratic questions before giving direct answers
- Track time since last meaningful activity for drift detection
- Nudge documentation every ~20 mins if none logged
- Escalate to teacher dashboard (silently) only at Level 3
TONE: Collegial, respectful of autonomy, curious rather than directive
```

### Key prompt differences between modes

| Aspect | Guided Mode Prompt | Open Studio Prompt |
|--------|-------------------|-------------------|
| Initiative | "Proactively check student progress and suggest next steps" | "Wait to be asked. Observe quietly" |
| Question style | "Use scaffolded questions with sentence starters" | "Use open-ended design critique questions" |
| MYP references | "Guide student through the current design cycle phase" | "Reference MYP criteria only when student's work naturally connects" |
| Feedback depth | "Provide detailed, step-by-step feedback" | "Ask questions that help student self-evaluate" |
| Intervention threshold | Low — check in frequently | High — only intervene on drift or request |

---

## 5. Edge Cases to Consider

- **Student earns Open Studio but doesn't want it** — Should be opt-in. Some students prefer structure. Let them stay in guided mode even if qualified
- **Student uses Open Studio to do nothing productive** — Drift detector handles this, but teacher needs to make the call on revoking. AI doesn't punish
- **Student in Open Studio asks for guided-mode help** — AI can temporarily shift to more supportive mode for a single interaction, then return to critic stance
- **Multiple students in Open Studio collaborating** — Should be encouraged. AI can facilitate group crits
- **ELL students** — Open Studio check-ins should respect language level. Simpler prompts, more visual cues
- **End of unit approaching** — AI should increase documentation nudges as deadlines near, regardless of mode

---

## 6. Competitive Landscape

| Model | Similarity | Key Difference |
|-------|-----------|----------------|
| Alpha School / 2 Hour Learning | AI tutoring → earned free time | AI teaches then humans supervise. StudioLoom: AI supervises the earned autonomy phase too |
| Competency-based ed (all 50 US states) | Mastery unlocks progression | Progression = more content. StudioLoom: progression = more freedom |
| Genius Hour / 20% time | Self-directed project time | Given to everyone. StudioLoom: earned, not given |
| Khan Academy / Khanmigo | AI tutoring with mastery | AI always in tutor mode. StudioLoom: AI changes role based on student readiness |

**StudioLoom's unique position:** The AI shifts from tutor to critic based on demonstrated readiness. Nobody else is doing this role-switching mechanic tied to earned autonomy within a design education context.

---

## 7. Implementation Priority

### Phase 1 — Core unlock mechanic
- [ ] Define and implement unlock criteria tracking
- [ ] Build progress indicator UI (readiness ring/licence card)
- [ ] Teacher dashboard toggle for manual grant/revoke
- [ ] "Open Studio unlocked" notification flow

### Phase 2 — AI mode switching
- [ ] Implement dual system prompts (guided vs Open Studio)
- [ ] Build context-switching logic based on student's current mode
- [ ] Periodic check-in system with configurable intervals
- [ ] Drift detection (activity monitoring + escalation tiers)

### Phase 3 — Teacher dashboard
- [ ] Open Studio session summaries
- [ ] Drift alert indicators
- [ ] Per-student Open Studio history (earned/lost/granted)
- [ ] Class-level view: who's in Open Studio, who's close, who's far

### Phase 4 — Refinement
- [ ] Critic-mode prompt tuning based on student feedback
- [ ] Documentation nudge effectiveness tracking
- [ ] ELL/UDL adaptations for Open Studio check-ins
- [ ] Peer collaboration features within Open Studio
