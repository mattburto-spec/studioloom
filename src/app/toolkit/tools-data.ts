export type Phase = 'discover' | 'define' | 'ideate' | 'prototype' | 'test';
export type ToolGroup = 'ideation' | 'analysis' | 'evaluation' | 'research' | 'planning';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ToolkitTool {
  id: string;
  name: string;
  phase: Phase;
  difficulty: Difficulty;
  time: string;
  group: ToolGroup;
  desc: string;
  interactive: boolean; // true = has dedicated /toolkit/[slug] page
  slug?: string; // URL path for interactive tools (e.g., 'scamper' → /toolkit/scamper)
}

export const PHASE_LABELS: Record<Phase, string> = {
  discover: 'Discover',
  define: 'Define',
  ideate: 'Ideate',
  prototype: 'Prototype',
  test: 'Test',
};

export const PHASE_COLORS: Record<Phase, string> = {
  discover: '#60a5fa',
  define: '#a78bfa',
  ideate: '#34d399',
  prototype: '#fbbf24',
  test: '#f472b6',
};

// Interactive tools that have dedicated /toolkit/[slug] pages
// NOTE: slug defaults to id if not specified
export const INTERACTIVE_SLUGS: Record<string, string> = {
  'mind-map': 'mind-map',
  'empathy-map': 'empathy-map',
  'journey-map': 'journey-map',
  'stakeholder-map': 'stakeholder-map',
  'persona': 'user-persona',
  'biomimicry': 'biomimicry',
  'affinity': 'affinity-diagram',
  'how-might-we': 'how-might-we',
  'five-whys': 'five-whys',
  'fishbone': 'fishbone',
  'swot': 'swot-analysis',
  'systems-map': 'systems-map',
  'point-of-view': 'point-of-view',
  'scamper': 'scamper',
  'lotus': 'lotus-diagram',
  'reverse-brainstorm': 'reverse-brainstorm',
  'morphological': 'morphological-chart',
  'brainstorm-web': 'brainstorm-web',
  'six-hats': 'six-thinking-hats',
  'design-spec': 'design-specification',
  'storyboard': 'storyboard',
  'sketch': 'quick-sketch',
  'pmi': 'pmi-chart',
  'decision-matrix': 'decision-matrix',
  'dot-voting': 'dot-voting',
  'comparison': 'pairwise-comparison',
  'feedback-grid': 'feedback-capture-grid',
  'impact-effort': 'impact-effort-matrix',
};

// AI search keyword rules — maps intent words to relevant tool IDs
export const SEARCH_RULES: { keywords: string[]; tools: string[] }[] = [
  { keywords: ['brainstorm', 'ideas', 'generate', 'come up with'], tools: ['scamper', 'brainstorm-web', 'lotus', 'reverse-brainstorm', 'brainwrite', 'morphological'] },
  { keywords: ['evaluate', 'decide', 'choose', 'compare', 'pick'], tools: ['decision-matrix', 'pmi', 'dot-voting', 'comparison', 'impact-effort', 'six-hats'] },
  { keywords: ['research', 'user', 'understand', 'empathy', 'interview'], tools: ['empathy-map', 'persona', 'journey-map', 'stakeholder-map', 'target-audience'] },
  { keywords: ['problem', 'cause', 'root', 'why', 'define'], tools: ['five-whys', 'fishbone', 'how-might-we', 'point-of-view', 'systems-map'] },
  { keywords: ['organize', 'group', 'sort', 'cluster', 'theme'], tools: ['affinity', 'concept-map', 'mind-map', 'tree-diagram'] },
  { keywords: ['plan', 'prototype', 'build', 'spec', 'iterate'], tools: ['design-spec', 'storyboard', 'design-sprint', 'iteration-tracker', 'value-prop'] },
  { keywords: ['feedback', 'review', 'assess', 'critique', 'test'], tools: ['feedback-grid', 'pmi', 'assessment', 'rubric-maker', 'portfolio-review'] },
  { keywords: ['sketch', 'draw', 'visual', 'mood', 'inspire'], tools: ['sketch', 'moodboard', 'storyboard', 'mind-map'] },
  { keywords: ['quick', 'fast', 'easy', 'simple', 'beginner'], tools: ['pmi', 'dot-voting', 'mind-map', 'five-whys', 'comparison', 'feedback-grid'] },
  { keywords: ['deep', 'thorough', 'advanced', 'comprehensive'], tools: ['six-hats', 'systems-map', 'biomimicry', 'design-sprint', 'morphological'] },
  { keywords: ['nature', 'bio', 'sustainable', 'environment'], tools: ['biomimicry', 'systems-map'] },
  { keywords: ['prioritize', 'rank', 'vote', 'effort', 'impact'], tools: ['dot-voting', 'impact-effort', 'decision-matrix', 'comparison'] },
];

