interface SectionDividerProps {
  number: number;
  color?: string;
}

export function SectionDivider({ number, color = "#E86F2C" }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-4 my-8">
      <div className="flex-1 h-px bg-gray-200" />
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
        style={{ backgroundColor: color }}
      >
        {number}
      </div>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}
