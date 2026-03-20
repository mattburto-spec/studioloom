# Open Studio — Feature Spec for StudioLoom

## Overview

**Open Studio** is a self-directed working mode that students unlock by demonstrating they can manage the MYP Design process independently. Once in Open Studio, students choose their own direction while an AI mentor shifts from instructor to studio critic — available, observant, but not directing.

**Core philosophy:** Open Studio is not a reward. It's a recognition of readiness. Not all students will earn it. That's by design.

---

## Context & Prior Art

The "mastery unlocks autonomy" model draws on established research and emerging practice:

- **Self-Determination Theory (SDT):** Autonomy, mastery, and purpose are the three pillars of intrinsic motivation (Deci & Ryan). Students given greater autonomy invest more effort and achieve greater proficiency.
- **Competency-Based Education:** All 50 US states now allow schools to measure success based on mastery rather than seat time (Aurora Institute).
- **Alpha School / 2 Hour Learning:** The closest operational model — AI-powered mastery in mornings, self-directed time in afternoons. Uses earned privileges (school currency, autonomy over space) as motivation. Note: their claims are unverified and the model is controversial.
- **Johns Hopkins AI Co-Tutor Study:** Introduced an AI chatbot as a Socratic co-tutor for middle/high school students working through case studies. Found that students and teachers both need training on how to interact with the AI.
- **Harvard RCT on AI Tutoring:** Students learned significantly more in less time with an AI tutor, and reported higher engagement and motivation.

**Where StudioLoom's Open Studio is distinct:** No existing platform combines gamified target-hitting that *unlocks* self-directed time with an AI that *shifts role* from tutor to mentor/supervisor during that earned autonomy. Existing models either use AI for instruction (Khan, Alpha) or humans for supervision. StudioLoom does both — AI teaches, AI supervises — but in fundamentally different modes.

---

## Earning Open Studio

### Design Principles

- It should feel like earning a licence, not accumulating points. You've shown you can drive, so now you can drive unsupervised.
- Not all students will get it. That's the point. It's aspirational.
- Per-unit reset — each project cycle is a fresh opportunity.
- Teacher override always available (grant early or revoke).

### Unlock Criteria (mix-and-match, not all required)

#### Process Evidence
- **Completed a full design cycle:** Inquiring → Developing → Creating → Evaluating, with documented reflections at each stage.
- **Maintained planning tools on schedule:** Kanban/Gantt updated consistently for X consecutive sessions. Proves they can plan and follow through.
- **Accurate self-assessment:** Self-assessed against MYP criteria and was within one band of teacher assessment. Proves they understand the standard.

#### Engagement Evidence
- **Constructive AI interaction:** Responded to AI feedback thoughtfully (not dismissed or copy-pasted). The AI can flag low-quality engagement.
- **Meaningful reflections:** Journal/reflection entries that demonstrate genuine thinking. AI can flag superficial entries.
- **Peer contribution:** Helped a classmate — peer endorsement or documented collaboration.

### UI Concept

A **readiness indicator** (progress ring or licence card) that fills as criteria are met. Not a single gate but a visible progression toward eligibility.

**Unlock notification:**
> **Open Studio unlocked** — You've shown you can manage your design process independently. Your AI mentor will check in periodically but you choose your direction.

### Revocation

- Open Studio can be lost, but gently.
- If the AI mentor flags that a student has gone significantly off-track for **two consecutive sessions**, it drops back to guided mode.
- Messaging: "Let's recalibrate" — not "You lost your privileges."
- Teacher can also revoke via dashboard toggle at any time.

---

## AI Mentor Behaviour

The AI has two distinct operating modes. The shift between them should feel tangible to the student.

### Guided Mode (default)

| Dimension | Behaviour |
|-----------|-----------|
| **Initiative** | Proactive — initiates check-ins, suggests next steps |
| **Structure** | Follows the MYP design cycle sequence |
| **Scaffolding** | Asks leading questions, provides sentence starters, offers examples |
| **Frequency** | Checks in every session or after every major task |
| **Tone** | Supportive tutor / encouraging coach |

### Open Studio Mode

| Dimension | Behaviour |
|-----------|-----------|
| **Initiative** | Reactive — waits to be asked, mostly observes |
| **Structure** | Student sets their own direction |
| **Scaffolding** | When engaged, asks harder questions (critic, not tutor) |
| **Frequency** | Light check-ins at configurable intervals (default ~15-20 mins) |
| **Tone** | Studio critic / visiting professional |

### Open Studio AI Behaviours (detail)

