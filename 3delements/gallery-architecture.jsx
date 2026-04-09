import { useState } from "react";

const LAYERS = [
  {
    id: "client",
    label: "Client (Next.js + Three.js)",
    color: "#e94560",
    y: 0,
    nodes: [
      { id: "scene", label: "3D Gallery Scene", desc: "Three.js renderer. Manages avatars, artworks, camera. Calls updatePosition() in render loop at 60fps.", x: 0 },
      { id: "hook", label: "useGalleryMultiplayer", desc: "Central hook. Manages Supabase channel subscriptions, broadcasts position at 10fps, exposes players/chat/reactions state.", x: 1 },
      { id: "ui", label: "UI Overlay", desc: "React components: chat panel, emoji picker, player list, artwork detail modal, proximity tooltip. Reads from hook state.", x: 2 },
    ],
  },
  {
    id: "realtime",
    label: "Supabase Realtime",
    color: "#4fc3f7",
    y: 1,
    nodes: [
      { id: "presence", label: "Presence Channel", desc: "Tracks who's in the gallery room. Auto-syncs join/leave. Payload: {name, role, color, joined_at}. Used for player list + online count.", x: 0 },
      { id: "broadcast", label: "Broadcast Channel", desc: "Ephemeral position updates at ~10fps. Payload: {id, x, z, angle}. No persistence — pure WebSocket. Also used for instant reaction delivery.", x: 1 },
      { id: "dbchanges", label: "Postgres Changes", desc: "Listens for INSERTs on gallery_chat and artwork_reactions tables. Delivers persisted messages to all subscribers in real-time.", x: 2 },
    ],
  },
  {
    id: "database",
    label: "Supabase Database",
    color: "#7ecf8a",
    y: 2,
    nodes: [
      { id: "studios", label: "Studios + Displays", desc: "studios: theme, access_code, belt_level, layout_config. studio_displays: which projects are on the wall with position, frame_style, caption, journal_excerpt.", x: 0 },
      { id: "events", label: "Gallery Events", desc: "gallery_events: Exhibition Night scheduling, room config, invite codes. gallery_event_studios: maps studios → wall positions. Teachers create and control is_live toggle.", x: 1 },
      { id: "social", label: "Chat + Reactions + Visits", desc: "gallery_chat: persisted messages. artwork_reactions: emoji reactions with counts view. guestbook_entries: moderated visitor messages. studio_visits: analytics.", x: 2 },
    ],
  },
];

const CONNECTIONS = [
  { from: "scene", to: "hook", label: "updatePosition(x,z,θ)", color: "#e94560" },
  { from: "hook", to: "scene", label: "players(), reactions", color: "#e94560" },
  { from: "hook", to: "ui", label: "chatMessages, onlineCount", color: "#e94560" },
  { from: "ui", to: "hook", label: "sendChat(), sendReaction()", color: "#e94560" },
  { from: "hook", to: "presence", label: "channel.track()", color: "#4fc3f7" },
  { from: "presence", to: "hook", label: "presence sync/join/leave", color: "#4fc3f7" },
  { from: "hook", to: "broadcast", label: "player_move @ 10fps", color: "#4fc3f7" },
  { from: "broadcast", to: "hook", label: "remote positions", color: "#4fc3f7" },
  { from: "hook", to: "dbchanges", label: "subscribe INSERT", color: "#4fc3f7" },
  { from: "dbchanges", to: "hook", label: "new chat/reaction rows", color: "#4fc3f7" },
  { from: "hook", to: "social", label: "INSERT chat, reactions", color: "#7ecf8a" },
  { from: "studios", to: "events", label: "gallery_event_studios", color: "#7ecf8a44" },
  { from: "events", to: "social", label: "event_id FK", color: "#7ecf8a44" },
];

