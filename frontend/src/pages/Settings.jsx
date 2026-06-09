// Settings page for configuring SMTP sender profiles and managing user passwords.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { api, useAuth } from '../App';
import { getFriendlyError } from '../utils/errors';
import UpgradeModal from '../components/UpgradeModal';

export default function Settings() {
  // useState hooks
  const { user, refreshUser } = useAuth();
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [fromName, setFromName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState(465);
  const [sendDelay, setSendDelay] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [testResult, setTestResult] = useState(null);
  const [showTrialBanner, setShowTrialBanner] = useState(true);

  // New UI states
  const [preset, setPreset] = useState('gmail');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Derived values/variables
  const limit = user?.limits?.max_smtp_accounts ?? (user?.plan === 'pro' ? 3 : 1);
  const isAtLimit = senders.length >= limit && !editingId;

  // useEffect hooks
  useEffect(() => {
    // Empty dependency array: set page title and fetch SMTP senders once on component mount
    document.title = 'Settings - ColdOutreach';
    fetchSenders();
  }, []);

  useEffect(() => {
    if (loading) return;
    const dismissed = localStorage.getItem('guide_collapsed');
    if (dismissed === 'true') {
      setGuideExpanded(false);
    } else if (senders.length > 0) {
      setGuideExpanded(false);
    } else {
      setGuideExpanded(true);
    }
  }, [senders.length, loading]);

  // Handler and helper functions
  const fetchSenders = async () => {
    try {
      const res = await api.get('/api/settings/smtp');
      setSenders(res.data || []);
      await refreshUser();
    } catch (e) {
      // Failed to fetch senders silently
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (p) => {
    setPreset(p);
    if (p === 'gmail') {
      setHost('smtp.gmail.com');
      setPort(465);
      setAdvancedOpen(false);
    } else if (p === 'outlook') {
      setHost('smtp.office365.com');
      setPort(587);
      setAdvancedOpen(false);
    } else if (p === 'yahoo') {
      setHost('smtp.mail.yahoo.com');
      setPort(465);
      setAdvancedOpen(false);
    } else {
      setHost('');
      setPort(587);
      setAdvancedOpen(true);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ text: '', type: '' });

    if (!fromName.trim()) {
      setMessage({ text: 'Sender Name is required', type: 'error' });
      setSubmitting(false);
      return;
    }

    if (!username.trim()) {
      setMessage({ text: 'Email Address is required', type: 'error' });
      setSubmitting(false);
      return;
    }
    if (!password.trim()) {
      setMessage({ text: 'Password is required', type: 'error' });
      setSubmitting(false);
      return;
    }
    const parsedPort = parseInt(port);
    if (isNaN(parsedPort) || parsedPort <= 0) {
      setMessage({ text: 'A valid port number is required', type: 'error' });
      setSubmitting(false);
      return;
    }
    if (!host.trim()) {
      setMessage({ text: 'SMTP Host is required', type: 'error' });
      setSubmitting(false);
      return;
    }

    try {
      const fd = new FormData();
      if (editingId) {
        fd.append('sender_id', editingId);
      }
      fd.append('host', host);
      fd.append('port', parsedPort);
      fd.append('username', username);
      fd.append('password', password);
      fd.append('from_name', fromName);
      fd.append('from_email', username);
      fd.append('send_delay_seconds', sendDelay);

      const res = await api.post('/api/settings/smtp', fd);
      setMessage({ text: res.data.message, type: 'success' });
      resetForm();
      fetchSenders();
    } catch (err) {
      setMessage({ text: getFriendlyError(err, 'Failed to save settings'), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage({ text: '', type: '' });
    setTestResult({ status: 'testing', text: 'Testing...' });

    if (!username.trim()) {
      setMessage({ text: 'Email Address is required for connection test', type: 'error' });
      setTestResult({ status: 'error', text: 'Missing email' });
      setTesting(false);
      return;
    }
    if (!password.trim()) {
      setMessage({ text: 'Password/App Password is required for connection test', type: 'error' });
      setTestResult({ status: 'error', text: 'Missing password' });
      setTesting(false);
      return;
    }
    const parsedPort = parseInt(port);
    if (isNaN(parsedPort) || parsedPort <= 0) {
      setMessage({ text: 'A valid port number is required', type: 'error' });
      setTestResult({ status: 'error', text: 'Invalid port' });
      setTesting(false);
      return;
    }
    if (!host.trim()) {
      setMessage({ text: 'SMTP Host is required', type: 'error' });
      setTestResult({ status: 'error', text: 'Missing host' });
      setTesting(false);
      return;
    }

    try {
      const fd = new FormData();
      if (editingId) fd.append('sender_id', editingId);
      fd.append('host', host);
      fd.append('port', parsedPort);
      fd.append('username', username);
      fd.append('password', password);
      fd.append('from_name', fromName || username);
      fd.append('from_email', username);
      const res = await api.post('/api/settings/smtp/test', fd);
      setMessage({ text: res.data.message, type: 'success' });
      setTestResult({ status: 'success', text: 'Connection Success' });
    } catch (err) {
      setMessage({ text: getFriendlyError(err, 'SMTP test failed'), type: 'error' });
      setTestResult({ status: 'error', text: 'Connection Failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setFromName(s.from_name);
    setUsername(s.username);
    setPassword('••••••••••••••••');
    setHost(s.host);
    setPort(s.port);
    setSendDelay(s.send_delay_seconds || 3);
    setMessage({ text: '', type: '' });

    // Detect preset based on host/port
    if (s.host === 'smtp.gmail.com' && s.port === 465) {
      setPreset('gmail');
      setAdvancedOpen(false);
    } else if (s.host === 'smtp.office365.com' && s.port === 587) {
      setPreset('outlook');
      setAdvancedOpen(false);
    } else if (s.host === 'smtp.mail.yahoo.com' && s.port === 465) {
      setPreset('yahoo');
      setAdvancedOpen(false);
    } else {
      setPreset('custom');
      setAdvancedOpen(true);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sender account?')) return;
    try {
      await api.delete(`/api/settings/smtp/${id}`);
      setMessage({ text: 'Sender account deleted.', type: 'success' });
      if (editingId === id) resetForm();
      fetchSenders();
    } catch (err) {
      setMessage({ text: getFriendlyError(err, 'Failed to delete'), type: 'error' });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFromName('');
    setUsername('');
    setPassword('');
    setHost('smtp.gmail.com');
    setPort(465);
    setSendDelay(3);
    setTestResult(null);
    setPreset('gmail');
    setAdvancedOpen(false);
  };

  const getAppPasswordLink = () => {
    if (preset === 'gmail') {
      return (
        <>Navigate to your provider's App Passwords page (e.g. <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Google App Passwords</a>).</>
      );
    }
    if (preset === 'outlook') {
      return (
        <>Navigate to your provider's App Passwords page (e.g. <a href="https://account.live.com/proofs/manage/additional" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Microsoft App Passwords</a>).</>
      );
    }
    if (preset === 'yahoo') {
      return (
        <>Navigate to your provider's App Passwords page (e.g. <a href="https://login.yahoo.com/account/security" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Yahoo Security Settings</a>).</>
      );
    }
    return <>Navigate to your email provider's account security settings page to generate an App Password.</>;
  };

  if (loading) return <p style={{ color: 'var(--muted-foreground)' }}>Loading settings…</p>;

  const toggleGuide = () => {
    const newVal = !guideExpanded;
    setGuideExpanded(newVal);
    if (!newVal) {
      localStorage.setItem('guide_collapsed', 'true');
    } else {
      localStorage.removeItem('guide_collapsed');
    }
  };

  return (
    <div style={{ animation: 'slideUp 0.3s var(--ease-smooth)' }}>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">SMTP Settings</h1>
          <p className="page-subtitle">Manage your sender profiles. Add multiple accounts to scale outreach.</p>
        </div>
      </div>

      {/* Trial expiry banner */}
      {user?.plan === 'trial' && user?.trial_expires_at && showTrialBanner && (
        <div className="alert alert-warning" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>You are on the <strong>Trial Plan</strong>. Your trial expires on <strong>{new Date(user.trial_expires_at).toLocaleDateString()}</strong>.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.82rem', height: '30px' }} onClick={() => setShowUpgradeModal(true)}>Upgrade to Pro</button>
            <button
              onClick={() => setShowTrialBanner(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.7 }}
              title="Dismiss"
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}

      {/* Alert */}
      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '24px' }}>
          {message.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="settings-grid">

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── Add / Edit Form ── */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 className="section-title" style={{ marginBottom: '20px' }}>
              {editingId ? 'Edit Sender' : 'Add Sender'}
            </h2>

            {/* Presets Row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[
                { id: 'gmail', name: 'Gmail' },
                { id: 'outlook', name: 'Outlook' },
                { id: 'yahoo', name: 'Yahoo' },
                { id: 'custom', name: 'Custom' }
              ].map(p => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetClick(p.id)}
                    className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      flex: 1,
                      fontSize: '0.8rem',
                      padding: '8px 0',
                      borderRadius: 'var(--radius)',
                      border: active ? 'none' : '1px solid var(--border)',
                      background: active ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      textAlign: 'center',
                      display: 'block'
                    }}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div className="form-group">
                <label className="form-label">Sender Name</label>
                <input type="text" className="form-control" placeholder="e.g. Company Outreach" value={fromName} onChange={e => setFromName(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (sender login)</label>
                <input type="email" className="form-control" placeholder="you@domain.com" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off" />
              </div>

              <div className="form-group">
                <label className="form-label">App Password / SMTP Password</label>
                <input type="password" className="form-control" placeholder="Enter app password or SMTP password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
                <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', display: 'block', lineHeight: '1.4' }}>
                  Use a secure App Password rather than your account password.
                  {preset === 'gmail' && (
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                      Generate one here →
                    </a>
                  )}
                  {preset === 'outlook' && (
                    <a href="https://account.live.com/proofs/manage/additional" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                      Generate one here →
                    </a>
                  )}
                  {preset === 'yahoo' && (
                    <a href="https://login.yahoo.com/account/security" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                      Generate one here →
                    </a>
                  )}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Send Delay (seconds)</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="60"
                  value={sendDelay}
                  onChange={e => setSendDelay(parseInt(e.target.value) || 3)}
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', display: 'block', lineHeight: '1.4' }}>
                  Wait time between sending emails (clamped between 1 and 60 seconds).
                </span>
              </div>

              {/* Advanced toggling link */}
              {preset !== 'custom' && (
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline'
                    }}
                  >
                    {advancedOpen ? 'Hide advanced settings' : 'Change host/port (advanced)'}
                  </button>
                </div>
              )}

              {/* Advanced */}
              <details open={advancedOpen} onToggle={e => setAdvancedOpen(e.target.open)} style={{ marginBottom: '16px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, userSelect: 'none', display: preset === 'custom' ? 'list-item' : 'none' }}>
                  Advanced SMTP Settings
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '12px', marginTop: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">SMTP Host</label>
                    <input type="text" className="form-control" value={host} onChange={e => { setHost(e.target.value); setPreset('custom'); }} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Port</label>
                    <input type="number" className="form-control" value={port} onChange={e => { setPort(parseInt(e.target.value) || ''); setPreset('custom'); }} required />
                  </div>
                </div>
              </details>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={handleTest} disabled={submitting || testing || !username || !password}>
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
                {testResult && (
                  <span className={`badge ${
                    testResult.status === 'success' ? 'badge-success' :
                    testResult.status === 'error' ? 'badge-error' :
                    'badge-running'
                  }`} style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center' }}>
                    {testResult.status === 'success' && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                    )}
                    {testResult.status === 'error' && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    )}
                    {testResult.text}
                  </span>
                )}
              </div>

              <div
                style={{ display: 'flex', gap: '8px', width: '100%' }}
                title={isAtLimit ? "Limit reached — upgrade to add more senders." : ""}
              >
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={submitting || testing || isAtLimit}>
                  {submitting ? 'Saving…' : editingId ? 'Update Sender' : 'Add Sender'}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={submitting || testing}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Collapsible Setup Guide */}
          <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={toggleGuide}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--foreground)',
                fontFamily: 'var(--font-header)',
                fontWeight: 700,
                fontSize: '0.95rem'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                How to set up your sender account →
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: guideExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {guideExpanded && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'slideDown 0.2s var(--ease-smooth)' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.4 }}>
                  Follow these steps to generate a secure App Password for your email provider. Regular passwords will fail due to security blocks.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    {
                      step: 1,
                      title: "Enable 2FA",
                      desc: <>Enable <strong>Two-Factor Authentication</strong> in your email provider security settings.</>
                    },
                    {
                      step: 2,
                      title: "App Passwords",
                      desc: getAppPasswordLink()
                    },
                    {
                      step: 3,
                      title: "Generate Key",
                      desc: <>Select App as <strong>"Mail"</strong>, choose your device, and generate a secure 16-character code.</>
                    },
                    {
                      step: 4,
                      title: "Configure SMTP",
                      desc: <>Choose your provider preset below, paste your generated key into Password, and test the connection.</>
                    }
                  ].map((item) => (
                    <div key={item.step} style={{ display: 'flex', gap: '10px', background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: 'var(--radius)' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        flexShrink: 0
                      }}>
                        {item.step}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.8rem', marginBottom: '2px', fontFamily: 'var(--font-header)', fontWeight: 700 }}>{item.title}</strong>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', lineHeight: 1.3, margin: 0 }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <div className="flex-between" style={{ width: '100%' }}>
              <h2 className="section-title" style={{ margin: 0 }}>Configured Senders</h2>
              <span className="badge badge-running" style={{ background: 'var(--surface-hover)', color: 'var(--primary)', borderColor: 'var(--border-subtle)' }}>
                {senders.length} / {limit} accounts used
              </span>
            </div>
            {isAtLimit && (
              <div style={{ color: 'var(--error)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-end' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowUpgradeModal(true)}>Limit reached — upgrade to add more senders</span>
              </div>
            )}
          </div>

          {senders.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <div className="empty-state-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </div>
              <p style={{ fontSize: '0.88rem' }}>No sender accounts yet. Add one on the left.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {senders.map((s) => {
                const initials = s.from_name
                  ? s.from_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  : 'SM';
                return (
                  <div
                    key={s.id}
                    className="card"
                    style={{
                      padding: '16px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid var(--border)',
                      borderLeft: editingId === s.id ? '4px solid var(--primary)' : '1px solid var(--border)',
                      boxShadow: editingId === s.id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                      transform: editingId === s.id ? 'translateY(-1px)' : 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Avatar */}
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'var(--primary)', color: 'var(--primary-foreground)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-header)', fontWeight: 800, fontSize: '0.85rem',
                        flexShrink: 0
                      }}>
                        {initials}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.92rem', fontFamily: 'var(--font-header)', fontWeight: 700 }}>{s.from_name}</strong>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>{s.username}</span>
                        <div style={{ marginTop: '3px' }}>
                           <span className="badge badge-success" style={{ fontSize: '0.64rem' }}>● Active</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleEdit(s)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderColor: 'transparent',
                          background: 'transparent',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--surface-hover)';
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDelete(s.id)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.78rem',
                          color: 'var(--error)',
                          borderColor: 'transparent',
                          background: 'transparent',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(244, 63, 94, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
