// Hub data — multi-program StudioLoom shell.

const HUB_DATA = {
  programs: [
    { id: "pypx",     name: "PYPX",             color: "#9333EA", icon: "🌱", framework: "PYP" },
    { id: "design",   name: "MYP Design",       color: "#E86F2C", icon: "🛠️", framework: "MYP" },
    { id: "service",  name: "Service as Action",color: "#10B981", icon: "🤝", framework: "MYP" },
    { id: "pp",       name: "Personal Project", color: "#3B82F6", icon: "🧭", framework: "MYP" },
    { id: "cas",      name: "CAS",              color: "#FF3366", icon: "🎭", framework: "DP" },
    { id: "genproj",  name: "Capstone",         color: "#0EA5A4", icon: "🏔️", framework: "Generic" },
  ],
  teachers: {
    amara: {
      id: "amara", name: "Ms. Amara Okafor", initials: "AO", role: "Primary teacher",
      programs: [
        { programId: "pypx", role: "Lead teacher", cohort: "Grade 5 Blue", count: 18, urgent: 4, avg: 52, href: "PYPX Teacher Dashboard.html" },
      ],
    },
    harper: {
      id: "harper", name: "Ms. Devi Harper", initials: "DH", role: "MYP Design & PP supervisor",
      programs: [
        { programId: "design",  role: "Subject teacher", cohort: "Grade 8 Design", count: 32, urgent: 5, avg: 64, href: "#" },
        { programId: "pp",      role: "Supervisor",      cohort: "Grade 10 PP",    count: 4,  urgent: 1, avg: 71, href: "#" },
        { programId: "service", role: "Co-advisor",      cohort: "Grade 8 SA",     count: 32, urgent: 2, avg: 48, href: "#" },
      ],
    },
    riel: {
      id: "riel", name: "Mr. Sana Riel", initials: "SR", role: "DP coordinator",
      programs: [
        { programId: "cas",     role: "Coordinator",    cohort: "DP1 & DP2", count: 68, urgent: 9, avg: 58, href: "#" },
        { programId: "pp",      role: "Supervisor",     cohort: "Grade 10", count: 2,  urgent: 0, avg: 80, href: "#" },
        { programId: "design",  role: "Subject teacher",cohort: "Grade 9 Design", count: 28, urgent: 3, avg: 61, href: "#" },
        { programId: "genproj", role: "Mentor",         cohort: "HS Capstone", count: 5, urgent: 1, avg: 55, href: "#" },
      ],
    },
  },
  students: {
    aarav: {
      id: "aarav", name: "Aarav Mehta", initials: "AM", grade: "Grade 5",
      programs: [
        { programId: "pypx", cohort: "G5 Blue · PYPX", progress: 46, phase: "Find out", nextStep: "Interview Mr. Patel about the garden", nextDue: "Thu", href: "PYPX Dashboard.html" },
      ],
    },
    theo: {
      id: "theo", name: "Theo Dubois", initials: "TD", grade: "Grade 8",
      programs: [
        { programId: "design",  cohort: "MYP Design · G8",  progress: 62, phase: "Developing ideas",    nextStep: "Draft 3 concept sketches for the prototype", nextDue: "Tomorrow", href: "#", urgency: "high" },
        { programId: "service", cohort: "Service · G8",     progress: 38, phase: "Acting",              nextStep: "Log Saturday's litter pickup hours",          nextDue: "Mon",     href: "#" },
        { programId: "pp",      cohort: "Personal Project", progress: 8,  phase: "Investigating",       nextStep: "Pick a topic for your Personal Project",      nextDue: "Next week", href: "#", isNew: true },
      ],
    },
    maya: {
      id: "maya", name: "Maya Okonkwo", initials: "MO", grade: "DP Year 1",
      programs: [
        { programId: "cas",   cohort: "CAS · DP1",       progress: 55, phase: "Experiences",         nextStep: "Upload reflection from Arts showcase",      nextDue: "Today", href: "#", urgency: "high" },
        { programId: "pp",    cohort: "EE (2026)",        progress: 42, phase: "Research",            nextStep: "Meet with supervisor · Thu 3:30pm",         nextDue: "Thu",   href: "#" },
        { programId: "design",cohort: "Design Tech · DP",  progress: 70, phase: "Solution evaluation", nextStep: "Write evaluation for prototype v2",         nextDue: "Fri",   href: "#" },
      ],
    },
  },
};

window.HUB_DATA = HUB_DATA;
