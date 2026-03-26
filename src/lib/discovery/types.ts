/**
 * Discovery Engine — Core Type Definitions
 *
 * The DiscoveryProfile is the single data structure that every station
 * reads from and writes to. It's the student's self-portrait built
 * through 8 stations of varied interactions.
 *
 * @see docs/specs/discovery-engine-build-plan.md (master spec)
 * @see docs/specs/discovery-engine-spec.md (data model details)
 */

// ─── Design Archetypes ───────────────────────────────────────────

export type DesignArchetype =
  | 'Maker'
  | 'Researcher'
  | 'Leader'
  | 'Communicator'
  | 'Creative'
  | 'Systems';

export const ALL_ARCHETYPES: DesignArchetype[] = [
  'Maker', 'Researcher', 'Leader', 'Communicator', 'Creative', 'Systems',
];

// ─── Working Style ───────────────────────────────────────────────

export interface WorkingStyleVector {
  planning: 'planner' | 'improviser';
  social: 'collaborative' | 'independent';
  structure: 'structured' | 'flexible';
  energy: 'deep_focus' | 'burst';
  decision: 'gut' | 'analytical';
  risk: 'risk_taker' | 'reliable';
  pace: 'slow_build' | 'fast_start';
  feedback: 'specific' | 'big_picture';
  scope: 'depth' | 'breadth';
  expression: 'visual' | 'verbal';
  learning_intake: 'study' | 'experiment';
  learning_source: 'example' | 'concept';
  // Learning condition pairs (research: self-regulation d=0.52, emotion regulation d=0.53)
  autonomy: 'self_directed' | 'guided';
  stress_response: 'push_through' | 'step_back';
}

export type WorkingStyleDimension = keyof WorkingStyleVector;

export type DominantStyle = 'planner' | 'doer' | 'explorer' | 'balanced';

// ─── Age Bands ───────────────────────────────────────────────────

export type AgeBand = 'junior' | 'senior' | 'extended';

// ─── Station Data Types ──────────────────────────────────────────

/** S0: Design Identity Card */
export interface Station0Data {
  palette: string | null;          // e.g. 'warm', 'cool', 'bold', 'earth', 'neon'
  tools: string[];                 // exactly 3 tool IDs
  workspaceItems: string[];        // exactly 4 workspace item IDs
}

/** S1: The Campfire — Quick-Fire Binary Pairs */
export interface Station1Data {
  dimensions: Record<WorkingStyleDimension, 'a' | 'b'>;
  workingStyle: WorkingStyleVector | null;
  dominantStyle: DominantStyle | null;
  kitReflection: string | null;    // Kit's reflection on the quick-fire results
}

/** S2: The Workshop — Archetype Scenarios */
export interface Station2Data {
  panicResponse: string | null;                    // Text prompt #1 — free text
  panicResponseAiAnalysis: PanicResponseAnalysis | null;
  scenarioChoices: Record<string, string>;         // scenario_id → chosen option_id
  peopleIcons: string[];                           // 2-3 selected "people come to you for" icons
  archetypeReveal: ArchetypeRevealData | null;
}

export interface PanicResponseAnalysis {
  archetype_signals: Record<DesignArchetype, number>;
  action_orientation: 'high' | 'medium' | 'low';
  specificity: 'high' | 'medium' | 'low';
  kit_response: string;
}

export interface ArchetypeRevealData {
  primary: DesignArchetype;
  secondary: DesignArchetype | null;
  isPolymath: boolean;
  scores: Record<DesignArchetype, number>;
}

/** S3: The Collection Wall — Interests & Values */
export interface Station3Data {
  interests: string[];                              // 5-7 selected interest icon IDs
  irritationPresets: string[];                      // selected preset irritation IDs
  irritationFreeText: string | null;                // student's own irritation (highest signal)
  irritationAiAnalysis: IrritationAnalysis | null;
  youtubeTopics: string[];                          // selected YouTube topic IDs
  valuesRanking: ValuesRanking;                     // 3-tier values sort
}

export interface IrritationAnalysis {
  problem_domain: string;
  emotional_intensity: 'low' | 'medium' | 'high';
  scope: 'personal' | 'school' | 'community' | 'global';
  archetype_signals: Record<DesignArchetype, number>;
  interest_signals: string[];
  kit_response: string;
  summary_tag: string;
}

