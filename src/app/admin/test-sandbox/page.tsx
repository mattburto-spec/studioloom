"use client";

import { TestSandbox } from "@/components/admin/ai-model/TestSandbox";

export default function TestSandboxPage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Header */}
      <div
        className="px-6 py-3 flex items-center justify-between shrink-0 border-b"
        style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <h1 className="text-base font-bold text-gray-900">AI Test Sandbox</h1>
          <span className="text-xs text-gray-400">Independent of AI model controls</span>
        </div>
        <a
          href="/admin/ai-model"
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors font-medium"
        >
          AI Model Config →
        </a>
      </div>

      {/* Sandbox */}
      <div className="flex-1 overflow-y-auto bg-surface-alt">
        <TestSandbox />
      </div>
    </div>
  );
}
