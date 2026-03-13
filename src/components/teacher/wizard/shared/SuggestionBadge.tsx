"use client";

interface SuggestionBadgeProps {
  label: string;
  onAccept: () => void;
  onDismiss: () => void;
  variant?: "compact" | "full";
}

export function SuggestionBadge({
  label,
  onAccept,
  onDismiss,
  variant = "compact",
}: SuggestionBadgeProps) {
  if (variant === "full") {
    return (
      <div className="rounded-lg border border-brand-purple/20 bg-brand-purple/5 p-3 animate-fade-in">
        <div className="flex items-start gap-2">
          <SparkleIcon />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-brand-purple/60 font-medium mb-1">AI suggests</p>
            <p className="text-xs text-text-primary leading-relaxed">{label}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={onAccept}
                className="px-3 py-1 bg-brand-purple text-white text-[10px] font-semibold rounded-full hover:bg-brand-purple/90 transition"
              >
                Use this
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-1 text-text-secondary text-[10px] hover:text-text-primary transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onAccept}
      className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-brand-purple/25 bg-brand-purple/5 text-brand-purple text-xs font-medium hover:bg-brand-purple/10 hover:border-brand-purple/40 transition-all duration-200 animate-fade-in"
    >
      <SparkleIcon />
      <span className="truncate max-w-[180px]">{label}</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-brand-purple/40 hover:text-brand-purple hover:bg-brand-purple/10 transition"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
        </svg>
      </span>
    </button>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="flex-shrink-0 opacity-60"
    >
      <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
    </svg>
  );
}

export function SuggestionLoading() {
  return (
    <span className="inline-flex items-center gap-1 ml-2">
      <span className="w-1 h-1 rounded-full bg-brand-purple/40 animate-pulse" />
      <span className="w-1 h-1 rounded-full bg-brand-purple/40 animate-pulse" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 rounded-full bg-brand-purple/40 animate-pulse" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
