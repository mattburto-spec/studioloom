/**
 * ============================================================
 * DISCOVERY ENGINE — R3F 3D JOURNEY PROTOTYPE
 * ============================================================
 *
 * Rebuilds the 8-station Discovery journey with procedural
 * low-poly 3D environments and a full 3D Kit character.
 *
 * Stations:
 *   0. Identity Card — Welcome foyer (palette, tools, workspace)
 *   1. Campfire — Binary quick-fire pairs
 *   2. Workshop — Archetype scenarios
 *   3. Collection Wall — Interests, values, irritations
 *   4. Window — Community scene with hotspots
 *   5. Toolkit — Resources & self-efficacy
 *   6. Crossroads — AI doors & fear cards
 *   7. Launchpad — Project statement & grand reveal
 *
 * Architecture: Raw Three.js + React (artifact-compatible).
 * In production, swap for @react-three/fiber + @react-three/drei.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// ═══════════════════════════════════════════════════════════════
// SECTION 1: CONSTANTS & CONTENT POOLS
// ═══════════════════════════════════════════════════════════════

const STATION_META = [
  { id: 0, name: "Identity Card", subtitle: "Welcome to the studio", env: "foyer", colors: { primary: "#F59E0B", bg: "#FEF3C7", accent: "#D97706" } },
  { id: 1, name: "The Campfire", subtitle: "How do you work?", env: "campfire", colors: { primary: "#EA580C", bg: "#431407", accent: "#FB923C" } },
  { id: 2, name: "The Workshop", subtitle: "What's your superpower?", env: "workshop", colors: { primary: "#0D9488", bg: "#134E4A", accent: "#5EEAD4" } },
  { id: 3, name: "Collection Wall", subtitle: "What lights you up?", env: "gallery", colors: { primary: "#6366F1", bg: "#1E1B4B", accent: "#A5B4FC" } },
  { id: 4, name: "The Window", subtitle: "What do you see out there?", env: "window", colors: { primary: "#3B82F6", bg: "#1E3A5F", accent: "#93C5FD" } },
  { id: 5, name: "Your Toolkit", subtitle: "What do you bring?", env: "shelves", colors: { primary: "#059669", bg: "#064E3B", accent: "#6EE7B7" } },
  { id: 6, name: "Crossroads", subtitle: "Choose your path", env: "corridor", colors: { primary: "#7C3AED", bg: "#2E1065", accent: "#C4B5FD" } },
  { id: 7, name: "Launchpad", subtitle: "Your grand reveal", env: "rooftop", colors: { primary: "#F472B6", bg: "#831843", accent: "#FBCFE8" } },
];

// Station 0: Identity
const PALETTES = [
  { id: "warm", name: "Warm", colors: ["#F59E0B", "#EF4444", "#F97316", "#FCD34D"] },
  { id: "cool", name: "Cool", colors: ["#3B82F6", "#06B6D4", "#8B5CF6", "#93C5FD"] },
  { id: "bold", name: "Bold", colors: ["#DC2626", "#F97316", "#EAB308", "#7C3AED"] },
  { id: "earth", name: "Earth", colors: ["#92400E", "#A16207", "#65A30D", "#78716C"] },
  { id: "neon", name: "Neon", colors: ["#EC4899", "#06B6D4", "#84CC16", "#F472B6"] },
];

const TOOLS = [
  { id: "hammer", label: "Hammer", icon: "🔨", archetype: "maker" },
  { id: "magnifier", label: "Magnifying Glass", icon: "🔍", archetype: "researcher" },
  { id: "clipboard", label: "Clipboard", icon: "📋", archetype: "leader" },
  { id: "megaphone", label: "Megaphone", icon: "📣", archetype: "communicator" },
  { id: "paintbrush", label: "Paintbrush", icon: "🎨", archetype: "creative" },
  { id: "gear", label: "Gear", icon: "⚙️", archetype: "systems" },
  { id: "pencil", label: "Pencil", icon: "✏️", archetype: "creative" },
  { id: "microscope", label: "Microscope", icon: "🔬", archetype: "researcher" },
  { id: "camera", label: "Camera", icon: "📷", archetype: "creative" },
  { id: "laptop", label: "Laptop", icon: "💻", archetype: "systems" },
  { id: "scissors", label: "Scissors", icon: "✂️", archetype: "maker" },
  { id: "compass", label: "Compass", icon: "📐", archetype: "systems" },
];

const WORKSPACE_ITEMS = [
  { id: "tidy_desk", label: "Tidy desk", icon: "🗄️", trait: "structured" },
  { id: "messy_desk", label: "Creative chaos", icon: "🎪", trait: "flexible" },
  { id: "whiteboard", label: "Whiteboard", icon: "📝", trait: "planner" },
  { id: "sticky_notes", label: "Sticky notes", icon: "📌", trait: "improviser" },
  { id: "plants", label: "Plants", icon: "🌿", trait: "marathoner" },
  { id: "headphones", label: "Headphones", icon: "🎧", trait: "solo" },
  { id: "two_chairs", label: "Two chairs", icon: "🪑", trait: "collaborator" },
  { id: "books", label: "Reference books", icon: "📚", trait: "researcher" },
  { id: "prototypes", label: "Prototype models", icon: "🏗️", trait: "maker" },
  { id: "mood_board", label: "Inspiration board", icon: "🖼️", trait: "creative" },
  { id: "tools_rack", label: "Tool organizer", icon: "🧰", trait: "systems" },
  { id: "coffee", label: "Coffee setup", icon: "☕", trait: "marathoner" },
  { id: "calendar", label: "Calendar", icon: "📅", trait: "planner" },
  { id: "sketchbook", label: "Sketchbook", icon: "📓", trait: "creative" },
  { id: "collab_board", label: "Collab board", icon: "👥", trait: "collaborator" },
  { id: "clock", label: "Clock", icon: "⏰", trait: "structured" },
];

// Station 1: Binary pairs
const BINARY_PAIRS = [
  { id: "planning", prompt: "New project, blank page. You...", a: "Grab a pencil and start sketching", b: "Write down a plan first", dimA: "improviser", dimB: "planner" },
  { id: "social", prompt: "Stuck on a problem. You...", a: "Find someone to talk it through", b: "Headphones on, figure it out alone", dimA: "collaborative", dimB: "independent" },
  { id: "structure", prompt: "Your desk right now is...", a: "Organised — I know where things are", b: "A mess — but I know where everything is", dimA: "structured", dimB: "flexible" },
  { id: "energy", prompt: "Saturday morning, no plans. You...", a: "Pick one thing and go deep for hours", b: "Do a bunch of different stuff", dimA: "deep_focus", dimB: "burst" },
  { id: "decision", prompt: "Choosing between two project ideas...", a: "Pick the one that feels right", b: "Make a pros and cons list", dimA: "gut", dimB: "analytical" },
  { id: "risk", prompt: "Project is 'good enough' with 2 days left...", a: "Tear it apart, try something ambitious", b: "Polish until it's really solid", dimA: "risk_taker", dimB: "reliable" },
  { id: "pace", prompt: "First day on a new project...", a: "Research, think, plan, then start", b: "Get something made by end of day", dimA: "slow_build", dimB: "fast_start" },
  { id: "feedback", prompt: "Teacher hands back your work...", a: "Look at specific marks and comments", b: "Check the overall grade and vibe", dimA: "specific", dimB: "big_picture" },
  { id: "scope", prompt: "Extra week on a project, you'd...", a: "Go deeper into what you've got", b: "Add something new", dimA: "depth", dimB: "breadth" },
  { id: "expression", prompt: "Need to explain an idea...", a: "Draw it or build it", b: "Talk or write it out", dimA: "visual", dimB: "verbal" },
  { id: "learning", prompt: "Learning a new tool, you...", a: "Watch a video first", b: "Just start pressing buttons", dimA: "study", dimB: "experiment" },
  { id: "source", prompt: "You 'get' something when...", a: "Someone shows a great example", b: "Someone explains the idea behind it", dimA: "example", dimB: "concept" },
];

// Station 2: Scenarios
const SCENARIOS = [
  { id: "crisis", prompt: "Group project — plan isn't working, deadline next week. You...",
    options: [
      { text: "Quietly build a backup plan", archetype: "maker" },
      { text: "Call a meeting, new direction", archetype: "leader" },
      { text: "Research what went wrong", archetype: "researcher" },
      { text: "Sketch 3 quick alternatives", archetype: "creative" },
    ]},
  { id: "free_period", prompt: "Teacher absent, free period, project due in 3 days. You...",
    options: [
      { text: "Head to workshop, start making", archetype: "maker" },
      { text: "Research what others have done", archetype: "researcher" },
      { text: "Find your group, coordinate", archetype: "leader" },
      { text: "Grab sketchbook, brainstorm wildly", archetype: "creative" },
    ]},
  { id: "feedback_crunch", prompt: "Teacher says design is 'fine but safe.' One day to improve...",
    options: [
      { text: "Rebuild one section from scratch", archetype: "maker" },
      { text: "Study award-winning examples", archetype: "researcher" },
      { text: "Ask 3 classmates for honest feedback", archetype: "communicator" },
      { text: "Generate 5 radical alternatives", archetype: "creative" },
    ]},
];

// Station 3: Interests
const INTEREST_ICONS = [
  { id: "tech", label: "Technology", icon: "💻" }, { id: "art", label: "Art & Design", icon: "🎨" },
  { id: "music", label: "Music", icon: "🎵" }, { id: "nature", label: "Nature", icon: "🌿" },
  { id: "sports", label: "Sports", icon: "⚽" }, { id: "food", label: "Food & Cooking", icon: "🍳" },
  { id: "science", label: "Science", icon: "🔬" }, { id: "fashion", label: "Fashion", icon: "👗" },
  { id: "gaming", label: "Gaming", icon: "🎮" }, { id: "film", label: "Film & Video", icon: "🎬" },
  { id: "building", label: "Building Things", icon: "🏗️" }, { id: "animals", label: "Animals", icon: "🐾" },
  { id: "social", label: "Social Justice", icon: "✊" }, { id: "space", label: "Space", icon: "🚀" },
  { id: "writing", label: "Writing", icon: "✍️" }, { id: "travel", label: "Travel", icon: "✈️" },
  { id: "photo", label: "Photography", icon: "📸" }, { id: "math", label: "Puzzles & Math", icon: "🧩" },
  { id: "robots", label: "Robots", icon: "🤖" }, { id: "environment", label: "Environment", icon: "🌍" },
];

const VALUES_CARDS = [
  { id: "creativity", label: "Creativity", desc: "Making something original" },
  { id: "helping", label: "Helping Others", desc: "Making a difference" },
  { id: "challenge", label: "Challenge", desc: "Pushing my limits" },
  { id: "teamwork", label: "Teamwork", desc: "Working with others" },
  { id: "independence", label: "Independence", desc: "Doing it my way" },
  { id: "precision", label: "Precision", desc: "Getting it exactly right" },
  { id: "speed", label: "Speed", desc: "Moving fast and iterating" },
  { id: "beauty", label: "Beauty", desc: "Making things beautiful" },
  { id: "logic", label: "Logic", desc: "Things that make sense" },
  { id: "fun", label: "Fun", desc: "Enjoying the process" },
  { id: "impact", label: "Impact", desc: "Changing something real" },
  { id: "learning", label: "Learning", desc: "Understanding new things" },
];

// Station 4: Community hotspots
const COMMUNITY_HOTSPOTS = [
  { id: "school", label: "School", x: -3, z: -2, color: "#3B82F6" },
  { id: "park", label: "Park", x: 2, z: -3, color: "#22C55E" },
  { id: "market", label: "Market", x: -2, z: 2, color: "#F59E0B" },
  { id: "home", label: "Homes", x: 3, z: 1, color: "#EF4444" },
  { id: "clinic", label: "Clinic", x: 0, z: -4, color: "#EC4899" },
  { id: "workshop_area", label: "Workshop", x: -4, z: 0, color: "#8B5CF6" },
];

// Station 5: Self-efficacy domains
const EFFICACY_DOMAINS = [
  { id: "research", label: "Researching", desc: "Finding out what you need to know" },
  { id: "ideate", label: "Coming up with ideas", desc: "Generating creative solutions" },
  { id: "plan", label: "Planning & organising", desc: "Mapping out the steps" },
  { id: "make", label: "Making & building", desc: "Getting hands-on with materials" },
  { id: "present", label: "Presenting work", desc: "Sharing what you've made" },
  { id: "evaluate", label: "Evaluating", desc: "Judging quality and improving" },
  { id: "collaborate", label: "Working with others", desc: "Collaborating effectively" },
];

// Station 6: Fear cards
const FEAR_CARDS = [
  { id: "fail", label: "What if I fail?", response: "Failure is iteration in disguise. Every professional designer fails their way to great work. The question isn't 'will I fail?' — it's 'will I learn from it?'" },
  { id: "ideas", label: "What if I run out of ideas?", response: "Ideas aren't a finite resource. They come from looking at the world. The more you observe, the more you have. Start with what annoys you." },
  { id: "not_good", label: "What if I'm not good enough?", response: "'Good enough' is a moving target. You're comparing your chapter 1 to someone else's chapter 20. The only useful comparison is you vs. you last month." },
  { id: "boring", label: "What if it's boring?", response: "If YOU find it boring, that's valuable data. Chase the version of this that excites you. The energy you bring to a project is the most important material." },
  { id: "time", label: "What if I run out of time?", response: "Time pressure is a design constraint, not an enemy. Some of the best work happens under deadlines. The trick is knowing what to cut, not what to add." },
];

// Station 7: Grand reveal archetypes
const ARCHETYPES = {
  maker: { name: "The Maker", desc: "You learn by doing. Hands first, theory later.", color: "#EF4444", icon: "🔨" },
  researcher: { name: "The Researcher", desc: "You dig deep before you build.", color: "#3B82F6", icon: "🔍" },
  leader: { name: "The Leader", desc: "You see the big picture and move people.", color: "#F59E0B", icon: "📋" },
  creative: { name: "The Creative", desc: "You see possibilities everywhere.", color: "#8B5CF6", icon: "🎨" },
  communicator: { name: "The Communicator", desc: "You connect ideas and people.", color: "#EC4899", icon: "🗣️" },
  systems: { name: "The Systems Thinker", desc: "You see how everything connects.", color: "#059669", icon: "⚙️" },
};

// Kit dialogue per station
const KIT_DIALOGUE = {
  0: { entry: "Hey! Welcome to my studio. Let's set yours up.", idle: "Take your time — pick what feels right.", exit: "Nice choices. That says a lot about you." },
  1: { entry: "Quick round — just go with your gut. Ready?", idle: "No right answers here. Just honest ones.", exit: "Interesting... I'm starting to see how you tick." },
  2: { entry: "Let me throw some situations at you.", idle: "What would you actually do — not what sounds good.", exit: "I think I know your superpower now..." },
  3: { entry: "Show me what lights you up.", idle: "Pick anything that catches your eye.", exit: "That's quite a collection. I see patterns." },
  4: { entry: "Look out the window. What do you see?", idle: "Every great design starts with noticing something.", exit: "You've got eyes for the real problems." },
  5: { entry: "What do you bring to the table?", idle: "Be honest — this isn't a job interview.", exit: "You've got more going for you than you think." },
  6: { entry: "Three doors. Each leads somewhere different.", idle: "There's no wrong choice here. Which one excites you?", exit: "Bold choice. Let's do this." },
  7: { entry: "We're almost there. One last thing...", idle: "This is YOUR project statement.", exit: "Look at that. Look at who you are. Let's go." },
};

// ═══════════════════════════════════════════════════════════════
// SECTION 2: THREE.JS SCENE BUILDER HELPERS
// ═══════════════════════════════════════════════════════════════

function createMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...opts });
}

function addBox(parent, w, h, d, color, pos, rot) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), createMaterial(color));
  mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, rTop, rBot, h, color, pos, segs = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), createMaterial(color));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, r, color, pos) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), createMaterial(color));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCone(parent, r, h, color, pos, segs = 6) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), createMaterial(color));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPlane(parent, w, h, color, pos, rot) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), createMaterial(color, { side: THREE.DoubleSide }));
  mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3: 3D KIT CHARACTER
// ═══════════════════════════════════════════════════════════════

function buildKitCharacter() {
  const kit = new THREE.Group();
  kit.name = "kit";

  // Body — cylindrical torso
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.25, 0.6, 8),
    createMaterial("#7C3AED") // Purple hoodie
  );
  torso.position.y = 0.8;
  kit.add(torso);

  // Head — sphere
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 10),
    createMaterial("#F5D6B8") // Skin tone
  );
  head.position.y = 1.3;
  kit.add(head);

  // Hair — slightly larger sphere cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    createMaterial("#4A1D96") // Dark purple hair
  );
  hair.position.y = 1.35;
  kit.add(hair);

  // Eyes — two small spheres
  const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
  const eyeMat = createMaterial("#1E1B4B");
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.07, 1.32, 0.17);
  kit.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.07, 1.32, 0.17);
  kit.add(rightEye);

  // Smile — torus arc
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI),
    createMaterial("#C4532A")
  );
  smile.position.set(0, 1.24, 0.17);
  smile.rotation.x = Math.PI;
  smile.name = "smile";
  kit.add(smile);

  // Arms — cylinders
  const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.4, 6);
  const armMat = createMaterial("#7C3AED");
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.32, 0.85, 0);
  leftArm.rotation.z = 0.3;
  leftArm.name = "leftArm";
  kit.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.32, 0.85, 0);
  rightArm.rotation.z = -0.3;
  rightArm.name = "rightArm";
  kit.add(rightArm);

  // Hands — small spheres
  const handMat = createMaterial("#F5D6B8");
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), handMat);
  leftHand.position.set(-0.42, 0.68, 0);
  kit.add(leftHand);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), handMat);
  rightHand.position.set(0.42, 0.68, 0);
  kit.add(rightHand);

  // Legs — cylinders
  const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.45, 6);
  const legMat = createMaterial("#374151"); // Dark pants
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.1, 0.3, 0);
  kit.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.1, 0.3, 0);
  kit.add(rightLeg);

  // Shoes — small boxes
  const shoeMat = createMaterial("#92400E");
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.16), shoeMat);
  leftShoe.position.set(-0.1, 0.06, 0.03);
  kit.add(leftShoe);
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.16), shoeMat);
  rightShoe.position.set(0.1, 0.06, 0.03);
  kit.add(rightShoe);

  return kit;
}

// Kit animation states
function animateKit(kit, time, expression = "idle") {
  if (!kit) return;
  // Breathing idle bob
  kit.position.y = Math.sin(time * 1.5) * 0.02;

  // Arm swing
  const leftArm = kit.getObjectByName("leftArm");
  const rightArm = kit.getObjectByName("rightArm");
  if (leftArm && rightArm) {
    if (expression === "wave") {
      rightArm.rotation.z = -1.2 + Math.sin(time * 6) * 0.3;
      leftArm.rotation.z = 0.3;
    } else if (expression === "celebrate") {
      leftArm.rotation.z = 1.0 + Math.sin(time * 4) * 0.15;
      rightArm.rotation.z = -1.0 + Math.sin(time * 4 + 1) * 0.15;
    } else if (expression === "think") {
      rightArm.rotation.z = -0.8;
      rightArm.rotation.x = -0.4;
      leftArm.rotation.z = 0.3;
    } else if (expression === "point") {
      rightArm.rotation.z = -1.3;
      rightArm.rotation.x = -0.2;
      leftArm.rotation.z = 0.3;
    } else {
      leftArm.rotation.z = 0.3 + Math.sin(time * 2) * 0.05;
      rightArm.rotation.z = -0.3 - Math.sin(time * 2) * 0.05;
      rightArm.rotation.x = 0;
    }
  }

  // Smile expression
  const smile = kit.getObjectByName("smile");
  if (smile) {
    if (expression === "celebrate") {
      smile.scale.set(1.3, 1.3, 1.3);
    } else if (expression === "think") {
      smile.scale.set(0.6, 0.6, 0.6);
      smile.rotation.x = 0; // Flatten to line
    } else {
      smile.scale.set(1, 1, 1);
      smile.rotation.x = Math.PI;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3B: GLB ASSET LOADER (Kenney packs)
// ═══════════════════════════════════════════════════════════════

// Paths from public/ root — adjust if assets move to a different location
const FURN = "3delements/kenney_furniture-kit/Models/GLTF format/";
const NATR = "3delements/kenney_nature-kit/Models/GLTF format/";
const _glbCache = {};
const _gltfLoader = new GLTFLoader();

function loadGLB(path, parent, pos, scale = 1, rotY = 0) {
  function place(m) {
    m.position.set(...pos);
    if (typeof scale === "number") m.scale.set(scale, scale, scale); else m.scale.set(...scale);
    m.rotation.y = rotY;
    m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    parent.add(m);
    // Hide primitive fallbacks once any GLB loads
    const fb = parent.getObjectByName("fallbacks");
    if (fb) fb.visible = false;
  }
  if (_glbCache[path]) {
    place(_glbCache[path].clone());
    return;
  }
  _gltfLoader.load(path, (gltf) => {
    _glbCache[path] = gltf.scene.clone();
    place(gltf.scene);
  }, undefined, (err) => { console.warn("GLB load failed:", path, err); });
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: ENVIRONMENT BUILDERS (with Kenney GLB assets)
// ═══════════════════════════════════════════════════════════════

function buildFoyer(scene) {
  const group = new THREE.Group();
  group.name = "env_foyer";
  // Room shell
  addPlane(group, 12, 12, "#C4A265", [0, 0, 0], [-Math.PI / 2, 0, 0]);
  addBox(group, 12, 5, 0.2, "#FEF3C7", [0, 2.5, -6], null);
  addBox(group, 0.2, 5, 12, "#FDF6E3", [-6, 2.5, 0], null);
  addBox(group, 0.2, 5, 12, "#FDF6E3", [6, 2.5, 0], null);

  // Primitive fallbacks (hidden once GLBs load)
  const fb = new THREE.Group(); fb.name = "fallbacks";
  addBox(fb, 2.5, 0.02, 1.5, "#D97706", [0, 0.01, 3], null);
  addBox(fb, 2, 0.85, 1, "#A16207", [2, 0.42, -2], null);
  addBox(fb, 0.6, 0.6, 0.5, "#92400E", [2, 0.55, -0.8], null);
  addBox(fb, 1.2, 2.5, 0.3, "#92400E", [-3.5, 1.25, -5.5], null);
  addBox(fb, 1.2, 2.5, 0.3, "#92400E", [-1, 1.25, -5.5], null);
  addCylinder(fb, 0.08, 0.12, 0.5, "#B45309", [0, 4, -2]);
  addCone(fb, 0.2, 0.15, "#FCD34D", [0, 3.8, -2]);
  addSphere(fb, 0.3, "#22C55E", [4.5, 0.5, -4.5]);
  addSphere(fb, 0.25, "#22C55E", [-5, 0.4, -4]);
  group.add(fb);

  // GLB furniture
  loadGLB(FURN + "desk.glb", group, [2, 0, -2], 1.4);
  loadGLB(FURN + "chair.glb", group, [2, 0, -0.8], 1.4, Math.PI);
  loadGLB(FURN + "bookcaseOpen.glb", group, [-3.5, 0, -5.5], 1.6);
  loadGLB(FURN + "bookcaseClosedWide.glb", group, [-1, 0, -5.5], 1.6);
  loadGLB(FURN + "lampSquareCeiling.glb", group, [0, 4.2, -2], 1.5);
  loadGLB(FURN + "lampSquareCeiling.glb", group, [3, 4.2, -3], 1.5);
  loadGLB(FURN + "pottedPlant.glb", group, [4.5, 0, -4.5], 1.8);
  loadGLB(FURN + "pottedPlant.glb", group, [-5, 0, -4], 1.5);
  loadGLB(FURN + "rugRectangle.glb", group, [0, 0.01, 2], 2.5);
  loadGLB(FURN + "books.glb", group, [1.6, 0.85, -2], 1.4);
  loadGLB(FURN + "laptop.glb", group, [2.4, 0.85, -2], 1.2);
  loadGLB(FURN + "coatRackStanding.glb", group, [5, 0, 2], 1.6);
  loadGLB(FURN + "plantSmall1.glb", group, [-5.2, 0, 2], 1.5);
  loadGLB(FURN + "sideTable.glb", group, [4.5, 0, -2], 1.3);
  loadGLB(FURN + "lampRoundTable.glb", group, [4.5, 0.65, -2], 1.2);

  scene.add(group);
  return group;
}

function buildCampfire(scene) {
  const group = new THREE.Group();
  group.name = "env_campfire";
  addPlane(group, 16, 16, "#3D2817", [0, 0, 0], [-Math.PI / 2, 0, 0]);

  // Primitive fallbacks (hidden once GLBs load)
  const fb = new THREE.Group(); fb.name = "fallbacks";
  addCylinder(fb, 0.5, 0.6, 0.15, "#78716C", [0, 0.07, 0]);
  addCone(fb, 0.3, 0.7, "#EF4444", [0, 0.45, 0]);
  addCone(fb, 0.2, 0.5, "#F97316", [0.05, 0.55, 0.05]);
  addCone(fb, 0.15, 0.4, "#FCD34D", [-0.03, 0.5, -0.03]);
  addCylinder(fb, 0.2, 0.25, 0.8, "#5C3A1E", [1.8, 0.4, 1.2]);
  addCylinder(fb, 0.15, 0.2, 0.6, "#5C3A1E", [-1.5, 0.3, 2]);
  addCylinder(fb, 0.25, 0.3, 0.6, "#3D2817", [-2, 0.3, -1.5]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; addCylinder(fb, 0.06, 0.08, 2 + Math.random(), "#5C3A1E", [Math.cos(a) * 5.5, 1, Math.sin(a) * 5.5]); addCone(fb, 0.5 + Math.random() * 0.3, 1.2 + Math.random(), "#166534", [Math.cos(a) * 5.5, 2.5, Math.sin(a) * 5.5]); }
  addBox(fb, 0.6, 0.3, 0.4, "#6B7280", [3, 0.15, 3]);
  addBox(fb, 0.5, 0.25, 0.35, "#78716C", [-3, 0.12, 4]);
  group.add(fb);

  // Campfire GLB
  loadGLB(NATR + "campfire_stones.glb", group, [0, 0, 0], 1.8);

  // Logs & seating
  loadGLB(NATR + "log_stack.glb", group, [1.8, 0, 1.2], 1.5, 0.4);
  loadGLB(NATR + "log.glb", group, [-1.5, 0, 2], 2.0, 1.2);
  loadGLB(NATR + "log_large.glb", group, [2.2, 0, -1], 1.3, -0.8);
  loadGLB(NATR + "stump_round.glb", group, [-2, 0, -1.5], 1.5);
  loadGLB(NATR + "stump_roundDetailed.glb", group, [0, 0, 2.5], 1.4);

  // Trees
  loadGLB(NATR + "tree_pineDefaultA.glb", group, [5, 0, -4], 2.0);
  loadGLB(NATR + "tree_pineRoundA.glb", group, [-5, 0, -5], 2.2);
  loadGLB(NATR + "tree_oak.glb", group, [6, 0, 2], 2.0);
  loadGLB(NATR + "tree_detailed.glb", group, [-6, 0, 3], 1.8);
  loadGLB(NATR + "tree_pineTallA.glb", group, [-4, 0, -6], 1.5);
  loadGLB(NATR + "tree_pineTallB.glb", group, [4, 0, -6], 1.5);

  // Rocks & plants
  loadGLB(NATR + "rock_smallA.glb", group, [3, 0, 3], 1.5);
  loadGLB(NATR + "rock_smallC.glb", group, [-3, 0, 4], 1.8);
  loadGLB(NATR + "rock_largeA.glb", group, [5.5, 0, -1], 1.2);
  loadGLB(NATR + "stone_smallA.glb", group, [-1, 0, -2.5], 2.0);
  loadGLB(NATR + "plant_bush.glb", group, [3, 0, -3], 1.8);
  loadGLB(NATR + "plant_bushLarge.glb", group, [-4, 0, 1], 1.5);
  loadGLB(NATR + "mushroom_redGroup.glb", group, [-3, 0, -4], 1.5);
  loadGLB(NATR + "grass_large.glb", group, [2, 0, -4], 2.0);
  loadGLB(NATR + "grass.glb", group, [-2, 0, 3.5], 2.0);

  // Stars
  for (let i = 0; i < 30; i++) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), new THREE.MeshBasicMaterial({ color: "#FEF3C7" }));
    star.position.set((Math.random() - 0.5) * 20, 6 + Math.random() * 4, (Math.random() - 0.5) * 20);
    group.add(star);
  }
  scene.add(group);
  return group;
}

function buildWorkshop(scene) {
  const group = new THREE.Group();
  group.name = "env_workshop";
  addPlane(group, 14, 14, "#9CA3AF", [0, 0, 0], [-Math.PI / 2, 0, 0]);
  addBox(group, 14, 5, 0.2, "#D1D5DB", [0, 2.5, -7], null);
  addBox(group, 0.2, 5, 14, "#E5E7EB", [-7, 2.5, 0], null);
  addBox(group, 0.2, 5, 14, "#E5E7EB", [7, 2.5, 0], null);

  // Primitive fallbacks (hidden once GLBs load)
  const fb = new THREE.Group(); fb.name = "fallbacks";
  addBox(fb, 3, 0.85, 1.5, "#6B7280", [0, 0.42, -4], null);
  addCylinder(fb, 0.15, 0.15, 0.7, "#78716C", [0, 0.35, -2.5]);
  addCylinder(fb, 0.15, 0.15, 0.7, "#78716C", [-1.5, 0.35, -2.5]);
  addBox(fb, 1.5, 2.5, 0.6, "#92400E", [-5, 1.25, -4], null);
  addBox(fb, 1.5, 2.5, 0.6, "#92400E", [5, 1.25, -5], null);
  addBox(fb, 0.6, 0.5, 0.5, "#A16207", [-5.3, 0.25, -1], null);
  addBox(fb, 0.6, 0.5, 0.5, "#A16207", [-4.3, 0.25, -1], null);
  group.add(fb);

  // Pegboard (primitives — always visible, wall-mounted)
  addBox(group, 3, 2, 0.05, "#D4A265", [0, 2.5, -6.8], null);
  addBox(group, 0.08, 0.6, 0.05, "#374151", [-0.8, 2.8, -6.7], null);
  addBox(group, 0.25, 0.15, 0.05, "#374151", [-0.8, 3.1, -6.7], null);
  addBox(group, 0.06, 0.5, 0.05, "#374151", [0, 2.7, -6.7], null);
  addBox(group, 0.4, 0.05, 0.05, "#374151", [0.8, 2.6, -6.7], null);

  // Workbench area
  loadGLB(FURN + "desk.glb", group, [0, 0, -4], 1.8);
  loadGLB(FURN + "stoolBar.glb", group, [0, 0, -2.5], 1.4);
  loadGLB(FURN + "stoolBar.glb", group, [-1.5, 0, -2.5], 1.4);

  // Storage
  loadGLB(FURN + "bookcaseClosedWide.glb", group, [-5, 0, -4], 1.6);
  loadGLB(FURN + "bookcaseOpen.glb", group, [5, 0, -5], 1.5);
  loadGLB(FURN + "cardboardBoxClosed.glb", group, [-5.3, 0.01, -1], 1.5);
  loadGLB(FURN + "cardboardBoxOpen.glb", group, [-4.3, 0.01, -1], 1.5);
  loadGLB(FURN + "cardboardBoxClosed.glb", group, [-5.3, 0.65, -1], 1.5);
  loadGLB(FURN + "lampSquareCeiling.glb", group, [0, 4.5, -3], 1.8);
  loadGLB(FURN + "lampSquareFloor.glb", group, [4.5, 0, -2], 1.5);
  loadGLB(FURN + "trashcan.glb", group, [5.5, 0, 0], 1.4);
  loadGLB(FURN + "computerScreen.glb", group, [-1, 0.85, -4], 1.2);

  scene.add(group);
  return group;
}

function buildGallery(scene) {
  const group = new THREE.Group();
  group.name = "env_gallery";
  addPlane(group, 14, 14, "#1E1B4B", [0, 0, 0], [-Math.PI / 2, 0, 0]);
  addBox(group, 14, 5, 0.2, "#312E81", [0, 2.5, -7], null);
  addBox(group, 0.2, 5, 14, "#312E81", [-7, 2.5, 0], null);
  addBox(group, 0.2, 5, 14, "#312E81", [7, 2.5, 0], null);

  // Wall art (always visible — on walls)
  ["#FCD34D", "#A5B4FC", "#F9A8D4", "#86EFAC"].forEach((c, i) => {
    const x = -4 + i * 2.8;
    addBox(group, 2, 1.5, 0.05, c, [x, 2.5, -6.8], null);
    addBox(group, 1.8, 1.3, 0.03, "#FFF7ED", [x, 2.5, -6.75], null);
  });

  // Primitive fallbacks (hidden once GLBs load)
  const fb = new THREE.Group(); fb.name = "fallbacks";
  for (let i = 0; i < 3; i++) { const x = -3 + i * 3; addCylinder(fb, 0.3, 0.35, 0.8, "#E5E7EB", [x, 0.4, -2]); addSphere(fb, 0.2, ["#EF4444", "#8B5CF6", "#06B6D4"][i], [x, 1, -2]); }
  addBox(fb, 3, 0.1, 0.6, "#92400E", [0, 0.45, 2], null);
  addBox(fb, 0.1, 0.45, 0.6, "#78716C", [-1.4, 0.22, 2], null);
  addBox(fb, 0.1, 0.45, 0.6, "#78716C", [1.4, 0.22, 2], null);
  group.add(fb);

  // Pedestals (GLB) + sculptures (primitive — stay on group)
  loadGLB(FURN + "sideTable.glb", group, [-3, 0, -2], 1.5);
  loadGLB(FURN + "sideTable.glb", group, [0, 0, -2], 1.5);
  loadGLB(FURN + "sideTable.glb", group, [3, 0, -2], 1.5);
  addSphere(group, 0.2, "#EF4444", [-3, 1.0, -2]);
  addSphere(group, 0.2, "#8B5CF6", [0, 1.0, -2]);
  addSphere(group, 0.2, "#06B6D4", [3, 1.0, -2]);

  // Bench & lamps
  loadGLB(FURN + "bench.glb", group, [0, 0, 2], 1.6);
  loadGLB(FURN + "lampWall.glb", group, [-5.8, 2.2, -4], 1.5, Math.PI / 2);
  loadGLB(FURN + "lampWall.glb", group, [5.8, 2.2, -4], 1.5, -Math.PI / 2);
  loadGLB(FURN + "lampWall.glb", group, [-5.8, 2.2, 2], 1.5, Math.PI / 2);
  loadGLB(FURN + "lampWall.glb", group, [5.8, 2.2, 2], 1.5, -Math.PI / 2);
  loadGLB(FURN + "plantSmall2.glb", group, [-6, 0, -6], 1.8);
  loadGLB(FURN + "plantSmall3.glb", group, [6, 0, -6], 1.8);

  scene.add(group);
  return group;
}

function buildWindowScene(scene) {
  const group = new THREE.Group();
  group.name = "env_window";
  addPlane(group, 8, 8, "#D4A265", [0, 0, 0], [-Math.PI / 2, 0, 0]);

  // Primitive fallbacks (hidden once GLBs load)
  const fb = new THREE.Group(); fb.name = "fallbacks";
  addBox(fb, 6, 0.2, 0.2, "#78716C", [0, 2, -3.9], null); addBox(fb, 6, 0.2, 0.2, "#78716C", [0, 0.5, -3.9], null);
  addBox(fb, 0.2, 1.7, 0.2, "#78716C", [-3, 1.25, -3.9], null); addBox(fb, 0.2, 1.7, 0.2, "#78716C", [3, 1.25, -3.9], null); addBox(fb, 0.2, 1.7, 0.2, "#78716C", [0, 1.25, -3.9], null);
  addBox(fb, 5.5, 0.2, 1, "#6366F1", [0, 0.6, -3.2], null);
  addBox(fb, 0.8, 0.8, 0.8, "#92400E", [2, 0.4, -1.5], null);
  addBox(fb, 0.3, 3, 1.5, "#92400E", [-3.5, 1.5, -2], null);
  addPlane(fb, 20, 20, "#86EFAC", [0, 0, -14], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) { addCylinder(fb, 0.06, 0.08, 0.8, "#5C3A1E", [-4 + i * 2, 0.4, -12]); addCone(fb, 0.4, 0.8, "#166534", [-4 + i * 2, 1, -12]); }
  group.add(fb);

  // Window walls (GLB)
  loadGLB(FURN + "wallWindow.glb", group, [-1.5, 0, -3.8], 2.0);
  loadGLB(FURN + "wallWindow.glb", group, [1.5, 0, -3.8], 2.0);

  // Reading nook
  loadGLB(FURN + "loungeChair.glb", group, [2, 0, -1.5], 1.5, -0.3);
  loadGLB(FURN + "bookcaseOpen.glb", group, [-3.5, 0, -2], 1.4);
  loadGLB(FURN + "sideTableDrawers.glb", group, [3.5, 0, -1], 1.3);
  loadGLB(FURN + "lampRoundFloor.glb", group, [3.5, 0, 0.5], 1.5);
  loadGLB(FURN + "rugRound.glb", group, [1, 0.01, -0.5], 2.5);
  loadGLB(FURN + "pillow.glb", group, [2.2, 0.5, -1.5], 1.2);

  // Outside landscape
  loadGLB(NATR + "tree_default.glb", group, [-3, 0, -8], 2.5);
  loadGLB(NATR + "tree_oak.glb", group, [3, 0, -10], 2.2);
  loadGLB(NATR + "tree_detailed.glb", group, [0, 0, -12], 2.0);
  loadGLB(NATR + "tree_simple.glb", group, [-5, 0, -11], 1.8);
  loadGLB(NATR + "tree_fat.glb", group, [5, 0, -9], 1.8);
  loadGLB(NATR + "fence_simple.glb", group, [-3, 0, -6], 2.0);
  loadGLB(NATR + "fence_simple.glb", group, [-1, 0, -6], 2.0);
  loadGLB(NATR + "fence_simple.glb", group, [1, 0, -6], 2.0);
  loadGLB(NATR + "fence_simple.glb", group, [3, 0, -6], 2.0);
  loadGLB(NATR + "path_stone.glb", group, [0, 0.01, -7], 2.5);
  loadGLB(NATR + "flower_redA.glb", group, [-2, 0, -7], 2.5);
  loadGLB(NATR + "flower_yellowB.glb", group, [2, 0, -7.5], 2.5);
  loadGLB(NATR + "plant_bushLarge.glb", group, [-5, 0, -7.5], 2.0);
  loadGLB(NATR + "rock_largeB.glb", group, [4.5, 0, -7], 1.5);

  scene.add(group);
  return group;
}

function buildShelves(scene) {
  const group = new THREE.Group();
  group.name = "env_shelves";
  addPlane(group, 12, 12, "#064E3B", [0, 0, 0], [-Math.PI / 2, 0, 0]);
  addBox(group, 12, 5, 0.2, "#065F46", [0, 2.5, -6], null);
  addBox(group, 0.2, 5, 12, "#065F46", [-6, 2.5, 0], null);
  addBox(group, 0.2, 5, 12, "#065F46", [6, 2.5, 0], null);

  // Primitive fallbacks (hidden once GLBs load)
  const fb = new THREE.Group(); fb.name = "fallbacks";
  const ic = ["#EF4444", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899"];
  for (let r = 0; r < 4; r++) { addBox(fb, 10, 0.08, 0.8, "#92400E", [0, 0.5 + r * 1.0, -5.5], null); for (let c = 0; c < 5; c++) { addBox(fb, 0.4, 0.35, 0.3, ic[c], [-3.5 + c * 1.8, 0.7 + r * 1.0, -5.5], null); } }
  addBox(fb, 0.1, 4.5, 0.8, "#78716C", [-5, 2.25, -5.5], null); addBox(fb, 0.1, 4.5, 0.8, "#78716C", [5, 2.25, -5.5], null);
  addBox(fb, 2, 0.08, 1, "#A16207", [3, 0.75, 0], null);
  addBox(fb, 0.6, 0.6, 0.5, "#92400E", [3, 0.55, 1.5], null);
  addCylinder(fb, 0.08, 0.12, 0.5, "#B45309", [3.8, 1.1, 0]); addCone(fb, 0.2, 0.15, "#FCD34D", [3.8, 1.45, 0]);
  group.add(fb);

  // Bookcases
  loadGLB(FURN + "bookcaseOpen.glb", group, [-4, 0, -5.5], 1.6);
  loadGLB(FURN + "bookcaseOpen.glb", group, [-1.5, 0, -5.5], 1.6);
  loadGLB(FURN + "bookcaseClosedWide.glb", group, [1.5, 0, -5.5], 1.6);
  loadGLB(FURN + "bookcaseOpen.glb", group, [4, 0, -5.5], 1.6);
  loadGLB(FURN + "books.glb", group, [-3.5, 1.2, -5.3], 1.2);
  loadGLB(FURN + "books.glb", group, [-1, 1.2, -5.3], 1.2, 0.5);
  loadGLB(FURN + "books.glb", group, [2, 2.2, -5.3], 1.2, -0.3);
  loadGLB(FURN + "books.glb", group, [4.5, 1.8, -5.3], 1.2);

  // Desk area
  loadGLB(FURN + "desk.glb", group, [3, 0, 0], 1.4);
  loadGLB(FURN + "chairDesk.glb", group, [3, 0, 1.5], 1.3, Math.PI);
  loadGLB(FURN + "lampRoundTable.glb", group, [3.8, 0.85, 0], 1.2);
  loadGLB(FURN + "books.glb", group, [2.2, 0.85, 0], 1.0);
  loadGLB(FURN + "cardboardBoxClosed.glb", group, [-5, 0, 2], 1.4);
  loadGLB(FURN + "cardboardBoxOpen.glb", group, [-4, 0, 2.5], 1.4);
  loadGLB(FURN + "plantSmall1.glb", group, [5, 0, -2], 1.5);
  loadGLB(FURN + "pottedPlant.glb", group, [-5, 0, -3], 1.5);

  scene.add(group);
  return group;
}

function buildCorridor(scene) {
  const group = new THREE.Group();
  group.name = "env_corridor";
  addPlane(group, 10, 16, "#374151", [0, 0, 0], [-Math.PI / 2, 0, 0]);
  addBox(group, 0.2, 5, 16, "#4C1D95", [-5, 2.5, 0], null);
  addBox(group, 0.2, 5, 16, "#4C1D95", [5, 2.5, 0], null);
  addPlane(group, 10, 16, "#2E1065", [0, 5, 0], [Math.PI / 2, 0, 0]);

  // Primitive fallbacks (hidden once GLBs load)
  const fb = new THREE.Group(); fb.name = "fallbacks";
  const dc = ["#EF4444", "#3B82F6", "#22C55E"];
  for (let i = 0; i < 3; i++) { const x = -3 + i * 3; addBox(fb, 1.5, 2.5, 0.1, "#78716C", [x, 1.25, -7], null); addBox(fb, 1.3, 2.3, 0.08, dc[i], [x, 1.25, -6.95], null); addSphere(fb, 0.06, "#FCD34D", [x + 0.5, 1.2, -6.85]); addBox(fb, 1.7, 0.2, 0.15, "#78716C", [x, 2.6, -7], null); }
  for (let z = -4; z <= 4; z += 4) { addBox(fb, 0.1, 0.3, 0.1, "#78716C", [-4.8, 2.5, z], null); addCone(fb, 0.08, 0.15, "#FCD34D", [-4.8, 2.8, z]); addBox(fb, 0.1, 0.3, 0.1, "#78716C", [4.8, 2.5, z], null); addCone(fb, 0.08, 0.15, "#FCD34D", [4.8, 2.8, z]); }
  addBox(fb, 2, 0.02, 14, "#7C3AED", [0, 0.01, 0], null);
  group.add(fb);

  // Doorways (GLB) + colored door panels (primitive — stay on group)
  loadGLB(FURN + "doorway.glb", group, [-3, 0, -6.5], 1.6);
  loadGLB(FURN + "doorway.glb", group, [0, 0, -6.5], 1.6);
  loadGLB(FURN + "doorway.glb", group, [3, 0, -6.5], 1.6);
  const doorColors = ["#EF4444", "#3B82F6", "#22C55E"];
  for (let i = 0; i < 3; i++) {
    addBox(group, 1.3, 2.3, 0.04, doorColors[i], [-3 + i * 3, 1.25, -6.7], null);
  }

  // Wall lamps
  loadGLB(FURN + "lampWall.glb", group, [-4.8, 2.2, -4], 1.3, Math.PI / 2);
  loadGLB(FURN + "lampWall.glb", group, [4.8, 2.2, -4], 1.3, -Math.PI / 2);
  loadGLB(FURN + "lampWall.glb", group, [-4.8, 2.2, 0], 1.3, Math.PI / 2);
  loadGLB(FURN + "lampWall.glb", group, [4.8, 2.2, 0], 1.3, -Math.PI / 2);
  loadGLB(FURN + "lampWall.glb", group, [-4.8, 2.2, 4], 1.3, Math.PI / 2);
  loadGLB(FURN + "lampWall.glb", group, [4.8, 2.2, 4], 1.3, -Math.PI / 2);

  // Runner rug & side details
  loadGLB(FURN + "rugRectangle.glb", group, [0, 0.01, 0], [3.5, 1, 6]);
  loadGLB(FURN + "sideTable.glb", group, [-4, 0, 2], 1.2);
  loadGLB(FURN + "plantSmall2.glb", group, [-4, 0.65, 2], 1.0);
  loadGLB(FURN + "sideTable.glb", group, [4, 0, 2], 1.2);
  loadGLB(FURN + "plantSmall3.glb", group, [4, 0.65, 2], 1.0);

  scene.add(group);
  return group;
}

function buildRooftop(scene) {
  const group = new THREE.Group();
  group.name = "env_rooftop";
  addPlane(group, 14, 14, "#9CA3AF", [0, 0, 0], [-Math.PI / 2, 0, 0]);
  addBox(group, 14, 0.8, 0.3, "#6B7280", [0, 0.4, -7], null);
  addBox(group, 14, 0.8, 0.3, "#6B7280", [0, 0.4, 7], null);
  addBox(group, 0.3, 0.8, 14, "#6B7280", [-7, 0.4, 0], null);
  addBox(group, 0.3, 0.8, 14, "#6B7280", [7, 0.4, 0], null);

  // Primitive fallbacks — table, HVAC, string lights (hidden once GLBs load)
  const fb = new THREE.Group(); fb.name = "fallbacks";
  addCylinder(fb, 0.4, 0.4, 0.06, "#92400E", [0, 0.65, 0]); addCylinder(fb, 0.06, 0.06, 0.6, "#78716C", [0, 0.32, 0]);
  addCylinder(fb, 0.5, 0.5, 0.8, "#78716C", [5, 1.2, -4]); addCone(fb, 0.55, 0.3, "#6B7280", [5, 1.75, -4]);
  for (let i = -5; i <= 5; i += 1.5) { const lm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: ["#FCD34D", "#F9A8D4", "#93C5FD", "#86EFAC"][Math.abs(Math.round(i)) % 4] })); lm.position.set(i, 2.8, -3 + Math.sin(i) * 0.3); fb.add(lm); }
  group.add(fb);

  // Seating area
  loadGLB(FURN + "tableCoffee.glb", group, [0, 0, 0], 1.6);
  loadGLB(FURN + "chairCushion.glb", group, [-1.2, 0, 0.8], 1.4, 0.3);
  loadGLB(FURN + "chairCushion.glb", group, [1.2, 0, 0.8], 1.4, -0.3);
  loadGLB(FURN + "chairCushion.glb", group, [0, 0, -1.2], 1.4, Math.PI);

  // Plants along edge
  loadGLB(FURN + "plantSmall1.glb", group, [-5, 0.8, -6.5], 1.5);
  loadGLB(FURN + "plantSmall2.glb", group, [-3, 0.8, -6.5], 1.5);
  loadGLB(FURN + "plantSmall3.glb", group, [3, 0.8, -6.5], 1.5);
  loadGLB(FURN + "pottedPlant.glb", group, [5, 0.8, -6.5], 1.5);
  loadGLB(NATR + "pot_large.glb", group, [-5.5, 0, 5], 2.0);
  loadGLB(NATR + "pot_small.glb", group, [5.5, 0, 5], 2.0);
  loadGLB(NATR + "fence_simple.glb", group, [-2, 0.8, -6.8], 1.5);
  loadGLB(NATR + "fence_simple.glb", group, [0, 0.8, -6.8], 1.5);
  loadGLB(NATR + "fence_simple.glb", group, [2, 0.8, -6.8], 1.5);

  // City skyline (primitives — always visible)
  const skylineColors = ["#374151", "#4B5563", "#6B7280", "#374151", "#4B5563"];
  const skylineX = [-8, -4, 0, 4, 8];
  const skylineH = [3, 5, 4, 6, 3.5];
  for (let i = 0; i < 5; i++) {
    addBox(group, 2, skylineH[i], 2, skylineColors[i], [skylineX[i], skylineH[i] / 2, -14], null);
    for (let wy = 0; wy < skylineH[i] - 1; wy++) {
      for (let wx = -0.4; wx <= 0.4; wx += 0.8) {
        const windowMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.3, 0.05),
          new THREE.MeshBasicMaterial({ color: Math.random() > 0.3 ? "#FCD34D" : "#1F2937" })
        );
        windowMesh.position.set(skylineX[i] + wx, wy + 1, -12.9);
        group.add(windowMesh);
      }
    }
  }

  // HVAC unit
  addCylinder(group, 0.5, 0.5, 0.8, "#78716C", [5, 1.2, -4]);
  addCone(group, 0.55, 0.3, "#6B7280", [5, 1.75, -4]);

  // String lights
  for (let i = -5; i <= 5; i += 1.5) {
    const lightMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: ["#FCD34D", "#F9A8D4", "#93C5FD", "#86EFAC"][Math.abs(i) % 4] })
    );
    lightMesh.position.set(i, 2.8, -3 + Math.sin(i) * 0.3);
    group.add(lightMesh);
  }

  // Sunset sky
  const skyGeo = new THREE.PlaneGeometry(40, 15);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color("#1E3A5F") },
      bottomColor: { value: new THREE.Color("#F97316") },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec2 vUv; void main() { gl_FragColor = vec4(mix(bottomColor, topColor, vUv.y), 1.0); }`,
    side: THREE.DoubleSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, 5, -20);
  group.add(sky);

  scene.add(group);
  return group;
}

// Environment map
const ENV_BUILDERS = {
  foyer: buildFoyer,
  campfire: buildCampfire,
  workshop: buildWorkshop,
  gallery: buildGallery,
  window: buildWindowScene,
  shelves: buildShelves,
  corridor: buildCorridor,
  rooftop: buildRooftop,
};

// Camera positions per station
const CAMERA_POSITIONS = {
  foyer: { pos: [0, 2, 5], look: [0, 1.2, -2] },
  campfire: { pos: [0, 2.5, 5], look: [0, 0.5, 0] },
  workshop: { pos: [0, 2, 4], look: [0, 1.5, -3] },
  gallery: { pos: [0, 2, 5], look: [0, 2, -4] },
  window: { pos: [0, 1.5, 3], look: [0, 1.2, -5] },
  shelves: { pos: [0, 2, 5], look: [0, 1.5, -3] },
  corridor: { pos: [0, 1.8, 6], look: [0, 1.5, -5] },
  rooftop: { pos: [0, 2, 6], look: [0, 1.5, -5] },
};

// Kit positions per station
const KIT_POSITIONS = {
  foyer: [-2, 0, 2],
  campfire: [-1.5, 0, 1.5],
  workshop: [-3, 0, 0],
  gallery: [-3, 0, 1],
  window: [-2, 0, 1],
  shelves: [-3, 0, 1],
  corridor: [-2, 0, 3],
  rooftop: [-2, 0, 2],
};

// ═══════════════════════════════════════════════════════════════
// SECTION 5: MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Discovery3DJourney() {
  // ── State ──
  const [station, setStation] = useState(0);
  const [subStep, setSubStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [kitExpression, setKitExpression] = useState("wave");
  const [kitDialogue, setKitDialogue] = useState(KIT_DIALOGUE[0].entry);
  const [showDialogue, setShowDialogue] = useState(true);

  // Station-specific state
  const [selectedPalette, setSelectedPalette] = useState(null);
  const [selectedTools, setSelectedTools] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState([]);
  const [binaryAnswers, setBinaryAnswers] = useState({});
  const [currentBinaryIndex, setCurrentBinaryIndex] = useState(0);
  const [scenarioAnswers, setScenarioAnswers] = useState({});
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [irritationText, setIrritationText] = useState("");
  const [topValues, setTopValues] = useState([]);
  const [selectedHotspots, setSelectedHotspots] = useState([]);
  const [problemText, setProblemText] = useState("");
  const [efficacyRatings, setEfficacyRatings] = useState({});
  const [selectedDoor, setSelectedDoor] = useState(null);
  const [selectedFear, setSelectedFear] = useState(null);
  const [projectStatement, setProjectStatement] = useState("");
  const [revealShown, setRevealShown] = useState(false);

  // Computed archetype
  const computedArchetype = useMemo(() => {
    const scores = { maker: 0, researcher: 0, leader: 0, creative: 0, communicator: 0, systems: 0 };
    selectedTools.forEach(t => { const tool = TOOLS.find(x => x.id === t); if (tool) scores[tool.archetype] += 2; });
    Object.values(scenarioAnswers).forEach(a => { if (a) scores[a] += 3; });
    const max = Math.max(...Object.values(scores));
    return Object.entries(scores).find(([, v]) => v === max)?.[0] || "creative";
  }, [selectedTools, scenarioAnswers]);

  // ── Three.js refs ──
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const kitRef = useRef(null);
  const envGroupRef = useRef(null);
  const frameRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const targetCamPos = useRef(new THREE.Vector3());
  const targetCamLook = useRef(new THREE.Vector3());

  // ── Scene setup & render loop ──
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a1a2e");
    scene.fog = new THREE.FogExp2("#1a1a2e", 0.025);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    // Lights
    const ambient = new THREE.AmbientLight("#FFF7ED", 0.5);
    scene.add(ambient);
    const main = new THREE.DirectionalLight("#FCD34D", 1.0);
    main.position.set(3, 8, 5);
    main.castShadow = true;
    main.shadow.mapSize.set(1024, 1024);
    main.shadow.camera.near = 0.5;
    main.shadow.camera.far = 30;
    main.shadow.camera.left = -10;
    main.shadow.camera.right = 10;
    main.shadow.camera.top = 10;
    main.shadow.camera.bottom = -10;
    scene.add(main);
    const fill = new THREE.PointLight("#F472B6", 0.3, 15);
    fill.position.set(-3, 3, 2);
    scene.add(fill);

    // Kit character
    const kit = buildKitCharacter();
    kit.scale.set(1.8, 1.8, 1.8);
    kit.position.set(...KIT_POSITIONS.foyer);
    kit.rotation.y = 0.3;
    scene.add(kit);
    kitRef.current = kit;

    // Initial environment
    const envGroup = ENV_BUILDERS.foyer(scene);
    envGroupRef.current = envGroup;

    // Camera target
    const cp = CAMERA_POSITIONS.foyer;
    camera.position.set(...cp.pos);
    targetCamPos.current.set(...cp.pos);
    targetCamLook.current.set(...cp.look);
    camera.lookAt(...cp.look);

    // Render loop
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const time = clockRef.current.getElapsedTime();

      // Smooth camera
      camera.position.lerp(targetCamPos.current, 0.03);
      const lookTarget = new THREE.Vector3();
      lookTarget.copy(camera.position).lerp(targetCamLook.current, 0.05);
      // Use a secondary smooth look
      camera.lookAt(targetCamLook.current);

      // Animate Kit
      animateKit(kit, time, kitExpression);

      // Flicker fire in campfire scene
      const fire = scene.getObjectByName("env_campfire");
      if (fire) {
        fire.children.forEach(c => {
          if (c.geometry?.type === "ConeGeometry" && c.position.y > 0.3) {
            c.scale.y = 0.9 + Math.sin(time * 8 + c.position.x * 5) * 0.15;
            c.scale.x = 0.9 + Math.cos(time * 6 + c.position.z * 3) * 0.1;
          }
        });
      }

      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    const onResize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update kit expression ref for animation loop ──
  const kitExprRef = useRef(kitExpression);
  useEffect(() => { kitExprRef.current = kitExpression; }, [kitExpression]);

  // ── Station transitions ──
  const goToStation = useCallback((newStation) => {
    if (transitioning || newStation < 0 || newStation > 7) return;
    setTransitioning(true);
    setShowDialogue(false);
    setKitExpression("wave");

    setTimeout(() => {
      const scene = sceneRef.current;
      if (!scene) return;

      // Remove old environment
      if (envGroupRef.current) {
        scene.remove(envGroupRef.current);
        envGroupRef.current.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(m => m.dispose()); else c.material.dispose(); } });
      }

      // Build new environment
      const meta = STATION_META[newStation];
      const builder = ENV_BUILDERS[meta.env];
      const newEnv = builder(scene);
      envGroupRef.current = newEnv;

      // Update scene background & fog
      scene.background = new THREE.Color(meta.colors.bg);
      scene.fog = new THREE.FogExp2(meta.colors.bg, 0.02);

      // Move Kit
      const kitPos = KIT_POSITIONS[meta.env];
      if (kitRef.current) {
        kitRef.current.position.set(...kitPos);
      }

      // Move camera
      const cp = CAMERA_POSITIONS[meta.env];
      targetCamPos.current.set(...cp.pos);
      targetCamLook.current.set(...cp.look);

      // Update state
      setStation(newStation);
      setSubStep(0);

      setTimeout(() => {
        setKitDialogue(KIT_DIALOGUE[newStation].entry);
        setShowDialogue(true);
        setKitExpression("idle");
        setTransitioning(false);
      }, 600);
    }, 400);
  }, [transitioning]);

  const nextStation = useCallback(() => goToStation(station + 1), [station, goToStation]);
  const prevStation = useCallback(() => goToStation(station - 1), [station, goToStation]);

  // ── Station completion check ──
  const canAdvance = useMemo(() => {
    switch (station) {
      case 0: return selectedPalette && selectedTools.length >= 3 && selectedWorkspace.length >= 4;
      case 1: return currentBinaryIndex >= BINARY_PAIRS.length;
      case 2: return currentScenarioIndex >= SCENARIOS.length;
      case 3: return selectedInterests.length >= 3 && topValues.length >= 3;
      case 4: return selectedHotspots.length >= 1 && problemText.length > 10;
      case 5: return Object.keys(efficacyRatings).length >= EFFICACY_DOMAINS.length;
      case 6: return selectedDoor !== null;
      case 7: return projectStatement.length > 10;
      default: return false;
    }
  }, [station, selectedPalette, selectedTools, selectedWorkspace, currentBinaryIndex, currentScenarioIndex, selectedInterests, topValues, selectedHotspots, problemText, efficacyRatings, selectedDoor, projectStatement]);

  // ═══════════════════════════════════════════════════════════════
  // SECTION 6: STATION UI RENDERERS
  // ═══════════════════════════════════════════════════════════════

  function renderStation0() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Palette picker */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#FCD34D", marginBottom: 8 }}>Choose your colour palette</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PALETTES.map(p => (
              <button key={p.id} onClick={() => { setSelectedPalette(p.id); setKitExpression("celebrate"); setTimeout(() => setKitExpression("idle"), 1500); }}
                style={{ padding: "8px 12px", borderRadius: 8, border: selectedPalette === p.id ? "2px solid #FCD34D" : "2px solid rgba(255,255,255,0.15)", background: selectedPalette === p.id ? "rgba(252,211,77,0.2)" : "rgba(255,255,255,0.05)", cursor: "pointer", display: "flex", gap: 4, alignItems: "center" }}>
                {p.colors.map((c, i) => <span key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: c, display: "inline-block" }} />)}
                <span style={{ color: "#FFF", fontSize: 12, marginLeft: 4 }}>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Tool picker */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#FCD34D", marginBottom: 8 }}>Pick 3 tools for your belt ({selectedTools.length}/3)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {TOOLS.map(t => {
              const sel = selectedTools.includes(t.id);
              return (
                <button key={t.id} onClick={() => {
                  if (sel) setSelectedTools(selectedTools.filter(x => x !== t.id));
                  else if (selectedTools.length < 3) { setSelectedTools([...selectedTools, t.id]); setKitDialogue("Good pick!"); }
                }}
                  style={{ padding: 8, borderRadius: 8, border: sel ? "2px solid #FCD34D" : "2px solid rgba(255,255,255,0.1)", background: sel ? "rgba(252,211,77,0.2)" : "rgba(255,255,255,0.05)", cursor: "pointer", textAlign: "center", opacity: !sel && selectedTools.length >= 3 ? 0.4 : 1 }}>
                  <div style={{ fontSize: 20 }}>{t.icon}</div>
                  <div style={{ fontSize: 10, color: "#E5E7EB", marginTop: 2 }}>{t.label}</div>
                </button>
              );
            })}
          </div>
        </div>
        {/* Workspace picker */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#FCD34D", marginBottom: 8 }}>Decorate your workspace — pick 4 ({selectedWorkspace.length}/4)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 180, overflowY: "auto" }}>
            {WORKSPACE_ITEMS.map(item => {
              const sel = selectedWorkspace.includes(item.id);
              return (
                <button key={item.id} onClick={() => {
                  if (sel) setSelectedWorkspace(selectedWorkspace.filter(x => x !== item.id));
                  else if (selectedWorkspace.length < 4) setSelectedWorkspace([...selectedWorkspace, item.id]);
                }}
                  style={{ padding: 6, borderRadius: 8, border: sel ? "2px solid #FCD34D" : "2px solid rgba(255,255,255,0.1)", background: sel ? "rgba(252,211,77,0.15)" : "rgba(255,255,255,0.05)", cursor: "pointer", textAlign: "center", opacity: !sel && selectedWorkspace.length >= 4 ? 0.35 : 1 }}>
                  <div style={{ fontSize: 18 }}>{item.icon}</div>
                  <div style={{ fontSize: 9, color: "#D1D5DB" }}>{item.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderStation1() {
    if (currentBinaryIndex >= BINARY_PAIRS.length) {
      // Summary
      const style = Object.entries(binaryAnswers).reduce((acc, [id, choice]) => {
        const pair = BINARY_PAIRS.find(p => p.id === id);
        if (pair) acc[id] = choice === "a" ? pair.dimA : pair.dimB;
        return acc;
      }, {});
      return (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#FB923C", marginBottom: 12 }}>Your working style</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {Object.entries(style).map(([key, val]) => (
              <span key={key} style={{ padding: "4px 10px", borderRadius: 16, background: "rgba(251,146,60,0.2)", color: "#FCD34D", fontSize: 11, border: "1px solid rgba(251,146,60,0.3)" }}>
                {val.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>
      );
    }
    const pair = BINARY_PAIRS[currentBinaryIndex];
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{currentBinaryIndex + 1} / {BINARY_PAIRS.length}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#FFF", marginBottom: 16 }}>{pair.prompt}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {["a", "b"].map(choice => (
            <button key={choice} onClick={() => {
              setBinaryAnswers({ ...binaryAnswers, [pair.id]: choice });
              setCurrentBinaryIndex(currentBinaryIndex + 1);
              setKitExpression("think");
              setTimeout(() => setKitExpression("idle"), 800);
              if (currentBinaryIndex + 1 < BINARY_PAIRS.length) {
                setKitDialogue(KIT_DIALOGUE[1].idle);
              } else {
                setKitDialogue(KIT_DIALOGUE[1].exit);
                setKitExpression("celebrate");
              }
            }}
              style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "2px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#FFF", cursor: "pointer", fontSize: 13, lineHeight: 1.4, transition: "all 0.2s" }}
              onMouseEnter={e => { e.target.style.background = "rgba(251,146,60,0.2)"; e.target.style.borderColor = "#FB923C"; }}
              onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}>
              {choice === "a" ? pair.a : pair.b}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderStation2() {
    if (currentScenarioIndex >= SCENARIOS.length) {
      return (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#5EEAD4", marginBottom: 8 }}>Your archetype is emerging...</div>
          <div style={{ fontSize: 32, marginBottom: 4 }}>{ARCHETYPES[computedArchetype]?.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: ARCHETYPES[computedArchetype]?.color }}>{ARCHETYPES[computedArchetype]?.name}</div>
          <div style={{ fontSize: 13, color: "#D1D5DB", marginTop: 4 }}>{ARCHETYPES[computedArchetype]?.desc}</div>
        </div>
      );
    }
    const scenario = SCENARIOS[currentScenarioIndex];
    return (
      <div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{currentScenarioIndex + 1} / {SCENARIOS.length}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#FFF", marginBottom: 12 }}>{scenario.prompt}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {scenario.options.map((opt, i) => (
            <button key={i} onClick={() => {
              setScenarioAnswers({ ...scenarioAnswers, [scenario.id]: opt.archetype });
              setCurrentScenarioIndex(currentScenarioIndex + 1);
              setKitExpression("think");
              setKitDialogue(currentScenarioIndex + 1 < SCENARIOS.length ? "Interesting choice..." : KIT_DIALOGUE[2].exit);
              setTimeout(() => setKitExpression(currentScenarioIndex + 1 >= SCENARIOS.length ? "celebrate" : "idle"), 1000);
            }}
              style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#FFF", cursor: "pointer", fontSize: 13, textAlign: "left", transition: "all 0.2s" }}
              onMouseEnter={e => { e.target.style.background = "rgba(94,234,212,0.15)"; e.target.style.borderColor = "#5EEAD4"; }}
              onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}>
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderStation3() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Interests */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#A5B4FC", marginBottom: 6 }}>Pick 3-5 things that interest you ({selectedInterests.length})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {INTEREST_ICONS.map(item => {
              const sel = selectedInterests.includes(item.id);
              return (
                <button key={item.id} onClick={() => {
                  if (sel) setSelectedInterests(selectedInterests.filter(x => x !== item.id));
                  else if (selectedInterests.length < 5) { setSelectedInterests([...selectedInterests, item.id]); setKitDialogue("Nice choice!"); }
                }}
                  style={{ padding: 4, borderRadius: 8, border: sel ? "2px solid #A5B4FC" : "1px solid rgba(255,255,255,0.1)", background: sel ? "rgba(165,180,252,0.2)" : "transparent", cursor: "pointer", textAlign: "center", opacity: !sel && selectedInterests.length >= 5 ? 0.3 : 1 }}>
                  <div style={{ fontSize: 16 }}>{item.icon}</div>
                  <div style={{ fontSize: 8, color: "#D1D5DB" }}>{item.label}</div>
                </button>
              );
            })}
          </div>
        </div>
        {/* Irritation */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#A5B4FC", marginBottom: 6 }}>What annoys you? (optional)</div>
          <textarea value={irritationText} onChange={e => setIrritationText(e.target.value)} placeholder="Something that bugs you about the world..."
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#FFF", fontSize: 13, resize: "none", height: 50, outline: "none" }} />
        </div>
        {/* Values */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#A5B4FC", marginBottom: 6 }}>Top 3 values ({topValues.length}/3)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {VALUES_CARDS.map(v => {
              const sel = topValues.includes(v.id);
              return (
                <button key={v.id} onClick={() => {
                  if (sel) setTopValues(topValues.filter(x => x !== v.id));
                  else if (topValues.length < 3) setTopValues([...topValues, v.id]);
                }}
                  style={{ padding: "6px 4px", borderRadius: 8, border: sel ? "2px solid #A5B4FC" : "1px solid rgba(255,255,255,0.1)", background: sel ? "rgba(165,180,252,0.2)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#FFF" }}>{v.label}</div>
                  <div style={{ fontSize: 9, color: "#9CA3AF" }}>{v.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderStation4() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#93C5FD", marginBottom: 8 }}>What catches your eye in the community?</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>Click areas in the 3D scene outside the window, or pick from below:</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {COMMUNITY_HOTSPOTS.map(hs => {
              const sel = selectedHotspots.includes(hs.id);
              return (
                <button key={hs.id} onClick={() => {
                  if (sel) setSelectedHotspots(selectedHotspots.filter(x => x !== hs.id));
                  else { setSelectedHotspots([...selectedHotspots, hs.id]); setKitDialogue("Good eye — tell me more about what you see there."); setKitExpression("point"); setTimeout(() => setKitExpression("idle"), 1500); }
                }}
                  style={{ padding: "8px 6px", borderRadius: 8, border: sel ? `2px solid ${hs.color}` : "1px solid rgba(255,255,255,0.1)", background: sel ? `${hs.color}22` : "rgba(255,255,255,0.05)", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: hs.color }}>{hs.label}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#93C5FD", marginBottom: 6 }}>What problem do you see there?</div>
          <textarea value={problemText} onChange={e => setProblemText(e.target.value)} placeholder="Describe a problem you'd want to solve..."
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#FFF", fontSize: 13, resize: "none", height: 60, outline: "none" }} />
        </div>
      </div>
    );
  }

  function renderStation5() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#6EE7B7", marginBottom: 4 }}>How confident are you in each area?</div>
        {EFFICACY_DOMAINS.map(d => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 100, fontSize: 11, color: "#D1D5DB" }}>{d.label}</div>
            <input type="range" min={1} max={5} value={efficacyRatings[d.id] || 3}
              onChange={e => setEfficacyRatings({ ...efficacyRatings, [d.id]: parseInt(e.target.value) })}
              style={{ flex: 1, accentColor: "#6EE7B7" }} />
            <div style={{ width: 20, fontSize: 12, color: "#6EE7B7", textAlign: "center" }}>{efficacyRatings[d.id] || 3}</div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>1 = still learning &nbsp; 5 = I've got this</div>
      </div>
    );
  }

  function renderStation6() {
    if (selectedDoor !== null && selectedFear !== null) {
      return (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#C4B5FD", marginBottom: 8 }}>You chose Door {selectedDoor + 1}</div>
          <div style={{ fontSize: 13, color: "#D1D5DB" }}>
            {["The bold path — fast, ambitious, high risk.", "The deep path — thorough, researched, methodical.", "The wide path — collaborative, many perspectives."][selectedDoor]}
          </div>
        </div>
      );
    }
    if (selectedDoor !== null) {
      // Fear cards
      return (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#C4B5FD", marginBottom: 8 }}>Before you go — pick the fear that resonates most:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FEAR_CARDS.map(card => (
              <button key={card.id} onClick={() => {
                setSelectedFear(card.id);
                setKitDialogue(card.response);
                setKitExpression("think");
                setTimeout(() => setKitExpression("idle"), 3000);
              }}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(196,181,253,0.3)", background: "rgba(196,181,253,0.1)", color: "#FFF", cursor: "pointer", fontSize: 12, textAlign: "left" }}>
                {card.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    // Door selection
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#C4B5FD", marginBottom: 12 }}>Three doors. Three paths. Choose one.</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Bold", color: "#EF4444", desc: "Fast, ambitious, high risk" },
            { label: "Deep", color: "#3B82F6", desc: "Thorough, researched, methodical" },
            { label: "Wide", color: "#22C55E", desc: "Collaborative, many perspectives" },
          ].map((door, i) => (
            <button key={i} onClick={() => {
              setSelectedDoor(i);
              setKitDialogue("Interesting choice... but first, let's talk about something.");
              setKitExpression("think");
            }}
              style={{ flex: 1, padding: "16px 8px", borderRadius: 12, border: `2px solid ${door.color}`, background: `${door.color}22`, cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>🚪</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: door.color }}>{door.label}</div>
              <div style={{ fontSize: 10, color: "#D1D5DB", marginTop: 4 }}>{door.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderStation7() {
    if (revealShown) {
      const arch = ARCHETYPES[computedArchetype] || ARCHETYPES.creative;
      return (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#F9A8D4", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Grand Reveal</div>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{arch.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: arch.color, marginBottom: 4 }}>{arch.name}</div>
          <div style={{ fontSize: 14, color: "#E5E7EB", marginBottom: 16 }}>{arch.desc}</div>
          <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>Your project statement</div>
            <div style={{ fontSize: 14, color: "#FFF", fontStyle: "italic" }}>"{projectStatement}"</div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            {selectedInterests.slice(0, 3).map(id => {
              const item = INTEREST_ICONS.find(x => x.id === id);
              return <span key={id} style={{ padding: "3px 8px", borderRadius: 12, background: "rgba(165,180,252,0.2)", color: "#A5B4FC", fontSize: 11 }}>{item?.icon} {item?.label}</span>;
            })}
            {topValues.slice(0, 3).map(id => {
              const v = VALUES_CARDS.find(x => x.id === id);
              return <span key={id} style={{ padding: "3px 8px", borderRadius: 12, background: "rgba(252,211,77,0.2)", color: "#FCD34D", fontSize: 11 }}>{v?.label}</span>;
            })}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#FBCFE8", marginBottom: 8 }}>Write your project statement</div>
          <textarea value={projectStatement} onChange={e => setProjectStatement(e.target.value)}
            placeholder="I want to design..."
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#FFF", fontSize: 14, resize: "none", height: 70, outline: "none" }} />
        </div>
        {projectStatement.length > 10 && (
          <button onClick={() => { setRevealShown(true); setKitDialogue(KIT_DIALOGUE[7].exit); setKitExpression("celebrate"); }}
            style={{ padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg, #EC4899, #8B5CF6)", color: "#FFF", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
            Reveal Who I Am ✨
          </button>
        )}
      </div>
    );
  }

  const stationRenderers = [renderStation0, renderStation1, renderStation2, renderStation3, renderStation4, renderStation5, renderStation6, renderStation7];

  // ═══════════════════════════════════════════════════════════════
  // SECTION 7: MAIN RENDER
  // ═══════════════════════════════════════════════════════════════

  const meta = STATION_META[station];

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden", fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif" }}>
      {/* 3D Canvas */}
      <div ref={mountRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* Transition overlay */}
      {transitioning && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "black", opacity: 0.7, transition: "opacity 0.4s" }} />
      )}

      {/* Top bar: station name + progress */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
        <div>
          <div style={{ fontSize: 11, color: meta.colors.accent, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>Station {station}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#FFF" }}>{meta.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{meta.subtitle}</div>
        </div>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6 }}>
          {STATION_META.map((s, i) => (
            <div key={i} style={{
              width: i === station ? 24 : 8, height: 8, borderRadius: 4,
              background: i < station ? meta.colors.accent : i === station ? meta.colors.primary : "rgba(255,255,255,0.2)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
      </div>

      {/* Kit dialogue bubble */}
      {showDialogue && kitDialogue && (
        <div style={{
          position: "absolute", bottom: 260, left: 24, zIndex: 10, maxWidth: 280,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", borderRadius: 16,
          padding: "12px 16px", border: "1px solid rgba(124,58,237,0.4)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#C4B5FD", marginBottom: 4 }}>Kit</div>
          <div style={{ fontSize: 13, color: "#FFF", lineHeight: 1.5 }}>{kitDialogue}</div>
        </div>
      )}

      {/* Station interaction panel */}
      <div style={{
        position: "absolute", bottom: 0, right: 0, width: "min(420px, 100%)", maxHeight: "55vh", zIndex: 10,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", borderTopLeftRadius: 20,
        padding: "20px 20px 80px 20px", overflowY: "auto",
        borderTop: `2px solid ${meta.colors.primary}40`,
      }}>
        {stationRenderers[station]()}
      </div>

      {/* Navigation buttons */}
      <div style={{ position: "absolute", bottom: 16, right: 24, zIndex: 20, display: "flex", gap: 8 }}>
        {station > 0 && (
          <button onClick={prevStation} disabled={transitioning}
            style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.1)", color: "#FFF", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 13 }}>
            ← Back
          </button>
        )}
        {station < 7 && (
          <button onClick={nextStation} disabled={!canAdvance || transitioning}
            style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: canAdvance ? "pointer" : "not-allowed",
              background: canAdvance ? `linear-gradient(135deg, ${meta.colors.primary}, ${meta.colors.accent})` : "rgba(255,255,255,0.1)",
              color: "#FFF", border: "none", opacity: canAdvance ? 1 : 0.4, transition: "all 0.3s",
            }}>
            Continue →
          </button>
        )}
        {station === 7 && revealShown && (
          <button style={{ padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg, #EC4899, #8B5CF6)", color: "#FFF", border: "none", cursor: "pointer" }}>
            Start My Journey 🚀
          </button>
        )}
      </div>
    </div>
  );
}
