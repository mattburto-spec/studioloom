"use client";

import { useState, useEffect } from "react";

interface PMIData {
  plus: string[];
  minus: string[];
  interesting: string[];
}

interface PMIFrameworkProps {
  value: string;
  onChange: (value: string) => void;
}

function emptyPMI(): PMIData {
  return { plus: [""], minus: [""], interesting: [""] };
}

function parseValue(value: string): PMIData {
  if (!value) return emptyPMI();
  try {
    return JSON.parse(value);
  } catch {
    return emptyPMI();
  }
}

export function PMIFramework({ value, onChange }: PMIFrameworkProps) {
  const [data, setData] = useState<PMIData>(() => parseValue(value));

  useEffect(() => {
    onChange(JSON.stringify(data));
  }, [data, onChange]);

  function updateItem(
    column: "plus" | "minus" | "interesting",
    index: number,
    text: string
  ) {
    setData((prev) => {
      const items = [...prev[column]];
      items[index] = text;
      return { ...prev, [column]: items };
    });
  }

  function addItem(column: "plus" | "minus" | "interesting") {
    setData((prev) => ({
      ...prev,
      [column]: [...prev[column], ""],
    }));
  }

  const columns: { key: "plus" | "minus" | "interesting"; label: string; icon: string; color: string; bg: string }[] = [
    { key: "plus", label: "Plus (+)", icon: "+", color: "#2DA05E", bg: "#2DA05E10" },
    { key: "minus", label: "Minus (-)", icon: "-", color: "#E86F2C", bg: "#E86F2C10" },
    { key: "interesting", label: "Interesting (?)", icon: "?", color: "#2E86AB", bg: "#2E86AB10" },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-brand-purple flex items-center gap-1.5 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
        PMI Analysis
      </div>

      <div className="grid grid-cols-3 gap-3">
        {columns.map((col) => (
          <div
            key={col.key}
            className="rounded-xl border border-border overflow-hidden"
          >
            <div
              className="px-3 py-2 text-xs font-bold flex items-center gap-1.5"
              style={{ backgroundColor: col.bg, color: col.color }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: col.color }}
              >
                {col.icon}
              </span>
              {col.label}
            </div>
            <div className="p-2 space-y-1.5">
              {data[col.key].map((item, i) => (
                <input
                  key={i}
                  type="text"
                  value={item}
                  onChange={(e) => updateItem(col.key, i, e.target.value)}
                  placeholder={`${col.label} point...`}
                  className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
                />
              ))}
              <button
                onClick={() => addItem(col.key)}
                className="w-full py-1 text-[10px] text-text-secondary border border-dashed border-border rounded hover:bg-gray-50 transition"
              >
                + Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
