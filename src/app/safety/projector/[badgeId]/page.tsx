"use client";

import { useState, useEffect, useCallback, use } from "react";
import { getBlocksFromBadge } from "@/lib/safety/content-blocks";
import type { ContentBlock } from "@/lib/safety/content-blocks";
import { SpotTheHazard } from "@/components/safety/blocks";

// ============================================================================
// Types
// ============================================================================

interface BadgeData {
  id: string;
  name: string;
  description: string | null;
  learn_content?: any[];
  learning_blocks?: ContentBlock[];
}

interface Slide {
  type: "title" | "concept" | "hazard" | "end";
  title: string;
  content?: string;
  icon?: string;
  tips?: string[];
  block?: ContentBlock;
}

// ============================================================================
// SVG Icons
// ============================================================================

const ChevronLeftIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// ============================================================================
// Projector Page
// ============================================================================

export default function SafetyProjectorPage({
  params,
}: {
  params: Promise<{ badgeId: string }>;
}) {
  const { badgeId } = use(params);
  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<Slide[]>([]);

  // Load badge data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/public/safety-badges/${badgeId}`);
        if (res.ok) {
          const data = await res.json();
          setBadge(data.badge || data);
        }
      } catch (err) {
        console.error("Failed to load badge:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [badgeId]);

  // Build slides from badge content
  useEffect(() => {
    if (!badge) return;

    const builtSlides: Slide[] = [];

    // Title slide
    builtSlides.push({
      type: "title",
      title: badge.name,
      content: badge.description || "Safety Training",
    });

    // Content slides from blocks
    const blocks = getBlocksFromBadge(badge);
    for (const block of blocks) {
      if (block.type === "spot_the_hazard") {
        builtSlides.push({
          type: "hazard",
          title: block.title || "Spot the Hazard",
          block,
        });
      } else if (block.type === "key_concept") {
        builtSlides.push({
          type: "concept",
          title: block.title || "Key Concept",
          content: block.content,
          icon: block.icon,
          tips: block.tips,
        });
      } else if (block.type === "scenario") {
        builtSlides.push({
          type: "concept",
          title: block.title || "Scenario",
          content: block.narrative,
        });
      } else if (block.type === "before_after") {
        builtSlides.push({
          type: "concept",
          title: block.title || "Before & After",
          content: `WRONG: ${block.before_label || "Before"}\n\nRIGHT: ${block.after_label || "After"}`,
        });
      } else if (block.type === "comprehension_check") {
        builtSlides.push({
          type: "concept",
          title: "Quick Check",
          content: block.question,
        });
      }
    }

    // End slide
    builtSlides.push({
      type: "end",
      title: "Ready for the Quiz?",
      content: `You've covered all the safety material for "${badge.name}". Time to test your knowledge!`,
    });

    setSlides(builtSlides);
  }, [badge]);

  // Keyboard navigation
  const goNext = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        window.close();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  // Listen for postMessage from teacher dashboard
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "projector-nav") {
        if (e.data.direction === "next") goNext();
        else if (e.data.direction === "prev") goPrev();
        else if (typeof e.data.slide === "number") setCurrentSlide(e.data.slide);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [goNext, goPrev]);

  if (loading) {
    return (
      <div style={{
        background: "#0a0a1a",
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, -apple-system, sans-serif",
      }}>
        <p style={{ color: "#94a3b8", fontSize: 18 }}>Loading...</p>
      </div>
    );
  }

  if (!badge || slides.length === 0) {
    return (
      <div style={{
        background: "#0a0a1a",
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, -apple-system, sans-serif",
      }}>
        <p style={{ color: "#94a3b8", fontSize: 18 }}>Badge not found</p>
      </div>
    );
  }

  const slide = slides[currentSlide];

  return (
    <div
      style={{
        background: "#0a0a1a",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: "Inter, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        cursor: "none",
        userSelect: "none",
      }}
      onClick={goNext}
    >
      {/* Progress bar */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: "#1e1b4b",
        zIndex: 50,
      }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg, #818cf8, #a855f7)",
          width: `${((currentSlide + 1) / slides.length) * 100}%`,
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* Slide counter */}
      <div style={{
        position: "fixed",
        top: 16,
        right: 24,
        color: "#64748b",
        fontSize: 14,
        zIndex: 50,
      }}>
        {currentSlide + 1} / {slides.length}
      </div>

      {/* Main content area */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 64px",
      }}>
        {/* Title slide */}
        {slide.type === "title" && (
          <div style={{ textAlign: "center", maxWidth: 800 }}>
            <div style={{ color: "#818cf8", marginBottom: 24 }}>
              <ShieldIcon />
            </div>
            <h1 style={{
              fontSize: "clamp(36px, 5vw, 64px)",
              fontWeight: 700,
              marginBottom: 16,
              background: "linear-gradient(135deg, #818cf8, #a855f7, #f472b6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              lineHeight: 1.2,
            }}>
              {slide.title}
            </h1>
            <p style={{ fontSize: 22, color: "#94a3b8", lineHeight: 1.6 }}>
              {slide.content}
            </p>
            <p style={{
              marginTop: 48,
              fontSize: 16,
              color: "#475569",
            }}>
              Press → or click to begin
            </p>
          </div>
        )}

        {/* Concept slide */}
        {slide.type === "concept" && (
          <div style={{ maxWidth: 900, width: "100%" }}>
            {slide.icon && (
              <div style={{ fontSize: 48, marginBottom: 16 }}>{slide.icon}</div>
            )}
            <h2 style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 700,
              color: "#e2e8f0",
              marginBottom: 24,
              lineHeight: 1.3,
            }}>
              {slide.title}
            </h2>
            {slide.content && (
              <p style={{
                fontSize: "clamp(18px, 2.5vw, 28px)",
                color: "#94a3b8",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}>
                {slide.content}
              </p>
            )}
            {slide.tips && slide.tips.length > 0 && (
              <div style={{ marginTop: 32 }}>
                {slide.tips.map((tip, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 12,
                    fontSize: 20,
                    color: "#cbd5e1",
                  }}>
                    <span style={{
                      color: "#818cf8",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hazard slide — interactive */}
        {slide.type === "hazard" && slide.block && (
          <div
            style={{ maxWidth: 1000, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#e2e8f0",
              marginBottom: 16,
              textAlign: "center",
            }}>
              {slide.title}
            </h2>
            <SpotTheHazard block={slide.block as any} />
          </div>
        )}

        {/* End slide */}
        {slide.type === "end" && (
          <div style={{ textAlign: "center", maxWidth: 700 }}>
            <div style={{
              fontSize: 64,
              marginBottom: 24,
            }}>
              ✅
            </div>
            <h2 style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 700,
              color: "#e2e8f0",
              marginBottom: 16,
            }}>
              {slide.title}
            </h2>
            <p style={{
              fontSize: 22,
              color: "#94a3b8",
              lineHeight: 1.6,
            }}>
              {slide.content}
            </p>
          </div>
        )}
      </div>

      {/* Navigation arrows (visible on hover) */}
      <div
        style={{
          position: "fixed",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: currentSlide > 0 ? 0.3 : 0,
          transition: "opacity 0.2s",
          cursor: "pointer",
          zIndex: 50,
        }}
        onClick={(e) => { e.stopPropagation(); goPrev(); }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0.8"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0.3"; }}
      >
        <ChevronLeftIcon />
      </div>
      <div
        style={{
          position: "fixed",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: currentSlide < slides.length - 1 ? 0.3 : 0,
          transition: "opacity 0.2s",
          cursor: "pointer",
          zIndex: 50,
        }}
        onClick={(e) => { e.stopPropagation(); goNext(); }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0.8"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0.3"; }}
      >
        <ChevronRightIcon />
      </div>

      {/* Keyboard hint */}
      <div style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        color: "#334155",
        fontSize: 13,
        zIndex: 50,
      }}>
        ← → arrows &nbsp;|&nbsp; Space to advance &nbsp;|&nbsp; Esc to close
      </div>
    </div>
  );
}
