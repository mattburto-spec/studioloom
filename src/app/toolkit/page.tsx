'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { tools, Phase, DeployMode, ToolType } from './tools-data';

type ViewMode = 'grid' | 'list';

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

  // Filter tools
  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      !searchQuery ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tool.synonyms && tool.synonyms.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPhase = selectedPhase === 'all' || tool.phases.includes(selectedPhase);
    const matchesType = selectedType === 'all' || tool.type === selectedType;
    const matchesDeployMode =
      selectedDeployMode === 'all' || tool.modes.includes(selectedDeployMode);

    return matchesSearch && matchesPhase && matchesType && matchesDeployMode;
  });

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

  const getPhaseColor = (phase: Phase): string => {
    const phaseObj = phases.find((p) => p.value === phase);
    return phaseObj?.color || '#6366f1';
  };

  const getPhaseTagColor = (phase: Phase): { bg: string; text: string } => {
    const colorMap: Record<Phase, { bg: string; text: string }> = {
      discover: { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' },
      define: { bg: 'rgba(236,72,153,0.12)', text: '#f472b6' },
      ideate: { bg: 'rgba(168,85,247,0.12)', text: '#c084fc' },
      prototype: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
      test: { bg: 'rgba(16,185,129,0.12)', text: '#34d399' },
    };
    return colorMap[phase] ?? { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' };
  };

  const getDifficultyColor = (difficulty: string): { bg: string; text: string } => {
    switch (difficulty) {
      case 'beginner':
        return { bg: 'rgba(16,185,129,0.15)', text: '#34d399' };
      case 'intermediate':
        return { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' };
      case 'advanced':
        return { bg: 'rgba(239,68,68,0.15)', text: '#f87171' };
      default:
        return { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' };
    }
  };

  return (
    <div
      style={{
        background: '#06060f',
        color: '#e8eaf0',
        minHeight: '100vh',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      {/* HERO */}
      <div
        style={{
          position: 'relative',
          padding: 'clamp(48px, 5vw, 72px) 24px 48px',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Aurora gradient background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 80% 60% at 20% 40%, rgba(99,102,241,0.12) 0%, transparent 70%),
              radial-gradient(ellipse 60% 50% at 80% 30%, rgba(168,85,247,0.08) 0%, transparent 70%),
              radial-gradient(ellipse 70% 40% at 50% 80%, rgba(236,72,153,0.06) 0%, transparent 70%)
            `,
            animation: 'aurora 25s ease-in-out infinite alternate',
          }}
        />

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

        <div style={{ position: 'relative', maxWidth: '680px', margin: '0 auto' }}>
          <h1
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
          </h1>

          <p
            style={{
              fontSize: '17px',
              color: '#6b7394',
              lineHeight: 1.6,
              maxWidth: '540px',
              margin: '0 auto 24px',
            }}
          >
            Browse {tools.length}+ visual thinking tools used by the world's best design teachers.
            Filter by design process phase. Deploy as a presentation, printable, group activity, or
            solo task — in one click.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '32px',
              flexWrap: 'wrap',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {tools.length}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#3d4260',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Tools
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                7
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#3d4260',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Categories
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                4
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#3d4260',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Deploy Modes
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {[
              'IB MYP Design',
              'GCSE Design & Tech',
              'A-Level DT',
              'ACARA',
              'PLTW',
              'Stanford d.school',
              'IDEO',
              'Double Diamond',
            ].map((framework) => (
              <span
                key={framework}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: '20px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#6b7394',
                  transition: 'all 0.2s',
                }}
              >
                {framework}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
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
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#3d4260',
                pointerEvents: 'none',
                width: '18px',
                height: '18px',
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tools by name, description, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 46px',
                background: '#0d0d1a',
                border: '1.5px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                color: '#e8eaf0',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
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
            <div
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: '#3d4260',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '4px',
                padding: '2px 7px',
                pointerEvents: 'none',
              }}
            >
              /
            </div>
          </div>

          {/* Filter rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Phase filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#3d4260',
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  minWidth: '56px',
                }}
              >
                Phase
              </div>
              {phases.map((phase) => (
                <button
                  key={phase.value}
                  onClick={() => setSelectedPhase(phase.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '1.5px solid rgba(255,255,255,0.06)',
                    background:
                      selectedPhase === phase.value && phase.color
                        ? phase.color
                        : selectedPhase === phase.value
                          ? 'rgba(255,255,255,0.1)'
                          : 'transparent',
                    color:
                      selectedPhase === phase.value
                        ? '#fff'
                        : phase.value !== 'all'
                          ? '#6b7394'
                          : '#6b7394',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {phase.label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#3d4260',
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  minWidth: '56px',
                }}
              >
                Type
              </div>
              {types.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border:
                      selectedType === type.value
                        ? '1.5px solid rgba(255,255,255,0.2)'
                        : '1.5px solid rgba(255,255,255,0.06)',
                    background:
                      selectedType === type.value ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: selectedType === type.value ? '#fff' : '#6b7394',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Deploy mode filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#3d4260',
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  minWidth: '56px',
                }}
              >
                Deploy
              </div>
              {deployModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setSelectedDeployMode(mode.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '1.5px solid rgba(255,255,255,0.06)',
                    background:
                      selectedDeployMode === mode.value
                        ? 'rgba(16,185,129,0.12)'
                        : 'transparent',
                    color:
                      selectedDeployMode === mode.value ? '#34d399' : '#6b7394',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '13px', color: '#3d4260', fontWeight: 500 }}>
            Showing {filteredTools.length} of {tools.length} tools
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.06)',
                background: viewMode === 'grid' ? '#0d0d1a' : 'transparent',
                color: viewMode === 'grid' ? '#e8eaf0' : '#3d4260',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.06)',
                background: viewMode === 'list' ? '#0d0d1a' : 'transparent',
                color: viewMode === 'list' ? '#e8eaf0' : '#3d4260',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              ≡
            </button>
          </div>
        </div>

        {filteredTools.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
            <h3 style={{ fontSize: '18px', color: '#e8eaf0', marginBottom: '8px', fontWeight: 700 }}>
              No tools found
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7394' }}>
              Try adjusting your filters or search query
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
              gap: '16px',
            }}
          >
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                onClick={() => tool.slug && router.push(`/toolkit/${tool.slug}`)}
                style={{
                  background: '#0d0d1a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  cursor: tool.slug ? 'pointer' : 'default',
                  transition: 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.35s cubic-bezier(0.25,0.46,0.45,0.94), border-color 0.3s',
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  willChange: 'transform',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'translateY(-4px) perspective(800px) rotateX(1deg)';
                  el.style.boxShadow =
                    '0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(99,102,241,0.04)';
                  el.style.borderColor = 'rgba(255,255,255,0.12)';
                  // Reveal deploy overlay
                  const overlay = el.querySelector('[data-deploy-overlay]') as HTMLDivElement | null;
                  if (overlay) {
                    overlay.style.transform = 'translateY(0)';
                    overlay.style.pointerEvents = 'auto';
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'none';
                  el.style.boxShadow = 'none';
                  el.style.borderColor = 'rgba(255,255,255,0.06)';
                  // Hide deploy overlay
                  const overlay = el.querySelector('[data-deploy-overlay]') as HTMLDivElement | null;
                  if (overlay) {
                    overlay.style.transform = 'translateY(100%)';
                    overlay.style.pointerEvents = 'none';
                  }
                }}
              >
                {/* Card visual */}
                <div
                  style={{
                    height: '180px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: tool.bg,
                  }}
                >
                  <svg
                    dangerouslySetInnerHTML={{ __html: tool.svg }}
                    style={{ width: '100%', height: '100%' }}
                  />

                  {/* Badges */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}>
                    {tool.slug ? (
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '20px',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          letterSpacing: '0.3px',
                          background: 'rgba(99,102,241,0.2)',
                          color: '#818cf8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ fontSize: '8px' }}>▶</span> Interactive
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '20px',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          letterSpacing: '0.3px',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        Template
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        letterSpacing: '0.3px',
                        background: getDifficultyColor(tool.difficulty).bg,
                        color: getDifficultyColor(tool.difficulty).text,
                        textTransform: 'capitalize',
                      }}
                    >
                      {tool.difficulty}
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: '18px', position: 'relative' }}>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#fff',
                      marginBottom: '6px',
                      letterSpacing: '-0.2px',
                    }}
                  >
                    {tool.name}
                  </div>

                  <div
                    style={{
                      fontSize: '12.5px',
                      color: '#6b7394',
                      lineHeight: 1.55,
                      marginBottom: '14px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {tool.desc}
                  </div>

                  {/* Tags */}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {tool.phases.map((phase) => {
                      const colors = getPhaseTagColor(phase);
                      return (
                        <span
                          key={phase}
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: '4px',
                            letterSpacing: '0.2px',
                            background: colors.bg,
                            color: colors.text,
                            textTransform: 'capitalize',
                          }}
                        >
                          {phase}
                        </span>
                      );
                    })}
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: '4px',
                        letterSpacing: '0.2px',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#6b7394',
                        textTransform: 'capitalize',
                      }}
                    >
                      {tool.type}
                    </span>
                  </div>

                  {/* Meta */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#3d4260', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ⏱ {tool.time}
                    </div>
                    <div style={{ fontSize: '11px', color: '#3d4260' }}>👥 {tool.people}</div>
                  </div>

                  {/* Deploy overlay */}
                  <div
                    data-deploy-overlay
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(6,6,15,0.97) 60%, transparent)',
                      padding: '40px 18px 18px',
                      display: 'flex',
                      gap: '6px',
                      transform: 'translateY(100%)',
                      transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    {[
                      { mode: 'present', label: 'Present', icon: '▶', color: '#6366f1' },
                      { mode: 'print', label: 'Print', icon: '⎙', color: '#f59e0b' },
                      { mode: 'group', label: 'Group', icon: '👥', color: '#10b981' },
                      { mode: 'solo', label: 'Solo', icon: '👤', color: '#a855f7' },
                    ].map((btn) => {
                      const canDeploy = tool.modes.includes(btn.mode as DeployMode);
                      return (
                        <button
                          key={btn.mode}
                          disabled={!canDeploy}
                          style={{
                            flex: 1,
                            padding: '9px 6px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: canDeploy ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            background: canDeploy
                              ? btn.mode === 'present'
                                ? 'rgba(99,102,241,0.15)'
                                : btn.mode === 'print'
                                  ? 'rgba(245,158,11,0.15)'
                                  : btn.mode === 'group'
                                    ? 'rgba(16,185,129,0.15)'
                                    : 'rgba(168,85,247,0.15)'
                              : 'rgba(255,255,255,0.04)',
                            color: canDeploy ? btn.color : '#3d4260',
                            opacity: canDeploy ? 1 : 0.5,
                          }}
                        >
                          <span style={{ fontSize: '15px' }}>{btn.icon}</span>
                          <span style={{ fontSize: '10px' }}>{btn.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        style={{
          textAlign: 'center',
          padding: '48px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          marginTop: '40px',
        }}
      >
        <div
          style={{
            fontSize: '20px',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            marginBottom: '8px',
          }}
        >
          Studio
          <span
            style={{
              background: 'linear-gradient(135deg, #818cf8, #e879f9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
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
