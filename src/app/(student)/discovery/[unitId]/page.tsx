"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

// Code-split: DiscoveryShell + 8 station components (~5,900 lines)
// Only loaded when student actually visits /discovery/[unitId]
const DiscoveryShell = dynamic(
  () => import("@/components/discovery/DiscoveryShell").then((m) => m.DiscoveryShell),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: "100vh", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", border: "4px solid #2d2d4a",
            borderTop: "4px solid #7C3AED", borderRadius: "50%", margin: "0 auto",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ fontSize: "16px", color: "#9CA3AF", fontWeight: 500, marginTop: "12px" }}>Loading Discovery...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    ),
  }
);

/**
 * Discovery Engine — Main Page
 *
 * Entry point: /discovery/[unitId]
 *
 * This thin page component extracts route params and delegates
 * everything to DiscoveryShell, which manages the full experience
 * (state machine, station rendering, transitions, Kit mentor).
 *
 * Query params:
 * - mode: 'mode_1' | 'mode_2' (default: 'mode_1')
 * - classId: optional class context
 *
 * @see docs/specs/discovery-engine-build-plan.md
 */
export default function DiscoveryPage() {
  const params = useParams();
  const unitId = params.unitId as string;

  return <DiscoveryShell unitId={unitId} />;
}
