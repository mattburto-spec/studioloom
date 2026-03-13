/**
 * Seed script: migrates the 16 hardcoded activity templates into the
 * activity_cards database table with rich metadata + modifier axes.
 *
 * Usage:
 *   npx tsx src/lib/activity-cards/seed.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dependency needed)
function loadEnv(filename: string) {
  try {
    const content = readFileSync(resolve(process.cwd(), filename), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* file not found — skip */ }
}
loadEnv(".env.local");
loadEnv(".env");

import { createClient } from "@supabase/supabase-js";
import { ACTIVITY_LIBRARY } from "../activity-library";
import type { ModifierAxis } from "@/types/activity-cards";

// ---------------------------------------------------------------------------
// Supabase admin client (direct, not via the shared helper so this can
// run standalone from the CLI)
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ---------------------------------------------------------------------------
// Duration string → minutes
// ---------------------------------------------------------------------------

const DURATION_MAP: Record<string, number> = {
  "5min": 5,
  "10min": 10,
  "15min": 15,
  "20min": 20,
  "30min+": 30,
};

// ---------------------------------------------------------------------------
// Hand-crafted modifier axes per card
// Each card gets modifiers specific to how teachers actually vary it.
// ---------------------------------------------------------------------------

const CARD_MODIFIERS: Record<string, ModifierAxis[]> = {
  scamper: [
    {
      id: "medium",
      label: "Working Medium",
      description: "How students record their SCAMPER ideas",
      type: "select",
      options: [
        { value: "written", label: "Written notes", promptDelta: "Students write their SCAMPER ideas as text notes." },
        { value: "sketches", label: "Quick sketches", promptDelta: "Students draw quick sketches alongside each SCAMPER prompt instead of writing paragraphs." },
        { value: "digital", label: "Digital / CAD", promptDelta: "Students use digital tools (e.g. TinkerCAD, Canva) to visualise each SCAMPER idea." },
      ],
      default: "written",
    },
    {
      id: "collaboration",
      label: "Collaboration Style",
      description: "How students work together on SCAMPER",
      type: "select",
      options: [
        { value: "solo", label: "Solo brainstorm", promptDelta: "Each student works individually." },
        { value: "think-pair-share", label: "Think-Pair-Share", promptDelta: "Students brainstorm individually first, then share with a partner to combine the best ideas." },
        { value: "group-rotation", label: "Group rotation", promptDelta: "Pass the paper around the group — each person adds one idea per SCAMPER letter before passing." },
      ],
      default: "solo",
    },
  ],

  "six-thinking-hats": [
    {
      id: "format",
      label: "Discussion Format",
      description: "How students cycle through the six hats",
      type: "select",
      options: [
        { value: "written", label: "Written individually", promptDelta: "Each student writes responses for all six hats." },
        { value: "role-play", label: "Role-play in groups", promptDelta: "Assign one hat per student in a group — each person argues from their hat's perspective in a structured discussion." },
        { value: "stations", label: "Station rotation", promptDelta: "Set up 6 stations around the room (one per hat). Groups rotate every 3 minutes, adding ideas at each station." },
      ],
      default: "written",
    },
    {
      id: "depth",
      label: "Depth",
      description: "How deeply students explore each hat",
      type: "select",
      options: [
        { value: "quick", label: "Quick scan (2 min/hat)", promptDelta: "Keep responses brief — 2-3 bullet points per hat maximum." },
        { value: "deep", label: "Deep dive (5 min/hat)", promptDelta: "Students write a full paragraph per hat with evidence and examples." },
      ],
      default: "quick",
    },
  ],

  pmi: [
    {
      id: "scope",
      label: "Evaluation Scope",
      description: "What students evaluate",
      type: "select",
      options: [
        { value: "single", label: "Single option", promptDelta: "Evaluate one design option in depth." },
        { value: "comparative", label: "Compare 2-3 options", promptDelta: "Create a separate PMI chart for each option, then compare across charts." },
      ],
      default: "single",
    },
    {
      id: "format",
      label: "Response Format",
      description: "How students present their PMI",
      type: "select",
      options: [
        { value: "table", label: "3-column table", promptDelta: "Use a 3-column table format with Plus, Minus, and Interesting headers." },
        { value: "freeform", label: "Freeform text", promptDelta: "Write in paragraph form using bullet points under each heading." },
      ],
      default: "table",
    },
  ],

  "see-think-wonder": [
    {
      id: "stimulus",
      label: "Stimulus Type",
      description: "What students observe",
      type: "select",
      options: [
        { value: "image", label: "Still image/product", promptDelta: "Students observe a still image or physical product." },
        { value: "video", label: "Short video clip", promptDelta: "Students watch a 1-2 minute video clip and respond." },
        { value: "physical", label: "Physical object handling", promptDelta: "Students handle and examine a physical object or prototype, noting tactile qualities too." },
      ],
      default: "image",
    },
    {
      id: "collaboration",
      label: "Collaboration",
      description: "Individual or shared observation",
      type: "select",
      options: [
        { value: "individual", label: "Individual", promptDelta: "Each student writes their own observations." },
        { value: "gallery-walk", label: "Gallery walk", promptDelta: "Set up multiple observation stations. Students rotate and add their observations to a shared sheet at each station." },
      ],
      default: "individual",
    },
  ],

  "crazy-8s": [
    {
      id: "medium",
      label: "Sketching Medium",
      description: "How students create their 8 ideas",
      type: "select",
      options: [
        { value: "paper", label: "Paper fold", promptDelta: "Fold a piece of paper into 8 sections and sketch by hand." },
        { value: "digital", label: "Digital canvas", promptDelta: "Use a digital whiteboard or drawing tool to create 8 sketches in separate frames." },
        { value: "sticky-notes", label: "Sticky notes", promptDelta: "Use 8 individual sticky notes — one idea per note — to enable easy rearranging afterwards." },
      ],
      default: "paper",
    },
    {
      id: "timing",
      label: "Time Pressure",
      description: "How strict the 1-minute-per-sketch rule is",
      type: "select",
      options: [
        { value: "strict", label: "Strict (1 min each)", promptDelta: "Enforce strict 1-minute timer per sketch to maximise divergent thinking." },
        { value: "relaxed", label: "Relaxed (2 min each)", promptDelta: "Give 2 minutes per sketch for students who need more time to capture their ideas." },
      ],
      default: "strict",
    },
  ],

  "design-critique": [
    {
      id: "mode",
      label: "Feedback Mode",
      description: "How the critique is delivered",
      type: "select",
      options: [
        { value: "written", label: "Written feedback", promptDelta: "Students write their feedback using the three lenses." },
        { value: "verbal", label: "Verbal round-robin", promptDelta: "Students take turns giving verbal feedback in a structured round-robin — each person shares one 'I Like', one 'I Wish', and one 'What If'." },
        { value: "sticky-wall", label: "Sticky note wall", promptDelta: "Each student writes feedback on colour-coded sticky notes (green=like, pink=wish, yellow=what if) and posts them on the designer's board." },
      ],
      default: "written",
    },
    {
      id: "subject",
      label: "Critique Subject",
      description: "What is being critiqued",
      type: "select",
      options: [
        { value: "peer", label: "Peer's work", promptDelta: "Students critique a classmate's design or prototype." },
        { value: "self", label: "Self-critique", promptDelta: "Students apply the three lenses to their own design work." },
        { value: "professional", label: "Professional example", promptDelta: "Students critique a professional product or design example." },
      ],
      default: "peer",
    },
  ],

  "empathy-map": [
    {
      id: "data-source",
      label: "Data Source",
      description: "Where empathy data comes from",
      type: "select",
      options: [
        { value: "imagined", label: "Imagined persona", promptDelta: "Students create the empathy map based on an imagined persona representing their target user." },
        { value: "interview", label: "From live interview", promptDelta: "Students first conduct a short interview with a real person, then fill the empathy map with actual data." },
        { value: "observation", label: "From video/observation", promptDelta: "Students watch a video or observe users in context, then map what they saw, heard, and inferred." },
      ],
      default: "imagined",
    },
    {
      id: "depth",
      label: "Map Depth",
      description: "How detailed the empathy map is",
      type: "select",
      options: [
        { value: "quick", label: "Quick 4-quadrant", promptDelta: "Use the standard 4-quadrant empathy map: Says, Thinks, Does, Feels." },
        { value: "extended", label: "Extended (with pains & gains)", promptDelta: "Use the extended empathy map with 6 sections: Says, Thinks, Does, Feels, plus Pains and Gains." },
      ],
      default: "quick",
    },
  ],

  storyboarding: [
    {
      id: "frame-count",
      label: "Frame Count",
      description: "Number of storyboard frames",
      type: "select",
      options: [
        { value: "4", label: "4 frames (simplified)", promptDelta: "Create a 4-frame storyboard: Problem → Solution → Key Feature → Happy User." },
        { value: "6", label: "6 frames (standard)", promptDelta: "Create a 6-frame storyboard covering the full user journey." },
        { value: "8", label: "8 frames (detailed)", promptDelta: "Create an 8-frame storyboard with additional scenes for context and edge cases." },
      ],
      default: "6",
    },
    {
      id: "medium",
      label: "Drawing Medium",
      description: "How students create the storyboard",
      type: "select",
      options: [
        { value: "hand-drawn", label: "Hand-drawn", promptDelta: "Draw frames by hand on paper, then photograph." },
        { value: "digital", label: "Digital tool", promptDelta: "Use a digital tool (Canva, Google Slides, Storyboard That) to create frames." },
        { value: "photo", label: "Photo-based", promptDelta: "Act out scenes and photograph them, or use found images to create a photo storyboard." },
      ],
      default: "hand-drawn",
    },
  ],

  "affinity-mapping": [
    {
      id: "medium",
      label: "Mapping Medium",
      description: "Physical or digital sticky notes",
      type: "select",
      options: [
        { value: "physical", label: "Physical sticky notes", promptDelta: "Use real sticky notes on a table or wall." },
        { value: "digital", label: "Digital board (Miro/Jamboard)", promptDelta: "Use a digital whiteboard like Miro, FigJam, or Google Jamboard for virtual sticky notes." },
      ],
      default: "physical",
    },
    {
      id: "grouping",
      label: "Grouping Method",
      description: "How themes are identified",
      type: "select",
      options: [
        { value: "silent", label: "Silent sort", promptDelta: "Students sort notes into groups silently — no talking allowed until all notes are placed." },
        { value: "discussion", label: "Discussion-based", promptDelta: "Students discuss each note as a group and decide together where it belongs." },
      ],
      default: "silent",
    },
  ],

  "decision-matrix": [
    {
      id: "criteria-source",
      label: "Criteria Source",
      description: "Where evaluation criteria come from",
      type: "select",
      options: [
        { value: "student", label: "Student-defined", promptDelta: "Students choose their own evaluation criteria based on their design specification." },
        { value: "teacher", label: "Teacher-provided", promptDelta: "Use the evaluation criteria provided by the teacher." },
        { value: "specification", label: "From design specification", promptDelta: "Extract criteria directly from the student's design specification requirements." },
      ],
      default: "student",
    },
    {
      id: "scoring",
      label: "Scoring Method",
      description: "How options are scored",
      type: "select",
      options: [
        { value: "numeric", label: "1-5 numeric", promptDelta: "Score each option 1-5 against each criterion." },
        { value: "traffic-light", label: "Traffic light (R/A/G)", promptDelta: "Use traffic light colours: Red (poor), Amber (acceptable), Green (good) instead of numbers." },
      ],
      default: "numeric",
    },
  ],

  "5-whys": [
    {
      id: "mode",
      label: "Investigation Mode",
      description: "Individual or collaborative root cause analysis",
      type: "select",
      options: [
        { value: "individual", label: "Individual written", promptDelta: "Each student traces 5 whys on their own." },
        { value: "pair-interview", label: "Pair interview", promptDelta: "One student states the problem, the partner asks 'Why?' five times — like a journalist interview." },
      ],
      default: "individual",
    },
    {
      id: "scope",
      label: "Problem Scope",
      description: "What problem is being analysed",
      type: "select",
      options: [
        { value: "design-problem", label: "Design problem (start of unit)", promptDelta: "Apply 5 Whys to the initial design problem to understand root causes before designing." },
        { value: "failure-analysis", label: "Failure analysis (testing phase)", promptDelta: "Apply 5 Whys to a failure or issue discovered during testing to find the root cause." },
      ],
      default: "design-problem",
    },
  ],

  "kwl-chart": [
    {
      id: "timing",
      label: "L Column Timing",
      description: "When the 'Learned' column is completed",
      type: "select",
      options: [
        { value: "end-of-lesson", label: "End of lesson", promptDelta: "Complete the 'L' column at the end of the same lesson." },
        { value: "end-of-week", label: "End of research phase", promptDelta: "Return to the KWL chart after completing all research to fill in the 'L' column." },
      ],
      default: "end-of-lesson",
    },
    {
      id: "sharing",
      label: "Sharing",
      description: "Whether KWL is shared with class",
      type: "toggle",
      default: false,
    },
  ],

  "lotus-diagram": [
    {
      id: "medium",
      label: "Drawing Medium",
      description: "How students create the lotus diagram",
      type: "select",
      options: [
        { value: "paper", label: "Paper grid", promptDelta: "Draw the 3x3 grid on paper." },
        { value: "digital", label: "Digital template", promptDelta: "Use a digital template (Google Slides, Canva) with pre-made grid boxes." },
      ],
      default: "paper",
    },
    {
      id: "depth",
      label: "Expansion Depth",
      description: "How many levels to expand",
      type: "select",
      options: [
        { value: "one-level", label: "One level (8 themes)", promptDelta: "Only expand the central idea into 8 themes — skip the second level expansion." },
        { value: "full", label: "Full (64 ideas)", promptDelta: "Complete the full Lotus Diagram: expand the central idea into 8 themes, then each theme into 8 more ideas." },
      ],
      default: "full",
    },
  ],

  "what-if-scenarios": [
    {
      id: "scenario-source",
      label: "Scenario Source",
      description: "Who creates the what-if questions",
      type: "select",
      options: [
        { value: "provided", label: "Teacher-provided", promptDelta: "Use the provided what-if scenarios." },
        { value: "student-created", label: "Student-created", promptDelta: "Students brainstorm their own what-if scenarios relevant to their specific design." },
        { value: "peer-swap", label: "Peer swap", promptDelta: "Pairs swap designs and write what-if scenarios for each other's work." },
      ],
      default: "provided",
    },
    {
      id: "response-depth",
      label: "Response Depth",
      description: "How detailed the scenario analysis should be",
      type: "select",
      options: [
        { value: "brief", label: "Brief (1-2 sentences)", promptDelta: "Keep responses brief — just identify what would happen and one change." },
        { value: "detailed", label: "Detailed (with sketch)", promptDelta: "For each scenario, write a full analysis and sketch how the design would need to change." },
      ],
      default: "brief",
    },
  ],

  "pairwise-comparison": [
    {
      id: "criteria-focus",
      label: "Comparison Basis",
      description: "What criteria to compare on",
      type: "select",
      options: [
        { value: "overall", label: "Overall preference", promptDelta: "Compare options based on overall impression — which is better overall?" },
        { value: "per-criterion", label: "Per-criterion", promptDelta: "Run separate pairwise comparisons for each evaluation criterion, then see which option wins most criteria." },
      ],
      default: "overall",
    },
  ],
};

