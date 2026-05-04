"use client";

import type { UnitPage, ActivitySection, PortfolioEntry } from "@/types";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";

/** A group of pages rendered together under one heading. */
export interface NarrativeSection {
  heading: string;
  color: string;
  pages: Array<{
    page: UnitPage;
    responses: Record<string, unknown>;
    updatedAt: string | null;
  }>;
}

interface NarrativeViewProps {
  unitTitle: string;
  unitDescription: string | null;
  studentName: string;
  sections: NarrativeSection[];
  portfolioEntries: PortfolioEntry[];
  dateRange: { start: string; end: string } | null;
  unitId: string;
  firstPageId: string | null;
  /** Hide the top toolbar (used when rendered inside NarrativeModal which has its own header). */
  hideToolbar?: boolean;
}

export function NarrativeView({
  unitTitle,
  unitDescription,
  studentName,
  sections,
  portfolioEntries,
  dateRange,
  unitId,
  firstPageId,
  hideToolbar,
}: NarrativeViewProps) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const manualPortfolioEntries = portfolioEntries.filter((e) => e.type !== "auto");

  if (sections.length === 0 && manualPortfolioEntries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-6">
          <p className="text-lg font-semibold text-gray-800 mb-2">
            No responses yet
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Complete some activities to build your design narrative.
          </p>
          <a
            href={firstPageId ? `/unit/${unitId}/${firstPageId}` : `/dashboard`}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Back to unit
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print / Back toolbar — hidden in print, hidden when inside modal */}
      {!hideToolbar && (
        <div className="narrative-no-print sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <a
            href={firstPageId ? `/unit/${unitId}/${firstPageId}` : `/dashboard`}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5 transition"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to unit
          </a>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition flex items-center gap-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / Save PDF
          </button>
        </div>
      )}

      {/* Cover */}
      <div className="narrative-cover max-w-3xl mx-auto px-8 pt-20 pb-16">
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          {unitTitle}
        </h1>
        {unitDescription && (
          <p className="text-lg text-gray-500 leading-relaxed mb-8">
            {unitDescription}
          </p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="font-medium text-gray-600">{studentName}</span>
          {dateRange && (
            <>
              <span className="text-gray-300">|</span>
              <span>
                {formatDate(dateRange.start)} &mdash;{" "}
                {formatDate(dateRange.end)}
              </span>
            </>
          )}
        </div>
        <div className="mt-12 h-px bg-gray-200" />
      </div>

      {/* Narrative sections */}
      <div className="max-w-3xl mx-auto px-8 pb-20 space-y-16">
        {sections.map((section, sectionIdx) => (
          <div
            key={sectionIdx}
            className={sectionIdx > 0 ? "narrative-page-break" : ""}
          >
            {/* Section heading */}
            <div
              className="border-l-4 pl-5 mb-8"
              style={{ borderLeftColor: section.color }}
            >
              <h2
                className="text-2xl font-bold"
                style={{ color: section.color }}
              >
                {section.heading}
              </h2>
            </div>

            {/* Pages in this section */}
            <div className="space-y-12">
              {section.pages.map(({ page, responses, updatedAt }) => (
                <PageBlock
                  key={page.id}
                  page={page}
                  responses={responses}
                  updatedAt={updatedAt}
                  sectionColor={section.color}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Portfolio / Process Journal section — manual entries only (auto entries already appear in narrative sections) */}
      {manualPortfolioEntries.length > 0 && (
        <div className="max-w-3xl mx-auto px-8 pb-20">
          <div className={sections.length > 0 ? "narrative-page-break" : ""}>
            <div
              className="border-l-4 pl-5 mb-8"
              style={{ borderLeftColor: "#FF3366" }}
            >
              <h2 className="text-2xl font-bold" style={{ color: "#FF3366" }}>
                Process Journal
              </h2>
            </div>

            <div className="space-y-6">
              {manualPortfolioEntries.map((entry) => (
                <PortfolioEntryBlock key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer — hidden in print and modal */}
      {!hideToolbar && (
        <div className="narrative-no-print border-t border-gray-200 py-8 text-center">
          <p className="text-xs text-gray-400">
            Generated from StudioLoom
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page block — renders a single page's prompts + responses           */
/* ------------------------------------------------------------------ */

function PageBlock({
  page,
  responses,
  updatedAt,
  sectionColor,
}: {
  page: UnitPage;
  responses: Record<string, unknown>;
  updatedAt: string | null;
  sectionColor: string;
}) {
  const content = page.content;

  return (
    <div>
      {/* Page title */}
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          {content.title || page.title}
        </h3>
        {updatedAt && (
          <span className="text-xs text-gray-400">
            {new Date(updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Activity sections */}
      <div className="space-y-6">
        {content.sections.map((section, i) => {
          const value = responses[`section_${i}`];
          if (!value && value !== 0) return null;

          return (
            <div key={i}>
              {/* Prompt — Lever 1 composed text */}
              <p className="text-sm text-gray-500 mb-2 leading-relaxed">
                {composedPromptText(section)}
              </p>
              {/* Response */}
              <ResponseDisplay value={value} />
            </div>
          );
        })}

        {/* Reflection responses */}
        {content.reflection &&
          content.reflection.items.map((item, i) => {
            const value = responses[`reflection_${i}`];
            if (!value && value !== 0) return null;
            return (
              <div key={`reflection_${i}`}>
                <p className="text-sm text-gray-500 mb-2 leading-relaxed">
                  {item}
                </p>
                <ResponseDisplay value={value} />
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Response display — handles text, uploads, links, voice, structured */
/* ------------------------------------------------------------------ */

function ResponseDisplay({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return null;

  const str = typeof value === "string" ? value : JSON.stringify(value);

  // Try to parse as JSON response object
  if (str.startsWith("{") || str.startsWith("[")) {
    try {
      const parsed = JSON.parse(str);

      // Upload response
      if (parsed.type === "upload" && parsed.url) {
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
          parsed.filename || parsed.url
        );
        if (isImage) {
          return (
            <div className="my-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={parsed.url}
                alt={parsed.filename || "Uploaded image"}
                className="max-w-full rounded-lg border border-gray-200"
              />
              {parsed.filename && (
                <p className="text-xs text-gray-400 mt-1">{parsed.filename}</p>
              )}
            </div>
          );
        }
        return (
          <p className="text-sm text-gray-600 italic">
            Uploaded file: {parsed.filename || "file"}
          </p>
        );
      }

      // Voice recording
      if (parsed.type === "voice") {
        return (
          <p className="text-sm text-gray-600 italic">
            Voice recording: {parsed.filename || "recording"}
          </p>
        );
      }

      // Link response
      if (parsed.type === "link" && parsed.url) {
        return (
          <a
            href={parsed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline break-all"
          >
            {parsed.title || parsed.url}
          </a>
        );
      }

      // Decision matrix
      if (parsed.options && Array.isArray(parsed.options) && parsed.criteria) {
        return (
          <div className="overflow-x-auto my-3">
            <table className="text-sm border border-gray-200 w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-1.5 text-left text-gray-600 font-medium">
                    Criteria
                  </th>
                  {parsed.options.map((opt: string, i: number) => (
                    <th
                      key={i}
                      className="border border-gray-200 px-3 py-1.5 text-center text-gray-600 font-medium"
                    >
                      {opt}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.criteria.map(
                  (
                    c: { name: string; scores?: number[] },
                    ci: number
                  ) => (
                    <tr key={ci}>
                      <td className="border border-gray-200 px-3 py-1.5 text-gray-700">
                        {c.name}
                      </td>
                      {(c.scores || []).map((s: number, si: number) => (
                        <td
                          key={si}
                          className="border border-gray-200 px-3 py-1.5 text-center text-gray-700"
                        >
                          {s}
                        </td>
                      ))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        );
      }

      // PMI (Plus / Minus / Interesting)
      if (parsed.plus !== undefined || parsed.minus !== undefined || parsed.interesting !== undefined) {
        return (
          <div className="space-y-2 my-3">
            {parsed.plus && (
              <div className="text-sm">
                <span className="font-medium text-green-700">Plus: </span>
                <span className="text-gray-700">{parsed.plus}</span>
              </div>
            )}
            {parsed.minus && (
              <div className="text-sm">
                <span className="font-medium text-red-700">Minus: </span>
                <span className="text-gray-700">{parsed.minus}</span>
              </div>
            )}
            {parsed.interesting && (
              <div className="text-sm">
                <span className="font-medium text-blue-700">Interesting: </span>
                <span className="text-gray-700">{parsed.interesting}</span>
              </div>
            )}
          </div>
        );
      }

      // Fallback for other JSON — render as formatted text
      return (
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {JSON.stringify(parsed, null, 2)}
        </p>
      );
    } catch {
      // Not valid JSON — fall through to plain text
    }
  }

  // Plain text response
  return (
    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
      {str}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Portfolio entry block                                               */
/* ------------------------------------------------------------------ */

const ENTRY_TYPE_LABELS: Record<string, string> = {
  entry: "Entry",
  photo: "Photo",
  link: "Link",
  note: "Note",
  mistake: "Learning Moment",
};

function PortfolioEntryBlock({ entry }: { entry: PortfolioEntry }) {
  const dateStr = new Date(entry.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const typeLabel = ENTRY_TYPE_LABELS[entry.type] || entry.type;

  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 pt-0.5">
        <span className="text-xs text-gray-400">{dateStr}</span>
      </div>
      <div className="flex-1 min-w-0">
        {entry.type === "mistake" && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-medium mb-2">
            {typeLabel}
          </span>
        )}

        {entry.media_url && (
          <div className="mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.media_url}
              alt=""
              className="max-w-full rounded-lg border border-gray-200"
              loading="lazy"
            />
          </div>
        )}

        {entry.content && (
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </p>
        )}

        {entry.link_url && (
          <a
            href={entry.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline break-all"
          >
            {entry.link_title || entry.link_url}
          </a>
        )}
      </div>
    </div>
  );
}
