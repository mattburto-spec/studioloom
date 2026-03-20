'use client';

import { useState } from 'react';

interface OnTheFlyPanelProps {
  classId: string;
  unitId: string;
  pageId?: string;
  studentCount: number;
  onActivityLaunched?: (activity: { type: string; prompt: string }) => void;
}

type ActivityType = 'poll' | 'exitTicket' | 'showMe' | 'thinkPairShare' | 'collaborateBoard' | 'reflection';
type PollOptionType = 'thumbs' | '1-5' | 'abcd' | 'agreeDisagree' | 'custom';

interface ActivityState {
  type: ActivityType | null;
  prompt: string;
  pollOptionType?: PollOptionType;
  pollOptions?: string[];
  sentenceStarters?: string[];
}

const ACTIVITY_TYPES = [
  { id: 'poll', label: 'Quick Poll', emoji: '📊' },
  { id: 'exitTicket', label: 'Exit Ticket', emoji: '📝' },
  { id: 'showMe', label: 'Show Me', emoji: '📸' },
  { id: 'thinkPairShare', label: 'Think-Pair-Share', emoji: '💬' },
  { id: 'collaborateBoard', label: 'Collaborate Board', emoji: '🗒️' },
  { id: 'reflection', label: 'Quick Reflection', emoji: '🤔' },
];

const POLL_PRESETS = [
  { label: 'Thumbs Up/Down', value: 'thumbs' },
  { label: '1-5 Scale', value: '1-5' },
  { label: 'A/B/C/D', value: 'abcd' },
  { label: 'Agree/Disagree', value: 'agreeDisagree' },
  { label: 'Custom', value: 'custom' },
];

const SENTENCE_STARTERS = [
  'I noticed that...',
  'I realized...',
  'One thing I learned is...',
  'I found it challenging to...',
  'Next time I would...',
];

