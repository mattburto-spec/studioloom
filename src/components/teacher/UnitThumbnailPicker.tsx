"use client";

import { useRef, useState, useMemo } from "react";

// ── Curated gallery: 30 Unsplash photos covering design/workshop/maker themes ──
const GALLERY_PHOTOS = [
  // Workshop & Making
  { url: "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=600&h=400&fit=crop", label: "Workshop tools" },
  { url: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600&h=400&fit=crop", label: "Woodworking" },
  { url: "https://images.unsplash.com/photo-1565034946487-077786996e27?w=600&h=400&fit=crop", label: "Maker space" },
  { url: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&h=400&fit=crop", label: "Prototyping" },
  { url: "https://images.unsplash.com/photo-1504917595217-d4dc5ede4c48?w=600&h=400&fit=crop", label: "3D Printing" },
  // Technology & Digital
  { url: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&h=400&fit=crop", label: "Robotics" },
  { url: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=600&h=400&fit=crop", label: "Electronics" },
  { url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop", label: "Digital design" },
  { url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop", label: "Circuit board" },
  // Design & Creative
  { url: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop", label: "Sketching" },
  { url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=400&fit=crop", label: "Art studio" },
  { url: "https://images.unsplash.com/photo-1541462608143-67571c6738dd?w=600&h=400&fit=crop", label: "Creative process" },
  { url: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=600&h=400&fit=crop", label: "Photography" },
  { url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&h=400&fit=crop", label: "Architecture" },
  // Classroom & Collaboration
  { url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&h=400&fit=crop", label: "Students" },
  { url: "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600&h=400&fit=crop", label: "Classroom" },
  { url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&h=400&fit=crop", label: "Teamwork" },
  { url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop", label: "Collaboration" },
  // Nature & Environment
  { url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=400&fit=crop", label: "Forest" },
  { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop", label: "Beach" },
  { url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&h=400&fit=crop", label: "Landscape" },
  { url: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&h=400&fit=crop", label: "Plants" },
  // Community & Service
  { url: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=600&h=400&fit=crop", label: "Community" },
  { url: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&h=400&fit=crop", label: "Volunteering" },
  // Materials & Textures
  { url: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop", label: "Paper craft" },
  { url: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=600&h=400&fit=crop", label: "Abstract color" },
  { url: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=600&h=400&fit=crop", label: "Paint swirl" },
  // Misc design
  { url: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=600&h=400&fit=crop", label: "Blueprint" },
  { url: "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=600&h=400&fit=crop", label: "Color palette" },
  { url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop", label: "Data viz" },
];

// Same gradient palette as UnitThumbnail
const GRADIENT_PALETTE = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)",
];

function hashTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % GRADIENT_PALETTE.length;
}

interface UnitThumbnailPickerProps {
  unitId: string;
  unitTitle: string;
  currentThumbnailUrl: string | null;
  onThumbnailChange: (url: string | null) => void;
}

export default function UnitThumbnailPicker({
  unitId,
  unitTitle,
  currentThumbnailUrl,
  onThumbnailChange,
}: UnitThumbnailPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const gradient = useMemo(
    () => GRADIENT_PALETTE[hashTitle(unitTitle)],
    [unitTitle]
  );

  // Save a gallery URL (or null to reset)
  async function saveGalleryUrl(url: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/unit-thumbnail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, thumbnailUrl: url }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }
      onThumbnailChange(url);
      setIsOpen(false);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Upload a custom image
  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only images allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Max 5MB");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("unitId", unitId);

      const res = await fetch("/api/teacher/upload-unit-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        return;
      }

      const { url } = await res.json();
      onThumbnailChange(url);
      setIsOpen(false);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* Current thumbnail preview + change button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative w-full aspect-[16/7] rounded-xl overflow-hidden border-2 border-gray-200 hover:border-purple-400 transition-all cursor-pointer"
      >
        {currentThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentThumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: gradient }}
          >
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none" style={{ opacity: 0.3 }}>
              <line x1="30" y1="20" x2="30" y2="80" stroke="white" strokeWidth="8" strokeLinecap="round" />
              <line x1="70" y1="20" x2="70" y2="80" stroke="white" strokeWidth="8" strokeLinecap="round" />
              <line x1="20" y1="40" x2="80" y2="40" stroke="white" strokeWidth="8" strokeLinecap="round" />
              <line x1="20" y1="60" x2="80" y2="60" stroke="white" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-semibold flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {currentThumbnailUrl ? "Change image" : "Add cover image"}
          </span>
        </div>
      </button>

      {/* Picker panel */}
      {isOpen && (
        <div className="mt-3 border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800">Choose Cover Image</h3>
            <div className="flex items-center gap-2">
              {currentThumbnailUrl && (
                <button
                  onClick={() => saveGalleryUrl(null)}
                  disabled={saving}
                  className="text-xs text-gray-500 hover:text-red-500 transition font-medium"
                >
                  Reset to default
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Upload section */}
          <div className="px-4 pt-3 pb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition text-sm font-medium text-gray-600 hover:text-purple-700"
            >
              {uploading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload your own image
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-4 py-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">or pick from gallery</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Gallery grid */}
          <div className="px-4 py-3 max-h-[320px] overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {GALLERY_PHOTOS.map((photo) => {
                const isSelected = currentThumbnailUrl === photo.url;
                return (
                  <button
                    key={photo.url}
                    onClick={() => saveGalleryUrl(photo.url)}
                    disabled={saving}
                    className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.03] ${
                      isSelected
                        ? "border-purple-500 ring-2 ring-purple-300 shadow-md"
                        : "border-transparent hover:border-purple-300"
                    }`}
                    title={photo.label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url.replace("w=600&h=400", "w=200&h=150")}
                      alt={photo.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </div>
                    )}
                    {/* Label on hover */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 hover:opacity-100 transition">
                      <span className="text-[9px] text-white font-medium">{photo.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 pb-3">
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            </div>
          )}

          {/* Saving indicator */}
          {saving && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <div className="animate-spin w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full" />
                Saving...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
