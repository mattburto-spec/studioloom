# Education AI Patterns — Questerra Toolkit Standard

> Reference doc for all interactive toolkit tools, Journey Engine blocks, and student-facing AI interactions.
> Based on research into Khanmigo, Duolingo, ITS (Intelligent Tutoring Systems), and cognitive science.
> Established with SCAMPER tool (Mar 2026). Applied across all 27 interactive toolkit tools. Extends to Journey Engine blocks and any future student-facing AI interaction.

## Core Philosophy

**The student does the thinking. AI is the coach, not the player.**

Every AI interaction must pass this test: "Does this make the student think harder, or does it do the thinking for them?" If it does the thinking, cut it.

### Phase-Aware Feedback (Critical Rule)

**Match your AI feedback to the design thinking phase the tool operates in.**

- **Ideation tools** (SCAMPER, Brainstorm, Crazy 8s, etc.): AI must encourage DIVERGENT thinking — more ideas, wilder ideas, building on momentum. Never ask about flaws, feasibility, trade-offs, or "what could go wrong?" That kills creative flow. Good nudges: "What if you pushed that further?", "What else could this lead to?", "What would a completely different version look like?"

- **Evaluation tools** (Decision Matrix, PMI, Pairwise Comparison, etc.): AI should encourage CONVERGENT thinking — critical analysis, trade-offs, feasibility, who it works/doesn't work for. This is where "What could go wrong?" belongs.

- **Research tools** (Surveys, Interviews, etc.): AI should encourage depth and specificity — follow-up questions, edge cases, validating assumptions.

**The mistake to avoid:** Using evaluation-phase language in ideation tools. Asking "How would this rope know when to extend, and what stops it from deploying accidentally?" during brainstorming is evaluation masquerading as a nudge. It shuts down creative flow instead of fueling it.

---

## The Five Patterns

### 1. Effort-Gating (Before Feedback)

Assess the quality of a student's response BEFORE choosing a feedback strategy. Never give the same feedback to a lazy one-liner and a thoughtful paragraph.

**Client-side assessment (deterministic, instant):**
```typescript
function assessEffort(idea: string): 'low' | 'medium' | 'high' {
  const words = idea.trim().split(/\s+/).length;
  const hasReasoning = /\b(because|since|so that|in order to|this would|this could|which means|that way)\b/i.test(idea);
  const hasSpecifics = /\b(for example|such as|like|using|made of|instead of|rather than|compared to)\b/i.test(idea);
  const hasDetail = words >= 15;

  if (words < 6) return 'low';
  if ((hasDetail && hasSpecifics) || (hasDetail && hasReasoning) || (hasSpecifics && hasReasoning)) return 'high';
  if (words >= 10 || hasSpecifics || hasReasoning) return 'medium';
  return 'low';
}
```

**Why client-side:** Instant (no API latency), deterministic (no AI parsing failures), and the effort level is sent to the API so it can adapt its tone.

**How the API adapts by effort level:**
- **Low effort:** Push back with warmth. No praise. Challenge for specifics. "Can you describe specifically what material you'd use and why?"
- **Medium effort:** Acknowledge one detail, then push deeper. "Nice thinking about the hinge — what happens when someone with arthritis tries it?"
- **High effort:** Celebrate a specific detail, then push for second-order effects, trade-offs, or edge cases. "Strong reasoning about sustainability — who does this NOT work for?"

**Better than Khanmigo:** Khanmigo gives the same response style regardless of effort. We adapt the entire feedback strategy.

### 2. Socratic Feedback — Acknowledge → Question

Every AI nudge follows the Khanmigo pattern but with effort-gating:

```
[acknowledgment] → [one Socratic question]
```

**Rules for the AI:**
- Ask exactly ONE question (not two, not a paragraph)
- Maximum 25 words for the question
- Reference the student's SPECIFIC idea (never generic)
- Never suggest the answer in the question
- Vary the approach — try "what if", "what else", "how about", "imagine if"
- For low effort: skip the acknowledgment, nudge for specifics to EXPAND the idea
- **CRITICAL:** Match tone to the design phase (see Phase-Aware Feedback above)

