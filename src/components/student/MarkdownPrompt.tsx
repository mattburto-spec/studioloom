"use client";

import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
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

/**
 * Lightweight markdown renderer for activity prompts.
 * Allows: p, strong, em, ul, ol, li, a (opens new tab).
 * No headings, images, or code blocks — keeps prompts clean.
 *
 * Set `tappable` to wrap word leaves in <TappableText> for the
 * Tap-a-word lookup feature (Phase 1B mounts).
 */
export function MarkdownPrompt({ text, tappable = false }: MarkdownPromptProps) {
  if (!tappable) {
    return (
      <ReactMarkdown
        allowedElements={["p", "strong", "em", "ul", "ol", "li", "a"]}
        unwrapDisallowed
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    );
  }

  // Tappable mode: override each text-bearing leaf so its string children get
  // wrapped in <TappableText>. Anchors stay non-tappable (they're navigation,
  // not vocabulary).
  return (
    <ReactMarkdown
      allowedElements={["p", "strong", "em", "ul", "ol", "li", "a"]}
      unwrapDisallowed
      components={{
        p: ({ children }) => <p>{wrapStringChildren(children)}</p>,
        strong: ({ children }) => <strong>{wrapStringChildren(children)}</strong>,
        em: ({ children }) => <em>{wrapStringChildren(children)}</em>,
        li: ({ children }) => <li>{wrapStringChildren(children)}</li>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            {children}
          </a>
        ),
      }}
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
