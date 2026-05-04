"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";

interface MachineProfile {
  id: string;
  name: string;
  machine_category: string;
}

interface Fabricator {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  invite_pending: boolean;
  machines: MachineProfile[];
}

interface FabricatorsClientProps {
  initialFabricators: Fabricator[];
  machines: MachineProfile[];
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const mins = (Date.now() - then) / 60000;
  if (mins < 60) return `${Math.max(1, Math.round(mins))}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  const days = hrs / 24;
  if (days < 14) return `${Math.round(days)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function FabricatorsClient({
  initialFabricators,
  machines,
}: FabricatorsClientProps) {
  const router = useRouter();
  const [fabricators] = useState(initialFabricators);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  return (
    <div className="pb-10">
      {/* PreflightTeacherNav is mounted by the server page wrapper,
       *  so this client component just renders its own content. */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fabricators</h1>
          <p className="mt-2 max-w-2xl text-base text-gray-600">
            A Fabricator account picks up approved submissions + runs them on
            your machines. This could be a dedicated lab tech, a shared
            computer next to the printers that&apos;s always signed in, or just
            you — whoever&apos;s actually running the machines.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Each Fabricator account sees every job from your classes.
            Per-machine restrictions aren't part of v1; if you need
            them later (e.g. dedicated laser-cutter operator), file a
            request.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="shrink-0 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700"
        >
          + Invite a Fabricator
        </button>
      </div>

      {banner && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            banner.kind === "success"
              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
              : "bg-rose-50 text-rose-900 ring-1 ring-rose-200"
          }`}
        >
          {banner.text}
        </div>
      )}

      {fabricators.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          No Fabricators yet. Click <strong>Invite a Fabricator</strong> to send an invite link.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email / Login</th>
                {/* Phase 8.1d-9: Machines column removed — fabricators
                     now see ALL of the inviting teacher's jobs, no
                     per-fabricator restriction. The fabricator_machines
                     junction is deprecated as a visibility mechanism. */}
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fabricators.map((f) => (
                <FabricatorRow
                  key={f.id}
                  fabricator={f}
                  onAction={async (action) => {
                    const result = await runAction(f.id, action);
                    setBanner(result);
                    if (result.kind === "success") router.refresh();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && (
        <InviteModal
          machines={machines}
          onClose={() => setInviteOpen(false)}
          onSuccess={(text) => {
            setBanner({ kind: "success", text });
            setInviteOpen(false);
            router.refresh();
          }}
          onError={(text) => setBanner({ kind: "error", text })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// FabricatorRow
// ---------------------------------------------------------------

type RowAction = "deactivate" | "reactivate" | "reset-password";

async function runAction(
  fabricatorId: string,
  action: RowAction
): Promise<{ kind: "success" | "error"; text: string }> {
  try {
    if (action === "reset-password") {
      const res = await fetch(
        `/api/teacher/fabricators/${fabricatorId}/reset-password`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          kind: "error",
          text: data.error ?? `Reset failed (${res.status}).`,
        };
      }
      return { kind: "success", text: "Reset email sent." };
    }
    const isActive = action === "reactivate";
    const res = await fetch(`/api/teacher/fabricators/${fabricatorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        kind: "error",
        text: data.error ?? `Update failed (${res.status}).`,
      };
    }
    return {
      kind: "success",
      text: isActive ? "Reactivated." : "Deactivated.",
    };
  } catch (err) {
    return {
      kind: "error",
      text: err instanceof Error ? err.message : "Network error.",
    };
  }
}

function FabricatorRow({
  fabricator,
  onAction,
}: {
  fabricator: Fabricator;
  onAction: (action: RowAction) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );

  // Phase 8-1 + Round 2 (4 May 2026): the actions dropdown is rendered
  // via React portal because the table wrapper has `overflow-hidden`
  // (needed to clip the rounded corners on the table content). Without
  // the portal, the absolutely-positioned dropdown would render INSIDE
  // the wrapper and get clipped at the table's bottom edge — Matt
  // reported the popup "hidden within the box it's nested in" during
  // the cross-persona admin smoke. Portal escapes the overflow context
  // entirely, positioned via getBoundingClientRect on the button.
  useEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // Position the menu top-right under the button. Menu width is
    // 12rem (w-48 = 192px); right-align by anchoring left to
    // (button.right - 192px). 4px vertical gap.
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.right - 192,
    });
  }, [menuOpen]);

  // Click-outside + ESC dismissal.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function handle(action: RowAction) {
    setMenuOpen(false);
    startTransition(async () => {
      await onAction(action);
    });
  }

  return (
    <tr className={fabricator.is_active ? "" : "bg-gray-50 text-gray-500"}>
      <td className="px-4 py-3 font-medium text-gray-900">
        {fabricator.display_name}
      </td>
      <td className="px-4 py-3">
        <div>{fabricator.email}</div>
        <div className="text-xs text-gray-500">
          last login: {formatRelative(fabricator.last_login_at)}
        </div>
      </td>
      {/* Phase 8.1d-9: Machines cell removed — see thead comment. */}
      <td className="px-4 py-3">
        {fabricator.invite_pending ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            Invite pending
          </span>
        ) : fabricator.is_active ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
            Deactivated
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          ref={buttonRef}
          type="button"
          disabled={isPending}
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          aria-label="Row actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          …
        </button>
        {menuOpen &&
          menuPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-50 w-48 rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-gray-200"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                className="block w-full px-3 py-1.5 text-left hover:bg-gray-50 disabled:opacity-50"
                onClick={() => handle("reset-password")}
                disabled={!fabricator.is_active}
                role="menuitem"
              >
                Reset password (email)
              </button>
              {fabricator.is_active ? (
                <button
                  className="block w-full px-3 py-1.5 text-left text-rose-700 hover:bg-rose-50"
                  onClick={() => handle("deactivate")}
                  role="menuitem"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
                  onClick={() => handle("reactivate")}
                  role="menuitem"
                >
                  Reactivate
                </button>
              )}
            </div>,
            document.body
          )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------
// InviteModal
// ---------------------------------------------------------------

function InviteModal({
  machines,
  onClose,
  onSuccess,
  onError,
}: {
  machines: MachineProfile[];
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [machineIds, setMachineIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resend, setResend] = useState(false);

  function toggleMachine(id: string) {
    setMachineIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/teacher/fabricators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, machineIds, resend }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && !resend && data.hint) {
        // Offer the resend path.
        setResend(true);
        onError(
          "A Fabricator with that email already exists. Click Send to re-send the invite."
        );
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        onError(data.error ?? `Invite failed (${res.status}).`);
        setSubmitting(false);
        return;
      }
      const emailStatus = data.email;
      const note =
        emailStatus && emailStatus.sent === false
          ? ` Email not dispatched: ${emailStatus.reason}.`
          : "";
      onSuccess(`Invite sent to ${email}.${note}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-900">
          {resend ? "Re-send invite" : "Invite a Fabricator"}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          They'll get an email with a one-time set-password link (24h validity).
        </p>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-base shadow-sm focus:border-purple-500 focus:ring-purple-500"
            disabled={submitting}
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Display name
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-base shadow-sm focus:border-purple-500 focus:ring-purple-500"
            disabled={submitting}
          />
        </label>

        {/* Phase 8.1d-9: machine-assignment checkboxes removed.
             Fabricators now see ALL jobs from their inviting teacher
             — no per-machine restrictions. Per-machine opt-in scoping
             stays as a future possibility (PH9-FU-FAB-MACHINE-RESTRICT)
             but isn't part of v1. Eliminates teacher-side overhead
             that wasn't carrying its weight at NIS scale. */}
        <p className="mt-3 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
          This fabricator will see <strong>every job</strong> from your
          classes — no per-machine setup needed. They just log in and
          pick up the next job from the queue.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700 disabled:opacity-60"
          >
            {submitting ? "Sending…" : resend ? "Re-send invite" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
