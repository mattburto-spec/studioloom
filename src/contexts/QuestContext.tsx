'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type {
  QuestJourney,
  QuestMilestone,
  QuestEvidence,
  QuestPhase,
  MentorId,
  EvidenceType,
  QuestInteractionType,
} from '@/lib/quest/types';
import { getNextPhase, getPhaseProgress } from '@/lib/quest/phase-machine';

interface QuestState {
  journey: QuestJourney | null;
  milestones: QuestMilestone[];
  evidence: QuestEvidence[];
  isLoading: boolean;
  error: string | null;
}

interface QuestActions {
  /** Load quest data for a unit */
  loadQuest: (unitId: string) => Promise<void>;
  /** Create a new quest journey */
  createQuest: (unitId: string, classId: string | null, frameworkId: string) => Promise<void>;
  /** Select a mentor */
  selectMentor: (mentorId: MentorId) => Promise<void>;
  /** Advance to next phase */
  advancePhase: (targetPhase: QuestPhase) => Promise<void>;
  /** Submit evidence */
  submitEvidence: (data: {
    milestoneId?: string;
    type: EvidenceType;
    content?: string;
    fileUrl?: string;
    fileType?: string;
  }) => Promise<void>;
  /** Send message to mentor */
  sendMentorMessage: (message: string, interactionType: QuestInteractionType) => Promise<string>;
  /** Update discovery profile */
  updateDiscoveryProfile: (profile: Partial<QuestJourney['discovery_profile']>) => void;
  /** Confirm contract */
  confirmContract: (contract: QuestJourney['contract']) => Promise<void>;
  /** Get overall progress percentage */
  getProgress: () => number;
  /** Check if can advance to next phase */
  canAdvance: () => QuestPhase | null;
}

interface QuestContextValue extends QuestState, QuestActions {}

const QuestContext = createContext<QuestContextValue | null>(null);

export function QuestProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QuestState>({
    journey: null,
    milestones: [],
    evidence: [],
    isLoading: false,
    error: null,
  });

  const journeyIdRef = useRef<string | null>(null);

  const loadQuest = useCallback(async (unitId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/student/quest?unitId=${unitId}`);
      if (!res.ok) throw new Error('Failed to load quest');
      const data = await res.json();
      journeyIdRef.current = data.journey?.id || null;
      setState({
        journey: data.journey,
        milestones: data.milestones || [],
        evidence: data.evidence || [],
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  const createQuest = useCallback(
    async (unitId: string, classId: string | null, frameworkId: string) => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        const res = await fetch('/api/student/quest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unitId, classId, frameworkId }),
        });
        if (!res.ok) throw new Error('Failed to create quest');
        const data = await res.json();
        journeyIdRef.current = data.journey.id;
        setState(prev => ({
          ...prev,
          journey: data.journey,
          isLoading: false,
        }));
      } catch (err) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    },
    []
  );

  const selectMentor = useCallback(async (mentorId: MentorId) => {
    if (!journeyIdRef.current) return;
    try {
      const res = await fetch('/api/student/quest/mentor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: journeyIdRef.current, mentorId }),
      });
      if (!res.ok) throw new Error('Failed to select mentor');
      const data = await res.json();
      setState(prev => ({ ...prev, journey: data.journey }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  const advancePhase = useCallback(async (targetPhase: QuestPhase) => {
    if (!journeyIdRef.current) return;
    try {
      const res = await fetch('/api/student/quest/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: journeyIdRef.current, targetPhase }),
      });
      if (!res.ok) throw new Error('Failed to advance phase');
      const data = await res.json();
      setState(prev => ({ ...prev, journey: data.journey }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  const submitEvidence = useCallback(
    async (data: {
      milestoneId?: string;
      type: EvidenceType;
      content?: string;
      fileUrl?: string;
      fileType?: string;
    }) => {
      if (!journeyIdRef.current) return;
      try {
        const res = await fetch('/api/student/quest/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ journeyId: journeyIdRef.current, ...data }),
        });
        if (!res.ok) throw new Error('Failed to submit evidence');
        const result = await res.json();
        setState(prev => ({
          ...prev,
          evidence: [result.evidence, ...prev.evidence],
          journey: prev.journey
            ? { ...prev.journey, total_evidence_count: prev.journey.total_evidence_count + 1 }
            : null,
        }));
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    },
    []
  );

  const sendMentorMessage = useCallback(
    async (message: string, interactionType: QuestInteractionType): Promise<string> => {
      if (!journeyIdRef.current) return '';
      try {
        const res = await fetch('/api/student/quest/mentor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journeyId: journeyIdRef.current,
            message,
            interactionType,
          }),
        });
        if (!res.ok) throw new Error('Failed to send message');
        const data = await res.json();
        return data.response || '';
      } catch {
        return 'Sorry, I had trouble responding. Try again?';
      }
    },
    []
  );

  const updateDiscoveryProfile = useCallback(
    (profile: Partial<QuestJourney['discovery_profile']>) => {
      setState(prev => {
        if (!prev.journey) return prev;
        return {
          ...prev,
          journey: {
            ...prev.journey,
            discovery_profile: {
              ...prev.journey.discovery_profile,
              ...profile,
            } as any,
          },
        };
      });
    },
    []
  );

  const confirmContract = useCallback(async (contract: QuestJourney['contract']) => {
    if (!journeyIdRef.current || !contract) return;
    // Save contract to journey via a dedicated endpoint or direct update
    // For now, store locally — API integration in Phase 4
    setState(prev => {
      if (!prev.journey) return prev;
      return {
        ...prev,
        journey: {
          ...prev.journey,
          contract: { ...contract, confirmed_at: new Date().toISOString() } as any,
        },
      };
    });
  }, []);

  const getProgress = useCallback((): number => {
    if (!state.journey) return 0;
    return getPhaseProgress(state.journey.phase);
  }, [state.journey]);

  const canAdvance = useCallback((): QuestPhase | null => {
    if (!state.journey) return null;
    const sharingEvidence = state.evidence.filter(e => e.phase === 'sharing').length;
    return getNextPhase(state.journey, state.milestones, sharingEvidence);
  }, [state.journey, state.milestones, state.evidence]);

  const value: QuestContextValue = {
    ...state,
    loadQuest,
    createQuest,
    selectMentor,
    advancePhase,
    submitEvidence,
    sendMentorMessage,
    updateDiscoveryProfile,
    confirmContract,
    getProgress,
    canAdvance,
  };

  return <QuestContext.Provider value={value}>{children}</QuestContext.Provider>;
}

export function useQuest(): QuestContextValue {
  const ctx = useContext(QuestContext);
  if (!ctx) {
    throw new Error('useQuest must be used within a QuestProvider');
  }
  return ctx;
}
