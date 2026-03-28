'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useToolSession } from '@/hooks/useToolSession';

interface ToolkitToolProps {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  studentId?: string;
  unitId?: string;
  pageId?: string;
  onSave?: (state: any) => void;
  onComplete?: (data: any) => void;
}

interface Sketch {
  id: string;
  dataUrl: string;
  timestamp: number;
  note: string;
  duration: number;
}

interface ToolState {
  stage: 'intro' | 'sketching' | 'gallery';
  challenge: string;
  sketches: Sketch[];
  currentSketchData: string | null;
  selectedDuration: number;
  strokes: Array<{ x: number; y: number; size: number; color: string; isEraser: boolean }[]>;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 500;
const COLORS = ['#000000', '#7b2ff2', '#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];
const COLOR_LABELS = ['Black', 'Purple', 'Blue', 'Red', 'Green', 'Orange'];
const DURATIONS = [
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '5 min', seconds: 300 },
];

const PenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const EraserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l3.12 3.12a1 1 0 0 1 0 1.41L2.5 16.25a2 2 0 0 0 0 2.83l2.83 2.83a2 2 0 0 0 2.83 0L20.29 7.29a1 1 0 0 1 1.41 0L22 4" />
  </svg>
);

const ClearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const UndoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
  </svg>
);

const CircleProgressRing = ({ progress, radius = 45 }: { progress: number; radius?: number }) => {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={radius * 2 + 10} height={radius * 2 + 10} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={radius + 5}
        cy={radius + 5}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="3"
      />
      <motion.circle
        cx={radius + 5}
        cy={radius + 5}
        r={radius}
        fill="none"
        stroke="#fbbf24"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
};