export default function OnTheFlyPanel({
  classId,
  unitId,
  pageId,
  studentCount,
  onActivityLaunched,
}: OnTheFlyPanelProps) {
  const [state, setState] = useState<ActivityState>({ type: null, prompt: '' });
  const [isLaunching, setIsLaunching] = useState(false);
  const [liveActivityType, setLiveActivityType] = useState<string | null>(null);
  const [respondedCount, setRespondedCount] = useState(0);

  const handleActivitySelect = (type: ActivityType) => {
    setState({ type, prompt: '' });
    if (type === 'poll') {
      setState((prev) => ({ ...prev, pollOptionType: 'thumbs' }));
    }
  };

  const handlePollPresetChange = (preset: PollOptionType) => {
    setState((prev) => ({ ...prev, pollOptionType: preset }));
  };

  const handleAddCustomOption = () => {
    setState((prev) => ({
      ...prev,
      pollOptions: [...(prev.pollOptions || []), ''],
    }));
  };

  const handleCustomOptionChange = (index: number, value: string) => {
    setState((prev) => {
      const options = [...(prev.pollOptions || [])];
      options[index] = value;
      return { ...prev, pollOptions: options };
    });
  };

  const handleSentenceStarterToggle = (starter: string) => {
    setState((prev) => {
      const starters = [...(prev.sentenceStarters || [])];
      if (starters.includes(starter)) {
        return { ...prev, sentenceStarters: starters.filter((s) => s !== starter) };
      }
      return { ...prev, sentenceStarters: [...starters, starter] };
    });
  };

  const handleLaunchActivity = async () => {
    if (!state.type || !state.prompt.trim()) return;

    setIsLaunching(true);
    try {
      const response = await fetch('/api/teacher/teach/on-the-fly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          unitId,
          pageId,
          activityType: state.type,
          prompt: state.prompt,
          pollOptionType: state.pollOptionType,
          pollOptions: state.pollOptions,
          sentenceStarters: state.sentenceStarters,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLiveActivityType(state.type);
        setRespondedCount(0);
        onActivityLaunched?.({
          type: state.type,
          prompt: state.prompt,
        });

        // Reset form
        setState({ type: null, prompt: '' });
      }
    } catch (error) {
      console.error('Failed to launch activity:', error);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleCloseActivity = async () => {
    try {
      await fetch(`/api/teacher/teach/on-the-fly/${classId}`, {
        method: 'DELETE',
      });
      setLiveActivityType(null);
      setRespondedCount(0);
    } catch (error) {
      console.error('Failed to close activity:', error);
    }
  };

  // Live activity display
  if (liveActivityType) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '16px',
          backgroundColor: '#1E1E2E',
          borderRadius: '8px',
          border: '1px solid #353550',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              animation: 'pulse 2s infinite',
            }}
          />
          <span style={{ fontWeight: '600' }}>Activity Live</span>
        </div>

        <div
          style={{
            padding: '12px',
            borderRadius: '4px',
            backgroundColor: '#353550',
            marginBottom: '12px',
          }}
        >
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>
            Responses
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#7C3AED' }}>
            {respondedCount} / {studentCount}
          </div>
          <div
            style={{
              width: '100%',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: '#4B5563',
              marginTop: '8px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(respondedCount / studentCount) * 100}%`,
                backgroundColor: '#10B981',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleCloseActivity}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#4B5563',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#5A6B7F';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#4B5563';
          }}
        >
          Close Activity
        </button>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  // Activity form
  if (state.type) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '16px',
          backgroundColor: '#1E1E2E',
          borderRadius: '8px',
          border: '1px solid #353550',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '14px',
        }}
      >
        {/* Back Button */}
        <button
          onClick={() => setState({ type: null, prompt: '' })}
          style={{
            padding: '0',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#7C3AED',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '12px',
          }}
        >
          ← Back to Activities
        </button>

        {/* Activity Type Title */}
        <h3 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '600' }}>
          {ACTIVITY_TYPES.find((a) => a.id === state.type)?.label}
        </h3>

        {/* Common Prompt Field */}
        <div style={{ marginBottom: '12px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '4px',
              color: '#9CA3AF',
            }}
          >
            Prompt
          </label>
          <textarea
            value={state.prompt}
            onChange={(e) => setState((prev) => ({ ...prev, prompt: e.target.value }))}
            placeholder="Enter the activity prompt..."
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #353550',
              backgroundColor: '#353550',
              color: '#fff',
              fontSize: '13px',
              resize: 'vertical',
              minHeight: '80px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Poll-specific Options */}
        {state.type === 'poll' && (
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#9CA3AF',
              }}
            >
              Response Format
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {POLL_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() =>
                    handlePollPresetChange(preset.value as PollOptionType)
                  }
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: state.pollOptionType === preset.value ? '2px solid #7C3AED' : '1px solid #353550',
                    backgroundColor: state.pollOptionType === preset.value ? '#7C3AED' : '#353550',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {state.pollOptionType === 'custom' && (
              <div style={{ marginTop: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#9CA3AF',
                  }}
                >
                  Custom Options
                </label>
                {(state.pollOptions || []).map((option, idx) => (
                  <input
                    key={idx}
                    value={option}
                    onChange={(e) =>
                      handleCustomOptionChange(idx, e.target.value)
                    }
                    placeholder={`Option ${idx + 1}`}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #353550',
                      backgroundColor: '#353550',
                      color: '#fff',
                      fontSize: '12px',
                      marginBottom: '6px',
                      fontFamily: 'inherit',
                    }}
                  />
                ))}
                <button
                  onClick={handleAddCustomOption}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px dashed #353550',
                    backgroundColor: 'transparent',
                    color: '#7C3AED',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}
                >
                  + Add Option
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reflection-specific Sentence Starters */}
        {state.type === 'reflection' && (
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#9CA3AF',
              }}
            >
              Sentence Starters
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SENTENCE_STARTERS.map((starter) => (
                <button
                  key={starter}
                  onClick={() => handleSentenceStarterToggle(starter)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: (state.sentenceStarters || []).includes(starter) ? '2px solid #7C3AED' : '1px solid #353550',
                    backgroundColor: (state.sentenceStarters || []).includes(starter) ? '#7C3AED' : '#353550',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Push Button */}
        <button
          onClick={handleLaunchActivity}
          disabled={!state.prompt.trim() || isLaunching}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#7C3AED',
            color: '#fff',
            cursor: !state.prompt.trim() || isLaunching ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            opacity: !state.prompt.trim() || isLaunching ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {isLaunching ? 'Launching...' : `Push to ${studentCount} Students`}
        </button>
      </div>
    );
  }

  // Activity grid (initial state)
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '400px',
        padding: '16px',
        backgroundColor: '#1E1E2E',
        borderRadius: '8px',
        border: '1px solid #353550',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
      }}
    >
      <h3 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '600' }}>
        Quick Activities
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}
      >
        {ACTIVITY_TYPES.map((activity) => (
          <button
            key={activity.id}
            onClick={() => handleActivitySelect(activity.id as ActivityType)}
            style={{
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #353550',
              backgroundColor: '#353550',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#4B5563';
              (e.target as HTMLButtonElement).style.borderColor = '#7C3AED';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#353550';
              (e.target as HTMLButtonElement).style.borderColor = '#353550';
            }}
          >
            <span style={{ fontSize: '24px' }}>{activity.emoji}</span>
            <span>{activity.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
