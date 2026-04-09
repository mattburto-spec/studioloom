import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

const AVATAR_COLORS = [
  { id: "red", hex: "#e94560", name: "Ruby" },
  { id: "blue", hex: "#4fc3f7", name: "Sapphire" },
  { id: "green", hex: "#7ecf8a", name: "Emerald" },
  { id: "orange", hex: "#ff8a65", name: "Amber" },
  { id: "purple", hex: "#b07cc6", name: "Amethyst" },
  { id: "gold", hex: "#d4a843", name: "Gold" },
];

const PROJECTS = [
  { title: "Bluetooth Speaker", student: "Alex C.", phase: "Create", color: "#e94560", desc: "Wood & acrylic enclosure with parametric finger joints. Full 12-week Design Cycle project.", grade: "A" },
  { title: "Sustainable Packaging", student: "Maya R.", phase: "Evaluate", color: "#7ecf8a", desc: "Biodegradable packaging solution for school cafeteria takeaway meals.", grade: "A-" },
  { title: "Chess Manufacturing", student: "Jordan L.", phase: "Create", color: "#6c8ebf", desc: "Injection molding vs 3D printing analysis for mass-production.", grade: "B+" },
  { title: "Desk Organizer", student: "Sam T.", phase: "Develop", color: "#d4a843", desc: "Ergonomic workspace optimization through research-driven design.", grade: "B" },
  { title: "Library App Redesign", student: "Priya K.", phase: "Develop", color: "#b07cc6", desc: "Accessibility-focused redesign of school library booking system.", grade: "A" },
  { title: "Water Filtration", student: "Leo W.", phase: "Inquire", color: "#4fc3f7", desc: "Low-cost filtration prototype for outdoor education trips.", grade: null },
  { title: "Modular Shelving", student: "Zoe M.", phase: "Create", color: "#ff8a65", desc: "CNC-cut plywood flat-pack shelving with tool-free assembly.", grade: "A-" },
  { title: "Braille Learning Tool", student: "Kai N.", phase: "Evaluate", color: "#aed581", desc: "3D-printed tactile cards for teaching braille to sighted peers.", grade: "A" },
];

const SIMULATED_PLAYERS = [
  { name: "Mrs. Chen", role: "parent", color: "#4fc3f7", chatMessages: ["Wow, amazing work!", "So proud of Alex!", "This is incredible", "Love the design process"], behavior: "wanderer" },
  { name: "Mr. Rodriguez", role: "parent", color: "#ff8a65", chatMessages: ["Great exhibition!", "Very impressive", "Love the detail here"], behavior: "art-lover" },
  { name: "Yuki S.", role: "student", color: "#b07cc6", chatMessages: ["Check out my project!", "Thanks for coming!", "haha nice avatar"], behavior: "social" },
  { name: "Ms. Park", role: "teacher", color: "#aed581", chatMessages: ["Excellent craftsmanship", "Strong inquiry phase", "Well done everyone"], behavior: "methodical" },
  { name: "David L.", role: "parent", color: "#d4a843", chatMessages: ["This is so cool!", "Jordan did great!", "What a gallery!"], behavior: "wanderer" },
];

const EMOJI_OPTIONS = ["❤️", "🔥", "👏", "⭐", "💡", "🎨"];

