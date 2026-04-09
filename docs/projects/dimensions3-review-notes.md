# Dimensions3 Spec Review — Matt's Notes + Responses
**Date: 3 April 2026**
**Context: Matt read the printed spec doc and raised 18 questions**

---

## Spec Updates Required

These are concrete changes to `docs/projects/dimensions3.md` that came out of this review:

| # | Change | Section | Priority |
|---|--------|---------|----------|
| 1 | Add `journey` as 13th activity category | 6.3 | Do now |
| 2 | Change activity duration from "5-35 min" to "5-80 min" | 5.3, 12.1 | Do now |
| 3 | Add content safety/moderation section | NEW Section 17 | Do now |
| 4 | Add `assessment` as a block flag (not a separate category) | 5.3 | Do now |
| 5 | Add `interactive_config` JSONB field to activity_blocks schema | 5.3 SQL | Do now |
| 6 | Add curriculum chunking + outcome matching to Stage 0/5 | 3.0, 3.5 | Do now |
| 7 | Add `tier` to teacher_profiles in migration plan | Phase A | Do now |
| 8 | Add Block Interaction sandbox tab design | 7 | Do now |
| 9 | Add visual/media AI assessment note to block schema | 5.3 | Do now |
| 10 | Note same-school architecture as future concern | NEW Section 18 or appendix | Do now |
| 11 | Clarify old code removal strategy (immediate, not staged) | 11 | Do now |
| 12 | Add FrameworkAdapter test panel to sandbox design | 7 | Already there (confirm) |

---

## Q1: Discovery Engine Journeys as Blocks

**Question:** How are journeys stored? Should they be activity blocks in a `journey` category?

**Answer:** Yes — journeys should be a block category. The Discovery Engine's 8-station architecture (state machine, sessions, mentor) is the technical foundation, but the concept generalises. A journey block would contain:

- `journey_config`: JSONB with station definitions, state machine transitions, mentor config
- `journey_type`: 'discovery' | 'client-meeting' | 'open-studio-setup' | 'skill-building' | custom
- `estimated_duration`: total journey time (could span multiple lessons)
- `cross_session`: boolean (single-session like Discovery vs multi-session like Real Client)

**Spec update needed:** Add `journey` as 13th activity category in Section 6.3. Journey blocks are multi-activity containers — they're the only category that contains sub-activities internally.

**New project created:** `docs/projects/realclient.md` — Real Client Journey concept.

---

## Q2: Content Safety & Moderation

**Question:** How is inappropriate content from student text, audio, uploads, AI chat, gallery posts monitored and reported?

**Answer:** This is a GAP in the current spec. Dimensions3 has PII scanning and copyright flagging for the *ingestion* pipeline (teacher uploads), but nothing for *student-generated content*. This needs a dedicated safety system.

**What's needed:**

1. **Text moderation** — Every student text submission (responses, gallery reviews, AI chat messages, reflection text) passes through a moderation check before storage. Options: (a) Anthropic's content moderation API, (b) OpenAI moderation endpoint (free, fast), (c) keyword blocklist + AI classification for ambiguous content.

2. **Image/video moderation** — Student uploads (photos, sketches, videos) need visual content scanning. Options: (a) Google Cloud Vision SafeSearch, (b) AWS Rekognition, (c) Azure Content Moderator. Must run async (upload first, flag after).

3. **AI chat guardrails** — Design Assistant already has a system prompt that avoids harmful content, but needs explicit output filtering too. Response should be scanned before delivery to student.

4. **Gallery moderation** — Gallery submissions and peer reviews need pre-publication moderation. Options: (a) auto-publish with async scan + auto-hide if flagged, (b) teacher approval queue (too slow for classroom pace), (c) auto-publish with real-time scan (adds latency). Recommendation: (a) — async scan, auto-hide, teacher notified.

5. **Reporting pipeline** — Flagged content → teacher notification (in-app + email) → admin log → content quarantined (hidden from other students, preserved for review) → teacher resolves (dismiss false positive / confirm + action).

6. **Audit trail** — All moderation decisions logged. Required for school compliance (child safety reporting obligations vary by jurisdiction — Australia, UK, US all have different requirements).

**Spec update needed:** New Section 17: Content Safety & Moderation. This is a critical area for schools — not having it is a dealbreaker.

---

## Q3: Assessment Blocks

**Question:** How do teachers set up assessments? Are they blocks? Can blocks become assessments?

