# Service Learning Framework — StudioLoom Extension

## The Idea

StudioLoom's infrastructure (units, lessons, Open Studio, AI mentor, toolkit, portfolio) works for any structured learning journey — not just MYP Design. By adding a **framework selector at class creation**, the same platform serves Design, Service Learning, PYP Exhibition, Personal Project, and more. Each framework changes the AI personality, phase names, vocabulary, and generation prompts — but the code stays the same.

## Class Framework Selector

When creating a new class, teacher picks a framework:

| Framework | Phases | AI Mentor Tone | Target |
|-----------|--------|----------------|--------|
| **MYP Design** (default) | Inquiring → Developing → Creating → Evaluating | Design critic / Socratic tutor | Years 7-10 Design |
| **Service Learning** | Investigate → Prepare → Act → Reflect → Demonstrate | Community coach / accountability partner | Any age, CAS/Service |
| **PYP Exhibition** | Wonder → Explore → Create → Share | Curious guide / gentle challenger | Years 5-6 |
| **Personal Project** | Define → Plan → Create → Reflect → Report | Process mentor / writing coach | Year 10 MYP PP |
| **Custom** | Teacher-defined phases | Teacher-configured | Anything |

Stored as `framework` TEXT column on `classes` table. Default: `"myp_design"`. Flows through to AI prompts, Open Studio phases, toolkit suggestions, and generation templates.

## Service Learning Framework — Detail

### The 5 Phases

Based on IB CAS cycle + best practice from National Youth Leadership Council (NYLC) K-12 Service-Learning Standards:

#### 1. INVESTIGATE (Discovery)
**What students do:** Identify community needs, research the context, talk to stakeholders.
**Maps to Open Studio Discovery.** Comic strip reframed: "What fires you up? What's broken in your community? Who's affected?"

