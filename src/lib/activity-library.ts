import type { CriterionKey } from "@/lib/constants";
import type { ActivitySection, VocabTerm, Reflection, PageContent } from "@/types";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";

// ---------------------------------------------------------------------------
// Activity Template types
// ---------------------------------------------------------------------------

export interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  category:
    | "design-thinking"
    | "visible-thinking"
    | "evaluation"
    | "brainstorming"
    | "analysis";
  tags: {
    criteria: CriterionKey[];
    phases: string[];
    thinkingType: "creative" | "critical" | "analytical" | "metacognitive";
    duration: "5min" | "10min" | "15min" | "20min" | "30min+";
    groupSize: "individual" | "pairs" | "small-group" | "whole-class" | "flexible";
  };
  template: {
    sections: ActivitySection[];
    vocabTerms?: VocabTerm[];
    reflection?: Reflection;
  };
  aiHints: {
    whenToUse: string;
    topicAdaptation: string;
  };
}

// ---------------------------------------------------------------------------
// Curated Activity Library
// ---------------------------------------------------------------------------

export const ACTIVITY_LIBRARY: ActivityTemplate[] = [
  // ── SCAMPER ─────────────────────────────────────────────────────────
  {
    id: "scamper",
    name: "SCAMPER",
    description:
      "Structured brainstorming using 7 thinking prompts: Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse.",
    category: "design-thinking",
    tags: {
      criteria: ["B"],
      phases: ["ideation"],
      thinkingType: "creative",
      duration: "20min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Choose your design idea and apply each SCAMPER prompt:\n\n**S** — Substitute: What materials, parts or people could you swap?\n**C** — Combine: What ideas or features could you merge?\n**A** — Adapt: What could you borrow from another product or nature?\n**M** — Modify: What could you make bigger, smaller, faster or different?\n**P** — Put to another use: How else could this be used?\n**E** — Eliminate: What could you remove to simplify?\n**R** — Reverse: What if you flipped, reversed or rearranged parts?\n\nWrite at least one idea for each letter.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "I could substitute ___ with ___.",
                "I could combine ___ and ___.",
                "I could adapt ___ by ___.",
              ],
              hints: [
                "Think about the materials you are using",
                "Look at similar products for ideas",
              ],
            },
            ell2: {
              sentenceStarters: [
                "One substitution idea is...",
                "I could modify my design by...",
                "If I reverse ___, then...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Which SCAMPER prompt generated the most innovative idea? Why?",
                "How might you combine multiple SCAMPER ideas into a single improvement?",
              ],
            },
          },
          responseType: "text",
          exampleResponse:
            "S: I could substitute plastic with recycled cardboard to make it more sustainable.\nC: I could combine the handle and the lid into one piece.\nA: I could adapt the folding mechanism from origami.\nM: I could make the base wider for better stability.\nP: The packaging could also be used as a display stand.\nE: I could remove the separate instructions sheet and print them on the box.\nR: What if the box opens from the bottom instead of the top?",
        },
      ],
      vocabTerms: [
        { term: "Substitute", definition: "Replace one thing with another", example: "Substitute plastic with bamboo" },
        { term: "Iterate", definition: "Repeat a process to improve the result", example: "After testing, iterate on the design" },
        { term: "Innovation", definition: "A new idea, method, or product", example: "The foldable design was an innovation" },
      ],
      reflection: {
        type: "confidence-slider",
        items: [
          "I can use SCAMPER to generate multiple ideas",
          "I considered ideas I wouldn't have thought of otherwise",
        ],
      },
    },
    aiHints: {
      whenToUse: "Use on B2 (generating ideas) when students need structured brainstorming to move beyond their first idea.",
      topicAdaptation: "Replace the generic prompts with topic-specific examples. E.g., for a food packaging unit: 'S: What if you substituted the plastic tray with an edible wrapper?'",
    },
  },

  // ── Six Thinking Hats ───────────────────────────────────────────────
  {
    id: "six-thinking-hats",
    name: "Six Thinking Hats",
    description:
      "Evaluate a design from six perspectives: facts, feelings, caution, benefits, creativity, and process.",
    category: "visible-thinking",
    tags: {
      criteria: ["A", "B"],
      phases: ["analysis", "ideation"],
      thinkingType: "critical",
      duration: "20min",
      groupSize: "small-group",
    },
    template: {
      sections: [
        {
          prompt:
            "Examine your design idea wearing each of the Six Thinking Hats:\n\n🤍 **White Hat** (Facts): What do you know? What data do you need?\n❤️ **Red Hat** (Feelings): What is your gut feeling about this idea?\n⚫ **Black Hat** (Caution): What could go wrong? What are the risks?\n💛 **Yellow Hat** (Benefits): What are the advantages? Why could this work?\n💚 **Green Hat** (Creativity): What new ideas or alternatives come to mind?\n💙 **Blue Hat** (Process): What is our next step? How should we decide?\n\nWrite 2-3 points for each hat.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "The facts I know are...",
                "I feel ___ about this because...",
                "A risk is...",
              ],
              hints: [
                "Start with the White Hat — list what you already know",
                "The Black Hat helps you spot problems early",
              ],
            },
            ell2: {
              sentenceStarters: [
                "One benefit of this idea is...",
                "A creative alternative could be...",
                "The next step should be...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Which hat revealed the most useful insight? How will this change your design?",
                "How does switching perspectives help you make better design decisions?",
              ],
            },
          },
          responseType: "text",
        },
      ],
      reflection: {
        type: "checklist",
        items: [
          "I considered facts and evidence (White Hat)",
          "I acknowledged my feelings about the design (Red Hat)",
          "I identified potential risks (Black Hat)",
          "I recognised benefits and strengths (Yellow Hat)",
        ],
      },
    },
    aiHints: {
      whenToUse: "Use on A3-A4 (analysing existing products) or B2-B3 (evaluating design ideas from multiple angles).",
      topicAdaptation: "Frame each hat prompt around the specific design challenge. E.g., for bridge design: 'Black Hat: What loads or forces could cause the bridge to fail?'",
    },
  },

  // ── PMI (Plus / Minus / Interesting) ────────────────────────────────
  {
    id: "pmi",
    name: "PMI (Plus / Minus / Interesting)",
    description:
      "Quick evaluation framework: list the positives, negatives, and interesting aspects of each option.",
    category: "evaluation",
    tags: {
      criteria: ["B", "D"],
      phases: ["evaluation", "ideation"],
      thinkingType: "analytical",
      duration: "10min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Create a PMI chart for your chosen design option:\n\n**Plus (+):** What are the good things about this idea?\n**Minus (-):** What are the drawbacks or concerns?\n**Interesting (?):** What is surprising, unusual, or worth exploring further?\n\nList at least 3 points in each column.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "A positive thing is...",
                "A problem could be...",
                "Something interesting is...",
              ],
              hints: [
                "Think about cost, time, materials, and the user",
                "Interesting = something you want to find out more about",
              ],
            },
            ell2: {
              sentenceStarters: [
                "One advantage is ___ because...",
                "A drawback is ___ which means...",
                "It would be interesting to explore...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Do any 'Interesting' points suggest a way to turn a Minus into a Plus?",
                "Compare your PMI charts for two different options — which has the stronger case?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on B3 (evaluating and choosing between ideas) or D1-D2 (evaluating the final product).",
      topicAdaptation: "Prompt students to evaluate their specific design options. E.g., 'Create a PMI chart comparing your 3D-printed case vs your laser-cut case.'",
    },
  },

  // ── See-Think-Wonder ────────────────────────────────────────────────
  {
    id: "see-think-wonder",
    name: "See-Think-Wonder",
    description:
      "Visual thinking routine: observe carefully, interpret what you see, then ask questions.",
    category: "visible-thinking",
    tags: {
      criteria: ["A"],
      phases: ["inquiry", "analysis"],
      thinkingType: "analytical",
      duration: "10min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Look closely at the product, image, or design provided by your teacher.\n\n👁 **See:** What do you notice? Describe exactly what you observe — shapes, colours, materials, size, details.\n🧠 **Think:** What do you think is going on? Why was it designed this way? What is its purpose?\n❓ **Wonder:** What questions do you have? What would you like to find out?\n\nWrite at least 3 points for each.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "I can see...",
                "I think this is because...",
                "I wonder why...",
              ],
              hints: [
                "Look at the shape, colour, and size",
                "Think about who would use this",
              ],
            },
            ell2: {
              sentenceStarters: [
                "I notice that ___ which suggests...",
                "This might have been designed to...",
                "I wonder what would happen if...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "How do your observations connect to the design brief?",
                "What assumptions are you making that you could test?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on A1-A2 (inquiry and research) when students need to analyse existing products or contexts.",
      topicAdaptation: "Specify what students should look at. E.g., 'Look at the three sustainable packaging examples your teacher has provided.'",
    },
  },

  // ── Crazy 8s ────────────────────────────────────────────────────────
  {
    id: "crazy-8s",
    name: "Crazy 8s",
    description:
      "Rapid sketching: 8 different ideas in 8 minutes. Forces quantity over quality to break creative blocks.",
    category: "brainstorming",
    tags: {
      criteria: ["B"],
      phases: ["ideation"],
      thinkingType: "creative",
      duration: "10min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Fold a piece of paper into 8 sections. Set a timer for 8 minutes.\n\nSketch a DIFFERENT design idea in each box — one idea per minute. Don't worry about quality, focus on quantity!\n\nRules:\n- Each sketch must be different (not variations of the same idea)\n- No erasing — just keep going\n- Labels and annotations are encouraged\n- Stick figures and rough shapes are fine\n\nWhen done, photograph or scan your sheet and upload it.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "My first idea is...",
                "Another idea is...",
                "This one is different because...",
              ],
              hints: [
                "Think about different materials you could use",
                "Think about different shapes and sizes",
                "Look around the room for inspiration",
              ],
            },
            ell2: {
              sentenceStarters: [
                "Idea ___ is inspired by...",
                "This approach is different because...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Which sketch surprised you the most? Could you develop it further?",
                "Can you combine elements from two sketches into a stronger idea?",
              ],
            },
          },
          responseType: "upload",
        },
        {
          prompt: "Look at your 8 sketches. Circle your top 2 favourites and explain why you chose them.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "My favourite is number ___ because...",
                "I chose this one because...",
              ],
              hints: ["Think about which idea is most creative and also possible to make"],
            },
            ell2: {
              sentenceStarters: [
                "I selected idea ___ because it best meets...",
                "Compared to the others, this one...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "How would you refine your top idea based on your design specification?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on B2 (generating ideas) when students need to produce many ideas quickly before narrowing down.",
      topicAdaptation: "Add topic-specific prompts. E.g., 'Sketch 8 different ways to design a phone stand using only recycled materials.'",
    },
  },

  // ── Design Critique ─────────────────────────────────────────────────
  {
    id: "design-critique",
    name: "Design Critique (I Like, I Wish, What If)",
    description:
      "Structured peer feedback using three lenses: appreciation, improvement, and imagination.",
    category: "evaluation",
    tags: {
      criteria: ["C", "D"],
      phases: ["evaluation", "creation"],
      thinkingType: "critical",
      duration: "15min",
      groupSize: "pairs",
    },
    template: {
      sections: [
        {
          prompt:
            "Review a classmate's design (or your own prototype) using the three feedback lenses:\n\n👍 **I Like...** — What works well? What is effective about this design?\n🙏 **I Wish...** — What would you improve? What could be better?\n💡 **What If...** — What creative suggestions do you have? What alternative approaches?\n\nGive at least 2 comments for each lens. Be specific and constructive.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "I like ___ because...",
                "I wish ___ was different because...",
                "What if you tried...?",
              ],
              hints: [
                "Focus on specific parts of the design, not general comments",
                "'I wish' is about improvement, not criticism",
              ],
            },
            ell2: {
              sentenceStarters: [
                "I like how ___ solves the problem of...",
                "I wish ___ because it would improve...",
                "What if you considered ___ to address...?",
              ],
            },
            ell3: {
              extensionPrompts: [
                "How does the feedback you received connect to the design specification?",
                "Which piece of feedback will have the biggest impact on your final design?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on C3-C4 (testing and modifying) or D1-D2 (evaluating) when students need structured peer feedback.",
      topicAdaptation: "Guide students to focus on criteria relevant to the topic. E.g., for ergonomic design: 'Focus your critique on comfort, usability, and material choice.'",
    },
  },

  // ── Empathy Map ─────────────────────────────────────────────────────
  {
    id: "empathy-map",
    name: "Empathy Map",
    description:
      "User-centred design tool: understand your target user by mapping what they say, think, do, and feel.",
    category: "design-thinking",
    tags: {
      criteria: ["A"],
      phases: ["inquiry", "analysis"],
      thinkingType: "analytical",
      duration: "15min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Think about your target user (client). Create an Empathy Map with four quadrants:\n\n💬 **Says:** What do they say about the problem? What words or phrases do they use?\n🧠 **Thinks:** What are they really thinking? What are their concerns or motivations?\n🤲 **Does:** What actions do they take? How do they currently solve the problem?\n❤️ **Feels:** What emotions do they experience? What frustrates or excites them?\n\nFill in at least 3 points per quadrant.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "My user says...",
                "My user thinks about...",
                "My user feels ___ because...",
              ],
              hints: [
                "Imagine you are the user — what is their day like?",
                "Think about what makes them frustrated",
              ],
            },
            ell2: {
              sentenceStarters: [
                "Based on my research, the user often says...",
                "They probably think ___ because...",
                "Their main frustration is...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "What contradictions exist between what the user says and what they actually do?",
                "How does understanding the user's emotions change your design approach?",
              ],
            },
          },
          responseType: "text",
        },
      ],
      vocabTerms: [
        { term: "Empathy", definition: "Understanding and sharing the feelings of another person", example: "Designing with empathy means thinking about how the user feels" },
        { term: "Target audience", definition: "The specific group of people a product is designed for", example: "Our target audience is Year 8 students" },
      ],
    },
    aiHints: {
      whenToUse: "Use on A1-A2 (identifying the need, researching the problem) to help students deeply understand their target user.",
      topicAdaptation: "Specify the target user. E.g., 'Create an empathy map for an elderly person who struggles with opening food packaging.'",
    },
  },

  // ── Storyboarding ───────────────────────────────────────────────────
  {
    id: "storyboarding",
    name: "Storyboarding",
    description:
      "Visual narrative showing how a user interacts with your design, step by step.",
    category: "design-thinking",
    tags: {
      criteria: ["B", "C"],
      phases: ["planning", "ideation"],
      thinkingType: "creative",
      duration: "20min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Create a 6-frame storyboard showing how your target user will interact with your design:\n\n1. **The Problem** — Show the user encountering the problem\n2. **Discovery** — How do they find/receive your product?\n3. **First Use** — What happens when they first use it?\n4. **Key Feature** — Show the most important feature in action\n5. **Result** — What is the outcome? How is the problem solved?\n6. **Happy User** — Show the positive impact on the user\n\nDraw each frame with a short caption underneath. Upload your storyboard.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "In frame 1, the user is...",
                "Then, the user...",
                "At the end, the user feels...",
              ],
              hints: [
                "Stick figures are fine — focus on telling the story",
                "Add speech bubbles to show what the user says",
              ],
            },
            ell2: {
              sentenceStarters: [
                "The storyboard begins with...",
                "The key moment is when...",
                "The design solves the problem by...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "What alternative user journey could you show that highlights a different feature?",
                "How might the storyboard change for a different target user?",
              ],
            },
          },
          responseType: "upload",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on B4 (planning) or C1 (preparing to create) to help students visualise the user experience.",
      topicAdaptation: "Tailor the 6-frame structure to the topic. E.g., for an app: 'Show the user opening the app, navigating menus, and completing their task.'",
    },
  },

  // ── Affinity Mapping ────────────────────────────────────────────────
  {
    id: "affinity-mapping",
    name: "Affinity Mapping",
    description:
      "Group brainstorming: generate ideas on sticky notes, then cluster them into themes.",
    category: "analysis",
    tags: {
      criteria: ["A"],
      phases: ["analysis", "inquiry"],
      thinkingType: "analytical",
      duration: "15min",
      groupSize: "small-group",
    },
    template: {
      sections: [
        {
          prompt:
            "Work with your group to brainstorm everything you know or have found about the design problem.\n\n**Step 1:** Write each idea, fact, or observation on a separate sticky note (1 idea per note).\n**Step 2:** Spread all notes on the table. Silently sort them into groups that feel related.\n**Step 3:** Name each group with a theme header.\n**Step 4:** Photograph your organised board and upload it.\n\nThen write: What themes emerged? Were there any surprises?",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "We grouped these together because...",
                "The biggest theme is...",
                "We were surprised that...",
              ],
              hints: [
                "Write one idea per note — keep it short",
                "Move notes around until the groups feel right",
              ],
            },
            ell2: {
              sentenceStarters: [
                "The main themes that emerged are...",
                "An unexpected connection was...",
                "This analysis suggests our design should focus on...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Which theme has the most evidence? What does this tell you about user priorities?",
                "Are there any gaps in your research that the map reveals?",
              ],
            },
          },
          responseType: "upload",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on A2-A3 (research and analysis) when students have gathered data and need to find patterns.",
      topicAdaptation: "Set the brainstorming focus. E.g., 'Brainstorm everything you learned from your user interviews about school bag problems.'",
    },
  },

  // ── Decision Matrix ─────────────────────────────────────────────────
  {
    id: "decision-matrix",
    name: "Decision Matrix",
    description:
      "Score design options against weighted criteria to make an evidence-based choice.",
    category: "evaluation",
    tags: {
      criteria: ["B"],
      phases: ["evaluation"],
      thinkingType: "analytical",
      duration: "15min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Create a decision matrix to choose between your design ideas.\n\n1. List your top 3 design options across the top\n2. List 4-5 criteria down the side (e.g., cost, durability, aesthetics, sustainability, ease of making)\n3. Give each criterion a weight (1-3) based on importance\n4. Score each option against each criterion (1-5)\n5. Calculate weighted totals\n\nWhich option scored highest? Do you agree with the result? Explain your final choice.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "My criteria are...",
                "Option ___ scored highest because...",
                "I chose ___ because...",
              ],
              hints: [
                "Weight = how important the criterion is (3 = very important)",
                "Score = how well the option meets the criterion (5 = very well)",
              ],
            },
            ell2: {
              sentenceStarters: [
                "I weighted ___ as most important because...",
                "Although option ___ scored highest, I think...",
                "The matrix shows that...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "If you changed the weights, would the result change? What does this reveal about your priorities?",
                "How does the matrix result compare to your gut feeling? Why might they differ?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on B3 (choosing between design ideas) when students need to justify their choice with evidence.",
      topicAdaptation: "Suggest topic-relevant criteria. E.g., for food packaging: 'Consider criteria like shelf life, recyclability, cost, and visual appeal.'",
    },
  },

  // ── 5 Whys ──────────────────────────────────────────────────────────
  {
    id: "5-whys",
    name: "5 Whys",
    description:
      "Root cause analysis: ask 'why?' five times to dig beneath the surface of a problem.",
    category: "analysis",
    tags: {
      criteria: ["A", "D"],
      phases: ["inquiry", "evaluation"],
      thinkingType: "critical",
      duration: "10min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Start with a problem statement, then ask 'Why?' five times to find the root cause.\n\n**Problem:** [State the problem clearly]\n**Why 1:** Why does this happen? →\n**Why 2:** Why is that? →\n**Why 3:** Why? →\n**Why 4:** Why? →\n**Why 5:** Why? →\n\n**Root Cause:** What is the real, underlying problem?\n\nHow does understanding the root cause change what you need to design?",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "The problem is...",
                "This happens because...",
                "The real cause is...",
              ],
              hints: [
                "Each 'why' should dig deeper than the last",
                "The root cause is usually about people, systems, or design",
              ],
            },
            ell2: {
              sentenceStarters: [
                "The surface problem is ___, but the root cause is...",
                "This changes my design because I now need to address...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Could there be multiple root causes? How would you address each?",
                "How does this technique prevent you from solving the wrong problem?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on A1 (identifying the problem) or D3-D4 (reflecting on what went wrong) for root cause analysis.",
      topicAdaptation: "Provide a starter problem. E.g., 'Students at our school don't recycle their lunch packaging. Ask 5 Whys to find the root cause.'",
    },
  },

  // ── KWL Chart ───────────────────────────────────────────────────────
  {
    id: "kwl-chart",
    name: "KWL Chart",
    description:
      "Activate prior knowledge: what do you Know, what do you Want to know, and what did you Learn?",
    category: "visible-thinking",
    tags: {
      criteria: ["A"],
      phases: ["inquiry"],
      thinkingType: "metacognitive",
      duration: "10min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Before starting your research, complete a KWL chart:\n\n**K — What I KNOW:** What do you already know about this topic or problem? List facts, experiences, and assumptions.\n\n**W — What I WANT to know:** What questions do you have? What do you need to find out to design a good solution?\n\nYou'll complete the **L** column later after your research.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "I already know that...",
                "I want to find out...",
                "One question I have is...",
              ],
              hints: [
                "Think about what you have seen or used before",
                "Your 'W' questions will guide your research",
              ],
            },
            ell2: {
              sentenceStarters: [
                "From experience, I know that...",
                "An important question to research is...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Which of your 'K' items are assumptions you should verify?",
                "How will you prioritise your 'W' questions for research?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on A1 (beginning inquiry) as a warm-up before research to activate prior knowledge and set research direction.",
      topicAdaptation: "Frame around the unit topic. E.g., 'What do you already know about sustainable materials? What do you need to find out?'",
    },
  },

  // ── Lotus Diagram ───────────────────────────────────────────────────
  {
    id: "lotus-diagram",
    name: "Lotus Diagram",
    description:
      "Expand one central idea into 8 themes, then break each theme into 8 more ideas — 64 ideas total.",
    category: "brainstorming",
    tags: {
      criteria: ["B"],
      phases: ["ideation"],
      thinkingType: "creative",
      duration: "20min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Create a Lotus Diagram to expand your design thinking:\n\n1. Write your central design challenge in the middle box\n2. In the 8 boxes around it, write 8 related themes or sub-problems\n3. Take each of those 8 themes and brainstorm 8 more specific ideas around each\n\nYou can draw this on paper (3x3 grid repeated) or use a digital tool. Upload your completed diagram.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "My central challenge is...",
                "One theme is...",
                "An idea related to this theme is...",
              ],
              hints: [
                "Start with big categories like materials, shape, user, cost",
                "Don't worry if some boxes are hard to fill — that shows where you need more research",
              ],
            },
            ell2: {
              sentenceStarters: [
                "I broke the challenge into themes like...",
                "The most productive theme was ___ because...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Which theme generated the most diverse ideas? Why?",
                "Can you find connections between ideas from different themes?",
              ],
            },
          },
          responseType: "upload",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on B1-B2 (developing a specification, generating ideas) when students need to thoroughly explore the design space.",
      topicAdaptation: "Suggest the central challenge and possible themes. E.g., 'Centre: Eco-friendly lunch box. Themes might include: material, size, insulation, closure, cleaning, cost, aesthetics, sustainability.'",
    },
  },

  // ── What-If Scenarios ───────────────────────────────────────────────
  {
    id: "what-if-scenarios",
    name: "What-If Scenarios",
    description:
      "Stress-test a design by exploring extreme or unexpected situations.",
    category: "evaluation",
    tags: {
      criteria: ["B", "C"],
      phases: ["evaluation", "planning"],
      thinkingType: "critical",
      duration: "15min",
      groupSize: "pairs",
    },
    template: {
      sections: [
        {
          prompt:
            "Stress-test your design by answering these 'What If' questions:\n\n1. What if your user drops it from 1 metre?\n2. What if a young child tries to use it?\n3. What if it gets wet or left outside?\n4. What if you only had half the budget?\n5. What if your user is left-handed?\n6. What if it needs to last 10 years instead of 1?\n\nFor each question: explain what would happen to your current design and what you would change to address it.",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "If this happened, my design would...",
                "I would change ___ to fix this.",
                "This is a problem because...",
              ],
              hints: [
                "Think about the weakest part of your design",
                "Some scenarios might not apply — explain why",
              ],
            },
            ell2: {
              sentenceStarters: [
                "My design would likely ___ because...",
                "To address this scenario, I would modify...",
                "This reveals a weakness in...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Which scenario revealed the most critical flaw? How will you prioritise fixing it?",
                "Can you create your own 'What If' scenarios specific to your user?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on B3-B4 (evaluating and planning) or C3 (testing changes) to stress-test designs before building.",
      topicAdaptation: "Replace generic scenarios with topic-specific ones. E.g., for a solar charger: 'What if it's cloudy for 3 days? What if the phone is a different size?'",
    },
  },

  // ── Pairwise Comparison ─────────────────────────────────────────────
  {
    id: "pairwise-comparison",
    name: "Pairwise Comparison",
    description:
      "Compare design options two at a time to build a clear ranking.",
    category: "evaluation",
    tags: {
      criteria: ["B"],
      phases: ["evaluation"],
      thinkingType: "analytical",
      duration: "10min",
      groupSize: "individual",
    },
    template: {
      sections: [
        {
          prompt:
            "Compare your design ideas in pairs. For each pair, choose which is better and explain why.\n\nIf you have ideas A, B, and C:\n- A vs B → Winner: ___ because...\n- A vs C → Winner: ___ because...\n- B vs C → Winner: ___ because...\n\nCount the wins:\n- A: ___ wins\n- B: ___ wins\n- C: ___ wins\n\nDoes the ranking match your instinct? Why or why not?",
          scaffolding: {
            ell1: {
              sentenceStarters: [
                "I prefer ___ because...",
                "Option ___ is better because...",
                "The winner is ___ because...",
              ],
              hints: [
                "Think about one specific criterion when comparing",
                "It's OK if the ranking surprises you",
              ],
            },
            ell2: {
              sentenceStarters: [
                "When comparing ___ and ___, I chose ___ because...",
                "The overall ranking suggests...",
                "This differs from my gut feeling because...",
              ],
            },
            ell3: {
              extensionPrompts: [
                "Does the ranking change if you use different criteria for comparison?",
                "What does this exercise reveal about your design priorities?",
              ],
            },
          },
          responseType: "text",
        },
      ],
    },
    aiHints: {
      whenToUse: "Use on B3 (choosing between ideas) as a simpler alternative to a full decision matrix.",
      topicAdaptation: "Name the specific options being compared. E.g., 'Compare your cardboard prototype vs your acrylic prototype vs your 3D-printed prototype.'",
    },
  },
];

// ---------------------------------------------------------------------------
// Helper: get activities filtered by criterion
// ---------------------------------------------------------------------------

export function getActivitiesForCriterion(
  criterion: CriterionKey
): ActivityTemplate[] {
  return ACTIVITY_LIBRARY.filter((a) =>
    a.tags.criteria.includes(criterion)
  );
}

// ---------------------------------------------------------------------------
// Helper: get activity by ID
// ---------------------------------------------------------------------------

export function getActivityById(
  id: string
): ActivityTemplate | undefined {
  return ACTIVITY_LIBRARY.find((a) => a.id === id);
}

// ---------------------------------------------------------------------------
// Helper: build a concise summary for AI prompts
// ---------------------------------------------------------------------------

export function getActivityLibrarySummary(
  criterion?: CriterionKey
): string {
  const activities = criterion
    ? getActivitiesForCriterion(criterion)
    : ACTIVITY_LIBRARY;

  return activities
    .map(
      (a) =>
        `- ${a.name} (${a.id}): ${a.aiHints.whenToUse}`
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Sidebar categories for the wizard review phase
// ---------------------------------------------------------------------------

export interface SidebarCategory {
  id: string;
  label: string;
  color: string;
  activityCategories: ActivityTemplate["category"][];
}

export const SIDEBAR_CATEGORIES: SidebarCategory[] = [
  {
    id: "design",
    label: "Design",
    color: "#2E86AB",
    activityCategories: ["design-thinking", "brainstorming"],
  },
  {
    id: "thinking",
    label: "Thinking",
    color: "#E86F2C",
    activityCategories: ["visible-thinking"],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    color: "#2DA05E",
    activityCategories: ["evaluation", "analysis"],
  },
  {
    id: "skills",
    label: "Skills",
    color: "#8B2FC9",
    activityCategories: [], // placeholder — no activities yet
  },
];

export function getActivitiesForSidebarCategory(
  categoryId: string
): ActivityTemplate[] {
  const cat = SIDEBAR_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return [];
  return ACTIVITY_LIBRARY.filter((a) =>
    cat.activityCategories.includes(a.category)
  );
}

// ---------------------------------------------------------------------------
// Detect which activities are already used in generated pages
// ---------------------------------------------------------------------------

const RESPONSE_TYPE_TO_ACTIVITY: Record<string, string> = {
  "decision-matrix": "decision-matrix",
  "pmi": "pmi",
  "pairwise": "pairwise-comparison",
};

const TEXT_PATTERNS: Array<{ pattern: RegExp; activityId: string }> = [
  { pattern: /SCAMPER|Substitute.*Combine.*Adapt/i, activityId: "scamper" },
  { pattern: /Six Thinking Hats|White Hat.*Red Hat/i, activityId: "six-thinking-hats" },
  { pattern: /See.*Think.*Wonder/i, activityId: "see-think-wonder" },
  { pattern: /Crazy 8s|8 different ideas in 8 minutes/i, activityId: "crazy-8s" },
  { pattern: /I Like.*I Wish.*What If/i, activityId: "design-critique" },
  { pattern: /Empathy Map|Says.*Thinks.*Does.*Feels/i, activityId: "empathy-map" },
  { pattern: /Storyboard|6-frame/i, activityId: "storyboarding" },
  { pattern: /Affinity Map/i, activityId: "affinity-mapping" },
  { pattern: /Decision Matrix|weighted criteria/i, activityId: "decision-matrix" },
  { pattern: /5 Whys|ask.*why.*five times/i, activityId: "5-whys" },
  { pattern: /KWL|Know.*Want.*Learn/i, activityId: "kwl-chart" },
  { pattern: /Lotus Diagram/i, activityId: "lotus-diagram" },
  { pattern: /What.If Scenarios|stress.test/i, activityId: "what-if-scenarios" },
  { pattern: /Pairwise Comparison/i, activityId: "pairwise-comparison" },
];

export function detectUsedActivities(
  pages: Partial<Record<string, PageContent>>
): Set<string> {
  const used = new Set<string>();
  for (const page of Object.values(pages)) {
    if (!page) continue;
    for (const section of page.sections) {
      // Check response type mapping
      const rtMatch = section.responseType ? RESPONSE_TYPE_TO_ACTIVITY[section.responseType] : undefined;
      if (rtMatch) used.add(rtMatch);
      // Check text patterns in prompt — Lever 1: scan the composed slot
      // text so v2 activities (where `task` carries the imperative body)
      // still trigger the right pattern matches.
      const text = composedPromptText(section);
      for (const { pattern, activityId } of TEXT_PATTERNS) {
        if (pattern.test(text)) used.add(activityId);
      }
    }
  }
  return used;
}
