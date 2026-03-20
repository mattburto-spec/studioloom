'use client';

// This is a placeholder wrapper that delegates to the existing How Might We implementation
// For embedded/standalone mode, import the HowMightWe component from student responses
export function HowMightWeTool({
  toolId = 'how-might-we',
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
  // In public mode, delegate to the actual How Might We page
  // In embedded/standalone mode, use persistence hooks
  if (mode === 'public') {
    // Return a message since the actual tool is at /toolkit/how-might-we
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        background: '#f0f0f0',
        borderRadius: '12px',
        color: '#666',
      }}>
        <p>How Might We is available at /toolkit/how-might-we</p>
        <p style={{ fontSize: '12px', marginTop: '16px' }}>
          For embedded usage, the full component is available in student responses.
        </p>
      </div>
    );
  }

  // For embedded/standalone modes, the HowMightWe component should be used
  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      background: '#f0f0f0',
      borderRadius: '12px',
      color: '#666',
    }}>
      <p>How Might We is embedded via the full component implementation</p>
    </div>
  );
}
