# Discovery Engine — AI Integration Touchpoint Map
*Every place AI fires, what model, what latency, what happens if it fails.*

**Status:** Pre-build review. Must be locked before writing code.
**Companion docs:** `discovery-engine-ux-design.md` (visuals), `discovery-engine-spec.md` (data model), `discovery-engine-v3-intelligence.md` (intelligence layer), `education-ai-patterns.md` (patterns)
**Date:** 26 March 2026

---

## Why This Document Exists

The v3-intelligence spec defines WHAT the AI does. This document defines HOW it integrates with the UX — every call, every fallback, every latency budget, and every place where the generated-image approach creates constraints the AI layer needs to work around.

**6 issues the v3 spec didn't address** (because the UX wasn't designed yet):

1. **Static images can't be dynamically modified** — scene emphasis (Station 4) needs overlay approach, not SVG manipulation
2. **Station reordering affects the visual journey** — the background images and journey bar must adapt
3. **Text prompt analysis needs its own pattern** — not ideation (toolkit) and not evaluation, it's self-revelation
4. **Community scene clickable regions** — need image-map coordinates, not SVG hotspots
5. **Profile → Design Assistant handoff** — data format and injection point undefined
6. **Resilience** — what happens when AI calls fail mid-journey?

---

## Complete Touchpoint Map

### Legend

- **🟢 No AI** — pure logic, content selection, or UI
- **🔵 Haiku 4.5** — fast, cheap, student-facing
- **🟣 Sonnet 4** — expensive, high-stakes generation
- **⚡ Sync** — student waits (must be fast)
- **🔄 Async** — background, student doesn't wait
- **📊 Logic** — deterministic computation, no LLM call

---

### Pre-Journey

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 0.1 | Age band determination | 🟢📊 | Read `grade_level` from `class_students` → map to junior/senior/extended | Instant | Default to `senior` if unknown |
| 0.2 | Content pool selection | 🟢📊 | Filter activities by `ageBands` array, select age-appropriate scenarios | Instant | Use `senior` pool (largest) |
| 0.3 | Session creation | 🟢 | Create `discovery_sessions` row with student_id, start time, age_band | Instant | Retry once, then proceed without persistence (in-memory only) |

---

### Station 0: Design Identity Card

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 0.4 | Color palette selection | 🟢📊 | Map palette → temperament signal, store in profile | Instant | — |
| 0.5 | Tool belt selection | 🟢📊 | Map 3 tools → archetype weights using tool→archetype table, capture selection order + timing | Instant | — |
| 0.6 | Workspace decoration | 🟢📊 | Map 4 items → working style signals using item→trait table, capture placement order | Instant | — |
| 0.7 | Behavioral baseline | 🟢📊 | Calculate: time per screen, decisiveness (first-pick speed), reconsideration count (swaps) | Instant | — |

**No AI calls in Station 0.** Everything is deterministic mapping. The Identity Card is pure data collection via interaction.

---

### Station 1: Campfire (Meeting Kit)

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 1.1 | Kit introduction | 🟢 | Pre-written Kit intro text, displayed with Rive animation | — | — |
| 1.2 | Quick-fire binary choices (10-12 pairs) | 🟢📊 | Each pair maps to a working style dimension. Capture: choice, response time, any hesitation (mouse hover before tap) | Instant per pair | — |
| 1.3 | Working style vector computation | 📊 | 10-12 binary dimensions → composite working style profile. Deterministic. | Instant | — |
| 1.4 | **Kit reflects on quick-fire** | 🔵⚡ | Haiku generates 2-3 sentence reflection on the pattern ("So you're a morning person who starts before planning — interesting...") | <2s | Pre-written generic reflection based on dominant dimension ("Looks like you're someone who dives in first — let's see where that takes us.") |
| 1.5 | **Behavioral composite computation** | 📊 | Calculate anxiety/confidence/engagement signals from all Station 0+1 behavioral data. Determine student type: anxious_rusher, confident_decider, explorer, standard | Instant | Default to `standard` |
| 1.6 | **Route decision** | 📊 | Based on behavioral composite + age_band, determine station order for Stations 2-4 | Instant | Default order: 2→3→4 |

**AI calls in Station 1:** 1 Haiku call (reflection). Everything else is deterministic.

**Route decision detail:**
```
IF behavioral_composite == 'anxious_rusher':
  → 3 → 4 → 2 (interests first, identity last)
ELIF behavioral_composite == 'confident_decider':
  → 2(compressed) → 3(compressed) → 4(compressed)
ELIF age_band == 'junior':
  → 3 → 2 → 4 (interests before identity for younger students)
ELSE:
  → 2 → 3 → 4 (standard)
```

**How routing affects the UI:**
- Journey bar station order changes (icons reposition)
- Station background images load in the new order
- Kit's transition dialogue adjusts ("Let me show you something" vs "Follow me to the workshop")
- **Implementation:** `stationOrder: string[]` in the discovery state machine. JourneyBar and StationScene both read from this array. Images are prefetched based on the order.

---

