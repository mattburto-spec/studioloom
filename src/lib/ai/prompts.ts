import type { UnitWizardInput, LessonJourneyInput, JourneyOutlineOption, TimelineOutlineOption, TimelinePhase, TimelineLessonSkeleton, TimelineSkeleton } from "@/types";
import { CRITERIA, PAGES, type CriterionKey, MYP_GLOBAL_CONTEXTS, MYP_KEY_CONCEPTS, MYP_RELATED_CONCEPTS_DESIGN, EMPHASIS_PAGE_COUNT, buildPageDefinitions } from "@/lib/constants";
import { getActivityLibrarySummary } from "@/lib/activity-library";
import { getActivityCardSummaryEnriched } from "@/lib/activity-cards";
import {
  retrieveContext,
  formatRetrievedContext,
  recordRetrieval,
} from "@/lib/knowledge/retrieve";
import {
  retrieveLessonProfiles,
  formatLessonProfiles,
  incrementProfileReferences,
} from "@/lib/knowledge/retrieve-lesson-profiles";
import { retrieveAggregatedFeedback } from "@/lib/knowledge/feedback";
import { buildTeachingContextBlock } from "@/lib/knowledge/analysis-prompts";
import { buildFrameworkPromptBlock } from "@/lib/ai/framework-vocabulary";
import type { PartialTeachingContext } from "@/types/lesson-intelligence";
import { getFrameworkFromContext } from "@/lib/ai/teacher-context";

// =========================================================================
// Grade-Aware Timing Profiles
// =========================================================================

export interface GradeTimingProfile {
  mypYear: number;
  warmupMinutes: number;
  introMinutes: number;
  reflectionMinutes: number;
  /** Max minutes for HIGH cognitive demand activities (reading, writing, analysis, documentation) */
  maxHighCognitiveMinutes: number;
  /** Max minutes for ACTIVE/HANDS-ON activities (making, experimenting, building, testing) */
  maxHandsOnMinutes: number;
  /** Max minutes for COLLABORATIVE activities (discussion, peer review, group work) */
  maxCollaborativeMinutes: number;
  /** Max minutes for DIGITAL/RESEARCH activities (online research, digital tools, CAD) */
  maxDigitalMinutes: number;
  /** General pacing and scaffolding guidance for the AI */
  pacingNote: string;
}

const TIMING_PROFILES: Record<number, GradeTimingProfile> = {
  1: {
    mypYear: 1, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 12, maxHandsOnMinutes: 40, maxCollaborativeMinutes: 15, maxDigitalMinutes: 15,
    pacingNote: "MYP Year 1 (age 11): Students sustain cognitive focus for ~10-12 minutes but can engage in hands-on making for much longer. Reading, writing, and analysis tasks must be SHORT (≤12 min) and heavily scaffolded with checklists, sentence starters, and worked examples. Hands-on/making activities can run 20-40 min as long as they have clear checkpoints. Break reading-heavy tasks into small chunks with partner discussion between them.",
  },
  2: {
    mypYear: 2, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 15, maxHandsOnMinutes: 40, maxCollaborativeMinutes: 15, maxDigitalMinutes: 20,
    pacingNote: "MYP Year 2 (age 12): Cognitive focus extends to ~12-15 minutes. Still scaffold reading/analysis tasks with sentence starters and templates, but allow some choice in how students respond. Hands-on making activities can run 20-40 min. Mix active and passive tasks — avoid back-to-back reading/writing activities.",
  },
  3: {
    mypYear: 3, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 20, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 20, maxDigitalMinutes: 25,
    pacingNote: "MYP Year 3 (age 13): Cognitive focus ~15-20 minutes. Balance structured guidance with growing autonomy. Provide reference materials and exemplars but reduce step-by-step scaffolding. Students can handle longer research tasks and sustained making sessions.",
  },
  4: {
    mypYear: 4, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 25, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 30,
    pacingNote: "MYP Year 4 (age 15): Cognitive focus ~25 minutes. Support extended independent work with clear success criteria. Scaffold through exemplars and peer critique rather than templates. Students can manage longer analysis and documentation tasks.",
  },
  5: {
    mypYear: 5, warmupMinutes: 5, introMinutes: 3, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 30, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 35,
    pacingNote: "MYP Year 5 (age 16): Cognitive focus ~30 minutes. Minimise unnecessary transitions to allow flow state during deep work. Scaffold through prompts and peer critique. Students can sustain extended analysis, documentation, and independent making sessions.",
  },
};

/**
 * Parse the MYP year from a gradeLevel string like "Year 3 (Grade 8)".
 * Returns the timing profile for that year, defaulting to Year 3 if parsing fails.
 */
export function getGradeTimingProfile(gradeLevel: string): GradeTimingProfile {
  const match = gradeLevel?.match(/Year\s*(\d)/i);
  const year = match ? parseInt(match[1], 10) : 3;
  return TIMING_PROFILES[year] || TIMING_PROFILES[3];
}

/**
 * Build a timing constraints block for injection into generation prompts.
 * Uses activity-type-aware durations rather than hard caps.
 */
export function buildTimingBlock(profile: GradeTimingProfile, lessonLengthMinutes: number): string {
  const coreTime = lessonLengthMinutes - profile.warmupMinutes - profile.introMinutes - profile.reflectionMinutes;
  return `## Age-Appropriate Pacing (${profile.pacingNote})

Timing by activity type — duration depends on COGNITIVE DEMAND, not just the clock:
- Reading, writing, analysis, documentation (HIGH cognitive): ≤${profile.maxHighCognitiveMinutes} min per activity
- Making, experimenting, building, testing (HANDS-ON): ≤${profile.maxHandsOnMinutes} min per activity
- Discussion, peer review, group critique (COLLABORATIVE): ≤${profile.maxCollaborativeMinutes} min per activity
- Online research, digital tools, CAD work (DIGITAL): ≤${profile.maxDigitalMinutes} min per activity

Lesson structure:
- Warmup: ~${profile.warmupMinutes} min | Introduction: ~${profile.introMinutes} min | Reflection: ~${profile.reflectionMinutes} min
- Core work: ~${coreTime} min available (2-4 core activities per lesson)
- All sections should sum to approximately ${lessonLengthMinutes} minutes
- Avoid placing two high-cognitive activities back-to-back — alternate with hands-on or collaborative tasks`;
}

// =========================================================================

/**
 * System prompt that teaches the AI about MYP Design, the page structure,
 * and the exact JSON schema to output.
 */
