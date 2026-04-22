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
    return (
      <div className="min-h-screen gradient-hero">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-3 bg-white/10 rounded w-full" />
            <div className="h-10 bg-white/10 rounded w-full" />
            <div className="h-64 bg-white/10 rounded w-full" />
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
