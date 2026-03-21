'use client';

import { useState, useEffect } from 'react';

interface BadgeRequirement {
  id: string;
  badge_id: string;
  badge_name: string;
  badge_slug: string;
  is_required: boolean;
}

interface SafetyRequirementsProps {
  unitId: string;
}

export default function SafetyRequirements({ unitId }: SafetyRequirementsProps) {
  const [expanded, setExpanded] = useState(false);
  const [requirements, setRequirements] = useState<BadgeRequirement[]>([]);
  const [allBadges, setAllBadges] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;

    async function loadRequirements() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/teacher/badges/unit-requirements?unitId=${encodeURIComponent(unitId)}`
        );
        if (response.ok) {
          const data = await response.json();
          setRequirements(data.requirements || []);
        }
      } catch (err) {
        console.error('Error loading requirements:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRequirements();
  }, [unitId, expanded]);

  async function loadAllBadges() {
    setLoadingBadges(true);
    try {
      const response = await fetch('/api/teacher/badges/list');
      if (response.ok) {
        const data = await response.json();
        setAllBadges(data.badges || []);
      }
    } catch (err) {
      console.error('Error loading badges:', err);
    } finally {
      setLoadingBadges(false);
    }
  }

  async function addRequirement(badgeId: string) {
    try {
      const response = await fetch('/api/teacher/badges/unit-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, badgeId, isRequired: true }),
      });

      if (response.ok) {
        const data = await response.json();
        // Add to list
        const badge = allBadges.find((b) => b.id === badgeId);
        if (badge) {
          setRequirements([
            ...requirements,
            {
              id: data.requirement.id,
              badge_id: badgeId,
              badge_name: badge.name,
              badge_slug: badge.slug,
              is_required: true,
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Error adding requirement:', err);
    }
  }

  async function removeRequirement(requirementId: string) {
    setRemovingId(requirementId);
    try {
      const response = await fetch('/api/teacher/badges/unit-requirements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementId }),
      });

      if (response.ok) {
        setRequirements((prev) => prev.filter((r) => r.id !== requirementId));
      }
    } catch (err) {
      console.error('Error removing requirement:', err);
    } finally {
      setRemovingId(null);
    }
  }

  const availableForAdd = allBadges.filter(
    (badge) => !requirements.some((r) => r.badge_id === badge.id)
  );

  return (
    <div>
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && allBadges.length === 0) {
            loadAllBadges();
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-white hover:bg-surface-alt transition-colors"
      >
        <div className="text-left">
          <span className="text-base font-semibold text-text-primary">
            Safety Requirements
          </span>
          {requirements.length > 0 && (
            <span className="block text-xs text-text-tertiary mt-0.5">
              {requirements.length} badge{requirements.length !== 1 ? 's' : ''} required
            </span>
          )}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-tertiary transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 p-4 rounded-xl border border-border bg-surface-alt">
          {loading ? (
            <div className="text-sm text-text-secondary">Loading...</div>
          ) : requirements.length === 0 ? (
            <div className="text-sm text-text-secondary mb-3">
              No safety requirements yet.
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {requirements.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-border"
                >
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {req.badge_name}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {req.is_required ? '✓ Required' : '○ Recommended'}
                    </div>
                  </div>
                  <button
                    onClick={() => removeRequirement(req.id)}
                    disabled={removingId === req.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {removingId === req.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add requirement dropdown */}
          {availableForAdd.length > 0 && (
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">
                Add Requirement
              </label>
              <div className="space-y-1.5">
                {availableForAdd.map((badge) => (
                  <button
                    key={badge.id}
                    onClick={() => addRequirement(badge.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm bg-white border border-border hover:bg-surface-alt transition-colors text-text-primary"
                  >
                    + {badge.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableForAdd.length === 0 && requirements.length > 0 && (
            <div className="text-xs text-text-tertiary border-t border-border pt-3">
              All badges have been added.
            </div>
          )}

          {loadingBadges && !expanded && (
            <div className="text-xs text-text-secondary">Loading badges...</div>
          )}
        </div>
      )}
    </div>
  );
}
