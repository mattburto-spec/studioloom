/**
 * ============================================================
 * R3F DESIGNVILLE STARTER
 * ============================================================
 * 
 * React Three Fiber (R3F) lets you build Three.js scenes
 * using React components. If you know React, you know R3F.
 * 
 * KEY MENTAL MODEL:
 * - <mesh> = a visible 3D object (like <div> in HTML)
 * - <boxGeometry> = the shape (like width/height in CSS)
 * - <meshStandardMaterial> = the surface look (like background-color)
 * - <group> = a container (like a <div> wrapper)
 * - useFrame() = runs every frame (like requestAnimationFrame)
 * - useRef() = same as React, but points to 3D objects
 * 
 * EVERY 3D object has: position={[x, y, z]}
 *   x = left/right
 *   y = up/down (this is the "height" axis)
 *   z = forward/backward
 */

import { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────
// Since we're in an artifact, we'll use raw Three.js in a
// Canvas to demonstrate R3F patterns. In your real project,
// you'd install @react-three/fiber and @react-three/drei
// and use their <Canvas>, <OrbitControls>, etc.
//
// I'll structure this EXACTLY like R3F components so when you
// move to real R3F, it's a direct 1:1 translation.
// ─────────────────────────────────────────────────────────────

// ── GAME CONFIG ──────────────────────────────────────────────

const BUILDINGS = [
  { name: "Rosa's Bakery", x: -6, z: -4, w: 3, d: 3, h: 2.5, color: "#c17f59", roofColor: "#8b4513", hasQuest: true, emoji: "🧁" },
  { name: "Town Hall", x: 6, z: -4, w: 3.5, d: 3, h: 3, color: "#7a8ba0", roofColor: "#4a5a6a", emoji: "🏛️" },
  { name: "School", x: -6, z: 6, w: 3, d: 2.5, h: 2.2, color: "#6a9bc0", roofColor: "#3a6a8a", emoji: "📚" },
  { name: "Garden Shed", x: 6, z: 6, w: 2, d: 2, h: 1.8, color: "#6b8c5a", roofColor: "#4a6a3a", emoji: "🌱" },
];

const TREES = [
  { x: -10, z: -8 }, { x: -8, z: -10 }, { x: 10, z: -8 }, { x: 8, z: -10 },
  { x: -10, z: 8 }, { x: -12, z: 4 }, { x: 12, z: 4 }, { x: 10, z: 8 },
  { x: -3, z: -10 }, { x: 3, z: -10 }, { x: -10, z: 0 }, { x: 10, z: 0 },
  { x: 0, z: -10 }, { x: -12, z: -4 }, { x: 12, z: -4 }, { x: -12, z: 8 },
  { x: 12, z: 8 }, { x: 0, z: 10 }, { x: -4, z: 10 }, { x: 4, z: 10 },
];

const NPCS = [
  { id: "rosa", name: "Rosa", x: -4, z: -3, color: "#e8a87c",
    dialogue: [
      { speaker: "Rosa", text: "Welcome! I'm Rosa, I run the bakery here in Designville.", mood: "warm" },
      { speaker: "Rosa", text: "I have a real problem — my customers keep burning their hands on my takeaway coffee cups.", mood: "worried" },
      { speaker: "Rosa", text: "The paper cups have no insulation. Poor Mr. Tanaka winces every morning.", mood: "concerned" },
      { speaker: "Rosa", text: "Could you design a better cup sleeve? Eco-friendly, affordable, and it actually has to work!", mood: "hopeful" },
    ],
  },
  { id: "tomas", name: "Tomás", x: 0, z: 2, color: "#f0c27a",
    dialogue: [
      { speaker: "Tomás", text: "Hey! Have you tried Rosa's hot chocolate? It's amazing but it BURNS.", mood: "excited" },
      { speaker: "Tomás", text: "I wrap my scarf around the cup. Works okay but then my neck gets cold!", mood: "laughing" },
    ],
  },
  { id: "mayor", name: "Mayor Lin", x: 5, z: -2, color: "#b0c4de",
    dialogue: [
      { speaker: "Mayor Lin", text: "Welcome to Designville, young designer!", mood: "proud" },
      { speaker: "Mayor Lin", text: "This village runs on creative problem-solving. Talk to the villagers — they need you.", mood: "encouraging" },
    ],
  },
  { id: "mei", name: "Auntie Mei", x: 5, z: 5, color: "#a8d5a2",
    dialogue: [
      { speaker: "Auntie Mei", text: "Hello dear! I tend the community garden, but my knees aren't what they used to be...", mood: "gentle" },
      { speaker: "Auntie Mei", text: "Maybe someday someone will design a garden I can use from my wheelchair.", mood: "hopeful" },
    ],
  },
];

const PHASE_COLORS = { Inquire: "#6c8ebf", Develop: "#d4a843", Create: "#82b366", Evaluate: "#b85450" };
const PHASE_ICONS = { Inquire: "🔍", Develop: "✏️", Create: "🔨", Evaluate: "📊" };

// ── MAIN COMPONENT ───────────────────────────────────────────

export default function DesignvilleR3F() {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(null);
  const playerRef = useRef({ x: 0, z: 8, angle: Math.PI, speed: 0.07, rotSpeed: 0.035 });
  const keysRef = useRef({});
  const npcMeshesRef = useRef([]);
  const questMarkerRef = useRef(null);

  const [nearNPC, setNearNPC] = useState(null);
  const [dialogue, setDialogue] = useState(null);
  const [questAccepted, setQuestAccepted] = useState(false);
  const [questOffer, setQuestOffer] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const mobileRef = useRef({ forward: false, back: false, left: false, right: false });
  const [mobileControls, setMobileControls] = useState({ forward: false, back: false, left: false, right: false });

  useEffect(() => { setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0); }, []);

  const showNotif = useCallback((text) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const updateMobile = (key, val) => {
    setMobileControls(prev => { const n = { ...prev, [key]: val }; mobileRef.current = n; return n; });
  };

  // ── SCENE SETUP ────────────────────────────────────────────
  // In real R3F, this is all declarative JSX:
  //   <Canvas> <ambientLight /> <mesh> ... </mesh> </Canvas>
  // Here we do it imperatively to show what R3F does under the hood.

  useEffect(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    // ── THE SCENE (R3F: <Canvas>)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#87CEEB"); // Sky blue
    scene.fog = new THREE.FogExp2("#87CEEB", 0.025); // Atmospheric fog

    // ── THE CAMERA (R3F: configured on <Canvas>)
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);

    // ── THE RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mountRef.current.appendChild(renderer.domElement);

    // ═══════════════════════════════════════════════════════════
    // LIGHTING
    // In R3F: <ambientLight intensity={0.5} />
    //         <directionalLight position={[10, 15, 5]} castShadow />
    // ═══════════════════════════════════════════════════════════

    const ambient = new THREE.AmbientLight("#b4c8e0", 0.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight("#fff5e6", 1.2);
    sun.position.set(10, 15, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    scene.add(sun);

    const hemi = new THREE.HemisphereLight("#87CEEB", "#4a7c3f", 0.3);
    scene.add(hemi);

    // ═══════════════════════════════════════════════════════════
    // GROUND PLANE
    // In R3F:
    //   <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
    //     <planeGeometry args={[40, 40]} />
    //     <meshStandardMaterial color="#5a8c4a" />
    //   </mesh>
    // ═══════════════════════════════════════════════════════════

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: "#5a8c4a", roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Paths (simple flat boxes on the ground)
    const pathMat = new THREE.MeshStandardMaterial({ color: "#c4a96a", roughness: 0.95 });
    // Main cross path
    [{ w: 1.5, d: 20, x: 0, z: 0 }, { w: 20, d: 1.5, x: 0, z: 0 }].forEach(p => {
      const path = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.05, p.d), pathMat);
      path.position.set(p.x, 0.026, p.z);
      path.receiveShadow = true;
      scene.add(path);
    });
    // Diagonal paths to buildings
    [{ x: -3, z: -2, a: 0.6 }, { x: 3, z: -2, a: -0.6 }, { x: -3, z: 3, a: -0.6 }, { x: 3, z: 3, a: 0.6 }].forEach(p => {
      const diag = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 5), pathMat);
      diag.position.set(p.x, 0.026, p.z);
      diag.rotation.y = p.a;
      diag.receiveShadow = true;
      scene.add(diag);
    });

    // ═══════════════════════════════════════════════════════════
    // BUILDINGS
    // In R3F, each building would be a <Building /> component:
    //   <Building name="Rosa's Bakery" position={[-6, 0, -4]} ... />
    //
    // The component returns a <group> with child meshes.
    // ═══════════════════════════════════════════════════════════

    BUILDINGS.forEach(b => {
      const group = new THREE.Group();
      group.position.set(b.x, 0, b.z);

      // Walls
      const walls = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, b.h, b.d),
        new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.8 })
      );
      walls.position.y = b.h / 2;
      walls.castShadow = true;
      walls.receiveShadow = true;
      group.add(walls);

      // Roof (pyramid-ish using a cone)
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.75, 1.2, 4),
        new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.7 })
      );
      roof.position.y = b.h + 0.6;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // Door
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.2, 0.1),
        new THREE.MeshStandardMaterial({ color: "#5a3a1a", roughness: 0.6 })
      );
      door.position.set(0, 0.6, b.d / 2 + 0.05);
      group.add(door);

      // Window
      const windowMat = new THREE.MeshStandardMaterial({ color: "#a8d4f0", roughness: 0.2, metalness: 0.1 });
      [-0.8, 0.8].forEach(wx => {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), windowMat);
        win.position.set(wx, b.h * 0.6, b.d / 2 + 0.05);
        group.add(win);
      });

      scene.add(group);
    });

    // ═══════════════════════════════════════════════════════════
    // TREES
    // In R3F: <Tree position={[x, 0, z]} />
    // Using simple cone + cylinder = low-poly style
    // ═══════════════════════════════════════════════════════════

    const trunkMat = new THREE.MeshStandardMaterial({ color: "#6b4226", roughness: 0.9 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: "#3a7a2a", roughness: 0.8 });
    const leavesMat2 = new THREE.MeshStandardMaterial({ color: "#2d6b20", roughness: 0.8 });

    TREES.forEach((t, i) => {
      const group = new THREE.Group();
      group.position.set(t.x, 0, t.z);

      const scale = 0.8 + Math.sin(i * 3.7) * 0.3;

      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, 1.2 * scale, 6),
        trunkMat
      );
      trunk.position.y = 0.6 * scale;
      trunk.castShadow = true;
      group.add(trunk);

      // Foliage layers (stacked cones = low-poly tree)
      [
        { y: 1.8, r: 0.9, h: 1.2 },
        { y: 2.5, r: 0.7, h: 1.0 },
        { y: 3.0, r: 0.45, h: 0.8 },
      ].forEach((layer, li) => {
        const leaves = new THREE.Mesh(
          new THREE.ConeGeometry(layer.r * scale, layer.h * scale, 6),
          li % 2 === 0 ? leavesMat : leavesMat2
        );
        leaves.position.y = layer.y * scale;
        leaves.castShadow = true;
        group.add(leaves);
      });

      scene.add(group);
    });

    // ═══════════════════════════════════════════════════════════
    // VILLAGE DETAILS
    // ═══════════════════════════════════════════════════════════

    // Well in center
    const well = new THREE.Group();
    const wellBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.7, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: "#8a8a8a", roughness: 0.9 })
    );
    wellBase.position.y = 0.4;
    wellBase.castShadow = true;
    well.add(wellBase);
    const wellRoof = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: "#5a3a1a", roughness: 0.7 })
    );
    wellRoof.position.y = 1.4;
    wellRoof.rotation.y = Math.PI / 4;
    well.add(wellRoof);
    // Posts
    [-0.35, 0.35].forEach(px => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4),
        new THREE.MeshStandardMaterial({ color: "#5a3a1a" })
      );
      post.position.set(px, 1.05, 0);
      well.add(post);
    });
    well.position.set(0, 0, 0);
    scene.add(well);

    // Flower patches
    const flowerColors = ["#e8647c", "#f0c27a", "#b07cc6", "#ff8a65"];
    [[-2, -7], [2, -7], [-8, 2], [8, 2], [-2, 8], [2, 8]].forEach(([fx, fz], fi) => {
      for (let i = 0; i < 5; i++) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 6, 6),
          new THREE.MeshStandardMaterial({ color: flowerColors[(fi + i) % flowerColors.length] })
        );
        flower.position.set(fx + Math.sin(i * 2.3) * 0.6, 0.15, fz + Math.cos(i * 1.7) * 0.6);
        scene.add(flower);
      }
    });

    // Fences near garden
    const fenceMat = new THREE.MeshStandardMaterial({ color: "#8b7355", roughness: 0.85 });
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4), fenceMat);
      post.position.set(4 + i * 0.8, 0.3, 4.5);
      post.castShadow = true;
      scene.add(post);
      if (i < 4) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.04), fenceMat);
        rail.position.set(4.4 + i * 0.8, 0.4, 4.5);
        scene.add(rail);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PLAYER AVATAR
    // In R3F:
    //   <group ref={playerRef}>
    //     <mesh> <cylinderGeometry /> <meshStandardMaterial /> </mesh>
    //     <mesh> <sphereGeometry /> ... </mesh>
    //   </group>
    //
    // useFrame(() => { /* movement logic */ })
    // ═══════════════════════════════════════════════════════════

    const playerGroup = new THREE.Group();
    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: "#e94560", roughness: 0.5 })
    );
    body.position.y = 0.6;
    body.castShadow = true;
    playerGroup.add(body);
    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: "#e94560", roughness: 0.5 })
    );
    head.position.y = 1.2;
    head.castShadow = true;
    playerGroup.add(head);
    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#fff" });
    const pupilMat = new THREE.MeshStandardMaterial({ color: "#1a1a2e" });
    [[-0.08, 1.25, -0.16], [0.08, 1.25, -0.16]].forEach(pos => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
      eye.position.set(...pos);
      playerGroup.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), pupilMat);
      pupil.position.set(pos[0], pos[1], pos[2] - 0.03);
      playerGroup.add(pupil);
    });
    // Shadow disc
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 8),
      new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.2 })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    playerGroup.add(shadowDisc);

    playerGroup.position.set(0, 0, 8);
    scene.add(playerGroup);

    // ═══════════════════════════════════════════════════════════
    // NPCs
    // In R3F: <NPC id="rosa" position={[-4, 0, -3]} dialogue={...} />
    // ═══════════════════════════════════════════════════════════

    const npcMeshes = [];
    NPCS.forEach(npc => {
      const group = new THREE.Group();

      // Body
      const nBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: npc.color, roughness: 0.5 })
      );
      nBody.position.y = 0.6;
      nBody.castShadow = true;
      group.add(nBody);

      // Head
      const nHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: npc.color, roughness: 0.5 })
      );
      nHead.position.y = 1.2;
      nHead.castShadow = true;
      group.add(nHead);

      // Eyes (facing toward center of village)
      const angle = Math.atan2(-npc.x, -npc.z);
      [[-0.08, 0], [0.08, 0]].forEach(([ex]) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
        eye.position.set(
          Math.cos(angle) * ex + Math.sin(angle) * -0.16,
          1.25,
          -Math.sin(angle) * ex + Math.cos(angle) * -0.16
        );
        group.add(eye);
      });

      // Shadow
      const nShadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 8),
        new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.15 })
      );
      nShadow.rotation.x = -Math.PI / 2;
      nShadow.position.y = 0.02;
      group.add(nShadow);

      group.position.set(npc.x, 0, npc.z);
      group.userData = { npcId: npc.id };
      scene.add(group);
      npcMeshes.push(group);
    });
    npcMeshesRef.current = npcMeshes;

    // Quest marker (floating ! above Rosa)
    const markerGroup = new THREE.Group();
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({ color: "#f0c41b", emissive: "#f0c41b", emissiveIntensity: 0.5 })
    );
    markerGroup.add(marker);
    const markerGlow = new THREE.PointLight("#f0c41b", 0.5, 3);
    markerGlow.position.y = 0.2;
    markerGroup.add(markerGlow);
    markerGroup.position.set(-4, 2, -3);
    scene.add(markerGroup);
    questMarkerRef.current = markerGroup;

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // ═══════════════════════════════════════════════════════════
    // GAME LOOP
    // In R3F, this is useFrame((state, delta) => { ... })
    // It runs every frame automatically.
    // ═══════════════════════════════════════════════════════════

    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;

      const p = playerRef.current;
      const k = keysRef.current;
      const m = mobileRef.current;

      // ── PLAYER MOVEMENT ──
      const forward = k["w"] || k["arrowup"] || m.forward;
      const back = k["s"] || k["arrowdown"] || m.back;
      const left = k["a"] || k["arrowleft"] || m.left;
      const right = k["d"] || k["arrowright"] || m.right;

      if (left) p.angle += p.rotSpeed;
      if (right) p.angle -= p.rotSpeed;

      let moving = false;
      if (forward) {
        const nx = p.x + Math.sin(p.angle) * p.speed;
        const nz = p.z + Math.cos(p.angle) * p.speed;
        // Simple boundary + building collision
        if (nx > -14 && nx < 14 && nz > -14 && nz < 14) {
          let blocked = false;
          BUILDINGS.forEach(b => {
            if (Math.abs(nx - b.x) < b.w / 2 + 0.5 && Math.abs(nz - b.z) < b.d / 2 + 0.5) blocked = true;
          });
          if (Math.abs(nx) < 0.9 && Math.abs(nz) < 0.9) blocked = true; // Well
          if (!blocked) { p.x = nx; p.z = nz; moving = true; }
        }
      }
      if (back) {
        const nx = p.x - Math.sin(p.angle) * p.speed * 0.5;
        const nz = p.z - Math.cos(p.angle) * p.speed * 0.5;
        if (nx > -14 && nx < 14 && nz > -14 && nz < 14) {
          let blocked = false;
          BUILDINGS.forEach(b => {
            if (Math.abs(nx - b.x) < b.w / 2 + 0.5 && Math.abs(nz - b.z) < b.d / 2 + 0.5) blocked = true;
          });
          if (!blocked) { p.x = nx; p.z = nz; moving = true; }
        }
      }

      // Update player mesh
      playerGroup.position.x = p.x;
      playerGroup.position.z = p.z;
      playerGroup.rotation.y = p.angle;
      // Walk bob
      if (moving) {
        playerGroup.position.y = Math.sin(time * 10) * 0.04;
      } else {
        playerGroup.position.y = 0;
      }

      // ── CAMERA FOLLOW ──
      // Third-person: camera sits behind and above the player
      // In R3F you'd put this in useFrame()
      const camDist = 5;
      const camHeight = 3.5;
      const camTargetX = p.x - Math.sin(p.angle) * camDist;
      const camTargetZ = p.z - Math.cos(p.angle) * camDist;
      camera.position.x += (camTargetX - camera.position.x) * 0.06;
      camera.position.z += (camTargetZ - camera.position.z) * 0.06;
      camera.position.y += (camHeight - camera.position.y) * 0.06;
      camera.lookAt(p.x, 1, p.z);

      // ── NPC IDLE ANIMATION ──
      npcMeshes.forEach((mesh, i) => {
        mesh.position.y = Math.sin(time * 1.5 + i * 2) * 0.03;
        mesh.rotation.y = Math.sin(time * 0.5 + i * 3) * 0.15;
      });

      // ── QUEST MARKER BOUNCE ──
      if (questMarkerRef.current) {
        questMarkerRef.current.position.y = 2 + Math.sin(time * 3) * 0.2;
        questMarkerRef.current.rotation.y = time * 2;
      }

      // ── NPC PROXIMITY CHECK ──
      let closestNPC = null;
      let closestDist = 3;
      NPCS.forEach(npc => {
        const dx = npc.x - p.x;
        const dz = npc.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < closestDist) { closestDist = dist; closestNPC = npc.id; }
      });
      setNearNPC(closestNPC);

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth;
      const nh = mountRef.current.clientHeight;
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
  }, []);

  // ── INPUT ──────────────────────────────────────────────────
  useEffect(() => {
    const down = e => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "e" || e.key === " ") handleInteract();
      if (showHelp) setShowHelp(false);
    };
    const up = e => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  });

  const handleInteract = useCallback(() => {
    if (questOffer) return;

    if (dialogue) {
      const npc = NPCS.find(n => n.id === dialogue.npcId);
      const next = dialogue.lineIndex + 1;
      if (next < npc.dialogue.length) {
        setDialogue({ ...dialogue, lineIndex: next });
      } else {
        if (dialogue.npcId === "rosa" && !questAccepted) {
          setQuestOffer(true);
          setDialogue(null);
        } else {
          setDialogue(null);
        }
      }
      return;
    }

    if (nearNPC) {
      setDialogue({ npcId: nearNPC, lineIndex: 0 });
      if (showHelp) setShowHelp(false);
    }
  }, [dialogue, nearNPC, questOffer, questAccepted, showHelp]);

  const acceptQuest = () => {
    setQuestAccepted(true);
    setQuestOffer(false);
    showNotif("Quest Accepted: The Hot Cup Problem!");
    // Hide quest marker
    if (questMarkerRef.current) questMarkerRef.current.visible = false;
  };

  const currentNPC = dialogue ? NPCS.find(n => n.id === dialogue.npcId) : null;
  const currentLine = currentNPC?.dialogue[dialogue?.lineIndex];

  // ── RENDER ─────────────────────────────────────────────────
  // This is the KEY R3F pattern: the 3D canvas fills the screen,
  // React UI components float on top as absolute-positioned overlays.
  // In your real app, dialogue boxes, quest log, AI assistant, etc.
  // are all just React components rendered above the <Canvas>.

  return (
    <div style={{ height: "100vh", position: "relative", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>
      {/* 3D Canvas */}
      <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

      {/* ═══ REACT UI OVERLAYS ═══ */}
      {/* These sit ON TOP of the 3D scene — this is how R3F apps work */}

      {/* HUD */}
      <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none", zIndex: 10 }}>
        <div style={{ background: "rgba(10,10,20,0.75)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px 14px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Designville</div>
          {questAccepted && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
              <span style={{ fontSize: 12 }}>🔍</span>
              <span style={{ fontSize: 10, color: "#6c8ebf", fontWeight: 600 }}>Inquire: The Hot Cup Problem</span>
            </div>
          )}
        </div>
        {questAccepted && (
          <div style={{ background: "rgba(10,10,20,0.75)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", gap: 3 }}>
              {["Inquire", "Develop", "Create", "Evaluate"].map((p, i) => (
                <div key={p} style={{ width: 28, height: 4, borderRadius: 2, background: i === 0 ? PHASE_COLORS[p] : "rgba(255,255,255,0.1)" }} />
              ))}
            </div>
            <div style={{ fontSize: 8, color: "#888", marginTop: 3, textAlign: "center" }}>Phase 1/4</div>
          </div>
        )}
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(10,10,20,0.85)", backdropFilter: "blur(12px)", borderRadius: 16, padding: "24px 32px", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", zIndex: 20, color: "#e8e0d4" }}>
          <h2 style={{ fontSize: 18, fontWeight: 300, margin: "0 0 4px", letterSpacing: 2 }}>Welcome to Designville</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 16px" }}>A 3D world built with React Three Fiber</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              {[["WASD", "Move"], ["A / D", "Turn"], ["E", "Talk"]].map(([k, l]) => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e94560", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#f0c41b" }}>Find the golden marker — Rosa needs your help!</p>
          <p style={{ fontSize: 10, color: "#555", marginTop: 8 }}>Press any key to start</p>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div style={{ position: "absolute", top: 50, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,20,0.9)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px 18px", color: "#f0c41b", fontSize: 13, fontWeight: 600, border: "1px solid rgba(240,196,27,0.2)", zIndex: 20, whiteSpace: "nowrap" }}>
          📜 {notification}
        </div>
      )}

      {/* NPC Proximity Prompt */}
      {nearNPC && !dialogue && !questOffer && (
        <div style={{ position: "absolute", bottom: isMobile ? 160 : 60, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,20,0.8)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "8px 16px", border: "1px solid rgba(255,255,255,0.08)", color: "#f0c41b", fontSize: 12, fontWeight: 600, zIndex: 15, whiteSpace: "nowrap" }}>
          {isMobile ? "Tap 💬 to talk to " : "Press E to talk to "}
          <span style={{ color: NPCS.find(n => n.id === nearNPC)?.color }}>
            {NPCS.find(n => n.id === nearNPC)?.name}
          </span>
        </div>
      )}

      {/* Dialogue Box */}
      {dialogue && currentLine && (
        <div onClick={handleInteract} style={{ position: "absolute", bottom: isMobile ? 130 : 16, left: 12, right: 12, zIndex: 30, maxWidth: 440, margin: "0 auto" }}>
          <div style={{ background: "rgba(10,10,20,0.92)", backdropFilter: "blur(12px)", borderRadius: 14, padding: 16, border: `1px solid ${currentNPC.color}33`, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: currentNPC.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {NPCS.find(n => n.id === dialogue.npcId)?.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: currentNPC.color }}>{currentLine.speaker}</div>
                {currentLine.mood && <div style={{ fontSize: 9, color: "#666", fontStyle: "italic" }}>{currentLine.mood}</div>}
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#e8e0d4", lineHeight: 1.7, margin: "0 0 8px" }}>{currentLine.text}</p>
            <div style={{ textAlign: "right", fontSize: 10, color: "#555" }}>
              {dialogue.lineIndex + 1}/{currentNPC.dialogue.length} — {isMobile ? "tap" : "E"} to continue ▶
            </div>
          </div>
        </div>
      )}

      {/* Quest Offer */}
      {questOffer && (
        <div style={{ position: "absolute", bottom: isMobile ? 130 : 16, left: 12, right: 12, zIndex: 30, maxWidth: 440, margin: "0 auto" }}>
          <div style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(240,196,27,0.2)" }}>
            <div style={{ padding: "12px 16px", background: "rgba(240,196,27,0.06)", borderBottom: "1px solid rgba(240,196,27,0.1)" }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#f0c41b", fontWeight: 700, textTransform: "uppercase" }}>New Quest</div>
              <h3 style={{ fontSize: 16, color: "#f0e6d3", margin: "4px 0 2px", fontWeight: 600 }}>The Hot Cup Problem</h3>
              <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Design an eco-friendly insulating sleeve for Rosa's cups</p>
            </div>
            <div style={{ padding: "10px 16px 14px" }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {["Inquire", "Develop", "Create", "Evaluate"].map(p => (
                  <span key={p} style={{ fontSize: 8, padding: "3px 6px", borderRadius: 3, background: PHASE_COLORS[p] + "22", color: PHASE_COLORS[p], fontWeight: 700 }}>{PHASE_ICONS[p]} {p}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={acceptQuest} style={{ flex: 1, padding: "11px 0", background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Accept Quest</button>
                <button onClick={() => setQuestOffer(false)} style={{ padding: "11px 16px", background: "rgba(255,255,255,0.04)", color: "#666", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 11, cursor: "pointer" }}>Later</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && !dialogue && !questOffer && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end", pointerEvents: "none", zIndex: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, pointerEvents: "auto" }}>
            <button onTouchStart={() => updateMobile("forward", true)} onTouchEnd={() => updateMobile("forward", false)}
              style={{ width: 52, height: 52, borderRadius: 12, background: mobileControls.forward ? "rgba(233,69,96,0.4)" : "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
            <div style={{ display: "flex", gap: 3 }}>
              <button onTouchStart={() => updateMobile("left", true)} onTouchEnd={() => updateMobile("left", false)}
                style={{ width: 52, height: 52, borderRadius: 12, background: mobileControls.left ? "rgba(233,69,96,0.4)" : "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
              <div style={{ width: 52, height: 52 }} />
              <button onTouchStart={() => updateMobile("right", true)} onTouchEnd={() => updateMobile("right", false)}
                style={{ width: 52, height: 52, borderRadius: 12, background: mobileControls.right ? "rgba(233,69,96,0.4)" : "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
            </div>
            <button onTouchStart={() => updateMobile("back", true)} onTouchEnd={() => updateMobile("back", false)}
              style={{ width: 52, height: 52, borderRadius: 12, background: mobileControls.back ? "rgba(233,69,96,0.4)" : "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, pointerEvents: "auto" }}>
            {nearNPC && (
              <button onClick={handleInteract}
                style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(240,196,27,0.15)", border: "2px solid #f0c41b", color: "#f0c41b", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>💬</button>
            )}
          </div>
        </div>
      )}

      {/* Desktop controls */}
      {!isMobile && !showHelp && !dialogue && !questOffer && (
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10, zIndex: 10 }}>
          {[["WASD", "Move"], ["E", "Talk"]].map(([k, l]) => (
            <span key={k} style={{ fontSize: 10, color: "#555", background: "rgba(10,10,20,0.6)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
              <strong style={{ color: "#888" }}>{k}</strong> {l}
            </span>
          ))}
        </div>
      )}

      {/* R3F learning note */}
      <div style={{ position: "absolute", top: 8, right: 8, pointerEvents: "none", zIndex: 5 }}>
        <div style={{ background: "rgba(10,10,20,0.6)", borderRadius: 8, padding: "4px 8px", border: "1px solid rgba(255,255,255,0.04)" }}>
          <span style={{ fontSize: 8, color: "#555", letterSpacing: 1 }}>REACT THREE FIBER</span>
        </div>
      </div>
    </div>
  );
}
