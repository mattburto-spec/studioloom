# Loominary — Interactive 3D Tutorial System
## Guided Skill Lessons, Safety Training & Visual Instruction

**Date:** April 2026  
**Status:** Concept / Architecture Planning  
**Engine:** React Three Fiber (R3F) + drei  

---

## Core Insight

The 3D engine built for Designville's quest world can serve triple duty: narrative discovery, interactive tutorials, and visual asset creation. This eliminates the need for most traditional instructional media (diagrams, illustrations, annotated photos) except for high-definition video of real-world hand skills.

---

## Three Tutorial Modes

### Mode A: Guided Skill Tutorial

**What:** Step-by-step interactive lessons where students perform actions in 3D. Camera guides attention, instructions overlay the scene, validation gates each step.

**Already prototyped:** Caliper measurement tutorial (12 steps, 3 measurements, Rosa reacts).

**Best for:**
- Measurement and dimensioning (calipers, rulers, protractors)
- Tool identification and selection
- Material properties and selection
- Assembly and disassembly (exploded views)
- Sketching techniques (isometric, orthographic projection)
- Circuit/electronics connections (micro:bit, Arduino)
- Digital fabrication setup (3D printer, laser cutter workflows)
- Design Cycle navigation (understanding each phase)

**Step schema:**
```json
{
  "id": "step_03",
  "instruction": "Connect the VCC wire to the 3V pin",
  "subtext": "The red wire carries power from the micro:bit to the sensor",
  "action": "click",
  "target": "wire_vcc",
  "highlight": "pin_3v",
  "validation": "wire_connected",
  "camPos": [2, 3, 2],
  "camLook": [0, 0.5, 0],
  "hint": "The 3V pin is the second from the right",
  "measurement": null,
  "dialogue": null
}
```

**Key features:**
- Camera lerps between positions per step (cinematic guidance)
- Highlight rings pulse on interactive targets
- Validation prevents skipping (must perform action)
- Results accumulate (measurements, connections, identifications)
- NPC can react at key moments (Rosa, Mr. Okafor, etc.)
- XP and badge awarded on completion
- Data integrates into student's StudioLoom project

---

### Mode B: Safety Scene (Hazard Identification)

**What:** A 3D workshop/lab scene with deliberately placed hazards. Students explore the scene and click to identify each hazard. Scored on how many they find, how quickly, and whether they can explain the risk.

**Best for:**
- Workshop safety (machinery, sharp tools, PPE)
- Lab safety (chemicals, electrical, fire)
- Kitchen/food safety (cross-contamination, temperature, hygiene)
- Ergonomic assessment (workstation setup)
- Site assessment for design projects

**How it works:**
1. Scene loads with a set number of hidden hazards (e.g., 8 hazards in a workshop)
2. Student explores freely — walks around or orbits the camera
3. When they spot a hazard, they tap it
4. A card appears: "What's the hazard?" with multiple choice or free text
5. If correct: hazard highlights green, explanation shown, points awarded
6. Timer optional for competitive/gamified version
7. Final score shows found/total with explanations for missed hazards

**Hazard examples in a workshop scene:**
- Frayed power cable on the bench
- Safety goggles left on the table (not on face)
- Soldering iron left on without holder
- Loose wood shavings near heat source
- Fire extinguisher blocked by boxes
- No first aid kit visible
- Wet floor near electrical equipment
- Open container of adhesive without ventilation

**Scene schema:**
```json
{
  "title": "Workshop Safety Check",
  "scene": "workshop",
  "lighting": "afternoon",
  "timeLimit": 120,
  "hazards": [
    {
      "id": "h1",
      "type": "electrical",
      "object": "frayed_cable",
      "position": [2, 0.9, -1],
      "description": "Frayed power cable — risk of electric shock",
      "severity": "high",
      "fix": "Replace the cable immediately and unplug the tool"
    }
  ]
}
```

**Gamification:**
- Score: found/total hazards
- Time bonus for speed
- Streak bonus for consecutive correct identifications
- "Safety Inspector" badge for perfect score
- Leaderboard per class (opt-in)
- Rosa says "You spotted the fire risk before anyone else!" (NPC reaction)

---

### Mode C: Visual Step Diagram (Static Renders)

**What:** The 3D engine renders a sequence of annotated images showing a physical process step-by-step. Not interactive — the output is a series of clear, consistent, annotated visuals. Like a LEGO instruction manual, but generated from 3D scenes.

