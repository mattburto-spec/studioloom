/**
 * ============================================================
 * DISCOVERY ENGINE — ROOM DESIGN PROTOTYPE
 * ============================================================
 *
 * "Another World" aesthetic: floating platforms with curved
 * backdrop shells, atmospheric fog, emissive accents, and
 * particle effects. Each station is a distinct island in a
 * shared void, connected by the journey.
 *
 * ROOM ARCHITECTURE:
 * - Floating hexagonal platform (main floor)
 * - Curved backdrop shell (180° arc behind the platform)
 * - Station-specific Kenney GLB props
 * - 3-point lighting with colored accents
 * - Fog tinted to station palette
 * - Floating emissive particles
 * - Edge glow ring around platform
 *
 * In production: swap for @react-three/fiber + @react-three/drei.
 * This prototype uses raw Three.js for artifact compatibility.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// ═══════════════════════════════════════════════════════════════
// SECTION 1: STATION DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const STATIONS = [
  {
    id: 0, name: "Identity Card", subtitle: "Welcome to the studio",
    env: "foyer",
    colors: {
      primary: "#F59E0B", bg: "#1A1408", accent: "#FCD34D",
      fog: "#1A1408", ambient: "#FEF3C7", floor: "#C4A265",
      shell: "#2D2210", emissive: "#F59E0B", edgeGlow: "#D97706",
    },
    cameraPos: [0, 4, 9],
    cameraTarget: [0, 1, 0],
  },
  {
    id: 1, name: "The Campfire", subtitle: "How do you work?",
    env: "campfire",
    colors: {
      primary: "#EA580C", bg: "#0D0805", accent: "#FB923C",
      fog: "#0D0805", ambient: "#431407", floor: "#3D2817",
      shell: "#1A0F08", emissive: "#EF4444", edgeGlow: "#EA580C",
    },
    cameraPos: [0, 3.5, 8],
    cameraTarget: [0, 0.5, 0],
  },
  {
    id: 2, name: "The Workshop", subtitle: "What's your superpower?",
    env: "workshop",
    colors: {
      primary: "#0D9488", bg: "#0A1A18", accent: "#5EEAD4",
      fog: "#0A1A18", ambient: "#134E4A", floor: "#9CA3AF",
      shell: "#0F2A26", emissive: "#14B8A6", edgeGlow: "#0D9488",
    },
    cameraPos: [0, 4, 9],
    cameraTarget: [0, 1, 0],
  },
  {
    id: 3, name: "Collection Wall", subtitle: "What lights you up?",
    env: "gallery",
    colors: {
      primary: "#6366F1", bg: "#0A0A1F", accent: "#A5B4FC",
      fog: "#0A0A1F", ambient: "#1E1B4B", floor: "#1E1B4B",
      shell: "#141230", emissive: "#818CF8", edgeGlow: "#6366F1",
    },
    cameraPos: [0, 4, 9],
    cameraTarget: [0, 1.2, 0],
  },
  {
    id: 4, name: "The Window", subtitle: "What do you see out there?",
    env: "window",
    colors: {
      primary: "#3B82F6", bg: "#0A1525", accent: "#93C5FD",
      fog: "#0A1525", ambient: "#1E3A5F", floor: "#1E3A5F",
      shell: "#0F1E30", emissive: "#60A5FA", edgeGlow: "#3B82F6",
    },
    cameraPos: [0, 4, 9],
    cameraTarget: [0, 1, 0],
  },
  {
    id: 5, name: "Your Toolkit", subtitle: "What do you bring?",
    env: "shelves",
    colors: {
      primary: "#059669", bg: "#051A12", accent: "#6EE7B7",
      fog: "#051A12", ambient: "#064E3B", floor: "#064E3B",
      shell: "#0A2E1E", emissive: "#34D399", edgeGlow: "#059669",
    },
    cameraPos: [0, 4, 9],
    cameraTarget: [0, 1, 0],
  },
  {
    id: 6, name: "Crossroads", subtitle: "Choose your path",
    env: "corridor",
    colors: {
      primary: "#7C3AED", bg: "#0D0520", accent: "#C4B5FD",
      fog: "#0D0520", ambient: "#2E1065", floor: "#2E1065",
      shell: "#1A0A35", emissive: "#A78BFA", edgeGlow: "#7C3AED",
    },
    cameraPos: [0, 4, 9],
    cameraTarget: [0, 1, 0],
  },
  {
    id: 7, name: "Launchpad", subtitle: "Your grand reveal",
    env: "rooftop",
    colors: {
      primary: "#F472B6", bg: "#1A0815", accent: "#FBCFE8",
      fog: "#1A0815", ambient: "#831843", floor: "#831843",
      shell: "#2D1025", emissive: "#F9A8D4", edgeGlow: "#F472B6",
    },
    cameraPos: [0, 5, 10],
    cameraTarget: [0, 1.5, 0],
  },
];

// ═══════════════════════════════════════════════════════════════
// SECTION 2: ASSET PATHS
// ═══════════════════════════════════════════════════════════════

const FURN = "3delements/kenney_furniture-kit/Models/GLTF format/";
const NATR = "3delements/kenney_nature-kit/Models/GLTF format/";

// Station-specific prop layouts
const STATION_PROPS = {
  foyer: [
    { path: FURN + "desk.glb", pos: [0, 0, -2.5], scale: 1.4, rotY: 0 },
    { path: FURN + "chair.glb", pos: [0, 0, -0.8], scale: 1.4, rotY: Math.PI },
    { path: FURN + "bookcaseOpen.glb", pos: [-3, 0, -3.5], scale: 1.5, rotY: 0 },
    { path: FURN + "bookcaseClosedWide.glb", pos: [-1, 0, -3.8], scale: 1.5, rotY: 0 },
    { path: FURN + "laptop.glb", pos: [0.3, 0.85, -2.5], scale: 1.2, rotY: 0 },
    { path: FURN + "books.glb", pos: [-0.5, 0.85, -2.5], scale: 1.2, rotY: 0.3 },
    { path: FURN + "pottedPlant.glb", pos: [3, 0, -2], scale: 1.6, rotY: 0 },
    { path: FURN + "rugRound.glb", pos: [0, 0.02, 1.5], scale: 2.5, rotY: 0 },
    { path: FURN + "coatRackStanding.glb", pos: [3.5, 0, 0.5], scale: 1.4, rotY: 0 },
    { path: FURN + "lampRoundFloor.glb", pos: [-3.5, 0, -1], scale: 1.4, rotY: 0 },
    { path: FURN + "sideTable.glb", pos: [3, 0, -0.5], scale: 1.2, rotY: 0 },
    { path: FURN + "lampRoundTable.glb", pos: [3, 0.6, -0.5], scale: 1.1, rotY: 0 },
  ],
  campfire: [
    { path: NATR + "campfire_stones.glb", pos: [0, 0, 0], scale: 1.8, rotY: 0 },
    { path: NATR + "log_stack.glb", pos: [2, 0, 1.5], scale: 1.5, rotY: 0.4 },
    { path: NATR + "log.glb", pos: [-2, 0, 2], scale: 2.0, rotY: 1.2 },
    { path: NATR + "stump_round.glb", pos: [-2.5, 0, -1], scale: 1.5, rotY: 0 },
    { path: NATR + "stump_roundDetailed.glb", pos: [1, 0, 2.5], scale: 1.4, rotY: 0 },
    { path: NATR + "tree_pineDefaultA.glb", pos: [-4, 0, -3], scale: 1.8, rotY: 0 },
    { path: NATR + "tree_pineRoundA.glb", pos: [4, 0, -3.5], scale: 2.0, rotY: 0 },
    { path: NATR + "rock_smallA.glb", pos: [3, 0, 2], scale: 1.5, rotY: 0 },
    { path: NATR + "rock_smallC.glb", pos: [-3.5, 0, 2.5], scale: 1.4, rotY: 0 },
    { path: NATR + "mushroom_redGroup.glb", pos: [-3, 0, -2], scale: 1.5, rotY: 0 },
    { path: NATR + "plant_bush.glb", pos: [2.5, 0, -2.5], scale: 1.6, rotY: 0 },
    { path: NATR + "grass_large.glb", pos: [-1, 0, -3], scale: 2.0, rotY: 0 },
  ],
  workshop: [
    { path: FURN + "desk.glb", pos: [0, 0, -3], scale: 1.6, rotY: 0 },
    { path: FURN + "stoolBar.glb", pos: [0, 0, -1.5], scale: 1.3, rotY: 0 },
    { path: FURN + "stoolBar.glb", pos: [-1.5, 0, -1.5], scale: 1.3, rotY: 0 },
    { path: FURN + "bookcaseClosedWide.glb", pos: [-3.5, 0, -3.5], scale: 1.5, rotY: 0.3 },
    { path: FURN + "cardboardBoxOpen.glb", pos: [3, 0, -1], scale: 1.5, rotY: 0 },
    { path: FURN + "cardboardBoxClosed.glb", pos: [3, 0.6, -1], scale: 1.5, rotY: 0.5 },
    { path: FURN + "computerScreen.glb", pos: [-0.8, 0.85, -3], scale: 1.1, rotY: 0 },
    { path: FURN + "lampSquareFloor.glb", pos: [3.5, 0, -2.5], scale: 1.4, rotY: 0 },
    { path: FURN + "trashcan.glb", pos: [3.5, 0, 1], scale: 1.3, rotY: 0 },
    { path: FURN + "books.glb", pos: [0.5, 0.85, -3], scale: 1.1, rotY: 0.8 },
  ],
  gallery: [
    { path: FURN + "loungeDesignSofa.glb", pos: [0, 0, 1.5], scale: 1.4, rotY: Math.PI },
    { path: FURN + "tableCoffeeGlass.glb", pos: [0, 0, 0], scale: 1.4, rotY: 0 },
    { path: FURN + "plantSmall1.glb", pos: [3, 0, -2], scale: 1.6, rotY: 0 },
    { path: FURN + "plantSmall2.glb", pos: [-3, 0, -2], scale: 1.6, rotY: 0 },
    { path: FURN + "lampRoundFloor.glb", pos: [-3.5, 0, 1], scale: 1.5, rotY: 0 },
    { path: FURN + "lampRoundFloor.glb", pos: [3.5, 0, 1], scale: 1.5, rotY: 0 },
    { path: FURN + "rugRounded.glb", pos: [0, 0.02, 0.5], scale: 3, rotY: 0 },
    { path: FURN + "loungeChairRelax.glb", pos: [-2.5, 0, 0], scale: 1.3, rotY: 0.5 },
    { path: FURN + "loungeChairRelax.glb", pos: [2.5, 0, 0], scale: 1.3, rotY: -0.5 },
  ],
  window: [
    { path: FURN + "benchCushion.glb", pos: [0, 0, -2.5], scale: 1.4, rotY: 0 },
    { path: FURN + "tableCoffee.glb", pos: [0, 0, -0.5], scale: 1.3, rotY: 0 },
    { path: NATR + "plant_bushDetailed.glb", pos: [-3, 0, -2], scale: 1.5, rotY: 0 },
    { path: NATR + "plant_bushLarge.glb", pos: [3, 0, -2.5], scale: 1.4, rotY: 0 },
    { path: NATR + "flower_purpleA.glb", pos: [-2, 0, 1.5], scale: 2.0, rotY: 0 },
    { path: NATR + "flower_yellowA.glb", pos: [2, 0, 1.5], scale: 2.0, rotY: 0 },
    { path: FURN + "pillowBlueLong.glb", pos: [0.3, 0.45, -2.5], scale: 1.2, rotY: 0.2 },
    { path: FURN + "plantSmall3.glb", pos: [3.5, 0, 0.5], scale: 1.5, rotY: 0 },
    { path: NATR + "rock_smallFlatA.glb", pos: [-3.5, 0, 1], scale: 2.0, rotY: 0 },
  ],
  shelves: [
    { path: FURN + "bookcaseOpen.glb", pos: [-2.5, 0, -3.5], scale: 1.5, rotY: 0 },
    { path: FURN + "bookcaseClosed.glb", pos: [-0.5, 0, -3.5], scale: 1.5, rotY: 0 },
    { path: FURN + "bookcaseOpen.glb", pos: [1.5, 0, -3.5], scale: 1.5, rotY: 0 },
    { path: FURN + "desk.glb", pos: [0, 0, -1], scale: 1.3, rotY: 0 },
    { path: FURN + "books.glb", pos: [-0.4, 0.85, -1], scale: 1.2, rotY: 0 },
    { path: FURN + "books.glb", pos: [0.4, 0.85, -1], scale: 1.2, rotY: 1.5 },
    { path: FURN + "cardboardBoxOpen.glb", pos: [3, 0, 0], scale: 1.4, rotY: 0 },
    { path: FURN + "pottedPlant.glb", pos: [-3.5, 0, 0], scale: 1.5, rotY: 0 },
    { path: FURN + "lampSquareFloor.glb", pos: [3.5, 0, -2], scale: 1.3, rotY: 0 },
    { path: FURN + "rugRectangle.glb", pos: [0, 0.02, 1], scale: 2.0, rotY: 0 },
  ],
  corridor: [
    { path: NATR + "statue_obelisk.glb", pos: [-3, 0, -2], scale: 1.8, rotY: 0 },
    { path: NATR + "statue_obelisk.glb", pos: [3, 0, -2], scale: 1.8, rotY: 0 },
    { path: NATR + "statue_column.glb", pos: [-4, 0, 0], scale: 1.6, rotY: 0 },
    { path: NATR + "statue_column.glb", pos: [4, 0, 0], scale: 1.6, rotY: 0 },
    { path: NATR + "stone_tallA.glb", pos: [-2, 0, -3.5], scale: 1.5, rotY: 0 },
    { path: NATR + "stone_tallB.glb", pos: [2, 0, -3.5], scale: 1.5, rotY: 0 },
    { path: NATR + "path_stone.glb", pos: [0, 0.02, -1], scale: 2.0, rotY: 0 },
    { path: NATR + "path_stone.glb", pos: [0, 0.02, 1], scale: 2.0, rotY: 0 },
    { path: NATR + "mushroom_tanTall.glb", pos: [-3.5, 0, 2], scale: 2.0, rotY: 0 },
    { path: NATR + "mushroom_redTall.glb", pos: [3.5, 0, 2], scale: 2.0, rotY: 0 },
    { path: NATR + "hanging_moss.glb", pos: [-1, 3, -3], scale: 2.5, rotY: 0 },
    { path: NATR + "hanging_moss.glb", pos: [1, 3.2, -3.5], scale: 2.0, rotY: 1 },
  ],
  rooftop: [
    { path: NATR + "platform_stone.glb", pos: [0, -0.1, 0], scale: 2.5, rotY: 0 },
    { path: NATR + "statue_ring.glb", pos: [0, 0, -2.5], scale: 2.0, rotY: 0 },
    { path: NATR + "statue_column.glb", pos: [-3, 0, -3], scale: 1.5, rotY: 0 },
    { path: NATR + "statue_column.glb", pos: [3, 0, -3], scale: 1.5, rotY: 0 },
    { path: NATR + "flower_redA.glb", pos: [-2, 0, 1], scale: 2.5, rotY: 0 },
    { path: NATR + "flower_purpleB.glb", pos: [2, 0, 1.5], scale: 2.5, rotY: 0 },
    { path: NATR + "flower_yellowB.glb", pos: [-1, 0, 2.5], scale: 2.5, rotY: 0 },
    { path: NATR + "plant_bushSmall.glb", pos: [3, 0, 1], scale: 2.0, rotY: 0 },
    { path: NATR + "plant_bushSmall.glb", pos: [-3.5, 0, 0], scale: 1.8, rotY: 0 },
    { path: NATR + "lily_large.glb", pos: [0, 0, 2], scale: 3.0, rotY: 0 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// SECTION 3: GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════════

/** Create a hexagonal platform */
function createPlatform(radius, height, color, edgeColor) {
  const group = new THREE.Group();

  // Main platform — cylinder with 6 sides for hex look
  const geo = new THREE.CylinderGeometry(radius, radius * 1.05, height, 32);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.3, metalness: 0.1,
  });
  const platform = new THREE.Mesh(geo, mat);
  platform.position.y = -height / 2;
  platform.receiveShadow = true;
  group.add(platform);

  // Edge glow ring
  const ringGeo = new THREE.TorusGeometry(radius * 1.02, 0.04, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: edgeColor });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  ring.name = "edgeRing";
  group.add(ring);

  // Subtle under-glow
  const underGeo = new THREE.CircleGeometry(radius * 1.1, 32);
  const underMat = new THREE.MeshBasicMaterial({
    color: edgeColor, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
  });
  const underglow = new THREE.Mesh(underGeo, underMat);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = -height;
  group.add(underglow);

  return group;
}

