"use client";

import { motion } from "framer-motion";

interface QuestBubbleProps {
  children: React.ReactNode;
  direction?: "left" | "right"; // left = student, right = AI
  color?: string; // bubble background color
  avatar?: React.ReactNode; // avatar element
  animate?: boolean; // whether to animate entrance
  compact?: boolean; // smaller version for inline use
}

export function QuestBubble({
  children,
  direction = "right",
  color,
  avatar,
  animate = true,
  compact = false,
}: QuestBubbleProps) {
  const isAI = direction === "right";
  const bgColor = color || (isAI ? "#1e1b4b" : "#2d2066"); // dark indigo for AI, deep purple for student
  const borderColor = isAI ? "#7c3aed" : "#a78bfa";

  const bubbleContent = (
    <div
      style={{
        display: "flex",
        flexDirection: isAI ? "row" : "row-reverse",
        alignItems: "flex-end",
        gap: compact ? "8px" : "12px",
        maxWidth: "100%",
      }}
    >
      {avatar && (
        <div
          style={{
            flexShrink: 0,
            width: compact ? "28px" : "36px",
            height: compact ? "28px" : "36px",
            borderRadius: "50%",
            background: isAI
              ? "linear-gradient(135deg, #7c3aed, #a78bfa)"
              : "linear-gradient(135deg, #06b6d4, #22d3ee)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: compact ? "14px" : "18px",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {avatar}
        </div>
      )}
      <div
        style={{
          position: "relative",
          background: bgColor,
          border: `1.5px solid ${borderColor}`,
          borderRadius: isAI ? "16px 16px 16px 4px" : "16px 16px 4px 16px",
          padding: compact ? "8px 12px" : "12px 16px",
          color: "#e2e8f0",
          fontSize: compact ? "13px" : "14px",
          lineHeight: "1.5",
          maxWidth: "85%",
          wordBreak: "break-word",
        }}
      >
        {children}
      </div>
    </div>
  );

  if (!animate)
    return (
      <div style={{ marginBottom: compact ? "8px" : "12px" }}>{bubbleContent}</div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{ marginBottom: compact ? "8px" : "12px" }}
    >
      {bubbleContent}
    </motion.div>
  );
}
