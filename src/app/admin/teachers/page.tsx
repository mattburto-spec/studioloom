"use client";

import { useState, useEffect, useCallback } from "react";

interface Teacher {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  classCount: number;
  unitCount: number;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadTeachers = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/teachers")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setTeachers(data.teachers || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading teachers...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Teachers</h2>
          <p className="text-sm text-gray-500">{teachers.length} registered teacher{teachers.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-purple rounded-lg hover:opacity-90 transition shadow-sm"
          style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
        >
          + Invite teacher
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Classes</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Units</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No teachers registered</td></tr>
            )}
            {teachers.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">{t.name || "—"}</td>
                <td className="px-4 py-2 text-gray-600">{t.email || "—"}</td>
                <td className="px-4 py-2 text-right text-gray-600">{t.classCount}</td>
                <td className="px-4 py-2 text-right text-gray-600">{t.unitCount}</td>
                <td className="px-4 py-2 text-right text-xs text-gray-500">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <InviteTeacherModal
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            setInviteOpen(false);
            loadTeachers();
          }}
        />
      )}
    </div>
  );
}

function InviteTeacherModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/teachers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || `Invite failed (HTTP ${res.status})`);
        return;
      }
      setSuccessMsg(`Invite sent to ${data.invited?.email || email}. They'll receive an email to set their password.`);
      // Let the admin read the success message briefly before reload.
      setTimeout(onInvited, 1200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Invite a teacher</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              They&apos;ll get an email with a link to set their password.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              required
              disabled={submitting || !!successMsg}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              disabled={submitting || !!successMsg}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent disabled:bg-gray-50"
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
          {successMsg && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              {successMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !!successMsg || !email}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
            >
              {submitting ? "Sending…" : successMsg ? "Sent" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