**Answer:** Any block can be marked as assessable. Rather than a separate "assessment" category, assessment is a **flag on a block** — `is_assessable: boolean` + `assessment_config: JSONB`.

When `is_assessable = true`, the block gets:
- `rubric_criteria`: which neutral criteria this block assesses (e.g., ['evaluating', 'communicating'])
- `assessment_type`: 'formative' | 'summative' | 'diagnostic'
- `scoring_method`: 'criterion-referenced' | 'holistic' | 'self-assessment' | 'peer-assessment'
- `rubric_descriptors`: optional per-criterion band descriptors (generated or teacher-written)

In the lesson editor, a teacher can toggle any activity block to "Assess this" — the block gets a rubric overlay, student responses are flagged for grading, and the block appears in the grading dashboard.

**Dedicated assessment blocks** also exist — blocks whose primary purpose IS assessment:
- End-of-unit evaluation task
- Design brief response
- Presentation rubric
- Self-assessment checklist
- Peer review round (links to Gallery system)

These are in the `critique` or `reflection` categories but with `is_assessable = true` and richer `assessment_config`.

**Spec update needed:** Add `is_assessable`, `assessment_config` to block schema in Section 5.3.

---

## Q4: AI Critic Blocks

**Question:** Blocks that are AI characters (famous designers, etc.) giving feedback on student work.

**Answer:** This is a great application of the `ai_rules` field that already exists on activity blocks. An AI critic block would have:

```typescript
{
  activity_category: 'critique',
  ai_rules: {
    phase: 'convergent',
    tone: 'You are Dieter Rams. You believe in "less, but better." You evaluate student work against your 10 principles of good design. You are direct but encouraging. You never use more than 3 sentences.',
    rules: ['Always reference specific principles by number', 'Ask one provocative question', 'Never say "good job" without explaining why'],
    forbidden_words: ['awesome', 'cool', 'nice'],
    persona: {
      name: 'Dieter Rams',
      avatar: 'rams-avatar.png',  // or generated
      style: 'minimalist-critique'
    }
  }
}
```

The existing AI endpoint structure handles this — the `ai_rules` are injected into the system prompt. The critic's response is contextualised to the student's actual work (text, images if visual AI assessment is available).

**Teacher-created critics:** Teachers could create custom critic personas (a local architect, a target user, a sustainability expert) stored as block templates in their library.

**No spec change needed** — the existing `ai_rules` JSONB on blocks already supports this. Just needs a good UI for persona creation (future feature).

---

## Q5: Same-School Architecture

**Question:** Do we need to plan for multiple teachers at the same school now?

**Answer:** Not for Dimensions3 build, but we should note the architectural implications so we don't paint ourselves into a corner.

**Current model:** Each teacher is an island. `teacher_profiles.id` owns everything (classes, units, students, blocks). No school-level entity exists.

