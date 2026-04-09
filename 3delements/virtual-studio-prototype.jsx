import { useState } from "react";

const THEMES = [
  { id: "workshop", name: "Maker Workshop", bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", accent: "#e94560", shelf: "#2a2a4a", wall: "#1e1e3a", text: "#f0e6d3" },
  { id: "gallery", name: "White Gallery", bg: "linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)", accent: "#111", shelf: "#fff", wall: "#e8e8e8", text: "#222" },
  { id: "greenhouse", name: "Green Studio", bg: "linear-gradient(135deg, #1b2a1b 0%, #2d4a2d 50%, #1a3a2a 100%)", accent: "#7ecf8a", shelf: "#2a3f2a", wall: "#1f2f1f", text: "#d4e8d0" },
];

const PROJECTS = [
  { id: 1, title: "Bluetooth Speaker Enclosure", phase: "Create", grade: "A", thumb: "🔊", desc: "Designed a wood & acrylic enclosure with parametric joints. 12-week project covering full Design Cycle.", tags: ["Woodwork", "CAD", "Electronics"] },
  { id: 2, title: "Chess Piece Manufacturing", phase: "Evaluate", grade: "B+", thumb: "♟️", desc: "Mass-production analysis of chess pieces using injection molding vs 3D printing.", tags: ["Manufacturing", "Analysis"] },
  { id: 3, title: "Sustainable Packaging", phase: "Create", grade: "A-", thumb: "📦", desc: "Biodegradable packaging solution for school cafeteria takeaway meals.", tags: ["Sustainability", "Prototyping"] },
  { id: 4, title: "App UI Redesign", phase: "Develop", grade: null, thumb: "📱", desc: "Redesigning the school library booking app for better accessibility.", tags: ["UX/UI", "Digital"] },
  { id: 5, title: "Ergonomic Desk Organizer", phase: "Inquire", grade: null, thumb: "🗂️", desc: "Research phase — surveying students on desk organization pain points.", tags: ["Ergonomics", "Research"] },
];

const BADGES = [
  { icon: "🎯", name: "First Crit", desc: "Gave first peer review" },
  { icon: "🔥", name: "7-Day Streak", desc: "Logged process journal 7 days straight" },
  { icon: "⭐", name: "Artisan Belt", desc: "Reached Artisan design level" },
  { icon: "🧪", name: "Prototype Master", desc: "Completed 5 prototypes" },
  { icon: "💡", name: "Design Spark", desc: "Won a Daily Design Spark challenge" },
  { icon: "🤝", name: "Mentor", desc: "Helped 3 peers in Studio Crits" },
];

const GUESTBOOK = [
  { name: "Mom", msg: "So proud of your speaker project! The wood joints look amazing.", time: "2 days ago", emoji: "❤️" },
  { name: "Dad", msg: "Great progress this term. Keep it up!", time: "1 week ago", emoji: "👏" },
  { name: "Ms. Chen", msg: "Excellent reflection on your sustainable packaging research.", time: "2 weeks ago", emoji: "⭐" },
];

const PhaseTag = ({ phase, accent }) => {
  const colors = {
    Inquire: "#6c8ebf", Develop: "#d4a843", Create: "#82b366", Evaluate: "#b85450",
  };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "3px 8px", borderRadius: 3, background: colors[phase] || accent, color: "#fff" }}>
      {phase}
    </span>
  );
};