### Station 2: Workshop (Strengths & Archetype)

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 2.1 | Kit's failure story selection | 🟢📊 | Select from 3-4 pre-written Kit failure stories based on working style from S1. Planner → over-planning story. Doer → jumping-in-too-fast story. | Instant | Use default story (generic Kit failure) |
| 2.2 | Scenario framing adaptation | 🟢📊 | Scenario TEXT is selected from 2 variants per scenario: planning-language vs action-language, based on working style. Images are always the same. | Instant | Use default framing |
| 2.3 | **Text prompt #1 analysis** | 🔵⚡ | "Your friend is panicking..." — Haiku analyzes for archetype signals, action orientation, specificity, emotional charge. Returns structured JSON. | <2s | Skip analysis, weight archetype purely from scenario responses |
| 2.4 | **Kit reflects on text prompt** | 🔵⚡ | Haiku generates 2-sentence reflection referencing SPECIFIC words the student used. | <2s | Generic reflection: "That tells me a lot about how you handle pressure." |
| 2.5 | **Mid-station adaptation** | 📊 | After 3 of 6 scenarios: calculate archetype confidence. If >70% one type → remaining 3 are confirmation. If two tied → differentiator. If scattered → broader. | Instant | Use default remaining scenarios |
| 2.6 | **Archetype reveal generation** | 🔵⚡ | Generate: archetype name, 2-sentence description, famous exemplar, strength narrative. | <2s | Pre-written descriptions for each of the 6 archetypes (always available) |

**AI calls in Station 2:** 3 Haiku calls (text analysis, reflection, reveal). Mid-station adaptation is deterministic.

**Text prompt analysis prompt structure:**
```
System: You are analyzing a student's response to a design scenario for
archetype signals. The student is {age_band}. Respond ONLY with JSON.

User: The student was asked: "Your best friend is panicking — big project
due tomorrow, 2 hours left. What do you actually do?"

Their response: "{student_text}"

Analyze for:
- primary_archetype: which of [Maker, Researcher, Leader, Communicator, Creative, Systems_Thinker] this response most suggests
- confidence: 0-100 how clearly this maps to one archetype
- action_words: list of action verbs the student used
- specificity: low/medium/high — did they give concrete details?
- emotional_charge: low/medium/high — how much feeling is in the response?
- key_phrase: the most revealing phrase (max 8 words)
```

**Why this isn't effort-gating:** The toolkit effort-gating pattern checks word count + reasoning markers to decide feedback tone. Here, we're not giving feedback — we're EXTRACTING signal. The analysis is classification, not coaching. Different prompt, different output structure.

---

### Station 3: Collection Wall (Interests & Values)

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 3.1 | Kit's collection stories | 🟢 | Pre-written. Kit shows their eclectic collection, normalizes not having "one passion." | — | — |
| 3.2 | Interest icon selection | 🟢📊 | 20 interest icons → student picks 5-7. Capture: selection order, timing, any deselects | Instant | — |
| 3.3 | Irritation signal | 🟢📊 | Scenario select or text. If text: analyzed like a mini text prompt (async). | Instant UI / <2s analysis | Skip irritation analysis, use icon selections only |
| 3.4 | YouTube rabbit holes | 🟢📊 | Icon grid selection. Purely data collection. | Instant | — |
| 3.5 | Values ranking | 🟢📊 | Drag-sort 8 cards into 3 tiers. Capture: order, time per decision, reconsideration. | Instant | — |
| 3.6 | **Kit connects the dots** | 🔵⚡ | Haiku synthesizes: interests + values + irritation → "You said X, Y, Z — there's a pattern here..." | <2s | Pre-written pattern template: "Your interests in [top 2] and your value of [top value] point somewhere interesting." |
| 3.7 | **Interest Map reveal generation** | 🔵⚡ | Haiku identifies 1-2 non-obvious cross-domain connections between interests. | <2s | Connect top 2 interests with a generic bridge: "[Interest 1] and [Interest 2] both involve [common theme]." |

**AI calls in Station 3:** 2 Haiku calls (synthesis, reveal). Optional 3rd if irritation was text input.

---

### Station 4: Window (Problems & Empathy)

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 4.1 | Kit's story | 🟢 | Pre-written. Kit tells about a student who saw a problem nobody noticed. | — | — |
| 4.2 | **Community scene hotspot emphasis** | 📊🟢 | Based on archetype + interests, 2-3 of 10+ hotspots get CSS overlay glow. The base image is STATIC (ChatGPT-generated). Emphasis is a positioned semi-transparent gradient overlay at known pixel coordinates. | Instant | No emphasis — all hotspots equal (still works, just less personalized) |
| 4.3 | Scene interaction tracking | 🟢📊 | Track: which hotspots clicked, click order, hover time before click, total hotspots noticed. | Instant | — |
| 4.4 | "Zoom in" narrowing | 🟢📊 | Student picks the problem that matters most. Pure selection. | Instant | — |
| 4.5 | "Who's affected?" sliders | 🟢📊 | 3 slider values captured. | Instant | — |
| 4.6 | **Text prompt #2 analysis** | 🔵⚡ | "What shouldn't be this hard?" — Haiku analyzes for: problem specificity, empathy depth, systemic vs individual framing, actionability. | <2s | Skip analysis, weight empathy from scene clicks + narrowing |
| 4.7 | **Bridge synthesis** | 🔵⚡ | Haiku connects archetype + interests + empathy: "These three things point somewhere..." This is the first moment where the student feels the data converging. | <3s | Template: "Your [archetype] instincts, your interest in [top interest], and the way you noticed [empathy target] — I'm starting to see something." |
| 4.8 | **Empathy Compass reveal** | 🔵⚡ | Generate empathy target description, scale assessment, pattern insight. | <2s | Pre-computed from scene clicks + text (deterministic compass without AI narrative) |

