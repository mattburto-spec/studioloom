import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-dark-blue text-white">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <nav className="flex items-center justify-between mb-20">
          <span className="text-xl font-bold tracking-tight">Questerra</span>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-white/70 hover:text-white transition"
            >
              Student Login
            </Link>
            <Link
              href="/teacher/login"
              className="px-4 py-2 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition border border-white/20"
            >
              Teacher Portal
            </Link>
          </div>
        </nav>

        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            The MYP Design
            <br />
            <span className="text-accent-blue">Process Platform</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-xl mx-auto leading-relaxed">
            Guide students through all 16 steps of the design cycle with
            built-in scaffolding, progress tracking, and planning tools.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-3.5 bg-accent-blue text-white rounded-xl font-medium hover:bg-accent-blue/90 transition text-lg"
            >
              Student Login
            </Link>
            <Link
              href="/teacher/login"
              className="px-8 py-3.5 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition border border-white/20 text-lg"
            >
              Teacher Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white text-text-primary">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-center mb-3">
            Built for MYP Design Teachers
          </h2>
          <p className="text-text-secondary text-center mb-14 max-w-lg mx-auto">
            Everything you need to deliver the design cycle — from Criterion A
            through D — in one platform.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🚇",
                title: "Subway Navigation",
                desc: "16-page design cycle with color-coded progress tracking across all four criteria.",
                color: "#2E86AB",
              },
              {
                icon: "🌐",
                title: "ELL Support",
                desc: "Three scaffolding levels with sentence starters, vocab warm-ups, and extension prompts.",
                color: "#2DA05E",
              },
              {
                icon: "📊",
                title: "Progress Dashboard",
                desc: "Real-time student progress grid. Click any cell to view responses instantly.",
                color: "#E86F2C",
              },
              {
                icon: "🎤",
                title: "Multiple Response Types",
                desc: "Text, voice recording, image upload, and sketch canvas for Universal Design.",
                color: "#8B2FC9",
              },
              {
                icon: "📋",
                title: "Planning Tools",
                desc: "Built-in Kanban board and timer to help students manage their design process.",
                color: "#2E86AB",
              },
              {
                icon: "🔑",
                title: "Simple Student Login",
                desc: "No passwords needed. Students log in with a class code and their name.",
                color: "#2DA05E",
              },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
                  style={{ backgroundColor: feature.color + "15" }}
                >
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Design Cycle */}
      <div className="bg-surface-alt text-text-primary">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-center mb-12">
            The Complete Design Cycle
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { letter: "A", name: "Inquiring & Analysing", color: "#2E86AB", pages: ["Identify need", "Research plan", "Analyse products", "Design brief"] },
              { letter: "B", name: "Developing Ideas", color: "#2DA05E", pages: ["Specification", "Design ideas", "Chosen design", "Planning drawings"] },
              { letter: "C", name: "Creating the Solution", color: "#E86F2C", pages: ["Plan with resources", "Technical skills", "Follow the plan", "Explain changes"] },
              { letter: "D", name: "Evaluating", color: "#8B2FC9", pages: ["Testing methods", "Evaluate success", "Improvements", "Impact"] },
            ].map((criterion) => (
              <div
                key={criterion.letter}
                className="bg-white rounded-xl p-5 border-t-3"
                style={{ borderTopColor: criterion.color, borderTopWidth: 3 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: criterion.color, color: "#fff" }}
                  >
                    {criterion.letter}
                  </span>
                  <span className="text-xs font-medium text-text-secondary">
                    {criterion.name}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {criterion.pages.map((page, i) => (
                    <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: criterion.color }}
                      >
                        {criterion.letter}{i + 1}
                      </span>
                      {page}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-dark-blue text-white/40 text-center py-8 text-sm">
        <p>Questerra — MYP Design Process Platform</p>
      </div>
    </div>
  );
}
