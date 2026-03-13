"use client";

import { ResponseInput } from "@/components/student/ResponseInput";
import { TextToSpeech } from "@/components/student/TextToSpeech";
import { MarkdownPrompt, stripMarkdown } from "@/components/student/MarkdownPrompt";
import { toEmbedUrl } from "@/lib/video-embed";
import type { ActivitySection } from "@/types";

interface ActivityCardProps {
  section: ActivitySection;
  index: number;
  ellLevel: number;
  responseValue: string;
  onResponseChange: (value: string) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  isLast: boolean;
  arrowOffset: number;
  allowedTypes: ("text" | "upload" | "voice" | "link")[];
  unitId: string;
  pageId: string;
  pageColor?: string;
}

const CONTENT_STYLE_CONFIG = {
  info: {
    bg: "bg-blue-50",
    border: "border-l-4 border-blue-400",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    label: "Key Information",
    labelColor: "text-blue-700",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-l-4 border-amber-400",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    label: "Safety Warning",
    labelColor: "text-amber-700",
  },
  tip: {
    bg: "bg-green-50",
    border: "border-l-4 border-green-400",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
        <path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </svg>
    ),
    label: "Pro Tip",
    labelColor: "text-green-700",
  },
  context: {
    bg: "bg-gray-50",
    border: "border-l-4 border-gray-300",
    icon: null,
    label: "",
    labelColor: "",
  },
};

export function ActivityCard({
  section,
  index,
  ellLevel,
  responseValue,
  onResponseChange,
  cardRef,
  isLast,
  allowedTypes,
  unitId,
  pageId,
  pageColor = "#6B7280",
}: ActivityCardProps) {
  const ellKey = `ell${ellLevel}` as "ell1" | "ell2" | "ell3";
  const scaffolding = section.scaffolding?.[ellKey];
  const sentenceStarters =
    (scaffolding as { sentenceStarters?: string[] })?.sentenceStarters || [];
  const extensionPrompts =
    ellLevel === 3
      ? (scaffolding as { extensionPrompts?: string[] })?.extensionPrompts || []
      : [];

  const isContentOnly = !section.responseType;
  const style = isContentOnly ? CONTENT_STYLE_CONFIG[section.contentStyle || "context"] : null;

  return (
    <div ref={cardRef} className="scroll-mt-20">
      {/* Content-only block wrapper */}
      {isContentOnly && style ? (
        <div className={`rounded-xl p-5 ${style.bg} ${style.border}`}>
          {style.label && (
            <div className="flex items-center gap-2 mb-2">
              {style.icon}
              <span className={`text-xs font-semibold ${style.labelColor}`}>{style.label}</span>
            </div>
          )}
          <div className="text-sm text-gray-700 leading-relaxed">
            <MarkdownPrompt text={section.prompt} />
          </div>

          {/* Media in content block */}
          {section.media && <MediaBlock media={section.media} />}

          {/* Links in content block */}
          {section.links && section.links.length > 0 && (
            <LinksBlock links={section.links} pageColor={pageColor} />
          )}
        </div>
      ) : (
        <>
          {/* Prompt header */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 leading-snug flex-1">
                <MarkdownPrompt text={section.prompt} />
              </h2>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                {section.portfolioCapture && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-pink/10 text-brand-pink text-[10px] font-semibold"
                    title="This response will appear in your portfolio"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    Portfolio
                  </span>
                )}
                <TextToSpeech text={stripMarkdown(section.prompt)} />
              </div>
            </div>
            {/* Colored accent bar under prompt */}
            <div className="w-12 h-1 rounded-full mt-3" style={{ backgroundColor: pageColor }} />
          </div>

          {/* Media */}
          {section.media && <MediaBlock media={section.media} />}

          {/* Links */}
          {section.links && section.links.length > 0 && (
            <LinksBlock links={section.links} pageColor={pageColor} />
          )}

          {/* Extension prompts for ELL 3 */}
          {extensionPrompts.length > 0 && (
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: pageColor + "0D" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: pageColor }}>
                Extension
              </p>
              {extensionPrompts.map((prompt, j) => (
                <p key={j} className="text-sm text-gray-600">
                  {prompt}
                </p>
              ))}
            </div>
          )}

          {/* Hints for ELL 1 */}
          {ellLevel === 1 &&
            (scaffolding as { hints?: string[] })?.hints && (
              <div className="bg-amber-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  Hints
                </p>
                {((scaffolding as { hints?: string[] }).hints || []).map(
                  (hint, j) => (
                    <p key={j} className="text-sm text-gray-600">
                      {hint}
                    </p>
                  )
                )}
              </div>
            )}

          {section.responseType && (
            <ResponseInput
              sectionIndex={index}
              responseType={section.responseType}
              value={responseValue}
              onChange={onResponseChange}
              sentenceStarters={sentenceStarters}
              unitId={unitId}
              pageId={pageId}
              allowedTypes={allowedTypes}
            />
          )}

          {/* Example response (collapsible) */}
          {section.exampleResponse && (
            <details className="mt-3">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                Show example response
              </summary>
              <div className="mt-2 bg-gray-50 rounded-xl p-4 text-sm text-gray-500 italic">
                {section.exampleResponse}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function MediaBlock({ media }: { media: { type: "image" | "video"; url: string; caption?: string } }) {
  if (media.type === "video") {
    const embedUrl = toEmbedUrl(media.url);
    if (!embedUrl) return null;
    return (
      <div className="mb-4">
        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={media.caption || "Video"}
          />
        </div>
        {media.caption && (
          <p className="text-xs text-gray-400 mt-2 text-center">{media.caption}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.url}
        alt={media.caption || "Activity image"}
        className="w-full rounded-xl object-cover max-h-80"
        loading="lazy"
      />
      {media.caption && (
        <p className="text-xs text-gray-400 mt-2 text-center">{media.caption}</p>
      )}
    </div>
  );
}

function LinksBlock({ links, pageColor }: { links: { url: string; label: string }[]; pageColor: string }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: pageColor + "15", color: pageColor }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          {link.label}
        </a>
      ))}
    </div>
  );
}
