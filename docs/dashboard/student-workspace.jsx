import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";

// ─── Tiny drag engine ───────────────────────────────────────────────
function useDrag(initialPos) {
  const [pos, setPos] = useState(initialPos);
  const [dragging, setDragging] = useState(false);
  const [zBoost, setZBoost] = useState(0);
  const offset = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    setDragging(true);
    setZBoost(1000);
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!dragging) return;
    setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
  }, [dragging]);

  const onPointerUp = useCallback(() => {
    setDragging(false);
    setZBoost(0);
  }, []);

  return { pos, dragging, zBoost, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}

// ─── 3D Scene (pure Three.js in canvas) ──────────────────────────────
function ThreeScene({ width, height }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 6, 8);
    camera.lookAt(0, 0, 0);

    // Desk surface
    const deskGeo = new THREE.BoxGeometry(14, 0.15, 8);
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.85, metalness: 0.05 });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.y = -0.1;
    desk.receiveShadow = true;
    scene.add(desk);

    // Objects on the desk
    const objects = [];

    // Pencil cup (cylinder)
    const cupGeo = new THREE.CylinderGeometry(0.3, 0.25, 0.8, 16);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xc4763a, roughness: 0.4, metalness: 0.1 });
    const cup = new THREE.Mesh(cupGeo, cupMat);
    cup.position.set(-4.5, 0.4, -1.5);
    cup.castShadow = true;
    cup.receiveShadow = true;
    scene.add(cup);
    objects.push(cup);

    // Pencils inside cup
    for (let i = 0; i < 4; i++) {
      const pencilGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.2, 6);
      const pencilColors = [0xf0c040, 0xe05030, 0x3080d0, 0x40b060];
      const pencilMat = new THREE.MeshStandardMaterial({ color: pencilColors[i], roughness: 0.6 });
      const pencil = new THREE.Mesh(pencilGeo, pencilMat);
      const angle = (i / 4) * Math.PI * 2;
      pencil.position.set(-4.5 + Math.cos(angle) * 0.12, 0.85, -1.5 + Math.sin(angle) * 0.12);
      pencil.rotation.z = (Math.random() - 0.5) * 0.15;
      pencil.rotation.x = (Math.random() - 0.5) * 0.1;
      pencil.castShadow = true;
      scene.add(pencil);
    }

    // Sketchbook (flat box)
    const bookGeo = new THREE.BoxGeometry(1.6, 0.08, 2.1);
    const bookMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.9 });
    const book = new THREE.Mesh(bookGeo, bookMat);
    book.position.set(4.2, 0.04, -0.5);
    book.rotation.y = 0.15;
    book.castShadow = true;
    book.receiveShadow = true;
    scene.add(book);
    objects.push(book);

    // Spiral binding dots on sketchbook
    for (let i = 0; i < 8; i++) {
      const dotGeo = new THREE.SphereGeometry(0.03, 8, 8);
      const dotMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(4.2 - 0.75, 0.1, -0.5 - 0.9 + i * 0.25);
      scene.add(dot);
    }

    // Ruler
    const rulerGeo = new THREE.BoxGeometry(2.5, 0.04, 0.35);
    const rulerMat = new THREE.MeshStandardMaterial({ color: 0x60a0c0, roughness: 0.3, metalness: 0.15 });
    const ruler = new THREE.Mesh(rulerGeo, rulerMat);
    ruler.position.set(-1.5, 0.02, 2.5);
    ruler.rotation.y = -0.2;
    ruler.castShadow = true;
    ruler.receiveShadow = true;
    scene.add(ruler);
    objects.push(ruler);

    // micro:bit placeholder (small circuit board shape)
    const boardGeo = new THREE.BoxGeometry(0.7, 0.06, 0.55);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5, metalness: 0.3 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(2, 0.03, 2.2);
    board.rotation.y = 0.4;
    board.castShadow = true;
    board.receiveShadow = true;
    scene.add(board);

    // LED dots on board
    const ledColors = [0xff3333, 0x33ff33, 0xffaa00, 0x3333ff, 0xff33ff];
    for (let i = 0; i < 5; i++) {
      const ledGeo = new THREE.SphereGeometry(0.025, 6, 6);
      const ledMat = new THREE.MeshStandardMaterial({ color: ledColors[i], emissive: ledColors[i], emissiveIntensity: 0.5 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      const lx = 2 + (i - 2) * 0.12;
      led.position.set(lx, 0.08, 2.2);
      scene.add(led);
    }
    objects.push(board);

    // Warm desk lamp light (main directional)
    const dirLight = new THREE.DirectionalLight(0xffeedd, 2.5);
    dirLight.position.set(-3, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 20;
    dirLight.shadow.camera.left = -8;
    dirLight.shadow.camera.right = 8;
    dirLight.shadow.camera.top = 6;
    dirLight.shadow.camera.bottom = -6;
    dirLight.shadow.bias = -0.002;
    dirLight.shadow.radius = 3;
    scene.add(dirLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xaabbdd, 0.4);
    fillLight.position.set(5, 3, -2);
    scene.add(fillLight);

    // Ambient
    const ambient = new THREE.AmbientLight(0x665544, 0.5);
    scene.add(ambient);

    // Gentle float animation
    let time = 0;
    const animate = () => {
      time += 0.008;
      objects.forEach((obj, i) => {
        obj.position.y += Math.sin(time + i * 1.5) * 0.0003;
      });
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
    };
  }, [width, height]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} />;
}

