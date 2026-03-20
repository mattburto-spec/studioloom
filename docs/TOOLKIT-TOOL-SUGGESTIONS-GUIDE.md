# Toolkit Tool Suggestions — Quick Reference Guide

How the design assistant suggests tools and how to customize it.

---

## What Are Tool Suggestions?

When students ask the design assistant (Design Mentor) for help, the assistant can suggest relevant toolkit tools that would help them think through their problem.

**Example:**
```
Student: "I'm stuck. I have 3 different design ideas but I don't know which one is best"
Assistant: "Having multiple strong ideas is great! You might find a [Decision Matrix](/toolkit/decision-matrix)
helpful here — it lets you score each idea against your criteria. What criteria matter most for your design?"
```

The link opens the Decision Matrix tool directly, so the student doesn't have to leave the conversation and search for it.

---

## How It Works

### The Flow

1. **Student asks for help** in the Design Mentor chat
2. **System prompt** includes awareness of available toolkit tools
3. **AI evaluates** whether a tool would help
4. **AI suggests one** (if appropriate) with a markdown link: `[Tool Name](/toolkit/slug)`
5. **Widget parses** the link and renders it as a clickable chip
6. **Student clicks** → tool opens in new tab → returns when done

### The System Prompt

The design assistant's system prompt (in `src/lib/ai/design-assistant-prompt.ts`) includes a "Toolkit Tool Suggestions" section.

**For students in IDEATE phase (Criterion B):**
```
## Toolkit Tool Suggestions
The student has access to these design thinking tools. When they're stuck or need a specific type
of thinking for ideate, you can suggest ONE of these:
- **SCAMPER** (/toolkit/scamper) — modify existing ideas creatively
- **Reverse Brainstorm** (/toolkit/reverse-brainstorm) — brainstorm problems, flip into solutions
- **Lotus Diagram** (/toolkit/lotus-diagram) — expand from central theme to many ideas
- **Morphological Chart** (/toolkit/morphological-chart) — combine parameters systematically

RULES FOR SUGGESTING TOOLS:
- Only suggest a tool when their message clearly indicates they'd benefit from that type of thinking
- Maximum ONE tool suggestion per response
- Frame it as optional: "You might find [Tool Name] helpful here"
- Include the link so they can click directly
- Don't suggest if they're just asking for a quick answer or encouragement
```

---

## Tool Categories by Design Phase

### DISCOVER Phase (Criterion A: Inquiring & Analysing)
**When the student is researching, understanding user needs, or exploring the problem**

Available tools:
- **Empathy Map** `/toolkit/empathy-map` — understand user perspective (Says/Thinks/Does/Feels)
- **Five Whys** `/toolkit/five-whys` — root cause analysis through repeated questioning
- **Stakeholder Map** `/toolkit/stakeholder-map` — identify who's affected by the design
- **Affinity Diagram** `/toolkit/affinity-diagram` — cluster research findings into themes

**When to suggest:**
- "I need to understand what my user really needs"
- "I'm trying to figure out where the problem comes from"
- "Who else is affected by this?"

---

### DEFINE Phase (Criterion B: Developing Ideas, Part 1)
**When the student is reframing the problem or setting a clear design brief**

Available tools:
- **How Might We** `/toolkit/how-might-we` — reframe problems as opportunities for solutions
- **Five Whys** `/toolkit/five-whys` — dig deeper into root causes
- **Stakeholder Map** `/toolkit/stakeholder-map` — understand who the design serves

**When to suggest:**
- "I'm trying to define the core problem"
- "I need to reframe this as a challenge"
- "Help me scope this down"

---

### IDEATE Phase (Criterion B: Developing Ideas, Part 2)
**When the student is generating many ideas and exploring possibilities**

Available tools:
- **SCAMPER** `/toolkit/scamper` — 7-step creative technique for modifying existing ideas
- **Reverse Brainstorm** `/toolkit/reverse-brainstorm` — brainstorm ways to cause problems, then flip them into solutions
- **Lotus Diagram** `/toolkit/lotus-diagram` — expand from central concept to 64 systematic ideas
- **Morphological Chart** `/toolkit/morphological-chart` — combine design parameters to generate alternatives

