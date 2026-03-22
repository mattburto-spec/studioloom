/**
 * Pre-built Spot the Hazard scenes.
 * Each scene defines hazard zones as percentage coordinates (0-100)
 * so they scale to any screen size.
 *
 * Scenes use inline SVG rendered by the SpotTheHazard component.
 * Illustration style: IKEA-manual clean line art.
 */

import type { SpotTheHazardBlock } from "./content-blocks";

// ============================================================================
// Woodworking Workshop Scene
// ============================================================================

export const WOODWORK_SCENE: SpotTheHazardBlock = {
  type: "spot_the_hazard",
  id: "scene-woodwork-01",
  title: "Spot the hazards in this woodworking workshop",
  scene_id: "woodwork-01",
  scene_type: "wood",
  total_hazards: 10,
  pass_threshold: 7,
  hazards: [
    {
      id: "w1",
      zone: { x: 8, y: 48, width: 14, height: 22 },
      severity: "critical",
      label: "No eye protection",
      explanation:
        "The student at the bandsaw is not wearing safety glasses. Flying wood chips and dust can cause serious eye injuries. Safety glasses must be worn whenever operating any power tool.",
      rule_reference: "PPE Rule #1: Eye protection mandatory with all power tools",
    },
    {
      id: "w2",
      zone: { x: 5, y: 68, width: 12, height: 14 },
      severity: "critical",
      label: "Loose clothing near bandsaw",
      explanation:
        "The student's hoodie strings are dangling near the bandsaw blade. Loose clothing, jewellery, and untied hair can get caught in rotating machinery and cause serious entanglement injuries.",
      rule_reference: "PPE Rule #3: Secure loose clothing, tie back hair, remove jewellery",
    },
    {
      id: "w3",
      zone: { x: 30, y: 72, width: 12, height: 18 },
      severity: "warning",
      label: "Sawdust on floor",
      explanation:
        "Sawdust has accumulated on the floor and not been swept up. This is a slip hazard and a fire risk. Workshop floors should be kept clean and clear at all times.",
      rule_reference: "Housekeeping Rule #1: Clean as you go",
    },
    {
      id: "w4",
      zone: { x: 42, y: 38, width: 16, height: 20 },
      severity: "critical",
      label: "Blade guard removed",
      explanation:
        "The table saw has its blade guard removed. Blade guards prevent accidental contact with the blade and reduce the risk of kickback. Never operate a table saw without the guard in place.",
      rule_reference: "Machine Safety Rule #2: Never remove safety guards",
    },
    {
      id: "w5",
      zone: { x: 62, y: 60, width: 10, height: 12 },
      severity: "warning",
      label: "Drink on workbench",
      explanation:
        "A water bottle is sitting on the workbench near electrical equipment. Liquids near power tools risk electrical shock and can damage equipment. All food and drinks should be kept in the designated break area.",
      rule_reference: "Workshop Rule #5: No food or drinks at workstations",
    },
    {
      id: "w6",
      zone: { x: 75, y: 54, width: 12, height: 24 },
      severity: "minor",
      label: "Chisel left on bench edge",
      explanation:
        "A sharp chisel is sitting on the edge of the workbench with the blade facing outward. It could fall and injure someone's foot or cut someone walking past. Sharp tools should be placed flat with blades facing away.",
      rule_reference: "Hand Tool Rule #1: Store sharp tools safely",
    },
    {
      id: "w7",
      zone: { x: 88, y: 30, width: 10, height: 20 },
      severity: "critical",
      label: "Fire exit blocked",
      explanation:
        "Materials are stacked in front of the emergency exit door. Fire exits must be kept clear at all times — in an emergency, seconds count. This is a serious fire safety violation.",
      rule_reference: "Emergency Rule #1: Never block fire exits",
    },
    {
      id: "w8",
      zone: { x: 22, y: 25, width: 10, height: 15 },
      severity: "warning",
      label: "Dust extraction not connected",
      explanation:
        "The dust extraction hose is disconnected from the machine. Fine wood dust is a respiratory hazard and long-term exposure can cause serious lung conditions. Always connect dust extraction before operating machinery.",
      rule_reference: "PPE Rule #4: Use dust extraction with all cutting operations",
    },
    {
      id: "w9",
      zone: { x: 50, y: 82, width: 14, height: 12 },
      severity: "warning",
      label: "Extension cord across walkway",
      explanation:
        "An extension cord runs across the main walkway creating a trip hazard. Cables should be routed along walls or covered with cable protectors when crossing walkways.",
      rule_reference: "Housekeeping Rule #3: Keep walkways clear",
    },
    {
      id: "w10",
      zone: { x: 33, y: 15, width: 8, height: 10 },
      severity: "minor",
      label: "Safety sign obscured",
      explanation:
        "A jacket is hanging over the machine safety instructions sign. Safety signs must be visible at all times so anyone using the machine can reference the rules.",
      rule_reference: "Workshop Rule #8: Keep safety signs visible",
    },
  ],
};

