"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// ClassShareChips — click-to-copy class code + student join URL (DT canvas
// Phase 3.6 Step 2, 16 May 2026). Sits below the canvas header subtitle so a
// busy teacher mid-lesson can grab the share-with-students bits in one
// click without opening any drawer.
//
// Student join URL: <origin>/login/<classCode> — pre-fills the code on the
// existing /(auth)/login/[classcode] surface (see class-code-helpers.ts).
// ---------------------------------------------------------------------------

interface ClassShareChipsProps {
  classCode: string;
}

export default function ClassShareChips({ classCode }: ClassShareChipsProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    // Origin is window-only — set on mount to avoid SSR hydration mismatch.
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const joinUrl = origin ? `${origin}/login/${classCode}` : `/login/${classCode}`;
  const joinUrlDisplay = origin
    ? `${origin.replace(/^https?:\/\//, "")}/login/${classCode}`
    : `/login/${classCode}`;

  async function copy(kind: "code" | "link", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1800);
    } catch (e) {
      console.error("[ClassShareChips] copy failed:", e);
    }
  }

  if (!classCode) return null;

  return (
    <div
      data-testid="class-share-chips"
      className="mt-1.5 flex flex-wrap items-center gap-2"
    >
      <button
        type="button"
        data-testid="class-share-chip-code"
        onClick={() => copy("code", classCode)}
        title="Copy class code"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-[11px] font-medium transition"
      >
        <span className="font-mono font-semibold">{classCode}</span>
        <span aria-hidden className="text-purple-400 group-hover:text-purple-600">
          {copied === "code" ? "✓" : "⧉"}
        </span>
        <span className="sr-only">Copy class code</span>
        {copied === "code" && (
          <span className="text-emerald-600 font-semibold">copied</span>
        )}
      </button>
      <button
        type="button"
        data-testid="class-share-chip-link"
        onClick={() => copy("link", joinUrl)}
        title="Copy student join link"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-alt border border-border text-text-secondary hover:bg-gray-100 text-[11px] font-medium transition max-w-full"
      >
        <span className="font-mono truncate max-w-[260px]">
          {joinUrlDisplay}
        </span>
        <span aria-hidden className="text-text-tertiary flex-shrink-0">
          {copied === "link" ? "✓" : "⧉"}
        </span>
        <span className="sr-only">Copy student join link</span>
        {copied === "link" && (
          <span className="text-emerald-600 font-semibold flex-shrink-0">copied</span>
        )}
      </button>
    </div>
  );
}