**When to suggest:**
- "I only have one idea and I need more options"
- "I'm stuck and can't think of anything new"
- "Help me explore more possibilities"
- "I need to think creatively about this"

---

### PROTOTYPE Phase (Criterion C: Creating the Solution)
**When the student is evaluating and refining options, or planning the build**

Available tools:
- **Decision Matrix** `/toolkit/decision-matrix` — score options against criteria with detailed reasoning
- **PMI Chart** `/toolkit/pmi-chart` — Plus/Minus/Interesting analysis
- **SWOT Analysis** `/toolkit/swot-analysis` — Strengths/Weaknesses/Opportunities/Threats

**When to suggest:**
- "I have multiple options and I need to choose"
- "I need to evaluate my options fairly"
- "Help me think through the trade-offs"

---

### TEST/EVALUATE Phase (Criterion D: Evaluating)
**When the student is analyzing results, comparing prototypes, or deciding on improvements**

Available tools:
- **Decision Matrix** `/toolkit/decision-matrix` — score prototype versions or compare test results
- **PMI Chart** `/toolkit/pmi-chart` — analyze prototype performance
- **SWOT Analysis** `/toolkit/swot-analysis` — identify strengths and improvements

**When to suggest:**
- "My prototype didn't work. What should I change?"
- "I've tested two versions. Which is better?"
- "How do I know if my solution works?"

---

## Tool Link Format

All tool suggestions use this markdown format:

```
[Tool Name](/toolkit/slug)
```

Examples:
```
Try [SCAMPER](/toolkit/scamper) for this
Consider a [Decision Matrix](/toolkit/decision-matrix)
You might find [Empathy Map](/toolkit/empathy-map) helpful
```

The widget automatically:
1. Parses the link
2. Fetches tool metadata (color, icon, description)
3. Renders as a clickable, colored chip
4. Opens in a new tab when clicked

---

## The Complete Tool List (13 Interactive Tools)

| Tool | Slug | Phase | Type | Best For |
|------|------|-------|------|----------|
| SCAMPER | `scamper` | Ideate | Ideation | Modifying existing ideas |
| Six Thinking Hats | `six-thinking-hats` | Ideate | Analysis | Multiple perspectives |
| PMI Chart | `pmi-chart` | Prototype | Evaluation | Quick evaluation |
| Five Whys | `five-whys` | Discover | Analysis | Root cause analysis |
| Decision Matrix | `decision-matrix` | Prototype | Evaluation | Comparing options |
| Empathy Map | `empathy-map` | Discover | Research | Understanding users |
| How Might We | `how-might-we` | Define | Ideation | Problem reframing |
| Reverse Brainstorm | `reverse-brainstorm` | Ideate | Ideation | Flip perspective |
| SWOT Analysis | `swot-analysis` | Prototype | Evaluation | Strategic analysis |
| Stakeholder Map | `stakeholder-map` | Discover | Research | Who's affected |
| Lotus Diagram | `lotus-diagram` | Ideate | Ideation | Systematic expansion |
| Affinity Diagram | `affinity-diagram` | Discover | Analysis | Cluster findings |
| Morphological Chart | `morphological-chart` | Ideate | Ideation | Parameter combinations |

---

## Rules for Suggesting Tools

### DO:
✓ Suggest when the student clearly needs that type of thinking
✓ Suggest max ONE tool per response
✓ Frame as optional: "You might find X helpful"
✓ Include the direct link so they can click
✓ Keep suggestion brief (1-2 sentences)
✓ Follow up with a Socratic question (not just a suggestion)
✓ Suggest tools that match the design phase they're in

### DON'T:
✗ Suggest multiple tools in one response
✗ Tell students they MUST use a tool ("You need to use...")
✗ Suggest if they just need encouragement ("Great idea!")
✗ Suggest the same tool twice in a conversation
✗ Use tool suggestion as a replacement for Socratic mentoring
✗ Suggest tools outside the current design phase
✗ Overuse suggestions (not every response needs one)

---

## Customizing Tool Suggestions

### Adding a New Tool

When a new interactive tool is built (e.g., "Brainstorm Plus"):

