"use client";

import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { toJpeg } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  { value: "broken", label: "Something's broken", icon: "🔴" },
  { value: "visual", label: "Doesn't look right", icon: "🎨" },
  { value: "confused", label: "I'm confused", icon: "❓" },
  { value: "feature_request", label: "Feature request", icon: "💡" },
] as const;

interface BugReportButtonProps {
  /** Current user role */
  role: "teacher" | "student";
  /** Current class ID (if in class context) */
  classId?: string | null;
  /** Whether bug reporting is enabled for this class. Admin/teacher always see the button. */
  enabled?: boolean;
}

type CapturedEvent = {
  kind: "console.error" | "console.warn" | "window.error" | "unhandledrejection";
  message: string;
  source?: string | null;
  ts: number;
};

const MAX_EVENTS = 10;
const MAX_EVENT_LEN = 500;

function clip(s: string, max = MAX_EVENT_LEN): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * Parse the current path to extract the active StudioLoom route context —
 * which unit/lesson/class/activity the user was looking at when they hit
 * the bug button. Lets admins filter "all reports against unit X".
 *
 * Routes we care about:
 *   /unit/:unitId
 *   /unit/:unitId/L:lessonNumber
 *   /unit/:unitId/L:lessonNumber/A:activityNumber
 *   /class/:classId
 *   /class/:classId/...
 *   /teacher/units/:unitId
 *   /admin/...
 */
function extractRouteContext(pathname: string): {
  pathname: string;
  routeKind: string | null;
  unitId?: string;
  lessonNumber?: number;
  activityNumber?: number;
  classId?: string;
} {
  const ctx: ReturnType<typeof extractRouteContext> = { pathname, routeKind: null };

  // /unit/:unitId(/L\d+(/A\d+)?)?
  const unitMatch = pathname.match(/\/unit\/([0-9a-f-]{36})(?:\/L(\d+))?(?:\/A(\d+))?/i);
  if (unitMatch) {
    ctx.routeKind = "unit";
    ctx.unitId = unitMatch[1];
    if (unitMatch[2]) ctx.lessonNumber = Number(unitMatch[2]);
    if (unitMatch[3]) ctx.activityNumber = Number(unitMatch[3]);
    return ctx;
  }

  // /class/:classId/...
  const classMatch = pathname.match(/\/class\/([0-9a-f-]{36})/i);
  if (classMatch) {
    ctx.routeKind = "class";
    ctx.classId = classMatch[1];
    return ctx;
  }

  // /teacher/units/:unitId
  const teacherUnitMatch = pathname.match(/\/teacher\/units\/([0-9a-f-]{36})/i);
  if (teacherUnitMatch) {
    ctx.routeKind = "teacher-unit";
    ctx.unitId = teacherUnitMatch[1];
    return ctx;
  }

  // Best-effort label for everything else
  if (pathname.startsWith("/teacher/")) ctx.routeKind = "teacher";
  else if (pathname.startsWith("/admin/")) ctx.routeKind = "admin";
  else if (pathname.startsWith("/dashboard")) ctx.routeKind = "dashboard";
  else if (pathname === "/" || pathname === "") ctx.routeKind = "landing";

  return ctx;
}

function buildClientContext(role: "teacher" | "student") {
  if (typeof window === "undefined") return { role };

  const nav = window.navigator;
  const conn = (nav as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;

  return {
    role,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null,
    deployEnv: process.env.NEXT_PUBLIC_VERCEL_ENV || null,
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 5) : [],
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
    },
    screen: {
      width: window.screen?.width ?? null,
      height: window.screen?.height ?? null,
    },
    connection: conn
      ? {
          effectiveType: conn.effectiveType ?? null,
          downlink: conn.downlink ?? null,
          rtt: conn.rtt ?? null,
          saveData: conn.saveData ?? null,
        }
      : null,
    hardware: {
      cores: nav.hardwareConcurrency ?? null,
      memoryGb: (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      touchPoints: nav.maxTouchPoints ?? null,
    },
    referrer: document.referrer || null,
    timeOnPageMs: Math.round(performance.now()),
    submittedAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    route: extractRouteContext(window.location.pathname),
  };
}

