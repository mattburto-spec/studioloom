import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Design Toolkit — 42 Visual Thinking Tools for Every Design Teacher | StudioLoom",
  description:
    "Browse 42 design thinking tools. Filter by design process phase, category, and deploy mode. Works with IB MYP, GCSE DT, A-Level, ACARA, PLTW, d.school, IDEO, and Double Diamond. Free forever.",
  openGraph: {
    title: "Design Toolkit — 42 Visual Thinking Tools",
    description:
      "The most beautiful collection of design thinking tools for teachers. Browse, filter, deploy. Free forever.",
    type: "website",
  },
};

export default function ToolkitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "#06060f",
        color: "#e8eaf0",
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      }}
    >
      {/* Minimal top nav — blends with dark theme */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{
          background: "rgba(6,6,15,0.85)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
            >
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="8" width="28" height="5" rx="2.5" fill="white" />
                <rect x="2" y="19" width="28" height="5" rx="2.5" fill="white" />
                <rect x="8" y="2" width="5" height="28" rx="2.5" fill="white" />
                <rect x="19" y="2" width="5" height="28" rx="2.5" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
              Studio<span style={{ color: "#fff" }}>Loom</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-xs font-medium px-3 py-1.5 rounded-md transition hover:opacity-80"
              style={{ color: "#f472b6" }}
            >
              Student
            </Link>
            <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "11px" }}>|</span>
            <Link
              href="/teacher/login"
              className="text-xs font-medium px-3 py-1.5 rounded-md transition hover:opacity-80"
              style={{ color: "#c084fc" }}
            >
              Teacher
            </Link>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
