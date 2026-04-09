import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const ang = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, flatShading: true, roughness: opts.roughness || 0.6, metalness: opts.metalness || 0, ...opts,
});

// ── STEP DATA ────────────────────────────────────────────────
const GUIDE_STEPS = [
  {
    title: "Parts Overview",
    desc: "Gather your components: a micro:bit, a PIR motion sensor module, and three jumper wires (red, black, yellow).",
    cam: [4, 4, 5],
    look: [0, 0.3, 0],
    callouts: [
      { text: "micro:bit", x: -1.2, y: 2.2 },
      { text: "PIR Sensor", x: 1.5, y: 2.2 },
      { text: "Jumper Wires", x: 0, y: -0.2 },
    ],
    wires: [],
    highlight: null,
  },
  {
    title: "Connect Power (VCC → 3V)",
    desc: "Take the RED jumper wire. Connect one end to the VCC pin on the PIR sensor, and the other end to the 3V pin on the micro:bit.",
    cam: [2, 3, 4],
    look: [0, 0.5, 0],
    callouts: [
      { text: "3V Pin", x: -1.8, y: 1.5, color: "#ff4444" },
      { text: "VCC", x: 2.2, y: 1.5, color: "#ff4444" },
      { text: "RED = Power", x: 0, y: -0.3, color: "#ff4444" },
    ],
    wires: ["vcc"],
    highlight: "vcc",
  },
  {
    title: "Connect Ground (GND → GND)",
    desc: "Take the BLACK jumper wire. Connect the GND pin on the PIR sensor to the GND pin on the micro:bit.",
    cam: [2, 3, 4],
    look: [0, 0.5, 0],
    callouts: [
      { text: "GND Pin", x: -1.8, y: 0.8, color: "#666" },
      { text: "GND", x: 2.2, y: 0.8, color: "#666" },
      { text: "BLACK = Ground", x: 0, y: -0.3, color: "#888" },
    ],
    wires: ["vcc", "gnd"],
    highlight: "gnd",
  },
  {
    title: "Connect Signal (OUT → Pin 0)",
    desc: "Take the YELLOW jumper wire. Connect the OUT (signal) pin on the PIR sensor to Pin 0 on the micro:bit.",
    cam: [2.5, 3, 3.5],
    look: [0, 0.5, 0],
    callouts: [
      { text: "Pin 0", x: -2, y: 1.1, color: "#ddcc00" },
      { text: "OUT (Signal)", x: 2.2, y: 1.1, color: "#ddcc00" },
      { text: "YELLOW = Signal", x: 0, y: -0.3, color: "#ddcc00" },
    ],
    wires: ["vcc", "gnd", "signal"],
    highlight: "signal",
  },
  {
    title: "Check All Connections",
    desc: "Verify all three wires are secure: RED → VCC to 3V, BLACK → GND to GND, YELLOW → OUT to Pin 0. No loose connections.",
    cam: [3.5, 4.5, 4.5],
    look: [0, 0.3, 0],
    callouts: [
      { text: "✓ 3V → VCC", x: -0.5, y: 2.4, color: "#82b366" },
      { text: "✓ GND → GND", x: -0.5, y: 1.8, color: "#82b366" },
      { text: "✓ Pin 0 → OUT", x: -0.5, y: 1.2, color: "#82b366" },
    ],
    wires: ["vcc", "gnd", "signal"],
    highlight: null,
  },
  {
    title: "Ready to Code!",
    desc: "Your PIR sensor is connected. Open MakeCode and program the micro:bit to read Pin 0. When motion is detected, the signal goes HIGH.",
    cam: [3, 2.5, 5],
    look: [0, 0.5, 0],
    callouts: [
      { text: "Motion detected → Pin 0 = HIGH", x: 0, y: 2.8, color: "#82b366" },
    ],
    wires: ["vcc", "gnd", "signal"],
    highlight: null,
  },
];

// ── 3D COMPONENT BUILDERS ────────────────────────────────────

