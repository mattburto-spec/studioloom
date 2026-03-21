'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Requirement {
  badge_id: string;
  badge_name: string;
  badge_slug: string;
  is_required: boolean;
  student_has: boolean;
  student_status: 'active' | 'expired' | 'none';
}

interface BadgeGateProps {
  unitId: string;
  children: React.ReactNode;
}

export default function BadgeGate({ unitId, children }: BadgeGateProps) {
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [allMet, setAllMet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkRequirements() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/student/safety/check-requirements?unitId=${encodeURIComponent(unitId)}`
        );

        if (!response.ok) {
          throw new Error('Failed to check requirements');
        }

        const data = await response.json();
        setRequirements(data.requirements || []);
        setAllMet(data.all_met || false);
      } catch (err) {
        console.error('Error checking badge requirements:', err);
        setError('Failed to load safety requirements');
      } finally {
        setLoading(false);
      }
    }

    checkRequirements();
  }, [unitId]);

  // If requirements are met, render children
  if (allMet) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ color: '#666', fontSize: '14px' }}>
          Loading safety requirements...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          color: '#dc2626',
        }}
      >
        <div>{error}</div>
      </div>
    );
  }

  // Gate screen
  const requiredBadges = requirements.filter((r) => r.is_required);
  const recommendedBadges = requirements.filter((r) => !r.is_required);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#f9fafb',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          width: '100%',
          background: 'white',
          borderRadius: '12px',
          padding: '48px 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
        }}
      >
        {/* Shield Icon */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            🛡️
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 8px 0',
            }}
          >
            Safety Certification Required
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#666',
              margin: '0',
            }}
          >
            Complete the required safety badges below to access this unit.
          </p>
        </div>

        {/* Required Badges */}
        {requiredBadges.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'uppercase',
                color: '#6b7280',
                margin: '0 0 12px 0',
                letterSpacing: '0.5px',
              }}
            >
              Required
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {requiredBadges.map((req) => (
                <div
                  key={req.badge_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: req.student_has ? '#f0fdf4' : '#fef3c7',
                    border: `1px solid ${req.student_has ? '#dcfce7' : '#fde68a'}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '18px',
                      marginRight: '12px',
                      minWidth: '24px',
                    }}
                  >
                    {req.student_has ? '✅' : '🔒'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#1f2937',
                      }}
                    >
                      {req.badge_name}
                    </div>
                    {req.student_status === 'expired' && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#d97706',
                          marginTop: '2px',
                        }}
                      >
                        Expired — retake required
                      </div>
                    )}
                  </div>
                  {!req.student_has && (
                    <Link
                      href={`/safety/${req.badge_slug}`}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        marginLeft: '12px',
                        display: 'inline-block',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#4338ca';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#4f46e5';
                      }}
                    >
                      Take Test
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Badges */}
        {recommendedBadges.length > 0 && (
          <div>
            <h2
              style={{
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'uppercase',
                color: '#6b7280',
                margin: '0 0 12px 0',
                letterSpacing: '0.5px',
              }}
            >
              Recommended
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recommendedBadges.map((req) => (
                <div
                  key={req.badge_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div
                    style={{
                      fontSize: '18px',
                      marginRight: '12px',
                      minWidth: '24px',
                    }}
                  >
                    {req.student_has ? '✅' : '💡'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#1f2937',
                      }}
                    >
                      {req.badge_name}
                    </div>
                  </div>
                  {!req.student_has && (
                    <Link
                      href={`/safety/${req.badge_slug}`}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#f3f4f6',
                        color: '#4f46e5',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        marginLeft: '12px',
                        border: '1px solid #d1d5db',
                        display: 'inline-block',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#e5e7eb';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#f3f4f6';
                      }}
                    >
                      Learn More
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
