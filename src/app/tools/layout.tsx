import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Free Teaching Tools — Questerra",
  description:
    "Free AI-powered tools for Design & Technology teachers. Generate marking comments, write reports, and more.",
};

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{
                background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
              }}
            >
              Q
            </div>
            <span className="font-semibold text-gray-900">Questerra</span>
            <span className="text-xs text-gray-400 ml-1 hidden sm:inline">
              Free Teaching Tools
            </span>
          </Link>
          <Link
            href="/teacher/login"
            className="text-sm font-medium text-[#7B2FF2] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-3">
          <p className="text-sm text-gray-500">
            Built by{" "}
            <Link href="/" className="text-[#7B2FF2] hover:underline">
              Questerra
            </Link>{" "}
            — AI-powered learning for MYP Design students
          </p>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Questerra. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
