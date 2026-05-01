import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="6" fill="#7B2FF2" />
              <rect x="2" y="8" width="28" height="5" rx="2.5" fill="white" />
              <rect x="2" y="19" width="28" height="5" rx="2.5" fill="white" />
              <rect x="8" y="2" width="5" height="28" rx="2.5" fill="white" />
              <rect x="19" y="2" width="5" height="28" rx="2.5" fill="white" />
            </svg>
            <span className="text-base font-semibold">StudioLoom</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-gray-900 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900 transition">Terms</Link>
            <Link href="/" className="hover:text-gray-900 transition">Home</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <article
          className={[
            "max-w-none text-gray-800",
            "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:tracking-tight",
            "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3",
            "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2",
            "[&_p]:leading-relaxed [&_p]:my-3 [&_p]:text-[15px]",
            "[&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:space-y-1",
            "[&_li]:text-[15px] [&_li]:leading-relaxed",
            "[&_a]:text-purple-700 hover:[&_a]:underline",
            "[&_strong]:font-semibold [&_strong]:text-gray-900",
          ].join(" ")}
        >
          {children}
        </article>
      </main>
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 text-xs text-gray-400 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <span>© {new Date().getFullYear()} StudioLoom</span>
          <span>Questions? <a href="mailto:hello@studioloom.org" className="text-gray-500 hover:text-gray-800">hello@studioloom.org</a></span>
        </div>
      </footer>
    </div>
  );
}