**API returns structured response (ideation example):**
```json
{
  "acknowledgment": "Love the foldable handle idea!",
  "nudge": "What if you made it work for a completely different age group too?",
  "effortLevel": "high"
}
```

**Evaluation tool example (different phase, different tone):**
```json
{
  "acknowledgment": "Good point about durability!",
  "nudge": "What trade-off does that material choice create for weight?",
  "effortLevel": "high"
}
```

**Better than Khanmigo:** We separate acknowledgment from question, allowing the UI to render them differently (acknowledgment is smaller, bolder; question is italic, prominent). AND we match feedback tone to the design phase — Khanmigo uses the same critical tone everywhere.

### 3. Staged Cognitive Load (Adaptive Prompts)

Prompts adapt their difficulty based on how many ideas the student has already written:

| Student progress | Prompt difficulty | Strategy |
|---|---|---|
| 0 ideas | Introductory | Accessible, concrete, everyday connections. First prompt is the easiest entry point possible. |
| 1-2 ideas | Building | Push in new directions. Avoid angles already explored. Mix "what if" / "who else" / "what assumption". |
| 3+ ideas | Advanced | Challenge assumptions. Ask about trade-offs, unintended consequences, ethics, feasibility. |

**Implementation:** The `existingIdeas` array is sent to the API with each prompt request. The system prompt includes a `DIFFICULTY` block that adjusts based on `existingIdeas.length`.

**Card dealing enforces this:** Students see one prompt at a time with a 10-second thinking timer before they can reveal the next. This prevents cognitive overload and encourages engagement with each prompt before moving on.

**Better than Duolingo:** Duolingo has fixed difficulty tiers. Our prompts are contextual — they adapt to the student's specific design challenge AND their previous answers.

### 4. Micro-Feedback Loops (Instant Acknowledgment)

When a student submits an idea, they get IMMEDIATE visual feedback (client-side, before the API responds):

