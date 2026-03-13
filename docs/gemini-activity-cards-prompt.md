# Activity Cards Generation Prompt

Paste this into Gemini (or Claude) to generate new activity cards for the StudioLoom database.

---

## PROMPT

You are helping me populate a database of activity cards for a design education platform. These cards are reusable classroom activity templates that teachers drag into their units. They must be **curriculum-agnostic** — they should work in any design classroom (IB MYP, UK GCSE Design & Technology, US PLTW, Australian NSW, or standalone design thinking courses). Do NOT reference IB-specific language, criteria letters, or curriculum-specific standards.

### What makes a great activity card

- **Practical and proven** — activities that experienced design teachers actually run in classrooms, not theoretical frameworks
- **Specific, not vague** — the prompt should guide students step-by-step, not just say "brainstorm ideas"
- **Scaffolded** — includes ELL support (sentence starters for beginners, extension prompts for advanced students)
- **Tool-aware** — references real tools students use (TinkerCAD, Canva, Figma, cardboard, foam board, laser cutter, 3D printer, etc.)
- **Time-realistic** — activities should genuinely fit in the stated duration
- **Rich metadata** — materials, tools, preparation notes, teacher tips

### Categories (pick the best fit)

- `design-thinking` — core design process activities (empathy, ideation, prototyping, testing)
- `visible-thinking` — thinking routines that make reasoning visible (Harvard Project Zero style)
- `evaluation` — assessment, critique, feedback, and reflection activities
- `brainstorming` — idea generation and creative divergence
- `analysis` — research, investigation, data gathering, user research
- `skills` — practical/technical skills (CAD, sketching, material handling, workshop safety)

### Thinking types

- `creative` — divergent, generative
- `critical` — evaluative, judgmental
- `analytical` — investigative, data-driven
- `metacognitive` — reflection on own thinking/process

### Group sizes

- `individual`, `pairs`, `small-group` (3-5), `whole-class`, `flexible`

### Design phases (use generic terms, not curriculum codes)

- `research`, `empathy`, `define`, `ideation`, `prototyping`, `testing`, `evaluation`, `reflection`, `planning`, `making`

### Output format

Return a JSON array of objects. Each object must match this exact structure:

```json
{
  "slug": "kebab-case-unique-id",
  "name": "Human Readable Name",
  "description": "One paragraph (2-3 sentences) explaining what this activity is and what students gain from it.",
  "category": "design-thinking",
  "phases": ["ideation", "prototyping"],
  "thinking_type": "creative",
  "duration_minutes": 20,
  "group_size": "pairs",
  "materials": ["sticky notes", "markers", "A3 paper"],
  "tools": [],
  "resources_needed": "Print role cards before class. Prepare 3 example user profiles.",
  "teacher_notes": "Works best after students have done initial research. Circulate and prompt students who get stuck on the 'Feels' quadrant.",
  "template": {
    "sections": [
      {
        "prompt": "The full student-facing instructions. Be specific and step-by-step.\n\nUse markdown formatting:\n- **Bold** for key terms\n- Numbered steps for sequential instructions\n- Bullet points for options",
        "responseType": "text",
        "scaffolding": {
          "ell1": {
            "sentenceStarters": [
              "I notice that ___.",
              "One idea is ___."
            ],
            "hints": [
              "Look at the example first",
              "Start with what you can see"
            ]
          },
          "ell2": {
            "sentenceStarters": [
              "Based on my research, I think ___.",
              "This connects to ___ because ___."
            ]
          },
          "ell3": {
            "extensionPrompts": [
              "How does this compare to a professional approach?",
              "What assumptions are you making and how could you test them?"
            ]
          }
        },
        "exampleResponse": "A realistic student response showing what good work looks like (3-5 sentences)."
      }
    ],
    "vocabTerms": [
      {
        "term": "Prototype",
        "definition": "A first version of a design used for testing",
        "example": "We built a cardboard prototype to test the size"
      }
    ],
    "reflection": {
      "type": "confidence-slider",
      "items": [
        "I can explain why this activity helped my design process",
        "I considered multiple perspectives before deciding"
      ]
    }
  },
  "ai_hints": {
    "whenToUse": "Use during the ideation phase when students need to move beyond their first idea and explore alternatives systematically.",
    "topicAdaptation": "Replace generic examples with topic-specific ones. For a packaging unit, use packaging examples. For a digital product, use app/website examples.",
    "modifierAxes": [
      {
        "id": "medium",
        "label": "Working Medium",
        "description": "How students capture their ideas",
        "type": "select",
        "options": [
          {
            "value": "paper",
            "label": "Paper-based",
            "promptDelta": "Students work on paper with pens, markers, and sticky notes."
          },
          {
            "value": "digital",
            "label": "Digital tools",
            "promptDelta": "Students use digital tools (Canva, Figma, Google Slides) to capture their work."
          },
          {
            "value": "physical",
            "label": "Physical prototyping",
            "promptDelta": "Students build quick physical models using cardboard, foam, or recycled materials."
          }
        ],
        "default": "paper"
      },
      {
        "id": "depth",
        "label": "Activity Depth",
        "description": "How much time and detail to invest",
        "type": "select",
        "options": [
          {
            "value": "quick",
            "label": "Quick (10 min)",
            "promptDelta": "Keep it rapid — focus on quantity of ideas over polish."
          },
          {
            "value": "standard",
            "label": "Standard (20 min)",
            "promptDelta": "Balance speed with thoughtfulness. Complete all sections."
          },
          {
            "value": "deep",
            "label": "Deep dive (30+ min)",
            "promptDelta": "Take time to develop each section thoroughly with detailed explanations and visuals."
          }
        ],
        "default": "standard"
      }
    ]
  }
}
```

