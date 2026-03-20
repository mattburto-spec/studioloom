"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QuestBubble } from "./QuestBubble";

interface ConversationMessage {
  role: "ai" | "student";
  content: string;
  step: string;
  timestamp: string;
}

interface DiscoveryProfile {
  strengths: { area: string; description: string }[];
  interests: { topic: string; category: string }[];
  needs_identified: { need: string; context: string }[];
  project_statement: string | null;
  archetype: string | null;
  discovery_step: string;
  completed_at: string | null;
}

interface DiscoveryFlowProps {
  unitId: string;
  onComplete?: (profile: DiscoveryProfile) => void;
  onStepChange?: (step: string) => void;
}

const STEP_INFO: Record<string, { title: string; subtitle: string; icon: string }> = {
  strengths: { title: "Your Strengths", subtitle: "What are you naturally good at?", icon: "💪" },
  interests: { title: "Your Interests", subtitle: "What topics fascinate you?", icon: "🔥" },
  needs: { title: "Needs Around You", subtitle: "Who needs help? What's broken?", icon: "🌍" },
  narrowing: { title: "Narrowing Down", subtitle: "Which idea has the most potential?", icon: "🎯" },
  commitment: { title: "Your Commitment", subtitle: "Lock in your project.", icon: "🤝" },
  complete: { title: "Discovery Complete", subtitle: "You know what you're doing and why.", icon: "✅" },
};

const ARCHETYPE_LABELS: Record<string, { label: string; icon: string }> = {
  make: { label: "Maker", icon: "🔧" },
  research: { label: "Researcher", icon: "🔬" },
  lead: { label: "Leader", icon: "👥" },
  serve: { label: "Helper", icon: "🤲" },
  create: { label: "Creator", icon: "🎨" },
  solve: { label: "Problem Solver", icon: "💡" },
  entrepreneurship: { label: "Entrepreneur", icon: "🚀" },
};

const STEP_ORDER = ["strengths", "interests", "needs", "narrowing", "commitment"];

