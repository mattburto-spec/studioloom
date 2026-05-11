"use client";

/**
 * ImageUploadButton — file-picker → POST /api/teacher/upload-image →
 * proxy URL → onUploaded callback. Used in the lesson editor wherever
 * a media URL field appears (ActivityBlock media tab + LessonIntroEditor
 * hero) so teachers can attach images from device alongside the existing
 * paste-a-URL flow.
 *
 * Self-contained state: idle / uploading / error. Errors surface inline
 * for a few seconds then clear; the parent doesn't need to know about
 * failure beyond "the URL never came back."
 */

import { useRef, useState } from "react";

interface Props {
  unitId: string;
  onUploaded: (url: string) => void;
  /** Override the button label. Default "📷 Upload". */
  label?: string;
  /** Visual variant — "inline" sits next to a URL input; "block" stands alone. */
  variant?: "inline" | "block";
  disabled?: boolean;
}

type State = "idle" | "uploading" | "error";

export function ImageUploadButton({
  unitId,
  onUploaded,
  label = "📷 Upload",
  variant = "inline",
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    setState("uploading");
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("unitId", unitId);

      const res = await fetch("/api/teacher/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || `Upload failed (${res.status})`);
      }

      const { url } = (await res.json()) as { url: string };
      onUploaded(url);
      setState("idle");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
      // Clear the error after a few seconds so the UI doesn't stay red.
      setTimeout(() => {
        setState("idle");
        setErrorMsg(null);
      }, 3500);
    }
  }

  const onPick = () => {
    if (disabled || state === "uploading") return;
    inputRef.current?.click();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice in a row re-fires onChange.
    e.target.value = "";
    if (file) void handleFile(file);
  };

  const buttonClass =
    variant === "block"
      ? "px-3 py-1.5 text-[12px] font-semibold bg-white border border-[var(--le-hair)] hover:border-[var(--le-ink-2)] rounded-md text-[var(--le-ink-2)] transition-colors"
      : "px-2.5 py-1.5 text-[11.5px] font-semibold bg-white border border-[var(--le-hair)] hover:border-[var(--le-ink-2)] rounded text-[var(--le-ink-2)] transition-colors";

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onPick}
        disabled={disabled || state === "uploading"}
        className={buttonClass}
        style={{
          opacity: disabled ? 0.5 : 1,
          cursor: disabled || state === "uploading" ? "not-allowed" : "pointer",
        }}
      >
        {state === "uploading" ? "Uploading…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        style={{ display: "none" }}
      />
      {state === "error" && errorMsg && (
        <span className="text-[10.5px] text-rose-600 font-semibold">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