**Three feedback tiers:**
| Effort | Color | Animation | Example messages |
|---|---|---|---|
| High | Purple (#a78bfa) | `celebrateGlow` — expanding purple glow ring | "Deep thinking!", "Great detail!", "Strong reasoning!" |
| Medium | Blue (#60a5fa) | `softBounce` — gentle upward bounce | "Good — keep pushing!", "Nice start!", "Building momentum!" |
| Low | Amber (#f59e0b) | `softBounce` | "Try adding more detail", "Can you be more specific?" |

**Auto-dismisses after 3 seconds** — long enough to register, short enough not to interrupt flow.

**Depth dots** appear on each idea card (1-3 dots, color-coded by effort level). These give persistent visual feedback about idea quality without being judgmental.

**Thinking Depth Meter** — a small progress bar above the ideas list showing average quality across all ideas in the current step. Changes color from amber → blue → purple as the student writes more detailed ideas.

**Better than Duolingo:** Duolingo has binary right/wrong with XP. We have a spectrum of effort with nuanced, specific feedback. Our progress indicators (depth dots, thinking meter) feel scholarly, not gamified.

### 5. Soft Gating (Encourage Before Enabling)

Don't hard-block students, but nudge them toward better behavior:

- **Prompt dealing:** If a student has dealt a prompt card but hasn't written any ideas yet, show a gentle amber message: "↓ Try writing an idea first — the prompt above is there to spark your thinking." They CAN still deal another card, but they're reminded of the expectation.
- **Prompts are read-only:** Students cannot click prompts to auto-fill their response. They must always type their own ideas. This is non-negotiable — the student does the thinking.
- **Card dealing timer:** 10-second cooldown between prompt reveals (circular SVG progress ring). Encourages processing before consuming more prompts.

---

## Visual Language for Feedback

| Element | Purpose | Style |
|---|---|---|
| Depth dots (1-3) | Per-idea quality indicator | 4px circles, amber/blue/purple |
| Thinking depth meter | Per-step average quality | 60px progress bar, changes color |
| Micro-feedback toast | Instant submission acknowledgment | Pill shape, 3s auto-dismiss |
| Nudge bubble | AI Socratic question | Rounded card with ✦ icon, indigo gradient bg |
| Acknowledgment line | AI recognition of good work | Small bold text above nudge question |
| Soft gate message | Gentle behavioral nudge | Amber italic text in rounded container |

---

## API Design Pattern

All toolkit AI endpoints follow this structure:

```typescript
// Single POST endpoint with action routing
POST /api/tools/{tool-name}

// Common request shape
interface RequestBody {
  action: string;        // "prompts" | "nudge" | "insights" | etc.
  challenge: string;     // The student's design challenge
  sessionId: string;     // For rate limiting (not auth)
  effortLevel?: string;  // Client-assessed effort level
  existingIdeas?: string[];
  // ... action-specific fields
}

// Rate limiting
const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60_000 },     // 50/min
  { maxRequests: 500, windowMs: 3_600_000 },  // 500/hour
];

// Model: Haiku 4.5 for all student-facing (speed + cost)
// Token caps: tight (60-400 tokens) to prevent over-helping
// Logging: fire-and-forget usage tracking with cost estimates
```

---

## Applying to New Tools

When building a new interactive toolkit tool, follow this checklist:

1. **Does the tool have student text input?** → Add effort assessment + micro-feedback
2. **Does the AI respond to student input?** → Use effort-gated Socratic nudges (acknowledge → question)
3. **Are there multiple prompts/questions?** → Use staged cognitive load (adapt difficulty to progress)
4. **Is there a sequence of steps?** → Use card dealing or progressive reveal with thinking timers
5. **Can the student skip thinking?** → Add soft gates (gentle encouragement, not hard blocks)
6. **Does the summary show student work?** → Add depth dots for visual quality indicators

### By interaction shape (see `docs/ideas/toolkit-interactive-tools-plan.md` for full plan):

**Step Sequence (ALL five patterns) — 10 tools, ALL COMPLETE ✅:**
- SCAMPER ✅ (reference implementation)
- Six Thinking Hats ✅ (6 perspectives, hatRules + hatTone per hat)
- PMI Chart ✅ (3 columns, colRules + colTone, evaluation-phase tone)
- Five Whys ✅ (5 steps, depth-detection: sideways vs deeper)
- Empathy Map ✅ (4 quadrants, quadRules + quadTone, Feels pushes contradictions)
- Reverse Brainstorming ✅ (3 steps, tone shifts divergent → convergent)
- Before & After ✅ (2 steps, reflective tone)
- Attribute Listing ✅, Random Input ✅, Role Play ✅

**Canvas (effort-gating, Socratic nudge, micro-feedback per region + cross-region AI insights) — ALL COMPLETE ✅:**
- SWOT Analysis ✅, Fishbone Diagram ✅, Stakeholder Map ✅, Impact/Effort Matrix ✅
- Lotus Diagram ✅, Affinity Diagram ✅, Feedback Capture Grid ✅, Systems Map ✅
- Journey Map ✅, User Persona Card ✅

**Comparison Engine (effort-gating on REASONING, not scores; AI challenges inconsistencies) — ALL COMPLETE ✅:**
- Decision Matrix ✅, Pairwise Comparison ✅, Trade-off Sliders ✅, Dot Voting ✅

**Guided Composition (opt-in "Coach Me" nudges per section, depth indicator per section) — ALL COMPLETE ✅:**
- Design Brief ✅, Point of View Statement ✅, How Might We ✅

**Template-only (21 catalog entries — no full interactivity, value is in constraints/physicality):**
- Crazy 8s (timer only), Mind Map, Brainstorm Web, Morphological Chart
- Round Robin, Gallery Walk, Mood Board, Storyboard, Wireframe Template
- Annotation Template, Gantt Planner, Resource Planner, and 9 others
- Future: TemplateToolResponse (guided worksheet) when built

---

## Key Technical Decisions

- **Client-side effort assessment** — deterministic, instant, no API latency. The AI gets the effort level as input to adapt its tone.
- **Structured JSON responses from AI** — nudge returns `{ acknowledgment, nudge, effortLevel }` parsed with fallback regex for malformed JSON.
- **Haiku 4.5 for everything student-facing** — fast and cheap. Sonnet is overkill for 25-word questions.
- **300-token cap on mentor responses** — prevents the AI from over-helping. Short responses force Socratic behavior.
- **Inline styles for dark theme** — the app is light-themed; toolkit tools use dark theme with inline styles to avoid leaking.
- **Prompts are ALWAYS read-only** — Matt's explicit decision. Students must type their own ideas, always.
- **10-second thinking timer** — based on cognitive science around processing time. Long enough to read and think, short enough not to frustrate.

---

## Reference Implementations

- **SCAMPER frontend:** `src/app/toolkit/scamper/page.tsx` (~1900 lines)
- **SCAMPER API:** `src/app/api/tools/scamper/route.ts` (~300 lines)
- **Tool registry:** `src/app/toolkit/tools-data.ts` (48 tools — 27 interactive + 21 catalog, `slug` field enables interactivity)
- **Toolkit layout:** `src/app/toolkit/layout.tsx` (dark theme wrapper)
- **Shared toolkit helpers:** `src/lib/toolkit/shared-api.ts` (callHaiku, validateToolkitRequest, parseToolkitJSON, logToolkitUsage)

---

## Future Directions

### Dimensions3: `ai_rules` on Activity Blocks (Apr 2026)
Per-step AI rules are currently hardcoded in each toolkit tool's API route (hatRules, colRules, quadRules, etc.). Dimensions3 adds an `ai_rules` JSONB field on every `activity_block`:
```typescript
ai_rules: {
  phase: "divergent" | "convergent" | "neutral",
  tone: string,
  rules: string[],
  forbidden_words?: string[]
}
```
This unlocks custom AI behavior on ANY lesson activity — a teacher can set "be encouraging, push for wilder ideas, never evaluate" on a brainstorming activity without needing a dedicated toolkit tool. The 5 patterns in this document still apply — `ai_rules` is the mechanism for configuring them per-block rather than per-tool. See `docs/projects/dimensions3.md` §6.3.

### Journey Engine: Interactive Blocks Follow the Same Patterns
Journey Blocks (binary choice, card sort, slider, text prompt, etc.) are student-facing AI interactions and MUST follow the same 5 patterns. Key differences from toolkit tools:
- **Effort-gating:** Applied to free-text Journey Blocks (text prompt, dialogue choice). Binary/slider blocks are inherently effort-constrained by design.
- **Socratic feedback:** Kit (or other mentor character) responds via the Journey's dialogue system, not a separate nudge bubble. Same acknowledge → question structure.
- **Staged cognitive load:** Journey's conditional branching handles difficulty progression — the journey author sets branch conditions based on prior responses.
- **Micro-feedback loops:** Character reactions (expressions, animations) replace depth dots. Same principle: instant acknowledgment of input quality.
- **Soft gating:** Journey blocks can require minimum input length before advancing, but the mentor nudges rather than hard-blocks.

See `docs/specs/journey-engine-spec.md` for full Journey Block type definitions.

---

*Last updated: 7 Apr 2026*
*Patterns established during SCAMPER build (17 Mar 2026). All 27 interactive tools complete (26 Mar 2026). Extended to Dimensions3 ai_rules and Journey Engine (Apr 2026).*
*Full build plan: `docs/ideas/toolkit-interactive-tools-plan.md`*
