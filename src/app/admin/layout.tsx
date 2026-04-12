"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Pipeline", href: "/admin/pipeline" },
  { label: "Library", href: "/admin/library" },
  { label: "Ingestion Sandbox", href: "/admin/ingestion-sandbox" },
  { label: "Simulator", href: "/admin/simulator" },
  { label: "Feedback", href: "/admin/feedback" },
  { label: "Costs", href: "/admin/costs" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Controls", href: "/admin/controls" },
  { label: "AI Model", href: "/admin/ai-model" },
  { label: "Frameworks", href: "/admin/framework-adapter" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Admin header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: "rgba(0,0,0,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/teacher/dashboard" className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
              >
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <rect x="2" y="8" width="28" height="5" rx="2.5" fill="white" />
                  <rect x="2" y="19" width="28" height="5" rx="2.5" fill="white" />
                  <rect x="8" y="2" width="5" height="28" rx="2.5" fill="white" />
                  <rect x="19" y="2" width="5" height="28" rx="2.5" fill="white" />
                </svg>
              </div>
              <span className="font-bold text-text-primary text-sm tracking-tight">StudioLoom</span>
            </Link>
            <div className="w-px h-5 bg-border" />
            <span className="text-xs font-semibold text-brand-purple bg-brand-purple/8 px-2.5 py-1 rounded-lg uppercase tracking-wider">
              Admin
            </span>
          </div>
          <Link
            href="/teacher/dashboard"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors font-medium"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Tab navigation */}
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 overflow-x-auto pb-px -mb-px">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                  isActive(tab.href)
                    ? "text-purple-700 bg-purple-50 border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
