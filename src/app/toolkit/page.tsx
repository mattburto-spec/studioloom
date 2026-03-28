'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { tools, Phase, DeployMode, ToolType } from './tools-data';

type ViewMode = 'grid' | 'list';

/* ── Expansion categories (Coming Soon) ─────────────────────── */
interface ComingSoonCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  tools: string[];
}

const COMING_SOON: ComingSoonCategory[] = [
  {
    id: 'psychometric',
    name: 'Psychometric & Self-Discovery',
    icon: '🧠',
    color: '#f472b6',
    desc: 'Uncover personal strengths, team dynamics, and cognitive styles through research-backed assessments.',
    tools: ['Learning Style Compass', 'Team Role Identifier', 'Creative Confidence Scale', 'Design Mindset Quiz', 'Cognitive Style Profiler'],
  },
  {
    id: 'collaboration',
    name: 'Collaboration & Teamwork',
    icon: '🤝',
    color: '#34d399',
    desc: 'Structure group work, make collective decisions, and manage team dynamics effectively.',
    tools: ['Dot Voting', 'Round Robin', 'Silent Brainstorm', 'Team Charter Builder', 'Consensus Check'],
  },
  {
    id: 'drawing',
    name: 'Drawing & Visual Thinking',
    icon: '✏️',
    color: '#fbbf24',
    desc: 'Sketch, prototype, and communicate ideas visually — no artistic talent required.',
    tools: ['Quick Sketch Canvas', 'Storyboard Builder', 'Wireframe Sketch', 'Visual Notetaking', 'Icon Library Builder'],
  },
  {
    id: 'planning',
    name: 'Planning & Project Management',
    icon: '📋',
    color: '#60a5fa',
    desc: 'Plan timelines, track resources, and manage the messy middle of design projects.',
    tools: ['Gantt Timeline', 'Resource Planner', 'Sprint Board', 'Risk Register', 'Milestone Tracker'],
  },
  {
    id: 'communication',
    name: 'Communication & Presentation',
    icon: '🎤',
    color: '#c084fc',
    desc: 'Pitch ideas, structure arguments, and present design work with confidence.',
    tools: ['Elevator Pitch Builder', 'Presentation Planner', 'Critique Protocol', 'Design Rationale', 'Peer Feedback Frames'],
  },
  {
    id: 'reflection',
    name: 'Reflection & Metacognition',
    icon: '🪞',
    color: '#fb923c',
    desc: 'Build awareness of your own thinking process, track growth, and deepen learning.',
    tools: ['Thinking Journal', 'KWL Chart', 'Exit Ticket', 'Process Portfolio Builder', 'Growth Tracker'],
  },
];

/* ── Animation variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 28 },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const comingSoonVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const comingSoonCard = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 24 },
  },
};

/* ── Helpers ─────────────────────────────────────────────────── */
const PHASE_COLORS: Record<Phase, string> = {
  discover: '#6366f1',
  define: '#ec4899',
  ideate: '#a855f7',
  prototype: '#f59e0b',
  test: '#10b981',
};

const getPhaseTagColor = (phase: Phase) => ({
  bg: `${PHASE_COLORS[phase]}1e`,
  text: phase === 'discover' ? '#818cf8'
    : phase === 'define' ? '#f472b6'
    : phase === 'ideate' ? '#c084fc'
    : phase === 'prototype' ? '#fbbf24'
    : '#34d399',
});