/** Create curved backdrop shell (180° arc) */
function createBackdropShell(radius, height, color, emissiveColor) {
  const group = new THREE.Group();

  // Main curved wall — half cylinder
  const shellGeo = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, Math.PI * 0.05, Math.PI * 0.9);
  const shellMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.8, metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.position.y = height / 2;
  shell.rotation.y = Math.PI / 2;
  group.add(shell);

  // Inner emissive trim at the top edge
  const trimGeo = new THREE.TorusGeometry(radius * 0.99, 0.03, 8, 48, Math.PI * 0.88);
  const trimMat = new THREE.MeshBasicMaterial({ color: emissiveColor });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.rotation.x = -Math.PI / 2;
  trim.rotation.z = Math.PI * 0.06;
  trim.position.y = height;
  trim.position.z = 0;
  group.add(trim);

  return group;
}

/** Create floating particles */
function createParticles(count, spread, color, yRange = [0.5, 6]) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    sizes[i] = Math.random() * 0.06 + 0.02;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color, size: 0.05, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}

/** Create star field (background) */
function createStarField(count) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 30 + Math.random() * 20;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: "#FEF3C7", size: 0.08, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}

/** Emissive accent object — glowing crystal/orb */
function createEmissiveAccent(type, color, pos, scale = 1) {
  let geo;
  if (type === "crystal") {
    geo = new THREE.OctahedronGeometry(0.2 * scale, 0);
  } else if (type === "orb") {
    geo = new THREE.SphereGeometry(0.15 * scale, 16, 16);
  } else {
    geo = new THREE.IcosahedronGeometry(0.18 * scale, 0);
  }

  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.8,
    roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.9,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.name = "emissive_accent";
  return mesh;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: GLB LOADER
// ═══════════════════════════════════════════════════════════════

const _glbCache = {};
let _gltfLoader = null;

function loadGLB(path, parent, pos, scale = 1, rotY = 0) {
  if (!_gltfLoader) _gltfLoader = new GLTFLoader();

  function place(model) {
    model.position.set(...pos);
    if (typeof scale === "number") model.scale.set(scale, scale, scale);
    else model.scale.set(...scale);
    model.rotation.y = rotY;
    model.traverse(c => {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });
    parent.add(model);
  }

  if (_glbCache[path]) { place(_glbCache[path].clone()); return; }
  _gltfLoader.load(path, (gltf) => {
    _glbCache[path] = gltf.scene.clone();
    place(gltf.scene);
  }, undefined, (err) => console.warn("GLB failed:", path, err));
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: STATION BUILDER
// ═══════════════════════════════════════════════════════════════

function buildStation(scene, station) {
  const group = new THREE.Group();
  group.name = `station_${station.id}`;
  const c = station.colors;

  // --- 1. FLOATING PLATFORM ---
  const platform = createPlatform(5.5, 0.5, c.floor, c.edgeGlow);
  group.add(platform);

  // --- 2. CURVED BACKDROP SHELL ---
  const shell = createBackdropShell(6.5, 5.5, c.shell, c.emissive);
  shell.position.z = -1;
  group.add(shell);

  // --- 3. LIGHTING ---

  // Ambient — soft colored wash
  const ambient = new THREE.AmbientLight(c.ambient, 0.3);
  group.add(ambient);

  // Key light — warm directional with shadows
  const keyLight = new THREE.DirectionalLight("#FFF5E1", 0.7);
  keyLight.position.set(3, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 25;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias = -0.001;
  group.add(keyLight);

  // Fill light — colored, opposite side
  const fillLight = new THREE.PointLight(c.primary, 0.5, 15);
  fillLight.position.set(-4, 3, 3);
  group.add(fillLight);

  // Accent light — behind objects, rim lighting effect
  const accentLight = new THREE.PointLight(c.emissive, 0.4, 12);
  accentLight.position.set(0, 2, -5);
  group.add(accentLight);

  // --- 4. EMISSIVE ACCENTS ---
  const accents = [
    createEmissiveAccent("crystal", c.emissive, [-4.5, 0.3, -2.5], 1.2),
    createEmissiveAccent("orb", c.accent, [4.2, 1.5, -1], 0.8),
    createEmissiveAccent("crystal", c.emissive, [-2, 0.2, 3], 0.6),
    createEmissiveAccent("icosa", c.accent, [3.5, 0.4, 2.5], 0.9),
  ];
  accents.forEach(a => group.add(a));

  // --- 5. PARTICLES ---
  const particles = createParticles(60, 12, c.accent, [0.3, 5]);
  particles.name = "particles";
  group.add(particles);

  // --- 6. PROPS (Kenney GLBs) ---
  const props = STATION_PROPS[station.env] || [];
  props.forEach(p => loadGLB(p.path, group, p.pos, p.scale, p.rotY));

  // --- 7. STATION-SPECIFIC DETAILS ---

  if (station.env === "campfire") {
    // Fire glow point light at campfire center
    const fireLight = new THREE.PointLight("#FF6B00", 1.2, 8);
    fireLight.position.set(0, 0.8, 0);
    fireLight.name = "fireLight";
    group.add(fireLight);

    // Fake fire — 3 overlapping cones
    [["#EF4444", 0.3, 0.8], ["#F97316", 0.2, 0.6], ["#FCD34D", 0.12, 0.4]].forEach(([col, r, h], i) => {
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 - i * 0.1 });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat);
      cone.position.set((Math.random() - 0.5) * 0.05, 0.15 + h / 2, (Math.random() - 0.5) * 0.05);
      cone.name = "flame_" + i;
      group.add(cone);
    });
  }

  if (station.env === "gallery") {
    // Floating picture frames on the shell wall
    const frameColors = ["#FCD34D", "#A5B4FC", "#F9A8D4", "#86EFAC", "#FCA5A5"];
    frameColors.forEach((fc, i) => {
      const angle = (i / frameColors.length) * Math.PI * 0.7 + Math.PI * 0.15;
      const x = Math.sin(angle) * 6;
      const z = -Math.cos(angle) * 6;
      const frameGroup = new THREE.Group();

      // Frame
      const frameMat = new THREE.MeshStandardMaterial({ color: "#FFF7ED", roughness: 0.9 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.06), frameMat);
      frameGroup.add(frame);

      // Canvas
      const canvasMat = new THREE.MeshStandardMaterial({
        color: fc, emissive: fc, emissiveIntensity: 0.15,
      });
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.04), canvasMat);
      canvas.position.z = 0.02;
      frameGroup.add(canvas);

      frameGroup.position.set(x, 2.5, z - 1);
      frameGroup.lookAt(0, 2.5, 0);
      group.add(frameGroup);
    });
  }

  if (station.env === "corridor") {
    // Glowing path lines on the ground
    for (let i = -2; i <= 2; i++) {
      const lineGeo = new THREE.BoxGeometry(0.08, 0.02, 1.2);
      const lineMat = new THREE.MeshBasicMaterial({
        color: c.emissive, transparent: true, opacity: 0.5 + Math.abs(i) * 0.1,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(i * 1.2, 0.02, i * 0.5);
      group.add(line);
    }
  }

  if (station.env === "rooftop") {
    // Extra star particles for the grand reveal
    const extraStars = createParticles(100, 18, "#FBCFE8", [1, 8]);
    group.add(extraStars);

    // Rising column of light
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.6, 8, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: c.emissive, transparent: true, opacity: 0.08,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 4, -2.5);
    beam.name = "launchBeam";
    group.add(beam);
  }

  scene.add(group);
  return group;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6: ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════

function animateStation(group, clock) {
  const t = clock.getElapsedTime();

  // Float particles gently
  const particles = group.getObjectByName("particles");
  if (particles) {
    const pos = particles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += Math.sin(t * 0.5 + i) * 0.001;
      // Wrap particles that go too high
      if (pos.array[i * 3 + 1] > 6) pos.array[i * 3 + 1] = 0.3;
    }
    pos.needsUpdate = true;
    particles.rotation.y = t * 0.02;
  }

  // Pulse edge ring
  const ring = group.getObjectByName("edgeRing");
  if (ring) {
    ring.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.3;
    ring.material.transparent = true;
  }

  // Bob emissive accents
  group.children.forEach(child => {
    if (child.name === "emissive_accent") {
      child.position.y += Math.sin(t * 0.8 + child.position.x) * 0.0008;
      child.rotation.y = t * 0.3;
      child.rotation.z = Math.sin(t * 0.5) * 0.1;
    }
  });

  // Campfire flicker
  const fireLight = group.getObjectByName("fireLight");
  if (fireLight) {
    fireLight.intensity = 1.0 + Math.sin(t * 8) * 0.3 + Math.sin(t * 12.5) * 0.15;
    fireLight.position.x = Math.sin(t * 3) * 0.05;
  }

  // Flame sway
  for (let i = 0; i < 3; i++) {
    const flame = group.getObjectByName("flame_" + i);
    if (flame) {
      flame.position.x = Math.sin(t * (4 + i * 2)) * 0.04;
      flame.position.z = Math.cos(t * (3 + i * 1.5)) * 0.04;
      flame.scale.y = 1 + Math.sin(t * (6 + i * 3)) * 0.15;
    }
  }

  // Launch beam pulse
  const beam = group.getObjectByName("launchBeam");
  if (beam) {
    beam.material.opacity = 0.05 + Math.sin(t * 0.8) * 0.04;
    beam.rotation.y = t * 0.2;
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 7: REACT COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function DiscoveryRoomsPrototype() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const stationGroupRef = useRef(null);
  const starFieldRef = useRef(null);
  const [currentStation, setCurrentStation] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const rafRef = useRef(null);

  // Initialize scene
  useEffect(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    cameraRef.current = camera;

    // Star field (persistent across stations)
    const stars = createStarField(500);
    starFieldRef.current = stars;
    scene.add(stars);

    // Resize handler
    const onResize = () => {
      const nw = mountRef.current?.clientWidth || w;
      const nh = mountRef.current?.clientHeight || h;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    // Animation loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const group = stationGroupRef.current;
      if (group) animateStation(group, clockRef.current);

      // Slowly rotate star field
      if (starFieldRef.current) {
        starFieldRef.current.rotation.y += 0.0001;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Switch stations
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    const station = STATIONS[currentStation];

    // Remove old station
    if (stationGroupRef.current) {
      scene.remove(stationGroupRef.current);
      stationGroupRef.current.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }

    // Update fog
    scene.fog = new THREE.FogExp2(station.colors.fog, 0.035);
    scene.background = new THREE.Color(station.colors.bg);

    // Build new station
    const group = buildStation(scene, station);
    stationGroupRef.current = group;

    // Camera
    camera.position.set(...station.cameraPos);
    camera.lookAt(...station.cameraTarget);
  }, [currentStation]);

  const goTo = useCallback((idx) => {
    if (transitioning || idx === currentStation) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentStation(idx);
      setTransitioning(false);
    }, 300);
  }, [currentStation, transitioning]);

  const station = STATIONS[currentStation];

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", background: "#000", overflow: "hidden" }}>
      {/* Three.js canvas mount */}
      <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />

      {/* Transition overlay */}
      <div style={{
        position: "absolute", inset: 0, background: "#000",
        opacity: transitioning ? 1 : 0, transition: "opacity 0.3s ease",
        pointerEvents: "none", zIndex: 10,
      }} />

      {/* Station info */}
      <div style={{
        position: "absolute", top: 24, left: 24, zIndex: 20,
        color: "#fff", fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 2,
          color: station.colors.accent, textTransform: "uppercase", marginBottom: 4,
        }}>
          Station {station.id + 1} of {STATIONS.length}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>
          {station.name}
        </div>
        <div style={{ fontSize: 14, opacity: 0.6 }}>
          {station.subtitle}
        </div>
      </div>

      {/* Station selector — bottom bar */}
      <div style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 6, zIndex: 20,
        background: "rgba(0,0,0,0.5)", borderRadius: 20,
        padding: "8px 16px", backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        {STATIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            style={{
              width: i === currentStation ? 36 : 12,
              height: 12,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: i === currentStation ? s.colors.primary : "rgba(255,255,255,0.2)",
              transition: "all 0.3s ease",
              position: "relative",
            }}
            title={s.name}
          />
        ))}
      </div>

      {/* Prev/Next arrows */}
      <div style={{
        position: "absolute", bottom: 24, right: 24, display: "flex", gap: 8, zIndex: 20,
      }}>
        <button
          onClick={() => goTo(Math.max(0, currentStation - 1))}
          disabled={currentStation === 0}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.4)",
            color: currentStation === 0 ? "rgba(255,255,255,0.2)" : "#fff",
            cursor: currentStation === 0 ? "default" : "pointer",
            fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(10px)",
          }}
        >
          &#8592;
        </button>
        <button
          onClick={() => goTo(Math.min(STATIONS.length - 1, currentStation + 1))}
          disabled={currentStation === STATIONS.length - 1}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.4)",
            color: currentStation === STATIONS.length - 1 ? "rgba(255,255,255,0.2)" : "#fff",
            cursor: currentStation === STATIONS.length - 1 ? "default" : "pointer",
            fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(10px)",
          }}
        >
          &#8594;
        </button>
      </div>

      {/* Station name pills — top right */}
      <div style={{
        position: "absolute", top: 24, right: 24, zIndex: 20,
        display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end",
      }}>
        {STATIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            style={{
              padding: "4px 12px", borderRadius: 12,
              border: i === currentStation ? `1px solid ${s.colors.accent}` : "1px solid rgba(255,255,255,0.08)",
              background: i === currentStation ? `${s.colors.primary}30` : "rgba(0,0,0,0.3)",
              color: i === currentStation ? s.colors.accent : "rgba(255,255,255,0.35)",
              cursor: "pointer", fontSize: 11, fontWeight: 500,
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: "all 0.2s ease",
              backdropFilter: "blur(8px)",
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