**AI calls in Station 4:** 3 Haiku calls.

**Critical: Community scene with generated images**

The v3 spec assumed SVG scenes with dynamically weighted hotspots. With generated images, we need:

```
SCENE_HOTSPOTS = [
  { id: 'lonely_student', type: 'people', coords: { x: 120, y: 340, w: 80, h: 100 },
    label: 'A student eating alone', emphasisForArchetypes: ['Communicator', 'Leader'] },
  { id: 'broken_fountain', type: 'system', coords: { x: 450, y: 200, w: 90, h: 120 },
    label: 'A broken water fountain', emphasisForArchetypes: ['Maker', 'Systems_Thinker'] },
  // ... 8-10 more
]
```

**Emphasis overlay implementation:**
```tsx
function HotspotOverlay({ hotspot, isEmphasized, onClick }) {
  return (
    <motion.button
      className="absolute rounded-full"
      style={{
        left: hotspot.coords.x, top: hotspot.coords.y,
        width: hotspot.coords.w, height: hotspot.coords.h,
      }}
      animate={isEmphasized ? {
        boxShadow: ['0 0 0px rgba(255,200,100,0)', '0 0 20px rgba(255,200,100,0.4)', '0 0 0px rgba(255,200,100,0)'],
      } : {}}
      transition={{ repeat: Infinity, duration: 3 }}
      onClick={() => onClick(hotspot.id)}
    />
  );
}
```

The image is generated once. Hotspot coordinates are defined per age band (junior scene may have simpler/fewer hotspots). The overlay is invisible until hovered — then shows a subtle glow ring. Emphasized hotspots have a slow-pulsing ambient glow that draws the eye without forcing the click.

---

### Between S4 → S5: Pre-Generation Window

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 4.9 | **Pre-generate Station 6 draft** | 🟣🔄 | Start a background Sonnet call with data from S1-S4 to draft 3 project directions. This gives a 3-5 second head start on the expensive call. Result cached, updated after S5. | Background | If pre-gen fails, full generation at S6 (adds ~3s to door reveal wait) |
| 4.10 | **Contextualize S5 resources** | 📊 | Based on emerging project direction (archetype + interests + empathy), order resource cards and self-efficacy sliders by relevance. | Instant | Default order |

---

### Station 5: Toolkit (Resources & Readiness)

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 5.1 | Kit scoping dialogue | 🟢 | Pre-written: "Every first-timer thinks too big. That's normal." | — | — |
| 5.2 | Time/resource/people data collection | 🟢📊 | Sliders, card sorts, icon selections. All deterministic. | Instant | — |
| 5.3 | **Self-efficacy pattern detection** | 📊 | Deterministic check: all-high (>80 avg), all-low (<30 avg), spike (one domain >2x others). Triggers Kit speech variant. | Instant | — |
| 5.4 | **Kit self-efficacy response** | 🔵⚡ | Based on pattern: all-high → challenge ("Which one are you LEAST confident in?"). All-low → reframe ("Low scores aren't bad — they're honest."). Spike → highlight. | <2s | Pre-written response per pattern type (3 variants) |
| 5.5 | **Readiness assessment** | 🔵⚡ | Haiku generates: Readiness Radar data (5 axes scored), gap identification, mentor gap commentary. | <2s | Compute radar deterministically from slider values + resource inventory. Skip mentor commentary. |

**AI calls in Station 5:** 2 Haiku calls.

---

### Station 6: Crossroads (Direction) — THE BIG ONE

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 6.1 | **Generate 3 project directions** | 🟣⚡ | Sonnet 4 synthesizes ALL data (S0-S5: ~38 explicit data points + behavioral signals) into 3 ProjectDirection objects. If pre-gen from 4.9 exists, UPDATE it with S5 data. If not, generate from scratch. | <5s (or <2s if pre-gen hit) | **Critical fallback needed.** See below. |
| 6.2 | Door exploration UI | 🟢 | Student reads 3 directions, rates excitement (1-5 slider per door). | — | — |
| 6.3 | **Kit reacts to excitement ratings** | 🔵⚡ | After student rates all 3: "Your gut reaction to Door 2 was strongest — trust that instinct." Or: "All three excited you equally — that's rare. Let's dig deeper." | <2s | Template based on which door scored highest |
| 6.4 | Fear identification | 🟢📊 | 5 illustrated scenario cards. Pure selection. | Instant | — |
| 6.5 | **Door elimination + selection** | 🟢📊 | Student picks their door. Capture: elimination order, time spent on each, any revisits. | Instant | — |
| 6.6 | **Post-selection feasibility** | 🔵⚡ | Kit grounds the choice: references specific resources from S5, time constraints, confidence gaps. "With your 4 hours a week and your making skills, this is ambitious but doable IF you start with [specific first step]." | <3s | Template: "Good choice. Let's make it real in the next step." |