**Best for:**
- Electronics connections (micro:bit, Arduino, Raspberry Pi)
- Assembly instructions for prototypes
- Tool setup procedures
- Material preparation steps
- Sewing/textile construction sequences
- Packaging/folding instructions

**Why this replaces traditional media:**
- Consistent angle and lighting across all steps
- Annotations are programmatic (arrows, labels, highlights)
- Can regenerate for different components (swap micro:bit for Arduino)
- No photography needed
- Always matches the art style of the platform
- Can be made interactive later by converting to Mode A

**Output formats:**
- Rendered as a scrollable card sequence in the lesson page
- Exportable as PNG/PDF for printing
- Convertible to interactive tutorial (Mode A) by adding click actions

---

## What This System Replaces

| Traditional Asset | Replaced By | Exception |
|-------------------|-------------|-----------|
| Annotated photos of tools | Mode C: 3D rendered diagrams | — |
| Safety worksheets | Mode B: Interactive hazard scene | — |
| "How to use X" handouts | Mode A: Guided tutorial | — |
| Circuit diagrams (static) | Mode C: Step-by-step 3D wiring | — |
| Process flowcharts | Mode A: Walk-through Design Cycle | — |
| Product exploded views | Mode A/C: Interactive disassembly | — |
| Measurement exercises | Mode A: Tool-based tutorials | — |
| Workshop safety videos | Mode B: Hazard identification | Real machine operation still needs video |
| Hand skill demonstrations | **NOT REPLACED** | Video required: soldering, cutting, sewing, sketching |

**The only content that still needs video:** real-world hand skills where physical nuance (pressure, speed, angle, material feel) cannot be conveyed in 3D.

---

## Content Authoring Pipeline

### Teacher-authored (via Discovery Builder)
- Select tutorial type (A, B, or C)
- Choose scene and props from asset library
- Write step instructions
- Set camera positions (preset angles or custom)
- Define interactive targets and validation
- Preview and publish

### AI-generated (via Claude API)
- Teacher provides: "Teach students to connect a PIR sensor to micro:bit"
- Claude generates: step array with instructions, camera angles, highlight targets, and annotations
- Teacher reviews, adjusts, publishes
- Claude can also generate hazard placements for safety scenes

### Community-shared
- Teachers can publish tutorials to a shared library
- Other teachers can fork and modify
- Rating and usage stats surface the best content
- Loominary curates a "starter pack" of essential tutorials per subject

---

## Technical Architecture

```
/lib/tutorials/
├── TutorialEngine.tsx        ← Core renderer (handles all 3 modes)
├── StepManager.ts            ← Step progression, validation, scoring
├── CameraDirector.ts         ← Lerp camera between step positions
├── HighlightSystem.ts        ← Pulse rings, arrows, labels
├── AnnotationOverlay.tsx     ← React overlay for instructions/results
├── HazardDetector.ts         ← Click detection for safety mode
├── DiagramRenderer.ts        ← Static render pipeline for Mode C
├── schemas/
│   ├── tutorial.schema.ts    ← TypeScript types for step arrays
│   ├── safety.schema.ts      ← Hazard scene definition
│   └── diagram.schema.ts     ← Static diagram sequence
└── presets/
    ├── electronics/          ← micro:bit, Arduino, Raspberry Pi
    ├── measurement/          ← Caliper, ruler, protractor tutorials
    ├── safety/               ← Workshop, lab, kitchen hazard scenes
    └── design-cycle/         ← Phase walkthroughs
```

---

## Integration with StudioLoom

- Tutorials appear as lesson content alongside text, video, and assignments
- Completion data flows to the student's progress record
- Measurements from tutorials auto-populate design specifications
- Safety certifications unlock access to workshop tools in the quest world
- Tutorial XP contributes to belt level progression
- Teachers assign tutorials as required prereqs before hands-on work

---

## Implementation Priority

1. **Mode C (Visual Diagrams)** — highest leverage. Replaces the most existing content with the least interactivity to build. A scrollable card sequence with 3D renders.
2. **Mode A (Guided Tutorials)** — the flagship interactive experience. Start with measurement and electronics.
3. **Mode B (Safety Scenes)** — high value for schools. Workshop safety is a universal need. Start with one scene, 8 hazards.

---

## Open Questions

- Should Mode C renders be generated at build time (static images) or runtime (live 3D)?
- How do we handle tutorials for tools/components not yet in the asset library?
- Should safety scenes have a free-explore mode before the timed assessment?
- Can we auto-generate camera positions from object placement, or must they be hand-tuned?
- Should tutorials be replayable for practice, or one-and-done for assessment?