export default function MultiplayerGallery() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const playerRef = useRef({ x: 0, z: 8, angle: Math.PI, speed: 0.08, rotSpeed: 0.04 });
  const keysRef = useRef({});
  const artworksRef = useRef([]);
  const frameRef = useRef(null);
  const npcDataRef = useRef([]);
  const nameSpritesRef = useRef([]);
  const chatSpritesRef = useRef([]);
  const playerNameRef = useRef(null);
  const clockRef = useRef(0);
  const emojiSpritesRef = useRef([]);

  const [phase, setPhase] = useState("lobby"); // lobby | gallery
  const [playerName, setPlayerName] = useState("");
  const [playerColor, setPlayerColor] = useState(AVATAR_COLORS[0]);
  const [playerRole, setPlayerRole] = useState("visitor");
  const [nearWork, setNearWork] = useState(null);
  const [selectedWork, setSelectedWork] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [onlineCount, setOnlineCount] = useState(6);
  const [artReactions, setArtReactions] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileControls, setMobileControls] = useState({ forward: false, back: false, left: false, right: false });
  const mobileRef = useRef({ forward: false, back: false, left: false, right: false });
  const [showPlayerList, setShowPlayerList] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const updateMobile = (key, val) => {
    setMobileControls(prev => {
      const next = { ...prev, [key]: val };
      mobileRef.current = next;
      return next;
    });
  };

  // Show notification
  const showNotif = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Simulated player join/leave
  useEffect(() => {
    if (phase !== "gallery") return;
    const interval = setInterval(() => {
      const r = Math.random();
      if (r < 0.15) {
        setOnlineCount(c => Math.min(c + 1, 12));
        const names = ["Emma T.", "Li Wei", "Sarah K.", "Tom B."];
        showNotif(`${names[Math.floor(Math.random() * names.length)]} joined the gallery`);
      } else if (r < 0.2) {
        setOnlineCount(c => Math.max(c - 1, 4));
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [phase, showNotif]);

  // Simulated NPC chat
  useEffect(() => {
    if (phase !== "gallery") return;
    const interval = setInterval(() => {
      const npc = SIMULATED_PLAYERS[Math.floor(Math.random() * SIMULATED_PLAYERS.length)];
      const msg = npc.chatMessages[Math.floor(Math.random() * npc.chatMessages.length)];
      setChatLog(prev => [...prev.slice(-20), { name: npc.name, role: npc.role, color: npc.color, msg, time: Date.now() }]);
    }, 5000 + Math.random() * 6000);
    return () => clearInterval(interval);
  }, [phase]);

  // Simulated reactions
  useEffect(() => {
    if (phase !== "gallery") return;
    const interval = setInterval(() => {
      const projIdx = Math.floor(Math.random() * PROJECTS.length);
      const emoji = EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)];
      setArtReactions(prev => {
        const key = projIdx.toString();
        const existing = prev[key] || {};
        return { ...prev, [key]: { ...existing, [emoji]: (existing[emoji] || 0) + 1 } };
      });
    }, 4000 + Math.random() * 5000);
    return () => clearInterval(interval);
  }, [phase]);

  const createTextTexture = useCallback((text, subtext, color, w = 512, h = 512) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#13132a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    // Abstract art
    ctx.save();
    ctx.beginPath();
    ctx.rect(30, 30, w - 60, h * 0.48);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = color + (30 + i * 12).toString(16).padStart(2, "0");
      ctx.beginPath();
      ctx.arc(80 + Math.sin(i * 1.8) * 160, 100 + Math.cos(i * 2.3) * 80, 30 + i * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.28, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#13132a";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✦", w / 2, h * 0.28 + 10);
    ctx.restore();

    ctx.fillStyle = "#f0e6d3";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    const words = text.split(" ");
    let line = "", y = h * 0.6;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > w - 80 && line) {
        ctx.fillText(line.trim(), w / 2, y); line = word + " "; y += 32;
      } else line = test;
    }
    ctx.fillText(line.trim(), w / 2, y);
    ctx.fillStyle = color;
    ctx.font = "16px sans-serif";
    ctx.fillText(subtext, w / 2, y + 30);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, []);

  const createNameSprite = useCallback((name, role, color) => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = "rgba(10,10,20,0.75)";
    const rx = 8, rw = 240, rh = 48, ry2 = 8;
    ctx.beginPath();
    ctx.moveTo(rx + 8, ry2);
    ctx.lineTo(rx + rw - 8, ry2);
    ctx.quadraticCurveTo(rx + rw, ry2, rx + rw, ry2 + 8);
    ctx.lineTo(rx + rw, ry2 + rh - 8);
    ctx.quadraticCurveTo(rx + rw, ry2 + rh, rx + rw - 8, ry2 + rh);
    ctx.lineTo(rx + 8, ry2 + rh);
    ctx.quadraticCurveTo(rx, ry2 + rh, rx, ry2 + rh - 8);
    ctx.lineTo(rx, ry2 + 8);
    ctx.quadraticCurveTo(rx, ry2, rx + 8, ry2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, 128, 30);

    const roleColors = { parent: "#4fc3f7", student: "#7ecf8a", teacher: "#d4a843", visitor: "#e94560" };
    ctx.fillStyle = roleColors[role] || "#888";
    ctx.font = "12px sans-serif";
    ctx.fillText(role.toUpperCase(), 128, 48);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.8, 0.45, 1);
    return sprite;
  }, []);

  const createChatBubble = useCallback((text) => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 512, 96);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    const pad = 16;
    ctx.beginPath();
    ctx.moveTo(pad + 10, pad);
    ctx.lineTo(512 - pad - 10, pad);
    ctx.quadraticCurveTo(512 - pad, pad, 512 - pad, pad + 10);
    ctx.lineTo(512 - pad, 96 - pad - 10);
    ctx.quadraticCurveTo(512 - pad, 96 - pad, 512 - pad - 10, 96 - pad);
    ctx.lineTo(pad + 10, 96 - pad);
    ctx.quadraticCurveTo(pad, 96 - pad, pad, 96 - pad - 10);
    ctx.lineTo(pad, pad + 10);
    ctx.quadraticCurveTo(pad, pad, pad + 10, pad);
    ctx.fill();

    ctx.fillStyle = "#1a1a2e";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    const display = text.length > 28 ? text.slice(0, 26) + "…" : text;
    ctx.fillText(display, 256, 56);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.5, 0.5, 1);
    return sprite;
  }, []);

  const createAvatarMesh = useCallback((color) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), new THREE.MeshStandardMaterial({ color }));
    body.position.y = 0.55;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color }));
    head.position.y = 1.08;
    g.add(head);
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#fff" });
    [[-0.07, 1.12, -0.14], [0.07, 1.12, -0.14]].forEach(p => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(...p);
      g.add(eye);
    });
    return g;
  }, []);

  const initScene = useCallback(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#080814");
    scene.fog = new THREE.Fog("#080814", 10, 24);

    const camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 50);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight("#2a2a4a", 0.5));
    const dirLight = new THREE.DirectionalLight("#ffeedd", 0.3);
    dirLight.position.set(0, 8, 0);
    scene.add(dirLight);

    const RW = 18, RL = 22, RH = 4.5;

    // Floor with checker pattern
    const floorCanvas = document.createElement("canvas");
    floorCanvas.width = 512; floorCanvas.height = 512;
    const fctx = floorCanvas.getContext("2d");
    const tileSize = 64;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        fctx.fillStyle = (r + c) % 2 === 0 ? "#18182e" : "#141428";
        fctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
      }
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RL), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RL), new THREE.MeshStandardMaterial({ color: "#0c0c18" }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = RH;
    scene.add(ceil);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: "#14142a", roughness: 0.8 });
    [
      { w: RW, pos: [0, RH / 2, -RL / 2], rot: [0, 0, 0] },
      { w: RW, pos: [0, RH / 2, RL / 2], rot: [0, Math.PI, 0] },
      { w: RL, pos: [-RW / 2, RH / 2, 0], rot: [0, Math.PI / 2, 0] },
      { w: RL, pos: [RW / 2, RH / 2, 0], rot: [0, -Math.PI / 2, 0] },
    ].forEach(c => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(c.w, RH), wallMat);
      wall.position.set(...c.pos);
      wall.rotation.set(...c.rot);
      scene.add(wall);
    });

    // Artworks
    const artworks = [];
    const positions = [
      { x: -8.9, z: -7, ry: Math.PI / 2 },
      { x: -8.9, z: -2, ry: Math.PI / 2 },
      { x: -8.9, z: 3, ry: Math.PI / 2 },
      { x: -8.9, z: 8, ry: Math.PI / 2 },
      { x: 8.9, z: -7, ry: -Math.PI / 2 },
      { x: 8.9, z: -2, ry: -Math.PI / 2 },
      { x: 8.9, z: 3, ry: -Math.PI / 2 },
      { x: 8.9, z: 8, ry: -Math.PI / 2 },
    ];

    positions.forEach((pos, i) => {
      if (i >= PROJECTS.length) return;
      const p = PROJECTS[i];
      const tex = createTextTexture(p.title, p.student + " • " + p.phase, p.color);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.08), new THREE.MeshStandardMaterial({ color: "#28283e", roughness: 0.4, metalness: 0.3 }));
      frame.position.set(pos.x, 2.2, pos.z);
      frame.rotation.y = pos.ry;
      scene.add(frame);

      const art = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
      art.position.set(pos.x, 2.2, pos.z);
      art.rotation.y = pos.ry;
      art.translateZ(0.05);
      art.userData = { project: p, index: i };
      scene.add(art);
      artworks.push(art);

      const spot = new THREE.SpotLight(p.color, 2, 7, Math.PI / 5, 0.6);
      const offset = pos.ry > 0 ? 1.5 : pos.ry < 0 ? -1.5 : 0;
      spot.position.set(pos.x + offset, 4, pos.z);
      spot.target = frame;
      scene.add(spot);
      scene.add(spot.target);
    });
    artworksRef.current = artworks;

    // Center sculpture
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 0.5, 6), new THREE.MeshStandardMaterial({ color: "#20203a", roughness: 0.5, metalness: 0.2 }));
    pedestal.position.set(0, 0.25, 0);
    scene.add(pedestal);

    const torusKnot = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.15, 16, 48),
      new THREE.MeshStandardMaterial({ color: "#e94560", roughness: 0.2, metalness: 0.6 })
    );
    torusKnot.position.set(0, 1.2, 0);
    scene.add(torusKnot);

    // Pillars
    [[-4, -4], [4, -4], [-4, 5], [4, 5]].forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, RH, 8), new THREE.MeshStandardMaterial({ color: "#1e1e36", roughness: 0.6 }));
      pillar.position.set(px, RH / 2, pz);
      scene.add(pillar);
      const pillarLight = new THREE.PointLight("#e9456030", 0.5, 4);
      pillarLight.position.set(px, RH - 0.3, pz);
      scene.add(pillarLight);
    });

    // Player avatar
    const playerAvatar = createAvatarMesh(playerColor.hex);
    playerAvatar.position.set(playerRef.current.x, 0, playerRef.current.z);
    scene.add(playerAvatar);

    const pNameSprite = createNameSprite(playerName || "You", playerRole, playerColor.hex);
    pNameSprite.position.y = 1.55;
    playerAvatar.add(pNameSprite);
    playerNameRef.current = playerAvatar;

    // NPC avatars
    const npcs = [];
    SIMULATED_PLAYERS.forEach((sp, i) => {
      const angle = (i / SIMULATED_PLAYERS.length) * Math.PI * 2;
      const startX = Math.sin(angle) * 5;
      const startZ = Math.cos(angle) * 4;

      const avatar = createAvatarMesh(sp.color);
      avatar.position.set(startX, 0, startZ);
      avatar.rotation.y = angle;
      scene.add(avatar);

      const nameSprite = createNameSprite(sp.name, sp.role, sp.color);
      nameSprite.position.y = 1.55;
      avatar.add(nameSprite);

      // Targets for art-lover behavior
      const targets = positions.map(p => ({ x: p.x + (p.ry > 0 ? 2 : p.ry < 0 ? -2 : 0), z: p.z }));

      npcs.push({
        mesh: avatar,
        data: sp,
        x: startX,
        z: startZ,
        targetX: startX,
        targetZ: startZ,
        angle: angle,
        phase: i * 1.7,
        speed: 0.015 + Math.random() * 0.01,
        targets,
        currentTarget: Math.floor(Math.random() * targets.length),
        waitTimer: Math.random() * 200,
        chatBubble: null,
        chatTimer: 0,
      });
    });
    npcDataRef.current = npcs;

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;
      clockRef.current = time;
      const p = playerRef.current;
      const k = keysRef.current;
      const m = mobileRef.current;

      const forward = k["w"] || k["arrowup"] || m.forward;
      const back = k["s"] || k["arrowdown"] || m.back;
      const left = k["a"] || k["arrowleft"] || m.left;
      const right = k["d"] || k["arrowright"] || m.right;

      if (left) p.angle += p.rotSpeed;
      if (right) p.angle -= p.rotSpeed;
      if (forward) { p.x += Math.sin(p.angle) * p.speed; p.z += Math.cos(p.angle) * p.speed; }
      if (back) { p.x -= Math.sin(p.angle) * p.speed * 0.6; p.z -= Math.cos(p.angle) * p.speed * 0.6; }
      p.x = Math.max(-8.2, Math.min(8.2, p.x));
      p.z = Math.max(-10.2, Math.min(10.2, p.z));

      playerAvatar.position.set(p.x, 0, p.z);
      playerAvatar.rotation.y = p.angle;

      // Bob animation
      if (forward || back) {
        playerAvatar.position.y = Math.sin(time * 8) * 0.03;
      }

      const camDist = 3.8, camH = 3;
      camera.position.set(p.x - Math.sin(p.angle) * camDist, camH, p.z - Math.cos(p.angle) * camDist);
      camera.lookAt(p.x, 1.2, p.z);

      // Rotate sculpture
      torusKnot.rotation.x = time * 0.3;
      torusKnot.rotation.y = time * 0.5;

      // NPC AI
      npcs.forEach(npc => {
        npc.waitTimer -= 1;
        if (npc.waitTimer <= 0) {
          const t = npc.targets[npc.currentTarget];
          npc.targetX = t.x + (Math.random() - 0.5) * 2;
          npc.targetZ = t.z + (Math.random() - 0.5) * 2;
          npc.targetX = Math.max(-7.5, Math.min(7.5, npc.targetX));
          npc.targetZ = Math.max(-9.5, Math.min(9.5, npc.targetZ));
        }

        const dx = npc.targetX - npc.x;
        const dz = npc.targetZ - npc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.3) {
          npc.x += dx * npc.speed;
          npc.z += dz * npc.speed;
          npc.angle = Math.atan2(dx, dz);
          npc.mesh.position.y = Math.sin(time * 6 + npc.phase) * 0.02;
        } else if (npc.waitTimer <= 0) {
          npc.waitTimer = 150 + Math.random() * 300;
          npc.currentTarget = (npc.currentTarget + 1) % npc.targets.length;
        }

        npc.mesh.position.x = npc.x;
        npc.mesh.position.z = npc.z;
        npc.mesh.rotation.y = npc.angle;

        // Chat bubble management
        if (npc.chatTimer > 0) {
          npc.chatTimer -= 1;
          if (npc.chatTimer <= 0 && npc.chatBubble) {
            npc.mesh.remove(npc.chatBubble);
            npc.chatBubble = null;
          }
        } else if (Math.random() < 0.001) {
          if (npc.chatBubble) npc.mesh.remove(npc.chatBubble);
          const msg = npc.data.chatMessages[Math.floor(Math.random() * npc.data.chatMessages.length)];
          const bubble = createChatBubble(msg);
          bubble.position.y = 1.9;
          npc.mesh.add(bubble);
          npc.chatBubble = bubble;
          npc.chatTimer = 180;
        }
      });

      // Proximity
      let closest = null, closestDist = 3.5;
      artworks.forEach(art => {
        const adx = art.position.x - p.x;
        const adz = art.position.z - p.z;
        const d = Math.sqrt(adx * adx + adz * adz);
        if (d < closestDist) { closestDist = d; closest = art.userData.project; }
      });
      setNearWork(closest);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth, nh = mountRef.current.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [playerName, playerColor, playerRole, createTextTexture, createNameSprite, createChatBubble, createAvatarMesh]);

  useEffect(() => {
    if (phase !== "gallery") return;
    const cleanup = initScene();
    const onDown = e => { keysRef.current[e.key.toLowerCase()] = true; };
    const onUp = e => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); if (cleanup) cleanup(); };
  }, [phase, initScene]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChatLog(prev => [...prev.slice(-20), { name: playerName || "You", role: playerRole, color: playerColor.hex, msg: chatInput.trim(), time: Date.now(), isMe: true }]);
    setChatInput("");
  };

  const addReaction = (emoji) => {
    if (!nearWork) return;
    const idx = PROJECTS.findIndex(p => p.title === nearWork.title).toString();
    setArtReactions(prev => {
      const existing = prev[idx] || {};
      return { ...prev, [idx]: { ...existing, [emoji]: (existing[emoji] || 0) + 1 } };
    });
    setShowEmojiPicker(false);
  };

  // ── LOBBY ──
  if (phase === "lobby") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #080814 0%, #14142a 100%)", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#f0e6d3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, background: "repeating-conic-gradient(#e94560 0% 25%, transparent 0% 50%) 0 0 / 40px 40px" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 400, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <div style={{ fontSize: 11, letterSpacing: 6, color: "#e94560", textTransform: "uppercase", marginBottom: 6 }}>StudioLoom</div>
            <h1 style={{ fontSize: 26, fontWeight: 200, margin: "0 0 4px", letterSpacing: 2 }}>Exhibition Night</h1>
            <p style={{ fontSize: 12, color: "#666" }}>MYP Design Gallery • {onlineCount} online</p>
            <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 10 }}>
              {Array.from({ length: Math.min(onlineCount, 8) }).map((_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < 5 ? SIMULATED_PLAYERS[i % 5].color : "#555", opacity: 0.7 }} />
              ))}
              {onlineCount > 8 && <span style={{ fontSize: 10, color: "#555", marginLeft: 4 }}>+{onlineCount - 8}</span>}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#666", display: "block", marginBottom: 6 }}>Your Name</label>
            <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Enter your name" maxLength={16}
              style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f0e6d3", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
          </div>

          {/* Role */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#666", display: "block", marginBottom: 6 }}>I am a…</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "visitor", label: "🚪 Visitor" }, { id: "parent", label: "👨‍👩‍👧 Parent" }, { id: "student", label: "🎒 Student" }, { id: "teacher", label: "📚 Teacher" }].map(r => (
                <button key={r.id} onClick={() => setPlayerRole(r.id)}
                  style={{ flex: 1, padding: "10px 4px", background: playerRole === r.id ? "rgba(233,69,96,0.15)" : "rgba(255,255,255,0.03)", border: playerRole === r.id ? "1px solid #e94560" : "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: playerRole === r.id ? "#e94560" : "#888", fontSize: 11, cursor: "pointer", fontWeight: playerRole === r.id ? 600 : 400 }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar Color */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#666", display: "block", marginBottom: 6 }}>Avatar Color</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {AVATAR_COLORS.map(c => (
                <button key={c.id} onClick={() => setPlayerColor(c)}
                  style={{ width: 44, height: 44, borderRadius: "50%", background: c.hex, border: playerColor.id === c.id ? "3px solid #fff" : "3px solid transparent", cursor: "pointer", boxShadow: playerColor.id === c.id ? `0 0 16px ${c.hex}66` : "none", transition: "all 0.2s" }} />
              ))}
            </div>
            <p style={{ textAlign: "center", fontSize: 11, color: playerColor.hex, marginTop: 6 }}>{playerColor.name}</p>
          </div>

          <button onClick={() => { if (playerName.trim()) setPhase("gallery"); }}
            disabled={!playerName.trim()}
            style={{ width: "100%", padding: "14px 0", background: playerName.trim() ? "linear-gradient(135deg, #e94560, #c73e54)" : "#333", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: playerName.trim() ? "pointer" : "not-allowed", letterSpacing: 1, boxShadow: playerName.trim() ? "0 4px 20px rgba(233,69,96,0.3)" : "none" }}>
            Enter Gallery →
          </button>

          <p style={{ textAlign: "center", fontSize: 11, color: "#444", marginTop: 16 }}>
            {isMobile ? "On-screen controls to move" : "WASD / Arrow Keys to move • Enter to chat"}
          </p>
        </div>
      </div>
    );
  }

  // ── GALLERY ──
  return (
    <div style={{ height: "100vh", position: "relative", background: "#080814", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* HUD Top Bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(180deg, rgba(8,8,20,0.85) 0%, transparent 100%)", pointerEvents: "none" }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Exhibition Night</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>MYP Design Year 4</div>
        </div>
        <button onClick={() => setShowPlayerList(!showPlayerList)} style={{ pointerEvents: "auto", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px", color: "#f0e6d3", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7ecf8a", display: "inline-block" }} />
          {onlineCount} online
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{ position: "absolute", top: 50, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,20,0.85)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "8px 16px", color: "#7ecf8a", fontSize: 11, border: "1px solid rgba(126,207,138,0.2)", whiteSpace: "nowrap", animation: "fadeIn 0.3s" }}>
          {notification}
        </div>
      )}

      {/* Player List */}
      {showPlayerList && (
        <div style={{ position: "absolute", top: 42, right: 14, background: "rgba(10,10,20,0.92)", backdropFilter: "blur(12px)", borderRadius: 10, padding: 12, border: "1px solid rgba(255,255,255,0.08)", width: 180, zIndex: 40 }}>
          <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 2, color: "#666", margin: "0 0 8px" }}>In Gallery</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "4px 0" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: playerColor.hex }} />
            <span style={{ fontSize: 12, color: "#f0e6d3", fontWeight: 600 }}>{playerName} (you)</span>
          </div>
          {SIMULATED_PLAYERS.map((sp, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, padding: "3px 0" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: sp.color }} />
              <span style={{ fontSize: 11, color: "#aaa" }}>{sp.name}</span>
              <span style={{ fontSize: 9, color: "#555", marginLeft: "auto" }}>{sp.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* Art proximity panel */}
      {nearWork && !selectedWork && (
        <div style={{ position: "absolute", bottom: isMobile ? 140 : 70, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,20,0.88)", backdropFilter: "blur(12px)", borderRadius: 12, padding: "12px 18px", border: `1px solid ${nearWork.color}33`, maxWidth: 340, width: "90%", color: "#f0e6d3" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div onClick={() => setSelectedWork(nearWork)} style={{ cursor: "pointer", flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{nearWork.title}</div>
              <div style={{ fontSize: 11, color: nearWork.color }}>{nearWork.student} • {nearWork.phase}</div>
            </div>
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 16, cursor: "pointer" }}>
              ❤️
            </button>
          </div>
          {/* Reactions */}
          {(() => {
            const idx = PROJECTS.findIndex(p => p.title === nearWork.title).toString();
            const reactions = artReactions[idx];
            if (!reactions) return null;
            return (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {Object.entries(reactions).map(([emoji, count]) => (
                  <span key={emoji} style={{ fontSize: 11, padding: "2px 6px", background: "rgba(255,255,255,0.06)", borderRadius: 12, color: "#ccc" }}>
                    {emoji} {count}
                  </span>
                ))}
              </div>
            );
          })()}
          {showEmojiPicker && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "6px 0" }}>
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => addReaction(e)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "6px 8px", fontSize: 18, cursor: "pointer" }}>{e}</button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>Tap title for details</div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedWork && (
        <div onClick={() => setSelectedWork(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#14142a", borderRadius: 16, padding: 22, maxWidth: 380, width: "100%", border: `1px solid ${selectedWork.color}33`, color: "#f0e6d3" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>{selectedWork.title}</h2>
                <span style={{ fontSize: 11, color: selectedWork.color }}>{selectedWork.student}</span>
              </div>
              <button onClick={() => setSelectedWork(null)} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "#aaa", margin: "0 0 14px" }}>{selectedWork.desc}</p>
            <div style={{ padding: 12, background: `${selectedWork.color}0a`, borderRadius: 8, borderLeft: `3px solid ${selectedWork.color}` }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#666", margin: "0 0 4px" }}>Process Journal</p>
              <p style={{ fontSize: 12, color: "#888", margin: 0, fontStyle: "italic", lineHeight: 1.6 }}>
                "Tested three different approaches today. The user feedback loop is revealing patterns I hadn't considered in my initial inquiry…"
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setSelectedWork(null)} style={{ flex: 1, padding: "10px 0", background: selectedWork.color, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Close</button>
              <button onClick={() => { addReaction("❤️"); setSelectedWork(null); }} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.06)", color: "#f0e6d3", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>❤️</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <div style={{ position: "absolute", bottom: isMobile ? 120 : 12, left: 12, width: 220, maxHeight: 180, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, paddingBottom: 4 }}>
          {chatLog.slice(-6).map((c, i) => (
            <div key={i} style={{ fontSize: 11, background: "rgba(10,10,20,0.7)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "4px 8px", color: "#ccc" }}>
              <span style={{ color: c.color, fontWeight: 600 }}>{c.name}: </span>
              {c.msg}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()}
            placeholder="Say something…" maxLength={60}
            style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#f0e6d3", fontSize: 11, outline: "none" }} />
          <button onClick={sendChat} style={{ padding: "8px 12px", background: "#e94560", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>↑</button>
        </div>
      </div>

      {/* Mobile Controls */}
      {isMobile && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "auto" }}>
            <div style={{ width: 48, height: 48 }} />
            <div style={{ display: "flex", gap: 4 }}>
              <button onTouchStart={() => updateMobile("left", true)} onTouchEnd={() => updateMobile("left", false)}
                style={{ width: 48, height: 48, borderRadius: 10, background: mobileControls.left ? "rgba(233,69,96,0.5)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
              <button onTouchStart={() => updateMobile("right", true)} onTouchEnd={() => updateMobile("right", false)}
                style={{ width: 48, height: 48, borderRadius: 10, background: mobileControls.right ? "rgba(233,69,96,0.5)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "auto" }}>
            <button onTouchStart={() => updateMobile("forward", true)} onTouchEnd={() => updateMobile("forward", false)}
              style={{ width: 48, height: 48, borderRadius: 10, background: mobileControls.forward ? "rgba(233,69,96,0.5)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ width: 48, height: 48 }} />
              <button onTouchStart={() => updateMobile("back", true)} onTouchEnd={() => updateMobile("back", false)}
                style={{ width: 48, height: 48, borderRadius: 10, background: mobileControls.back ? "rgba(233,69,96,0.5)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", gap: 6 }}>
          {["W", "A", "S", "D"].map(k => (
            <span key={k} style={{ fontSize: 10, color: "#444", background: "rgba(255,255,255,0.04)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
