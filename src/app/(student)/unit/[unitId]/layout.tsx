"use client";

import { use, useEffect } from "react";
import { UnitNavProvider, useUnitNav } from "@/contexts/UnitNavContext";
import { LessonSidebar } from "@/components/student/LessonSidebar";
import { useSidebarSlot } from "@/components/student/SidebarSlotContext";

function UnitLayoutInner({
  unitId,
  children,
}: {
  unitId: string;
  children: React.ReactNode;
}) {
  const ctx = useUnitNav();
  const { setHandler } = useSidebarSlot();

  // Register the mobile hamburger handler with the layout-owned BoldTopNav
  // so /unit/* routes can open the lesson drawer from the global nav.
  useEffect(() => {
    if (!ctx) return;
    setHandler(() => ctx.setSidebarOpen(true));
    return () => setHandler(null);
  }, [ctx, setHandler]);

  if (!ctx || ctx.loading || !ctx.data) {
    // Warm-paper Bold lesson skeleton — mirrors the loaded sidebar+main
    // structure so there's no layout shift when data arrives. We're inside
    // the (student) layout's .sl-v2 wrapper and BoldTopNav has already
    // injected the scoped CSS, so .lesson-bold tokens (--sl-bg, --sl-paper,
    // --sl-hair, --sl-hair-2) are in scope here.
    return (
      <div
        className="lesson-bold flex min-h-screen"
        style={{ background: "var(--sl-bg)" }}
      >
        {/* Sidebar placeholder — hidden on mobile to match LessonSidebar */}
        <div
          className="hidden md:flex flex-col w-[260px] shrink-0 border-r"
          style={{
            background: "var(--sl-paper)",
            borderColor: "var(--sl-hair)",
          }}
        >
          <div className="p-4 space-y-4 animate-pulse">
            <div
              className="h-32 rounded-lg"
              style={{ background: "var(--sl-hair-2)" }}
            />
            <div
              className="h-4 rounded w-3/4"
              style={{ background: "var(--sl-hair-2)" }}
            />
            <div
              className="h-3 rounded w-1/2"
              style={{ background: "var(--sl-hair-2)" }}
            />
            <div className="space-y-2 pt-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded"
                  style={{ background: "var(--sl-hair-2)" }}
                />
              ))}
            </div>
          </div>
        </div>
        {/* Main content placeholder — header card + body shimmer */}
        <div className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-6">
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                background: "var(--sl-paper)",
                borderColor: "var(--sl-hair)",
              }}
            >
              {/* Phase-stripe placeholder */}
              <div
                className="h-1.5 w-full"
                style={{ background: "var(--sl-hair-2)" }}
              />
              <div className="p-6 space-y-4">
                <div className="flex gap-2">
                  <div
                    className="h-5 w-20 rounded-full"
                    style={{ background: "var(--sl-hair-2)" }}
                  />
                  <div
                    className="h-5 w-16 rounded-full"
                    style={{ background: "var(--sl-hair-2)" }}
                  />
                </div>
                <div
                  className="h-8 rounded w-2/3"
                  style={{ background: "var(--sl-hair-2)" }}
                />
                <div className="space-y-2">
                  <div
                    className="h-3 rounded w-full"
                    style={{ background: "var(--sl-hair-2)" }}
                  />
                  <div
                    className="h-3 rounded w-5/6"
                    style={{ background: "var(--sl-hair-2)" }}
                  />
                </div>
              </div>
            </div>
            <div
              className="h-48 rounded-2xl border"
              style={{
                background: "var(--sl-paper)",
                borderColor: "var(--sl-hair)",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <LessonSidebar
        data={ctx.data}
        unitId={unitId}
        sidebarOpen={ctx.sidebarOpen}
        onClose={() => ctx.setSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}

export default function UnitLayout({
  params,
  children,
}: {
  params: Promise<{ unitId: string }>;
  children: React.ReactNode;
}) {
  const { unitId } = use(params);

  return (
    <UnitNavProvider unitId={unitId}>
      <UnitLayoutInner unitId={unitId}>
        {children}
      </UnitLayoutInner>
    </UnitNavProvider>
  );
}
