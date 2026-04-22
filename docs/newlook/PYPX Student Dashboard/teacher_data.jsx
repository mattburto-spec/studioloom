// Teacher data — 18 students in Grade 5 PYPX cohort, Ms. Okafor's class.

const TEACHER_DATA = {
  teacher: { name: "Ms. Amara Okafor", initials: "AO", cohort: "Grade 5 Blue · PYPX 2026", daysToExhibition: 31, exhibitionDate: "Thu 21 May" },
  phases: [
    { id: "wonder",  label: "Wonder",   color: "#FBBF24" },
    { id: "findout", label: "Find out", color: "#3B82F6" },
    { id: "make",    label: "Make",     color: "#14B8A6" },
    { id: "share",   label: "Share",    color: "#FF3366" },
    { id: "reflect", label: "Reflect",  color: "#8B2FC9" },
  ],
  // 18 students, varied progress
  students: [
    { id: 1, name: "Aarav Mehta", topic: "Birds disappearing from school garden", phase: "findout", pct: 46, mood: "great", lastCheckin: "Yesterday", blocker: null, flag: null, tasksDone: 5, tasksTotal: 12, humanMentor: "Dr. Lin", aiMentor: "Kit · Encouraging" },
    { id: 2, name: "Mei Chen", topic: "Why is our cafeteria so loud?", phase: "make", pct: 62, mood: "great", lastCheckin: "Today", blocker: null, flag: null, tasksDone: 7, tasksTotal: 11, humanMentor: "Mr. Patel", aiMentor: "Kit · Thinking" },
    { id: 3, name: "Jaylen Brooks", topic: "Where does our food waste go?", phase: "findout", pct: 38, mood: "stuck", lastCheckin: "2 days ago", blocker: "Couldn't find what I needed", flag: "stuck", tasksDone: 4, tasksTotal: 11, humanMentor: null, aiMentor: "Kit · Gentle" },
    { id: 4, name: "Priya Sharma", topic: "Stray dogs in our neighborhood", phase: "make", pct: 70, mood: "great", lastCheckin: "Today", blocker: null, flag: null, tasksDone: 8, tasksTotal: 12, humanMentor: "Ms. Harper", aiMentor: "Kit · Excited" },
    { id: 5, name: "Diego Ramos", topic: "Plastic in the ocean near us", phase: "findout", pct: 50, mood: "ok", lastCheckin: "Today", blocker: null, flag: null, tasksDone: 5, tasksTotal: 10, humanMentor: "Dr. Lin", aiMentor: "Kit · Thinking" },
    { id: 6, name: "Aisha Khan", topic: "Kids who skip breakfast", phase: "wonder", pct: 18, mood: "stuck", lastCheckin: "4 days ago", blocker: "Question was too big", flag: "behind", tasksDone: 2, tasksTotal: 11, humanMentor: null, aiMentor: "Kit · Gentle" },
    { id: 7, name: "Lucas Ferreira", topic: "Why do some kids feel lonely at recess?", phase: "make", pct: 58, mood: "ok", lastCheckin: "Today", blocker: null, flag: null, tasksDone: 6, tasksTotal: 12, humanMentor: "Ms. Okafor", aiMentor: "Kit · Encouraging" },
    { id: 8, name: "Sofia Rossi", topic: "Where does our water come from?", phase: "findout", pct: 55, mood: "great", lastCheckin: "Yesterday", blocker: null, flag: null, tasksDone: 6, tasksTotal: 11, humanMentor: "Mr. Patel", aiMentor: "Kit · Thinking" },
    { id: 9, name: "Kai Tanaka", topic: "How screens affect sleep", phase: "make", pct: 65, mood: "great", lastCheckin: "Today", blocker: null, flag: null, tasksDone: 7, tasksTotal: 12, humanMentor: "Priya Das", aiMentor: "Kit · Excited" },
    { id: 10, name: "Zara Ali", topic: "Why do we waste paper at school?", phase: "findout", pct: 42, mood: "ok", lastCheckin: "Yesterday", blocker: null, flag: null, tasksDone: 5, tasksTotal: 11, humanMentor: "Sam (Y10)", aiMentor: "Kit · Gentle" },
    { id: 11, name: "Marcus Johnson", topic: "Bees and pollination at school", phase: "wonder", pct: 22, mood: "stuck", lastCheckin: "5 days ago", blocker: "Didn't understand", flag: "behind", tasksDone: 2, tasksTotal: 11, humanMentor: null, aiMentor: "Kit · Gentle" },
    { id: 12, name: "Emma Williams", topic: "Why kids feel nervous talking to adults", phase: "share", pct: 85, mood: "great", lastCheckin: "Today", blocker: null, flag: "ahead", tasksDone: 10, tasksTotal: 12, humanMentor: "Ms. Harper", aiMentor: "Kit · Excited" },
    { id: 13, name: "Noah Kim", topic: "Plants that clean the air", phase: "make", pct: 55, mood: "ok", lastCheckin: "Yesterday", blocker: null, flag: null, tasksDone: 6, tasksTotal: 11, humanMentor: "Dr. Lin", aiMentor: "Kit · Thinking" },
    { id: 14, name: "Layla Ibrahim", topic: "Why don't more people ride bikes?", phase: "findout", pct: 48, mood: "great", lastCheckin: "Today", blocker: null, flag: null, tasksDone: 5, tasksTotal: 11, humanMentor: "Sam (Y10)", aiMentor: "Kit · Encouraging" },
    { id: 15, name: "Ethan Rivera", topic: "Stray cats and rats in the alley", phase: "findout", pct: 40, mood: "stuck", lastCheckin: "3 days ago", blocker: "Ran out of time", flag: "stuck", tasksDone: 4, tasksTotal: 11, humanMentor: "Ms. Harper", aiMentor: "Kit · Gentle" },
    { id: 16, name: "Hannah Goldberg", topic: "Why kids quit sports", phase: "make", pct: 60, mood: "great", lastCheckin: "Today", blocker: null, flag: null, tasksDone: 7, tasksTotal: 12, humanMentor: "Priya Das", aiMentor: "Kit · Excited" },
    { id: 17, name: "Yuki Nakamura", topic: "Why we throw away food at lunch", phase: "findout", pct: 52, mood: "ok", lastCheckin: "Yesterday", blocker: null, flag: null, tasksDone: 6, tasksTotal: 11, humanMentor: "Mr. Patel", aiMentor: "Kit · Thinking" },
    { id: 18, name: "Theo Dubois", topic: "Why some kids can't read well", phase: "make", pct: 68, mood: "great", lastCheckin: "Today", blocker: null, flag: "ahead", tasksDone: 8, tasksTotal: 12, humanMentor: "Ms. Okafor", aiMentor: "Kit · Encouraging" },
  ],
  checkins: [
    { id: 1, studentId: 3,  name: "Jaylen Brooks",    when: "2h ago",  mood: "stuck",  summary: "Couldn't find data on where school food waste actually goes. Asked for help.", blocker: "Couldn't find what I needed", finished: [] },
    { id: 2, studentId: 11, name: "Marcus Johnson",   when: "Yesterday", mood: "stuck", summary: "Struggled to frame the bee question. Wants to narrow it down with Ms. Okafor.", blocker: "Didn't understand", finished: [] },
    { id: 3, studentId: 15, name: "Ethan Rivera",     when: "Yesterday", mood: "stuck", summary: "Ran out of time after lunch — didn't start the map yet.", blocker: "Ran out of time", finished: [] },
    { id: 4, studentId: 6,  name: "Aisha Khan",       when: "2 days ago",mood: "stuck", summary: "Big question too broad. Wants to meet to pick something smaller.", blocker: "Question was too big", finished: [] },
    { id: 5, studentId: 12, name: "Emma Williams",    when: "Today",     mood: "great", summary: "Finished the poster and rehearsed once. Ready for the dry run.", blocker: null, finished: ["Poster", "Rehearsal"] },
    { id: 6, studentId: 2,  name: "Mei Chen",         when: "Today",     mood: "great", summary: "Interview with cafeteria manager went well. Has new ideas for the prototype.", blocker: null, finished: ["Interview"] },
    { id: 7, studentId: 18, name: "Theo Dubois",      when: "Today",     mood: "great", summary: "Prototype of reading app mockup is done. Wants feedback from Y3.", blocker: null, finished: ["Prototype v1"] },
    { id: 8, studentId: 9,  name: "Kai Tanaka",       when: "Today",     mood: "great", summary: "Survey responses (82) analyzed. Writing up findings.", blocker: null, finished: ["Survey analysis"] },
    { id: 9, studentId: 1,  name: "Aarav Mehta",      when: "Today",     mood: "great", summary: "Booked the interview with Mr. Patel for Thursday.", blocker: null, finished: ["Booking"] },
    { id: 10,studentId: 4,  name: "Priya Sharma",     when: "Today",     mood: "great", summary: "Visited animal shelter. Got permission to include photos in exhibition.", blocker: null, finished: ["Site visit", "Permission"] },
  ],
  resourceRequests: [
    { id: 1, studentId: 3,  name: "Jaylen Brooks",   ask: "Can I talk to someone who works at the landfill?",   type: "Expert",   when: "1h ago",  status: "pending" },
    { id: 2, studentId: 6,  name: "Aisha Khan",      ask: "Help picking my question — it's too big",            type: "Mentoring",when: "3h ago",  status: "pending" },
    { id: 3, studentId: 11, name: "Marcus Johnson",  ask: "Book on bees for kids?",                             type: "Reading",  when: "Yesterday", status: "pending" },
    { id: 4, studentId: 15, name: "Ethan Rivera",    ask: "Permission slip to walk around the neighborhood",    type: "Logistics",when: "Yesterday", status: "pending" },
    { id: 5, studentId: 8,  name: "Sofia Rossi",     ask: "Someone from the water treatment plant",             type: "Expert",   when: "2 days ago", status: "approved", note: "Dr. Lin connected." },
    { id: 6, studentId: 10, name: "Zara Ali",        ask: "Video about paper recycling",                        type: "Video",    when: "3 days ago", status: "approved", note: "Added to library." },
    { id: 7, studentId: 14, name: "Layla Ibrahim",   ask: "Can I survey parents at drop-off?",                  type: "Logistics",when: "Today",    status: "pending" },
  ],
};

window.TEACHER_DATA = TEACHER_DATA;
