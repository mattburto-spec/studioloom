'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { tools, Phase, PHASE_COLORS, PHASE_LABELS, SEARCH_RULES, COMING_SOON, TOOLKIT_TABS, getToolUrl } from './tools-data';
import { ToolkitThumbnail } from './toolkit-thumbnails';

/* ── Animation variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

/* ── Helpers ─────────────────────────────────────────────────── */
const getDifficultyColor = (d: string) =>
  d === 'beginner' ? { bg: 'rgba(16,185,129,0.15)', text: '#34d399' }
  : d === 'intermediate' ? { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' }
  : d === 'advanced' ? { bg: 'rgba(239,68,68,0.15)', text: '#f87171' }
  : { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' };

function aiSearch(query: string): string[] {
  const q = query.toLowerCase();
  const matched = new Set<string>();
  for (const rule of SEARCH_RULES) {
    if (rule.keywords.some(kw => q.includes(kw))) {
      rule.tools.forEach(t => matched.add(t));
    }
  }
  return Array.from(matched);
}

/* ── Phase pill config ────────────────────────────────────────── */
const PHASE_EMOJI: Record<Phase, string> = {
  discover: '\uD83D\uDD0D',
  define: '\uD83D\uDCCB',
  ideate: '\uD83D\uDCA1',
  prototype: '\uD83D\uDD27',
  test: '\u2714\uFE0F',
};

/* ── Toolkit category tabs (imported from tools-data.ts) ───── */

/* ── Main page component ────────────────────────────────────── */
export default function ToolkitPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<Phase | 'all'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && searchInputRef.current && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Phase counts
  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tools.length };
    for (const t of tools) counts[t.phase] = (counts[t.phase] || 0) + 1;
    return counts;
  }, []);

  const { filteredTools, aiActive } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = tools;
    let matched = false;

    if (selectedPhase !== 'all') {
      result = result.filter(t => t.phase === selectedPhase);
    }

    if (q) {
      const aiMatches = aiSearch(q);
      matched = aiMatches.length > 0;
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.id.includes(q) ||
        aiMatches.includes(t.id)
      );
    }

    return { filteredTools: result, aiActive: matched };
  }, [searchQuery, selectedPhase]);

  const handlePhaseClick = (phase: Phase | 'all') => {
    setSelectedPhase(prev => prev === phase ? 'all' : phase);
    setTimeout(() => {
      if (gridRef.current) {
        const y = gridRef.current.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div
      style={{
        background: '#0a0a14',
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

      {/* ═══ HERO with gradient background ═══ */}
      <motion.div
        initial="hidden"
        animate="visible"
        style={{
          position: 'relative',
          padding: 'clamp(40px, 4vw, 56px) 24px 0',
          textAlign: 'center',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0a0a12 0%, #1a1030 40%, #0d1a2a 70%, #0a0a12 100%)',
        }}
      >
        {/* Aurora glow orbs */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: `
              radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.15) 0%, transparent 60%),
              radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.1) 0%, transparent 60%),
              radial-gradient(ellipse at 50% 50%, rgba(236,72,153,0.06) 0%, transparent 50%)
            `,
            animation: 'aurora 25s ease-in-out infinite alternate',
          }}
        />

        <div style={{ position: 'relative', maxWidth: '680px', margin: '0 auto' }}>
          <motion.h1
            variants={fadeUp}
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 900,
              letterSpacing: '-1.5px',
              lineHeight: 1.15,
              marginBottom: '12px',
            }}
          >
            StudioLoom{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% 200%',
                animation: 'shimmer 6s ease-in-out infinite',
              }}
            >
              Toolkit
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            style={{
              fontSize: '15px', color: '#9393b0', lineHeight: 1.6,
              maxWidth: '480px', margin: '0 auto',
            }}
          >
            Tools to think better, design smarter, and solve real problems
          </motion.p>
        </div>

        {/* ── Category tabs (inside hero) ── */}
        <div style={{ position: 'relative', marginTop: '28px' }}>
          {/* Neon gradient line */}
          <div style={{
            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: 'min(700px, 90%)', height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6) 20%, rgba(96,165,250,0.5) 50%, rgba(139,92,246,0.6) 80%, transparent)',
            boxShadow: '0 0 8px rgba(139,92,246,0.3), 0 0 20px rgba(139,92,246,0.15)',
          }} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
            {TOOLKIT_TABS.map((tab) => (
              <div
                key={tab.id}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px 10px 0 0',
                  fontSize: '13px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: tab.active ? 'default' : 'not-allowed',
                  position: 'relative',
                  zIndex: tab.active ? 1 : 0,
                  marginBottom: '-1px',
                  ...(tab.active ? {
                    background: 'rgba(139,92,246,0.2)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderBottom: '2px solid #0a0a14',
                    color: '#a78bfa',
                  } : {
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderBottom: 'none',
                    color: '#4a4a6a',
                    opacity: 0.5,
                  }),
                }}
              >
                {tab.label}
                {!tab.active && (
                  <span style={{
                    fontSize: '9px', fontWeight: 600, marginLeft: '6px',
                    padding: '1px 6px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.04)', color: '#4a4a6a',
                    verticalAlign: 'middle',
                  }}>
                    Soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Large centered search bar (inside hero) ── */}
        <motion.div
          variants={fadeUp}
          style={{
            maxWidth: '640px', margin: '24px auto 0', position: 'relative',
            paddingBottom: '28px',
          }}
        >
          <svg
            style={{
              position: 'absolute', left: '16px', top: '14px',
              color: '#8b5cf6', width: '20px', height: '20px', pointerEvents: 'none',
            }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={`Try 'brainstorm ideas' or 'evaluate options'...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '14px 20px 14px 48px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px', color: '#e8eaf0', fontSize: '16px',
              fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </motion.div>
      </motion.div>

      {/* ═══ PHASE PILLS (centered, with icons + counts) ═══ */}
      <div style={{
        position: 'sticky', top: '49px', zIndex: 100,
        background: 'rgba(10,10,20,0.85)',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          padding: '14px 24px',
          display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap',
        }}>
          {(['all', 'discover', 'define', 'ideate', 'prototype', 'test'] as const).map((phase) => {
            const isActive = selectedPhase === phase;
            const color = phase === 'all' ? '#e8eaf0' : PHASE_COLORS[phase];
            const label = phase === 'all' ? 'All' : PHASE_LABELS[phase];
            const count = phaseCounts[phase] || 0;
            const emoji = phase === 'all' ? null : PHASE_EMOJI[phase];

            return (
              <motion.button
                key={phase}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePhaseClick(phase)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                  whiteSpace: 'nowrap',
                  border: `1.5px solid ${
                    isActive
                      ? (phase === 'all' ? 'rgba(255,255,255,0.3)' : `${color}99`)
                      : (phase === 'all' ? 'rgba(255,255,255,0.12)' : `${color}40`)
                  }`,
                  background: isActive
                    ? (phase === 'all' ? 'rgba(255,255,255,0.12)' : `${color}25`)
                    : (phase === 'all' ? 'rgba(255,255,255,0.06)' : `${color}12`),
                  color: isActive ? (phase === 'all' ? '#e8eaf0' : color) : (phase === 'all' ? 'rgba(255,255,255,0.5)' : `${color}cc`),
                  boxShadow: isActive ? `0 0 16px ${phase === 'all' ? 'rgba(255,255,255,0.08)' : `${color}25`}` : 'none',
                }}
              >
                {emoji && <span style={{ fontSize: '15px' }}>{emoji}</span>}
                {label}
                <span style={{ fontSize: '12px', opacity: 0.6, fontWeight: 500 }}>{count}</span>
                {isActive && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ═══ TOOL GRID ═══ */}
      <div ref={gridRef} style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 24px 40px' }}>
        {/* Toolbar row: count + view toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: '12px', marginBottom: '16px',
        }}>
          <motion.span
            key={filteredTools.length}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: '12px', color: '#6b6b8a', fontWeight: 500, marginRight: 'auto' }}
          >
            {filteredTools.length} of {tools.length} tools
            {selectedPhase !== 'all' && (
              <span style={{ color: PHASE_COLORS[selectedPhase], marginLeft: '6px' }}>
                in {PHASE_LABELS[selectedPhase]}
              </span>
            )}
            {aiActive && (
              <span style={{
                marginLeft: '8px', fontSize: '10px', fontWeight: 600,
                color: '#a78bfa', background: 'rgba(167,139,250,0.1)',
                padding: '2px 8px', borderRadius: '4px',
              }}>
                AI matched
              </span>
            )}
          </motion.span>

          {/* Grid / List toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '10px',
            padding: '3px',
          }}>
            <button style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: 'rgba(139,92,246,0.25)', color: '#e8eaf0',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>
              Grid
            </button>
            <button style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: 'none', color: '#6b6b8a',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>
              List
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {filteredTools.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center', padding: '60px 20px' }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.4 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h3 style={{ fontSize: '16px', color: '#e8eaf0', marginBottom: '6px', fontWeight: 700 }}>No tools match</h3>
              <p style={{ fontSize: '13px', color: '#6b7394' }}>Try a different search or clear the phase filter</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${selectedPhase}-${searchQuery}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '14px',
              }}
            >
              {filteredTools.map((tool) => {
                const url = getToolUrl(tool.id);
                const phaseColor = PHASE_COLORS[tool.phase];
                const diff = getDifficultyColor(tool.difficulty);

                return (
                  <motion.div
                    key={tool.id}
                    variants={cardVariants}
                    layout
                    whileHover={{
                      y: -4,
                      boxShadow: `0 16px 48px rgba(0,0,0,0.3), 0 0 24px ${phaseColor}08`,
                      borderColor: 'rgba(255,255,255,0.1)',
                    }}
                    onClick={() => url && router.push(url)}
                    style={{
                      background: '#0d0d1a',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      cursor: url ? 'pointer' : 'default',
                      position: 'relative',
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        height: '130px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${phaseColor}08 0%, ${phaseColor}03 100%)`,
                        padding: '16px',
                      }}
                    >
                      <ToolkitThumbnail toolId={tool.id} phase={tool.phase} />

                      {/* INTERACTIVE badge */}
                      {tool.interactive && (
                        <div style={{
                          position: 'absolute', top: '10px', right: '10px',
                          fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
                          background: 'rgba(129,140,248,0.2)', color: '#a78bfa',
                          letterSpacing: '0.5px', textTransform: 'uppercase',
                        }}>
                          Interactive
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div style={{ padding: '14px 16px 16px' }}>
                      <div style={{
                        fontSize: '14px', fontWeight: 700, color: '#fff',
                        marginBottom: '4px', letterSpacing: '-0.2px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {tool.name}
                      </div>

                      <div style={{
                        fontSize: '12px', color: '#6b7394', lineHeight: 1.5,
                        marginBottom: '12px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {tool.desc}
                      </div>

                      {/* Meta row */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)',
                      }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                          background: `${phaseColor}18`, color: phaseColor, textTransform: 'capitalize',
                        }}>
                          {tool.phase}
                        </span>

                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                          background: diff.bg, color: diff.text, textTransform: 'capitalize',
                        }}>
                          {tool.difficulty}
                        </span>

                        <span style={{
                          fontSize: '10px', color: '#3d4260', marginLeft: 'auto',
                        }}>
                          {tool.time}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ COMING SOON CATEGORIES ═══ */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 60px' }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <motion.div
            variants={fadeUp}
            style={{
              textAlign: 'center', marginBottom: '32px',
              paddingTop: '40px', borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{
              display: 'inline-block', fontSize: '10px', fontWeight: 700, letterSpacing: '2px',
              textTransform: 'uppercase', color: '#818cf8', marginBottom: '10px',
              padding: '4px 14px', borderRadius: '20px',
              background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)',
            }}>
              Coming Soon
            </div>
            <h2 style={{
              fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800,
              letterSpacing: '-0.8px', marginBottom: '8px',
            }}>
              Beyond design thinking.{' '}
              <span style={{
                background: 'linear-gradient(135deg, #818cf8, #34d399)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                More toolkits on the way.
              </span>
            </h2>
          </motion.div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '14px',
          }}>
            {COMING_SOON.map((cat) => (
              <motion.div
                key={cat.name}
                variants={cardVariants}
                style={{
                  background: '#0d0d1a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e8eaf0', marginBottom: '10px' }}>
                  {cat.name}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {cat.tools.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                        color: '#4a4f6a',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        textAlign: 'center', padding: '36px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
          Studio
          <span style={{
            background: 'linear-gradient(135deg, #818cf8, #e879f9)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Loom
          </span>
        </div>
        <p style={{ fontSize: '12px', color: '#3d4260', lineHeight: 1.5 }}>
          Design thinking toolkit for every student.
        </p>
      </div>
    </div>
  );
}