function buildMicrobit(scene) {
  const group = new THREE.Group();
  group.position.set(-1.5, 0.1, 0);

  // PCB board
  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.08, 1.6),
    ang("#1a1a2e", { roughness: 0.4, metalness: 0.1 })
  );
  pcb.position.y = 0;
  pcb.castShadow = true;
  pcb.receiveShadow = true;
  group.add(pcb);

  // Gold edge connector (bottom)
  const connector = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.06, 0.25),
    ang("#c4a040", { metalness: 0.7, roughness: 0.25 })
  );
  connector.position.set(0, -0.02, 0.9);
  group.add(connector);

  // Pin slots in edge connector
  const pinLabels = [
    { label: "0", x: -0.6, color: "#ffcc00" },
    { label: "1", x: -0.3, color: "#aaa" },
    { label: "2", x: 0, color: "#aaa" },
    { label: "3V", x: 0.35, color: "#ff4444" },
    { label: "GND", x: 0.65, color: "#444" },
  ];
  pinLabels.forEach(p => {
    // Pin hole
    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.07, 0.12),
      ang("#2a2a2a")
    );
    pin.position.set(p.x, -0.02, 0.95);
    group.add(pin);

    // Pin contact (gold)
    const contact = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.03, 0.08),
      ang(p.color === "#aaa" ? "#c4a040" : p.color, { metalness: 0.7, roughness: 0.2 })
    );
    contact.position.set(p.x, 0.01, 0.95);
    contact.name = `pin_${p.label}`;
    group.add(contact);
  });

  // LED matrix (5x5 dots)
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.04, 0.12),
        ang("#440000", { emissive: "#330000", emissiveIntensity: 0.3, roughness: 0.3 })
      );
      led.position.set(-0.3 + c * 0.15, 0.05, -0.3 + r * 0.15);
      group.add(led);
    }
  }

  // Buttons A and B
  [-0.7, 0.7].forEach((bx, i) => {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8),
      ang("#333", { roughness: 0.3 })
    );
    btn.position.set(bx, 0.07, 0);
    group.add(btn);
    // Button label area
    const labelBg = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 8),
      ang("#222", { roughness: 0.5 })
    );
    labelBg.position.set(bx, 0.042, 0);
    labelBg.rotation.x = -Math.PI / 2;
    group.add(labelBg);
  });

  // USB connector
  const usb = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.1, 0.15),
    ang("#aaa", { metalness: 0.6, roughness: 0.3 })
  );
  usb.position.set(0, 0.02, -0.85);
  group.add(usb);

  // Processor chip
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.04, 0.3),
    ang("#1a1a1a", { roughness: 0.3 })
  );
  chip.position.set(0.3, 0.06, -0.35);
  group.add(chip);

  // Board label
  const labelGeo = new THREE.BoxGeometry(0.6, 0.01, 0.15);
  const label = new THREE.Mesh(labelGeo, ang("#333", { roughness: 0.5 }));
  label.position.set(-0.3, 0.045, -0.55);
  group.add(label);

  scene.add(group);
  return group;
}

