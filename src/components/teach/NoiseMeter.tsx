"use client";

import React, { useState, useRef, useEffect } from "react";

interface NoiseMeterProps {
  onProjectToScreen?: (data: { type: "noise"; level: number; threshold: number }) => void;
}

export default function NoiseMeter({ onProjectToScreen }: NoiseMeterProps) {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(70);
  const [error, setError] = useState<string>("");
  const [isAboveThreshold, setIsAboveThreshold] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const getStateLabel = (level: number): string => {
    if (level < 30) return "Quiet";
    if (level < 60) return "Working";
    if (level < 80) return "Loud";
    return "Too Loud";
  };

  const getStateColor = (level: number): string => {
    if (level < 30) return "#10b981"; // green
    if (level < 60) return "#3b82f6"; // blue
    if (level < 80) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  const startMic = async () => {
    try {
      setError("");

      // Check for browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Microphone API not supported in this browser");
        return;
      }

      // Request mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Connect mic stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsEnabled(true);

      // Start volume monitoring loop
      const updateVolume = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate RMS (root mean square) for perceived loudness
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / dataArray.length);

          // Scale to 0-100
          const level = Math.min(100, Math.round((rms / 255) * 100));
          setVolumeLevel(level);

          // Check if above threshold
          const above = level > threshold;
          setIsAboveThreshold(above);

          // Notify projector
          onProjectToScreen?.({ type: "noise", level, threshold });
        }

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone access denied. Please allow access and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found on this device.");
      } else {
        setError(`Error: ${err.message}`);
      }
      setIsEnabled(false);
    }
  };

  const stopMic = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsEnabled(false);
    setVolumeLevel(0);
    setIsAboveThreshold(false);
  };

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, []);

  const stateColor = getStateColor(volumeLevel);
  const stateLabel = getStateLabel(volumeLevel);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "16px",
        background: "rgba(15, 15, 25, 0.95)",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        minWidth: "240px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#e5e7eb",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: "0 0 0 0", fontSize: "14px", fontWeight: 600 }}>
          🎤 Noise Meter
        </h3>
        {isEnabled && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "#10b981",
              letterSpacing: "0.5px",
            }}
          >
            ACTIVE
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: "10px",
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: "8px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            fontSize: "12px",
            color: "#fca5a5",
            lineHeight: "1.4",
          }}
        >
          {error}
        </div>
      )}

      {/* Mic button */}
      {!isEnabled && !error && (
        <button
          onClick={startMic}
          style={{
            padding: "10px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4f46e5";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#6366f1";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Enable Microphone
        </button>
      )}

      {/* When enabled */}
      {isEnabled && (
        <>
          {/* Gauge SVG */}
          <svg width="100%" height="140" viewBox="0 0 240 140">
            {/* Background arc */}
            <path
              d="M 40 120 A 80 80 0 0 1 200 120"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
            />

            {/* Gradient fill arc (scaled by volume level) */}
            <defs>
              <linearGradient id="volumeGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            <path
              d="M 40 120 A 80 80 0 0 1 200 120"
              stroke="url(#volumeGradient)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(volumeLevel / 100) * 251} 251`}
              style={{ transition: "stroke-dasharray 0.1s linear" }}
            />

            {/* Threshold marker line */}
            <g>
              {/* Calculate position for threshold (0-180 degrees on semicircle) */}
              {(() => {
                const angle = ((threshold / 100) * 180 * Math.PI) / 180;
                const x = 120 + 80 * Math.cos(Math.PI - angle);
                const y = 120 + 80 * Math.sin(Math.PI - angle);
                return (
                  <line
                    x1={x}
                    y1={y}
                    x2={x}
                    y2={y - 10}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth="2"
                    strokeDasharray="3,2"
                  />
                );
              })()}
            </g>

            {/* Center text: current level */}
            <text
              x="120"
              y="95"
              textAnchor="middle"
              fontSize="32"
              fontWeight="700"
              fill={stateColor}
              fontFamily="'Menlo', 'Monaco', monospace"
            >
              {volumeLevel}
            </text>

            {/* State label below gauge */}
            <text
              x="120"
              y="135"
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill={stateColor}
              fontFamily="system-ui"
            >
              {stateLabel}
            </text>
          </svg>

          {/* Flash animation when above threshold */}
          {isAboveThreshold && (
            <div
              style={{
                padding: "8px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "6px",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: 600,
                color: "#fca5a5",
                animation: "pulse 0.6s infinite",
              }}
            >
              🔊 Too Loud!
            </div>
          )}

          {/* Threshold slider */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "#9ca3af",
                fontWeight: 500,
              }}
            >
              <span>Threshold</span>
              <span>{threshold}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "3px",
                background: "rgba(255, 255, 255, 0.1)",
                outline: "none",
                cursor: "pointer",
                accentColor: "#6366f1",
              }}
            />
          </div>

          {/* Disable button */}
          <button
            onClick={stopMic}
            style={{
              padding: "10px",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#dc2626";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ef4444";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Disable Microphone
          </button>

          {/* Pulse animation CSS */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