export const UNIT_SYSTEM_PROMPT = `You are an expert MYP (Middle Years Programme) Design teacher and curriculum designer. You create engaging, differentiated unit content for the IB MYP Design cycle.

## MYP Design Cycle Structure
Units have a variable number of pages organized by MYP criteria (A, B, C, D).
The number of pages per criterion depends on the emphasis level:
- Light: 2 pages (concise coverage)
- Standard: 3 pages (balanced depth)
- Emphasis: 4 pages (thorough deep-dive)

Not every unit includes all 4 criteria — generate ONLY the pages specified in the user prompt.

## Your Task
Generate content for the requested criterion pages. Output ONLY valid JSON matching the exact schema below.

## JSON Schema (for each page)
{
  "pages": {
    "[PageId]": {
      "title": "Short descriptive page title",
      "learningGoal": "Clear learning objective for this page",
      "vocabWarmup": {
        "terms": [
          { "term": "Word", "definition": "Clear definition", "example": "Usage example" }
        ],
        "activity": {
          "type": "matching",
          "items": [
            { "question": "Match prompt", "answer": "Correct answer" }
          ]
        }
      },
      "introduction": {
        "text": "Introduction paragraph explaining the task and connecting to prior learning"
      },
      "sections": [
        {
          "prompt": "Clear, engaging question or task for the student",
          "scaffolding": {
            "ell1": {
              "sentenceStarters": ["Begin with...", "This means..."],
              "hints": ["Think about...", "Consider..."]
            },
            "ell2": {
              "sentenceStarters": ["I think...", "One example is..."]
            },
            "ell3": {
              "extensionPrompts": ["How might you extend this?", "What connections can you make?"]
            }
          },
          "responseType": "text",
          "exampleResponse": "A model response showing quality expectations"
        }
      ],
      "reflection": {
        "type": "confidence-slider",
        "items": ["I understand the task", "I can explain my reasoning"]
      }
    }
  }
}

## Important Rules
1. ALWAYS include ELL scaffolding (ell1, ell2, ell3) for EVERY section
2. Include 3-5 vocab terms per page, relevant to the topic
3. Include 2-4 activity sections per page
4. Vary responseType across sections: use "text", "upload", "link", "multi", and for decision-making tasks use "decision-matrix", "pmi", "pairwise", or "trade-off-sliders"
5. Make prompts age-appropriate for the specified grade level
6. Connect content to the specified global context and key concept
7. Include practical, hands-on activities where relevant
8. For "emphasis" criteria, include more detailed sections with deeper inquiry
9. For "light" criteria, keep sections focused and concise
10. Vocab activity type can be: "matching", "fill-blank", or "drag-sort"
11. Reflection type can be: "confidence-slider", "checklist", or "short-response"
12. Output ONLY the JSON object — no markdown, no explanations
13. When appropriate, incorporate established design thinking frameworks (SCAMPER, Six Thinking Hats, PMI, Empathy Map, Decision Matrix, etc.) into section prompts — adapt them to the specific topic rather than using generic templates
14. For B2-B3 pages (choosing between designs), prefer "decision-matrix" or "pairwise" responseType. For C1-C2 pages (planning creation), consider "trade-off-sliders". For evaluation pages, consider "pmi"
15. Set "portfolioCapture": true on 1-2 sections per page that represent substantive design work — research findings, design sketches/uploads, design justifications, creation evidence, evaluations. Omit or set false for vocab warm-ups, scaffolding prompts, and low-value practice questions`;

/**
 * Build the user prompt for generating a specific criterion's pages.
 *
 * @param activitySummary  Pre-fetched activity card summary from DB.
 *                         If omitted, falls back to the hardcoded library.
 */
export function buildCriterionPrompt(
  criterion: CriterionKey,
  input: UnitWizardInput,
  activitySummary?: string
): string {
  const criterionInfo = CRITERIA[criterion];
  const focusLevel = input.criteriaFocus[criterion] || "standard";
  const pageCount = EMPHASIS_PAGE_COUNT[focusLevel];
  const pageDefs = buildPageDefinitions([criterion], { [criterion]: focusLevel });

  const pageDescriptions = pageDefs
    .map((p) => `  - ${p.id}: ${p.title}`)
    .join("\n");

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  // Use DB-backed summary if available, fall back to hardcoded library
  const activitySuggestions = activitySummary || getActivityLibrarySummary(criterion);

  return `Generate ${pageCount} pages for Criterion ${criterion}: ${criterionInfo.name}

## Suggested Activity Cards for Criterion ${criterion}
Consider incorporating these activity cards where appropriate. Each card has a specific use case and optional modifiers. Pick the most relevant card for each page and weave it naturally into the section prompts:
${activitySuggestions}

## Unit Context
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}

## Pages to Generate
${pageDescriptions}

## Focus Level: ${focusLevel}
${focusLevel === "emphasis" ? "This is an EMPHASIS criterion — include more detailed sections (3-4 per page), deeper inquiry questions, and richer scaffolding." : focusLevel === "light" ? "This is a LIGHT criterion — keep sections concise (2 per page), focused, and efficient." : "This is STANDARD — include 2-3 sections per page with balanced depth."}

Generate the JSON for exactly these ${pageCount} pages (${pageDefs.map(p => p.id).join(", ")}). Remember to include ELL scaffolding (ell1, ell2, ell3) for every section.`;
}

/**
 * Build a RAG-enriched criterion prompt that includes retrieved examples
 * from the teacher's knowledge base and community content.
 *
 * Also fetches activity card summaries from the DB (with hardcoded fallback)
 * so the generation AI has full awareness of available activity cards.
 */
export async function buildRAGCriterionPrompt(
  criterion: CriterionKey,
  input: UnitWizardInput,
  teacherId?: string,
  selectedOutline?: { approach: string; pages: Record<string, { title: string; summary: string }> } | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  // Fetch enriched activity card summary from DB (includes modifier info)
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched(criterion);
  } catch {
    // DB unavailable — buildCriterionPrompt will fall back to hardcoded
  }

  const basePrompt = buildCriterionPrompt(criterion, input, activitySummary);

  // Retrieve relevant context from knowledge base
  const query = `${input.topic} ${input.title} Criterion ${criterion} ${CRITERIA[criterion].name} ${input.gradeLevel} ${input.globalContext}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      criterion,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    });

    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);

      // Record retrieval for quality tracking (fire-and-forget)
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement — continue without it
  }

  // Retrieve lesson profiles — structured pedagogical intelligence
  try {
    const profiles = await retrieveLessonProfiles({
      query: `${input.topic} ${input.title} ${CRITERIA[criterion].name} ${input.gradeLevel}`,
      gradeLevel: input.gradeLevel,
      criteria: [criterion],
      teacherId,
      maxProfiles: 3,
    });

    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);

      // Record retrieval for quality tracking (fire-and-forget)
      incrementProfileReferences(profileIds).catch(() => {});
    }
  } catch {
    // Lesson profiles are enhancement, not requirement
  }

  // Build outline instruction if teacher selected an approach
  let outlineSection = "";
  if (selectedOutline) {
    const criterionPages = Object.entries(selectedOutline.pages)
      .filter(([pageId]) => pageId.startsWith(criterion))
      .sort(([a], [b]) => a.localeCompare(b));

    if (criterionPages.length > 0) {
      outlineSection = `\n## Teacher's Chosen Approach: "${selectedOutline.approach}"
Follow this outline closely for each page:
${criterionPages.map(([pageId, p]) => `  - ${pageId}: "${p.title}" — ${p.summary}`).join("\n")}
`;
    }
  }

  if (!ragContext && !lessonContext && !outlineSection) {
    return { prompt: basePrompt, chunkIds: [] };
  }

  // Inject lesson profiles, RAG context, and outline before the base prompt
  // Order: Teaching Patterns (high-level) → Reference Examples (specific) → Outline → Base Prompt
  const enrichedPrompt = `${lessonContext ? lessonContext + "\n\n---\n\n" : ""}${ragContext ? ragContext + "\n\n---\n\n" : ""}${outlineSection ? outlineSection + "\n---\n\n" : ""}${basePrompt}`;

  return { prompt: enrichedPrompt, chunkIds };
}

/**
 * System prompt for generating unit outline options (not full pages).
 * Used in the multi-option generation step.
 */
export const OUTLINE_SYSTEM_PROMPT = `You are an expert MYP Design curriculum designer. Generate unit outline options — NOT full page content, just titles and brief descriptions for each page.

Units may not include all 4 criteria (A, B, C, D) and the number of pages per criterion varies by emphasis level. Generate outlines covering ONLY the specified criteria and page counts.

