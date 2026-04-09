import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

const PROJECTS = [
  { title: "Bluetooth Speaker Enclosure", student: "Alex C.", phase: "Create", color: "#e94560", desc: "Wood & acrylic enclosure with parametric joints. Full Design Cycle, 12 weeks.", grade: "A" },
  { title: "Sustainable Packaging", student: "Maya R.", phase: "Evaluate", color: "#7ecf8a", desc: "Biodegradable packaging for school cafeteria takeaway meals.", grade: "A-" },
  { title: "Chess Piece Manufacturing", student: "Jordan L.", phase: "Create", color: "#6c8ebf", desc: "Mass-production analysis: injection molding vs 3D printing.", grade: "B+" },
  { title: "Ergonomic Desk Organizer", student: "Sam T.", phase: "Develop", color: "#d4a843", desc: "Research-driven design for student workspace optimization.", grade: "B" },
  { title: "App UI Redesign", student: "Priya K.", phase: "Develop", color: "#b07cc6", desc: "Redesigning school library booking app for accessibility.", grade: "A" },
  { title: "Water Filtration System", student: "Leo W.", phase: "Inquire", color: "#4fc3f7", desc: "Low-cost filtration prototype for outdoor education trips.", grade: null },
  { title: "Modular Shelving Unit", student: "Zoe M.", phase: "Create", color: "#ff8a65", desc: "Flat-pack shelving using CNC-cut plywood with tool-free assembly.", grade: "A-" },
  { title: "Braille Learning Tool", student: "Kai N.", phase: "Evaluate", color: "#aed581", desc: "3D-printed tactile cards for teaching braille to sighted students.", grade: "A" },
];

const PHASE_COLORS = { Inquire: "#6c8ebf", Develop: "#d4a843", Create: "#82b366", Evaluate: "#b85450" };