// ---------------------------------------------------------------------------
// Embedding helper (inline to keep script standalone)
// ---------------------------------------------------------------------------

async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.warn("  ⚠ VOYAGE_API_KEY not set — skipping embedding");
    return null;
  }

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "voyage-3.5",
      input: [text],
      output_dimension: 1024,
    }),
  });

  if (!res.ok) {
    console.warn(`  ⚠ Embedding failed (${res.status}): ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed() {
  console.log("🌱 Seeding activity cards...\n");

  for (const template of ACTIVITY_LIBRARY) {
    const slug = template.id;
    console.log(`  → ${template.name} (${slug})`);

    // Check if card already exists
    const { data: existing } = await supabase
      .from("activity_cards")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existing) {
      console.log(`    ✓ Already exists, skipping`);
      continue;
    }

    // Build embedding text from name + description + whenToUse
    const embeddingText = `${template.name}: ${template.description} ${template.aiHints.whenToUse}`;
    const embedding = await getEmbedding(embeddingText);

    // Get modifiers for this card
    const modifiers = CARD_MODIFIERS[slug] || [];

    const row = {
      slug,
      name: template.name,
      description: template.description,
      category: template.category,
      criteria: template.tags.criteria,
      phases: template.tags.phases,
      thinking_type: template.tags.thinkingType,
      duration_minutes: DURATION_MAP[template.tags.duration] || 15,
      group_size: template.tags.groupSize,
      materials: [] as string[],
      tools: [] as string[],
      resources_needed: null,
      teacher_notes: null,
      template: {
        sections: template.template.sections,
        vocabTerms: template.template.vocabTerms || [],
        reflection: template.template.reflection || null,
      },
      ai_hints: {
        whenToUse: template.aiHints.whenToUse,
        topicAdaptation: template.aiHints.topicAdaptation,
        modifierAxes: modifiers,
      },
      curriculum_frameworks: ["IB_MYP"],
      source: "system",
      is_public: true,
      ...(embedding ? { embedding: `[${embedding.join(",")}]` } : {}),
    };

    const { error } = await supabase.from("activity_cards").insert(row);

    if (error) {
      console.error(`    ✗ Error: ${error.message}`);
    } else {
      console.log(`    ✓ Inserted${embedding ? " (with embedding)" : " (no embedding)"}`);
    }

    // Small delay to avoid rate limiting on Voyage API
    if (embedding) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("\n✅ Seeding complete!");
}

seed().catch(console.error);
