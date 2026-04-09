import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

const ang = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, flatShading: true, roughness: opts.roughness || 0.6, metalness: opts.metalness || 0, ...opts,
});

// ── TUTORIAL SCRIPT ──────────────────────────────────────────
const STEPS = [
  {
    id: "intro",
    instruction: "Welcome to the measurement workshop. Today you'll learn to measure Rosa's coffee cup precisely.",
    subtext: "Good measurements lead to good designs. Let's start.",
    action: "continue",
    highlight: null,
    camPos: [2, 2.2, 4],
    camLook: [0, 0.9, -0.5],
  },
  {
    id: "identify",
    instruction: "First, find the calipers on the workbench.",
    subtext: "Calipers measure width with precision down to 0.1mm. Look for the metal tool.",
    action: "click",
    target: "caliper",
    highlight: "caliper",
    camPos: [1.5, 1.5, 2.5],
    camLook: [0.8, 0.95, -1],
  },
  {
    id: "pickup",
    instruction: "Pick up the calipers.",
    subtext: "Tap the calipers to pick them up from the workbench.",
    action: "click",
    target: "caliper",
    highlight: "caliper",
    camPos: [1.2, 1.3, 1.8],
    camLook: [0.8, 0.9, -1],
  },
  {
    id: "learn_parts",
    instruction: "These are digital calipers. The jaws open and close to grip an object.",
    subtext: "The outer jaws measure external dimensions. The display shows the reading.",
    action: "continue",
    highlight: "caliper_held",
    camPos: [0.3, 1.6, 1.5],
    camLook: [0, 1.2, 0],
  },
  {
    id: "find_cup",
    instruction: "Now find Rosa's coffee cup on the counter.",
    subtext: "We need to measure its outer diameter to design a sleeve that fits.",
    action: "click",
    target: "cup",
    highlight: "cup",
    camPos: [-1, 1.4, 1.5],
    camLook: [-1.8, 0.95, -0.5],
  },
  {
    id: "measure_width",
    instruction: "Measure the cup's outer diameter.",
    subtext: "Tap the cup to place the calipers around it. The jaws will grip the widest point.",
    action: "click",
    target: "cup",
    highlight: "cup",
    camPos: [-1.2, 1.3, 1],
    camLook: [-1.8, 0.95, -0.5],
  },
  {
    id: "read_measurement",
    instruction: "Read the measurement: 82.4mm",
    subtext: "The outer diameter of Rosa's standard takeaway cup. Record this in your specification.",
    action: "continue",
    highlight: null,
    camPos: [-1.5, 1.2, 0.6],
    camLook: [-1.8, 1, -0.5],
    measurement: { value: 82.4, unit: "mm", label: "Cup outer diameter" },
  },
  {
    id: "measure_height",
    instruction: "Now measure the cup's height. Tap the cup again.",
    subtext: "We need the height to know how tall the sleeve should be.",
    action: "click",
    target: "cup",
    highlight: "cup",
    camPos: [-1.6, 1.5, 1.2],
    camLook: [-1.8, 0.95, -0.5],
  },
  {
    id: "read_height",
    instruction: "Height: 95.2mm",
    subtext: "Your sleeve doesn't need to cover the full height — just the grip zone. Note this down.",
    action: "continue",
    highlight: null,
    camPos: [-1.3, 1.1, 0.8],
    camLook: [-1.8, 0.95, -0.5],
    measurement: { value: 95.2, unit: "mm", label: "Cup height" },
  },
  {
    id: "measure_wall",
    instruction: "One more — measure the wall thickness. Tap the cup.",
    subtext: "This tells us how much insulation the paper alone provides.",
    action: "click",
    target: "cup",
    highlight: "cup",
    camPos: [-1.4, 1.2, 0.5],
    camLook: [-1.8, 1, -0.5],
  },
  {
    id: "read_wall",
    instruction: "Wall thickness: 0.8mm",
    subtext: "Very thin! No wonder it conducts heat straight to fingers. Your sleeve needs to compensate.",
    action: "continue",
    highlight: null,
    camPos: [-1.3, 1.1, 0.7],
    camLook: [-1.8, 1, -0.5],
    measurement: { value: 0.8, unit: "mm", label: "Wall thickness" },
  },
  {
    id: "rosa_react",
    instruction: "Rosa notices your work.",
    subtext: "",
    action: "continue",
    highlight: null,
    camPos: [0.3, 1.5, 2],
    camLook: [-0.5, 1.3, 0],
    dialogue: { speaker: "Rosa", text: "82.4mm diameter! Nobody's ever measured my cups before. This is how real design starts, isn't it?", mood: "impressed" },
  },
  {
    id: "complete",
    instruction: "Skill Complete: Precision Measurement",
    subtext: "You've recorded three critical measurements for Rosa's sleeve design.",
    action: "finish",
    highlight: null,
    camPos: [2, 2, 3.5],
    camLook: [0, 0.9, -0.5],
  },
];