// All 42 tools (28 interactive + 14 catalog)
export const tools: ToolkitTool[] = [
  // ── DISCOVER ──
  { id: 'mind-map', name: 'Mind Map', phase: 'discover', difficulty: 'beginner', time: '15-30m', group: 'ideation', desc: 'Branch ideas from a central topic to explore connections and discover patterns.', interactive: true, slug: 'mind-map' },
  { id: 'empathy-map', name: 'Empathy Map', phase: 'discover', difficulty: 'beginner', time: '15-30m', group: 'research', desc: 'Map what users say, think, do, and feel to build deep understanding.', interactive: true, slug: 'empathy-map' },
  { id: 'journey-map', name: 'Journey Map', phase: 'discover', difficulty: 'intermediate', time: '30-45m', group: 'research', desc: "Trace a user's experience step by step to find pain points and opportunities.", interactive: true, slug: 'journey-map' },
  { id: 'stakeholder-map', name: 'Stakeholder Map', phase: 'discover', difficulty: 'intermediate', time: '20-30m', group: 'research', desc: 'Identify who your design affects and what they need from it.', interactive: true, slug: 'stakeholder-map' },
  { id: 'persona', name: 'User Persona', phase: 'discover', difficulty: 'intermediate', time: '20-40m', group: 'research', desc: 'Create a fictional user profile based on real research data.', interactive: true, slug: 'user-persona' },
  { id: 'target-audience', name: 'Target Audience Profile', phase: 'discover', difficulty: 'beginner', time: '15-25m', group: 'research', desc: "Define who you're designing for — demographics, needs, and context.", interactive: false },
  { id: 'design-dialogue', name: 'Design Dialogue', phase: 'discover', difficulty: 'beginner', time: '15-30m', group: 'research', desc: 'Structured conversation prompts to explore a design challenge.', interactive: false },
  { id: 'biomimicry', name: 'Biomimicry Canvas', phase: 'discover', difficulty: 'advanced', time: '30-60m', group: 'research', desc: 'Look to nature for design inspiration and sustainable solutions.', interactive: true, slug: 'biomimicry' },

  // ── DEFINE ──
  { id: 'affinity', name: 'Affinity Diagram', phase: 'define', difficulty: 'intermediate', time: '20-40m', group: 'analysis', desc: 'Group and organize ideas into natural clusters to find themes.', interactive: true, slug: 'affinity-diagram' },
  { id: 'how-might-we', name: 'How Might We?', phase: 'define', difficulty: 'intermediate', time: '15-30m', group: 'analysis', desc: 'Reframe problems as opportunities with structured question crafting.', interactive: true, slug: 'how-might-we' },
  { id: 'five-whys', name: 'Five Whys', phase: 'define', difficulty: 'intermediate', time: '10-20m', group: 'analysis', desc: 'Dig to the root cause of a problem by asking "why?" five times.', interactive: true, slug: 'five-whys' },
  { id: 'fishbone', name: 'Fishbone Diagram', phase: 'define', difficulty: 'intermediate', time: '15-30m', group: 'analysis', desc: 'Map all possible causes of a problem in a structured visual.', interactive: true, slug: 'fishbone' },
  { id: 'swot', name: 'SWOT Analysis', phase: 'define', difficulty: 'intermediate', time: '15-30m', group: 'analysis', desc: 'Evaluate Strengths, Weaknesses, Opportunities, and Threats.', interactive: true, slug: 'swot-analysis' },
  { id: 'concept-map', name: 'Concept Map', phase: 'define', difficulty: 'intermediate', time: '20-40m', group: 'analysis', desc: 'Connect concepts with labeled relationships to show understanding.', interactive: false },
  { id: 'systems-map', name: 'Systems Map', phase: 'define', difficulty: 'advanced', time: '30-60m', group: 'analysis', desc: 'Visualize how parts of a system interact and influence each other.', interactive: true, slug: 'systems-map' },
  { id: 'design-criteria', name: 'Design Criteria', phase: 'define', difficulty: 'beginner', time: '10-20m', group: 'analysis', desc: 'Set clear success criteria your design must meet.', interactive: false },
  { id: 'user-story', name: 'User Story Mapping', phase: 'define', difficulty: 'intermediate', time: '20-40m', group: 'analysis', desc: 'Map user needs as "As a... I want... So that..." stories.', interactive: false },
  { id: 'point-of-view', name: 'Point of View Statement', phase: 'define', difficulty: 'beginner', time: '10-15m', group: 'analysis', desc: 'Distill your research into a clear problem statement.', interactive: true, slug: 'point-of-view' },

  // ── IDEATE ──
  { id: 'scamper', name: 'SCAMPER', phase: 'ideate', difficulty: 'intermediate', time: '20-40m', group: 'ideation', desc: '7 thinking strategies to transform existing ideas into new ones.', interactive: true, slug: 'scamper' },
  { id: 'lotus', name: 'Lotus Diagram', phase: 'ideate', difficulty: 'intermediate', time: '25-45m', group: 'ideation', desc: 'Expand a central idea into 8 themes, then 8 sub-ideas each.', interactive: true, slug: 'lotus-diagram' },
  { id: 'reverse-brainstorm', name: 'Reverse Brainstorm', phase: 'ideate', difficulty: 'intermediate', time: '15-30m', group: 'ideation', desc: 'Brainstorm bad ideas first, then flip them into real solutions.', interactive: true, slug: 'reverse-brainstorm' },
  { id: 'morphological', name: 'Morphological Chart', phase: 'ideate', difficulty: 'advanced', time: '30-45m', group: 'ideation', desc: 'Combine features across categories to generate novel combinations.', interactive: true, slug: 'morphological-chart' },
  { id: 'brainstorm-web', name: 'Brainstorm Web', phase: 'ideate', difficulty: 'beginner', time: '15-30m', group: 'ideation', desc: 'Free-form idea generation with visual web connections.', interactive: true, slug: 'brainstorm-web' },
  { id: 'tree-diagram', name: 'Tree Diagram', phase: 'ideate', difficulty: 'intermediate', time: '15-30m', group: 'ideation', desc: 'Break big ideas into smaller branches of sub-ideas.', interactive: false },
  { id: 'brainwrite', name: 'Brainwrite', phase: 'ideate', difficulty: 'intermediate', time: '15-30m', group: 'ideation', desc: "Silent brainstorming: write, pass, build on others' ideas.", interactive: false },
  { id: 'six-hats', name: 'Six Thinking Hats', phase: 'ideate', difficulty: 'advanced', time: '30-60m', group: 'ideation', desc: 'Look at a problem from 6 different thinking perspectives.', interactive: true, slug: 'six-thinking-hats' },

  // ── PROTOTYPE ──
  { id: 'value-prop', name: 'Value Proposition Canvas', phase: 'prototype', difficulty: 'intermediate', time: '20-40m', group: 'planning', desc: 'Map how your design creates value for users.', interactive: false },
  { id: 'design-sprint', name: 'Design Sprint Planning', phase: 'prototype', difficulty: 'advanced', time: '60+ min', group: 'planning', desc: 'Plan a focused 5-day design sprint process.', interactive: false },
  { id: 'moodboard', name: 'Mood Board', phase: 'prototype', difficulty: 'beginner', time: '20-40m', group: 'planning', desc: 'Collect visual inspiration to guide your design direction.', interactive: false },
  { id: 'storyboard', name: 'Storyboard', phase: 'prototype', difficulty: 'intermediate', time: '25-45m', group: 'planning', desc: 'Sketch a sequence showing how users interact with your design.', interactive: true, slug: 'storyboard' },
  { id: 'design-spec', name: 'Design Specification', phase: 'prototype', difficulty: 'advanced', time: '30-60m', group: 'planning', desc: 'Document detailed technical requirements for your design.', interactive: true, slug: 'design-specification' },
  { id: 'iteration-tracker', name: 'Iteration Tracker', phase: 'prototype', difficulty: 'intermediate', time: '10-20m', group: 'planning', desc: 'Track changes and improvements across design iterations.', interactive: false },
  { id: 'sketch', name: 'Quick Sketch', phase: 'prototype', difficulty: 'beginner', time: '10-30m', group: 'planning', desc: 'Rapid sketching with timer to explore ideas visually.', interactive: true, slug: 'quick-sketch' },

  // ── TEST ──
  { id: 'pmi', name: 'PMI Chart', phase: 'test', difficulty: 'beginner', time: '10-20m', group: 'evaluation', desc: 'Evaluate ideas by listing Plus, Minus, and Interesting points.', interactive: true, slug: 'pmi-chart' },
  { id: 'decision-matrix', name: 'Decision Matrix', phase: 'test', difficulty: 'intermediate', time: '20-40m', group: 'evaluation', desc: 'Score options against weighted criteria to make informed choices.', interactive: true, slug: 'decision-matrix' },
  { id: 'dot-voting', name: 'Dot Voting', phase: 'test', difficulty: 'beginner', time: '10-20m', group: 'evaluation', desc: 'Democratic prioritization: everyone gets limited votes.', interactive: true, slug: 'dot-voting' },
  { id: 'comparison', name: 'Pairwise Comparison', phase: 'test', difficulty: 'beginner', time: '10-20m', group: 'evaluation', desc: 'Compare options head-to-head in pairs to find the best.', interactive: true, slug: 'pairwise-comparison' },
  { id: 'feedback-grid', name: 'Feedback Capture Grid', phase: 'test', difficulty: 'beginner', time: '10-20m', group: 'evaluation', desc: 'Organize feedback into likes, wishes, questions, and ideas.', interactive: true, slug: 'feedback-capture-grid' },
  { id: 'impact-effort', name: 'Impact/Effort Matrix', phase: 'test', difficulty: 'beginner', time: '15-25m', group: 'evaluation', desc: 'Plot ideas on a 2×2 grid of impact vs effort to prioritize.', interactive: true, slug: 'impact-effort-matrix' },
  { id: 'rubric-maker', name: 'Assessment Rubric', phase: 'test', difficulty: 'intermediate', time: '20-40m', group: 'evaluation', desc: 'Build rubrics for self, peer, or teacher assessment.', interactive: false },
  { id: 'assessment', name: 'Peer Assessment', phase: 'test', difficulty: 'intermediate', time: '15-30m', group: 'evaluation', desc: 'Structured peer feedback with sentence starters.', interactive: false },
  { id: 'portfolio-review', name: 'Portfolio Review', phase: 'test', difficulty: 'advanced', time: '30-60m', group: 'evaluation', desc: 'Reflect on your portfolio with structured self-evaluation.', interactive: false },
];

