"use client";

/**
 * /admin/library/[blockId]/interactions — Phase 7C-3
 *
 * Shows a block's relationships: prerequisite tags, shared tags with other
 * blocks, and same-phase blocks. Simple radial graph layout.
 *
 * Block interaction model data may be sparse — handles empty state gracefully.
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface BlockSummary {
  id: string;
  title: string;
  phase: string | null;
  bloom_level: string | null;
  tags: string[];
  prerequisite_tags: string[];
  activity_category: string | null;
  efficacy_score: number;
}

interface RelatedBlock extends BlockSummary {
  relation: "prerequisite" | "dependent" | "same-phase" | "tag-overlap";
  sharedTags: string[];
}

export default function BlockInteractionsPage() {
  const params = useParams();
  const blockId = params.blockId as string;

  const [block, setBlock] = useState<BlockSummary | null>(null);
  const [related, setRelated] = useState<RelatedBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!blockId) return;

    fetch(`/api/admin/library/block-interactions?blockId=${blockId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setBlock(data.block);
        setRelated(data.related || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [blockId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-500">Loading interactions...</p>
      </div>
    );
  }

  if (error || !block) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-sm text-red-600">Error: {error || "Block not found"}</p>
      </div>
    );
  }

  const prerequisites = related.filter((r) => r.relation === "prerequisite");
  const dependents = related.filter((r) => r.relation === "dependent");
  const samePhase = related.filter((r) => r.relation === "same-phase");
  const tagOverlap = related.filter((r) => r.relation === "tag-overlap");

  const relationColor: Record<string, string> = {
    prerequisite: "#3B82F6",
    dependent: "#10B981",
    "same-phase": "#8B5CF6",
    "tag-overlap": "#F59E0B",
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/library"
          className="text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Library
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">{block.title}</span>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">Interactions</span>
      </div>

      {/* Central block card */}
      <div className="bg-white rounded-xl border-2 border-purple-300 p-4 max-w-lg mx-auto text-center">
        <h2 className="text-base font-bold text-gray-900">{block.title}</h2>
        <div className="flex items-center justify-center gap-2 mt-2">
          {block.phase && (
            <span className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded-full">
              {block.phase}
            </span>
          )}
          {block.bloom_level && (
            <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full">
              {block.bloom_level}
            </span>
          )}
          {block.activity_category && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {block.activity_category}
            </span>
          )}
        </div>
        {block.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mt-2">
            {block.tags.map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-gray-50 text-gray-500 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
        {block.prerequisite_tags.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Requires: {block.prerequisite_tags.join(", ")}
          </p>
        )}
      </div>

      {/* Interaction graph — simple list layout grouped by relation type */}
      {related.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No related blocks found</p>
          <p className="text-xs text-gray-400 mt-1">
            Block interaction data may be sparse. Relationships are inferred from
            shared tags and prerequisite_tags.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Prerequisites — blocks this block depends on */}
          {prerequisites.length > 0 && (
            <RelationSection
              title="Prerequisites"
              subtitle="Blocks this block depends on"
              blocks={prerequisites}
              color={relationColor.prerequisite}
            />
          )}

          {/* Dependents — blocks that depend on this block */}
          {dependents.length > 0 && (
            <RelationSection
              title="Dependents"
              subtitle="Blocks that require this block"
              blocks={dependents}
              color={relationColor.dependent}
            />
          )}

          {/* Same phase */}
          {samePhase.length > 0 && (
            <RelationSection
              title="Same Phase"
              subtitle={`Other blocks in "${block.phase}" phase`}
              blocks={samePhase}
              color={relationColor["same-phase"]}
            />
          )}

          {/* Tag overlap */}
          {tagOverlap.length > 0 && (
            <RelationSection
              title="Tag Overlap"
              subtitle="Blocks sharing tags"
              blocks={tagOverlap}
              color={relationColor["tag-overlap"]}
            />
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {Object.entries(relationColor).map(([rel, color]) => (
          <div key={rel} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="capitalize">{rel.replace("-", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelationSection({
  title,
  subtitle,
  blocks,
  color,
}: {
  title: string;
  subtitle: string;
  blocks: RelatedBlock[];
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <span className="ml-auto text-xs text-gray-400">{blocks.length}</span>
      </div>
      <div className="space-y-2">
        {blocks.slice(0, 10).map((b) => (
          <Link
            key={b.id}
            href={`/admin/library/${b.id}/interactions`}
            className="block px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          >
            <p className="text-sm font-medium text-gray-900">{b.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {b.bloom_level && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                  {b.bloom_level}
                </span>
              )}
              <span className="text-[10px] text-gray-400">
                efficacy: {b.efficacy_score}
              </span>
              {b.sharedTags.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  shared: {b.sharedTags.join(", ")}
                </span>
              )}
            </div>
          </Link>
        ))}
        {blocks.length > 10 && (
          <p className="text-xs text-gray-400 text-center">
            +{blocks.length - 10} more
          </p>
        )}
      </div>
    </div>
  );
}
