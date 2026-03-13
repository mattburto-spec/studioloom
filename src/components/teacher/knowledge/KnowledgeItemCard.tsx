"use client";

import { KNOWLEDGE_ITEM_TYPES, type KnowledgeItemTypeKey } from "@/lib/constants";
import type { KnowledgeItem } from "@/types/knowledge-library";

interface KnowledgeItemCardProps {
  item: KnowledgeItem;
  onEdit: (item: KnowledgeItem) => void;
  onArchive: (item: KnowledgeItem) => void;
}

export default function KnowledgeItemCard({
  item,
  onEdit,
  onArchive,
}: KnowledgeItemCardProps) {
  const typeMeta = KNOWLEDGE_ITEM_TYPES[item.item_type as KnowledgeItemTypeKey] || KNOWLEDGE_ITEM_TYPES.other;

  return (
    <div
      className="bg-white rounded-xl border border-border overflow-hidden group hover:shadow-sm transition-shadow cursor-pointer"
      onClick={() => onEdit(item)}
    >
      {/* Thumbnail */}
      {item.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail_url}
          alt={item.title}
          className="w-full h-36 object-cover"
        />
      ) : (
        <div
          className="w-full h-20 flex items-center justify-center"
          style={{ backgroundColor: `${typeMeta.color}10` }}
        >
          <TypeIcon icon={typeMeta.icon} color={typeMeta.color} />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Type badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${typeMeta.color}15`, color: typeMeta.color }}
          >
            {typeMeta.label}
          </span>
          {item.is_public && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
              Public
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-text-primary line-clamp-1 mb-1">
          {item.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-text-secondary line-clamp-2 mb-3">
          {item.description || "No description"}
        </p>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-text-secondary"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 4 && (
              <span className="text-[10px] text-text-secondary/50">
                +{item.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Date + Counters + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-text-secondary/60">
            <span>{formatDate(item.created_at)}</span>
            {item.counters.times_linked > 0 && <span>{item.counters.times_linked} linked</span>}
            {item.counters.times_viewed > 0 && <span>{item.counters.times_viewed} views</span>}
          </div>
          <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
              className="w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center text-text-secondary/40 hover:text-accent-blue transition"
              title="Edit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(item); }}
              className="w-7 h-7 rounded-full hover:bg-yellow-50 flex items-center justify-center text-text-secondary/40 hover:text-yellow-600 transition"
              title={item.is_archived ? "Unarchive" : "Archive"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

// Simple icon component using Lucide-style paths
function TypeIcon({ icon, color }: { icon: string; color: string }) {
  const paths: Record<string, React.ReactNode> = {
    BookOpen: (
      <>
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </>
    ),
    LayoutGrid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </>
    ),
    FileText: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>
    ),
    Wrench: (
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    ),
    BookMarked: (
      <>
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <polyline points="10 2 10 10 13 7 16 10 16 2" />
      </>
    ),
    GraduationCap: (
      <>
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
      </>
    ),
    Image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </>
    ),
    Play: (
      <polygon points="5 3 19 12 5 21 5 3" />
    ),
    Music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
    Package: (
      <>
        <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    ),
  };

  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon] || paths.Package}
    </svg>
  );
}
