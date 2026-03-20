/**
 * Toolkit Tool Metadata
 *
 * Provides quick access to tool information including color, phase, type, etc.
 * Used by design assistant suggestions, floating launcher, and tool browsers.
 */

export interface ToolMetadata {
  name: string;
  slug: string;
  desc: string;
  phase: 'discover' | 'define' | 'ideate' | 'prototype' | 'test';
  type: 'ideation' | 'analysis' | 'evaluation' | 'research' | 'planning';
  color: string; // hex color for UI
  bgColor: string; // darker bg color for cards
}

/**
 * Interactive toolkit tools with their metadata.
 * Subset of the full tools catalog — only interactive tools.
 */
export const INTERACTIVE_TOOLS: Record<string, ToolMetadata> = {
  scamper: {
    name: 'SCAMPER',
    slug: 'scamper',
    desc: '7-step creative technique for modifying existing ideas',
    phase: 'ideate',
    type: 'ideation',
    color: '#818cf8',
    bgColor: '#312e81',
  },
  'six-thinking-hats': {
    name: 'Six Thinking Hats',
    slug: 'six-thinking-hats',
    desc: 'Examine a topic from 6 different perspectives',
    phase: 'ideate',
    type: 'analysis',
    color: '#ec4899',
    bgColor: '#500724',
  },
  'pmi-chart': {
    name: 'PMI Chart',
    slug: 'pmi-chart',
    desc: 'Evaluate ideas by listing Plus, Minus, and Interesting points',
    phase: 'prototype',
    type: 'evaluation',
    color: '#06b6d4',
    bgColor: '#164e63',
  },
  'five-whys': {
    name: 'Five Whys',
    slug: 'five-whys',
    desc: 'Dig deeper with root cause analysis through repeated questioning',
    phase: 'discover',
    type: 'analysis',
    color: '#8b5cf6',
    bgColor: '#3f0f5c',
  },
  'decision-matrix': {
    name: 'Decision Matrix',
    slug: 'decision-matrix',
    desc: 'Score options against criteria with detailed reasoning',
    phase: 'prototype',
    type: 'evaluation',
    color: '#f59e0b',
    bgColor: '#78350f',
  },
  'empathy-map': {
    name: 'Empathy Map',
    slug: 'empathy-map',
    desc: 'Understand user perspective: what they say, think, do, feel',
    phase: 'discover',
    type: 'research',
    color: '#10b981',
    bgColor: '#064e3b',
  },
  'how-might-we': {
    name: 'How Might We',
    slug: 'how-might-we',
    desc: 'Reframe problems as opportunities for creative solutions',
    phase: 'define',
    type: 'ideation',
    color: '#f97316',
    bgColor: '#431407',
  },
  'reverse-brainstorm': {
    name: 'Reverse Brainstorm',
    slug: 'reverse-brainstorm',
    desc: 'Brainstorm ways to cause problems, then flip into solutions',
    phase: 'ideate',
    type: 'ideation',
    color: '#6366f1',
    bgColor: '#312e81',
  },
  'swot-analysis': {
    name: 'SWOT Analysis',
    slug: 'swot-analysis',
    desc: 'Evaluate idea by analyzing Strengths, Weaknesses, Opportunities, Threats',
    phase: 'prototype',
    type: 'evaluation',
    color: '#ef4444',
    bgColor: '#7f1d1d',
  },
  'stakeholder-map': {
    name: 'Stakeholder Map',
    slug: 'stakeholder-map',
    desc: 'Identify and understand all people affected by your design',
    phase: 'discover',
    type: 'research',
    color: '#14b8a6',
    bgColor: '#134e4a',
  },
  'lotus-diagram': {
    name: 'Lotus Diagram',
    slug: 'lotus-diagram',
    desc: 'Expand from central theme to 64 related ideas systematically',
    phase: 'ideate',
    type: 'ideation',
    color: '#d946ef',
    bgColor: '#5b0e49',
  },
  'affinity-diagram': {
    name: 'Affinity Diagram',
    slug: 'affinity-diagram',
    desc: 'Cluster research findings and observations into meaningful themes',
    phase: 'discover',
    type: 'analysis',
    color: '#0ea5e9',
    bgColor: '#0c2d48',
  },
  'morphological-chart': {
    name: 'Morphological Chart',
    slug: 'morphological-chart',
    desc: 'Combine design parameters systematically to generate alternatives',
    phase: 'ideate',
    type: 'ideation',
    color: '#a855f7',
    bgColor: '#4c0519',
  },
};

/**
 * Get metadata for a single tool by slug.
 */
export function getToolMetadata(slug: string): ToolMetadata | null {
  return INTERACTIVE_TOOLS[slug] || null;
}

/**
 * Get all tools for a specific phase.
 */
export function getToolsByPhase(phase: ToolMetadata['phase']): ToolMetadata[] {
  return Object.values(INTERACTIVE_TOOLS).filter((t) => t.phase === phase);
}

/**
 * Get all tools for a specific type.
 */
export function getToolsByType(type: ToolMetadata['type']): ToolMetadata[] {
  return Object.values(INTERACTIVE_TOOLS).filter((t) => t.type === type);
}

/**
 * Get all interactive tools.
 */
export function getAllInteractiveTools(): ToolMetadata[] {
  return Object.values(INTERACTIVE_TOOLS);
}