**Station 6 is the highest-stakes AI moment.** The 3 doors are the product of everything that came before. If this call fails, the student's experience collapses.

**Door generation prompt structure:**
```
System: You are generating 3 project directions for an {age_band}
MYP Design student. You have their complete Discovery profile below.
Generate exactly 3 options as JSON.

Door 1 ("Sweet Spot"): Highest overlap between archetype, interests,
empathy target, AND available resources. Achievable with what they have.
Door 2 ("Stretch"): Matches archetype + interests but requires growing
into a resource gap. Realistic but challenging.
Door 3 ("Surprise"): A non-obvious connection the student hasn't made.
Uses an unexpected intersection of their data points.

{age_band} calibration:
- junior: concrete, school-scale, 4-6 week scope, familiar contexts
- senior: community-scale, 6-8 week scope, can involve external people
- extended: ambitious, 8-12 week scope, can involve research or advocacy

Student profile:
{full_discovery_profile_json}

Return JSON:
{
  "doors": [
    {
      "number": 1,
      "title": "short evocative title (max 6 words)",
      "description": "2-3 sentences. Vivid, specific, exciting.",
      "why_this_fits": "1 sentence connecting to their specific data",
      "first_step": "the concrete thing they'd do in Week 1",
      "resources_needed": ["from their inventory"],
      "resources_gap": ["what they'd need to find/learn"],
      "ambition_level": "achievable|stretch|ambitious",
      "archetype_alignment": "which archetype this serves"
    }
  ]
}
```

**Critical fallback for door generation failure:**

If Sonnet fails (timeout, 500, rate limit):
1. **Retry once** with Sonnet (1s delay)
2. If retry fails, **fall back to Haiku** with a simplified prompt (fewer cross-references, simpler output)
3. If Haiku fails, **use template doors** built from the student's top archetype + top interest + top empathy target:
   - Door 1: "[Archetype verb] a [interest-related] solution for [empathy target]"
   - Door 2: "Research and design a [interest-related] system that addresses [empathy target]"
   - Door 3: "Create a [creative medium] that raises awareness about [empathy target]"
4. Template doors are less personalized but still use the student's actual data. The journey continues.

```tsx
async function generateDoors(profile: DiscoveryProfile): Promise<ProjectDirection[]> {
  try {
    return await callSonnet(DOOR_GENERATION_PROMPT, profile);
  } catch (e1) {
    console.error('[Discovery] Sonnet door gen failed, retrying...', e1);
    try {
      return await callSonnet(DOOR_GENERATION_PROMPT, profile);
    } catch (e2) {
      console.error('[Discovery] Sonnet retry failed, falling back to Haiku', e2);
      try {
        return await callHaiku(DOOR_GENERATION_PROMPT_SIMPLIFIED, profile);
      } catch (e3) {
        console.error('[Discovery] All AI failed, using template doors', e3);
        return buildTemplateDoors(profile);
      }
    }
  }
}
```

---

### Station 7: Launchpad (Commitment & Grand Reveal)

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 7.1 | Project statement scaffolding | 🟢📊 | Pre-fill template: "I will [chosen door title], for [empathy target], because [value]." Student edits. | Instant | — |
| 7.2 | Success criteria | 🟢📊 | AI suggests 3 criteria based on chosen door. Student can edit/add. | <2s Haiku | 3 generic criteria: "It works", "People use it", "I learned something" |
| 7.3 | **Grand Reveal generation** | 🟣⚡ | Sonnet 4 generates the full profile package: multi-paragraph narrative, Ikigai circle contents (4 circles mapped from data), archetype title + description, 3 refined project suggestions from chosen door, first milestone suggestion. | <5s | **Staggered reveal fallback** — see below |
| 7.4 | **Shareable profile text** | 🔵🔄 | Haiku generates concise text overlays for the PNG export (title, tagline, 3 key traits). | <2s (async, not blocking reveal) | Use archetype title + top interest + top value as static text |
| 7.5 | Reveal animation sequence | 🟢 | 12-15 second choreographed animation using the Sonnet output. UI-only. | — | — |
| 7.6 | Save & Share | 🟢 | Generate PNG (html-to-image or canvas), generate PDF, store DiscoveryProfile JSON. | 1-2s for image gen | Offer "download later" if image gen slow |

**Staggered reveal fallback:**

If the Sonnet Grand Reveal call fails, don't show a loading error. Instead:

