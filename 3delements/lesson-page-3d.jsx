import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ── MINI 3D RENDERERS ────────────────────────────────────────
// Each mode gets its own tiny Three.js setup

function useScene(mountRef, setup, deps = []) {
  const frameRef = useRef(null);
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 50);

    const ctx = setup(scene, camera, renderer);

    let t = 0;
    const loop = () => {
      frameRef.current = requestAnimationFrame(loop);
      t += 0.016;
      if (ctx?.animate) ctx.animate(t);
      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      const nw = el.clientWidth, nh = el.clientHeight;
      if (nw === 0 || nh === 0) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, deps);
}

const angMat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, flatShading: true, roughness: opts.roughness || 0.6, metalness: opts.metalness || 0, ...opts,
});

function createCharacterMesh(color, emoji) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 6), angMat(color));
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 5, 4), angMat(color));
  head.position.y = 1.3; head.castShadow = true; g.add(head);
  // Apron for Rosa
  if (emoji === "👩‍🍳") {
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.55, 6, 1, false, 0, Math.PI), angMat("#fff", { roughness: 0.7 }));
    apron.position.y = 0.58; apron.rotation.y = Math.PI; g.add(apron);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.25, 5), angMat("#fff", { roughness: 0.4 }));
    hat.position.y = 1.58; g.add(hat);
    const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.19, 5, 4), angMat("#fff", { roughness: 0.4 }));
    hatTop.position.y = 1.7; g.add(hatTop);
  }
  // Eyes
  const eyeMat = angMat("#fff");
  const pupilMat = angMat("#2a1a0a");
  [[-0.08, 1.34], [0.08, 1.34]].forEach(([ex, ey]) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), eyeMat);
    eye.position.set(ex, ey, -0.18); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), pupilMat);
    pupil.position.set(ex, ey, -0.2); g.add(pupil);
  });
  // Shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; g.add(shadow);
  return g;
}

