import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

export default function CharacterShowcase() {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [lighting, setLighting] = useState("workshop"); // workshop | evening | bright
  const dragRef = useRef({ dragging: false, prevX: 0, angleY: 0.4 });

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a1008");
    scene.fog = new THREE.FogExp2("#1a1008", 0.06);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 80);
    camera.position.set(0, 2.2, 5.5);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    mountRef.current.appendChild(renderer.domElement);

    // ═══════════════════════════════════════════════════════════
    // LIGHTING — forge workshop atmosphere
    // ═══════════════════════════════════════════════════════════

    const ambient = new THREE.AmbientLight("#2a1a0a", 0.3);
    scene.add(ambient);

    // Forge fire glow (main warm light)
    const forgeLight = new THREE.PointLight("#ff6622", 3, 10, 1.5);
    forgeLight.position.set(-2.5, 1, -1.5);
    forgeLight.castShadow = true;
    forgeLight.shadow.mapSize.set(1024, 1024);
    scene.add(forgeLight);

    // Secondary forge bounce
    const forgeBounce = new THREE.PointLight("#ff4400", 1.2, 6, 2);
    forgeBounce.position.set(-2, 0.3, -1);
    scene.add(forgeBounce);

    // Cool fill from window
    const windowLight = new THREE.DirectionalLight("#4466aa", 0.25);
    windowLight.position.set(4, 5, 2);
    windowLight.castShadow = true;
    windowLight.shadow.mapSize.set(1024, 1024);
    windowLight.shadow.camera.near = 0.1;
    windowLight.shadow.camera.far = 20;
    windowLight.shadow.camera.left = -5;
    windowLight.shadow.camera.right = 5;
    windowLight.shadow.camera.top = 5;
    windowLight.shadow.camera.bottom = -2;
    scene.add(windowLight);

    // Overhead lantern
    const lanternLight = new THREE.PointLight("#ffaa44", 1.5, 8, 2);
    lanternLight.position.set(0, 3.5, 0);
    scene.add(lanternLight);

    // Rim light (backlight for character silhouette)
    const rimLight = new THREE.SpotLight("#5588cc", 0.8, 12, Math.PI / 6, 0.5);
    rimLight.position.set(-1, 4, -3);
    rimLight.target.position.set(0, 1, 0);
    scene.add(rimLight);
    scene.add(rimLight.target);

    // ═══════════════════════════════════════════════════════════
    // WORKSHOP FLOOR
    // ═══════════════════════════════════════════════════════════

    const floorCanvas = document.createElement("canvas");
    floorCanvas.width = 512; floorCanvas.height = 512;
    const fctx = floorCanvas.getContext("2d");
    fctx.fillStyle = "#2a2018";
    fctx.fillRect(0, 0, 512, 512);
    // Wood plank pattern
    for (let p = 0; p < 8; p++) {
      const py = p * 64;
      const brightness = 30 + Math.random() * 15;
      fctx.fillStyle = `rgb(${brightness + 15}, ${brightness + 8}, ${brightness})`;
      fctx.fillRect(0, py + 1, 512, 62);
      // Grain lines
      for (let g = 0; g < 12; g++) {
        fctx.strokeStyle = `rgba(${brightness - 5}, ${brightness - 2}, ${brightness - 8}, 0.4)`;
        fctx.lineWidth = 0.5;
        fctx.beginPath();
        fctx.moveTo(0, py + 5 + g * 5 + Math.random() * 3);
        for (let gx = 0; gx < 512; gx += 20) {
          fctx.lineTo(gx, py + 5 + g * 5 + Math.sin(gx * 0.02 + g) * 2);
        }
        fctx.stroke();
      }
      // Knots
      if (Math.random() > 0.6) {
        fctx.fillStyle = `rgba(${brightness - 10}, ${brightness - 5}, ${brightness - 12}, 0.6)`;
        fctx.beginPath();
        fctx.ellipse(100 + Math.random() * 300, py + 32, 8 + Math.random() * 6, 5 + Math.random() * 4, Math.random(), 0, Math.PI * 2);
        fctx.fill();
      }
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 3);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Back wall
    const wallCanvas = document.createElement("canvas");
    wallCanvas.width = 256; wallCanvas.height = 256;
    const wctx = wallCanvas.getContext("2d");
    wctx.fillStyle = "#3a2a1a";
    wctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 300; i++) {
      wctx.fillStyle = `rgba(${40 + Math.random() * 30}, ${25 + Math.random() * 20}, ${15 + Math.random() * 15}, 0.2)`;
      wctx.fillRect(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 8, 3 + Math.random() * 8);
    }
    const wallTex = new THREE.CanvasTexture(wallCanvas);
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 5),
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 })
    );
    backWall.position.set(0, 2.5, -3);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const sideWall = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 5),
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 })
    );
    sideWall.position.set(-4, 2.5, 0);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.receiveShadow = true;
    scene.add(sideWall);

    // ═══════════════════════════════════════════════════════════
    // CHARACTER — Angular Low-Poly "Designer Hero"
    // Link-inspired but with faceted geometric style
    // ═══════════════════════════════════════════════════════════

    const character = new THREE.Group();

    // Helper: create angular/faceted shapes
    const angularMat = (color, opts = {}) => new THREE.MeshStandardMaterial({
      color, roughness: opts.roughness || 0.6, metalness: opts.metalness || 0,
      flatShading: true, // KEY: makes everything faceted/angular
      ...opts,
    });

    // ── BOOTS ──
    const bootMat = angularMat("#3a2a1a", { roughness: 0.85 });
    [-0.15, 0.15].forEach(side => {
      // Boot shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 5), bootMat);
      shaft.position.set(side, 0.175, 0);
      shaft.castShadow = true;
      character.add(shaft);
      // Boot foot (elongated box)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.28), bootMat);
      foot.position.set(side, 0.05, 0.03);
      foot.castShadow = true;
      character.add(foot);
      // Boot sole
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.3), angularMat("#1a1008"));
      sole.position.set(side, 0.02, 0.03);
      character.add(sole);
      // Boot cuff fold
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.06, 5), angularMat("#4a3a28"));
      cuff.position.set(side, 0.34, 0);
      character.add(cuff);
    });

    // ── LEGS ── (slightly tapered cylinders)
    const pantsMat = angularMat("#4a5a3a");
    [-0.13, 0.13].forEach(side => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.5, 5), pantsMat);
      leg.position.set(side, 0.6, 0);
      leg.castShadow = true;
      character.add(leg);
    });

    // ── BELT ──
    const beltMat = angularMat("#5a3a1a", { roughness: 0.7 });
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.08, 6), beltMat);
    belt.position.y = 0.87;
    character.add(belt);
    // Belt buckle
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.03), angularMat("#c4a040", { metalness: 0.8, roughness: 0.2 }));
    buckle.position.set(0, 0.87, 0.2);
    character.add(buckle);
    // Belt pouch (designer tools!)
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), angularMat("#6a4a2a"));
    pouch.position.set(0.18, 0.84, 0.12);
    pouch.rotation.y = 0.3;
    character.add(pouch);
    // Pencil sticking out of pouch
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 4), angularMat("#d4a843"));
    pencil.position.set(0.2, 0.92, 0.14);
    pencil.rotation.z = 0.3;
    pencil.rotation.x = -0.2;
    character.add(pencil);
    const pencilTip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 4), angularMat("#2a2a2a"));
    pencilTip.position.set(0.22, 0.98, 0.13);
    pencilTip.rotation.z = 0.3;
    character.add(pencilTip);

    // ── TORSO ── (angular vest/tunic)
    const tunicMat = angularMat("#3a6a3a");
    // Main torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.55, 6), tunicMat);
    torso.position.y = 1.12;
    torso.castShadow = true;
    character.add(torso);

    // Vest overlay
    const vestMat = angularMat("#2a5a2a", { roughness: 0.7 });
    // Front vest panel
    const vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.06), vestMat);
    vestFront.position.set(0, 1.15, 0.14);
    character.add(vestFront);
    // Vest collar
    const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.06), vestMat);
    collarL.position.set(-0.1, 1.38, 0.14);
    collarL.rotation.z = 0.3;
    character.add(collarL);
    const collarR = collarL.clone();
    collarR.position.x = 0.1;
    collarR.rotation.z = -0.3;
    character.add(collarR);

    // Chest strap (diagonal)
    const strapMat = angularMat("#5a3a1a");
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.04), strapMat);
    strap.position.set(-0.06, 1.15, 0.18);
    strap.rotation.z = 0.35;
    character.add(strap);

    // ── ARMS ──
    const skinMat = angularMat("#d4a87c");
    const sleeveMat = angularMat("#3a6a3a");

    [-1, 1].forEach(side => {
      // Shoulder
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 3), sleeveMat);
      shoulder.position.set(side * 0.24, 1.35, 0);
      shoulder.castShadow = true;
      character.add(shoulder);

      // Upper arm (sleeved)
      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 5), sleeveMat);
      upperArm.position.set(side * 0.28, 1.18, 0);
      upperArm.rotation.z = side * 0.15;
      upperArm.castShadow = true;
      character.add(upperArm);

      // Sleeve cuff
      const sleeveCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.065, 0.04, 5), angularMat("#2a5a2a"));
      sleeveCuff.position.set(side * 0.3, 1.03, 0);
      character.add(sleeveCuff);

      // Forearm (skin)
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 5), skinMat);
      forearm.position.set(side * 0.31, 0.92, 0.05);
      forearm.rotation.x = -0.2;
      forearm.castShadow = true;
      character.add(forearm);

      // Bracer/wrist guard
      const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.058, 0.08, 5), angularMat("#5a3a1a", { roughness: 0.7 }));
      bracer.position.set(side * 0.31, 0.85, 0.06);
      character.add(bracer);

      // Hand
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.08), skinMat);
      hand.position.set(side * 0.32, 0.78, 0.08);
      character.add(hand);
    });

    // ── RIGHT HAND: holding a ruler/measuring tool ──
    const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.015), angularMat("#c4a040", { metalness: 0.6, roughness: 0.3 }));
    ruler.position.set(0.33, 0.82, 0.1);
    ruler.rotation.x = -0.8;
    ruler.rotation.z = 0.1;
    character.add(ruler);
    // Ruler markings
    for (let m = 0; m < 6; m++) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.003, 0.02), angularMat("#1a1a1a"));
      mark.position.set(0.33, 0.68 + m * 0.04, 0.1 + m * 0.02);
      mark.rotation.x = -0.8;
      character.add(mark);
    }

    // ── NECK ──
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 5), skinMat);
    neck.position.y = 1.43;
    character.add(neck);

    // ── HEAD — Angular/faceted ──
    // Custom geometry for angular face
    const headGeo = new THREE.BufferGeometry();
    const s = 0.16; // scale
    // Vertices for angular head shape
    const headVerts = new Float32Array([
      // Front face - angular jawline
      -0.7*s, -0.5*s, 0.8*s,   0.7*s, -0.5*s, 0.8*s,   0.9*s, 0.3*s, 0.7*s,   // lower right
      -0.7*s, -0.5*s, 0.8*s,   0.9*s, 0.3*s, 0.7*s,    -0.9*s, 0.3*s, 0.7*s,   // lower left
      -0.9*s, 0.3*s, 0.7*s,    0.9*s, 0.3*s, 0.7*s,     0.8*s, 0.9*s, 0.6*s,   // mid right
      -0.9*s, 0.3*s, 0.7*s,    0.8*s, 0.9*s, 0.6*s,    -0.8*s, 0.9*s, 0.6*s,   // mid left
      -0.8*s, 0.9*s, 0.6*s,    0.8*s, 0.9*s, 0.6*s,     0*s,   1.2*s, 0.3*s,    // forehead

      // Chin point
      -0.7*s, -0.5*s, 0.8*s,   0.7*s, -0.5*s, 0.8*s,    0*s,  -0.8*s, 0.5*s,    // chin

      // Right side
      0.7*s, -0.5*s, 0.8*s,    0.9*s, 0.3*s, 0.7*s,     1.0*s, 0.2*s, 0*s,      // right low
      0.7*s, -0.5*s, 0.8*s,    1.0*s, 0.2*s, 0*s,        0.5*s, -0.6*s, 0*s,     // right jaw
      0.9*s, 0.3*s, 0.7*s,     0.8*s, 0.9*s, 0.6*s,     0.9*s, 0.8*s, 0*s,       // right upper
      0.9*s, 0.3*s, 0.7*s,     0.9*s, 0.8*s, 0*s,        1.0*s, 0.2*s, 0*s,      // right mid

      // Left side
      -0.7*s, -0.5*s, 0.8*s,  -0.9*s, 0.3*s, 0.7*s,    -1.0*s, 0.2*s, 0*s,
      -0.7*s, -0.5*s, 0.8*s,  -1.0*s, 0.2*s, 0*s,       -0.5*s, -0.6*s, 0*s,
      -0.9*s, 0.3*s, 0.7*s,   -0.8*s, 0.9*s, 0.6*s,    -0.9*s, 0.8*s, 0*s,
      -0.9*s, 0.3*s, 0.7*s,   -0.9*s, 0.8*s, 0*s,       -1.0*s, 0.2*s, 0*s,

      // Top
      -0.8*s, 0.9*s, 0.6*s,    0*s, 1.2*s, 0.3*s,       -0.9*s, 0.8*s, 0*s,
      0.8*s, 0.9*s, 0.6*s,     0*s, 1.2*s, 0.3*s,        0.9*s, 0.8*s, 0*s,
      -0.9*s, 0.8*s, 0*s,      0*s, 1.2*s, 0.3*s,        0*s, 1.0*s, -0.5*s,
      0.9*s, 0.8*s, 0*s,       0*s, 1.2*s, 0.3*s,        0*s, 1.0*s, -0.5*s,

      // Back
      -0.9*s, 0.8*s, 0*s,      0*s, 1.0*s, -0.5*s,      -0.8*s, 0.2*s, -0.5*s,
      0.9*s, 0.8*s, 0*s,       0*s, 1.0*s, -0.5*s,       0.8*s, 0.2*s, -0.5*s,
      -0.5*s, -0.6*s, 0*s,    -1.0*s, 0.2*s, 0*s,       -0.8*s, 0.2*s, -0.5*s,
      0.5*s, -0.6*s, 0*s,      1.0*s, 0.2*s, 0*s,        0.8*s, 0.2*s, -0.5*s,
      -0.5*s, -0.6*s, 0*s,    -0.8*s, 0.2*s, -0.5*s,     0*s, -0.5*s, -0.4*s,
      0.5*s, -0.6*s, 0*s,      0.8*s, 0.2*s, -0.5*s,     0*s, -0.5*s, -0.4*s,
      0*s, -0.8*s, 0.5*s,     -0.5*s, -0.6*s, 0*s,       0*s, -0.5*s, -0.4*s,
      0*s, -0.8*s, 0.5*s,      0.5*s, -0.6*s, 0*s,       0*s, -0.5*s, -0.4*s,

      // Back top fill
      -0.8*s, 0.2*s, -0.5*s,   0*s, 1.0*s, -0.5*s,       0.8*s, 0.2*s, -0.5*s,
      -0.8*s, 0.2*s, -0.5*s,   0.8*s, 0.2*s, -0.5*s,     0*s, -0.5*s, -0.4*s,
    ]);
    headGeo.setAttribute("position", new THREE.BufferAttribute(headVerts, 3));
    headGeo.computeVertexNormals();

    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.y = 1.6;
    headMesh.castShadow = true;
    character.add(headMesh);

    // ── EYES — sharp angular ──
    const eyeWhiteMat = angularMat("#e8e4d8", { roughness: 0.3 });
    const irisMat = angularMat("#2a6a4a", { roughness: 0.2, emissive: "#0a2a1a", emissiveIntensity: 0.2 });
    const pupilMat = angularMat("#0a0a0a");

    [-0.055, 0.055].forEach(ex => {
      // Eye socket shadow
      const socket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), angularMat("#b08a60"));
      socket.position.set(ex, 1.62, 0.12);
      character.add(socket);

      // Eyeball
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 4), eyeWhiteMat);
      eye.position.set(ex, 1.62, 0.135);
      character.add(eye);

      // Iris
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 4, 3), irisMat);
      iris.position.set(ex, 1.62, 0.155);
      character.add(iris);

      // Pupil
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 4, 3), pupilMat);
      pupil.position.set(ex, 1.62, 0.162);
      character.add(pupil);

      // Eyelid crease
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.015), angularMat("#c49a6a"));
      lid.position.set(ex, 1.645, 0.135);
      lid.rotation.z = ex > 0 ? -0.1 : 0.1;
      character.add(lid);

      // Lower lid
      const lowerLid = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.005, 0.012), angularMat("#c49a6a"));
      lowerLid.position.set(ex, 1.598, 0.14);
      character.add(lowerLid);
    });

    // Eyebrows — angular slashes
    [-0.055, 0.055].forEach((bx, i) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.015), angularMat("#5a3a1a"));
      brow.position.set(bx, 1.665, 0.13);
      brow.rotation.z = i === 0 ? 0.15 : -0.15; // slight determined angle
      character.add(brow);
    });

    // Nose — angular wedge
    const noseGeo = new THREE.BufferGeometry();
    const ns = 0.015;
    const noseVerts = new Float32Array([
      0, 0, 4*ns,   -2*ns, -3*ns, 2*ns,   2*ns, -3*ns, 2*ns,  // front
      0, 0, 4*ns,    0, 3*ns, 0,          -2*ns, -3*ns, 2*ns,  // left
      0, 0, 4*ns,    0, 3*ns, 0,           2*ns, -3*ns, 2*ns,  // right
    ]);
    noseGeo.setAttribute("position", new THREE.BufferAttribute(noseVerts, 3));
    noseGeo.computeVertexNormals();
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, 1.59, 0.12);
    character.add(nose);

    // Mouth — thin angular line
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.01), angularMat("#a06a4a"));
    mouth.position.set(0, 1.545, 0.13);
    character.add(mouth);
    // Slight smirk (one side higher)
    const smirk = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.008), angularMat("#a06a4a"));
    smirk.position.set(0.025, 1.548, 0.13);
    smirk.rotation.z = 0.2;
    character.add(smirk);

    // ── EARS — pointed angular (elf-like) ──
    [-1, 1].forEach(side => {
      const earGeo = new THREE.BufferGeometry();
      const es = 0.02;
      const earVerts = new Float32Array([
        0, 0, 0,   side * 4*es, 2*es, -es,   side * 2*es, -3*es, 0,
        0, 0, 0,   side * 4*es, 2*es, -es,   side * 3*es, 4*es, -0.5*es,
      ]);
      earGeo.setAttribute("position", new THREE.BufferAttribute(earVerts, 3));
      earGeo.computeVertexNormals();
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(side * 0.14, 1.6, 0.02);
      character.add(ear);
    });

    // ── HAIR — angular tousled chunks ──
    const hairMat = angularMat("#5a3a1a", { roughness: 0.85 });
    const hairDarkMat = angularMat("#3a2210", { roughness: 0.85 });

    // Hair base cap
    const hairBase = new THREE.Mesh(new THREE.SphereGeometry(0.17, 5, 4, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
    hairBase.position.y = 1.68;
    hairBase.castShadow = true;
    character.add(hairBase);

    // Tousled angular hair chunks
    const hairChunks = [
      { x: 0.06, y: 1.78, z: 0.08, rx: -0.4, ry: 0.2, rz: 0.3, sx: 1, sy: 1.4, sz: 0.6 },
      { x: -0.08, y: 1.79, z: 0.06, rx: -0.3, ry: -0.3, rz: -0.2, sx: 1.1, sy: 1.3, sz: 0.5 },
      { x: 0, y: 1.81, z: 0.04, rx: -0.5, ry: 0, rz: 0.1, sx: 0.8, sy: 1.5, sz: 0.6 },
      { x: 0.1, y: 1.75, z: -0.02, rx: -0.1, ry: 0.5, rz: 0.4, sx: 0.9, sy: 1.2, sz: 0.5 },
      { x: -0.1, y: 1.76, z: -0.04, rx: 0, ry: -0.4, rz: -0.3, sx: 1, sy: 1.3, sz: 0.5 },
      // Fringe / bangs
      { x: 0.04, y: 1.72, z: 0.13, rx: -0.8, ry: 0.1, rz: 0.2, sx: 0.7, sy: 1.1, sz: 0.3 },
      { x: -0.05, y: 1.73, z: 0.12, rx: -0.7, ry: -0.2, rz: -0.1, sx: 0.8, sy: 1.2, sz: 0.3 },
      // Side hair
      { x: 0.14, y: 1.65, z: 0.03, rx: 0.1, ry: 0.6, rz: 0.5, sx: 0.5, sy: 0.9, sz: 0.4 },
      { x: -0.14, y: 1.66, z: 0.02, rx: 0.1, ry: -0.5, rz: -0.4, sx: 0.5, sy: 1.0, sz: 0.4 },
      // Back hair
      { x: 0.03, y: 1.68, z: -0.1, rx: 0.5, ry: 0.1, rz: 0.2, sx: 0.9, sy: 1.2, sz: 0.5 },
      { x: -0.04, y: 1.67, z: -0.12, rx: 0.6, ry: -0.2, rz: -0.1, sx: 1, sy: 1.1, sz: 0.4 },
    ];
    hairChunks.forEach((h, i) => {
      const chunk = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.1, 3),
        i % 3 === 0 ? hairDarkMat : hairMat
      );
      chunk.position.set(h.x, h.y, h.z);
      chunk.rotation.set(h.rx, h.ry, h.rz);
      chunk.scale.set(h.sx, h.sy, h.sz);
      chunk.castShadow = true;
      character.add(chunk);
    });

    // ── HEADBAND ──
    const headband = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.015, 4, 12, Math.PI * 1.4),
      angularMat("#e94560", { roughness: 0.4 })
    );
    headband.position.set(0, 1.68, 0.02);
    headband.rotation.x = -0.1;
    headband.rotation.y = Math.PI * 0.3;
    character.add(headband);
    // Headband tail
    const bandTail1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.008), angularMat("#e94560"));
    bandTail1.position.set(-0.12, 1.64, -0.1);
    bandTail1.rotation.z = -0.5;
    bandTail1.rotation.x = 0.3;
    character.add(bandTail1);
    const bandTail2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.008), angularMat("#c73e54"));
    bandTail2.position.set(-0.15, 1.58, -0.12);
    bandTail2.rotation.z = -0.7;
    bandTail2.rotation.x = 0.4;
    character.add(bandTail2);

    // ── BACK ITEM: Design notebook/sketchbook ──
    const notebook = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.04), angularMat("#4a3a2a", { roughness: 0.75 }));
    notebook.position.set(0, 1.05, -0.2);
    notebook.rotation.x = 0.1;
    character.add(notebook);
    // Notebook pages edge
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.23, 0.02), angularMat("#e8e0c8"));
    pages.position.set(0, 1.05, -0.17);
    character.add(pages);
    // Notebook strap
    const nbStrap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.06), angularMat("#5a3a1a"));
    nbStrap.position.set(0, 1.17, -0.2);
    character.add(nbStrap);

    // Position character
    character.position.set(0, 0, 0);
    scene.add(character);

    // ═══════════════════════════════════════════════════════════
    // WORKSHOP PROPS
    // ═══════════════════════════════════════════════════════════

    // Forge / furnace
    const forge = new THREE.Group();
    forge.position.set(-3, 0, -2);

    const forgeBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.2), angularMat("#4a4040", { roughness: 0.95 }));
    forgeBase.position.y = 0.5;
    forgeBase.castShadow = true;
    forge.add(forgeBase);
    // Fire opening
    const fireOpening = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.1), angularMat("#1a0a00"));
    fireOpening.position.set(0, 0.5, 0.61);
    forge.add(fireOpening);
    // Fire glow inside
    const fireGlow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.08), angularMat("#ff4400", { emissive: "#ff2200", emissiveIntensity: 2, roughness: 0.1 }));
    fireGlow.position.set(0, 0.5, 0.55);
    forge.add(fireGlow);
    // Embers
    const emberMat = angularMat("#ff6600", { emissive: "#ff4400", emissiveIntensity: 1.5 });
    for (let i = 0; i < 5; i++) {
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 4, 3), emberMat);
      ember.position.set(-0.15 + Math.random() * 0.3, 0.35 + Math.random() * 0.2, 0.5);
      forge.add(ember);
    }
    // Chimney / hood
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 0.6, 4), angularMat("#3a3535", { roughness: 0.9 }));
    hood.position.y = 1.3;
    hood.rotation.y = Math.PI / 4;
    forge.add(hood);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 4), angularMat("#3a3535"));
    chimney.position.y = 2.35;
    forge.add(chimney);

    scene.add(forge);

    // Workbench
    const bench = new THREE.Group();
    bench.position.set(2.5, 0, -1.5);

    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.9), angularMat("#6a5030", { roughness: 0.85 }));
    benchTop.position.y = 0.9;
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    bench.add(benchTop);
    // Legs
    [[-0.9, -0.35], [0.9, -0.35], [-0.9, 0.35], [0.9, 0.35]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), angularMat("#5a4020"));
      leg.position.set(lx, 0.45, lz);
      bench.add(leg);
    });
    // Tools on bench
    // Caliper
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.06), angularMat("#888", { metalness: 0.7, roughness: 0.3 }));
    caliper.position.set(-0.5, 0.97, 0);
    caliper.rotation.y = 0.3;
    bench.add(caliper);
    // Protractor
    const protractor = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.005, 8, 1, false, 0, Math.PI), angularMat("#c4a040", { metalness: 0.5 }));
    protractor.position.set(0.2, 0.96, 0.1);
    protractor.rotation.x = -Math.PI / 2;
    bench.add(protractor);
    // Sketch paper
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.003, 0.3), angularMat("#e8e0c8"));
    paper.position.set(0.5, 0.955, -0.1);
    paper.rotation.y = -0.1;
    bench.add(paper);
    // Pencils
    for (let pi = 0; pi < 3; pi++) {
      const pencilTool = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), angularMat(["#d4a843", "#e94560", "#4a8a4a"][pi]));
      pencilTool.position.set(0.3 + pi * 0.06, 0.96, 0.2);
      pencilTool.rotation.z = Math.PI / 2;
      pencilTool.rotation.y = 0.2 * pi;
      bench.add(pencilTool);
    }

    scene.add(bench);

    // Anvil
    const anvil = new THREE.Group();
    anvil.position.set(-1, 0, -0.5);
    const anvilBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.3, 5), angularMat("#3a3a3a", { metalness: 0.6, roughness: 0.5 }));
    anvilBase.position.y = 0.15;
    anvilBase.castShadow = true;
    anvil.add(anvilBase);
    const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), angularMat("#4a4a4a", { metalness: 0.7, roughness: 0.4 }));
    anvilTop.position.y = 0.36;
    anvilTop.castShadow = true;
    anvil.add(anvilTop);
    const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), angularMat("#4a4a4a", { metalness: 0.7 }));
    anvilHorn.position.set(0.3, 0.36, 0);
    anvilHorn.rotation.z = -Math.PI / 2;
    anvil.add(anvilHorn);
    scene.add(anvil);

    // Hanging lantern
    const hangLantern = new THREE.Group();
    hangLantern.position.set(0, 3.2, 0);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), angularMat("#3a3a3a", { metalness: 0.6 }));
    chain.position.y = 0.4;
    hangLantern.add(chain);
    const lanternBody = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.25), angularMat("#2a2a2a", { metalness: 0.4 }));
    hangLantern.add(lanternBody);
    const lanternGlass = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), angularMat("#ffaa44", { emissive: "#ff8822", emissiveIntensity: 1.2, transparent: true, opacity: 0.8 }));
    hangLantern.add(lanternGlass);
    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.12, 4), angularMat("#2a2a2a", { metalness: 0.4 }));
    lanternCap.position.y = 0.18;
    lanternCap.rotation.y = Math.PI / 4;
    hangLantern.add(lanternCap);
    scene.add(hangLantern);

    // ═══════════════════════════════════════════════════════════
    // FORGE PARTICLES (fire sparks)
    // ═══════════════════════════════════════════════════════════

    const sparkCount = 30;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkData = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = -3;
      sparkPos[i * 3 + 1] = 0.5;
      sparkPos[i * 3 + 2] = -1.4;
      sparkData.push({ vx: (Math.random() - 0.5) * 0.01, vy: 0.015 + Math.random() * 0.02, vz: 0.005 + Math.random() * 0.01, life: Math.random() });
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({ color: "#ffaa33", size: 0.04, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparks);

    // ═══════════════════════════════════════════════════════════
    // ANIMATION
    // ═══════════════════════════════════════════════════════════

    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;

      // Character idle — breathing + subtle sway
      character.position.y = Math.sin(time * 1.8) * 0.008;
      // Subtle body sway
      character.rotation.z = Math.sin(time * 0.7) * 0.01;

      // Head slight look around
      headMesh.rotation.y = Math.sin(time * 0.4) * 0.08;
      headMesh.rotation.x = Math.sin(time * 0.3) * 0.03;

      // Hair physics (subtle wind)
      hairChunks.forEach((_, i) => {
        const chunk = character.children.find((c, ci) => ci > 30 && ci <= 30 + hairChunks.length && ci - 31 === i);
        if (chunk) {
          chunk.rotation.z += Math.sin(time * 2 + i) * 0.001;
        }
      });

      // Headband tail sway
      bandTail1.rotation.z = -0.5 + Math.sin(time * 2) * 0.15;
      bandTail2.rotation.z = -0.7 + Math.sin(time * 2.3 + 0.5) * 0.2;

      // Camera
      if (autoRotate) {
        dragRef.current.angleY += 0.003;
      }
      const camRadius = 4;
      const camAngle = dragRef.current.angleY;
      camera.position.x = Math.sin(camAngle) * camRadius;
      camera.position.z = Math.cos(camAngle) * camRadius;
      camera.position.y = 2.2 + Math.sin(time * 0.3) * 0.1;
      camera.lookAt(0, 1.2, 0);

      // Forge flicker
      forgeLight.intensity = 3 + Math.sin(time * 8) * 0.4 + Math.sin(time * 13) * 0.3;
      forgeBounce.intensity = 1.2 + Math.sin(time * 10 + 1) * 0.3;
      lanternLight.intensity = 1.5 + Math.sin(time * 6) * 0.15;

      // Fire glow pulse
      fireGlow.material.emissiveIntensity = 2 + Math.sin(time * 6) * 0.5;

      // Sparks
      const sPos = sparkGeo.attributes.position.array;
      for (let i = 0; i < sparkCount; i++) {
        sparkData[i].life += 0.008 + Math.random() * 0.005;
        sPos[i * 3] += sparkData[i].vx + Math.sin(time * 3 + i) * 0.002;
        sPos[i * 3 + 1] += sparkData[i].vy;
        sPos[i * 3 + 2] += sparkData[i].vz;
        if (sparkData[i].life > 1) {
          sPos[i * 3] = -3 + (Math.random() - 0.5) * 0.3;
          sPos[i * 3 + 1] = 0.5 + Math.random() * 0.3;
          sPos[i * 3 + 2] = -1.4;
          sparkData[i].life = 0;
          sparkData[i].vy = 0.015 + Math.random() * 0.02;
          sparkData[i].vx = (Math.random() - 0.5) * 0.01;
          sparkData[i].vz = 0.005 + Math.random() * 0.01;
        }
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = 0.7 + Math.sin(time * 5) * 0.2;

      // Lantern gentle sway
      hangLantern.rotation.x = Math.sin(time * 0.8) * 0.03;
      hangLantern.rotation.z = Math.sin(time * 0.6) * 0.02;

      renderer.render(scene, camera);
    };
    animate();

    // Mouse/touch drag to rotate
    const onPointerDown = (e) => {
      dragRef.current.dragging = true;
      dragRef.current.prevX = e.clientX || e.touches?.[0]?.clientX || 0;
      setAutoRotate(false);
    };
    const onPointerMove = (e) => {
      if (!dragRef.current.dragging) return;
      const x = e.clientX || e.touches?.[0]?.clientX || 0;
      const dx = x - dragRef.current.prevX;
      dragRef.current.angleY += dx * 0.008;
      dragRef.current.prevX = x;
    };
    const onPointerUp = () => { dragRef.current.dragging = false; };

    const el = renderer.domElement;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("touchstart", onPointerDown);
    el.addEventListener("touchmove", onPointerMove);
    el.addEventListener("touchend", onPointerUp);

    const onResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      cancelAnimationFrame(frameRef.current);
      if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [autoRotate, lighting]);

  return (
    <div style={{ height: "100vh", position: "relative", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden", background: "#0a0804" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0, cursor: "grab" }} />

      {/* Title */}
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none", zIndex: 10 }}>
        <div style={{ background: "rgba(10,8,4,0.7)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px 14px", border: "1px solid rgba(255,170,68,0.1)" }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>StudioLoom</div>
          <div style={{ fontSize: 14, color: "#f0e6d3", fontWeight: 300, letterSpacing: 1, marginTop: 2 }}>The Designer</div>
          <div style={{ fontSize: 10, color: "#665530", marginTop: 2, fontStyle: "italic" }}>Workshop — Character Study</div>
        </div>

        <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button onClick={() => setAutoRotate(!autoRotate)} style={{ background: "rgba(10,8,4,0.7)", backdropFilter: "blur(6px)", border: autoRotate ? "1px solid rgba(233,69,96,0.3)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 10px", color: autoRotate ? "#e94560" : "#665530", fontSize: 10, cursor: "pointer" }}>
            {autoRotate ? "⏸ Pause" : "▶ Rotate"}
          </button>
        </div>
      </div>

      {/* Character Info */}
      <div style={{ position: "absolute", bottom: 16, left: 12, right: 12, zIndex: 10, pointerEvents: "none" }}>
        <div style={{ background: "rgba(10,8,4,0.75)", backdropFilter: "blur(10px)", borderRadius: 12, padding: "12px 16px", border: "1px solid rgba(255,170,68,0.08)", maxWidth: 360 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #e94560, #c73e54)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f0e6d3", letterSpacing: 1 }}>Design Hero</div>
              <div style={{ fontSize: 9, color: "#887755" }}>Artisan Belt • Level 12</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#99886a", margin: 0, lineHeight: 1.6 }}>
            Angular low-poly character built entirely from Three.js primitives — no imported models. Faceted geometry with flat shading. Drag to orbit.
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {["Ruler", "Sketchbook", "Pencils", "Design Pouch"].map(item => (
              <span key={item} style={{ fontSize: 8, padding: "3px 6px", borderRadius: 3, background: "rgba(255,170,68,0.08)", color: "#aa8855", fontWeight: 600, letterSpacing: 0.5 }}>{item}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
