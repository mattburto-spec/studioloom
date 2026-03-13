"use client";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  isExpanded: boolean;
  isComplete: boolean;
  onToggle: () => void;
  badge?: string;
  color?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  subtitle,
  isExpanded,
  isComplete,
  onToggle,
  badge,
  color,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border border-border rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-sm">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-200"
            style={{
              backgroundColor: isComplete
                ? (color || "#2DA05E")
                : isExpanded
                  ? (color || "#2E86AB") + "20"
                  : "#f1f5f9",
              color: isComplete
                ? "#fff"
                : isExpanded
                  ? (color || "#2E86AB")
                  : "#94a3b8",
            }}
          >
            {isComplete ? "✓" : ""}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">{title}</span>
              {badge && (
                <span className="px-1.5 py-0.5 bg-brand-purple/10 text-brand-purple text-[10px] font-medium rounded">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && !isExpanded && (
              <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[280px]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`text-text-secondary transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
