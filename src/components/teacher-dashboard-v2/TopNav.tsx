"use client";

import { useState } from "react";
import { I } from "./icons";
import { PROGRAMS, NAV } from "./mock-data";

interface TopNavProps {
  scope: string;
  onScope: (id: string) => void;
  /** Phase 2+ — teacher initials for avatar. Defaults to "MG" until wired. */
  initials?: string;
}

export function TopNav({ scope, onScope, initials = "MG" }: TopNavProps) {
  const [open, setOpen] = useState(false);
  const cur = PROGRAMS.find((p) => p.id === scope) ?? PROGRAMS[0];

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg)]/80 backdrop-blur-lg border-b border-[var(--hair)]">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[var(--ink)] flex items-center justify-center text-white display text-[15px]">
            #
          </div>
          <div className="display text-[17px] leading-none">StudioLoom</div>
        </div>

        <div className="w-px h-6 bg-[var(--hair)] mx-1" />

        {/* Scope chip — Phase 1 stub. Will become class-filter in Phase 2. */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 bg-white border border-[var(--hair)] rounded-full pl-2 pr-3 py-1.5 hover:shadow-sm transition"
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[12px]"
              style={{ background: `${cur.color}1a` }}
            >
              {cur.icon}
            </span>
            <span className="text-[12.5px] font-bold">{cur.name}</span>
            <span className="text-[var(--ink-3)]">
              <I name="chev" size={12} s={2.5} />
            </span>
          </button>
          {open && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl card-shadow-lg w-64 p-1.5">
                {PROGRAMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onScope(p.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition ${
                      scope === p.id ? "bg-[var(--bg)]" : "hover:bg-[var(--bg)]"
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[13px]"
                      style={{ background: `${p.color}1a` }}
                    >
                      {p.icon}
                    </span>
                    <span className="flex-1 text-[12.5px] font-bold">
                      {p.name}
                    </span>
                    {scope === p.id && <I name="check" size={13} s={2.5} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Nav — Phase 1 stub. Real nav items wired in Phase 2. */}
        <nav className="flex items-center gap-0.5 ml-2">
          {NAV.map((n, i) => (
            <button
              key={n}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition ${
                i === 0
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--ink-2)] hover:bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Right */}
        <button className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)]">
          <I name="search" size={16} />
        </button>
        <button className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)] relative">
          <I name="bell" size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E86F2C] border-2 border-[var(--bg)]" />
        </button>
        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9333EA] to-[#E86F2C] text-white flex items-center justify-center font-bold text-[11px]">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
