/**
 * Station 2: The Workshop — Archetype Scenarios
 *
 * Content: Kit's story, panic text prompt, 6 archetype scenarios (+ 1 junior),
 * "people come to you for" icon grid.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 2
 */

import type {
  ArchetypeScenario,
  PeopleIcon,
  DesignArchetype,
  AgeBand,
} from '../types';

// ─── Archetype Scenarios ────────────────────────────────────────

export const SCENARIOS: ArchetypeScenario[] = [
  {
    id: 'group_crisis',
    prompt: "You're in a group project. Halfway through, you realise the plan isn't working. The deadline is next week. You...",
    options: [
      { id: 'a', text: 'Quietly start building a backup plan in case the original fails', archetypeWeights: { Maker: 3 } },
      { id: 'b', text: 'Call a meeting and lay out a new direction for the group', archetypeWeights: { Leader: 3 } },
      { id: 'c', text: 'Research what went wrong — you need data before changing anything', archetypeWeights: { Researcher: 3 } },
      { id: 'd', text: 'Sketch 3 quick alternatives and let the group pick', archetypeWeights: { Creative: 3 } },
      { id: 'e', text: 'Talk to each person separately to understand what they think', archetypeWeights: { Communicator: 3 } },
      { id: 'f', text: "Map out which parts are working and which aren't — fix only what's broken", archetypeWeights: { Systems: 3 } },
    ],
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'free_period',
    prompt: "Your teacher is absent and you have a free period. Your design project is due in 3 days. You...",
    options: [
      { id: 'a', text: 'Head to the workshop and start making something — even rough', archetypeWeights: { Maker: 3 } },
      { id: 'b', text: 'Open your laptop and research what other people have done for similar problems', archetypeWeights: { Researcher: 3 } },
      { id: 'c', text: "Find your group and coordinate who's doing what by when", archetypeWeights: { Leader: 3 } },
      { id: 'd', text: 'Grab your sketchbook and brainstorm wildly — no judgement', archetypeWeights: { Creative: 3 } },
      { id: 'e', text: 'Find your target user and ask them some quick questions', archetypeWeights: { Communicator: 2, Researcher: 1 } },
      { id: 'f', text: 'Review the project plan and figure out the most efficient path to done', archetypeWeights: { Systems: 3 } },
    ],
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'feedback_crunch',
    prompt: "Your teacher says your design is 'fine but safe.' You have one day to improve it before final submission. You...",
    options: [
      { id: 'a', text: 'Rebuild one section from scratch with a bolder approach', archetypeWeights: { Maker: 2, Creative: 1 } },
      { id: 'b', text: 'Look at award-winning examples and analyse what makes them stand out', archetypeWeights: { Researcher: 3 } },
      { id: 'c', text: 'Ask 3 classmates for honest feedback and pick the best suggestion', archetypeWeights: { Communicator: 2, Leader: 1 } },
      { id: 'd', text: 'Generate 5 radically different alternatives in 20 minutes, pick the most exciting', archetypeWeights: { Creative: 3 } },
      { id: 'e', text: 'Identify the weakest part of the system and redesign just that piece', archetypeWeights: { Systems: 3 } },
      { id: 'f', text: 'Present your current work to someone and watch their reaction — that tells you what to fix', archetypeWeights: { Communicator: 3 } },
    ],
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'someone_needs_help',
    prompt: "A classmate is struggling with their project. They're frustrated and behind. You...",
    options: [
      { id: 'a', text: 'Sit down with them and help build something together — hands on', archetypeWeights: { Maker: 3 } },
      { id: 'b', text: 'Help them break down the problem and find resources', archetypeWeights: { Researcher: 2, Systems: 1 } },
      { id: 'c', text: "Organise a quick study group so they're not alone", archetypeWeights: { Leader: 3 } },
      { id: 'd', text: "Share some creative techniques that always work for you when you're stuck", archetypeWeights: { Creative: 2, Communicator: 1 } },
      { id: 'e', text: 'Listen first. Sometimes people just need to talk through it before they can fix it', archetypeWeights: { Communicator: 3 } },
      { id: 'f', text: 'Look at their process and spot where it went off track — help them see the pattern', archetypeWeights: { Systems: 3 } },
    ],
    ageBands: ['junior', 'senior', 'extended'],
  },
  {
    id: 'collab_disagreement',
    prompt: "You and a partner disagree about which direction your project should go. You both feel strongly. You...",
    options: [
      { id: 'a', text: 'Make your case clearly and try to convince them', archetypeWeights: { Leader: 3 } },
      { id: 'b', text: "Find the overlap between both ideas — there's usually a way to combine them", archetypeWeights: { Communicator: 3 } },
      { id: 'c', text: "Let them take the lead on this one — you'll contribute more in your own way later", archetypeWeights: {} },
      { id: 'd', text: 'Split up — you each build your version and compare', archetypeWeights: { Maker: 3 } },
    ],
    ageBands: ['junior', 'senior', 'extended'],
  },
  // Senior/Extended only
  {
    id: 'ambiguity_response',
    prompt: "Your teacher gives you a project brief that says: 'Improve something in your community.' No other instructions. You...",
    options: [
      { id: 'a', text: 'Love it — immediately start thinking about what to build', archetypeWeights: { Maker: 2, Creative: 1 } },
      { id: 'b', text: 'Start researching your community — what needs improving?', archetypeWeights: { Researcher: 3 } },
      { id: 'c', text: "Ask the teacher clarifying questions — what counts? what's the scope?", archetypeWeights: { Systems: 2, Leader: 1 } },
      { id: 'd', text: 'Talk to community members to find out what THEY think needs improving', archetypeWeights: { Communicator: 3 } },
      { id: 'e', text: "Feel a bit overwhelmed but excited — draw a mind map to find your way in", archetypeWeights: { Creative: 2 } },
      { id: 'f', text: 'Create a spreadsheet of every possible problem and rank them by impact', archetypeWeights: { Systems: 3 } },
    ],
    ageBands: ['senior', 'extended'],
  },
  // Junior replacement
  {
    id: 'ambiguity_response_junior',
    prompt: "Your teacher says 'Design something that solves a problem at school.' That's it — no other rules. You...",
    options: [
      { id: 'a', text: 'Awesome! Start sketching ideas straight away', archetypeWeights: { Maker: 2, Creative: 1 } },
      { id: 'b', text: 'Walk around school looking for problems to solve', archetypeWeights: { Researcher: 2, Communicator: 1 } },
      { id: 'c', text: 'Ask your friends what annoys them about school', archetypeWeights: { Communicator: 3 } },
      { id: 'd', text: "Ask the teacher some questions first — you want to know what's expected", archetypeWeights: { Systems: 2 } },
      { id: 'e', text: 'Make a list of every problem you can think of, then pick the best one', archetypeWeights: { Systems: 2, Researcher: 1 } },
      { id: 'f', text: 'Find a friend and brainstorm together', archetypeWeights: { Leader: 1, Communicator: 2 } },
    ],
    ageBands: ['junior'],
  },
];

