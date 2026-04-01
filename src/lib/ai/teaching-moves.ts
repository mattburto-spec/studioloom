/**
 * Teaching Moves Library — Curated activity patterns for AI generation
 *
 * Expert teachers draw from a mental library of ~50-80 proven activity patterns
 * ("moves") that reliably produce engagement and learning. This library gives
 * the AI the same resource.
 *
 * Integration points:
 *   1. Generation prompts — filtered moves injected as suggestions
 *   2. Pulse repair — specific moves suggested to fix weak dimensions
 *   3. Lesson editor — "Suggested moves" panel (future)
 *   4. Knowledge pipeline — auto-extraction from uploads (future)
 *
 * @see docs/projects/lesson-pulse.md § Teaching Moves Library
 */

// ─── Types ───

export type DesignPhase =
  | "discover"
  | "define"
  | "ideate"
  | "prototype"
  | "test"
  | "any";

export type EnergyLevel = "low" | "medium" | "high";

export type MoveCategory =
  | "ideation"
  | "critique"
  | "research"
  | "making"
  | "reflection"
  | "warmup"
  | "collaboration"
  | "presentation";

export interface TeachingMove {
  /** Unique slug ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** 1-2 sentence description of what happens */
  description: string;
  /** Concrete example of the move in action */
  example: string;
  /** Which design phases this move fits */
  phases: DesignPhase[];
  /** Primary bloom levels this move targets */
  bloomLevels: BloomLevel[];
  /** Best grouping strategies */
  grouping: GroupingStrategy[];
  /** Energy/movement level */
  energy: EnergyLevel;
  /** Activity category */
  category: MoveCategory;
  /** Estimated duration range in minutes [min, max] */
  durationRange: [number, number];
  /** Which Pulse dimensions this move strengthens */
  boosts: PulseDimension[];
  /** Optional: specific sub-scores this move targets */
  boostDetails?: string;
  /** Variations or adaptations */
  variations?: string[];
  /** Prep requirements (empty = no prep) */
  prep?: string;
  /** Unit types this works best with (empty = all) */
  unitTypes?: UnitType[];
}

type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

type GroupingStrategy =
  | "individual"
  | "pair"
  | "small_group"
  | "whole_class"
  | "flexible";

export type PulseDimension =
  | "cognitive_rigour"
  | "student_agency"
  | "teacher_craft";

type UnitType = "design" | "service" | "pp" | "inquiry";

// ─── Retrieval ───

export interface MoveFilter {
  phase?: DesignPhase;
  bloomLevel?: BloomLevel;
  grouping?: GroupingStrategy;
  energy?: EnergyLevel;
  category?: MoveCategory;
  boosts?: PulseDimension;
  unitType?: UnitType;
  maxResults?: number;
}

/**
 * Retrieve teaching moves matching the given filters.
 * Returns moves sorted by relevance (number of matching criteria).
 */
export function getTeachingMoves(filter: MoveFilter = {}): TeachingMove[] {
  let moves = [...TEACHING_MOVES];

  // Hard filters — must match
  if (filter.unitType) {
    moves = moves.filter(
      (m) => !m.unitTypes || m.unitTypes.length === 0 || m.unitTypes.includes(filter.unitType!)
    );
  }

  // Score each move by how many soft criteria it matches
  const scored = moves.map((move) => {
    let score = 0;

    if (filter.phase) {
      if (move.phases.includes(filter.phase) || move.phases.includes("any")) score += 3;
    }
    if (filter.bloomLevel) {
      if (move.bloomLevels.includes(filter.bloomLevel)) score += 2;
    }
    if (filter.grouping) {
      if (move.grouping.includes(filter.grouping)) score += 1;
    }
    if (filter.energy) {
      if (move.energy === filter.energy) score += 1;
    }
    if (filter.category) {
      if (move.category === filter.category) score += 2;
    }
    if (filter.boosts) {
      if (move.boosts.includes(filter.boosts)) score += 3;
    }

    return { move, score };
  });

  // Filter out zero-score matches when filters are provided
  const hasFilters = Object.values(filter).some((v) => v !== undefined && v !== null);
  const filtered = hasFilters ? scored.filter((s) => s.score > 0) : scored;

  // Sort by score descending, then alphabetical for stability
  filtered.sort((a, b) => b.score - a.score || a.move.name.localeCompare(b.move.name));

  const max = filter.maxResults ?? 5;
  return filtered.slice(0, max).map((s) => s.move);
}

/**
 * Format moves for injection into a generation prompt.
 * Returns a compact string suitable for AI consumption (~100-200 tokens for 3-5 moves).
 */
export function formatMovesForPrompt(moves: TeachingMove[]): string {
  if (moves.length === 0) return "";

  const lines = moves.map(
    (m) =>
      `- **${m.name}** (${m.durationRange[0]}-${m.durationRange[1]} min, ${m.grouping[0]}): ${m.description} Example: "${m.example}"`
  );

  return `## Suggested Teaching Moves
Consider incorporating one or more of these proven activity patterns. Don't use them all — pick the one that best fits the lesson's needs. Adapt the move to your specific topic rather than using it verbatim.

${lines.join("\n")}`;
}

/**
 * Get moves specifically targeting a weak Pulse dimension.
 * Used by surgical repair to suggest concrete fixes.
 */
export function getRepairMoves(
  weakDimension: PulseDimension,
  phase?: DesignPhase,
  maxResults = 3
): TeachingMove[] {
  return getTeachingMoves({
    boosts: weakDimension,
    phase,
    maxResults,
  });
}

/**
 * Format repair moves into a repair prompt section.
 */
