"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownPromptProps {
  text: string;
}

/**
 * Lightweight markdown renderer for activity prompts.
 * Allows: p, strong, em, ul, ol, li, a (opens new tab).
 * No headings, images, or code blocks — keeps prompts clean.
 */
export function MarkdownPrompt({ text }: MarkdownPromptProps) {
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