/**
 * Capture the current page as a JPEG data-URL using html-to-image. Returns
 * { dataUrl, bytes } on success, null on failure or oversized payload.
 *
 * Long lesson pages can render to 20+ MP — even at JPEG q=0.8 that blows
 * past Vercel's 4.5 MB body limit. So we dynamically scale pixelRatio so
 * the longest output dimension caps at MAX_LONGEST_DIM, and reject the
 * payload if it's still over MAX_PAYLOAD_BYTES after encoding (rather
 * than letting the API 413 with a confusing error).
 */
const MAX_LONGEST_DIM = 1400;
const MAX_PAYLOAD_BYTES = 3 * 1024 * 1024; // 3MB after base64 — fits Vercel 4.5MB body limit

async function capturePageScreenshot(): Promise<{ dataUrl: string; bytes: number } | null> {
  try {
    // Hide the bug-report panel itself so it doesn't appear in the shot.
    const panel = document.querySelector<HTMLElement>("[data-bug-report-panel]");
    const prevDisplay = panel?.style.display;
    if (panel) panel.style.display = "none";

    // Compute pixelRatio so that max(naturalWidth, naturalHeight) * ratio <= MAX_LONGEST_DIM.
    const naturalW = document.documentElement.scrollWidth;
    const naturalH = document.documentElement.scrollHeight;
    const longest = Math.max(naturalW, naturalH);
    const baseRatio = longest > 0 ? Math.min(1, MAX_LONGEST_DIM / longest) : 1;

    const dataUrl = await toJpeg(document.body, {
      cacheBust: true,
      pixelRatio: baseRatio,
      quality: 0.8,
      backgroundColor: "#ffffff",
      filter: (node) => {
        if (node instanceof HTMLElement && node.dataset.bugReportButton === "true") return false;
        return true;
      },
    });

    if (panel && prevDisplay !== undefined) panel.style.display = prevDisplay;

    // Approximate base64-decoded byte count: 3/4 of the data part length.
    const commaIdx = dataUrl.indexOf(",");
    const base64Len = commaIdx >= 0 ? dataUrl.length - commaIdx - 1 : dataUrl.length;
    const decodedBytes = Math.floor(base64Len * 0.75);

    if (dataUrl.length > MAX_PAYLOAD_BYTES) {
      // Even after compression, this is too big for the wire. Caller surfaces
      // a friendly message rather than letting the server 413.
      return null;
    }

    return { dataUrl, bytes: decodedBytes };
  } catch (e) {
    console.warn("Bug report: screenshot capture failed", e);
    return null;
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function BugReportButton({ role, classId, enabled = true }: BugReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotBytes, setScreenshotBytes] = useState<number>(0);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  // Bumps each time the button is clicked open — used as the AnimatePresence
  // key so the splat re-triggers on every click.
  const [splatKey, setSplatKey] = useState<number>(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<CapturedEvent[]>([]);

  // Capture console errors/warns + uncaught errors + unhandled promise rejections.
  // The Sentry-style screenshot Matt sent was an `onunhandledrejection` —
  // the old console.error-only hook would have missed it.
  useEffect(() => {
    const push = (ev: CapturedEvent) => {
      eventsRef.current = [...eventsRef.current.slice(-(MAX_EVENTS - 1)), ev];
    };

    const origError = console.error;
    const origWarn = console.warn;

    console.error = (...args: unknown[]) => {
      push({ kind: "console.error", message: clip(args.map(String).join(" ")), ts: Date.now() });
      origError.apply(console, args);
    };
    console.warn = (...args: unknown[]) => {
      push({ kind: "console.warn", message: clip(args.map(String).join(" ")), ts: Date.now() });
      origWarn.apply(console, args);
    };

    const onErr = (e: ErrorEvent) => {
      push({
        kind: "window.error",
        message: clip(e.message || "Unknown error"),
        source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : null,
        ts: Date.now(),
      });
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg =
        reason instanceof Error
          ? `${reason.name}: ${reason.message}\n${(reason.stack || "").slice(0, 300)}`
          : String(reason);
      push({ kind: "unhandledrejection", message: clip(msg), ts: Date.now() });
    };

    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);

    return () => {
      console.error = origError;
      console.warn = origWarn;
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Teachers always see the button; students only when enabled for their class
  if (role === "student" && !enabled) return null;

  const handleClose = () => {
    setOpen(false);
    setStep("pick");
    setCategory(null);
    setDescription("");
    setError(null);
    setSubmitted(false);
    setScreenshotDataUrl(null);
    setScreenshotBytes(0);
    setCapturingScreenshot(false);
  };

  const handleAttachScreenshot = async () => {
    setCapturingScreenshot(true);
    setError(null);

    // toJpeg does heavy synchronous DOM/canvas work before its first
    // internal await — without a yield here, the main thread is blocked
    // before the browser paints the shimmer, and the loading state
    // either flashes for a frame or never paints at all. Two rAF ticks
    // guarantees React commits and the browser paints before we start.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const result = await capturePageScreenshot();
    setCapturingScreenshot(false);
    if (result) {
      setScreenshotDataUrl(result.dataUrl);
      setScreenshotBytes(result.bytes);
    } else {
      setError("Page is too long to screenshot. Submit without it — we'll still get the URL + browser info.");
    }
  };

  const handleCategoryPick = (cat: string) => {
    setCategory(cat);
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!category || !description.trim()) return;
    setSubmitting(true);
    setError(null);

    const ctx = {
      ...buildClientContext(role),
      events: eventsRef.current,
    };

    // Mirror the report into Sentry so triage gets stack traces, breadcrumbs,
    // and any session replay alongside the user's text. We do NOT block on
    // Sentry — if it fails, the report still submits without an event id.
    let sentryEventId: string | null = null;
    try {
      sentryEventId = Sentry.captureMessage(
        `Bug report (${category}): ${description.trim().slice(0, 80)}`,
        {
          level: category === "broken" ? "error" : "info",
          tags: {
            bug_report: "true",
            bug_category: category,
            reporter_role: role,
            class_id: classId || "none",
            route_kind: ctx.route?.routeKind || "unknown",
          },
          contexts: {
            bug_report: {
              description: description.trim(),
              page_url: window.location.href,
              recent_events: eventsRef.current.length,
            },
          },
        }
      );
    } catch {
      // Non-fatal — keep going.
    }

    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          page_url: window.location.href,
          // Legacy field — still accepted by the API; mirror the error events.
          console_errors: eventsRef.current
            .filter((e) => e.kind === "console.error")
            .slice(-5)
            .map((e) => e.message),
          class_id: classId || null,
          role_hint: role,
          client_context: ctx,
          sentry_event_id: sentryEventId,
          screenshot_data_url: screenshotDataUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSubmitted(true);
      setTimeout(handleClose, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => {
          setSplatKey((k) => k + 1);
          setOpen(!open);
        }}
        data-bug-report-button="true"
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors hover:scale-105 active:scale-95"
        style={{
          background: open ? "#DC2626" : "#7B2FF2",
          color: "white",
        }}
        title="Report a bug"
      >
        {/* Splat — re-keyed on each click so the animation re-fires.
            Multi-blob radial that scales out and fades. Students-only
            since teachers might find it noisy. */}
        {role === "student" && (
          <AnimatePresence>
            <motion.span
              key={splatKey}
              className="pointer-events-none absolute inset-0 rounded-full"
              initial={{ scale: 0.4, opacity: 0.85 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              style={{
                background:
                  "radial-gradient(circle at 30% 35%, #FCD34D 0 18%, transparent 22%), " +
                  "radial-gradient(circle at 70% 30%, #F472B6 0 14%, transparent 19%), " +
                  "radial-gradient(circle at 60% 75%, #34D399 0 16%, transparent 21%), " +
                  "radial-gradient(circle at 25% 70%, #60A5FA 0 14%, transparent 19%), " +
                  "radial-gradient(circle at 50% 50%, rgba(123,47,242,0.55) 0 35%, transparent 55%)",
              }}
            />
          </AnimatePresence>
        )}

        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="relative">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <motion.svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="relative"
            // Students get a periodic wiggle so the bug feels alive.
            // Teachers get a static icon — they're working, not playing.
            // Pattern: brief 6-frame jiggle every ~5s with a 1.6s active window.
            animate={
              role === "student"
                ? { rotate: [0, -10, 8, -6, 4, -2, 0] }
                : undefined
            }
            transition={
              role === "student"
                ? {
                    duration: 1.6,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 4.5,
                  }
                : undefined
            }
          >
            <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z" />
            <path d="M12 20v2M6 13H2M22 13h-4M6 17H3.5M20.5 17H18M6 9H4M20 9h-2" />
          </motion.svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          data-bug-report-panel
          className="fixed bottom-20 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          {submitted ? (
            <div className="p-6 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-medium text-gray-900">Report submitted!</p>
              <p className="text-xs text-gray-500 mt-1">Thanks for helping improve StudioLoom</p>
            </div>
          ) : step === "pick" ? (
            <div className="p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">What's happening?</p>
              <div className="space-y-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleCategoryPick(c.value)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="text-lg">{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setStep("pick")}
                  className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-semibold text-gray-900">
                  {CATEGORIES.find((c) => c.value === category)?.label}
                </span>
              </div>

              <textarea
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                maxLength={2000}
              />

              <p className="text-[10px] text-gray-400 mt-1">
                Auto-captures: page URL, browser, viewport, release{eventsRef.current.length > 0 ? `, ${eventsRef.current.length} recent error${eventsRef.current.length === 1 ? "" : "s"}` : ""}
              </p>

              {/* Screenshot attach */}
              <div className="mt-3">
                {screenshotDataUrl ? (
                  <div className="space-y-1">
                    <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                      <a href={screenshotDataUrl} target="_blank" rel="noopener noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screenshotDataUrl}
                          alt="Attached screenshot"
                          className="w-full h-32 object-cover object-top block"
                        />
                      </a>
                      <button
                        onClick={() => { setScreenshotDataUrl(null); setScreenshotBytes(0); }}
                        className="absolute top-1 right-1 px-2 py-0.5 text-[10px] bg-black/60 text-white rounded hover:bg-black/80"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Screenshot attached · {formatBytes(screenshotBytes)} · click to view full
                    </p>
                  </div>
                ) : capturingScreenshot ? (
                  // Shutter / progress shimmer — capture takes 2-3s on long
                  // pages; visible motion reassures the user it's working.
                  <div className="relative w-full h-32 rounded-lg border border-gray-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 overflow-hidden flex flex-col items-center justify-center gap-2">
                    {/* Shimmer sweep */}
                    <motion.div
                      className="absolute inset-y-0 w-1/3"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.18) 50%, transparent 100%)",
                      }}
                      initial={{ x: "-100%" }}
                      animate={{ x: "300%" }}
                      transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
                    />
                    {/* Pulsing camera */}
                    <motion.svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#7B2FF2"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="relative"
                      animate={{ scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }}
                      transition={{ duration: 1.0, ease: "easeInOut", repeat: Infinity }}
                    >
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </motion.svg>
                    <p className="relative text-xs text-purple-700 font-medium">Capturing screenshot…</p>
                    <p className="relative text-[10px] text-gray-500">Long pages can take a few seconds</p>
                  </div>
                ) : (
                  <button
                    onClick={handleAttachScreenshot}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    Attach screenshot of this page
                  </button>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-600 mt-2">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!description.trim() || submitting}
                className="w-full mt-3 py-2 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
                style={{ background: "#7B2FF2" }}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          )}
        </div>
      )}

    </>
  );
}
