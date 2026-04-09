"use client";

export default function AlertsFeed({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm">
        All systems healthy — no active alerts
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-2.5 text-sm border border-red-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{alert}</span>
        </div>
      ))}
    </div>
  );
}