const FLOW_SCENARIOS = [
  {
    id: "join",
    title: "Player Joins Gallery",
    steps: [
      "Player enters name, role, avatar color in lobby UI",
      "useGalleryMultiplayer initializes Supabase channel",
      "channel.subscribe() → SUBSCRIBED status",
      "channel.track({name, role, color}) sends presence",
      "All clients receive presence 'join' event",
      "Remote clients create new avatar mesh in Three.js scene",
      "Position broadcast interval starts at 100ms (10fps)",
    ],
  },
  {
    id: "move",
    title: "Player Movement Loop",
    steps: [
      "Three.js render loop runs at 60fps",
      "WASD input updates local player position",
      "updatePosition(x, z, angle) stores position in ref",
      "Every 100ms: broadcast sends {id, x, z, angle}",
      "Remote clients receive broadcast event",
      "Remote player state updated in React state",
      "Next render frame: lerp remote meshes toward target position",
      "Lerp factor 0.15 = smooth ~6 frame interpolation",
    ],
  },
  {
    id: "react",
    title: "Emoji Reaction Flow",
    steps: [
      "Player walks near artwork → proximity detection triggers",
      "UI shows artwork tooltip with emoji picker button",
      "Player taps emoji → sendReaction(displayId, '❤️')",
      "Broadcast sends {display_id, emoji, reactor_name} instantly",
      "All clients see floating emoji animation immediately",
      "Simultaneously: INSERT into artwork_reactions table",
      "Postgres Changes delivers row to all subscribers",
      "reaction_counts view auto-updates for persistent display",
    ],
  },
  {
    id: "chat",
    title: "Chat Message Flow",
    steps: [
      "Player types message, presses Enter or send button",
      "sendChat() inserts row into gallery_chat table",
      "Postgres Changes on gallery_chat fires INSERT event",
      "All subscribed clients receive the new message",
      "Chat panel updates with sender name, color, and role badge",
      "Messages persisted — late joiners load last 20 on connect",
    ],
  },
];

const PERF_NOTES = [
  { title: "Position Broadcasting", detail: "10fps via Broadcast (not DB). ~40 bytes/msg. 20 players = ~8KB/s bandwidth. Supabase Broadcast is ephemeral WebSocket — no DB writes for movement." },
  { title: "Player Interpolation", detail: "Clients render at 60fps but receive updates at 10fps. Lerp factor 0.15 smooths the gap. Visual result: ~6 frame catch-up, feels fluid." },
  { title: "Stale Player Cleanup", detail: "Client-side 2s interval checks lastUpdate. Players silent >5s removed from map. Presence 'leave' handles graceful disconnects." },
  { title: "Reaction Counts", detail: "reaction_counts SQL view aggregates on read. For high-traffic events, consider a trigger-updated materialized counter column on studio_displays." },
  { title: "Chat History", detail: "Load last 20 messages on join. Postgres Changes delivers new INSERTs. Cap client-side buffer at 50 messages. Older messages available via pagination." },
  { title: "Room Capacity", detail: "Supabase Realtime handles ~100 concurrent per channel comfortably. For larger events, shard by room sections or limit max_visitors on gallery_events." },
];

