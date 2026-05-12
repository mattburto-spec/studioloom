"use client";

import { ResponseInput } from "@/components/student/ResponseInput";
import { PortfolioCaptureAffordance } from "@/components/student/PortfolioCaptureAffordance";
import { TextToSpeech } from "@/components/student/TextToSpeech";
import { stripMarkdown } from "@/components/student/MarkdownPrompt";
import { ComposedPrompt } from "@/components/student/ComposedPrompt";
import { composedPromptText, hasSlotFields } from "@/lib/lever-1/compose-prompt";
import { TappableText } from "@/components/student/tap-a-word";
import { toEmbedUrl } from "@/lib/video-embed";
import { KeyInformationCallout } from "@/components/lesson";
import type { ActivitySection } from "@/types";

import type { IntegrityMetadata } from "./MonitoredTextarea";

interface ActivityCardProps {
  section: ActivitySection;
  index: number;
  ellLevel: number;
  responseValue: string;
  onResponseChange: (value: string) => void;
  /**
   * Round 11 — bypass-the-debounce save. Used by Process Journal (and
   * any other "explicit Save button" response type) so the value
   * survives a navigation within the autosave debounce window.
   */
  onSaveResponseImmediate?: (value: string) => Promise<void>;
  cardRef?: (el: HTMLDivElement | null) => void;
  isLast: boolean;
  arrowOffset: number;
  allowedTypes: ("text" | "upload" | "voice" | "link")[];
  unitId: string;
  pageId: string;
  pageColor?: string;
  /** Enable integrity monitoring on text responses (academic integrity tracking) */
  enableIntegrityMonitoring?: boolean;
  /** Callback when integrity metadata is updated */
  onIntegrityUpdate?: (sectionIndex: number, metadata: IntegrityMetadata) => void;
}

/**
 * Content-block style refresh (8 May 2026): bumped from a tired
 * pale-bg + thin left-stripe pattern to a more dynamic card shape:
 * gradient background, full subtle border, colored circular icon
 * badge, larger body text, and a soft hover-lift. ComposedPrompt
 * (with tappable=true → click-for-word-definition) is unchanged so
 * the dictionary affordance keeps working.
 */