const getDifficultyColor = (d: string) =>
  d === 'beginner' ? { bg: 'rgba(16,185,129,0.15)', text: '#34d399' }
  : d === 'intermediate' ? { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' }
  : d === 'advanced' ? { bg: 'rgba(239,68,68,0.15)', text: '#f87171' }
  : { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' };

/* ── Main page component ─────────────────────────────────────── */
export default function ToolkitPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<Phase | 'all'>('all');
  const [selectedType, setSelectedType] = useState<ToolType | 'all'>('all');
  const [selectedDeployMode, setSelectedDeployMode] = useState<DeployMode | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredTools = useMemo(() => tools.filter((tool) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      tool.name.toLowerCase().includes(q) ||
      tool.desc.toLowerCase().includes(q) ||
      (tool.synonyms && tool.synonyms.toLowerCase().includes(q));
    const matchesPhase = selectedPhase === 'all' || tool.phases.includes(selectedPhase);
    const matchesType = selectedType === 'all' || tool.type === selectedType;
    const matchesDeploy = selectedDeployMode === 'all' || tool.modes.includes(selectedDeployMode);
    return matchesSearch && matchesPhase && matchesType && matchesDeploy;
  }), [searchQuery, selectedPhase, selectedType, selectedDeployMode]);

  const phases: Array<{ value: Phase | 'all'; label: string; color?: string }> = [
    { value: 'all', label: 'All' },
    { value: 'discover', label: 'Discover', color: '#6366f1' },
    { value: 'define', label: 'Define', color: '#ec4899' },
    { value: 'ideate', label: 'Ideate', color: '#a855f7' },
    { value: 'prototype', label: 'Prototype', color: '#f59e0b' },
    { value: 'test', label: 'Test', color: '#10b981' },
  ];

  const types: Array<{ value: ToolType | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'ideation', label: 'Ideation' },
    { value: 'analysis', label: 'Analysis' },
    { value: 'evaluation', label: 'Evaluation' },
    { value: 'research', label: 'Research' },
    { value: 'planning', label: 'Planning' },
    { value: 'communication', label: 'Communication' },
    { value: 'reflection', label: 'Reflection' },
  ];

  const deployModes: Array<{ value: DeployMode | 'all'; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: '▦' },
    { value: 'present', label: 'Present', icon: '▶' },
    { value: 'print', label: 'Print', icon: '⎙' },
    { value: 'group', label: 'Group', icon: '👥' },
    { value: 'solo', label: 'Solo', icon: '👤' },
  ];

  const hasActiveFilter = selectedPhase !== 'all' || selectedType !== 'all' || selectedDeployMode !== 'all' || searchQuery.length > 0;

  const clearFilters = () => {
    setSelectedPhase('all');
    setSelectedType('all');
    setSelectedDeployMode('all');
    setSearchQuery('');
  };

  const interactiveCount = tools.filter(t => t.slug).length;
  const totalToolCount = tools.length + COMING_SOON.reduce((s, c) => s + c.tools.length, 0);

  return (
    <div
      style={{
        background: '#06060f',
        color: '#e8eaf0',
        minHeight: '100vh',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <style>{`
        @keyframes aurora {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          50% { transform: translate(-2%,1%) scale(1.02); opacity: 0.8; }
          100% { transform: translate(1%,-1%) scale(0.98); opacity: 1; }
        }
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      {/* ═══ HERO ═══ */}
      <motion.div
        initial="hidden"
        animate="visible"
        style={{
          position: 'relative',
          padding: 'clamp(48px, 5vw, 72px) 24px 48px',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Aurora background */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: `
              radial-gradient(ellipse 80% 60% at 20% 40%, rgba(99,102,241,0.12) 0%, transparent 70%),
              radial-gradient(ellipse 60% 50% at 80% 30%, rgba(168,85,247,0.08) 0%, transparent 70%),
              radial-gradient(ellipse 70% 40% at 50% 80%, rgba(236,72,153,0.06) 0%, transparent 70%)
            `,
            animation: 'aurora 25s ease-in-out infinite alternate',
          }}
        />

        <div style={{ position: 'relative', maxWidth: '680px', margin: '0 auto' }}>
          <motion.h1
            variants={fadeUp}
            style={{
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 900,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              marginBottom: '16px',
            }}
          >
            Every design thinking tool.
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #818cf8 0%, #e879f9 50%, #fb923c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% 200%',
                animation: 'shimmer 6s ease-in-out infinite',
              }}
            >
              Beautifully deployed.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            style={{
              fontSize: '17px', color: '#6b7394', lineHeight: 1.6,
              maxWidth: '540px', margin: '0 auto 24px',
            }}
          >
            Browse {totalToolCount}+ visual thinking tools used by the world's best design teachers.
            Filter by phase, type, or deploy mode — launch any interactive tool in one click.
          </motion.p>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            style={{
              display: 'flex', justifyContent: 'center', gap: '32px',
              flexWrap: 'wrap', marginBottom: '24px',
            }}
          >
            {[
              { n: interactiveCount, label: 'Interactive' },
              { n: tools.length, label: 'Total Tools' },
              { n: 13, label: 'Categories' },
              { n: 4, label: 'Deploy Modes' },
            ].map((stat) => (
              <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{
                  fontSize: '28px', fontWeight: 800,
                  background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {stat.n}
                </div>
                <div style={{
                  fontSize: '11px', color: '#3d4260', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '1px',
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Framework badges */}
          <motion.div
            variants={fadeUp}
            style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}
          >
            {['IB MYP Design', 'GCSE Design & Tech', 'A-Level DT', 'ACARA', 'PLTW', 'Stanford d.school', 'IDEO', 'Double Diamond'].map((fw) => (
              <span
                key={fw}
                style={{
                  fontSize: '11px', fontWeight: 600, padding: '4px 12px',
                  borderRadius: '20px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)', color: '#6b7394',
                }}
              >
                {fw}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* ═══ CONTROLS (sticky) ═══ */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(6,6,15,0.82)',
          backdropFilter: 'blur(20px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '16px 24px' }}>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <svg
              style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                color: '#3d4260', pointerEvents: 'none', width: '18px', height: '18px',
              }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tools by name, description, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px 12px 46px',
                background: '#0d0d1a', border: '1.5px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', color: '#e8eaf0', fontSize: '14px',
                fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(129,140,248,0.4)';
                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(129,140,248,0.06)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <div style={{
              position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#3d4260',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '4px', padding: '2px 7px', pointerEvents: 'none',
            }}>
              /
            </div>
          </div>

          {/* Filter rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Phase */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#3d4260', textTransform: 'uppercase', letterSpacing: '1.2px', minWidth: '56px' }}>Phase</div>
              {phases.map((phase) => (
                <motion.button
                  key={phase.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedPhase(phase.value)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    border: '1.5px solid rgba(255,255,255,0.06)',
                    background: selectedPhase === phase.value && phase.color ? phase.color
                      : selectedPhase === phase.value ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: selectedPhase === phase.value ? '#fff' : '#6b7394',
                    cursor: 'pointer', transition: 'background 0.2s, color 0.2s', whiteSpace: 'nowrap',
                  }}
                >
                  {phase.label}
                </motion.button>
              ))}
            </div>

            {/* Type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#3d4260', textTransform: 'uppercase', letterSpacing: '1.2px', minWidth: '56px' }}>Type</div>
              {types.map((type) => (
                <motion.button
                  key={type.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedType(type.value)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    border: selectedType === type.value ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid rgba(255,255,255,0.06)',
                    background: selectedType === type.value ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: selectedType === type.value ? '#fff' : '#6b7394',
                    cursor: 'pointer', transition: 'background 0.2s, color 0.2s', whiteSpace: 'nowrap',
                  }}
                >
                  {type.label}
                </motion.button>
              ))}
            </div>

            {/* Deploy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#3d4260', textTransform: 'uppercase', letterSpacing: '1.2px', minWidth: '56px' }}>Deploy</div>
              {deployModes.map((mode) => (
                <motion.button
                  key={mode.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDeployMode(mode.value)}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    border: '1.5px solid rgba(255,255,255,0.06)',
                    background: selectedDeployMode === mode.value ? 'rgba(16,185,129,0.12)' : 'transparent',
                    color: selectedDeployMode === mode.value ? '#34d399' : '#6b7394',
                    cursor: 'pointer', transition: 'background 0.2s, color 0.2s',
                    display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{mode.icon}</span>
                  {mode.label}
                </motion.button>
              ))}

              {/* Clear filters */}
              <AnimatePresence>
                {hasActiveFilter && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={clearFilters}
                    style={{
                      marginLeft: 'auto', padding: '6px 14px', borderRadius: '6px',
                      fontSize: '11px', fontWeight: 600, border: '1px solid rgba(239,68,68,0.2)',
                      background: 'rgba(239,68,68,0.08)', color: '#f87171',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    Clear filters
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TOOL GRID ═══ */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <motion.div
            key={filteredTools.length}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ fontSize: '13px', color: '#3d4260', fontWeight: 500 }}
          >
            Showing {filteredTools.length} of {tools.length} tools
          </motion.div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['grid', 'list'] as ViewMode[]).map((vm) => (
              <motion.button
                key={vm}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setViewMode(vm)}
                style={{
                  width: '32px', height: '32px', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: viewMode === vm ? '#0d0d1a' : 'transparent',
                  color: viewMode === vm ? '#e8eaf0' : '#3d4260',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {vm === 'grid' ? '▦' : '≡'}
              </motion.button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {filteredTools.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center', padding: '80px 20px' }}
            >
              <div style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
              <h3 style={{ fontSize: '18px', color: '#e8eaf0', marginBottom: '8px', fontWeight: 700 }}>No tools found</h3>
              <p style={{ fontSize: '14px', color: '#6b7394' }}>Try adjusting your filters or search query</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${selectedPhase}-${selectedType}-${selectedDeployMode}-${searchQuery}-${viewMode}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: 'grid',
                gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
                gap: '16px',
              }}
            >
              {filteredTools.map((tool) => (
                <motion.div
                  key={tool.name}
                  variants={cardVariants}
                  layout
                  whileHover={{
                    y: -6,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(99,102,241,0.04)',
                    borderColor: 'rgba(255,255,255,0.12)',
                  }}
                  onClick={() => tool.slug && router.push(`/toolkit/${tool.slug}`)}
                  style={{
                    background: '#0d0d1a',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    cursor: tool.slug ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                >
                  {/* Card visual */}
                  <div
                    style={{
                      height: '180px', position: 'relative',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', background: tool.bg,
                    }}
                  >
                    <svg dangerouslySetInnerHTML={{ __html: tool.svg }} style={{ width: '100%', height: '100%' }} />

                    {/* Badges */}
                    <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                      {tool.slug ? (
                        <div style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                          backdropFilter: 'blur(8px)', letterSpacing: '0.3px',
                          background: 'rgba(99,102,241,0.2)', color: '#818cf8',
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                          <span style={{ fontSize: '8px' }}>▶</span> Interactive
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                          backdropFilter: 'blur(8px)', letterSpacing: '0.3px',
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
                        }}>
                          Template
                        </div>
                      )}
                      <div style={{
                        fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                        backdropFilter: 'blur(8px)', letterSpacing: '0.3px',
                        background: getDifficultyColor(tool.difficulty).bg,
                        color: getDifficultyColor(tool.difficulty).text,
                        textTransform: 'capitalize',
                      }}>
                        {tool.difficulty}
                      </div>
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '18px', position: 'relative' }}>
                    <div style={{
                      fontSize: '16px', fontWeight: 700, color: '#fff',
                      marginBottom: '6px', letterSpacing: '-0.2px',
                    }}>
                      {tool.name}
                    </div>

                    <div style={{
                      fontSize: '12.5px', color: '#6b7394', lineHeight: 1.55,
                      marginBottom: '14px', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {tool.desc}
                    </div>

                    {/* Phase + type tags */}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      {tool.phases.map((phase) => {
                        const c = getPhaseTagColor(phase);
                        return (
                          <span key={phase} style={{
                            fontSize: '10px', fontWeight: 600, padding: '3px 9px', borderRadius: '4px',
                            letterSpacing: '0.2px', background: c.bg, color: c.text, textTransform: 'capitalize',
                          }}>
                            {phase}
                          </span>
                        );
                      })}
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '3px 9px', borderRadius: '4px',
                        background: 'rgba(255,255,255,0.04)', color: '#6b7394', textTransform: 'capitalize',
                      }}>
                        {tool.type}
                      </span>
                    </div>

                    {/* Meta */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ fontSize: '11px', color: '#3d4260', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⏱ {tool.time}
                      </div>
                      <div style={{ fontSize: '11px', color: '#3d4260' }}>
                        👥 {tool.people}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ COMING SOON CATEGORIES ═══ */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0 24px 60px' }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={comingSoonVariants}
        >
          {/* Section header */}
          <motion.div
            variants={fadeUp}
            style={{
              textAlign: 'center', marginBottom: '48px',
              paddingTop: '48px', borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{
              display: 'inline-block', fontSize: '10px', fontWeight: 700, letterSpacing: '2px',
              textTransform: 'uppercase', color: '#818cf8', marginBottom: '12px',
              padding: '5px 16px', borderRadius: '20px',
              background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)',
            }}>
              Coming Soon
            </div>
            <h2 style={{
              fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800,
              letterSpacing: '-1px', marginBottom: '12px',
            }}>
              Beyond design thinking.
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #818cf8, #34d399)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Tools for every thinking skill.
              </span>
            </h2>
            <p style={{ fontSize: '15px', color: '#6b7394', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
              We&apos;re expanding the toolkit with 6 new categories — 30+ tools for
              self-discovery, collaboration, visual thinking, planning, communication, and metacognition.
            </p>
          </motion.div>

          {/* Category cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '20px',
          }}>
            {COMING_SOON.map((cat) => (
              <motion.div
                key={cat.id}
                variants={comingSoonCard}
                whileHover={{
                  y: -4,
                  borderColor: `${cat.color}40`,
                  boxShadow: `0 12px 40px rgba(0,0,0,0.2), 0 0 30px ${cat.color}08`,
                }}
                style={{
                  background: '#0d0d1a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px',
                  padding: '28px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Glow background */}
                <div style={{
                  position: 'absolute', top: '-30px', right: '-30px',
                  width: '120px', height: '120px', borderRadius: '50%',
                  background: `radial-gradient(circle, ${cat.color}10 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '28px', width: '48px', height: '48px', borderRadius: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${cat.color}12`, border: `1px solid ${cat.color}20`,
                    }}>
                      {cat.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
                        {cat.name}
                      </h3>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, color: cat.color,
                        background: `${cat.color}15`, padding: '2px 8px', borderRadius: '8px',
                      }}>
                        {cat.tools.length} tools planned
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '13px', color: '#6b7394', lineHeight: 1.5, marginBottom: '16px' }}>
                    {cat.desc}
                  </p>

                  {/* Tool list */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {cat.tools.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: '6px',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                          color: '#6b7394',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        textAlign: 'center', padding: '48px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '40px',
      }}>
        <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Studio
          <span style={{
            background: 'linear-gradient(135deg, #818cf8, #e879f9)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Loom
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#3d4260', lineHeight: 1.6 }}>
          Design thinking toolkit for every student.<br />
          <a
            href="#"
            style={{ color: '#818cf8', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e879f9')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#818cf8')}
          >
            Learn more about StudioLoom
          </a>
        </p>
      </div>
    </div>
  );
}