// ─── People Icons ("What do people come to you for?") ───────────

export const PEOPLE_ICONS: PeopleIcon[] = [
  { id: 'fixing', label: 'Fixing things', icon: '🛠️', archetypes: [{ archetype: 'Maker', weight: 3 }] },
  { id: 'ideas', label: 'Ideas', icon: '💡', archetypes: [{ archetype: 'Creative', weight: 3 }] },
  { id: 'organized', label: 'Getting organized', icon: '📋', archetypes: [{ archetype: 'Leader', weight: 1.5 }, { archetype: 'Systems', weight: 1.5 }] },
  { id: 'explaining', label: 'Explaining things', icon: '🗣️', archetypes: [{ archetype: 'Communicator', weight: 3 }] },
  { id: 'finding_out', label: 'Finding things out', icon: '🔍', archetypes: [{ archetype: 'Researcher', weight: 3 }] },
  { id: 'settling', label: 'Settling arguments', icon: '🤝', archetypes: [{ archetype: 'Communicator', weight: 1.5 }, { archetype: 'Leader', weight: 1.5 }] },
  { id: 'aesthetics', label: 'Making things look good', icon: '🎨', archetypes: [{ archetype: 'Creative', weight: 3 }] },
  { id: 'figuring_out', label: 'Figuring out how things work', icon: '🧩', archetypes: [{ archetype: 'Systems', weight: 1.5 }, { archetype: 'Researcher', weight: 1.5 }] },
  { id: 'tech_help', label: 'Tech help', icon: '📱', archetypes: [{ archetype: 'Systems', weight: 1.5 }, { archetype: 'Maker', weight: 1.5 }] },
  { id: 'mood', label: 'Making people laugh / feel better', icon: '🎭', archetypes: [{ archetype: 'Communicator', weight: 3 }] },
];

