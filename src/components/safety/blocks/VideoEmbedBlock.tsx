"use client";

import { useState, useEffect } from "react";
import type { VideoEmbedBlock } from "@/lib/safety/content-blocks";

// ============================================================================
// Icons (inline SVGs, no lucide-react)
// ============================================================================

function PlayIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" fill="#fff" opacity="0.9" />
      <path d="M19 17L19 31L32 24L19 17Z" fill="#1a1a2e" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================================================
// Helper: Extract video ID and build embed URL
// ============================================================================

function getVideoEmbedUrl(url: string, startTime?: number, endTime?: number): string | null {
  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    let embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const params = new URLSearchParams();
    if (startTime) params.set("start", startTime.toString());
    if (endTime) params.set("end", endTime.toString());
    if (params.toString()) {
      embedUrl += `?${params.toString()}`;
    }
    return embedUrl;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Direct video file (mp4, webm, etc)
  if (url.match(/\.(mp4|webm|ogv|mov)$/i)) {
    return url;
  }

  return null;
}

function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogv|mov)$/i.test(url);
}

// ============================================================================
// Main Component
// ============================================================================

interface VideoEmbedBlockProps {
  block: VideoEmbedBlock;
  onComplete?: () => void;
}

export default function VideoEmbedBlockComponent({ block, onComplete }: VideoEmbedBlockProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const [isComplete, setIsComplete] = useState(false);
  const embedUrl = getVideoEmbedUrl(block.url, block.start_time, block.end_time);
  const isDirectVideo = embedUrl && isDirectVideoFile(block.url);

  // Countdown timer: after 10 seconds of play, mark as complete
  useEffect(() => {
    if (!hasStarted || isComplete) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsComplete(true);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [hasStarted, isComplete, onComplete]);

  if (!embedUrl) {
    return (
      <div style={{ background: "#1a1a2e", borderRadius: "16px", padding: "24px" }}>
        <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
          {block.title}
        </h3>
        <p style={{ color: "#ef4444", fontSize: "14px", margin: 0 }}>
          Invalid video URL. Please check the format.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "#1a1a2e", borderRadius: "16px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 12px" }}>
        <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>
          📹 {block.title}
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px", margin: "4px 0 0" }}>
          Watch to continue
        </p>
      </div>

      {/* Video Container */}
      <div
        style={{
          position: "relative",
          margin: "12px 16px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "2px solid #334155",
          aspectRatio: "16 / 9",
          background: "#000",
        }}
      >
        {!hasStarted && (
          <button
            onClick={() => setHasStarted(true)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: "none",
              background: "rgba(0, 0, 0, 0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              transition: "background 0.3s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0, 0, 0, 0.7)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0, 0, 0, 0.5)";
            }}
          >
            <PlayIcon />
          </button>
        )}

        {hasStarted && isDirectVideo ? (
          <video
            controls
            autoPlay
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          >
            <source src={embedUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : hasStarted ? (
          <iframe
            width="100%"
            height="100%"
            src={embedUrl}
            title={block.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              border: "none",
            }}
          />
        ) : null}
      </div>

      {/* Caption */}
      {block.caption && (
        <p
          style={{
            margin: "8px 24px 0",
            color: "#cbd5e1",
            fontSize: "13px",
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          {block.caption}
        </p>
      )}

      {/* Countdown / Completion state */}
      {hasStarted && !isComplete && (
        <div
          style={{
            margin: "16px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#334155",
            color: "#fbbf24",
            fontSize: "13px",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Continue available in {secondsRemaining}s...
        </div>
      )}

      {isComplete && (
        <div
          style={{
            padding: "12px 16px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            margin: "8px 16px 16px",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            animation: "slideIn 0.4s ease-out",
          }}
        >
          <CheckIcon />
          Video watched
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes slideIn {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
