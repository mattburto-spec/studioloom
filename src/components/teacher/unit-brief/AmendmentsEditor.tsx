"use client";

import { useState } from "react";
import type { UnitBriefAmendment } from "@/types/unit-brief";

interface AmendmentsEditorProps {
  amendments: UnitBriefAmendment[];
  onAdd: (input: {
    version_label: string;
    title: string;
    body: string;
  }) => Promise<boolean>;
  disabled?: boolean;
}

const VERSION_LABEL_MAX = 20;

/**
 * Section 3 of the Brief & Constraints editor. Append-only amendments
 * stream with an add-form at the bottom. version_label is free text
 * (e.g. "v1.1", "v2.0", "v1.5-emergency") capped at 20 chars; title
 * and body are required.
 */
export function AmendmentsEditor({
  amendments,
  onAdd,
  disabled,
}: AmendmentsEditorProps) {
  const [versionLabel, setVersionLabel] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    const v = versionLabel.trim();
    const t = title.trim();
    const b = body.trim();
    if (v.length === 0) {
      setLocalError("Version label is required.");
      return;
    }
    if (v.length > VERSION_LABEL_MAX) {
      setLocalError(`Version label must be ${VERSION_LABEL_MAX} characters or fewer.`);
      return;
    }
    if (t.length === 0) {
      setLocalError("Title is required.");
      return;
    }
    if (b.length === 0) {
      setLocalError("Body is required.");
      return;
    }
    setLocalError(null);
    const ok = await onAdd({ version_label: v, title: t, body: b });
    if (ok) {
      setVersionLabel("");
      setTitle("");
      setBody("");
    }
  };

  return (
    <div className="rounded border border-gray-200 p-4">
      {amendments.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500" data-testid="amendments-empty">
          No amendments yet. Add one below to issue a change order.
        </p>
      ) : (
        <ul className="mb-4 space-y-3" data-testid="amendments-list">
          {amendments.map((a) => (
            <li
              key={a.id}
              className="rounded border border-gray-200 bg-gray-50 p-3"
              data-testid={`amendment-${a.id}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                  {a.version_label}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {a.title}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  {formatDate(a.created_at)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                {a.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gray-200 pt-3">
        <h3 className="mb-2 text-sm font-medium text-gray-700">
          + Add amendment
        </h3>
        {localError && (
          <div
            role="alert"
            className="mb-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-800"
            data-testid="amendment-local-error"
          >
            {localError}
          </div>
        )}
        <div className="space-y-2">
          <input
            type="text"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            placeholder='Version label, e.g. "v2.0"'
            maxLength={VERSION_LABEL_MAX}
            data-testid="amendment-version-label"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Add LEDs"
            data-testid="amendment-title"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What changes? Why?"
            rows={3}
            data-testid="amendment-body"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={disabled}
            data-testid="amendment-submit"
            className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-300"
          >
            Add amendment
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
