import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';

export default function Register() {
  const { theme, toggleTheme, login } = useAuth();
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState('');
  const [animateShake,    setAnimateShake]    = useState(false);
  const [success,         setSuccess]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Create Account - ColdOutreach';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setAnimateShake(true);
      setTimeout(() => setAnimateShake(false), 400);
      return;
    }
    setLoading(true);
    try {
      // 1. Register
      const fd = new FormData();
      fd.append('email', email);
      fd.append('password', password);
      await import('axios').then(m => m.default.post('/api/auth/register', fd));

      // 2. Auto-login immediately after registration
      setSuccess(true);
      await login(email, password);

      // 3. Redirect to dashboard
      navigate('/');
    } catch (err) {
      setSuccess(false);
      setError(err.response?.data?.detail || 'Registration failed. Try a different email.');
      setAnimateShake(true);
      setTimeout(() => setAnimateShake(false), 400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--background)',
      fontFamily: 'var(--font-body)'
    }}>
      {/* Brand panel (hidden on mobile) */}
      <div className="login-brand-panel" style={{
        flex: 1.1,
        background: 'linear-gradient(135deg, oklch(0.24 0.08 254), oklch(0.12 0.04 254))',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '54px',
        position: 'relative',
        overflow: 'hidden',
        borderRight: '1px solid var(--border-subtle)'
      }}>
        {/* Decorative Grid */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />

        {/* Soft abstract glowing shapes */}
        <div style={{
          position: 'absolute',
          top: '15%',
          right: '-10%',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          opacity: 0.22,
          filter: 'blur(80px)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '-5%',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          background: 'var(--stat-enqueued)',
          opacity: 0.16,
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }} />

        {/* Brand Header */}
        <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <img 
            src={logoDark} 
            alt="ColdOutreach Logo" 
            style={{ height: '26px', width: 'auto', display: 'block', objectFit: 'contain' }} 
          />
          <div style={{ fontFamily: 'var(--font-header)', fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em', transform: 'translateY(2px)' }}>
            <span style={{ color: 'var(--logo-blue)' }}>Cold</span><span style={{ color: 'rgba(255,255,255,0.9)' }}>Outreach</span>
          </div>
        </div>

        {/* Brand Content */}
        <div style={{ zIndex: 1, maxWidth: '480px', margin: 'auto 0' }}>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '2.8rem', fontWeight: 900, lineHeight: 1.15, marginBottom: '20px', color: '#ffffff' }}>
            Start growing your sales pipeline today.
          </h2>
          <p style={{ fontSize: '1.08rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontWeight: 500 }}>
            Automate outreach campaigns, track delivery status, configure robust SMTP settings, and boost conversion rates in one simple platform.
          </p>
        </div>

        {/* Brand Footer */}
        <div style={{ zIndex: 1, fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
          © {new Date().getFullYear()} ColdOutreach. All rights reserved.
        </div>
      </div>

      {/* Form panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative'
      }}>
        {/* Theme Toggle Button */}
        <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
        </div>

        <div style={{ maxWidth: '400px', width: '100%', animation: 'scaleIn 0.3s var(--ease-spring)' }}>
          {/* Brand header on Mobile only */}
          <div className="mobile-only-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <img 
              src={theme === 'dark' ? logoDark : logoLight} 
              alt="ColdOutreach Logo" 
              style={{ height: '64px', width: 'auto', display: 'block', objectFit: 'contain' }} 
            />
            <div style={{ fontFamily: 'var(--font-header)', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--logo-blue)' }}>Cold</span><span style={{ color: 'var(--logo-dark)' }}>Outreach</span>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.88rem', margin: 0 }}>
              Create an account to start your first campaign
            </p>
          </div>

          {/* Card */}
          <div className={`card ${animateShake ? 'shake' : ''}`} style={{ padding: '38px', border: '1px solid var(--border-card)', background: 'var(--card)', boxShadow: 'none' }}>
            <h1 style={{ fontFamily: 'var(--font-header)', fontSize: '1.45rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
              Create Account
            </h1>

            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">Account created! Signing you in…</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input type="email" className="form-control" placeholder="name@company.com"
                    value={email} onChange={e => setEmail(e.target.value)} required disabled={loading || success} autoFocus style={{ paddingLeft: '38px' }} />
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input type="password" className="form-control" placeholder="Min. 8 characters"
                    value={password} onChange={e => setPassword(e.target.value)} required disabled={loading || success} style={{ paddingLeft: '38px' }} />
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input type="password" className="form-control" placeholder="••••••••"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={loading || success} style={{ paddingLeft: '38px' }} />
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px', padding: '11px', gap: '8px' }} disabled={loading || success}>
                {loading ? (
                  <>
                    <svg className="spinner" viewBox="0 0 50 50" style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }}>
                      <circle className="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" style={{ strokeDasharray: '1, 150', strokeDashoffset: 0, animation: 'dash 1.5s ease-in-out infinite' }}></circle>
                    </svg>
                    Creating…
                  </>
                ) : (
                  <>Create Account →</>
                )}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      {/* CSS style block for mobile view headers */}
      <style>{`
        @media (min-width: 901px) {
          .mobile-only-header { display: none !important; }
        }
      `}</style>
    </div>
  );
}
