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

  const fetchSenders = async () => {
    try {
      const res = await api.get('/api/settings/smtp');
      setSenders(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSenders(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const fd = new FormData();
      if (editingId) fd.append('sender_id', editingId);
      fd.append('host', host);
      fd.append('port', port);
      fd.append('username', username);
      fd.append('password', password === '••••••••••••••••' ? '' : password);
      fd.append('from_name', fromName);
      fd.append('from_email', username);
      const res = await api.post('/api/settings/smtp', fd);
      setMessage({ text: res.data.message, type: 'success' });
      resetForm();
      fetchSenders();
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to save settings', type: 'error' });
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage({ text: '', type: '' });
    try {
      const fd = new FormData();
      if (editingId) fd.append('sender_id', editingId);
      fd.append('host', host);
      fd.append('port', port);
      fd.append('username', username);
      fd.append('password', password === '••••••••••••••••' ? '' : password);
      fd.append('from_name', fromName);
      fd.append('from_email', username);
      const res = await api.post('/api/settings/smtp/test', fd);
      setMessage({ text: res.data.message, type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'SMTP test failed', type: 'error' });
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
      setMessage({ text: err.response?.data?.detail || 'Failed to delete', type: 'error' });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFromName('');
    setUsername('');
    setPassword('');
    setHost('smtp.gmail.com');
    setPort(465);
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
          {message.type === 'success' ? '✓' : '⚠️'} {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── Add / Edit Form ── */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 className="section-title" style={{ marginBottom: '20px' }}>
            {editingId ? '✏️ Edit Sender' : '➕ Add Sender'}
          </h2>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div className="form-group">
              <label className="form-label">Sender Name</label>
              <input type="text" className="form-control" placeholder="e.g. Company Outreach" value={fromName} onChange={e => setFromName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Gmail Address</label>
              <input type="email" className="form-control" placeholder="you@gmail.com" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Gmail App Password</label>
              <input type="password" className="form-control" placeholder="16-character app password" value={password} onChange={e => setPassword(e.target.value)} required />
              <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                🔑 Use an App Password — not your account password. <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700 }}>Generate one here →</a>
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
                {saving ? 'Saving…' : editingId ? 'Update Sender' : '+ Add Sender'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving || testing}>
                  Cancel
                </button>
              )}
            </div>

            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={saving || testing || !username || !password}>
              {testing ? 'Testing…' : '🧪 Test Connection'}
            </button>
          </form>
        </div>

        {/* ── Senders List ── */}
        <div className="card" style={{ padding: '24px' }}>
          <div className="flex-between" style={{ marginBottom: '20px' }}>
            <h2 className="section-title">Configured Senders</h2>
            <span className="badge badge-running" style={{ background: 'rgba(var(--primary)/0.08)', color: 'var(--primary)', borderColor: 'rgba(var(--primary)/0.2)' }}>
              {senders.length} {senders.length === 1 ? 'account' : 'accounts'}
            </span>
          </div>

          {senders.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <div className="empty-state-icon">📬</div>
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
                      border: editingId === s.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                      boxShadow: editingId === s.id ? '0 0 0 3px rgba(200,80,60,0.1)' : 'var(--shadow-sm)',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
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

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={() => handleEdit(s)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem', color: 'var(--error)', borderColor: 'rgba(220,38,38,0.25)' }}
                        onClick={() => handleDelete(s.id)}
                      >
                        Delete
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
      <div className="alert alert-info" style={{ marginTop: '24px' }}>
        <div>
          <strong>Gmail Setup Guide</strong>
          <ol style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>Enable 2-Factor Authentication on your Google account.</li>
            <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>myaccount.google.com/apppasswords</a></li>
            <li>Generate an App Password for "Mail".</li>
            <li>Use <code>smtp.gmail.com</code>, port <code>465</code> (SSL) or <code>587</code> (TLS).</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
