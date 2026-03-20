'use client';

// This is a placeholder wrapper that delegates to the existing Decision Matrix implementation
// For embedded/standalone mode, import the DecisionMatrix component from student responses
export function DecisionMatrixTool({
  toolId = 'decision-matrix',
  mode = 'public',
  challenge,
  sessionId,
  onSave,
  onComplete,
}: {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  onSave?: (state: any) => void;
  onComplete?: (data: any) => void;
}) {
  // In public mode, delegate to the actual Decision Matrix page
  // In embedded/standalone mode, use persistence hooks
  if (mode === 'public') {
    // Return a message since the actual tool is at /toolkit/decision-matrix
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        background: '#f0f0f0',
        borderRadius: '12px',
        color: '#666',
      }}>
        <p>Decision Matrix is available at /toolkit/decision-matrix</p>
        <p style={{ fontSize: '12px', marginTop: '16px' }}>
          For embedded usage, the full component is available in student responses.
        </p>
      </div>
    );
  }

  // For embedded/standalone modes, the DecisionMatrix component from student/responses should be used
  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      background: '#f0f0f0',
      borderRadius: '12px',
      color: '#666',
    }}>
      <p>Decision Matrix is embedded via the DecisionMatrix component from student responses</p>
    </div>
  );
}
