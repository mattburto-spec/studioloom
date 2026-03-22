"use client";

import { useState, useCallback } from "react";
import type { SpotTheHazardBlock } from "@/lib/safety/content-blocks";

// ============================================================================
// SVG Workshop Scene Illustrations (IKEA-style clean line art)
// ============================================================================

function WoodworkScene() {
  return (
    <svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Floor */}
      <rect x="0" y="480" width="1000" height="120" fill="#e8e0d4" />
      <line x1="0" y1="480" x2="1000" y2="480" stroke="#c4b8a8" strokeWidth="2" />

      {/* Back wall */}
      <rect x="0" y="0" width="1000" height="480" fill="#f5f0e8" />

      {/* Window */}
      <rect x="380" y="30" width="240" height="160" fill="#d4e8f0" stroke="#8a7e6e" strokeWidth="3" rx="2" />
      <line x1="500" y1="30" x2="500" y2="190" stroke="#8a7e6e" strokeWidth="2" />
      <line x1="380" y1="110" x2="620" y2="110" stroke="#8a7e6e" strokeWidth="2" />

      {/* Safety sign (partially obscured) */}
      <rect x="310" y="80" width="50" height="60" fill="#FFD700" stroke="#333" strokeWidth="2" rx="3" />
      <text x="335" y="105" textAnchor="middle" fontSize="10" fill="#333" fontWeight="bold">⚠</text>
      <text x="335" y="120" textAnchor="middle" fontSize="7" fill="#333">SAFETY</text>
      <text x="335" y="130" textAnchor="middle" fontSize="7" fill="#333">RULES</text>
      {/* Jacket hanging over sign */}
      <path d="M 300 75 Q 335 65 370 75 L 365 120 Q 335 115 305 120 Z" fill="#5a7a9a" opacity="0.7" />

      {/* Bandsaw (left side) */}
      <rect x="50" y="280" width="100" height="200" fill="#888" stroke="#555" strokeWidth="2" rx="4" />
      <rect x="60" y="240" width="80" height="40" fill="#999" stroke="#555" strokeWidth="2" rx="2" />
      <rect x="85" y="200" width="30" height="45" fill="#aaa" stroke="#555" strokeWidth="2" />
      <line x1="100" y1="210" x2="100" y2="380" stroke="#333" strokeWidth="2" strokeDasharray="4,2" />
      {/* Bandsaw table */}
      <rect x="40" y="370" width="120" height="8" fill="#777" stroke="#555" strokeWidth="1.5" />

      {/* Student at bandsaw (no safety glasses, loose hoodie) */}
      <circle cx="130" cy="310" r="22" fill="#f0d0a0" stroke="#333" strokeWidth="1.5" /> {/* head */}
      <rect x="110" y="332" width="40" height="70" fill="#4a6fa5" rx="4" /> {/* hoodie body */}
      {/* Hoodie strings dangling */}
      <path d="M 120 340 L 115 380 M 140 340 L 145 380" stroke="#fff" strokeWidth="2" fill="none" />
      {/* No glasses - bare eyes */}
      <circle cx="123" cy="307" r="3" fill="#333" />
      <circle cx="137" cy="307" r="3" fill="#333" />
      {/* Arms reaching to bandsaw */}
      <line x1="110" y1="350" x2="85" y2="370" stroke="#f0d0a0" strokeWidth="8" strokeLinecap="round" />
      <line x1="150" y1="350" x2="120" y2="375" stroke="#f0d0a0" strokeWidth="8" strokeLinecap="round" />

      {/* Dust extraction hose (disconnected) */}
      <path d="M 200 180 Q 220 200 240 200 L 260 210" stroke="#666" strokeWidth="10" fill="none" strokeLinecap="round" />
      <circle cx="260" cy="210" r="8" fill="none" stroke="#666" strokeWidth="2" /> {/* open end */}
      <text x="270" y="200" fontSize="8" fill="#999" fontStyle="italic">disconnected</text>

      {/* Sawdust pile on floor */}
      <ellipse cx="340" cy="520" rx="50" ry="15" fill="#d4b896" opacity="0.8" />
      <ellipse cx="355" cy="515" rx="30" ry="8" fill="#c4a876" opacity="0.6" />

      {/* Table saw (center) */}
      <rect x="400" y="300" width="160" height="180" fill="#777" stroke="#555" strokeWidth="2" rx="4" />
      <rect x="390" y="290" width="180" height="14" fill="#999" stroke="#555" strokeWidth="1.5" rx="2" />
      {/* Blade visible (guard removed!) */}
      <circle cx="480" cy="296" r="35" fill="none" stroke="#c44" strokeWidth="2" strokeDasharray="3,3" />
      <line x1="480" y1="264" x2="480" y2="296" stroke="#c44" strokeWidth="3" />

      {/* Drink on workbench (right side) */}
      <rect x="610" y="340" width="120" height="130" fill="#b08040" stroke="#8a6020" strokeWidth="2" rx="2" />
      <rect x="600" y="330" width="140" height="14" fill="#c09050" stroke="#8a6020" strokeWidth="1.5" />
      {/* Water bottle */}
      <rect x="648" y="310" width="20" height="30" fill="#80c0e0" stroke="#4090b0" strokeWidth="1.5" rx="3" />
      <rect x="652" y="304" width="12" height="8" fill="#4090b0" rx="2" />

      {/* Chisel on bench edge */}
      <rect x="730" y="342" width="60" height="6" fill="#c09050" stroke="#8a6020" strokeWidth="1" />
      <polygon points="790,345 800,342 800,348" fill="#bbb" stroke="#888" strokeWidth="1" />

      {/* Fire exit (back right, blocked) */}
      <rect x="880" y="200" width="80" height="130" fill="#4a8a4a" stroke="#333" strokeWidth="2" rx="2" />
      <text x="920" y="250" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="bold">FIRE</text>
      <text x="920" y="265" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="bold">EXIT</text>
      <text x="920" y="285" textAnchor="middle" fontSize="20" fill="#fff">↑</text>
      {/* Materials blocking exit */}
      <rect x="885" y="300" width="35" height="50" fill="#d4a060" stroke="#a07030" strokeWidth="1.5" />
      <rect x="895" y="280" width="30" height="25" fill="#c09050" stroke="#a07030" strokeWidth="1.5" />
      <rect x="925" y="310" width="25" height="40" fill="#b08040" stroke="#a07030" strokeWidth="1.5" />

      {/* Extension cord across floor */}
      <path d="M 460 510 Q 520 530 580 510 Q 640 490 700 510" stroke="#ff8c00" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* Floor tiles/lines */}
      <line x1="200" y1="480" x2="200" y2="600" stroke="#d4c8b4" strokeWidth="1" opacity="0.5" />
      <line x1="400" y1="480" x2="400" y2="600" stroke="#d4c8b4" strokeWidth="1" opacity="0.5" />
      <line x1="600" y1="480" x2="600" y2="600" stroke="#d4c8b4" strokeWidth="1" opacity="0.5" />
      <line x1="800" y1="480" x2="800" y2="600" stroke="#d4c8b4" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function MetalworkScene() {
  return (
    <svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Floor */}
      <rect x="0" y="480" width="1000" height="120" fill="#d0d0d0" />
      <line x1="0" y1="480" x2="1000" y2="480" stroke="#aaa" strokeWidth="2" />

      {/* Back wall */}
      <rect x="0" y="0" width="1000" height="480" fill="#e8e8e8" />

      {/* Bench grinder (left) */}
      <rect x="60" y="350" width="100" height="130" fill="#666" stroke="#444" strokeWidth="2" rx="3" />
      <circle cx="110" cy="330" r="30" fill="#888" stroke="#444" strokeWidth="2" />
      <circle cx="110" cy="330" r="20" fill="#999" stroke="#555" strokeWidth="1.5" />
      {/* Student at grinder (glasses but no face shield) */}
      <circle cx="170" cy="300" r="22" fill="#d4a878" stroke="#333" strokeWidth="1.5" />
      <rect x="152" y="295" width="36" height="10" fill="rgba(200,230,255,0.6)" stroke="#4090b0" strokeWidth="1" rx="4" /> {/* glasses only */}
      <rect x="150" y="322" width="40" height="65" fill="#3a5a2a" rx="4" />
      {/* Sparks */}
      <circle cx="85" cy="315" r="2" fill="#ff6" />
      <circle cx="78" cy="322" r="1.5" fill="#ff8" />
      <circle cx="92" cy="308" r="2" fill="#ffa" />
      <circle cx="75" cy="328" r="1" fill="#ff6" />

      {/* E-stop with toolbox on it */}
      <rect x="195" y="55" width="30" height="30" fill="#e22" stroke="#a00" strokeWidth="2" rx="15" />
      <text x="210" y="75" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">E-STOP</text>
      {/* Toolbox covering it */}
      <rect x="188" y="45" width="44" height="28" fill="#2a4a8a" stroke="#1a3060" strokeWidth="1.5" rx="2" />
      <line x1="188" y1="55" x2="232" y2="55" stroke="#1a3060" strokeWidth="1" />

      {/* Lathe (center-left) */}
      <rect x="250" y="300" width="130" height="150" fill="#777" stroke="#555" strokeWidth="2" rx="3" />
      <rect x="240" y="290" width="150" height="14" fill="#999" stroke="#555" strokeWidth="1.5" />
      <circle cx="290" cy="340" r="25" fill="#888" stroke="#555" strokeWidth="2" />
      <rect x="315" y="330" width="60" height="20" fill="#aaa" stroke="#666" strokeWidth="1.5" />
      {/* Gloves next to lathe! */}
      <path d="M 290 365 Q 295 380 305 385 L 310 375 L 315 385 L 320 375 L 325 385 L 330 370 Q 325 355 310 355 Z" fill="#c4a040" stroke="#a08020" strokeWidth="1.5" />

      {/* Cutting fluid spill */}
      <ellipse cx="370" cy="180" rx="35" ry="12" fill="#a0c8a0" opacity="0.5" />

      {/* Hot metal on floor */}
      <rect x="450" y="490" width="30" height="8" fill="#888" stroke="#666" strokeWidth="1" />
      <rect x="500" y="500" width="25" height="6" fill="#999" stroke="#666" strokeWidth="1" />
      <rect x="470" y="510" width="35" height="7" fill="#888" stroke="#666" strokeWidth="1" />
      {/* Heat shimmer lines */}
      <path d="M 465 485 Q 468 478 470 485" stroke="#f80" strokeWidth="1" fill="none" opacity="0.6" />
      <path d="M 490 488 Q 493 480 496 488" stroke="#f80" strokeWidth="1" fill="none" opacity="0.6" />

      {/* Fire extinguisher (blocked) */}
      <rect x="545" y="90" width="22" height="45" fill="#e22" stroke="#a00" strokeWidth="1.5" rx="4" />
      <rect x="550" y="82" width="12" height="12" fill="#333" rx="2" />
      {/* Equipment blocking it */}
      <rect x="530" y="115" width="50" height="40" fill="#777" stroke="#555" strokeWidth="1.5" />

      {/* Pillar drill (right-center, missing guard) */}
      <rect x="650" y="250" width="80" height="200" fill="#888" stroke="#555" strokeWidth="2" rx="3" />
      <rect x="660" y="200" width="60" height="55" fill="#999" stroke="#555" strokeWidth="2" rx="2" />
      <rect x="680" y="180" width="20" height="25" fill="#aaa" stroke="#666" strokeWidth="1.5" />
      {/* Chuck visible (no guard) */}
      <circle cx="690" cy="250" r="12" fill="#777" stroke="#444" strokeWidth="2" />
      <text x="720" y="248" fontSize="7" fill="#c44" fontStyle="italic">no guard</text>

      {/* Student with compressed air */}
      <circle cx="870" cy="340" r="22" fill="#d4a878" stroke="#333" strokeWidth="1.5" />
      <rect x="850" y="362" width="40" height="70" fill="#4a4a8a" rx="4" />
      {/* Air gun */}
      <line x1="850" y1="380" x2="820" y2="365" stroke="#666" strokeWidth="4" strokeLinecap="round" />
      {/* Air blast lines */}
      <path d="M 820 365 L 800 358 M 820 365 L 800 365 M 820 365 L 800 372" stroke="#8cf" strokeWidth="1.5" fill="none" />
      {/* Pointing at shirt */}
      <path d="M 800 365 Q 790 365 785 370" stroke="#8cf" strokeWidth="1" fill="none" />

      {/* Swarf on vice */}
      <rect x="30" y="480" width="80" height="40" fill="#888" stroke="#555" strokeWidth="2" />
      <rect x="40" y="470" width="60" height="14" fill="#999" stroke="#666" strokeWidth="1.5" />
      {/* Curly swarf */}
      <path d="M 55 468 Q 60 460 65 468 Q 70 476 75 468" stroke="#aaa" strokeWidth="2" fill="none" />
      <path d="M 45 465 Q 50 455 55 465" stroke="#bbb" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function GeneralScene() {
  return (
    <svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Floor */}
      <rect x="0" y="480" width="1000" height="120" fill="#e4ddd0" />
      <line x1="0" y1="480" x2="1000" y2="480" stroke="#c8bca8" strokeWidth="2" />

      {/* Back wall */}
      <rect x="0" y="0" width="1000" height="480" fill="#f0ece4" />

      {/* First aid sign (but kit missing) */}
      <rect x="390" y="60" width="50" height="50" fill="#fff" stroke="#2a8a2a" strokeWidth="3" rx="3" />
      <text x="415" y="95" textAnchor="middle" fontSize="30" fill="#2a8a2a" fontWeight="bold">+</text>
      {/* Empty mount below sign */}
      <rect x="395" y="115" width="40" height="5" fill="#999" stroke="#777" strokeWidth="1" />

      {/* Student with heat gun + phone */}
      <circle cx="120" cy="320" r="22" fill="#d4a878" stroke="#333" strokeWidth="1.5" />
      <rect x="100" y="342" width="40" height="70" fill="#c04040" rx="4" />
      {/* Phone in left hand */}
      <rect x="80" y="345" width="16" height="28" fill="#222" stroke="#111" strokeWidth="1" rx="3" />
      <rect x="82" y="348" width="12" height="22" fill="#4488cc" rx="1" />
      {/* Heat gun in right hand */}
      <rect x="145" y="360" width="35" height="18" fill="#e8a020" stroke="#c08010" strokeWidth="1.5" rx="3" />
      <rect x="178" y="364" width="12" height="10" fill="#444" rx="1" />
      {/* Heat waves */}
      <path d="M 192 364 Q 198 358 204 364 M 196 360 Q 202 354 208 360" stroke="#f60" strokeWidth="1.5" fill="none" opacity="0.6" />

      {/* Spray adhesive area */}
      <rect x="270" y="300" width="100" height="160" fill="#b08040" stroke="#8a6020" strokeWidth="2" rx="2" />
      <rect x="260" y="290" width="120" height="14" fill="#c09050" stroke="#8a6020" strokeWidth="1.5" />
      {/* Spray can */}
      <rect x="310" y="260" width="18" height="35" fill="#3a8a3a" stroke="#2a6a2a" strokeWidth="1.5" rx="4" />
      <circle cx="319" cy="258" r="4" fill="#2a6a2a" />
      {/* Spray cloud */}
      <ellipse cx="325" cy="280" rx="25" ry="15" fill="#e8e8a0" opacity="0.3" />
      <ellipse cx="330" cy="275" rx="20" ry="12" fill="#e8e8a0" opacity="0.2" />

      {/* Overcrowded area (center) */}
      <rect x="460" y="380" width="140" height="100" fill="#b08040" stroke="#8a6020" strokeWidth="2" rx="2" />
      <rect x="450" y="370" width="160" height="14" fill="#c09050" stroke="#8a6020" strokeWidth="1.5" />
      {/* Multiple students packed together */}
      <circle cx="490" cy="410" r="16" fill="#f0d0a0" stroke="#333" strokeWidth="1" />
      <circle cx="520" cy="405" r="16" fill="#d4a878" stroke="#333" strokeWidth="1" />
      <circle cx="550" cy="412" r="16" fill="#e8c090" stroke="#333" strokeWidth="1" />
      <circle cx="575" cy="408" r="16" fill="#f0d0a0" stroke="#333" strokeWidth="1" />
      {/* Sharp tools between them */}
      <line x1="505" y1="430" x2="505" y2="450" stroke="#999" strokeWidth="2" />
      <line x1="535" y1="430" x2="535" y2="455" stroke="#999" strokeWidth="2" />

      {/* Soldering iron (right, unattended) */}
      <rect x="700" y="250" width="100" height="130" fill="#b08040" stroke="#8a6020" strokeWidth="2" rx="2" />
      <rect x="690" y="240" width="120" height="14" fill="#c09050" stroke="#8a6020" strokeWidth="1.5" />
      {/* Soldering iron on bench (no stand) */}
      <rect x="720" y="235" width="50" height="5" fill="#666" stroke="#444" strokeWidth="1" rx="1" />
      <rect x="770" y="233" width="15" height="9" fill="#e8a020" rx="2" />
      {/* Heat glow */}
      <circle cx="717" cy="237" r="4" fill="#f60" opacity="0.4" />

      {/* School bag on floor */}
      <rect x="600" y="490" width="40" height="45" fill="#3a4a8a" stroke="#2a3a6a" strokeWidth="1.5" rx="4" />
      <path d="M 608 490 Q 620 480 632 490" stroke="#2a3a6a" strokeWidth="3" fill="none" />

      {/* Overloaded power board */}
      <rect x="845" y="310" width="60" height="12" fill="#fff" stroke="#999" strokeWidth="1.5" rx="2" />
      {/* Multiple plugs */}
      <rect x="850" y="295" width="10" height="18" fill="#666" stroke="#444" strokeWidth="1" rx="1" />
      <rect x="865" y="295" width="10" height="18" fill="#666" stroke="#444" strokeWidth="1" rx="1" />
      <rect x="880" y="295" width="10" height="18" fill="#666" stroke="#444" strokeWidth="1" rx="1" />
      <rect x="895" y="295" width="10" height="18" fill="#666" stroke="#444" strokeWidth="1" rx="1" />
      {/* Daisy chain adapter */}
      <rect x="845" y="325" width="30" height="8" fill="#fff" stroke="#999" strokeWidth="1" rx="1" />
      <path d="M 860 333 L 860 350 L 840 350" stroke="#f80" strokeWidth="3" fill="none" />

      {/* Student cutting toward hand */}
      <circle cx="210" cy="200" r="18" fill="#d4a878" stroke="#333" strokeWidth="1.5" />
      <rect x="193" y="218" width="34" height="55" fill="#5a5a8a" rx="4" />
      {/* Hands and knife */}
      <ellipse cx="190" cy="260" rx="8" ry="5" fill="#d4a878" stroke="#333" strokeWidth="1" /> {/* holding hand */}
      <line x1="220" y1="255" x2="195" y2="262" stroke="#999" strokeWidth="2" strokeLinecap="round" /> {/* knife cutting toward hand */}
      <polygon points="195,262 188,260 188,264" fill="#bbb" />
    </svg>
  );
}