// ─── Kit Dialogue ───────────────────────────────────────────────

export const STATION_2_KIT_DIALOGUE = {
  intro: "This is where I find out what you actually DO — not what you say you'd do. I'm going to tell you a story first, then put you in some situations.",
  story: "When I was your age, someone dropped a half-finished chair in front of me and said 'fix it.' No instructions. I panicked. Then I looked closer and realised — I didn't need to fix the whole thing. I just needed to figure out which leg was wrong. That changed how I see problems.",
  text_prompt: "Your best friend messages you panicking at 9pm. Their big project is due tomorrow and they've barely started. They have about 2 hours. What do you ACTUALLY tell them to do? Be specific — not 'just try your best.' What's your actual plan for them?",
  scenarios_intro: "Now some situations. Don't overthink these — pick the one that feels most like you, not the one that sounds best.",
  people_grid_intro: "Last thing for this station. Quick one: what do people actually come to you for? Not what you WISH they came to you for. What do they ACTUALLY ask?",
  people_grid_subtitle: "Pick 2-3",
  reveal: "Interesting. I'm starting to see a pattern. Let me hold onto this — it's going to make sense later.",
};

// ─── Helpers ────────────────────────────────────────────────────

export function getScenariosForAge(ageBand: AgeBand): ArchetypeScenario[] {
  return SCENARIOS.filter((s) => s.ageBands.includes(ageBand));
}

/**
 * Compute archetype signals from scenario choices.
 * Returns accumulated weights per archetype.
 */
export function computeScenarioArchetypeSignals(
  scenarios: ArchetypeScenario[],
  choices: Record<string, string>,
): Record<DesignArchetype, number> {
  const signals: Record<DesignArchetype, number> = {
    Maker: 0, Researcher: 0, Leader: 0,
    Communicator: 0, Creative: 0, Systems: 0,
  };

  for (const scenario of scenarios) {
    const chosenId = choices[scenario.id];
    if (!chosenId) continue;
    const option = scenario.options.find((o) => o.id === chosenId);
    if (!option) continue;
    for (const [arch, weight] of Object.entries(option.archetypeWeights)) {
      signals[arch as DesignArchetype] += weight;
    }
  }

  return signals;
}

/**
 * Compute archetype signals from people icon selections.
 * "External validation" — weighted 1.5× (observable strengths are more reliable).
 */
export function computePeopleArchetypeSignals(
  selectedIds: string[],
): Record<DesignArchetype, number> {
  const signals: Record<DesignArchetype, number> = {
    Maker: 0, Researcher: 0, Leader: 0,
    Communicator: 0, Creative: 0, Systems: 0,
  };
  const EXTERNAL_MULTIPLIER = 1.5;

  for (const id of selectedIds) {
    const icon = PEOPLE_ICONS.find((p) => p.id === id);
    if (!icon) continue;
    for (const { archetype, weight } of icon.archetypes) {
      signals[archetype] += weight * EXTERNAL_MULTIPLIER;
    }
  }

  return signals;
}
