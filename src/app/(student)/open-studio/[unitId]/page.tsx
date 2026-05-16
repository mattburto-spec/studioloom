"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { JourneyMap } from "@/components/open-studio/JourneyMap";
import { DiscoveryFlow } from "@/components/open-studio/DiscoveryFlow";
import { QuestBubble } from "@/components/open-studio/QuestBubble";
import { useStudent } from "../../student-context";
import type { JourneyPhase } from "@/components/open-studio/JourneyMap";

interface OpenStudioStatus {
  unlocked: boolean;
  status: string;
  statusId?: string;
  teacherNote?: string;
  checkInIntervalMin: number;
  unlockedAt?: string;
  activeSession?: {
    id: string;
    session_number: number;
    focus_area: string;
    started_at: string;
    ai_interactions: number;
    check_in_count: number;
    drift_flags: Array<{ level: number; reason: string }>;
  } | null;
}

interface Unit {
  id: string;
  title: string;
  topic?: string;
}

const DARK_THEME = {
  bg: "#0f0a28",
  text: "#e2e8f0",
  textMuted: "#a1a1aa",
  purple: "#7c3aed",
  purpleLight: "#a78bfa",
  border: "rgba(124, 58, 237, 0.2)",
};

const PLACEHOLDER_CONTENT = {
  planning: {
    emoji: "🗺️",
    title: "Planning Phase Coming Soon",
    description: "Work backward from your project goal. Define milestones, break down steps, and create a realistic timeline.",
    icon: "📋",
  },
  working: {
    emoji: "⚡",
    title: "Working Phase Coming Soon",
    description: "Execute your plan. Document your progress, tackle challenges, and iterate on your solution.",
    icon: "🛠️",
  },
  sharing: {
    emoji: "🎤",
    title: "Sharing Phase Coming Soon",
    description: "Present your work. Reflect on what you learned. Celebrate your growth and share impact.",
    icon: "🌟",
  },
};