1. **Phase 1 (instant, no AI):** Show the Identity Card (already built), archetype from S2 reveal (already generated), Ikigai circles with RAW DATA labels (interests, strengths, empathy targets, resources — direct from profile, no narrative needed)
2. **Phase 2 (retry in background):** While student looks at Phase 1, retry the Sonnet call. If it succeeds, animate the narrative text into the existing layout.
3. **Phase 3 (if all AI fails):** Use template narrative: "You're a [archetype] who cares about [empathy target]. Your strengths in [top 2 strengths] combined with your interest in [top interest] point toward [chosen door title]. Your first step: [door.first_step]."

The student ALWAYS gets a reveal. The quality varies, but the experience never breaks.

---

### Post-Journey

| # | Touchpoint | Type | What Happens | Latency | Fallback |
|---|-----------|------|-------------|---------|----------|
| 8.1 | **Teacher dashboard summary** | 🔵🔄 | Haiku generates 200-word teacher-facing profile summary. Background, after student closes. | <3s (async) | Store raw profile data. Teacher sees structured data without narrative. |
| 8.2 | **Cross-domain insight computation** | 📊🔄 | Deterministic: archetype × empathy, values × self-efficacy tensions, working style × resources, fear × archetype. Log for data science. | Instant | — |
| 8.3 | **First milestone suggestion** | 🔵🔄 | Haiku generates Week 1 concrete action based on chosen door + resources + self-efficacy. | <2s (async) | Template: "This week, spend 30 minutes [door.first_step]. Take a photo of what you find/make." |
| 8.4 | **Design Assistant prompt injection** | 🟢📊 | Build `discoveryContext` string from DiscoveryProfile. Inject into Design Assistant system prompt via `buildOpenStudioSystemPrompt()`. | Instant | Design Assistant works without discovery context (same as today) |
| 8.5 | Profile persistence | 🟢 | Store full DiscoveryProfile JSON in `student_discovery_profiles` table. Link to student_id + unit_id (or class_id for standalone). | Instant | Retry once. If DB fails, store in localStorage as emergency backup. |

---

## Design Assistant Handoff (Critical Pipeline)

The DiscoveryProfile feeds into the rest of the student's Open Studio experience. Here's the data flow:

```
Discovery Engine (this feature)
        ↓
  DiscoveryProfile JSON (stored in DB)
        ↓
  Design Assistant system prompt injection
        ↓
  AI mentor knows: archetype, working style, strengths,
  interests, empathy target, project direction, fears,
  self-efficacy gaps, collaboration style
        ↓
  Mentor behavior adapts:
  - Scaffolding level matches self-efficacy
  - Nudge style matches working style
  - Milestone pacing matches time horizon awareness
  - Encouragement targets known fears
  - Project suggestions stay within chosen direction
```

**DiscoveryProfile → System Prompt format:**

```typescript
function buildDiscoveryContext(profile: DiscoveryProfile): string {
  return `
## Student Discovery Profile
This student completed the Discovery Engine on ${profile.completedAt}.

**Design Archetype:** ${profile.archetype.primary} (${profile.archetype.confidence}% confidence)
${profile.archetype.secondary ? `Secondary: ${profile.archetype.secondary}` : ''}

**Working Style:** ${profile.workingStyle.summary}
- Decision making: ${profile.workingStyle.decisionStyle}
- Energy: ${profile.workingStyle.energyPattern}
- Collaboration: ${profile.workingStyle.collaborationStyle}

**Interests:** ${profile.interests.clusters.join(', ')}
**Top Values:** ${profile.values.top3.join(', ')}

**Empathy Target:** ${profile.empathy.target}
- Scale: ${profile.empathy.scale} (personal/school/community/global)
- Problem type: ${profile.empathy.type} (people/system)

**Project Direction:** ${profile.project.title}
- Statement: "${profile.project.statement}"
- Ambition: ${profile.project.ambitionLevel}
- First step: ${profile.project.firstStep}

**Self-Efficacy Profile:**
${profile.selfEfficacy.domains.map(d => `- ${d.name}: ${d.score}/100`).join('\n')}
Biggest gap: ${profile.selfEfficacy.biggestGap}

**Known Fear:** ${profile.fear.primary}
**Time Budget:** ${profile.resources.hoursPerWeek} hours/week
**Time Horizon:** ${profile.resources.timeHorizonFeeling}

**Mentor Guidelines for this student:**
- Working style is "${profile.workingStyle.dominant}" — ${profile.workingStyle.dominant === 'planner' ? 'respect their need to plan but nudge toward action by Week 2' : 'channel their energy into focused milestones so they don\'t scatter'}
- Fear of "${profile.fear.primary}" — ${getFearGuidance(profile.fear.primary)}
- Self-efficacy gap in "${profile.selfEfficacy.biggestGap}" — scaffold this area, celebrate small wins
- Archetype "${profile.archetype.primary}" — ${getArchetypeGuidance(profile.archetype.primary)}
`.trim();
}
```