export default function MeasurementTutorial() {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const sceneObjRef = useRef({});
  const [step, setStep] = useState(-1); // -1 = title
  const [measurements, setMeasurements] = useState([]);
  const [caliperState, setCaliperState] = useState("on_bench"); // on_bench | held | measuring
  const [showSpec, setShowSpec] = useState(false);
  const [completed, setCompleted] = useState(false);
  const camTargetRef = useRef({ px: 2, py: 2.2, pz: 4, lx: 0, ly: 0.9, lz: -0.5 });
  const highlightPulseRef = useRef(0);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // ── SCENE SETUP ────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a1008");
    scene.fog = new THREE.FogExp2("#1a1008", 0.04);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 50);
    camera.position.set(2, 2.2, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    el.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight("#1a1535", 0.35));
    const forge = new THREE.PointLight("#ff6622", 2, 8, 1.5);
    forge.position.set(-3.5, 1.2, -2); forge.castShadow = true; scene.add(forge);
    const fill = new THREE.DirectionalLight("#4466aa", 0.2);
    fill.position.set(4, 5, 3); fill.castShadow = true;
    fill.shadow.mapSize.set(1024, 1024);
    fill.shadow.camera.near = 0.1; fill.shadow.camera.far = 20;
    fill.shadow.camera.left = -6; fill.shadow.camera.right = 6;
    fill.shadow.camera.top = 6; fill.shadow.camera.bottom = -3;
    scene.add(fill);
    const overhead = new THREE.PointLight("#ffaa44", 1.2, 7);
    overhead.position.set(0, 3, 0); scene.add(overhead);

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), ang("#2a2018", { roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    // Walls
    const wallMat = ang("#3a2a1a", { roughness: 0.9 });
    const bWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), wallMat);
    bWall.position.set(0, 2.5, -3); bWall.receiveShadow = true; scene.add(bWall);
    const sWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), wallMat);
    sWall.position.set(-4.5, 2.5, 0); sWall.rotation.y = Math.PI / 2; scene.add(sWall);

    // ── WORKBENCH ──
    const bench = new THREE.Group();
    bench.position.set(1, 0, -1);
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.9), ang("#6a5030", { roughness: 0.8 }));
    benchTop.position.y = 0.88; benchTop.castShadow = true; benchTop.receiveShadow = true; bench.add(benchTop);
    [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.88, 0.07), ang("#5a4020")); leg.position.set(lx, 0.44, lz); bench.add(leg);
    });
    // Cross brace
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2, 0.04, 0.04), ang("#5a4020"));
    brace.position.set(0, 0.3, 0); bench.add(brace);
    scene.add(bench);

    // ── CALIPER (interactive) ──
    const caliperGroup = new THREE.Group();
    caliperGroup.userData = { id: "caliper", interactive: true };
    // Main beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.015, 0.04), ang("#b0b0b0", { metalness: 0.7, roughness: 0.25 }));
    beam.position.y = 0; caliperGroup.add(beam);
    // Scale markings
    for (let m = 0; m < 12; m++) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.008, 0.042), ang("#333", { metalness: 0.5 }));
      mark.position.set(-0.15 + m * 0.027, 0, 0); caliperGroup.add(mark);
    }
    // Fixed jaw
    const jaw1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.04), ang("#a0a0a0", { metalness: 0.7, roughness: 0.25 }));
    jaw1.position.set(-0.17, -0.04, 0); caliperGroup.add(jaw1);
    // Sliding jaw
    const jaw2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.04), ang("#a0a0a0", { metalness: 0.7, roughness: 0.25 }));
    jaw2.position.set(-0.06, -0.04, 0); jaw2.name = "slidingJaw"; caliperGroup.add(jaw2);
    // Display screen
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.01), ang("#111", { roughness: 0.2 }));
    screen.position.set(0.04, 0.018, 0.025); caliperGroup.add(screen);
    // Display value (green glow)
    const display = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.002), ang("#00cc44", { emissive: "#00aa33", emissiveIntensity: 0.8 }));
    display.position.set(0.04, 0.018, 0.032); display.name = "display"; caliperGroup.add(display);
    // Thumb wheel
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.045, 8), ang("#888", { metalness: 0.6 }));
    wheel.position.set(-0.02, -0.01, 0); wheel.rotation.x = Math.PI / 2; caliperGroup.add(wheel);

    caliperGroup.position.set(1.3, 0.94, -1);
    caliperGroup.rotation.y = 0.3;
    scene.add(caliperGroup);

    // ── COUNTER WITH CUPS ──
    const counter = new THREE.Group();
    counter.position.set(-2, 0, -0.5);
    const cTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.5), ang("#6a4a28", { roughness: 0.8 }));
    cTop.position.y = 0.425; cTop.castShadow = true; cTop.receiveShadow = true; counter.add(cTop);
    const cSurface = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 0.6), ang("#7a5a38"));
    cSurface.position.y = 0.87; counter.add(cSurface);
    scene.add(counter);

    // Cups
    const cupGroup = new THREE.Group();
    cupGroup.userData = { id: "cup", interactive: true };
    const cup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.13, 8), ang("#e8e0d0", { roughness: 0.3 }));
    cup1.position.y = 0.065; cup1.castShadow = true; cupGroup.add(cup1);
    // Cup rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.005, 4, 8), ang("#ddd8c8", { roughness: 0.3 }));
    rim.position.y = 0.13; rim.rotation.x = Math.PI / 2; cupGroup.add(rim);
    // Cup sleeve line (showing where sleeve would go)
    const sleeveLine = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.05, 0.06, 8, 1, true), ang("#c4a060", { roughness: 0.5, transparent: true, opacity: 0.3 }));
    sleeveLine.position.y = 0.05; cupGroup.add(sleeveLine);
    cupGroup.position.set(-1.8, 0.9, -0.5);
    scene.add(cupGroup);

    // Extra cups
    [[-2.2, -0.4], [-1.5, -0.55], [-2.4, -0.6]].forEach(([cx, cz]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.12, 6), ang("#e0d8c8", { roughness: 0.35 }));
      c.position.set(cx, 0.96, cz); scene.add(c);
    });

    // ── ROSA ──
    const rosa = new THREE.Group();
    rosa.position.set(-0.5, 0, 0.5);
    rosa.rotation.y = 0.8;
    const rBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 6), ang("#e8a87c")); rBody.position.y = 0.65; rBody.castShadow = true; rosa.add(rBody);
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.55, 6, 1, false, 0, Math.PI), ang("#fff", { roughness: 0.7 })); apron.position.y = 0.58; apron.rotation.y = Math.PI; rosa.add(apron);
    const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 5, 4), ang("#e8a87c")); rHead.position.y = 1.3; rHead.castShadow = true; rosa.add(rHead);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.25, 5), ang("#fff")); hat.position.y = 1.58; rosa.add(hat);
    const hatT = new THREE.Mesh(new THREE.SphereGeometry(0.19, 5, 4), ang("#fff")); hatT.position.y = 1.7; rosa.add(hatT);
    [[-0.08, 1.34, -0.18], [0.08, 1.34, -0.18]].forEach(p => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), ang("#fff")); e.position.set(p[0], p[1], p[2]); rosa.add(e);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), ang("#2a1a0a")); pu.position.set(p[0], p[1], p[2] - 0.02); rosa.add(pu);
    });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; rosa.add(shadow);
    scene.add(rosa);

    // Other bench tools
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.003, 0.25), ang("#e8e0c8")); paper.position.set(0.6, 0.92, -1); scene.add(paper);
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), ang("#d4a843")); pencil.position.set(0.75, 0.93, -0.9); pencil.rotation.z = Math.PI / 2; scene.add(pencil);
    const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.005, 0.03), ang("#c4a040", { metalness: 0.5, roughness: 0.3 })); ruler.position.set(0.4, 0.93, -1.2); ruler.rotation.y = -0.2; scene.add(ruler);

    // Forge
    const forgeBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), ang("#4a4040", { roughness: 0.95 })); forgeBase.position.set(-3.5, 0.5, -2); forgeBase.castShadow = true; scene.add(forgeBase);
    const fireGlow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.08), ang("#ff4400", { emissive: "#ff2200", emissiveIntensity: 2 })); fireGlow.position.set(-3.5, 0.5, -1.39); scene.add(fireGlow);

    // Sparks
    const sparkCount = 12;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVel = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = -3.5; sparkPos[i * 3 + 1] = 0.5; sparkPos[i * 3 + 2] = -1.3;
      sparkVel.push({ vy: 0.01 + Math.random() * 0.012, life: Math.random() });
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    scene.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: "#ffaa33", size: 0.03, transparent: true, opacity: 0.8, sizeAttenuation: true, depthWrite: false })));

    // Highlight ring (reusable)
    const highlightRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.01, 4, 16),
      new THREE.MeshBasicMaterial({ color: "#f0c41b", transparent: true, opacity: 0.6 })
    );
    highlightRing.rotation.x = -Math.PI / 2;
    highlightRing.visible = false;
    scene.add(highlightRing);

    // Store refs
    sceneObjRef.current = { scene, camera, renderer, caliperGroup, cupGroup, rosa, rHead, forge, fireGlow, highlightRing, sparkGeo, sparkVel, sparkPos, jaw2: caliperGroup.getObjectByName("slidingJaw") };

    // Animation
    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;
      highlightPulseRef.current = time;

      // Camera lerp
      const ct = camTargetRef.current;
      camera.position.x += (ct.px - camera.position.x) * 0.04;
      camera.position.y += (ct.py - camera.position.y) * 0.04;
      camera.position.z += (ct.pz - camera.position.z) * 0.04;
      const lookTarget = new THREE.Vector3();
      lookTarget.set(
        camera.position.x + (ct.lx - camera.position.x) * 0.5,
        ct.ly,
        camera.position.z + (ct.lz - camera.position.z) * 0.5
      );
      camera.lookAt(ct.lx, ct.ly, ct.lz);

      // Subtle camera breathing
      camera.position.x += Math.sin(time * 0.4) * 0.005;
      camera.position.y += Math.sin(time * 0.6) * 0.004;

      // Rosa idle
      rosa.position.y = Math.sin(time * 1.5) * 0.005;

      // Forge flicker
      forge.intensity = 2 + Math.sin(time * 8) * 0.3;
      fireGlow.material.emissiveIntensity = 2 + Math.sin(time * 6) * 0.4;

      // Highlight pulse
      if (highlightRing.visible) {
        highlightRing.material.opacity = 0.3 + Math.sin(time * 4) * 0.25;
        highlightRing.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
      }

      // Sparks
      const sp = sparkGeo.attributes.position.array;
      for (let i = 0; i < sparkCount; i++) {
        sparkVel[i].life += 0.007;
        sp[i * 3 + 1] += sparkVel[i].vy;
        sp[i * 3] += Math.sin(time + i) * 0.001;
        if (sparkVel[i].life > 1) { sp[i * 3] = -3.5 + (Math.random() - 0.5) * 0.2; sp[i * 3 + 1] = 0.5; sparkVel[i].life = 0; }
      }
      sparkGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => { camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(el.clientWidth, el.clientHeight); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(frameRef.current); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); renderer.dispose(); };
  }, []);

  // ── STEP MANAGEMENT ────────────────────────────────────────
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    const s = STEPS[step];
    const obj = sceneObjRef.current;
    if (!obj.scene) return;

    // Camera
    if (s.camPos) camTargetRef.current = { px: s.camPos[0], py: s.camPos[1], pz: s.camPos[2], lx: s.camLook[0], ly: s.camLook[1], lz: s.camLook[2] };

    // Highlight
    if (obj.highlightRing) {
      if (s.highlight === "caliper") {
        obj.highlightRing.visible = true;
        obj.highlightRing.position.set(1.3, 0.96, -1);
        obj.highlightRing.scale.setScalar(0.8);
      } else if (s.highlight === "cup") {
        obj.highlightRing.visible = true;
        obj.highlightRing.position.set(-1.8, 0.93, -0.5);
        obj.highlightRing.scale.setScalar(0.6);
      } else if (s.highlight === "caliper_held") {
        obj.highlightRing.visible = false;
      } else {
        obj.highlightRing.visible = false;
      }
    }

    // Caliper state changes
    if (s.id === "pickup" && caliperState === "on_bench") {
      // Will be picked up on click
    }

    // Record measurement
    if (s.measurement) {
      setMeasurements(prev => {
        if (prev.find(m => m.label === s.measurement.label)) return prev;
        return [...prev, s.measurement];
      });
    }
  }, [step, caliperState]);

  const handleAction = useCallback(() => {
    if (step < 0) return;
    const s = STEPS[step];
    const obj = sceneObjRef.current;

    if (s.action === "continue" || s.action === "finish") {
      if (s.action === "finish") {
        setCompleted(true);
        return;
      }
      if (step < STEPS.length - 1) setStep(step + 1);
      return;
    }

    if (s.action === "click") {
      if (s.target === "caliper" && (s.id === "identify" || s.id === "pickup")) {
        if (s.id === "pickup") {
          setCaliperState("held");
          // Move caliper to "held" position
          if (obj.caliperGroup) {
            obj.caliperGroup.position.set(0, 1.5, 0.5);
            obj.caliperGroup.rotation.set(0, 0, 0);
            obj.caliperGroup.scale.setScalar(1.8);
          }
        }
        setStep(step + 1);
      } else if (s.target === "cup") {
        if (s.id === "find_cup") {
          setStep(step + 1);
        } else if (s.id === "measure_width" || s.id === "measure_height" || s.id === "measure_wall") {
          setCaliperState("measuring");
          // Animate caliper to cup
          if (obj.caliperGroup) {
            obj.caliperGroup.position.set(-1.8, 1.05, -0.3);
            obj.caliperGroup.rotation.set(0, Math.PI / 2, 0);
            obj.caliperGroup.scale.setScalar(1.2);
            // Open/close jaws
            const jaw = obj.caliperGroup.getObjectByName("slidingJaw");
            if (jaw) {
              if (s.id === "measure_width") jaw.position.x = 0.02;
              else if (s.id === "measure_height") { obj.caliperGroup.rotation.z = Math.PI / 2; jaw.position.x = 0.05; }
              else { jaw.position.x = -0.14; }
            }
          }
          setStep(step + 1);
        }
      }
    }
  }, [step, caliperState]);

  const currentStep = step >= 0 && step < STEPS.length ? STEPS[step] : null;
  const progress = step >= 0 ? ((step + 1) / STEPS.length) * 100 : 0;

  // ── TITLE SCREEN ───────────────────────────────────────────
  if (step === -1) {
    return (
      <div style={{ height: "100vh", position: "relative", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>
        <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <div style={{ textAlign: "center", maxWidth: 380, padding: 20 }}>
            <div style={{ fontSize: 9, letterSpacing: 5, color: "#e94560", textTransform: "uppercase", marginBottom: 6 }}>Loominary Skill Tutorial</div>
            <h1 style={{ fontSize: 24, fontWeight: 300, color: "#f0e6d3", margin: "0 0 4px", letterSpacing: 2 }}>Precision Measurement</h1>
            <p style={{ fontSize: 14, color: "#d4a843", margin: "0 0 16px", fontStyle: "italic" }}>Using Calipers to Measure Rosa's Cup</p>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14, marginBottom: 20, border: "1px solid rgba(255,255,255,0.06)", textAlign: "left" }}>
              <p style={{ fontSize: 12, color: "#aa9977", margin: "0 0 8px", lineHeight: 1.6 }}>In this tutorial you'll learn to:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {["Identify and pick up measurement tools", "Measure outer diameter, height, and wall thickness", "Record precise specifications for your design brief"].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#887766" }}>
                    <span style={{ color: "#6c8ebf" }}>✦</span> {s}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {["🔍 Inquire", "⏱ 3 min", "🎯 3 measurements"].map(tag => (
                <span key={tag} style={{ fontSize: 9, padding: "4px 8px", borderRadius: 4, background: "rgba(108,142,191,0.15)", color: "#6c8ebf", fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
            <button onClick={() => setStep(0)} style={{ padding: "13px 36px", background: "linear-gradient(135deg, #e94560, #c73e54)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 20px rgba(233,69,96,0.3)" }}>
              Start Tutorial →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── COMPLETED ──────────────────────────────────────────────
  if (completed) {
    return (
      <div style={{ height: "100vh", position: "relative", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>
        <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <div style={{ textAlign: "center", background: "rgba(10,8,4,0.92)", backdropFilter: "blur(12px)", borderRadius: 18, padding: "28px 32px", border: "1px solid rgba(130,179,102,0.2)", maxWidth: 380 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📐</div>
            <h2 style={{ fontSize: 20, fontWeight: 400, color: "#82b366", margin: "0 0 4px", letterSpacing: 1 }}>Skill Unlocked!</h2>
            <p style={{ fontSize: 14, color: "#f0e6d3", margin: "0 0 14px" }}>Precision Measurement</p>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12, marginBottom: 16, border: "1px solid rgba(255,255,255,0.04)", textAlign: "left" }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#554433", textTransform: "uppercase", marginBottom: 8 }}>Recorded Specifications</div>
              {measurements.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: i < measurements.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{m.label}</span>
                  <span style={{ fontSize: 12, color: "#82b366", fontWeight: 700, fontFamily: "monospace" }}>{m.value}{m.unit}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#665544", margin: "0 0 14px", fontStyle: "italic" }}>These measurements have been added to your design specification for "The Hot Cup Problem."</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: "#82b36622", color: "#82b366", fontWeight: 700 }}>+25 XP</span>
              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: "#d4a84322", color: "#d4a843", fontWeight: 700 }}>🏆 Precision Badge</span>
            </div>
            <button onClick={() => { setStep(-1); setCompleted(false); setMeasurements([]); setCaliperState("on_bench"); }}
              style={{ padding: "10px 24px", background: "#82b366", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Continue to Next Task →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── TUTORIAL VIEW ──────────────────────────────────────────
  return (
    <div style={{ height: "100vh", position: "relative", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden", color: "#e8e0d4" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

      {/* Top HUD */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "8px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div>
            <span style={{ fontSize: 9, letterSpacing: 3, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Tutorial</span>
            <span style={{ fontSize: 11, color: "#776655", marginLeft: 8 }}>Precision Measurement</span>
          </div>
          <div style={{ fontSize: 10, color: "#554433" }}>Step {step + 1}/{STEPS.length}</div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #6c8ebf, #82b366)", borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>
      </div>

      {/* Measurements sidebar */}
      {measurements.length > 0 && (
        <div style={{ position: "absolute", top: 50, right: 8, background: "rgba(10,8,4,0.8)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(130,179,102,0.15)", zIndex: 10, minWidth: 130 }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "#554433", textTransform: "uppercase", marginBottom: 6 }}>Spec Sheet</div>
          {measurements.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: "#887766" }}>{m.label}</span>
              <span style={{ fontSize: 10, color: "#82b366", fontWeight: 700, fontFamily: "monospace" }}>{m.value}{m.unit}</span>
            </div>
          ))}
        </div>
      )}

      {/* Instruction Panel */}
      {currentStep && (
        <div onClick={() => {
          if (currentStep.action === "continue" || currentStep.action === "finish") handleAction();
        }}
          style={{ position: "absolute", bottom: 12, left: 10, right: 10, zIndex: 20, maxWidth: 460, margin: "0 auto", cursor: currentStep.action === "continue" || currentStep.action === "finish" ? "pointer" : "default" }}>

          {/* Dialogue overlay (when Rosa speaks) */}
          {currentStep.dialogue && (
            <div style={{ background: "rgba(10,8,4,0.9)", backdropFilter: "blur(10px)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(232,168,124,0.15)", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e8a87c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👩‍🍳</div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e8a87c" }}>{currentStep.dialogue.speaker}</span>
                <span style={{ fontSize: 9, color: "#554433", fontStyle: "italic" }}>({currentStep.dialogue.mood})</span>
              </div>
              <p style={{ fontSize: 13, color: "#f0e6d3", lineHeight: 1.7, margin: 0, fontFamily: "Georgia, serif" }}>"{currentStep.dialogue.text}"</p>
            </div>
          )}

          {/* Main instruction card */}
          <div style={{ background: "rgba(10,8,4,0.92)", backdropFilter: "blur(14px)", borderRadius: 14, padding: "14px 16px", border: currentStep.action === "click" ? "1px solid rgba(240,196,27,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {/* Step indicator */}
              <div style={{ width: 32, height: 32, borderRadius: 8, background: currentStep.action === "click" ? "rgba(240,196,27,0.1)" : "rgba(108,142,191,0.1)", border: currentStep.action === "click" ? "1px solid rgba(240,196,27,0.2)" : "1px solid rgba(108,142,191,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 2 }}>
                {currentStep.action === "click" ? "👆" : currentStep.action === "finish" ? "✅" : "📖"}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#f0e6d3", margin: "0 0 3px", lineHeight: 1.5 }}>
                  {currentStep.instruction}
                </p>
                {currentStep.subtext && (
                  <p style={{ fontSize: 11, color: "#887766", margin: 0, lineHeight: 1.5 }}>{currentStep.subtext}</p>
                )}
              </div>
            </div>

            {/* Measurement result display */}
            {currentStep.measurement && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(130,179,102,0.08)", borderRadius: 8, border: "1px solid rgba(130,179,102,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#aaa" }}>{currentStep.measurement.label}</span>
                <span style={{ fontSize: 18, color: "#82b366", fontWeight: 700, fontFamily: "monospace" }}>{currentStep.measurement.value}<span style={{ fontSize: 11, fontWeight: 400 }}>{currentStep.measurement.unit}</span></span>
              </div>
            )}

            {/* Action hint */}
            <div style={{ marginTop: 8, textAlign: "right" }}>
              {currentStep.action === "click" ? (
                <button onClick={handleAction} style={{ padding: "8px 18px", background: "rgba(240,196,27,0.12)", border: "1px solid rgba(240,196,27,0.2)", borderRadius: 8, color: "#f0c41b", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {currentStep.target === "caliper" ? "👆 Tap Calipers" : "👆 Tap Cup"}
                </button>
              ) : currentStep.action === "finish" ? (
                <button onClick={handleAction} style={{ padding: "8px 18px", background: "#82b366", border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Complete Tutorial ✓
                </button>
              ) : (
                <span style={{ fontSize: 10, color: "#554433" }}>tap to continue ▶</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
