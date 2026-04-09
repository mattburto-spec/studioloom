"use client";

interface CostData {
  todayUSD: number;
  weekUSD: number;
  monthUSD: number;
  dailyBreakdown: Array<{ date: string; usd: number }>;
  alerts: string[];
}

export default function CostOverview({ data }: { data: CostData }) {
  const maxCost = Math.max(...data.dailyBreakdown.map(d => d.usd), 0.01);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500">Today</div>
          <div className="text-2xl font-bold text-gray-900">${data.todayUSD.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500">This Week</div>
          <div className="text-2xl font-bold text-gray-900">${data.weekUSD.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500">This Month</div>
          <div className="text-2xl font-bold text-gray-900">${data.monthUSD.toFixed(2)}</div>
        </div>
      </div>

      {/* Daily bar chart */}
      {data.dailyBreakdown.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Spend</h3>
          <div className="flex items-end gap-1 h-32">
            {data.dailyBreakdown.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-purple-500 rounded-t"
                  style={{ height: `${Math.max((d.usd / maxCost) * 100, 2)}%` }}
                  title={`${d.date}: $${d.usd.toFixed(4)}`}
                />
                <div className="text-[9px] text-gray-400 truncate w-full text-center">
                  {d.date.slice(5)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className="bg-amber-50 text-amber-700 rounded-lg px-4 py-2 text-sm border border-amber-100">
              {alert}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
