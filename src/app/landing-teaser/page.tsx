export default function Home() {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        background: '#fafafa',
        color: '#1f2937',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        margin: 0,
        WebkitFontSmoothing: 'antialiased',
      }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          {/* Logo */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: '2.5rem' }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="6" fill="white"/>
              <rect x="2" y="8" width="28" height="5" rx="2.5" fill="#7B2FF2"/>
              <rect x="2" y="19" width="28" height="5" rx="2.5" fill="#7B2FF2"/>
              <rect x="8" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/>
              <rect x="19" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/>
              <rect x="4" y="8" width="12" height="5" rx="2.5" fill="#7B2FF2"/>
              <rect x="16" y="19" width="12" height="5" rx="2.5" fill="#7B2FF2"/>
            </svg>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
              StudioLoom
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(1.75rem, 5vw, 2.25rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            color: '#111827',
            letterSpacing: '-0.025em',
            marginBottom: '1rem',
          }}>
            Project-based learning, beautifully structured
          </h1>

          <p style={{
            fontSize: '1.125rem',
            lineHeight: 1.6,
            color: '#6b7280',
            marginBottom: '2.5rem',
          }}>
            Helping you and your students grow into the best humans you can be.
          </p>

          {/* Email signup - static form, no JS needed for now */}
          <form style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}>
            <input
              type="email"
              placeholder="you@school.edu"
              required
              aria-label="Email address"
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                border: '1.5px solid #e5e7eb',
                borderRadius: 10,
                background: 'white',
                color: '#111827',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                background: '#7B2FF2',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Notify me
            </button>
          </form>
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
            We&apos;ll let you know when early access opens. No spam.
          </p>
        </div>

        <footer style={{ marginTop: '4rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
          &copy; 2026 StudioLoom
        </footer>
      </body>
    </html>
  );
}
