"use client";

// ChoiceCardImageUploadButton — sibling of ImageUploadButton but does
// not require unitId (Choice Cards are a library-scoped entity, not
// unit-scoped). Calls /api/teacher/upload-choice-card-image and emits
// the resulting proxy URL via onUploaded.

import { useRef, useState } from "react";

interface Props {
  onUploaded: (url: string) => void;
  label?: string;
  variant?: "inline" | "block";
  disabled?: boolean;
}

type State = "idle" | "uploading" | "error";

export function ChoiceCardImageUploadButton({
  onUploaded,
  label = "📷 Upload image",
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

      const res = await fetch("/api/teacher/upload-choice-card-image", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Upload failed (${res.status})`);
      }

      const { url } = (await res.json()) as { url: string };
      onUploaded(url);
      setState("idle");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
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
    e.target.value = "";
    if (file) void handleFile(file);
  };

  const buttonClass =
    variant === "block"
      ? "px-3 py-1.5 text-[12px] font-semibold bg-white border border-emerald-300 hover:border-emerald-500 rounded-md text-emerald-800 transition-colors"
      : "px-2.5 py-1.5 text-[11.5px] font-semibold bg-white border border-emerald-300 hover:border-emerald-500 rounded text-emerald-800 transition-colors";

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
        <span className="text-[10.5px] font-semibold text-rose-600">{errorMsg}</span>
      )}
    </div>
  );
}
