import { useState, useEffect, useRef, useCallback } from "react";

const ROOM_W = 16;
const ROOM_H = 12;
const CELL = 40;

const STUDENTS = [
  { id: "s1", name: "Alex C.", avatar: "🧑‍🎨", color: "#e94560" },
  { id: "s2", name: "Mia W.", avatar: "👩‍🔬", color: "#6c8ebf" },
  { id: "s3", name: "Jake R.", avatar: "🧑‍💻", color: "#82b366" },
  { id: "s4", name: "Priya S.", avatar: "👩‍🎤", color: "#d4a843" },
  { id: "s5", name: "Leo T.", avatar: "🧑‍🚀", color: "#b85450" },
  { id: "s6", name: "Sofia K.", avatar: "👩‍🏫", color: "#9b72cf" },
];

const ARTWORKS = [
  { id: "a1", studentId: "s1", title: "Bluetooth Speaker", thumb: "🔊", x: 2, y: 0, wall: "north", desc: "Wood & acrylic enclosure with parametric finger joints", grade: "A", phase: "Create" },
  { id: "a2", studentId: "s2", title: "Water Filtration", thumb: "💧", x: 5, y: 0, wall: "north", desc: "Low-cost ceramic water filter for rural communities", grade: "A-", phase: "Evaluate" },
  { id: "a3", studentId: "s3", title: "Game Controller", thumb: "🎮", x: 9, y: 0, wall: "north", desc: "Ergonomic controller designed for accessibility needs", grade: "B+", phase: "Create" },
  { id: "a4", studentId: "s4", title: "Eco Packaging", thumb: "📦", x: 13, y: 0, wall: "north", desc: "Biodegradable mushroom-based packaging prototype", grade: "A", phase: "Evaluate" },
  { id: "a5", studentId: "s5", title: "Chess Pieces", thumb: "♟️", x: 0, y: 3, wall: "west", desc: "CNC-milled chess set exploring manufacturing methods", grade: "B+", phase: "Create" },
  { id: "a6", studentId: "s6", title: "School App", thumb: "📱", x: 0, y: 7, wall: "west", desc: "Library booking app redesign with improved accessibility", grade: "A-", phase: "Develop" },
  { id: "a7", studentId: "s1", title: "Desk Organizer", thumb: "🗂️", x: 15, y: 3, wall: "east", desc: "3D-printed modular desk system based on ergonomic research", phase: "Inquire" },
  { id: "a8", studentId: "s3", title: "Solar Charger", thumb: "☀️", x: 15, y: 7, wall: "east", desc: "Portable solar charging station for outdoor classrooms", grade: "B", phase: "Create" },
  { id: "a9", studentId: "s4", title: "Planters", thumb: "🌱", x: 4, y: 11, wall: "south", desc: "Self-watering planters made from recycled plastic", grade: "A", phase: "Evaluate" },
  { id: "a10", studentId: "s2", title: "Prosthetic Hand", thumb: "🤖", x: 10, y: 11, wall: "south", desc: "Affordable 3D-printed prosthetic for young patients", grade: "A+", phase: "Create" },
];

const NPC_POSITIONS = [
  { id: "s2", x: 4, y: 3, facing: "up" },
  { id: "s3", x: 10, y: 5, facing: "left" },
  { id: "s4", x: 7, y: 8, facing: "down" },
  { id: "s5", x: 13, y: 4, facing: "up" },
  { id: "s6", x: 3, y: 9, facing: "right" },
];

const FURNITURE = [
  { type: "workbench", x: 7, y: 5, w: 2, h: 1, emoji: "🔨", label: "Workbench" },
  { type: "display", x: 11, y: 8, w: 1, h: 1, emoji: "🖼️", label: "Display Stand" },
  { type: "printer", x: 13, y: 9, w: 1, h: 1, emoji: "🖨️", label: "3D Printer" },
  { type: "table", x: 5, y: 6, w: 2, h: 1, emoji: "📐", label: "Design Table" },
];

const isBlocked = (x, y) => {
  if (x < 1 || x > ROOM_W - 2 || y < 1 || y > ROOM_H - 2) return true;
  for (const f of FURNITURE) {
    if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) return true;
  }
  for (const n of NPC_POSITIONS) {
    if (x === n.x && y === n.y) return true;
  }
  return false;
};

const getAdjacentArtwork = (px, py) => {
  return ARTWORKS.find(a => {
    if (a.wall === "north" && py === 1 && Math.abs(px - a.x) <= 1) return true;
    if (a.wall === "south" && py === ROOM_H - 2 && Math.abs(px - a.x) <= 1) return true;
    if (a.wall === "west" && px === 1 && Math.abs(py - a.y) <= 1) return true;
    if (a.wall === "east" && px === ROOM_W - 2 && Math.abs(py - a.y) <= 1) return true;
    return false;
  });
};

