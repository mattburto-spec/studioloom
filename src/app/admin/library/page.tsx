"use client";

import { useState, useEffect, useCallback } from "react";
import BlockBrowser from "@/components/admin/library/BlockBrowser";

export default function LibraryPage() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [phase, setPhase] = useState("");
  const [sort, setSort] = useState("created_at");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (phase) params.set("phase", phase);
    params.set("sort", sort);

    fetch(`/api/admin/library?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setBlocks(data.blocks || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        setBlocks([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [search, category, phase, sort]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Block Library</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search blocks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border rounded-lg px-3 py-1.5 w-64"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5">
          <option value="">All Categories</option>
          <option value="warmup">Warmup</option>
          <option value="research">Research</option>
          <option value="making">Making</option>
          <option value="ideation">Ideation</option>
          <option value="critique">Critique</option>
          <option value="reflection">Reflection</option>
          <option value="assessment">Assessment</option>
        </select>
        <select value={phase} onChange={(e) => setPhase(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5">
          <option value="">All Phases</option>
          <option value="opening">Opening</option>
          <option value="discover">Discover</option>
          <option value="define">Define</option>
          <option value="ideate">Ideate</option>
          <option value="prototype">Prototype</option>
          <option value="test">Test</option>
          <option value="debrief">Debrief</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5">
          <option value="created_at">Newest</option>
          <option value="efficacy">Highest Efficacy</option>
          <option value="usage">Most Used</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
      ) : (
        <BlockBrowser blocks={blocks} total={total} />
      )}
    </div>
  );
}