export default function ArchitectureDiagram() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [activeTab, setActiveTab] = useState("architecture");

  const nodePositions = {};
  LAYERS.forEach(layer => {
    layer.nodes.forEach(node => {
      nodePositions[node.id] = { x: node.x, y: layer.y, color: layer.color };
    });
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8e0d4" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 10, letterSpacing: 5, color: "#e94560", textTransform: "uppercase", marginBottom: 4 }}>StudioLoom</div>
        <h1 style={{ fontSize: 20, fontWeight: 300, margin: 0, letterSpacing: 1 }}>Multiplayer Gallery Architecture</h1>
        <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>Supabase Realtime + Three.js + Next.js</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { id: "architecture", label: "System Map" },
          { id: "flows", label: "Data Flows" },
          { id: "perf", label: "Performance" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, padding: "10px 0", background: activeTab === tab.id ? "rgba(233,69,96,0.08)" : "transparent", border: "none", borderBottom: activeTab === tab.id ? "2px solid #e94560" : "2px solid transparent", color: activeTab === tab.id ? "#e94560" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: 1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* ── ARCHITECTURE TAB ── */}
        {activeTab === "architecture" && (
          <div>
            {LAYERS.map((layer, li) => (
              <div key={layer.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: layer.color }} />
                  <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: layer.color, fontWeight: 600 }}>{layer.label}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {layer.nodes.map(node => (
                    <button key={node.id} onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                      style={{ flex: 1, padding: 12, background: selectedNode?.id === node.id ? `${layer.color}15` : "rgba(255,255,255,0.02)", border: selectedNode?.id === node.id ? `1px solid ${layer.color}44` : "1px solid rgba(255,255,255,0.06)", borderRadius: 10, cursor: "pointer", textAlign: "left", color: "#e8e0d4" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: layer.color }}>{node.label}</div>
                      <div style={{ fontSize: 10, color: "#777", lineHeight: 1.4 }}>{node.desc.slice(0, 60)}…</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Connection legend */}
            <div style={{ marginTop: 16, padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#555", margin: "0 0 10px" }}>Data Flow Connections</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {CONNECTIONS.filter(c => c.color !== "#7ecf8a44").map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <span style={{ color: c.color, fontWeight: 600, minWidth: 100 }}>{c.from}</span>
                    <span style={{ color: "#444" }}>→</span>
                    <span style={{ color: c.color, fontWeight: 600, minWidth: 100 }}>{c.to}</span>
                    <span style={{ color: "#666", fontFamily: "monospace", fontSize: 10 }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected node detail */}
            {selectedNode && (
              <div style={{ marginTop: 12, padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{selectedNode.label}</h3>
                  <button onClick={() => setSelectedNode(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
                <p style={{ fontSize: 12, color: "#aaa", lineHeight: 1.7, margin: 0 }}>{selectedNode.desc}</p>
              </div>
            )}
          </div>
        )}

        {/* ── FLOWS TAB ── */}
        {activeTab === "flows" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {FLOW_SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setActiveScenario(activeScenario?.id === s.id ? null : s)}
                  style={{ padding: 14, background: activeScenario?.id === s.id ? "rgba(233,69,96,0.08)" : "rgba(255,255,255,0.02)", border: activeScenario?.id === s.id ? "1px solid #e9456044" : "1px solid rgba(255,255,255,0.06)", borderRadius: 10, cursor: "pointer", textAlign: "left", color: "#e8e0d4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</span>
                    <span style={{ fontSize: 10, color: "#666" }}>{s.steps.length} steps</span>
                  </div>
                </button>
              ))}
            </div>

            {activeScenario && (
              <div style={{ padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px", color: "#e94560" }}>{activeScenario.title}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {activeScenario.steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#e9456022", border: "1px solid #e9456044", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#e94560" }}>{i + 1}</div>
                        {i < activeScenario.steps.length - 1 && <div style={{ width: 1, height: 20, background: "rgba(233,69,96,0.15)" }} />}
                      </div>
                      <p style={{ fontSize: 12, color: "#bbb", margin: "2px 0 12px", lineHeight: 1.5 }}>{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PERFORMANCE TAB ── */}
        {activeTab === "perf" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PERF_NOTES.map((note, i) => (
              <div key={i} style={{ padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", borderLeft: "3px solid #7ecf8a" }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px", color: "#7ecf8a" }}>{note.title}</h4>
                <p style={{ fontSize: 12, color: "#999", margin: 0, lineHeight: 1.6 }}>{note.detail}</p>
              </div>
            ))}

            <div style={{ marginTop: 8, padding: 14, background: "rgba(233,69,96,0.05)", borderRadius: 10, border: "1px solid #e9456022" }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px", color: "#e94560" }}>Supabase Realtime Channel Strategy</h4>
              <p style={{ fontSize: 12, color: "#999", margin: 0, lineHeight: 1.7 }}>
                One channel per gallery event handles all three modes: Presence (who's online), Broadcast (positions + ephemeral reactions), and Postgres Changes (persisted chat + reactions). This keeps the connection count at 2 channels per client — one for the main room, one for DB changes. Supabase multiplexes these over a single WebSocket connection.
              </p>
            </div>

            <div style={{ padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px", color: "#d4a843" }}>Scaling Considerations</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["1–20 players", "Single channel, no issues. ~2KB/s per client."],
                  ["20–50 players", "Consider reducing broadcast to 5fps. Add viewport culling — only render avatars within camera frustum."],
                  ["50–100 players", "Shard gallery into 'rooms' or 'wings'. Each wing is a separate channel. Players see door transitions between wings."],
                  ["100+ players", "Move to dedicated WebSocket server (e.g., Hathora, Colyseus). Supabase handles persistence + auth, dedicated server handles real-time state."],
                ].map(([scale, detail], i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#d4a843", minWidth: 90, flexShrink: 0 }}>{scale}</span>
                    <span style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
        <p style={{ fontSize: 10, color: "#444", margin: 0 }}>Files: gallery-migration.sql • useGalleryMultiplayer.ts • Architecture reference</p>
      </div>
    </div>
  );
}
