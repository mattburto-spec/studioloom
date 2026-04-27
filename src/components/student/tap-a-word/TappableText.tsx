"use client";

import { useMemo, useRef, useState } from "react";
import { tokenize } from "./tokenize";
import { useWordLookup } from "./useWordLookup";
import { WordPopover } from "./WordPopover";

/**
 * TappableText — wraps an educational text string and renders each
 * tappable word as a <button> that opens a definition popover.
 *
 * Phase 1A: plain strings only. Markdown surfaces (MarkdownPrompt)
 * get a `tappable` prop that swaps leaf renderers — that integration
 * lands in Phase 1B.
 *
 * Single popover at a time per TappableText instance. The popover
 * anchors to the clicked button's bounding rect; if the user taps a
 * different word, the popover repositions and re-fetches.
 *
 * Untappable tokens (whitespace, punctuation, URLs, 1-char tokens,
 * pure numbers) render as plain spans preserving the original text.
 */

export interface TappableTextProps {
  /** The text to render. */
  text: string;
  /**
   * Optional surrounding sentence for polysemy disambiguation.
   * Phase 1A passes this to the API but does not yet use it server-side
   * (context_hash is hardcoded to '' in the cache). Phase 2 will hash + use.
   */
  contextSentence?: string;
  /** Optional className applied to the wrapping span. */
  className?: string;
}

export function TappableText({ text, contextSentence, className }: TappableTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const lookup = useWordLookup();
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>, word: string) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenWord(word);
    setAnchorRect(rect);
    lookup.lookup(word, contextSentence);
  }

  function handleClose() {
    setOpenWord(null);
    setAnchorRect(null);
    lookup.reset();
  }

  return (
    <span ref={containerRef} className={className}>
      {tokens.map((tok, i) => {
        if (!tok.tappable) {
          return <span key={i}>{tok.text}</span>;
        }
        const isOpen = openWord !== null && openWord === tok.text.toLowerCase();
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => handleClick(e, tok.text)}
            className={
              "inline border-0 bg-transparent p-0 m-0 font-inherit text-inherit cursor-pointer " +
              "hover:underline hover:decoration-dotted hover:decoration-gray-400 hover:underline-offset-2 " +
              (isOpen ? "underline decoration-dotted decoration-gray-500 underline-offset-2" : "")
            }
            aria-label={`Look up ${tok.text}`}
          >
            {tok.text}
          </button>
        );
      })}
      {openWord && anchorRect && (
        <WordPopover
          word={openWord}
          state={lookup.state}
          definition={lookup.definition}
          exampleSentence={lookup.exampleSentence}
          l1Translation={lookup.l1Translation}
          l1Target={lookup.l1Target}
          errorMessage={lookup.errorMessage}
          anchorRect={anchorRect}
          onClose={handleClose}
        />
      )}
    </span>
  );
}
