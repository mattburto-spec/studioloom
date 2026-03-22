"use client";

import { useState, useMemo } from "react";
import type { KeyConceptBlock } from "@/lib/safety/content-blocks";

// ============================================================================
// Inline SVG Icons
// ============================================================================

function LightbulbIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11 10.07 7.5 12 7.5s3.5 1.57 3.5 3.5z" fill="currentColor" />
    </svg>
  );
}

function WarningTriangleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor" />
    </svg>
  );
}

function CheckmarkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
    </svg>
  );
}

// ============================================================================
// Markdown-like Formatting Parser
// ============================================================================

function parseMarkdown(text: string) {
  // Split by paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  return paragraphs.map((para, idx) => {
    // Check for bullet list
    if (para.match(/^[\s]*[-*]\s/m)) {
      const items = para.split(/\n/).filter(line => line.trim());
      return (
        <ul
          key={idx}
          style={{
            margin: "12px 0",
            paddingLeft: "20px",
            fontSize: "14px",
            color: "#1f2937",
            lineHeight: 1.6,
          }}
        >
          {items.map((item, i) => (
            <li key={i} style={{ marginBottom: "6px" }}>
              {formatInlineMarkdown(item.replace(/^[\s]*[-*]\s/, ""))}
            </li>
          ))}
        </ul>
      );
    }

    // Regular paragraph
    return (
      <p
        key={idx}
        style={{
          margin: "12px 0",
          fontSize: "14px",
          color: "#1f2937",
          lineHeight: 1.6,
        }}
      >
        {formatInlineMarkdown(para)}
      </p>
    );
  });
}

