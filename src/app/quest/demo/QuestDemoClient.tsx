'use client';

import React, { useState, useMemo } from 'react';
import type { QuestJourney, QuestMilestone, QuestEvidence, QuestPhase, MentorId, HealthScore, DiscoveryProfile, StudentContract, MilestoneStatus, EvidenceType } from '@/lib/quest/types';
import { PHASE_LABELS } from '@/lib/quest/types';
import { PHASE_COLORS } from '@/lib/quest/color-system';
import { getMentor, MENTORS } from '@/lib/quest/mentors';
import {
  MentorSelector,
  ProfileBuilder,
  ContractForm,
  SMARTGoalEditor,
  WorkingPhaseView,
  SharingPhaseView,
  QuestCompletionCelebration,
  MilestoneCard,
} from '@/components/quest';

const DEFAULT_HEALTH_SCORE: HealthScore = {
  momentum: 'green',
  engagement: 'green',
  quality: 'amber',
  self_awareness: 'green',
  last_computed_at: new Date().toISOString(),
  check_in_interval_minutes: 15,
};

// ============================================================================
// MOCK DATA FACTORIES (Showcase Mode)
// ============================================================================

function createMockJourney(): QuestJourney {
  return {
    id: 'demo-journey-1',
    student_id: 'demo-student',
    unit_id: 'demo-unit',
    class_id: 'demo-class',
    framework_id: 'service_as_action',
    mentor_id: 'river',
    phase: 'working',
    phase_entered_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    discovery_profile: {
      strengths: ['Empathy', 'Communication', 'Organisation'],
      interests: ['Environmental sustainability', 'Community gardens', 'Teaching younger students'],
      needs: ['Time management', 'Public speaking confidence', 'Project management'],
      archetype: 'The Connector',
      project_idea: 'Create a community composting program at our school that teaches younger students about waste reduction and grows food for the school canteen',
      narrowing_notes: 'Started broad (environment) → narrowed to composting → added teaching element → focused on Year 5 as peer mentors',
      discovery_completed_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    contract: {
      what: 'Design and run a school composting program with weekly workshops for Year 5 students',
      who_for: 'Year 5 students at our school, plus the wider school community who will benefit from reduced food waste',
      done_looks_like: 'Three working compost bins, a workshop guide, 8 trained Year 5 compost champions, and vegetables growing in the school garden by end of term',
      milestones_summary: 'Research waste streams → Build/install bins → Create workshop guide → Train Year 5 champions → Monitor compost health → Grow and harvest food → Present results to school',
      help_needed: 'Access to garden space, budget for compost bins (~$200), permission to run workshops during lunch, advice from school horticulturist',
      success_criteria: 'At least 6 Year 5 students can independently manage the compost system, food waste diverted from landfill increases by 30%, school canteen uses harvested vegetables',
      confirmed_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    },
    help_intensity: 'guided',
    health_score: DEFAULT_HEALTH_SCORE,
    total_sessions: 12,
    total_evidence_count: 18,
    sessions_remaining: 4,
    started_at: new Date(Date.now() - 35 * 86400000).toISOString(),
    completed_at: null,
  };
}

function createMockMilestones(): QuestMilestone[] {
  const now = Date.now();
  const day = 86400000;

  return [
    {
      id: 'ms-1',
      journey_id: 'demo-journey-1',
      title: 'Research waste streams',
      description: 'Audit school waste for one week, identify food waste percentage',
      phase: 'planning' as QuestPhase,
      framework_phase_id: null,
      sort_order: 1,
      specific: 'Measure daily food waste for 5 school days',
      measurable: 'Document weight and percentage of total waste',
      target_date: '2026-03-10',
      status: 'completed' as MilestoneStatus,
      completed_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      completion_note: 'Found 35% of landfill waste is food waste',
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: true,
      approved_at: new Date(Date.now() - 19 * 86400000).toISOString(),
      source: 'template' as const,
    },
    {
      id: 'ms-2',
      journey_id: 'demo-journey-1',
      title: 'Design compost system',
      description: 'Sketch bin designs, research materials and costs',
      phase: 'planning' as QuestPhase,
      framework_phase_id: null,
      sort_order: 2,
      specific: 'Compare 3 bin designs (wooden, plastic, worm)',
      measurable: 'Cost estimate, space requirements, capacity',
      target_date: '2026-03-17',
      status: 'completed' as MilestoneStatus,
      completed_at: new Date(Date.now() - 16 * 86400000).toISOString(),
      completion_note: 'Selected wooden bin design, cost $65 per unit',
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: true,
      approved_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      source: 'template' as const,
    },
    {
      id: 'ms-3',
      journey_id: 'demo-journey-1',
      title: 'Build compost bins',
      description: 'Source materials and construct 3 bins',
      phase: 'working' as QuestPhase,
      framework_phase_id: null,
      sort_order: 3,
      specific: 'Build bins with volunteer help',
      measurable: '3 functional bins ready for use',
      target_date: '2026-03-31',
      status: 'active' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: 'Great progress — check drainage',
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: 'ms-4',
      journey_id: 'demo-journey-1',
      title: 'Create workshop guide',
      description: 'Write 4-week workshop curriculum for Year 5',
      phase: 'working' as QuestPhase,
      framework_phase_id: null,
      sort_order: 4,
      specific: 'Design activities for composting concepts',
      measurable: '4 lesson plans with materials & instructions',
      target_date: '2026-04-07',
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: 'ms-5',
      journey_id: 'demo-journey-1',
      title: 'Deliver first workshop',
      description: 'Run Week 1 composting introduction',
      phase: 'working' as QuestPhase,
      framework_phase_id: null,
      sort_order: 5,
      specific: 'Present to 8 Year 5 volunteers',
      measurable: 'All students complete pre/post quiz',
      target_date: '2026-04-14',
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: 'ms-6',
      journey_id: 'demo-journey-1',
      title: 'Prepare presentation',
      description: 'Create slides and visuals for final showcase',
      phase: 'sharing' as QuestPhase,
      framework_phase_id: null,
      sort_order: 6,
      specific: 'Document journey from research to impact',
      measurable: '10-15 slide deck with photos & data',
      target_date: '2026-04-28',
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: 'ms-7',
      journey_id: 'demo-journey-1',
      title: 'Present to school community',
      description: 'Showcase composting program at assembly',
      phase: 'sharing' as QuestPhase,
      framework_phase_id: null,
      sort_order: 7,
      specific: 'Present 10-minute talk to whole school',
      measurable: 'Deliver with Year 5 champions',
      target_date: '2026-05-05',
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
  ];
}

function createMockEvidence(): QuestEvidence[] {
  return [
    {
      id: 'evidence-1',
      journey_id: 'demo-journey-1',
      milestone_id: 'ms-1',
      type: 'text' as EvidenceType,
      content: 'Day 1: 8.4 kg of food waste collected (35% of total waste). Breakdown: vegetable scraps, bread, fruit.',
      file_url: null,
      file_type: null,
      thumbnail_url: null,
      ai_analysis: {
        quality_signal: 'green',
        summary: 'Student conducted thorough audit with accurate measurements',
        tags: ['data', 'research', 'observation'],
        complexity_score: 6,
      },
      approved_by_teacher: true,
      approved_at: new Date(Date.now() - 18 * 86400000).toISOString(),
      teacher_feedback: 'Excellent data collection!',
      phase: 'planning' as QuestPhase,
      framework_phase_id: null,
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      id: 'evidence-2',
      journey_id: 'demo-journey-1',
      milestone_id: 'ms-2',
      type: 'text' as EvidenceType,
      content: 'Sketched three bin designs. Wooden design selected: 60cm × 60cm × 80cm, $65 per unit, capacity 120L per layer.',
      file_url: null,
      file_type: null,
      thumbnail_url: null,
      ai_analysis: {
        quality_signal: 'green',
        summary: 'Student compared multiple designs and justified selection',
        tags: ['design', 'engineering', 'analysis'],
        complexity_score: 7,
      },
      approved_by_teacher: true,
      approved_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      teacher_feedback: 'Nice cost analysis. Check ventilation holes.',
      phase: 'planning' as QuestPhase,
      framework_phase_id: null,
      created_at: new Date(Date.now() - 17 * 86400000).toISOString(),
    },
  ];
}

// ============================================================================
// WALKTHROUGH MODE HELPERS
// ============================================================================

function createEmptyJourney(): QuestJourney {
  return {
    id: 'walkthrough-' + Date.now(),
    student_id: 'walkthrough-student',
    unit_id: 'walkthrough-unit',
    class_id: null,
    framework_id: 'service_as_action',
    mentor_id: null,
    phase: 'not_started',
    phase_entered_at: new Date().toISOString(),
    discovery_profile: null,
    contract: null,
    help_intensity: 'guided',
    health_score: DEFAULT_HEALTH_SCORE,
    total_sessions: 0,
    total_evidence_count: 0,
    sessions_remaining: null,
    started_at: new Date().toISOString(),
    completed_at: null,
  };
}

function generateDefaultMilestones(journeyId: string): QuestMilestone[] {
  const now = Date.now();
  const day = 86400000;

  return [
    // Planning
    {
      id: `ms-${Date.now()}-1`,
      journey_id: journeyId,
      title: 'Define your vision of success',
      description: 'What does the finished project look like?',
      phase: 'planning' as QuestPhase,
      framework_phase_id: null,
      sort_order: 1,
      specific: null,
      measurable: null,
      target_date: new Date(now + 3 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: `ms-${Date.now()}-2`,
      journey_id: journeyId,
      title: 'Confirm your project contract',
      description: 'Lock in what you will do, for whom, and how you will know it worked',
      phase: 'planning' as QuestPhase,
      framework_phase_id: null,
      sort_order: 2,
      specific: null,
      measurable: null,
      target_date: new Date(now + 5 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: `ms-${Date.now()}-3`,
      journey_id: journeyId,
      title: 'Identify resources needed',
      description: 'People, materials, permissions, budget',
      phase: 'planning' as QuestPhase,
      framework_phase_id: null,
      sort_order: 3,
      specific: null,
      measurable: null,
      target_date: new Date(now + 7 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    // Working
    {
      id: `ms-${Date.now()}-4`,
      journey_id: journeyId,
      title: 'Investigation & research',
      description: 'Understand the problem deeply before acting',
      phase: 'working' as QuestPhase,
      framework_phase_id: null,
      sort_order: 4,
      specific: null,
      measurable: null,
      target_date: new Date(now + 14 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: `ms-${Date.now()}-5`,
      journey_id: journeyId,
      title: 'First action taken',
      description: 'Take your first concrete step toward the goal',
      phase: 'working' as QuestPhase,
      framework_phase_id: null,
      sort_order: 5,
      specific: null,
      measurable: null,
      target_date: new Date(now + 21 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: `ms-${Date.now()}-6`,
      journey_id: journeyId,
      title: 'Mid-point check',
      description: 'Assess progress and adjust plan if needed',
      phase: 'working' as QuestPhase,
      framework_phase_id: null,
      sort_order: 6,
      specific: null,
      measurable: null,
      target_date: new Date(now + 28 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    // Sharing
    {
      id: `ms-${Date.now()}-7`,
      journey_id: journeyId,
      title: 'Prepare presentation',
      description: 'Story structure, visuals, practice',
      phase: 'sharing' as QuestPhase,
      framework_phase_id: null,
      sort_order: 7,
      specific: null,
      measurable: null,
      target_date: new Date(now + 35 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: `ms-${Date.now()}-8`,
      journey_id: journeyId,
      title: 'Present to audience',
      description: 'Share your journey and impact',
      phase: 'sharing' as QuestPhase,
      framework_phase_id: null,
      sort_order: 8,
      specific: null,
      measurable: null,
      target_date: new Date(now + 38 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
    {
      id: `ms-${Date.now()}-9`,
      journey_id: journeyId,
      title: 'Final reflection written',
      description: 'Compare original goals to actual outcomes',
      phase: 'sharing' as QuestPhase,
      framework_phase_id: null,
      sort_order: 9,
      specific: null,
      measurable: null,
      target_date: new Date(now + 40 * day).toISOString().split('T')[0],
      status: 'upcoming' as MilestoneStatus,
      completed_at: null,
      completion_note: null,
      teacher_note: null,
      teacher_adjusted_date: null,
      approved_by_teacher: false,
      approved_at: null,
      source: 'template' as const,
    },
  ];
}

// ============================================================================
// WALKTHROUGH PHASES
// ============================================================================

interface DiscoveryStep {
  step: 1 | 2 | 3 | 4 | 5;
  strengths: string;
  interests: string;
  needs: string;
  projectIdea: string;
}

function WalkthroughNotStarted({ onBegin, onFrameworkSelect }: { onBegin: () => void; onFrameworkSelect: (fw: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12">
      <div className="max-w-2xl text-center mb-12">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">Begin Your Quest</h1>
        <p className="text-xl text-slate-600 mb-8">
          Choose a framework to guide your service learning journey. Your mentor will help you discover your strengths,
          plan your project, and make a real difference.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 max-w-3xl">
        {[
          {
            id: 'service_as_action',
            title: 'Service as Action',
            desc: 'Make a difference in your community',
          },
          {
            id: 'myp_design',
            title: 'MYP Design',
            desc: 'Design solutions to real problems',
          },
          {
            id: 'personal_project',
            title: 'Personal Project',
            desc: 'Pursue your passion independently',
          },
          {
            id: 'pyp_exhibition',
            title: 'PYP Exhibition',
            desc: 'Collaborate to explore an issue',
          },
        ].map((fw) => (
          <button
            key={fw.id}
            onClick={() => onFrameworkSelect(fw.id)}
            className="p-6 bg-white rounded-lg border-2 border-slate-200 hover:border-indigo-500 hover:shadow-lg transition-all text-left"
          >
            <h3 className="font-bold text-lg text-slate-900 mb-2">{fw.title}</h3>
            <p className="text-sm text-slate-600">{fw.desc}</p>
          </button>
        ))}
      </div>

      <button
        onClick={onBegin}
        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
      >
        Start Your Quest →
      </button>
    </div>
  );
}

function WalkthroughDiscovery({
  journey,
  onDiscoveryComplete,
}: {
  journey: QuestJourney;
  onDiscoveryComplete: (profile: DiscoveryProfile) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [data, setData] = useState({
    strengths: '',
    interests: '',
    needs: '',
    projectIdea: '',
  });

  const mentor = journey.mentor_id ? getMentor(journey.mentor_id) : null;

  const mentorPrompts = {
    1: {
      kit: "What do you build or fix that others notice?",
      sage: "What questions keep coming back to you?",
      river: "Tell me about a time you helped someone...",
      spark: "What really bugs you about the world?",
      haven: "What do you quietly care about?",
    },
    2: {
      kit: "What problems do you like solving with your hands?",
      sage: "What patterns or systems puzzle you?",
      river: "What issues affect people you care about?",
      spark: "What's the status quo you want to challenge?",
      haven: "What would make your community feel safer?",
    },
    3: {
      kit: "What skills would you like to develop?",
      sage: "What knowledge gaps bother you?",
      river: "How would you like to grow as a person?",
      spark: "What's your next creative frontier?",
      haven: "What strength could you build for others?",
    },
    4: {
      kit: "What could you prototype in the next 3 weeks?",
      sage: "What would be a meaningful discovery?",
      river: "Whose story could you help change?",
      spark: "What if nobody had done this before?",
      haven: "What difference would feel worthwhile?",
    },
  };

  const prompts = mentorPrompts[step as keyof typeof mentorPrompts] || {};
  const currentPrompt = mentor ? prompts[mentor.id] : '';

  const canAdvance =
    (step === 1 && data.strengths.length >= 20) ||
    (step === 2 && data.interests.length >= 20) ||
    (step === 3 && data.needs.length >= 20) ||
    (step === 4 && data.projectIdea.length >= 20);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s < step ? 'bg-green-500' : s === step ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-slate-600">
            Step {step} of 4: {['Your Strengths', 'Your Interests', 'Areas to Grow', 'Your Project Idea'][step - 1]}
          </p>
        </div>

        {/* Mentor */}
        {mentor && (
          <div className="flex items-start gap-4 mb-8 bg-white rounded-lg p-6 border-l-4" style={{ borderColor: mentor.primaryColor }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: mentor.primaryColor }}>
              {mentor.name[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-900 mb-1">{mentor.name} asks:</p>
              <p className="text-slate-700 italic">{currentPrompt}</p>
            </div>
          </div>
        )}

        {/* Input form */}
        <div className="bg-white rounded-lg p-8 mb-6">
          {step === 1 && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Your Strengths</label>
              <textarea
                value={data.strengths}
                onChange={(e) => setData({ ...data, strengths: e.target.value })}
                placeholder="What are you good at? What do others say you're naturally talented at? What comes easily to you?"
                className="w-full h-24 p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <p className="text-xs text-slate-500 mt-2">{data.strengths.length} characters</p>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">What You Care About</label>
              <textarea
                value={data.interests}
                onChange={(e) => setData({ ...data, interests: e.target.value })}
                placeholder="What problems do you notice? What issues matter to you? What would you spend free time on?"
                className="w-full h-24 p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <p className="text-xs text-slate-500 mt-2">{data.interests.length} characters</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Where You Want to Grow</label>
              <textarea
                value={data.needs}
                onChange={(e) => setData({ ...data, needs: e.target.value })}
                placeholder="What do you want to get better at? What challenges you? What skills are you working on?"
                className="w-full h-24 p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <p className="text-xs text-slate-500 mt-2">{data.needs.length} characters</p>
            </div>
          )}

          {step === 4 && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Your Project Idea</label>
              <textarea
                value={data.projectIdea}
                onChange={(e) => setData({ ...data, projectIdea: e.target.value })}
                placeholder="What's your idea? What will you create or do? How does it connect your strengths, interests, and growth?"
                className="w-full h-24 p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <p className="text-xs text-slate-500 mt-2">{data.projectIdea.length} characters</p>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Review Your Profile</h3>
              <ProfileBuilder
                strengths={data.strengths.split('\n').filter((s) => s.trim())}
                interests={data.interests.split('\n').filter((s) => s.trim())}
                needs={data.needs.split('\n').filter((s) => s.trim())}
                archetype="Emerging Leader"
                projectIdea={data.projectIdea}
              />
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => setStep(Math.max(1, step - 1) as 1 | 2 | 3 | 4 | 5)}
            disabled={step === 1}
            className="px-6 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold disabled:opacity-50 transition-colors"
          >
            ← Back
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4 | 5)}
              disabled={!canAdvance}
              className="flex-1 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-semibold transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => {
                onDiscoveryComplete({
                  strengths: data.strengths.split('\n').filter((s) => s.trim()),
                  interests: data.interests.split('\n').filter((s) => s.trim()),
                  needs: data.needs.split('\n').filter((s) => s.trim()),
                  archetype: 'Emerging Leader',
                  project_idea: data.projectIdea,
                  narrowing_notes: 'Walkthrough discovery completed',
                  discovery_completed_at: new Date().toISOString(),
                });
              }}
              className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              Continue to Planning →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WalkthroughPlanning({
  journey,
  milestones,
  onMilestonesReady,
}: {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  onMilestonesReady: () => void;
}) {
  const [contract, setContract] = useState<StudentContract | null>(journey.contract);
  const [contractConfirmed, setContractConfirmed] = useState(!!journey.contract?.confirmed_at);
  const [showMilestoneEdit, setShowMilestoneEdit] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);

  const workingMilestones = milestones.filter((m) => m.phase === 'working');
  const allMilestonesComplete = workingMilestones.length >= 3 && workingMilestones.every((m) => m.target_date);

  if (!contractConfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Your Project Contract</h2>

          <ContractForm
            contract={contract}
            mentorId={journey.mentor_id || 'kit'}
            onFieldUpdate={(field, value) => {
              setContract((c) => (c ? { ...c, [field]: value } : { [field]: value } as any));
            }}
            onConfirm={() => setContractConfirmed(true)}
            isConfirmed={contractConfirmed}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Plan Your Milestones</h2>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Working Phase Milestones</h3>
          <div className="space-y-4">
            {workingMilestones.map((ms) => (
              <div key={ms.id} className="bg-white rounded-lg p-6 border-l-4 border-amber-500">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">{ms.title}</h4>
                    <p className="text-sm text-slate-600 mt-1">{ms.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingMilestoneId(ms.id === editingMilestoneId ? null : ms.id);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm"
                  >
                    {ms.id === editingMilestoneId ? 'Done' : 'Edit'}
                  </button>
                </div>

                {ms.id === editingMilestoneId && (
                  <div className="bg-slate-50 rounded p-4">
                    <SMARTGoalEditor
                      milestone={ms}
                      onUpdate={(updates) => {
                        // In a real app, would update the milestone state
                      }}
                    />
                  </div>
                )}

                {ms.target_date && (
                  <p className="text-xs text-slate-500">Target: {new Date(ms.target_date).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onMilestonesReady}
          disabled={!allMilestonesComplete}
          className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg font-semibold transition-colors"
        >
          Milestones Ready → Start Working Phase
        </button>
      </div>
    </div>
  );
}

function SimpleHealthGauges() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Momentum', color: 'bg-green-500' },
        { label: 'Engagement', color: 'bg-green-500' },
        { label: 'Quality', color: 'bg-amber-500' },
        { label: 'Self-Awareness', color: 'bg-green-500' },
      ].map((g) => (
        <div key={g.label} className="bg-white rounded-lg p-4 text-center">
          <div className={`w-8 h-8 rounded-full ${g.color} mx-auto mb-2`} />
          <p className="text-xs font-semibold text-slate-600">{g.label}</p>
        </div>
      ))}
    </div>
  );
}

function WalkthroughWorking({
  journey,
  milestones,
  onPhaseComplete,
}: {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  onPhaseComplete: () => void;
}) {
  const [localMilestones, setLocalMilestones] = useState(milestones);
  const [localEvidence, setLocalEvidence] = useState<QuestEvidence[]>([]);
  const [newEvidenceText, setNewEvidenceText] = useState('');

  const handleAddEvidence = () => {
    if (newEvidenceText.trim()) {
      const ev: QuestEvidence = {
        id: `evidence-${Date.now()}`,
        journey_id: journey.id,
        milestone_id: localMilestones[0]?.id || null,
        type: 'text' as EvidenceType,
        content: newEvidenceText,
        file_url: null,
        file_type: null,
        thumbnail_url: null,
        ai_analysis: {
          quality_signal: 'green',
          summary: 'Student evidence',
          tags: ['working'],
          complexity_score: 5,
        },
        approved_by_teacher: false,
        approved_at: null,
        teacher_feedback: null,
        phase: 'working' as QuestPhase,
        framework_phase_id: null,
        created_at: new Date().toISOString(),
      };
      setLocalEvidence((prev) => [...prev, ev]);
      setNewEvidenceText('');
    }
  };

  const handleMilestoneStatusChange = (id: string, status: MilestoneStatus, note?: string) => {
    setLocalMilestones((ms) =>
      ms.map((m) =>
        m.id === id
          ? {
              ...m,
              status,
              completion_note: note || null,
              completed_at: status === 'completed' ? new Date().toISOString() : null,
            }
          : m
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Working Phase</h2>

        {/* Health gauges */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Quest Health</h3>
          <SimpleHealthGauges />
        </div>

        {/* Milestones */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Milestones</h3>
          <div className="space-y-4">
            {localMilestones.filter((m) => m.phase === 'working').map((ms) => (
              <MilestoneCard
                key={ms.id}
                milestone={ms}
                onStatusChange={handleMilestoneStatusChange}
                evidence={[]}
              />
            ))}
          </div>
        </div>

        {/* Evidence form */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Evidence</h3>
          <div className="bg-white rounded-lg p-6">
            <textarea
              value={newEvidenceText}
              onChange={(e) => setNewEvidenceText(e.target.value)}
              placeholder="What progress did you make? What did you learn? Add a photo caption, reflection, or note..."
              className="w-full h-20 p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 mb-4"
            />
            <button
              onClick={handleAddEvidence}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Add Evidence
            </button>
          </div>

          {localEvidence.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-slate-900 mb-3">Your Evidence ({localEvidence.length})</h4>
              <div className="space-y-3">
                {localEvidence.map((ev) => (
                  <div key={ev.id} className="bg-white rounded-lg p-4 border-l-4 border-indigo-500">
                    <p className="text-sm text-slate-700">{ev.content}</p>
                    <p className="text-xs text-slate-500 mt-2">{new Date(ev.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onPhaseComplete}
          className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
        >
          Ready for Sharing Phase →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function QuestDemoPage() {
  const [mode, setMode] = useState<'showcase' | 'walkthrough'>('showcase');

  // Showcase state
  const [showcasePhase, setShowcasePhase] = useState<QuestPhase>('working');
  const mockJourney = useMemo(() => createMockJourney(), []);
  const mockMilestones = useMemo(() => createMockMilestones(), []);
  const mockEvidence = useMemo(() => createMockEvidence(), []);

  // Walkthrough state
  const [walkthroughJourney, setWalkthroughJourney] = useState<QuestJourney>(() => createEmptyJourney());
  const [walkthroughMilestones, setWalkthroughMilestones] = useState<QuestMilestone[]>([]);
  const [walkthroughEvidence, setWalkthroughEvidence] = useState<QuestEvidence[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  const handleWalkthroughBegin = () => {
    setWalkthroughJourney((j) => ({ ...j, phase: 'discovery' as QuestPhase }));
  };

  const handleWalkthroughFrameworkSelect = (fw: string) => {
    setWalkthroughJourney((j) => ({ ...j, framework_id: fw }));
  };

  const handleWalkthroughMentorSelect = (mentorId: MentorId) => {
    setWalkthroughJourney((j) => ({ ...j, mentor_id: mentorId }));
  };

  const handleDiscoveryComplete = (profile: DiscoveryProfile) => {
    setWalkthroughJourney((prev) => {
      const j = prev;
      return {
        ...j,
        phase: 'planning' as QuestPhase,
        discovery_profile: profile,
      };
    });
    setWalkthroughMilestones(generateDefaultMilestones(walkthroughJourney.id));
  };

  const handlePlanningComplete = () => {
    setWalkthroughJourney((j) => ({ ...j, phase: 'working' as QuestPhase }));
  };

  const handleWorkingComplete = () => {
    setWalkthroughJourney((j) => ({ ...j, phase: 'sharing' as QuestPhase }));
  };

  const handleSharingComplete = () => {
    setWalkthroughJourney((j) => ({
      ...j,
      phase: 'completed' as QuestPhase,
      completed_at: new Date().toISOString(),
    }));
    setShowCelebration(true);
  };

  const resetWalkthrough = () => {
    setWalkthroughJourney(createEmptyJourney());
    setWalkthroughMilestones([]);
    setWalkthroughEvidence([]);
    setShowCelebration(false);
  };

  // ===== SHOWCASE MODE =====
  if (mode === 'showcase') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Quest Demo</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setMode('walkthrough')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                Start Walkthrough
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Showcase Mode</h2>
            <p className="text-lg text-slate-600 mb-6">
              Pre-loaded demo data showing a student journey in progress. Click phase pills to jump between phases.
            </p>

            {/* Phase navigation */}
            <div className="flex gap-2 flex-wrap">
              {(['planning', 'working', 'sharing'] as QuestPhase[]).map((phase) => (
                <button
                  key={phase}
                  onClick={() => setShowcasePhase(phase)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    showcasePhase === phase
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-600'
                  }`}
                >
                  {PHASE_LABELS[phase]}
                </button>
              ))}
            </div>
          </div>

          {/* Phase content */}
          <div className="mt-12">
            {showcasePhase === 'planning' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg p-8 border-l-4 border-blue-500">
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Project Contract</h3>
                  {mockJourney.contract && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-slate-900">What</h4>
                        <p className="text-slate-700">{mockJourney.contract.what}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">For Whom</h4>
                        <p className="text-slate-700">{mockJourney.contract.who_for}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">Done Looks Like</h4>
                        <p className="text-slate-700">{mockJourney.contract.done_looks_like}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Planning Milestones</h3>
                  <div className="space-y-3">
                    {mockMilestones
                      .filter((m) => m.phase === 'planning')
                      .map((ms) => (
                        <MilestoneCard key={ms.id} milestone={ms} onStatusChange={() => {}} evidence={[]} />
                      ))}
                  </div>
                </div>
              </div>
            )}

            {showcasePhase === 'working' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Quest Health</h3>
                  <div className="bg-white rounded-lg p-8">
                    <SimpleHealthGauges />
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Working Milestones</h3>
                  <div className="space-y-3">
                    {mockMilestones
                      .filter((m) => m.phase === 'working')
                      .map((ms) => (
                        <MilestoneCard key={ms.id} milestone={ms} onStatusChange={() => {}} evidence={[]} />
                      ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Evidence ({mockEvidence.length})</h3>
                  <div className="space-y-3">
                    {mockEvidence.map((ev) => (
                      <div key={ev.id} className="bg-white rounded-lg p-6 border-l-4 border-indigo-500">
                        <p className="text-slate-900 font-semibold mb-2">{mockMilestones.find((m) => m.id === ev.milestone_id)?.title}</p>
                        <p className="text-slate-700">{ev.content}</p>
                        {ev.teacher_feedback && <p className="text-sm text-green-600 mt-2">✓ {ev.teacher_feedback}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showcasePhase === 'sharing' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg p-8 border-l-4 border-green-500">
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Sharing Phase</h3>
                  <p className="text-slate-700 mb-4">Time to share your journey and impact with your community.</p>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-slate-900">Milestones to Complete</h4>
                      <div className="mt-2 space-y-2">
                        {mockMilestones
                          .filter((m) => m.phase === 'sharing')
                          .map((ms) => (
                            <div key={ms.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded">
                              <span className="text-lg">📋</span>
                              <div>
                                <p className="font-semibold text-slate-900">{ms.title}</p>
                                <p className="text-sm text-slate-600">{ms.description}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== WALKTHROUGH MODE =====
  if (showCelebration) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-12 max-w-2xl text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">🎉 Quest Complete!</h1>
          <p className="text-xl text-slate-600 mb-8">
            You've successfully completed your service learning journey. From discovery to impact — amazing work!
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-600">{walkthroughMilestones.length}</p>
                <p className="text-sm text-slate-600">Milestones</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-600">{walkthroughEvidence.length}</p>
                <p className="text-sm text-slate-600">Evidence</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-purple-600">5</p>
                <p className="text-sm text-slate-600">Weeks</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setMode('showcase');
              resetWalkthrough();
            }}
            className="mt-8 w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
          >
            Back to Showcase
          </button>
        </div>
      </div>
    );
  }

  if (walkthroughJourney.phase === 'not_started') {
    return (
      <div>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Quest Walkthrough</h1>
            <button
              onClick={() => setMode('showcase')}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
            >
              Back to Showcase
            </button>
          </div>
        </div>

        <WalkthroughNotStarted onBegin={handleWalkthroughBegin} onFrameworkSelect={handleWalkthroughFrameworkSelect} />
      </div>
    );
  }

  if (walkthroughJourney.phase === 'discovery' && !walkthroughJourney.mentor_id) {
    return (
      <div>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Choose Your Mentor</h1>
            <button
              onClick={() => setMode('showcase')}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
            >
              Back to Showcase
            </button>
          </div>
        </div>

        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
          <div className="max-w-4xl mx-auto">
            <p className="text-lg text-slate-600 mb-12">
              Each mentor brings a unique perspective to your journey. Choose the voice that resonates with you.
            </p>

            <MentorSelector selectedMentorId={null} onMentorSelected={handleWalkthroughMentorSelect} />
          </div>
        </div>
      </div>
    );
  }

  if (walkthroughJourney.phase === 'discovery' && walkthroughJourney.mentor_id) {
    return (
      <div>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Discovery Phase</h1>
            <button
              onClick={() => setMode('showcase')}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
            >
              Back to Showcase
            </button>
          </div>
        </div>

        <WalkthroughDiscovery journey={walkthroughJourney} onDiscoveryComplete={handleDiscoveryComplete} />
      </div>
    );
  }

  if (walkthroughJourney.phase === 'planning') {
    return (
      <div>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Planning Phase</h1>
            <button
              onClick={() => setMode('showcase')}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
            >
              Back to Showcase
            </button>
          </div>
        </div>

        <WalkthroughPlanning
          journey={walkthroughJourney}
          milestones={walkthroughMilestones}
          onMilestonesReady={handlePlanningComplete}
        />
      </div>
    );
  }

  if (walkthroughJourney.phase === 'working') {
    return (
      <div>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Working Phase</h1>
            <button
              onClick={() => setMode('showcase')}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
            >
              Back to Showcase
            </button>
          </div>
        </div>

        <WalkthroughWorking
          journey={walkthroughJourney}
          milestones={walkthroughMilestones}
          onPhaseComplete={handleWorkingComplete}
        />
      </div>
    );
  }

  if (walkthroughJourney.phase === 'sharing') {
    return (
      <div>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Sharing Phase</h1>
            <button
              onClick={() => setMode('showcase')}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
            >
              Back to Showcase
            </button>
          </div>
        </div>

        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">Sharing Phase</h2>
            <div className="bg-white rounded-lg p-8 border-l-4 border-green-500">
              <p className="text-lg text-slate-700 mb-6">
                Time to share your journey with your community. Complete the final milestones to document your impact.
              </p>

              <div className="space-y-4 mb-8">
                {walkthroughMilestones
                  .filter((m) => m.phase === 'sharing')
                  .map((ms) => (
                    <div key={ms.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-2xl">📌</span>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{ms.title}</p>
                        <p className="text-sm text-slate-600 mt-1">{ms.description}</p>
                      </div>
                    </div>
                  ))}
              </div>

              <button
                onClick={handleSharingComplete}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                Complete Quest ✨
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
