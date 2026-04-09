import { useState } from "react";

const unitTypes = {
  design: { label: "Design", color: "#0E7C86", icon: "✏️", emoji: "🔧" },
  service: { label: "Service", color: "#E85D75", icon: "🤝", emoji: "💚" },
  pp: { label: "PP", color: "#7C5CFC", icon: "📋", emoji: "🎯" },
  pypx: { label: "PYPx", color: "#F5A623", icon: "🌍", emoji: "⭐" },
};

const units = [
  { name: "Arcade Machine Project", type: "design", progress: 50 },
  { name: "Community Garden", type: "service", progress: 30 },
  { name: "Personal Project", type: "pp", progress: 75 },
  { name: "Exhibition Prep", type: "pypx", progress: 0 },
];

function ProgressRing({ progress, color, size = 44 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2} textAnchor="middle" dy="0.35em" fontSize="11" fontWeight="700" fill={color}>
        {progress}%
      </text>
    </svg>
  );
}

// ─── Option A: Colour-coded left accent bar ───
function CardOptionA({ unit }) {
  const t = unitTypes[unit.type];
  return (
    <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)", width: 300 }}>
      <div style={{ width: 6, background: t.color, flexShrink: 0 }} />
      <div style={{ padding: "16px 16px 14px 14px", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>{unit.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Continue where you left off →</div>
          </div>
          <ProgressRing progress={unit.progress} color={t.color} />
        </div>
      </div>
    </div>
  );
}

// ─── Option B: Tag chip / pill ───
function CardOptionB({ unit }) {
  const t = unitTypes[unit.type];
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "16px 16px 14px", width: 300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.color, background: t.color + "18",
              padding: "2px 10px", borderRadius: 99, letterSpacing: 0.5 }}>{t.label}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>{unit.name}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Continue where you left off →</div>
        </div>
        <ProgressRing progress={unit.progress} color={t.color} />
      </div>
    </div>
  );
}

// ─── Option C: Icon badge + coloured top border ───
function CardOptionC({ unit }) {
  const t = unitTypes[unit.type];
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)", width: 300,
      borderTop: `3.5px solid ${t.color}` }}>
      <div style={{ padding: "14px 16px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: t.color, textTransform: "uppercase",
                letterSpacing: 0.8 }}>{t.label}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>{unit.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Continue where you left off →</div>
          </div>
          <ProgressRing progress={unit.progress} color={t.color} />
        </div>
      </div>
    </div>
  );
}

// ─── Option D: Gradient banner with type label ───
function CardOptionD({ unit }) {
  const t = unitTypes[unit.type];
  const gradients = {
    design: "linear-gradient(135deg, #0E7C86, #14B8A6)",
    service: "linear-gradient(135deg, #E85D75, #F9A8B8)",
    pp: "linear-gradient(135deg, #7C5CFC, #A78BFA)",
    pypx: "linear-gradient(135deg, #F5A623, #FBBF24)",
  };
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)", width: 300 }}>
      <div style={{ background: gradients[unit.type], padding: "12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase",
          letterSpacing: 1.2 }}>{t.label}</span>
        <ProgressRing progress={unit.progress} color="#fff" size={38} />
      </div>
      <div style={{ padding: "12px 16px 14px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>{unit.name}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Continue where you left off →</div>
      </div>
    </div>
  );
}

export default function UnitTypeConcepts() {
  const [selected, setSelected] = useState("B");
  const options = { A: CardOptionA, B: CardOptionB, C: CardOptionC, D: CardOptionD };
  const descriptions = {
    A: "Colour bar on the left edge — subtle, minimal, scannable",
    B: "Tag chip / pill above the title — clear labelling, lightweight",
    C: "Icon + coloured top border — visual + text cue together",
    D: "Gradient banner header — bold, distinct per type",
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "#f0f4f5",
      minHeight: "100vh", padding: 32 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 4 }}>
        Unit Type Differentiators
      </h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
        4 approaches for Studioloom — each shown with all 4 unit types
      </p>

      {/* Tab selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {Object.keys(options).map(key => (
          <button key={key} onClick={() => setSelected(key)}
            style={{ padding: "8px 20px", borderRadius: 99, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13,
              background: selected === key ? "#1a2a3a" : "#fff",
              color: selected === key ? "#fff" : "#64748b",
              boxShadow: selected === key ? "none" : "0 1px 4px rgba(0,0,0,0.08)" }}>
            Option {key}
          </button>
        ))}
      </div>

      <p style={{ color: "#475569", fontSize: 13, marginBottom: 20, fontStyle: "italic" }}>
        {descriptions[selected]}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 660 }}>
        {units.map(u => {
          const Card = options[selected];
          return <Card key={u.name + selected} unit={u} />;
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginTop: 28, flexWrap: "wrap" }}>
        {Object.entries(unitTypes).map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: val.color }} />
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
