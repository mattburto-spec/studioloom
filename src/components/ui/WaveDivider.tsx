/**
 * Organic wave divider inspired by the Uncode Creative Landing template.
 * Renders layered SVG waves to separate sections.
 */

interface WaveDividerProps {
  /** "top" = waves point upward (placed at top of section), "bottom" = waves point down */
  direction?: "top" | "bottom";
  /** Tailwind background class for the wave fill (e.g. "fill-white", "fill-surface-alt") */
  fillClass?: string;
  /** Optional secondary wave with lighter opacity */
  showAccent?: boolean;
  className?: string;
}

export function WaveDivider({
  direction = "bottom",
  fillClass = "fill-white",
  showAccent = true,
  className = "",
}: WaveDividerProps) {
  const flip = direction === "top" ? "rotate-180" : "";

  return (
    <div className={`relative w-full overflow-hidden leading-none ${className}`}>
      {/* Accent wave (lighter, behind) */}
      {showAccent && (
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className={`absolute bottom-0 w-full h-full opacity-30 ${flip}`}
        >
          <path
            d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,80 1440,70 L1440,120 L0,120 Z"
            className="fill-brand-lilac"
          />
        </svg>
      )}

      {/* Main wave */}
      <svg
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        className={`relative w-full h-16 md:h-20 lg:h-24 ${flip}`}
      >
        <path
          d="M0,40 C320,100 640,0 960,50 C1120,75 1320,60 1440,40 L1440,100 L0,100 Z"
          className={fillClass}
        />
      </svg>
    </div>
  );
}