export function formatRepairMoves(
  weakDimension: PulseDimension,
  moves: TeachingMove[]
): string {
  if (moves.length === 0) return "";

  const dimLabel =
    weakDimension === "cognitive_rigour"
      ? "Cognitive Rigour"
      : weakDimension === "student_agency"
        ? "Student Agency"
        : "Teacher Craft";

  const moveList = moves
    .map((m) => `  - "${m.name}": ${m.description}`)
    .join("\n");

  return `To improve ${dimLabel}, consider replacing or enhancing one Work Time activity with one of these proven teaching moves:
${moveList}`;
}

// ─── Seed Data: ~65 Curated Teaching Moves ───

const TEACHING_MOVES: TeachingMove[] = [
  // ═══════════════════════════════════════════
  // IDEATION MOVES (boost Student Agency + CR)
  // ═══════════════════════════════════════════
  {
    id: "blind-swap",
    name: "Blind Swap",
    description:
      "Students work on an idea for 5 min, then swap papers with someone they can't see (face away, random). They must improve the other person's idea without changing the core concept.",
    example:
      "After initial sketching, students fold their paper in half, pass it to the person behind them, and have 4 minutes to add improvements to the stranger's chair design.",
    phases: ["ideate"],
    bloomLevels: ["evaluate", "create"],
    grouping: ["pair"],
    energy: "medium",
    category: "ideation",
    durationRange: [8, 12],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "Agency: peer contribution. CR: evaluate + create in rapid succession.",
    variations: [
      "Triple swap — idea passes through 3 people",
      "Constraint swap — each person adds a constraint, not a solution",
    ],
  },
  {
    id: "constraint-removal",
    name: "Constraint Removal",
    description:
      "Remove one major constraint from the design brief and brainstorm freely. Then reintroduce the constraint and see which wild ideas can be adapted.",
    example:
      "What if cost didn't matter? What if it could be any size? Students brainstorm without the weight limit, then circle ideas that could work if made lighter.",
    phases: ["ideate"],
    bloomLevels: ["create", "evaluate"],
    grouping: ["individual", "pair"],
    energy: "medium",
    category: "ideation",
    durationRange: [8, 15],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: forces abstract thinking. SA: genuine creative freedom.",
  },
  {
    id: "materials-roulette",
    name: "Materials Roulette",
    description:
      "Each group draws 3 random materials from a bag. They must incorporate all 3 into their design solution. Forces lateral thinking beyond default material choices.",
    example:
      "Group draws 'corrugated cardboard, rubber bands, aluminium foil'. They must use all three in their phone stand prototype.",
    phases: ["ideate", "prototype"],
    bloomLevels: ["create", "apply"],
    grouping: ["small_group"],
    energy: "high",
    category: "making",
    durationRange: [15, 25],
    boosts: ["student_agency", "cognitive_rigour"],
    prep: "Prepare bags with diverse material combinations",
  },
  {
    id: "worst-idea-first",
    name: "Worst Idea First",
    description:
      "Deliberately brainstorm the WORST possible solutions. Then flip each bad idea to find the kernel of a good one. Removes fear of failure and unlocks creative thinking.",
    example:
      "Design the worst possible school bag — too heavy, no pockets, uncomfortable straps. Then flip: what if 'too heavy' means it has wheels? What if 'uncomfortable' leads to an exoskeleton frame?",
    phases: ["ideate"],
    bloomLevels: ["create", "analyze"],
    grouping: ["small_group", "pair"],
    energy: "high",
    category: "ideation",
    durationRange: [10, 15],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "SA: low-stakes creative freedom. CR: inversion is high-order thinking.",
    variations: ["Individual then share", "Competition format — worst idea wins a prize"],
  },
  {
    id: "60-second-pitch",
    name: "60-Second Pitch",
    description:
      "Students have exactly 60 seconds to pitch their idea to a partner. Partner asks ONE question. Rotate 3 times. Forces clarity and identifies weak spots fast.",
    example:
      "After 20 min of ideation, each student stands and pitches their best idea in 60 seconds. Partner asks: 'Who is this for?' or 'How does it actually work?'",
    phases: ["ideate", "define"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["pair"],
    energy: "high",
    category: "presentation",
    durationRange: [8, 12],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "SA: peer feedback + self-selection. CR: synthesis under constraint.",
    variations: ["Elevator pitch (30 seconds)", "Shark Tank format with panel"],
  },
  {
    id: "concept-mashup",
    name: "Concept Mashup",
    description:
      "Combine two unrelated concepts to generate novel ideas. Draw one card from a 'thing' pile and one from a 'quality' pile, then design at the intersection.",
    example:
      "Draw 'umbrella' + 'playful'. Now design a playful umbrella. Draw 'backpack' + 'invisible'. Now reimagine a backpack that's invisible.",
    phases: ["ideate"],
    bloomLevels: ["create"],
    grouping: ["individual", "pair"],
    energy: "medium",
    category: "ideation",
    durationRange: [10, 15],
    boosts: ["cognitive_rigour", "student_agency"],
    prep: "Prepare concept cards (can reuse across units)",
  },
  {
    id: "silent-brainstorm",
    name: "Silent Brainstorm (Brainwriting)",
    description:
      "Everyone writes ideas on sticky notes in silence for 5 min. No talking. Then cluster on a wall. Prevents dominant voices from controlling ideation.",
    example:
      "5 minutes of silent sticky note writing — one idea per note. Post on the board. Then 5 minutes of silent reading and grouping into clusters.",
    phases: ["ideate", "define"],
    bloomLevels: ["create", "analyze"],
    grouping: ["individual"],
    energy: "low",
    category: "ideation",
    durationRange: [8, 15],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: every voice equal. TC: inclusive by design (ELL-friendly, introvert-friendly).",
  },
  {
    id: "rapid-prototype-sprint",
    name: "Rapid Prototype Sprint",
    description:
      "Build a rough prototype in exactly 10 minutes using only paper, tape, and scissors. Speed prevents overthinking and perfectionism.",
    example:
      "You have 10 minutes and these materials: A3 paper, masking tape, scissors, markers. Build a model of your design that you can hold up and explain.",
    phases: ["prototype"],
    bloomLevels: ["create", "apply"],
    grouping: ["individual", "pair"],
    energy: "high",
    category: "making",
    durationRange: [10, 15],
    boosts: ["student_agency", "cognitive_rigour"],
    prep: "Set up material stations",
  },

  // ═══════════════════════════════════════════
  // CRITIQUE MOVES (boost CR + TC)
  // ═══════════════════════════════════════════
  {
    id: "silent-gallery-walk",
    name: "Silent Gallery Walk",
    description:
      "Work is displayed around the room. Students walk silently with sticky notes, leaving written feedback on each piece. No talking until the debrief.",
    example:
      "Pin up all prototypes. 8 min silent walk — leave green stickies for strengths, pink for questions. Then 5 min whole-class debrief: 'What patterns did you notice?'",
    phases: ["test", "prototype"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["individual"],
    energy: "medium",
    category: "critique",
    durationRange: [12, 18],
    boosts: ["cognitive_rigour", "teacher_craft"],
    boostDetails: "CR: evaluation across multiple works. TC: structured, inclusive (written > verbal).",
    variations: [
      "Two Glows & a Grow (2 positives, 1 improvement)",
      "TAG feedback (Tell, Ask, Give)",
    ],
  },
  {
    id: "warm-cool-feedback",
    name: "Warm/Cool Feedback",
    description:
      "Structured peer critique: 'warm' feedback (what's working and why) followed by 'cool' feedback (questions and suggestions). Ron Berger protocol.",
    example:
      "In pairs: 2 min warm ('I notice the hinge mechanism is strong because...'), 2 min cool ('I wonder what happens if the user is left-handed?'), 1 min response.",
    phases: ["test", "prototype", "ideate"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["pair", "small_group"],
    energy: "medium",
    category: "critique",
    durationRange: [8, 15],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: structured evaluation. SA: peer voice matters.",
  },
  {
    id: "failure-museum",
    name: "Failure Museum",
    description:
      "Students display their FAILED prototypes/attempts alongside labels explaining what they learned from each failure. Celebrates iteration over perfection.",
    example:
      "Set up a 'museum' table. Each student places their worst prototype with a card: 'This failed because... I learned that...' Class tours the museum.",
    phases: ["test", "prototype"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["whole_class"],
    energy: "medium",
    category: "reflection",
    durationRange: [10, 15],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: normalizes failure (d=0.52 self-regulation). TC: growth mindset culture.",
    variations: ["Digital failure museum (photos + captions)", "Failure awards ceremony"],
  },
  {
    id: "role-reversal-critique",
    name: "Role Reversal Critique",
    description:
      "Student presents their design AS IF they are the end user, not the designer. Forces empathy and exposes usability issues they'd otherwise miss.",
    example:
      "'Pretend you're a Year 3 student using this pencil case for the first time. Walk us through your morning — where do the pens go? Can you find the eraser quickly?'",
    phases: ["test", "define"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["pair", "small_group"],
    energy: "medium",
    category: "critique",
    durationRange: [8, 12],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: perspective-taking is high-order. SA: empathetic ownership.",
  },
  {
    id: "two-stars-wish",
    name: "Two Stars & a Wish",
    description:
      "Reviewer gives exactly 2 specific strengths ('stars') and 1 improvement suggestion ('wish'). Scaffolded critique that ensures balance.",
    example:
      "Star 1: 'Your joint technique is strong — the finger joints will hold weight.' Star 2: 'The colour scheme matches the brief.' Wish: 'I wish the handle was bigger for small hands.'",
    phases: ["test", "prototype"],
    bloomLevels: ["evaluate"],
    grouping: ["pair"],
    energy: "low",
    category: "critique",
    durationRange: [5, 10],
    boosts: ["cognitive_rigour", "teacher_craft"],
    boostDetails: "CR: specific evaluation. TC: scaffolded and ELL-friendly.",
  },

  // ═══════════════════════════════════════════
  // RESEARCH MOVES (boost CR)
  // ═══════════════════════════════════════════
  {
    id: "expert-interview-sim",
    name: "Expert Interview Simulation",
    description:
      "Half the class researches a topic and becomes 'experts'. The other half interviews them with prepared questions. Then swap roles with a different topic.",
    example:
      "Group A researches ergonomic seating for 10 min. Group B prepares interview questions. Then B interviews A for 8 min. Swap with 'sustainable materials'.",
    phases: ["discover"],
    bloomLevels: ["analyze", "evaluate"],
    grouping: ["pair"],
    energy: "medium",
    category: "research",
    durationRange: [15, 25],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: analysis + synthesis. SA: student-generated knowledge.",
    variations: ["Hot seat — one expert, whole class asks", "Panel format with 3 experts"],
  },
  {
    id: "product-autopsy",
    name: "Product Autopsy",
    description:
      "Physically disassemble an existing product to understand how it works. Sketch the internal structure. Identify materials, joining techniques, and design decisions.",
    example:
      "Each pair gets a broken toaster/phone case/toy. Carefully take it apart. Sketch and label every component. Answer: 'Why did the designer choose THIS material for THIS part?'",
    phases: ["discover", "define"],
    bloomLevels: ["analyze", "evaluate"],
    grouping: ["pair", "small_group"],
    energy: "high",
    category: "research",
    durationRange: [15, 25],
    boosts: ["cognitive_rigour"],
    boostDetails: "CR: authentic analysis of real artefacts.",
    prep: "Collect broken/cheap products for disassembly",
    unitTypes: ["design"],
  },
  {
    id: "user-shadowing",
    name: "User Shadowing (10-Minute Version)",
    description:
      "Students observe a real user performing a task for 10 min, noting pain points and workarounds. No talking — just watching and noting.",
    example:
      "Observe a Year 3 student organising their desk for 10 min. Note: What takes the longest? What falls? What do they search for? What do they ignore?",
    phases: ["discover"],
    bloomLevels: ["analyze"],
    grouping: ["individual", "pair"],
    energy: "low",
    category: "research",
    durationRange: [10, 15],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: observational analysis. SA: primary research skill.",
  },
  {
    id: "5-whys",
    name: "5 Whys Root Cause",
    description:
      "Ask 'Why?' five times in succession to move from surface observations to root causes. Forces depth over breadth in problem analysis.",
    example:
      "'The cafeteria queue is slow.' Why? 'People can't decide.' Why? 'The menu is confusing.' Why? 'It has 40 options.' Why? 'They've never removed old items.' Root cause: menu curation system needed.",
    phases: ["define"],
    bloomLevels: ["analyze"],
    grouping: ["pair", "small_group"],
    energy: "low",
    category: "research",
    durationRange: [8, 12],
    boosts: ["cognitive_rigour"],
    boostDetails: "CR: causal chain analysis (high-order).",
  },
  {
    id: "stakeholder-speed-dating",
    name: "Stakeholder Speed Dating",
    description:
      "Students role-play different stakeholders (user, manufacturer, shop owner, environmentalist). 3 min per 'date' — ask questions from your stakeholder's perspective.",
    example:
      "Assign roles: parent, child, teacher, janitor. Each has 3 min to ask questions about the proposed playground redesign from their perspective. Rotate 4 times.",
    phases: ["discover", "define"],
    bloomLevels: ["analyze", "evaluate"],
    grouping: ["pair"],
    energy: "high",
    category: "research",
    durationRange: [12, 20],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "SA: role-play = agency. CR: multiple perspectives = evaluation.",
  },

  // ═══════════════════════════════════════════
  // MAKING MOVES (boost SA + TC)
  // ═══════════════════════════════════════════
  {
    id: "progressive-constraints",
    name: "Progressive Constraints",
    description:
      "Start with total freedom, then add one constraint every 5 minutes. Each constraint forces adaptation and creative problem-solving.",
    example:
      "Build anything from cardboard. (5 min) Now: it must be taller than 30cm. (5 min) Now: it must hold a tennis ball. (5 min) Now: it must use only 2 joins.",
    phases: ["prototype"],
    bloomLevels: ["create", "apply"],
    grouping: ["individual", "pair"],
    energy: "high",
    category: "making",
    durationRange: [15, 25],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "SA: freedom within structure. CR: adaptation under constraint.",
  },
  {
    id: "parallel-prototypes",
    name: "Parallel Prototypes",
    description:
      "Build 3 different prototypes of the same idea simultaneously (different materials, scales, or approaches). Compare at the end. Prevents premature commitment.",
    example:
      "Make your phone stand in 3 versions: one from cardboard, one from wire, one from clay. You have 15 min. Then test all three — which works best and why?",
    phases: ["prototype"],
    bloomLevels: ["create", "evaluate"],
    grouping: ["individual"],
    energy: "high",
    category: "making",
    durationRange: [15, 25],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: comparison requires evaluation. SA: student chooses winner.",
  },
  {
    id: "skill-station-rotation",
    name: "Skill Station Rotation",
    description:
      "Set up 4-5 skill stations around the room. Students rotate every 8-10 minutes, practicing one technique per station. Build competence before the main project.",
    example:
      "Station 1: Measuring and marking. Station 2: Joining techniques. Station 3: Finishing/sanding. Station 4: Safety quiz. Station 5: Material testing. Rotate every 8 min.",
    phases: ["prototype"],
    bloomLevels: ["apply", "understand"],
    grouping: ["small_group"],
    energy: "high",
    category: "making",
    durationRange: [25, 40],
    boosts: ["teacher_craft"],
    boostDetails: "TC: differentiated by station, varied grouping, structured flow.",
    prep: "Set up 4-5 physical stations with materials",
    unitTypes: ["design"],
  },
  {
    id: "testing-olympics",
    name: "Testing Olympics",
    description:
      "Multiple standardized tests for prototypes: drop test, weight test, user test, aesthetics vote. Score card for each. Makes testing systematic and fun.",
    example:
      "Bridge Testing Olympics: Event 1 — how much weight before collapse? Event 2 — aesthetics vote (class poll). Event 3 — span test. Event 4 — material efficiency (weight:strength ratio).",
    phases: ["test"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["whole_class", "small_group"],
    energy: "high",
    category: "making",
    durationRange: [15, 25],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: multi-criteria evaluation. SA: competitive engagement.",
    unitTypes: ["design"],
  },
  {
    id: "reverse-engineering",
    name: "Reverse Engineering Challenge",
    description:
      "Give students a finished product and ask them to figure out how to make it. They must document the manufacturing process without instructions.",
    example:
      "Here's a finished wooden box with dovetail joints. Your task: figure out the order of operations. What was cut first? What was assembled first? Draw the process as a flowchart.",
    phases: ["discover", "prototype"],
    bloomLevels: ["analyze", "evaluate"],
    grouping: ["pair", "small_group"],
    energy: "medium",
    category: "making",
    durationRange: [15, 20],
    boosts: ["cognitive_rigour"],
    unitTypes: ["design"],
  },

  // ═══════════════════════════════════════════
  // REFLECTION MOVES (boost SA + TC)
  // ═══════════════════════════════════════════
  {
    id: "one-word-whip",
    name: "One-Word Whip-Around",
    description:
      "Every student says ONE word that captures their feeling about today's work. No explanations. Fast, inclusive, gives teacher instant pulse check.",
    example:
      "Before you pack up: one word — how did today go? Go around the room. 'Frustrated.' 'Proud.' 'Confused.' 'Excited.' 'Stuck.'",
    phases: ["any"],
    bloomLevels: ["evaluate"],
    grouping: ["whole_class"],
    energy: "low",
    category: "reflection",
    durationRange: [2, 5],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: every voice heard. TC: instant formative assessment.",
  },
  {
    id: "exit-ticket-3-2-1",
    name: "Exit Ticket: 3-2-1",
    description:
      "3 things you learned, 2 things you found interesting, 1 question you still have. Classic structured reflection that surfaces gaps.",
    example:
      "On a sticky note: 3 things you learned about sustainable materials, 2 things that surprised you, 1 question for next lesson. Hand to teacher on the way out.",
    phases: ["any"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["individual"],
    energy: "low",
    category: "reflection",
    durationRange: [3, 5],
    boosts: ["cognitive_rigour", "teacher_craft"],
    boostDetails: "CR: metacognition. TC: feeds next lesson planning.",
  },
  {
    id: "process-timeline",
    name: "Process Timeline",
    description:
      "Students draw a timeline of their design process so far, marking decision points, pivots, and 'aha' moments. Visual metacognition.",
    example:
      "Draw your design journey as a path. Mark: where you started, where you got stuck, where you changed direction, and where you are now. Add a note at each turn: why did you pivot?",
    phases: ["test", "prototype"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["individual"],
    energy: "low",
    category: "reflection",
    durationRange: [8, 12],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "SA: ownership of process. CR: metacognitive analysis.",
  },
  {
    id: "if-i-started-again",
    name: "If I Started Again",
    description:
      "Students write or present what they would do differently if they started the project from scratch. Powerful reflection that demonstrates growth.",
    example:
      "'If I started this project again, I would: (1) spend more time on research because I didn't understand the user well enough, (2) test earlier because my first prototype was too finished to change.'",
    phases: ["test"],
    bloomLevels: ["evaluate"],
    grouping: ["individual", "pair"],
    energy: "low",
    category: "reflection",
    durationRange: [5, 10],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: evaluation of own process. SA: self-direction for next time.",
  },
  {
    id: "peer-teach-back",
    name: "Peer Teach-Back",
    description:
      "Students teach a concept or technique they just learned to a partner who missed it (or pretends to be new). Teaching = deepest learning.",
    example:
      "You just learned how to use the scroll saw safely. Now teach your partner — they have to be able to pass the safety quiz based ONLY on what you taught them.",
    phases: ["any"],
    bloomLevels: ["evaluate", "create"],
    grouping: ["pair"],
    energy: "medium",
    category: "reflection",
    durationRange: [5, 10],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: teaching requires synthesis (d=0.74). SA: student as expert.",
  },

  // ═══════════════════════════════════════════
  // WARMUP MOVES (boost TC)
  // ═══════════════════════════════════════════
  {
    id: "design-challenge-30sec",
    name: "30-Second Design Challenge",
    description:
      "Sketch a solution to a silly design problem in 30 seconds. Repeat 3 times with different problems. Warms up creative muscles and lowers perfectionism.",
    example:
      "Round 1: Design a hat for a giraffe. (30 sec) Round 2: Design a door for a submarine. (30 sec) Round 3: Design a chair for a ghost. (30 sec). Share your favourite with a partner.",
    phases: ["ideate"],
    bloomLevels: ["create"],
    grouping: ["individual"],
    energy: "medium",
    category: "warmup",
    durationRange: [3, 5],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: creative freedom. TC: inclusive warm-up, sets creative tone.",
  },
  {
    id: "odd-one-out",
    name: "Odd One Out",
    description:
      "Show 4 images/objects. Students identify which is the 'odd one out' and explain their reasoning. Works for materials, products, techniques — any domain.",
    example:
      "Show 4 chairs: stacking chair, beanbag, office chair, stool. Which is the odd one out? There's no right answer — the reasoning is the point.",
    phases: ["discover", "define"],
    bloomLevels: ["analyze"],
    grouping: ["pair", "whole_class"],
    energy: "low",
    category: "warmup",
    durationRange: [3, 5],
    boosts: ["cognitive_rigour", "teacher_craft"],
    boostDetails: "CR: classification + justification. TC: low-stakes entry point.",
    prep: "Prepare 4 images/objects",
  },
  {
    id: "what-if-machine",
    name: "What If Machine",
    description:
      "Teacher poses a 'What if?' question related to the topic. Students have 2 min to discuss in pairs, then share the most interesting idea.",
    example:
      "'What if chairs couldn't have legs?' Discuss for 2 min. Best ideas: hanging from ceiling, magnetic levitation, built into the floor.",
    phases: ["ideate", "discover"],
    bloomLevels: ["create", "analyze"],
    grouping: ["pair"],
    energy: "medium",
    category: "warmup",
    durationRange: [3, 5],
    boosts: ["cognitive_rigour", "student_agency"],
  },
  {
    id: "vocab-charades",
    name: "Vocab Charades",
    description:
      "Students act out technical vocabulary terms without speaking. Class guesses. Makes abstract terms concrete and memorable.",
    example:
      "Act out: 'ergonomic', 'biodegradable', 'prototype', 'iteration'. No words, no pointing at objects. Other students guess and explain the term.",
    phases: ["any"],
    bloomLevels: ["remember", "understand"],
    grouping: ["whole_class"],
    energy: "high",
    category: "warmup",
    durationRange: [5, 8],
    boosts: ["teacher_craft"],
    boostDetails: "TC: kinaesthetic learning, ELL-friendly, differentiated recall.",
  },
  {
    id: "mystery-material",
    name: "Mystery Material",
    description:
      "Pass around an unknown material. Students must identify its properties by touch, weight, flexibility, and appearance. Then guess what it's used for.",
    example:
      "Pass around a piece of kevlar fabric without naming it. Feel, stretch, try to tear, weigh. Properties: strong, lightweight, flexible, woven. What could this be used for? (Body armour, sails, tyres)",
    phases: ["discover"],
    bloomLevels: ["analyze", "understand"],
    grouping: ["whole_class", "small_group"],
    energy: "medium",
    category: "warmup",
    durationRange: [5, 8],
    boosts: ["cognitive_rigour", "teacher_craft"],
    prep: "Source an interesting material sample",
    unitTypes: ["design"],
  },

  // ═══════════════════════════════════════════
  // COLLABORATION MOVES (boost SA + TC)
  // ═══════════════════════════════════════════
  {
    id: "think-pair-share",
    name: "Think-Pair-Share",
    description:
      "Individual thinking (1 min) → pair discussion (2 min) → share with class (2 min). Classic but effective. Ensures every student processes the question before hearing others.",
    example:
      "'How could you make this design more sustainable?' Think alone for 1 min. Discuss with your partner for 2 min. Share your best idea with the class.",
    phases: ["any"],
    bloomLevels: ["analyze", "evaluate"],
    grouping: ["pair"],
    energy: "low",
    category: "collaboration",
    durationRange: [5, 8],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: individual thinking time protected. TC: inclusive structure.",
  },
  {
    id: "jigsaw-expert-groups",
    name: "Jigsaw Expert Groups",
    description:
      "Divide content into 4 chunks. Each group becomes expert in 1 chunk, then reforms into mixed groups where each expert teaches their piece.",
    example:
      "4 joining techniques: Group A learns butt joints, Group B mitre joints, Group C dovetails, Group D pocket screws. Then regroup: each new team has one expert per technique.",
    phases: ["discover"],
    bloomLevels: ["understand", "evaluate"],
    grouping: ["small_group"],
    energy: "medium",
    category: "collaboration",
    durationRange: [20, 30],
    boosts: ["teacher_craft", "student_agency"],
    boostDetails: "TC: structured differentiation. SA: student as teacher (d=0.74).",
  },
  {
    id: "design-sprint",
    name: "Mini Design Sprint",
    description:
      "Compressed version of Google Ventures' design sprint: Understand (5 min) → Sketch (5 min) → Decide (3 min) → Prototype (10 min) → Test (5 min).",
    example:
      "In 30 minutes, your team will: understand the brief, sketch 3 solutions each, vote on the best, build a paper prototype, test with another team.",
    phases: ["ideate", "prototype"],
    bloomLevels: ["create", "evaluate"],
    grouping: ["small_group"],
    energy: "high",
    category: "collaboration",
    durationRange: [25, 35],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "SA: team decision-making. CR: full cycle in compressed time.",
  },
  {
    id: "world-cafe",
    name: "World Café",
    description:
      "3-4 discussion tables with different questions. Groups rotate every 8 min. A 'table host' stays to brief incoming groups on previous insights.",
    example:
      "Table 1: 'Who is our user?' Table 2: 'What are the constraints?' Table 3: 'What exists already?' Table 4: 'What's the real problem?' Rotate every 8 min. Hosts summarise.",
    phases: ["discover", "define"],
    bloomLevels: ["analyze", "evaluate"],
    grouping: ["small_group"],
    energy: "medium",
    category: "collaboration",
    durationRange: [20, 35],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "SA: student-led facilitation. CR: builds on previous group's thinking.",
    prep: "Set up 3-4 tables with flipchart paper and question prompts",
  },
  {
    id: "pair-programming-design",
    name: "Pair Design (Driver/Navigator)",
    description:
      "One student draws/builds (driver), the other gives verbal instructions only (navigator). Swap roles every 5 min. Prevents one person dominating.",
    example:
      "Navigator: 'Draw a circle for the base, about 5cm diameter. Now add a vertical line up from center...' Driver sketches only what's described. Swap after 5 min.",
    phases: ["prototype", "ideate"],
    bloomLevels: ["create", "apply"],
    grouping: ["pair"],
    energy: "medium",
    category: "collaboration",
    durationRange: [10, 15],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: both roles have agency. TC: structured pair work, ELL-friendly (listening).",
  },

  // ═══════════════════════════════════════════
  // SERVICE/PP-SPECIFIC MOVES
  // ═══════════════════════════════════════════
  {
    id: "community-mapping",
    name: "Community Mapping",
    description:
      "Students create a visual map of their community, identifying needs, assets, and connections. Can be physical (walking tour) or digital.",
    example:
      "Walk around the school campus for 15 min. Map: What's broken? What's missing? What works well? Who uses each space? Mark with red (need), green (asset), yellow (opportunity).",
    phases: ["discover"],
    bloomLevels: ["analyze"],
    grouping: ["small_group"],
    energy: "high",
    category: "research",
    durationRange: [15, 30],
    boosts: ["student_agency", "cognitive_rigour"],
    unitTypes: ["service", "pp"],
  },
  {
    id: "empathy-immersion",
    name: "Empathy Immersion",
    description:
      "Simulate the user's experience. Wear gloves to experience arthritis. Use a wheelchair for 10 min. Block one ear to simulate hearing loss. Direct experience > reading about it.",
    example:
      "Wear thick gardening gloves and try to: open a jar, type a message, button a shirt. How does this change your understanding of product design for elderly users?",
    phases: ["discover", "define"],
    bloomLevels: ["analyze", "evaluate"],
    grouping: ["individual", "pair"],
    energy: "medium",
    category: "research",
    durationRange: [10, 20],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: experiential analysis. SA: personal connection to user needs.",
    prep: "Prepare simulation materials (gloves, blindfolds, etc.)",
  },
  {
    id: "impact-mapping",
    name: "Impact Mapping",
    description:
      "For service/PP projects: map the ripple effects of your action. Primary impact → Secondary impact → Systemic change. Forces students to think beyond immediate results.",
    example:
      "Your project: cleaning up the river. Primary: cleaner water. Secondary: more fish, safer swimming. Systemic: community pride, local council attention, ongoing maintenance culture.",
    phases: ["define", "test"],
    bloomLevels: ["evaluate", "analyze"],
    grouping: ["pair", "small_group"],
    energy: "low",
    category: "reflection",
    durationRange: [10, 15],
    boosts: ["cognitive_rigour"],
    unitTypes: ["service", "pp"],
  },
  {
    id: "action-plan-backwards",
    name: "Backwards Action Plan",
    description:
      "Start with the end goal (presentation day, community event, final product) and work backwards to today. What needs to happen the week before? The month before? This week?",
    example:
      "Presentation is June 1. Work backwards: May 25 = rehearsal. May 18 = final edits. May 11 = first draft. May 4 = research complete. Today (April 1) = choose topic and find 3 sources.",
    phases: ["define"],
    bloomLevels: ["apply", "analyze"],
    grouping: ["individual", "pair"],
    energy: "low",
    category: "collaboration",
    durationRange: [10, 15],
    boosts: ["student_agency"],
    boostDetails: "SA: student-owned planning, goal-setting.",
    unitTypes: ["service", "pp"],
  },

  // ═══════════════════════════════════════════
  // HIGH-ENERGY / MOVEMENT BREAKS
  // ═══════════════════════════════════════════
  {
    id: "gallery-vote",
    name: "Gallery Vote (Dot Democracy)",
    description:
      "Post all ideas on the wall. Each student gets 3 dot stickers to vote. Can spread votes or stack them. Quick democratic prioritisation with movement.",
    example:
      "Pin all 12 design concepts on the board. Everyone gets 3 green dots. Place them on the ideas you think we should develop further. Most dots = next steps.",
    phases: ["ideate", "define"],
    bloomLevels: ["evaluate"],
    grouping: ["whole_class"],
    energy: "high",
    category: "ideation",
    durationRange: [5, 10],
    boosts: ["student_agency"],
    boostDetails: "SA: democratic decision-making.",
    prep: "Dot stickers or markers",
  },
  {
    id: "speed-networking",
    name: "Speed Networking",
    description:
      "Students form two circles (inner and outer). Inner rotates every 2 min. Each pair shares one thing about their project. Fast, social, energising.",
    example:
      "Inner circle describes their design problem. Outer circle suggests one material. Rotate. Now inner describes their user. Outer suggests one constraint to consider. Rotate.",
    phases: ["ideate", "discover"],
    bloomLevels: ["understand", "apply"],
    grouping: ["pair"],
    energy: "high",
    category: "collaboration",
    durationRange: [8, 12],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: social learning. TC: movement break + content integration.",
  },
  {
    id: "material-scavenger-hunt",
    name: "Material Scavenger Hunt",
    description:
      "Give teams a list of material properties (flexible, transparent, waterproof, rigid). They have 5 min to find examples around the room/school. First team with all properties wins.",
    example:
      "Find something: flexible + strong, rigid + lightweight, transparent + waterproof, natural + decorative. Take a photo of each. 5 minutes. Go!",
    phases: ["discover"],
    bloomLevels: ["understand", "apply"],
    grouping: ["small_group"],
    energy: "high",
    category: "warmup",
    durationRange: [5, 10],
    boosts: ["teacher_craft"],
    boostDetails: "TC: kinaesthetic learning, differentiated by team composition.",
    unitTypes: ["design"],
  },

  // ═══════════════════════════════════════════
  // PRESENTATION MOVES (boost SA + CR)
  // ═══════════════════════════════════════════
  {
    id: "pecha-kucha",
    name: "Pecha Kucha (20×20)",
    description:
      "Present using exactly 20 slides, each shown for exactly 20 seconds. Auto-advancing slides force concise storytelling. Adapted: 6 slides × 30 seconds for younger students.",
    example:
      "6 slides, 30 seconds each. Slide 1: The problem. Slide 2: My user. Slide 3: My idea. Slide 4: How I made it. Slide 5: How I tested it. Slide 6: What I'd change.",
    phases: ["test"],
    bloomLevels: ["evaluate", "create"],
    grouping: ["individual"],
    energy: "medium",
    category: "presentation",
    durationRange: [5, 8],
    boosts: ["student_agency", "cognitive_rigour"],
    boostDetails: "SA: personal narrative. CR: synthesis under time constraint.",
  },
  {
    id: "museum-exhibit",
    name: "Museum Exhibit",
    description:
      "Students set up their work as a museum exhibit with a label card, process photos, and interactive element. Visitors walk through and leave feedback.",
    example:
      "Set up your exhibit: product on display, label card (title, designer, materials, inspiration), process photos, one question for visitors to answer on a sticky note.",
    phases: ["test"],
    bloomLevels: ["evaluate", "create"],
    grouping: ["individual"],
    energy: "medium",
    category: "presentation",
    durationRange: [15, 25],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: ownership of display. TC: inclusive assessment format.",
  },

  // ═══════════════════════════════════════════
  // DIFFERENTIATION / SCAFFOLDING MOVES
  // ═══════════════════════════════════════════
  {
    id: "choice-board",
    name: "Choice Board",
    description:
      "3×3 grid of activities at different levels/modalities. Students choose their path. Tic-tac-toe rule: must complete a line of 3 (ensures variety).",
    example:
      "Row 1: Sketch, Write, Photograph. Row 2: Build, Present, Discuss. Row 3: Research, Annotate, Film. Do any 3 in a line — horizontal, vertical, or diagonal.",
    phases: ["any"],
    bloomLevels: ["apply", "create", "analyze"],
    grouping: ["individual"],
    energy: "medium",
    category: "making",
    durationRange: [20, 35],
    boosts: ["student_agency", "teacher_craft"],
    boostDetails: "SA: genuine choice. TC: built-in differentiation (modality, complexity).",
  },
  {
    id: "scaffolded-challenge",
    name: "Scaffolded Challenge (Must/Should/Could)",
    description:
      "Three-tier task: Must (everyone completes), Should (most will reach), Could (extension for fast finishers). All tiers visible — students self-select upward.",
    example:
      "Must: build a bridge that spans 20cm. Should: bridge holds a 200g weight. Could: bridge uses the least material possible (weight:strength ratio). Track which tier you reached.",
    phases: ["prototype", "test"],
    bloomLevels: ["apply", "evaluate", "create"],
    grouping: ["individual"],
    energy: "medium",
    category: "making",
    durationRange: [15, 30],
    boosts: ["teacher_craft", "student_agency"],
    boostDetails: "TC: differentiation by outcome. SA: self-directed challenge level.",
  },
  {
    id: "anchor-chart",
    name: "Anchor Chart Co-Creation",
    description:
      "Teacher and students build a reference chart together on the board. Students contribute examples, the teacher organises. Chart stays visible all unit.",
    example:
      "Create an anchor chart for 'Properties of Materials'. Left column: property name. Middle: definition (students suggest). Right: example from our project (students contribute). Stays on the wall.",
    phases: ["discover"],
    bloomLevels: ["understand", "remember"],
    grouping: ["whole_class"],
    energy: "low",
    category: "collaboration",
    durationRange: [8, 12],
    boosts: ["teacher_craft"],
    boostDetails: "TC: scaffolded reference, ELL-friendly visual, classroom management tool.",
  },
  {
    id: "sentence-starters-wall",
    name: "Sentence Starters Wall",
    description:
      "Display sentence starters relevant to the current phase on the classroom wall. Students can reference them during discussions and written work. Swap them each phase.",
    example:
      "Ideation starters: 'What if we...' / 'Building on that...' / 'A completely different approach...' Evaluation starters: 'The strength of this is...' / 'This might fail because...' / 'Compared to option B...'",
    phases: ["any"],
    bloomLevels: ["understand", "apply"],
    grouping: ["individual"],
    energy: "low",
    category: "warmup",
    durationRange: [2, 3],
    boosts: ["teacher_craft"],
    boostDetails: "TC: ELL scaffold, UDL 5.1 (language/symbols).",
    prep: "Print or write phase-specific sentence starter cards",
  },

  // ═══════════════════════════════════════════
  // INQUIRY-SPECIFIC MOVES
  // ═══════════════════════════════════════════
  {
    id: "provocation",
    name: "Provocation",
    description:
      "Show an image, object, or statement designed to provoke questions and wonder. Students generate as many questions as possible without answering them first.",
    example:
      "Show a photo of a landfill next to a luxury shopping mall. 3 minutes: write as many questions as this image raises. No answers yet — just questions. Sort into 'researchable' and 'philosophical'.",
    phases: ["discover"],
    bloomLevels: ["analyze"],
    grouping: ["individual", "pair"],
    energy: "low",
    category: "research",
    durationRange: [5, 10],
    boosts: ["cognitive_rigour", "student_agency"],
    boostDetails: "CR: question generation is high-order. SA: student-directed inquiry.",
    unitTypes: ["inquiry", "service"],
  },
  {
    id: "visible-thinking-see-think-wonder",
    name: "See-Think-Wonder",
    description:
      "Harvard Project Zero routine. Students observe: What do I SEE? (facts) What do I THINK is going on? (interpretation) What does it make me WONDER? (questions)",
    example:
      "Look at this bridge that collapsed. See: steel beams, broken supports, cars on top. Think: the supports weren't strong enough for the weight. Wonder: how do engineers calculate load limits?",
    phases: ["discover", "define"],
    bloomLevels: ["analyze", "evaluate"],
    grouping: ["individual", "pair"],
    energy: "low",
    category: "research",
    durationRange: [8, 12],
    boosts: ["cognitive_rigour"],
    boostDetails: "CR: separates observation from interpretation — high-order thinking.",
    unitTypes: ["inquiry", "design"],
  },

  // ═══════════════════════════════════════════
  // DIGITAL / DOCUMENTATION MOVES
  // ═══════════════════════════════════════════
  {
    id: "time-lapse-process",
    name: "Time-Lapse Process Doc",
    description:
      "Set up a phone to take photos every 30 seconds during making. Review the time-lapse at the end — students annotate key moments for their portfolio.",
    example:
      "Prop your phone against your pencil case, set timer to 30-second intervals. Make your prototype. At the end, pick 5 key frames and write what was happening in each.",
    phases: ["prototype"],
    bloomLevels: ["evaluate"],
    grouping: ["individual"],
    energy: "low",
    category: "reflection",
    durationRange: [3, 5],
    boosts: ["student_agency"],
    boostDetails: "SA: student-curated evidence.",
  },
  {
    id: "annotated-sketch",
    name: "Annotated Sketch Explosion",
    description:
      "Sketch your design with annotation lines pointing to every feature. Each annotation must answer: What is it? What material? Why this choice?",
    example:
      "Draw your phone stand. Add at least 8 annotation arrows. Each one: 'Base — MDF — chosen because it's heavy enough to prevent tipping' / 'Groove — 6mm wide — fits most phone cases'.",
    phases: ["prototype", "define"],
    bloomLevels: ["analyze", "apply"],
    grouping: ["individual"],
    energy: "low",
    category: "making",
    durationRange: [10, 15],
    boosts: ["cognitive_rigour"],
    boostDetails: "CR: justification of every design decision.",
  },
];

export { TEACHING_MOVES };
