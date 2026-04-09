import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

export default function RosasBakeryShowcase() {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const playerRef = useRef({ x: 0, z: 6, angle: Math.PI, speed: 0.055, rotSpeed: 0.03 });
  const keysRef = useRef({});
  const mobileRef = useRef({ forward: false, back: false, left: false, right: false });
  const [mobileControls, setMobileControls] = useState({ forward: false, back: false, left: false, right: false });
  const [isMobile, setIsMobile] = useState(false);
  const [nearRosa, setNearRosa] = useState(false);
  const [dialogue, setDialogue] = useState(null);
  const [showLabel, setShowLabel] = useState(true);

  useEffect(() => { setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0); }, []);
  const updateMobile = (k, v) => { setMobileControls(p => { const n = { ...p, [k]: v }; mobileRef.current = n; return n; }); };

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a1425");

    // Night sky gradient via large sphere
    const skyGeo = new THREE.SphereGeometry(60, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color("#0a0818") },
        bottomColor: { value: new THREE.Color("#1a2040") },
        horizonColor: { value: new THREE.Color("#2a1a3a") },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 col = mix(horizonColor, topColor, max(h, 0.0));
          col = mix(bottomColor, col, smoothstep(-0.1, 0.3, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Fog
    scene.fog = new THREE.FogExp2("#1a1425", 0.04);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountRef.current.appendChild(renderer.domElement);

    // ═══════════════════════════════════════════════════════════
    // LIGHTING — warm evening atmosphere
    // ═══════════════════════════════════════════════════════════

    const ambient = new THREE.AmbientLight("#1a1535", 0.4);
    scene.add(ambient);

    // Moon light (cool blue from above-behind)
    const moon = new THREE.DirectionalLight("#4466aa", 0.3);
    moon.position.set(-8, 12, -10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 0.1;
    moon.shadow.camera.far = 40;
    moon.shadow.camera.left = -15;
    moon.shadow.camera.right = 15;
    moon.shadow.camera.top = 15;
    moon.shadow.camera.bottom = -15;
    moon.shadow.bias = -0.001;
    scene.add(moon);

    // Bakery warm glow (emanating from windows/door)
    const bakeryGlow = new THREE.PointLight("#ff9944", 2.5, 12, 1.5);
    bakeryGlow.position.set(-3, 1.5, -2);
    bakeryGlow.castShadow = true;
    scene.add(bakeryGlow);

    // Street lanterns
    const lanternPositions = [[2, -1], [-1, 3], [4, 3], [-5, 1]];
    const lanternLights = [];
    lanternPositions.forEach(([lx, lz]) => {
      const light = new THREE.PointLight("#ffaa55", 1.2, 6, 2);
      light.position.set(lx, 2.2, lz);
      light.castShadow = false;
      scene.add(light);
      lanternLights.push(light);
    });

    // ═══════════════════════════════════════════════════════════
    // GROUND — cobblestone with texture
    // ═══════════════════════════════════════════════════════════

    // Grass base
    const grassCanvas = document.createElement("canvas");
    grassCanvas.width = 512; grassCanvas.height = 512;
    const gctx = grassCanvas.getContext("2d");
    gctx.fillStyle = "#2a4a22";
    gctx.fillRect(0, 0, 512, 512);
    // Grass variation
    for (let i = 0; i < 2000; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      gctx.fillStyle = `rgba(${30 + Math.random() * 30}, ${60 + Math.random() * 40}, ${20 + Math.random() * 20}, 0.6)`;
      gctx.fillRect(gx, gy, 1 + Math.random() * 2, 3 + Math.random() * 5);
    }
    const grassTex = new THREE.CanvasTexture(grassCanvas);
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(6, 6);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Cobblestone path
    const stoneCanvas = document.createElement("canvas");
    stoneCanvas.width = 256; stoneCanvas.height = 256;
    const sctx = stoneCanvas.getContext("2d");
    sctx.fillStyle = "#4a4440";
    sctx.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const offset = r % 2 === 0 ? 0 : 16;
        const brightness = 55 + Math.random() * 25;
        sctx.fillStyle = `rgb(${brightness + 10}, ${brightness + 5}, ${brightness})`;
        sctx.beginPath();
        sctx.roundRect(c * 32 + 2 + offset, r * 32 + 2, 28, 28, 4);
        sctx.fill();
        sctx.strokeStyle = `rgba(0,0,0,0.3)`;
        sctx.lineWidth = 1;
        sctx.stroke();
      }
    }
    const stoneTex = new THREE.CanvasTexture(stoneCanvas);
    stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
    stoneTex.repeat.set(3, 8);

    // Main path
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 14),
      new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92 })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, 0);
    path.receiveShadow = true;
    scene.add(path);

    // Branch to bakery
    const stoneTex2 = stoneTex.clone();
    stoneTex2.repeat.set(2, 3);
    const branchPath = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 4),
      new THREE.MeshStandardMaterial({ map: stoneTex2, roughness: 0.92 })
    );
    branchPath.rotation.x = -Math.PI / 2;
    branchPath.rotation.z = 0.4;
    branchPath.position.set(-1.8, 0.02, -1.5);
    branchPath.receiveShadow = true;
    scene.add(branchPath);

    // ═══════════════════════════════════════════════════════════
    // ROSA'S BAKERY — detailed building
    // ═══════════════════════════════════════════════════════════

    const bakery = new THREE.Group();
    bakery.position.set(-4.5, 0, -3);

    // Foundation
    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.15, 3.7),
      new THREE.MeshStandardMaterial({ color: "#5a5550", roughness: 0.95 })
    );
    foundation.position.y = 0.075;
    foundation.receiveShadow = true;
    bakery.add(foundation);

    // Main walls - plaster texture
    const wallCanvas = document.createElement("canvas");
    wallCanvas.width = 256; wallCanvas.height = 256;
    const wctx = wallCanvas.getContext("2d");
    wctx.fillStyle = "#d4b896";
    wctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) {
      wctx.fillStyle = `rgba(${160 + Math.random() * 40}, ${140 + Math.random() * 30}, ${110 + Math.random() * 20}, 0.15)`;
      wctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 2 + Math.random() * 6);
    }
    const wallTex = new THREE.CanvasTexture(wallCanvas);

    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.8, 3.5),
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 })
    );
    walls.position.y = 1.55;
    walls.castShadow = true;
    walls.receiveShadow = true;
    bakery.add(walls);

    // Timber frame beams (half-timbered style)
    const beamMat = new THREE.MeshStandardMaterial({ color: "#3a2815", roughness: 0.8 });
    // Horizontal beams
    [0.15, 1.5, 2.9].forEach(by => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.12, 0.12), beamMat);
      beam.position.set(0, by, 1.76);
      beam.castShadow = true;
      bakery.add(beam);
      const beamBack = beam.clone();
      beamBack.position.z = -1.76;
      bakery.add(beamBack);
    });
    // Vertical beams
    [-1.9, -0.6, 0.6, 1.9].forEach(bx => {
      const vbeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.12), beamMat);
      vbeam.position.set(bx, 1.55, 1.76);
      bakery.add(vbeam);
    });
    // Cross beams (X pattern)
    [-1.25, 1.25].forEach(cx => {
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 0.06), beamMat);
      cross1.position.set(cx, 2.1, 1.76);
      cross1.rotation.z = 0.45;
      bakery.add(cross1);
      const cross2 = cross1.clone();
      cross2.rotation.z = -0.45;
      bakery.add(cross2);
    });

    // Roof — steeper, with overhang
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-2.6, 0);
    roofShape.lineTo(0, 2);
    roofShape.lineTo(2.6, 0);
    roofShape.lineTo(-2.6, 0);
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 4.2, bevelEnabled: false });
    const roofCanvas = document.createElement("canvas");
    roofCanvas.width = 128; roofCanvas.height = 128;
    const rctx = roofCanvas.getContext("2d");
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        const offset = r % 2 === 0 ? 0 : 4;
        rctx.fillStyle = `rgb(${100 + Math.random() * 30}, ${50 + Math.random() * 20}, ${30 + Math.random() * 15})`;
        rctx.fillRect(c * 8 + offset, r * 8, 8, 8);
      }
    }
    const roofTex = new THREE.CanvasTexture(roofCanvas);
    roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping;
    roofTex.repeat.set(2, 2);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.9 }));
    roof.position.set(0, 2.9, -2.1);
    roof.castShadow = true;
    bakery.add(roof);

    // Chimney
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.5, 0.5),
      new THREE.MeshStandardMaterial({ color: "#6a4a3a", roughness: 0.85 })
    );
    chimney.position.set(1.2, 4.2, -0.5);
    chimney.castShadow = true;
    bakery.add(chimney);
    const chimneyTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.12, 0.65),
      new THREE.MeshStandardMaterial({ color: "#5a3a2a" })
    );
    chimneyTop.position.set(1.2, 4.95, -0.5);
    bakery.add(chimneyTop);

    // Door — detailed
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 1.8, 0.15),
      new THREE.MeshStandardMaterial({ color: "#2a1a0a", roughness: 0.7 })
    );
    doorFrame.position.set(0, 1.05, 1.78);
    bakery.add(doorFrame);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 1.6, 0.08),
      new THREE.MeshStandardMaterial({ color: "#6b3a1a", roughness: 0.6 })
    );
    door.position.set(0, 1.05, 1.85);
    bakery.add(door);
    // Door panels
    [[-0.15, 1.4], [0.15, 1.4], [-0.15, 0.75], [0.15, 0.75]].forEach(([px, py]) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.45, 0.02),
        new THREE.MeshStandardMaterial({ color: "#5a2a10", roughness: 0.5 })
      );
      panel.position.set(px, py, 1.9);
      bakery.add(panel);
    });
    // Door handle
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshStandardMaterial({ color: "#c4a040", metalness: 0.8, roughness: 0.2 })
    );
    handle.position.set(0.25, 1, 1.92);
    bakery.add(handle);

    // Windows — glowing warm interior
    const windowGlowMat = new THREE.MeshStandardMaterial({
      color: "#ffcc66", emissive: "#ff9933", emissiveIntensity: 0.8, roughness: 0.3,
    });
    [[-1.3, 1.6], [1.3, 1.6]].forEach(([wx, wy]) => {
      // Window frame
      const wFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.65, 0.12),
        new THREE.MeshStandardMaterial({ color: "#3a2815", roughness: 0.7 })
      );
      wFrame.position.set(wx, wy, 1.76);
      bakery.add(wFrame);
      // Glass panes (2x2 grid)
      [[-0.12, 0.1], [0.12, 0.1], [-0.12, -0.1], [0.12, -0.1]].forEach(([gx, gy]) => {
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 0.02),
          windowGlowMat
        );
        pane.position.set(wx + gx, wy + gy, 1.82);
        bakery.add(pane);
      });
      // Window sill
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.06, 0.2),
        new THREE.MeshStandardMaterial({ color: "#3a2815", roughness: 0.7 })
      );
      sill.position.set(wx, wy - 0.35, 1.82);
      bakery.add(sill);
    });

    // Awning over door
    const awningShape = new THREE.Shape();
    awningShape.moveTo(-0.8, 0);
    awningShape.quadraticCurveTo(0, 0.3, 0.8, 0);
    const awningGeo = new THREE.ExtrudeGeometry(awningShape, { depth: 0.8, bevelEnabled: false });
    const awning = new THREE.Mesh(awningGeo, new THREE.MeshStandardMaterial({ color: "#8b2020", roughness: 0.7 }));
    awning.position.set(0, 2.1, 1.8);
    awning.rotation.x = -Math.PI / 2;
    bakery.add(awning);

    // Sign: "Rosa's Bakery"
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 0.06),
      new THREE.MeshStandardMaterial({ color: "#2a1a0a", roughness: 0.6 })
    );
    signBoard.position.set(0, 2.55, 1.9);
    bakery.add(signBoard);
    // Sign text via canvas
    const signCanvas = document.createElement("canvas");
    signCanvas.width = 256; signCanvas.height = 80;
    const sgctx = signCanvas.getContext("2d");
    sgctx.fillStyle = "#2a1a0a";
    sgctx.fillRect(0, 0, 256, 80);
    sgctx.fillStyle = "#f0d4a0";
    sgctx.font = "bold 32px Georgia, serif";
    sgctx.textAlign = "center";
    sgctx.fillText("Rosa's Bakery", 128, 45);
    sgctx.fillStyle = "#d4a060";
    sgctx.font = "16px Georgia, serif";
    sgctx.fillText("🧁  Est. 2019  🧁", 128, 70);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.45),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 })
    );
    signFace.position.set(0, 2.55, 1.94);
    bakery.add(signFace);

    // Hanging sign bracket
    const bracket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: "#3a3a3a", metalness: 0.7 })
    );
    bracket.position.set(-0.9, 2.65, 1.85);
    bracket.rotation.z = Math.PI / 2;
    bakery.add(bracket);

    // Flower boxes under windows
    [[-1.3, 1.2], [1.3, 1.2]].forEach(([fx, fy]) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.2, 0.2),
        new THREE.MeshStandardMaterial({ color: "#5a3a2a", roughness: 0.8 })
      );
      box.position.set(fx, fy, 1.88);
      bakery.add(box);
      // Flowers
      const fColors = ["#e8647c", "#f0c27a", "#ff8a8a", "#ffaa55"];
      for (let f = 0; f < 6; f++) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 6, 6),
          new THREE.MeshStandardMaterial({ color: fColors[f % fColors.length] })
        );
        flower.position.set(fx - 0.25 + f * 0.1, fy + 0.15, 1.92);
        bakery.add(flower);
        // Stems
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.12, 3),
          new THREE.MeshStandardMaterial({ color: "#3a6a2a" })
        );
        stem.position.set(fx - 0.25 + f * 0.1, fy + 0.08, 1.92);
        bakery.add(stem);
      }
    });

    // Bakery steps
    [0.08, 0.22].forEach((sy, si) => {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 - si * 0.2, 0.12, 0.4 - si * 0.1),
        new THREE.MeshStandardMaterial({ color: "#7a7068", roughness: 0.9 })
      );
      step.position.set(0, sy, 2.1 + si * 0.2);
      step.receiveShadow = true;
      bakery.add(step);
    });

    scene.add(bakery);

    // ═══════════════════════════════════════════════════════════
    // STREET LANTERNS — detailed
    // ═══════════════════════════════════════════════════════════

    const lanternMeshes = [];
    lanternPositions.forEach(([lx, lz]) => {
      const group = new THREE.Group();
      group.position.set(lx, 0, lz);

      // Post
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: "#2a2a2a", metalness: 0.6, roughness: 0.4 })
      );
      post.position.y = 1.1;
      post.castShadow = true;
      group.add(post);

      // Arm
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4),
        new THREE.MeshStandardMaterial({ color: "#2a2a2a", metalness: 0.6 })
      );
      arm.position.set(0.2, 2.1, 0);
      arm.rotation.z = -Math.PI / 4;
      group.add(arm);

      // Lantern housing
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.3, 0.22),
        new THREE.MeshStandardMaterial({ color: "#1a1a1a", metalness: 0.5 })
      );
      housing.position.set(0.35, 2.1, 0);
      group.add(housing);

      // Lantern glass (glowing)
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.2, 0.16),
        new THREE.MeshStandardMaterial({ color: "#ffcc44", emissive: "#ff9922", emissiveIntensity: 1.5, transparent: true, opacity: 0.85 })
      );
      glass.position.set(0.35, 2.1, 0);
      group.add(glass);

      // Roof cap
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.15, 4),
        new THREE.MeshStandardMaterial({ color: "#1a1a1a", metalness: 0.5 })
      );
      cap.position.set(0.35, 2.32, 0);
      cap.rotation.y = Math.PI / 4;
      group.add(cap);

      // Base
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.08, 6),
        new THREE.MeshStandardMaterial({ color: "#2a2a2a", metalness: 0.5 })
      );
      base.position.y = 0.04;
      group.add(base);

      scene.add(group);
      lanternMeshes.push(group);
    });

    // ═══════════════════════════════════════════════════════════
    // TREES — more detailed with variation
    // ═══════════════════════════════════════════════════════════

    const treeData = [
      { x: -9, z: -5, s: 1.1, type: "pine" }, { x: -8, z: 0, s: 0.9, type: "oak" },
      { x: -9, z: 4, s: 1.0, type: "pine" }, { x: 6, z: -5, s: 1.2, type: "oak" },
      { x: 7, z: 2, s: 0.8, type: "pine" }, { x: 8, z: 6, s: 1.0, type: "pine" },
      { x: -3, z: -7, s: 0.7, type: "oak" }, { x: 3, z: -7, s: 0.9, type: "pine" },
      { x: -6, z: 6, s: 1.1, type: "oak" }, { x: 0, z: -8, s: 0.8, type: "pine" },
    ];

    treeData.forEach(t => {
      const group = new THREE.Group();
      group.position.set(t.x, 0, t.z);
      group.scale.setScalar(t.s);

      if (t.type === "pine") {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.18, 1.5, 6),
          new THREE.MeshStandardMaterial({ color: "#4a2a15", roughness: 0.9 })
        );
        trunk.position.y = 0.75;
        trunk.castShadow = true;
        group.add(trunk);

        [{ y: 1.8, r: 1.0, h: 1.3 }, { y: 2.6, r: 0.75, h: 1.1 }, { y: 3.2, r: 0.5, h: 0.9 }, { y: 3.7, r: 0.25, h: 0.6 }].forEach((l, i) => {
          const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(l.r, l.h, 7),
            new THREE.MeshStandardMaterial({
              color: i % 2 === 0 ? "#1a4a1a" : "#2a5a2a",
              roughness: 0.85,
            })
          );
          leaves.position.y = l.y;
          leaves.castShadow = true;
          group.add(leaves);
        });
      } else {
        // Oak - rounder canopy
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.2, 1.8, 6),
          new THREE.MeshStandardMaterial({ color: "#5a3a20", roughness: 0.9 })
        );
        trunk.position.y = 0.9;
        trunk.castShadow = true;
        group.add(trunk);

        // Branches
        [[-0.3, 1.5, 0.2, -0.4], [0.25, 1.6, -0.15, 0.5]].forEach(([bx, by, bz, rot]) => {
          const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.06, 0.8, 4),
            new THREE.MeshStandardMaterial({ color: "#4a2a15" })
          );
          branch.position.set(bx, by, bz);
          branch.rotation.z = rot;
          group.add(branch);
        });

        // Foliage clusters
        [
          [0, 2.8, 0, 0.9], [-0.4, 2.5, 0.3, 0.7], [0.4, 2.4, -0.2, 0.65],
          [0, 3.3, 0, 0.6], [-0.3, 3.0, -0.2, 0.55],
        ].forEach(([cx, cy, cz, cr]) => {
          const cluster = new THREE.Mesh(
            new THREE.SphereGeometry(cr, 7, 6),
            new THREE.MeshStandardMaterial({
              color: new THREE.Color().setHSL(0.28 + Math.random() * 0.05, 0.5, 0.2 + Math.random() * 0.08),
              roughness: 0.85,
            })
          );
          cluster.position.set(cx, cy, cz);
          cluster.castShadow = true;
          group.add(cluster);
        });
      }
      scene.add(group);
    });

    // ═══════════════════════════════════════════════════════════
    // MARKET STALL (next to bakery)
    // ═══════════════════════════════════════════════════════════

    const stall = new THREE.Group();
    stall.position.set(-1.5, 0, -4);

    // Table
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.08, 1),
      new THREE.MeshStandardMaterial({ color: "#6a4a30", roughness: 0.8 })
    );
    table.position.y = 0.85;
    table.castShadow = true;
    stall.add(table);

    // Legs
    [[-0.9, 0, -0.4], [0.9, 0, -0.4], [-0.9, 0, 0.4], [0.9, 0, 0.4]].forEach(([lx, _, lz]) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.85, 4),
        new THREE.MeshStandardMaterial({ color: "#5a3a20" })
      );
      leg.position.set(lx, 0.425, lz);
      stall.add(leg);
    });

    // Canopy
    const canopyGeo = new THREE.PlaneGeometry(2.4, 1.4);
    const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({ color: "#cc4444", roughness: 0.7, side: THREE.DoubleSide }));
    canopy.position.set(0, 1.8, 0);
    canopy.rotation.x = -0.15;
    stall.add(canopy);

    // Canopy poles
    [[-1.1, -0.6], [1.1, -0.6]].forEach(([px, pz]) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: "#5a3a20" })
      );
      pole.position.set(px, 0.9, pz);
      stall.add(pole);
    });

    // Bread loaves on table
    const breadMat = new THREE.MeshStandardMaterial({ color: "#c49450", roughness: 0.75 });
    [[-0.5, 0], [0, 0.1], [0.5, -0.05], [-0.2, -0.15], [0.3, 0.15]].forEach(([bx, bz]) => {
      const loaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        breadMat
      );
      loaf.scale.set(1.4, 0.7, 1);
      loaf.position.set(bx, 0.97, bz);
      stall.add(loaf);
    });

    scene.add(stall);

    // ═══════════════════════════════════════════════════════════
    // FOUNTAIN (instead of well — more visual interest)
    // ═══════════════════════════════════════════════════════════

    const fountain = new THREE.Group();
    fountain.position.set(2, 0, -1);

    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.1, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: "#6a6a70", roughness: 0.8, metalness: 0.1 })
    );
    basin.position.y = 0.25;
    fountain.add(basin);

    // Water surface
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 12),
      new THREE.MeshStandardMaterial({ color: "#3a6a9a", roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.45;
    fountain.add(water);

    // Center column
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: "#7a7a80", roughness: 0.6 })
    );
    column.position.y = 0.9;
    fountain.add(column);

    // Top ornament
    const ornament = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({ color: "#c4a040", metalness: 0.8, roughness: 0.2 })
    );
    ornament.position.y = 1.55;
    fountain.add(ornament);

    scene.add(fountain);

    // ═══════════════════════════════════════════════════════════
    // PARTICLE SYSTEMS
    // ═══════════════════════════════════════════════════════════

    // Chimney smoke
    const smokeCount = 40;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeSizes = new Float32Array(smokeCount);
    const smokeAlphas = new Float32Array(smokeCount);
    const smokeVelocities = [];
    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = -4.5 + 1.2 + (Math.random() - 0.5) * 0.2;
      smokePositions[i * 3 + 1] = 5 + Math.random() * 3;
      smokePositions[i * 3 + 2] = -3 - 0.5;
      smokeSizes[i] = 3 + Math.random() * 4;
      smokeAlphas[i] = Math.random();
      smokeVelocities.push({ vx: (Math.random() - 0.5) * 0.003, vy: 0.008 + Math.random() * 0.005, life: Math.random() });
    }
    smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3));
    smokeGeo.setAttribute("size", new THREE.BufferAttribute(smokeSizes, 1));
    const smokeMat = new THREE.PointsMaterial({ color: "#aaa8a0", transparent: true, opacity: 0.15, size: 0.3, sizeAttenuation: true, depthWrite: false });
    const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokeParticles);

    // Fireflies
    const fireflyCount = 25;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPos = new Float32Array(fireflyCount * 3);
    const fireflyData = [];
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPos[i * 3] = (Math.random() - 0.5) * 16;
      fireflyPos[i * 3 + 1] = 0.5 + Math.random() * 2;
      fireflyPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
      fireflyData.push({ phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 1.5, radius: 0.3 + Math.random() * 0.5 });
    }
    fireflyGeo.setAttribute("position", new THREE.BufferAttribute(fireflyPos, 3));
    const fireflyMat = new THREE.PointsMaterial({ color: "#ffee88", transparent: true, opacity: 0.8, size: 0.08, sizeAttenuation: true, depthWrite: false });
    const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
    scene.add(fireflies);

    // Water splash particles
    const splashCount = 15;
    const splashGeo = new THREE.BufferGeometry();
    const splashPos = new Float32Array(splashCount * 3);
    const splashData = [];
    for (let i = 0; i < splashCount; i++) {
      splashPos[i * 3] = 2;
      splashPos[i * 3 + 1] = 1.5;
      splashPos[i * 3 + 2] = -1;
      splashData.push({ phase: (i / splashCount) * Math.PI * 2, speed: 1 + Math.random() * 0.5 });
    }
    splashGeo.setAttribute("position", new THREE.BufferAttribute(splashPos, 3));
    const splashMat = new THREE.PointsMaterial({ color: "#88bbee", transparent: true, opacity: 0.5, size: 0.05, sizeAttenuation: true });
    const splashParticles = new THREE.Points(splashGeo, splashMat);
    scene.add(splashParticles);

    // ═══════════════════════════════════════════════════════════
    // ROSA NPC
    // ═══════════════════════════════════════════════════════════

    const rosa = new THREE.Group();
    rosa.position.set(-3, 0, -1);
    const rBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 8), new THREE.MeshStandardMaterial({ color: "#e8a87c", roughness: 0.5 }));
    rBody.position.y = 0.65;
    rBody.castShadow = true;
    rosa.add(rBody);
    // Apron
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: "#fff", roughness: 0.6 }));
    apron.position.y = 0.55;
    apron.rotation.y = Math.PI;
    rosa.add(apron);
    const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshStandardMaterial({ color: "#e8a87c", roughness: 0.5 }));
    rHead.position.y = 1.3;
    rHead.castShadow = true;
    rosa.add(rHead);
    // Chef hat
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.25, 8), new THREE.MeshStandardMaterial({ color: "#fff", roughness: 0.4 }));
    hat.position.y = 1.6;
    rosa.add(hat);
    const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: "#fff", roughness: 0.4 }));
    hatTop.position.y = 1.72;
    rosa.add(hatTop);
    // Eyes
    [[-0.08, 1.34, -0.18], [0.08, 1.34, -0.18]].forEach(pos => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshStandardMaterial({ color: "#fff" }));
      eye.position.set(...pos);
      rosa.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshStandardMaterial({ color: "#2a1a0a" }));
      pupil.position.set(pos[0], pos[1], pos[2] - 0.03);
      rosa.add(pupil);
    });
    // Shadow
    const rShadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.2 }));
    rShadow.rotation.x = -Math.PI / 2;
    rShadow.position.y = 0.02;
    rosa.add(rShadow);

    // Quest marker
    const qMarker = new THREE.Group();
    const qSphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: "#f0c41b", emissive: "#f0c41b", emissiveIntensity: 0.6 }));
    qMarker.add(qSphere);
    const qGlow = new THREE.PointLight("#f0c41b", 0.8, 3);
    qMarker.add(qGlow);
    qMarker.position.set(-3, 2.2, -1);
    scene.add(qMarker);
    scene.add(rosa);

    // ═══════════════════════════════════════════════════════════
    // PLAYER
    // ═══════════════════════════════════════════════════════════

    const playerGroup = new THREE.Group();
    const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.85, 8), new THREE.MeshStandardMaterial({ color: "#e94560", roughness: 0.4 }));
    pBody.position.y = 0.625;
    pBody.castShadow = true;
    playerGroup.add(pBody);
    const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: "#e94560", roughness: 0.4 }));
    pHead.position.y = 1.25;
    pHead.castShadow = true;
    playerGroup.add(pHead);
    [[-0.08, 1.3, -0.16], [0.08, 1.3, -0.16]].forEach(pos => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), new THREE.MeshStandardMaterial({ color: "#fff" }));
      eye.position.set(...pos);
      playerGroup.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), new THREE.MeshStandardMaterial({ color: "#1a1a2e" }));
      pupil.position.set(pos[0], pos[1], pos[2] - 0.025);
      playerGroup.add(pupil);
    });
    const pShadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 8), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.25 }));
    pShadow.rotation.x = -Math.PI / 2;
    pShadow.position.y = 0.02;
    playerGroup.add(pShadow);
    playerGroup.position.set(0, 0, 6);
    scene.add(playerGroup);

    // Stars
    const starCount = 200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.4 + 0.1;
      const r = 45 + Math.random() * 10;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#ffffff", size: 0.15, sizeAttenuation: true }));
    scene.add(stars);

    // ═══════════════════════════════════════════════════════════
    // ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════

    let time = 0;
    const colliders = [
      { x: -4.5, z: -3, hw: 2.5, hd: 2.2 },   // Rosa's Bakery
      { x: -1.5, z: -4, hw: 1.3, hd: 0.8 },    // Market stall
      { x: 2, z: -1, hw: 1.3, hd: 1.3 },        // Fountain
      { x: -3, z: -1, hw: 0.5, hd: 0.5 },       // Rosa NPC
    ];

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;

      const p = playerRef.current;
      const k = keysRef.current;
      const m = mobileRef.current;

      if (!dialogue) {
        if (k["a"] || k["arrowleft"] || m.left) p.angle += p.rotSpeed;
        if (k["d"] || k["arrowright"] || m.right) p.angle -= p.rotSpeed;

        let moving = false;
        if (k["w"] || k["arrowup"] || m.forward) {
          const nx = p.x + Math.sin(p.angle) * p.speed;
          const nz = p.z + Math.cos(p.angle) * p.speed;
          let blocked = false;
          colliders.forEach(c => { if (Math.abs(nx - c.x) < c.hw && Math.abs(nz - c.z) < c.hd) blocked = true; });
          if (nx > -12 && nx < 12 && nz > -10 && nz < 10 && !blocked) { p.x = nx; p.z = nz; moving = true; }
        }
        if (k["s"] || k["arrowdown"] || m.back) {
          const nx = p.x - Math.sin(p.angle) * p.speed * 0.5;
          const nz = p.z - Math.cos(p.angle) * p.speed * 0.5;
          let blocked = false;
          colliders.forEach(c => { if (Math.abs(nx - c.x) < c.hw && Math.abs(nz - c.z) < c.hd) blocked = true; });
          if (nx > -12 && nx < 12 && nz > -10 && nz < 10 && !blocked) { p.x = nx; p.z = nz; moving = true; }
        }

        playerGroup.position.x = p.x;
        playerGroup.position.z = p.z;
        playerGroup.rotation.y = p.angle;
        playerGroup.position.y = moving ? Math.sin(time * 10) * 0.04 : Math.sin(time * 1.5) * 0.01;
      }

      // Camera
      const cd = 4.5, ch = 3.2;
      camera.position.x += (p.x - Math.sin(p.angle) * cd - camera.position.x) * 0.05;
      camera.position.z += (p.z - Math.cos(p.angle) * cd - camera.position.z) * 0.05;
      camera.position.y += (ch - camera.position.y) * 0.05;
      camera.lookAt(p.x, 1, p.z);

      // Rosa idle
      rosa.position.y = Math.sin(time * 1.5) * 0.02;
      rosa.rotation.y = Math.sin(time * 0.4) * 0.2;

      // Quest marker
      qMarker.position.y = 2.2 + Math.sin(time * 3) * 0.15;
      qMarker.rotation.y = time * 2;

      // Lantern flicker
      lanternLights.forEach((l, i) => {
        l.intensity = 1.2 + Math.sin(time * 8 + i * 3) * 0.15 + Math.sin(time * 13 + i * 7) * 0.1;
      });

      // Bakery glow pulse
      bakeryGlow.intensity = 2.5 + Math.sin(time * 2) * 0.3;

      // Smoke particles
      const sPos = smokeGeo.attributes.position.array;
      for (let i = 0; i < smokeCount; i++) {
        smokeVelocities[i].life += 0.004;
        sPos[i * 3] += smokeVelocities[i].vx + Math.sin(time + i) * 0.001;
        sPos[i * 3 + 1] += smokeVelocities[i].vy;
        if (smokeVelocities[i].life > 1) {
          sPos[i * 3] = -4.5 + 1.2 + (Math.random() - 0.5) * 0.15;
          sPos[i * 3 + 1] = 5;
          sPos[i * 3 + 2] = -3 - 0.5;
          smokeVelocities[i].life = 0;
          smokeVelocities[i].vx = (Math.random() - 0.5) * 0.003;
          smokeVelocities[i].vy = 0.008 + Math.random() * 0.005;
        }
      }
      smokeGeo.attributes.position.needsUpdate = true;

      // Fireflies
      const fPos = fireflyGeo.attributes.position.array;
      for (let i = 0; i < fireflyCount; i++) {
        const d = fireflyData[i];
        fPos[i * 3] += Math.sin(time * d.speed + d.phase) * 0.005;
        fPos[i * 3 + 1] += Math.cos(time * d.speed * 0.7 + d.phase) * 0.003;
        fPos[i * 3 + 2] += Math.sin(time * d.speed * 0.5 + d.phase * 2) * 0.005;
      }
      fireflyGeo.attributes.position.needsUpdate = true;
      fireflyMat.opacity = 0.4 + Math.sin(time * 3) * 0.3;

      // Fountain splash
      const spPos = splashGeo.attributes.position.array;
      for (let i = 0; i < splashCount; i++) {
        const d = splashData[i];
        const t2 = (time * d.speed + d.phase) % (Math.PI * 2);
        const progress = t2 / (Math.PI * 2);
        spPos[i * 3] = 2 + Math.sin(d.phase) * 0.3 * progress;
        spPos[i * 3 + 1] = 1.5 + progress * 0.8 - progress * progress * 1.5;
        spPos[i * 3 + 2] = -1 + Math.cos(d.phase) * 0.3 * progress;
      }
      splashGeo.attributes.position.needsUpdate = true;

      // Water surface shimmer
      water.material.opacity = 0.6 + Math.sin(time * 2) * 0.1;

      // Stars twinkle
      stars.material.opacity = 0.6 + Math.sin(time * 0.5) * 0.2;

      // NPC proximity
      const dx = -3 - p.x, dz = -1 - p.z;
      setNearRosa(Math.sqrt(dx * dx + dz * dz) < 2.5);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Input
  useEffect(() => {
    const down = e => {
      keysRef.current[e.key.toLowerCase()] = true;
      if ((e.key.toLowerCase() === "e" || e.key === " ") && !dialogue && nearRosa) {
        setDialogue(0);
        if (showLabel) setShowLabel(false);
      } else if ((e.key.toLowerCase() === "e" || e.key === " ") && dialogue !== null) {
        advanceDialogue();
      }
      if (showLabel) setShowLabel(false);
    };
    const up = e => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  });

  const rosaLines = [
    { speaker: "Rosa", text: "Oh! A visitor! Welcome, welcome to my little bakery.", mood: "delighted" },
    { speaker: "Rosa", text: "Smell that? Fresh sourdough. Been baking since 4 this morning. But I have a problem...", mood: "concerned" },
    { speaker: "Rosa", text: "See those cups? Every morning, Mr. Tanaka burns his fingers. The teachers rushing to school nearly drop theirs.", mood: "worried" },
    { speaker: "Rosa", text: "I need someone to design a proper cup sleeve. Eco-friendly — I refuse to add more waste to the world.", mood: "determined" },
    { speaker: "Rosa", text: "You look like a designer to me. What do you say — will you help?", mood: "hopeful" },
  ];

  const advanceDialogue = () => {
    if (dialogue < rosaLines.length - 1) setDialogue(dialogue + 1);
    else setDialogue(null);
  };

  return (
    <div style={{ height: "100vh", position: "relative", fontFamily: "'Georgia', serif", overflow: "hidden", background: "#0a0818" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

      {/* Title */}
      {showLabel && (
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", zIndex: 20, pointerEvents: "none" }}>
          <div style={{ fontSize: 10, letterSpacing: 6, color: "#f0c41b", textTransform: "uppercase", marginBottom: 6 }}>StudioLoom</div>
          <h1 style={{ fontSize: 28, fontWeight: 300, color: "#f0e6d3", margin: "0 0 6px", letterSpacing: 3, textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}>Rosa's Bakery</h1>
          <p style={{ fontSize: 12, color: "#aa9977", fontStyle: "italic" }}>Designville — Evening</p>
          <p style={{ fontSize: 11, color: "#665544", marginTop: 16 }}>{isMobile ? "Use controls to explore" : "WASD to move — E to talk"}</p>
        </div>
      )}

      {/* HUD */}
      {!showLabel && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(10,8,20,0.7)", backdropFilter: "blur(6px)", borderRadius: 8, padding: "6px 12px", border: "1px solid rgba(240,196,27,0.1)", zIndex: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#f0c41b", textTransform: "uppercase", fontWeight: 600 }}>Designville</div>
          <div style={{ fontSize: 10, color: "#665544", marginTop: 1, fontStyle: "italic" }}>Evening — Rosa's Corner</div>
        </div>
      )}

      {/* Proximity */}
      {nearRosa && dialogue === null && !showLabel && (
        <div style={{ position: "absolute", bottom: isMobile ? 160 : 60, left: "50%", transform: "translateX(-50%)", background: "rgba(10,8,20,0.8)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px 18px", border: "1px solid rgba(232,168,124,0.2)", color: "#e8a87c", fontSize: 12, fontWeight: 600, zIndex: 15, whiteSpace: "nowrap" }}>
          {isMobile ? "Tap 💬 to talk to Rosa" : "Press E to talk to Rosa"}
        </div>
      )}

      {/* Dialogue */}
      {dialogue !== null && (
        <div onClick={advanceDialogue} style={{ position: "absolute", bottom: isMobile ? 130 : 16, left: 12, right: 12, zIndex: 30, maxWidth: 460, margin: "0 auto" }}>
          <div style={{ background: "rgba(10,8,20,0.92)", backdropFilter: "blur(14px)", borderRadius: 16, padding: "16px 20px", border: "1px solid rgba(232,168,124,0.2)", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #e8a87c, #c4886a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👩‍🍳</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e8a87c" }}>{rosaLines[dialogue].speaker}</div>
                <div style={{ fontSize: 9, color: "#665544", fontStyle: "italic" }}>{rosaLines[dialogue].mood}</div>
              </div>
            </div>
            <p style={{ fontSize: 15, color: "#f0e6d3", lineHeight: 1.8, margin: "0 0 8px", fontFamily: "'Georgia', serif" }}>
              "{rosaLines[dialogue].text}"
            </p>
            <div style={{ textAlign: "right", fontSize: 10, color: "#554433" }}>
              {dialogue + 1}/{rosaLines.length} — {isMobile ? "tap" : "E"} ▶
            </div>
          </div>
        </div>
      )}

      {/* Mobile */}
      {isMobile && !showLabel && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end", pointerEvents: "none", zIndex: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, pointerEvents: "auto" }}>
            <button onTouchStart={() => updateMobile("forward", true)} onTouchEnd={() => updateMobile("forward", false)} style={{ width: 50, height: 50, borderRadius: 12, background: mobileControls.forward ? "rgba(233,69,96,0.4)" : "rgba(10,8,20,0.6)", border: "1px solid rgba(240,196,27,0.15)", color: "#f0c41b", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
            <div style={{ display: "flex", gap: 3 }}>
              <button onTouchStart={() => updateMobile("left", true)} onTouchEnd={() => updateMobile("left", false)} style={{ width: 50, height: 50, borderRadius: 12, background: mobileControls.left ? "rgba(233,69,96,0.4)" : "rgba(10,8,20,0.6)", border: "1px solid rgba(240,196,27,0.15)", color: "#f0c41b", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
              <div style={{ width: 50, height: 50 }} />
              <button onTouchStart={() => updateMobile("right", true)} onTouchEnd={() => updateMobile("right", false)} style={{ width: 50, height: 50, borderRadius: 12, background: mobileControls.right ? "rgba(233,69,96,0.4)" : "rgba(10,8,20,0.6)", border: "1px solid rgba(240,196,27,0.15)", color: "#f0c41b", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
            </div>
            <button onTouchStart={() => updateMobile("back", true)} onTouchEnd={() => updateMobile("back", false)} style={{ width: 50, height: 50, borderRadius: 12, background: mobileControls.back ? "rgba(233,69,96,0.4)" : "rgba(10,8,20,0.6)", border: "1px solid rgba(240,196,27,0.15)", color: "#f0c41b", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
          </div>
          {nearRosa && dialogue === null && (
            <button onClick={() => setDialogue(0)} style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(240,196,27,0.15)", border: "2px solid #f0c41b", color: "#f0c41b", fontSize: 22, cursor: "pointer", pointerEvents: "auto" }}>💬</button>
          )}
        </div>
      )}

      {!isMobile && !showLabel && dialogue === null && (
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10, zIndex: 10 }}>
          {[["WASD", "Move"], ["E", "Talk"]].map(([k, l]) => (
            <span key={k} style={{ fontSize: 10, color: "#554433", background: "rgba(10,8,20,0.5)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(240,196,27,0.08)" }}>
              <strong style={{ color: "#887755" }}>{k}</strong> {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
