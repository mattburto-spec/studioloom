"use client";

import { useEffect } from "react";
import type {
  UnitBrief,
  UnitBriefAmendment,
  DimensionUnit,
} from "@/types/unit-brief";
import { MATERIALS_CHIPS } from "@/lib/project-spec/archetypes";

interface BriefDrawerProps {
  open: boolean;
  brief: UnitBrief;
  amendments: UnitBriefAmendment[];
  onClose: () => void;
}

const MATERIAL_LABEL_BY_ID = new Map(
  MATERIALS_CHIPS.map((c) => [c.id as string, c.label]),
);

/**
 * Student-facing brief surface. Slide-in drawer from the right edge,
 * 700px wide, dim backdrop. Shown when the student clicks the
 * persistent BriefChip in the BoldTopNav. Local React state only —
 * no URL deeplink in v1 (Phase C spec).
 *
 * Sections (top to bottom):
 *   1. Brief prose
 *   2. Spec diagram (Phase B.5) if uploaded
 *   3. Design constraints card (only if archetype is design)
 *   4. Amendments — oldest-first; the brief's evolution story
 */
export function BriefDrawer({
  open,
  brief,
  amendments,
  onClose,
}: BriefDrawerProps) {
  // Close on Escape; mount/unmount the listener lazily so it doesn't
  // run on every page load when the drawer is closed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasDesignConstraints =
    brief.constraints.archetype === "design" &&
    Object.keys(brief.constraints.data).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Brief and constraints"
      data-testid="brief-drawer"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close brief drawer"
        data-testid="brief-drawer-backdrop"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative h-full w-full max-w-[700px] overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            <span aria-hidden="true" className="mr-2">📋</span>
            Brief &amp; Constraints
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="brief-drawer-close"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Section 1 — Brief prose */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Brief
            </h3>
            {brief.brief_text ? (
              <p
                className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800"
                data-testid="brief-drawer-prose"
              >
                {brief.brief_text}
              </p>
            ) : (
              <p
                className="text-sm italic text-gray-500"
                data-testid="brief-drawer-prose-empty"
              >
                Your teacher hasn&apos;t written the scenario yet.
              </p>
            )}
          </section>

          {/* Section 2 — Spec diagram (Phase B.5) */}
          {brief.diagram_url && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Spec diagram
              </h3>
              <div className="overflow-hidden rounded border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brief.diagram_url}
                  alt="Spec diagram"
                  data-testid="brief-drawer-diagram"
                  className="block max-h-[480px] w-full object-contain"
                />
              </div>
            </section>
          )}

          {/* Section 3 — Constraints (Design archetype only) */}
          {hasDesignConstraints && brief.constraints.archetype === "design" && (
            <section data-testid="brief-drawer-constraints">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Constraints
              </h3>
              <DesignConstraintsView data={brief.constraints.data} />
            </section>
          )}

          {/* Section 4 — Amendments (oldest-first — Phase C spec) */}
          {amendments.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Amendments
              </h3>
              <ul
                className="space-y-3"
                data-testid="brief-drawer-amendments"
              >
                {amendments.map((a) => (
                  <li
                    key={a.id}
                    data-testid={`brief-drawer-amendment-${a.id}`}
                    className="rounded border border-gray-200 bg-gray-50 p-3"
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
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

interface DesignConstraintsViewProps {
  data: {
    dimensions?: { h?: number; w?: number; d?: number; unit?: DimensionUnit };
    materials_whitelist?: string[];
    budget?: string;
    audience?: string;
    must_include?: string[];
    must_avoid?: string[];
  };
}

function DesignConstraintsView({ data }: DesignConstraintsViewProps) {
  return (
    <dl className="space-y-3 rounded border border-gray-200 bg-gray-50 p-4 text-sm">
      {data.dimensions && (
        <Row label="Dimensions">{formatDimensions(data.dimensions)}</Row>
      )}
      {data.materials_whitelist && data.materials_whitelist.length > 0 && (
        <Row label="Materials">
          <div className="flex flex-wrap gap-1.5">
            {data.materials_whitelist.map((m) => (
              <span
                key={m}
                className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700"
              >
                {MATERIAL_LABEL_BY_ID.get(m) ?? m}
              </span>
            ))}
          </div>
        </Row>
      )}
      {data.budget && <Row label="Budget">{data.budget}</Row>}
      {data.audience && <Row label="Audience">{data.audience}</Row>}
      {data.must_include && data.must_include.length > 0 && (
        <Row label="Must include">
          <ul className="list-disc pl-5 text-gray-800">
            {data.must_include.map((m, i) => (
              <li key={`${m}-${i}`}>{m}</li>
            ))}
          </ul>
        </Row>
      )}
      {data.must_avoid && data.must_avoid.length > 0 && (
        <Row label="Must avoid">
          <ul className="list-disc pl-5 text-gray-800">
            {data.must_avoid.map((m, i) => (
              <li key={`${m}-${i}`}>{m}</li>
            ))}
          </ul>
        </Row>
      )}
    </dl>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3">
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  );
}

function formatDimensions(d: {
  h?: number;
  w?: number;
  d?: number;
  unit?: DimensionUnit;
}): string {
  const parts: string[] = [];
  if (typeof d.h === "number") parts.push(`H ${d.h}`);
  if (typeof d.w === "number") parts.push(`W ${d.w}`);
  if (typeof d.d === "number") parts.push(`D ${d.d}`);
  if (parts.length === 0) return "—";
  const u = d.unit ?? "mm";
  return `${parts.join(" × ")} ${u}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
