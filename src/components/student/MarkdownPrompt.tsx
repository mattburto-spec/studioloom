"use client";

import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { TappableText } from "@/components/student/tap-a-word";

interface MarkdownPromptProps {
  text: string;
  /**
   * Opt-in: wrap text leaves inside p/strong/em/li in <TappableText> so each
   * word is tappable for definition lookup. Phase 1B mount surface — the
   * caller decides per surface whether to enable it. Default false preserves
   * the original render exactly for any surface that hasn't opted in yet.
   */
  tappable?: boolean;
}

/**
 * Walk a ReactNode tree and wrap every string leaf in <TappableText>.
 * Nested elements (like <strong> from markdown) pass through — the
 * components override on each markdown leaf handles their wrapping.
 */
function wrapStringChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child, i) => {
    if (typeof child === "string") {
      return <TappableText key={i} text={child} />;
    }
    if (typeof child === "number") {
      return <TappableText key={i} text={String(child)} />;
    }
    if (isValidElement(child)) return child;
    return child;
  });
}

// ─── Stable component overrides for ReactMarkdown ────────────────────
//
// CRITICAL — these MUST live at module scope, NOT inside the component.
//
// react-markdown receives the `components` prop and uses each entry as a
// React component type for matching markdown nodes (`React.createElement(
// components[nodeName], props)`). If those component functions are
// recreated on every render, React's reconciler sees a different
// component TYPE between renders → unmounts the entire subtree → remounts
// fresh.
//
// In June 2026 (round 26 / Path B fix) this was diagnosed as the root
// cause of the tap-a-word "popover briefly appears then disappears" bug:
// every render of MarkdownPrompt destroyed all its TappableText children
// (which then destroyed their popovers). Cascade observed in prod when
// any state changed on a lesson page — even an unrelated re-render
// triggered by autosave or context updates would tear down all activity
// content.
//
// The functions here close over no state — they're pure renderers that
// take only `children` and `href`. So module-scope is correct.

function MarkdownAnchor({
  children,
  href,
}: {
  children?: ReactNode;
  href?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-800"
    >
      {children}
    </a>
  );
}

function MarkdownP({ children }: { children?: ReactNode }) {
  return <p>{wrapStringChildren(children)}</p>;
}

function MarkdownStrong({ children }: { children?: ReactNode }) {
  return <strong>{wrapStringChildren(children)}</strong>;
}

function MarkdownEm({ children }: { children?: ReactNode }) {
  return <em>{wrapStringChildren(children)}</em>;
}

function MarkdownLi({ children }: { children?: ReactNode }) {
  return <li>{wrapStringChildren(children)}</li>;
}

const ALLOWED_ELEMENTS = ["p", "strong", "em", "ul", "ol", "li", "a"] as const;

// Plain (non-tappable) — only the anchor needs override, for new-tab / styling.
const PLAIN_COMPONENTS: Components = {
  a: MarkdownAnchor,
};

// Tappable — every text-bearing leaf overridden so its string children get
// wrapped in <TappableText>. Anchors stay non-tappable (they're navigation,
// not vocabulary).
const TAPPABLE_COMPONENTS: Components = {
  p: MarkdownP,
  strong: MarkdownStrong,
  em: MarkdownEm,
  li: MarkdownLi,
  a: MarkdownAnchor,
};

/**
 * Lightweight markdown renderer for activity prompts.
 * Allows: p, strong, em, ul, ol, li, a (opens new tab).
 * No headings, images, or code blocks — keeps prompts clean.
 *
 * Set `tappable` to wrap word leaves in <TappableText> for the
 * Tap-a-word lookup feature (Phase 1B mounts).
 */
export function MarkdownPrompt({ text, tappable = false }: MarkdownPromptProps) {
  return (
    <ReactMarkdown
      allowedElements={[...ALLOWED_ELEMENTS]}
      unwrapDisallowed
      components={tappable ? TAPPABLE_COMPONENTS : PLAIN_COMPONENTS}
    >
      {text}
    </ReactMarkdown>
  );
}

/**
 * Strip markdown syntax for plain-text use (e.g. TextToSpeech).
 * Removes: **bold**, *italic*, [links](url), `code`.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
