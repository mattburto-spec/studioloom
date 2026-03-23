'use client';

import React, { useMemo } from 'react';

interface BadgeNode {
  id: string;
  name: string;
  icon: string;
  tier: 1 | 2 | 3 | 4;
  color: string;
  prerequisites: string[];
  description: string;
}

interface BadgePathProps {
  earnedBadgeIds: string[];
  onBadgeClick?: (badgeId: string) => void;
  theme?: 'dark' | 'light';
}

// Define the complete badge tree
const BADGE_TREE: BadgeNode[] = [
  // TIER 1: Foundation
  {
    id: 'general-workshop-safety',
    name: 'General Workshop Safety',
    icon: '⚠️',
    tier: 1,
    color: '#FF6B6B',
    prerequisites: [],
    description: 'Essential workshop safety fundamentals',
  },
  {
    id: 'fire-safety-emergency',
    name: 'Fire Safety & Emergency',
    icon: '🔥',
    tier: 1,
    color: '#FF8C00',
    prerequisites: [],
    description: 'Emergency response and fire prevention',
  },
  {
    id: 'ppe-fundamentals',
    name: 'PPE Fundamentals',
    icon: '🥽',
    tier: 1,
    color: '#FFB74D',
    prerequisites: [],
    description: 'Personal protective equipment essentials',
  },
  {
    id: 'hand-tool-safety',
    name: 'Hand Tool Safety',
    icon: '🔨',
    tier: 1,
    color: '#FFC857',
    prerequisites: [],
    description: 'Safe use of hand tools',
  },

  // TIER 2: Workshop Areas (all require General Workshop Safety)
  {
    id: 'wood-workshop',
    name: 'Wood Workshop',
    icon: '🪵',
    tier: 2,
    color: '#A8E6CF',
    prerequisites: ['general-workshop-safety'],
    description: 'Woodworking safety and techniques',
  },
  {
    id: 'metal-workshop',
    name: 'Metal Workshop',
    icon: '⚙️',
    tier: 2,
    color: '#95B8D1',
    prerequisites: ['general-workshop-safety'],
    description: 'Metalworking safety and techniques',
  },
  {
    id: 'plastics-composites',
    name: 'Plastics & Composites',
    icon: '🧩',
    tier: 2,
    color: '#FFD3B6',
    prerequisites: ['general-workshop-safety'],
    description: 'Working with plastics and composite materials',
  },
  {
    id: 'electronics-soldering',
    name: 'Electronics & Soldering',
    icon: '🔌',
    tier: 2,
    color: '#F4A261',
    prerequisites: ['general-workshop-safety'],
    description: 'Electronics safety and soldering techniques',
  },
  {
    id: 'digital-fabrication',
    name: 'Digital Fabrication',
    icon: '💻',
    tier: 2,
    color: '#E76F51',
    prerequisites: ['general-workshop-safety'],
    description: 'CAM software and digital tools',
  },
  {
    id: 'textiles',
    name: 'Textiles',
    icon: '🧵',
    tier: 2,
    color: '#D62828',
    prerequisites: ['general-workshop-safety'],
    description: 'Textile and sewing safety',
  },

  // TIER 3: Machine Specific
  {
    id: 'band-saw',
    name: 'Band Saw',
    icon: '🔪',
    tier: 3,
    color: '#06A77D',
    prerequisites: ['wood-workshop'],
    description: 'Band saw operation and safety',
  },
  {
    id: 'scroll-saw',
    name: 'Scroll Saw',
    icon: '📐',
    tier: 3,
    color: '#119B9B',
    prerequisites: ['wood-workshop'],
    description: 'Scroll saw precision cutting',
  },
  {
    id: 'pedestal-drill',
    name: 'Pedestal Drill',
    icon: '⬇️',
    tier: 3,
    color: '#3DADC6',
    prerequisites: ['metal-workshop'],
    description: 'Drill press operation',
  },
  {
    id: 'disc-sander',
    name: 'Disc Sander',
    icon: '⭕',
    tier: 3,
    color: '#1D82B7',
    prerequisites: ['wood-workshop'],
    description: 'Disc sanding technique',
  },
  {
    id: 'wood-lathe',
    name: 'Wood Lathe',
    icon: '🔄',
    tier: 3,
    color: '#0066CC',
    prerequisites: ['wood-workshop'],
    description: 'Wood turning on the lathe',
  },
  {
    id: 'laser-cutter',
    name: 'Laser Cutter',
    icon: '✂️',
    tier: 3,
    color: '#8B39FF',
    prerequisites: ['digital-fabrication'],
    description: 'Laser cutting and engraving',
  },
  {
    id: '3d-printer',
    name: '3D Printer',
    icon: '🖨️',
    tier: 3,
    color: '#B53DA8',
    prerequisites: ['digital-fabrication'],
    description: '3D printing operation and prep',
  },
  {
    id: 'sewing-machine',
    name: 'Sewing Machine',
    icon: '🪡',
    tier: 3,
    color: '#E63C7A',
    prerequisites: ['textiles'],
    description: 'Sewing machine mastery',
  },

  // TIER 4: Materials & Processes
  {
    id: 'resin-casting',
    name: 'Resin Casting',
    icon: '🧴',
    tier: 4,
    color: '#D4A574',
    prerequisites: ['plastics-composites'],
    description: 'Safe resin casting techniques',
  },
  {
    id: 'vacuum-forming',
    name: 'Vacuum Forming',
    icon: '💨',
    tier: 4,
    color: '#C9ADA7',
    prerequisites: ['plastics-composites'],
    description: 'Vacuum forming process',
  },
  {
    id: 'screen-printing',
    name: 'Screen Printing',
    icon: '🖼️',
    tier: 4,
    color: '#9A8C98',
    prerequisites: ['textiles'],
    description: 'Screen printing on textiles',
  },
];

