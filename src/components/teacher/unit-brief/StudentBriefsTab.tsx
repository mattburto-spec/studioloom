"use client";

// Unit Briefs Foundation Phase F.E — teacher review of per-student
// brief authoring.
//
// Read-only list of every student's overrides for a unit. Renders
// inline beside the "Brief" tab on /teacher/units/[unitId]/brief.
// Each card shows the student's name, when they last edited, which
// choice card they picked (if any), and the fields they authored.

import { useEffect, useState } from "react";
import { MATERIALS_CHIPS } from "@/lib/project-spec/archetypes";
import type {
  DesignDimensions,
  UnitBriefConstraints,
} from "@/types/unit-brief";

interface StudentBriefRow {
  student_id: string;
  student_name: string;
  brief_text: string | null;
  constraints: UnitBriefConstraints;
  diagram_url: string | null;
  updated_at: string;
  choice_card_id: string | null;
  choice_card_label: string | null;
}

interface Props {
  unitId: string;
}

const MATERIAL_LABEL_BY_ID = new Map(
  MATERIALS_CHIPS.map((c) => [c.id as string, c.label]),
);

export function StudentBriefsTab({ unitId }: Props) {
  const [studentBriefs, setStudentBriefs] = useState<StudentBriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(
      `/api/teacher/unit-brief/student-briefs?unitId=${encodeURIComponent(unitId)}`,
    )
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Failed to load (${res.status})`);
          return;
        }
        const data = await res.json();
        setStudentBriefs(
          Array.isArray(data.studentBriefs) ? data.studentBriefs : [],
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  if (loading) {
    return (
      <div
        className="p-8 text-gray-500"
        data-testid="student-briefs-tab-loading"
      >
        Loading student briefs…
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        data-testid="student-briefs-tab-error"
      >
        {error}
      </div>
    );
  }
  if (studentBriefs.length === 0) {
    return (
      <div
        className="rounded border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600"
        data-testid="student-briefs-tab-empty"
      >
        <p className="mb-1 text-base font-medium text-gray-800">
          No student authoring yet
        </p>
        <p className="text-xs text-gray-500">
          When students edit any unlocked field on their brief, their
          version appears here. Locked fields they can&apos;t edit —
          those show your value to them read-only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="student-briefs-tab">
      <p className="text-xs text-gray-500">
        {studentBriefs.length} student{studentBriefs.length === 1 ? "" : "s"}{" "}
        have authored. Sorted by most recent edit.
      </p>
      {studentBriefs.map((sb) => (
        <StudentBriefCard key={sb.student_id} brief={sb} />
      ))}
    </div>
  );
}

function StudentBriefCard({ brief }: { brief: StudentBriefRow }) {
  const designData =
    brief.constraints.archetype === "design" ? brief.constraints.data : {};
  const hasAnyConstraint =
    brief.constraints.archetype === "design" &&
    Object.keys(designData).length > 0;

  return (
    <article
      className="rounded border border-gray-200 bg-white p-4"
      data-testid={`student-brief-card-${brief.student_id}`}
    >
      <header className="mb-3 flex flex-wrap items-baseline gap-2">
        <h3
          className="text-sm font-semibold text-gray-900"
          data-testid={`student-brief-name-${brief.student_id}`}
        >
          {brief.student_name}
        </h3>
        {brief.choice_card_label && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800">
            📋 {brief.choice_card_label}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-500">
          Updated {formatDate(brief.updated_at)}
        </span>
      </header>

      {brief.brief_text !== null && brief.brief_text.length > 0 && (
        <section className="mb-3">
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Brief
          </h4>
          <p
            className="whitespace-pre-wrap rounded bg-gray-50 px-3 py-2 text-sm text-gray-800"
            data-testid={`student-brief-text-${brief.student_id}`}
          >
            {brief.brief_text}
          </p>
        </section>
      )}

      {hasAnyConstraint && (
        <section>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Constraints
          </h4>
          <dl className="grid grid-cols-1 gap-2 rounded bg-gray-50 px-3 py-2 text-sm md:grid-cols-2">
            {designData.dimensions && (
              <ConstraintRow
                label="Dimensions"
                value={formatDimensions(designData.dimensions)}
              />
            )}
            {designData.budget && (
              <ConstraintRow label="Budget" value={designData.budget} />
            )}
            {designData.audience && (
              <ConstraintRow label="Audience" value={designData.audience} />
            )}
            {designData.materials_whitelist &&
              designData.materials_whitelist.length > 0 && (
                <ConstraintRow
                  label="Materials"
                  value={designData.materials_whitelist
                    .map((m) => MATERIAL_LABEL_BY_ID.get(m) ?? m)
                    .join(", ")}
                />
              )}
            {designData.must_include && designData.must_include.length > 0 && (
              <ConstraintRow
                label="Must include"
                value={designData.must_include.join(" · ")}
              />
            )}
            {designData.must_avoid && designData.must_avoid.length > 0 && (
              <ConstraintRow
                label="Must avoid"
                value={designData.must_avoid.join(" · ")}
              />
            )}
          </dl>
        </section>
      )}

      {!brief.brief_text && !hasAnyConstraint && (
        <p className="text-xs italic text-gray-500">
          (Row exists but no fields authored — likely a stale draft.)
        </p>
      )}
    </article>
  );
}

function ConstraintRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase text-gray-500">
        {label}
      </dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  );
}

function formatDimensions(d: DesignDimensions): string {
  const parts: string[] = [];
  if (typeof d.h === "number") parts.push(`H ${d.h}`);
  if (typeof d.w === "number") parts.push(`W ${d.w}`);
  if (typeof d.d === "number") parts.push(`D ${d.d}`);
  if (parts.length === 0) return "—";
  return `${parts.join(" × ")} ${d.unit ?? "mm"}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) {
      const mins = Math.max(1, Math.round(diffMs / (1000 * 60)));
      return `${mins} min ago`;
    }
    if (diffHours < 24) {
      return `${Math.round(diffHours)}h ago`;
    }
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