export default function Gallery3D() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const playerRef = useRef({ x: 0, z: 8, angle: Math.PI, speed: 0.08, rotSpeed: 0.04 });
  const keysRef = useRef({});
  const artworksRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const frameRef = useRef(null);
  const otherAvatarsRef = useRef([]);

  const [started, setStarted] = useState(false);
  const [selectedWork, setSelectedWork] = useState(null);
  const [nearWork, setNearWork] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileControls, setMobileControls] = useState({ forward: false, back: false, left: false, right: false });
  const mobileRef = useRef({ forward: false, back: false, left: false, right: false });

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const updateMobile = (key, val) => {
    setMobileControls(prev => {
      const next = { ...prev, [key]: val };
      mobileRef.current = next;
      return next;
    });
  };

  const createTextTexture = useCallback((text, subtext, color, width = 512, height = 512) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Inner accent line
    ctx.strokeStyle = color + "44";
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    // Abstract art representation
    ctx.save();
    ctx.beginPath();
    ctx.rect(40, 40, width - 80, height * 0.5);
    ctx.clip();

    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = color + (40 + i * 15).toString(16);
      const bx = 60 + Math.sin(i * 2.1) * 140;
      const by = 80 + Math.cos(i * 1.7) * 100;
      const bw = 80 + Math.sin(i * 3.2) * 60;
      const bh = 60 + Math.cos(i * 2.5) * 40;
      ctx.fillRect(bx, by, bw, bh);
    }
    // Central icon circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.3, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✦", width / 2, height * 0.3 + 11);
    ctx.restore();

    // Title
    ctx.fillStyle = "#f0e6d3";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    const words = text.split(" ");
    let line = "";
    let y = height * 0.62;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > width - 80 && line) {
        ctx.fillText(line.trim(), width / 2, y);
        line = word + " ";
        y += 34;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), width / 2, y);

    // Subtext
    ctx.fillStyle = color;
    ctx.font = "18px sans-serif";
    ctx.fillText(subtext, width / 2, y + 36);

    // Phase dot
    ctx.beginPath();
    ctx.arc(width / 2, height - 50, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, []);

  const createAvatarMesh = useCallback((color, x, z, angle) => {
    const group = new THREE.Group();
    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8),
      new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = 0.55;
    group.add(body);
    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({ color })
    );
    head.position.y = 1.08;
    group.add(head);
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#ffffff" });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.07, 1.12, -0.14);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.07, 1.12, -0.14);
    group.add(rightEye);

    group.position.set(x, 0, z);
    group.rotation.y = angle;
    return group;
  }, []);

  const initScene = useCallback(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0a14");
    scene.fog = new THREE.Fog("#0a0a14", 8, 22);

    const camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 50);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight("#2a2a4a", 0.6);
    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight("#ffeedd", 0.4);
    mainLight.position.set(0, 8, 0);
    scene.add(mainLight);

    // Gallery room dimensions
    const roomW = 16, roomL = 20, roomH = 4;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomW, roomL);
    const floorMat = new THREE.MeshStandardMaterial({ color: "#1a1a28", roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(roomW, roomL),
      new THREE.MeshStandardMaterial({ color: "#0f0f1a", roughness: 1 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = roomH;
    scene.add(ceil);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: "#16162a", roughness: 0.85 });
    const wallConfigs = [
      { w: roomW, h: roomH, pos: [0, roomH / 2, -roomL / 2], rot: [0, 0, 0] },
      { w: roomW, h: roomH, pos: [0, roomH / 2, roomL / 2], rot: [0, Math.PI, 0] },
      { w: roomL, h: roomH, pos: [-roomW / 2, roomH / 2, 0], rot: [0, Math.PI / 2, 0] },
      { w: roomL, h: roomH, pos: [roomW / 2, roomH / 2, 0], rot: [0, -Math.PI / 2, 0] },
    ];
    wallConfigs.forEach(c => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), wallMat);
      wall.position.set(...c.pos);
      wall.rotation.set(...c.rot);
      scene.add(wall);
    });

    // Floor grid lines
    const gridMat = new THREE.LineBasicMaterial({ color: "#252540", transparent: true, opacity: 0.3 });
    for (let i = -roomW / 2; i <= roomW / 2; i += 2) {
      const pts = [new THREE.Vector3(i, 0.01, -roomL / 2), new THREE.Vector3(i, 0.01, roomL / 2)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (let i = -roomL / 2; i <= roomL / 2; i += 2) {
      const pts = [new THREE.Vector3(-roomW / 2, 0.01, i), new THREE.Vector3(roomW / 2, 0.01, i)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }

    // Artworks on walls
    const artworks = [];
    const artPositions = [
      { x: -7.9, z: -6, ry: Math.PI / 2 },
      { x: -7.9, z: -1, ry: Math.PI / 2 },
      { x: -7.9, z: 4, ry: Math.PI / 2 },
      { x: 7.9, z: -6, ry: -Math.PI / 2 },
      { x: 7.9, z: -1, ry: -Math.PI / 2 },
      { x: 7.9, z: 4, ry: -Math.PI / 2 },
      { x: -3, z: -9.9, ry: 0 },
      { x: 3, z: -9.9, ry: 0 },
    ];

    artPositions.forEach((pos, i) => {
      if (i >= PROJECTS.length) return;
      const p = PROJECTS[i];
      const tex = createTextTexture(p.title, p.student + " • " + p.phase, p.color);

      // Frame
      const frameGeo = new THREE.BoxGeometry(2.2, 2.2, 0.08);
      const frameMat = new THREE.MeshStandardMaterial({ color: "#2a2a3e", roughness: 0.4, metalness: 0.3 });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(pos.x, 2, pos.z);
      frame.rotation.y = pos.ry;
      frame.castShadow = true;
      scene.add(frame);

      // Canvas
      const artGeo = new THREE.PlaneGeometry(1.9, 1.9);
      const artMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      const art = new THREE.Mesh(artGeo, artMat);
      art.position.set(pos.x, 2, pos.z);
      art.rotation.y = pos.ry;
      art.translateZ(0.05);
      art.userData = { project: p, index: i };
      scene.add(art);
      artworks.push(art);

      // Spotlight per artwork
      const spot = new THREE.SpotLight(p.color, 1.5, 6, Math.PI / 6, 0.5);
      spot.position.set(pos.x + (pos.ry > 0 ? 1 : pos.ry < 0 ? -1 : 0), 3.5, pos.z + (pos.ry === 0 ? 1.5 : 0));
      spot.target = frame;
      scene.add(spot);
      scene.add(spot.target);
    });

    artworksRef.current = artworks;

    // Center pedestal
    const pedGeo = new THREE.CylinderGeometry(0.8, 1, 0.6, 6);
    const pedMat = new THREE.MeshStandardMaterial({ color: "#252540", roughness: 0.5, metalness: 0.2 });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.set(0, 0.3, -2);
    scene.add(pedestal);

    // Globe on pedestal
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 16),
      new THREE.MeshStandardMaterial({ color: "#e94560", roughness: 0.3, metalness: 0.5, wireframe: true })
    );
    globe.position.set(0, 1, -2);
    scene.add(globe);

    // Benches
    [[-2, 3], [2, 3]].forEach(([bx, bz]) => {
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.3, 0.6),
        new THREE.MeshStandardMaterial({ color: "#2a2a3e", roughness: 0.6 })
      );
      bench.position.set(bx, 0.35, bz);
      scene.add(bench);
    });

    // NPC avatars — other "visitors" wandering
    const npcColors = ["#4fc3f7", "#ff8a65", "#aed581"];
    const npcs = [];
    npcColors.forEach((c, i) => {
      const a = (i / npcColors.length) * Math.PI * 2;
      const nx = Math.sin(a) * 4;
      const nz = Math.cos(a) * 3 - 2;
      const avatar = createAvatarMesh(c, nx, nz, a + Math.PI);
      scene.add(avatar);
      npcs.push({ mesh: avatar, baseX: nx, baseZ: nz, phase: i * 2.1, speed: 0.3 + i * 0.1 });
    });
    otherAvatarsRef.current = npcs;

    // Player avatar (we see from above/behind)
    const playerAvatar = createAvatarMesh("#e94560", playerRef.current.x, playerRef.current.z, playerRef.current.angle);
    scene.add(playerAvatar);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Animation loop
    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;
      const p = playerRef.current;
      const k = keysRef.current;
      const m = mobileRef.current;

      // Movement
      const forward = k["w"] || k["arrowup"] || m.forward;
      const back = k["s"] || k["arrowdown"] || m.back;
      const left = k["a"] || k["arrowleft"] || m.left;
      const right = k["d"] || k["arrowright"] || m.right;

      if (left) p.angle += p.rotSpeed;
      if (right) p.angle -= p.rotSpeed;
      if (forward) {
        p.x += Math.sin(p.angle) * p.speed;
        p.z += Math.cos(p.angle) * p.speed;
      }
      if (back) {
        p.x -= Math.sin(p.angle) * p.speed * 0.6;
        p.z -= Math.cos(p.angle) * p.speed * 0.6;
      }

      // Clamp to room
      p.x = Math.max(-7.2, Math.min(7.2, p.x));
      p.z = Math.max(-9.2, Math.min(9.2, p.z));

      // Update player avatar
      playerAvatar.position.set(p.x, 0, p.z);
      playerAvatar.rotation.y = p.angle;

      // Third-person camera
      const camDist = 3.5;
      const camH = 2.8;
      camera.position.set(
        p.x - Math.sin(p.angle) * camDist,
        camH,
        p.z - Math.cos(p.angle) * camDist
      );
      camera.lookAt(p.x, 1.2, p.z);

      // Rotate globe
      globe.rotation.y = time * 0.5;
      globe.rotation.x = Math.sin(time * 0.3) * 0.2;

      // NPC wander
      npcs.forEach(npc => {
        const nx = npc.baseX + Math.sin(time * npc.speed + npc.phase) * 2;
        const nz = npc.baseZ + Math.cos(time * npc.speed * 0.7 + npc.phase) * 1.5;
        const angle = Math.atan2(nx - npc.mesh.position.x, nz - npc.mesh.position.z);
        npc.mesh.position.x += (nx - npc.mesh.position.x) * 0.02;
        npc.mesh.position.z += (nz - npc.mesh.position.z) * 0.02;
        npc.mesh.rotation.y = angle;
      });

      // Proximity check for artworks
      let closest = null;
      let closestDist = 3;
      artworks.forEach(art => {
        const dx = art.position.x - p.x;
        const dz = art.position.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < closestDist) {
          closestDist = dist;
          closest = art.userData.project;
        }
      });
      setNearWork(closest);

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
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [createTextTexture, createAvatarMesh]);

  useEffect(() => {
    if (!started) return;
    const cleanup = initScene();
    const onDown = e => { keysRef.current[e.key.toLowerCase()] = true; };
    const onUp = e => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      if (cleanup) cleanup();
    };
  }, [started, initScene]);

  // ── SPLASH ──
  if (!started) {
    return (
      <div style={{ height: "100vh", background: "linear-gradient(180deg, #0a0a14 0%, #16162a 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#f0e6d3", padding: 20, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.15, background: "repeating-linear-gradient(0deg, transparent, transparent 40px, #e9456010 40px, #e9456010 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #e9456010 40px, #e9456010 41px)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 14, letterSpacing: 6, textTransform: "uppercase", color: "#e94560", marginBottom: 12, fontWeight: 300 }}>StudioLoom</div>
          <h1 style={{ fontSize: 32, fontWeight: 200, margin: "0 0 6px", letterSpacing: 2 }}>Class Gallery</h1>
          <p style={{ fontSize: 13, color: "#8a8a9a", marginBottom: 32, maxWidth: 320, lineHeight: 1.6 }}>
            Walk through a 3D gallery space. Explore student design works on the walls. Other visitors wander around you.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 32, maxWidth: 340 }}>
            {PROJECTS.map((p, i) => (
              <span key={i} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 4, background: p.color + "22", color: p.color, fontWeight: 600 }}>{p.student}</span>
            ))}
          </div>

          <button onClick={() => setStarted(true)} style={{ padding: "14px 40px", background: "linear-gradient(135deg, #e94560, #c73e54)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 24px rgba(233,69,96,0.3)" }}>
            Enter Gallery →
          </button>

          <div style={{ marginTop: 24, fontSize: 11, color: "#555", lineHeight: 1.8 }}>
            {isMobile ? "Use on-screen controls to move" : "WASD or Arrow Keys to move"}
            <br />Walk near artworks to see details
          </div>
        </div>
      </div>
    );
  }

  // ── 3D GALLERY ──
  return (
    <div style={{ height: "100vh", position: "relative", background: "#0a0a14", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* HUD - Top */}
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#e94560", textTransform: "uppercase", fontWeight: 600 }}>StudioLoom Gallery</div>
          <div style={{ fontSize: 11, color: "#8a8a9a", marginTop: 2 }}>MYP Design • Year 4</div>
        </div>
        <div style={{ background: "rgba(10,10,20,0.7)", borderRadius: 6, padding: "6px 10px", backdropFilter: "blur(8px)", border: "1px solid rgba(233,69,96,0.15)" }}>
          <span style={{ fontSize: 10, color: "#8a8a9a" }}>Visitors: </span>
          <span style={{ fontSize: 10, color: "#e94560", fontWeight: 700 }}>4</span>
        </div>
      </div>

      {/* Proximity Info Panel */}
      {nearWork && !selectedWork && (
        <div onClick={() => setSelectedWork(nearWork)} style={{ position: "absolute", bottom: isMobile ? 130 : 60, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,20,0.85)", backdropFilter: "blur(12px)", borderRadius: 12, padding: "12px 20px", border: `1px solid ${nearWork.color}44`, maxWidth: 320, textAlign: "center", cursor: "pointer", color: "#f0e6d3" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{nearWork.title}</div>
          <div style={{ fontSize: 11, color: nearWork.color }}>{nearWork.student} • {nearWork.phase}</div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>Tap to view details</div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedWork && (
        <div onClick={() => setSelectedWork(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 24, maxWidth: 380, width: "100%", border: `1px solid ${selectedWork.color}33`, color: "#f0e6d3" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>{selectedWork.title}</h2>
                <span style={{ fontSize: 11, color: selectedWork.color, fontWeight: 600 }}>{selectedWork.student}</span>
              </div>
              <button onClick={() => setSelectedWork(null)} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: (PHASE_COLORS[selectedWork.phase] || "#888") + "33", color: PHASE_COLORS[selectedWork.phase] || "#888", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{selectedWork.phase}</span>
              {selectedWork.grade && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#ccc", fontWeight: 600 }}>Grade: {selectedWork.grade}</span>}
            </div>

            <p style={{ fontSize: 13, lineHeight: 1.7, color: "#bbb", margin: "0 0 16px" }}>{selectedWork.desc}</p>

            <div style={{ padding: 12, background: `${selectedWork.color}0a`, borderRadius: 8, borderLeft: `3px solid ${selectedWork.color}` }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#666", margin: "0 0 4px" }}>Process Journal</p>
              <p style={{ fontSize: 12, color: "#999", margin: 0, fontStyle: "italic", lineHeight: 1.6 }}>
                "Initial research complete. Moving into prototyping phase. Key insight: user testing revealed unexpected constraints around portability…"
              </p>
            </div>

            <button onClick={() => setSelectedWork(null)} style={{ marginTop: 16, width: "100%", padding: "10px 0", background: selectedWork.color, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && (
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
          {/* Left stick - rotation */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "auto" }}>
            <div style={{ width: 50, height: 50 }} />
            <div style={{ display: "flex", gap: 4 }}>
              <button onTouchStart={() => updateMobile("left", true)} onTouchEnd={() => updateMobile("left", false)}
                style={{ width: 50, height: 50, borderRadius: 10, background: mobileControls.left ? "rgba(233,69,96,0.5)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
              <button onTouchStart={() => updateMobile("right", true)} onTouchEnd={() => updateMobile("right", false)}
                style={{ width: 50, height: 50, borderRadius: 10, background: mobileControls.right ? "rgba(233,69,96,0.5)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
            </div>
          </div>
          {/* Right stick - movement */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "auto" }}>
            <button onTouchStart={() => updateMobile("forward", true)} onTouchEnd={() => updateMobile("forward", false)}
              style={{ width: 50, height: 50, borderRadius: 10, background: mobileControls.forward ? "rgba(233,69,96,0.5)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ width: 50, height: 50 }} />
              <button onTouchStart={() => updateMobile("back", true)} onTouchEnd={() => updateMobile("back", false)}
                style={{ width: 50, height: 50, borderRadius: 10, background: mobileControls.back ? "rgba(233,69,96,0.5)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop controls hint */}
      {!isMobile && (
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 16, alignItems: "center" }}>
          {["W ↑", "A ←", "S ↓", "D →"].map(k => (
            <span key={k} style={{ fontSize: 10, color: "#555", background: "rgba(255,255,255,0.04)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
