"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useDiscoverySession } from "@/hooks/useDiscoverySession";
import { StationBackground } from "./StationBackground";
import { KitMentor } from "./KitMentor";
import { ProgressBar } from "./ProgressBar";
import { StationRenderer } from "./stations/StationRenderer";
import { getKitState } from "@/lib/discovery/kit-expressions";
import type { DiscoveryMode, DiscoveryStation, DiscoveryState } from "@/lib/discovery/types";

/**
 * DiscoveryShell — the orchestrator for the entire Discovery experience.
 *
 * Manages:
 * - Session lifecycle (useDiscoverySession hook)
 * - Station backgrounds (CSS gradients per station)
 * - Kit mentor (expression + position)
 * - Station rendering (delegates to per-station components)
 * - Transition animations between stations
 * - Progress indicator
 * - Exit button
 *
 * This is an immersive full-screen experience.
 * The standard student nav header is hidden.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 1
 * @see docs/specs/discovery-engine-ux-design.md
 */

interface DiscoveryShellProps {
  unitId: string;
}

export function DiscoveryShell({ unitId }: DiscoveryShellProps) {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as DiscoveryMode) || "mode_1";
  const classId = searchParams.get("classId");

  const session = useDiscoverySession({
    unitId,
    classId,
    ageBand: "senior", // Fallback — auto-detected from graduation_year in useDiscoverySession init
    mode,
  });

  // ─── Auto-complete stations on transition ─────────────────────
  // When the state machine enters a transition (e.g. transition_2_3),
  // the previous station is complete. Mark it so resume works correctly.
  const lastCompletedRef = useRef<number>(-1);

  useEffect(() => {
    const currentState = session.machine.current;
    if (session.machine.isTransition) {
      // Extract the "from" station from transition_N_M
      const match = currentState.match(/^transition_(\d+)_\d+$/);
      if (match) {
        const completedStation = parseInt(match[1], 10) as DiscoveryStation;
        if (completedStation > lastCompletedRef.current) {
          lastCompletedRef.current = completedStation;
          session.completeStation(completedStation);
        }
      }
    }
    // Also handle the last station (S7 has no transition after it)
    if (currentState === "completed" && lastCompletedRef.current < 7) {
      lastCompletedRef.current = 7;
      // completeJourney already called by the action that set this state
    }
  }, [session.machine.current, session.machine.isTransition, session.completeStation]);

  // ─── Loading State ──────────────────────────────────────────
  if (session.loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/70 text-base">Loading your journey...</p>
        </div>
      </div>
    );
  }

  // ─── Error State (failed to create/load session) ────────────
  if (!session.loading && !session.sessionId && session.machine.current === "not_started") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Couldn&apos;t start your journey
          </h1>
          <p className="text-white/70 mb-6 text-base">
            Something went wrong loading the Discovery Engine. Try refreshing the page, or head back to your dashboard.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              Try Again
            </button>
            <a
              href="/dashboard"
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─── Completed State ────────────────────────────────────────
  if (session.machine.current === "completed") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="text-6xl mb-4">🚀</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Journey Complete
          </h1>
          <p className="text-white/60 mb-6">
            You&apos;ve discovered your design identity. Your project awaits.
          </p>
          <a
            href={`/unit/${unitId}/narrative`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
          >
            Continue to your project →
          </a>
        </div>
      </div>
    );
  }

  // ─── Main Experience ────────────────────────────────────────
  const stationMeta = session.currentStationMeta;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background — CSS gradient per station */}
      <StationBackground
        station={session.machine.currentStation}
        isTransition={session.machine.isTransition}
      />

      {/* Progress bar — minimal, top of screen */}
      <ProgressBar
        totalProgress={session.totalProgress}
        stationProgress={session.stationProgress}
        stationName={stationMeta?.shortName ?? ""}
        stationEmoji={stationMeta?.emoji ?? ""}
        saveStatus={session.saveStatus}
      />

      {/* Kit Mentor — floating character with context-aware expression */}
      {(() => {
        const kitState = getKitState(session.machine.current as DiscoveryState);
        return (
          <KitMentor
            expression={kitState.expression}
            station={session.machine.currentStation}
            message={kitState.message}
          />
        );
      })()}

      {/* Station Content — the main interactive area */}
      <div className="absolute inset-0 pt-12 pb-20 flex items-center justify-center">
        <div className="w-full max-w-2xl mx-auto px-6">
          <StationRenderer session={session} />
        </div>
      </div>

      {/* Navigation — bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* Back button */}
          <button
            onClick={session.back}
            disabled={!session.machine.canGoBack}
            className="px-4 py-2 rounded-full text-sm font-medium text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            ← Back
          </button>

          {/* Save indicator */}
          <div className="text-xs text-white/30">
            {session.saveStatus === "saving" && "Saving..."}
            {session.saveStatus === "saved" && "✓ Saved"}
            {session.saveStatus === "error" && "⚠ Save failed"}
          </div>

          {/* Next button */}
          <button
            onClick={session.next}
            disabled={
              !session.machine.canGoForward || !session.canAdvanceFromCurrent
            }
            className="px-6 py-2.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-colors backdrop-blur-sm"
          >
            Continue →
          </button>
        </div>
      </div>

      {/* Exit button — top right */}
      <a
        href="/dashboard"
        className="absolute top-3 right-4 text-white/30 hover:text-white/60 transition-colors text-sm z-50"
      >
        ✕ Exit
      </a>
    </div>
  );
}