// ============================================================================
// Metalwork Workshop Scene
// ============================================================================

export const METALWORK_SCENE: SpotTheHazardBlock = {
  type: "spot_the_hazard",
  id: "scene-metalwork-01",
  title: "Spot the hazards in this metalworking workshop",
  scene_id: "metalwork-01",
  scene_type: "metal",
  total_hazards: 9,
  pass_threshold: 6,
  hazards: [
    {
      id: "m1",
      zone: { x: 10, y: 45, width: 14, height: 22 },
      severity: "critical",
      label: "No face shield at grinder",
      explanation:
        "The student using the bench grinder has safety glasses but no face shield. Grinding operations throw hot metal particles at high speed — a full face shield is required in addition to safety glasses.",
      rule_reference: "PPE Rule #2: Face shield required for grinding operations",
    },
    {
      id: "m2",
      zone: { x: 28, y: 50, width: 10, height: 20 },
      severity: "critical",
      label: "Gloves near lathe",
      explanation:
        "Gloves are lying next to the metalworking lathe. NEVER wear gloves when operating a lathe — they can catch on the rotating workpiece and pull your hand in. This is one of the most dangerous workshop mistakes.",
      rule_reference: "Machine Safety Rule #5: No gloves near rotating machinery",
    },
    {
      id: "m3",
      zone: { x: 45, y: 70, width: 16, height: 16 },
      severity: "critical",
      label: "Hot metal on floor",
      explanation:
        "Freshly cut metal pieces have been left on the floor without marking. Hot metal looks identical to cold metal and can cause serious burns. Hot work areas must be clearly marked and pieces placed on designated cooling racks.",
      rule_reference: "Hot Work Rule #1: Mark and isolate hot materials",
    },
    {
      id: "m4",
      zone: { x: 68, y: 35, width: 12, height: 18 },
      severity: "warning",
      label: "Missing machine guard",
      explanation:
        "The pillar drill is missing its chuck guard. The rotating chuck can catch clothing, hair, or skin. Guards must be in place before operation.",
      rule_reference: "Machine Safety Rule #2: Never remove safety guards",
    },
    {
      id: "m5",
      zone: { x: 82, y: 55, width: 14, height: 20 },
      severity: "warning",
      label: "Compressed air pointed at person",
      explanation:
        "A student is using compressed air to blow metal filings off their clothes. Compressed air can drive particles into skin and eyes, and high pressure directed at the body can cause air embolism. Use a brush instead.",
      rule_reference: "Compressed Air Rule #1: Never direct at people",
    },
    {
      id: "m6",
      zone: { x: 55, y: 15, width: 10, height: 12 },
      severity: "warning",
      label: "Fire extinguisher blocked",
      explanation:
        "Equipment is stored in front of the fire extinguisher, making it inaccessible in an emergency. Fire safety equipment must have clear access at all times.",
      rule_reference: "Emergency Rule #2: Keep fire equipment accessible",
    },
    {
      id: "m7",
      zone: { x: 5, y: 78, width: 12, height: 14 },
      severity: "minor",
      label: "Swarf in vice",
      explanation:
        "Metal swarf (curly metal shavings) is left in and around the vice. Swarf has razor-sharp edges and can cause cuts when handling workpieces. Brush swarf away with a swarf brush, never bare hands.",
      rule_reference: "Hand Safety Rule #2: Use swarf brush, not fingers",
    },
    {
      id: "m8",
      zone: { x: 35, y: 25, width: 10, height: 12 },
      severity: "minor",
      label: "Cutting fluid spill",
      explanation:
        "Cutting fluid has spilled on the workbench and floor. Cutting fluid is slippery and some types are skin irritants. Spills should be cleaned immediately with absorbent pads.",
      rule_reference: "Housekeeping Rule #2: Clean spills immediately",
    },
    {
      id: "m9",
      zone: { x: 20, y: 10, width: 8, height: 8 },
      severity: "critical",
      label: "Emergency stop button obstructed",
      explanation:
        "A tool box is placed on top of the lathe's emergency stop button. E-stops must be immediately accessible at all times — they're designed to be hit quickly in a crisis. Never place anything on or near an e-stop.",
      rule_reference: "Emergency Rule #3: E-stops must be accessible",
    },
  ],
};