**Injection point:** `src/lib/ai/open-studio-prompt.ts` → `buildOpenStudioSystemPrompt()` already accepts student context. Add `discoveryContext` as a new section after the existing student data.

---

## AI Call Budget Summary

| Station | Haiku Calls | Sonnet Calls | Total Calls | Est. Cost |
|---------|-------------|-------------|-------------|-----------|
| 0 (Identity Card) | 0 | 0 | 0 | $0 |
| 1 (Campfire) | 1 | 0 | 1 | $0.001 |
| 2 (Workshop) | 3 | 0 | 3 | $0.003 |
| 3 (Collection Wall) | 2-3 | 0 | 2-3 | $0.003 |
| 4 (Window) | 3 | 0 | 3 | $0.003 |
| Pre-S6 | 0 | 1 (async) | 1 | $0.025 |
| 5 (Toolkit) | 2 | 0 | 2 | $0.002 |
| 6 (Crossroads) | 2 | 1* | 3 | $0.027 |
| 7 (Launchpad) | 1 | 1 | 2 | $0.026 |
| Post-journey | 2 | 0 | 2 | $0.002 |
| **TOTAL** | **16-17** | **3** | **19-20** | **~$0.09** |

*Station 6 Sonnet call may use pre-generated draft from the async call between S4→S5, reducing to an update rather than full generation.

**Cost per student: ~$0.09.** Very affordable. The most expensive moment is Station 6 door generation (Sonnet) — justified because it's the defining moment of the experience.

---

## Latency Budget

**Student-visible wait states:**

| Moment | Max Wait | What Student Sees | Reality |
|--------|----------|-------------------|---------|
| Kit reflects (S1, S2, S3, S4, S5) | 2s | Kit switches to "thinking" expression (Rive), typing indicator dots appear in speech bubble | Haiku call |
| Bridge synthesis (S4) | 3s | Kit's eyes move upward (thinking), speech bubble shows "..." with gentle pulse | Haiku call |
| Door generation (S6) | 5s | Full-screen "Kit is thinking hard about your journey..." with animated illustration. This is the ONE place where a loading state is acceptable. | Sonnet call (or pre-gen hit for <2s) |
| Grand Reveal (S7) | 5s | Intentional: the 12-15s animation sequence STARTS immediately with Phase 1 data (identity card, archetype). Narrative text animates in as Sonnet response arrives. Student doesn't perceive a wait because the animation IS the experience. | Sonnet call overlapping with animation |

**Rule: NEVER show a loading spinner.** Always show Kit thinking (Rive expression change), or start an animation that the AI response fills into.

---

## Resilience & Edge Cases

### Student closes browser mid-journey
**Solution:** Auto-save after every activity completion. `discovery_sessions` table stores full state as JSONB (`current_station`, `completed_activities`, `profile_so_far`, `behavioral_data`). On return, restore to last completed activity. Kit says: "Welcome back — I remember where we were."

### Student is offline or on slow connection
**Solution:** Queue AI calls. All deterministic computations (behavioral scoring, archetype weighting, route decisions) work offline. Mentor speech falls back to pre-written variants. When connection returns, queued calls fire and update the profile retroactively. The journey never stops.

### AI returns malformed JSON
**Solution:** Every AI call has regex fallback parsing (same pattern as toolkit tools). If JSON parse fails, extract key fields with regex. If regex fails, use template fallback. Log the malformed response for debugging.

```typescript
function parseAIResponse<T>(raw: string, fallback: T): T {
  try {
    // Try JSON parse first
    const json = JSON.parse(raw);
    if (validateSchema(json)) return json;
  } catch {}

  try {
    // Try extracting JSON from markdown code block
    const match = raw.match(/```json?\s*([\s\S]*?)```/);
    if (match) {
      const json = JSON.parse(match[1]);
      if (validateSchema(json)) return json;
    }
  } catch {}

  // Log failure, return fallback
  console.error('[Discovery] AI response parse failed, using fallback', { raw });
  return fallback;
}
```

### Student answers inconsistently
**Covered in v3 spec:** AI detects scattered responses (no dominant archetype after 3 scenarios) and adapts: broader scenarios, reveal acknowledges exploration ("You're not one type — you're a blend"). The behavioral composite flags this as `identity_exploring` — a healthy signal, not an error.

### Student rushes through everything (<2s per response)
**Covered in v3 spec:** Compression triggers. Skip mentor stories, reduce scenario count, shorter reveals. But also: log this as a potential data quality warning. The teacher summary notes: "This student moved very quickly through Discovery — responses may not fully reflect their thinking. Consider a follow-up conversation."

### Student takes days to complete (not one sitting)
**Solution:** Save state after every activity. No timeout on the journey. When they return, Kit acknowledges the gap: "It's been a few days — let's pick up where we left off. Here's what I remember about you so far..." (Haiku generates recap from profile-so-far). Behavioral data from the first session is preserved but time-between-sessions is noted (could indicate low engagement or just schedule constraints — ambiguous).

---

## Data Model Integration

### New Tables Needed

