"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

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
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Phase 8-4 navigation hint: Lab setup is the new primary admin surface. */}
      <a
        href="/teacher/preflight/lab-setup"
        className="inline-block mb-4 text-sm text-brand-purple hover:underline"
      >
        ← Back to Lab setup
      </a>
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
            Each account only sees jobs for the machines you assign it to.
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
                <th className="px-4 py-3 text-left font-medium">Machines</th>
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
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {fabricator.machines.length === 0 ? (
            <span className="text-xs text-gray-400">No machines assigned</span>
          ) : (
            fabricator.machines.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800 ring-1 ring-purple-200"
              >
                {m.name}
              </span>
            ))
          )}
        </div>
      </td>
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
        <div className="relative inline-block">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Row actions"
          >
            …
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-gray-200">
              <button
                className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
                onClick={() => handle("reset-password")}
                disabled={!fabricator.is_active}
              >
                Reset password (email)
              </button>
              {fabricator.is_active ? (
                <button
                  className="block w-full px-3 py-1.5 text-left text-rose-700 hover:bg-rose-50"
                  onClick={() => handle("deactivate")}
                >
                  Deactivate
                </button>
              ) : (
                <button
                  className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
                  onClick={() => handle("reactivate")}
                >
                  Reactivate
                </button>
              )}
            </div>
          )}
        </div>
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

        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-gray-700">
            Assign to machines
          </legend>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-3">
            {machines.length === 0 ? (
              <p className="text-sm text-gray-500">
                No machines available. Seed system templates run at app startup;
                if you're seeing this, something is wrong.
              </p>
            ) : (
              machines.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={machineIds.includes(m.id)}
                    onChange={() => toggleMachine(m.id)}
                    disabled={submitting}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>
                    <strong>{m.name}</strong>{" "}
                    <span className="text-xs text-gray-500">
                      ({m.machine_category})
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          {machineIds.length === 0 && (
            <p className="mt-1 text-xs text-rose-600">
              Pick at least one machine.
            </p>
          )}
        </fieldset>

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
            disabled={submitting || machineIds.length === 0}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700 disabled:opacity-60"
          >
            {submitting ? "Sending…" : resend ? "Re-send invite" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