**What same-school needs:**
- `schools` table (school_id, name, settings, admin_teacher_id)
- `teacher_profiles.school_id` FK
- Shared block libraries (school-wide blocks visible to all teachers at the school)
- Shared students (student enrolled at school, assigned to multiple teachers' classes)
- School-wide admin (one teacher sees all classes, all students, aggregate data)
- Shared safety badges (school-wide requirements)
- School-wide timetable (one calendar for all teachers)

**What to protect now:**
- Don't hardcode single-teacher assumptions in the Block Library queries (add `teacher_id` filter that can later become `teacher_id OR school_id`)
- Block `visibility` field already in the schema ('private' | 'school' | 'public') — this is forward-compatible
- Student lookup via `class_students` junction is already multi-class — extending to multi-teacher is a junction table change, not an architecture change

**Recommendation:** Add a short note to Dimensions3 as a future consideration. No code changes needed for v1.

---

## Q6: AI Assessment of Visual/Media Student Work

**Question:** Can AI assess student drawings, sketches, photos, videos against a rubric?

**Answer:** Yes, and this is a HIGH-VALUE feature. Claude (Sonnet/Opus) and GPT-4V can both analyse images against rubrics. The flow:

1. Student uploads image/photo/sketch to an activity block
2. System sends image + rubric criteria + assessment descriptors to a vision-capable model
3. AI returns structured feedback: per-criterion observations, strengths, growth areas, specific suggestions
4. Feedback displayed to student (instant) and teacher (logged)

**Applications:**
- Sketch quality feedback ("Your perspective drawing shows understanding of vanishing points but the proportions of the handle are inconsistent with the scale")
- Prototype photo assessment ("I can see you've tested three material combinations but the join method on the right prototype looks structurally weak")
- Process documentation ("Your design journal shows clear progression from initial concepts to refined solution, but the evaluation section lacks specific criteria references")
- Real Client response ("As your client, I can see the form factor addresses my portability requirement but the colour palette doesn't match my brand guidelines")

**Cost consideration:** Vision model calls are more expensive than text-only. Limit to: (a) teacher-enabled blocks only, (b) one assessment per submission (not continuous), (c) Haiku for initial feedback, Sonnet for detailed rubric analysis.

**Spec update needed:** Add `supports_visual_assessment: boolean` to block schema and note vision model costs in Stage 3 gap generation.

---

## Q7: Framework vs Curriculum Context

**Question:** Are `framework` and `curriculumContext` different strings? Where does the system learn about curriculum? How are specific outcomes handled?

**Answer:** Yes, they're different dimensions:

- **`framework`** = assessment system ('IB_MYP', 'GCSE_DT', 'ACARA_DT'). Determines HOW work is assessed (criteria names, grade scales, band descriptors). Lives on the class.
- **`curriculumContext`** = content specification ('MYP Community Project', 'GCSE D&T - Materials', 'ACARA Year 9-10 Design'). Determines WHAT content should be covered (specific outcomes, knowledge requirements, time allocations).

**Curriculum chunking is a real gap.** Right now `curriculumContext` is a free-text string. For curriculum-driven teachers (especially GCSE, ACARA, PLTW), the system needs:

1. **Curriculum documents stored as chunked knowledge** — uploaded curriculum docs go through the ingestion pipeline, extracted as tagged chunks with outcome IDs
2. **Outcome selection at Stage 0** — teacher can optionally pick specific curriculum outcomes from a searchable list (filtered by their curriculumContext selection)
3. **Outcome matching at Stage 5** — after the unit is assembled, a matching pass tags each lesson/activity with best-fit curriculum outcomes. Presented as a coverage report ("This unit covers outcomes 3.1, 3.4, 3.7 — outcomes 3.2, 3.3 not addressed")
4. **Teacher confirmation** — teacher reviews the mapping, adjusts, confirms

**Two approaches for Stage 0:**
- **Option A:** Teacher picks specific outcomes upfront → generation is constrained to cover them
- **Option B:** Teacher creates unit → system matches outcomes afterward → teacher reviews

**Recommendation:** Option B for v1 (simpler, still useful), Option A as enhancement. Most teachers think "I want to teach packaging design" not "I want to cover outcomes 3.1.4 through 3.1.7."

**Spec update needed:** Add curriculum chunking as a concern in Stage 0 and outcome matching as a sub-step in Stage 5. New ingestion pass for curriculum documents (Pass C — only runs on documents tagged as curriculum/syllabus).

---

## Q8: Period Minutes and Lesson Count

**Question:** Is `periodMinutes` how the system knows lesson count?

**Answer:** No — `lessonCount` is a separate field in `GenerationRequest` (line 71 of the spec). The teacher explicitly says "I want 12 lessons." `periodMinutes` tells the system how long each lesson is, so it can plan activities that fit within the time.

The relationship: `lessonCount` × `periodMinutes` = total available time. The pipeline uses this to:
- Size activities appropriately (don't put a 30-min activity in a 40-min period with setup + debrief)
- Distribute content across lessons (more lessons = each lesson covers less)
- Plan extensions (more period minutes = more room for early-finisher activities)

The timetable engine (already built) can also compute lesson count from term dates + class meetings — so in the wizard, "Auto from timetable" could pre-fill `lessonCount` based on how many periods remain in the term.

---

## Q9: Unit Import Getting Smarter Over Time

**Question:** How does import handle varied teacher formats?

**Answer:** The import pipeline learns through two mechanisms:

1. **Pass A (Classification) gets better with exposure.** When a teacher corrects a misclassified block or adjusts boundaries, that correction is logged. Over time, the prompt for Pass A can include examples of "this format → these blocks" from previous successful imports.

2. **Match Report feedback.** The reconstruction stage shows original vs reconstructed side-by-side with match %. When a teacher says "this was wrong" and fixes it, the correction trains the next import. Specifically: the teacher's corrected block boundaries + metadata become ground truth for that document format.

**Practical limit:** With 1 developer and 0 customers, this learning loop won't have much data initially. The v1 approach is "best effort + teacher corrections" — which is honest and functional. The system improves as teachers use it.

**No spec change needed** — the feedback loop in Section 5 already covers this. The correction signals from import flow naturally into the feedback system.

---

## Q10: Activity Duration Cap

**Question:** "5-35 min" is too low — 80-min periods exist.

**Answer:** Correct. The spec says "a single activity lasting 5-35 minutes" but that's artificially capped. In an 80-min period, a prototyping session could easily be 50-60 minutes. Even in a 60-min period, a substantial making task could be 40 minutes.

**Spec update needed:** Change "5-35 minutes" to "5-80 minutes" in Section 5.3 and 12.1. The `timeWeight` system (quick/moderate/extended/flexible) already handles this — `extended` maps to longer durations.

---

## Q11: Block Interaction Model Testing in Sandbox

**Question:** Can block interactions be tested in sandbox separately?

**Answer:** Good catch — the current sandbox design tests the full pipeline end-to-end but doesn't isolate block interactions. You're right that when debugging interaction issues, you need to separate variables.

**Solution:** Add a "Block Interactions" sandbox tab that:
- Lets you pick 2-5 blocks manually
- Shows their prerequisite chains, familiarity scores, cross-block state
- Simulates Layer A (prerequisite check), Layer B (familiarity adaptation), Layer C (state transfer) independently
- Exports a "block sequence" that can be injected into the main pipeline sandbox at Stage 2 (Assembly) to test how interactions affect the full unit

**Spec update needed:** Add Block Interaction sandbox tab to Section 7.

---

## Q12: School-Grade Security

**Question:** Is the security in the spec industry-best for schools?

**Answer:** The spec has PII scanning, copyright flagging, and data integrity — but it's focused on the pipeline data, not the broader platform. For schools, we need to address:

**What the spec covers:**
- PII scanning on ingested content (regex + Haiku)
- Copyright flagging
- Write-ahead versioning (no silent data mutation)
- Audit logging

**What schools additionally need:**
- **COPPA/FERPA compliance** (US) — parental consent, data minimisation, no advertising, data deletion on request
- **GDPR/UK GDPR** (UK/EU) — right to erasure, data portability, DPO, lawful basis
- **Australian Privacy Principles** (AU) — APP 8 cross-border disclosure, notifiable data breaches
- **PIPL** (China) — data localisation, separate consent for minors
- **Content moderation** (see Q2 above)
- **SOC 2 Type II** — eventually, for enterprise sales
- **Encryption at rest** — Supabase handles this but should be documented
- **Penetration testing** — before enterprise sales
- **Incident response plan** — what happens when a breach is detected

**For Dimensions3 build:** Add the content safety section (Q2). The broader compliance work is a separate project (school security audit) that needs its own timeline. The architecture isn't blocking — Supabase + Vercel provide a solid security foundation. The gaps are procedural (policies, DPO, incident response) not technical.

---

## Q13: Old Code Removal

**Question:** Staged removal is unnecessary — no teachers using the site, remove now.

**Answer:** Agreed. The spec's Section 11 suggests a gradual migration because it assumed active users. With 0 users, we can delete quarantined code outright during Dimensions3 Phase A. Cleaner codebase, less confusion.

**Spec update needed:** Change Section 11 migration strategy from "staged" to "immediate deletion during Phase A."

---

## Q14: FrameworkAdapter Testability

**Question:** Can you see the adapter's output?

**Answer:** Yes — the spec already includes a FrameworkAdapter test panel in the sandbox (Section 7, mentioned in testing plan). It shows a generated unit rendered through each framework adapter side-by-side. You pick a neutral unit, select 2-3 frameworks, and see how criterion labels, phase names, and assessment vocabulary change.

The test panel should show: (a) the neutral content, (b) each framework's adaptation, (c) any mapping gaps (neutral terms that don't have a framework equivalent), (d) round-trip test (neutral → framework → neutral should be lossless).

**Already in spec** — confirmed it's there. Will make sure it's prominent enough.

---

## Q15: Open Studio v2

**Question:** Open Studio needs journey + goal setting + scaffolding via blocks.

**Answer:** Created `docs/projects/openstudio.md` with the full v2 vision. Key decisions:

- Open Studio becomes a journey container with customizable stations
- Teachers drag scaffolding blocks (time management, goal-setting, self-assessment) into a student's journey
- System suggests scaffolding based on Discovery Profile + past performance
- MiniSkills can serve as embedded Open Studio scaffolding

**For Dimensions3:** Add `journey` as 13th activity category (already noted in Q1). Everything else is post-Dimensions3.

---

## Q16: Other Platform Safety Considerations

Beyond content moderation (Q2) and school compliance (Q12):

- **Rate limiting on student AI interactions** — already have 30/min on Design Assistant, but need per-student daily caps to prevent abuse/cost explosion
- **Session hijacking** — student tokens are nanoid(48) with 7-day TTL. Should add: IP binding (warn on IP change), device fingerprinting (optional), automatic session invalidation on password change (when teacher changes student's access code)
- **Teacher impersonation** — student URL patterns are predictable. Add CSRF tokens to all student mutation endpoints
- **Gallery abuse** — anonymous peer reviews could be used for bullying. Add: word-level toxicity check on reviews, teacher approval queue for flagged reviews, ability to identify anonymous reviewers (teacher-only, not students)
- **Data export** — GDPR right to erasure / data portability. Need a "Download my data" + "Delete my account" flow for both teachers and students (via teacher request for minors)
- **Backup/restore** — Supabase point-in-time recovery exists, but should document RPO/RTO for school IT admins

---

## Q17: Monetisation

**Answer:** Created `docs/projects/monetisation.md` with full tier structure, architecture requirements, and build estimate.

**For Dimensions3:** Add `tier TEXT DEFAULT 'free'` to `teacher_profiles` in the Phase A migration. Add a `checkTierAccess()` stub function that returns `{ allowed: true }` for everyone during beta. Generation routes include the check but it's a no-op until Stripe is wired.

This is ~0.5 days of work piggybacked onto Phase A. Means every new route we write is tier-aware from day one, even if enforcement is off.

---

## Q18: Dynamic/Interactive Content in Blocks (SCAMPER Example)

**Question:** How is SCAMPER (interactive tool) stored as a block? How are AI features and interactive aspects stored?

**Answer:** This is an important architectural question. SCAMPER is currently a ~550-line React component at `/toolkit/scamper` with its own API endpoint at `/api/tools/scamper`. When it becomes a block, it needs to carry:

1. **Interactive configuration** — which SCAMPER steps are included, custom prompts per step, time limits, example text
2. **AI endpoint reference** — which API route handles the AI feedback
3. **Component reference** — which React component renders it
4. **State schema** — what shape the student's saved state takes (for persistence and cross-block reference)

**Proposed block schema addition:**

```typescript
// New JSONB field on activity_blocks
interactive_config: {
  component_id: string;        // 'scamper' | 'six-hats' | 'decision-matrix' | etc.
  tool_config: Record<string, any>;  // Per-tool customisation (steps to include, custom prompts, time limits)
  ai_endpoint: string;         // '/api/tools/scamper' — or null for non-AI tools like Dot Voting
  state_schema: string;        // JSON Schema defining the shape of saved student state
  requires_challenge: boolean; // true = student must enter a challenge/topic first
  estimated_duration: string;  // timeWeight override for this specific interactive
}
```

**How it works in the lesson editor:**
- Teacher drags a "SCAMPER" block from the block library into a lesson
- The block renders as the full interactive SCAMPER tool inline (same component, embedded mode)
- Teacher can customise via `tool_config`: disable certain steps, change prompts, adjust time
- Student sees the full interactive experience within their lesson page
- State saves to `student_progress.responses` as JSON (already working — wired 26 Mar)

**Current state:** All 27 interactive tools are already wirable as lesson editor blocks via `ToolkitResponseInput.tsx` (built 29 Mar). The `tool_config` layer adds teacher customisation on top.

**Limits:** The current architecture supports any React component as a block. The limit is building new components — each interactive tool is 500-1000 lines of React + 300-400 lines of API. The Block Library doesn't change this — it just makes existing interactive tools discoverable, reusable, and customisable.

**Future expansion:** Rich interactive blocks (simulations, 3D viewers, collaborative whiteboards) would follow the same pattern: React component + optional AI endpoint + state schema. The architecture doesn't limit what a block can be — it just standardises how blocks are stored, discovered, and rendered.

**Spec update needed:** Add `interactive_config` JSONB field to the `activity_blocks` SQL schema in Section 5.3.
