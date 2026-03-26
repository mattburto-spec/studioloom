"use client";

import { useParams } from "next/navigation";
import { DiscoveryShell } from "@/components/discovery/DiscoveryShell";

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
