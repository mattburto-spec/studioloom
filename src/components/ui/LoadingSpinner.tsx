type SpinnerSize = "sm" | "md" | "lg";

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  /** Optional label shown below the spinner */
  label?: string;
  className?: string;
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-3",
};

/**
 * Loading spinner. Replaces ~10 inline spinner implementations.
 *
 * Usage:
 *   <LoadingSpinner />
 *   <LoadingSpinner size="lg" label="Generating..." />
 */
export function LoadingSpinner({
  size = "md",
  label,
  className = "",
}: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className={`${SIZE_CLASSES[size]} border-purple-600 border-t-transparent rounded-full animate-spin`}
      />
      {label && (
        <p className="text-sm text-gray-500">{label}</p>
      )}
    </div>
  );
}