// ═══════════════════════════════════════════════════════════
// MODE 2: EMBEDDED SCENE (main lesson window)
// ═══════════════════════════════════════════════════════════
function EmbeddedScene({ onEnterWorld }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);

  useScene(ref, (scene, camera) => {
    scene.background = new THREE.Color("#1a1008");
    scene.fog = new THREE.FogExp2("#1a1008", 0.06);
    camera.position.set(1.5, 1.8, 3);
    camera.lookAt(-0.5, 1, -0.5);

    // Lighting
    scene.add(new THREE.AmbientLight("#1a1535", 0.4));
    const forge = new THREE.PointLight("#ff6622", 2.5, 8, 1.5);
    forge.position.set(-3, 1.2, -1.5); scene.add(forge);
    const fill = new THREE.DirectionalLight("#4466aa", 0.2);
    fill.position.set(3, 4, 2); scene.add(fill);
    const lantern = new THREE.PointLight("#ffaa44", 1.2, 6);
    lantern.position.set(0, 3, 0); scene.add(lantern);

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), angMat("#2a2018", { roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    // Back wall
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), angMat("#3a2a1a", { roughness: 0.9 }));
    wall.position.set(0, 2, -2.5); scene.add(wall);

    // Rosa
    const rosa = createCharacterMesh("#e8a87c", "👩‍🍳");
    rosa.position.set(-0.5, 0, -0.3);
    rosa.rotation.y = 0.3;
    scene.add(rosa);

    // Counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.5), angMat("#6a4a28"));
    counter.position.set(-2.2, 0.425, -0.5); scene.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 0.6), angMat("#7a5a38"));
    top.position.set(-2.2, 0.87, -0.5); scene.add(top);

    // Cups
    [[-2.8, -0.4], [-2.4, -0.6], [-2, -0.35], [-1.6, -0.55]].forEach(([cx, cz]) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.12, 5), angMat("#e8e0d0", { roughness: 0.3 }));
      cup.position.set(cx, 0.96, cz); scene.add(cup);
    });

    // Forge
    const forgeBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), angMat("#4a4040", { roughness: 0.95 }));
    forgeBase.position.set(-3, 0.5, -1.5); scene.add(forgeBase);
    const fireGlow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.08), angMat("#ff4400", { emissive: "#ff2200", emissiveIntensity: 2 }));
    fireGlow.position.set(-3, 0.5, -0.99); scene.add(fireGlow);

    // Sparks
    const sparkCount = 15;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVel = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = -3; sparkPos[i * 3 + 1] = 0.5; sparkPos[i * 3 + 2] = -0.9;
      sparkVel.push({ vy: 0.01 + Math.random() * 0.015, life: Math.random() });
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    scene.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: "#ffaa33", size: 0.03, transparent: true, opacity: 0.8, sizeAttenuation: true })));

    return {
      animate: (t) => {
        rosa.position.y = Math.sin(t * 1.5) * 0.006;
        rosa.rotation.y = 0.3 + Math.sin(t * 0.4) * 0.08;
        forge.intensity = 2.5 + Math.sin(t * 8) * 0.3;
        fireGlow.material.emissiveIntensity = 2 + Math.sin(t * 6) * 0.4;
        camera.position.x = 1.5 + Math.sin(t * 0.15) * 0.15;
        camera.position.y = 1.8 + Math.sin(t * 0.2) * 0.05;
        camera.lookAt(-0.5, 1, -0.5);

        const sp = sparkGeo.attributes.position.array;
        for (let i = 0; i < sparkCount; i++) {
          sparkVel[i].life += 0.008;
          sp[i * 3 + 1] += sparkVel[i].vy;
          sp[i * 3] += Math.sin(t + i) * 0.001;
          if (sparkVel[i].life > 1) {
            sp[i * 3] = -3 + (Math.random() - 0.5) * 0.2;
            sp[i * 3 + 1] = 0.5;
            sparkVel[i].life = 0;
          }
        }
        sparkGeo.attributes.position.needsUpdate = true;
      },
    };
  });

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div ref={ref} style={{ width: "100%", height: 240 }} />
      {/* Overlay */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 14px 12px", background: "linear-gradient(transparent, rgba(10,8,4,0.9))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 10, color: "#e8a87c", fontWeight: 600, letterSpacing: 1 }}>👩‍🍳 Rosa the Baker</div>
            <div style={{ fontSize: 11, color: "#887766", marginTop: 2 }}>Has a problem she needs your help with…</div>
          </div>
          <button onClick={onEnterWorld} style={{ padding: "7px 14px", background: hovered ? "#e94560" : "rgba(233,69,96,0.15)", border: "1px solid #e9456044", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
            Enter World →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODE 3: FLOATING 3D BADGES
// ═══════════════════════════════════════════════════════════
function Badge3D({ color, shape }) {
  const ref = useRef(null);
  useScene(ref, (scene, camera) => {
    camera.position.set(0, 0, 2.5);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight("#fff", 0.5));
    const dir = new THREE.DirectionalLight("#fff", 1);
    dir.position.set(2, 3, 2); scene.add(dir);
    const point = new THREE.PointLight(color, 1, 4);
    point.position.set(0, 0, 1.5); scene.add(point);

    let mesh;
    if (shape === "star") {
      mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), angMat(color, { metalness: 0.4, roughness: 0.3 }));
    } else if (shape === "gem") {
      mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), angMat(color, { metalness: 0.6, roughness: 0.2 }));
      mesh.scale.y = 1.3;
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 5, 4), angMat(color, { metalness: 0.3, roughness: 0.4 }));
    }
    scene.add(mesh);
    return { animate: (t) => { mesh.rotation.y = t * 0.8; mesh.rotation.x = Math.sin(t * 0.5) * 0.15; mesh.position.y = Math.sin(t * 1.2) * 0.05; } };
  });
  return <div ref={ref} style={{ width: 40, height: 40 }} />;
}