export function QuickSketchTool({
  mode,
  challenge: initialChallenge = '',
  studentId = '',
  unitId = '',
  pageId = '',
  onComplete,
}: ToolkitToolProps) {
  const [state, setState] = useState<ToolState>({
    stage: 'intro',
    challenge: initialChallenge,
    sketches: [],
    currentSketchData: null,
    selectedDuration: 120,
    strokes: [],
  });

  const [timeRemaining, setTimeRemaining] = useState(state.selectedDuration);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(2);
  const [isErasing, setIsErasing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Persist state
  const { session: toolSession, updateState: updateToolSession } = useToolSession({
    toolId: 'quick-sketch',
    studentId,
    mode: mode === 'public' ? 'standalone' : mode,
    challenge: state.challenge,
    unitId,
    pageId,
  });

  useEffect(() => {
    if (toolSession?.state) {
      setState(toolSession.state);
    }
  }, [toolSession]);

  const saveState = useCallback(() => {
    if (mode === 'public') return;
    setSaveStatus('saving');
    updateToolSession(state)
      .then(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      })
      .catch(() => setSaveStatus('error'));
  }, [state, updateToolSession, mode]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((t) => t - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isTimerActive) {
      setIsTimerActive(false);
      saveSketch();
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeRemaining]);

  const drawLine = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = isErasing ? selectedSize * 3 : selectedSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isErasing) {
      ctx.clearRect(toX - selectedSize * 1.5, toY - selectedSize * 1.5, selectedSize * 3, selectedSize * 3);
    } else {
      ctx.strokeStyle = selectedColor;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }
  }, [selectedColor, selectedSize, isErasing]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawLine(x, y, x, y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawLine(x - 2, y - 2, x, y);
  };

  const handleCanvasMouseUp = () => {
    isDrawingRef.current = false;
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    drawLine(x, y, x, y);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    drawLine(x - 2, y - 2, x, y);
  };

  const handleCanvasTouchEnd = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  };

  const undoStroke = () => {
    const canvas = canvasRef.current;
    if (!canvas || state.strokes.length === 0) return;

    const newStrokes = state.strokes.slice(0, -1);
    setState((s) => ({ ...s, strokes: newStrokes }));

    // Redraw canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    newStrokes.forEach((stroke) => {
      stroke.forEach((point, i) => {
        if (i === 0) return;
        const prev = stroke[i - 1];
        ctx.lineWidth = point.size * (point.isEraser ? 3 : 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (point.isEraser) {
          ctx.clearRect(point.x - point.size * 1.5, point.y - point.size * 1.5, point.size * 3, point.size * 3);
        } else {
          ctx.strokeStyle = point.color;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      });
    });
  };

  const saveSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png', 0.6);
    const newSketch: Sketch = {
      id: Date.now().toString(),
      dataUrl,
      timestamp: Date.now(),
      note: '',
      duration: state.selectedDuration - timeRemaining,
    };
    setState((s) => ({
      ...s,
      sketches: [...s.sketches, newSketch],
      strokes: [],
    }));
    clearCanvas();
    setTimeRemaining(state.selectedDuration);
  };

  const updateSketchNote = (sketchId: string, note: string) => {
    setState((s) => ({
      ...s,
      sketches: s.sketches.map((sk) => (sk.id === sketchId ? { ...sk, note } : sk)),
    }));
  };

  const startIntro = () => {
    if (!state.challenge.trim()) return;
    setState((s) => ({ ...s, stage: 'sketching' }));
    setTimeRemaining(state.selectedDuration);
    clearCanvas();
  };

  const startSketching = () => {
    setIsTimerActive(true);
  };

  const goToGallery = () => {
    setState((s) => ({ ...s, stage: 'gallery' }));
    if (onComplete) {
      onComplete({
        challenge: state.challenge,
        sketches: state.sketches,
        totalSketches: state.sketches.length,
      });
    }
  };

  const resetTool = () => {
    setState({
      stage: 'intro',
      challenge: '',
      sketches: [],
      currentSketchData: null,
      selectedDuration: 120,
      strokes: [],
    });
    setTimeRemaining(120);
    setIsTimerActive(false);
  };

  useEffect(() => {
    saveState();
  }, [state]);

  // Intro Stage
  if (state.stage === 'intro') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        style={{
          background: 'linear-gradient(135deg, #0c0c1a 0%, #12122a 100%)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          position: 'relative',
          color: '#e8eaf0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Save Status */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            fontSize: '14px',
            color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : '#6b7394',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {saveStatus === 'saving' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>⟳</motion.div>}
          {saveStatus === 'saved' && '✓ Saved'}
          {saveStatus === 'error' && '✕ Save failed'}
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            textAlign: 'center',
            maxWidth: '600px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>✏️</div>
          <h1 style={{ fontSize: '36px', marginBottom: '12px', fontWeight: '700', color: '#fbbf24' }}>Quick Sketch</h1>
          <p style={{ fontSize: '16px', color: '#a0aec0', marginBottom: '40px' }}>
            Explore ideas visually. Sketch your challenge, then spend time exploring solutions on canvas.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '32px',
            background: '#12122a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            marginBottom: '24px',
          }}
        >
          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: '500', color: '#cbd5e0' }}>
            What's your design challenge?
          </label>
          <textarea
            value={state.challenge}
            onChange={(e) => setState((s) => ({ ...s, challenge: e.target.value }))}
            placeholder="e.g., 'Sketch 3 ways to improve a water bottle...' or 'Sketch solutions for better classroom storage...'"
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '12px',
              background: '#0c0c1a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#e8eaf0',
              fontSize: '14px',
              fontFamily: 'inherit',
              marginBottom: '16px',
              resize: 'vertical',
            }}
          />

          <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: '500', color: '#cbd5e0' }}>
            Sketching duration per round
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {DURATIONS.map((dur) => (
              <motion.button
                key={dur.seconds}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setState((s) => ({ ...s, selectedDuration: dur.seconds }))}
                style={{
                  padding: '8px 16px',
                  background: state.selectedDuration === dur.seconds ? '#fbbf24' : 'rgba(255,255,255,0.08)',
                  color: state.selectedDuration === dur.seconds ? '#0c0c1a' : '#e8eaf0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {dur.label}
              </motion.button>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startIntro}
            disabled={!state.challenge.trim()}
            style={{
              width: '100%',
              padding: '12px',
              background: !state.challenge.trim() ? 'rgba(255,255,255,0.1)' : '#fbbf24',
              color: !state.challenge.trim() ? '#6b7394' : '#0c0c1a',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: !state.challenge.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Start Sketching
          </motion.button>
        </motion.div>

        {state.sketches.length > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={goToGallery}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.08)',
              color: '#e8eaf0',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Skip to Gallery ({state.sketches.length} sketches)
          </motion.button>
        )}
      </motion.div>
    );
  }

  // Sketching Stage
  if (state.stage === 'sketching') {
    const progress = ((state.selectedDuration - timeRemaining) / state.selectedDuration) * 100;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          background: 'linear-gradient(135deg, #0c0c1a 0%, #12122a 100%)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px',
          color: '#e8eaf0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            width: '100%',
            maxWidth: '700px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#fbbf24', margin: 0 }}>Sketch Round {state.sketches.length + 1}</h2>
            <p style={{ fontSize: '13px', color: '#6b7394', margin: '4px 0 0 0' }}>{state.challenge}</p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              position: 'fixed',
              top: 20,
              right: 20,
              fontSize: '14px',
              color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : '#6b7394',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {saveStatus === 'saving' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>⟳</motion.div>}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '✕ Save failed'}
          </motion.div>
        </div>

        {/* Canvas Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            position: 'relative',
            marginBottom: '24px',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid #fbbf24',
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.1)',
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
            style={{
              background: '#ffffff',
              cursor: 'crosshair',
              display: 'block',
            }}
          />

          {/* Timer Ring Overlay */}
          {isTimerActive && (
            <motion.div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <CircleProgressRing progress={progress} />
              <div style={{ marginTop: '8px', fontSize: '28px', fontWeight: '700', color: '#fbbf24' }}>
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            width: '100%',
            maxWidth: '700px',
            padding: '20px',
            background: '#12122a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            marginBottom: '24px',
          }}
        >
          {/* Color Palette */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#cbd5e0', marginBottom: '8px', textTransform: 'uppercase' }}>
              Colors
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {COLORS.map((color, i) => (
                <motion.button
                  key={color}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedColor(color);
                    setIsErasing(false);
                  }}
                  title={COLOR_LABELS[i]}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: color,
                    border: selectedColor === color && !isErasing ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#cbd5e0', marginBottom: '8px', textTransform: 'uppercase' }}>
              Brush Size
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {[1, 2, 4, 6].map((size) => (
                <motion.button
                  key={size}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedSize(size)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: selectedSize === size ? '#fbbf24' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: size * 2,
                      height: size * 2,
                      borderRadius: '50%',
                      background: selectedSize === size ? '#0c0c1a' : 'rgba(232,234,240,0.3)',
                    }}
                  />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Tool Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsErasing(false);
              }}
              title="Pen"
              style={{
                padding: '8px 12px',
                background: !isErasing ? '#fbbf24' : 'rgba(255,255,255,0.08)',
                color: !isErasing ? '#0c0c1a' : '#e8eaf0',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              <PenIcon /> Draw
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsErasing(true)}
              title="Eraser"
              style={{
                padding: '8px 12px',
                background: isErasing ? '#fbbf24' : 'rgba(255,255,255,0.08)',
                color: isErasing ? '#0c0c1a' : '#e8eaf0',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              <EraserIcon /> Erase
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={undoStroke}
              title="Undo"
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.08)',
                color: '#e8eaf0',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              <UndoIcon /> Undo
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearCanvas}
              title="Clear"
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.08)',
                color: '#e8eaf0',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              <ClearIcon /> Clear
            </motion.button>
          </div>
        </motion.div>

        {/* Timer and Actions */}
        <div
          style={{
            width: '100%',
            maxWidth: '700px',
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          {!isTimerActive ? (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startSketching}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#fbbf24',
                  color: '#0c0c1a',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Start Timer
              </motion.button>
              {state.sketches.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={goToGallery}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#e8eaf0',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Go to Gallery
                </motion.button>
              )}
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsTimerActive(false)}
              style={{
                flex: 1,
                padding: '12px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Stop Timer
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  // Gallery Stage
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        background: 'linear-gradient(135deg, #0c0c1a 0%, #12122a 100%)',
        minHeight: '100vh',
        padding: '40px 20px',
        color: '#e8eaf0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Save Status */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          fontSize: '14px',
          color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : '#6b7394',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 50,
        }}
      >
        {saveStatus === 'saving' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>⟳</motion.div>}
        {saveStatus === 'saved' && '✓ Saved'}
        {saveStatus === 'error' && '✕ Save failed'}
      </motion.div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#fbbf24', margin: '0 0 12px 0' }}>Sketch Gallery</h1>
          <p style={{ fontSize: '16px', color: '#a0aec0', margin: 0 }}>{state.sketches.length} sketches created</p>
          <p style={{ fontSize: '13px', color: '#6b7394', margin: '4px 0 0 0' }}>Challenge: {state.challenge}</p>
        </motion.div>

        {state.sketches.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#12122a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
            <p style={{ fontSize: '16px', color: '#a0aec0' }}>No sketches yet. Go back and create some!</p>
          </motion.div>
        ) : (
          <motion.div
            layout
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              marginBottom: '40px',
            }}
          >
            <AnimatePresence>
              {state.sketches.map((sketch, i) => (
                <motion.div
                  key={sketch.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    background: '#12122a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '4/3',
                      overflow: 'hidden',
                      background: '#ffffff',
                    }}
                  >
                    <img
                      src={sketch.dataUrl}
                      alt={`Sketch ${i + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>

                  <div style={{ padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7394', marginBottom: '8px' }}>
                      Sketch {i + 1} • {sketch.duration}s
                    </div>
                    <textarea
                      value={sketch.note}
                      onChange={(e) => updateSketchNote(sketch.id, e.target.value)}
                      placeholder="Add notes about this sketch..."
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '8px',
                        background: '#0c0c1a',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '6px',
                        color: '#e8eaf0',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setState((s) => ({ ...s, stage: 'sketching' }))}
            style={{
              padding: '12px 24px',
              background: '#fbbf24',
              color: '#0c0c1a',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Add More Sketches
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetTool}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.08)',
              color: '#e8eaf0',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Start New Challenge
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