const CONTENT_STYLE_CONFIG = {
  info: {
    bg: "bg-gradient-to-br from-blue-50 via-blue-50/70 to-white",
    border: "border border-blue-200/70",
    badgeBg: "bg-blue-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    label: "Key Information",
    labelColor: "text-blue-700",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-50 via-amber-50/70 to-white",
    border: "border border-amber-200/70",
    badgeBg: "bg-amber-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    label: "Safety Warning",
    labelColor: "text-amber-800",
  },
  tip: {
    bg: "bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-white",
    border: "border border-emerald-200/70",
    badgeBg: "bg-emerald-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </svg>
    ),
    label: "Pro Tip",
    labelColor: "text-emerald-700",
  },
  context: {
    bg: "bg-gradient-to-br from-gray-50 via-gray-50/70 to-white",
    border: "border border-gray-200/70",
    badgeBg: "",
    icon: null,
    label: "",
    labelColor: "",
  },
  activity: {
    bg: "bg-gradient-to-br from-violet-50 via-violet-50/70 to-white",
    border: "border border-violet-200/70",
    badgeBg: "bg-violet-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    label: "Classroom Activity",
    labelColor: "text-violet-700",
  },
  speaking: {
    bg: "bg-gradient-to-br from-indigo-50 via-indigo-50/70 to-white",
    border: "border border-indigo-200/70",
    badgeBg: "bg-indigo-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: "Discussion / Speaking",
    labelColor: "text-indigo-700",
  },
  practical: {
    bg: "bg-gradient-to-br from-orange-50 via-orange-50/70 to-white",
    border: "border border-orange-200/70",
    badgeBg: "bg-orange-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    label: "Hands-On Activity",
    labelColor: "text-orange-700",
  },
  // LIS.A.2 — present only to keep the record exhaustive over the
  // ContentStyle union. Sections with contentStyle === "key-callout"
  // never reach this lookup; they short-circuit through
  // KeyInformationCallout via isCalloutStyle below.
  "key-callout": {
    bg: "",
    border: "",
    badgeBg: "",
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
  onSaveResponseImmediate,
  cardRef,
  isLast,
  allowedTypes,
  unitId,
  pageId,
  pageColor = "#6B7280",
  enableIntegrityMonitoring = false,
  onIntegrityUpdate,
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

  // LIS.A.2 — both legacy "info" content blocks AND explicit "key-callout"
  // sections render via KeyInformationCallout (magazine treatment). When
  // bullets are present, the 3-card layout fires; otherwise the prose
  // body renders in a single warm card. Other content styles (warning /
  // tip / context / activity / speaking / practical) carry functional
  // colour meanings (safety amber, pro-tip green, etc.) and stay on
  // the legacy CONTENT_STYLE_CONFIG path.
  const isCalloutStyle =
    isContentOnly &&
    (section.contentStyle === "info" || section.contentStyle === "key-callout");

  const calloutBullets =
    Array.isArray(section.bullets) && section.bullets.length > 0
      ? section.bullets
      : undefined;

  // LIS.A.3 — promote section.framing to the magazine title when the
  // teacher hasn't authored an explicit bulletsTitle. Only applies when
  // slot fields are present (so we know `framing` is a heading-shaped
  // string, not an empty placeholder). Tell ComposedPrompt to skip it
  // so the body card doesn't render the title twice.
  const sectionHasSlots = isCalloutStyle ? hasSlotFields(section) : false;
  const calloutTitle =
    section.bulletsTitle ??
    (sectionHasSlots && section.framing ? section.framing : undefined);
  const skipFramingInBody = !!(
    calloutTitle &&
    !section.bulletsTitle &&
    sectionHasSlots &&
    section.framing
  );

  const style =
    isContentOnly && !isCalloutStyle
      ? CONTENT_STYLE_CONFIG[section.contentStyle || "context"]
      : null;

  return (
    <div ref={cardRef} className="scroll-mt-20">
      {/* LIS.A.2 — Magazine callout for both "info" + "key-callout". */}
      {isCalloutStyle ? (
        <KeyInformationCallout
          title={calloutTitle}
          eyebrow={section.bulletsEyebrow}
          intro={section.bulletsIntro}
          bullets={calloutBullets}
          body={
            calloutBullets ? undefined : (
              <>
                <ComposedPrompt
                  section={section}
                  variant="compact"
                  tappable
                  skipFraming={skipFramingInBody}
                />
                {section.media && <MediaBlock media={section.media} />}
                {section.links && section.links.length > 0 && (
                  <LinksBlock links={section.links} pageColor={pageColor} />
                )}
              </>
            )
          }
        />
      ) : isContentOnly && style ? (
        <div
          className={`relative rounded-3xl p-6 md:p-8 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${style.bg} ${style.border} overflow-hidden`}
        >
          {/* Subtle decorative top accent — adds presence without
              shouting. Inherits the badge color so each block style
              has its own thin signature stripe. */}
          {style.badgeBg && (
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${style.badgeBg} opacity-70`}
              aria-hidden="true"
            />
          )}
          {style.label && (
            <div className="flex items-center gap-3 mb-4">
              {style.icon && (
                <div
                  className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center shadow-md ${style.badgeBg}`}
                  aria-hidden="true"
                >
                  {style.icon}
                </div>
              )}
              <span
                className={`text-[12px] font-bold uppercase tracking-[0.12em] ${style.labelColor}`}
              >
                {style.label}
              </span>
            </div>
          )}
          <div className="text-[17px] md:text-[18px] text-gray-800 leading-[1.65] font-normal">
            <ComposedPrompt section={section} variant="compact" tappable />
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
          {/* Prompt header — Lever 1 hybrid composition (framing + task + 🎯 success) */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <ComposedPrompt section={section} variant="standard" tappable />
              </div>
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
                {/* TTS reads the COMPOSED prompt — students hear framing + task + signal */}
                <TextToSpeech text={stripMarkdown(composedPromptText(section))} />
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

          {/* Hints for ELL 1 — restored to pre-Sub-Phase-3 ELL-only gating
              after Phase 0 of language-scaffolding-redesign rolled back the
              autonomy-driven gating. Will be replaced by signal-driven
              Tap-a-word + Response Starters affordances in upcoming phases. */}
          {ellLevel === 1 &&
            (scaffolding as { hints?: string[] })?.hints && (
              <div className="bg-amber-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  Hints
                </p>
                {((scaffolding as { hints?: string[] }).hints || []).map(
                  (hint, j) => (
                    <p key={j} className="text-sm text-gray-600">
                      <TappableText text={hint} />
                    </p>
                  )
                )}
              </div>
            )}

          {section.responseType && (
            // Round 14 (6 May 2026) — wrap the response in a `group`
            // container so the subtle PortfolioCaptureAffordance can
            // appear on hover. Affordance hidden for structured-prompts
            // (own Save flow) and for already-portfolioCapture-flagged
            // sections (auto-saved on the autosave debounce).
            <div className="group relative">
              <ResponseInput
                sectionIndex={index}
                responseType={section.responseType}
                value={responseValue}
                onChange={onResponseChange}
                sentenceStarters={sentenceStarters}
                unitId={unitId}
                pageId={pageId}
                allowedTypes={allowedTypes}
                toolId={section.toolId}
                toolChallenge={section.toolChallenge}
                prompts={section.prompts}
                requirePhoto={section.requirePhoto}
                autoCreateKanbanCardOnSave={section.autoCreateKanbanCardOnSave}
                promptsLayout={section.promptsLayout}
                onSaveResponseImmediate={onSaveResponseImmediate}
                enableIntegrityMonitoring={enableIntegrityMonitoring}
                onIntegrityUpdate={
                  onIntegrityUpdate
                    ? (metadata) => onIntegrityUpdate(index, metadata)
                    : undefined
                }
                activityId={section.activityId}
                choiceCardsConfig={section.choiceCardsConfig}
              />

              {section.responseType !== "structured-prompts" &&
                !section.portfolioCapture && (
                  <div
                    className="flex items-center justify-end mt-1.5 min-h-[16px]"
                    data-testid="portfolio-capture-row"
                  >
                    <PortfolioCaptureAffordance
                      unitId={unitId}
                      pageId={pageId}
                      sectionIndex={index}
                      value={responseValue}
                      onSaveResponseImmediate={onSaveResponseImmediate}
                    />
                  </div>
                )}
            </div>
          )}

          {/* Example response (collapsible) — restored to pre-Sub-Phase-3
              default-collapsed behaviour after Phase 0 rollback. */}
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
