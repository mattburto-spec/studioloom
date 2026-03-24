"use client";

import { useState, useRef, useEffect } from "react";

interface InlineEditProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  as?: "h1" | "h2" | "p" | "span";
}

/**
 * InlineEdit — Click-to-edit component for inline content editing
 *
 * Renders as the specified element in display mode.
 * On click, switches to an input/textarea with autoFocus.
 * Blur or Enter (single-line) commits the edit and calls onChange.
 * Escape cancels and reverts to the original value.
 *
 * Style: hover shows subtle bg-gray-50, no visual mode switch.
 */
export default function InlineEdit({
  value,
  onChange,
  placeholder = "",
  multiline = false,
  className = "",
  as = "span",
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync draft to value when value changes externally
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Focus input/textarea when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditing(true);
    setDraft(value);
  };

  const commitEdit = () => {
    setEditing(false);
    if (draft !== value) {
      onChange(draft);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
    // For single-line: Enter commits
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    }
  };

  if (!editing) {
    // Display mode
    const displayContent = value || (
      <span className="text-gray-400">{placeholder}</span>
    );

    const displayClass = `cursor-text hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors ${className}`;

    switch (as) {
      case "h1":
        return (
          <h1 className={displayClass} onClick={startEdit}>
            {displayContent}
          </h1>
        );
      case "h2":
        return (
          <h2 className={displayClass} onClick={startEdit}>
            {displayContent}
          </h2>
        );
      case "p":
        return (
          <p className={displayClass} onClick={startEdit}>
            {displayContent}
          </p>
        );
      case "span":
      default:
        return (
          <span className={displayClass} onClick={startEdit}>
            {displayContent}
          </span>
        );
    }
  }

  // Edit mode
  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.Ref<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        className={`w-full border border-indigo-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none ${className}`}
        placeholder={placeholder}
        rows={4}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.Ref<HTMLInputElement>}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={handleKeyDown}
      className={`w-full border border-indigo-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${className}`}
      placeholder={placeholder}
    />
  );
}
