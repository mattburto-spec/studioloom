'use client';

import { useState, useRef, useEffect } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

type StageType = 'intro' | 'working' | 'summary';
type EffortLevel = 'low' | 'medium' | 'high';

const SPEC_SECTIONS = [
  {
    label: 'Requirements',
    emoji: '📋',
    instruction: 'What MUST the design do?',
    placeholder: 'e.g., "Must be waterproof", "Must support 5kg load", "Must fit in a 30cm space"',
    guidance: 'Functional requirements — measurable. Not "it should be nice" — "it must do X".',
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.15)',
  },
  {
    label: 'Constraints',
    emoji: '⚠️',
    instruction: 'What limits exist?',
    placeholder: 'e.g., "Budget: $50", "Materials available: recycled plastic only", "Build time: 2 weeks"',
    guidance: 'Cost, materials, time, tools, safety rules, physical limitations.',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
  },
  {
    label: 'User Needs',
    emoji: '❤️',
    instruction: 'What does the user need from this?',
    placeholder: 'e.g., "Must feel comfortable for 8-hour use", "Should inspire confidence", "Aesthetically modern"',
    guidance: 'Comfort, usability, emotional response, aesthetics. The human side.',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.15)',
  },
  {
    label: 'Success Criteria',
    emoji: '✓',
    instruction: 'How will you know if it succeeds?',
    placeholder: 'e.g., "Prototype holds 5kg without breaking", "User can operate in <10 seconds", "Reduces setup time by 50%"',
    guidance: 'Measurable outcomes. How do you test? What does "good" look like?',
    color: '#d946ef',
    glow: 'rgba(217,70,239,0.15)',
  },
  {
    label: 'Specifications',
    emoji: '📐',
    instruction: 'Specific measurements and details.',
    placeholder: 'e.g., "Length: 150mm", "Weight: <200g", "Material: recycled PET plastic, 2mm thickness"',
    guidance: 'Numbers, not words. Dimensions (mm), weight (g), materials, colours, finishes. Be precise.',
    color: '#f43f5e',
    glow: 'rgba(244,63,94,0.15)',
  },
];

interface ToolState {
  stage: StageType;
  designTopic: string;
  sections: string[];
  currentSection: number;
  efforts: EffortLevel[];
}

interface ToolResponse {
  toolId: string;
  designTopic: string;
  stage: StageType;
  sections: string[];
  metadata: {
    timeSpentMs: number;
  };
}

function assessEffort(text: string): EffortLevel {
  const words = text.trim().split(/\s+/).length;
  const hasNumbers = /\d+/.test(text);
  const hasMeasurements = /\b(mm|cm|kg|g|hours|seconds|degrees|percent|%)\b/i.test(text);
  const hasSpecifics = /\b(must|should|requires|needs|at least|maximum|minimum)\b/i.test(text);

  if (words < 5) return 'low';
  if ((hasNumbers && hasMeasurements) || (hasSpecifics && words >= 12)) return 'high';
  if (words >= 8 || hasSpecifics) return 'medium';
  return 'low';
}

function getDepthInfo(effort: EffortLevel): { dots: 1 | 2 | 3; label: string; color: string } {
  if (effort === 'high') return { dots: 3, label: 'Detailed', color: '#a78bfa' };
  if (effort === 'medium') return { dots: 2, label: 'Good start', color: '#60a5fa' };
  return { dots: 1, label: 'Go deeper', color: '#f59e0b' };
}