// ── Unified toolkit category tabs (shared across public + teacher pages) ──
export interface ToolkitTab {
  id: string;
  label: string;
  active: boolean;
}

export const TOOLKIT_TABS: ToolkitTab[] = [
  { id: 'design-thinking', label: 'Design', active: true },
  { id: 'visual-spatial', label: 'Visual', active: false },
  { id: 'collaboration', label: 'Collaborate', active: false },
  { id: 'planning-strategy', label: 'Strategy', active: false },
  { id: 'systems-science', label: 'Systems', active: false },
  { id: 'self-discovery', label: 'Discovery', active: false },
  { id: 'reflection-growth', label: 'Growth', active: false },
];

// Coming Soon expansion categories (aligned with TOOLKIT_TABS)
export interface ComingSoonCategory {
  name: string;
  tools: string[];
}

export const COMING_SOON: ComingSoonCategory[] = [
  { name: 'Visual & Spatial', tools: ['Annotation Tool', 'Wireframe Builder', 'Mood Board Creator', 'Comparison Sketch', 'Storyboard Creator'] },
  { name: 'Collaboration', tools: ['Round Robin', 'Team Charter Builder', 'Consensus Builder', 'Warm-up Library', 'Energy Level Pulser'] },
  { name: 'Planning & Strategy', tools: ['Sprint Board', 'Timeline Builder', 'Pitch Builder', 'Business Model Canvas', 'Design Brief Writer'] },
  { name: 'Systems & Science', tools: ['Causal Loop Diagram', 'Futures Cone Builder', 'Ripple Effect Mapper', 'A/B Testing Matrix', 'Sustainability Canvas'] },
  { name: 'Self-Discovery', tools: ['Archetype Finder', 'Strength Mapper', 'Values Card Sort', 'Fear Reframer', 'Working Style Profiler'] },
  { name: 'Reflection & Growth', tools: ['Learning Log', 'Growth Tracker', 'Mistake Journal', 'Process Documentation', 'Design DNA Profiler'] },
];

// Helper: get slug for a tool (interactive tools only)
export function getToolSlug(id: string): string | null {
  return INTERACTIVE_SLUGS[id] || null;
}

// Helper: get URL for a tool
export function getToolUrl(id: string): string | null {
  const slug = getToolSlug(id);
  return slug ? `/toolkit/${slug}` : null;
}

// ── BACKWARD COMPATIBILITY ──
// Re-export types used by existing tool components
export type DeployMode = 'present' | 'print' | 'group' | 'solo';
export type ToolType = ToolGroup;
export type Tool = ToolkitTool;
