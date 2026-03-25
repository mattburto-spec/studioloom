"use client";

import React from "react";
import { motion } from "framer-motion";
import MentorAvatar from "./MentorAvatar";
import type { MentorId } from "@/lib/quest/types";

interface MentorCardProps {
  mentor: {
    id: MentorId;
    name: string;
    tagline: string;
    archetype: string;
    description: string;
    primaryColor: string;
    accentColor: string;
  };
  isSelected: boolean;
  onSelect: (id: string) => void;
  index: number;
}

export const MentorCard: React.FC<MentorCardProps> = ({
  mentor,
  isSelected,
  onSelect,
  index,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.1,
        type: "spring",
        stiffness: 100,
        damping: 12,
      }}
      whileHover={{
        scale: 1.02,
      }}
      onClick={() => onSelect(mentor.id)}
      style={{
        cursor: "pointer",
        position: "relative",
      }}
    >
      <div
        style={{
          backgroundColor: "#1a1035",
          borderLeft: `4px solid ${mentor.primaryColor}`,
          borderRadius: "8px",
          padding: "20px",
          minHeight: "280px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          transition: "all 0.3s ease",
          boxShadow: isSelected
            ? `0 0 20px ${mentor.primaryColor}40, 0 8px 16px rgba(0, 0, 0, 0.3)`
            : "0 4px 12px rgba(0, 0, 0, 0.2)",
          border: isSelected ? `2px solid ${mentor.primaryColor}` : "2px solid transparent",
          outline: isSelected ? `2px solid ${mentor.primaryColor}` : "none",
          outlineOffset: isSelected ? "2px" : "0px",
        }}
      >
        {/* Selected Badge */}
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 10 }}
            style={{
              position: "absolute",
              top: "-12px",
              right: "12px",
              backgroundColor: mentor.primaryColor,
              color: "#1a1a1a",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "14px",
              boxShadow: `0 4px 12px ${mentor.primaryColor}60`,
            }}
          >
            ✓
          </motion.div>
        )}

        {/* Avatar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "8px",
          }}
        >
          <MentorAvatar mentorId={mentor.id} size={64} />
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "#ffffff",
            textAlign: "center",
            lineHeight: "1.2",
          }}
        >
          {mentor.name}
        </div>

        {/* Archetype */}
        <div
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: mentor.primaryColor,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {mentor.archetype}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "13px",
            color: "#9CA3AF",
            textAlign: "center",
            fontStyle: "italic",
            lineHeight: "1.4",
          }}
        >
          "{mentor.tagline}"
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "14px",
            color: "#D1D5DB",
            textAlign: "center",
            lineHeight: "1.5",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mentor.description}
        </div>

        {/* Selected state indicator text */}
        {isSelected && (
          <div
            style={{
              fontSize: "12px",
              color: mentor.primaryColor,
              textAlign: "center",
              fontWeight: "600",
              marginTop: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Selected
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MentorCard;
