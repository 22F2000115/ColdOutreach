import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../App';
import { PLAN_LIMITS } from '../config';
import RichEditor from '../components/RichEditor';

/* ── Status badge helper ──────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    running:   'badge-running',
    completed: 'badge-completed',
    paused:    'badge-paused',
    draft:     'badge-draft',
    failed:    'badge-error',
    scheduled: 'badge-paused',
  };
  return (
    <span className={`badge ${map[status] || 'badge-draft'}`}>
      {status === 'running' && <span className="sending-dot" />}
      {status === 'scheduled' && (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      )}
      {status}
    </span>
  );
}

/* ── Dashboard ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [senders,   setSenders]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeKebabId, setActiveKebabId] = useState(null);

  const [showModal, setShowModal]   = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [name,      setName]        = useState('');
  const [subject,   setSubject]     = useState('');
  const [body,      setBody]        = useState('<p>Hi,</p><p>I noticed what your company <strong>{{company}}</strong> is doing and wanted to reach out.</p>');
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [csvFile,   setCsvFile]     = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentDisplayName, setAttachmentDisplayName] = useState('');
  const [creating,  setCreating]    = useState(false);
  const [error,     setError]       = useState('');

  const userPlan = user?.plan || 'trial';
  const campaignLimit = user?.limits?.max_campaigns ?? PLAN_LIMITS[userPlan].max_campaigns;
  const isAtCampaignLimit = campaigns.length >= campaignLimit;

  const isAdmin = user?.role === 'admin';
  const isAddQuotaReached = !isAdmin && user?.usage && user?.quotas && user.usage.add >= user.quotas.add;
  const isEditQuotaReached = !isAdmin && user?.usage && user?.quotas && user.usage.edit >= user.quotas.edit;
  const isDeleteQuotaReached = !isAdmin && user?.usage && user?.quotas && user.usage.delete >= user.quotas.delete;

  const handleOpenCreateModal = () => {
    if (isAddQuotaReached) {
      alert("You've reached your plan limit. Please upgrade to Pro or contact us for help.");
      return;
    }
    if (isAtCampaignLimit) {
      alert(`Campaign limit reached (${campaignLimit} allowed on ${userPlan} plan). Please upgrade to add more.`);
      return;
    }
    setShowModal(true);
  };


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
      await refreshUser();
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

    const handleOutsideClick = () => setActiveKebabId(null);
    document.addEventListener('click', handleOutsideClick);

    return () => {
      clearInterval(t);
      document.removeEventListener('click', handleOutsideClick);
    };
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
      await refreshUser();
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
    if (isDeleteQuotaReached) {
      alert("You've reached your plan limit. Please upgrade to Pro or contact us for help.");
      return;
    }
    if (!confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      await refreshUser();
      fetchCampaigns();
    } catch {
      alert('Failed to delete campaign');
    }
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
        <button
          className="btn btn-primary"
          onClick={handleOpenCreateModal}
          disabled={isAddQuotaReached || isAtCampaignLimit}
          style={{ transition: 'all 0.3s', opacity: (isAddQuotaReached || isAtCampaignLimit) ? 0.6 : 1, cursor: (isAddQuotaReached || isAtCampaignLimit) ? 'not-allowed' : 'pointer', boxShadow: (isAddQuotaReached || isAtCampaignLimit) ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)', fontWeight: 800 }}
          onMouseEnter={(e) => {
            const icon = e.currentTarget.querySelector('.plus-icon');
            if (icon && !(isAddQuotaReached || isAtCampaignLimit)) icon.style.transform = 'rotate(90deg)';
          }}
          onMouseLeave={(e) => {
            const icon = e.currentTarget.querySelector('.plus-icon');
            if (icon && !(isAddQuotaReached || isAtCampaignLimit)) icon.style.transform = 'rotate(0deg)';
          }}
        >
          <svg className="plus-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.25s ease-out' }}>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Campaign
        </button>
      </div>

      {/* Quota Limit Warning Banner */}
      {(isAddQuotaReached || isEditQuotaReached || isDeleteQuotaReached) && (
        <div className="alert alert-error" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '10px', flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span style={{ fontSize: '0.92rem', fontWeight: 500 }}>
              You've reached your plan limit. Please upgrade to Pro or contact us for help.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {user?.plan !== 'pro' && (
              <button 
                onClick={() => navigate('/contact')}
                className="btn btn-primary" 
                style={{ padding: '6px 12px', fontSize: '0.8rem', height: '30px' }}
              >
                Upgrade to Pro
              </button>
            )}
            <Link 
              to="/contact" 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.8rem', height: '30px', display: 'inline-flex', alignItems: 'center' }}
            >
              Contact Us
            </Link>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {[
          { 
            label: 'Total Campaigns', 
            value: campaigns.length, 
            color: 'var(--stat-total)',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            )
          },
          { 
            label: 'Emails Enqueued', 
            value: totalEmails,       
            color: 'var(--stat-enqueued)',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            )
          },
          { 
            label: 'Delivered',        
            value: totalSent,          
            color: 'var(--stat-delivered)',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            )
          },
          { 
            label: 'Failures',          
            value: totalFailed,        
            color: 'var(--stat-failures)',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            )
          },
        ].map(({ label, value, color, icon }) => (
          <div 
            className="metric-card" 
            key={label} 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              background: `color-mix(in srgb, ${color} 8%, var(--bg-card))`, 
              border: 'none', 
              boxShadow: 'var(--shadow-sm)' 
            }}
          >
            <div>
              <div className="metric-label">{label}</div>
              <div className="metric-value" style={{ color }}>{value}</div>
            </div>
            <div style={{ color, opacity: 0.85 }}>
              {icon}
            </div>
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
        <div className="card empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', gap: '12px', boxShadow: 'none', border: '1px solid var(--border-card)' }}>
          <div className="empty-state-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-hover)', color: 'var(--primary)', marginBottom: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"></path>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </div>
          <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)' }}>No campaigns yet</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', maxWidth: '340px', margin: '0 auto 12px', lineHeight: '1.5' }}>Create your first one to start outreach campaigns, import contacts, and send emails.</p>
          <button
            className="btn btn-primary"
            style={{
              padding: '10px 24px',
              animation: isAddQuotaReached ? 'none' : 'pulsing 2s infinite alternate',
              boxShadow: isAddQuotaReached ? 'none' : '0 4px 14px rgba(99, 102, 241, 0.4)',
              opacity: isAddQuotaReached ? 0.6 : 1,
              cursor: isAddQuotaReached ? 'not-allowed' : 'pointer'
            }}
            onClick={handleOpenCreateModal}
            disabled={isAddQuotaReached}
          >
            + New Campaign
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {campaigns.map((c) => {
            const pct = c.stats.total > 0 ? Math.round((c.stats.sent / c.stats.total) * 100) : 0;
            const sender = senders.find(s => s.id === c.sender_id);
            return (
              <div key={c.id} className={`campaign-row-card ${c.status}`}>
                {/* 1. Name & Sender */}
                <div style={{ flex: '1.2', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {isEditQuotaReached ? (
                    <span 
                      style={{ fontFamily: 'var(--font-header)', fontWeight: 800, fontSize: '1.22rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', cursor: 'not-allowed' }}
                      title="Edit quota reached"
                      onClick={() => alert("You've reached your plan limit. Please upgrade to Pro or contact us for help.")}
                    >
                      {c.name}
                    </span>
                  ) : (
                    <Link to={`/campaigns/${c.id}`} style={{ fontFamily: 'var(--font-header)', fontWeight: 800, fontSize: '1.22rem', color: 'var(--foreground)', display: 'block', marginBottom: '6px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </Link>
                  )}
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
                  <div className="progress-bar-track" style={{ height: '4px' }}>
                    <div className={`progress-bar-fill${c.status === 'running' ? ' shimmer' : ''}`} style={{ width: `${pct}%` }} />
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {(c.status === 'draft' || c.status === 'paused' || c.status === 'failed') && (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '9px 14px', fontSize: '0.88rem', height: '38px', gap: '6px' }}
                      onClick={(e) => handleAction(c.id, 'start', e)}
                      disabled={isEditQuotaReached}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      Start
                    </button>
                  )}

                  {c.status === 'running' && (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '9px 14px', fontSize: '0.88rem', height: '38px', gap: '6px' }}
                      onClick={(e) => handleAction(c.id, 'pause', e)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                      </svg>
                      Pause
                    </button>
                  )}
                  {isEditQuotaReached ? (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '9px 14px', fontSize: '0.88rem', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: 0.6, cursor: 'not-allowed' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        alert("You've reached your plan limit. Please upgrade to Pro or contact us for help.");
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit
                    </button>
                  ) : (
                    <Link to={`/campaigns/${c.id}`} className="btn btn-secondary" style={{ padding: '9px 14px', fontSize: '0.88rem', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit
                    </Link>
                  )}
                  
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => handleDelete(c.id, e)}
                    disabled={isDeleteQuotaReached}
                    style={{
                      padding: '9px 12px',
                      fontSize: '0.88rem',
                      height: '38px',
                      color: 'var(--error)',
                      borderColor: 'transparent',
                      background: 'transparent',
                      cursor: isDeleteQuotaReached ? 'not-allowed' : 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (!isDeleteQuotaReached) {
                        e.currentTarget.style.background = 'rgba(244, 63, 94, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDeleteQuotaReached) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
                  <input type="text" className="form-control" placeholder="e.g. Quick note about {{company}}" value={subject} onChange={e => setSubject(e.target.value)} required />
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                    Use placeholders like <code>{"{{company}}"}</code>, <code>{"{{first_name}}"}</code>, <code>{"{{last_name}}"}</code>, <code>{"{{role}}"}</code> or custom CSV column headers.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Body</label>
                  <RichEditor value={body} onChange={setBody} />
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', marginTop: '4px', display: 'block' }}>
                    Use placeholders like <code>{"{{company}}"}</code>, <code>{"{{first_name}}"}</code>, etc. anywhere in the body.
                  </span>
                </div>

                <div className="form-group" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPreviewModal(true)}
                    style={{ fontSize: '0.82rem', padding: '6px 12px', height: '32px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    Preview Email
                  </button>
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

      {/* ── Email Preview Modal ─────────────────────────────────────────── */}
      {showPreviewModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowPreviewModal(false); }}>
          <div className="modal-box" style={{ maxWidth: '600px', animation: 'scaleIn 0.3s var(--ease-spring)' }}>
            <div className="modal-header">
              <h2 className="modal-title">Email Template Preview</h2>
              <button className="modal-close" onClick={() => setShowPreviewModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                  <strong>From:</strong> {(() => {
                    const sender = senders.find(s => s.id == selectedSenderId);
                    return sender ? `${sender.from_name} <${sender.from_email}>` : 'Selected Sender';
                  })()}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                  <strong>To:</strong> Lead Email &lt;lead@company.com&gt;
                </div>
                <div style={{ fontSize: '0.94rem', color: 'var(--foreground)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '4px' }}>
                  <strong>Subject:</strong> {(() => {
                    const sample = { company: "Acme Corp", first_name: "Jane", last_name: "Doe", role: "VP of Growth" };
                    let sub = subject;
                    Object.keys(sample).forEach(k => {
                      sub = sub.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), sample[k]);
                      sub = sub.replace(new RegExp(`\\{${k}\\}`, 'gi'), sample[k]);
                    });
                    return sub || '(No Subject)';
                  })()}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '8px' }}>Rendered Body (Sandboxed Preview)</label>
                <iframe
                  srcDoc={`
                    <html>
                      <head>
                        <style>
                          body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            font-size: 14px;
                            line-height: 1.6;
                            color: #334155;
                            padding: 20px;
                            margin: 0;
                            background-color: #ffffff;
                          }
                          p { margin-top: 0; margin-bottom: 1em; }
                          strong { color: #0f172a; }
                        </style>
                      </head>
                      <body>
                        ${(() => {
                          const sample = { company: "Acme Corp", first_name: "Jane", last_name: "Doe", role: "VP of Growth" };
                          let rendered = body;
                          Object.keys(sample).forEach(k => {
                            rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), sample[k]);
                            rendered = rendered.replace(new RegExp(`\\{${k}\\}`, 'gi'), sample[k]);
                          });
                          return rendered;
                        })()}
                      </body>
                    </html>
                  `}
                  style={{
                    width: '100%',
                    height: '350px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    background: '#ffffff'
                  }}
                  title="email-preview"
                />
              </div>

              <div style={{ background: 'var(--primary-subtle, rgba(99,102,241,0.08))', border: '1px solid var(--primary-border, rgba(99,102,241,0.2))', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                <strong>Note:</strong> Custom CSV column values are parsed and substituted at runtime. The preview uses sample values for representation.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPreviewModal(false)}>
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
