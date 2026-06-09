export default function TrialExpiredModal({ onSignOut }) {
  const handleUpgrade = () => {
    // Navigate to settings or upgrade page. Here we just redirect to settings.
    window.location.href = '/settings';
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'var(--font-body)',
      padding: '24px',
      animation: 'fadeIn 0.4s var(--ease-smooth)'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        background: 'var(--card)',
        border: '1px solid var(--border-glass)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-lg), 0 0 40px var(--accent-glow)',
        padding: '38px',
        textAlign: 'center',
        animation: 'scaleIn 0.3s var(--ease-spring)'
      }}>
        {/* Hourglass Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'var(--error-glow, rgba(220, 38, 38, 0.08))',
          color: 'var(--error, #dc2626)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 2h14"></path>
            <path d="M5 22h14"></path>
            <path d="M19 2v4c0 4-3 7-7 7s-7-3-7-7V2"></path>
            <path d="M5 22v-4c0-4 3-7 7-7s7 3 7 7v4"></path>
          </svg>
        </div>

        <h2 style={{
          fontFamily: 'var(--font-header)',
          fontSize: '1.6rem',
          fontWeight: 800,
          color: 'var(--foreground)',
          marginBottom: '12px'
        }}>
          Your trial has expired
        </h2>

        <p style={{
          fontSize: '0.94rem',
          color: 'var(--muted-foreground)',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          Your 30-day free trial of ColdOutreach has ended. Upgrade your account to continue automating outreach campaigns and configuring SMTP settings.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleUpgrade}
            className="btn btn-primary"
            style={{
              padding: '12px',
              fontSize: '0.94rem',
              fontWeight: 700,
              width: '100%',
              justifyContent: 'center',
              boxShadow: '0 4px 14px var(--accent-glow)'
            }}
          >
            Upgrade to Pro →
          </button>

          <button
            onClick={onSignOut}
            className="btn btn-secondary"
            style={{
              padding: '12px',
              fontSize: '0.94rem',
              fontWeight: 700,
              width: '100%',
              justifyContent: 'center',
              background: 'transparent',
              borderColor: 'var(--border-subtle)'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
