import { useState } from 'react';
import UpgradeModal from './UpgradeModal';

export default function TrialExpiredModal({ onSignOut }) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  return (
    <>
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
          {/* Hourglass/Crown-styled Icon */}
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--primary-subtle, rgba(99, 102, 241, 0.08))',
            color: 'var(--primary, #6366F1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 22h14"></path>
              <path d="M5 2h14"></path>
              <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path>
              <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path>
            </svg>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-header)',
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--foreground)',
            marginBottom: '12px'
          }}>
            Your free trial has ended
          </h2>

          <p style={{
            fontSize: '0.92rem',
            color: 'var(--muted-foreground)',
            lineHeight: '1.6',
            marginBottom: '32px'
          }}>
            Your 30-day trial has expired. You can no longer access your campaigns or send emails. To continue using ColdOutreach, upgrade to a Pro account.
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 700,
                justifyContent: 'center',
                boxShadow: '0 4px 14px var(--accent-glow)'
              }}
            >
              Upgrade to Pro
            </button>

            <button
              onClick={onSignOut}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 700,
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

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
}
