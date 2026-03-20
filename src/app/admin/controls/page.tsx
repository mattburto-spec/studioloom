"use client";

import { AIControlPanel } from "@/components/admin/AIControlPanel";

export default function AdminControlsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <AIControlPanel
        onSave={(macro, school) => {
          console.log("Save:", { macro, school });
          // TODO: wire to API
        }}
      />
    </div>
  );
}
