'use client';

import React, { useState } from 'react';
import type { QuestJourney, QuestMilestone, QuestEvidence, QuestPhase, MentorId } from '@/lib/quest/types';
import { PHASE_COLORS } from '@/lib/quest/color-system';
import { getMentor } from '@/lib/quest/mentors';
import {
  MentorSelector,
  ProfileBuilder,
  ContractForm,
  SMARTGoalEditor,
  EvidenceCapture,
  WorkingPhaseView,
  SharingPhaseView,
  QuestCompletionCelebration,
  CheckInPanel,
} from '@/components/quest';
import QuestDiscoveryFlow from '@/components/quest/QuestDiscoveryFlow';
import OverworldMap from '@/components/quest/OverworldMap';
import BackwardTimeline from '@/components/quest/BackwardTimeline';

// Mock data factory
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
    health_score: {
      momentum: 'green',
      engagement: 'green',
      quality: 'amber',
      self_awareness: 'green',
      last_computed_at: new Date().toISOString(),
      check_in_interval_minutes: 15,
    },
    total_sessions: 12,
    total_evidence_count: 18,
    sessions_remaining: 4,
    started_at: new Date(Date.now() - 35 * 86400000).toISOString(),
    completed_at: null,
  };
}

function createMockMilestones(): QuestMilestone[] {
  return [
    // Planning phase
    {
      id: 'milestone-1',
      journey_id: 'demo-journey-1',
      phase: 'planning',
      title: 'Research waste streams',
      description: 'Audit school waste for one week, identify food waste percentage',
      order: 1,
      is_optional: false,
      design_phase: 'discover',
      completed_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      evidence_ids: ['evidence-1'],
    },
    {
      id: 'milestone-2',
      journey_id: 'demo-journey-1',
      phase: 'planning',
      title: 'Design compost system',
      description: 'Sketch bin designs, research materials and costs',
      order: 2,
      is_optional: false,
      design_phase: 'ideate',
      completed_at: new Date(Date.now() - 18 * 86400000).toISOString(),
      evidence_ids: ['evidence-2'],
    },
    {
      id: 'milestone-3',
      journey_id: 'demo-journey-1',
      phase: 'planning',
      title: 'Create workshop plan',
      description: 'Outline 4-week workshop series for Year 5 students',
      order: 3,
      is_optional: false,
      design_phase: 'ideate',
      completed_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      evidence_ids: ['evidence-3'],
    },
    // Working phase
    {
      id: 'milestone-4',
      journey_id: 'demo-journey-1',
      phase: 'working',
      title: 'Build compost bins',
      description: 'Construct bins with Year 5 team, test first batch',
      order: 4,
      is_optional: false,
      design_phase: 'prototype',
      completed_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      evidence_ids: ['evidence-4', 'evidence-5'],
    },
    {
      id: 'milestone-5',
      journey_id: 'demo-journey-1',
      phase: 'working',
      title: 'Run first workshop',
      description: 'Train Year 5 students on composting process and care',
      order: 5,
      is_optional: false,
      design_phase: 'prototype',
      completed_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      evidence_ids: ['evidence-6', 'evidence-7'],
    },
    {
      id: 'milestone-6',
      journey_id: 'demo-journey-1',
      phase: 'working',
      title: 'Monitor compost health',
      description: 'Track temperature, moisture, smell weekly. Adjust recipe if needed.',
      order: 6,
      is_optional: false,
      design_phase: 'test',
      completed_at: null,
      evidence_ids: [],
    },
    // Sharing phase
    {
      id: 'milestone-7',
      journey_id: 'demo-journey-1',
      phase: 'sharing',
      title: 'Final reflection written',
      description: 'Reflect on growth, impact, and what you learned about service',
      order: 7,
      is_optional: false,
      design_phase: 'define',
      completed_at: null,
      evidence_ids: [],
    },
    {
      id: 'milestone-8',
      journey_id: 'demo-journey-1',
      phase: 'sharing',
      title: 'Present to school community',
      description: 'Share project results, composting system, and Year 5 reflections at assembly',
      order: 8,
      is_optional: true,
      design_phase: 'define',
      completed_at: null,
      evidence_ids: [],
    },
  ];
}

