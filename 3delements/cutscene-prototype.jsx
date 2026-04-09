import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as Tone from "tone";

// ── CUTSCENE SCRIPT ──────────────────────────────────────────
const SCRIPT = [
  // [type, duration, camera, lookAt, dialogue, mood, action]
  {
    id: "wide_establish",
    type: "camera",
    duration: 2500,
    cam: [3, 2.5, 5],
    look: [-1, 1, -1],
    dialogue: null,
    action: "idle",
    music: "ambient",
  },
  {
    id: "pan_to_bakery",
    type: "camera",
    duration: 2500,
    cam: [1, 2, 3.5],
    look: [-3, 1.5, -2],
    dialogue: null,
    action: "idle",
    music: "ambient",
  },
  {
    id: "rosa_notice",
    type: "dialogue",
    duration: 0,
    cam: [0.8, 1.7, 2.2],
    look: [-1.2, 1.4, -0.5],
    dialogue: { speaker: "Rosa", text: "Oh! A new face in Designville!", mood: "surprised" },
    action: "rosa_turn",
    sfx: "notice",
  },
  {
    id: "rosa_welcome",
    type: "dialogue",
    duration: 0,
    cam: [-0.5, 1.6, 1.5],
    look: [-1.2, 1.4, -0.5],
    dialogue: { speaker: "Rosa", text: "Come in, come in! I'm Rosa — I run this little bakery. Been here fifteen years now.", mood: "warm" },
    action: "rosa_gesture",
    sfx: "dialogue",
  },
  {
    id: "close_rosa_worried",
    type: "dialogue",
    duration: 0,
    cam: [-0.6, 1.5, 0.8],
    look: [-1.2, 1.45, -0.5],
    dialogue: { speaker: "Rosa", text: "But I have a problem. A real one. My customers keep burning their hands on my takeaway cups.", mood: "worried" },
    action: "rosa_worried",
    sfx: "concern",
    music: "tension",
  },
  {
    id: "pan_to_cups",
    type: "camera",
    duration: 2000,
    cam: [-2.5, 1.2, 0.5],
    look: [-3, 0.9, -1.5],
    dialogue: null,
    action: "idle",
  },
  {
    id: "rosa_explain",
    type: "dialogue",
    duration: 0,
    cam: [-1.8, 1.4, 1.2],
    look: [-1.2, 1.4, -0.5],
    dialogue: { speaker: "Rosa", text: "See those cups? Paper thin. No insulation. Old Mr. Tanaka — he's been coming here every morning for years...", mood: "sad" },
    action: "rosa_look_down",
    sfx: "dialogue",
  },
  {
    id: "rosa_tanaka",
    type: "dialogue",
    duration: 0,
    cam: [-0.8, 1.55, 1],
    look: [-1.2, 1.45, -0.5],
    dialogue: { speaker: "Rosa", text: "He winces every time he picks up the cup. Too proud to complain. But I see it. Every single morning.", mood: "pained" },
    action: "rosa_touch_face",
    sfx: "emotional",
  },
  {
    id: "over_shoulder_player",
    type: "dialogue",
    duration: 0,
    cam: [0.3, 1.8, 1.8],
    look: [-1.2, 1.3, -0.5],
    dialogue: { speaker: "Rosa", text: "The school teachers rush in before class — carrying cups across the road with one hand, papers in the other. It's a disaster waiting to happen.", mood: "concerned" },
    action: "rosa_gesture_wide",
    sfx: "dialogue",
  },
  {
    id: "rosa_determined",
    type: "dialogue",
    duration: 0,
    cam: [-0.4, 1.5, 0.6],
    look: [-1.2, 1.5, -0.5],
    dialogue: { speaker: "Rosa", text: "I need someone to design a better cup sleeve. Eco-friendly — I refuse to add more waste to this world.", mood: "determined" },
    action: "rosa_fist",
    sfx: "determination",
    music: "hopeful",
  },
  {
    id: "two_shot",
    type: "dialogue",
    duration: 0,
    cam: [1.5, 1.6, 2.5],
    look: [-0.3, 1.3, 0],
    dialogue: { speaker: "Rosa", text: "You... you look like someone who solves problems. Am I wrong?", mood: "hopeful" },
    action: "rosa_lean_forward",
    sfx: "hope",
  },
  {
    id: "quest_offer",
    type: "quest",
    duration: 0,
    cam: [0.5, 1.8, 2.8],
    look: [-0.5, 1.2, 0],
    dialogue: null,
    action: "rosa_waiting",
    sfx: "quest_chime",
    music: "quest",
  },
];