export default function VirtualStudio() {
  const [view, setView] = useState("splash");
  const [theme, setTheme] = useState(THEMES[0]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [accessCode, setAccessCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [guestbookOpen, setGuestbookOpen] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [hoveredBadge, setHoveredBadge] = useState(null);

  const VALID_CODE = "STUDIO-7X";

  const handleCodeSubmit = () => {
    if (accessCode.toUpperCase() === VALID_CODE) {
      setView("visitor");
      setCodeError(false);
    } else {
      setCodeError(true);
    }
  };

  // ── SPLASH ──
  if (view === "splash") {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#f0e6d3", padding: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 20%, rgba(233,69,96,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(100,140,255,0.06) 0%, transparent 50%)" }} />
        <div style={{ position: "relative", textAlign: "center", maxWidth: 500 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏛️</div>
          <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: 3, margin: "0 0 4px", textTransform: "uppercase" }}>Virtual Studio</h1>
          <p style={{ fontSize: 13, color: "#8a8a9a", marginBottom: 40, letterSpacing: 1 }}>StudioLoom Portfolio Experience</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <button onClick={() => setView("builder")} style={{ width: 260, padding: "14px 0", background: "linear-gradient(135deg, #e94560, #c73e54)", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: 1 }}>
              🎨 Student Studio Builder
            </button>
            <button onClick={() => setView("code-entry")} style={{ width: 260, padding: "14px 0", background: "transparent", color: "#f0e6d3", border: "1px solid rgba(240,230,211,0.2)", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer", letterSpacing: 1 }}>
              🚪 Visit a Studio
            </button>
          </div>

          <p style={{ fontSize: 11, color: "#555", marginTop: 40, lineHeight: 1.6 }}>
            Prototype wireframe — demonstrates student customization<br />and parent/visitor walkthrough experience
          </p>
        </div>
      </div>
    );
  }

  // ── CODE ENTRY ──
  if (view === "code-entry") {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#f0e6d3", padding: 20 }}>
        <button onClick={() => setView("splash")} style={{ position: "absolute", top: 16, left: 16, background: "none", border: "none", color: "#8a8a9a", cursor: "pointer", fontSize: 13 }}>← Back</button>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
          <h2 style={{ fontSize: 20, fontWeight: 400, margin: "0 0 8px", letterSpacing: 1 }}>Enter Studio Code</h2>
          <p style={{ fontSize: 12, color: "#8a8a9a", marginBottom: 24 }}>Ask the student for their studio access code</p>
          <input
            value={accessCode}
            onChange={e => { setAccessCode(e.target.value); setCodeError(false); }}
            onKeyDown={e => e.key === "Enter" && handleCodeSubmit()}
            placeholder="e.g. STUDIO-7X"
            style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: codeError ? "1px solid #e94560" : "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f0e6d3", fontSize: 16, textAlign: "center", letterSpacing: 2, outline: "none", boxSizing: "border-box" }}
          />
          {codeError && <p style={{ color: "#e94560", fontSize: 12, marginTop: 8 }}>Invalid code. Try STUDIO-7X for demo.</p>}
          <button onClick={handleCodeSubmit} style={{ marginTop: 16, width: "100%", padding: "12px 0", background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Enter Studio →
          </button>
        </div>
      </div>
    );
  }

  // ── STUDENT BUILDER ──
  if (view === "builder") {
    return (
      <div style={{ minHeight: "100vh", background: "#111119", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8e0d4" }}>
        {/* Top Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setView("splash")} style={{ background: "none", border: "none", color: "#8a8a9a", cursor: "pointer", fontSize: 13 }}>← Back</button>
          <span style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#8a8a9a" }}>Studio Builder</span>
          <span style={{ fontSize: 11, color: "#555" }}>Preview ↗</span>
        </div>

        <div style={{ padding: 20 }}>
          {/* Theme Selector */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "#666", marginBottom: 10 }}>Studio Theme</p>
            <div style={{ display: "flex", gap: 10 }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => setTheme(t)}
                  style={{ flex: 1, padding: "14px 10px", background: t.bg, border: theme.id === t.id ? `2px solid ${t.accent}` : "2px solid transparent", borderRadius: 10, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div style={{ background: theme.bg, borderRadius: 14, padding: 24, marginBottom: 20, border: `1px solid ${theme.accent}22`, minHeight: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 300, color: theme.text, margin: 0, letterSpacing: 1 }}>Alex Chen's Studio</h2>
                <p style={{ fontSize: 12, color: theme.accent, margin: "4px 0 0" }}>MYP Year 4 Design • Artisan Belt ⭐</p>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {BADGES.slice(0, 4).map((b, i) => (
                  <span key={i} style={{ fontSize: 18, background: theme.shelf, borderRadius: 6, padding: "4px 6px" }}>{b.icon}</span>
                ))}
              </div>
            </div>

            {/* Project Shelves */}
            <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: theme.text, opacity: 0.5, marginBottom: 10 }}>Works on Display</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {PROJECTS.slice(0, 4).map(p => (
                <div key={p.id} style={{ background: theme.shelf, borderRadius: 10, padding: 14, cursor: "pointer", border: `1px solid ${theme.accent}15`, transition: "transform 0.2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 24 }}>{p.thumb}</span>
                    <PhaseTag phase={p.phase} accent={theme.accent} />
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 4px" }}>{p.title}</h4>
                  <p style={{ fontSize: 11, color: theme.text, opacity: 0.6, margin: 0, lineHeight: 1.4 }}>{p.desc.slice(0, 60)}…</p>
                </div>
              ))}
            </div>

            {/* Stats Bar */}
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 18, padding: "12px 0", borderTop: `1px solid ${theme.accent}15` }}>
              {[["5", "Projects"], ["⭐ Artisan", "Belt"], ["23", "Journal Entries"], ["142", "XP"]].map(([val, label], i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: theme.accent }}>{val}</div>
                  <div style={{ fontSize: 10, color: theme.text, opacity: 0.5 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Share Section */}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "#666", margin: "0 0 10px" }}>Share Your Studio</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 8, fontFamily: "monospace", fontSize: 14, letterSpacing: 3, color: "#e94560", textAlign: "center" }}>
                STUDIO-7X
              </div>
              <button style={{ padding: "10px 16px", background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Copy Code
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#555", margin: "8px 0 0", textAlign: "center" }}>Share this code with parents or visitors to let them explore your studio</p>
          </div>
        </div>
      </div>
    );
  }

  // ── VISITOR VIEW ──
  if (view === "visitor") {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: "'Segoe UI', system-ui, sans-serif", color: theme.text, position: "relative" }}>
        {/* Visitor Header */}
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.accent}15` }}>
          <button onClick={() => { setView("splash"); setAccessCode(""); }} style={{ background: "none", border: "none", color: theme.text, opacity: 0.5, cursor: "pointer", fontSize: 13 }}>← Exit</button>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, opacity: 0.4 }}>Visiting Studio</span>
          <button onClick={() => setGuestbookOpen(true)} style={{ background: theme.accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            📖 Guestbook
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Student Info */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: theme.shelf, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 10px", border: `2px solid ${theme.accent}` }}>🎨</div>
            <h1 style={{ fontSize: 22, fontWeight: 300, margin: "0 0 4px", letterSpacing: 1 }}>Alex Chen's Studio</h1>
            <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>MYP Year 4 Design • NIS</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
              {BADGES.map((b, i) => (
                <span key={i}
                  onMouseEnter={() => setHoveredBadge(i)}
                  onMouseLeave={() => setHoveredBadge(null)}
                  style={{ fontSize: 18, background: theme.shelf, borderRadius: 8, padding: "5px 7px", cursor: "pointer", position: "relative", border: hoveredBadge === i ? `1px solid ${theme.accent}` : "1px solid transparent", transition: "all 0.2s" }}>
                  {b.icon}
                  {hoveredBadge === i && (
                    <div style={{ position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "6px 10px", borderRadius: 6, fontSize: 10, whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                      <strong>{b.name}</strong><br />{b.desc}
                    </div>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Project Detail or Grid */}
          {selectedProject ? (
            <div style={{ background: theme.shelf, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${theme.accent}20` }}>
              <button onClick={() => setSelectedProject(null)} style={{ background: "none", border: "none", color: theme.accent, cursor: "pointer", fontSize: 12, marginBottom: 12, padding: 0 }}>← Back to all works</button>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{selectedProject.thumb}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{selectedProject.title}</h2>
                <PhaseTag phase={selectedProject.phase} accent={theme.accent} />
              </div>
              {selectedProject.grade && <p style={{ fontSize: 12, color: theme.accent, margin: "0 0 10px" }}>Grade: {selectedProject.grade}</p>}
              <p style={{ fontSize: 13, lineHeight: 1.7, opacity: 0.8, margin: "0 0 14px" }}>{selectedProject.desc}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selectedProject.tags.map(t => (
                  <span key={t} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: `${theme.accent}18`, color: theme.accent, fontWeight: 600 }}>{t}</span>
                ))}
              </div>

              {/* Process Journal Preview */}
              <div style={{ marginTop: 20, padding: 14, background: `${theme.accent}08`, borderRadius: 10, borderLeft: `3px solid ${theme.accent}` }}>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, opacity: 0.5, margin: "0 0 6px" }}>Process Journal Excerpt</p>
                <p style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.7, margin: 0, fontStyle: "italic" }}>
                  "Today I tested three different joint types for the enclosure. The finger joints gave the cleanest look but the dovetails are structurally stronger. Need to consider the trade-off given this will house electronics that generate heat…"
                </p>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, opacity: 0.4, marginBottom: 10 }}>Works on Display — tap to explore</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {PROJECTS.map(p => (
                  <div key={p.id} onClick={() => setSelectedProject(p)}
                    style={{ background: theme.shelf, borderRadius: 12, padding: 14, cursor: "pointer", display: "flex", gap: 14, alignItems: "center", border: `1px solid ${theme.accent}10`, transition: "all 0.15s" }}>
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{p.thumb}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 3px" }}>{p.title}</h4>
                      <p style={{ fontSize: 11, opacity: 0.5, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</p>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <PhaseTag phase={p.phase} accent={theme.accent} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Guestbook Modal */}
        {guestbookOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, padding: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setGuestbookOpen(false); }}>
            <div style={{ background: "#1a1a2e", borderRadius: "16px 16px 0 0", padding: 20, width: "100%", maxWidth: 500, maxHeight: "70vh", overflowY: "auto", color: "#f0e6d3" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>📖 Guestbook</h3>
                <button onClick={() => setGuestbookOpen(false)} style={{ background: "none", border: "none", color: "#8a8a9a", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              {GUESTBOOK.map((g, i) => (
                <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.emoji} {g.name}</span>
                    <span style={{ fontSize: 10, opacity: 0.4 }}>{g.time}</span>
                  </div>
                  <p style={{ fontSize: 12, opacity: 0.7, margin: 0, lineHeight: 1.5 }}>{g.msg}</p>
                </div>
              ))}

              <div style={{ marginTop: 16 }}>
                <textarea
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Leave a message…"
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f0e6d3", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box" }}
                />
                <button style={{ marginTop: 8, width: "100%", padding: "10px 0", background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Sign Guestbook
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