// ─── Card component ──────────────────────────────────────────────────
function Card({ id, title, subtitle, children, initialPos, color, z, icon }) {
  const { pos, dragging, zBoost, handlers } = useDrag(initialPos);

  return (
    <div
      {...handlers}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        zIndex: z + zBoost,
        width: 260,
        cursor: dragging ? "grabbing" : "grab",
        transform: dragging ? "scale(1.03) rotate(-1deg)" : "scale(1) rotate(0deg)",
        transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.3s ease",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {/* Shadow layer */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 16,
        boxShadow: dragging
          ? "0 20px 60px rgba(0,0,0,0.35), 0 8px 20px rgba(0,0,0,0.2)"
          : "0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)",
        transition: dragging ? "none" : "box-shadow 0.3s ease",
        zIndex: -1
      }} />

      <div style={{
        background: "rgba(32,30,28,0.92)",
        backdropFilter: "blur(20px)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>
        {/* Header bar */}
        <div style={{
          padding: "14px 18px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}>{icon}</div>
          <div>
            <div style={{ color: "#f0ece6", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>{title}</div>
            {subtitle && <div style={{ color: "rgba(240,236,230,0.45)", fontFamily: "'DM Sans', sans-serif", fontSize: 11, marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: "14px 18px 18px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Progress ring ───────────────────────────────────────────────────
function ProgressRing({ value, size = 44, color = "#c4763a" }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - value)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2,0.8,0.2,1)" }} />
    </svg>
  );
}

// ─── Main dashboard ──────────────────────────────────────────────────
export default function StudentWorkspace() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(t); }, []);

  const greeting = time.getHours() < 12 ? "Good morning" : time.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden", position: "relative",
      background: "linear-gradient(165deg, #1a1714 0%, #0f0e0c 40%, #151210 100%)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* Warm ambient glow */}
      <div style={{
        position: "absolute", top: -100, left: -100, width: 500, height: 500,
        background: "radial-gradient(circle, rgba(196,118,58,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -200, right: -100, width: 600, height: 600,
        background: "radial-gradient(circle, rgba(90,70,50,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ padding: "28px 36px 0", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: "rgba(240,236,230,0.35)", fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {greeting}
            </div>
            <h1 style={{
              fontFamily: "'DM Serif Display', serif", color: "#f0ece6",
              fontSize: 32, fontWeight: 400, margin: "4px 0 0", letterSpacing: "-0.02em",
            }}>
              Your Studio
            </h1>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              background: "rgba(196,118,58,0.12)", border: "1px solid rgba(196,118,58,0.2)",
              borderRadius: 10, padding: "8px 14px",
              color: "#c4763a", fontSize: 13, fontWeight: 600,
            }}>
              Level 7 — Explorer
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #c4763a, #e0a060)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, color: "#1a1714",
            }}>A</div>
          </div>
        </div>
      </div>

      {/* 3D desk scene (background layer) */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "45%", opacity: 0.6, pointerEvents: "none",
        maskImage: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)",
      }}>
        <ThreeScene width={1200} height={500} />
      </div>

      {/* Draggable cards */}
      <Card id="next" title="Next Action" subtitle="Design Cycle → Develop" initialPos={{ x: 40, y: 120 }} color="rgba(196,118,58,0.25)" z={10} icon="→">
        <div style={{ color: "#f0ece6", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
          Build your first prototype using the materials list from your planning phase.
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(196,118,58,0.1)", borderRadius: 10, padding: "10px 14px",
          border: "1px solid rgba(196,118,58,0.15)",
        }}>
          <ProgressRing value={0.65} size={36} />
          <div>
            <div style={{ color: "#c4763a", fontSize: 12, fontWeight: 600 }}>65% through Develop</div>
            <div style={{ color: "rgba(240,236,230,0.4)", fontSize: 11 }}>~2 sessions remaining</div>
          </div>
        </div>
      </Card>

      <Card id="mentor" title="AI Mentor" subtitle="Matched: Dieter Rams" initialPos={{ x: 340, y: 140 }} color="rgba(80,140,200,0.25)" z={8} icon="✦">
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(80,140,200,0.3), rgba(80,140,200,0.1))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>🎯</div>
          <div style={{ color: "rgba(240,236,230,0.65)", fontSize: 12, lineHeight: 1.55 }}>
            <span style={{ color: "#f0ece6", fontWeight: 600 }}>Trait match: 87%</span><br />
            Simplicity, function-first thinking, iterative refinement
          </div>
        </div>
        <div style={{
          background: "rgba(80,140,200,0.08)", borderRadius: 10, padding: "10px 14px",
          border: "1px solid rgba(80,140,200,0.12)", color: "rgba(240,236,230,0.55)", fontSize: 12, fontStyle: "italic",
        }}>
          "Less, but better. How could you simplify your mechanism?"
        </div>
      </Card>

      <Card id="capture" title="Recent Captures" subtitle="3 new this week" initialPos={{ x: 640, y: 110 }} color="rgba(100,180,120,0.25)" z={6} icon="◉">
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, aspectRatio: "1", borderRadius: 10,
              background: `linear-gradient(${120 + i * 30}deg, rgba(100,180,120,${0.08 + i * 0.04}), rgba(60,60,50,0.3))`,
              border: "1px solid rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "rgba(240,236,230,0.2)",
            }}>
              {["✎", "△", "◈"][i - 1]}
            </div>
          ))}
        </div>
        <div style={{ color: "rgba(240,236,230,0.4)", fontSize: 11, marginTop: 10, textAlign: "center" }}>
          Tap to review AI annotations
        </div>
      </Card>

      <Card id="project" title="Bluetooth Speaker" subtitle="MYP Criterion C & D" initialPos={{ x: 80, y: 370 }} color="rgba(200,170,80,0.25)" z={4} icon="♫">
        <div style={{ marginBottom: 10 }}>
          {["Research", "Plan", "Develop", "Evaluate"].map((phase, i) => (
            <div key={phase} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
              borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.03)" : "none",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: i < 2 ? "rgba(100,180,120,0.3)" : i === 2 ? "rgba(200,170,80,0.3)" : "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: i < 2 ? "#64b478" : i === 2 ? "#c8aa50" : "rgba(255,255,255,0.2)",
              }}>{i < 2 ? "✓" : i === 2 ? "●" : "○"}</div>
              <span style={{ color: i <= 2 ? "#f0ece6" : "rgba(240,236,230,0.3)", fontSize: 12, fontWeight: i === 2 ? 600 : 400 }}>{phase}</span>
              {i === 2 && <span style={{ marginLeft: "auto", color: "#c8aa50", fontSize: 11, fontWeight: 500 }}>In progress</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card id="xp" title="XP & Skills" subtitle="1,240 XP total" initialPos={{ x: 420, y: 400 }} color="rgba(180,100,200,0.25)" z={3} icon="⬡">
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 8 }}>
          {[
            { label: "Making", val: 0.8, col: "#c4763a" },
            { label: "Thinking", val: 0.6, col: "#508cc8" },
            { label: "Iterating", val: 0.45, col: "#64b478" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <ProgressRing value={s.val} size={40} color={s.col} />
              <div style={{ color: "rgba(240,236,230,0.45)", fontSize: 10, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{
          background: "rgba(180,100,200,0.08)", borderRadius: 8, padding: "8px 12px",
          border: "1px solid rgba(180,100,200,0.12)",
          color: "rgba(240,236,230,0.55)", fontSize: 11, textAlign: "center",
        }}>
          +80 XP to unlock Open Studio mode
        </div>
      </Card>

      {/* Subtle grain overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        opacity: 0.4,
      }} />
    </div>
  );
}