function formatInlineMarkdown(text: string) {
  // Split by ** for bold
  const parts = text.split(/(\*\*.*?\*\*)/);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} style={{ fontWeight: 700, color: "#111827" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

// ============================================================================
// Progressive Reveal Section
// ============================================================================

interface RevealSection {
  id: string;
  label: string;
  icon: "content" | "tips" | "examples" | "warning";
  revealed: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

interface KeyConceptBlockProps {
  block: KeyConceptBlock;
  onComplete?: () => void;
}

export default function KeyConceptBlockComponent({ block, onComplete }: KeyConceptBlockProps) {
  const [sections, setSections] = useState<RevealSection[]>([
    { id: "content", label: "Key Concept", icon: "content", revealed: true },
    ...(block.tips ? [{ id: "tips", label: "Tips", icon: "tips", revealed: false }] : []),
    ...(block.examples ? [{ id: "examples", label: "Examples", icon: "examples", revealed: false }] : []),
    ...(block.warning ? [{ id: "warning", label: "Important", icon: "warning", revealed: false }] : []),
  ]);

  // Check if all sections revealed
  const allRevealed = useMemo(() => sections.every(s => s.revealed), [sections]);

  const toggleSection = (id: string) => {
    setSections(prev => {
      const updated = prev.map(s => (s.id === id ? { ...s, revealed: !s.revealed } : s));
      // Check if all revealed now
      if (updated.every(s => s.revealed) && !allRevealed) {
        onComplete?.();
      }
      return updated;
    });
  };

  return (
    <style>{`
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `}
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        border: "2px solid #e5e7eb",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header with Icon */}
      <div
        style={{
          padding: "24px 20px 16px",
          background: "linear-gradient(135deg, #f0f4f8 0%, #f9fafb 100%)",
          borderBottom: "2px solid #e5e7eb",
          display: "flex",
          alignItems: "flex-start",
          gap: "16px",
        }}
      >
        <div
          style={{
            fontSize: "40px",
            lineHeight: 1,
            minWidth: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {block.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: "20px",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {block.title}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            {sections.length} parts to explore — read and scroll to complete
          </p>
        </div>
      </div>

      {/* Content Sections */}
      <div style={{ padding: "20px" }}>
        {sections.map((section) => (
          <div key={section.id} style={{ marginBottom: section === sections[sections.length - 1] ? 0 : "16px" }}>
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              style={{
                width: "100%",
                background: section.revealed
                  ? "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)"
                  : "#ffffff",
                border: `2px solid ${section.revealed ? "#d1d5db" : "#e5e7eb"}`,
                borderRadius: "8px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontWeight: section.revealed ? 600 : 500,
                color: section.revealed ? "#1f2937" : "#6b7280",
                fontSize: "14px",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = section.revealed
                  ? "linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)"
                  : "#f9fafb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = section.revealed
                  ? "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)"
                  : "#ffffff";
              }}
            >
              {/* Icon indicator */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "20px",
                  height: "20px",
                  color: section.revealed ? "#059669" : "#9ca3af",
                }}
              >
                {section.revealed ? <CheckmarkIcon size={16} /> : <span style={{ fontSize: "12px" }}>{"+"}</span>}
              </div>

              {/* Label */}
              <span style={{ flex: 1 }}>{section.label}</span>

              {/* Expand chevron */}
              <span
                style={{
                  transform: section.revealed ? "rotate(0deg)" : "rotate(-90deg)",
                  display: "inline-block",
                  transition: "transform 0.2s ease",
                }}
              >
                ▼
              </span>
            </button>

            {/* Section Content */}
            {section.revealed && (
              <div
                style={{
                  marginTop: "12px",
                  paddingLeft: "32px",
                  animation: "slideUp 0.3s ease-out",
                }}
              >
                {section.id === "content" && (
                  <div>
                    {block.image && (
                      <div
                        style={{
                          marginBottom: "16px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "#f3f4f6",
                        }}
                      >
                        <img
                          src={block.image}
                          alt={block.title}
                          style={{
                            width: "100%",
                            height: "auto",
                            display: "block",
                          }}
                        />
                      </div>
                    )}
                    {parseMarkdown(block.content)}
                  </div>
                )}

                {section.id === "tips" && block.tips && (
                  <div>
                    {block.tips.map((tip, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#f0fdf4",
                          border: "2px solid #bbf7d0",
                          borderRadius: "8px",
                          padding: "12px 14px",
                          marginBottom: idx < block.tips!.length - 1 ? "10px" : 0,
                          display: "flex",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            color: "#15803d",
                            minWidth: "20px",
                            marginTop: "2px",
                          }}
                        >
                          <span style={{ fontSize: "12px", fontWeight: 700 }}>{idx + 1}</span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "#166534",
                            lineHeight: 1.5,
                          }}
                        >
                          {tip}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {section.id === "examples" && block.examples && (
                  <div>
                    {block.examples.map((example, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#eff6ff",
                          borderLeft: "4px solid #3b82f6",
                          padding: "12px 14px",
                          marginBottom: idx < block.examples!.length - 1 ? "10px" : 0,
                          borderRadius: "4px",
                          fontSize: "14px",
                          color: "#1e40af",
                          lineHeight: 1.6,
                          fontStyle: "italic",
                        }}
                      >
                        "{example}"
                      </div>
                    ))}
                  </div>
                )}

                {section.id === "warning" && block.warning && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "2px solid #fca5a5",
                      borderRadius: "8px",
                      padding: "14px",
                      display: "flex",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        color: "#dc2626",
                        marginTop: "2px",
                        minWidth: "20px",
                      }}
                    >
                      <WarningTriangleIcon size={18} />
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "#7f1d1d",
                        lineHeight: 1.6,
                        fontWeight: 500,
                      }}
                    >
                      {block.warning}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Completion Indicator */}
      {allRevealed && (
        <div
          style={{
            padding: "12px 20px",
            background: "#f0fdf4",
            borderTop: "2px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            color: "#166534",
            animation: "slideUp 0.3s ease-out",
          }}
        >
          <div style={{ color: "#22c55e" }}>
            <CheckmarkIcon size={16} />
          </div>
          <span style={{ fontWeight: 600 }}>All content explored</span>
        </div>
      )}
    </div>
  );
}