Each option should represent a genuinely different pedagogical approach to the same topic. Vary the activities, the entry point, the emphasis, and the assessment strategy.

Output valid JSON matching this schema:
{
  "options": [
    {
      "approach": "Short name for this approach (e.g., 'Community-Driven Design')",
      "description": "2-3 sentence description of what makes this approach distinctive",
      "strengths": ["Strength 1", "Strength 2"],
      "pages": {
        "A1": { "title": "Page title", "summary": "One-sentence description of what students do" },
        "A2": { ... },
        ...for all specified page IDs
      }
    }
  ]
}

Rules:
1. Generate exactly 3 options
2. Each option MUST cover ALL the page IDs specified in the user prompt — no more, no fewer
3. Options must be genuinely different — vary the design thinking frameworks, assessment types, entry activities, and real-world connections
4. Keep page summaries to one sentence each
5. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for multi-option outline generation.
 */
export function buildOutlinePrompt(
  input: UnitWizardInput,
  ragContext?: string
): string {
  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration for creating diverse, high-quality approaches.\n`
    : "";

  // Build page specification from selected criteria and emphasis
  const pageDefs = buildPageDefinitions(input.selectedCriteria, input.criteriaFocus);
  const totalPages = pageDefs.length;
  const pageSpec = (input.selectedCriteria || []).map(c => {
    const emphasis = (input.criteriaFocus || {})[c] || "standard";
    const count = EMPHASIS_PAGE_COUNT[emphasis];
    const pageIds = Array.from({ length: count }, (_, i) => `${c}${i + 1}`);
    return `- Criterion ${c} (${CRITERIA[c].name}): ${count} pages (${pageIds.join(", ")})`;
  }).join("\n");

  const criteriaFocusStr = (input.selectedCriteria || [])
    .map(c => `${c}=${(input.criteriaFocus || {})[c] || "standard"}`)
    .join(", ");

  return `Generate 3 distinct unit outline options for the following MYP Design unit:
${ragSection}
## Unit Context
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Criteria Focus: ${criteriaFocusStr}

## Page Structure (${totalPages} pages total)
${pageSpec}

Generate 3 genuinely different approaches. Each MUST cover exactly these ${totalPages} pages with the page IDs specified above.`;
}

/**
 * System prompt for the wizard suggestion endpoint.
 * Embeds valid MYP option lists so AI can only suggest valid values.
 */
export const SUGGEST_SYSTEM_PROMPT = `You are an MYP Design curriculum advisor. Given a topic and partial unit context, suggest the most relevant MYP framework elements AND practical teaching ideas.

VALID GLOBAL CONTEXTS (use exact labels):
${MYP_GLOBAL_CONTEXTS.map((gc) => `- "${gc.label}"`).join("\n")}

VALID KEY CONCEPTS (use exact values):
${MYP_KEY_CONCEPTS.map((kc) => `- "${kc}"`).join("\n")}

VALID RELATED CONCEPTS for Design (use exact values):
${MYP_RELATED_CONCEPTS_DESIGN.map((rc) => `- "${rc}"`).join("\n")}

Rules:
1. For globalContext and keyConcept, ONLY use the exact values listed above
2. For activities, tools, groupwork, and resources — suggest real, specific, practical ideas relevant to the topic (not from a fixed list)
3. Activities should be specific teaching activities (e.g., "SCAMPER brainstorm", "Gallery walk critique", "See-Think-Wonder analysis")
4. Tools should be specific software, platforms, or equipment students would use (e.g., "TinkerCAD", "Canva", "laser cutter", "Arduino")
5. Groupwork should describe specific collaborative structures (e.g., "Pair sketching", "Expert jigsaw", "Design critique circles")
6. Resources should be types of external content to include (e.g., "YouTube tutorial", "Industry case study", "Interactive demo")
7. Rank by relevance to the topic and grade level
8. For Statement of Inquiry, follow the IB formula: Key Concept + Related Concept(s) + Global Context woven into a single exploratory sentence
9. Keep JSON output minimal — no explanations outside JSON
10. Output ONLY valid JSON matching the requested schema`;

export interface SuggestContext {
  topic: string;
  title?: string;
  gradeLevel?: string;
  globalContext?: string;
  keyConcept?: string;
  relatedConcepts?: string[];
  statementOfInquiry?: string;
  /** Keywords already placed into buckets — AI should suggest complementary ones */
  placedKeywords?: string[];
}

export function buildSuggestPrompt(tier: 1 | 2 | 3, context: SuggestContext): string {
  const exclude: string[] = [];
  if (context.globalContext) exclude.push(`Already chosen globalContext: "${context.globalContext}"`);
  if (context.keyConcept) exclude.push(`Already chosen keyConcept: "${context.keyConcept}"`);
  if (context.relatedConcepts?.length)
    exclude.push(`Already chosen relatedConcepts: ${context.relatedConcepts.map((r) => `"${r}"`).join(", ")}`);

  if (context.placedKeywords?.length) {
    exclude.push(`Already placed keywords: ${context.placedKeywords.map((k) => `"${k}"`).join(", ")}`);
  }

  const excludeSection = exclude.length > 0 ? `\nDo NOT repeat these (already selected):\n${exclude.join("\n")}` : "";
  const complementSection = context.placedKeywords?.length
    ? `\nThe teacher has already chosen: ${context.placedKeywords.join(", ")}. Suggest COMPLEMENTARY items that pair well with these choices — different activities, tools, or resources that fill gaps.`
    : "";

  let schema = "";
  if (tier === 1) {
    schema = `{
  "globalContext": ["top pick", "2nd pick"],
  "keyConcept": ["top pick", "2nd pick"],
  "activities": ["specific activity 1", "specific activity 2", "specific activity 3"],
  "tools": ["specific tool or platform 1", "specific tool 2"],
  "groupwork": ["collaborative structure 1", "collaborative structure 2"],
  "resources": ["resource type 1", "resource type 2"]
}`;
  } else if (tier === 2) {
    schema = context.keyConcept
      ? `{ "relatedConcepts": ["top pick", "2nd pick", "3rd pick"] }`
      : `{ "keyConcept": ["top pick", "2nd pick"], "relatedConcepts": ["top pick", "2nd pick", "3rd pick"] }`;
  } else {
    schema = `{ "statementOfInquiry": "One exploratory sentence connecting key concept, related concepts, and global context", "criteriaEmphasis": [{ "criterion": "A"|"B"|"C"|"D", "direction": "emphasis"|"light", "reason": "short reason" }] }`;
  }

  return `Topic: "${context.topic}"
Title: "${context.title || ""}"
Grade: ${context.gradeLevel || "Year 3 (Grade 8)"}
${excludeSection}${complementSection}

Return JSON matching this schema:
${schema}`;
}

// --- Auto-config prompt (Build for Me mode) ---

import { DESIGN_SKILLS, MYP_ATL_SKILL_CATEGORIES } from "@/lib/constants";

export const AUTOCONFIG_SYSTEM_PROMPT = `You are an expert MYP Design curriculum advisor. Given a teacher's end-goal description and optional keyword tags, determine ALL the MYP framework elements needed to build a unit.

VALID GLOBAL CONTEXTS (pick exactly 1, use exact label):
${MYP_GLOBAL_CONTEXTS.map((gc) => `- "${gc.label}"`).join("\n")}

VALID KEY CONCEPTS (pick exactly 1, use exact value):
${MYP_KEY_CONCEPTS.map((kc) => `- "${kc}"`).join("\n")}

VALID RELATED CONCEPTS for Design (pick 2-3, use exact values):
${MYP_RELATED_CONCEPTS_DESIGN.map((rc) => `- "${rc}"`).join("\n")}

VALID DESIGN SKILLS (pick 1-3 that match the project):
${(DESIGN_SKILLS as readonly string[]).map((s) => `- "${s}"`).join("\n")}

VALID ATL SKILL CATEGORIES:
${MYP_ATL_SKILL_CATEGORIES.map((cat) => `- ${cat.category}: ${cat.skills.join(", ")}`).join("\n")}

Rules:
1. ONLY use exact values from the lists above
2. Generate a concise unit title (5-8 words)
3. The topic should expand on the teacher's goal text into a clear description
4. Statement of Inquiry must follow IB formula: weave Key Concept + Related Concepts + Global Context into one exploratory sentence
5. criteriaFocus: consider the project type. Heavy research → emphasize A. Heavy making → emphasize C. Heavy evaluation → emphasize D. Default to "standard" for balanced projects.
6. selectedCriteria: include all 4 by default ["A","B","C","D"]. For short units (4 weeks or less), consider dropping a criterion. For focused projects, consider using only 2-3 criteria.
7. Output ONLY valid JSON — no markdown, no explanations`;

export function buildAutoConfigPrompt(
  goalText: string,
  gradeLevel: string,
  durationWeeks: number,
  keywords: string[]
): string {
  const keywordsSection = keywords.length > 0
    ? `\nTeacher-pinned keywords: ${keywords.join(", ")}`
    : "";

  return `Teacher's goal: "${goalText}"
Grade: ${gradeLevel}
Duration: ${durationWeeks} weeks${keywordsSection}

Return JSON matching this exact schema:
{
  "title": "Short unit title",
  "topic": "Expanded topic description",
  "globalContext": "One of the valid global contexts",
  "keyConcept": "One of the valid key concepts",
  "relatedConcepts": ["concept1", "concept2"],
  "statementOfInquiry": "One exploratory sentence",
  "selectedCriteria": ["A", "B", "C", "D"],
  "criteriaFocus": { "A": "standard|emphasis|light", "B": "...", "C": "...", "D": "..." },
  "atlSkills": ["skill1", "skill2"],
  "specificSkills": ["design skill 1"]
}`;
}

// =========================================================================
// JOURNEY MODE — Continuous Learning Journey Generation
// =========================================================================

/**
 * System prompt for journey-mode generation.
 * Frames the unit as one continuous learning journey working backwards
 * from the end goal, broken into lesson-length blocks.
 */
export const JOURNEY_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. You create engaging, differentiated unit content structured as a continuous learning journey.

## Core Principle: Backward Design
You are given an END GOAL — the final product or outcome students must achieve. Your job is to work BACKWARDS from that goal to design a coherent sequence of lessons that gets students there. Every lesson exists because it contributes to reaching the end goal.

## Unit Structure
The unit is a sequence of LESSON BLOCKS. Each lesson is a fixed length (specified in the prompt). Lessons flow continuously — there are no structural breaks between "criteria" or "phases". Instead, each lesson naturally builds on the previous one.

## Assessment Criteria as Tags
The prompt specifies which assessment criteria exist (e.g. A, B, C, D for MYP Design). You MUST tag every activity section with the criteria it addresses using "criterionTags": ["A"] or ["B", "C"]. Criteria are metadata — they tell the teacher which assessment strand an activity contributes to. They do NOT control lesson structure.

A single lesson might touch multiple criteria. For example:
- Researching materials (A) → sketching initial ideas (B) in one lesson
- Building a prototype (C) → testing it (D) in another
- Evaluating results (D) while planning iterations (B) in another

## Lesson Flow Grammar
Follow these principles for sequencing across the unit:

### Bloom's Progression
Early lessons start at Remember/Understand (research, vocabulary, analysis of existing products).
Middle lessons progress to Apply/Analyse (ideation, planning, skill-building).
Later lessons reach Evaluate/Create (making, testing, evaluating, iterating).

### Scaffolding Fade
Lesson 1-2: Heavy scaffolding (sentence starters, worked examples, structured templates).
Middle lessons: Moderate scaffolding (some sentence starters, reference to earlier work).
Final lessons: Minimal scaffolding (extension prompts only, students work independently).

### Energy & Pacing
Each lesson has an energy arc: calm focus (warm-up) → active engagement (core tasks) → reflection.
Across the unit: build from curious exploration → creative energy → productive struggle → celebratory completion.

### Continuity
Each lesson's introduction should reference what was achieved in the previous lesson.
Each lesson should end by previewing what comes next.
The final lesson should circle back to the original goal.

## Timing
Each lesson is exactly [X] minutes. The prompt below provides age-appropriate timing constraints based on the students' grade level — follow them precisely. Activity durations MUST respect the maximum core activity length for the grade.

IMPORTANT: Include "durationMinutes" on EVERY section. All section durations within a lesson should sum to the lesson length.

## JSON Schema (for each lesson page)
{
  "[LessonId]": {
    "title": "Short descriptive lesson title",
    "learningGoal": "Clear learning objective for this lesson",
    "vocabWarmup": {
      "terms": [
        { "term": "Word", "definition": "Clear definition", "example": "Usage example" }
      ],
      "activity": {
        "type": "matching|fill-blank|drag-sort",
        "items": [{ "question": "Match prompt", "answer": "Correct answer" }]
      }
    },
    "introduction": {
      "text": "Introduction connecting to prior learning and previewing this lesson"
    },
    "sections": [
      {
        "prompt": "Clear, engaging task for the student",
        "criterionTags": ["A"],
        "durationMinutes": 15,
        "scaffolding": {
          "ell1": { "sentenceStarters": [...], "hints": [...] },
          "ell2": { "sentenceStarters": [...] },
          "ell3": { "extensionPrompts": [...] }
        },
        "responseType": "text|upload|voice|link|multi|decision-matrix|pmi|pairwise|trade-off-sliders",
        "exampleResponse": "Model response showing quality expectations",
        "portfolioCapture": true
      }
    ],
    "reflection": {
      "type": "confidence-slider|checklist|short-response",
      "items": ["I understand the task", "I can explain my reasoning"]
    }
  }
}

## Important Rules
1. ALWAYS include ELL scaffolding (ell1, ell2, ell3) for EVERY section
2. ALWAYS include criterionTags on EVERY section — at least one criterion per section
3. ALWAYS include durationMinutes on EVERY section — realistic time estimate in minutes
4. Include 3-5 vocab terms per lesson, relevant to the lesson's focus
5. Include 2-4 activity sections per lesson (adjust based on lesson length)
6. Vary responseType across sections: "text", "upload", "link", "multi", and for decision tasks use "decision-matrix", "pmi", "pairwise", or "trade-off-sliders"
6. Make content age-appropriate for the specified grade level
7. Connect content to the specified global context and key concept
8. Include practical, hands-on activities where relevant
9. Vocab activity type can be: "matching", "fill-blank", or "drag-sort"
10. Reflection type can be: "confidence-slider", "checklist", or "short-response"
11. When appropriate, incorporate design thinking frameworks (SCAMPER, Six Thinking Hats, PMI, Empathy Map, Decision Matrix, etc.) — adapt them to the specific topic
12. Set "portfolioCapture": true on 1-2 sections per lesson that represent substantive design work (analysis, sketches, justifications, creation evidence, evaluations)
13. Each lesson should be SELF-CONTAINED enough to work as a single class period, but CONNECTED enough that the unit tells a coherent story
14. The first lesson should hook students with the end goal and build excitement
15. The final lesson should include completion, presentation, or celebration of the end product`;

/**
 * Build the user prompt for journey-mode lesson generation.
 *
 * @param lessonIds   Which lessons to generate (e.g. ["L01","L02","L03","L04","L05","L06"])
 * @param input       Journey input with end goal, weeks, lesson config
 * @param options     Optional context: outline, activity cards, RAG
 */
export function buildJourneyPrompt(
  lessonIds: string[],
  input: LessonJourneyInput,
  options?: {
    selectedOutline?: JourneyOutlineOption | null;
    activitySummary?: string;
    ragContext?: string;
    lessonContext?: string;
    totalLessons?: number;
    batchIndex?: number;
    previousLessonSummary?: string;
    teachingContextBlock?: string;
  }
): string {
  const totalLessons = options?.totalLessons || input.durationWeeks * input.lessonsPerWeek;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  // Build outline context for this batch
  let outlineSection = "";
  if (options?.selectedOutline) {
    const relevantLessons = options.selectedOutline.lessonPlan
      .filter((l) => lessonIds.includes(l.lessonId));
    if (relevantLessons.length > 0) {
      outlineSection = `\n## Teacher's Chosen Approach: "${options.selectedOutline.approach}"
Follow this outline closely for each lesson:
${relevantLessons.map((l) => `  - ${l.lessonId}: "${l.title}" — ${l.summary} [${l.criterionTags.join(", ")}]`).join("\n")}
`;
    }
  }

  // Context from previous batch
  const continuitySection = options?.previousLessonSummary
    ? `\n## Previously Generated Lessons
${options.previousLessonSummary}
Continue the learning journey from where the previous lessons left off.
`
    : "";

  // RAG context sections
  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";
  const contextBlock = options?.teachingContextBlock ? options.teachingContextBlock + "\n\n---\n\n" : "";

  return `${contextBlock}${lessonProfileSection}${ragSection}${continuitySection}${outlineSection}
## Available Activity Cards
Consider incorporating these activity cards where appropriate. Pick the most relevant for each lesson and weave them naturally into section prompts:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons total)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")} (tag each section with the relevant criteria)

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes)}

## Lessons to Generate
Generate these ${lessonIds.length} lessons (of ${totalLessons} total):
${lessonIds.map((id, i) => {
  const lessonNum = parseInt(id.replace("L", ""), 10);
  return `  - ${id}: Lesson ${lessonNum} of ${totalLessons}`;
}).join("\n")}

${lessonIds[0] === "L01" ? "This is the FIRST batch — Lesson 1 should hook students with the end goal and build excitement about the project." : ""}
${lessonIds.includes(`L${String(totalLessons).padStart(2, "0")}`) ? "This batch includes the FINAL lesson — it should include completion, presentation, or celebration of the end product." : ""}

Remember:
- Each lesson is exactly ${input.lessonLengthMinutes} minutes
- Tag EVERY section with criterionTags (${(input.assessmentCriteria || []).join(", ")})
- Include ELL scaffolding (ell1, ell2, ell3) for every section
- Build on what came before, preview what comes next`;
}

/**
 * Build a RAG-enriched journey prompt.
 * Retrieves lesson profiles and knowledge chunks WITHOUT criterion filtering.
 */
export async function buildRAGJourneyPrompt(
  lessonIds: string[],
  input: LessonJourneyInput,
  teacherId?: string,
  selectedOutline?: JourneyOutlineOption | null,
  previousLessonSummary?: string,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  // Fetch enriched activity card summary from DB (all categories, no criterion filter)
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched();
  } catch {
    // DB unavailable — will fall back to hardcoded
  }

  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  // Retrieve relevant context from knowledge base (no criterion filter)
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    });

    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement
  }

  // Retrieve lesson profiles + aggregated feedback
  let feedbackContext = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query: `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    });

    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);
      incrementProfileReferences(profileIds).catch(() => {});

      // Close the feedback loop: inject real teaching experience
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackContext = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement, not requirement
      }
    }
  } catch {
    // Lesson profiles are enhancement, not requirement
  }

  // Build teaching context + framework vocabulary blocks
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));

  const prompt = buildJourneyPrompt(lessonIds, input, {
    selectedOutline,
    activitySummary,
    ragContext: ragContext || undefined,
    lessonContext: (lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "")) || undefined,
    totalLessons,
    previousLessonSummary,
    teachingContextBlock: (frameworkBlock + teachingContextBlock) || undefined,
  });

  return { prompt, chunkIds };
}

/**
 * System prompt for journey-mode outline generation.
 */
export const JOURNEY_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate unit outline options structured as a continuous learning journey.

The teacher has an END GOAL — the final product or outcome students must achieve. You design 3 genuinely different lesson sequences that work backwards from that goal.

Each outline is a sequence of lessons (not grouped by criteria). Each lesson has a primary focus and the assessment criteria it will address.

Output valid JSON matching this schema:
{
  "options": [
    {
      "approach": "Short name (e.g., 'Rapid Prototype First')",
      "description": "2-3 sentences on what makes this approach distinctive",
      "strengths": ["Strength 1", "Strength 2"],
      "lessonPlan": [
        {
          "lessonId": "L01",
          "title": "Lesson title",
          "summary": "One-sentence description of what students do",
          "primaryFocus": "Research|Ideation|Planning|Skill Building|Making|Testing|Iteration|Evaluation|Presentation",
          "criterionTags": ["A"]
        }
      ]
    }
  ]
}

Rules:
1. Generate exactly 3 options
2. Each option MUST have exactly the number of lessons specified
3. Options must be genuinely different — vary entry points, sequencing, project approaches
4. A lesson can address multiple criteria (criterionTags: ["B", "C"])
5. Ensure ALL specified criteria appear across the unit (every criterion must be tagged at least once)
6. The first lesson should hook students; the last should celebrate the outcome
7. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for journey-mode outline generation.
 */
export function buildJourneyOutlinePrompt(
  input: LessonJourneyInput,
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;
  const lessonIds = Array.from({ length: totalLessons }, (_, i) =>
    `L${String(i + 1).padStart(2, "0")}`
  );

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 3 distinct lesson journey outlines for the following unit:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria to Tag: ${(input.assessmentCriteria || []).join(", ")}

## Lesson IDs
Generate outlines for exactly ${totalLessons} lessons with IDs: ${lessonIds.join(", ")}

Generate 3 genuinely different approaches. Each MUST include exactly ${totalLessons} lessons.`;
}

