import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════
// ASSET LIBRARY DEFINITIONS
// ═══════════════════════════════════════════════════════════

const ENVIRONMENTS = [
  { id: "bakery", name: "Bakery Interior", icon: "🧁", floor: "#2a2018", wall: "#d4b896", wallBack: "#3a2a1a" },
  { id: "workshop", name: "Workshop", icon: "🔨", floor: "#1e1a14", wall: "#4a3a2a", wallBack: "#2a2018" },
  { id: "school", name: "School Library", icon: "📚", floor: "#2a2828", wall: "#8a9aa0", wallBack: "#3a4448" },
  { id: "garden", name: "Garden", icon: "🌱", floor: "#2a4a22", wall: null, wallBack: null },
  { id: "gallery", name: "Gallery", icon: "🏛️", floor: "#1e1e2a", wall: "#e8e4e0", wallBack: "#2a2a3a" },
];

const LIGHTING_PRESETS = [
  { id: "morning", name: "Morning", icon: "🌅", sun: "#ffd4a0", sunI: 1.2, sunPos: [8, 10, 5], ambient: "#b4c8e0", ambI: 0.5, sky: "#87CEEB" },
  { id: "afternoon", name: "Afternoon", icon: "☀️", sun: "#fff5e6", sunI: 1.4, sunPos: [2, 12, 3], ambient: "#d0d8e0", ambI: 0.6, sky: "#6aafe0" },
  { id: "evening", name: "Evening", icon: "🌇", sun: "#ff8844", sunI: 0.8, sunPos: [-6, 4, 8], ambient: "#2a1a30", ambI: 0.3, sky: "#1a1030" },
  { id: "night", name: "Night", icon: "🌙", sun: "#4466aa", sunI: 0.25, sunPos: [-8, 10, -5], ambient: "#0a0818", ambI: 0.2, sky: "#0a0814" },
  { id: "cozy", name: "Cozy Interior", icon: "🕯️", sun: "#ff6622", sunI: 0.15, sunPos: [-3, 2, -1], ambient: "#1a1008", ambI: 0.3, sky: "#1a1008" },
];

const WEATHER_OPTIONS = [
  { id: "none", name: "Clear", icon: "—" },
  { id: "fireflies", name: "Fireflies", icon: "✨" },
  { id: "dust", name: "Dust Motes", icon: "💨" },
  { id: "rain", name: "Rain", icon: "🌧️" },
  { id: "snow", name: "Snow", icon: "❄️" },
  { id: "leaves", name: "Falling Leaves", icon: "🍂" },
];

const PROP_LIBRARY = [
  { id: "counter", name: "Counter", icon: "🪵", cat: "furniture" },
  { id: "table", name: "Table", icon: "🪑", cat: "furniture" },
  { id: "shelf", name: "Shelf", icon: "📦", cat: "furniture" },
  { id: "lantern", name: "Lantern", icon: "🏮", cat: "lighting" },
  { id: "forge", name: "Forge", icon: "🔥", cat: "tools" },
  { id: "anvil", name: "Anvil", icon: "⚒️", cat: "tools" },
  { id: "workbench", name: "Workbench", icon: "🔧", cat: "tools" },
  { id: "tree_pine", name: "Pine Tree", icon: "🌲", cat: "nature" },
  { id: "tree_oak", name: "Oak Tree", icon: "🌳", cat: "nature" },
  { id: "flowers", name: "Flowers", icon: "🌸", cat: "nature" },
  { id: "fountain", name: "Fountain", icon: "⛲", cat: "structure" },
  { id: "fence", name: "Fence", icon: "🚧", cat: "structure" },
  { id: "cups", name: "Coffee Cups", icon: "☕", cat: "objects" },
  { id: "books", name: "Books", icon: "📖", cat: "objects" },
  { id: "sign", name: "Sign", icon: "🪧", cat: "structure" },
];

