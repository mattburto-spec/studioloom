/**
 * Station 5: The Toolkit — Resources & Confidence
 *
 * Content: 12 resource cards, 6 people icons, 7 self-efficacy sliders,
 * past experience, failure response, audience, time horizon.
 *
 * Metaphor: "packing your bag before a trip."
 * Must NOT feel like a form. One interaction type per screen.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 5
 */

import type { ResourceCard, PeopleIcon, SelfEfficacyDomain } from '../types';

// ─── Resource Cards (drag into Got / Could Get / Nope) ──────────

export const RESOURCE_CARDS: ResourceCard[] = [
  { id: 'workshop', label: 'A workshop or makerspace', icon: '🔧', category: 'Physical making' },
  { id: 'art_supplies', label: 'Art supplies — paper, paint, markers', icon: '🎨', category: 'Creative materials' },
  { id: 'computer', label: 'A computer or laptop', icon: '💻', category: 'Digital capacity' },
  { id: 'money', label: 'Some money to spend (~$20+)', icon: '💰', category: 'Financial resource' },
  { id: 'camera', label: 'A camera or phone camera', icon: '📸', category: 'Documentation' },
  { id: 'real_tools', label: 'Real tools — saws, drills, soldering iron', icon: '🪚', category: 'Advanced making' },
  { id: 'kitchen', label: 'A kitchen or food prep space', icon: '🍳', category: 'Food projects' },
  { id: 'outdoor', label: 'Outdoor space you can use', icon: '🌳', category: 'Environmental' },
  { id: 'present', label: 'A way to present to people', icon: '📽️', category: 'Communication' },
  { id: 'internet', label: 'Reliable internet', icon: '📶', category: 'Research / digital' },
  { id: 'transport', label: 'A way to get places (bike, bus, parents)', icon: '🚲', category: 'Community access' },
  { id: 'quiet_space', label: 'A quiet space where you can focus', icon: '🔇', category: 'Focus' },
];

export const RESOURCE_KIT_LINES: Record<string, string> = {
  workshop: "The best projects start with sawdust on the floor",
  art_supplies: "You'd be surprised what you can do with a marker and an idea",
  computer: "Not just for YouTube. Mostly for YouTube. But not just.",
  money: "Even a tiny budget changes what's possible",
  camera: "The best camera is the one in your pocket",
  real_tools: "Power tools are just levers with attitude",
  kitchen: "Some of the best design projects you can eat",
  outdoor: "Nature is the original design studio",
  present: "The work isn't done until someone else sees it",
  internet: "Research superpower. Also distraction superpower.",
  transport: "Some problems require you to actually go there",
  quiet_space: "Sometimes the most productive tool is a closed door",
};

// ─── People Icons ("Who's in your corner?") ─────────────────────

export const SUPPORT_PEOPLE: PeopleIcon[] = [
  { id: 'teacher', label: 'A teacher who gets it', icon: '👩‍🏫', archetypes: [] },
  { id: 'friend', label: "A friend who'd be up for it", icon: '👫', archetypes: [] },
  { id: 'expert', label: 'Someone who knows things', icon: '🧑‍🔬', archetypes: [] },
  { id: 'complement', label: "Someone good at what I'm bad at", icon: '🤝', archetypes: [] },
  { id: 'family', label: "Family who'd back me up", icon: '👨‍👩‍👧', archetypes: [] },
  { id: 'real_person', label: 'A real person I could talk to', icon: '🗣️', archetypes: [] },
];

// ─── Self-Efficacy Sliders ──────────────────────────────────────

export const SELF_EFFICACY_DOMAINS: SelfEfficacyDomain[] = [
  {
    id: 'making',
    label: 'Making with hands',
    description: 'Building, crafting, physical creation',
    archetype_correlation: { Maker: 3 },
  },
  {
    id: 'sketching',
    label: 'Sketching & drawing',
    description: 'Getting ideas from head to paper',
    archetype_correlation: { Creative: 2, Maker: 1 },
  },
  {
    id: 'researching',
    label: 'Researching',
    description: 'Finding things out, investigating',
    archetype_correlation: { Researcher: 3 },
  },
  {
    id: 'presenting',
    label: 'Presenting',
    description: 'Speaking in front of people',
    archetype_correlation: { Communicator: 2, Leader: 1 },
  },
  {
    id: 'writing',
    label: 'Writing',
    description: 'Explaining things clearly on paper',
    archetype_correlation: { Communicator: 2, Researcher: 1 },
  },
  {
    id: 'collaborating',
    label: 'Working with others',
    description: 'Teamwork and group dynamics',
    archetype_correlation: { Leader: 2, Communicator: 1 },
  },
  {
    id: 'ideating',
    label: 'Coming up with ideas',
    description: 'Brainstorming and creative thinking',
    archetype_correlation: { Creative: 3 },
  },
];

export const EFFICACY_SLIDER_LABELS: Record<string, { left: string; right: string }> = {
  making: { left: "I break things more than I build them", right: "Give me materials and I'll figure it out" },
  sketching: { left: "Stick figures are a stretch", right: "I can get what's in my head onto paper" },
  researching: { left: "I Google things and hope for the best", right: "I know how to actually find things out" },
  presenting: { left: "I'd genuinely rather clean toilets", right: "Put me in front of people, I'm fine" },
  writing: { left: "Getting thoughts into sentences is painful", right: "I can explain things clearly on paper" },
  collaborating: { left: "Group work gives me a headache", right: "I work well with basically anyone" },
  ideating: { left: "My brain goes blank when someone says 'brainstorm'", right: "Ideas are the easy part for me" },
};