// ═══════════════════════════════════════════════════════════
// MODE 5: PIP COMPANION
// ═══════════════════════════════════════════════════════════
function PipCompanion({ visible, onClose }) {
  const ref = useRef(null);
  useScene(ref, (scene, camera) => {
    scene.background = new THREE.Color("#1a1008");
    camera.position.set(0, 1.4, 1.8);
    camera.lookAt(0, 1.15, 0);
    scene.add(new THREE.AmbientLight("#2a1a10", 0.5));
    const warm = new THREE.PointLight("#ff8844", 1.5, 5);
    warm.position.set(-1, 2, 1); scene.add(warm);
    const fill = new THREE.PointLight("#4466aa", 0.3, 4);
    fill.position.set(1, 1.5, 1); scene.add(fill);
    const rosa = createCharacterMesh("#e8a87c", "👩‍🍳");
    scene.add(rosa);
    return {
      animate: (t) => {
        rosa.position.y = Math.sin(t * 1.5) * 0.005;
        rosa.rotation.y = Math.sin(t * 0.3) * 0.1;
        // Subtle head tilt
        const headMesh = rosa.children[1];
        if (headMesh) headMesh.rotation.x = Math.sin(t * 0.5) * 0.04;
      },
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div style={{ position: "fixed", bottom: 70, right: 12, width: 130, height: 150, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(232,168,124,0.2)", boxShadow: "0 8px 30px rgba(0,0,0,0.5)", zIndex: 50 }}>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      <button onClick={onClose} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", border: "none", color: "#887766", fontSize: 12, borderRadius: "50%", width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px", background: "rgba(10,8,4,0.8)", textAlign: "center" }}>
        <span style={{ fontSize: 8, color: "#e8a87c", letterSpacing: 1 }}>Rosa is watching</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODE 4: MODAL CUTSCENE (simplified)
// ═══════════════════════════════════════════════════════════
function CutsceneModal({ open, onClose }) {
  const ref = useRef(null);
  const [line, setLine] = useState(0);

  const lines = [
    { speaker: "Rosa", text: "Oh! A new face! Welcome, welcome to my bakery.", mood: "warm" },
    { speaker: "Rosa", text: "I have a problem — my customers keep burning their hands on these cups.", mood: "worried" },
    { speaker: "Rosa", text: "Could you design a better sleeve? Eco-friendly, affordable, and it has to actually work.", mood: "hopeful" },
  ];

  useScene(ref, (scene, camera) => {
    scene.background = new THREE.Color("#1a1008");
    scene.fog = new THREE.FogExp2("#1a1008", 0.05);
    camera.position.set(0.5, 1.6, 2);
    camera.lookAt(-0.3, 1.3, 0);
    scene.add(new THREE.AmbientLight("#1a1535", 0.4));
    const warm = new THREE.PointLight("#ff6622", 2.5, 8);
    warm.position.set(-2, 1.2, -1); scene.add(warm);
    const fill = new THREE.DirectionalLight("#4466aa", 0.2);
    fill.position.set(3, 4, 2); scene.add(fill);
    const rosa = createCharacterMesh("#e8a87c", "👩‍🍳");
    rosa.position.set(-0.3, 0, 0);
    rosa.rotation.y = 0.2;
    scene.add(rosa);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), angMat("#2a2018", { roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    return {
      animate: (t) => {
        rosa.position.y = Math.sin(t * 1.5) * 0.005;
        camera.position.x = 0.5 + Math.sin(t * 0.3) * 0.1;
        camera.lookAt(-0.3, 1.3, 0);
        warm.intensity = 2.5 + Math.sin(t * 8) * 0.3;
      },
    };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 32, background: "#000", flexShrink: 0 }} />
      <div style={{ flex: 1, position: "relative" }}>
        <div ref={ref} style={{ width: "100%", height: "100%" }} />

        {/* Dialogue */}
        <div onClick={() => { if (line < lines.length - 1) setLine(l => l + 1); else { setLine(0); onClose(); } }}
          style={{ position: "absolute", bottom: 12, left: 12, right: 12, maxWidth: 440, margin: "0 auto", cursor: "pointer" }}>
          <div style={{ background: "rgba(10,8,4,0.92)", backdropFilter: "blur(12px)", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(232,168,124,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8a87c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👩‍🍳</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e8a87c" }}>{lines[line].speaker}</div>
                <div style={{ fontSize: 9, color: "#554433", fontStyle: "italic" }}>{lines[line].mood}</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#f0e6d3", lineHeight: 1.7, margin: "0 0 4px", fontFamily: "Georgia, serif" }}>"{lines[line].text}"</p>
            <div style={{ textAlign: "right", fontSize: 9, color: "#443322" }}>{line + 1}/{lines.length} — tap ▶</div>
          </div>
        </div>
      </div>
      <div style={{ height: 32, background: "#000", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12 }}>
        <button onClick={() => { setLine(0); onClose(); }} style={{ background: "none", border: "none", color: "#443322", fontSize: 9, cursor: "pointer", letterSpacing: 1 }}>SKIP →</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN LESSON PAGE
// ═══════════════════════════════════════════════════════════

const TASKS = [
  { text: "Interview 5 of Rosa's customers about their experience", done: true },
  { text: "Research existing cup sleeve designs and materials", done: true },
  { text: "Investigate eco-friendly insulation materials", done: false },
  { text: "Write a design brief with specifications", done: false },
];

export default function LessonPage() {
  const [showCutscene, setShowCutscene] = useState(false);
  const [showPip, setShowPip] = useState(false);
  const [tasks, setTasks] = useState(TASKS);

  const toggleTask = (idx) => {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, done: !t.done } : t));
  };

  const completedCount = tasks.filter(t => t.done).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c14", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8e0d4" }}>
      {/* Nav Bar */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Loominary</div>
          <span style={{ color: "#333" }}>|</span>
          <span style={{ fontSize: 11, color: "#665544" }}>MYP Design — Year 4</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowPip(!showPip)} style={{ background: showPip ? "rgba(232,168,124,0.1)" : "rgba(255,255,255,0.03)", border: showPip ? "1px solid rgba(232,168,124,0.2)" : "1px solid rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 8px", color: showPip ? "#e8a87c" : "#554433", fontSize: 10, cursor: "pointer" }}>
            👩‍🍳 {showPip ? "Hide" : "Show"} Rosa
          </button>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e94560", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>A</div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 10, color: "#443322", marginBottom: 12, display: "flex", gap: 4 }}>
          <span>Unit 3</span><span style={{ color: "#333" }}>→</span><span style={{ color: "#6c8ebf" }}>Inquire Phase</span>
        </div>

        {/* ═══ MODE 2: EMBEDDED 3D SCENE ═══ */}
        <EmbeddedScene onEnterWorld={() => setShowCutscene(true)} />

        {/* Quest Header */}
        <div style={{ marginTop: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: "#6c8ebf22", color: "#6c8ebf", fontWeight: 700, letterSpacing: 1 }}>🔍 INQUIRE</span>
            <span style={{ fontSize: 10, color: "#443322" }}>Phase 1 of 4</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: "0 0 4px", letterSpacing: 0.5 }}>The Hot Cup Problem</h1>
          <p style={{ fontSize: 12, color: "#887766", margin: 0, lineHeight: 1.6 }}>
            Design an eco-friendly insulating sleeve for Rosa's takeaway cups. Start by understanding the problem through research and interviews.
          </p>
        </div>

        {/* Phase Progress */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {[
            { phase: "Inquire", color: "#6c8ebf", active: true },
            { phase: "Develop", color: "#d4a843", active: false },
            { phase: "Create", color: "#82b366", active: false },
            { phase: "Evaluate", color: "#b85450", active: false },
          ].map(p => (
            <div key={p.phase} style={{ flex: 1 }}>
              <div style={{ height: 3, borderRadius: 2, background: p.active ? p.color : "rgba(255,255,255,0.04)", marginBottom: 3 }} />
              <div style={{ fontSize: 8, textAlign: "center", color: p.active ? p.color : "#333", fontWeight: p.active ? 700 : 400 }}>{p.phase}</div>
            </div>
          ))}
        </div>

        {/* Task Checklist */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)", padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#ccc" }}>Tasks</span>
            <span style={{ fontSize: 10, color: "#6c8ebf" }}>{completedCount}/{tasks.length} complete</span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(completedCount / tasks.length) * 100}%`, background: "#6c8ebf", borderRadius: 2, transition: "width 0.3s" }} />
          </div>

          {tasks.map((task, i) => (
            <div key={i} onClick={() => toggleTask(i)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: i < tasks.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none", cursor: "pointer" }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: task.done ? "2px solid #6c8ebf" : "2px solid rgba(255,255,255,0.12)", background: task.done ? "#6c8ebf22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                {task.done && <span style={{ fontSize: 11, color: "#6c8ebf" }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: task.done ? "#665544" : "#ccc", lineHeight: 1.5, textDecoration: task.done ? "line-through" : "none" }}>{task.text}</span>
            </div>
          ))}
        </div>

        {/* ═══ MODE 3: FLOATING 3D BADGES ═══ */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)", padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#ccc", marginBottom: 10 }}>Achievements Unlocked</div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { name: "First Interview", color: "#6c8ebf", shape: "star" },
              { name: "Researcher", color: "#d4a843", shape: "gem" },
              { name: "7-Day Streak", color: "#e94560", shape: "sphere" },
            ].map(b => (
              <div key={b.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <Badge3D color={b.color} shape={b.shape} />
                <span style={{ fontSize: 8, color: "#776655", textAlign: "center" }}>{b.name}</span>
              </div>
            ))}
            {/* Locked badge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: 0.3 }}>
              <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔒</div>
              <span style={{ fontSize: 8, color: "#443322", textAlign: "center" }}>Full Cycle</span>
            </div>
          </div>
        </div>

        {/* AI Assistant */}
        <div style={{ background: "rgba(233,69,96,0.04)", borderRadius: 12, border: "1px solid rgba(233,69,96,0.08)", padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#e94560", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✦</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#e94560" }}>Design Assistant</span>
          </div>
          <p style={{ fontSize: 12, color: "#887766", margin: "0 0 10px", lineHeight: 1.5 }}>Need help planning your customer interviews? I can suggest questions that'll reveal the real pain points.</p>
          <div style={{ display: "flex", gap: 6 }}>
            <input placeholder="Ask about your design challenge…" style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "#e8e0d4", fontSize: 12, outline: "none" }} />
            <button style={{ padding: "8px 14px", background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ask</button>
          </div>
        </div>

        {/* Journal Entry */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)", padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#ccc", marginBottom: 8 }}>Process Journal</div>
          <textarea placeholder="Reflect on today's research. What surprised you? What questions do you still have?" style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "#e8e0d4", fontSize: 12, outline: "none", minHeight: 70, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 10, color: "#443322" }}>🔥 3 day streak</span>
            <button style={{ padding: "6px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#aaa", fontSize: 11, cursor: "pointer" }}>Save Entry</button>
          </div>
        </div>

        {/* Mode Labels */}
        <div style={{ padding: "12px 0 20px", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#332211", textTransform: "uppercase", marginBottom: 10 }}>3D Rendering Modes on This Page</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { mode: "Mode 2", label: "Embedded Scene", desc: "Rosa's bakery — 3D window in content flow", color: "#e8a87c" },
              { mode: "Mode 3", label: "Floating 3D", desc: "Achievement badges — spinning objects inline", color: "#d4a843" },
              { mode: "Mode 4", label: "Modal Cutscene", desc: "Tap 'Enter World' above to trigger", color: "#e94560" },
              { mode: "Mode 5", label: "PiP Companion", desc: "Toggle Rosa in the nav bar", color: "#7ecf8a" },
            ].map(m => (
              <div key={m.mode} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.03)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.color }}>{m.mode}: {m.label}</span>
                  <span style={{ fontSize: 9, color: "#443322", marginLeft: 6 }}>{m.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ MODE 5: PIP COMPANION ═══ */}
      <PipCompanion visible={showPip} onClose={() => setShowPip(false)} />

      {/* ═══ MODE 4: CUTSCENE MODAL ═══ */}
      <CutsceneModal open={showCutscene} onClose={() => { setShowCutscene(false); setShowPip(true); }} />
    </div>
  );
}
