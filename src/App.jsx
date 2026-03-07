import { useState, useEffect, useRef, useCallback } from "react";

// ─── FONTS ───
const FONTS_CSS = `@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Silkscreen:wght@400;700&display=swap');`;

// ─── THEME ───
const T = {
  bg: "#0a0e1a", bgCard: "#121a2e", bgCardHover: "#1a2440", surface: "#1e2a45",
  border: "#2a3558", text: "#e8ecf4", textMuted: "#7b88a8", textDim: "#4a5670",
  accent: "#6366f1", accentGlow: "rgba(99,102,241,0.25)",
  criterionA: "#f59e0b", criterionB: "#10b981", criterionC: "#6366f1", criterionD: "#ec4899",
  xpBar: "#22d3ee", danger: "#ef4444", success: "#10b981",
  gold: "#fbbf24", mapGreen: "#166534", mapPath: "#a3845b",
  mapWater: "#1e3a5f", mapGrass: "#1a3a2a",
};

// ─── MYP DATA ───
const CRITERIA = [
  { id: "A", name: "Inquiring & Analysing", color: T.criterionA, icon: "🔍", terrain: "forest",
    steps: [
      { id: "a1", name: "Research the Problem", desc: "Explain and justify the need for a solution", summative: false },
      { id: "a2", name: "Develop Design Brief", desc: "Construct a research plan and design brief", summative: false },
      { id: "a3", name: "Analyse Existing Products", desc: "Analyse existing products that inspire", summative: true },
      { id: "a4", name: "Write Specification", desc: "Develop a detailed design specification", summative: true },
    ]},
  { id: "B", name: "Developing Ideas", color: T.criterionB, icon: "💡", terrain: "plains",
    steps: [
      { id: "b1", name: "Generate Ideas", desc: "Develop a range of feasible design ideas", summative: false },
      { id: "b2", name: "Evaluate & Select", desc: "Present ideas against the specification", summative: true },
      { id: "b3", name: "Develop Chosen Design", desc: "Create detailed planning drawings", summative: true },
      { id: "b4", name: "Plan for Creation", desc: "Create a plan to produce the solution", summative: false },
    ]},
  { id: "C", name: "Creating the Solution", color: T.criterionC, icon: "🛠️", terrain: "mountain",
    steps: [
      { id: "c1", name: "Follow the Plan", desc: "Construct a logical plan with resources", summative: false },
      { id: "c2", name: "Build & Document", desc: "Show excellent technical skills", summative: false },
      { id: "c3", name: "Justify Changes", desc: "Explain changes made to design", summative: true },
      { id: "c4", name: "Final Product", desc: "Present the final solution", summative: true },
    ]},
  { id: "D", name: "Evaluating", color: T.criterionD, icon: "⭐", terrain: "castle",
    steps: [
      { id: "d1", name: "Testing Methods", desc: "Design testing methods to evaluate", summative: false },
      { id: "d2", name: "Evaluate vs Spec", desc: "Evaluate against the specification", summative: true },
      { id: "d3", name: "Future Improvements", desc: "Explain how it could be improved", summative: true },
      { id: "d4", name: "Impact Assessment", desc: "Evaluate the impact on community", summative: true },
    ]},
];

const DOJO_SKILLS = [
  { id: "cad", name: "CAD Mastery", icon: "📐", color: "#6366f1", levels: 5, current: 3,
    desc: "Tinkercad, Fusion 360, Onshape",
    modules: ["Basic Shapes", "Combine & Cut", "Precise Dimensions", "Complex Forms", "Assemblies"] },
  { id: "workshop", name: "Workshop Tools", icon: "🔨", color: "#f59e0b", levels: 5, current: 2,
    desc: "Hand tools, power tools, safety",
    modules: ["Tool Safety", "Measuring & Marking", "Cutting Techniques", "Joining Methods", "Finishing"] },
  { id: "coding", name: "Coding", icon: "💻", color: "#10b981", levels: 5, current: 1,
    desc: "Arduino, micro:bit, Python",
    modules: ["Variables & Loops", "Inputs & Outputs", "Sensors", "Serial & Data", "IoT Projects"] },
  { id: "electronics", name: "Electronics", icon: "⚡", color: "#ec4899", levels: 5, current: 0,
    desc: "Circuits, soldering, components",
    modules: ["Basic Circuits", "LEDs & Resistors", "Soldering", "Sensors & Motors", "PCB Design"] },
  { id: "laser", name: "Laser & 3D Print", icon: "🖨️", color: "#22d3ee", levels: 4, current: 2,
    desc: "Laser cutter, FDM, resin printing",
    modules: ["File Prep", "Material Settings", "Print Optimization", "Post Processing"] },
  { id: "graphic", name: "Graphic Design", icon: "🎨", color: "#a855f7", levels: 4, current: 4,
    desc: "Canva, Illustrator, layout principles",
    modules: ["Typography", "Color Theory", "Layout & Composition", "Brand Identity"] },
];

const MOCK_CLASSES = [
  { code: "DESIGN-7B", name: "Grade 7B Design", students: 8, unit: "Sustainable Packaging" },
  { code: "DESIGN-8A", name: "Grade 8A Design", students: 12, unit: "Smart Home Device" },
  { code: "DESIGN-9C", name: "Grade 9C Design", students: 10, unit: "Community App" },
];

const MOCK_STUDENTS = [
  { name: "Lily W.", avatar: "🧑‍🎨", progress: 62, currentStep: "b2", needsHelp: false, xp: 1450, skills: ["cad","graphic"], work: { notes: "Strong analysis. Ideas need more variety.", lastActive: "2 hours ago" }},
  { name: "Marcus T.", avatar: "🤖", progress: 45, currentStep: "a4", needsHelp: true, xp: 980, skills: ["coding"], work: { notes: "Stuck on specification. Needs scaffolding.", lastActive: "1 day ago" }},
  { name: "Aiko S.", avatar: "🦊", progress: 78, currentStep: "c1", needsHelp: false, xp: 1820, skills: ["cad","workshop","laser"], work: { notes: "Excellent progress. Very independent.", lastActive: "30 min ago" }},
  { name: "Oliver K.", avatar: "🚀", progress: 35, currentStep: "a3", needsHelp: true, xp: 720, skills: ["graphic"], work: { notes: "Analysis is surface-level. Needs prompting.", lastActive: "3 hours ago" }},
  { name: "Priya M.", avatar: "👩‍💻", progress: 88, currentStep: "c3", needsHelp: false, xp: 2100, skills: ["coding","electronics","cad"], work: { notes: "Outstanding. Ready for extension tasks.", lastActive: "15 min ago" }},
  { name: "Tomás R.", avatar: "🎮", progress: 52, currentStep: "b1", needsHelp: false, xp: 1200, skills: ["workshop","cad"], work: { notes: "Creative ideas but needs to link to spec.", lastActive: "1 hour ago" }},
  { name: "Sophie L.", avatar: "🦉", progress: 28, currentStep: "a2", needsHelp: true, xp: 580, skills: [], work: { notes: "Behind schedule. Absent 3 days last week.", lastActive: "2 days ago" }},
  { name: "Jin H.", avatar: "⚡", progress: 71, currentStep: "b4", needsHelp: false, xp: 1650, skills: ["laser","graphic","workshop"], work: { notes: "Good planning. Detailed Gantt chart.", lastActive: "45 min ago" }},
];

