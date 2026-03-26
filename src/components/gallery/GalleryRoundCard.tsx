"use client";

// Inline SVGs since lucide-react version may not have Calendar/Users

interface GalleryRoundCardProps {
  round: {
    id: string;
    title: string;
    status: "open" | "closed";
    created_at: string;
    deadline: string | null;
    submission_count?: number;
    total_students?: number;
    review_completion?: number;
  };
  onClick: () => void;
}

export function GalleryRoundCard({
  round,
  onClick,
}: GalleryRoundCardProps) {
  const createdDate = new Date(round.created_at);
  const deadlineDate = round.deadline ? new Date(round.deadline) : null;
  const isOverdue = deadlineDate && deadlineDate < new Date();
  const daysLeft = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const submissionCount = round.submission_count || 0;
  const totalStudents = round.total_students || 24;
  const submissionPercent = totalStudents > 0 ? Math.round((submissionCount / totalStudents) * 100) : 0;
  const reviewCompletion = round.review_completion || 0;

  const statusColor =
    round.status === "open"
      ? "bg-green-50 border-green-200 hover:bg-green-100"
      : "bg-gray-50 border-gray-200 hover:bg-gray-100";

  const statusBadge =
    round.status === "open"
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-800";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border-2 rounded-xl p-5 transition-all hover:shadow-md ${statusColor}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-lg mb-1 line-clamp-2">{round.title}</h3>
          <p className="text-xs text-gray-500">{createdDate.toLocaleDateString()}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ml-2 ${statusBadge}`}>
          {round.status === "open" ? "Open" : "Closed"}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700">Submissions</p>
          <p className="text-xs font-semibold text-purple-600">
            {submissionCount}/{totalStudents}
          </p>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300"
            style={{ width: `${submissionPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 text-center mb-4">
        <div>
          <p className="text-xs text-gray-600 mb-1">Submissions</p>
          <p className="text-sm font-bold text-gray-900">{submissionPercent}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Reviews</p>
          <p className="text-sm font-bold text-gray-900">{reviewCompletion}%</p>
        </div>
        <div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-400 mb-1"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p className="text-sm font-bold text-gray-900">{totalStudents}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200 text-xs">
        {deadlineDate ? (
          <div className="flex items-center gap-1 text-gray-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            {isOverdue ? (
              <span className="text-red-600 font-medium">Overdue</span>
            ) : daysLeft !== null && daysLeft <= 3 ? (
              <span className="text-amber-600 font-medium">{daysLeft} days left</span>
            ) : (
              <span>{deadlineDate.toLocaleDateString()}</span>
            )}
          </div>
        ) : (
          <span className="text-gray-500">No deadline</span>
        )}
        <span className="text-gray-500">
          {round.status === "open" ? "In Progress" : "Archived"}
        </span>
      </div>
    </button>
  );
}
