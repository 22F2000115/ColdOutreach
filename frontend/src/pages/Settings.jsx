import React, { useState, useEffect } from 'react';
import { api } from '../App';

export default function Settings() {
  const [senders,   setSenders]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [fromName,  setFromName]  = useState('');
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [host,      setHost]      = useState('smtp.gmail.com');
  const [port,      setPort]      = useState(465);
  const [saving,    setSaving]    = useState(false);
  const [testing,   setTesting]   = useState(false);
  const [message,   setMessage]   = useState({ text: '', type: '' });
  const [testResult, setTestResult] = useState(null);

  const fetchSenders = async () => {
    try {
      const res = await api.get('/api/settings/smtp');
      setSenders(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSenders(); }, []);

  const getErrorMessage = (err, fallback) => {
    if (err.response?.data?.detail) {
      const detail = err.response.data.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        return detail.map(d => `${d.loc ? d.loc.slice(1).join(' ') : ''} ${d.msg}`.trim()).join(', ');
      }
      return JSON.stringify(detail);
    }
    return err.message || fallback;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });

    if (!fromName.trim()) {
      setMessage({ text: 'Sender Name is required', type: 'error' });
      setSaving(false);
      return;
    }
    if (!username.trim()) {
      setMessage({ text: 'Gmail Address is required', type: 'error' });
      setSaving(false);
      return;
    }
    if (!password.trim()) {
      setMessage({ text: 'Password is required', type: 'error' });
      setSaving(false);
      return;
    }
    const parsedPort = parseInt(port);
    if (isNaN(parsedPort) || parsedPort <= 0) {
      setMessage({ text: 'A valid port number is required', type: 'error' });
      setSaving(false);
      return;
    }

    try {
      const fd = new FormData();
      if (editingId) fd.append('sender_id', editingId);
      fd.append('host', host);
      fd.append('port', parsedPort);
      fd.append('username', username);
      fd.append('password', password);
      fd.append('from_name', fromName);
      fd.append('from_email', username);
      const res = await api.post('/api/settings/smtp', fd);
      setMessage({ text: res.data.message, type: 'success' });
      resetForm();
      fetchSenders();
    } catch (err) {
      setMessage({ text: getErrorMessage(err, 'Failed to save settings'), type: 'error' });
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage({ text: '', type: '' });
    setTestResult({ status: 'testing', text: 'Testing...' });

    if (!username.trim()) {
      setMessage({ text: 'Gmail Address is required for connection test', type: 'error' });
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
      setMessage({ text: getErrorMessage(err, 'SMTP test failed'), type: 'error' });
      setTestResult({ status: 'error', text: 'Connection Failed' });
    } finally { setTesting(false); }
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setFromName(s.from_name);
    setUsername(s.username);
    setPassword('••••••••••••••••');
    setHost(s.host);
    setPort(s.port);
    setMessage({ text: '', type: '' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sender account?')) return;
    try {
      await api.delete(`/api/settings/smtp/${id}`);
      setMessage({ text: 'Sender account deleted.', type: 'success' });
      if (editingId === id) resetForm();
      fetchSenders();
    } catch (err) {
      setMessage({ text: getErrorMessage(err, 'Failed to delete'), type: 'error' });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFromName('');
    setUsername('');
    setPassword('');
    setHost('smtp.gmail.com');
    setPort(465);
    setTestResult(null);
  };

  if (loading) return <p style={{ color: 'var(--muted-foreground)' }}>Loading settings…</p>;

  return (
    <div style={{ animation: 'slideUp 0.3s var(--ease-smooth)' }}>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">SMTP Settings</h1>
          <p className="page-subtitle">Manage your Gmail sender profiles. Add multiple accounts to scale outreach.</p>
        </div>
      </div>

      {/* Alert */}
      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '24px' }}>
          {message.type === 'success' ? '✓' : '!'} {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── Add / Edit Form ── */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 className="section-title" style={{ marginBottom: '20px' }}>
            {editingId ? 'Edit Sender' : 'Add Sender'}
          </h2>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div className="form-group">
              <label className="form-label">Sender Name</label>
              <input type="text" className="form-control" placeholder="e.g. Company Outreach" value={fromName} onChange={e => setFromName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Gmail Address</label>
              <input type="email" className="form-control" placeholder="you@gmail.com" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off" />
            </div>

            <div className="form-group">
              <label className="form-label">Gmail App Password</label>
              <input type="password" className="form-control" placeholder="16-character app password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
              <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                Use an App Password — not your account password. <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700 }}>Generate one here →</a>
              </span>
            </div>

            {/* Advanced */}
            <details style={{ marginBottom: '16px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, userSelect: 'none' }}>
                Advanced SMTP Settings
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '12px', marginTop: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">SMTP Host</label>
                  <input type="text" className="form-control" value={host} onChange={e => setHost(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Port</label>
                  <input type="number" className="form-control" value={port} onChange={e => setPort(parseInt(e.target.value))} required />
                </div>
              </div>
            </details>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={saving || testing}>
                {saving ? 'Saving…' : editingId ? 'Update Sender' : 'Add Sender'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving || testing}>
                  Cancel
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
              <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={handleTest} disabled={saving || testing || !username || !password}>
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
              {testResult && (
                <span className={`badge ${
                  testResult.status === 'success' ? 'badge-success' :
                  testResult.status === 'error' ? 'badge-error' :
                  'badge-running'
                }`} style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                  {testResult.status === 'success' && '✓ '}
                  {testResult.status === 'error' && '✕ '}
                  {testResult.text}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* ── Senders List ── */}
        <div className="card" style={{ padding: '24px' }}>
          <div className="flex-between" style={{ marginBottom: '20px' }}>
            <h2 className="section-title">Configured Senders</h2>
            <span className="badge badge-running" style={{ background: 'var(--surface-hover)', color: 'var(--primary)', borderColor: 'var(--border-subtle)' }}>
              {senders.length} {senders.length === 1 ? 'account' : 'accounts'}
            </span>
          </div>

          {senders.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <div className="empty-state-icon" style={{ fontSize: '2rem', color: 'var(--muted-foreground)' }}>✉</div>
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
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.78rem', gap: '4px' }} onClick={() => handleEdit(s)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px', fontSize: '0.78rem', color: 'var(--error)', borderColor: 'rgba(220,38,38,0.15)', background: 'transparent' }}
                        onClick={() => handleDelete(s.id)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--error-glow)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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

      {/* Gmail Guide */}
      <div className="card" style={{ marginTop: '24px', padding: '24px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          Gmail App Password Setup Guide
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            {
              step: 1,
              title: "2-Factor Auth",
              desc: <>Enable <strong>2-Factor Authentication</strong> on your Google account settings.</>
            },
            {
              step: 2,
              title: "App Passwords",
              desc: <>Go to the <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Google App Passwords</a> page.</>
            },
            {
              step: 3,
              title: "Generate Password",
              desc: <>Select App as <strong>"Mail"</strong>, select Device, and generate the 16-character code.</>
            },
            {
              step: 4,
              title: "Configure SMTP",
              desc: <>Use host <code>smtp.gmail.com</code> and port <code>465</code> (SSL/SSL) on the form above.</>
            }
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius)' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.82rem',
                flexShrink: 0
              }}>
                {item.step}
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.88rem', marginBottom: '4px', fontFamily: 'var(--font-header)', fontWeight: 700 }}>{item.title}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
