import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../App';
import RichEditor from '../components/RichEditor';

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
  const navigate = useNavigate();
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

  const fetchCampaigns = async () => {
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
    fetchCampaigns();
    const t = setInterval(async () => {
      try { const r = await api.get('/api/campaigns'); setCampaigns(r.data || []); } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const resetModal = () => {
    setName(''); setSubject('');
    setBody('<p>Hi,</p><p>I noticed what your company <strong>{company}</strong> is doing and wanted to reach out.</p>');
    setCsvFile(null); setAttachmentFile(null); setAttachmentDisplayName('');
    setError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedSenderId) { setError('Please select a sender account first.'); return; }

    setCreating(true);
    const fd = new FormData();
    fd.append('name', name);
    fd.append('subject_template', subject);
    fd.append('body_template', body);
    fd.append('sender_id', selectedSenderId);
    if (csvFile) fd.append('contacts_csv', csvFile);
    if (attachmentFile) {
      fd.append('attachment', attachmentFile);
      if (attachmentDisplayName) fd.append('attachment_display_name', attachmentDisplayName);
    }

    try {
      const res = await api.post('/api/campaigns', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      resetModal();
      setShowModal(false);
      // Redirect to the new campaign so user can add contacts there
      navigate(`/campaigns/${res.data.campaign_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    if (!confirm('Delete this campaign?')) return;
    try { await api.delete(`/api/campaigns/${id}`); fetchCampaigns(); } catch { alert('Failed to delete campaign'); }
  };

  const handleAction = async (id, action, e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('action', action);
      await api.post(`/api/campaigns/${id}/action`, fd);
      fetchCampaigns();
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action} campaign`);
    }
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
          <div className="empty-state-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
          <h3 style={{ fontFamily: 'var(--font-header)', marginBottom: '8px' }}>No campaigns yet</h3>
          <p style={{ fontSize: '0.88rem', marginBottom: '20px' }}>Upload a contacts list and an email template to get started.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Campaign</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {campaigns.map((c) => {
            const pct = c.stats.total > 0 ? Math.round((c.stats.sent / c.stats.total) * 100) : 0;
            const sender = senders.find(s => s.id === c.sender_id);
            return (
              <div key={c.id} className="campaign-row-card">
                {/* 1. Name & Sender */}
                <div style={{ flex: '1.2', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Link to={`/campaigns/${c.id}`} style={{ fontFamily: 'var(--font-header)', fontWeight: 800, fontSize: '1.22rem', color: 'var(--foreground)', display: 'block', marginBottom: '6px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </Link>
                  {sender ? (
                    <div style={{ fontSize: '0.88rem', color: 'var(--muted-foreground)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {sender.from_name} ({sender.username})
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No sender account configured</div>
                  )}
                </div>

                {/* 2. Subject & Attachment */}
                <div style={{ flex: '1.2', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="eyebrow" style={{ marginBottom: '6px', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Subject Line</div>
                  <div style={{ fontSize: '0.98rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 500 }} title={c.subject_template}>
                    {c.subject_template || '—'}
                  </div>
                  {c.attachment_name && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                      </svg>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {c.attachment_display_name || c.attachment_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Progress */}
                <div style={{ flex: '1', minWidth: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="flex-between" style={{ fontSize: '0.84rem', color: 'var(--muted-foreground)', marginBottom: '6px' }}>
                    <span>{c.stats.sent}/{c.stats.total} sent</span>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{pct}%</span>
                  </div>
                  <div className="progress-bar-track" style={{ height: '8px' }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {c.stats.total} total leads
                  </div>
                </div>

                {/* 4. Status */}
                <div style={{ minWidth: '105px', display: 'flex', justifyContent: 'center', alignItems: 'center', transform: 'scale(1.18)' }}>
                  <StatusBadge status={c.status} />
                </div>

                {/* 5. Actions */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {(c.status === 'draft' || c.status === 'paused' || c.status === 'failed') && (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '10px 20px', fontSize: '0.92rem', height: '44px' }}
                      onClick={(e) => handleAction(c.id, 'start', e)}
                    >
                      Start
                    </button>
                  )}
                  {c.status === 'running' && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '10px 20px', fontSize: '0.92rem', height: '44px' }}
                      onClick={(e) => handleAction(c.id, 'pause', e)}
                    >
                      Pause
                    </button>
                  )}
                  <Link to={`/campaigns/${c.id}`} className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '0.92rem', height: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    Edit
                  </Link>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '10px 14px', fontSize: '0.92rem', height: '44px', color: 'var(--error)', borderColor: 'rgba(220,38,38,0.2)' }}
                    onClick={(e) => handleDelete(c.id, e)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Campaign Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) { resetModal(); setShowModal(false); } }}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">New Outreach Campaign</h2>
              <button className="modal-close" onClick={() => { resetModal(); setShowModal(false); }}>×</button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="alert alert-error">! {error}</div>
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
                    Use <code>{'{company}'}</code> as a placeholder — replaced per recipient.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Body</label>
                  <RichEditor value={body} onChange={setBody} />
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                    Use <code>{'{company}'}</code> anywhere in the body.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Contacts CSV <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>(optional)</span></label>
                    <input type="file" accept=".csv" className="form-control" onChange={e => setCsvFile(e.target.files[0])} />
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>Needs an <code>email</code> column. You can also add leads after creation.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Attachment <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>(optional)</span></label>
                    <input type="file" className="form-control" onChange={e => setAttachmentFile(e.target.files[0])} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Display name e.g. Proposal.pdf"
                      value={attachmentDisplayName}
                      onChange={e => setAttachmentDisplayName(e.target.value)}
                      style={{ marginTop: '8px' }}
                    />
                  </div>
                </div>

                {/* Info hint */}
                <div style={{ background: 'var(--primary-subtle, rgba(99,102,241,0.08))', border: '1px solid var(--primary-border, rgba(99,102,241,0.2))', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                  After creating, you'll be taken to the campaign page where you can add leads individually, import CSV files, edit the template, and launch.
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={creating}>
                    {creating ? 'Creating…' : 'Create Campaign →'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { resetModal(); setShowModal(false); }}>
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