function createMockEvidence(): QuestEvidence[] {
  return [
    {
      id: 'evidence-1',
      journey_id: 'demo-journey-1',
      student_id: 'demo-student',
      type: 'text',
      content: 'Over 1 week of waste audits, I found that the school canteen produces about 45kg of food waste daily. Main items: vegetable peelings (30%), plate waste (35%), spoiled prep items (20%), packaging (15%). This is huge—we could definitely use this for composting.',
      metadata: { word_count: 65 },
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      mime_type: 'text/plain',
    },
    {
      id: 'evidence-2',
      journey_id: 'demo-journey-1',
      student_id: 'demo-student',
      type: 'image',
      content: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzhjYTcxNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNiI+Q29tcG9zdCBCaW4gU2tldGNoPC90ZXh0Pjwvc3ZnPg==',
      metadata: { sketch_title: 'Compost bin design with 3 chambers', includes_dimensions: true },
      created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
      mime_type: 'image/svg+xml',
    },
    {
      id: 'evidence-3',
      journey_id: 'demo-journey-1',
      student_id: 'demo-student',
      type: 'text',
      content: 'Workshop Plan: Week 1 - Composting basics & food webs; Week 2 - Hands-on bin building; Week 3 - Maintaining the system; Week 4 - Harvesting and using compost in the garden. Each session 30 mins, includes discussion, hands-on activity, reflection.',
      metadata: { word_count: 52, activity_count: 4 },
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      mime_type: 'text/plain',
    },
    {
      id: 'evidence-4',
      journey_id: 'demo-journey-1',
      student_id: 'demo-student',
      type: 'image',
      content: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzY2YzJhNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNiI+Q29tcG9zdCBCaW5zIEJ1aWx0PC90ZXh0Pjwvc3ZnPg==',
      metadata: { photo_subject: 'Three assembled compost bins in garden', includes_people: true },
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      mime_type: 'image/svg+xml',
    },
    {
      id: 'evidence-5',
      journey_id: 'demo-journey-1',
      student_id: 'demo-student',
      type: 'text',
      content: 'Bin construction took 4 hours with 6 Year 5 volunteers. We used recycled wooden pallets and wire mesh. It was harder than expected—getting the bottoms secure to prevent rodent access was tricky. But once we figured it out, they were really proud of what they built.',
      metadata: { word_count: 57, reflection_depth: 'medium' },
      created_at: new Date(Date.now() - 9 * 86400000).toISOString(),
      mime_type: 'text/plain',
    },
    {
      id: 'evidence-6',
      journey_id: 'demo-journey-1',
      student_id: 'demo-student',
      type: 'text',
      content: 'First workshop: 8 Year 5 students attended. We covered: food web (compost = recycling nutrients), what goes in, what doesn\'t, smell/moisture clues. One student asked "can we compost paper towels?" which led to a great discussion about decomposition rates. They left excited to help manage it.',
      metadata: { word_count: 62, student_engagement: 'high', questions_asked: 3 },
      created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      mime_type: 'text/plain',
    },
    {
      id: 'evidence-7',
      journey_id: 'demo-journey-1',
      student_id: 'demo-student',
      type: 'image',
      content: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZDM0ZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzMzIiBmb250LXNpemU9IjE2Ij5Xb3Jrc2hvcCBQaG90bzwvdGV4dD48L3N2Zz4=',
      metadata: { photo_subject: 'Year 5 students with compost bins', group_size: 8 },
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      mime_type: 'image/svg+xml',
    },
  ];
}

