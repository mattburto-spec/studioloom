'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuestJourney, QuestMilestone, QuestEvidence, MilestoneStatus } from '@/lib/quest/types';
import { getMentor } from '@/lib/quest/mentors';
import OverworldMap from './OverworldMap';
import { MilestoneCard } from './MilestoneCard';
import { EvidenceCapture } from './EvidenceCapture';

interface WorkingPhaseViewProps {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  evidence: QuestEvidence[];
  onMilestoneStatusChange?: (milestoneId: string, status: MilestoneStatus, note?: string) => void;
  onEvidenceSubmitted?: (evidence: QuestEvidence) => void;
  onPhaseAdvance?: () => void;
}

type FilterType = 'all' | 'active' | 'upcoming' | 'completed';

export function WorkingPhaseView({
  journey,
  milestones,
  evidence,
  onMilestoneStatusChange,
  onEvidenceSubmitted,
  onPhaseAdvance,
}: WorkingPhaseViewProps) {
  // State
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('active');
  const [focusedMilestoneId, setFocusedMilestoneId] = useState<string | null>(null);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [localEvidence, setLocalEvidence] = useState<QuestEvidence[]>(evidence);
  const [isDesktop, setIsDesktop] = useState(true);

  // Refs for scroll targets
  const milestoneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const evidenceCaptureRef = useRef<HTMLDivElement | null>(null);
  const checkInPanelRef = useRef<HTMLDivElement | null>(null);

  // Mentor info
  const mentor = getMentor(journey.mentor_id);
  const mentorColor = mentor?.primaryColor || '#A78BFA';

  // Responsive layout detection
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update local evidence when prop changes
  useEffect(() => {
    setLocalEvidence(evidence);
  }, [evidence]);

  // Filter milestones
  const filteredMilestones = useMemo(() => {
    const activeList = milestones.sort((a, b) => {
      const statusOrder = {
        active: 0,
        overdue: 1,
        upcoming: 2,
        completed: 3,
        skipped: 4,
      };
      return statusOrder[a.status] - statusOrder[b.status];
    });

    if (selectedFilter === 'all') return activeList;
    return activeList.filter((m) => {
      if (selectedFilter === 'active') return m.status === 'active' || m.status === 'overdue';
      if (selectedFilter === 'upcoming') return m.status === 'upcoming';
      if (selectedFilter === 'completed') return m.status === 'completed' || m.status === 'skipped';
      return true;
    });
  }, [milestones, selectedFilter]);

  // Calculate progress
  const completedCount = milestones.filter((m) => m.status === 'completed').length;
  const totalCount = milestones.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Check if "Ready to Share" button should be enabled
  const isReadyToShare = milestones.every((m) =>
    m.status === 'completed' || m.status === 'skipped' || m.phase !== 'working'
  );

  // Event handlers
  const handleMilestoneClick = (milestone: QuestMilestone) => {
    setFocusedMilestoneId(milestone.id);
    if (isDesktop && milestoneRefs.current[milestone.id]) {
      milestoneRefs.current[milestone.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleMilestoneStatusChange = (milestoneId: string, status: MilestoneStatus, note?: string) => {
    onMilestoneStatusChange?.(milestoneId, status, note);
  };

  const handleEvidenceSubmitted = (newEvidence: QuestEvidence) => {
    setLocalEvidence((prev) => [newEvidence, ...prev]);
    onEvidenceSubmitted?.(newEvidence);
  };

  const handleQuickMenuAction = (action: string) => {
    switch (action) {
      case 'evidence':
        evidenceCaptureRef.current?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'checkin':
        checkInPanelRef.current?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'milestone':
        // Open first active milestone
        const activeMilestone = milestones.find((m) => m.status === 'active');
        if (activeMilestone) {
          handleMilestoneClick(activeMilestone);
        }
        break;
    }
    setIsQuickMenuOpen(false);
  };

  // Status bar styles
  const statusBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '24px',
    alignItems: 'center',
    padding: '16px 20px',
    marginBottom: '24px',
    backgroundColor: '#111827',
    border: '1px solid #1e293b',
    borderRadius: '12px',
    flexWrap: 'wrap',
  };

  const statusPillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: mentorColor,
    color: '#fff',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  };

  const progressBarContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const progressBarStyle: React.CSSProperties = {
    width: '120px',
    height: '6px',
    backgroundColor: '#374151',
    borderRadius: '3px',
    overflow: 'hidden',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    width: `${progressPercent}%`,
    backgroundColor: mentorColor,
    transition: 'width 0.3s ease',
  };

  const readyToShareButtonStyle: React.CSSProperties = {
    marginLeft: 'auto',
    padding: '8px 16px',
    backgroundColor: isReadyToShare ? mentorColor : '#4B5563',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: isReadyToShare ? 'pointer' : 'not-allowed',
    opacity: isReadyToShare ? 1 : 0.6,
    transition: 'opacity 0.2s ease',
  };

  // Left column (map + milestones)
  const leftColumnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    ...(isDesktop && { width: '60%' }),
  };

  // Right column (evidence + checkin)
  const rightColumnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    ...(isDesktop && {
      width: '40%',
      position: 'sticky',
      top: '16px',
      maxHeight: 'calc(100vh - 32px)',
      overflowY: 'auto',
    }),
  };

  // Main container
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: isDesktop ? '24px' : '0',
    flexDirection: isDesktop ? 'row' : 'column',
    width: '100%',
  };

  // Map section style
  const mapSectionStyle: React.CSSProperties = {
    height: '280px',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
  };

  // Milestones section style
  const milestonesSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const milestonesHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  };

  const milestonesHeaderTitleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#f1f5f9',
  };

  const milestonesCountStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#94a3b8',
  };

  // Filter tabs
  const filterTabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  };

  const filterTabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    backgroundColor: isActive ? mentorColor : '#1e293b',
    color: isActive ? '#fff' : '#cbd5e1',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  // Empty state
  const emptyStateStyle: React.CSSProperties = {
    padding: '20px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
  };

  // Milestone card list
  const milestonesListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: isDesktop ? '400px' : 'none',
    overflowY: isDesktop ? 'auto' : 'visible',
  };

  // FAB (floating action button)
  const fabStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    backgroundColor: mentorColor,
    border: 'none',
    borderRadius: '28px',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 100,
  };

  // Quick menu styles
  const quickMenuStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '72px',
    right: '0',
    backgroundColor: '#1e293b',
    border: `1px solid ${mentorColor}`,
    borderRadius: '8px',
    overflow: 'hidden',
    minWidth: '180px',
    zIndex: 101,
  };

  const quickMenuItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#f1f5f9',
    fontSize: '13px',
    fontWeight: '500',
    textAlign: 'left',
    cursor: 'pointer',
    borderBottom: '1px solid #334155',
    transition: 'background-color 0.2s ease',
  };

  const quickMenuItemHoverStyle: React.CSSProperties = {
    backgroundColor: '#334155',
  };

  return (
    <div style={{ padding: isDesktop ? '24px' : '16px', width: '100%' }}>
      {/* Status Bar */}
      <div style={statusBarStyle}>
        <div style={statusPillStyle}>
          Working Phase
        </div>

        <div style={progressBarContainerStyle}>
          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
            {completedCount} of {totalCount} complete
          </span>
          <div style={progressBarStyle}>
            <div style={progressFillStyle} />
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#cbd5e1', marginLeft: 'auto' }}>
          {localEvidence.length} evidence items
        </div>

        <button
          style={readyToShareButtonStyle}
          onClick={() => isReadyToShare && onPhaseAdvance?.()}
          disabled={!isReadyToShare}
        >
          Ready to Share →
        </button>
      </div>

      {/* Main Layout */}
      <div style={containerStyle}>
        {/* Left Column: Map + Milestones */}
        <div style={leftColumnStyle}>
          {/* Overworld Map */}
          <div style={mapSectionStyle}>
            <OverworldMap
              milestones={milestones}
              currentPhase="working"
              mentorId={journey.mentor_id}
              onMilestoneClick={handleMilestoneClick}
              compact={true}
            />
          </div>

          {/* Milestones Section */}
          <div style={milestonesSectionStyle}>
            <div style={milestonesHeaderStyle}>
              <div>
                <div style={milestonesHeaderTitleStyle}>Your Milestones</div>
                <div style={milestonesCountStyle}>{filteredMilestones.length} item(s)</div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={filterTabsStyle}>
              {(['all', 'active', 'upcoming', 'completed'] as FilterType[]).map((filter) => (
                <button
                  key={filter}
                  style={filterTabStyle(selectedFilter === filter)}
                  onClick={() => setSelectedFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Milestones List */}
            <div style={milestonesListStyle}>
              <AnimatePresence>
                {filteredMilestones.length > 0 ? (
                  filteredMilestones.map((milestone) => {
                    const milestoneLoaclEvidence = localEvidence.filter(
                      (e) => e.milestone_id === milestone.id
                    );

                    return (
                      <motion.div
                        key={milestone.id}
                        ref={(el) => {
                          if (el) milestoneRefs.current[milestone.id] = el;
                        }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => handleMilestoneClick(milestone)}
                      >
                        <MilestoneCard
                          milestone={milestone}
                          evidence={milestoneLoaclEvidence}
                          isActive={milestone.status === 'active' || milestone.status === 'overdue'}
                          mentorColor={mentorColor}
                          onStatusChange={handleMilestoneStatusChange}
                          onClick={() => handleMilestoneClick(milestone)}
                        />
                      </motion.div>
                    );
                  })
                ) : (
                  <div style={emptyStateStyle}>
                    No milestones in this filter
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column: Evidence + Check-in */}
        <div style={rightColumnStyle}>
          {/* Evidence Capture */}
          <div
            ref={evidenceCaptureRef}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <EvidenceCapture
              journeyId={journey.id}
              milestones={milestones}
              recentEvidence={localEvidence}
              mentorColor={mentorColor}
              onEvidenceSubmitted={handleEvidenceSubmitted}
            />
          </div>

          {/* Check-in Panel Placeholder */}
          <div
            ref={checkInPanelRef}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '16px',
              minHeight: '200px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '12px' }}>
              Health Check-In
            </div>

            {/* Placeholder for CheckInPanel component */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#94a3b8',
              }}
            >
              Check-in panel will be mounted here
            </div>

            {/* Health Score Display */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
                Current Status
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['momentum', 'engagement', 'quality', 'self_awareness'].map((key) => {
                  const level = journey.health_score[key as keyof typeof journey.health_score];
                  const levelColor =
                    level === 'green' ? '#10B981' : level === 'amber' ? '#F59E0B' : '#EF4444';
                  return (
                    <div
                      key={key}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#1e293b',
                        borderLeft: `3px solid ${levelColor}`,
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#cbd5e1',
                        textTransform: 'capitalize',
                      }}
                    >
                      {key.replace(/_/g, ' ')}: {level}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAB (Floating Action Button) */}
      <motion.button
        style={fabStyle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsQuickMenuOpen(!isQuickMenuOpen)}
      >
        +
      </motion.button>

      {/* Quick Menu */}
      <AnimatePresence>
        {isQuickMenuOpen && (
          <motion.div
            style={quickMenuStyle}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.15 }}
          >
            <button
              style={quickMenuItemStyle}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, quickMenuItemHoverStyle);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' });
              }}
              onClick={() => handleQuickMenuAction('evidence')}
            >
              📸 Add Evidence
            </button>
            <button
              style={quickMenuItemStyle}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, quickMenuItemHoverStyle);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' });
              }}
              onClick={() => handleQuickMenuAction('checkin')}
            >
              💬 Check In
            </button>
            <button
              style={quickMenuItemStyle}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, quickMenuItemHoverStyle);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' });
              }}
              onClick={() => handleQuickMenuAction('milestone')}
            >
              📋 Mark Milestone
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WorkingPhaseView;
