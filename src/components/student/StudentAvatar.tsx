"use client";

import { useState, useRef } from "react";
import type { Student } from "@/types";
import { compressImage } from "@/lib/compress-image";

// Deterministic color from string
const AVATAR_COLORS = [
  "#2E86AB", // accent-blue
  "#E86F2C", // orange
  "#2DA05E", // green
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#F59E0B", // amber
  "#06B6D4", // cyan
  "#EF4444", // red
  "#10B981", // emerald
  "#6366F1", // indigo
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(student: Student): string {
  const name = student.display_name || student.username;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface StudentAvatarProps {
  student: Student;
  size?: number;
  editable?: boolean;
  onAvatarChange?: (newUrl: string) => void;
}

export function StudentAvatar({
  student,
  size = 32,
  editable = false,
  onAvatarChange,
}: StudentAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = getInitials(student);
  const bgColor = getColor(student.display_name || student.username);
  const hasImage = student.avatar_url && !imgError;

  async function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB max

    setUploading(true);
    setShowMenu(false);

    try {
      // Compress aggressively — avatars display at max 60px
      const compressed = await compressImage(file, { maxWidthOrHeight: 400, maxSizeMB: 0.2 });
      const formData = new FormData();
      formData.append("file", compressed);

      const res = await fetch("/api/student/avatar", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setImgError(false);
        onAvatarChange?.(data.url);
      }
    } catch {
      // fail silently
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setShowMenu(false);
    setUploading(true);

    try {
      const res = await fetch("/api/student/avatar", { method: "DELETE" });
      if (res.ok) {
        setImgError(false);
        onAvatarChange?.("");
      }
    } catch {
      // fail silently
    } finally {
      setUploading(false);
    }
  }

  const fontSize = Math.round(size * 0.4);

  return (
    <div className="relative">
      <button
        onClick={() => editable && setShowMenu(!showMenu)}
        disabled={!editable || uploading}
        className={`relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${
          editable ? "cursor-pointer group" : "cursor-default"
        }`}
        style={{ width: size, height: size }}
        title={editable ? "Change profile picture" : undefined}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={student.avatar_url!}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: bgColor, fontSize }}
          >
            {initials}
          </div>
        )}

        {/* Hover overlay for editable */}
        {editable && !uploading && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
            <svg
              width={Math.round(size * 0.35)}
              height={Math.round(size * 0.35)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-hover:opacity-100 transition"
            >
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        )}

        {/* Uploading spinner */}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div
              className="border-2 border-white/30 border-t-white rounded-full animate-spin"
              style={{
                width: Math.round(size * 0.4),
                height: Math.round(size * 0.4),
              }}
            />
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div
            ref={menuRef}
            className="absolute top-full right-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-border py-1 min-w-[160px]"
          >
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-alt transition flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload photo
            </button>
            {hasImage && (
              <button
                onClick={removeAvatar}
                className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 transition flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
                Remove photo
              </button>
            )}
          </div>
        </>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = "";
          setShowMenu(false);
        }}
      />
    </div>
  );
}