export function DiscoveryFlow({ unitId, onComplete, onStepChange }: DiscoveryFlowProps) {
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("strengths");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCompletedStep, setLastCompletedStep] = useState<string | null>(null);
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial profile and conversation
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        const response = await fetch(`/api/student/open-studio/discovery?unitId=${unitId}`);
        if (!response.ok) throw new Error("Failed to load discovery state");

        const data = await response.json();
        setProfile(data.profile);

        // If conversation is empty (pre-existing profile without greeting), add a client-side greeting
        const conv = data.conversation || [];
        if (conv.length === 0) {
          conv.push({
            role: "ai",
            content: "Welcome to Open Studio! 🚀 Let's explore what you're naturally drawn to. What are you good at? Think about what friends ask you for help with, or what comes easily to you.",
            step: "strengths",
            timestamp: new Date().toISOString(),
          });
        }
        setConversation(conv);
        setCurrentStep(data.profile.discovery_step || "strengths");

        if (onStepChange) {
          onStepChange(data.profile.discovery_step || "strengths");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsInitializing(false);
      }
    };

    loadInitialState();
  }, [unitId, onStepChange]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Handle message submission
  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;

      const userMessage = inputValue.trim();
      setInputValue("");

      // Add student message to conversation
      const studentMsg: ConversationMessage = {
        role: "student",
        content: userMessage,
        step: currentStep,
        timestamp: new Date().toISOString(),
      };
      setConversation((prev) => [...prev, studentMsg]);

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/student/open-studio/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, message: userMessage }),
        });

        if (!response.ok) throw new Error("Failed to get AI response");

        const data = await response.json();

        // Add AI message to conversation
        const aiMsg: ConversationMessage = {
          role: "ai",
          content: data.response,
          step: data.step,
          timestamp: new Date().toISOString(),
        };
        setConversation((prev) => [...prev, aiMsg]);

        // Update profile and step
        setProfile(data.profile);
        setCurrentStep(data.step);

        // Track step completion
        if (data.isStepComplete && data.step !== lastCompletedStep) {
          setLastCompletedStep(data.step);
        }

        // Handle discovery completion
        if (data.isDiscoveryComplete && onComplete) {
          setTimeout(() => onComplete(data.profile), 500);
        }

        if (onStepChange) {
          onStepChange(data.step);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        // Remove the student message on error
        setConversation((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, currentStep, unitId, lastCompletedStep, onComplete, onStepChange]
  );

  if (isInitializing) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "600px",
          backgroundColor: "#0f0f1e",
          borderRadius: "12px",
        }}
      >
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
          <div style={{ fontSize: "24px", color: "#7c3aed" }}>Loading your discovery journey...</div>
        </motion.div>
      </div>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const stepInfo = STEP_INFO[currentStep] || STEP_INFO.strengths;
  const isDiscoveryComplete = profile?.completed_at !== null;
  const archetypeInfo = profile?.archetype ? ARCHETYPE_LABELS[profile.archetype] : null;

  return (
    <div
      style={{
        display: "flex",
        gap: "24px",
        height: "800px",
        backgroundColor: "#0f0f1e",
        borderRadius: "16px",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Main chat area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a14",
          borderRight: "1px solid #1e1e3f",
        }}
      >
        {/* Step indicator */}
        <motion.div
          style={{
            padding: "20px",
            borderBottom: "1px solid #1e1e3f",
            backgroundColor: "#0f0f1e",
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "20px", fontWeight: "600", color: "#ffffff", marginBottom: "4px" }}>
              {stepInfo.icon} {stepInfo.title}
            </div>
            <div style={{ fontSize: "14px", color: "#a0a0b0" }}>{stepInfo.subtitle}</div>
          </div>

          {/* Progress dots */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {STEP_ORDER.map((step, idx) => {
              const isActive = idx <= stepIndex;
              const isCurrentStep = step === currentStep;
              return (
                <motion.div
                  key={step}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: isActive ? "#7c3aed" : "#2a2a3e",
                    transition: "background-color 0.3s",
                  }}
                  animate={{ scale: isCurrentStep ? 1.5 : 1 }}
                />
              );
            })}
          </div>
        </motion.div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <AnimatePresence mode="popLayout">
            {conversation.map((msg, idx) => (
              <motion.div
                key={`${msg.timestamp}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "ai" ? "flex-start" : "flex-end",
                }}
              >
                <QuestBubble
                  direction={msg.role === "ai" ? "right" : "left"}
                  avatar={msg.role === "ai" ? "🎯" : "👤"}
                >
                  <div>
                    <div>{msg.content}</div>
                    <div style={{ fontSize: "11px", color: "#71717a", marginTop: "6px" }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </QuestBubble>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ display: "flex" }}
              >
                <QuestBubble direction="right" avatar="🎯">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ color: "#a78bfa" }}
                  >
                    Thinking...
                  </motion.div>
                </QuestBubble>
              </motion.div>
            )}

            {lastCompletedStep && lastCompletedStep === currentStep && !isLoading && (
              <motion.div
                key={`complete-${lastCompletedStep}`}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "8px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#7c3aed",
                    color: "#ffffff",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  ✓ Step complete
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "12px 24px",
              backgroundColor: "#3e1f1f",
              borderTop: "1px solid #5a2a2a",
              color: "#ff6b6b",
              fontSize: "13px",
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Input area */}
        {!isDiscoveryComplete && (
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: "20px",
              borderTop: "1px solid #1e1e3f",
              backgroundColor: "#0f0f1e",
              display: "flex",
              gap: "12px",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Share your thoughts..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "12px 16px",
                backgroundColor: "#1a1a2e",
                border: "1px solid #2a2a3e",
                borderRadius: "8px",
                color: "#ffffff",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#7c3aed";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#2a2a3e";
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              style={{
                padding: "12px 24px",
                backgroundColor: isLoading || !inputValue.trim() ? "#3a3a4e" : "#7c3aed",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                cursor: isLoading || !inputValue.trim() ? "not-allowed" : "pointer",
                fontSize: "14px",
                transition: "background-color 0.2s",
              }}
            >
              Send
            </button>
          </form>
        )}

        {/* Discovery complete message */}
        {isDiscoveryComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "20px",
              borderTop: "1px solid #1e1e3f",
              backgroundColor: "#0f0f1e",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "14px", color: "#a0a0b0", marginBottom: "12px" }}>
              ✅ Discovery is complete! You're ready to begin planning.
            </div>
            <button
              onClick={() => {
                if (onComplete && profile) {
                  onComplete(profile);
                }
              }}
              style={{
                padding: "12px 24px",
                backgroundColor: "#7c3aed",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Begin Planning →
            </button>
          </motion.div>
        )}
      </div>

      {/* Side profile panel */}
      {profile && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            width: "320px",
            backgroundColor: "#0f0f1e",
            borderLeft: "1px solid #1e1e3f",
            padding: "24px",
            overflowY: "auto",
            display: showProfilePanel ? "flex" : "none",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Project statement */}
          {profile.project_statement && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#7c3aed", textTransform: "uppercase", marginBottom: "8px" }}>
                Your Project
              </div>
              <div style={{ fontSize: "14px", color: "#e0e0e8", lineHeight: "1.5" }}>
                {profile.project_statement}
              </div>
            </motion.div>
          )}

          {/* Archetype badge */}
          {archetypeInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#7c3aed", textTransform: "uppercase", marginBottom: "8px" }}>
                You Are A
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "#7c3aed20",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #7c3aed40",
                }}
              >
                <span style={{ fontSize: "18px" }}>{archetypeInfo.icon}</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#c4b5fd" }}>
                  {archetypeInfo.label}
                </span>
              </div>
            </motion.div>
          )}

          {/* Strengths section */}
          {profile.strengths.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#7c3aed", textTransform: "uppercase", marginBottom: "12px" }}>
                💪 Strengths ({profile.strengths.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {profile.strengths.map((s, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    style={{
                      padding: "10px",
                      backgroundColor: "#1a1a2e",
                      borderLeft: "3px solid #7c3aed",
                      borderRadius: "4px",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#e0e0e8" }}>
                      {s.area}
                    </div>
                    <div style={{ fontSize: "12px", color: "#a0a0b0", marginTop: "4px" }}>
                      {s.description}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Interests section */}
          {profile.interests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#7c3aed", textTransform: "uppercase", marginBottom: "12px" }}>
                🔥 Interests ({profile.interests.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {profile.interests.map((i, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    style={{
                      padding: "10px",
                      backgroundColor: "#1a1a2e",
                      borderLeft: "3px solid #f59e0b",
                      borderRadius: "4px",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#e0e0e8" }}>
                      {i.topic}
                    </div>
                    <div style={{ fontSize: "12px", color: "#a0a0b0" }}>{i.category}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Needs section */}
          {profile.needs_identified.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#7c3aed", textTransform: "uppercase", marginBottom: "12px" }}>
                🌍 Needs ({profile.needs_identified.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {profile.needs_identified.map((n, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    style={{
                      padding: "10px",
                      backgroundColor: "#1a1a2e",
                      borderLeft: "3px solid #10b981",
                      borderRadius: "4px",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#e0e0e8" }}>
                      {n.need}
                    </div>
                    <div style={{ fontSize: "12px", color: "#a0a0b0", marginTop: "4px" }}>
                      {n.context}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Empty state */}
          {profile.strengths.length === 0 &&
            profile.interests.length === 0 &&
            profile.needs_identified.length === 0 && (
              <div style={{ textAlign: "center", color: "#a0a0b0", fontSize: "13px" }}>
                💭 Start sharing to build your profile
              </div>
            )}
        </motion.div>
      )}
    </div>
  );
}