1. Add to `src/lib/tools/toolkit-metadata.ts`:
```typescript
'brainstorm-plus': {
  name: 'Brainstorm Plus',
  slug: 'brainstorm-plus',
  desc: 'Enhanced brainstorming with AI-powered idea combinations',
  phase: 'ideate',
  type: 'ideation',
  color: '#6366f1',
  bgColor: '#312e81',
},
```

2. Add to phase list in `src/lib/ai/design-assistant-prompt.ts`:
```typescript
const TOOLKIT_TOOLS_BY_PHASE = {
  ideate: [
    // ... existing tools ...
    { name: 'Brainstorm Plus', slug: 'brainstorm-plus', desc: '...' },
  ],
};
```

3. Done! The system prompt will automatically include it.

### Changing Which Tools are Suggested for a Phase

Edit `TOOLKIT_TOOLS_BY_PHASE` in `src/lib/ai/design-assistant-prompt.ts`:

```typescript
const TOOLKIT_TOOLS_BY_PHASE = {
  discover: [
    { name: 'Empathy Map', slug: 'empathy-map', desc: '...' },
    // Remove or add tools here
  ],
  // ... other phases
};
```

### Disabling Tool Suggestions Temporarily

Set an empty list for that phase:
```typescript
const TOOLKIT_TOOLS_BY_PHASE = {
  ideate: [], // No suggestions for ideation
  // ... other phases
};
```

---

## Context Awareness

The system prompt adapts based on the **current design phase**, which is determined from the unit page's **criterion tags**:

```
Criterion A ("Inquiring & Analysing") → DISCOVER phase
Criterion B ("Developing Ideas")       → IDEATE phase
Criterion C ("Creating the Solution")  → PROTOTYPE phase
Criterion D ("Evaluating")             → TEST/EVALUATE phase
```

If no criterion tag is provided, the system prompt includes generic toolkit awareness with all tools listed by phase (not biased).

### Example in Code

In `src/lib/design-assistant/conversation.ts`:

```typescript
const systemPrompt = buildDesignAssistantSystemPrompt({
  bloomLevel,
  effortScore,
  criterionTags: ['Criterion B: Developing Ideas'], // ← this determines phase
  previousTurns: turns.length,
});
```

---

## Widget Rendering

The `DesignAssistantWidget` automatically:

1. **Parses** markdown links in assistant messages
2. **Fetches** tool metadata (colors, descriptions)
3. **Renders** as styled chips:
   - Background color from tool metadata
   - External link icon
   - Hover effects (scale + shadow)
4. **Opens** in new tab on click (preserves chat)

No manual configuration needed!

---

## Testing Tool Suggestions

### Quick Manual Test

1. Open a unit page during "Developing Ideas" (Criterion B)
2. Ask the Design Mentor: "I only have one idea but I need more"
3. Expected response includes tool suggestion (e.g., SCAMPER)
4. Click the tool link → opens in new tab
5. Return to chat → conversation is preserved

### Full Test Cycle

1. Test in DISCOVER phase (Criterion A) → expect research tools
2. Test in IDEATE phase (Criterion B) → expect ideation tools
3. Test in PROTOTYPE phase (Criterion C) → expect evaluation tools
4. Test in EVALUATE phase (Criterion D) → expect evaluation tools
5. Test without criterion tags → expect generic toolkit awareness

---

## Troubleshooting

### Suggestions Not Appearing

- Check that criterion tags are provided to `buildDesignAssistantSystemPrompt`
- Verify the tool slug is correct (lowercase, hyphens only)
- Check that the AI response includes a markdown link (not just plain text)

### Link Not Parsing

- Ensure the format is exactly: `[Name](/toolkit/slug)`
- Check the slug is lowercase with hyphens (no spaces, underscores)
- Verify the tool exists in `INTERACTIVE_TOOLS`

### Link Opens Wrong Tool

- Check the slug matches the tool you intended
- Verify the toolkit route exists: `/toolkit/{slug}`

---

## References

- **Implementation**: `src/lib/ai/design-assistant-prompt.ts`
- **Metadata**: `src/lib/tools/toolkit-metadata.ts`
- **Widget**: `src/components/student/DesignAssistantWidget.tsx`
- **Spec**: `docs/specs/student-toolkit-access.md`
- **Full Details**: `docs/specs/phase-d-ai-tool-suggestions-implementation.md`