const CHARACTER_PRESETS = [
  { id: "baker", name: "Baker", emoji: "👩‍🍳", color: "#e8a87c" },
  { id: "teacher", name: "Teacher", emoji: "👨‍🏫", color: "#7eb8da" },
  { id: "elder", name: "Elder", emoji: "👵", color: "#a8d5a2" },
  { id: "child", name: "Child", emoji: "🧒", color: "#f0c27a" },
  { id: "shopkeeper", name: "Shopkeeper", emoji: "🧑‍💼", color: "#c4b5e0" },
  { id: "artist", name: "Artist", emoji: "👩‍🎨", color: "#b07cc6" },
  { id: "none", name: "No Character", emoji: "—", color: "#555" },
];

// ═══════════════════════════════════════════════════════════
// 3D BUILDERS
// ═══════════════════════════════════════════════════════════

const ang = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: opts.roughness || 0.6, metalness: opts.metalness || 0, ...opts });

function buildCharacter(scene, preset) {
  if (preset.id === "none") return null;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 6), ang(preset.color));
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 5, 4), ang(preset.color));
  head.position.y = 1.3; head.castShadow = true; g.add(head);
  if (preset.id === "baker") {
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.55, 6, 1, false, 0, Math.PI), ang("#fff", { roughness: 0.7 }));
    apron.position.y = 0.58; apron.rotation.y = Math.PI; g.add(apron);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.25, 5), ang("#fff")); hat.position.y = 1.58; g.add(hat);
    const hatT = new THREE.Mesh(new THREE.SphereGeometry(0.19, 5, 4), ang("#fff")); hatT.position.y = 1.7; g.add(hatT);
  }
  if (preset.id === "teacher") {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.04), ang("#e94560")); tie.position.set(0, 0.85, 0.22); g.add(tie);
    const glasses1 = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 4, 6), ang("#3a3a3a", { metalness: 0.5 })); glasses1.position.set(-0.08, 1.34, -0.2); g.add(glasses1);
    const glasses2 = glasses1.clone(); glasses2.position.x = 0.08; g.add(glasses2);
  }
  if (preset.id === "elder") {
    const shawl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.3, 6), ang("#8a6a8a", { roughness: 0.8 })); shawl.position.y = 1.05; g.add(shawl);
  }
  // Eyes
  [[-0.08, 1.34, -0.18], [0.08, 1.34, -0.18]].forEach(p => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), ang("#fff")); e.position.set(p[0], p[1], p[2]); g.add(e);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), ang("#2a1a0a")); pu.position.set(p[0], p[1], p[2] - 0.02); g.add(pu);
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; g.add(shadow);
  g.position.set(0, 0, 0);
  g.userData.type = "character";
  scene.add(g);
  return g;
}