export interface ValuesRanking {
  core: string[];       // top tier
  important: string[];  // middle tier
  nice: string[];       // bottom tier
}

/** S4: The Window — Problems & Needs */
export interface Station4Data {
  sceneClicks: string[];           // clicked hotspot IDs (2+ required)
  zoomChoice: string | null;       // the one they narrowed down to
  sliders: {
    scale: number;     // 0-100: personal ↔ global
    urgency: number;   // 0-100: low ↔ critical
    proximity: number; // 0-100: distant ↔ personal
  };
  problemText: string | null;      // Text prompt #2 — "What shouldn't be this hard?"
  problemAiAnalysis: ProblemAnalysis | null;
}

export interface ProblemAnalysis {
  problem_domain: string;
  specificity: 'high' | 'medium' | 'low';
  empathy_target: string;
  actionability: 'high' | 'medium' | 'low';
  kit_response: string;
}

/** S5: The Toolkit — Resources & Constraints */
export interface Station5Data {
  timeHoursPerWeek: number | null;     // 1-15 slider
  resources: ResourceSort;
  peopleIcons: string[];               // selected relationship icons
  selfEfficacy: Record<string, number>;  // domain → 0-100
  pastProjectCount: string | null;     // 'none' | '1-2' | '3-5' | '6+'
  lastProjectOutcome: string | null;   // 'completed' | 'scaled_back' | 'abandoned' | 'ongoing'
  failureResponse: string | null;      // chosen option ID
  audience: string | null;             // 'classmates' | 'school' | 'community' | 'online' | 'specific_person'
  timeHorizon: string | null;          // 'weeks_2_4' | 'term' | 'semester' | 'year'
}

export interface ResourceSort {
  have: string[];
  canGet: string[];
  dontHave: string[];
}

/** S6: The Crossroads — Doors & Direction */
export interface Station6Data {
  doors: TemplateDoor[];               // 3 AI-generated doors
  doorExplorations: Record<number, DoorExploration>;  // index → exploration
  customDoor: string | null;           // student-proposed alternative
  fearCards: string[];                 // selected fear card IDs
  chosenDoorIndex: number | null;      // 0, 1, 2, or -1 for custom
}

export interface TemplateDoor {
  title: string;
  description: string;
  type: 'sweet_spot' | 'stretch' | 'surprise';
  firstStep: string;
  timeEstimate: string;
  archetype: DesignArchetype;
}

export interface DoorExploration {
  excitement: number;    // 0-100 slider
  notes: string | null;  // optional student notes
}

/** S7: The Launchpad — Commitment */
export interface Station7Data {
  projectStatement: string | null;        // "I will [what], for [who], because [why]"
  successCriteria: string[];              // 3-5 selected/custom criteria
  excitementScore: number | null;         // 0-100 slider
  excitementResponse: string | null;      // Kit's response to excitement level
  grandReveal: GrandRevealData | null;
}

export interface GrandRevealData {
  title: string;          // project title
  narrative: string;      // AI-generated portrait
  archetypeCard: {
    archetype: DesignArchetype;
    secondary: DesignArchetype | null;
    description: string;
  };
  strengthsSummary: string;
  interestMap: string[];
  projectDirection: string;
  mentorNote: string;     // Kit's final message
}

// ─── The Profile ─────────────────────────────────────────────────

/**
 * DiscoveryProfile — the complete student self-portrait.
 *
 * Built incrementally across 8 stations.
 * Stored as JSONB in the database.
 * Feeds into Open Studio AI context and Design Assistant.
 */
export interface DiscoveryProfile {
  // Metadata
  studentId: string;
  unitId: string;
  classId: string | null;
  ageBand: AgeBand;
  mode: DiscoveryMode;
  startedAt: string;              // ISO timestamp
  completedAt: string | null;     // ISO timestamp
  lastStationCompleted: number;   // -1 if none, 0-7
  version: number;                // schema version for future migrations

  // Per-station data
  station0: Station0Data;
  station1: Station1Data;
  station2: Station2Data;
  station3: Station3Data;
  station4: Station4Data;
  station5: Station5Data;
  station6: Station6Data;
  station7: Station7Data;

  // Computed composites (rebuilt after each station)
  archetypeScores: Record<DesignArchetype, number>;  // 0-100 per archetype
  archetypeResult: ArchetypeRevealData | null;
  workingStyle: WorkingStyleVector | null;
  dominantStyle: DominantStyle | null;
}

