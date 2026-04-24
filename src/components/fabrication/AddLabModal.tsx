"use client";

/**
 * AddLabModal — Phase 8-4.
 *
 * Simple form: name + optional description. First lab becomes the
 * teacher's default (if they have none). Shows a 409 message if they
 * somehow trip the unique-default-per-teacher index.
 */

import * as React from "react";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function AddLabModal({ onClose, onSaved }: Props) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!name.trim()) {
      setErrorMessage("Lab name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/teacher/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({ error: "" }));
      if (!res.ok) {
        setErrorMessage(body.error || `Create failed (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }
      onSaved();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error");
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
      >
        <h2 className="text-lg font-semibold text-gray-900">Add a lab</h2>
        <p className="text-sm text-gray-600">
          Labs group your machines. Classes get assigned to a default lab,
          and students see only that lab's machines in their upload picker.
        </p>

        <label className="block text-sm font-medium text-gray-700">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2nd floor design lab"
            required
            maxLength={80}
            autoFocus
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {errorMessage && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-900">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-3 py-1.5 rounded bg-brand-purple text-white hover:bg-brand-purple/90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create lab"}
          </button>
        </div>
      </form>
    </div>
  );
}
