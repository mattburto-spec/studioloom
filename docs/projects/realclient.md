# Project: Real Client Journey
**Created: 3 April 2026**
**Status: IDEA — not yet specced**
**Depends on: Dimensions3 (Activity Block Library + Journey infrastructure)**

---

## What This Is

A structured AI-simulated (and eventually real) client experience where students work with a "client" throughout their design unit. The client has needs, constraints, preferences, and emotions — and the student must meet with them multiple times during the unit to gather requirements, present concepts, get feedback, and iterate.

## Why This Matters

Empathy is the hardest design skill to teach in a classroom. Students often design for imaginary users with no accountability. A persistent client relationship forces genuine empathy work:

- **Meeting 1 (Discovery phase):** Client describes their problem, context, constraints. Student must listen, ask questions, take notes. The client has personality — they might be vague, or overly specific, or change their mind.
- **Meeting 2 (Define/Ideate phase):** Student presents initial concepts. Client reacts with genuine emotional responses ("I like the direction but I'm worried about cost" / "That's not what I meant at all"). Student must adapt.
- **Meeting 3 (Prototype phase):** Student shows progress. Client gives feedback on specifics. May introduce new constraints ("Actually, my budget just got cut" / "My daughter will be using this too").
- **Meeting 4 (Test/Evaluate phase):** Final presentation. Client assesses against their original needs. Gives honest feedback including what worked and what they'd change.

## Architecture Considerations

### As an Activity Block Category
Real Client meetings should be a block category (`journey` or new `client-meeting` category) that teachers can drag into lessons at appropriate points. Each meeting block contains:

- `client_persona`: JSONB defining the client's personality, needs, communication style, emotional state
- `meeting_type`: 'discovery' | 'concept-review' | 'progress-check' | 'final-presentation'
- `conversation_rules`: AI rules for the client character (what they know, what they don't, how they react)
- `memory`: Client remembers previous meetings — references past conversations, notices changes, tracks promises made
- `rubric_alignment`: Which criteria this meeting assesses (researching, communicating, evaluating)

### AI Implementation
- Client is an AI character (Haiku for cost) with persistent memory across meetings
- Client persona generated from unit context OR teacher-defined
- Conversation stored in `client_sessions` table linked to student + unit
- Client has emotional state that shifts based on student's work quality and communication
- Teacher can preview/adjust client persona before unit starts
- Client gives honest, sometimes uncomfortable feedback — not always encouraging

### Cross-Meeting Memory
- Meeting 1 responses become context for Meeting 2 AI prompts
- Client tracks: promises made, questions asked, concerns raised, deadlines given
- If student ignores client feedback from Meeting 2, Meeting 3 client notices and says so
- Final meeting references the full journey — "Remember when you first showed me X? Look how far this has come"

### Future: Real Client Mode
- Teacher connects a real external person (parent, community member, local business)
- Real client sees student work via a read-only gallery view
- Real client leaves feedback via structured forms (same format as AI client)
- AI client remains as fallback when real client doesn't respond in time
- Hybrid mode: real client for key meetings, AI for interim check-ins

## Connection to Discovery Engine

The Discovery Engine's 8-station journey architecture (state machine, auto-save sessions, Kit mentor) is the technical foundation. A Real Client meeting is essentially a Discovery-style journey with:
- Different character (client persona instead of Kit)
- Different goal (gather requirements instead of build profile)
- Cross-session memory (Discovery is single-session; client meetings span weeks)
- Teacher-configurable persona (Discovery's Kit is fixed)

## Connection to Dimensions3

- Client meeting blocks need the Activity Block Library infrastructure (Phase A)
- Client persona storage uses block metadata JSONB
- Meeting rubric alignment uses the neutral criterion taxonomy
- Client feedback quality contributes to block efficacy scoring
- Client conversations need the same content safety monitoring as Design Assistant (see safety project)

## Build Estimate
~5-7 days once Dimensions3 Block Library is live. Not on critical path.

## Open Questions
1. Should client personas be sharable between teachers? (Reusable "difficult client" archetype library?)
2. How does the client handle student work that's a photo/sketch vs text? (Needs visual AI assessment — see Q6 in spec review)
3. Should meeting frequency be fixed (4 meetings) or teacher-configurable?
4. Can students choose their client from a roster? (More engagement but more content to generate)
5. How does this interact with Open Studio mode? (Client meetings as structured check-ins during self-directed work?)
