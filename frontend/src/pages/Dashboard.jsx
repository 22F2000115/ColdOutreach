import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../App';

/* ── Rich Text Editor ─────────────────────────────────────────────────────── */
function RichEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || '';
      initialized.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exec = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const TBtn = ({ label, cmd, val, title }) => (
    <button
      type="button"
      title={title || label}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd, val); }}
      style={{
        background: 'none', border: 'none', color: 'var(--muted-foreground)',
        cursor: 'pointer', padding: '3px 8px', borderRadius: '4px',
        fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.4,
        transition: 'color 0.15s, background 0.15s', fontFamily: 'var(--font-body)'
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--foreground)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
    >
      {label}
    </button>
  );

  const Sep = () => <span style={{ width: '1px', height: '16px', background: 'var(--border-mid)', margin: '0 3px', display: 'inline-block' }} />;

  return (
    <div>
      <div className="rich-editor-toolbar">
        <TBtn label="B" cmd="bold" title="Bold" />
        <TBtn label="I" cmd="italic" title="Italic" />
        <TBtn label="U" cmd="underline" title="Underline" />
        <Sep />
        <TBtn label="H2" cmd="formatBlock" val="h2" title="Heading" />
        <TBtn label="P"  cmd="formatBlock" val="p"  title="Paragraph" />
        <Sep />
        <TBtn label="• List" cmd="insertUnorderedList" title="Bullet list" />
        <TBtn label="1. List" cmd="insertOrderedList" title="Numbered list" />
        <Sep />
        <button
          type="button"
          title="Insert Link"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = prompt('Enter URL:');
            if (url) exec('createLink', url);
          }}
          style={{
            background: 'none', border: 'none', color: 'var(--muted-foreground)',
            cursor: 'pointer', padding: '3px 8px', borderRadius: '4px',
            fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.4,
            fontFamily: 'var(--font-body)', transition: 'color 0.15s, background 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--foreground)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
        >
          🔗 Link
        </button>
        <TBtn label="Clear" cmd="removeFormat" title="Clear formatting" />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="rich-editor-area"
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
          }
        }}
      />
    </div>
  );
}