### Valid responseType values

- `"text"` — written response (most common)
- `"upload"` — photo/file upload (great for sketches, prototypes, physical work)
- `"link"` — URL to external work (TinkerCAD, Canva, Figma project)
- `"multi"` — combination of text + upload

### Modifier axis rules

Each card should have **2-3 modifier axes** that are **specific to that activity**, not generic. Think about how a real teacher would actually vary this activity:
- Medium / format (paper vs. digital vs. physical)
- Collaboration mode (solo vs. pairs vs. group rotation)
- Depth / complexity (quick version vs. extended)
- Data source / input (imagined vs. real-world vs. from research)
- Output format (sketches vs. written vs. presentation)

Each option needs a `promptDelta` — a specific instruction fragment that changes how the AI adapts the activity.

### Reflection type options

- `"confidence-slider"` — "I can..." statements students rate themselves on
- `"checklist"` — checkbox items
- `"short-response"` — open-ended reflection questions

### What I need

Generate **30 activity cards** covering these areas. Aim for variety across categories, thinking types, group sizes, and durations:

**Design Process Activities (8-10 cards):**
- User research / empathy methods
- Problem definition / design brief writing
- Ideation techniques beyond SCAMPER
- Prototyping methods (low-fi to hi-fi)
- User testing / feedback collection

**Visible Thinking Routines (5-7 cards):**
- Harvard Project Zero routines (Think-Puzzle-Explore, Chalk Talk, The Explanation Game, Connect-Extend-Challenge, etc.)
- Metacognitive routines for design

**Making & Technical Skills (5-7 cards):**
- Sketching techniques (isometric, exploded view, annotation)
- Material exploration activities
- CAD/digital tool workflows
- Workshop safety and tool competency

**Evaluation & Critique (5-7 cards):**
- Design critique formats
- Self-assessment against success criteria
- Peer feedback structures
- Portfolio curation and reflection

**Cross-Cutting / Creative (3-5 cards):**
- Biomimicry / nature-inspired design
- Sustainability audit
- Cultural context research
- Design ethics discussion

### Important rules

1. **NO IB-specific language** — no "Criterion A", "MYP", "ATL skills", "Global Context", "Statement of Inquiry". Use generic design education language.
2. **Be specific in prompts** — step-by-step instructions, not vague directives. A student reading the prompt should know exactly what to do.
3. **Include realistic example responses** — show what good student work looks like.
4. **ELL scaffolding is mandatory** — every section needs ell1, ell2, ell3 scaffolding.
5. **Teacher notes should be genuinely useful** — timing tips, common mistakes, differentiation ideas.
6. **Modifiers should be meaningfully different** — each option should actually change the activity, not just relabel it.
7. **Activities should work for ages 11-18** — middle school through high school design students.
8. **Leave the `criteria` field as an empty array** `[]` — curriculum mapping will be done separately.
9. **Set `curriculum_frameworks` to** `[]` — these are framework-agnostic.
10. **Set `source` to** `"system"`.

Return ONLY the JSON array, no commentary.
