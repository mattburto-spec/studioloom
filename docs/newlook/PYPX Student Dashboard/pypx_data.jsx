// PYPX data layer — realistic G5 student state. Single source of truth.

const PYPX_DATA = {
  student: {
    name: "Aarav Mehta",
    firstName: "Aarav",
    initials: "AM",
    grade: "G5",
    mentor: "Ms. Okafor",
  },
  project: {
    title: "Why do birds disappear from our school garden?",
    centralIdea: "Living things depend on the spaces humans design.",
    lineOfInquiry: "Human impact · Habitats · Responsibility",
    transdisciplinaryTheme: "Sharing the Planet",
    exhibitionDate: "Thu 21 May",
    daysLeft: 31,
    overallPct: 46,
    currentPhase: "findout", // wonder | findout | make | share | reflect
  },
  phases: [
    { id: "wonder",  label: "Wonder",    sub: "Pick your question", pct: 100, color: "#FBBF24", icon: "lightbulb" },
    { id: "findout", label: "Find out",  sub: "Research & talk to experts", pct: 65, color: "#3B82F6", icon: "search" },
    { id: "make",    label: "Make",      sub: "Build your action / product", pct: 20, color: "#14B8A6", icon: "hammer" },
    { id: "share",   label: "Share",     sub: "Exhibition day", pct: 0, color: "#FF3366", icon: "flag" },
    { id: "reflect", label: "Reflect",   sub: "What did you learn?", pct: 0, color: "#8B2FC9", icon: "sparkles" },
  ],
  // The ONE next step — hero card content
  nextStep: {
    title: "Interview Mr. Patel (school gardener)",
    why: "He's seen the garden for 12 years. He'll know what changed.",
    phase: "findout",
    due: "Thursday",
    dueIn: "in 2 days",
    estMinutes: 20,
    skill: "How to interview an expert",
    steps: [
      { t: "Write 5 open questions", done: true },
      { t: "Practice with a partner", done: true },
      { t: "Book a 15-min slot with Mr. Patel", done: false, current: true },
      { t: "Record the interview (ask first!)", done: false },
      { t: "Write 3 things you learned", done: false },
    ],
  },
  // Project board tasks — for kanban/phases/checklist tweaks
  tasks: [
    { id: 1, title: "Pick my big question",                phase: "wonder",  status: "done", due: "Apr 1" },
    { id: 2, title: "Research: bird species in our area",  phase: "findout", status: "done", due: "Apr 8" },
    { id: 3, title: "Map where birds used to be seen",     phase: "findout", status: "done", due: "Apr 12" },
    { id: 4, title: "Interview Mr. Patel (gardener)",      phase: "findout", status: "doing", due: "Apr 24", next: true },
    { id: 5, title: "Survey Year 3–5 about bird sightings",phase: "findout", status: "doing", due: "Apr 28" },
    { id: 6, title: "Sketch 3 bird-feeder designs",        phase: "make",    status: "todo",  due: "May 2" },
    { id: 7, title: "Build prototype feeder from recycled",phase: "make",    status: "todo",  due: "May 8" },
    { id: 8, title: "Test feeder in garden for 5 days",    phase: "make",    status: "todo",  due: "May 14" },
    { id: 9, title: "Make exhibition board + poster",      phase: "share",   status: "todo",  due: "May 19" },
    { id: 10,title: "Practice 3-min presentation",         phase: "share",   status: "todo",  due: "May 20" },
    { id: 11,title: "PYPX Exhibition Day",                 phase: "share",   status: "todo",  due: "May 21", milestone: true },
    { id: 12,title: "Write reflection journal",            phase: "reflect", status: "todo",  due: "May 23" },
  ],
  milestones: [
    { date: "Apr 22", day: "Tue", label: "Today", today: true },
    { date: "Apr 24", day: "Thu", label: "Interview Mr. Patel", type: "meeting", pip: "#3B82F6" },
    { date: "Apr 25", day: "Fri", label: "Mentor check-in", type: "mentor", pip: "#9333EA" },
    { date: "Apr 28", day: "Mon", label: "Survey due", type: "task", pip: "#F59E0B" },
    { date: "May 2",  day: "Fri", label: "Sketches due", type: "task", pip: "#F59E0B" },
    { date: "May 8",  day: "Thu", label: "Prototype built", type: "milestone", pip: "#14B8A6" },
    { date: "May 14", day: "Wed", label: "Testing ends", type: "task", pip: "#F59E0B" },
    { date: "May 19", day: "Mon", label: "Board & poster", type: "task", pip: "#F59E0B" },
    { date: "May 21", day: "Thu", label: "EXHIBITION DAY", type: "big", pip: "#FF3366" },
  ],
  // Mini-courses in the Skills Library
  skillsLibrary: [
    { id: "interview", title: "How to interview an expert", min: 15, lessons: 4, enrolled: true, progress: 50, color: "#3B82F6", icon: "microphone", tag: "Talking to people", recommended: true },
    { id: "survey",    title: "Build a survey that works",  min: 20, lessons: 5, enrolled: true, progress: 20, color: "#14B8A6", icon: "chart", tag: "Research", recommended: true },
    { id: "sketch",    title: "Sketch your ideas quickly",  min: 25, lessons: 6, enrolled: false, progress: 0, color: "#E86F2C", icon: "pencil", tag: "Making", recommended: true },
    { id: "poster",    title: "Design a poster that pops",  min: 30, lessons: 7, enrolled: false, progress: 0, color: "#FF3366", icon: "paintbrush", tag: "Sharing" },
    { id: "citing",    title: "Where did I get that fact?", min: 10, lessons: 3, enrolled: false, progress: 0, color: "#8B2FC9", icon: "microscope", tag: "Research" },
    { id: "present",   title: "Present without being nervous", min: 20, lessons: 5, enrolled: false, progress: 0, color: "#FBBF24", icon: "lightning", tag: "Sharing" },
    { id: "time",      title: "Plan your week",             min: 15, lessons: 4, enrolled: false, progress: 0, color: "#10B981", icon: "seedling", tag: "Staying on track" },
    { id: "feedback",  title: "Give & receive feedback",    min: 15, lessons: 4, enrolled: false, progress: 0, color: "#F472B6", icon: "puzzle", tag: "Teamwork" },
    { id: "recycle",   title: "Build with recycled materials", min: 30, lessons: 6, enrolled: false, progress: 0, color: "#34D399", icon: "hammer", tag: "Making" },
    { id: "photo",     title: "Take photos for your project", min: 10, lessons: 3, enrolled: false, progress: 0, color: "#A78BFA", icon: "camera", tag: "Sharing" },
    { id: "measure",   title: "Measuring & data",           min: 20, lessons: 5, enrolled: false, progress: 0, color: "#818CF8", icon: "ruler", tag: "Research" },
    { id: "coding",    title: "Build a tiny website",       min: 45, lessons: 8, enrolled: false, progress: 0, color: "#7B2FF2", icon: "laptop", tag: "Making" },
  ],
  // Resource Library
  resources: {
    people: [
      { name: "Mr. Patel",      role: "School gardener",   avail: "Tue/Thu lunch",      tag: "On campus", relevant: true },
      { name: "Dr. Lin",        role: "Ornithologist, CityU", avail: "Video call, book 1 week ahead", tag: "Expert", relevant: true },
      { name: "Ms. Harper",     role: "Year 3 teacher",    avail: "Email for survey access", tag: "On campus" },
      { name: "Sam (Y10)",      role: "Eco-club lead",     avail: "Tue after school",   tag: "Student mentor" },
      { name: "Priya Das",      role: "Parent · wildlife photographer", avail: "Email via office", tag: "Parent expert" },
      { name: "Ms. Okafor",     role: "Your mentor",       avail: "Fri 10:30 check-ins", tag: "Mentor", relevant: true },
    ],
    readings: [
      { title: "What birds need: 3 basics",   src: "Audubon Kids", mins: 6, relevant: true },
      { title: "How gardens change over time", src: "Nat Geo Young", mins: 9 },
      { title: "Interviewing adults: a Y5 guide", src: "StudioLoom library", mins: 5, relevant: true },
      { title: "Why habitats disappear",       src: "BBC Bitesize",  mins: 8 },
      { title: "Choosing a PYPX question",     src: "IB Primary",    mins: 12 },
    ],
    videos: [
      { title: "Build a bird feeder from a milk carton", dur: "4:12", src: "YouTube · kid-safe" },
      { title: "Kids ask an expert — the format",        dur: "3:30", src: "StudioLoom", relevant: true },
      { title: "What is biodiversity?",                  dur: "6:05", src: "TED-Ed" },
    ],
    templates: [
      { title: "Interview question planner",  type: "worksheet", relevant: true },
      { title: "Weekly project planner",      type: "worksheet" },
      { title: "Exhibition poster template",  type: "canva" },
      { title: "Citation cheat sheet",        type: "pdf" },
      { title: "Survey builder",              type: "form" },
    ],
  },
  // Kit mentor nudges keyed to the student's current state
  kitNudges: [
    { variant: "encouraging", msg: "You've done 2 of 3 steps to prep the interview. What's one question you still feel unsure about?", chips: ["I'm not sure", "Show me examples", "I'm ready"] },
    { variant: "thinking", msg: "Your survey has 3 questions. What would a younger kid not understand?", chips: ["Read them aloud", "Make them simpler"] },
    { variant: "gentle", msg: "Meeting Mr. Patel is in 2 days. Want to practice one more time?", chips: ["Yes, practice", "I'm good"] },
  ],
};

window.PYPX_DATA = PYPX_DATA;
