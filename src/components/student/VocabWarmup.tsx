"use client";

import { useState } from "react";
import { TappableText } from "@/components/student/tap-a-word";
import type { VocabWarmup as VocabWarmupType } from "@/types";

interface VocabWarmupProps {
  warmup: VocabWarmupType;
  ellLevel: number;
}

export function VocabWarmup({ warmup, ellLevel }: VocabWarmupProps) {
  const [expandedTerm, setExpandedTerm] = useState<number | null>(null);
  const [matchedItems, setMatchedItems] = useState<Set<number>>(new Set());

  // Only show for ELL level 1 and 2
  if (ellLevel > 2) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border/50 p-5">
      <h3 className="text-sm font-semibold text-accent-blue mb-3 uppercase tracking-wide">
        📖 Vocabulary Warm-up
      </h3>

      {/* Terms */}
      <div className="space-y-2 mb-4">
        {warmup.terms.map((term, i) => (
          <div
            key={i}
            className="bg-white rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedTerm(expandedTerm === i ? null : i)}
              className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-surface-alt transition"
            >
              <span className="font-medium text-sm">{term.term}</span>
              <span className="text-xs text-text-secondary">
                {expandedTerm === i ? "▲" : "▼"}
              </span>
            </button>
            {expandedTerm === i && (
              <div className="px-4 pb-3 text-sm">
                <p className="text-text-secondary"><TappableText text={term.definition} /></p>
                {term.example && (
                  <p className="text-text-secondary/70 mt-1 italic text-xs">
                    Example: <TappableText text={term.example} />
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Activity */}
      {warmup.activity && ellLevel === 1 && (
        <div className="border-t border-accent-blue/20 pt-3">
          <p className="text-xs font-medium text-accent-blue mb-2">
            Quick Practice:
          </p>
          <div className="space-y-1.5">
            {warmup.activity.items.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition ${
                  matchedItems.has(i)
                    ? "bg-accent-green/10 text-accent-green"
                    : "bg-white hover:bg-surface-alt"
                }`}
                onClick={() => {
                  setMatchedItems((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  });
                }}
              >
                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0"
                  style={{
                    borderColor: matchedItems.has(i) ? "#2DA05E" : "#E5E7EB",
                  }}
                >
                  {matchedItems.has(i) ? "✓" : ""}
                </span>
                <span>{item.question}</span>
                {matchedItems.has(i) && (
                  <span className="ml-auto text-xs text-accent-green font-medium">
                    {item.answer}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
