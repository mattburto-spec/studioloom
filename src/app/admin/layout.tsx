"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Primary nav — pilot-focused tabs.
//
// Removed in three passes:
//   - 4 May AM: Pipeline + Library (Dimensions3 quarantined)
//   - 4 May PM #1: Quality + Controls (Quality = Dimensions3 efficacy
//     scores; Controls = empty hub page).
//   - 4 May PM #2: Wiring (system architecture map — useful as a
//     reference doc but not a daily-pilot-ops surface; access via
//     direct /admin/wiring URL when needed).
//   - Added: AI Budget + Deletions (new pilot-ops tabs).
//
// Page files for removed tabs remain so URLs don't 404; nav just hides them.
const TABS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Cost & Usage", href: "/admin/cost-usage" },
  { label: "AI Budget", href: "/admin/ai-budget" },
  { label: "Teachers", href: "/admin/teachers" },
  { label: "Students", href: "/admin/students" },
  { label: "Schools", href: "/admin/schools" },
  { label: "Bug Reports", href: "/admin/bug-reports" },
  // Pilot Mode P3: dev-only review surface for Preflight scanner tuning.
  // Lists every flagged + overridden fab job across all schools so the
  // ruleset can be tightened/loosened based on real student usage.
  { label: "Preflight", href: "/admin/preflight/flagged" },
  { label: "Audit Log", href: "/admin/audit-log" },
  { label: "Deletions", href: "/admin/deletions" },
];

// Secondary nav — operational tools.
//
// Removed 4 May PM: Settings (admin_settings UI rarely touched; can navigate
// to /admin/settings directly when needed) + AI Model (runtime model config,
// also rarely touched; direct URL works). Kept Registries (load-bearing for
// drift detection) + Frameworks (FrameworkAdapter mapping reference).
const TOOLS_TABS = [
  { label: "Registries", href: "/admin/controls/registries" },
  { label: "Frameworks", href: "/admin/framework-adapter" },
];

interface WhoAmI {
  email: string | null;
  teacherId: string | null;
}

/**
 * Auth state for the admin shell:
 *  - "checking"     → waiting on the first whoami response
 *  - "admin"        → confirmed admin; render the chrome + children
 *  - "redirecting"  → whoami returned 401/403; router.replace to /admin/login
 *                     is in flight. Don't render chrome.
 */
type AdminAuthState = "checking" | "admin" | "redirecting";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingTeacherRequests, setPendingTeacherRequests] = useState<number>(0);
  const [whoami, setWhoami] = useState<WhoAmI | null>(null);
  const [authState, setAuthState] = useState<AdminAuthState>("checking");
  const [menuOpen, setMenuOpen] = useState(false);

  // Lightweight badge count for the Teachers tab — surfaces the
  // teacher_access_requests queue without requiring the user to drill into
  // the Teachers tab to see there's anything waiting. Polls once on mount;
  // refreshed on every nav (the layout re-mounts on hard navigation).
  useEffect(() => {
    if (pathname === "/admin/login" || pathname === null) return;
    fetch("/api/admin/teacher-requests?status=pending")
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => setPendingTeacherRequests(Array.isArray(d.requests) ? d.requests.length : 0))
      .catch(() => { /* silent — badge just stays 0 */ });
  }, [pathname]);

  // Phase 6.7+ — show the logged-in admin's email in the header AND
  // detect session takeover. The auth cookie is domain-scoped on
  // studioloom.org so all incognito windows in the same Chrome profile
  // share it. If a student logs in via /api/auth/student-classcode-login
  // in another window, the admin's session is silently replaced. Without
  // this check the page just stays mounted and surfaces opaque 403s on
  // every API call — confusing.
  //
  // The check (8 May 2026):
  //   - whoami returns 401 / 403 → session is gone or no longer admin
  //     → redirect to /admin/login with a friendly note via query param
  //   - whoami returns ok → set the dropdown email as before
  useEffect(() => {
    if (pathname === "/admin/login" || pathname === null) return;
    setAuthState("checking");
    fetch("/api/admin/whoami")
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          // Session-takeover or expired — bounce to login with reason.
          // Set state BEFORE replace so we don't render chrome between
          // ticks while router.replace is in flight.
          setAuthState("redirecting");
          router.replace("/admin/login?reason=session-changed");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d?.ok) {
          setWhoami({ email: d.email ?? null, teacherId: d.teacherId ?? null });
          setAuthState("admin");
        }
      })
      .catch(() => { /* silent — header just shows "Admin" */ });
  }, [pathname, router]);

  // Close the menu when the route changes (so it doesn't linger across
  // tab navigations).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  // /admin/login manages its own chrome — render bare (no admin nav).
  // Also render bare while pathname is still resolving (null during initial
  // render) to avoid a chrome flash before the client hydrates.
  if (pathname === null || pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Defense in depth: don't render the admin chrome until whoami has
  // confirmed admin status. Middleware should already redirect unauth'd
  // requests at the network layer, but if a stale cookie or CDN/cache
  // edge case sneaks through, this prevents the brief flash of admin
  // chrome that an unauthorised viewer would otherwise see while
  // router.replace fires in the useEffect above.
  if (authState !== "admin") {
    return (
      <div
        className="min-h-screen bg-surface-alt flex items-center justify-center"
        data-testid="admin-auth-checking"
      >
        <div className="text-text-secondary text-sm flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full bg-brand-purple animate-pulse"
            aria-hidden="true"
          />
          {authState === "redirecting" ? "Redirecting…" : "Verifying admin access…"}
        </div>
      </div>
    );
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-md hover:bg-gray-100"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase">
                {whoami?.email?.[0] ?? "A"}
              </span>
              <span className="hidden sm:inline-block max-w-[200px] truncate text-text-primary">
                {whoami?.email ?? "Admin"}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400" aria-hidden="true">
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {menuOpen && (
              <>
                {/* Click-away overlay */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
                  role="menu"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500">Signed in as</div>
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {whoami?.email ?? "(unknown — not admin?)"}
                    </div>
                    {whoami?.teacherId && (
                      <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                        {whoami.teacherId}
                      </div>
                    )}
                  </div>
                  {/* "Back to teacher dashboard" link removed 8 May 2026 —
                       the admin role is intentionally separable from the
                       teacher role. Per Matt: "admin doesn't need a 'back
                       to teacher dashboard' button … in future may not
                       even be a teacher". An admin who happens to also
                       teach can navigate via the URL bar or a fresh tab. */}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Primary tab navigation — 12 spec tabs */}
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 overflow-x-auto pb-px -mb-px">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
                  isActive(tab.href)
                    ? "text-purple-700 bg-purple-50 border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.label}
                {tab.href === "/admin/teachers" && pendingTeacherRequests > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold leading-none bg-amber-500 text-white rounded-full"
                    title={`${pendingTeacherRequests} teacher request(s) awaiting review`}
                  >
                    {pendingTeacherRequests}
                  </span>
                )}
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
