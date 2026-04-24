// Shared primitives — lifted from StudioLoom student UI kit and extended for PYPX G5.

const sl = {
  purple: "#9333EA", purpleDark: "#7E22CE", purpleDeep: "#6B21A8",
  brand: "#7B2FF2", violet: "#5C16C5",
  pink: "#FF3366", coral: "#FF6B6B",
  ink: "#1A1A2E", body: "#111827",
  fg2: "#6B7280", fg3: "#9CA3AF",
  border: "#E5E7EB", borderSub: "#F3F4F6",
  surface: "#FFFFFF", surfaceAlt: "#F8F9FA",
  // PYPX phase palette — pulled from accents + extended
  pypxYellow: "#FBBF24", pypxAmber: "#F59E0B",
  teal: "#14B8A6", green: "#10B981", blue: "#3B82F6", orange: "#E86F2C",
};

// ---------- Button ----------
function Button({ variant = "primary", size = "md", icon, iconRight, children, onClick, className = "", type = "button" }) {
  const v = {
    primary: "bg-[#9333EA] text-white hover:bg-[#7E22CE] active:bg-[#6B21A8] shadow-sm",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    ghost: "text-gray-600 hover:bg-gray-100",
    pypx: "text-[#1A1A2E] hover:brightness-105 shadow-sm",
    coral: "text-white hover:brightness-105 shadow-sm",
    dark: "bg-[#1A1A2E] text-white hover:bg-[#111827]",
  }[variant];
  const extra = variant === "pypx" ? { background: "linear-gradient(90deg,#FBBF24 0%,#FDE68A 100%)" } :
                 variant === "coral" ? { background: "linear-gradient(135deg,#FF3366 0%,#FF6B6B 100%)" } : {};
  const s = {
    xs: "px-2.5 py-1 text-[11px] rounded-md gap-1",
    sm: "px-3 py-1.5 text-xs rounded-md gap-1.5",
    md: "px-4 py-2 text-sm rounded-lg gap-2",
    lg: "px-5 py-2.5 text-sm rounded-lg gap-2",
    xl: "px-6 py-3.5 text-base rounded-xl gap-2.5",
  }[size];
  return (
    <button type={type} onClick={onClick} style={extra} className={`inline-flex items-center justify-center font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${v} ${s} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}

// ---------- Badge ----------
function Badge({ variant = "default", size = "md", children, className = "", style }) {
  const v = {
    default: "bg-gray-100 text-gray-700",
    primary: "bg-purple-100 text-purple-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
    pink: "bg-rose-100 text-rose-700",
    pypx: "bg-amber-100 text-amber-800",
    dark: "bg-[#1A1A2E] text-white",
    outline: "border border-gray-300 text-gray-700",
  }[variant];
  const s = { sm: "px-1.5 py-0.5 text-[10px]", md: "px-2 py-0.5 text-[11px]", lg: "px-2.5 py-1 text-xs" }[size];
  return <span style={style} className={`inline-flex items-center font-semibold rounded-full whitespace-nowrap ${v} ${s} ${className}`}>{children}</span>;
}

// ---------- Icon helpers ----------
const Icon = ({ d, size = 18, fill = "none", stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);
const IconChevronRight = ({ size = 16 }) => <Icon size={size} d="M9 18l6-6-6-6" />;
const IconChevronLeft = ({ size = 16 }) => <Icon size={size} d="M15 18l-6-6 6-6" />;
const IconArrowRight = ({ size = 16 }) => <Icon size={size} d="M5 12h14M13 6l6 6-6 6" />;
const IconPlus = ({ size = 16 }) => <Icon size={size} d="M12 5v14M5 12h14" />;
const IconCheck = ({ size = 16 }) => <Icon size={size} d="M20 6L9 17l-5-5" />;
const IconX = ({ size = 16 }) => <Icon size={size} d="M18 6L6 18M6 6l12 12" />;
const IconSparkles = ({ size = 16 }) => <Icon size={size} d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />;
const IconBookmark = ({ size = 16 }) => <Icon size={size} d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />;
const IconCalendar = ({ size = 16 }) => <Icon size={size} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>} />;
const IconClock = ({ size = 16 }) => <Icon size={size} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const IconUsers = ({ size = 16 }) => <Icon size={size} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />;
const IconBook = ({ size = 16 }) => <Icon size={size} d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5V21h15" />;
const IconVideo = ({ size = 16 }) => <Icon size={size} d={<><path d="M22 8l-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/></>} />;
const IconFile = ({ size = 16 }) => <Icon size={size} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />;
const IconFlag = ({ size = 16 }) => <Icon size={size} d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15" />;
const IconTarget = ({ size = 16 }) => <Icon size={size} d={<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>} />;
const IconCompass = ({ size = 16 }) => <Icon size={size} d={<><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5L13 13l-4.5 2.5L11 11z"/></>} />;
const IconSearch = ({ size = 16 }) => <Icon size={size} d={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>} />;
const IconBell = ({ size = 16 }) => <Icon size={size} d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 0 0-4 0v.3A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5M9 17a3 3 0 0 0 6 0" />;
const IconCircle = ({ size = 16 }) => <Icon size={size} d={<circle cx="12" cy="12" r="9"/>} />;
const IconCircleCheck = ({ size = 16 }) => <Icon size={size} d={<><circle cx="12" cy="12" r="9" fill="#10B981" stroke="#10B981"/><path d="M8 12l3 3 5-6" stroke="#fff"/></>} />;
const IconPlay = ({ size = 16 }) => <Icon size={size} d="M5 3l14 9-14 9z" fill="currentColor" stroke="none" />;
const IconLightbulb = ({ size = 16 }) => <Icon size={size} d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />;
const IconMessage = ({ size = 16 }) => <Icon size={size} d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />;
const IconExternal = ({ size = 14 }) => <Icon size={size} d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />;
const IconHome = ({ size = 16 }) => <Icon size={size} d="M3 12l9-9 9 9M5 10v10h14V10" />;
const IconGrid = ({ size = 16 }) => <Icon size={size} d={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>} />;
const IconSettings = ({ size = 16 }) => <Icon size={size} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>} />;

// ---------- Progress Circle ----------
function ProgressCircle({ pct = 0, size = 36, color = "#9333EA", track = "rgba(255,255,255,.4)", showLabel = true, textColor = "#1A1A2E" }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}/>
      {showLabel && <text x="50%" y="54%" textAnchor="middle" fontSize={size <= 24 ? 8 : 10} fontWeight="700" fill={textColor}>{pct}%</text>}
    </svg>
  );
}

// ---------- Card ----------
function Card({ children, className = "", onClick, hover = false, style = {} }) {
  return (
    <div onClick={onClick} style={style} className={`bg-white border border-gray-200 rounded-2xl shadow-sm ${hover ? "hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer" : ""} ${className}`}>
      {children}
    </div>
  );
}

// ---------- Section header ----------
function SectionHeader({ title, subtitle, action, onAction, icon }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="text-lg font-bold text-[#1A1A2E] flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <button onClick={onAction} className="text-xs font-semibold text-purple-700 hover:text-purple-900">{action} →</button>}
    </div>
  );
}

// ---------- Logo ----------
function Logo({ size = 28, dark = false, showText = true }) {
  return (
    <div className="flex items-center gap-2">
      <img src="assets/logo.svg" width={size} height={size} alt="StudioLoom"/>
      {showText && <span className={`font-extrabold text-[15px] tracking-tight ${dark ? "text-white" : "text-[#1A1A2E]"}`}>StudioLoom</span>}
    </div>
  );
}

Object.assign(window, {
  sl, Button, Badge, Icon, Card, SectionHeader, Logo, ProgressCircle,
  IconChevronRight, IconChevronLeft, IconArrowRight, IconPlus, IconCheck, IconX,
  IconSparkles, IconBookmark, IconCalendar, IconClock, IconUsers, IconBook,
  IconVideo, IconFile, IconFlag, IconTarget, IconCompass, IconSearch, IconBell,
  IconCircle, IconCircleCheck, IconPlay, IconLightbulb, IconMessage, IconExternal,
  IconHome, IconGrid, IconSettings,
});
