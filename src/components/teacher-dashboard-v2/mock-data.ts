/* Phase 1 mock data — lifted verbatim from
 * docs/newlook/PYPX Student Dashboard/teacher_bold.jsx.
 * Replaced section-by-section in Phases 2-7 with real data wiring.
 */

export interface Program {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export const PROGRAMS: Program[] = [
  { id: "all", name: "All programs", color: "#0A0A0A", icon: "🏠" },
  { id: "design", name: "MYP Design", color: "#E86F2C", icon: "🛠" },
  { id: "pypx", name: "PYPX", color: "#9333EA", icon: "🌱" },
  { id: "service", name: "Service as Action", color: "#10B981", icon: "🤝" },
];

export const NAV: string[] = [
  "Dashboard",
  "Classes",
  "Units",
  "Toolkit",
  "Badges",
  "Alerts",
  "Students",
  "Library",
];

export interface NextClass {
  period: string;
  startsIn: number;
  time: string;
  room: string;
  class: string;
  color: string;
  colorDark: string;
  colorTint: string;
  title: string;
  sub: string;
  phase: string;
  phasePct: number;
  students: number;
  ready: number;
  ungraded: number;
  img: string;
}

export const NEXT: NextClass = {
  period: "Period 1",
  startsIn: 23,
  time: "9:00 AM",
  room: "D12",
  class: "7 Design",
  color: "#0EA5A4",
  colorDark: "#0F766E",
  colorTint: "#CCFBF1",
  title: "Biomimicry",
  sub: "Plastic pouch inspired by nature",
  phase: "Developing ideas",
  phasePct: 34,
  students: 18,
  ready: 14,
  ungraded: 3,
  img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=1100&fit=crop",
};

export interface ScheduleSlot {
  num: string;
  time: string;
  class: string;
  color: string;
  tint: string;
  unit: string;
  sub: string;
  state: "next" | "upcoming" | "done";
  progress: number;
  ungraded: number;
  note?: string;
}

export const SCHEDULE: ScheduleSlot[] = [
  { num: "01", time: "9:00",  class: "7 Design",         color: "#0EA5A4", tint: "#CCFBF1", unit: "Biomimicry",          sub: "Developing ideas · 18 students", state: "next",     progress: 34, ungraded: 3 },
  { num: "02", time: "10:15", class: "9 Design Science", color: "#10B981", tint: "#D1FAE5", unit: "CO2 Racer",           sub: "Testing · 16 students",          state: "upcoming", progress: 62, ungraded: 0 },
  { num: "03", time: "11:30", class: "10 Design",        color: "#E86F2C", tint: "#FED7AA", unit: "Interactive Pinball", sub: "Investigating · 14 students",    state: "upcoming", progress: 8,  ungraded: 7 },
  { num: "05", time: "14:00", class: "7 Design",         color: "#0EA5A4", tint: "#CCFBF1", unit: "Biomimicry",          sub: "Developing ideas · 18 students", state: "upcoming", progress: 34, ungraded: 3, note: "Lab booking" },
];

export interface Insight {
  bg: string;
  accent: string;
  text: string;
  tag: string;
  big: string;
  unit: string;
  body: string;
  who?: string[];
  count?: boolean;
  cta: string;
}

export const INSIGHTS: Insight[] = [
  {
    bg: "#FEE2E2", accent: "#DC2626", text: "#7F1D1D",
    tag: "Act now",
    big: "5",
    unit: "students stuck",
    body: "Marcus, Theo, Zara, Ava & Elena — no meaningful activity in 10+ days. Spread across Biomimicry and Coffee Table.",
    who: ["MJ", "TD", "ZA", "AS", "EM"],
    cta: "Review & message",
  },
  {
    bg: "#FEF3C7", accent: "#D97706", text: "#78350F",
    tag: "To grade",
    big: "15",
    unit: "pieces waiting",
    body: "Oldest is 10 days old. Most are in CO2 Racer (5) and Pinball (7). A focused session clears it in ~45 min.",
    count: true,
    cta: "Open queue",
  },
  {
    bg: "#DBEAFE", accent: "#2563EB", text: "#1E3A8A",
    tag: "Watch",
    big: "↓62%",
    unit: "keystroke drop",
    body: "4 students logged under 20 keystrokes this week in Design Journal. Typical baseline is 200+.",
    who: ["AS", "ZA", "RK", "NO"],
    cta: "See students",
  },
  {
    bg: "#D1FAE5", accent: "#059669", text: "#064E3B",
    tag: "Celebrate",
    big: "↑38%",
    unit: "Pinball surge",
    body: "7 students submitted research ahead of schedule — the highest voluntary output of any unit this term.",
    who: ["RK", "JC", "AS", "MC"],
    cta: "Send shout-out",
  },
];

export type BadgeKind = "pink-re" | "amber" | "gray";

export interface UnitCardData {
  id: string;
  title: string;
  kicker: string;
  classTag: string;
  color: string;
  tint: string;
  students: number;
  progress: number;
  img: string;
  due: string;
  badges: BadgeKind[];
}

export const UNITS: UnitCardData[] = [
  {
    id: "co2",
    title: "CO2 Racer",
    kicker: "Speed Through Science & Design",
    classTag: "10 Design", color: "#E86F2C", tint: "#FFEDD5",
    students: 3, progress: 2,
    img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=600&fit=crop",
    due: "Race day · Apr 28",
    badges: ["pink-re", "amber"],
  },
  {
    id: "biom",
    title: "Biomimicry",
    kicker: "Plastic pouch inspired by nature",
    classTag: "7 Design", color: "#0EA5A4", tint: "#CCFBF1",
    students: 1, progress: 0,
    img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=600&fit=crop",
    due: "Sketchbook · Apr 25",
    badges: ["amber"],
  },
  {
    id: "coffee",
    title: "Coffee Table",
    kicker: "Designing and building a coffee table",
    classTag: "10 Design", color: "#EC4899", tint: "#FCE7F3",
    students: 3, progress: 0,
    img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&h=600&fit=crop",
    due: "First prototype · May 3",
    badges: ["pink-re", "gray"],
  },
  {
    id: "pinball",
    title: "Pinball Machines",
    kicker: "Interactive design with electronics",
    classTag: "10 Design", color: "#9333EA", tint: "#E9D5FF",
    students: 3, progress: 2,
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=600&fit=crop",
    due: "Research · Apr 30",
    badges: [],
  },
];

export interface UnassignedClass {
  name: string;
  students: number;
  color: string;
}

export const UNASSIGNED: UnassignedClass[] = [
  { name: "Service LEEDers", students: 2, color: "#3B82F6" },
  { name: "8 Design",        students: 0, color: "#9333EA" },
  { name: "Grade 8 Design",  students: 1, color: "#06B6D4" },
];