// =========================================================================
// Journey Mode — Single outline generation (for "suggest another" feature)
// =========================================================================

export const SINGLE_JOURNEY_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate ONE unit outline structured as a continuous learning journey.

The teacher has an END GOAL — the final product or outcome students must achieve. You design a single lesson sequence that works backwards from that goal.

Output valid JSON matching this schema:
{
  "approach": "Short name (e.g., 'Rapid Prototype First')",
  "description": "2-3 sentences on what makes this approach distinctive",
  "strengths": ["Strength 1", "Strength 2"],
  "lessonPlan": [
    {
      "lessonId": "L01",
      "title": "Lesson title",
      "summary": "One-sentence description of what students do",
      "primaryFocus": "Research|Ideation|Planning|Skill Building|Making|Testing|Iteration|Evaluation|Presentation",
      "criterionTags": ["A"]
    }
  ]
}

Rules:
1. Generate exactly 1 option (NOT wrapped in an "options" array)
2. The option MUST have exactly the number of lessons specified
3. A lesson can address multiple criteria (criterionTags: ["B", "C"])
4. Ensure ALL specified criteria appear across the unit
5. The first lesson should hook students; the last should celebrate the outcome
6. Output ONLY valid JSON — no markdown, no explanations`;

export function buildSingleJourneyOutlinePrompt(
  input: LessonJourneyInput,
  angleHint: string,
  avoidApproaches: string[],
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;
  const lessonIds = Array.from({ length: totalLessons }, (_, i) =>
    `L${String(i + 1).padStart(2, "0")}`
  );

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const avoidSection = avoidApproaches.length > 0
    ? `\n\nIMPORTANT: Do NOT use these approaches (already taken by other options): ${avoidApproaches.join(", ")}. Be genuinely different.`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 1 lesson journey outline for the following unit, taking a **${angleHint}** angle:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria to Tag: ${(input.assessmentCriteria || []).join(", ")}

## Lesson IDs
Generate an outline for exactly ${totalLessons} lessons with IDs: ${lessonIds.join(", ")}

## Requirements
- ${angleHint}
- Be genuinely creative and distinctive${avoidSection}`;
}

