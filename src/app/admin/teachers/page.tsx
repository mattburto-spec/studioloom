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

const PROTECTED_EMAILS = new Set(["system@studioloom.internal"]);

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);

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
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No teachers registered</td></tr>
            )}
            {teachers.map((t) => {
              const isProtected = !!t.email && PROTECTED_EMAILS.has(t.email.toLowerCase());
              return (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                  <td className="px-4 py-2 font-medium text-gray-900">{t.name || "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{t.email || "—"}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{t.classCount}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{t.unitCount}</td>
                  <td className="px-4 py-2 text-right text-xs text-gray-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isProtected ? (
                      <span
                        className="text-xs text-gray-300"
                        title="System account — protected"
                      >
                        🔒
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="text-gray-300 hover:text-red-600 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Remove ${t.name || t.email || "teacher"}`}
                        title="Remove teacher"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
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

      {deleteTarget && (
        <DeleteTeacherModal
          teacher={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            loadTeachers();
          }}
        />
      )}
    </div>
  );
}

function DeleteTeacherModal({
  teacher,
  onClose,
  onDeleted,
}: {
  teacher: Teacher;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasContent = teacher.classCount > 0 || teacher.unitCount > 0;

  async function handleDelete() {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/teachers/${teacher.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || `Delete failed (HTTP ${res.status})`);
        return;
      }
      onDeleted();
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
            <h3 className="text-lg font-bold text-gray-900">Remove teacher</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              This permanently deletes the account and all associated data.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4 text-sm">
          <div className="font-medium text-gray-900">{teacher.name || "—"}</div>
          <div className="text-gray-600">{teacher.email || "—"}</div>
          <div className="mt-1 text-xs text-gray-500">
            {teacher.classCount} class{teacher.classCount !== 1 ? "es" : ""} · {teacher.unitCount} unit{teacher.unitCount !== 1 ? "s" : ""}
          </div>
        </div>

        {hasContent ? (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <strong>Blocked:</strong> this teacher still owns {teacher.classCount} class{teacher.classCount !== 1 ? "es" : ""} and {teacher.unitCount} unit{teacher.unitCount !== 1 ? "s" : ""}.
            Reassign or delete their classes and units first, then come back here.
          </div>
        ) : (
          <p className="text-sm text-gray-600 mb-4">
            This teacher has no classes or units. Deleting will remove their
            account, knowledge uploads, library items, and cost records. This
            cannot be undone.
          </p>
        )}

        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {errorMsg}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting || hasContent}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {submitting ? "Removing…" : "Remove teacher"}
          </button>
        </div>
      </div>
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