export default function QuestDemoPage() {
  const [journey, setJourney] = useState<QuestJourney>(createMockJourney());
  const [currentPhase, setCurrentPhase] = useState<QuestPhase>('working');
  const [selectedMentor, setSelectedMentor] = useState<MentorId>('river');
  const [healthState, setHealthState] = useState<0 | 1 | 2>(0); // 0=all green, 1=mixed, 2=all red
  const milestones = createMockMilestones();
  const evidence = createMockEvidence();

  const handleMentorChange = (mentorId: string) => {
    setSelectedMentor(mentorId as MentorId);
    setJourney(prev => ({ ...prev, mentor_id: mentorId }));
  };

  const handlePhaseChange = (phase: QuestPhase) => {
    setCurrentPhase(phase);
    setJourney(prev => ({
      ...prev,
      phase,
      phase_entered_at: new Date().toISOString(),
    }));
  };

  const handleToggleHealth = () => {
    setHealthState(prev => ((prev + 1) % 3) as 0 | 1 | 2);
    const newHealth = {
      0: { momentum: 'green', engagement: 'green', quality: 'green', self_awareness: 'green' },
      1: { momentum: 'green', engagement: 'amber', quality: 'amber', self_awareness: 'green' },
      2: { momentum: 'red', engagement: 'red', quality: 'red', self_awareness: 'amber' },
    };
    setJourney(prev => ({
      ...prev,
      health_score: {
        ...prev.health_score,
        ...newHealth[healthState],
      },
    }));
  };

  const phaseLabels: Record<QuestPhase, string> = {
    'not_started': 'Start',
    discovery: 'Discovery',
    planning: 'Planning',
    working: 'Working',
    sharing: 'Sharing',
    completed: 'Completed',
  };

  const phaseMilestones = milestones.filter(m => m.phase === currentPhase);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/40 backdrop-blur border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Service Learning Quest</h1>
              <p className="text-purple-300 text-sm mt-1">Demo Mode — Full Journey Experience</p>
            </div>
            <div className="text-right text-sm text-purple-300">
              Student: <span className="text-white font-medium">Alex Chen</span>
              <br />
              Project: <span className="text-white font-medium">School Composting Program</span>
            </div>
          </div>

          {/* Phase navigation pills */}
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(phaseLabels) as QuestPhase[]).map(phase => (
              <button
                key={phase}
                onClick={() => handlePhaseChange(phase)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  currentPhase === phase
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {phaseLabels[phase]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overworld map strip */}
      <div className="bg-gradient-to-r from-indigo-950/40 to-purple-950/40 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="h-24 rounded-lg bg-slate-900/30 border border-purple-500/20 flex items-center justify-between px-4">
            <div className="text-xs text-purple-300">
              <p className="font-semibold mb-1">Journey Progress</p>
              <div className="flex gap-1">
                {(Object.keys(phaseLabels) as QuestPhase[]).map(phase => (
                  <div
                    key={phase}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentPhase === phase
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                        : phase === 'completed' ||
                          (Object.keys(phaseLabels).indexOf(phase) <
                            Object.keys(phaseLabels).indexOf(currentPhase))
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {phase.substring(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right text-xs text-purple-300">
              <p className="font-semibold">Evidence Collected: {evidence.length}</p>
              <p className="text-purple-400 mt-1">{journey.total_sessions} sessions completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {currentPhase === 'not_started' && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-12 border border-purple-500/20 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 mb-6">
                <span className="text-4xl">🗺️</span>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Begin Your Quest</h2>
            <p className="text-purple-300 mb-8 max-w-lg mx-auto">
              Discover your strengths, define your service project, and make a real difference in your community. Your journey starts with a conversation with your mentor.
            </p>
            <button
              onClick={() => handlePhaseChange('discovery')}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-600/50 transition-all"
            >
              Start Discovery Phase →
            </button>
          </div>
        )}

        {currentPhase === 'discovery' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-2">Choose Your Mentor</h2>
              <p className="text-purple-300 text-sm mb-6">
                Select a mentor whose style resonates with you. Your mentor will guide you through discovery.
              </p>
              <MentorSelector
                selected={selectedMentor}
                onChange={handleMentorChange}
              />
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-6">Discovery Journey</h2>
              <p className="text-purple-300 text-sm mb-4">
                Your mentor will ask you thought-provoking questions to help you discover your strengths, interests, and what drives you to help others.
              </p>
              {journey.discovery_profile && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-emerald-500/30">
                    <p className="text-emerald-400 font-medium text-sm mb-2">Strengths</p>
                    <ul className="text-purple-200 text-sm space-y-1">
                      {journey.discovery_profile.strengths.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-blue-500/30">
                    <p className="text-blue-400 font-medium text-sm mb-2">Interests</p>
                    <ul className="text-purple-200 text-sm space-y-1">
                      {journey.discovery_profile.interests.map((i, idx) => (
                        <li key={idx}>• {i}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentPhase === 'planning' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-2">Your Service Contract</h2>
              <p className="text-purple-300 text-sm mb-6">
                Clarify what success looks like. This contract defines your project scope and keeps you focused.
              </p>
              {journey.contract && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/30">
                    <p className="text-purple-400 font-medium text-sm mb-2">What</p>
                    <p className="text-slate-300 text-sm">{journey.contract.what}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-pink-500/30">
                    <p className="text-pink-400 font-medium text-sm mb-2">Who For</p>
                    <p className="text-slate-300 text-sm">{journey.contract.who_for}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-indigo-500/30 md:col-span-2">
                    <p className="text-indigo-400 font-medium text-sm mb-2">Success Looks Like</p>
                    <p className="text-slate-300 text-sm">{journey.contract.done_looks_like}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-2">Backward Timeline</h2>
              <p className="text-purple-300 text-sm mb-6">
                Work backward from your deadline to plan milestones and stay on track.
              </p>
              <div className="bg-slate-900/30 rounded-lg p-4 h-32 flex items-center justify-center border border-purple-500/20">
                <p className="text-slate-500">Timeline visualization</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-4">Planning Milestones</h2>
              <div className="space-y-3">
                {phaseMilestones.map(m => (
                  <div
                    key={m.id}
                    className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/30 flex items-start gap-3"
                  >
                    <div className={`mt-1 w-4 h-4 rounded-full flex-shrink-0 ${m.completed_at ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    <div className="flex-1">
                      <p className="text-white font-medium">{m.title}</p>
                      <p className="text-slate-400 text-sm mt-1">{m.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentPhase === 'working' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-2">Active Working Phase</h2>
              <p className="text-purple-300 text-sm mb-6">
                You're making progress! Capture evidence, hit milestones, and check in regularly with your mentor.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-900/50 rounded-lg p-4 border border-emerald-500/30">
                  <p className="text-emerald-400 text-xs font-medium uppercase mb-2">Momentum</p>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <p className="text-white font-semibold">Green</p>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-amber-500/30">
                  <p className="text-amber-400 text-xs font-medium uppercase mb-2">Quality</p>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <p className="text-white font-semibold">Amber</p>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-blue-500/30">
                  <p className="text-blue-400 text-xs font-medium uppercase mb-2">Sessions Left</p>
                  <p className="text-white font-semibold">{journey.sessions_remaining} remaining</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 rounded-lg p-4 border border-emerald-500/30 mb-6">
                <p className="text-emerald-200 text-sm font-medium mb-3">Recent Activity</p>
                <div className="space-y-2 text-emerald-300 text-sm">
                  <p>✓ Completed: Run first workshop</p>
                  <p>✓ Collected: 7 evidence items</p>
                  <p>→ Next: Monitor compost health (ongoing)</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-4">Evidence Captured</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evidence.slice(0, 4).map(e => (
                  <div key={e.id} className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/30">
                    <p className="text-purple-400 text-xs font-medium uppercase mb-2">{e.type}</p>
                    <p className="text-slate-300 text-sm line-clamp-3">
                      {typeof e.content === 'string' && !e.content.startsWith('data:') ? e.content : `[${e.type.toUpperCase()}]`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-4">Working Milestones</h2>
              <div className="space-y-3">
                {phaseMilestones.map(m => (
                  <div
                    key={m.id}
                    className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/30 flex items-start gap-3"
                  >
                    <div className={`mt-1 w-4 h-4 rounded-full flex-shrink-0 ${m.completed_at ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    <div className="flex-1">
                      <p className="text-white font-medium">{m.title}</p>
                      <p className="text-slate-400 text-sm mt-1">{m.description}</p>
                      {m.completed_at && <p className="text-emerald-400 text-xs mt-2">✓ Completed</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentPhase === 'sharing' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-2">Share Your Impact</h2>
              <p className="text-purple-300 text-sm mb-6">
                Reflect on what you learned and share your story with the community. Your impact extends beyond the project itself.
              </p>

              <div className="bg-gradient-to-r from-indigo-950 to-purple-950 rounded-lg p-6 border border-purple-500/30 mb-6">
                <p className="text-purple-200 font-semibold mb-3">Sharing Phase Tasks</p>
                <ul className="space-y-2 text-purple-300 text-sm">
                  <li>✓ Gather all evidence and reflections</li>
                  <li>✓ Write final reflection on growth and impact</li>
                  <li>→ Share results with school community (optional)</li>
                  <li>→ Archive your journey for the portfolio</li>
                </ul>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-6 border border-indigo-500/30">
                <p className="text-indigo-400 font-medium mb-4">All Evidence Collected</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {evidence.map((e, i) => (
                    <div key={e.id} className="text-center">
                      <div className="w-12 h-12 mx-auto rounded-lg bg-slate-800 flex items-center justify-center mb-2">
                        <span className="text-lg">
                          {e.type === 'text' && '📝'}
                          {e.type === 'image' && '📷'}
                          {e.type === 'video' && '🎥'}
                          {e.type === 'reflection' && '💭'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs capitalize">{e.type}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-4">Sharing Milestones</h2>
              <div className="space-y-3">
                {phaseMilestones.map(m => (
                  <div
                    key={m.id}
                    className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/30 flex items-start gap-3"
                  >
                    <div className={`mt-1 w-4 h-4 rounded-full flex-shrink-0 ${m.completed_at ? 'bg-emerald-500' : m.is_optional ? 'bg-slate-700' : 'bg-amber-500'}`} />
                    <div className="flex-1">
                      <p className="text-white font-medium">{m.title}</p>
                      <p className="text-slate-400 text-sm mt-1">{m.description}</p>
                      {m.is_optional && <p className="text-slate-500 text-xs mt-2">(Optional)</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentPhase === 'completed' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 rounded-xl p-12 border border-emerald-500/30 text-center">
              <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-emerald-600 to-indigo-600 mb-8 mx-auto shadow-lg shadow-emerald-600/50">
                <span className="text-6xl">🏆</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-3">Quest Complete!</h2>
              <p className="text-emerald-200 mb-8 max-w-2xl mx-auto text-lg">
                You've successfully designed and launched a school composting program, trained Year 5 leaders, and reduced food waste. Your service has real impact.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-900/50 rounded-lg p-6 border border-emerald-500/30">
                  <p className="text-emerald-400 text-sm font-medium mb-2">Hours Invested</p>
                  <p className="text-white text-3xl font-bold">28</p>
                  <p className="text-slate-400 text-xs mt-1">Across 12 sessions</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-6 border border-emerald-500/30">
                  <p className="text-emerald-400 text-sm font-medium mb-2">People Impacted</p>
                  <p className="text-white text-3xl font-bold">8+</p>
                  <p className="text-slate-400 text-xs mt-1">Year 5 compost champions</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-6 border border-emerald-500/30">
                  <p className="text-emerald-400 text-sm font-medium mb-2">Waste Diverted</p>
                  <p className="text-white text-3xl font-bold">27kg+</p>
                  <p className="text-slate-400 text-xs mt-1">Per week from landfill</p>
                </div>
              </div>

              <button
                onClick={() => handlePhaseChange('working')}
                className="px-6 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-all"
              >
                View Journey Timeline
              </button>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-4">Your Impact Story</h2>
              <div className="bg-slate-900/50 rounded-lg p-6 border border-purple-500/30">
                <p className="text-slate-300 leading-relaxed mb-4">
                  When I started this quest, I just wanted to reduce waste. But I discovered something bigger: leadership.
                  Teaching Year 5 students to care for the compost system, watching them get excited about turning food scraps into soil...
                  that changed how I think about making change. It's not about the bins. It's about the people. Now there's a team of
                  8 Year 5 leaders who care as much as I do.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Next year, I want to expand this to the primary school. And I want to help them design their own composting projects
                  in their hometowns. Real change spreads when you empower others.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Demo controls */}
      <div className="fixed bottom-6 right-6 bg-slate-900 border border-purple-500/40 rounded-lg p-4 shadow-xl max-w-xs space-y-3">
        <p className="text-purple-300 text-xs font-semibold uppercase">Demo Controls</p>

        <div>
          <label className="text-slate-400 text-xs block mb-2">Switch Mentor</label>
          <select
            value={selectedMentor}
            onChange={e => handleMentorChange(e.target.value)}
            className="w-full bg-slate-800 text-white text-sm rounded px-2 py-1 border border-purple-500/30"
          >
            <option value="kit">Kit the Maker</option>
            <option value="sage">Sage the Questioner</option>
            <option value="river">River the Storyteller</option>
            <option value="spark">Spark the Provocateur</option>
            <option value="haven">Haven the Builder</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 text-xs block mb-2">Jump to Phase</label>
          <select
            value={currentPhase}
            onChange={e => handlePhaseChange(e.target.value as QuestPhase)}
            className="w-full bg-slate-800 text-white text-sm rounded px-2 py-1 border border-purple-500/30"
          >
            {(Object.keys(phaseLabels) as QuestPhase[]).map(phase => (
              <option key={phase} value={phase}>
                {phaseLabels[phase]}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleToggleHealth}
          className="w-full bg-purple-600 text-white text-xs py-2 rounded hover:bg-purple-700 transition-colors"
        >
          Toggle Health ({['All Green', 'Mixed', 'All Red'][healthState]})
        </button>

        <p className="text-slate-500 text-xs pt-2 border-t border-slate-700">
          Clickable phase pills at top to navigate. All state is local.
        </p>
      </div>
    </div>
  );
}