const getAdjacentNPC = (px, py) => {
  return NPC_POSITIONS.find(n => Math.abs(n.x - px) <= 1 && Math.abs(n.y - py) <= 1);
};

const PhaseColor = { Inquire: "#6c8ebf", Develop: "#d4a843", Create: "#82b366", Evaluate: "#b85450" };

export default function ClassGallery() {
  const [playerPos, setPlayerPos] = useState({ x: 8, y: 6 });
  const [facing, setFacing] = useState("down");
  const [viewing, setViewing] = useState(null);
  const [chatNPC, setChatNPC] = useState(null);
  const [showHelp, setShowHelp] = useState(true);
  const [walkAnim, setWalkAnim] = useState(false);
  const roomRef = useRef(null);
  const [touchStart, setTouchStart] = useState(null);

  const move = useCallback((dx, dy) => {
    const dir = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
    setFacing(dir);
    setWalkAnim(true);
    setTimeout(() => setWalkAnim(false), 150);
    const nx = playerPos.x + dx;
    const ny = playerPos.y + dy;
    if (!isBlocked(nx, ny)) {
      setPlayerPos({ x: nx, y: ny });
      setViewing(null);
      setChatNPC(null);
    }
  }, [playerPos]);

  const interact = useCallback(() => {
    const art = getAdjacentArtwork(playerPos.x, playerPos.y);
    if (art) { setViewing(art); setChatNPC(null); return; }
    const npc = getAdjacentNPC(playerPos.x, playerPos.y);
    if (npc) { setChatNPC(npc); setViewing(null); return; }
  }, [playerPos]);

  useEffect(() => {
    const h = (e) => {
      if (viewing || chatNPC) {
        if (e.key === "Escape" || e.key === " ") { setViewing(null); setChatNPC(null); e.preventDefault(); }
        return;
      }
      switch (e.key) {
        case "ArrowUp": case "w": case "W": move(0, -1); e.preventDefault(); break;
        case "ArrowDown": case "s": case "S": move(0, 1); e.preventDefault(); break;
        case "ArrowLeft": case "a": case "A": move(-1, 0); e.preventDefault(); break;
        case "ArrowRight": case "d": case "D": move(1, 0); e.preventDefault(); break;
        case " ": case "Enter": interact(); e.preventDefault(); break;
      }
      setShowHelp(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move, interact, viewing, chatNPC]);

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const threshold = 25;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      interact();
    } else if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 1 : -1, 0);
    } else {
      move(0, dy > 0 ? 1 : -1);
    }
    setTouchStart(null);
    setShowHelp(false);
  };

  const nearArt = getAdjacentArtwork(playerPos.x, playerPos.y);
  const nearNPC = getAdjacentNPC(playerPos.x, playerPos.y);
  const student = (id) => STUDENTS.find(s => s.id === id);

  const viewOffsetX = Math.max(0, Math.min(playerPos.x * CELL - 160, ROOM_W * CELL - 360));
  const viewOffsetY = Math.max(0, Math.min(playerPos.y * CELL - 200, ROOM_H * CELL - 440));

  return (
    <div style={{ height: "100vh", background: "#0a0a14", fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", userSelect: "none" }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Header */}
      <div style={{ padding: "10px 16px", background: "#12121e", borderBottom: "1px solid #1f1f35", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f0e6d3", letterSpacing: 1 }}>🏛️ MYP4 Design Gallery</span>
          <span style={{ fontSize: 10, color: "#555", marginLeft: 8 }}>Ms. Burton's Class</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {STUDENTS.map(s => (
            <span key={s.id} title={s.name} style={{ fontSize: 14, opacity: 0.7 }}>{s.avatar}</span>
          ))}
        </div>
      </div>

      {/* Room viewport */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div ref={roomRef} style={{
          width: ROOM_W * CELL, height: ROOM_H * CELL, position: "absolute",
          left: -viewOffsetX, top: -viewOffsetY,
          transition: "left 0.15s ease-out, top 0.15s ease-out",
        }}>
          {/* Floor */}
          <div style={{ position: "absolute", inset: 0, background: "#1a1a2e" }}>
            {Array.from({ length: ROOM_W * ROOM_H }).map((_, i) => {
              const gx = i % ROOM_W, gy = Math.floor(i / ROOM_W);
              const edge = gx === 0 || gx === ROOM_W - 1 || gy === 0 || gy === ROOM_H - 1;
              return (
                <div key={i} style={{
                  position: "absolute", left: gx * CELL, top: gy * CELL, width: CELL, height: CELL,
                  background: edge ? "#0f1528" : (gx + gy) % 2 === 0 ? "#1e1e38" : "#1a1a30",
                  borderRight: !edge ? "1px solid #16162a" : "none",
                  borderBottom: !edge ? "1px solid #16162a" : "none",
                  boxSizing: "border-box",
                }} />
              );
            })}
          </div>

          {/* Wall art */}
          {ARTWORKS.map(a => {
            const isNear = nearArt?.id === a.id;
            const st = student(a.studentId);
            return (
              <div key={a.id} style={{
                position: "absolute", left: a.x * CELL, top: a.y * CELL,
                width: CELL, height: CELL,
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 5,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 6,
                  background: isNear ? `${st.color}40` : "#2a2a48",
                  border: isNear ? `2px solid ${st.color}` : "2px solid #3a3a58",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, transition: "all 0.2s",
                  boxShadow: isNear ? `0 0 12px ${st.color}40` : "none",
                  cursor: "pointer",
                }}>
                  {a.thumb}
                </div>
              </div>
            );
          })}

          {/* Furniture */}
          {FURNITURE.map((f, i) => (
            <div key={i} style={{
              position: "absolute", left: f.x * CELL, top: f.y * CELL,
              width: f.w * CELL, height: f.h * CELL,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: f.w > 1 ? 22 : 18, zIndex: 5,
            }}>
              <div style={{
                background: "#252540", borderRadius: 8, width: "90%", height: "80%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid #3a3a55", flexDirection: "column", gap: 2,
              }}>
                <span>{f.emoji}</span>
                <span style={{ fontSize: 7, color: "#666", letterSpacing: 0.5 }}>{f.label}</span>
              </div>
            </div>
          ))}

          {/* NPC students */}
          {NPC_POSITIONS.map(n => {
            const s = student(n.id);
            const isNear = nearNPC?.id === n.id;
            return (
              <div key={n.id} style={{
                position: "absolute", left: n.x * CELL, top: n.y * CELL,
                width: CELL, height: CELL,
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 10, transition: "all 0.15s",
              }}>
                <div style={{ position: "relative" }}>
                  <span style={{ fontSize: 24, filter: isNear ? "drop-shadow(0 0 6px rgba(255,255,255,0.3))" : "none" }}>{s.avatar}</span>
                  {isNear && (
                    <div style={{
                      position: "absolute", bottom: "105%", left: "50%", transform: "translateX(-50%)",
                      background: s.color, color: "#fff", padding: "2px 8px", borderRadius: 4,
                      fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: 0.5,
                    }}>{s.name}</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Player */}
          <div style={{
            position: "absolute",
            left: playerPos.x * CELL, top: playerPos.y * CELL,
            width: CELL, height: CELL,
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 20, transition: "left 0.12s ease-out, top 0.12s ease-out",
          }}>
            <div style={{
              fontSize: 26,
              transform: `scaleX(${facing === "left" ? -1 : 1}) ${walkAnim ? "translateY(-3px)" : "translateY(0)"}`,
              transition: "transform 0.1s",
              filter: "drop-shadow(0 2px 4px rgba(233,69,96,0.4))",
            }}>🧑‍🎨</div>
          </div>
        </div>

        {/* Interaction prompt */}
        {(nearArt || nearNPC) && !viewing && !chatNPC && (
          <div style={{
            position: "absolute", bottom: 130, left: "50%", transform: "translateX(-50%)",
            background: "rgba(15,15,30,0.92)", border: "1px solid #e9456044",
            borderRadius: 10, padding: "8px 16px", zIndex: 30,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 12, color: "#e94560", fontWeight: 700 }}>SPACE</span>
            <span style={{ fontSize: 12, color: "#ccc" }}>
              {nearArt ? `View "${nearArt.title}"` : `Talk to ${student(nearNPC.id)?.name}`}
            </span>
          </div>
        )}

        {/* Artwork detail panel */}
        {viewing && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(180deg, rgba(15,15,30,0.95) 0%, rgba(10,10,20,0.98) 100%)",
            borderTop: `2px solid ${student(viewing.studentId)?.color || "#e94560"}`,
            padding: "16px 20px", zIndex: 40,
            animation: "slideUp 0.2s ease-out",
          }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 28 }}>{viewing.thumb}</span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0e6d3", margin: 0 }}>{viewing.title}</h3>
                    <span style={{ fontSize: 11, color: student(viewing.studentId)?.color }}>
                      by {student(viewing.studentId)?.name}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6, margin: "8px 0" }}>{viewing.desc}</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                    padding: "3px 8px", borderRadius: 3,
                    background: PhaseColor[viewing.phase], color: "#fff",
                  }}>{viewing.phase}</span>
                  {viewing.grade && (
                    <span style={{ fontSize: 11, color: "#888" }}>Grade: <strong style={{ color: "#f0e6d3" }}>{viewing.grade}</strong></span>
                  )}
                </div>
              </div>
              <button onClick={() => setViewing(null)} style={{
                background: "rgba(255,255,255,0.08)", border: "none", color: "#888",
                borderRadius: 6, padding: "6px 10px", fontSize: 11, cursor: "pointer",
              }}>✕ Close</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={{
                flex: 1, padding: "10px 0", background: student(viewing.studentId)?.color || "#e94560",
                color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>Visit {student(viewing.studentId)?.name}'s Studio →</button>
              <button style={{
                padding: "10px 16px", background: "rgba(255,255,255,0.06)",
                color: "#ccc", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, cursor: "pointer",
              }}>💬 Leave Comment</button>
            </div>
          </div>
        )}

        {/* NPC chat bubble */}
        {chatNPC && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(15,15,30,0.95)", borderTop: `2px solid ${student(chatNPC.id)?.color}`,
            padding: "16px 20px", zIndex: 40,
            animation: "slideUp 0.2s ease-out",
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 30 }}>{student(chatNPC.id)?.avatar}</span>
              <div style={{ flex: 1 }}>
                <strong style={{ color: student(chatNPC.id)?.color, fontSize: 13 }}>{student(chatNPC.id)?.name}</strong>
                <p style={{ color: "#ccc", fontSize: 12, lineHeight: 1.6, margin: "6px 0 0" }}>
                  "Hey! Have you seen my latest project on the north wall? I'm really proud of how the prototype turned out. Let me know what you think!"
                </p>
              </div>
              <button onClick={() => setChatNPC(null)} style={{
                background: "rgba(255,255,255,0.08)", border: "none", color: "#888",
                borderRadius: 6, padding: "6px 10px", fontSize: 11, cursor: "pointer",
              }}>✕</button>
            </div>
          </div>
        )}

        {/* Help overlay */}
        {showHelp && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "rgba(10,10,20,0.92)", border: "1px solid #2a2a45",
            borderRadius: 14, padding: 20, zIndex: 50, textAlign: "center",
            maxWidth: 260,
          }}>
            <p style={{ fontSize: 14, color: "#f0e6d3", margin: "0 0 12px", fontWeight: 600 }}>🏛️ Class Gallery</p>
            <p style={{ fontSize: 11, color: "#888", lineHeight: 1.7, margin: "0 0 14px" }}>
              Walk around and explore your classmates' design work!
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, color: "#aaa", marginBottom: 14 }}>
              <div>⬆️⬇️⬅️➡️ Move</div>
              <div>SPACE Interact</div>
              <div>👆 Swipe to walk</div>
              <div>👆 Tap to interact</div>
            </div>
            <button onClick={() => setShowHelp(false)} style={{
              width: "100%", padding: "10px 0", background: "#e94560", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Enter Gallery</button>
          </div>
        )}
      </div>

      {/* D-pad for mobile */}
      <div style={{
        flexShrink: 0, padding: "8px 0 16px", background: "#0e0e1a",
        borderTop: "1px solid #1a1a30",
        display: "flex", justifyContent: "center", alignItems: "center", gap: 24,
      }}>
        <div style={{ position: "relative", width: 120, height: 120 }}>
          {[
            { dir: "up", dx: 0, dy: -1, top: 0, left: 40, label: "▲" },
            { dir: "down", dx: 0, dy: 1, top: 80, left: 40, label: "▼" },
            { dir: "left", dx: -1, dy: 0, top: 40, left: 0, label: "◀" },
            { dir: "right", dx: 1, dy: 0, top: 40, left: 80, label: "▶" },
          ].map(b => (
            <button key={b.dir}
              onClick={() => { move(b.dx, b.dy); setShowHelp(false); }}
              style={{
                position: "absolute", top: b.top, left: b.left,
                width: 40, height: 40, borderRadius: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#888", fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
              }}>{b.label}</button>
          ))}
          <div style={{
            position: "absolute", top: 40, left: 40, width: 40, height: 40,
            background: "rgba(255,255,255,0.02)", borderRadius: 4,
          }} />
        </div>
        <button onClick={() => { interact(); setShowHelp(false); }}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: (nearArt || nearNPC) ? "#e94560" : "rgba(255,255,255,0.06)",
            border: (nearArt || nearNPC) ? "2px solid #ff6b81" : "2px solid rgba(255,255,255,0.1)",
            color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
            letterSpacing: 0.5, transition: "all 0.2s",
            boxShadow: (nearArt || nearNPC) ? "0 0 16px rgba(233,69,96,0.4)" : "none",
          }}>
          {(nearArt || nearNPC) ? "VIEW" : "ACT"}
        </button>
      </div>
    </div>
  );
}
