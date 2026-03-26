'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SpotTheHazard, ModuleRenderer } from '@/components/safety/blocks';
import { BadgePathVisualization } from '@/components/safety';
import { WOODWORK_SCENE, METALWORK_SCENE, GENERAL_SCENE, SCENE_LIST } from '@/lib/safety/scenes';
import {
  GENERAL_WORKSHOP_MODULE,
  HAND_TOOL_MODULE,
  FIRE_SAFETY_MODULE,
  PPE_MODULE,
  WOOD_WORKSHOP_MODULE,
  METAL_WORKSHOP_MODULE,
  PLASTICS_MODULE,
  ELECTRONICS_MODULE,
  LASER_CUTTER_MODULE,
  THREE_D_PRINTER_MODULE,
  BAND_SAW_MODULE,
} from '@/lib/safety/modules';
import { BUILT_IN_BADGES } from '@/lib/safety/badge-definitions';
import type { BadgeDefinition } from '@/lib/safety/types';
import type { LearningModule } from '@/lib/safety/content-blocks';

type ViewMode = 'landing' | 'cards' | 'learn' | 'quiz';

export default function SafetyToolsPage() {
  const badges = BUILT_IN_BADGES;
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [activeScene, setActiveScene] = useState(WOODWORK_SCENE);
  const [moduleCompleted, setModuleCompleted] = useState(false);

  // Map badge slugs to rich learning modules
  const MODULE_MAP: Record<string, LearningModule> = {
    'general-workshop-safety': GENERAL_WORKSHOP_MODULE,
    'hand-tool-safety': HAND_TOOL_MODULE,
    'fire-safety-emergency': FIRE_SAFETY_MODULE,
    'ppe-fundamentals': PPE_MODULE,
    'wood-workshop-safety': WOOD_WORKSHOP_MODULE,
    'metal-workshop-safety': METAL_WORKSHOP_MODULE,
    'plastics-composites-safety': PLASTICS_MODULE,
    'electronics-soldering-safety': ELECTRONICS_MODULE,
    'laser-cutter-safety': LASER_CUTTER_MODULE,
    '3d-printer-safety': THREE_D_PRINTER_MODULE,
    'band-saw': BAND_SAW_MODULE,
  };

  function startBadge(badge: BadgeDefinition) {
    setSelectedBadge(badge);
    setViewMode('learn');
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizComplete(false);
    setScore(0);
    setModuleCompleted(false);
  }

  function goToQuiz() {
    setViewMode('quiz');
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizComplete(false);
    setScore(0);
  }

  function handleAnswerSelect(optionIndex: number) {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: optionIndex,
    });
  }

  function submitQuiz() {
    if (!selectedBadge) return;

    let correctCount = 0;
    selectedBadge.question_pool.forEach((q, idx) => {
      const selectedIdx = selectedAnswers[idx];
      if (selectedIdx !== undefined && q.options) {
        // Compare selected option text to correct_answer string
        if (q.options[selectedIdx] === q.correct_answer) {
          correctCount++;
        }
      } else if (q.type === 'true_false') {
        // For true/false, options are ['True', 'False'] and correct_answer is 'true'/'false'
        const selected = selectedIdx === 0 ? 'true' : 'false';
        if (selected === q.correct_answer) {
          correctCount++;
        }
      }
    });

    const percentage = Math.round(
      (correctCount / selectedBadge.question_pool.length) * 100
    );
    setScore(percentage);
    setQuizComplete(true);
  }

  function handleNextQuestion() {
    if (!selectedBadge) return;
    if (currentQuestionIndex < selectedBadge.question_pool.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }

  function handlePrevQuestion() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }

  function resetBadge() {
    setSelectedBadge(null);
    setViewMode('landing');
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizComplete(false);
    setScore(0);
  }

  const TIER_INFO: Record<number, { name: string; icon: string; border: string; text: string }> = {
    1: { name: 'Foundation', icon: '🛡️', border: '#10b981', text: '#059669' },
    2: { name: 'Workshop Areas', icon: '🏭', border: '#f59e0b', text: '#d97706' },
    3: { name: 'Machine Specific', icon: '⚙️', border: '#8b5cf6', text: '#7c3aed' },
    4: { name: 'Materials & Processes', icon: '🔬', border: '#ec4899', text: '#db2777' },
  };

  const getTierColor = (tier: number | string) => {
    const t = typeof tier === 'number' ? tier : 1;
    return TIER_INFO[t] || TIER_INFO[1];
  };

  // SVG Icons
  const BookIcon = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4h20v24H6z" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M16 4v24M8 8h16M8 14h16M8 20h16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );

  const EyeIcon = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="16" cy="16" r="4" fill="currentColor" />
      <path d="M3 16c2-4 6-8 13-8s11 4 13 8" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );

  const CheckIcon = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 16l5 5 13-13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );

  // Landing view
  if (viewMode === 'landing') {
    return (
      <div style={{ background: '#06060f', color: '#e8eaf0', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', paddingBottom: '60px' }}>
        {/* Hero Section with Interactive Demo */}
        <div style={{ position: 'relative', padding: 'clamp(48px, 5vw, 72px) 24px 48px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 20% 40%, rgba(99,102,241,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 30%, rgba(168,85,247,0.08) 0%, transparent 70%), radial-gradient(ellipse 70% 40% at 50% 80%, rgba(236,72,153,0.06) 0%, transparent 70%)', animation: 'aurora 25s ease-in-out infinite alternate' }} />
          <style>{`@keyframes aurora { 0% { transform: translate(0,0) scale(1); opacity: 1; } 50% { transform: translate(-2%,1%) scale(1.02); opacity: 0.8; } 100% { transform: translate(1%,-1%) scale(0.98); opacity: 1; } }`}</style>

          <div style={{ position: 'relative', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Headline */}
            <div style={{ textAlign: 'center', marginBottom: 'clamp(32px, 4vw, 48px)' }}>
              <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: '700', margin: '0 0 16px 0', background: 'linear-gradient(135deg, #818cf8 0%, #f472b6 50%, #fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                🛡️ Workshop Safety
              </h1>
              <p style={{ fontSize: 'clamp(16px, 2vw, 18px)', color: '#a8adc7', margin: '0 0 32px 0', lineHeight: '1.6', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', fontWeight: '400' }}>
                Interactive safety training. Spot hazards, learn risks, see what you remember. Play now — it takes 3 minutes.
              </p>
            </div>

            {/* Interactive Demo */}
            <div style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid #404860', borderRadius: '16px', padding: 'clamp(24px, 4vw, 40px)', marginBottom: 'clamp(48px, 6vw, 72px)', backdropFilter: 'blur(10px)' }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 12px 0' }}>
                  Try It: Spot the Hazards
                </h2>
                <p style={{ fontSize: '14px', color: '#a8adc7', margin: 0 }}>
                  Click on hazards in the scene. Can you find them all before running out of time?
                </p>
              </div>

              <div style={{ background: 'rgba(10,10,30,0.8)', borderRadius: '12px', padding: '24px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                    Choose a Scene
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {SCENE_LIST.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => setActiveScene(scene.id === 'woodwork-01' ? WOODWORK_SCENE : scene.id === 'metalwork-01' ? METALWORK_SCENE : GENERAL_SCENE)}
                        style={{
                          padding: '8px 14px',
                          background: activeScene.scene_id === scene.id ? 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)' : 'rgba(255,255,255,0.08)',
                          color: activeScene.scene_id === scene.id ? '#fff' : '#a8adc7',
                          border: activeScene.scene_id === scene.id ? 'none' : '1px solid #404860',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (activeScene.scene_id !== scene.id) {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeScene.scene_id !== scene.id) {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                          }
                        }}
                      >
                        {scene.name} ({scene.hazardCount})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Spot the Hazard Component */}
              <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
                <SpotTheHazard block={activeScene} />
              </div>
            </div>

            {/* How It Works Section */}
            <div style={{ marginBottom: 'clamp(48px, 6vw, 72px)' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '700', color: '#e8eaf0', margin: '0 0 12px 0' }}>
                  How It Works
                </h2>
                <p style={{ fontSize: '14px', color: '#a8adc7', margin: 0 }}>
                  A 3-step journey to workshop mastery
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {[
                  {
                    num: '1',
                    title: 'Interactive Learning',
                    desc: 'Play the Spot the Hazard game to learn real workshop risks. Each scene has 8–10 hazards to find.',
                    icon: BookIcon,
                  },
                  {
                    num: '2',
                    title: 'Hazard Discovery',
                    desc: 'Click to identify hazards. Get instant feedback on severity and learn the rule behind each risk.',
                    icon: EyeIcon,
                  },
                  {
                    num: '3',
                    title: 'Knowledge Test',
                    desc: 'Take a short quiz to prove your understanding. Pass to earn a safety badge.',
                    icon: CheckIcon,
                  },
                ].map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.num}
                      style={{
                        background: 'rgba(30,27,75,0.6)',
                        border: '1px solid #404860',
                        borderRadius: '12px',
                        padding: '32px 24px',
                        textAlign: 'center',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.8)';
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#6b7280';
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.6)';
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#404860';
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: '#818cf8' }}>
                        <Icon />
                      </div>
                      <div style={{ fontSize: '48px', fontWeight: '700', color: '#818cf8', marginBottom: '12px' }}>
                        {step.num}
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 12px 0' }}>
                        {step.title}
                      </h3>
                      <p style={{ fontSize: '14px', color: '#a8adc7', lineHeight: '1.6', margin: 0 }}>
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scene Browser */}
            <div style={{ marginBottom: 'clamp(48px, 6vw, 72px)' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '700', color: '#e8eaf0', margin: '0 0 12px 0' }}>
                  Explore All Scenes
                </h2>
                <p style={{ fontSize: '14px', color: '#a8adc7', margin: 0 }}>
                  Each workshop has unique hazards to discover
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                {[
                  { name: 'Woodworking', count: 10, icon: '🪵', desc: 'Power tools, blade guards, dust extraction' },
                  { name: 'Metalworking', count: 9, icon: '⚙️', desc: 'Grinders, lathes, hot work, rotating machinery' },
                  { name: 'General Design', count: 8, icon: '🔧', desc: 'Heat guns, adhesives, soldering, electrical' },
                ].map((scene, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(30,27,75,0.6)',
                      border: '1px solid #404860',
                      borderRadius: '12px',
                      padding: '24px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.8)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#6b7280';
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.6)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#404860';
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                      {scene.icon}
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 8px 0' }}>
                      {scene.name} Workshop
                    </h3>
                    <p style={{ fontSize: '13px', color: '#a8adc7', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                      {scene.desc}
                    </p>
                    <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                      {scene.count} hazards to spot
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Badge Skill Tree */}
            <div style={{ marginBottom: 'clamp(48px, 6vw, 72px)' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '700', color: '#e8eaf0', margin: '0 0 12px 0' }}>
                  Badge Progression Path
                </h2>
                <p style={{ fontSize: '14px', color: '#a8adc7', margin: 0 }}>
                  23 badges across 4 tiers — from foundations to machine-specific certification
                </p>
              </div>
              <div style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid #404860', borderRadius: '16px', padding: 'clamp(24px, 4vw, 40px)', backdropFilter: 'blur(10px)' }}>
                <BadgePathVisualization earnedBadgeIds={[]} theme="dark" />
              </div>
            </div>

            {/* Feature Highlights */}
            <div style={{ marginBottom: 'clamp(48px, 6vw, 72px)' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '700', color: '#e8eaf0', margin: '0 0 12px 0' }}>
                  What You'll Learn
                </h2>
                <p style={{ fontSize: '14px', color: '#a8adc7', margin: 0 }}>
                  5 types of interactive learning modules
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                  { emoji: '🎯', title: 'Spot the Hazard', desc: 'Click hazards in interactive scenes' },
                  { emoji: '📋', title: 'Scenarios', desc: 'Make decisions under pressure' },
                  { emoji: '📸', title: 'Before & After', desc: 'See the fix for each hazard' },
                  { emoji: '💡', title: 'Key Concepts', desc: 'Learn the rules behind the risks' },
                  { emoji: '✓', title: 'Quick Checks', desc: 'Test your understanding instantly' },
                  { emoji: '🏆', title: 'Badges', desc: 'Earn certification & track progress' },
                ].map((feat, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(30,27,75,0.6)',
                      border: '1px solid #404860',
                      borderRadius: '10px',
                      padding: '20px 16px',
                      textAlign: 'center',
                      transition: 'all 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.8)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#6b7280';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.6)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#404860';
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                      {feat.emoji}
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 4px 0' }}>
                      {feat.title}
                    </h3>
                    <p style={{ fontSize: '12px', color: '#a8adc7', margin: 0 }}>
                      {feat.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%)', border: '1px solid #404860', borderRadius: '12px', padding: 'clamp(40px, 6vw, 60px) 24px', textAlign: 'center', marginBottom: 'clamp(48px, 6vw, 72px)' }}>
              <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '700', color: '#e8eaf0', margin: '0 0 16px 0' }}>
                Ready to Certify Your Class?
              </h2>
              <p style={{ fontSize: '15px', color: '#a8adc7', margin: '0 0 32px 0', lineHeight: '1.6', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Teachers: create custom badges, track student progress, and embed safety training into your units.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link
                  href="/login"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '12px 32px',
                    background: 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
                  }}
                >
                  Sign In to StudioLoom
                </Link>
                <button
                  onClick={() => setViewMode('cards')}
                  style={{
                    padding: '12px 32px',
                    background: 'transparent',
                    color: '#818cf8',
                    border: '2px solid #818cf8',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(129,140,248,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  Browse Badges
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cards view
  if (viewMode === 'cards' && !selectedBadge) {
    return (
      <div style={{ background: '#06060f', color: '#e8eaf0', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', paddingBottom: '60px' }}>
        <div style={{ position: 'relative', padding: 'clamp(48px, 5vw, 72px) 24px 48px', textAlign: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 20% 40%, rgba(99,102,241,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 30%, rgba(168,85,247,0.08) 0%, transparent 70%), radial-gradient(ellipse 70% 40% at 50% 80%, rgba(236,72,153,0.06) 0%, transparent 70%)', animation: 'aurora 25s ease-in-out infinite alternate' }} />
          <style>{`@keyframes aurora { 0% { transform: translate(0,0) scale(1); opacity: 1; } 50% { transform: translate(-2%,1%) scale(1.02); opacity: 0.8; } 100% { transform: translate(1%,-1%) scale(0.98); opacity: 1; } }`}</style>
          <div style={{ position: 'relative', maxWidth: '680px', margin: '0 auto' }}>
            <button
              onClick={() => setViewMode('landing')}
              style={{
                marginBottom: '24px',
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid #404860',
                borderRadius: '8px',
                color: '#a8adc7',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
                (e.currentTarget as HTMLButtonElement).style.color = '#e8eaf0';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#404860';
                (e.currentTarget as HTMLButtonElement).style.color = '#a8adc7';
              }}
            >
              ← Back to Demo
            </button>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: '700', margin: '0 0 16px 0', background: 'linear-gradient(135deg, #818cf8 0%, #f472b6 50%, #fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              🛡️ Safety Badges
            </h1>
            <p style={{ fontSize: '18px', color: '#a8adc7', margin: '0', lineHeight: '1.6', fontWeight: '400' }}>
              Free interactive safety training. Learn, check your understanding, and track your progress.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            {[1, 2, 3, 4].map((tier) => {
              const tierBadges = badges.filter((b) => b.tier === tier);
              if (tierBadges.length === 0) return null;
              const tierInfo = TIER_INFO[tier] || TIER_INFO[1];
              return (
                <div key={tier} style={{ marginBottom: '48px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <span style={{ fontSize: '24px' }}>{tierInfo.icon}</span>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: '#e8eaf0' }}>
                      Tier {tier}: {tierInfo.name}
                    </h2>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>{tierBadges.length} badge{tierBadges.length !== 1 ? 's' : ''}</span>
                    <div style={{ flex: 1, height: '1px', background: '#404860' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {tierBadges.map((badge) => (
                      <div
                        key={badge.id}
                        style={{
                          background: 'rgba(30,27,75,0.6)',
                          border: `2px solid ${tierInfo.border}`,
                          borderRadius: '12px',
                          padding: '24px',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.8)';
                          (e.currentTarget as HTMLDivElement).style.borderColor = tierInfo.text;
                          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.6)';
                          (e.currentTarget as HTMLDivElement).style.borderColor = tierInfo.border;
                          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                        }}
                        onClick={() => startBadge(badge)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <span style={{ fontSize: '32px' }}>{badge.icon_name}</span>
                          <div style={{ padding: '2px 8px', borderRadius: '4px', background: `${tierInfo.border}20`, border: `1px solid ${tierInfo.border}40`, fontSize: '11px', fontWeight: '600', color: tierInfo.border }}>
                            Tier {tier}
                          </div>
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 8px 0' }}>
                          {badge.name}
                        </h3>
                        <p style={{ fontSize: '13px', color: '#a8adc7', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                          {badge.description}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                          <span>{badge.question_pool?.length || 0} questions</span>
                          <span>•</span>
                          <span>{badge.pass_threshold}% to pass</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); startBadge(badge); }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            background: `linear-gradient(135deg, ${tierInfo.border} 0%, ${tierInfo.text} 100%)`,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                          }}
                        >
                          Start Badge →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        <div style={{ marginTop: '72px', padding: '48px 24px', textAlign: 'center', borderTop: '1px solid #404860' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 16px 0' }}>
            Track Your Progress
          </h2>
          <p style={{ fontSize: '14px', color: '#a8adc7', margin: '0 0 24px auto', maxWidth: '600px' }}>
            Want to save your badge progress and use these badges in StudioLoom units? Sign up for free.
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
            }}
          >
            Sign Up for StudioLoom
          </Link>
        </div>
      </div>
    );
  }

  // Learn view
  if (viewMode === 'learn' && selectedBadge) {
    // Check if a rich learning module exists for this badge
    const richModule = MODULE_MAP[selectedBadge.slug];

    return (
      <div style={{ background: '#06060f', color: '#e8eaf0', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
          <button
            onClick={() => {
              setViewMode('cards');
              setSelectedBadge(null);
            }}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid #404860',
              borderRadius: '8px',
              color: '#a8adc7',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '24px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
              (e.currentTarget as HTMLButtonElement).style.color = '#e8eaf0';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#404860';
              (e.currentTarget as HTMLButtonElement).style.color = '#a8adc7';
            }}
          >
            ← Back to Badges
          </button>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#e8eaf0', margin: '0 0 8px 0' }}>
              {selectedBadge.name}
            </h1>
            <p style={{ fontSize: '15px', color: '#a8adc7', margin: 0 }}>
              {selectedBadge.description}
            </p>
          </div>

          {richModule ? (
            <>
              {/* Rich interactive learning module */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '16px 20px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '24px' }}>📚</span>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 4px 0' }}>
                      Interactive Learning Module — ~{richModule.estimated_minutes} min
                    </p>
                    <p style={{ fontSize: '12px', color: '#a8adc7', margin: 0 }}>
                      {richModule.learning_objectives.length} learning objectives • Complete all sections to unlock the quiz
                    </p>
                  </div>
                </div>
              </div>
              <ModuleRenderer
                module={richModule}
                onModuleComplete={() => setModuleCompleted(true)}
                showProgress={true}
              />
              <button
                onClick={goToQuiz}
                disabled={!moduleCompleted}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: moduleCompleted ? 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)' : '#374151',
                  color: moduleCompleted ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: moduleCompleted ? 'pointer' : 'not-allowed',
                  marginTop: '32px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (moduleCompleted) (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  if (moduleCompleted) (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
              >
                {moduleCompleted ? 'Take Quiz →' : 'Complete All Sections First'}
              </button>
            </>
          ) : (
            <>
              {/* Fallback: flat learn content cards */}
              {selectedBadge.learn_content?.map((card, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(30,27,75,0.6)',
                    border: '1px solid #404860',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '24px' }}>{card.icon}</span>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaf0', margin: 0 }}>
                      {card.title}
                    </h2>
                  </div>
                  <div style={{ fontSize: '14px', color: '#a8adc7', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {card.content}
                  </div>
                </div>
              ))}
              <button
                onClick={goToQuiz}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '32px',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
              >
                Take Quiz →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Quiz view
  if (viewMode === 'quiz' && selectedBadge) {
    const questions = selectedBadge.question_pool || [];
    const currentQuestion = questions[currentQuestionIndex];
    const selectedAnswer = selectedAnswers[currentQuestionIndex];
    const allAnswered = Object.keys(selectedAnswers).length === questions.length;

    if (quizComplete) {
      const passed = score >= 70;
      return (
        <div
          style={{
            background: '#06060f',
            color: '#e8eaf0',
            minHeight: '100vh',
            fontFamily: 'Inter, -apple-system, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              width: '100%',
              background: 'rgba(30,27,75,0.8)',
              border: `2px solid ${passed ? '#10b981' : '#ef4444'}`,
              borderRadius: '12px',
              padding: '48px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>
              {passed ? '✅' : '❌'}
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#e8eaf0', margin: '0 0 8px 0' }}>
              {passed ? 'Badge Earned!' : 'Try Again'}
            </h1>
            <p style={{ fontSize: '15px', color: '#a8adc7', margin: '0 0 24px 0' }}>
              You scored <strong>{score}%</strong> ({Object.keys(selectedAnswers).length}/{questions.length} correct)
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setSelectedBadge(null);
                  setViewMode('cards');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid #404860',
                  borderRadius: '8px',
                  color: '#a8adc7',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#404860';
                }}
              >
                Back to Badges
              </button>
              {!passed && (
                <button
                  onClick={() => {
                    setCurrentQuestionIndex(0);
                    setSelectedAnswers({});
                    setQuizComplete(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  Retake Quiz
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ background: '#06060f', color: '#e8eaf0', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '48px 24px' }}>
          <button
            onClick={() => setViewMode('learn')}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid #404860',
              borderRadius: '8px',
              color: '#a8adc7',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '24px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#404860';
            }}
          >
            ← Back to Learning
          </button>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#e8eaf0', margin: 0 }}>
                {selectedBadge.name} Quiz
              </h1>
              <span style={{ fontSize: '14px', color: '#a8adc7' }}>
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            <div style={{ height: '6px', background: '#404860', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #818cf8 0%, #a855f7 100%)',
                  width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
          {currentQuestion && (
            <div
              style={{
                background: 'rgba(30,27,75,0.6)',
                border: '1px solid #404860',
                borderRadius: '12px',
                padding: '32px',
                marginBottom: '32px',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#e8eaf0',
                  margin: '0 0 24px 0',
                  lineHeight: '1.5',
                }}
              >
                {currentQuestion.prompt}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(currentQuestion.options || (currentQuestion.type === 'true_false' ? ['True', 'False'] : []))?.map((option, idx) => (
                  <label
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '14px 16px',
                      background:
                        selectedAnswer === idx ? '#404860' : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${selectedAnswer === idx ? '#818cf8' : '#404860'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAnswer !== idx)
                        (e.currentTarget as HTMLLabelElement).style.background =
                          'rgba(255,255,255,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAnswer !== idx)
                        (e.currentTarget as HTMLLabelElement).style.background =
                          'rgba(255,255,255,0.05)';
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestionIndex}`}
                      checked={selectedAnswer === idx}
                      onChange={() => handleAnswerSelect(idx)}
                      style={{
                        marginRight: '12px',
                        cursor: 'pointer',
                        width: '18px',
                        height: '18px',
                      }}
                    />
                    <span style={{ fontSize: '14px', color: '#e8eaf0' }}>
                      {option}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
            <button
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0}
              style={{
                flex: 1,
                padding: '12px 24px',
                background: currentQuestionIndex === 0 ? '#404860' : 'transparent',
                border: `1px solid ${currentQuestionIndex === 0 ? '#404860' : '#6b7280'}`,
                borderRadius: '8px',
                color: currentQuestionIndex === 0 ? '#6b7280' : '#a8adc7',
                cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (currentQuestionIndex > 0)
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    '#a8adc7';
              }}
              onMouseLeave={(e) => {
                if (currentQuestionIndex > 0)
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    '#6b7280';
              }}
            >
              ← Previous
            </button>
            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={submitQuiz}
                disabled={!allAnswered}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: allAnswered
                    ? 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)'
                    : 'linear-gradient(135deg, #404860 0%, #404860 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: allAnswered ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (allAnswered)
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  if (allAnswered)
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
              >
                Submit Quiz →
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                disabled={selectedAnswer === undefined}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: selectedAnswer !== undefined
                    ? 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)'
                    : 'linear-gradient(135deg, #404860 0%, #404860 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedAnswer !== undefined ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedAnswer !== undefined)
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  if (selectedAnswer !== undefined)
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