const UNIT_LIBRARY = [
  { name: "Sustainable Packaging", grade: "7-8", criteria: ["A","B","C","D"], shared: true, author: "You" },
  { name: "Smart Home Device", grade: "8-9", criteria: ["A","B","C"], shared: false, author: "You" },
  { name: "Community App Design", grade: "9-10", criteria: ["A","B","C","D"], shared: true, author: "Ms. Chen" },
  { name: "Wearable Tech", grade: "8-9", criteria: ["A","B","C","D"], shared: true, author: "Mr. Patel" },
  { name: "Flat-Pack Furniture", grade: "9-10", criteria: ["B","C","D"], shared: true, author: "Ms. Johansson" },
];

// ─── HELPERS ───
function GlowOrb({ color, size = 200, top, left, right, bottom, opacity = 0.08 }) {
  return <div style={{ position: "absolute", top, left, right, bottom, width: size, height: size,
    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    opacity, borderRadius: "50%", pointerEvents: "none", filter: "blur(40px)" }} />;
}

function getStepCriterion(stepId) {
  for (const c of CRITERIA) { if (c.steps.find(s => s.id === stepId)) return c; }
  return CRITERIA[0];
}
function getStepName(stepId) {
  for (const c of CRITERIA) { const s = c.steps.find(s => s.id === stepId); if (s) return s.name; }
  return "";
}