// ─── Discovery Mode ──────────────────────────────────────────────

/**
 * Mode 1 (Design): lessons → teacher unlock → Discovery → Open Studio
 * Mode 2 (Service/PP/PYPx): Discovery IS the unit entry, Open Studio from day one
 */
export type DiscoveryMode = 'mode_1' | 'mode_2';

// ─── State Machine ───────────────────────────────────────────────

export type DiscoveryStation = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DiscoveryState =
  | 'not_started' | 'loading' | 'completed'
  // Station 0
  | 'station_0' | 'station_0_palette' | 'station_0_tools' | 'station_0_workspace'
  // Station 1
  | 'station_1' | 'station_1_intro' | 'station_1_quickfire' | 'station_1_reflection'
  // Station 2
  | 'station_2' | 'station_2_intro' | 'station_2_story' | 'station_2_text_prompt'
  | 'station_2_scenarios' | 'station_2_people_grid' | 'station_2_reveal'
  // Station 3
  | 'station_3' | 'station_3_intro' | 'station_3_interest_grid' | 'station_3_irritation'
  | 'station_3_youtube' | 'station_3_values_sort' | 'station_3_reveal'
  // Station 4
  | 'station_4' | 'station_4_intro' | 'station_4_story' | 'station_4_scene'
  | 'station_4_zoom' | 'station_4_sliders' | 'station_4_text_prompt' | 'station_4_reveal'
  // Station 5
  | 'station_5' | 'station_5_intro' | 'station_5_time' | 'station_5_resources'
  | 'station_5_people' | 'station_5_efficacy' | 'station_5_experience'
  | 'station_5_failure' | 'station_5_audience' | 'station_5_time_horizon' | 'station_5_reveal'
  // Station 6
  | 'station_6' | 'station_6_intro' | 'station_6_generating' | 'station_6_explore_1'
  | 'station_6_explore_2' | 'station_6_explore_3' | 'station_6_custom'
  | 'station_6_fear' | 'station_6_choose'
  // Station 7
  | 'station_7' | 'station_7_intro' | 'station_7_ascent' | 'station_7_statement'
  | 'station_7_criteria' | 'station_7_excitement' | 'station_7_grand_reveal' | 'station_7_share'
  // Transitions between stations
  | 'transition_0_1' | 'transition_1_2' | 'transition_2_3' | 'transition_3_4'
  | 'transition_4_5' | 'transition_5_6' | 'transition_6_7';

// ─── Session Persistence ─────────────────────────────────────────

export interface DiscoverySession {
  id: string;
  student_id: string;
  unit_id: string;
  class_id: string | null;
  state: DiscoveryState;
  profile: DiscoveryProfile;
  mode: DiscoveryMode;
  started_at: string;
  completed_at: string | null;
  last_saved_at: string;
  version: number;
}

// ─── Scoring ─────────────────────────────────────────────────────

export interface StationArchetypeSignal {
  station: string;                           // e.g. 's0_tools', 's2_scenarios'
  raw: Record<DesignArchetype, number>;      // Raw score from this station
  maxPossible: number;                       // Maximum achievable from this station
  signalQuality: number;                     // 0-1, how reliable this signal is
}

/**
 * Revised station weights (26 March 2026).
 * Free-text irritation is highest individual weight because
 * it's emotional, self-generated, and specific.
 */
export const STATION_WEIGHTS: Record<string, number> = {
  s0_tools:            0.15,
  s2_scenarios:        0.25,
  s2_people:           0.20,
  s3_irritation_ai:    0.20,  // Highest individual weight — free-text analysis
  s3_irritation_preset: 0.05,
  s3_interests:        0.05,
  s5_efficacy:         0.05,
};

// ─── Content Pool Types ──────────────────────────────────────────

export interface BinaryPair {
  id: string;
  dimension: WorkingStyleDimension;
  prompt: string;
  optionA: { label: string; icon: string; signal: string; value: 'a' };
  optionB: { label: string; icon: string; signal: string; value: 'b' };
  ageBands: AgeBand[];
}

export interface ArchetypeScenario {
  id: string;
  prompt: string;
  options: Array<{
    id: string;
    text: string;
    archetypeWeights: Partial<Record<DesignArchetype, number>>;
  }>;
  ageBands: AgeBand[];
}

