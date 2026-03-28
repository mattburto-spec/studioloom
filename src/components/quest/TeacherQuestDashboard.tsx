'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuestJourney, QuestPhase, MentorId, HelpIntensity, HealthScore } from '@/lib/quest/types';
import { PHASE_LABELS, PHASE_ORDER } from '@/lib/quest/types';
import { getHealthColor } from '@/lib/quest/health';
import { StudentQuestCard } from './StudentQuestCard';
import { QuestDetailPanel } from './QuestDetailPanel';

interface JourneyWithMeta {
  id: string;
  student_id: string;
  phase: QuestPhase;
  mentor_id: MentorId | null;
  help_intensity: HelpIntensity;
  health_score: HealthScore;
  started_at: string;
  updated_at: string;
  students: { id: string; display_name: string };
  milestone_progress: { total: number; completed: number };
  pending_evidence_count: number;
}

interface TeacherQuestDashboardProps {
  unitId: string;
  classId?: string;
  unitTitle?: string;
  className?: string;
}

const PHASE_COLORS: Record<QuestPhase, string> = {
  not_started: '#6B7280',
  discovery: '#F59E0B',
  planning: '#6366F1',
  working: '#10B981',
  sharing: '#8B5CF6',
  completed: '#22C55E',
};

function countPhaseStudents(journeys: JourneyWithMeta[], phase: QuestPhase): number {
  return journeys.filter(j => j.phase === phase).length;
}

function countNeedsAttention(journeys: JourneyWithMeta[]): number {
  return journeys.filter(j => {
    const redDots = [j.health_score.momentum, j.health_score.engagement, j.health_score.quality, j.health_score.self_awareness]
      .filter(d => d === 'red').length;
    return redDots >= 2 || j.pending_evidence_count >= 5;
  }).length;
}

function countTotalPendingEvidence(journeys: JourneyWithMeta[]): number {
  return journeys.reduce((sum, j) => sum + j.pending_evidence_count, 0);
}