// =========================================================================
// Timeline Mode — Flat activity sequence
// =========================================================================

/**
 * System prompt for timeline-mode generation.
 * Activities are a flat sequence; lesson boundaries are computed from duration.
 */
export const TIMELINE_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. You create engaging, differentiated unit content as a continuous timeline of activities.

## Core Principle: Continuous Timeline
Instead of creating fixed lessons, you generate a FLAT SEQUENCE of activities for the entire unit. Lesson boundaries are computed automatically from activity durations and the school's lesson length. An activity that doesn't fit in the remaining time slides whole to the next lesson.

## Backward Design
You are given an END GOAL — the final product or outcome students must achieve. Work BACKWARDS from that goal to design a coherent activity sequence.

## Activity Roles
Every activity has a "role":
- **warmup**: Vocabulary warm-up (include vocabTerms). Place one roughly every [lessonLength] minutes.
- **intro**: Introduction connecting to prior learning. Place one after each warmup.
- **core**: Main student tasks — the heart of the unit. Most activities are core.
- **content**: Pure information — safety warnings, key concepts, context blocks. No student response required. Omit responseType. Use contentStyle: "info" (key concepts), "warning" (safety/caution), "tip" (pro tips), "context" (background). Include media (image/video URLs) or links (external tool URLs with labels) where visual reference or tool access helps.
- **reflection**: Self-assessment at natural breakpoints. Place one roughly every [lessonLength] minutes.

