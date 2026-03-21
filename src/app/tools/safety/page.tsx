'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct: number;
}

interface LearnContent {
  title: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

interface Badge {
  id: string;
  name: string;
  slug: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold';
  learn_content: LearnContent;
  question_pool: Question[];
}

type ViewMode = 'cards' | 'learn' | 'quiz';

export default function SafetyToolsPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    async function loadBadges() {
      try {
        setLoading(true);
        const response = await fetch('/api/public/safety-badges');
        if (response.ok) {
          const data = await response.json();
          setBadges(data.badges || []);
        }
      } catch (err) {
        console.error('Error loading badges:', err);
      } finally {
        setLoading(false);
      }
    }

    loadBadges();
  }, []);

  function startBadge(badge: Badge) {
    setSelectedBadge(badge);
    setViewMode('learn');
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizComplete(false);
    setScore(0);
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
      if (selectedAnswers[idx] === q.correct) {
        correctCount++;
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
    setViewMode('cards');
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizComplete(false);
    setScore(0);
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return { bg: 'rgba(184,134,11,0.1)', border: '#b8860b', text: '#8b6914' };
      case 'silver':
        return { bg: 'rgba(192,192,192,0.1)', border: '#c0c0c0', text: '#808080' };
      case 'gold':
        return { bg: 'rgba(255,215,0,0.1)', border: '#ffd700', text: '#b8960f' };
      default:
        return { bg: 'rgba(99,102,241,0.1)', border: '#6366f1', text: '#4f46e5' };
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return '🥉';
      case 'silver':
        return '🥈';
      case 'gold':
        return '🥇';
      default:
        return '⭐';
    }
  };

  // Cards view
  if (viewMode === 'cards' && !selectedBadge) {
    return (
      <div style={{ background: '#06060f', color: '#e8eaf0', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', paddingBottom: '60px' }}>
        <div style={{ position: 'relative', padding: 'clamp(48px, 5vw, 72px) 24px 48px', textAlign: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 20% 40%, rgba(99,102,241,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 30%, rgba(168,85,247,0.08) 0%, transparent 70%), radial-gradient(ellipse 70% 40% at 50% 80%, rgba(236,72,153,0.06) 0%, transparent 70%)', animation: 'aurora 25s ease-in-out infinite alternate' }} />
          <style>{`@keyframes aurora { 0% { transform: translate(0,0) scale(1); opacity: 1; } 50% { transform: translate(-2%,1%) scale(1.02); opacity: 0.8; } 100% { transform: translate(1%,-1%) scale(0.98); opacity: 1; } }`}</style>
          <div style={{ position: 'relative', maxWidth: '680px', margin: '0 auto' }}>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: '700', margin: '0 0 16px 0', background: 'linear-gradient(135deg, #818cf8 0%, #f472b6 50%, #fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              🛡️ Safety Badges
            </h1>
            <p style={{ fontSize: '18px', color: '#a8adc7', margin: '0', lineHeight: '1.6', fontWeight: '400' }}>
              Free interactive safety training. Learn, test yourself, and track your progress.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
            <p style={{ color: '#a8adc7' }}>Loading badges...</p>
          </div>
        ) : badges.length === 0 ? (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
            <p style={{ color: '#a8adc7' }}>No badges available yet.</p>
          </div>
        ) : (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            {['bronze', 'silver', 'gold'].map((tier) => {
              const tierBadges = badges.filter((b) => b.tier === tier);
              if (tierBadges.length === 0) return null;
              const tierColor = getTierColor(tier);
              const tierIcon = getTierIcon(tier);
              return (
                <div key={tier} style={{ marginBottom: '48px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <span style={{ fontSize: '24px' }}>{tierIcon}</span>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', textTransform: 'capitalize', margin: 0, color: '#e8eaf0' }}>
                      {tier} Badges
                    </h2>
                    <div style={{ flex: 1, height: '1px', background: '#404860' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {tierBadges.map((badge) => (
                      <div key={badge.id} style={{ background: 'rgba(30,27,75,0.6)', border: `2px solid ${tierColor.border}`, borderRadius: '12px', padding: '24px', cursor: 'pointer', transition: 'all 0.3s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.8)'; (e.currentTarget as HTMLDivElement).style.borderColor = tierColor.text; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,27,75,0.6)'; (e.currentTarget as HTMLDivElement).style.borderColor = tierColor.border; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.7 }}>{tierIcon}</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 8px 0' }}>{badge.name}</h3>
                        <p style={{ fontSize: '13px', color: '#a8adc7', margin: '0 0 16px 0', lineHeight: '1.5' }}>{badge.description}</p>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                          <span>{badge.question_pool?.length || 0} questions</span>
                          <span>•</span>
                          <span>~15 min</span>
                        </div>
                        <button onClick={() => startBadge(badge)} style={{ width: '100%', padding: '10px 16px', background: `linear-gradient(135deg, ${tierColor.border} 0%, ${tierColor.text} 100%)`, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}>
                          Start Badge →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: '72px', padding: '48px 24px', textAlign: 'center', borderTop: '1px solid #404860' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 16px 0' }}>Track Your Progress</h2>
          <p style={{ fontSize: '14px', color: '#a8adc7', margin: '0 0 24px auto', maxWidth: '600px' }}>Want to save your badge progress and use these badges in StudioLoom units? Sign up for free.</p>
          <Link href="/login" style={{ display: 'inline-block', padding: '12px 32px', background: 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', transition: 'opacity 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}>
            Sign Up for StudioLoom
          </Link>
        </div>
      </div>
    );
  }

  // Learn view
  if (viewMode === 'learn' && selectedBadge) {
    return (
      <div style={{ background: '#06060f', color: '#e8eaf0', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
          <button onClick={resetBadge} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #404860', borderRadius: '8px', color: '#a8adc7', cursor: 'pointer', fontSize: '14px', marginBottom: '24px', transition: 'all 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.color = '#e8eaf0'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#404860'; (e.currentTarget as HTMLButtonElement).style.color = '#a8adc7'; }}>
            ← Back to Badges
          </button>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#e8eaf0', margin: '0 0 8px 0' }}>{selectedBadge.name}</h1>
            <p style={{ fontSize: '15px', color: '#a8adc7', margin: 0 }}>{selectedBadge.description}</p>
          </div>
          {selectedBadge.learn_content?.sections?.map((section, idx) => (
            <div key={idx} style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid #404860', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 12px 0' }}>{section.title}</h2>
              <div style={{ fontSize: '14px', color: '#a8adc7', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{section.content}</div>
            </div>
          ))}
          <button onClick={goToQuiz} style={{ width: '100%', padding: '14px 24px', background: 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '32px', transition: 'opacity 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}>
            Take Quiz →
          </button>
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
        <div style={{ background: '#06060f', color: '#e8eaf0', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '500px', width: '100%', background: 'rgba(30,27,75,0.8)', border: `2px solid ${passed ? '#10b981' : '#ef4444'}`, borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>{passed ? '✅' : '❌'}</div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#e8eaf0', margin: '0 0 8px 0' }}>{passed ? 'Badge Earned!' : 'Try Again'}</h1>
            <p style={{ fontSize: '15px', color: '#a8adc7', margin: '0 0 24px 0' }}>You scored <strong>{score}%</strong> ({Object.keys(selectedAnswers).length}/{questions.length} correct)</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={resetBadge} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #404860', borderRadius: '8px', color: '#a8adc7', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#404860'; }}>
                Back to Badges
              </button>
              {!passed && (
                <button onClick={() => { setCurrentQuestionIndex(0); setSelectedAnswers({}); setQuizComplete(false); }} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
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
          <button onClick={() => setViewMode('learn')} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #404860', borderRadius: '8px', color: '#a8adc7', cursor: 'pointer', fontSize: '14px', marginBottom: '24px', transition: 'all 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#404860'; }}>
            ← Back to Learning
          </button>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#e8eaf0', margin: 0 }}>{selectedBadge.name} Quiz</h1>
              <span style={{ fontSize: '14px', color: '#a8adc7' }}>Question {currentQuestionIndex + 1} of {questions.length}</span>
            </div>
            <div style={{ height: '6px', background: '#404860', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #818cf8 0%, #a855f7 100%)', width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
          {currentQuestion && (
            <div style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid #404860', borderRadius: '12px', padding: '32px', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e8eaf0', margin: '0 0 24px 0', lineHeight: '1.5' }}>{currentQuestion.question}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentQuestion.options?.map((option, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: selectedAnswer === idx ? '#404860' : 'rgba(255,255,255,0.05)', border: `2px solid ${selectedAnswer === idx ? '#818cf8' : '#404860'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => { if (selectedAnswer !== idx) (e.currentTarget as HTMLLabelElement).style.background = 'rgba(255,255,255,0.08)'; }} onMouseLeave={(e) => { if (selectedAnswer !== idx) (e.currentTarget as HTMLLabelElement).style.background = 'rgba(255,255,255,0.05)'; }}>
                    <input type="radio" name={`question-${currentQuestionIndex}`} checked={selectedAnswer === idx} onChange={() => handleAnswerSelect(idx)} style={{ marginRight: '12px', cursor: 'pointer', width: '18px', height: '18px' }} />
                    <span style={{ fontSize: '14px', color: '#e8eaf0' }}>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
            <button onClick={handlePrevQuestion} disabled={currentQuestionIndex === 0} style={{ flex: 1, padding: '12px 24px', background: currentQuestionIndex === 0 ? '#404860' : 'transparent', border: `1px solid ${currentQuestionIndex === 0 ? '#404860' : '#6b7280'}`, borderRadius: '8px', color: currentQuestionIndex === 0 ? '#6b7280' : '#a8adc7', cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s' }} onMouseEnter={(e) => { if (currentQuestionIndex > 0) (e.currentTarget as HTMLButtonElement).style.borderColor = '#a8adc7'; }} onMouseLeave={(e) => { if (currentQuestionIndex > 0) (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280'; }}>
              ← Previous
            </button>
            {currentQuestionIndex === questions.length - 1 ? (
              <button onClick={submitQuiz} disabled={!allAnswered} style={{ flex: 1, padding: '12px 24px', background: allAnswered ? 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)' : 'linear-gradient(135deg, #404860 0%, #404860 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: allAnswered ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600', transition: 'opacity 0.2s' }} onMouseEnter={(e) => { if (allAnswered) (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'; }} onMouseLeave={(e) => { if (allAnswered) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}>
                Submit Quiz →
              </button>
            ) : (
              <button onClick={handleNextQuestion} disabled={selectedAnswer === undefined} style={{ flex: 1, padding: '12px 24px', background: selectedAnswer !== undefined ? 'linear-gradient(135deg, #818cf8 0%, #a855f7 100%)' : 'linear-gradient(135deg, #404860 0%, #404860 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: selectedAnswer !== undefined ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600', transition: 'opacity 0.2s' }} onMouseEnter={(e) => { if (selectedAnswer !== undefined) (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'; }} onMouseLeave={(e) => { if (selectedAnswer !== undefined) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}>
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
