"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Primary nav — 12 tabs per spec §9.8
const TABS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Pipeline", href: "/admin/pipeline" },
  { label: "Library", href: "/admin/library" },
  { label: "Controls", href: "/admin/controls" },
  { label: "Cost & Usage", href: "/admin/cost-usage" },
  { label: "Quality", href: "/admin/quality" },
  { label: "Wiring", href: "/admin/wiring" },
  { label: "Teachers", href: "/admin/teachers" },
  { label: "Students", href: "/admin/students" },
  { label: "Schools", href: "/admin/schools" },
  { label: "Bug Reports", href: "/admin/bug-reports" },
  { label: "Audit Log", href: "/admin/audit-log" },
];

// Secondary nav — legacy/tool routes
const TOOLS_TABS = [
  { label: "Pipeline Health", href: "/admin/pipeline/health" },
  { label: "Library Health", href: "/admin/library/health" },
  { label: "Ingestion Sandbox", href: "/admin/ingestion-sandbox" },
  { label: "Simulator", href: "/admin/simulator" },
  { label: "Feedback", href: "/admin/feedback" },
  { label: "Costs", href: "/admin/costs" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Registries", href: "/admin/controls/registries" },
  { label: "AI Model", href: "/admin/ai-model" },
  { label: "Frameworks", href: "/admin/framework-adapter" },
  { label: "Generation Sandbox", href: "/admin/generation-sandbox" },
  { label: "Sandbox Hub", href: "/admin/test-sandbox" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // /admin/login manages its own chrome — render bare (no admin nav)
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    // Exact match for sub-routes, startsWith for top-level tabs
    if (href.split("/").length > 3) return pathname === href;
    return pathname === href;
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

        {/* Primary tab navigation — 12 spec tabs */}
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

        {/* Secondary nav — tools & legacy routes */}
        <div className="max-w-7xl mx-auto px-6 border-t border-gray-100">
          <nav className="flex gap-1 overflow-x-auto py-1">
            {TOOLS_TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-2.5 py-1 text-[10px] font-medium rounded whitespace-nowrap transition-colors ${
                  isActive(tab.href)
                    ? "text-purple-600 bg-purple-50"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
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