```sql
-- Student discovery profiles (the output)
CREATE TABLE student_discovery_profiles (
  id TEXT PRIMARY KEY DEFAULT nanoid(12),
  student_id TEXT NOT NULL REFERENCES students(id),
  class_id TEXT,  -- nullable (standalone mode)
  unit_id TEXT,   -- nullable (standalone mode)
  status TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | completed | abandoned
  age_band TEXT NOT NULL,  -- junior | senior | extended
  mentor TEXT NOT NULL DEFAULT 'kit',
  station_order TEXT[] NOT NULL,  -- ordered station IDs
  current_station TEXT,
  profile_data JSONB NOT NULL DEFAULT '{}',  -- DiscoveryProfile
  behavioral_data JSONB NOT NULL DEFAULT '{}',  -- all stealth signals
  activity_log JSONB NOT NULL DEFAULT '[]',  -- ordered list of every activity + response + timing
  ai_calls_log JSONB NOT NULL DEFAULT '[]',  -- every AI call with prompt, response, latency, model
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_time_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_discovery_student ON student_discovery_profiles(student_id);
CREATE INDEX idx_discovery_status ON student_discovery_profiles(status);
```

### DiscoveryProfile JSON Shape

```typescript
interface DiscoveryProfile {
  version: 1;
  studentId: string;
  ageBand: 'junior' | 'senior' | 'extended';
  mentor: 'kit'; // expand later

  identityCard: {
    palette: string;  // warm | cool | bold | earth | neon
    tools: string[];  // 3 tool IDs
    toolOrder: string[];  // selection order
    workspace: string[];  // 4 item IDs
  };

  workingStyle: {
    dimensions: Record<string, number>;  // 10-12 binary dimensions as 0-1 values
    summary: string;  // AI-generated
    dominant: 'planner' | 'doer' | 'explorer' | 'balanced';
    decisionStyle: 'gut' | 'analytical' | 'consensus';
    energyPattern: 'sprinter' | 'marathoner';
    collaborationStyle: 'lead' | 'negotiate' | 'defer' | 'parallel';
  };

  archetype: {
    primary: DesignArchetype;
    secondary?: DesignArchetype;
    confidence: number;  // 0-100
    scores: Record<DesignArchetype, number>;  // all 6 archetype scores
    narrative: string;  // AI-generated reveal text
  };

  interests: {
    icons: string[];  // 5-7 interest icon IDs
    clusters: string[];  // AI-identified cluster labels
    irritation: string;  // what annoys them
    curiosityTopics: string[];  // rabbit hole selections
    crossConnections: string[];  // AI-identified non-obvious links
  };

  values: {
    tiers: { core: string[]; important: string[]; nice: string[] };
    top3: string[];
  };

  empathy: {
    sceneClicks: string[];  // hotspot IDs clicked, in order
    target: string;  // the narrowed-down primary target
    scale: 'personal' | 'school' | 'community' | 'global';
    urgency: number;  // 0-100
    proximity: number;  // 0-100
    type: 'people' | 'system' | 'mixed';
    textResponse: string;  // "What shouldn't be this hard?"
    problemArticulation: string;  // AI-extracted clean problem statement
  };

  resources: {
    hoursPerWeek: number;
    inventory: { have: string[]; canGet: string[]; dontHave: string[] };
    people: string[];  // mentor, collaborator, expert, etc.
    timeHorizonFeeling: number;  // 0 (ages away) to 100 (basically tomorrow)
  };

  selfEfficacy: {
    domains: { name: string; score: number }[];
    pattern: 'all_high' | 'all_low' | 'spike' | 'mixed';
    biggestGap: string;
    biggestStrength: string;
  };

  experience: {
    pastProjectCount: number;
    lastOutcome: string;
    failureResponse: string;
  };

  fear: {
    primary: string;  // from 5 illustrated cards
  };

  project: {
    doors: ProjectDirection[];  // all 3 generated
    chosen: number;  // 1, 2, or 3
    title: string;
    statement: string;  // "I will [what], for [who], because [why]"
    successCriteria: string[];
    firstStep: string;
    ambitionLevel: 'achievable' | 'stretch' | 'ambitious';
  };

  // AI-generated synthesis
  ikigai: {
    love: string[];    // from interests + values
    goodAt: string[];  // from archetype + self-efficacy
    worldNeeds: string[];  // from empathy
    realistic: string[];   // from resources
    intersection: string;  // the sweet spot
  };

  grandRevealNarrative: string;  // Sonnet-generated multi-paragraph profile
  teacherSummary: string;  // Haiku-generated 200-word teacher summary
  crossDomainInsights: CrossDomainInsight[];  // computed novel correlations
}
```

---