export default function CutscenePrototype() {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const sceneRef = useRef({});
  const [step, setStep] = useState(-1); // -1 = title screen
  const [questAccepted, setQuestAccepted] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const stepRef = useRef(-1);
  const camTargetRef = useRef({ x: 3, y: 2.5, z: 5, lx: -1, ly: 1, lz: -1 });
  const camCurrentRef = useRef({ x: 3, y: 2.5, z: 5, lx: -1, ly: 1, lz: -1 });
  const transitionRef = useRef({ active: false, startTime: 0, duration: 0 });
  const synthsRef = useRef({});
  const sequenceRef = useRef(null);

  // ── AUDIO SETUP ────────────────────────────────────────────
  const initAudio = useCallback(async () => {
    if (audioStarted) return;
    await Tone.start();
    setAudioStarted(true);

    // Ambient synth pad
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 1, sustain: 0.6, release: 3 },
      volume: -18,
    }).toDestination();

    // Melody synth
    const melody = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1 },
      volume: -14,
    }).toDestination();

    // SFX synth
    const sfx = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 },
      volume: -10,
    }).toDestination();

    // Pluck for quest chime
    const pluck = new Tone.PluckSynth({ volume: -8 }).toDestination();

    // Reverb
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.4 }).toDestination();
    pad.connect(reverb);
    melody.connect(reverb);

    synthsRef.current = { pad, melody, sfx, pluck };

    // Start ambient pad
    pad.triggerAttack(["C3", "E3", "G3"], Tone.now());
  }, [audioStarted]);

  const playSFX = useCallback((type) => {
    const { sfx, pluck, melody, pad } = synthsRef.current;
    if (!sfx) return;
    const now = Tone.now();

    switch (type) {
      case "notice":
        sfx.triggerAttackRelease("G5", "16n", now);
        sfx.triggerAttackRelease("C6", "16n", now + 0.1);
        break;
      case "dialogue":
        sfx.triggerAttackRelease("E5", "32n", now);
        break;
      case "concern":
        melody.triggerAttackRelease("D4", "4n", now);
        melody.triggerAttackRelease("Bb3", "4n", now + 0.4);
        break;
      case "emotional":
        melody.triggerAttackRelease("G3", "2n", now);
        melody.triggerAttackRelease("Eb4", "4n", now + 0.6);
        break;
      case "determination":
        melody.triggerAttackRelease("C4", "8n", now);
        melody.triggerAttackRelease("E4", "8n", now + 0.15);
        melody.triggerAttackRelease("G4", "8n", now + 0.3);
        break;
      case "hope":
        melody.triggerAttackRelease("E4", "4n", now);
        melody.triggerAttackRelease("G4", "4n", now + 0.3);
        break;
      case "quest_chime":
        pluck.triggerAttack("C5", now);
        pluck.triggerAttack("E5", now + 0.15);
        pluck.triggerAttack("G5", now + 0.3);
        pluck.triggerAttack("C6", now + 0.45);
        break;
      case "quest_accept":
        pluck.triggerAttack("G4", now);
        pluck.triggerAttack("C5", now + 0.12);
        pluck.triggerAttack("E5", now + 0.24);
        pluck.triggerAttack("G5", now + 0.36);
        pluck.triggerAttack("C6", now + 0.48);
        melody.triggerAttackRelease("C5", "2n", now + 0.6);
        break;
    }
  }, []);

  const changeMood = useCallback((mood) => {
    const { pad } = synthsRef.current;
    if (!pad) return;
    const now = Tone.now();
    pad.releaseAll(now);

    setTimeout(() => {
      switch (mood) {
        case "tension":
          pad.triggerAttack(["D3", "F3", "Ab3"], Tone.now());
          break;
        case "hopeful":
          pad.triggerAttack(["C3", "E3", "A3"], Tone.now());
          break;
        case "quest":
          pad.triggerAttack(["G3", "B3", "D4"], Tone.now());
          break;
        case "triumph":
          pad.triggerAttack(["C3", "E3", "G3", "C4"], Tone.now());
          break;
        default:
          pad.triggerAttack(["C3", "E3", "G3"], Tone.now());
      }
    }, 500);
  }, []);

  // ── 3D SCENE ───────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a1008");
    scene.fog = new THREE.FogExp2("#1a1008", 0.045);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 80);
    camera.position.set(3, 2.5, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight("#1a1535", 0.35));
    const forgeLight = new THREE.PointLight("#ff6622", 3, 10, 1.5);
    forgeLight.position.set(-3.5, 1.2, -2);
    forgeLight.castShadow = true;
    scene.add(forgeLight);
    const forgeBounce = new THREE.PointLight("#ff4400", 1, 5);
    forgeBounce.position.set(-3, 0.3, -1.5);
    scene.add(forgeBounce);
    const windowLight = new THREE.DirectionalLight("#4466aa", 0.2);
    windowLight.position.set(5, 6, 3);
    windowLight.castShadow = true;
    windowLight.shadow.mapSize.set(1024, 1024);
    windowLight.shadow.camera.near = 0.1; windowLight.shadow.camera.far = 20;
    windowLight.shadow.camera.left = -6; windowLight.shadow.camera.right = 6;
    windowLight.shadow.camera.top = 6; windowLight.shadow.camera.bottom = -3;
    scene.add(windowLight);
    const lanternLight = new THREE.PointLight("#ffaa44", 1.5, 8, 2);
    lanternLight.position.set(0, 3.5, 0);
    scene.add(lanternLight);
    const rimLight = new THREE.SpotLight("#5588cc", 0.6, 12, Math.PI / 6, 0.5);
    rimLight.position.set(-1, 4, -3);
    rimLight.target.position.set(0, 1, 0);
    scene.add(rimLight); scene.add(rimLight.target);

    const angMat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: opts.roughness || 0.6, metalness: opts.metalness || 0, ...opts });

    // Floor
    const floorC = document.createElement("canvas"); floorC.width = 512; floorC.height = 512;
    const fc = floorC.getContext("2d"); fc.fillStyle = "#2a2018"; fc.fillRect(0, 0, 512, 512);
    for (let p = 0; p < 8; p++) { fc.fillStyle = `rgb(${35 + Math.random() * 12}, ${28 + Math.random() * 10}, ${20 + Math.random() * 8})`; fc.fillRect(0, p * 64 + 1, 512, 62); }
    const floorTex = new THREE.CanvasTexture(floorC); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    // Walls
    const wallMat = angMat("#3a2a1a", { roughness: 0.9 });
    const bWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), wallMat); bWall.position.set(0, 2.5, -3.5); bWall.receiveShadow = true; scene.add(bWall);
    const sWall = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), wallMat); sWall.position.set(-5, 2.5, 0); sWall.rotation.y = Math.PI / 2; scene.add(sWall);

    // ── ROSA ──
    const rosa = new THREE.Group();
    rosa.position.set(-1.2, 0, -0.5);

    const rBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 6), angMat("#e8a87c")); rBody.position.y = 0.65; rBody.castShadow = true; rosa.add(rBody);
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.55, 6, 1, false, 0, Math.PI), angMat("#fff", { roughness: 0.7 })); apron.position.y = 0.58; apron.rotation.y = Math.PI; rosa.add(apron);
    const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 5, 4), angMat("#e8a87c")); rHead.position.y = 1.3; rHead.castShadow = true; rosa.add(rHead);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.28, 5), angMat("#fff", { roughness: 0.4 })); hat.position.y = 1.58; rosa.add(hat);
    const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 5, 4), angMat("#fff", { roughness: 0.4 })); hatTop.position.y = 1.72; rosa.add(hatTop);

    // Eyes
    [[-0.08, 1.34, -0.18], [0.08, 1.34, -0.18]].forEach(p => {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), angMat("#fff"));
      eyeW.position.set(p[0], p[1], p[2]);
      rosa.add(eyeW);
      const eyeP = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 3), angMat("#3a2210"));
      eyeP.position.set(p[0], p[1], p[2] - 0.025);
      rosa.add(eyeP);
    });
    // Brows
    [[-0.08, 1.37], [0.08, 1.37]].forEach(([bx, by], i) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.015), angMat("#6a4020"));
      brow.position.set(bx, by, -0.16); brow.rotation.z = i === 0 ? 0.1 : -0.1;
      rosa.add(brow);
    });
    const rMouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.01), angMat("#b06a4a")); rMouth.position.set(0, 1.27, -0.19); rosa.add(rMouth);

    // Arms
    [-1, 1].forEach(side => {
      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 5), angMat("#e8a87c"));
      upperArm.position.set(side * 0.28, 1.1, 0); upperArm.rotation.z = side * 0.2; upperArm.castShadow = true;
      upperArm.name = side === -1 ? "rosaArmL" : "rosaArmR";
      rosa.add(upperArm);
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 5), angMat("#e8a87c"));
      forearm.position.set(side * 0.32, 0.88, 0.05);
      forearm.name = side === -1 ? "rosaForearmL" : "rosaForearmR";
      rosa.add(forearm);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.07), angMat("#e8a87c"));
      hand.position.set(side * 0.33, 0.74, 0.07);
      hand.name = side === -1 ? "rosaHandL" : "rosaHandR";
      rosa.add(hand);
    });

    const rShadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.2 }));
    rShadow.rotation.x = -Math.PI / 2; rShadow.position.y = 0.02; rosa.add(rShadow);
    rosa.rotation.y = 0.5; // initially facing away
    scene.add(rosa);

    // ── PLAYER ──
    const player = new THREE.Group();
    player.position.set(0.8, 0, 1.5);
    const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.85, 6), angMat("#e94560")); pBody.position.y = 0.625; pBody.castShadow = true; player.add(pBody);
    const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 5, 4), angMat("#d4a87c")); pHead.position.y = 1.25; pHead.castShadow = true; player.add(pHead);
    // Headband
    const hband = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 3, 10, Math.PI * 1.4), angMat("#e94560")); hband.position.set(0, 1.33, 0.02); hband.rotation.y = Math.PI * 0.3; player.add(hband);
    // Hair chunks
    [{ x: 0.05, y: 1.42, z: 0.06, ry: 0.2 }, { x: -0.06, y: 1.43, z: 0.04, ry: -0.3 }, { x: 0, y: 1.45, z: -0.02, ry: 0.1 }].forEach(h => {
      const chunk = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 3), angMat("#5a3a1a", { roughness: 0.85 }));
      chunk.position.set(h.x, h.y, h.z); chunk.rotation.set(-0.4, h.ry, 0.2); chunk.scale.set(1, 1.3, 0.6);
      player.add(chunk);
    });
    [[-0.07, 1.28, -0.16], [0.07, 1.28, -0.16]].forEach(p => {
      const pEyeW = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), angMat("#fff"));
      pEyeW.position.set(p[0], p[1], p[2]);
      player.add(pEyeW);
      const pEyeP = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), angMat("#1a1a2e"));
      pEyeP.position.set(p[0], p[1], p[2] - 0.025);
      player.add(pEyeP);
    });
    // Boots
    [-0.12, 0.12].forEach(side => {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.24), angMat("#3a2a1a")); boot.position.set(side, 0.05, 0.02); player.add(boot);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.3, 5), angMat("#3a2a1a")); shaft.position.set(side, 0.18, 0); player.add(shaft);
    });
    const pShadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.2 }));
    pShadow.rotation.x = -Math.PI / 2; pShadow.position.y = 0.02; player.add(pShadow);
    player.rotation.y = Math.PI + 0.3;
    scene.add(player);

    // ── PROPS ──
    // Counter/bar
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.9, 0.6), angMat("#6a4a28", { roughness: 0.8 }));
    counter.position.set(-2.5, 0.45, -0.5); counter.castShadow = true; counter.receiveShadow = true; scene.add(counter);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.7), angMat("#7a5a38")); counterTop.position.set(-2.5, 0.91, -0.5); scene.add(counterTop);

    // Cups on counter (the problem!)
    const cupMat = angMat("#e8e0d0", { roughness: 0.4 });
    const cups = [];
    [[-3.2, 0.95, -0.4], [-2.8, 0.95, -0.6], [-2.4, 0.95, -0.3], [-2, 0.95, -0.5]].forEach(([cx, cy, cz]) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 6), cupMat);
      cup.position.set(cx, cy + 0.07, cz); cup.castShadow = true; scene.add(cup); cups.push(cup);
      // Steam
      const steamGeo = new THREE.BufferGeometry();
      const steamPos = new Float32Array([cx, cy + 0.18, cz, cx + 0.02, cy + 0.25, cz, cx - 0.01, cy + 0.32, cz + 0.01]);
      steamGeo.setAttribute("position", new THREE.BufferAttribute(steamPos, 3));
      const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ color: "#fff", size: 0.025, transparent: true, opacity: 0.25, sizeAttenuation: true }));
      scene.add(steam); cups.push(steam);
    });

    // Forge
    const forgeBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.2), angMat("#4a4040", { roughness: 0.95 }));
    forgeBase.position.set(-3.5, 0.6, -2); forgeBase.castShadow = true; scene.add(forgeBase);
    const fireGlow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.1), angMat("#ff4400", { emissive: "#ff2200", emissiveIntensity: 2 }));
    fireGlow.position.set(-3.5, 0.6, -1.39); scene.add(fireGlow);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 0.6, 4), angMat("#3a3535", { roughness: 0.9 }));
    hood.position.set(-3.5, 1.5, -2); hood.rotation.y = Math.PI / 4; scene.add(hood);
    const chimneyM = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 4), angMat("#3a3535"));
    chimneyM.position.set(-3.5, 2.55, -2); scene.add(chimneyM);

    // Shelves on back wall
    [-1, 0.5, 2].forEach(sx => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.3), angMat("#5a4028"));
      shelf.position.set(sx, 2, -3.4); scene.add(shelf);
      // Items on shelf
      for (let i = 0; i < 3; i++) {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 5), angMat(["#8a6a40", "#6a8a6a", "#8a6060"][i], { roughness: 0.3 }));
        jar.position.set(sx - 0.3 + i * 0.3, 2.1, -3.35); scene.add(jar);
      }
    });

    // Hanging lantern
    const hLantern = new THREE.Group(); hLantern.position.set(0, 3.2, 0);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 3), angMat("#3a3a3a", { metalness: 0.5 })); chain.position.y = 0.4; hLantern.add(chain);
    const lBody = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.25), angMat("#2a2a2a", { metalness: 0.4 })); hLantern.add(lBody);
    const lGlass = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), angMat("#ffaa44", { emissive: "#ff8822", emissiveIntensity: 1.2, transparent: true, opacity: 0.8 })); hLantern.add(lGlass);
    scene.add(hLantern);

    // Spark particles
    const sparkCount = 25;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVel = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = -3.5; sparkPos[i * 3 + 1] = 0.6; sparkPos[i * 3 + 2] = -1.3;
      sparkVel.push({ vx: (Math.random() - 0.5) * 0.008, vy: 0.012 + Math.random() * 0.015, vz: 0.004 + Math.random() * 0.008, life: Math.random() });
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat2 = new THREE.PointsMaterial({ color: "#ffaa33", size: 0.035, transparent: true, opacity: 0.85, sizeAttenuation: true, depthWrite: false });
    scene.add(new THREE.Points(sparkGeo, sparkMat2));

    // Store refs
    sceneRef.current = { scene, camera, renderer, rosa, player, rHead, rMouth, forgeLight, forgeBounce, lanternLight, fireGlow, hLantern, sparkGeo, sparkVel, sparkPos, cups };

    // ── ANIMATION ──
    let time = 0;
    const lookTarget = new THREE.Vector3();

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;
      const s = stepRef.current;

      // Camera interpolation
      const ct = camCurrentRef.current;
      const tt = camTargetRef.current;
      const lerpSpeed = 0.03;
      ct.x += (tt.x - ct.x) * lerpSpeed;
      ct.y += (tt.y - ct.y) * lerpSpeed;
      ct.z += (tt.z - ct.z) * lerpSpeed;
      ct.lx += (tt.lx - ct.lx) * lerpSpeed;
      ct.ly += (tt.ly - ct.ly) * lerpSpeed;
      ct.lz += (tt.lz - ct.lz) * lerpSpeed;

      // Subtle camera breath
      camera.position.set(
        ct.x + Math.sin(time * 0.5) * 0.02,
        ct.y + Math.sin(time * 0.7) * 0.015,
        ct.z + Math.cos(time * 0.4) * 0.01
      );
      lookTarget.set(ct.lx, ct.ly, ct.lz);
      camera.lookAt(lookTarget);

      // Rosa idle
      rosa.position.y = Math.sin(time * 1.5) * 0.006;

      // Rosa expression based on current step
      if (s >= 2) { // After she notices you
        // Smoothly turn to face player
        const targetRot = -0.3;
        rosa.rotation.y += (targetRot - rosa.rotation.y) * 0.04;
      }

      // Arm gestures
      const armL = rosa.getObjectByName("rosaArmL");
      const armR = rosa.getObjectByName("rosaArmR");
      const forearmL = rosa.getObjectByName("rosaForearmL");
      const forearmR = rosa.getObjectByName("rosaForearmR");
      const handL = rosa.getObjectByName("rosaHandL");
      const handR = rosa.getObjectByName("rosaHandR");

      if (armL && armR) {
        // Default idle
        let lTarget = 0.2, rTarget = -0.2;
        let lForeY = 0.88, rForeY = 0.88;
        let lHandY = 0.74, rHandY = 0.74;

        if (s === 3 || s === 8) { // gesture - arms out
          lTarget = 0.6; rTarget = -0.6;
          lForeY = 0.95; rForeY = 0.95;
        } else if (s === 4) { // worried - hands closer
          lTarget = 0.4; rTarget = -0.4;
          lForeY = 1; rForeY = 1;
          lHandY = 0.85; rHandY = 0.85;
        } else if (s === 7) { // touch face
          rTarget = -0.8;
          rForeY = 1.15;
          rHandY = 1.1;
        } else if (s === 9) { // determined fist
          lTarget = 0.5;
          lForeY = 1.05;
          lHandY = 0.95;
        } else if (s === 10) { // lean forward
          rosa.rotation.x += (-0.05 - rosa.rotation.x) * 0.03;
        }

        armL.rotation.z += (lTarget - armL.rotation.z) * 0.04;
        armR.rotation.z += (rTarget - armR.rotation.z) * 0.04;
        if (forearmL) forearmL.position.y += (lForeY - forearmL.position.y) * 0.04;
        if (forearmR) forearmR.position.y += (rForeY - forearmR.position.y) * 0.04;
        if (handL) handL.position.y += (lHandY - handL.position.y) * 0.04;
        if (handR) handR.position.y += (rHandY - handR.position.y) * 0.04;
      }

      // Eyebrow expression
      rosa.children.forEach(child => {
        if (child.geometry?.type === "BoxGeometry" && child.position.y > 1.36 && child.position.y < 1.38) {
          if (s >= 4 && s <= 7) {
            child.rotation.z += ((child.position.x > 0 ? 0.2 : -0.2) - child.rotation.z) * 0.03;
          } else if (s >= 9) {
            child.rotation.z += ((child.position.x > 0 ? -0.15 : 0.15) - child.rotation.z) * 0.03;
          }
        }
      });

      // Mouth shape
      if (rMouth) {
        if (s >= 4 && s <= 7) {
          rMouth.scale.y += (2 - rMouth.scale.y) * 0.05; // open/worried
        } else if (s >= 9) {
          rMouth.scale.x += (1.3 - rMouth.scale.x) * 0.05; // slight smile
        } else {
          rMouth.scale.y += (1 - rMouth.scale.y) * 0.05;
          rMouth.scale.x += (1 - rMouth.scale.x) * 0.05;
        }
      }

      // Player head subtle reaction
      if (s >= 2) {
        const pHead2 = player.children[1]; // head
        if (pHead2) {
          pHead2.rotation.y = Math.sin(time * 0.3) * 0.05;
          if (s >= 4) pHead2.rotation.x = 0.05; // slight nod
        }
      }

      // Forge flicker
      forgeLight.intensity = 3 + Math.sin(time * 8) * 0.4 + Math.sin(time * 13) * 0.25;
      forgeBounce.intensity = 1 + Math.sin(time * 10) * 0.25;
      lanternLight.intensity = 1.5 + Math.sin(time * 6) * 0.12;
      fireGlow.material.emissiveIntensity = 2 + Math.sin(time * 6) * 0.4;
      hLantern.rotation.x = Math.sin(time * 0.8) * 0.02;

      // Sparks
      const sp = sparkGeo.attributes.position.array;
      for (let i = 0; i < sparkCount; i++) {
        sparkVel[i].life += 0.006;
        sp[i * 3] += sparkVel[i].vx; sp[i * 3 + 1] += sparkVel[i].vy; sp[i * 3 + 2] += sparkVel[i].vz;
        if (sparkVel[i].life > 1) {
          sp[i * 3] = -3.5 + (Math.random() - 0.5) * 0.3;
          sp[i * 3 + 1] = 0.6; sp[i * 3 + 2] = -1.3;
          sparkVel[i].life = 0; sparkVel[i].vy = 0.012 + Math.random() * 0.015;
        }
      }
      sparkGeo.attributes.position.needsUpdate = true;

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

  // ── STEP PROGRESSION ───────────────────────────────────────
  const advanceStep = useCallback(() => {
    const nextStep = step + 1;
    if (nextStep >= SCRIPT.length) return;

    const s = SCRIPT[nextStep];
    setStep(nextStep);
    stepRef.current = nextStep;

    // Camera target
    if (s.cam) {
      camTargetRef.current.x = s.cam[0];
      camTargetRef.current.y = s.cam[1];
      camTargetRef.current.z = s.cam[2];
    }
    if (s.look) {
      camTargetRef.current.lx = s.look[0];
      camTargetRef.current.ly = s.look[1];
      camTargetRef.current.lz = s.look[2];
    }

    // SFX
    if (s.sfx) playSFX(s.sfx);

    // Music mood
    if (s.music) changeMood(s.music);

    // Auto-advance for camera-only steps
    if (s.type === "camera" && s.duration > 0) {
      setTimeout(() => advanceStep(), s.duration);
    }
  }, [step, playSFX, changeMood]);

  const startCutscene = useCallback(async () => {
    await initAudio();
    setShowSkip(true);
    advanceStep();
  }, [initAudio, advanceStep]);

  const acceptQuest = useCallback(() => {
    setQuestAccepted(true);
    playSFX("quest_accept");
    changeMood("triumph");
  }, [playSFX, changeMood]);

  const currentScript = step >= 0 && step < SCRIPT.length ? SCRIPT[step] : null;

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", position: "relative", fontFamily: "'Georgia', serif", overflow: "hidden", background: "#0a0804" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

      {/* Cinematic bars */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: step >= 0 ? 40 : 0, background: "#000", transition: "height 1s ease", zIndex: 15 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: step >= 0 ? 40 : 0, background: "#000", transition: "height 1s ease", zIndex: 15 }} />

      {/* Title Screen */}
      {step === -1 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 20, background: "rgba(0,0,0,0.5)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: 6, color: "#e94560", textTransform: "uppercase", marginBottom: 6 }}>StudioLoom</div>
            <h1 style={{ fontSize: 26, fontWeight: 300, color: "#f0e6d3", margin: "0 0 4px", letterSpacing: 3 }}>The Hot Cup Problem</h1>
            <p style={{ fontSize: 12, color: "#665530", fontStyle: "italic", margin: "0 0 28px" }}>A Design Quest — Cinematic Prototype</p>
            <button onClick={startCutscene} style={{ padding: "14px 40px", background: "linear-gradient(135deg, #e94560, #c73e54)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 20px rgba(233,69,96,0.3)" }}>
              ▶ Play Cutscene
            </button>
            <p style={{ fontSize: 10, color: "#443322", marginTop: 14 }}>Best with sound on</p>
          </div>
        </div>
      )}

      {/* Skip button */}
      {showSkip && !questAccepted && step < SCRIPT.length - 1 && (
        <button onClick={() => { setStep(SCRIPT.length - 1); stepRef.current = SCRIPT.length - 1; const s = SCRIPT[SCRIPT.length - 1]; camTargetRef.current = { x: s.cam[0], y: s.cam[1], z: s.cam[2], lx: s.look[0], ly: s.look[1], lz: s.look[2] }; playSFX("quest_chime"); changeMood("quest"); }}
          style={{ position: "absolute", top: 50, right: 12, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 12px", color: "#665530", fontSize: 10, cursor: "pointer", zIndex: 25, letterSpacing: 1 }}>
          SKIP ▸▸
        </button>
      )}

      {/* Dialogue Box */}
      {currentScript?.dialogue && !questAccepted && (
        <div onClick={advanceStep} style={{ position: "absolute", bottom: 50, left: 12, right: 12, zIndex: 30, maxWidth: 480, margin: "0 auto", cursor: "pointer" }}>
          <div style={{ background: "rgba(10,8,4,0.92)", backdropFilter: "blur(14px)", borderRadius: 14, padding: "14px 18px", border: `1px solid rgba(232,168,124,0.15)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #e8a87c, #c4886a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👩‍🍳</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e8a87c" }}>{currentScript.dialogue.speaker}</div>
                <div style={{ fontSize: 9, color: "#665530", fontStyle: "italic" }}>{currentScript.dialogue.mood}</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#f0e6d3", lineHeight: 1.8, margin: "0 0 6px" }}>
              "{currentScript.dialogue.text}"
            </p>
            <div style={{ textAlign: "right", fontSize: 10, color: "#443322" }}>tap to continue ▶</div>
          </div>
        </div>
      )}

      {/* Quest Offer */}
      {currentScript?.type === "quest" && !questAccepted && (
        <div style={{ position: "absolute", bottom: 50, left: 12, right: 12, zIndex: 30, maxWidth: 420, margin: "0 auto" }}>
          <div style={{ background: "rgba(10,8,4,0.95)", backdropFilter: "blur(14px)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(240,196,27,0.2)" }}>
            <div style={{ padding: "14px 18px", background: "rgba(240,196,27,0.05)", borderBottom: "1px solid rgba(240,196,27,0.1)" }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#f0c41b", fontWeight: 700, textTransform: "uppercase" }}>Quest Available</div>
              <h3 style={{ fontSize: 17, color: "#f0e6d3", margin: "6px 0 3px", fontWeight: 600 }}>The Hot Cup Problem</h3>
              <p style={{ fontSize: 11, color: "#887755", margin: 0 }}>Design an eco-friendly insulating sleeve for Rosa's takeaway cups</p>
            </div>
            <div style={{ padding: "10px 18px 16px" }}>
              <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
                {[["🔍", "Inquire", "#6c8ebf"], ["✏️", "Develop", "#d4a843"], ["🔨", "Create", "#82b366"], ["📊", "Evaluate", "#b85450"]].map(([icon, name, color]) => (
                  <span key={name} style={{ fontSize: 8, padding: "3px 7px", borderRadius: 4, background: color + "22", color, fontWeight: 700, letterSpacing: 0.5 }}>{icon} {name}</span>
                ))}
              </div>
              <button onClick={acceptQuest} style={{ width: "100%", padding: "12px 0", background: "linear-gradient(135deg, #e94560, #c73e54)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 16px rgba(233,69,96,0.3)" }}>
                Accept Quest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quest Accepted Celebration */}
      {questAccepted && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, background: "rgba(0,0,0,0.3)", animation: "fadeIn 0.5s ease" }}>
          <div style={{ textAlign: "center", background: "rgba(10,8,4,0.9)", backdropFilter: "blur(14px)", borderRadius: 18, padding: "28px 36px", border: "1px solid rgba(240,196,27,0.15)", maxWidth: 360 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚔️</div>
            <h2 style={{ fontSize: 20, fontWeight: 400, color: "#f0c41b", margin: "0 0 4px", letterSpacing: 2 }}>Quest Accepted</h2>
            <p style={{ fontSize: 16, color: "#f0e6d3", margin: "0 0 12px", fontWeight: 300 }}>The Hot Cup Problem</p>
            <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 16 }}>
              {[["🔍", "Inquire", "#6c8ebf"], ["✏️", "Develop", "#d4a843"], ["🔨", "Create", "#82b366"], ["📊", "Evaluate", "#b85450"]].map(([icon, name, color]) => (
                <span key={name} style={{ fontSize: 9, padding: "4px 8px", borderRadius: 4, background: color + "22", color, fontWeight: 700 }}>{icon} {name}</span>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#665530", margin: 0, fontStyle: "italic" }}>Rosa is counting on you. Begin the Design Cycle.</p>
          </div>
        </div>
      )}

      {/* Audio indicator */}
      {audioStarted && step >= 0 && !questAccepted && (
        <div style={{ position: "absolute", bottom: 50, left: 12, zIndex: 20 }}>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 14 }}>
            {[3, 5, 4, 6, 3].map((h, i) => (
              <div key={i} style={{ width: 2, height: h + Math.sin(Date.now() * 0.005 + i) * 2, background: "#e94560", borderRadius: 1, opacity: 0.6, transition: "height 0.1s" }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