## Rich Content
- **media**: Include image or video URLs where visual reference helps. Use standard YouTube/Vimeo watch URLs (auto-converted to embeds). Set type to "image" or "video".
- **links**: Include external tool links with clear labels, e.g. { url: "https://tinkercad.com", label: "Open TinkerCAD" }. Displayed as action buttons.
- **markdown**: Prompts support basic markdown: **bold**, *italic*, [links](url). Use sparingly for emphasis.

## Phase Labels
Group activities into phases using "phaseLabel" (e.g., "Research", "Ideation", "Prototyping", "Evaluation"). Activities in the same phase share a phaseLabel. This helps teachers see the arc.

## Assessment Criteria as Tags
Tag every CORE activity with criterionTags (e.g. ["A"], ["B","C"]). Warmup/intro/reflection activities can omit tags.

## Timing
- Total duration of ALL activities ≈ totalLessons × lessonLengthMinutes
- Each activity has a realistic durationMinutes
- The prompt below provides age-appropriate timing constraints based on the students' grade level — core activity durations MUST respect the maximum for the grade
- Place warmup+intro+reflection bookends at approximately every [lessonLength] minutes of cumulative core time

## Sequencing
### Bloom's Progression
Early: Remember/Understand (research, vocabulary, existing product analysis)
Middle: Apply/Analyse (ideation, planning, skill-building)
Later: Evaluate/Create (making, testing, evaluating, iterating)

### Scaffolding Fade
Early activities: Heavy scaffolding (sentence starters, worked examples, templates)
Middle: Moderate scaffolding
Late: Minimal scaffolding (extension prompts only)

### Energy & Pacing
Build from curious exploration → creative energy → productive struggle → celebratory completion

## Rules
1. Include ELL scaffolding (ell1, ell2, ell3) for EVERY core activity
2. Tag every core activity with criterionTags
3. Include durationMinutes on EVERY activity
4. Vary responseType across activities
5. Set portfolioCapture: true on 1-2 core activities per ~lesson-length of time
6. First activities should hook students with the end goal
7. Final activities should include completion/celebration of the end product
8. Give each activity a unique short ID (a1, a2, a3, ...)`;

/**
 * Build the user prompt for timeline-mode activity generation.
 */
export function buildTimelinePrompt(
  input: LessonJourneyInput,
  options?: {
    selectedOutline?: TimelineOutlineOption | null;
    phaseToGenerate?: TimelinePhase;
    activitySummary?: string;
    ragContext?: string;
    lessonContext?: string;
    totalLessons?: number;
    previousActivitiesSummary?: string;
    activitiesGeneratedSoFar?: number;
    teachingContextBlock?: string;
  }
): string {
  const totalLessons = options?.totalLessons || input.durationWeeks * input.lessonsPerWeek;
  const totalMinutes = totalLessons * input.lessonLengthMinutes;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  // Phase-specific context
  let phaseSection = "";
  if (options?.phaseToGenerate) {
    const phase = options.phaseToGenerate;
    phaseSection = `
## Phase to Generate: "${phase.title}"
${phase.summary}
Primary Focus: ${phase.primaryFocus}
Criteria Emphasis: ${phase.criterionTags.join(", ")}
Estimated duration: ~${phase.estimatedLessons} lessons (${phase.estimatedLessons * input.lessonLengthMinutes} minutes of activities)

Generate activities for THIS PHASE ONLY. Include warmup/intro at the start and reflection at the end.`;
  } else if (options?.selectedOutline) {
    phaseSection = `
## Teacher's Chosen Approach: "${options.selectedOutline.approach}"
Phases:
${options.selectedOutline.phases.map((p) => `  - ${p.title} (~${p.estimatedLessons} lessons): ${p.summary} [${p.criterionTags.join(", ")}]`).join("\n")}

Generate activities covering ALL phases.`;
  }

  // Context from previous generation
  const continuitySection = options?.previousActivitiesSummary
    ? `
## Previously Generated Activities
${options.previousActivitiesSummary}
Continue the activity sequence from where the previous batch left off.`
    : "";

  // RAG context + teaching context
  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";
  const contextBlock = options?.teachingContextBlock ? options.teachingContextBlock + "\n\n---\n\n" : "";

  return `${contextBlock}${lessonProfileSection}${ragSection}${continuitySection}${phaseSection}

## Available Activity Cards
Consider incorporating these where appropriate:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons, ${totalMinutes} total minutes)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")} (tag each core activity)

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes)}

## Generation Target
Generate a flat list of activities. Total duration should be approximately ${totalMinutes} minutes.
Place warmup + intro + reflection bookends roughly every ${input.lessonLengthMinutes} minutes of content.
${options?.activitiesGeneratedSoFar ? `Activities generated so far: ${options.activitiesGeneratedSoFar}` : ""}

