import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../App';

function StatusBadge({ status }) {
  const map = {
    running:   'badge-running',
    completed: 'badge-completed',
    paused:    'badge-paused',
    draft:     'badge-draft',
    failed:    'badge-error',
    sent:      'badge-success',
    pending:   'badge-draft',
    sending:   'badge-running',
  };
  return (
    <span className={`badge ${map[status] || 'badge-draft'}`}>
      {status === 'running' && <span className="sending-dot" />}
      {status}
    </span>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign,    setCampaign]    = useState(null);
  const [recipients,  setRecipients]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [actionLoad,  setActionLoad]  = useState(false);
  const [error,       setError]       = useState('');

  const fetchData = async () => {
    try {
      const [campRes, recRes] = await Promise.all([
        api.get(`/api/campaigns/${id}`),
        api.get(`/api/campaigns/${id}/recipients`),
      ]);
      setCampaign(campRes.data);
      setRecipients(recRes.data);
    } catch {
      setError('Campaign not found or access denied.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    if (!campaign || campaign.status !== 'running') return;
    const t = setInterval(fetchData, 3000);
    return () => clearInterval(t);
  }, [campaign?.status]);

  const handleAction = async (action) => {
    setActionLoad(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('action', action);
      const res = await api.post(`/api/campaigns/${id}/action`, fd);
      setCampaign(prev => ({ ...prev, status: res.data.status }));
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || `Failed: ${action}`);
    } finally {
      setActionLoad(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      navigate('/');
    } catch {
      setError('Failed to delete campaign.');
    }
  };

  if (loading) return <p style={{ color: 'var(--muted-foreground)' }}>Loading campaign…</p>;
  if (error && !campaign) return <div className="alert alert-error">⚠️ {error}</div>;

  const pct = campaign.stats.total > 0 ? Math.round((campaign.stats.sent / campaign.stats.total) * 100) : 0;

  return (
    <div style={{ animation: 'slideUp 0.3s var(--ease-smooth)' }}>
      {/* Back link */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--muted-foreground)', fontSize: '0.84rem', fontWeight: 700, marginBottom: '20px' }}>
        ← All Campaigns
      </Link>

      {/* Page header */}
      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-subtitle">
            Created {new Date(campaign.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <button className="btn btn-primary" onClick={() => handleAction('start')} disabled={actionLoad}>
              ▶ Start Campaign
            </button>
          )}
          {campaign.status === 'running' && (
            <button className="btn btn-secondary" onClick={() => handleAction('pause')} disabled={actionLoad}>
              ⏸ Pause
            </button>
          )}
          {campaign.status !== 'running' && (
            <button className="btn btn-secondary" onClick={() => handleAction('reset')} disabled={actionLoad}>
              🔄 Reset
            </button>
          )}
          <button
            className="btn btn-secondary"
            style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,0.25)' }}
            onClick={handleDelete}
            disabled={actionLoad || campaign.status === 'running'}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '24px' }}>⚠️ {error}</div>}

      {/* Top info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '24px' }}>

        {/* Email template */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 className="section-title" style={{ marginBottom: '16px' }}>Email Template</h2>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--muted)', fontSize: '0.9rem' }}>
              {campaign.subject_template}
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Body Preview</label>
            <div
              style={{
                padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.65, minHeight: '80px'
              }}
              dangerouslySetInnerHTML={{ __html: campaign.body_template }}
            />
          </div>
          {campaign.attachment_name && (
            <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              📎 {campaign.attachment_display_name || campaign.attachment_name}
            </p>
          )}
        </div>

        {/* Status & metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: '8px' }}>Campaign Status</div>
            <StatusBadge status={campaign.status} />
            <div style={{ marginTop: '16px' }}>
              <div className="flex-between" style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '5px' }}>
                <span>Delivery</span>
                <span>{pct}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3 className="section-title" style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Metrics</h3>
            {[
              { label: 'Total',   value: campaign.stats.total,   color: 'var(--foreground)' },
              { label: 'Sent',    value: campaign.stats.sent,     color: 'var(--success)' },
              { label: 'Failed',  value: campaign.stats.failed,   color: 'var(--error)' },
              { label: 'Sending', value: campaign.stats.sending,  color: '#4f46e5' },
              { label: 'Pending', value: campaign.stats.pending,  color: 'var(--muted-foreground)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex-between" style={{ fontSize: '0.85rem', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>{label}</span>
                <strong style={{ color }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recipients table */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '32px' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="section-title">Outreach Log</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Company</th>
                <th>Status</th>
                <th>Sent At</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted-foreground)' }}>
                    No recipients loaded.
                  </td>
                </tr>
              ) : recipients.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.email}</td>
                  <td style={{ color: 'var(--muted-foreground)' }}>{r.company || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>
                    {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: r.status === 'failed' ? 'var(--error)' : 'var(--muted-foreground)' }}>
                    {r.error_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