function buildPIR(scene) {
  const group = new THREE.Group();
  group.position.set(1.5, 0.1, 0);

  // PCB
  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.06, 1.2),
    ang("#1a6a1a", { roughness: 0.5 })
  );
  pcb.castShadow = true;
  group.add(pcb);

  // White dome (Fresnel lens)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
    ang("#e8e8e0", { roughness: 0.3, metalness: 0.05 })
  );
  dome.position.y = 0.03;
  dome.castShadow = true;
  group.add(dome);

  // Dome segments (Fresnel pattern)
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.15 + i * 0.1, 0.008, 4, 12),
      ang("#d0d0c8", { roughness: 0.4 })
    );
    ring.position.y = 0.15 - i * 0.03;
    ring.rotation.x = -Math.PI / 2 + i * 0.15;
    group.add(ring);
  }

  // Sensor element under dome
  const sensor = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.08, 0.15),
    ang("#333", { metalness: 0.3 })
  );
  sensor.position.y = 0.04;
  group.add(sensor);

  // Adjustment pots (2 orange trimmers)
  [-0.3, 0.3].forEach(px => {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.04, 6),
      ang("#e08030", { roughness: 0.5 })
    );
    pot.position.set(px, 0.05, -0.35);
    group.add(pot);
    // Slot
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.01, 0.003),
      ang("#8a5020")
    );
    slot.position.set(px, 0.075, -0.35);
    group.add(slot);
  });

  // Header pins (3 pins at bottom)
  const pinNames = [
    { label: "VCC", x: -0.25, color: "#ff4444" },
    { label: "OUT", x: 0, color: "#ddcc00" },
    { label: "GND", x: 0.25, color: "#444" },
  ];
  pinNames.forEach(p => {
    // Pin
    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.25, 0.04),
      ang("#c4a040", { metalness: 0.7, roughness: 0.2 })
    );
    pin.position.set(p.x, -0.15, 0.5);
    pin.name = `pir_${p.label}`;
    group.add(pin);
    // Pin base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, 0.08),
      ang("#222")
    );
    base.position.set(p.x, -0.03, 0.5);
    group.add(base);
  });

  // Components on PCB
  [[-0.35, -0.1], [0.35, -0.1], [0, -0.3]].forEach(([cx, cz]) => {
    const comp = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.05),
      ang("#222", { roughness: 0.3 })
    );
    comp.position.set(cx, 0.05, cz);
    group.add(comp);
  });

  // Capacitor
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6),
    ang("#2a2a6a", { roughness: 0.4 })
  );
  cap.position.set(0.4, 0.07, 0);
  group.add(cap);

  scene.add(group);
  return group;
}

function buildWire(scene, type, visible) {
  if (!visible) return null;

  const colors = { vcc: "#ee3333", gnd: "#333333", signal: "#ddcc00" };
  const color = colors[type] || "#888";

  // Wire paths (bezier-like series of points)
  const paths = {
    vcc: [
      [-1.15, 0.12, 0.95],  // micro:bit 3V pin
      [-0.8, 0.4, 0.95],
      [-0.3, 0.6, 0.8],
      [0.3, 0.6, 0.7],
      [0.8, 0.4, 0.55],
      [1.25, 0.0, 0.5],     // PIR VCC pin
    ],
    gnd: [
      [-0.85, 0.12, 0.95],  // micro:bit GND pin
      [-0.5, 0.3, 1.1],
      [0, 0.35, 1.1],
      [0.5, 0.3, 0.9],
      [1.2, 0.15, 0.6],
      [1.75, 0.0, 0.5],     // PIR GND pin
    ],
    signal: [
      [-2.1, 0.12, 0.95],   // micro:bit Pin 0
      [-1.8, 0.5, 0.95],
      [-1, 0.7, 0.6],
      [0, 0.75, 0.4],
      [0.8, 0.5, 0.5],
      [1.5, 0.0, 0.5],      // PIR OUT pin
    ],
  };

  const points = (paths[type] || paths.vcc).map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.025, 6, false);
  const wire = new THREE.Mesh(tubeGeo, ang(color, { roughness: 0.5 }));
  wire.castShadow = true;
  wire.name = `wire_${type}`;
  scene.add(wire);

  // Wire ends (connector blobs)
  [points[0], points[points.length - 1]].forEach(p => {
    const end = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 5, 4),
      ang(color, { roughness: 0.4 })
    );
    end.position.copy(p);
    scene.add(end);
  });

  return wire;
}

// ── MAIN COMPONENT ───────────────────────────────────────────