export default function OpenStudioPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = use(params);
  const router = useRouter();
  const { student } = useStudent();

  const [status, setStatus] = useState<OpenStudioStatus | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<JourneyPhase>("discovery");
  const [completedPhases, setCompletedPhases] = useState<JourneyPhase[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const [discoveryComplete, setDiscoveryComplete] = useState(false);

  const journeyMapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load Open Studio status and unit info
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Open Studio status
        const statusRes = await fetch(
          `/api/student/open-studio/status?unitId=${unitId}`
        );
        if (!statusRes.ok) {
          throw new Error("Failed to load Open Studio status");
        }
        const statusData: OpenStudioStatus = await statusRes.json();

        if (!statusData.unlocked) {
          // Not unlocked — redirect back to unit with message
          router.push(`/unit/${unitId}/narrative?locked=true`);
          return;
        }

        setStatus(statusData);

        // Try to get unit title — non-critical, just for display
        try {
          const unitsRes = await fetch("/api/student/units");
          if (unitsRes.ok) {
            const unitsData = await unitsRes.json();
            const foundUnit = unitsData.units?.find(
              (u: Unit) => u.id === unitId
            );
            if (foundUnit) {
              setUnit(foundUnit);
            }
          }
        } catch {
          // Non-critical — unit title just won't show
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [unitId, router]);

  // Handle scroll to compact mode
  useEffect(() => {
    if (!journeyMapRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCompact(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(journeyMapRef.current);
    return () => observer.disconnect();
  }, []);

  // Update phase based on discovery completion
  useEffect(() => {
    if (discoveryComplete) {
      setCurrentPhase("planning");
      setCompletedPhases(["discovery"]);
    }
  }, [discoveryComplete]);

  // Handle discovery completion
  const handleDiscoveryComplete = () => {
    setDiscoveryComplete(true);
  };

  // Handle discovery step change
  const handleStepChange = (step: string) => {
    // Track which steps have been touched for progress visualization
    if (step === "complete") {
      handleDiscoveryComplete();
    }
  };

  if (loading) {
    return (
      <div
        style={{
          background: DARK_THEME.bg,
          color: DARK_THEME.text,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "36px",
            }}
          >
            🚀
          </div>
          <p style={{ fontSize: "14px", color: DARK_THEME.textMuted }}>
            Loading your Open Studio...
          </p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: DARK_THEME.bg,
          color: DARK_THEME.text,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            maxWidth: "400px",
          }}
        >
          <div style={{ fontSize: "48px" }}>⚠️</div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0" }}>
              Something went wrong
            </p>
            <p
              style={{
                fontSize: "14px",
                color: DARK_THEME.textMuted,
                margin: 0,
              }}
            >
              {error}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: DARK_THEME.purple,
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                DARK_THEME.purpleLight;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                DARK_THEME.purple;
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div
        style={{
          background: DARK_THEME.bg,
          color: DARK_THEME.text,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <QuestBubble direction="right" avatar="🔐">
          Open Studio isn't unlocked yet. Ask your teacher to unlock it.
        </QuestBubble>
      </div>
    );
  }

  return (
    <div
      style={{
        background: DARK_THEME.bg,
        color: DARK_THEME.text,
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: isCompact ? "sticky" : "relative",
          top: 0,
          zIndex: 40,
          background: isCompact
            ? "rgba(15, 10, 40, 0.95)"
            : "transparent",
          backdropFilter: isCompact ? "blur(12px)" : "none",
          borderBottom: isCompact
            ? `1px solid ${DARK_THEME.border}`
            : "none",
          padding: "16px 24px",
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <Link
            href={`/unit/${unitId}/narrative`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: DARK_THEME.textMuted,
              textDecoration: "none",
              fontSize: "14px",
              transition: "color 0.2s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color =
                DARK_THEME.text;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color =
                DARK_THEME.textMuted;
            }}
          >
            ← Back to Project
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "24px",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Open Studio
              </h1>
              {unit && (
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13px",
                    color: DARK_THEME.textMuted,
                  }}
                >
                  {unit.title}
                </p>
              )}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {isCompact && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{
                fontSize: "12px",
                color: DARK_THEME.textMuted,
              }}
            >
              {currentPhase === "discovery" && "Discovering..."}
              {currentPhase === "planning" && "Planning..."}
              {currentPhase === "working" && "Working..."}
              {currentPhase === "sharing" && "Sharing..."}
            </motion.div>
          )}
        </div>
      </motion.header>

      {/* Journey Map — always visible, sticky */}
      <div
        ref={journeyMapRef}
        style={{
          position: "sticky",
          top: isCompact ? "0" : "0",
          zIndex: 30,
          background: "rgba(15, 10, 40, 0.98)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(124, 58, 237, 0.15)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: isCompact ? "12px 24px" : "20px 24px",
            transition: "padding 0.3s ease",
          }}
        >
          <JourneyMap
            currentPhase={currentPhase}
            completedPhases={completedPhases}
            compact={isCompact}
          />
        </motion.div>
      </div>

      {/* Phase Content */}
      <motion.div
        ref={contentRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 24px 40px",
        }}
      >
        <AnimatePresence mode="wait">
          {currentPhase === "discovery" && (
            <motion.div
              key="discovery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Discovery Engine — full-screen immersive experience */}
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🧭</div>
                <h2 className="text-xl font-bold text-white mb-3">
                  Discover Your Design Identity
                </h2>
                <p className="text-white/60 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  An interactive journey with Kit, your design mentor.
                  Takes about 45-60 minutes. Your progress is saved automatically.
                </p>
                <a
                  href={`/discovery/${unitId}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
                >
                  Start Discovery →
                </a>
              </div>
            </motion.div>
          )}

          {currentPhase === "planning" && (
            <motion.div
              key="planning"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PlaceholderPhase
                phase="planning"
                content={PLACEHOLDER_CONTENT.planning}
              />
            </motion.div>
          )}

          {currentPhase === "working" && (
            <motion.div
              key="working"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PlaceholderPhase
                phase="working"
                content={PLACEHOLDER_CONTENT.working}
              />
            </motion.div>
          )}

          {currentPhase === "sharing" && (
            <motion.div
              key="sharing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PlaceholderPhase
                phase="sharing"
                content={PLACEHOLDER_CONTENT.sharing}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/**
 * Placeholder component for phases not yet implemented
 */
function PlaceholderPhase({
  phase,
  content,
}: {
  phase: string;
  content: {
    emoji: string;
    title: string;
    description: string;
    icon: string;
  };
}) {
  return (
    <motion.div
      style={{
        background: "linear-gradient(135deg, rgba(15, 10, 40, 0.95), rgba(30, 20, 60, 0.95))",
        border: `1.5px solid ${DARK_THEME.border}`,
        borderRadius: "20px",
        padding: "40px 32px",
        textAlign: "center",
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        style={{
          fontSize: "64px",
          marginBottom: "16px",
        }}
      >
        {content.emoji}
      </motion.div>

      <h2
        style={{
          fontSize: "28px",
          fontWeight: 700,
          margin: "0 0 8px 0",
          color: DARK_THEME.text,
        }}
      >
        {content.title}
      </h2>

      <p
        style={{
          fontSize: "16px",
          color: DARK_THEME.textMuted,
          margin: "0 0 24px 0",
          maxWidth: "600px",
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: "1.6",
        }}
      >
        {content.description}
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 24px",
          background: `rgba(124, 58, 237, 0.1)`,
          border: `1px solid rgba(124, 58, 237, 0.3)`,
          borderRadius: "12px",
          color: DARK_THEME.purpleLight,
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        <span>{content.icon}</span>
        <span>Coming in Sprint 2</span>
      </motion.div>
    </motion.div>
  );
}
