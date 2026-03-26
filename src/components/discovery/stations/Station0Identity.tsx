"use client";

import { useCallback } from "react";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import { getStation0Content } from "@/lib/discovery/content";
import { STATION_0_KIT_DIALOGUE } from "@/lib/discovery/content/station-0-identity";
import type { Station0Data } from "@/lib/discovery/types";
import { DiscoveryImage } from "../DiscoveryImage";
import { TOOL_ICONS, WORKSPACE_ICONS } from "@/lib/discovery/assets";

/**
 * Station 0: Design Identity Card
 *
 * Three sub-steps:
 * 1. Pick a colour palette (1 of 5)
 * 2. Pick 3 tools (from 12)
 * 3. Pick 4 workspace items (from 16)
 *
 * No authored text — all interaction is visual selection.
 * Kit comments on each choice.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 0
 */

function ToolIcon({ toolId, emoji }: { toolId: string; emoji: string }) {
  const imagePath = TOOL_ICONS[toolId];
  if (!imagePath) return <div className="text-2xl mb-1">{emoji}</div>;

  return (
    <div className="w-10 h-10 mx-auto mb-1">
      <DiscoveryImage
        src={imagePath}
        alt={toolId}
        className="w-full h-full object-contain"
        fallback={<div className="text-2xl text-center">{emoji}</div>}
      />
    </div>
  );
}

function WorkspaceIcon({ itemId, emoji }: { itemId: string; emoji: string }) {
  const imagePath = WORKSPACE_ICONS[itemId];
  if (!imagePath) return <div className="text-xl mb-1">{emoji}</div>;

  return (
    <div className="w-8 h-8 mx-auto mb-1">
      <DiscoveryImage
        src={imagePath}
        alt={itemId}
        className="w-full h-full object-contain"
        fallback={<div className="text-xl text-center">{emoji}</div>}
      />
    </div>
  );
}

interface Station0IdentityProps {
  session: UseDiscoverySessionReturn;
}

export function Station0Identity({ session }: Station0IdentityProps) {
  const { machine, profile } = session;
  const { current } = machine;
  const station0 = profile.station0;
  const { palettes, tools, workspaceItems } = getStation0Content();

  const updateData = useCallback(
    (updates: Partial<Station0Data>) => {
      session.updateStation("station0", { ...station0, ...updates });
    },
    [session, station0],
  );

  // ─── Intro ─────────────────────────────────────────────────
  if (current === "station_0") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🎨</div>
        <h2 className="text-xl font-bold text-white mb-3">
          Design Identity Card
        </h2>
        <p className="text-white/60 text-sm max-w-md mx-auto leading-relaxed">
          {STATION_0_KIT_DIALOGUE.intro}
        </p>
      </div>
    );
  }

  // ─── Palette Selection ─────────────────────────────────────
  if (current === "station_0_palette") {
    return (
      <div>
        <p className="text-white/70 text-sm mb-6 text-center">
          {STATION_0_KIT_DIALOGUE.palette_prompt}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {palettes.map((palette) => {
            const isSelected = station0.palette === palette.id;
            return (
              <button
                key={palette.id}
                onClick={() => updateData({ palette: palette.id })}
                className={`relative rounded-xl p-3 transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-white/60 scale-105"
                    : "ring-1 ring-white/10 hover:ring-white/30 hover:scale-102"
                }`}
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {/* Color swatches */}
                <div className="flex gap-1 mb-2">
                  {palette.colors.map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 h-8 rounded-md"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="text-xs text-white/70 font-medium">
                  {palette.label}
                </div>
                <div className="text-[10px] text-white/40">{palette.vibe}</div>
              </button>
            );
          })}
        </div>

        {/* Kit's response to selection */}
        {station0.palette && (
          <p className="text-white/50 text-xs text-center mt-4 italic">
            {STATION_0_KIT_DIALOGUE.palette_response(station0.palette)}
          </p>
        )}
      </div>
    );
  }

  // ─── Tool Selection (pick 3) ───────────────────────────────
  if (current === "station_0_tools") {
    return (
      <div>
        <p className="text-white/70 text-sm mb-2 text-center">
          {STATION_0_KIT_DIALOGUE.tools_prompt}
        </p>
        <p className="text-white/40 text-xs mb-6 text-center">
          Pick 3 — {station0.tools.length}/3 selected
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {tools.map((tool) => {
            const isSelected = station0.tools.includes(tool.id);
            const atLimit = station0.tools.length >= 3;
            return (
              <button
                key={tool.id}
                onClick={() => {
                  if (isSelected) {
                    updateData({
                      tools: station0.tools.filter((t) => t !== tool.id),
                    });
                  } else if (!atLimit) {
                    updateData({ tools: [...station0.tools, tool.id] });
                  }
                }}
                disabled={!isSelected && atLimit}
                className={`rounded-xl p-4 text-center transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-white/60 bg-white/10 scale-105"
                    : atLimit
                      ? "opacity-30 cursor-not-allowed bg-white/5"
                      : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <ToolIcon toolId={tool.id} emoji={tool.icon} />
                <div className="text-xs text-white/70">{tool.label}</div>
              </button>
            );
          })}
        </div>

        {station0.tools.length === 3 && (
          <p className="text-white/50 text-xs text-center mt-4 italic">
            {STATION_0_KIT_DIALOGUE.tools_response}
          </p>
        )}
      </div>
    );
  }

  // ─── Workspace Items (pick 4) ──────────────────────────────
  if (current === "station_0_workspace") {
    return (
      <div>
        <p className="text-white/70 text-sm mb-2 text-center">
          {STATION_0_KIT_DIALOGUE.workspace_prompt}
        </p>
        <p className="text-white/40 text-xs mb-6 text-center">
          Pick 4 — {station0.workspaceItems.length}/4 selected
        </p>

        <div className="grid grid-cols-4 gap-2">
          {workspaceItems.map((item) => {
            const isSelected = station0.workspaceItems.includes(item.id);
            const atLimit = station0.workspaceItems.length >= 4;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isSelected) {
                    updateData({
                      workspaceItems: station0.workspaceItems.filter(
                        (i) => i !== item.id,
                      ),
                    });
                  } else if (!atLimit) {
                    updateData({
                      workspaceItems: [...station0.workspaceItems, item.id],
                    });
                  }
                }}
                disabled={!isSelected && atLimit}
                className={`rounded-xl p-3 text-center transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-white/60 bg-white/10 scale-105"
                    : atLimit
                      ? "opacity-30 cursor-not-allowed bg-white/5"
                      : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                <WorkspaceIcon itemId={item.id} emoji={item.icon} />
                <div className="text-[10px] text-white/70 leading-tight">
                  {item.label}
                </div>
              </button>
            );
          })}
        </div>

        {station0.workspaceItems.length === 4 && (
          <p className="text-white/50 text-xs text-center mt-4 italic">
            {STATION_0_KIT_DIALOGUE.workspace_response}
          </p>
        )}
      </div>
    );
  }

  // Fallback
  return null;
}