## Locked Design Decisions (26 March 2026)

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| 1 | Adaptive station routing | **Fixed order for MVP.** Data model supports variable (`station_order` array). Switch to adaptive in v2 once we have real behavioral data. | Reduces state machine, journey bar, and prefetching complexity. |
| 2 | Community scene variants | **Defer — get a working prototype first.** Revisit after MVP is playable. | 1 shared scene is fine for prototype. Age-band variants are a v2 concern. |
| 3 | AI calls blocking reveals | **No — staggered reveal.** Animation starts with deterministic data (identity card, archetype scores, Ikigai raw labels). AI narrative layers on top as it arrives. | Student never perceives a wait because the animation IS the experience. |
| 4 | Irritation text analysis | **Yes — Haiku call if 10+ words typed.** Rich signal worth the ~$0.001. | Card-only selections don't need analysis (selection IS the data). |
| 5 | Discovery without Open Studio | **Two unit modes — see "Discovery Modes" section below.** | This is an architectural insight, not just a config toggle. |

---

## Discovery Modes: Design Units vs Open Studio-Default Units

**Key insight (26 March 2026):** Discovery isn't just an Open Studio prerequisite. Some unit types (e.g., Service as Learning) are structured so that Open Studio IS the unit — there are no teacher-directed lessons to complete first. Discovery runs as the unit onboarding experience in two distinct modes:

### Mode 1: Design Units (Discovery unlocks after lessons)

The standard MYP Design unit flow:
1. Teacher creates unit with structured lessons (Opening → Mini-Lesson → Work Time → Debrief)
2. Students work through teacher-directed lessons
3. Teacher unlocks Open Studio for students who are ready
4. **Discovery runs as the gateway to Open Studio** — students discover their project direction
5. Student enters self-directed Open Studio mode with AI mentor

In this mode, Discovery is a REWARD — something students earn access to after demonstrating readiness through the structured lessons. The DiscoveryProfile enriches the Open Studio experience but doesn't replace the lesson sequence.

### Mode 2: Open Studio-Default Units (Discovery IS the beginning)

For unit types where self-direction is the point from day one:
1. Teacher creates unit and sets it to **default Open Studio mode** (template-level setting)
2. Students enter the unit and immediately hit Discovery — no lessons to complete first
3. Discovery serves as the onboarding/orientation for the whole unit
4. Student enters Open Studio with their project direction already defined
5. AI mentor guides from the start, informed by the DiscoveryProfile

**Use cases for Mode 2:**
- **Service as Learning** — students identify a community need (empathy station is critical) and design their own service project
- **Personal Project (PP)** — students define their own extended project
- **PYPx Exhibition** — similar to PP, student-driven inquiry
- **Any "passion project" or inquiry unit** where the teacher provides a framework but not content

### Implementation

```typescript
// On the units or class_units table (likely class_units for per-class override)
interface UnitOpenStudioConfig {
  defaultMode: 'teacher_directed' | 'open_studio_default';
  // teacher_directed = standard flow (lessons → unlock → Discovery)
  // open_studio_default = Discovery runs immediately as unit entry
  discoveryRequired: boolean;  // true for both modes in v1
  allowSkipDiscovery: boolean; // false for MVP, teacher override later
}
```

**What changes between modes:**

| Aspect | Mode 1 (Design) | Mode 2 (OS-Default) |
|--------|-----------------|---------------------|
| When Discovery runs | After teacher unlocks Open Studio | Immediately on unit entry |
| What triggers it | Teacher action (`open_studio_status.status = 'unlocked'`) | Student opens unit for first time |
| Kit's tone in S1 | "Now that you've learned the basics, let's figure out YOUR project..." | "Welcome to this unit — before we dive in, let's figure out what matters to you..." |
| Door generation context | Informed by lessons already completed (Kit knows what they've learned) | Pure Discovery — no prior unit context |
| Post-Discovery | Open Studio with AI mentor | Open Studio with AI mentor (identical) |
| Teacher dashboard | Shows Discovery completion alongside lesson progress | Shows Discovery as the FIRST progress milestone |

**Data model impact:** The `student_discovery_profiles` table already has `unit_id` (nullable). For Mode 2, `unit_id` is always set. For Mode 1, `unit_id` links to the unit where Open Studio was unlocked. The profile is still readable by ALL units the student is enrolled in (the Design Assistant checks `student_discovery_profiles` by `student_id`, not by `unit_id`).

**Kit's intro prompt needs a mode parameter:**

```typescript
function buildKitIntroPrompt(mode: 'post_lessons' | 'unit_entry', unitTitle: string, ageBand: AgeBand): string {
  if (mode === 'unit_entry') {
    return `The student is starting a self-directed unit called "${unitTitle}".
    They haven't completed any structured lessons — Discovery IS their beginning.
    Frame everything as "figuring out what your project will be" not "applying what you've learned."
    Be more exploratory and open-ended. Don't reference prior class activities.`;
  }
  return `The student has completed structured lessons and their teacher has unlocked Open Studio.
  They already have context from class. Frame Discovery as "now it's YOUR turn to choose direction."
  You can reference that they've been learning design skills and now get to apply them.`;
}
```

**Migration note:** Add `open_studio_default_mode` to `class_units` (not `units`) so teachers can override per class. A Service unit template might default to `open_studio_default`, but a teacher could override to `teacher_directed` if they want to teach some structured lessons first.
