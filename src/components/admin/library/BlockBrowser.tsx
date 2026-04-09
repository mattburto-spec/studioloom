"use client";

interface Block {
  id: string;
  title: string;
  description?: string;
  bloom_level?: string;
  time_weight?: string;
  phase?: string;
  activity_category?: string;
  efficacy_score?: number;
  times_used?: number;
  source_type?: string;
  created_at: string;
}

const BLOOM_COLORS: Record<string, string> = {
  remember: "bg-red-100 text-red-700",
  understand: "bg-orange-100 text-orange-700",
  apply: "bg-yellow-100 text-yellow-700",
  analyze: "bg-green-100 text-green-700",
  evaluate: "bg-blue-100 text-blue-700",
  create: "bg-purple-100 text-purple-700",
};

export default function BlockBrowser({ blocks, total }: { blocks: Block[]; total: number }) {
  if (blocks.length === 0) {
    return <div className="text-gray-400 text-sm py-8 text-center">No blocks in library yet</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400">{total} blocks total</div>
      <div className="grid gap-3">
        {blocks.map((block) => (
          <div key={block.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">{block.title}</h4>
                  {block.bloom_level && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${BLOOM_COLORS[block.bloom_level] || "bg-gray-100 text-gray-600"}`}>
                      {block.bloom_level}
                    </span>
                  )}
                </div>
                {block.description && (
                  <p className="text-xs text-gray-500 line-clamp-2">{block.description}</p>
                )}
                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                  {block.phase && <span>{block.phase}</span>}
                  {block.activity_category && <span>{block.activity_category}</span>}
                  {block.time_weight && <span>{block.time_weight}</span>}
                  {block.source_type && <span className="text-purple-500">{block.source_type}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {block.efficacy_score != null && (
                  <div className="text-lg font-bold text-gray-900">{block.efficacy_score}</div>
                )}
                {block.times_used != null && (
                  <div className="text-xs text-gray-400">{block.times_used} uses</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
