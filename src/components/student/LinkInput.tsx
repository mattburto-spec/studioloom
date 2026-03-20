"use client";

import { useState } from "react";

interface LinkInputProps {
  value: string;
  onChange: (v: string) => void;
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str.startsWith("http") ? str : `https://${str}`);
    return true;
  } catch {
    return false;
  }
}

function getDomain(urlStr: string): string {
  try {
    return new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`)
      .hostname;
  } catch {
    return "";
  }
}

export function LinkInput({ value, onChange }: LinkInputProps) {
  const linkData =
    value && value.startsWith("{")
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return parsed.type === "link" ? parsed : null;
          } catch {
            return null;
          }
        })()
      : null;

  const [url, setUrl] = useState(linkData?.url || "");
  const [title, setTitle] = useState(linkData?.title || "");
  const [error, setError] = useState("");

  function saveLink() {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    if (!isValidUrl(fullUrl)) {
      setError("Please enter a valid URL");
      return;
    }
    setError("");
    onChange(
      JSON.stringify({
        type: "link",
        url: fullUrl,
        title: title || getDomain(fullUrl),
      })
    );
  }

  if (linkData) {
    const domain = getDomain(linkData.url);
    return (
      <div className="border border-border rounded-lg p-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          alt=""
          className="w-8 h-8"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {linkData.title}
          </p>
          <p className="text-xs text-text-secondary truncate">{linkData.url}</p>
        </div>
        <button
          onClick={() => onChange("")}
          className="text-xs text-red-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div>
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          placeholder="https://www.canva.com/design/..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Link title (optional)"
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
        onKeyDown={(e) => {
          if (e.key === "Enter") saveLink();
        }}
      />
      {url && isValidUrl(url.startsWith("http") ? url : `https://${url}`) && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=16`}
            alt=""
            className="w-4 h-4"
          />
          <span>{getDomain(url)}</span>
        </div>
      )}
      <button
        onClick={saveLink}
        disabled={!url.trim()}
        className="px-4 py-2 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition disabled:opacity-40"
      >
        Save Link
      </button>
    </div>
  );
}
