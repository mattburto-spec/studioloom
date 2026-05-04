/* Shared visual bits for the Tasks artboards */

const Dot = ({ color, size = 8 }) => (
  <span className="dot" style={{ background: color, width: size, height: size }} />
);

const CritPill = ({ k }) => {
  const map = { A: "var(--crit-a)", B: "var(--crit-b)", C: "var(--crit-c)", D: "var(--crit-d)" };
  return <span className="crit-pill" style={{ background: map[k] }}>{k}</span>;
};

const CritGhost = ({ k }) => {
  const map = { A: "var(--crit-a)", B: "var(--crit-b)", C: "var(--crit-c)", D: "var(--crit-d)" };
  return (
    <span
      className="crit-pill"
      style={{
        background: "transparent",
        color: map[k],
        border: `1.5px dashed ${map[k]}`,
        opacity: 0.7,
      }}
    >
      {k}
    </span>
  );
};

const Eyebrow = ({ children, style }) => (
  <div className="eyebrow" style={style}>{children}</div>
);

const Label = ({ children, hint, style }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 8, ...style }}>
    <span className="label">{children}</span>
    {hint && <span className="serif-it" style={{ fontSize: 12, color: "var(--ink-4)" }}>{hint}</span>}
  </div>
);

const StatusPill = ({ kind = "draft" }) => {
  const map = {
    draft:     { bg: "transparent", border: "1.5px dashed var(--ink-4)", color: "var(--ink-3)", text: "Draft" },
    published: { bg: "var(--ink)", border: "none", color: "var(--paper-card)", text: "Published" },
    graded:    { bg: "var(--ok-bg)", border: "none", color: "var(--ok)", text: "Graded" },
  };
  const m = map[kind];
  return (
    <span
      className="status-pill"
      style={{ background: m.bg, border: m.border, color: m.color }}
    >
      {kind === "draft" && <span className="dot" style={{ background: "var(--ink-4)", width: 6, height: 6 }} />}
      {m.text}
    </span>
  );
};

/* simple stroke icon */
const I = ({ d, size = 14, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
    <path d={d} />
  </svg>
);

const Plus    = (p) => <I d="M12 5v14M5 12h14" {...p}/>;
const Chevron = (p) => <I d="M9 18l6-6-6-6" {...p}/>;
const Caret   = (p) => <I d="M6 9l6 6 6-6" {...p}/>;
const Calendar= (p) => <I d="M3 8h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 2v4M16 2v4" {...p}/>;
const Doc     = (p) => <I d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 13h6M9 17h4" {...p}/>;
const Bolt    = (p) => <I d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" {...p}/>;
const Target  = (p) => <I d="M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" {...p}/>;
const Layers  = (p) => <I d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" {...p}/>;
const Mirror  = (p) => <I d="M12 3v18M5 7l-2 2 2 2M19 7l2 2-2 2M5 9h6M19 9h-6" {...p}/>;
const Lock    = (p) => <I d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" {...p}/>;
const Spark   = (p) => <I d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-5 4" {...p}/>;
const Wand    = (p) => <I d="M15 4l5 5L8 21l-5-5L15 4zM14 5l5 5M5 3v4M3 5h4M19 17v4M17 19h4" {...p}/>;
const Search  = (p) => <I d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5" {...p}/>;
const Clock   = (p) => <I d="M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" {...p}/>;
const ArrowR  = (p) => <I d="M5 12h14M13 5l7 7-7 7" {...p}/>;

/* category dot map for clarity in chips */
const CAT = {
  response: "var(--cat-response)",
  content:  "var(--cat-content)",
  toolkit:  "var(--cat-toolkit)",
  assessment:    "var(--cat-assessment)",
  collaboration: "var(--cat-collaboration)",
};

Object.assign(window, {
  Dot, CritPill, CritGhost, Eyebrow, Label, StatusPill, I,
  Plus, Chevron, Caret, Calendar, Doc, Bolt, Target, Layers,
  Mirror, Lock, Spark, Wand, Search, Clock, ArrowR, CAT,
});