Key activities:
- Community needs audit (walk around, observe, interview)
- Stakeholder mapping (who's affected, who has power, who's invisible)
- Root cause analysis (Five Whys — why does this problem persist?)
- Empathy mapping (understand the people you want to help)
- Asset mapping (what resources already exist? what's been tried?)

Toolkit tools: **Stakeholder Map**, **Five Whys**, **Empathy Map**, **How Might We**, **SWOT**

#### 2. PREPARE (Planning)
**What students do:** Set SMART goals, plan timeline, assign roles, identify resources, plan risk/safety.

Key activities:
- SMART goal setting (Specific, Measurable, Achievable, Relevant, Time-bound)
- Action plan with milestones and deadlines
- Resource inventory (what do we need? what do we have?)
- Risk assessment (what could go wrong? backup plans)
- Role assignment (who does what?)
- Partner/stakeholder communication plan

Toolkit tools: **Decision Matrix** (choose between project options), **PMI** (evaluate approaches)

AI mentor focus: "Is your goal specific enough? How will you measure success? What's your backup plan if [X] falls through?"

#### 3. ACT (Implementation)
**What students do:** Execute the plan, document progress, adapt when things change.
**Maps to Open Studio Working phase.** AI check-ins become accountability check-ins.

Key activities:
- Weekly progress logging (what did you do? what's next? blockers?)
- Photo/video documentation of service in action
- Stakeholder updates (keeping partners informed)
- Adaptation journal (what changed from the plan and why?)
- Time logging (hours of service — required for CAS/IB)

AI mentor focus: "You said you'd contact the food bank by Friday — did that happen? What's blocking you? How can you break this into a smaller step today?"

#### 4. REFLECT (Throughout + Post)
**What students do:** Ongoing reflection on learning, impact, personal growth.
**Uses the existing reflection system** (effort-gated "Pause & Think").

Reflection prompts (service-specific):
- "What surprised you about working with [stakeholder group]?"
- "How did your understanding of the issue change?"
- "What skill did you develop that you didn't expect?"
- "If you could start over, what would you do differently?"
- "How has this changed what you think about [community issue]?"

AI mentor: Socratic — never evaluates the service itself, pushes students to articulate their own learning. "You said 'it went well' — what specifically went well? How do you know?"

#### 5. DEMONSTRATE (Sharing)
**What students do:** Present impact to an audience, celebrate, plan sustainability.

Key activities:
- Impact summary (what changed because of your action?)
- Evidence portfolio (before/after photos, testimonials, data)
- Presentation to class/school/community partner
- Sustainability plan (what happens after you're done?)
- Celebration + recognition

Portfolio auto-pipeline captures everything from earlier phases into a shareable format.

### AI Mentor Personality: Service Learning Mode

```
You are a service learning mentor — part accountability partner, part community coach.

Your role:
- Help students stay on track with their service commitments
- Push them to think critically about community needs (not just "helping")
- Challenge surface-level reflections ("it was good" → "what specifically changed?")
- Hold them accountable to their own goals and timelines
- Celebrate genuine effort and initiative

You are NOT:
- A teacher grading their work
- A project manager doing their planning for them
- Someone who tells them what service to do

Key principles:
- Initiative comes from the student. You ask questions, you don't assign tasks.
- Real service addresses root causes, not symptoms. Push students deeper.
- Reflection is where the learning happens. Never skip it.
- Failed projects that teach something are more valuable than easy wins.
- Community voice matters — always ask "what do the people you're serving actually want?"

Service-specific vocabulary:
- "Community partner" not "client"
- "Impact" not "result"
- "Service" not "help" (implies equality, not charity)
- "Investigate" not "research" (more active)
- "Demonstrate" not "present" (implies evidence)
```

### What Changes Per Framework (Code Impact)

| Component | MYP Design | Service Learning | Code Change Needed |
|-----------|-----------|-----------------|-------------------|
| Open Studio phases | Discovery → Planning → Working → Sharing | Investigate → Prepare → Act → Demonstrate | Config lookup by framework |
| AI mentor system prompt | Design critic | Community coach | Prompt builder reads framework |
| Check-in questions | "How's your prototype?" | "Did you follow up with the food bank?" | Framework-specific prompt templates |
| Drift detection | "You seem off-task from design work" | "You haven't logged service hours this week" | Same mechanism, different language |
| Toolkit suggestions | SCAMPER, Decision Matrix | Stakeholder Map, Five Whys, SMART goals | Framework → tool mapping |
| Unit wizard | Design cycle steps | Service learning phases | Framework-aware generation |
| Portfolio labels | "Design Process" | "Service Journey" | Framework config |
| Reflection prompts | "How did your design evolve?" | "What did you learn about the community?" | Framework-specific prompt sets |

### Minimal Code Changes for Prototype

**To demo next week (< 1 day of work):**

1. Add `framework` column to `classes` table (TEXT, default "myp_design")
2. Add framework selector to class creation UI (dropdown)
3. Create `src/lib/frameworks/service-learning.ts` with:
   - Phase names and descriptions
   - AI mentor system prompt
   - Reflection prompt templates
   - Toolkit tool recommendations per phase
4. Modify `buildOpenStudioSystemPrompt()` to read class framework and swap prompts
5. Modify Open Studio phase labels to use framework config

**Everything else (unit wizard, portfolio labels, generation prompts) can stay MYP Design for the demo.** The key screens are:
- Class created with "Service Learning" framework ✓
- Open Studio phases show Investigate/Prepare/Act/Reflect/Demonstrate ✓
- AI mentor speaks service language ✓
- Toolkit tools recommended for service context ✓
- Student reflections use service-specific prompts ✓

### Future Frameworks (same pattern)

**PYP Exhibition:**
- Phases: Wonder → Explore → Create → Share
- AI: Curious guide, lots of "I wonder..." prompts, age-appropriate (10-11)
- Toolkit: Empathy Map, How Might We, PMI (simpler tools)

**Personal Project:**
- Phases: Define → Plan → Create → Reflect → Report
- AI: Process mentor + writing coach (PP has a heavy written report component)
- Toolkit: SMART goals, Gantt planning, reflection journals, report structure

**Custom:**
- Teacher defines phase names, descriptions, AI tone
- Power user feature — later phase

### Database Change

```sql
-- Add framework to classes
ALTER TABLE classes ADD COLUMN framework TEXT NOT NULL DEFAULT 'myp_design';

-- Framework options stored in code, not DB (like timing presets)
-- Values: myp_design, service_learning, pyp_exhibition, personal_project, custom
```

### Class Creation UI Change

Current: Teacher enters class name → class created.
New: Teacher enters class name → picks framework from visual cards → class created.

Framework cards show: icon, name, phase names, one-line description. "MYP Design" is pre-selected (default). Cards are large and visual — this is a meaningful pedagogical choice, not a dropdown afterthought.

### Why This Matters for Matt's Principal

- **Immediate value:** Matt can run his service group through StudioLoom next week
- **Platform story:** "It's not just a Design tool — it's a learning journey platform"
- **IB alignment:** CAS (Creativity, Activity, Service) is mandatory for all IB students. PP is mandatory for Year 10. PYP Exhibition is mandatory for Year 6. This covers the entire school.
- **Competitive moat:** No other platform does structured AI-mentored service learning
- **Revenue expansion:** From "MYP Design tool" to "IB learning platform" — 10x the market
