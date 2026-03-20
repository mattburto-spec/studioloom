"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QuestBubble } from "./QuestBubble";
import { ComicPanel, StepTransition, ProfileReveal, STEP_SCENES } from "./ComicPanel";

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

  // Build profile items for inline reveals
  const profileStrengths = (profile?.strengths || []).map(s => ({ title: s.area, detail: s.description }));
  const profileInterests = (profile?.interests || []).map(i => ({ title: i.topic, detail: i.category }));
  const profileNeeds = (profile?.needs_identified || []).map(n => ({ title: n.need, detail: n.context }));

  // Track which steps have profile data to show inline reveals
  const lastMentorMsgPerStep: Record<string, number> = {};
  conversation.forEach((msg, idx) => {
    if (msg.role === "ai") lastMentorMsgPerStep[msg.step] = idx;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "800px",
        backgroundColor: "#0a0a14",
        borderRadius: "16px",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Step progress bar — compact, always visible */}
      <motion.div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #1e1e3f",
          backgroundColor: "#0f0f1e",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "15px", fontWeight: "600", color: "#ffffff" }}>
            {stepInfo.icon} {stepInfo.title}
          </div>
          <div style={{ fontSize: "12px", color: "#a0a0b0" }}>{stepInfo.subtitle}</div>
        </div>

        {/* Progress steps as mini comic panels */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {STEP_ORDER.map((step, idx) => {
            const isActive = idx <= stepIndex;
            const isCurrentStep = step === currentStep;
            const si = STEP_INFO[step];
            const sc = STEP_SCENES[step] || STEP_SCENES.strengths;
            return (
              <motion.div
                key={step}
                animate={{ scale: isCurrentStep ? 1.1 : 1 }}
                style={{
                  width: isCurrentStep ? "auto" : "28px",
                  height: "28px",
                  borderRadius: "6px",
                  border: `2px solid ${isActive ? sc.accent : "#2a2a3e"}`,
                  background: isActive ? `${sc.accent}22` : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: isCurrentStep ? "0 10px" : "0",
                  gap: "4px",
                  transition: "all 0.3s",
                }}
              >
                <span style={{ fontSize: "12px" }}>{si?.icon}</span>
                {isCurrentStep && (
                  <span style={{ fontSize: "10px", fontWeight: 700, color: sc.accent, whiteSpace: "nowrap" }}>
                    {si?.title}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

        {/* Comic strip — the main visual experience */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <AnimatePresence mode="popLayout">
            {conversation.map((msg, idx) => {
              const prevMsg = idx > 0 ? conversation[idx - 1] : null;
              const isNewStep = prevMsg && prevMsg.step !== msg.step && msg.role === "ai";
              const msgStepInfo = STEP_INFO[msg.step] || STEP_INFO.strengths;

              // Show profile reveals after the last mentor message of a completed step
              const showStrengthReveal = msg.step === "interests" && isNewStep && profileStrengths.length > 0;
              const showInterestReveal = msg.step === "needs" && isNewStep && profileInterests.length > 0;
              const showNeedReveal = msg.step === "narrowing" && isNewStep && profileNeeds.length > 0;

              return (
                <div key={`${msg.timestamp}-${idx}`}>
                  {/* Profile reveal — what was discovered in the previous step */}
                  {showStrengthReveal && (
                    <ProfileReveal label="Strengths Discovered" icon="💪" items={profileStrengths} accentColor="#a78bfa" />
                  )}
                  {showInterestReveal && (
                    <ProfileReveal label="Interests Found" icon="🔥" items={profileInterests} accentColor="#60a5fa" />
                  )}
                  {showNeedReveal && (
                    <ProfileReveal label="Needs Identified" icon="🌍" items={profileNeeds} accentColor="#34d399" />
                  )}

                  {/* Cinematic step transition */}
                  {isNewStep && (
                    <StepTransition
                      step={msg.step}
                      stepLabel={msgStepInfo.title}
                      stepIcon={msgStepInfo.icon}
                      stepSubtitle={msgStepInfo.subtitle}
                    />
                  )}

                  {/* Comic panel */}
                  <ComicPanel
                    speaker={msg.role === "ai" ? "mentor" : "student"}
                    step={msg.step}
                    index={idx}
                    isStepStart={idx === 0 && msg.role === "ai"}
                    stepLabel={idx === 0 ? msgStepInfo.title : undefined}
                    stepIcon={idx === 0 ? msgStepInfo.icon : undefined}
                  >
                    <div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                    </div>
                  </ComicPanel>
                </div>
              );
            })}

            {/* Loading panel */}
            {isLoading && (
              <ComicPanel
                key="loading"
                speaker="mentor"
                step={currentStep}
                index={conversation.length}
              >
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ color: "#7c3aed", display: "flex", gap: "2px" }}
                >
                  <span>Thinking</span>
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}>.</motion.span>
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}>.</motion.span>
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}>.</motion.span>
                </motion.div>
              </ComicPanel>
            )}

            {/* Step complete badge */}
            {lastCompletedStep && lastCompletedStep === currentStep && !isLoading && (
              <motion.div
                key={`complete-${lastCompletedStep}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}
              >
                <div
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                    color: "#fff",
                    padding: "8px 20px",
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: 700,
                    border: "2px solid #c084fc",
                    boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
                  }}
                >
                  ✓ Step complete — onward!
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

      {/* Project statement bar — shows when discovered, replaces side panel */}
      {profile?.project_statement && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #1e1e3f",
            background: "linear-gradient(135deg, #7c3aed11, #7c3aed08)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {archetypeInfo && (
            <span style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#c4b5fd",
              background: "#7c3aed22",
              padding: "4px 10px",
              borderRadius: "12px",
              border: "1px solid #7c3aed33",
              whiteSpace: "nowrap",
            }}>
              {archetypeInfo.icon} {archetypeInfo.label}
            </span>
          )}
          <span style={{ fontSize: "13px", color: "#c4b5fd", fontWeight: 500 }}>
            {profile.project_statement}
          </span>
        </motion.div>
      )}
    </div>
  );
}