type BadgeStatus = 'locked' | 'available' | 'earned';

const BadgePathVisualization: React.FC<BadgePathProps> = ({
  earnedBadgeIds,
  onBadgeClick,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  // Determine status of each badge
  const badgeStatus = useMemo(() => {
    const statusMap = new Map<string, BadgeStatus>();

    BADGE_TREE.forEach((badge) => {
      if (earnedBadgeIds.includes(badge.id)) {
        statusMap.set(badge.id, 'earned');
      } else {
        // Check if prerequisites are met
        const prereqsMet = badge.prerequisites.length === 0 ||
          badge.prerequisites.every((prereqId) => earnedBadgeIds.includes(prereqId));
        statusMap.set(badge.id, prereqsMet ? 'available' : 'locked');
      }
    });

    return statusMap;
  }, [earnedBadgeIds]);

  // Group badges by tier
  const badgesByTier = useMemo(() => {
    return {
      tier1: BADGE_TREE.filter((b) => b.tier === 1),
      tier2: BADGE_TREE.filter((b) => b.tier === 2),
      tier3: BADGE_TREE.filter((b) => b.tier === 3),
      tier4: BADGE_TREE.filter((b) => b.tier === 4),
    };
  }, []);

  // Render connecting line from prerequisite to badge
  const renderConnectionLine = (
    fromBadgeId: string,
    toBadgeId: string,
    index: number
  ) => {
    // Find y position of from badge and to badge
    // This is a simplified approach using SVG lines
    const fromBadge = BADGE_TREE.find((b) => b.id === fromBadgeId);
    const toBadge = BADGE_TREE.find((b) => b.id === toBadgeId);

    if (!fromBadge || !toBadge) return null;

    // Calculate approximate positions based on tier
    const tierHeight = 160;
    const fromY = (fromBadge.tier - 1) * tierHeight + 40;
    const toY = (toBadge.tier - 1) * tierHeight + 40;

    // Calculate column positions (simplified for layout)
    const fromX = (BADGE_TREE.indexOf(fromBadge) % 3) * 150 + 75;
    const toX = (BADGE_TREE.indexOf(toBadge) % 3) * 150 + 75;

    const lineColor = isDark ? 'rgba(100, 200, 255, 0.3)' : 'rgba(100, 150, 200, 0.4)';

    return (
      <line
        key={`line-${fromBadgeId}-${toBadgeId}`}
        x1={fromX}
        y1={fromY + 40}
        x2={toX}
        y2={toY}
        stroke={lineColor}
        strokeWidth={2}
        strokeDasharray={badgeStatus.get(toBadgeId) === 'earned' ? '0' : '5,5'}
        style={{ transition: 'stroke-dasharray 0.3s ease' }}
      />
    );
  };

  const renderBadgeNode = (badge: BadgeNode) => {
    const status = badgeStatus.get(badge.id) || 'locked';
    const isEarned = status === 'earned';
    const isAvailable = status === 'available';
    const isLocked = status === 'locked';

    let bgColor = isDark ? '#1a1a2e' : '#f5f5f5';
    let borderColor = '#666';
    let textColor = isDark ? '#999' : '#999';
    let glowColor = 'transparent';

    if (isLocked) {
      bgColor = isDark ? '#0f0f1e' : '#efefef';
      borderColor = isDark ? '#333' : '#ddd';
      textColor = isDark ? '#555' : '#bbb';
    } else if (isAvailable) {
      bgColor = isDark ? '#1a2e3e' : '#e8f4f8';
      borderColor = badge.color;
      textColor = isDark ? '#ccc' : '#333';
      glowColor = `${badge.color}40`;
    } else if (isEarned) {
      bgColor = isDark ? '#1a3e1a' : '#e8f8e8';
      borderColor = '#4ade80';
      textColor = isDark ? '#4ade80' : '#22c55e';
      glowColor = '#4ade8060';
    }

    return (
      <div
        key={badge.id}
        onClick={() => onBadgeClick?.(badge.id)}
        style={{
          cursor: onBadgeClick ? 'pointer' : 'default',
          position: 'relative',
          backgroundColor: bgColor,
          border: `2px solid ${borderColor}`,
          borderRadius: '12px',
          padding: '12px 16px',
          textAlign: 'center',
          minWidth: '140px',
          transition: isAvailable
            ? 'all 0.3s ease'
            : 'all 0.2s ease',
          transform:
            isAvailable && !isEarned
              ? 'scale(1.02)'
              : 'scale(1)',
          boxShadow:
            isEarned
              ? `0 0 12px ${glowColor}, inset 0 0 8px ${glowColor}`
              : isAvailable
              ? `0 0 8px ${glowColor}, 0 2px 8px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`
              : `0 2px 4px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}`,
          animation:
            isAvailable && !isEarned
              ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              : 'none',
        }}
        title={badge.description}
      >
        {/* Badge Icon */}
        <div
          style={{
            fontSize: '32px',
            marginBottom: '8px',
            opacity: isLocked ? 0.4 : 1,
          }}
        >
          {badge.icon}
        </div>

        {/* Badge Name */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: textColor,
            marginBottom: '4px',
            lineHeight: '1.3',
          }}
        >
          {badge.name}
        </div>

        {/* Status Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '11px',
            color: textColor,
            opacity: 0.8,
          }}
        >
          {isEarned && <span style={{ color: '#4ade80' }}>✓ Earned</span>}
          {isAvailable && !isEarned && (
            <span style={{ color: badge.color }}>● Ready</span>
          )}
          {isLocked && (
            <span style={{ color: isDark ? '#555' : '#bbb' }}>🔒 Locked</span>
          )}
        </div>

        {/* Earned Checkmark */}
        {isEarned && (
          <div
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              width: '28px',
              height: '28px',
              backgroundColor: '#4ade80',
              color: '#fff',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(74, 222, 128, 0.4)',
            }}
          >
            ✓
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: isDark ? '#0a0a0f' : '#fafafa',
        color: isDark ? '#e0e0e0' : '#333',
        padding: '32px',
        borderRadius: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2
          style={{
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #64b5f6 0%, #81c784 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Workshop Safety Badge Path
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: isDark ? '#aaa' : '#666',
            margin: '0',
          }}
        >
          {`${earnedBadgeIds.length} of ${BADGE_TREE.length} badges earned`}
        </p>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: isDark ? '#1a1a2e' : '#e0e0e0',
          borderRadius: '4px',
          marginBottom: '32px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(earnedBadgeIds.length / BADGE_TREE.length) * 100}%`,
            background: 'linear-gradient(90deg, #64b5f6 0%, #81c784 100%)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Tier 1: Foundation */}
      <div style={{ marginBottom: '40px' }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '700',
            color: isDark ? '#ff6b6b' : '#cc3333',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          🏆 Tier 1: Foundation
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
          }}
        >
          {badgesByTier.tier1.map((badge) => renderBadgeNode(badge))}
        </div>
      </div>

      {/* Tier 2: Workshop Areas */}
      <div style={{ marginBottom: '40px' }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '700',
            color: isDark ? '#ffd700' : '#cc8800',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          🎯 Tier 2: Workshop Specialties
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
          }}
        >
          {badgesByTier.tier2.map((badge) => renderBadgeNode(badge))}
        </div>
        <p
          style={{
            fontSize: '12px',
            color: isDark ? '#888' : '#999',
            marginTop: '12px',
            marginBottom: '0',
            fontStyle: 'italic',
          }}
        >
          Requires: General Workshop Safety (Tier 1)
        </p>
      </div>

      {/* Tier 3: Machines */}
      <div style={{ marginBottom: '40px' }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '700',
            color: isDark ? '#64b5f6' : '#0066cc',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          ⚙️ Tier 3: Machine Mastery
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
          }}
        >
          {badgesByTier.tier3.map((badge) => renderBadgeNode(badge))}
        </div>
        <p
          style={{
            fontSize: '12px',
            color: isDark ? '#888' : '#999',
            marginTop: '12px',
            marginBottom: '0',
            fontStyle: 'italic',
          }}
        >
          Requires: Corresponding Tier 2 specialty badge
        </p>
      </div>

      {/* Tier 4: Advanced Processes */}
      <div style={{ marginBottom: '0' }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '700',
            color: isDark ? '#a78bfa' : '#7c3aed',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          🚀 Tier 4: Master Craftsperson
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
          }}
        >
          {badgesByTier.tier4.map((badge) => renderBadgeNode(badge))}
        </div>
        <p
          style={{
            fontSize: '12px',
            color: isDark ? '#888' : '#999',
            marginTop: '12px',
            marginBottom: '0',
            fontStyle: 'italic',
          }}
        >
          Requires: Corresponding Tier 2 specialty badge
        </p>
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: `1px solid ${isDark ? '#333' : '#ddd'}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#4ade80',
              borderRadius: '50%',
            }}
          />
          <span style={{ fontSize: '13px', color: isDark ? '#aaa' : '#666' }}>
            Earned
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#64b5f6',
              borderRadius: '50%',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
          <span style={{ fontSize: '13px', color: isDark ? '#aaa' : '#666' }}>
            Available
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: isDark ? '#333' : '#ddd',
              borderRadius: '50%',
            }}
          />
          <span style={{ fontSize: '13px', color: isDark ? '#666' : '#999' }}>
            Locked
          </span>
        </div>
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default BadgePathVisualization;
