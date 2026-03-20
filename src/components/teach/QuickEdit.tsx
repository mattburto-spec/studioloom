'use client';

import { useState, useCallback } from 'react';

interface QuickEditProps {
  unitId: string;
  pageId: string;
  content: {
    learningGoal?: string;
    workshopPhases?: {
      opening?: { hook?: string; durationMinutes?: number };
      miniLesson?: { focus?: string; durationMinutes?: number };
      workTime?: { durationMinutes?: number };
      debrief?: { protocol?: string; prompt?: string; durationMinutes?: number };
    };
  } | null;
  onSaved?: () => void;
}

type TabType = 'content' | 'timing' | 'notes';

const PHASE_COLORS: Record<string, string> = {
  opening: '#FFA500',
  miniLesson: '#3B82F6',
  workTime: '#10B981',
  debrief: '#8B5CF6',
};

export default function QuickEdit({
  unitId,
  pageId,
  content,
  onSaved,
}: QuickEditProps) {
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [isSaving, setSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  const [editContent, setEditContent] = useState({
    learningGoal: content?.learningGoal || '',
    openingHook: content?.workshopPhases?.opening?.hook || '',
    miniLessonFocus: content?.workshopPhases?.miniLesson?.focus || '',
    debriefPrompt: content?.workshopPhases?.debrief?.prompt || '',
    notes: '',
  });

  const [phaseDurations, setPhaseDurations] = useState({
    opening: content?.workshopPhases?.opening?.durationMinutes || 10,
    miniLesson: content?.workshopPhases?.miniLesson?.durationMinutes || 15,
    workTime: content?.workshopPhases?.workTime?.durationMinutes || 30,
    debrief: content?.workshopPhases?.debrief?.durationMinutes || 5,
  });

  const totalMinutes = Object.values(phaseDurations).reduce((a, b) => a + b, 0);

  const handleTextareaChange = (
    field: keyof typeof editContent,
    value: string
  ) => {
    setEditContent((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhaseDurationChange = (
    phase: keyof typeof phaseDurations,
    delta: number
  ) => {
    setPhaseDurations((prev) => ({
      ...prev,
      [phase]: Math.max(1, prev[phase] + delta),
    }));
  };

  const debouncedSave = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/teacher/teach/quick-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          pageId,
          content: {
            learningGoal: editContent.learningGoal,
            workshopPhases: {
              opening: {
                hook: editContent.openingHook,
                durationMinutes: phaseDurations.opening,
              },
              miniLesson: {
                focus: editContent.miniLessonFocus,
                durationMinutes: phaseDurations.miniLesson,
              },
              workTime: {
                durationMinutes: phaseDurations.workTime,
              },
              debrief: {
                prompt: editContent.debriefPrompt,
                durationMinutes: phaseDurations.debrief,
              },
            },
          },
          notes: editContent.notes,
        }),
      });

      if (response.ok) {
        setShowSavedFeedback(true);
        onSaved?.();
        setTimeout(() => setShowSavedFeedback(false), 2000);
      }
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setSaving(false);
    }
  }, [unitId, pageId, editContent, phaseDurations, onSaved]);

  const handleSave = () => {
    void debouncedSave();
  };

  return (
    <div
      style={{
        width: '340px',
        maxHeight: '400px',
        backgroundColor: '#1E1E2E',
        borderRadius: '8px',
        border: '1px solid #353550',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px',
          borderBottom: '1px solid #353550',
          backgroundColor: '#2A2A3E',
        }}
      >
        {(['content', 'timing', 'notes'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === tab ? '#7C3AED' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab ? '600' : '400',
              transition: 'all 0.2s',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          backgroundColor: '#1E1E2E',
        }}
      >
        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '4px',
                  color: '#9CA3AF',
                }}
              >
                Learning Goal
              </label>
              <textarea
                value={editContent.learningGoal}
                onChange={(e) =>
                  handleTextareaChange('learningGoal', e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #353550',
                  backgroundColor: '#353550',
                  color: '#fff',
                  fontSize: '13px',
                  resize: 'vertical',
                  minHeight: '60px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '4px',
                  color: '#9CA3AF',
                }}
              >
                Opening Hook
              </label>
              <textarea
                value={editContent.openingHook}
                onChange={(e) =>
                  handleTextareaChange('openingHook', e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #353550',
                  backgroundColor: '#353550',
                  color: '#fff',
                  fontSize: '13px',
                  resize: 'vertical',
                  minHeight: '60px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '4px',
                  color: '#9CA3AF',
                }}
              >
                Mini-Lesson Focus
              </label>
              <textarea
                value={editContent.miniLessonFocus}
                onChange={(e) =>
                  handleTextareaChange('miniLessonFocus', e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #353550',
                  backgroundColor: '#353550',
                  color: '#fff',
                  fontSize: '13px',
                  resize: 'vertical',
                  minHeight: '60px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '4px',
                  color: '#9CA3AF',
                }}
              >
                Debrief Prompt
              </label>
              <textarea
                value={editContent.debriefPrompt}
                onChange={(e) =>
                  handleTextareaChange('debriefPrompt', e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #353550',
                  backgroundColor: '#353550',
                  color: '#fff',
                  fontSize: '13px',
                  resize: 'vertical',
                  minHeight: '60px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'timing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(
              ['opening', 'miniLesson', 'workTime', 'debrief'] as const
            ).map((phase) => (
              <div
                key={phase}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  backgroundColor: '#353550',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: PHASE_COLORS[phase] || '#6B7280',
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>
                    {phase === 'miniLesson' ? 'Mini-Lesson' : phase.charAt(0).toUpperCase() + phase.slice(1)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <button
                    onClick={() =>
                      handlePhaseDurationChange(
                        phase as keyof typeof phaseDurations,
                        -1
                      )
                    }
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '1px solid #4B5563',
                      backgroundColor: '#2A2A3E',
                      color: '#9CA3AF',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      minWidth: '30px',
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: '600',
                    }}
                  >
                    {phaseDurations[phase as keyof typeof phaseDurations]}
                  </span>
                  <button
                    onClick={() =>
                      handlePhaseDurationChange(
                        phase as keyof typeof phaseDurations,
                        1
                      )
                    }
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '1px solid #4B5563',
                      backgroundColor: '#2A2A3E',
                      color: '#9CA3AF',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                borderRadius: '4px',
                backgroundColor: '#353550',
                fontSize: '13px',
                fontWeight: '600',
                color: '#9CA3AF',
              }}
            >
              Total: {totalMinutes} minutes
            </div>

            {totalMinutes > 60 && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  backgroundColor: '#7F1D1D',
                  fontSize: '12px',
                  color: '#FECACA',
                }}
              >
                ⚠️ Exceeds standard period length
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#9CA3AF',
              }}
            >
              Teacher Notes
            </label>
            <textarea
              value={editContent.notes}
              onChange={(e) => handleTextareaChange('notes', e.target.value)}
              placeholder="Notes for next time..."
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #353550',
                backgroundColor: '#353550',
                color: '#fff',
                fontSize: '13px',
                resize: 'vertical',
                minHeight: '250px',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid #353550',
          backgroundColor: '#2A2A3E',
          display: 'flex',
          gap: '8px',
        }}
      >
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#7C3AED',
            color: '#fff',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            opacity: isSaving ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        {showSavedFeedback && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              padding: '8px 12px',
              borderRadius: '4px',
              backgroundColor: '#10B981',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              animation: 'fadeOut 2s ease-in-out forwards',
            }}
          >
            Saved ✓
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeOut {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