// ═══════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("student");
  const [f1, setF1] = useState("");
  const [f2, setF2] = useState("");

  const go = () => { if (f1 && f2) onLogin(mode); };

  const inputStyle = (focus) => ({
    width: "100%", padding: "14px 16px", background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 12, color: T.text, fontSize: 15, fontFamily: mode === "student" && !focus ? "'JetBrains Mono', monospace" : "'Nunito', sans-serif",
    outline: "none", marginBottom: 16, boxSizing: "border-box", letterSpacing: mode === "student" ? 1.5 : 0,
  });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "'Nunito', sans-serif", position: "relative", overflow: "hidden" }}>
      <GlowOrb color={T.criterionA} size={400} top="-100px" left="-100px" opacity={0.12} />
      <GlowOrb color={T.criterionC} size={350} bottom="-80px" right="-80px" opacity={0.1} />
      <div style={{ background: T.bgCard, borderRadius: 24, padding: "48px 40px", width: 420,
        border: `1px solid ${T.border}`, position: "relative", zIndex: 1, boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 4 }}>🎨</div>
          <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 36, color: T.text, margin: 0, fontWeight: 700 }}>
            Quest<span style={{ color: T.accent }}>erra</span>
          </h1>
          <p style={{ color: T.textMuted, margin: "6px 0 0", fontSize: 14, fontFamily: "'Silkscreen', cursive" }}>MYP Design Adventure</p>
        </div>
        <div style={{ display: "flex", background: T.surface, borderRadius: 12, padding: 4, marginBottom: 28 }}>
          {["student", "teacher"].map(m => (
            <button key={m} onClick={() => { setMode(m); setF1(""); setF2(""); }} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
              fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14,
              background: mode === m ? T.accent : "transparent", color: mode === m ? "#fff" : T.textMuted,
            }}>{m === "student" ? "🎒 Student" : "📋 Teacher"}</button>
          ))}
        </div>
        <label style={{ color: T.textMuted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
          {mode === "student" ? "CLASS CODE" : "EMAIL"}
        </label>
        <input value={f1} onChange={e => setF1(mode === "student" ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={mode === "student" ? "e.g. DESIGN-7B" : "teacher@nis.edu.cn"}
          style={inputStyle(false)} />
        <label style={{ color: T.textMuted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
          {mode === "student" ? "YOUR NAME" : "PASSWORD"}
        </label>
        <input value={f2} onChange={e => setF2(e.target.value)}
          placeholder={mode === "student" ? "e.g. Tomás R." : "••••••••"}
          type={mode === "teacher" ? "password" : "text"} style={inputStyle(true)} />
        <button onClick={go} style={{
          width: "100%", padding: "16px", marginTop: 8,
          background: mode === "student" ? `linear-gradient(135deg, ${T.accent}, #818cf8)` : `linear-gradient(135deg, ${T.criterionB}, #34d399)`,
          border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 700,
          fontFamily: "'Fredoka'", cursor: "pointer", boxShadow: `0 4px 20px ${mode === "student" ? T.accentGlow : "rgba(16,185,129,0.3)"}`,
        }}>{mode === "student" ? "Start Your Quest →" : "Open Dashboard →"}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ZELDA-STYLE MAP
// ═══════════════════════════════════════════
function ZeldaMap({ activeStep, onStepClick, enabledCriteria }) {
  const allSteps = CRITERIA.filter(c => enabledCriteria.includes(c.id)).flatMap(c => c.steps.map(s => ({ ...s, criterion: c })));
  const activeIdx = allSteps.findIndex(s => s.id === activeStep);

  // Map layout - winding path positions for each step
  const mapPositions = [
    // Criterion A - Forest zone (left)
    { x: 8, y: 75, zone: "A" }, { x: 20, y: 60, zone: "A" }, { x: 12, y: 42, zone: "A" }, { x: 24, y: 26, zone: "A" },
    // Criterion B - Plains zone (center-left)
    { x: 38, y: 18, zone: "B" }, { x: 48, y: 32, zone: "B" }, { x: 40, y: 48, zone: "B" }, { x: 52, y: 60, zone: "B" },
    // Criterion C - Mountain zone (center-right)
    { x: 62, y: 48, zone: "C" }, { x: 72, y: 35, zone: "C" }, { x: 65, y: 20, zone: "C" }, { x: 78, y: 14, zone: "C" },
    // Criterion D - Castle zone (right)
    { x: 82, y: 30, zone: "D" }, { x: 90, y: 45, zone: "D" }, { x: 84, y: 62, zone: "D" }, { x: 92, y: 76, zone: "D" },
  ];

  const activePositions = mapPositions.slice(0, allSteps.length);

  const terrainElements = [
    // Forest trees (zone A)
    ...Array.from({length: 12}, (_, i) => ({ type: "tree", x: Math.random() * 30, y: Math.random() * 90, size: 14 + Math.random() * 10 })),
    // Plains flowers (zone B)
    ...Array.from({length: 8}, (_, i) => ({ type: "flower", x: 32 + Math.random() * 25, y: Math.random() * 80, size: 10 })),
    // Mountains (zone C)
    ...Array.from({length: 6}, (_, i) => ({ type: "mountain", x: 58 + Math.random() * 22, y: 5 + Math.random() * 60, size: 16 + Math.random() * 10 })),
    // Castle elements (zone D)
    { type: "castle", x: 88, y: 72, size: 28 },
  ];

  return (
    <div style={{
      position: "relative", width: "100%", height: 480, borderRadius: 20, overflow: "hidden",
      background: `linear-gradient(135deg, ${T.mapGrass} 0%, #152420 30%, #1a2a20 50%, #1c2535 70%, #1a1a30 100%)`,
      border: `2px solid ${T.border}`,
      boxShadow: "inset 0 0 60px rgba(0,0,0,0.4)",
    }}>
      {/* Grid overlay for retro feel */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      }} />

      {/* Terrain decorations */}
      {terrainElements.map((el, i) => (
        <div key={`t-${i}`} style={{
          position: "absolute", left: `${el.x}%`, top: `${el.y}%`, fontSize: el.size,
          opacity: 0.35, pointerEvents: "none", filter: "saturate(0.7)",
          transform: "translate(-50%, -50%)",
        }}>
          {el.type === "tree" ? "🌲" : el.type === "flower" ? "🌿" : el.type === "mountain" ? "⛰️" : "🏰"}
        </div>
      ))}

      {/* Zone labels */}
      {CRITERIA.filter(c => enabledCriteria.includes(c.id)).map((c, ci) => {
        const zones = [
          { x: 15, y: 8 }, { x: 44, y: 72 }, { x: 68, y: 8 }, { x: 87, y: 88 },
        ];
        const z = zones[ci] || zones[0];
        return (
          <div key={`zone-${c.id}`} style={{
            position: "absolute", left: `${z.x}%`, top: `${z.y}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: "'Silkscreen', cursive", fontSize: 10, fontWeight: 700,
            color: c.color, opacity: 0.7, letterSpacing: 1,
            textShadow: `0 0 10px ${c.color}60`,
            padding: "4px 10px", background: "rgba(0,0,0,0.4)", borderRadius: 6,
          }}>
            {c.icon} {c.name.toUpperCase()}
          </div>
        );
      })}

      {/* Path lines connecting steps */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        {activePositions.slice(0, -1).map((pos, i) => {
          const next = activePositions[i + 1];
          const isCompleted = i < activeIdx;
          const stepData = allSteps[i];
          return (
            <line key={`path-${i}`}
              x1={`${pos.x + 2}%`} y1={`${pos.y}%`}
              x2={`${next.x + 2}%`} y2={`${next.y}%`}
              stroke={isCompleted ? stepData.criterion.color : T.mapPath}
              strokeWidth={isCompleted ? 3 : 2}
              strokeDasharray={isCompleted ? "none" : "6 4"}
              opacity={isCompleted ? 0.7 : 0.3}
            />
          );
        })}
      </svg>

      {/* Step nodes */}
      {allSteps.map((step, i) => {
        const pos = activePositions[i];
        if (!pos) return null;
        const isActive = step.id === activeStep;
        const isCompleted = i < activeIdx;
        const isLocked = i > activeIdx;
        const nodeSize = isActive ? 52 : 42;

        return (
          <div key={step.id}
            onClick={() => !isLocked && onStepClick(step.id)}
            style={{
              position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`,
              transform: `translate(-50%, -50%) ${isActive ? "scale(1.1)" : "scale(1)"}`,
              width: nodeSize, height: nodeSize, borderRadius: "50%",
              background: isCompleted ? step.criterion.color : isActive ? T.surface : "rgba(20,25,40,0.9)",
              border: `3px solid ${isActive ? step.criterion.color : isCompleted ? step.criterion.color : T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isLocked ? "not-allowed" : "pointer",
              opacity: isLocked ? 0.35 : 1,
              boxShadow: isActive ? `0 0 25px ${step.criterion.color}60, 0 0 50px ${step.criterion.color}20` : isCompleted ? `0 0 12px ${step.criterion.color}30` : "none",
              transition: "all 0.3s ease",
              zIndex: isActive ? 5 : 2,
            }}
          >
            <span style={{ fontSize: isActive ? 22 : 18 }}>
              {isCompleted ? "✅" : isLocked ? "🔒" : step.criterion.icon}
            </span>

            {/* Step label */}
            <div style={{
              position: "absolute", top: "110%", left: "50%", transform: "translateX(-50%)",
              whiteSpace: "nowrap", textAlign: "center", pointerEvents: "none",
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: isActive ? step.criterion.color : T.textMuted,
                fontFamily: "'Silkscreen', cursive",
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                background: "rgba(10,14,26,0.7)", padding: "2px 6px", borderRadius: 4,
              }}>
                {step.name}
              </div>
              {step.summative && (
                <div style={{
                  fontSize: 7, fontWeight: 700, color: T.danger, marginTop: 2,
                  fontFamily: "'Silkscreen', cursive",
                }}>⚔ SUMMATIVE</div>
              )}
            </div>

            {/* Active player indicator */}
            {isActive && (
              <div style={{
                position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)",
                fontSize: 20, animation: "bounce 1s infinite",
              }}>▼</div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════
// DESIGN DOJO
// ═══════════════════════════════════════════
function DesignDojo({ onBack }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          padding: "8px 14px", background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 10, color: T.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "'Nunito'",
        }}>← Back</button>
        <div>
          <h2 style={{ fontFamily: "'Fredoka'", fontSize: 26, color: T.text, margin: 0 }}>
            🥋 Design Dojo
          </h2>
          <p style={{ color: T.textMuted, fontSize: 13, margin: "2px 0 0" }}>Master skills to unlock new abilities</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {DOJO_SKILLS.map(skill => (
          <div key={skill.id} onClick={() => setSelected(selected === skill.id ? null : skill.id)}
            style={{
              background: selected === skill.id ? skill.color + "15" : T.bgCard,
              borderRadius: 18, padding: 20,
              border: `2px solid ${selected === skill.id ? skill.color : T.border}`,
              cursor: "pointer", transition: "all 0.2s",
              boxShadow: selected === skill.id ? `0 0 25px ${skill.color}20` : "none",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, background: skill.color + "20",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                border: `1px solid ${skill.color}40`,
              }}>{skill.icon}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "'Fredoka'" }}>{skill.name}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{skill.desc}</div>
              </div>
            </div>

            {/* Level progress */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {Array.from({ length: skill.levels }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 8, borderRadius: 4,
                  background: i < skill.current ? skill.color : T.surface,
                  boxShadow: i < skill.current ? `0 0 6px ${skill.color}40` : "none",
                  transition: "all 0.3s",
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: skill.color, fontWeight: 700 }}>
              Level {skill.current}/{skill.levels}
              {skill.current === skill.levels && " ✨ MASTERED"}
            </div>

            {/* Expanded module list */}
            {selected === skill.id && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                {skill.modules.map((mod, mi) => (
                  <div key={mi} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                    borderBottom: mi < skill.modules.length - 1 ? `1px solid ${T.border}30` : "none",
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", fontSize: 11,
                      background: mi < skill.current ? skill.color : T.surface,
                      color: mi < skill.current ? "#fff" : T.textDim,
                      display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                      border: `1px solid ${mi < skill.current ? skill.color : T.border}`,
                    }}>{mi < skill.current ? "✓" : mi + 1}</div>
                    <span style={{
                      fontSize: 12, color: mi < skill.current ? T.text : mi === skill.current ? skill.color : T.textDim,
                      fontWeight: mi === skill.current ? 700 : 400,
                    }}>{mod}</span>
                    {mi === skill.current && (
                      <span style={{
                        marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 8px",
                        borderRadius: 6, background: skill.color + "25", color: skill.color,
                      }}>NEXT</span>
                    )}
                  </div>
                ))}
                <button style={{
                  width: "100%", marginTop: 12, padding: "10px", background: skill.color,
                  border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "'Fredoka'",
                }}>
                  {skill.current < skill.levels ? `▶ Start: ${skill.modules[skill.current]}` : "🏆 Review Mastery"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════
function AIChat({ currentStep, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatEnd = useRef(null);
  const tips = {
    a1: "What problem are you solving? Who is affected?",
    a2: "What does your client actually need? Have you asked them?",
    a3: "Compare 3 existing products — what works, what doesn't?",
    a4: "List measurable success criteria for your design.",
    b1: "Try SCAMPER: Substitute, Combine, Adapt, Modify, Put to use, Eliminate, Reverse!",
    b2: "Rate each idea against your specification. Which best meets the need?",
    b3: "Add dimensions, materials, and annotations to your chosen design.",
    b4: "What tools, materials, and time do you need? Build your Gantt chart!",
    c1: "Follow your plan step by step. Document everything!",
    c2: "Take photos as you build. Show your technical skills.",
    c3: "What changed from your plan? Why? Was it an improvement?",
    c4: "Present your final product. Does it meet the specification?",
    d1: "How will you test if your product works? Design fair tests.",
    d2: "Test against each specification point. Use data!",
    d3: "What would you do differently next time?",
    d4: "How does your solution impact your client and community?",
  };

  useEffect(() => {
    setMessages([{ role: "ai", text: tips[currentStep] || "What are you working on? I'm here to help you think, not think for you! 🧠" }]);
  }, [currentStep]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    setMessages(p => [...p, { role: "user", text: input }]);
    setInput(""); setTyping(true);
    setTimeout(() => {
      const responses = [
        "Great thinking! Now, can you push that idea further — what evidence supports it?",
        "Have you considered how your client would feel about that? Try asking them!",
        "That's a solid start. What are the constraints you need to work within?",
        "Nice! Now compare that with what you found in your research. Any patterns?",
        "I like where you're going. Can you sketch that out to make it clearer?",
      ];
      setMessages(p => [...p, { role: "ai", text: responses[Math.floor(Math.random() * responses.length)] }]);
      setTyping(false);
    }, 1000 + Math.random() * 800);
  };

  return (
    <div style={{
      position: "fixed", right: 24, bottom: 24, width: 360, height: 480,
      background: T.bgCard, borderRadius: 20, border: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", zIndex: 100,
      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: `linear-gradient(135deg, ${T.accent}, #818cf8)`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Design Buddy</div>
          <div style={{ fontSize: 10, color: T.success }}>● Guides your thinking</div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: T.textMuted, fontSize: 18, cursor: "pointer",
        }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%",
            padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.5, color: T.text,
            background: m.role === "user" ? T.accent : T.surface,
            borderBottomRightRadius: m.role === "user" ? 4 : 14,
            borderBottomLeftRadius: m.role === "ai" ? 4 : 14,
          }}>{m.text}</div>
        ))}
        {typing && <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: 14,
          background: T.surface, color: T.textMuted, fontSize: 13, borderBottomLeftRadius: 4 }}>
          <span style={{ animation: "pulse 1s infinite" }}>thinking...</span>
        </div>}
        <div ref={chatEnd} />
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask me anything..." style={{
            flex: 1, padding: "10px 14px", background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, color: T.text, fontSize: 13, fontFamily: "'Nunito'", outline: "none",
          }} />
        <button onClick={send} style={{
          padding: "10px 16px", background: T.accent, border: "none", borderRadius: 10,
          color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito'",
        }}>Send</button>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════
// STUDENT DASHBOARD
// ═══════════════════════════════════════════
function StudentDashboard({ onLogout }) {
  const [activeStep, setActiveStep] = useState("b1");
  const [showChat, setShowChat] = useState(false);
  const [view, setView] = useState("quest"); // quest | dojo
  const enabledCriteria = ["A", "B", "C", "D"];
  const progress = 52;
  const xp = 1200;
  const level = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;

  const allSteps = CRITERIA.filter(c => enabledCriteria.includes(c.id)).flatMap(c => c.steps.map(s => ({ ...s, criterion: c })));
  const currentStepData = allSteps.find(s => s.id === activeStep);

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, fontFamily: "'Nunito', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <GlowOrb color={T.accent} size={300} top="-50px" right="20%" opacity={0.05} />

      {/* Top Bar */}
      <div style={{
        padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${T.border}`, background: T.bgCard + "ee",
        backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🎨</span>
          <span style={{ fontFamily: "'Fredoka'", fontSize: 20, color: T.text, fontWeight: 700 }}>
            Quest<span style={{ color: T.accent }}>erra</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Nav tabs */}
          {[
            { key: "quest", label: "🗺️ Quest", active: view === "quest" },
            { key: "dojo", label: "🥋 Dojo", active: view === "dojo" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key)} style={{
              padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              background: tab.active ? T.accent + "25" : "transparent",
              color: tab.active ? T.accent : T.textMuted, fontSize: 13, fontWeight: 700,
              fontFamily: "'Nunito'",
            }}>{tab.label}</button>
          ))}
          <div style={{ width: 1, height: 24, background: T.border, margin: "0 4px" }} />
          <button onClick={() => setShowChat(!showChat)} style={{
            padding: "8px 14px", background: showChat ? T.accent : T.surface,
            border: `1px solid ${showChat ? T.accent : T.border}`, borderRadius: 10,
            color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito'",
          }}>🤖 Buddy</button>
          <button onClick={onLogout} style={{
            padding: "6px 10px", background: "transparent", border: "none",
            color: T.textMuted, fontSize: 16, cursor: "pointer",
          }}>↩</button>
        </div>
      </div>

      {view === "quest" ? (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px" }}>
          {/* Hero Avatar Section */}
          <div style={{
            display: "flex", gap: 20, marginBottom: 24, alignItems: "stretch",
          }}>
            {/* Avatar Card */}
            <div style={{
              background: `linear-gradient(135deg, ${T.bgCard}, ${T.surface})`,
              borderRadius: 20, padding: "24px 28px", width: 240,
              border: `1px solid ${T.border}`, textAlign: "center",
              position: "relative", overflow: "hidden",
            }}>
              <GlowOrb color={T.accent} size={150} top="-30px" left="-30px" opacity={0.15} />
              <div style={{
                fontSize: 80, lineHeight: 1, marginBottom: 8, position: "relative",
                filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
              }}>🎮</div>
              <div style={{
                fontFamily: "'Fredoka'", fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 2,
              }}>Tomás R.</div>
              <div style={{
                fontFamily: "'Silkscreen', cursive", fontSize: 11, color: T.gold,
                marginBottom: 12,
              }}>⚔ LEVEL {level} DESIGNER</div>

              {/* XP Bar */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textMuted, marginBottom: 4 }}>
                  <span>XP</span><span>{xpInLevel}/500</span>
                </div>
                <div style={{ height: 10, background: T.surface, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{
                    width: `${(xpInLevel / 500) * 100}%`, height: "100%", borderRadius: 6,
                    background: `linear-gradient(90deg, ${T.xpBar}, #06b6d4)`,
                    boxShadow: `0 0 10px ${T.xpBar}50`,
                  }} />
                </div>
              </div>

              {/* Skills badges */}
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {DOJO_SKILLS.filter(s => s.current > 0).slice(0, 4).map(s => (
                  <div key={s.id} title={s.name} style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: s.color + "20", border: `1px solid ${s.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  }}>{s.icon}</div>
                ))}
              </div>
            </div>

            {/* Stats & Timeline */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Unit & Progress */}
              <div style={{
                background: T.bgCard, borderRadius: 16, padding: "18px 22px",
                border: `1px solid ${T.border}`, flex: 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 1 }}>CURRENT UNIT</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'Fredoka'" }}>
                      📦 Sustainable Packaging
                    </div>
                  </div>
                  <div style={{
                    fontSize: 32, fontWeight: 800, color: T.criterionB, fontFamily: "'Fredoka'",
                  }}>{progress}%</div>
                </div>
                <div style={{ height: 14, background: T.surface, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{
                    width: `${progress}%`, height: "100%", borderRadius: 8,
                    background: `linear-gradient(90deg, ${T.criterionA}, ${T.criterionB}, ${T.criterionC})`,
                    boxShadow: `0 0 12px ${T.criterionB}40`, transition: "width 0.8s ease",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: T.textMuted }}>
                  <span>🔍 Criterion A</span><span>💡 B</span><span>🛠️ C</span><span>⭐ D</span>
                </div>
              </div>

              {/* Gantt */}
              <div style={{
                background: T.bgCard, borderRadius: 16, padding: "14px 18px",
                border: `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10, fontFamily: "'Fredoka'" }}>
                  📅 Timeline — Week 3 of 8
                </div>
                {CRITERIA.filter(c => enabledCriteria.includes(c.id)).map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", marginBottom: 5, height: 18 }}>
                    <span style={{ width: 20, fontSize: 12 }}>{c.icon}</span>
                    <div style={{ flex: 1, height: "100%", background: T.surface, borderRadius: 4, position: "relative", marginLeft: 6 }}>
                      {(() => {
                        const spans = { A: [0, 2.5], B: [2, 4], C: [3.5, 6.5], D: [6, 8] };
                        const s = spans[c.id];
                        return <div style={{
                          position: "absolute", left: `${(s[0] / 8) * 100}%`,
                          width: `${((s[1] - s[0]) / 8) * 100}%`, height: "100%",
                          background: `linear-gradient(90deg, ${c.color}80, ${c.color}40)`,
                          borderRadius: 4,
                        }} />;
                      })()}
                    </div>
                  </div>
                ))}
                <div style={{ position: "relative", marginLeft: 26, marginTop: 4, height: 1, background: T.border }}>
                  <div style={{
                    position: "absolute", left: `${(2.8 / 8) * 100}%`, top: -6,
                    fontSize: 8, color: T.danger, fontWeight: 700, fontFamily: "'Silkscreen'",
                  }}>▲ NOW</div>
                </div>
              </div>
            </div>
          </div>

          {/* Zelda Map */}
          <div style={{ marginBottom: 20 }}>
            <ZeldaMap activeStep={activeStep} onStepClick={setActiveStep} enabledCriteria={enabledCriteria} />
          </div>

          {/* Active Step Detail */}
          {currentStepData && (
            <div style={{
              background: T.bgCard, borderRadius: 18, border: `2px solid ${currentStepData.criterion.color}30`,
              padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, background: currentStepData.criterion.color + "20",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                  border: `2px solid ${currentStepData.criterion.color}40`,
                }}>{currentStepData.criterion.icon}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'Fredoka'" }}>
                    {currentStepData.name}
                  </div>
                  <div style={{ fontSize: 13, color: currentStepData.criterion.color }}>{currentStepData.desc}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {currentStepData.summative && <>
                  <button style={{ padding: "10px 18px", background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 10, color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito'" }}>
                    📥 Export PDF
                  </button>
                  <button style={{ padding: "10px 18px", background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 10, color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito'" }}>
                    📊 Export PPT
                  </button>
                </>}
                <button style={{
                  padding: "10px 24px", background: currentStepData.criterion.color,
                  border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "'Fredoka'",
                  boxShadow: `0 4px 15px ${currentStepData.criterion.color}40`,
                }}>▶ Start Working</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px" }}>
          <DesignDojo onBack={() => setView("quest")} />
        </div>
      )}

      {showChat && <AIChat currentStep={activeStep} onClose={() => setShowChat(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// UNIT BUILDER (AI-Assisted)
// ═══════════════════════════════════════════
function UnitBuilder({ onClose }) {
  const [mode, setMode] = useState(null); // null | "upload" | "describe" | "building"
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [enabledCriteria, setEnabledCriteria] = useState(["A", "B", "C", "D"]);
  const [unitName, setUnitName] = useState("");
  const [aiThinking, setAiThinking] = useState(false);

  const questions = [
    { key: "topic", q: "What's the design challenge or topic?", placeholder: "e.g. Students design sustainable packaging for a local bakery" },
    { key: "grade", q: "What MYP year group is this for?", placeholder: "e.g. Year 8 (MYP 3)" },
    { key: "weeks", q: "How many weeks will this unit run?", placeholder: "e.g. 8 weeks" },
    { key: "context", q: "What's the global context or statement of inquiry?", placeholder: "e.g. Fairness and development — innovations can have consequences" },
    { key: "tools", q: "What tools/equipment will students use?", placeholder: "e.g. Laser cutter, Tinkercad, cardboard prototyping" },
    { key: "client", q: "Is there a real client or is this hypothetical?", placeholder: "e.g. Local bakery owner Mr. Zhang" },
  ];

  const toggleCriterion = (id) => {
    setEnabledCriteria(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id].sort());
  };

  const nextQuestion = () => {
    if (step < questions.length - 1) setStep(step + 1);
    else {
      setAiThinking(true);
      setTimeout(() => { setAiThinking(false); setMode("building"); }, 2000);
    }
  };

  if (mode === "building") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Fredoka'", fontSize: 22, color: T.text, margin: 0 }}>
            ✨ Unit Generated!
          </h2>
          <button onClick={onClose} style={{
            padding: "8px 16px", background: T.success, border: "none", borderRadius: 10,
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Fredoka'",
          }}>Save & Use Unit</button>
        </div>

        <div style={{
          background: T.surface, borderRadius: 14, padding: 20, marginBottom: 16,
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>UNIT NAME</div>
          <input value={unitName || answers.topic || "Sustainable Packaging Challenge"}
            onChange={e => setUnitName(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 10, color: T.text, fontSize: 16, fontFamily: "'Fredoka'", outline: "none",
              boxSizing: "border-box",
            }} />
        </div>

        {/* Criteria toggles */}
        <div style={{
          background: T.surface, borderRadius: 14, padding: 20, marginBottom: 16,
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
            ACTIVE CRITERIA (toggle on/off)
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {CRITERIA.map(c => (
              <button key={c.id} onClick={() => toggleCriterion(c.id)} style={{
                flex: 1, padding: "14px 12px", borderRadius: 12,
                background: enabledCriteria.includes(c.id) ? c.color + "20" : T.bgCard,
                border: `2px solid ${enabledCriteria.includes(c.id) ? c.color : T.border}`,
                cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                opacity: enabledCriteria.includes(c.id) ? 1 : 0.4,
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{c.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: enabledCriteria.includes(c.id) ? c.color : T.textDim }}>
                  Criterion {c.id}
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{c.name}</div>
                <div style={{
                  marginTop: 8, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                  background: enabledCriteria.includes(c.id) ? c.color + "30" : T.surface,
                  color: enabledCriteria.includes(c.id) ? c.color : T.textDim,
                }}>
                  {enabledCriteria.includes(c.id) ? "ON" : "OFF"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Generated steps preview */}
        {CRITERIA.filter(c => enabledCriteria.includes(c.id)).map(c => (
          <div key={c.id} style={{
            background: T.surface, borderRadius: 14, padding: "14px 18px", marginBottom: 10,
            border: `1px solid ${c.color}30`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: c.color, fontFamily: "'Fredoka'" }}>
                Criterion {c.id}: {c.name}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {c.steps.map(s => (
                <div key={s.id} style={{
                  flex: 1, padding: "10px", background: T.bgCard, borderRadius: 10,
                  border: `1px solid ${T.border}`, fontSize: 11, color: T.text,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>{s.name}</div>
                  <div style={{ color: T.textMuted, fontSize: 10 }}>{s.desc}</div>
                  {s.summative && <div style={{ fontSize: 8, color: T.danger, fontWeight: 700, marginTop: 4 }}>⚔ SUMMATIVE</div>}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={{
            flex: 1, padding: "12px", background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, color: T.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito'",
          }}>📤 Share to Library</button>
          <button style={{
            flex: 1, padding: "12px", background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, color: T.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito'",
          }}>🔄 Regenerate with AI</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onClose} style={{
          padding: "8px 14px", background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 10, color: T.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "'Nunito'",
        }}>← Back</button>
        <h2 style={{ fontFamily: "'Fredoka'", fontSize: 22, color: T.text, margin: 0 }}>
          ✨ Create New Unit
        </h2>
      </div>

      {!mode && (
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={() => setMode("upload")} style={{
            flex: 1, padding: 32, background: T.bgCard, borderRadius: 18,
            border: `2px dashed ${T.border}`, cursor: "pointer", textAlign: "center",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Fredoka'" }}>Upload Existing Unit</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
              Upload a doc, PDF, or slides and AI will convert it into a Questerra unit
            </div>
          </button>
          <button onClick={() => { setMode("describe"); setStep(0); }} style={{
            flex: 1, padding: 32, background: T.bgCard, borderRadius: 18,
            border: `2px dashed ${T.border}`, cursor: "pointer", textAlign: "center",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.criterionB}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Fredoka'" }}>Build with AI</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
              Answer a few questions and AI will generate a complete unit for you
            </div>
          </button>
          <button onClick={() => {}} style={{
            flex: 1, padding: 32, background: T.bgCard, borderRadius: 18,
            border: `2px dashed ${T.border}`, cursor: "pointer", textAlign: "center",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Fredoka'" }}>Browse Library</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
              Pick a community-shared unit and customise it for your class
            </div>
          </button>
        </div>
      )}

      {mode === "upload" && (
        <div style={{
          background: T.bgCard, borderRadius: 18, padding: 40,
          border: `2px dashed ${T.accent}40`, textAlign: "center",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📁</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: "'Fredoka'" }}>
            Drop your unit file here
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
            Supports .docx, .pdf, .pptx, .pages — AI will extract and structure your unit
          </div>
          <button onClick={() => { setAiThinking(true); setTimeout(() => { setAiThinking(false); setMode("building"); }, 2000); }}
            style={{
              padding: "12px 28px", background: T.accent, border: "none", borderRadius: 12,
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Fredoka'",
            }}>
            📎 Choose File (demo)
          </button>
          {aiThinking && (
            <div style={{ marginTop: 20, color: T.accent, fontSize: 14, fontWeight: 600 }}>
              <span style={{ animation: "pulse 1s infinite" }}>🤖 AI is analysing your document...</span>
            </div>
          )}
        </div>
      )}

      {mode === "describe" && !aiThinking && (
        <div style={{ background: T.bgCard, borderRadius: 18, padding: 28, border: `1px solid ${T.border}` }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24, justifyContent: "center" }}>
            {questions.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 24 : 10, height: 10, borderRadius: 6,
                background: i < step ? T.criterionB : i === step ? T.accent : T.surface,
                transition: "all 0.3s",
              }} />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: T.accent + "20",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
            }}>🤖</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4, fontFamily: "'Fredoka'" }}>
                {questions[step].q}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>Question {step + 1} of {questions.length}</div>
            </div>
          </div>

          <textarea
            value={answers[questions[step].key] || ""}
            onChange={e => setAnswers({ ...answers, [questions[step].key]: e.target.value })}
            placeholder={questions[step].placeholder}
            rows={3}
            style={{
              width: "100%", padding: "14px 16px", background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 12, color: T.text, fontSize: 15, fontFamily: "'Nunito'",
              outline: "none", resize: "none", boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0} style={{
              padding: "10px 20px", background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, color: step === 0 ? T.textDim : T.text, fontSize: 13, cursor: step === 0 ? "not-allowed" : "pointer",
              fontFamily: "'Nunito'", fontWeight: 600,
            }}>← Back</button>
            <button onClick={nextQuestion} style={{
              padding: "10px 24px", background: T.accent, border: "none", borderRadius: 10,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Fredoka'",
            }}>
              {step < questions.length - 1 ? "Next →" : "✨ Generate Unit"}
            </button>
          </div>
        </div>
      )}

      {mode === "describe" && aiThinking && (
        <div style={{
          background: T.bgCard, borderRadius: 18, padding: 40, textAlign: "center",
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 1.5s infinite" }}>🤖</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Fredoka'" }}>
            Building your unit...
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
            Generating steps, rubrics, and resources based on your answers
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
    </div>
  );
}


// ═══════════════════════════════════════════
// STUDENT DETAIL (Teacher clicks student)
// ═══════════════════════════════════════════
function StudentDetail({ student, onBack }) {
  const criterion = getStepCriterion(student.currentStep);
  return (
    <div>
      <button onClick={onBack} style={{
        padding: "8px 14px", background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 10, color: T.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "'Nunito'",
        marginBottom: 20,
      }}>← Back to Class</button>

      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        {/* Student Info */}
        <div style={{
          background: T.bgCard, borderRadius: 18, padding: 28, width: 260,
          border: `1px solid ${T.border}`, textAlign: "center",
        }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>{student.avatar}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: "'Fredoka'" }}>{student.name}</div>
          <div style={{ fontSize: 12, color: T.xpBar, fontWeight: 600, marginBottom: 12 }}>⚡ {student.xp} XP</div>

          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
            {student.skills.map(sid => {
              const sk = DOJO_SKILLS.find(s => s.id === sid);
              return sk ? (
                <div key={sid} title={sk.name} style={{
                  width: 36, height: 36, borderRadius: 10, background: sk.color + "20",
                  border: `1px solid ${sk.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>{sk.icon}</div>
              ) : null;
            })}
            {student.skills.length === 0 && <div style={{ fontSize: 12, color: T.textDim }}>No skills earned yet</div>}
          </div>

          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 4 }}>CURRENT STEP</div>
            <div style={{
              padding: "10px 14px", background: criterion.color + "15", borderRadius: 10,
              border: `1px solid ${criterion.color}30`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: criterion.color }}>{criterion.icon} {getStepName(student.currentStep)}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Criterion {criterion.id}</div>
            </div>
          </div>

          <div style={{ textAlign: "left", marginTop: 14 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 4 }}>LAST ACTIVE</div>
            <div style={{ fontSize: 13, color: T.text }}>{student.work.lastActive}</div>
          </div>

          {student.needsHelp && (
            <div style={{
              marginTop: 14, padding: "10px 14px", background: T.danger + "15", borderRadius: 10,
              border: `1px solid ${T.danger}30`, textAlign: "left",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.danger }}>🆘 Flagged for Help</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>Student hasn't made progress in 48+ hours</div>
            </div>
          )}
        </div>

        {/* Progress & Work */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Progress through criteria */}
          <div style={{
            background: T.bgCard, borderRadius: 18, padding: 24, border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16, fontFamily: "'Fredoka'" }}>
              📊 Progress by Criterion
            </div>
            {CRITERIA.map(c => {
              const stepsInC = c.steps.length;
              const allSteps = CRITERIA.flatMap(cr => cr.steps);
              const currentIdx = allSteps.findIndex(s => s.id === student.currentStep);
              const cStartIdx = allSteps.findIndex(s => s.id === c.steps[0].id);
              const completed = Math.max(0, Math.min(stepsInC, currentIdx - cStartIdx));
              const pct = Math.round((completed / stepsInC) * 100);
              return (
                <div key={c.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: c.color }}>
                      {c.icon} Criterion {c.id}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{pct}%</span>
                  </div>
                  <div style={{ height: 10, background: T.surface, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%", borderRadius: 6,
                      background: c.color, transition: "width 0.5s",
                    }} />
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    {c.steps.map((s, si) => {
                      const sIdx = allSteps.findIndex(st => st.id === s.id);
                      const done = sIdx < currentIdx;
                      const active = s.id === student.currentStep;
                      return (
                        <div key={s.id} style={{
                          flex: 1, fontSize: 9, textAlign: "center", padding: "3px 0",
                          color: done ? c.color : active ? T.text : T.textDim,
                          fontWeight: active ? 700 : 400,
                          background: active ? c.color + "20" : "transparent", borderRadius: 4,
                        }}>
                          {done ? "✓" : ""} {s.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Teacher Notes */}
          <div style={{
            background: T.bgCard, borderRadius: 18, padding: 24, border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12, fontFamily: "'Fredoka'" }}>
              📝 Teacher Notes
            </div>
            <textarea defaultValue={student.work.notes} rows={3} style={{
              width: "100%", padding: "12px 14px", background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, color: T.text, fontSize: 13, fontFamily: "'Nunito'",
              outline: "none", resize: "vertical", boxSizing: "border-box",
            }} />
            <button style={{
              marginTop: 10, padding: "8px 18px", background: T.accent, border: "none",
              borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Nunito'",
            }}>Save Notes</button>
          </div>

          {/* Submitted Work */}
          <div style={{
            background: T.bgCard, borderRadius: 18, padding: 24, border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12, fontFamily: "'Fredoka'" }}>
              📂 Submitted Work
            </div>
            {[
              { name: "Research Report - Criterion A", date: "Feb 12", type: "PDF" },
              { name: "Product Analysis Table", date: "Feb 18", type: "PDF" },
            ].map((w, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: T.surface, borderRadius: 10, marginBottom: 6,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{w.date} · {w.type}</div>
                </div>
                <button style={{
                  padding: "6px 14px", background: T.bgCard, border: `1px solid ${T.border}`,
                  borderRadius: 8, color: T.text, fontSize: 12, cursor: "pointer", fontFamily: "'Nunito'",
                }}>View</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
// TEACHER DASHBOARD
// ═══════════════════════════════════════════
function TeacherDashboard({ onLogout }) {
  const [currentClass, setCurrentClass] = useState(MOCK_CLASSES[0]);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [view, setView] = useState("overview"); // overview | unitBuilder | studentDetail | library
  const [selectedStudent, setSelectedStudent] = useState(null);

  const needsHelpCount = MOCK_STUDENTS.filter(s => s.needsHelp).length;
  const avgProgress = Math.round(MOCK_STUDENTS.reduce((a, s) => a + s.progress, 0) / MOCK_STUDENTS.length);

  if (view === "unitBuilder") return (
    <TeacherShell currentClass={currentClass} onClassChange={(c) => { setCurrentClass(c); setShowClassPicker(false); }}
      showClassPicker={showClassPicker} setShowClassPicker={setShowClassPicker} onLogout={onLogout}>
      <UnitBuilder onClose={() => setView("overview")} />
    </TeacherShell>
  );

  if (view === "studentDetail" && selectedStudent !== null) return (
    <TeacherShell currentClass={currentClass} onClassChange={(c) => { setCurrentClass(c); setShowClassPicker(false); }}
      showClassPicker={showClassPicker} setShowClassPicker={setShowClassPicker} onLogout={onLogout}>
      <StudentDetail student={MOCK_STUDENTS[selectedStudent]} onBack={() => { setView("overview"); setSelectedStudent(null); }} />
    </TeacherShell>
  );

  if (view === "library") return (
    <TeacherShell currentClass={currentClass} onClassChange={(c) => { setCurrentClass(c); setShowClassPicker(false); }}
      showClassPicker={showClassPicker} setShowClassPicker={setShowClassPicker} onLogout={onLogout}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => setView("overview")} style={{
            padding: "8px 14px", background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, color: T.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "'Nunito'",
          }}>← Back</button>
          <h2 style={{ fontFamily: "'Fredoka'", fontSize: 22, color: T.text, margin: 0 }}>📚 Unit Library</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {UNIT_LIBRARY.map((unit, i) => (
            <div key={i} style={{
              background: T.bgCard, borderRadius: 14, padding: "18px 22px",
              border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{unit.name}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                  {unit.grade} · by {unit.author} · Criteria: {unit.criteria.join(", ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {unit.shared && <span style={{ fontSize: 10, color: T.criterionB, fontWeight: 700, background: T.criterionB + "20", padding: "3px 8px", borderRadius: 6 }}>SHARED</span>}
                <button style={{
                  padding: "8px 16px", background: T.accent, border: "none", borderRadius: 8,
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito'",
                }}>Use</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TeacherShell>
  );

  return (
    <TeacherShell currentClass={currentClass} onClassChange={(c) => { setCurrentClass(c); setShowClassPicker(false); }}
      showClassPicker={showClassPicker} setShowClassPicker={setShowClassPicker} onLogout={onLogout}>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setView("unitBuilder")} style={{
          padding: "12px 22px", background: `linear-gradient(135deg, ${T.accent}, #818cf8)`,
          border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "'Fredoka'",
          boxShadow: `0 4px 15px ${T.accentGlow}`,
        }}>✨ Create New Unit</button>
        <button onClick={() => setView("library")} style={{
          padding: "12px 22px", background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, color: T.text, fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: "'Nunito'",
        }}>📚 Unit Library</button>
      </div>

      {/* Overview Cards */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        {[
          { label: "STUDENTS", value: MOCK_STUDENTS.length, color: T.text },
          { label: "AVG PROGRESS", value: `${avgProgress}%`, color: T.criterionB },
          { label: "NEED HELP", value: needsHelpCount, color: needsHelpCount > 0 ? T.danger : T.text,
            bg: needsHelpCount > 0 ? T.danger + "10" : T.bgCard, border: needsHelpCount > 0 ? T.danger + "40" : T.border },
          { label: "CURRENT UNIT", value: currentClass.unit, color: T.text, small: true },
        ].map((card, i) => (
          <div key={i} style={{
            flex: 1, background: card.bg || T.bgCard, borderRadius: 16, padding: "18px 22px",
            border: `1px solid ${card.border || T.border}`,
          }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{card.label}</div>
            <div style={{
              fontSize: card.small ? 14 : 28, fontWeight: 800, color: card.color,
              fontFamily: "'Fredoka'", marginTop: card.small ? 4 : 0,
            }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Class Distribution */}
      <div style={{
        background: T.bgCard, borderRadius: 18, border: `1px solid ${T.border}`, padding: 24, marginBottom: 20,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16, fontFamily: "'Fredoka'" }}>
          📊 Where is Everyone?
        </div>
        <div style={{ display: "flex", gap: 14, height: 120, alignItems: "flex-end" }}>
          {CRITERIA.map(c => {
            const count = MOCK_STUDENTS.filter(s => s.currentStep.startsWith(c.id.toLowerCase())).length;
            const pct = (count / MOCK_STUDENTS.length) * 100;
            return (
              <div key={c.id} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: Math.max(pct * 1, 8), background: `linear-gradient(to top, ${c.color}90, ${c.color}30)`,
                  borderRadius: "10px 10px 4px 4px", marginBottom: 8,
                  boxShadow: `0 0 12px ${c.color}20`, display: "flex", alignItems: "flex-start",
                  justifyContent: "center", paddingTop: 6,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{count}</span>
                </div>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <div style={{ fontSize: 10, color: c.color, fontWeight: 700, marginTop: 2 }}>Criterion {c.id}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Student List */}
      <div style={{
        background: T.bgCard, borderRadius: 18, border: `1px solid ${T.border}`, padding: 24,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16, fontFamily: "'Fredoka'" }}>
          👥 Students — click for details
        </div>
        {MOCK_STUDENTS.sort((a, b) => a.progress - b.progress).map((student, i) => {
          const c = getStepCriterion(student.currentStep);
          const origIdx = MOCK_STUDENTS.indexOf(student);
          return (
            <div key={i} onClick={() => { setSelectedStudent(origIdx); setView("studentDetail"); }}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
                borderRadius: 12, cursor: "pointer", marginBottom: 4,
                border: student.needsHelp ? `1px solid ${T.danger}35` : `1px solid transparent`,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface + "90"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 28 }}>{student.avatar}</span>
              <div style={{ width: 110 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{student.name}</div>
                <div style={{ fontSize: 11, color: T.xpBar }}>⚡ {student.xp} XP</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: T.surface, borderRadius: 5, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ width: `${student.progress}%`, height: "100%", borderRadius: 5, background: c.color }} />
                </div>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{c.icon} {getStepName(student.currentStep)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: "'Fredoka'", width: 48, textAlign: "right" }}>
                {student.progress}%
              </div>
              {student.needsHelp && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: "4px 8px", borderRadius: 6, background: T.danger + "20", color: T.danger }}>🆘 HELP</span>
              )}
              <span style={{ color: T.textDim, fontSize: 14 }}>→</span>
            </div>
          );
        })}
      </div>
    </TeacherShell>
  );
}

// Teacher Shell (shared layout with class switcher)
function TeacherShell({ children, currentClass, onClassChange, showClassPicker, setShowClassPicker, onLogout }) {
  return (
    <div style={{
      minHeight: "100vh", background: T.bg, fontFamily: "'Nunito', sans-serif",
      position: "relative",
    }}>
      <GlowOrb color={T.criterionB} size={300} top="-50px" right="-50px" opacity={0.05} />

      {/* Top Bar */}
      <div style={{
        padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${T.border}`, background: T.bgCard + "ee",
        backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🎨</span>
          <span style={{ fontFamily: "'Fredoka'", fontSize: 20, color: T.text, fontWeight: 700 }}>
            Quest<span style={{ color: T.accent }}>erra</span>
          </span>
          <span style={{
            fontSize: 11, background: T.criterionB + "20", padding: "4px 10px", borderRadius: 8,
            color: T.criterionB, fontWeight: 700,
          }}>TEACHER</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          {/* Class Switcher */}
          <button onClick={() => setShowClassPicker(!showClassPicker)} style={{
            padding: "8px 16px", background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "'Nunito'", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontFamily: "'JetBrains Mono'", color: T.xpBar, fontSize: 12 }}>{currentClass.code}</span>
            <span style={{ color: T.textMuted }}>▾</span>
          </button>

          {showClassPicker && (
            <div style={{
              position: "absolute", top: "110%", right: 40, background: T.bgCard,
              border: `1px solid ${T.border}`, borderRadius: 14, padding: 8,
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 30, width: 280,
            }}>
              {MOCK_CLASSES.map(cls => (
                <button key={cls.code} onClick={() => onClassChange(cls)} style={{
                  display: "block", width: "100%", padding: "12px 16px", textAlign: "left",
                  background: cls.code === currentClass.code ? T.accent + "15" : "transparent",
                  border: "none", borderRadius: 10, cursor: "pointer", marginBottom: 2,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{cls.name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>
                    <span style={{ fontFamily: "'JetBrains Mono'", color: T.xpBar }}>{cls.code}</span> · {cls.students} students · {cls.unit}
                  </div>
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 4, paddingTop: 4 }}>
                <button style={{
                  width: "100%", padding: "10px 16px", background: "transparent", border: "none",
                  textAlign: "left", cursor: "pointer", borderRadius: 10, color: T.accent, fontSize: 13, fontWeight: 700,
                }}>+ Create New Class</button>
              </div>
            </div>
          )}

          <button onClick={onLogout} style={{
            padding: "6px 10px", background: "transparent", border: "none",
            color: T.textMuted, fontSize: 16, cursor: "pointer",
          }}>↩</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function DesignQuest() {
  const [view, setView] = useState("login");
  return (
    <>
      <style>{FONTS_CSS}</style>
      {view === "login" && <LoginScreen onLogin={(role) => setView(role)} />}
      {view === "student" && <StudentDashboard onLogout={() => setView("login")} />}
      {view === "teacher" && <TeacherDashboard onLogout={() => setView("login")} />}
    </>
  );
}
