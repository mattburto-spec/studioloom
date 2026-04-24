"use client";

import React from "react";
import { VocabWarmup } from "@/components/student/VocabWarmup";
import { TextToSpeech } from "@/components/student/TextToSpeech";
import { toEmbedUrl } from "@/lib/video-embed";
import { VideoBlock } from "./VideoBlock";
import type { VocabWarmup as VocabWarmupType, ActivityLink } from "@/types";

type Props = {
  vocabWarmup?: VocabWarmupType;
  introduction?: {
    text: string;
    media?: { type: "image" | "video"; url: string };
    links?: ActivityLink[];
  };
  /** ELL level (0-3). Passed through to VocabWarmup. */
  ellLevel: number;
  /** Phase color — accents vocab-warmup tint + video watch-prompt. */
  pageColor: string;
  /** Optional — override the default Watch eyebrow shown on the VideoBlock. */
  videoEyebrow?: string;
  /** Optional — drives the italic-serif reflection line under the video. */
  videoWatchPrompt?: string;
};

export function LessonIntro({
  vocabWarmup,
  introduction,
  ellLevel,
  pageColor,
  videoEyebrow,
  videoWatchPrompt,
}: Props) {
  const hasAnything = !!vocabWarmup || !!introduction;
  if (!hasAnything) return null;

  const videoEmbed =
    introduction?.media?.type === "video" ? toEmbedUrl(introduction.media.url) : null;

  return (
    <div className="space-y-5">
      {vocabWarmup && (
        <div
          className="rounded-2xl p-6 md:p-8"
          style={{
            background: "var(--sl-paper)",
            border: "1px solid var(--sl-hair)",
          }}
        >
          <VocabWarmup warmup={vocabWarmup} ellLevel={ellLevel} />
        </div>
      )}

      {introduction && (introduction.text || introduction.media) && (
        <div className="card-lb p-6 md:p-8">
          {introduction.text && (
            <div className="flex items-start gap-3">
              <p
                className="flex-1 leading-relaxed"
                style={{ fontSize: "15px", color: "var(--sl-ink-2)" }}
              >
                {introduction.text}
              </p>
              <TextToSpeech text={introduction.text} />
            </div>
          )}

          {introduction.media?.type === "image" && (
            <div
              className="mt-6 rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--sl-hair)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={introduction.media.url}
                alt=""
                className="w-full"
              />
            </div>
          )}

          {introduction.links && introduction.links.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {introduction.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold transition-opacity hover:opacity-80"
                  style={{
                    fontSize: "13px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    backgroundColor: pageColor + "15",
                    color: pageColor,
                  }}
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
                    aria-hidden="true"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {videoEmbed && (
        <VideoBlock
          embedUrl={videoEmbed}
          eyebrow={videoEyebrow}
          accentColor={pageColor}
          watchPrompt={videoWatchPrompt}
        />
      )}
    </div>
  );
}