function buildProp(scene, propId, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.userData.type = "prop";
  g.userData.propId = propId;

  switch (propId) {
    case "counter": {
      const c = new THREE.Mesh(new THREE.BoxGeometry(2, 0.85, 0.5), ang("#6a4a28", { roughness: 0.8 })); c.position.y = 0.425; c.castShadow = true; g.add(c);
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 0.6), ang("#7a5a38")); t.position.y = 0.87; g.add(t);
      break;
    }
    case "table": {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.8), ang("#6a5030")); t.position.y = 0.8; t.castShadow = true; g.add(t);
      [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].forEach(([lx, lz]) => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), ang("#5a4020")); l.position.set(lx, 0.4, lz); g.add(l);
      });
      break;
    }
    case "shelf": {
      [0.8, 1.4, 2].forEach(sy => {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), ang("#5a4028")); s.position.set(0, sy, 0); g.add(s);
      });
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.04), ang("#4a3420")); back.position.set(0, 1.1, -0.15); g.add(back);
      break;
    }
    case "lantern": {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.2, 5), ang("#2a2a2a", { metalness: 0.5 })); post.position.y = 1.1; post.castShadow = true; g.add(post);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), ang("#2a2a2a", { metalness: 0.4 })); housing.position.y = 2.2; g.add(housing);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), ang("#ffaa44", { emissive: "#ff8822", emissiveIntensity: 1.2, transparent: true, opacity: 0.8 })); glass.position.y = 2.2; g.add(glass);
      const light = new THREE.PointLight("#ffaa44", 1, 5, 2); light.position.y = 2.2; g.add(light);
      break;
    }
    case "forge": {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), ang("#4a4040", { roughness: 0.95 })); base.position.y = 0.5; base.castShadow = true; g.add(base);
      const fire = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.08), ang("#ff4400", { emissive: "#ff2200", emissiveIntensity: 2 })); fire.position.set(0, 0.5, 0.51); g.add(fire);
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.7, 0.5, 4), ang("#3a3535")); hood.position.y = 1.25; hood.rotation.y = Math.PI / 4; g.add(hood);
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.2, 4), ang("#3a3535")); chimney.position.y = 2.1; g.add(chimney);
      const fLight = new THREE.PointLight("#ff6622", 2, 6, 1.5); fLight.position.set(0, 0.8, 0.5); g.add(fLight);
      break;
    }
    case "anvil": {
      const ab = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.25, 5), ang("#3a3a3a", { metalness: 0.6, roughness: 0.4 })); ab.position.y = 0.125; ab.castShadow = true; g.add(ab);
      const at = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.2), ang("#4a4a4a", { metalness: 0.7, roughness: 0.3 })); at.position.y = 0.3; g.add(at);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), ang("#4a4a4a", { metalness: 0.7 })); horn.position.set(0.28, 0.3, 0); horn.rotation.z = -Math.PI / 2; g.add(horn);
      break;
    }
    case "workbench": {
      const wb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.8), ang("#6a5030")); wb.position.y = 0.85; wb.castShadow = true; g.add(wb);
      [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.07), ang("#5a4020")); leg.position.set(lx, 0.425, lz); g.add(leg);
      });
      break;
    }
    case "tree_pine": {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.3, 5), ang("#4a2a15", { roughness: 0.9 })); trunk.position.y = 0.65; trunk.castShadow = true; g.add(trunk);
      [{ y: 1.6, r: 0.8, h: 1.1 }, { y: 2.3, r: 0.6, h: 0.9 }, { y: 2.8, r: 0.35, h: 0.7 }].forEach((l, i) => {
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(l.r, l.h, 6), ang(i % 2 === 0 ? "#1a4a1a" : "#2a5a2a", { roughness: 0.85 }));
        leaves.position.y = l.y; leaves.castShadow = true; g.add(leaves);
      });
      break;
    }
    case "tree_oak": {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 5), ang("#5a3a20", { roughness: 0.9 })); trunk.position.y = 0.8; trunk.castShadow = true; g.add(trunk);
      [[0, 2.5, 0, 0.8], [-0.3, 2.2, 0.2, 0.6], [0.3, 2.3, -0.15, 0.55]].forEach(([cx, cy, cz, cr]) => {
        const cluster = new THREE.Mesh(new THREE.SphereGeometry(cr, 6, 5), ang("#2a5a20", { roughness: 0.85 }));
        cluster.position.set(cx, cy, cz); cluster.castShadow = true; g.add(cluster);
      });
      break;
    }
    case "flowers": {
      ["#e8647c", "#f0c27a", "#b07cc6", "#ff8a65", "#7ecf8a"].forEach((c, i) => {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), ang(c));
        f.position.set(Math.sin(i * 1.3) * 0.4, 0.12, Math.cos(i * 1.3) * 0.4); g.add(f);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 3), ang("#3a6a2a"));
        stem.position.set(Math.sin(i * 1.3) * 0.4, 0.05, Math.cos(i * 1.3) * 0.4); g.add(stem);
      });
      break;
    }
    case "fountain": {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.45, 10), ang("#6a6a70", { roughness: 0.8, metalness: 0.1 })); basin.position.y = 0.225; g.add(basin);
      const water = new THREE.Mesh(new THREE.CircleGeometry(0.7, 10), ang("#3a6a9a", { roughness: 0.1, transparent: true, opacity: 0.6 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.42; g.add(water);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1, 6), ang("#7a7a80")); col.position.y = 0.85; g.add(col);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), ang("#c4a040", { metalness: 0.7, roughness: 0.2 })); orb.position.y = 1.4; g.add(orb);
      break;
    }
    case "fence": {
      for (let i = 0; i < 5; i++) {
        const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 4), ang("#8b7355", { roughness: 0.85 })); p2.position.set(i * 0.6 - 1.2, 0.275, 0); p2.castShadow = true; g.add(p2);
        if (i < 4) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.03), ang("#8b7355")); rail.position.set(i * 0.6 - 0.9, 0.35, 0); g.add(rail); }
      }
      break;
    }
    case "cups": {
      [[-0.15, 0], [0.05, 0.1], [0.25, -0.05], [-0.05, -0.12]].forEach(([cx2, cz2]) => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 5), ang("#e8e0d0", { roughness: 0.3 })); cup.position.set(cx2, 0.055, cz2); g.add(cup);
      });
      break;
    }
    case "books": {
      [["#8a3030", 0], ["#2a5a8a", 0.08], ["#5a8a3a", 0.16], ["#8a6a2a", 0.22]].forEach(([c, bx]) => {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.12), ang(c, { roughness: 0.7 })); book.position.set(bx - 0.11, 0.09, 0); g.add(book);
      });
      break;
    }
    case "sign": {
      const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 4), ang("#5a3a1a")); post2.position.y = 0.9; post2.castShadow = true; g.add(post2);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.04), ang("#3a2a15")); board.position.y = 1.6; g.add(board);
      break;
    }
  }
  scene.add(g);
  return g;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function SceneComposer() {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const objectsRef = useRef([]);
  const particlesRef = useRef(null);
  const lightsRef = useRef([]);

  const [env, setEnv] = useState(ENVIRONMENTS[0]);
  const [lighting, setLighting] = useState(LIGHTING_PRESETS[4]);
  const [weather, setWeather] = useState("fireflies");
  const [character, setCharacter] = useState(CHARACTER_PRESETS[0]);
  const [activeProps, setActiveProps] = useState(["counter", "lantern", "cups"]);
  const [panel, setPanel] = useState("env");
  const [autoRotate, setAutoRotate] = useState(true);

  const dragRef = useRef({ dragging: false, prevX: 0, angle: 0.5 });

  // Rebuild scene when config changes
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    // Clean previous
    if (rendererRef.current) {
      cancelAnimationFrame(frameRef.current);
      if (el.contains(rendererRef.current.domElement)) el.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(lighting.sky);
    if (lighting.id === "night" || lighting.id === "cozy" || lighting.id === "evening") {
      scene.fog = new THREE.FogExp2(lighting.sky, 0.04);
    } else {
      scene.fog = new THREE.FogExp2(lighting.sky, 0.02);
    }

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 60);
    camera.position.set(3, 2.5, 4);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = lighting.id === "night" ? 0.8 : lighting.id === "cozy" ? 0.85 : 1.1;
    el.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Lighting
    const ambient = new THREE.AmbientLight(lighting.ambient, lighting.ambI);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(lighting.sun, lighting.sunI);
    sun.position.set(...lighting.sunPos);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 30;
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
    scene.add(sun);

    if (lighting.id === "night" || lighting.id === "evening") {
      const hemi = new THREE.HemisphereLight("#1a1a40", "#0a0a10", 0.15);
      scene.add(hemi);
    }

    // Environment
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      ang(env.floor, { roughness: 0.92 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    if (env.wall) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), ang(env.wallBack, { roughness: 0.9 }));
      wall.position.set(0, 2.5, -4); wall.receiveShadow = true; scene.add(wall);
      const sideW = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), ang(env.wallBack, { roughness: 0.9 }));
      sideW.position.set(-5, 2.5, 0); sideW.rotation.y = Math.PI / 2; scene.add(sideW);
    }

    if (env.id === "garden") {
      // Grass patches
      for (let i = 0; i < 40; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15 + Math.random() * 0.1, 3), ang("#3a7a2a"));
        blade.position.set((Math.random() - 0.5) * 10, 0.07, (Math.random() - 0.5) * 10);
        blade.rotation.z = (Math.random() - 0.5) * 0.3;
        scene.add(blade);
      }
    }

    // Stars for night
    if (lighting.id === "night" || lighting.id === "evening") {
      const starCount = 100;
      const starGeo = new THREE.BufferGeometry();
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * 0.6 + 0.1;
        starPos[i * 3] = 30 * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = 30 * Math.cos(phi);
        starPos[i * 3 + 2] = 30 * Math.sin(phi) * Math.sin(theta);
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#fff", size: 0.12, sizeAttenuation: true })));
    }

    // Character
    const charMesh = buildCharacter(scene, character);

    // Props
    const propMeshes = [];
    const propPositions = [[-2.5, -1.5], [2, -1], [-1, -2.5], [2.5, 1], [-2, 2], [-3.5, -0.5], [1, 2.5], [0, -3], [3, -2.5]];
    activeProps.forEach((pid, i) => {
      const pos = propPositions[i % propPositions.length];
      const m = buildProp(scene, pid, pos[0], pos[1]);
      if (m) propMeshes.push(m);
    });

    // Weather particles
    let particleSystem = null;
    if (weather !== "none") {
      const count = weather === "rain" ? 200 : weather === "snow" ? 150 : 30;
      const pGeo = new THREE.BufferGeometry();
      const pPos = new Float32Array(count * 3);
      const pVel = [];
      for (let i = 0; i < count; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 12;
        pPos[i * 3 + 1] = Math.random() * 6;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
        pVel.push({ vy: weather === "rain" ? -0.08 : weather === "snow" ? -0.01 : 0, phase: Math.random() * Math.PI * 2 });
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));

      const pColor = weather === "fireflies" ? "#ffee88" : weather === "dust" ? "#aa9977" : weather === "rain" ? "#88aacc" : weather === "snow" ? "#ddeeff" : "#aa7733";
      const pSize = weather === "rain" ? 0.02 : weather === "snow" ? 0.06 : weather === "fireflies" ? 0.06 : weather === "leaves" ? 0.08 : 0.03;

      particleSystem = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: pColor, size: pSize, transparent: true, opacity: 0.7, sizeAttenuation: true, depthWrite: false }));
      scene.add(particleSystem);
      particlesRef.current = { geo: pGeo, vel: pVel, type: weather, count };
    }

    // Animation
    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;

      // Camera
      if (autoRotate) dragRef.current.angle += 0.003;
      const cr = 5;
      camera.position.x = Math.sin(dragRef.current.angle) * cr;
      camera.position.z = Math.cos(dragRef.current.angle) * cr;
      camera.position.y = 2.5 + Math.sin(time * 0.3) * 0.1;
      camera.lookAt(0, 0.8, 0);

      // Character idle
      if (charMesh) {
        charMesh.position.y = Math.sin(time * 1.5) * 0.006;
        charMesh.rotation.y = Math.sin(time * 0.4) * 0.1;
      }

      // Weather
      if (particlesRef.current) {
        const pd = particlesRef.current;
        const pp = pd.geo.attributes.position.array;
        for (let i = 0; i < pd.count; i++) {
          if (pd.type === "rain") {
            pp[i * 3 + 1] += pd.vel[i].vy;
            if (pp[i * 3 + 1] < 0) { pp[i * 3 + 1] = 5 + Math.random(); pp[i * 3] = (Math.random() - 0.5) * 12; pp[i * 3 + 2] = (Math.random() - 0.5) * 12; }
          } else if (pd.type === "snow") {
            pp[i * 3 + 1] -= 0.008 + Math.sin(time + pd.vel[i].phase) * 0.002;
            pp[i * 3] += Math.sin(time * 0.5 + pd.vel[i].phase) * 0.003;
            if (pp[i * 3 + 1] < 0) { pp[i * 3 + 1] = 5; pp[i * 3] = (Math.random() - 0.5) * 12; }
          } else if (pd.type === "fireflies") {
            pp[i * 3] += Math.sin(time * 0.5 + pd.vel[i].phase) * 0.004;
            pp[i * 3 + 1] += Math.cos(time * 0.3 + pd.vel[i].phase) * 0.002;
            pp[i * 3 + 2] += Math.sin(time * 0.4 + pd.vel[i].phase * 2) * 0.004;
          } else if (pd.type === "dust") {
            pp[i * 3] += Math.sin(time * 0.2 + pd.vel[i].phase) * 0.002;
            pp[i * 3 + 1] += Math.cos(time * 0.15 + pd.vel[i].phase) * 0.001;
          } else if (pd.type === "leaves") {
            pp[i * 3 + 1] -= 0.006;
            pp[i * 3] += Math.sin(time + pd.vel[i].phase) * 0.006;
            pp[i * 3 + 2] += Math.cos(time * 0.7 + pd.vel[i].phase) * 0.004;
            if (pp[i * 3 + 1] < 0) { pp[i * 3 + 1] = 4 + Math.random() * 2; pp[i * 3] = (Math.random() - 0.5) * 10; }
          }
        }
        pd.geo.attributes.position.needsUpdate = true;
        if (particleSystem) particleSystem.material.opacity = pd.type === "fireflies" ? 0.4 + Math.sin(time * 3) * 0.3 : 0.6;
      }

      // Flicker lights in props
      scene.traverse(obj => {
        if (obj.isPointLight && obj.parent?.userData?.propId === "forge") {
          obj.intensity = 2 + Math.sin(time * 8) * 0.3;
        }
        if (obj.isPointLight && obj.parent?.userData?.propId === "lantern") {
          obj.intensity = 1 + Math.sin(time * 6 + 1) * 0.12;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Drag
    const onDown = (e) => { dragRef.current.dragging = true; dragRef.current.prevX = e.clientX || e.touches?.[0]?.clientX || 0; setAutoRotate(false); };
    const onMove = (e) => { if (!dragRef.current.dragging) return; const cx = e.clientX || e.touches?.[0]?.clientX || 0; dragRef.current.angle += (cx - dragRef.current.prevX) * 0.006; dragRef.current.prevX = cx; };
    const onUp = () => { dragRef.current.dragging = false; };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);

    const onResize = () => { const nw = el.clientWidth, nh = el.clientHeight; camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [env, lighting, weather, character, activeProps, autoRotate]);

  const toggleProp = (id) => {
    setActiveProps(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const PANELS = { env: "Environment", light: "Lighting", weather: "Weather", char: "Character", props: "Props" };

  return (
    <div style={{ height: "100vh", background: "#0c0c14", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8e0d4", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: 9, letterSpacing: 4, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Loominary</span>
          <span style={{ fontSize: 13, color: "#e8e0d4", fontWeight: 300, letterSpacing: 1, marginLeft: 10 }}>Scene Composer</span>
        </div>
        <div style={{ fontSize: 9, color: "#443322" }}>
          {env.name} • {lighting.name} • {weather !== "none" ? weather : "clear"} • {activeProps.length} props
        </div>
      </div>

      {/* 3D Viewport */}
      <div ref={mountRef} style={{ flex: 1, minHeight: 0, cursor: "grab", position: "relative" }}>
        {/* Viewport label */}
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(10,8,4,0.6)", borderRadius: 6, padding: "4px 8px", zIndex: 5 }}>
          <span style={{ fontSize: 8, color: "#554433", letterSpacing: 1 }}>LIVE PREVIEW — drag to orbit</span>
        </div>
      </div>

      {/* Panel Tabs */}
      <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        {Object.entries(PANELS).map(([id, name]) => (
          <button key={id} onClick={() => setPanel(id)}
            style={{ flex: 1, padding: "8px 0", background: panel === id ? "rgba(233,69,96,0.06)" : "transparent", border: "none", borderTop: panel === id ? "2px solid #e94560" : "2px solid transparent", color: panel === id ? "#e94560" : "#554433", fontSize: 10, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5 }}>
            {name}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.03)", flexShrink: 0, maxHeight: 180, overflowY: "auto" }}>
        {panel === "env" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ENVIRONMENTS.map(e => (
              <button key={e.id} onClick={() => setEnv(e)}
                style={{ padding: "8px 12px", background: env.id === e.id ? "rgba(233,69,96,0.1)" : "rgba(255,255,255,0.02)", border: env.id === e.id ? "1px solid #e9456044" : "1px solid rgba(255,255,255,0.04)", borderRadius: 8, color: env.id === e.id ? "#e94560" : "#aaa", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{e.icon}</span> {e.name}
              </button>
            ))}
          </div>
        )}

        {panel === "light" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LIGHTING_PRESETS.map(l => (
              <button key={l.id} onClick={() => setLighting(l)}
                style={{ padding: "8px 12px", background: lighting.id === l.id ? "rgba(233,69,96,0.1)" : "rgba(255,255,255,0.02)", border: lighting.id === l.id ? "1px solid #e9456044" : "1px solid rgba(255,255,255,0.04)", borderRadius: 8, color: lighting.id === l.id ? "#e94560" : "#aaa", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{l.icon}</span> {l.name}
              </button>
            ))}
          </div>
        )}

        {panel === "weather" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {WEATHER_OPTIONS.map(w => (
              <button key={w.id} onClick={() => setWeather(w.id)}
                style={{ padding: "8px 12px", background: weather === w.id ? "rgba(233,69,96,0.1)" : "rgba(255,255,255,0.02)", border: weather === w.id ? "1px solid #e9456044" : "1px solid rgba(255,255,255,0.04)", borderRadius: 8, color: weather === w.id ? "#e94560" : "#aaa", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{w.icon}</span> {w.name}
              </button>
            ))}
          </div>
        )}

        {panel === "char" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CHARACTER_PRESETS.map(c => (
              <button key={c.id} onClick={() => setCharacter(c)}
                style={{ padding: "8px 12px", background: character.id === c.id ? "rgba(233,69,96,0.1)" : "rgba(255,255,255,0.02)", border: character.id === c.id ? `1px solid ${c.color}44` : "1px solid rgba(255,255,255,0.04)", borderRadius: 8, color: character.id === c.id ? c.color : "#aaa", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
        )}

        {panel === "props" && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {PROP_LIBRARY.map(p => (
              <button key={p.id} onClick={() => toggleProp(p.id)}
                style={{ padding: "6px 10px", background: activeProps.includes(p.id) ? "rgba(233,69,96,0.1)" : "rgba(255,255,255,0.02)", border: activeProps.includes(p.id) ? "1px solid #e9456044" : "1px solid rgba(255,255,255,0.04)", borderRadius: 6, color: activeProps.includes(p.id) ? "#e94560" : "#888", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13 }}>{p.icon}</span> {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export bar */}
      <div style={{ padding: "6px 14px", borderTop: "1px solid rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "rgba(255,255,255,0.01)" }}>
        <span style={{ fontSize: 9, color: "#332211" }}>
          Components: {1 + (character.id !== "none" ? 1 : 0) + activeProps.length + (weather !== "none" ? 1 : 0)} loaded
        </span>
        <button style={{ padding: "5px 14px", background: "#e94560", color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
          Save Scene →
        </button>
      </div>
    </div>
  );
}