export function DesignSpecificationTool({
  toolId = 'design-specification',
  mode = 'public',
  challenge: initialChallenge = '',
  sessionId: initialSessionId,
  onSave,
  onComplete,
  studentId,
  unitId,
  pageId,
}: {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  onSave?: (state: ToolState) => void;
  onComplete?: (data: ToolResponse) => void;
  studentId?: string;
  unitId?: string;
  pageId?: string;
}) {
  const [stage, setStage] = useState<StageType>(initialChallenge ? 'working' : 'intro');
  const [designTopic, setDesignTopic] = useState(initialChallenge);
  const [sections, setSections] = useState<string[]>(['', '', '', '', '']);
  const [currentSection, setCurrentSection] = useState(0);
  const [efforts, setEfforts] = useState<EffortLevel[]>(['low', 'low', 'low', 'low', 'low']);
  const [sessionId] = useState(() => initialSessionId || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const startTimeRef = useRef(Date.now());

  const { session, updateState: updateToolSession } = useToolSession({
    toolId: 'design-specification',
    studentId,
    mode: mode === 'public' ? 'standalone' : (mode as 'embedded' | 'standalone'),
    challenge: designTopic,
    unitId,
    pageId,
  });

  /* ─── Sync state to session ─── */
  useEffect(() => {
    if (studentId && mode !== 'public') {
      updateToolSession({
        stage,
        designTopic,
        sections,
        currentSection,
        efforts,
      });
    }
  }, [stage, designTopic, sections, currentSection, efforts, studentId, mode, updateToolSession]);

  const section = SPEC_SECTIONS[currentSection];

  const handleTopicSubmit = (value: string) => {
    if (value.trim()) {
      setDesignTopic(value);
      setStage('working');
    }
  };

  const handleSectionInput = (sectionIndex: number, value: string) => {
    const newEffort = assessEffort(value);
    const newEfforts = [...efforts];
    newEfforts[sectionIndex] = newEffort;
    setEfforts(newEfforts);

    const newSections = [...sections];
    newSections[sectionIndex] = value;
    setSections(newSections);

    if (value.trim()) {
      const messages: Record<EffortLevel, string> = {
        low: 'Be more specific',
        medium: 'Good — add more detail!',
        high: 'Precise and measurable!',
      };
      setToastMessage(messages[newEffort]);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleGenerateAnalysis = async () => {
    const filled = sections.filter((s) => s.trim()).length;
    if (filled < 3) {
      setAiAnalysis('Please fill in at least 3 sections before generating analysis.');
      return;
    }

    setLoadingAnalysis(true);
    try {
      const response = await fetch('/api/tools/design-specification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          sessionId,
          designTopic,
          sections: {
            requirements: sections[0],
            constraints: sections[1],
            userNeeds: sections[2],
            successCriteria: sections[3],
            specifications: sections[4],
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI analysis');
      const data = await response.json();
      setAiAnalysis(data.analysis || '');
    } catch (error) {
      setAiAnalysis('Could not generate analysis. Try again.');
      console.error(error);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleComplete = () => {
    const timeSpent = Date.now() - startTimeRef.current;
    const response: ToolResponse = {
      toolId,
      designTopic,
      stage,
      sections,
      metadata: { timeSpentMs: timeSpent },
    };
    onComplete?.(response);
  };

  if (stage === 'intro') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #0c0c24 0%, #1a0c2e 100%)', color: '#ffffff', minHeight: '100vh', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        {session.saveStatus !== 'idle' && (
          <div style={{
            position: 'fixed', top: '16px', right: '16px', fontSize: '13px', fontWeight: '500',
            padding: '8px 12px', borderRadius: '6px', zIndex: 1000,
            opacity: session.saveStatus === 'saved' ? 1 : 0.8,
            background: session.saveStatus === 'error' ? '#dc26261a' : '#10b98114',
            color: session.saveStatus === 'error' ? '#ef4444' : '#10b981',
          }}>
            {session.saveStatus === 'saving' && '⟳ Saving...'}
            {session.saveStatus === 'saved' && '✓ Saved'}
            {session.saveStatus === 'error' && '✕ Save failed'}
          </div>
        )}
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '500px', width: '100%' }} className="tool-screen">
          <h1 style={{ fontSize: '36px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>Design Specification</h1>
          <p style={{ fontSize: '16px', color: '#d0d0d0', marginBottom: '40px', textAlign: 'center', lineHeight: '1.6' }}>
            Define your design in detail. Requirements, constraints, user needs, success criteria, and precise specifications.
          </p>
          <p style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '30px', fontStyle: 'italic', textAlign: 'center' }}>
            A specification is a contract between you and your maker. Be clear. Be precise.
          </p>
          <div style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '12px', padding: '30px', marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '15px', fontSize: '14px', fontWeight: '600' }}>
              What are you designing?
            </label>
            <textarea
              placeholder="e.g., 'A water bottle for school backpacks' or 'A smartphone stand for desks'"
              value={designTopic}
              onChange={(e) => setDesignTopic(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.5)', background: 'rgba(0,0,0,0.3)', color: '#ffffff', fontSize: '14px', fontFamily: 'inherit', minHeight: '80px', resize: 'none' }}
            />
            <button
              onClick={() => handleTopicSubmit(designTopic)}
              style={{ width: '100%', padding: '12px 20px', marginTop: '20px', background: '#a855f7', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Start Specifying
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'working') {
    const sectionValue = sections[currentSection];
    const effort = efforts[currentSection];
    const depthInfo = getDepthInfo(effort);

    return (
      <div style={{ background: 'linear-gradient(135deg, #0c0c24 0%, #1a0c2e 100%)', color: '#ffffff', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '700px', margin: '0 auto' }} className="tool-screen">
          <div style={{ marginBottom: '40px' }}>
            <p style={{ fontSize: '12px', color: '#a0a0a0', marginBottom: '8px', fontWeight: '600' }}>DESIGNING</p>
            <h2 style={{ fontSize: '24px', margin: '0', fontWeight: 'bold' }}>{designTopic}</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '40px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {SPEC_SECTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSection(idx)}
                style={{ padding: '10px 14px', background: currentSection === idx ? s.color : 'rgba(168,85,247,0.2)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          <div style={{ background: `linear-gradient(135deg, ${section.glow} 0%, rgba(168,85,247,0.05) 100%)`, border: `1px solid ${section.color}33`, borderRadius: '12px', padding: '30px', marginBottom: '40px', animation: 'toolFadeIn 0.3s ease-out' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold' }}>
              {section.emoji} {section.label}
            </h3>
            <p style={{ fontSize: '14px', color: '#d0d0d0', marginBottom: '20px' }}>
              {section.instruction}
            </p>

            <textarea
              placeholder={section.placeholder}
              value={sectionValue}
              onChange={(e) => handleSectionInput(currentSection, e.target.value)}
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: `1px solid ${section.color}66`, background: 'rgba(0,0,0,0.4)', color: '#ffffff', fontSize: '14px', fontFamily: 'inherit', minHeight: '120px', resize: 'none', marginBottom: '15px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <p style={{ fontSize: '12px', color: '#a0a0a0', margin: '0' }}>
                {section.guidance}
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    style={{ width: '8px', height: '8px', borderRadius: '50%', background: i < depthInfo.dots ? section.color : 'rgba(168,85,247,0.2)' }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowExample(!showExample)}
              style={{ background: 'none', border: 'none', color: section.color, cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '0', textAlign: 'left' }}
            >
              {showExample ? '▼ Hide example' : '▶ See an example'}
            </button>

            {showExample && (
              <div style={{ background: 'rgba(168,85,247,0.1)', border: `1px solid ${section.color}44`, borderRadius: '8px', padding: '12px', marginTop: '12px', fontSize: '13px', color: '#e0e0e0' }}>
                {section.placeholder}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginBottom: '40px' }}>
            <button
              onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
              disabled={currentSection === 0}
              style={{ padding: '10px 16px', background: currentSection === 0 ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.4)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: currentSection === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentSection(Math.min(4, currentSection + 1))}
              disabled={currentSection === 4}
              style={{ padding: '10px 16px', background: currentSection === 4 ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.4)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: currentSection === 4 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Next →
            </button>
          </div>

          {sections.filter((s) => s.trim()).length >= 3 && (
            <button
              onClick={() => {
                handleGenerateAnalysis();
                setStage('summary');
              }}
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #a855f7 0%, #f43f5e 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', transition: 'all 0.2s' }}
            >
              See Specification
            </button>
          )}
        </div>

        {toastMessage && (
          <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: 'rgba(168,85,247,0.9)', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', animation: 'toolFadeIn 0.2s ease-in' }}>
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  if (stage === 'summary') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #0c0c24 0%, #1a0c2e 100%)', color: '#ffffff', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '700px', margin: '0 auto' }} className="tool-screen">
          <h1 style={{ fontSize: '28px', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold' }}>Your Design Specification</h1>
          <p style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '40px', textAlign: 'center' }}>
            Complete specification with AI analysis:
          </p>

          <div style={{ background: 'rgba(168,85,247,0.1)', border: '2px solid #a855f7', borderRadius: '12px', padding: '30px', marginBottom: '30px' }}>
            {SPEC_SECTIONS.map((s, idx) =>
              sections[idx] && (
                <div key={idx} style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '13px', color: s.color, marginBottom: '8px', fontWeight: '600', margin: '0 0 8px' }}>
                    {s.emoji} {s.label.toUpperCase()}
                  </h4>
                  <p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.6', margin: '0' }}>
                    {sections[idx]}
                  </p>
                </div>
              )
            )}
          </div>

          <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#f43f5e', fontWeight: '600' }}>AI Analysis</h3>
            {loadingAnalysis ? (
              <p style={{ fontSize: '13px', color: '#a0a0a0', margin: '0' }}>Analyzing your specification...</p>
            ) : (
              <p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.6', margin: '0' }}>
                {aiAnalysis}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setStage('working')}
              style={{ padding: '12px 24px', background: 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.6)', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Edit
            </button>
            <button
              onClick={handleComplete}
              style={{ padding: '12px 24px', background: '#a855f7', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