/* ── Status badge helper ──────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    running:   'badge-running',
    completed: 'badge-completed',
    paused:    'badge-paused',
    draft:     'badge-draft',
    failed:    'badge-error',
  };
  return (
    <span className={`badge ${map[status] || 'badge-draft'}`}>
      {status === 'running' && <span className="sending-dot" />}
      {status}
    </span>
  );
}

/* ── Dashboard ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [senders,   setSenders]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  const [showModal, setShowModal]   = useState(false);
  const [name,      setName]        = useState('');
  const [subject,   setSubject]     = useState('');
  const [body,      setBody]        = useState('<p>Hi,</p><p>I noticed what your company <strong>{company}</strong> is doing and wanted to reach out.</p>');
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [csvFile,   setCsvFile]     = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentDisplayName, setAttachmentDisplayName] = useState('');
  const [creating,  setCreating]    = useState(false);
  const [error,     setError]       = useState('');

  const fetch = async () => {
    try {
      const [campRes, sendRes] = await Promise.all([
        api.get('/api/campaigns'),
        api.get('/api/settings/smtp'),
      ]);
      setCampaigns(campRes.data || []);
      const list = sendRes.data || [];
      setSenders(list);
      if (list.length > 0 && !selectedSenderId) setSelectedSenderId(list[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    const t = setInterval(async () => {
      try { const r = await api.get('/api/campaigns'); setCampaigns(r.data || []); } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedSenderId) { setError('Please select a sender account first.'); return; }
    if (!csvFile) { setError('A contacts CSV file is required.'); return; }

    setCreating(true);
    const fd = new FormData();
    fd.append('name', name);
    fd.append('subject_template', subject);
    fd.append('body_template', body);
    fd.append('sender_id', selectedSenderId);
    fd.append('contacts_csv', csvFile);
    if (attachmentFile) {
      fd.append('attachment', attachmentFile);
      if (attachmentDisplayName) fd.append('attachment_display_name', attachmentDisplayName);
    }

    try {
      await api.post('/api/campaigns', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setName(''); setSubject('');
      setBody('<p>Hi,</p><p>I noticed what your company <strong>{company}</strong> is doing and wanted to reach out.</p>');
      setCsvFile(null); setAttachmentFile(null); setAttachmentDisplayName('');
      setShowModal(false);
      fetch();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    if (!confirm('Delete this campaign?')) return;
    try { await api.delete(`/api/campaigns/${id}`); fetch(); } catch { alert('Failed to delete campaign'); }
  };

  const totalSent   = campaigns.reduce((a, c) => a + c.stats.sent,   0);
  const totalFailed = campaigns.reduce((a, c) => a + c.stats.failed, 0);
  const totalEmails = campaigns.reduce((a, c) => a + c.stats.total,  0);

  return (
    <div style={{ animation: 'slideUp 0.3s var(--ease-smooth)' }}>

      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Manage and monitor your outreach campaigns.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Campaign
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'Total Campaigns', value: campaigns.length, color: 'var(--foreground)' },
          { label: 'Emails Enqueued', value: totalEmails,       color: 'var(--foreground)' },
          { label: 'Delivered',        value: totalSent,          color: 'var(--success)' },
          { label: 'Failures',          value: totalFailed,        color: 'var(--error)' },
        ].map(({ label, value, color }) => (
          <div className="metric-card" key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Section header */}
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <span className="section-title">All Campaigns</span>
        {campaigns.filter(c => c.status === 'running').length > 0 && (
          <span className="badge badge-running">
            {campaigns.filter(c => c.status === 'running').length} Active
          </span>
        )}
      </div>

      {/* Campaign list */}
      {loading ? (
        <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="glass-panel empty-state">
          <div className="empty-state-icon">✉️</div>
          <h3 style={{ fontFamily: 'var(--font-header)', marginBottom: '8px' }}>No campaigns yet</h3>
          <p style={{ fontSize: '0.88rem', marginBottom: '20px' }}>Upload a contacts list and an email template to get started.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Campaign</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }}>
          {campaigns.map((c) => {
            const pct = c.stats.total > 0 ? Math.round((c.stats.sent / c.stats.total) * 100) : 0;
            const sender = senders.find(s => s.id === c.sender_id);
            return (
              <div key={c.id} className="campaign-card">
                {/* Top row */}
                <div className="flex-between">
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/campaigns/${c.id}`} style={{ fontFamily: 'var(--font-header)', fontWeight: 800, fontSize: '1.02rem', color: 'var(--foreground)', display: 'block', marginBottom: '3px' }}>
                      {c.name}
                    </Link>
                    {sender && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        📧 {sender.from_name} &lt;{sender.username}&gt;
                      </span>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="divider" />

                {/* Subject */}
                <div>
                  <div className="eyebrow" style={{ marginBottom: '3px' }}>Subject</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{c.subject_template}</p>
                </div>

                {c.attachment_name && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                    📎 {c.attachment_display_name || c.attachment_name}
                  </p>
                )}

                {/* Progress */}
                <div>
                  <div className="flex-between" style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '5px' }}>
                    <span>{c.stats.sent}/{c.stats.total} sent</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-between" style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    {c.stats.total} leads
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link to={`/campaigns/${c.id}`} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
                      Open →
                    </Link>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '7px 12px', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'rgba(220,38,38,0.25)' }}
                      onClick={(e) => handleDelete(c.id, e)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Campaign Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">New Outreach Campaign</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="alert alert-error">⚠️ {error}</div>
              )}

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Campaign Name</label>
                    <input type="text" className="form-control" placeholder="e.g. Sales Pitch v1" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sender Account</label>
                    <select className="form-control" value={selectedSenderId} onChange={e => setSelectedSenderId(e.target.value)} required>
                      <option value="" disabled>Select sender…</option>
                      {senders.map(s => (
                        <option key={s.id} value={s.id}>{s.from_name} ({s.username})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Subject Line</label>
                  <input type="text" className="form-control" placeholder="e.g. Quick note about {company}" value={subject} onChange={e => setSubject(e.target.value)} required />
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                    💡 Use <code>{'{company}'}</code> as a placeholder — replaced per recipient.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Body</label>
                  <RichEditor value={body} onChange={setBody} />
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                    Use <code>{'{company}'}</code> anywhere in the body.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Contacts CSV <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input type="file" accept=".csv" className="form-control" onChange={e => setCsvFile(e.target.files[0])} required />
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>Must include an <code>email</code> column. Optional: <code>company</code> column.</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Attachment (Optional)</label>
                    <input type="file" className="form-control" onChange={e => setAttachmentFile(e.target.files[0])} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Attachment Display Name</label>
                    <input type="text" className="form-control" placeholder="e.g. Proposal.pdf" value={attachmentDisplayName} onChange={e => setAttachmentDisplayName(e.target.value)} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Filename shown to recipients.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={creating}>
                    {creating ? 'Creating…' : 'Create Campaign'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