// ============================================================================
// General Workshop Scene
// ============================================================================

export const GENERAL_SCENE: SpotTheHazardBlock = {
  type: "spot_the_hazard",
  id: "scene-general-01",
  title: "Spot the hazards in this design workshop",
  scene_id: "general-01",
  scene_type: "general",
  total_hazards: 8,
  pass_threshold: 6,
  hazards: [
    {
      id: "g1",
      zone: { x: 8, y: 50, width: 14, height: 24 },
      severity: "critical",
      label: "Using phone while operating heat gun",
      explanation:
        "A student is looking at their phone while using a heat gun. Heat guns reach temperatures of 500°C+ and require full attention. Distraction near any heat source risks burns to yourself and others.",
      rule_reference: "Workshop Rule #1: Full attention when using any tool",
    },
    {
      id: "g2",
      zone: { x: 30, y: 40, width: 12, height: 18 },
      severity: "warning",
      label: "Spray adhesive used without ventilation",
      explanation:
        "Spray adhesive is being used at a regular workbench instead of in the spray booth or near an extraction fan. Adhesive fumes are toxic when inhaled. All spray products must be used with adequate ventilation.",
      rule_reference: "Chemical Safety Rule #1: Use spray products in ventilated areas only",
    },
    {
      id: "g3",
      zone: { x: 48, y: 65, width: 18, height: 18 },
      severity: "warning",
      label: "Overcrowded workstation",
      explanation:
        "Too many students are working in a small area with sharp tools. Overcrowding increases the risk of accidental contact with someone else's tools or hot materials. Maintain safe working distances.",
      rule_reference: "Workshop Rule #3: Maintain safe working distances",
    },
    {
      id: "g4",
      zone: { x: 72, y: 30, width: 12, height: 16 },
      severity: "critical",
      label: "Soldering iron left on unattended",
      explanation:
        "A soldering iron is left switched on and unattended on the bench without being in its stand. The tip reaches 350°C+ and can cause burns or start a fire if it rolls off the bench.",
      rule_reference: "Hot Work Rule #2: Always use stands, never leave unattended",
    },
    {
      id: "g5",
      zone: { x: 60, y: 78, width: 14, height: 14 },
      severity: "minor",
      label: "Bag on floor in walkway",
      explanation:
        "A school bag is left on the floor in the main walkway. This is a trip hazard, especially for anyone carrying materials or tools. Bags must go on hooks or in designated storage.",
      rule_reference: "Housekeeping Rule #4: Personal items in designated areas",
    },
    {
      id: "g6",
      zone: { x: 85, y: 42, width: 12, height: 20 },
      severity: "warning",
      label: "Overloaded power board",
      explanation:
        "Multiple devices are plugged into a single power board via a daisy chain of adapters. This is an electrical fire hazard. Each power board should be plugged directly into a wall socket, never into another power board.",
      rule_reference: "Electrical Safety Rule #1: No daisy-chaining power boards",
    },
    {
      id: "g7",
      zone: { x: 40, y: 12, width: 10, height: 10 },
      severity: "minor",
      label: "First aid kit not visible",
      explanation:
        "The first aid kit sign is present but the kit itself is missing from its wall mount. First aid supplies must be accessible and clearly visible. Report missing kits to the teacher immediately.",
      rule_reference: "Emergency Rule #4: Know your first aid kit location",
    },
    {
      id: "g8",
      zone: { x: 18, y: 28, width: 10, height: 14 },
      severity: "critical",
      label: "Cutting toward hand",
      explanation:
        "A student is using a craft knife cutting toward their holding hand. Always cut away from your body and away from your other hand. Use a cutting mat and safety ruler.",
      rule_reference: "Hand Tool Rule #3: Always cut away from yourself",
    },
  ],
};

// ============================================================================
// Scene Registry
// ============================================================================

export const SCENES: Record<string, SpotTheHazardBlock> = {
  "woodwork-01": WOODWORK_SCENE,
  "metalwork-01": METALWORK_SCENE,
  "general-01": GENERAL_SCENE,
};

export const SCENE_LIST = [
  { id: "woodwork-01", name: "Woodworking Workshop", type: "wood" as const, hazardCount: 10 },
  { id: "metalwork-01", name: "Metalworking Workshop", type: "metal" as const, hazardCount: 9 },
  { id: "general-01", name: "General Design Workshop", type: "general" as const, hazardCount: 8 },
];