export const EFFICACY_KIT_REACTIONS: Record<string, { low: string; mid: string; high: string }> = {
  making: {
    low: "That's fine — not every project needs power tools",
    mid: "Enough to be dangerous",
    high: "Maker hands. Noted.",
  },
  sketching: {
    low: "You don't need to draw well. You need to think visually.",
    mid: "Good enough to communicate — that's what matters",
    high: "Visual thinker. That's a real asset.",
  },
  researching: {
    low: "We'll work on that — there's a method to it",
    mid: "You know your way around — good",
    high: "Research brain. You'll find things nobody else does.",
  },
  presenting: {
    low: "Noted. We'll find ways to share your work that don't require a stage.",
    mid: "It's not your favourite, but you can do it",
    high: "Comfortable up front — that opens doors.",
  },
  writing: {
    low: "Not everyone thinks in words. That's OK.",
    mid: "You can get by. That's enough.",
    high: "Strong writer — that's an underrated superpower.",
  },
  collaborating: {
    low: "Solo project it is. Nothing wrong with that.",
    mid: "Depends on the group, right? Always does.",
    high: "People person. Your team will be lucky.",
  },
  ideating: {
    low: "Ideas can be learned. I'll show you some tricks.",
    mid: "They come when you're not trying — right?",
    high: "Idea machine. Your challenge will be picking one.",
  },
};

// ─── Past Experience Options ────────────────────────────────────

export const PAST_PROJECT_OPTIONS = [
  { id: 'first', label: 'This is my first one', icon: '🆕' },
  { id: 'one_two', label: 'One or two small ones', icon: '✌️' },
  { id: 'a_few', label: "A few — I've been here before", icon: '🔄' },
  { id: 'loads', label: 'Loads — I know the drill', icon: '💪' },
];

export const LAST_PROJECT_OPTIONS = [
  { id: 'proud', label: 'Finished it. Proud of it.', icon: '🎉' },
  { id: 'fine', label: 'Finished it. It was... fine.', icon: '😐' },
  { id: 'ran_out', label: 'Ran out of time before it was done', icon: '⏰' },
  { id: 'changed', label: 'Changed direction halfway through', icon: '🔀' },
  { id: 'never', label: "Haven't really done one before", icon: '🤷' },
];

// ─── Failure Response Options ───────────────────────────────────

export const FAILURE_RESPONSE_OPTIONS = [
  { id: 'pivot', label: 'Burn it down, start fresh — the idea was the problem', icon: '🔥' },
  { id: 'persist', label: "Keep grinding — I'll get through it eventually", icon: '🪨' },
  { id: 'pause', label: 'Step away. Come back tomorrow with fresh eyes.', icon: '🚶' },
  { id: 'help_seek', label: "Find someone who's done this before and ask for help", icon: '🙋' },
];

// ─── Audience Options ───────────────────────────────────────────

export const AUDIENCE_OPTIONS = [
  { id: 'personal', label: 'Just me and my teacher', icon: '🪞' },
  { id: 'class', label: 'My class', icon: '🏫' },
  { id: 'school', label: 'My whole school', icon: '🏫' },
  { id: 'community', label: 'People in my community', icon: '🏘️' },
  { id: 'global', label: 'Anyone, anywhere', icon: '🌍' },
];

// ─── Kit Dialogue ───────────────────────────────────────────────

export const STATION_5_KIT_DIALOGUE = {
  intro: "We're packing your bag. Not the fun stuff — the honest stuff. What have you actually got to work with?",
  time_prompt: "How many hours a week can you realistically spend on this? Not what sounds good — what's actually real.",
  resources_intro: "Open your bag — what have you got?",
  resources_columns: { have: '✅ Got it', canGet: '🔄 Could get it', nope: '❌ Nope' },
  people_intro: "Who's in your corner?",
  people_subtitle: "Select all that apply",
  efficacy_intro: "Honest check — one at a time. No wrong answers.",
  experience_intro: "One more thing. I'm not judging — I just need to know what you're walking in with.",
  experience_count: "Design projects you've actually finished?",
  experience_outcome: "Last project — how'd it end?",
  failure_intro: "Every project hits a wall. I've never seen one that doesn't. When yours does...",
  failure_prompt: "Your project stops working halfway through. Nothing is going to plan. You...",
  audience_intro: "Who's this for?",
  time_horizon_intro: "Last one. Be honest.",
  time_horizon_prompt: "8 weeks from now feels like...",
  time_horizon_left: "Basically forever away",
  time_horizon_right: "Basically tomorrow",
  time_horizon_low: "You've got time on your side. Use it.",
  time_horizon_mid: "Enough time to do something real if you start soon.",
  time_horizon_high: "Okay, so we need to be realistic about scope. That's useful information.",
  reveal: "I can see what you're working with. Resources, skills, support, experience — the full picture. Some people have more tools than they think.",
};
