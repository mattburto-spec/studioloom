"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getToolMetadata } from "@/lib/tools/toolkit-metadata";
import { checkClientSide, MODERATION_MESSAGES, detectLanguage } from "@/lib/content-safety/client-filter";
import { TappableText } from "@/components/student/tap-a-word";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Message {
  id: string;
  role: "student" | "assistant";
  content: string;
  questionType?: string;
  bloomLevel?: number;
  createdAt: string;
}

interface DesignAssistantWidgetProps {
  unitId: string;
  pageId: string;
  studentId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DesignAssistantWidget({
  unitId,
  pageId,
  studentId,
}: DesignAssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [bloomLevel, setBloomLevel] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Load existing conversation when opened
  const loadConversation = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await fetch(
        `/api/student/design-assistant?unitId=${unitId}&pageId=${pageId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.conversation) {
        setConversationId(data.conversation.id);
        setBloomLevel(data.conversation.bloomLevel || 1);
        if (data.turns?.length) {
          setMessages(
            data.turns.map((t: { id: string; role: string; content: string; questionType?: string; bloomLevel?: number; createdAt: string }) => ({
              id: t.id,
              role: t.role as "student" | "assistant",
              content: t.content,
              questionType: t.questionType,
              bloomLevel: t.bloomLevel,
              createdAt: t.createdAt,
            }))
          );
        }
      }
    } catch {
      // Non-critical
    }
    setLoaded(true);
  }, [unitId, pageId, loaded]);

  useEffect(() => {
    if (open) loadConversation();
  }, [open, loadConversation]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    // Content safety check — block before sending to AI
    const moderationCheck = checkClientSide(text);
    if (!moderationCheck.ok) {
      const lang = detectLanguage(text);
      setError(MODERATION_MESSAGES[lang === "zh" ? "zh" : "en"]);
      fetch("/api/safety/log-client-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "student_progress",
          flags: moderationCheck.flags,
          snippet: text.slice(0, 200),
        }),
      }).catch(() => {});
      return;
    }

    setError("");
    setSending(true);

    // Add student message immediately
    const studentMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "student",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, studentMsg]);
    setInput("");

    try {
      const res = await fetch("/api/student/design-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          unitId,
          pageId,
          message: text,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to get response");
        setSending(false);
        return;
      }

      const data = await res.json();
      setConversationId(data.conversationId);
      setBloomLevel(data.bloomLevel || bloomLevel);

      const assistantMsg: Message = {
        id: `resp-${Date.now()}`,
        role: "assistant",
        content: data.response,
        questionType: data.questionType,
        bloomLevel: data.bloomLevel,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Connection error. Please try again.");
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Bloom's level labels
  const bloomLabels = ["Remember", "Understand", "Apply", "Analyse", "Evaluate", "Create"];

  // Parse markdown-style tool links in assistant messages
  // Pattern: [Tool Name](/toolkit/slug)
  function parseToolLinks(text: string): (string | { type: 'toolLink'; name: string; slug: string })[] {
    const pattern = /\[([^\]]+)\]\(\/toolkit\/([a-z-]+)\)/g;
    const parts: (string | { type: 'toolLink'; name: string; slug: string })[] = [];
    let lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push({
        type: 'toolLink',
        name: match[1],
        slug: match[2],
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length === 0 ? [text] : parts;
  }

  // ── Collapsed state: just the FAB ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30 hover:scale-110 hover:shadow-xl active:scale-95 transition-all duration-150 flex items-center justify-center group"
        style={{ bottom: "5.5rem" }}
        title="Design Mentor"
      >
        {/* Lightbulb icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
        {/* Tooltip */}
        <span className="absolute left-14 px-2.5 py-1 rounded-lg bg-gray-900/80 text-white text-xs font-medium shadow-lg opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
          Design Mentor
        </span>
      </button>
    );
  }

  // ── Expanded state: chat panel ──
  return (
    <div
      className="fixed left-4 z-50 w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-pop-in"
      style={{ bottom: "2rem", maxHeight: "min(500px, calc(100vh - 6rem))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
          </svg>
          <span className="font-semibold text-sm">Design Mentor</span>
          {bloomLevel > 0 && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
              {bloomLabels[Math.min(bloomLevel - 1, 5)]}
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-2">
              Need help thinking through your design?
            </p>
            <p className="text-xs text-gray-400">
              I won&apos;t give you answers — but I&apos;ll ask questions to help you think deeper.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === "student"
                  ? "bg-blue-500 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="space-y-2">
                  {(() => {
                    // Split message into paragraphs for better readability
                    const paragraphs = msg.content.split('\n\n');
                    return paragraphs.map((para, idx) => {
                      const parts = parseToolLinks(para);
                      return (
                        <p key={idx}>
                          {parts.map((part, i) => {
                            if (typeof part === 'string') {
                              return <TappableText key={i} text={part} />;
                            }
                            // Render tool link as a styled chip/button with metadata color
                            const toolMeta = getToolMetadata(part.slug);
                            return (
                              <a
                                key={i}
                                href={`/toolkit/${part.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 hover:shadow-md"
                                style={{
                                  backgroundColor: toolMeta ? `${toolMeta.color}20` : '#d8b4fe',
                                  color: toolMeta?.color || '#a855f7',
                                  border: `1px solid ${toolMeta ? `${toolMeta.color}40` : '#d8b4fe'}`,
                                }}
                                title={`Try using ${part.name} for this`}
                              >
                                <span>{part.name}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </a>
                            );
                          })}
                        </p>
                      );
                    });
                  })()}
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-md text-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-100 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for help thinking..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 placeholder:text-gray-400"
            style={{ maxHeight: "80px" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-amber-500 transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