export interface ToolDefinition {
  id: string;
  label: string;
  icon: string;
  archetypeWeights: Record<DesignArchetype, number>;
}

export interface WorkspaceItem {
  id: string;
  label: string;
  icon: string;
  signal: string;
  trait: string;
}

export interface InterestIcon {
  id: string;
  label: string;
  icon: string;
  cluster: string;
  ageBands: AgeBand[];
}

export interface IrritationScenario {
  id: string;
  text: string;
  category: string;
  ageBands: AgeBand[];
}

export interface YouTubeTopic {
  id: string;
  label: string;
  icon: string;
  cluster: string;
  ageBands: AgeBand[];
}

export interface ValueCard {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface SceneHotspot {
  id: string;
  label: string;
  description: string;
  position: { x: number; y: number };  // percentage-based for responsive
  category: string;
  archetype_signal?: Partial<Record<DesignArchetype, number>>;
}

export interface ResourceCard {
  id: string;
  label: string;
  icon: string;
  category: string;
}

export interface PeopleIcon {
  id: string;
  label: string;
  icon: string;
  archetypes: Array<{ archetype: DesignArchetype; weight: number }>;
}

export interface SelfEfficacyDomain {
  id: string;
  label: string;
  description: string;
  archetype_correlation: Partial<Record<DesignArchetype, number>>;
}

export interface FearCard {
  id: string;
  label: string;
  icon: string;
  kitResponse: string;
}

// ─── Kit Dialogue ────────────────────────────────────────────────

export interface KitDialogue {
  station: number;
  step: string;
  text: string;
  expression: KitExpression;
  ageBands: AgeBand[];
}

export type KitExpression =
  | 'neutral'
  | 'curious'
  | 'excited'
  | 'thoughtful'
  | 'empathetic'
  | 'proud';

// ─── Factory Helpers ─────────────────────────────────────────────

export function createEmptyStation0(): Station0Data {
  return { palette: null, tools: [], workspaceItems: [] };
}

export function createEmptyStation1(): Station1Data {
  return { dimensions: {} as Record<WorkingStyleDimension, 'a' | 'b'>, workingStyle: null, dominantStyle: null, kitReflection: null };
}

export function createEmptyStation2(): Station2Data {
  return { panicResponse: null, panicResponseAiAnalysis: null, scenarioChoices: {}, peopleIcons: [], archetypeReveal: null };
}

export function createEmptyStation3(): Station3Data {
  return { interests: [], irritationPresets: [], irritationFreeText: null, irritationAiAnalysis: null, youtubeTopics: [], valuesRanking: { core: [], important: [], nice: [] } };
}

export function createEmptyStation4(): Station4Data {
  return { sceneClicks: [], zoomChoice: null, sliders: { scale: 50, urgency: 50, proximity: 50 }, problemText: null, problemAiAnalysis: null };
}

export function createEmptyStation5(): Station5Data {
  return { timeHoursPerWeek: null, resources: { have: [], canGet: [], dontHave: [] }, peopleIcons: [], selfEfficacy: {}, pastProjectCount: null, lastProjectOutcome: null, failureResponse: null, audience: null, timeHorizon: null };
}

export function createEmptyStation6(): Station6Data {
  return { doors: [], doorExplorations: {}, customDoor: null, fearCards: [], chosenDoorIndex: null };
}

export function createEmptyStation7(): Station7Data {
  return { projectStatement: null, successCriteria: [], excitementScore: null, excitementResponse: null, grandReveal: null };
}

export function createEmptyProfile(
  studentId: string,
  unitId: string,
  classId: string | null,
  ageBand: AgeBand,
  mode: DiscoveryMode,
): DiscoveryProfile {
  return {
    studentId,
    unitId,
    classId,
    ageBand,
    mode,
    startedAt: new Date().toISOString(),
    completedAt: null,
    lastStationCompleted: -1,
    version: 1,
    station0: createEmptyStation0(),
    station1: createEmptyStation1(),
    station2: createEmptyStation2(),
    station3: createEmptyStation3(),
    station4: createEmptyStation4(),
    station5: createEmptyStation5(),
    station6: createEmptyStation6(),
    station7: createEmptyStation7(),
    archetypeScores: { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 },
    archetypeResult: null,
    workingStyle: null,
    dominantStyle: null,
  };
}