export default function PIRGuide() {
  const [currentStep, setCurrentStep] = useState(0);
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const camTargetRef = useRef({ px: 4, py: 4, pz: 5, lx: 0, ly: 0.3, lz: 0 });

  const step = GUIDE_STEPS[currentStep];

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f4f0ea");

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 50);
    camera.position.set(...step.cam);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    el.appendChild(renderer.domElement);

    // Clean bright lighting (technical diagram style)
    scene.add(new THREE.AmbientLight("#e8e4e0", 0.7));
    const key = new THREE.DirectionalLight("#fff", 1);
    key.position.set(5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1; key.shadow.camera.far = 25;
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -3;
    key.shadow.bias = -0.001;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#c8d8f0", 0.4);
    fill.position.set(-3, 4, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight("#ffe8d0", 0.3);
    rim.position.set(0, 2, -5);
    scene.add(rim);

    // Work surface
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      ang("#e8e0d4", { roughness: 0.95 })
    );
    surface.rotation.x = -Math.PI / 2;
    surface.receiveShadow = true;
    scene.add(surface);

    // Subtle grid on surface
    const gridMat = new THREE.LineBasicMaterial({ color: "#d0c8b8", transparent: true, opacity: 0.3 });
    for (let i = -5; i <= 5; i++) {
      const pts = [new THREE.Vector3(i, 0.005, -5), new THREE.Vector3(i, 0.005, 5)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
      const pts2 = [new THREE.Vector3(-5, 0.005, i), new THREE.Vector3(5, 0.005, i)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), gridMat));
    }

    // Build components
    const microbit = buildMicrobit(scene);
    const pir = buildPIR(scene);

    // Wires based on current step
    step.wires.forEach(w => buildWire(scene, w, true));

    // Highlight ring for active wire
    if (step.highlight) {
      const highlightColors = { vcc: "#ff4444", gnd: "#666", signal: "#ddcc00" };
      const hColor = highlightColors[step.highlight] || "#f0c41b";

      // Glow on relevant pins
      if (step.highlight === "vcc") {
        const glow1 = new THREE.PointLight("#ff4444", 1, 2);
        glow1.position.set(-1.15, 0.3, 0.95);
        scene.add(glow1);
        const glow2 = new THREE.PointLight("#ff4444", 1, 2);
        glow2.position.set(1.25, 0.3, 0.5);
        scene.add(glow2);
      } else if (step.highlight === "gnd") {
        const glow1 = new THREE.PointLight("#8888ff", 0.8, 2);
        glow1.position.set(-0.85, 0.3, 0.95);
        scene.add(glow1);
        const glow2 = new THREE.PointLight("#8888ff", 0.8, 2);
        glow2.position.set(1.75, 0.3, 0.5);
        scene.add(glow2);
      } else if (step.highlight === "signal") {
        const glow1 = new THREE.PointLight("#ddcc00", 1, 2);
        glow1.position.set(-2.1, 0.3, 0.95);
        scene.add(glow1);
        const glow2 = new THREE.PointLight("#ddcc00", 1, 2);
        glow2.position.set(1.5, 0.3, 0.5);
        scene.add(glow2);
      }
    }

    // Jumper wires lying flat (for step 0)
    if (currentStep === 0) {
      [["#ee3333", -0.5], ["#333", 0], ["#ddcc00", 0.5]].forEach(([c, wz]) => {
        const wire = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.03, 0.03),
          ang(c, { roughness: 0.5 })
        );
        wire.position.set(0, 0.02, 1.5 + wz * 0.3);
        wire.rotation.y = 0.1;
        scene.add(wire);
        // Connector ends
        [-0.75, 0.75].forEach(ex => {
          const end = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), ang("#222"));
          end.position.set(ex, 0.02, 1.5 + wz * 0.3);
          scene.add(end);
        });
      });
    }

    camTargetRef.current = { px: step.cam[0], py: step.cam[1], pz: step.cam[2], lx: step.look[0], ly: step.look[1], lz: step.look[2] };

    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;

      const ct = camTargetRef.current;
      camera.position.x += (ct.px - camera.position.x) * 0.06;
      camera.position.y += (ct.py - camera.position.y) * 0.06;
      camera.position.z += (ct.pz - camera.position.z) * 0.06;
      camera.lookAt(ct.lx, ct.ly, ct.lz);

      // Subtle breathing
      camera.position.x += Math.sin(time * 0.3) * 0.008;
      camera.position.y += Math.sin(time * 0.4) * 0.005;

      // PIR dome subtle pulse on last step
      if (currentStep === 5) {
        pir.children[1].material.emissiveIntensity = 0.1 + Math.sin(time * 2) * 0.08;
        pir.children[1].material.emissive = new THREE.Color("#00aa44");
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => { const nw = el.clientWidth, nh = el.clientHeight; camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(frameRef.current); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); renderer.dispose(); };
  }, [currentStep]);

  return (
    <div style={{ height: "100vh", background: "#f4f0ea", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#2a2a2a", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #ddd8d0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "#fff" }}>
        <div>
          <span style={{ fontSize: 9, letterSpacing: 4, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Loominary</span>
          <span style={{ fontSize: 13, color: "#444", fontWeight: 400, marginLeft: 8 }}>Visual Guide</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["🔍 Inquire", "⚡ Electronics"].map(tag => (
            <span key={tag} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: "#eee8e0", color: "#887766", fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: "12px 14px 8px", background: "#fff", borderBottom: "1px solid #eee8e0", flexShrink: 0 }}>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 3px", color: "#2a2a2a" }}>Connecting a PIR Sensor to micro:bit</h1>
        <p style={{ fontSize: 11, color: "#888", margin: 0 }}>6 steps • Motion detection circuit • Beginner level</p>
      </div>

      {/* Step Progress */}
      <div style={{ padding: "8px 14px", background: "#faf8f4", borderBottom: "1px solid #eee8e0", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {GUIDE_STEPS.map((s, i) => (
            <button key={i} onClick={() => setCurrentStep(i)}
              style={{ flex: 1, height: 4, borderRadius: 2, background: i < currentStep ? "#82b366" : i === currentStep ? "#e94560" : "#ddd8d0", border: "none", cursor: "pointer", transition: "background 0.3s" }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 9, color: "#aaa" }}>Step {currentStep + 1} of {GUIDE_STEPS.length}</span>
          <span style={{ fontSize: 9, color: "#e94560", fontWeight: 600 }}>{step.title}</span>
        </div>
      </div>

      {/* 3D Viewport */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

        {/* Callout labels overlaid on 3D */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {step.callouts.map((c, i) => {
            // Convert 3D-ish positions to approximate screen positions
            const xPct = 50 + c.x * 12;
            const yPct = 50 - c.y * 12;
            return (
              <div key={i} style={{ position: "absolute", left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}>
                <div style={{ background: c.color ? `${c.color}18` : "rgba(0,0,0,0.06)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "4px 10px", border: `1px solid ${c.color || "#ccc"}44`, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.color || "#444" }}>{c.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instruction Panel */}
      <div style={{ padding: "12px 14px", background: "#fff", borderTop: "1px solid #eee8e0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: currentStep === GUIDE_STEPS.length - 1 ? "#82b36615" : "#e9456012", border: currentStep === GUIDE_STEPS.length - 1 ? "1px solid #82b36633" : "1px solid #e9456022", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
            {currentStep === 0 ? "📦" : currentStep === GUIDE_STEPS.length - 1 ? "✅" : "🔌"}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 3px", color: "#2a2a2a" }}>{step.title}</h3>
            <p style={{ fontSize: 12, color: "#666", margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
          <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}
            style={{ padding: "9px 18px", background: currentStep === 0 ? "#f0ece6" : "#eee8e0", border: "none", borderRadius: 8, color: currentStep === 0 ? "#ccc" : "#666", fontSize: 12, fontWeight: 600, cursor: currentStep === 0 ? "default" : "pointer" }}>
            ← Previous
          </button>
          <div style={{ display: "flex", gap: 3 }}>
            {GUIDE_STEPS.map((_, i) => (
              <button key={i} onClick={() => setCurrentStep(i)}
                style={{ width: 8, height: 8, borderRadius: "50%", background: i === currentStep ? "#e94560" : i < currentStep ? "#82b366" : "#ddd", border: "none", cursor: "pointer", padding: 0 }} />
            ))}
          </div>
          <button onClick={() => setCurrentStep(Math.min(GUIDE_STEPS.length - 1, currentStep + 1))} disabled={currentStep === GUIDE_STEPS.length - 1}
            style={{ padding: "9px 18px", background: currentStep === GUIDE_STEPS.length - 1 ? "#82b366" : "#e94560", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {currentStep === GUIDE_STEPS.length - 1 ? "Done ✓" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
