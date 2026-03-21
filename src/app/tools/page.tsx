import Link from "next/link";

const TOOLS = [
  {
    title: "Design Thinking Toolkit",
    description:
      "42 visual thinking tools for every design process phase. Interactive AI-powered tools with Socratic feedback. Works with IB MYP, GCSE DT, A-Level, ACARA, PLTW, d.school, IDEO, and Double Diamond.",
    href: "/toolkit",
    badge: "42 tools",
    badgeColor: "#7B2FF2",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    gradient: "from-purple-50 to-indigo-50",
    borderColor: "border-purple-200",
  },
  {
    title: "Workshop Safety Badges",
    description:
      "Digital safety certification for design workshops. 7 badges across 2 tiers — from general workshop safety to specialist tools like laser cutters, wood, metal, plastics, and electronics. Run as a class with a session code or let students self-certify.",
    href: "/tools/safety",
    badge: "7 badges",
    badgeColor: "#059669",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    gradient: "from-emerald-50 to-green-50",
    borderColor: "border-emerald-200",
  },
  {
    title: "Report Writer",
    description:
      "AI-powered bulk report comment generator. Upload your class list, rate students on skills and projects, and generate personalised report comments in seconds. Supports IB MYP, GCSE DT, ACARA, and general D&T frameworks.",
    href: "/tools/report-writer",
    badge: "AI-powered",
    badgeColor: "#2563EB",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    gradient: "from-blue-50 to-sky-50",
    borderColor: "border-blue-200",
  },
];

export default function ToolsHubPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Free Teaching Tools
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Everything you need for your Design &amp; Technology classroom — no account required.
        </p>
      </div>

      {/* Tool cards */}
      <div className="grid gap-5">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className={`group block bg-gradient-to-br ${tool.gradient} rounded-xl border ${tool.borderColor} p-6 hover:shadow-lg transition-all hover:-translate-y-0.5`}
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center border border-gray-100">
                {tool.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#7B2FF2] transition">
                    {tool.title}
                  </h2>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full text-white shrink-0"
                    style={{ backgroundColor: tool.badgeColor }}
                  >
                    {tool.badge}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {tool.description}
                </p>
              </div>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-gray-300 group-hover:text-[#7B2FF2] group-hover:translate-x-1 transition-all mt-1"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="text-center mt-12 pt-8 border-t border-gray-200">
        <p className="text-sm text-gray-400 mb-3">
          Want the full platform? AI unit builder, student tracking, portfolio system, and more.
        </p>
        <Link
          href="/teacher/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-lg transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
        >
          Get Started — Free for Teachers
        </Link>
      </div>
    </div>
  );
}