Remember:
- Every activity needs: id, role, title, prompt, durationMinutes
- Core activities need: responseType, criterionTags, scaffolding (ell1/ell2/ell3)
- Content activities: omit responseType. Use contentStyle, media, links where helpful.
- Warmup activities need: vocabTerms
- Reflection activities need: reflectionType, reflectionItems
- Use phaseLabel to group activities into coherent phases
- Include media (video/image URLs) and links (external tools) where they add value`;
}

/**
 * System prompt for timeline-mode outline generation.
 */
export const TIMELINE_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate unit outline options structured as phase-based timelines.

The teacher has an END GOAL. You design 3 genuinely different approaches, each described as a sequence of PHASES (not individual lessons). Phases are like chapters — "Research & Discovery", "Rapid Prototyping", "Testing & Iteration", etc.

Each phase specifies approximately how many lessons it spans, what the primary focus is, and which assessment criteria are emphasized.

Rules:
1. Generate exactly 3 options
2. Each option has 3-5 phases
3. Phase estimatedLessons must sum to approximately the total lesson count
4. Options must be genuinely different — vary entry points, sequencing, project approaches
5. Ensure ALL specified criteria appear across the phases
6. Include an estimatedActivityCount (typically 4-6 activities per lesson)
7. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for timeline-mode outline generation.
 */
export function buildTimelineOutlinePrompt(
  input: LessonJourneyInput,
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 3 distinct phase-based timeline outlines for the following unit:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- Each approach should have 3-5 phases
- Phase estimatedLessons should sum to approximately ${totalLessons}
- estimatedActivityCount should be realistic (~4-6 activities per lesson, so roughly ${totalLessons * 5})
- Generate 3 genuinely different approaches`;
}

/**
 * System prompt for generating a SINGLE timeline outline approach.
 */
export const SINGLE_TIMELINE_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate ONE unit outline structured as a phase-based timeline.

The teacher has an END GOAL. You design a single approach described as a sequence of PHASES (not individual lessons). Phases are like chapters — "Research & Discovery", "Rapid Prototyping", "Testing & Iteration", etc.

Each phase specifies approximately how many lessons it spans, what the primary focus is, and which assessment criteria are emphasized.

Rules:
1. Generate exactly 1 approach
2. The approach has 3-5 phases
3. Phase estimatedLessons must sum to approximately the total lesson count
4. Ensure ALL specified criteria appear across the phases
5. Include an estimatedActivityCount (typically 4-6 activities per lesson)
6. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build a user prompt for generating a SINGLE timeline outline with a given angle.
 */
export function buildSingleTimelineOutlinePrompt(
  input: LessonJourneyInput,
  angleHint: string,
  avoidApproaches: string[],
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const avoidSection = avoidApproaches.length > 0
    ? `\n\nIMPORTANT: Do NOT use these approaches (already taken by other options): ${avoidApproaches.join(", ")}. Be genuinely different.`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 1 phase-based timeline outline for the following unit, taking a **${angleHint}** angle:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- ${angleHint}
- The approach should have 3-5 phases
- Phase estimatedLessons should sum to approximately ${totalLessons}
- estimatedActivityCount should be realistic (~4-6 activities per lesson, so roughly ${totalLessons * 5})${avoidSection}`;
}

/**
 * Build RAG-enhanced timeline prompt with knowledge base + lesson profiles.
 * Mirrors buildRAGJourneyPrompt but for timeline-mode generation.
 */
export async function buildRAGTimelinePrompt(
  input: LessonJourneyInput,
  teacherId?: string,
  selectedOutline?: TimelineOutlineOption | null,
  phaseToGenerate?: TimelinePhase,
  previousActivitiesSummary?: string,
  activitiesGeneratedSoFar?: number,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  // Fetch enriched activity card summary from DB
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched();
  } catch {
    // DB unavailable — will fall back to hardcoded
  }

  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  // Retrieve relevant context from knowledge base
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    });

    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement
  }

  // Retrieve lesson profiles + their aggregated feedback
  let feedbackContext = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    });

    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);
      incrementProfileReferences(profileIds).catch(() => {});

      // Close the feedback loop: inject real teaching experience
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackContext = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement, not requirement
      }
    }
  } catch {
    // Lesson profiles are enhancement, not requirement
  }

  // Build teaching context + framework vocabulary blocks
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));

  const prompt = buildTimelinePrompt(input, {
    selectedOutline,
    phaseToGenerate,
    activitySummary,
    ragContext: ragContext || undefined,
    lessonContext: (lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "")) || undefined,
    totalLessons,
    previousActivitiesSummary,
    activitiesGeneratedSoFar,
    teachingContextBlock: (frameworkBlock + teachingContextBlock) || undefined,
  });

  return { prompt, chunkIds };
}

// =========================================================================
// SKELETON GENERATION (Stage 1 — fast lesson-level outline before full activities)
// =========================================================================

/**
 * System prompt for skeleton generation.
 * Produces lesson titles, key questions, and timing — NOT full activities.
 */
export const SKELETON_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. Generate a LESSON SKELETON — a lightweight outline of every lesson in the unit.

## What You're Generating
For each lesson: a title, key driving question, estimated duration, phase label, assessment criteria emphasis, and 3-4 brief activity hints (one line each, not full activity details).

## Backward Design
The teacher has an END GOAL. Work backwards: what must students have completed by the last lesson? The second-to-last? Build a coherent learning arc.

## Rules
1. Lesson count and timing must match the unit duration
2. Every assessment criterion must appear across the lessons
3. Activity hints are brief suggestions, not detailed prompts (e.g., "Warmup: key vocab matching", "Core: user survey design")
4. Include warmup + reflection hints in each lesson (bookending the core)
5. Include a narrative arc — a 2-3 sentence summary of how the unit flows emotionally and intellectually
6. Phase labels should match the selected approach's phases
7. Early lessons: research, exploration, understanding. Middle: ideation, skill-building. Late: making, testing, presenting.
8. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for skeleton generation.
 */
export function buildSkeletonPrompt(
  input: LessonJourneyInput,
  outline: TimelineOutlineOption,
  ragContext?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  return `Generate a lesson skeleton for the following unit:
${ragSection}
## Selected Approach: "${outline.approach}"
${outline.description}

Phases:
${outline.phases.map((p) => `  - ${p.title} (~${p.estimatedLessons} lessons): ${p.summary} [Criteria: ${p.criterionTags.join(", ")}]`).join("\n")}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- Generate exactly ${totalLessons} lesson skeletons
- Each lesson gets estimatedMinutes of ${input.lessonLengthMinutes}
- Each lesson has 3-4 brief activity hints (one line each)
- Phase labels must match the approach phases above
- Criteria must be distributed across all lessons
- Include a narrativeArc summary (2-3 sentences)`;
}

/**
 * Build RAG-enhanced skeleton prompt.
 */
export async function buildRAGSkeletonPrompt(
  input: LessonJourneyInput,
  outline: TimelineOutlineOption,
  teacherId?: string,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  let ragContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 3,
    });
    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement
  }

  // Retrieve lesson profiles + aggregated feedback for skeleton context
  let feedbackBlock = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    });
    if (profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackBlock = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement
      }
    }
  } catch {
    // Enhancement
  }

  // Prepend teaching context + framework vocabulary + feedback
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
  const contextPrefix = (frameworkBlock + teachingContextBlock + (feedbackBlock ? "\n\n" + feedbackBlock : "")).trim();
  const ragWithContext = contextPrefix
    ? contextPrefix + "\n\n---\n\n" + (ragContext || "")
    : ragContext || undefined;

  const prompt = buildSkeletonPrompt(input, outline, ragWithContext);
  return { prompt, chunkIds };
}

// =========================================================================
// PER-LESSON GENERATION (Stage 2 — uses skeleton context, runs in parallel)
// =========================================================================

/**
 * Build a prompt for generating activities for a SINGLE LESSON,
 * using the full skeleton as context instead of previousActivitiesSummary.
 */
export function buildPerLessonTimelinePrompt(
  input: LessonJourneyInput,
  lesson: TimelineLessonSkeleton,
  skeleton: TimelineSkeleton,
  options?: {
    ragContext?: string;
    lessonContext?: string;
    activitySummary?: string;
  }
): string {
  const totalLessons = skeleton.lessons.length;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  // Build a compact skeleton context (~50 tokens per lesson)
  const skeletonContext = skeleton.lessons.map((l) =>
    `  L${String(l.lessonNumber).padStart(2, "0")}: "${l.title}" — ${l.keyQuestion} (${l.estimatedMinutes}m, ${l.phaseLabel}) [${l.criterionTags.join(",")}]`
  ).join("\n");

  // Identify neighboring lessons for continuity
  const prevLesson = skeleton.lessons.find((l) => l.lessonNumber === lesson.lessonNumber - 1);
  const nextLesson = skeleton.lessons.find((l) => l.lessonNumber === lesson.lessonNumber + 1);

  let continuitySection = "";
  if (prevLesson) {
    continuitySection += `\nPrevious lesson: "${prevLesson.title}" — ${prevLesson.keyQuestion}`;
  }
  if (nextLesson) {
    continuitySection += `\nNext lesson: "${nextLesson.title}" — ${nextLesson.keyQuestion}`;
  }

  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";

  return `${lessonProfileSection}${ragSection}## Unit Skeleton (all ${totalLessons} lessons)
${skeleton.narrativeArc}

${skeletonContext}

## Generate Activities for Lesson ${lesson.lessonNumber}: "${lesson.title}"
Phase: ${lesson.phaseLabel}
Key Question: ${lesson.keyQuestion}
Target Duration: ${lesson.estimatedMinutes} minutes
Criteria: ${lesson.criterionTags.join(", ")}
Activity Hints: ${lesson.activityHints.join("; ")}
${continuitySection}

## Available Activity Cards
Consider incorporating these where appropriate:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Lesson Length: ${input.lessonLengthMinutes} minutes
- Key Concept: ${input.keyConcept}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes)}