// Scene component map
const SCENE_COMPONENTS: Record<string, React.FC> = {
  "woodwork-01": WoodworkScene,
  "metalwork-01": MetalworkScene,
  "general-01": GeneralScene,
};

// ============================================================================
// Severity colors
// ============================================================================

const SEVERITY_COLORS = {
  critical: { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B", badge: "#DC2626" },
  warning: { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E", badge: "#D97706" },
  minor: { bg: "#E0E7FF", border: "#6366F1", text: "#3730A3", badge: "#4F46E5" },
};

// ============================================================================
// Main Component
// ============================================================================

interface SpotTheHazardProps {
  block: SpotTheHazardBlock;
  onComplete?: (found: number, total: number) => void;
}

export default function SpotTheHazard({ block, onComplete }: SpotTheHazardProps) {
  const [foundIds, setFoundIds] = useState<Set<string>>(new Set());
  const [lastWrong, setLastWrong] = useState<{ x: number; y: number } | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [showAllHazards, setShowAllHazards] = useState(false);

  const SceneComponent = SCENE_COMPONENTS[block.scene_id];

  const handleSceneClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isComplete) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;

      // Check if click is within any hazard zone
      const hit = block.hazards.find(
        (h) =>
          !foundIds.has(h.id) &&
          xPct >= h.zone.x &&
          xPct <= h.zone.x + h.zone.width &&
          yPct >= h.zone.y &&
          yPct <= h.zone.y + h.zone.height
      );

      if (hit) {
        const newFound = new Set(foundIds);
        newFound.add(hit.id);
        setFoundIds(newFound);
        setSelectedHazard(hit.id);
        setLastWrong(null);

        if (newFound.size >= block.total_hazards) {
          setIsComplete(true);
          setShowAllHazards(true);
          onComplete?.(newFound.size, block.total_hazards);
        }
      } else {
        // Wrong click
        setLastWrong({ x: xPct, y: yPct });
        setSelectedHazard(null);
        setTimeout(() => setLastWrong(null), 800);
      }
    },
    [block.hazards, block.total_hazards, foundIds, isComplete, onComplete]
  );

  const foundCount = foundIds.size;
  const passedThreshold = foundCount >= block.pass_threshold;

  return (
    <div style={{ background: "#1a1a2e", borderRadius: "16px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {block.title}
          </h3>
          <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>
            Tap or click on areas where you see a safety hazard
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Found counter */}
          <div
            style={{
              background: passedThreshold ? "#059669" : "#334155",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: 600,
              transition: "background 0.3s",
            }}
          >
            {foundCount} / {block.total_hazards}
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ padding: "0 24px 12px", display: "flex", gap: "4px" }}>
        {block.hazards.map((h) => (
          <div
            key={h.id}
            style={{
              flex: 1,
              height: "4px",
              borderRadius: "2px",
              background: foundIds.has(h.id)
                ? SEVERITY_COLORS[h.severity].badge
                : "#334155",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* Scene */}
      <div
        style={{
          position: "relative",
          cursor: isComplete ? "default" : "crosshair",
          margin: "0 16px",
          borderRadius: "8px",
          overflow: "hidden",
          border: "2px solid #334155",
        }}
        onClick={handleSceneClick}
      >
        {SceneComponent ? <SceneComponent /> : (
          <div style={{ height: "400px", background: "#e8e0d4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#888" }}>Scene not found: {block.scene_id}</p>
          </div>
        )}

        {/* Found hazard markers */}
        {block.hazards.map((h) =>
          foundIds.has(h.id) || showAllHazards ? (
            <div
              key={h.id}
              style={{
                position: "absolute",
                left: `${h.zone.x}%`,
                top: `${h.zone.y}%`,
                width: `${h.zone.width}%`,
                height: `${h.zone.height}%`,
                border: `2px solid ${SEVERITY_COLORS[h.severity].badge}`,
                borderRadius: "6px",
                background: `${SEVERITY_COLORS[h.severity].badge}20`,
                transition: "all 0.3s ease-out",
                cursor: "pointer",
                animation: foundIds.has(h.id) && !showAllHazards ? "hazardPulse 0.5s ease-out" : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedHazard(selectedHazard === h.id ? null : h.id);
              }}
            >
              {/* Severity icon */}
              <div
                style={{
                  position: "absolute",
                  top: "-10px",
                  right: "-10px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: SEVERITY_COLORS[h.severity].badge,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                {h.severity === "critical" ? "!" : h.severity === "warning" ? "⚠" : "i"}
              </div>
            </div>
          ) : null
        )}

        {/* Wrong click flash */}
        {lastWrong && (
          <div
            style={{
              position: "absolute",
              left: `${lastWrong.x - 2}%`,
              top: `${lastWrong.y - 2}%`,
              width: "4%",
              height: "4%",
              borderRadius: "50%",
              border: "2px solid #ef4444",
              animation: "wrongFlash 0.8s ease-out forwards",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Selected hazard detail */}
      {selectedHazard && (
        <div style={{ padding: "16px 24px" }}>
          {(() => {
            const h = block.hazards.find((hz) => hz.id === selectedHazard);
            if (!h) return null;
            const colors = SEVERITY_COLORS[h.severity];
            return (
              <div
                style={{
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  borderRadius: "10px",
                  padding: "14px 16px",
                  animation: "slideIn 0.3s ease-out",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      background: colors.badge,
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {h.severity}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: colors.text }}>
                    {h.label}
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: colors.text, margin: "0 0 6px", lineHeight: 1.5 }}>
                  {h.explanation}
                </p>
                {h.rule_reference && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: colors.text,
                      opacity: 0.7,
                      margin: 0,
                      fontStyle: "italic",
                    }}
                  >
                    {h.rule_reference}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Completion state */}
      {isComplete && (
        <div style={{ padding: "16px 24px 20px", textAlign: "center" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #059669, #10b981)",
              borderRadius: "12px",
              padding: "20px",
              color: "#fff",
            }}
          >
            <p style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>
              All {block.total_hazards} hazards found!
            </p>
            <p style={{ fontSize: "13px", opacity: 0.9, margin: 0 }}>
              Tap any highlighted area to review the explanation.
            </p>
          </div>
        </div>
      )}

      {/* "I'm done" button when threshold met but not all found */}
      {!isComplete && passedThreshold && (
        <div style={{ padding: "12px 24px 20px", textAlign: "center" }}>
          <button
            onClick={() => {
              setIsComplete(true);
              setShowAllHazards(true);
              onComplete?.(foundCount, block.total_hazards);
            }}
            style={{
              background: "#059669",
              color: "#fff",
              border: "none",
              padding: "10px 24px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Show all hazards ({block.total_hazards - foundCount} remaining)
          </button>
          <p style={{ color: "#64748b", fontSize: "12px", marginTop: "6px" }}>
            You found enough to pass! Keep looking or reveal the rest.
          </p>
        </div>
      )}

      {/* Hint when stuck */}
      {!isComplete && foundCount > 0 && foundCount < block.pass_threshold && (
        <div style={{ padding: "8px 24px 16px" }}>
          <p style={{ color: "#64748b", fontSize: "12px", margin: 0, textAlign: "center" }}>
            Found {foundCount} — need {block.pass_threshold} to pass. Look at the floor, exits, and PPE.
          </p>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes hazardPulse {
          0% { transform: scale(1.2); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wrongFlash {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(2); }
        }
        @keyframes slideIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
