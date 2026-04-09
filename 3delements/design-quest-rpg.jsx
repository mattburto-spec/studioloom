import { useState, useEffect, useRef, useCallback } from "react";

// ── WORLD CONFIG ─────────────────────────────────────────────
const TILE = 40;
const COLS = 24;
const ROWS = 18;
const CAM_SMOOTH = 0.08;

// Tile types: 0=grass, 1=path, 2=water, 3=wall, 4=tree, 5=flowers, 6=bridge, 7=sand, 8=dark_grass, 9=door
const MAP = [
  [4,4,4,4,4,4,4,2,2,2,2,2,2,2,2,2,4,4,4,4,4,4,4,4],
  [4,0,0,0,4,4,0,2,2,2,2,2,2,2,2,2,0,0,4,4,0,0,0,4],
  [4,0,5,0,0,0,0,7,7,2,2,2,2,7,7,0,0,0,0,0,0,5,0,4],
  [4,0,0,0,1,1,1,1,7,7,2,2,7,7,1,1,1,1,1,0,0,0,0,4],
  [4,4,0,0,1,0,0,1,1,7,6,6,7,1,1,0,0,0,1,0,0,0,4,4],
  [4,0,0,0,1,0,3,3,3,1,1,1,1,3,3,3,0,0,1,0,0,0,0,4],
  [4,0,5,0,1,0,3,9,3,0,0,0,0,3,9,3,0,0,1,0,5,0,0,4],
  [4,0,0,0,1,0,3,3,3,0,0,0,0,3,3,3,0,0,1,0,0,0,0,4],
  [4,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,4],
  [4,0,0,1,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,0,0,0,4],
  [4,0,0,1,0,0,0,0,1,1,5,5,1,1,0,0,0,0,0,1,0,0,0,4],
  [4,0,0,1,0,3,3,3,1,0,0,0,0,1,3,3,3,0,0,1,0,0,0,4],
  [4,0,0,1,0,3,9,3,1,0,0,0,0,1,3,9,3,0,0,1,0,0,0,4],
  [4,5,0,1,0,3,3,3,1,0,0,0,0,1,3,3,3,0,0,1,0,5,0,4],
  [4,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,5,0,0,8,8,0,0,0,1,1,0,0,0,8,8,0,0,0,5,0,0,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
];

const TILE_COLORS = {
  0: "#4a7c3f", 1: "#c4a96a", 2: "#3a6ea5", 3: "#5a5a6e",
  4: "#2d5a27", 5: "#4a7c3f", 6: "#8b7355", 7: "#d4c49a",
  8: "#3d6b35", 9: "#6b4423",
};

const SOLID_TILES = new Set([2, 3, 4]);

// ── NPCs ─────────────────────────────────────────────────────
const NPCS = [
  {
    id: "baker",
    name: "Rosa the Baker",
    emoji: "👩‍🍳",
    x: 10, y: 10,
    color: "#e8a87c",
    hasQuest: true,
    questAccepted: false,
    dialogue: [
      { speaker: "Rosa", text: "Oh thank goodness, a designer! My bakery has a real problem.", mood: "worried" },
      { speaker: "Rosa", text: "Customers keep burning themselves on my takeaway coffee cups. The paper is too thin and there's no sleeve.", mood: "worried" },
      { speaker: "Rosa", text: "I need someone to design a better cup sleeve — something eco-friendly that actually insulates.", mood: "hopeful" },
      { speaker: "Rosa", text: "Could you help me? I'll need you to research materials, prototype some designs, and test them with real customers.", mood: "hopeful" },
    ],
    quest: {
      title: "The Hot Cup Problem",
      brief: "Design an eco-friendly insulating sleeve for Rosa's takeaway cups",
      client: "Rosa the Baker",
      phases: [
        { phase: "Inquire", tasks: ["Interview 5 customers about their experience", "Research existing sleeve designs", "Investigate sustainable materials", "Define design specifications"] },
        { phase: "Develop", tasks: ["Sketch 3 different sleeve concepts", "Create a decision matrix", "Select best concept with justification", "Plan your prototype"] },
        { phase: "Create", tasks: ["Build a prototype from chosen materials", "Test insulation with hot water", "Get feedback from Rosa", "Iterate on your design"] },
        { phase: "Evaluate", tasks: ["Test with 5 real customers", "Measure temperature retention", "Compare to existing solutions", "Present findings to Rosa"] },
      ],
    },
  },
  {
    id: "teacher",
    name: "Mr. Okafor",
    emoji: "👨‍🏫",
    x: 7, y: 6,
    color: "#7eb8da",
    hasQuest: true,
    questAccepted: false,
    dialogue: [
      { speaker: "Mr. Okafor", text: "Welcome to Designville! I teach at the local school.", mood: "friendly" },
      { speaker: "Mr. Okafor", text: "My Year 3 students can never find the right books in our library. The labeling system is a nightmare.", mood: "frustrated" },
      { speaker: "Mr. Okafor", text: "I need a better wayfinding system — something visual that even the youngest kids can follow.", mood: "thinking" },
      { speaker: "Mr. Okafor", text: "Would you take this on? It's a real problem that affects hundreds of students every day.", mood: "hopeful" },
    ],
    quest: {
      title: "Lost in the Library",
      brief: "Design a wayfinding system for the school library that young students can navigate independently",
      client: "Mr. Okafor",
      phases: [
        { phase: "Inquire", tasks: ["Observe students using the library", "Survey students on pain points", "Analyze existing wayfinding systems", "Research color-coding and iconography"] },
        { phase: "Develop", tasks: ["Create 3 wayfinding concepts", "Test concepts with Year 3 focus group", "Develop signage prototypes", "Plan implementation"] },
        { phase: "Create", tasks: ["Design final signage set", "Build physical prototypes", "Install test section in library", "Document the process"] },
        { phase: "Evaluate", tasks: ["Time students finding books before/after", "Gather teacher feedback", "Assess durability and visibility", "Write recommendations for Mr. Okafor"] },
      ],
    },
  },
  {
    id: "farmer",
    name: "Auntie Mei",
    emoji: "👩‍🌾",
    x: 20, y: 3,
    color: "#a8d5a2",
    hasQuest: true,
    questAccepted: false,
    dialogue: [
      { speaker: "Auntie Mei", text: "Hello dear! I grow vegetables in my garden across the bridge.", mood: "friendly" },
      { speaker: "Auntie Mei", text: "But I'm getting older, and bending down to check on my plants is getting harder every season.", mood: "sad" },
      { speaker: "Auntie Mei", text: "I wish someone could design a raised garden system that I could manage from a wheelchair.", mood: "hopeful" },
      { speaker: "Auntie Mei", text: "It needs to be affordable, easy to assemble, and fit in my small courtyard. Can you help?", mood: "hopeful" },
    ],
    quest: {
      title: "Growing Without Bending",
      brief: "Design an accessible raised garden bed system for elderly and wheelchair-bound gardeners",
      client: "Auntie Mei",
      phases: [
        { phase: "Inquire", tasks: ["Interview Auntie Mei about her needs", "Research accessible garden designs", "Measure courtyard dimensions", "Study ergonomic reach zones"] },
        { phase: "Develop", tasks: ["Sketch modular bed concepts", "Calculate material costs", "Choose between wood/metal/recycled materials", "Create detailed plans"] },
        { phase: "Create", tasks: ["Build scale model", "Test wheelchair accessibility", "Add irrigation features", "Get feedback from Auntie Mei"] },
        { phase: "Evaluate", tasks: ["Test with actual planting", "Check structural stability", "Assess water drainage", "Present to local community garden"] },
      ],
    },
  },
  {
    id: "kid",
    name: "Tomás",
    emoji: "🧒",
    x: 15, y: 6,
    color: "#f0c27a",
    hasQuest: false,
    dialogue: [
      { speaker: "Tomás", text: "Hey! I'm just exploring. Did you know Rosa's coffee cups burn everyone's hands?", mood: "excited" },
      { speaker: "Tomás", text: "And Mr. Okafor's library is so confusing — I can never find the comic books section!", mood: "playful" },
      { speaker: "Tomás", text: "I heard Auntie Mei needs help with her garden too. There are lots of problems to solve around here!", mood: "excited" },
    ],
  },
  {
    id: "mayor",
    name: "Mayor Lin",
    emoji: "🧑‍💼",
    x: 11, y: 15,
    color: "#c4b5e0",
    hasQuest: false,
    dialogue: [
      { speaker: "Mayor Lin", text: "Welcome to Designville, young designer! This village runs on creative problem-solving.", mood: "proud" },
      { speaker: "Mayor Lin", text: "Talk to the villagers — they all have real problems that need design solutions.", mood: "encouraging" },
      { speaker: "Mayor Lin", text: "Remember: good design starts with understanding the person you're designing for.", mood: "wise" },
    ],
  },
];

const PHASE_COLORS = { Inquire: "#6c8ebf", Develop: "#d4a843", Create: "#82b366", Evaluate: "#b85450" };
const PHASE_ICONS = { Inquire: "🔍", Develop: "✏️", Create: "🔨", Evaluate: "📊" };

export default function DesignQuestRPG() {
  const canvasRef = useRef(null);
  const [player, setPlayer] = useState({ x: 11, y: 16, dir: 0 }); // dir: 0=down,1=left,2=right,3=up
  const playerRef = useRef({ x: 11, y: 16, dir: 0 });
  const [camera, setCamera] = useState({ x: 11 * TILE, y: 16 * TILE });
  const camRef = useRef({ x: 11 * TILE, y: 16 * TILE });
  const keysRef = useRef({});
  const moveTimerRef = useRef(0);
  const frameRef = useRef(null);
  const [nearNPC, setNearNPC] = useState(null);
  const [dialogueState, setDialogueState] = useState(null); // { npcId, lineIndex }
  const [questLog, setQuestLog] = useState([]);
  const [showQuestLog, setShowQuestLog] = useState(false);
  const [showQuestDetail, setShowQuestDetail] = useState(null);
  const [npcStates, setNpcStates] = useState(() => {
    const s = {};
    NPCS.forEach(n => { s[n.id] = { questAccepted: false, talked: false }; });
    return s;
  });
  const [notification, setNotification] = useState(null);
  const [stepCount, setStepCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDir, setMobileDir] = useState(null);
  const mobileDirRef = useRef(null);

  useEffect(() => { setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0); }, []);

  const showNotif = useCallback((text, icon = "📜") => {
    setNotification({ text, icon });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ── CANVAS RENDERING ───────────────────────────────────────
  const drawWorld = useCallback((ctx, w, h, time) => {
    const p = playerRef.current;
    const cam = camRef.current;

    // Target camera
    const targetCamX = p.x * TILE + TILE / 2 - w / 2;
    const targetCamY = p.y * TILE + TILE / 2 - h / 2;
    cam.x += (targetCamX - cam.x) * CAM_SMOOTH;
    cam.y += (targetCamY - cam.y) * CAM_SMOOTH;

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Draw tiles
    const startCol = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const endCol = Math.min(COLS, Math.ceil((cam.x + w) / TILE) + 1);
    const startRow = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const endRow = Math.min(ROWS, Math.ceil((cam.y + h) / TILE) + 1);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tile = MAP[r]?.[c] ?? 0;
        const tx = c * TILE;
        const ty = r * TILE;

        ctx.fillStyle = TILE_COLORS[tile] || "#333";
        ctx.fillRect(tx, ty, TILE, TILE);

        // Tile details
        if (tile === 0 || tile === 8) {
          // Grass texture dots
          ctx.fillStyle = tile === 8 ? "#356130" : "#437536";
          for (let d = 0; d < 3; d++) {
            const dx = (c * 7 + d * 13 + r * 3) % 30 + 5;
            const dy = (r * 11 + d * 7 + c * 5) % 30 + 5;
            ctx.fillRect(tx + dx, ty + dy, 2, 2);
          }
        } else if (tile === 5) {
          // Flowers
          const colors = ["#e8647c", "#f0c27a", "#b07cc6", "#fff"];
          for (let f = 0; f < 3; f++) {
            ctx.fillStyle = colors[(c + r + f) % colors.length];
            const fx = tx + 8 + ((f * 13 + c * 7) % 24);
            const fy = ty + 8 + ((f * 11 + r * 5) % 24);
            ctx.beginPath();
            ctx.arc(fx, fy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (tile === 4) {
          // Trees
          ctx.fillStyle = "#1a4a14";
          ctx.beginPath();
          ctx.arc(tx + TILE / 2, ty + TILE / 2 - 4, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#226b1a";
          ctx.beginPath();
          ctx.arc(tx + TILE / 2 - 3, ty + TILE / 2 - 7, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#5a3a1a";
          ctx.fillRect(tx + TILE / 2 - 3, ty + TILE / 2 + 6, 6, 10);
        } else if (tile === 2) {
          // Water animation
          ctx.fillStyle = `rgba(100,180,255,${0.08 + Math.sin(time * 2 + c * 0.5 + r * 0.3) * 0.05})`;
          ctx.fillRect(tx, ty, TILE, TILE);
          // Ripples
          ctx.strokeStyle = "rgba(150,210,255,0.15)";
          ctx.lineWidth = 1;
          const rx = tx + TILE / 2 + Math.sin(time + c) * 8;
          const ry = ty + TILE / 2 + Math.cos(time * 0.7 + r) * 6;
          ctx.beginPath();
          ctx.arc(rx, ry, 4 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (tile === 6) {
          // Bridge planks
          ctx.fillStyle = "#6b5030";
          for (let pl = 0; pl < 4; pl++) {
            ctx.fillRect(tx + 2, ty + pl * 10 + 2, TILE - 4, 8);
          }
          ctx.fillStyle = "#8b7050";
          ctx.fillRect(tx, ty, 3, TILE);
          ctx.fillRect(tx + TILE - 3, ty, 3, TILE);
        } else if (tile === 3) {
          // Wall with texture
          ctx.fillStyle = "#4a4a5e";
          ctx.fillRect(tx + 2, ty + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = "#55556a";
          ctx.fillRect(tx + 4, ty + 4, TILE / 2 - 4, TILE / 2 - 4);
          ctx.fillRect(tx + TILE / 2, ty + TILE / 2, TILE / 2 - 4, TILE / 2 - 4);
        } else if (tile === 9) {
          // Door
          ctx.fillStyle = "#8b5e3c";
          ctx.fillRect(tx + 6, ty + 2, TILE - 12, TILE - 4);
          ctx.fillStyle = "#a0714a";
          ctx.fillRect(tx + 8, ty + 4, TILE - 16, TILE - 8);
          ctx.fillStyle = "#d4a843";
          ctx.beginPath();
          ctx.arc(tx + TILE - 14, ty + TILE / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 7) {
          // Sand texture
          ctx.fillStyle = "#c8b888";
          for (let d = 0; d < 4; d++) {
            const dx = (c * 9 + d * 11) % 32 + 4;
            const dy = (r * 7 + d * 13) % 32 + 4;
            ctx.fillRect(tx + dx, ty + dy, 1, 1);
          }
        }

        // Grid lines (subtle)
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.strokeRect(tx, ty, TILE, TILE);
      }
    }

    // Draw NPCs
    NPCS.forEach(npc => {
      const nx = npc.x * TILE;
      const ny = npc.y * TILE;
      const state = npcStates[npc.id];

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(nx + TILE / 2, ny + TILE - 4, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body bob
      const bob = Math.sin(time * 2 + npc.x) * 1.5;

      // NPC body
      ctx.fillStyle = npc.color;
      ctx.beginPath();
      ctx.arc(nx + TILE / 2, ny + TILE / 2 - 2 + bob, 14, 0, Math.PI * 2);
      ctx.fill();

      // Emoji face
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(npc.emoji, nx + TILE / 2, ny + TILE / 2 + 5 + bob);

      // Quest indicator
      if (npc.hasQuest && !state.questAccepted) {
        const bounce = Math.sin(time * 4) * 3;
        ctx.fillStyle = "#f0c41b";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("!", nx + TILE / 2, ny - 8 + bounce);
        // Glow
        ctx.beginPath();
        ctx.arc(nx + TILE / 2, ny - 12 + bounce, 10, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(240,196,27,0.15)";
        ctx.fill();
      } else if (npc.hasQuest && state.questAccepted) {
        ctx.fillStyle = "#7ecf8a";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("✓", nx + TILE / 2, ny - 6);
      }

      // Name tag
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const nameWidth = ctx.measureText(npc.name).width;
      ctx.fillRect(nx + TILE / 2 - nameWidth / 2 - 4, ny - 22, nameWidth + 8, 14);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(npc.name, nx + TILE / 2, ny - 12);
    });

    // Draw player
    const px = p.x * TILE;
    const py = p.y * TILE;
    const walkBob = Math.sin(time * 8) * 1;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(px + TILE / 2, py + TILE - 3, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = "#e94560";
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2 - 2 + walkBob, 13, 0, Math.PI * 2);
    ctx.fill();

    // Face direction indicator
    const dirs = [[0, 6], [-6, 0], [6, 0], [0, -6]];
    const [dx, dy] = dirs[p.dir];
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px + TILE / 2 + dx * 0.6, py + TILE / 2 - 2 + dy * 0.6 + walkBob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.arc(px + TILE / 2 + dx * 0.8, py + TILE / 2 - 2 + dy * 0.8 + walkBob, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // "You" label
    ctx.fillStyle = "#e94560";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YOU", px + TILE / 2, py - 8);

    // Interaction prompt
    if (nearNPC && !dialogueState) {
      const nn = NPCS.find(n => n.id === nearNPC);
      if (nn) {
        const promptY = nn.y * TILE + TILE + 16;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        const pw = 120;
        const ph = 22;
        const prx = nn.x * TILE + TILE / 2 - pw / 2;
        ctx.roundRect(prx, promptY, pw, ph, 6);
        ctx.fill();
        ctx.fillStyle = "#f0c41b";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(isMobile ? "TAP 💬 TO TALK" : "PRESS E TO TALK", nn.x * TILE + TILE / 2, promptY + 15);
      }
    }

    ctx.restore();
  }, [nearNPC, dialogueState, npcStates, isMobile]);

  // ── GAME LOOP ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let time = 0;
    const loop = () => {
      frameRef.current = requestAnimationFrame(loop);
      time += 0.016;

      const w = canvas.width = canvas.parentElement.clientWidth;
      const h = canvas.height = canvas.parentElement.clientHeight;

      // Movement
      if (!dialogueState) {
        moveTimerRef.current -= 1;
        if (moveTimerRef.current <= 0) {
          const k = keysRef.current;
          const md = mobileDirRef.current;
          let dx = 0, dy = 0, dir = playerRef.current.dir;

          if (k["w"] || k["arrowup"] || md === "up") { dy = -1; dir = 3; }
          else if (k["s"] || k["arrowdown"] || md === "down") { dy = 1; dir = 0; }
          else if (k["a"] || k["arrowleft"] || md === "left") { dx = -1; dir = 1; }
          else if (k["d"] || k["arrowright"] || md === "right") { dx = 1; dir = 2; }

          if (dx || dy) {
            const nx = playerRef.current.x + dx;
            const ny = playerRef.current.y + dy;
            const tile = MAP[ny]?.[nx];

            // Check NPC collision
            const npcBlock = NPCS.some(n => n.x === nx && n.y === ny);

            if (tile !== undefined && !SOLID_TILES.has(tile) && !npcBlock) {
              playerRef.current = { x: nx, y: ny, dir };
              setPlayer({ x: nx, y: ny, dir });
              setStepCount(s => s + 1);
              moveTimerRef.current = 6;
            } else {
              playerRef.current = { ...playerRef.current, dir };
              setPlayer(prev => ({ ...prev, dir }));
              moveTimerRef.current = 4;
            }
          }
        }
      }

      // NPC proximity check
      const p = playerRef.current;
      let closest = null;
      NPCS.forEach(npc => {
        const dist = Math.abs(npc.x - p.x) + Math.abs(npc.y - p.y);
        if (dist <= 2) closest = npc.id;
      });
      setNearNPC(closest);

      // Clear & draw
      ctx.clearRect(0, 0, w, h);
      drawWorld(ctx, w, h, time);
    };

    loop();
    return () => cancelAnimationFrame(frameRef.current);
  }, [drawWorld, dialogueState]);

  // ── INPUT ──────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "e" || e.key === " ") {
        handleInteract();
      }
    };
    const onUp = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [nearNPC, dialogueState, npcStates]);

  const handleInteract = useCallback(() => {
    if (dialogueState) {
      // Advance dialogue
      const npc = NPCS.find(n => n.id === dialogueState.npcId);
      if (!npc) return;
      const nextLine = dialogueState.lineIndex + 1;
      if (nextLine < npc.dialogue.length) {
        setDialogueState({ npcId: npc.id, lineIndex: nextLine });
      } else {
        // End of dialogue
        if (npc.hasQuest && !npcStates[npc.id].questAccepted) {
          // Show quest offer
          setDialogueState({ npcId: npc.id, lineIndex: -1, questOffer: true });
        } else {
          setDialogueState(null);
          setNpcStates(prev => ({ ...prev, [npc.id]: { ...prev[npc.id], talked: true } }));
        }
      }
    } else if (nearNPC) {
      // Start dialogue
      setDialogueState({ npcId: nearNPC, lineIndex: 0 });
    }
  }, [dialogueState, nearNPC, npcStates]);

  const acceptQuest = useCallback((npcId) => {
    const npc = NPCS.find(n => n.id === npcId);
    if (!npc || !npc.quest) return;
    setNpcStates(prev => ({ ...prev, [npcId]: { ...prev[npcId], questAccepted: true } }));
    setQuestLog(prev => [...prev, { ...npc.quest, npcId, acceptedAt: Date.now() }]);
    setDialogueState(null);
    showNotif(`New Quest: ${npc.quest.title}`);
  }, [showNotif]);

  const declineQuest = useCallback(() => {
    setDialogueState(null);
  }, []);

  const currentDialogue = dialogueState ? NPCS.find(n => n.id === dialogueState.npcId) : null;

  return (
    <div style={{ height: "100vh", background: "#1a1a2e", fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Canvas */}
      <div ref={canvasRef && undefined} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated" }} />
      </div>

      {/* HUD - Top */}
      <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none", zIndex: 10 }}>
        <div style={{ background: "rgba(10,10,20,0.8)", backdropFilter: "blur(6px)", borderRadius: 8, padding: "6px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Designville</div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>Steps: {stepCount}</div>
        </div>

        <button onClick={() => setShowQuestLog(!showQuestLog)}
          style={{ pointerEvents: "auto", background: questLog.length ? "rgba(233,69,96,0.15)" : "rgba(10,10,20,0.8)", backdropFilter: "blur(6px)", border: questLog.length ? "1px solid #e9456044" : "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 12px", color: "#e8e0d4", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          📋 Quests {questLog.length > 0 && <span style={{ background: "#e94560", color: "#fff", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>{questLog.length}</span>}
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{ position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,20,0.9)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px 18px", color: "#f0c41b", fontSize: 13, fontWeight: 600, border: "1px solid rgba(240,196,27,0.2)", display: "flex", alignItems: "center", gap: 8, zIndex: 20, whiteSpace: "nowrap" }}>
          {notification.icon} {notification.text}
        </div>
      )}

      {/* Dialogue Box */}
      {dialogueState && currentDialogue && (
        <div style={{ position: "absolute", bottom: isMobile ? 110 : 16, left: 12, right: 12, zIndex: 30 }}>
          {dialogueState.questOffer ? (
            // Quest offer
            <div style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", borderRadius: 14, border: "1px solid rgba(240,196,27,0.2)", overflow: "hidden", maxWidth: 420, margin: "0 auto" }}>
              <div style={{ padding: "12px 16px", background: "rgba(240,196,27,0.08)", borderBottom: "1px solid rgba(240,196,27,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#f0c41b", fontWeight: 700 }}>New Quest Available</span>
                </div>
                <h3 style={{ fontSize: 16, color: "#f0e6d3", margin: "6px 0 2px", fontWeight: 600 }}>{currentDialogue.quest.title}</h3>
                <p style={{ fontSize: 11, color: "#999", margin: 0 }}>From: {currentDialogue.name}</p>
              </div>
              <div style={{ padding: "10px 16px" }}>
                <p style={{ fontSize: 12, color: "#bbb", lineHeight: 1.6, margin: "0 0 12px" }}>{currentDialogue.quest.brief}</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {currentDialogue.quest.phases.map(p => (
                    <span key={p.phase} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: PHASE_COLORS[p.phase] + "22", color: PHASE_COLORS[p.phase], fontWeight: 700, letterSpacing: 1 }}>
                      {PHASE_ICONS[p.phase]} {p.phase.toUpperCase()}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => acceptQuest(dialogueState.npcId)} style={{ flex: 1, padding: "10px 0", background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Accept Quest</button>
                  <button onClick={declineQuest} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.06)", color: "#888", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Not yet</button>
                </div>
              </div>
            </div>
          ) : (
            // Normal dialogue
            <div onClick={handleInteract} style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", maxWidth: 420, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{currentDialogue.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: currentDialogue.color }}>{currentDialogue.dialogue[dialogueState.lineIndex]?.speaker}</span>
                {currentDialogue.dialogue[dialogueState.lineIndex]?.mood && (
                  <span style={{ fontSize: 10, color: "#666", fontStyle: "italic" }}>({currentDialogue.dialogue[dialogueState.lineIndex].mood})</span>
                )}
              </div>
              <p style={{ fontSize: 14, color: "#e8e0d4", lineHeight: 1.7, margin: "0 0 8px" }}>
                {currentDialogue.dialogue[dialogueState.lineIndex]?.text}
              </p>
              <div style={{ textAlign: "right", fontSize: 10, color: "#555" }}>
                {dialogueState.lineIndex + 1} / {currentDialogue.dialogue.length} — {isMobile ? "tap" : "press E"} to continue ▶
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quest Log Panel */}
      {showQuestLog && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowQuestLog(false); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <div style={{ background: "#12122a", borderRadius: 16, width: "100%", maxWidth: 400, maxHeight: "80vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#12122a", zIndex: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#f0e6d3" }}>📋 Quest Journal</h2>
              <button onClick={() => setShowQuestLog(false)} style={{ background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {questLog.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#555" }}>
                <p style={{ fontSize: 32, margin: "0 0 8px" }}>🗺️</p>
                <p style={{ fontSize: 13, margin: 0 }}>No quests yet. Talk to villagers with <span style={{ color: "#f0c41b" }}>!</span> above their heads!</p>
              </div>
            ) : (
              <div style={{ padding: 12 }}>
                {showQuestDetail ? (
                  // Quest detail view
                  <div>
                    <button onClick={() => setShowQuestDetail(null)} style={{ background: "none", border: "none", color: "#e94560", cursor: "pointer", fontSize: 12, padding: 0, marginBottom: 10 }}>← All Quests</button>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0e6d3", margin: "0 0 4px" }}>{showQuestDetail.title}</h3>
                    <p style={{ fontSize: 11, color: "#888", margin: "0 0 12px" }}>Client: {showQuestDetail.client}</p>
                    <p style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6, margin: "0 0 16px" }}>{showQuestDetail.brief}</p>

                    {showQuestDetail.phases.map((phase, pi) => (
                      <div key={phase.phase} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>{PHASE_ICONS[phase.phase]}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: PHASE_COLORS[phase.phase] }}>{phase.phase}</span>
                          <div style={{ flex: 1, height: 1, background: PHASE_COLORS[phase.phase] + "33" }} />
                        </div>
                        {phase.tasks.map((task, ti) => (
                          <div key={ti} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0 4px 24px" }}>
                            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${PHASE_COLORS[phase.phase]}44`, flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontSize: 12, color: "#999", lineHeight: 1.4 }}>{task}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Quest list
                  questLog.map((q, i) => (
                    <div key={i} onClick={() => setShowQuestDetail(q)} style={{ padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 10, marginBottom: 8, border: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, color: "#f0e6d3", margin: "0 0 4px" }}>{q.title}</h4>
                      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>{q.client} • {q.brief.slice(0, 60)}…</p>
                      <div style={{ display: "flex", gap: 4 }}>
                        {q.phases.map(p => (
                          <span key={p.phase} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: PHASE_COLORS[p.phase] + "22", color: PHASE_COLORS[p.phase], fontWeight: 700 }}>
                            {PHASE_ICONS[p.phase]} {p.phase}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && !dialogueState && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end", pointerEvents: "none", zIndex: 20 }}>
          {/* D-pad */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pointerEvents: "auto" }}>
            <button onTouchStart={() => { mobileDirRef.current = "up"; setMobileDir("up"); }} onTouchEnd={() => { mobileDirRef.current = null; setMobileDir(null); }}
              style={{ width: 50, height: 50, borderRadius: 10, background: mobileDir === "up" ? "rgba(233,69,96,0.4)" : "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
            <div style={{ display: "flex", gap: 2 }}>
              <button onTouchStart={() => { mobileDirRef.current = "left"; setMobileDir("left"); }} onTouchEnd={() => { mobileDirRef.current = null; setMobileDir(null); }}
                style={{ width: 50, height: 50, borderRadius: 10, background: mobileDir === "left" ? "rgba(233,69,96,0.4)" : "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
              <div style={{ width: 50, height: 50 }} />
              <button onTouchStart={() => { mobileDirRef.current = "right"; setMobileDir("right"); }} onTouchEnd={() => { mobileDirRef.current = null; setMobileDir(null); }}
                style={{ width: 50, height: 50, borderRadius: 10, background: mobileDir === "right" ? "rgba(233,69,96,0.4)" : "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
            </div>
            <button onTouchStart={() => { mobileDirRef.current = "down"; setMobileDir("down"); }} onTouchEnd={() => { mobileDirRef.current = null; setMobileDir(null); }}
              style={{ width: 50, height: 50, borderRadius: 10, background: mobileDir === "down" ? "rgba(233,69,96,0.4)" : "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, pointerEvents: "auto" }}>
            {nearNPC && (
              <button onClick={handleInteract}
                style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(240,196,27,0.2)", border: "2px solid #f0c41b", color: "#f0c41b", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>💬</button>
            )}
          </div>
        </div>
      )}

      {/* Desktop hint */}
      {!isMobile && !dialogueState && (
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 12, alignItems: "center", zIndex: 10 }}>
          {[["WASD", "Move"], ["E", "Talk"]].map(([key, label]) => (
            <span key={key} style={{ fontSize: 10, color: "#555", background: "rgba(10,10,20,0.7)", padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
              <strong style={{ color: "#888" }}>{key}</strong> {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