## Generation Target
Generate 3-6 activities totalling approximately ${lesson.estimatedMinutes} minutes.
Include a warmup at the start and a reflection at the end.
Activity IDs should be: L${String(lesson.lessonNumber).padStart(2, "0")}-a1, L${String(lesson.lessonNumber).padStart(2, "0")}-a2, etc.
All activities in this lesson should have phaseLabel: "${lesson.phaseLabel}"

Remember:
- Every activity needs: id, role, title, prompt, durationMinutes
- Core activities need: responseType, criterionTags, scaffolding (ell1/ell2/ell3)
- Content activities: omit responseType. Use contentStyle, media, links where helpful.
- Warmup activities need: vocabTerms
- Reflection activities need: reflectionType, reflectionItems
- Set portfolioCapture: true on 1-2 core activities`;
}

/**
 * Build RAG-enhanced per-lesson prompt.
 */
export async function buildRAGPerLessonPrompt(
  input: LessonJourneyInput,
  lesson: TimelineLessonSkeleton,
  skeleton: TimelineSkeleton,
  teacherId?: string,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched();
  } catch {
    // Fall back to hardcoded
  }

  const query = `${input.topic} ${lesson.title} ${lesson.keyQuestion} ${input.gradeLevel}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 3,
    });
    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement
  }

  // Retrieve lesson profiles + aggregated feedback
  let feedbackContext = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 2,
    });
    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);
      incrementProfileReferences(profileIds).catch(() => {});

      // Close the feedback loop: inject real teaching experience
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackContext = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement, not requirement
      }
    }
  } catch {
    // Enhancement
  }

  // Build teaching context + framework vocabulary
  const teachingContextStr = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkStr = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
  const contextPrefix = (frameworkStr + teachingContextStr).trim();

  // Prepend context to lesson profiles section, include feedback
  const lessonWithFeedback = lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "");
  const enrichedLessonContext = contextPrefix
    ? contextPrefix + (lessonWithFeedback ? "\n\n---\n\n" + lessonWithFeedback : "")
    : lessonWithFeedback || undefined;

  const prompt = buildPerLessonTimelinePrompt(input, lesson, skeleton, {
    ragContext: ragContext || undefined,
    lessonContext: enrichedLessonContext,
    activitySummary,
  });

  return { prompt, chunkIds };
}

// =========================================================================
// FEEDBACK CONTEXT FORMATTING (Layer 2 — inject teaching experience into prompts)
// =========================================================================

import type { AggregatedLessonFeedback } from "@/types/lesson-intelligence";

/**
 * Format aggregated feedback into a prompt block that teaches the AI
 * about real teaching experience with similar content.
 *
 * This is what makes the AI "get smarter over time" — real classroom
 * data feeds back into generation prompts.
 */
export function formatFeedbackContext(
  feedback: AggregatedLessonFeedback[]
): string {
  if (!feedback || feedback.length === 0) return "";

  const entries = feedback.map((f) => {
    const lines: string[] = [];

    lines.push(`### Teaching Experience (taught ${f.times_taught} time${f.times_taught === 1 ? "" : "s"})`);

    if (f.avg_teacher_rating) {
      lines.push(`- Teacher satisfaction: ${f.avg_teacher_rating.toFixed(1)}/5`);
    }

    if (f.avg_actual_duration_minutes) {
      lines.push(`- Actual duration: ~${Math.round(f.avg_actual_duration_minutes)} minutes`);
    }

    if (f.common_went_well?.length > 0) {
      lines.push(`- What worked well: ${f.common_went_well.slice(0, 3).join("; ")}`);
    }

    if (f.common_to_change?.length > 0) {
      lines.push(`- Suggested improvements: ${f.common_to_change.slice(0, 3).join("; ")}`);
    }

    if (f.common_struggles?.length > 0) {
      lines.push(`- Student struggles: ${f.common_struggles.slice(0, 3).join("; ")}`);
    }

    if (f.timing_reality?.length > 0) {
      const timingIssues = f.timing_reality.filter(
        (t) => Math.abs(t.avg_actual_minutes - t.planned_minutes) > 5
      );
      if (timingIssues.length > 0) {
        const timingNotes = timingIssues.map(
          (t) => `"${t.phase_title}": planned ${t.planned_minutes}m, actual ~${Math.round(t.avg_actual_minutes)}m`
        );
        lines.push(`- Timing reality: ${timingNotes.join("; ")}`);
      }
    }

    if (f.best_conditions?.energy_recommendation) {
      lines.push(`- Energy tip: ${f.best_conditions.energy_recommendation}`);
    }

    if (f.pace_distribution) {
      const total = Object.values(f.pace_distribution).reduce((a, b) => a + b, 0);
      if (total > 0) {
        const justRight = f.pace_distribution["just_right"] || 0;
        const pct = Math.round((justRight / total) * 100);
        if (pct < 60) {
          lines.push(`- Pacing concern: only ${pct}% of students felt pace was "just right"`);
        }
      }
    }

    return lines.join("\n");
  });

  return `## Real Teaching Experience
Teachers who taught similar lessons reported the following insights.
Use this to calibrate timing, difficulty, and activity design.

${entries.join("\n\n")}`;
}