export function TeacherQuestDashboard({
  unitId,
  classId,
  unitTitle,
  className,
}: TeacherQuestDashboardProps) {
  const [journeys, setJourneys] = useState<JourneyWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<QuestPhase | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'phase' | 'health' | 'last_active'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch journeys
  const fetchJourneys = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({ unitId });
      if (classId) params.append('classId', classId);

      // Mock API for now — in production, this would be GET /api/teacher/quest?unitId=...&classId=...
      // The response would be: { journeys: JourneyWithMeta[] }
      const response = await fetch(`/api/teacher/quest?${params.toString()}`, {
        method: 'GET',
      });

      if (!response.ok) throw new Error(`Failed to fetch journeys: ${response.statusText}`);
      const data = await response.json();
      setJourneys(data.journeys || []);
    } catch (err) {
      console.error('[TeacherQuestDashboard] fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quest journeys');
      // For demo, set empty array
      setJourneys([]);
    } finally {
      setLoading(false);
    }
  }, [unitId, classId]);

  // Initial fetch + 30s auto-refresh
  useEffect(() => {
    fetchJourneys();
    const interval = setInterval(fetchJourneys, 30000);
    return () => clearInterval(interval);
  }, [fetchJourneys]);

  // Filter and sort
  const filteredJourneys = journeys
    .filter(j => filterPhase === 'all' || j.phase === filterPhase)
    .filter(j => j.students.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.students.display_name.localeCompare(b.students.display_name);
        case 'phase':
          return PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase);
        case 'health': {
          const redCountA = [a.health_score.momentum, a.health_score.engagement, a.health_score.quality, a.health_score.self_awareness]
            .filter(d => d === 'red').length;
          const redCountB = [b.health_score.momentum, b.health_score.engagement, b.health_score.quality, b.health_score.self_awareness]
            .filter(d => d === 'red').length;
          return redCountB - redCountA;
        }
        case 'last_active':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    });

  const needsAttentionCount = countNeedsAttention(journeys);
  const totalPendingEvidence = countTotalPendingEvidence(journeys);
  const selectedJourney = journeys.find(j => j.id === selectedJourneyId);

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    padding: '24px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '4px',
    color: '#f1f5f9',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '20px',
  };

  const statsRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '12px 16px',
    border: '1px solid #334155',
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#e2e8f0',
  };

  const phaseDotsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  };

  const phaseDotStyle = (phase: QuestPhase, count: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#cbd5e1',
  });

  const dotStyle = (color: string): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
  });

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '12px',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: '200px',
    padding: '8px 12px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '14px',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    flex: 0,
    minWidth: '120px',
  };

  const refreshButtonStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: '#334155',
    border: '1px solid #475569',
    borderRadius: '6px',
    color: '#cbd5e1',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease-out',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  };

  const alertBannerStyle: React.CSSProperties = {
    backgroundColor: '#92400e30',
    border: '1px solid #92400e',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '20px',
    fontSize: '13px',
    color: '#fef3c7',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  };

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    color: '#64748b',
    textAlign: 'center',
  };

  const emptyIconStyle: React.CSSProperties = {
    fontSize: '48px',
    marginBottom: '12px',
    opacity: 0.5,
  };

  const emptyTitleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '4px',
  };

  const emptySubtitleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#475569',
  };

  // Render loading skeleton
  if (loading && journeys.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div
            style={{
              ...titleStyle,
              backgroundColor: '#1e293b',
              width: '200px',
              height: '24px',
              borderRadius: '4px',
              animation: 'pulse 2s infinite',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <motion.div style={headerStyle} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div style={titleStyle}>Quest Journeys</div>
        {unitTitle && classId && (
          <div style={subtitleStyle}>
            {unitTitle} • {className}
          </div>
        )}

        {/* Stats */}
        <div style={statsRowStyle}>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>Students</div>
            <div style={statValueStyle}>{journeys.length}</div>
          </div>

          <div style={statCardStyle}>
            <div style={statLabelStyle}>Phase Distribution</div>
            <div style={phaseDotsStyle}>
              {PHASE_ORDER.map(phase => {
                const count = countPhaseStudents(journeys, phase);
                if (count === 0) return null;
                return (
                  <div key={phase} style={phaseDotStyle(phase, count)}>
                    <div style={dotStyle(PHASE_COLORS[phase])} />
                    {count}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={statCardStyle}>
            <div style={statLabelStyle}>Needs Attention</div>
            <div style={{ ...statValueStyle, color: needsAttentionCount > 0 ? '#ef4444' : '#22c55e' }}>
              {needsAttentionCount}
            </div>
          </div>

          <div style={statCardStyle}>
            <div style={statLabelStyle}>Pending Evidence</div>
            <div style={{ ...statValueStyle, color: totalPendingEvidence > 0 ? '#f59e0b' : '#22c55e' }}>
              {totalPendingEvidence}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={controlsStyle}>
          <input
            type="text"
            placeholder="Search student name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={inputStyle}
          />

          <select
            value={filterPhase}
            onChange={e => setFilterPhase(e.target.value as QuestPhase | 'all')}
            style={selectStyle}
          >
            <option value="all">All Phases</option>
            {PHASE_ORDER.map(phase => (
              <option key={phase} value={phase}>
                {PHASE_LABELS[phase]}
              </option>
            ))}
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={selectStyle}>
            <option value="name">Sort: Name</option>
            <option value="phase">Sort: Phase</option>
            <option value="health">Sort: Health</option>
            <option value="last_active">Sort: Last Active</option>
          </select>

          <button
            style={refreshButtonStyle}
            onClick={() => {
              setIsRefreshing(true);
              fetchJourneys().finally(() => setIsRefreshing(false));
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#475569';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#334155';
            }}
          >
            {isRefreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
          </button>
        </div>
      </motion.div>

      {/* Content */}
      <div style={contentStyle}>
        {/* Alert banner */}
        {needsAttentionCount > 0 && (
          <motion.div
            style={alertBannerStyle}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <strong>⚠️ {needsAttentionCount} student(s) need attention</strong> — 2+ red health indicators or 5+ pending evidence.
            {journeys
              .filter(j => {
                const redDots = [j.health_score.momentum, j.health_score.engagement, j.health_score.quality, j.health_score.self_awareness]
                  .filter(d => d === 'red').length;
                return redDots >= 2 || j.pending_evidence_count >= 5;
              })
              .slice(0, 3)
              .map(j => (
                <span key={j.id} style={{ marginLeft: '8px' }}>
                  <button
                    onClick={() => setSelectedJourneyId(j.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fef3c7',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    {j.students.display_name}
                  </button>
                </span>
              ))}
          </motion.div>
        )}

        {/* Error banner */}
        {error && (
          <motion.div
            style={{
              backgroundColor: '#7f1d1d30',
              border: '1px solid #991b1b',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#fca5a5',
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <strong>Error:</strong> {error}
            <button
              onClick={() => {
                setError(null);
                setIsRefreshing(true);
                fetchJourneys().finally(() => setIsRefreshing(false));
              }}
              style={{
                marginLeft: '12px',
                background: 'none',
                border: 'none',
                color: '#fca5a5',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* Student card grid */}
        {filteredJourneys.length > 0 ? (
          <motion.div style={gridStyle} layout>
            <AnimatePresence>
              {filteredJourneys.map((journey, index) => (
                <motion.div
                  key={journey.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <StudentQuestCard
                    journey={journey}
                    onSelect={() => setSelectedJourneyId(journey.id)}
                    isSelected={selectedJourneyId === journey.id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div style={emptyStateStyle}>
            <div style={emptyIconStyle}>📜</div>
            <div style={emptyTitleStyle}>No students yet</div>
            <div style={emptySubtitleStyle}>
              {searchQuery || filterPhase !== 'all'
                ? 'No journeys match your filters'
                : 'Students will appear here once they begin their quest'}
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedJourney && (
        <QuestDetailPanel
          isOpen={!!selectedJourneyId}
          onClose={() => setSelectedJourneyId(null)}
          journey={selectedJourney as unknown as QuestJourney & { students: { display_name: string } }}
          milestones={[]}
          evidence={[]}
        />
      )}
    </div>
  );
}

export default TeacherQuestDashboard;
