"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────────
// AI-Assisted Text Field
// A textarea with a # button that triggers AI content suggestions.
// The # icon is the StudioLoom AI brand mark.
// ─────────────────────────────────────────────────────────────────

interface AIContext {
  field: string;
  lessonTitle: string;
  learningGoal: string;
  phase: string;
  /** Any extra context (e.g., existing content in other fields) */
  extra?: string;
}

interface AITextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  aiContext: AIContext;
  unitId: string;
  classId: string;
}

export default function AITextField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
  aiContext,
  unitId,
  classId,
}: AITextFieldProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setShowSuggestions(true);

    try {
      const res = await fetch("/api/teacher/lesson-editor/ai-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          classId,
          field: aiContext.field,
          phase: aiContext.phase,
          lessonTitle: aiContext.lessonTitle,
          learningGoal: aiContext.learningGoal,
          currentValue: value,
          extra: aiContext.extra,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI request failed: ${res.status}`);
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError("Couldn't get suggestions. Try again.");
      console.error("[AITextField]", err);
    } finally {
      setLoading(false);
    }
  }, [unitId, classId, aiContext, value]);

  const applySuggestion = (text: string) => {
    onChange(text);
    setShowSuggestions(false);
    setSuggestions([]);
    // Focus the textarea after applying
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const dismiss = () => {
    setShowSuggestions(false);
    setSuggestions([]);
    setError(null);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500">{label}</label>

        {/* AI assist button — purple # icon */}
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="group flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all shadow-sm hover:shadow-md hover:scale-110 active:scale-95"
          title={`AI suggestions for ${label}`}
        >
          {loading ? (
            <div className="animate-spin w-3 h-3 border-[1.5px] border-white border-t-transparent rounded-full" />
          ) : (
            <span className="text-[11px] font-black leading-none">#</span>
          )}
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        rows={rows}
      />

      {/* Suggestion dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[9px] font-black">
                  #
                </span>
                <span className="text-xs font-semibold text-indigo-700">
                  AI Suggestions
                </span>
              </div>
              <button
                onClick={dismiss}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="max-h-48 overflow-y-auto">
              {loading && (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-500">
                  <div className="animate-spin w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full" />
                  Thinking...
                </div>
              )}

              {error && (
                <div className="px-3 py-3 text-xs text-red-500">{error}</div>
              )}

              {suggestions.map((suggestion, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => applySuggestion(suggestion)}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors border-b border-gray-50 last:border-0 group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-indigo-400 group-hover:text-indigo-600 flex-shrink-0 mt-0.5 text-xs">
                      {i + 1}.
                    </span>
                    <span className="line-clamp-3">{suggestion}</span>
                  </div>
                </motion.button>
              ))}

              {!loading && suggestions.length === 0 && !error && (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">
                  No suggestions available
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