#### 1. Periodic Check-in
Non-intrusive. Not surveillance. A brief nudge at intervals.

**Example prompts:**
- "Quick check — still feeling good about your direction? Anything you want to bounce off me?"
- "How's it going? Need a second opinion on anything?"

If the student says they're fine, the AI backs off completely. No follow-up interrogation.

#### 2. Drift Detector
Triggers when the AI notices signals of stalling or off-task behaviour (no meaningful activity logged, work unrelated to any stated goal).

**Escalation ladder:**
1. **Gentle:** "Noticed you've been on this for a while — want a fresh perspective?"
2. **Direct:** "Looks like you might be stuck. Want to talk through where you're headed?"
3. **Silent flag:** Flags to teacher dashboard. Does not confront the student further.

#### 3. Critic Mode (when student asks for help)
Instead of answers or step-by-step guidance, the AI shifts to Socratic/design-crit style:

- "What's the strongest part of this? What's the weakest?"
- "If you had to cut one feature, which would it be and why?"
- "How would your target user respond to this?"
- "What would you change if you had twice the time? Half the time?"
- "What's the one thing that would make this significantly better?"

The AI should feel like a visiting designer giving a studio crit, not a teacher checking your work.

#### 4. Documentation Nudge
Self-directed students consistently fail to document process. The AI periodically reminds:

- "You've made good progress — worth capturing a quick reflection before you move on?"
- "This is a good decision point. Want to note down your reasoning?"

This also feeds back into the earning system — documented reflections are part of what keeps Open Studio unlocked.

#### 5. MYP Alignment Check
Occasional (not every session) gentle reminder to connect work back to MYP criteria:

- "Which criterion does this part of your work connect to most?"
- "If an examiner saw this, what strand would they assess it under?"

Light touch. Not a compliance check.

---

## Teacher Dashboard — Open Studio View

Teachers need enough signal to know who needs a human check-in, without it becoming surveillance.

### Per-student session summary:
- What the student worked on (auto-generated from activity log)
- Whether the AI flagged anything (drift, low engagement, off-task)
- Confidence score for how productive the session was (AI-assessed, low/medium/high)
- Number of AI interactions initiated by the student

### Class-level view:
- Who currently has Open Studio unlocked
- Who is close to unlocking (readiness indicator progress)
- Any flags requiring teacher attention
- One-click override to grant or revoke Open Studio

---

## Open Questions / Decisions Needed

1. **How many consecutive sessions should "on schedule" require?** 3? 5? Configurable by teacher?
2. **Should peer endorsement be required or just bonus?** Risk of social dynamics / popularity effects.
3. **Check-in interval in Open Studio** — fixed at 15-20 mins or student-configurable? Teacher-configurable?
4. **What happens at unit boundaries?** Clean reset, or partial credit carried forward?
5. **Should there be levels of Open Studio?** e.g. Level 1 = open choice within current project, Level 2 = can start side projects. Or keep it simple with one tier.
6. **How visible is Open Studio status to other students?** Aspirational if visible, but risk of stigma for those who don't have it.
7. **ELL/UDL considerations:** Should criteria be adjusted for students with language barriers or learning differences? Modified pathway to Open Studio?
8. **Data retention:** How long are AI interaction logs kept? Privacy implications for students.

---

## Implementation Notes

### Prompt Engineering
Two distinct system prompts needed:
- **Guided mode prompt:** Structured, scaffolded, proactive, MYP-cycle-aware
- **Open Studio prompt:** Reactive, Socratic, critic-style, minimal intervention

The mode switch should be clean — triggered by a flag in the student's profile, not by conversation context. The AI should know which mode it's in from the first message.

### Signals for Drift Detection
Possible inputs for the AI to assess engagement:
- Time since last meaningful input/save
- Similarity of current work to previous work (stuck in a loop?)
- Whether current activity relates to any stated goal or project brief
- Browser/tab focus (if available — privacy considerations)

### Integration with Existing StudioLoom Features
- **Subway navigation:** Open Studio could be visualised as an "express line" or a station you unlock
- **Kanban/Gantt:** Consistency data feeds directly into earning criteria
- **AI assistant:** Same underlying model, different system prompt and behaviour rules
- **Teacher dashboard:** Open Studio status and flags integrate into existing monitoring views

---

## Summary

Open Studio transforms the student-AI relationship from directed instruction to mentored independence. It rewards genuine self-management capability — not compliance, not points accumulation — with the autonomy to drive your own design process. The AI becomes the studio technician in the room: available, watchful, and only stepping in when something's genuinely going wrong.
