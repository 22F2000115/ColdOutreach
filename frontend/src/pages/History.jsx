// History page displaying overall email metrics, activity logs timeline, and campaign breakdown.
import { useState, useEffect, useCallback, useRef } from 'react';

import { api } from '../App';

// ─── Icon Components ──────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconCampaign() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function IconSmtp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconUser() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function IconChevron({ open }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}
function IconDownload() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
function IconMail() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
function IconPaperPlane() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function IconCheckCircle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}
function IconAlertCircle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
    </svg>
  );
}
function IconSpinner() {
  return (
    <svg className="spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="6.34" y1="17.66" x2="9.17" y2="14.83"></line>
      <line x1="14.83" y1="9.17" x2="17.66" y2="6.34"></line>
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }) {
  return (
    <div
      className="metric-card"
      style={{
        background: `color-mix(in srgb, ${color} 8%, var(--bg-card))`,
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '20px 22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        boxShadow: 'var(--shadow-sm)',
        flex: '1 1 190px',
        minWidth: 0,
      }}
    >
      <div>
        <div className="metric-label" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="metric-value" style={{ color }}>{value ?? '—'}</div>
      </div>
      <div style={{ color, opacity: 0.85, marginTop: '2px' }}>
        {icon}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr) {
  if (!dateStr) return '—';
  const timestamp = String(dateStr).replace(' ', 'T');
  const utcString = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
  const date = new Date(utcString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const timestamp = String(dateStr).replace(' ', 'T');
  const utcString = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
  return new Date(utcString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getLogIconConfig(log) {
  const isCompleted = log.action?.toLowerCase().includes('completed');
  if (isCompleted) return { icon: <IconCheck />, color: '#10B981' };
  if (log.event_type === 'campaign') return { icon: <IconCampaign />, color: '#6366F1' };
  if (log.event_type === 'smtp') return { icon: <IconSmtp />, color: '#F59E0B' };
  return { icon: <IconUser />, color: '#94A3B8' };
}

function renderLogDetail(log) {
  if (!log.metadata) return null;
  const { event_type, metadata } = log;
  if (event_type === 'campaign') {
    if (metadata.sent_count !== undefined)
      return `${metadata.campaign_name} · ${metadata.sent_count} sent, ${metadata.failed_count} failed`;
    return metadata.campaign_name || null;
  }
  if (event_type === 'smtp') return metadata.from_email || null;
  if (event_type === 'profile')
    return `${metadata.old_plan || '?'} → ${metadata.new_plan || '?'}`;
  return null;
}

function campaignStatusBadge(status) {
  const map = {
    completed: { label: 'Completed', color: 'var(--success, #10B981)', bg: 'var(--success-subtle, rgba(16,185,129,0.10))', border: '1px solid var(--success-border, rgba(16,185,129,0.20))' },
    running:   { label: 'Running',   color: 'var(--primary, #6366F1)', bg: 'var(--primary-subtle, rgba(99,102,241,0.10))', border: '1px solid var(--primary-border, rgba(99,102,241,0.20))' },
    paused:    { label: 'Paused',    color: 'var(--warning, #F59E0B)', bg: 'var(--warning-subtle, rgba(245,158,11,0.10))', border: '1px solid var(--warning-border, rgba(245,158,11,0.20))' },
    draft:     { label: 'Draft',     color: 'var(--text-muted, #94A3B8)', bg: 'var(--muted-subtle, rgba(148,163,184,0.10))', border: '1px solid var(--muted-border, rgba(148,163,184,0.20))' },
  };
  const s = map[status] || { label: status, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em',
      textTransform: 'uppercase',
      color: s.color, background: s.bg,
      border: s.border,
      borderRadius: '5px', padding: '2px 8px',
    }}>
      {s.label}
    </span>
  );
}

// ─── Campaign Accordion Row ───────────────────────────────────────────────────

function CampaignRow({ campaign, isOpen, onToggle }) {
  // useState hooks
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // useRef hooks
  const fetchedRef = useRef(false);

  // Derived values/variables
  const total = campaign.stats?.total || 0;
  const sent = campaign.stats?.sent || 0;
  const failed = campaign.stats?.failed || 0;

  // useEffect hooks
  useEffect(() => {
    if (isOpen && !fetchedRef.current) {
      fetchedRef.current = true;
      setLoadingDetail(true);
      api.get(`/api/user/campaign-activity/${campaign.id}`)
        .then(res => setDetail(res.data))
        .catch(err => setDetailError(err.response?.data?.detail || 'Something went wrong. Please try again.'))
        .finally(() => setLoadingDetail(false));
    }
  }, [isOpen, campaign.id]);

  return (
    <div style={{
      border: '1px solid var(--border-card)',
      borderRadius: '10px',
      overflow: 'hidden',
      background: 'var(--bg-card)',
      transition: 'box-shadow 0.2s',
      boxShadow: isOpen ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    }}>
      {/* Header Row */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'left',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Campaign name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {campaign.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {formatDateShort(campaign.created_at)}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <span style={{ fontSize: '0.76rem', color: '#6366F1', fontWeight: 600 }}>
            {total} leads
          </span>
          <span style={{ fontSize: '0.76rem', color: '#10B981', fontWeight: 600 }}>
            {sent} delivered
          </span>
          {failed > 0 && (
            <span style={{ fontSize: '0.76rem', color: '#F43F5E', fontWeight: 600 }}>
              {failed} failed
            </span>
          )}
        </div>

        {/* Status badge */}
        <div style={{ flexShrink: 0 }}>
          {campaignStatusBadge(campaign.status)}
        </div>

        {/* Chevron */}
        <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <IconChevron open={isOpen} />
        </div>
      </button>

      {/* Expandable detail */}
      {isOpen && (
        <div style={{
          borderTop: '1px solid var(--border-card)',
          padding: '16px',
          background: 'var(--bg-page)',
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          {loadingDetail && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading…
            </div>
          )}
          {detailError && (
            <div style={{ color: '#F43F5E', fontSize: '0.85rem', padding: '8px 0' }}>{detailError}</div>
          )}
          {detail && !loadingDetail && (
            <>
              {/* Aggregate stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
                {[
                  { label: 'Total Leads', value: detail.total_leads, color: '#6366F1' },
                  { label: 'Delivered',   value: detail.stats.delivered, color: '#10B981' },
                  { label: 'Failed',      value: detail.stats.failed, color: '#F43F5E' },
                  { label: 'Pending',     value: detail.stats.pending, color: '#94A3B8' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-card)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)' }}>
                      {s.value}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '1px' }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Send events table */}
              {detail.send_events.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', padding: '8px 0' }}>
                  No sent emails recorded yet for this campaign.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-card)' }}>
                        {['Recipient', 'Company', 'Status', 'Sent At'].map(h => (
                          <th key={h} style={{
                            textAlign: 'left', padding: '6px 10px',
                            color: 'var(--text-muted)', fontWeight: 700,
                            fontSize: '0.71rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.send_events.map((ev, i) => (
                        <tr key={i} style={{
                          borderBottom: i < detail.send_events.length - 1 ? '1px solid var(--border-card)' : 'none',
                        }}>
                          <td style={{ padding: '7px 10px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.email}
                          </td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>
                            {ev.company || '—'}
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 700,
                              color: ev.status === 'delivered' ? '#10B981' : '#F43F5E',
                              background: ev.status === 'delivered' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                              borderRadius: '4px', padding: '2px 7px',
                            }}>
                              {ev.status === 'delivered' ? 'Delivered' : 'Failed'}
                            </span>
                          </td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {ev.sent_at ? formatRelativeDate(ev.sent_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Main History Page ────────────────────────────────────────────────────────

export default function History() {
  // useState hooks
  const [eventType, setEventType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [openCampaignId, setOpenCampaignId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Derived values/variables
  const limit = 50;
  const activeCampaigns = campaigns.filter(c => c.status !== 'draft');
  const stats = summary
    ? [
        { label: 'Emails Sent',        value: summary.total_emails_sent,  color: '#6366F1', icon: <IconMail /> },
        { label: 'Campaigns Run',      value: summary.total_campaigns_run, color: '#06B6D4', icon: <IconPaperPlane /> },
        { label: 'Delivered',          value: summary.delivered_count,     color: '#10B981', icon: <IconCheckCircle /> },
        { label: 'Failed to Deliver',  value: summary.failed_count,        color: '#F43F5E', icon: <IconAlertCircle /> },
      ]
    : null;

  // useEffect hooks
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    // Empty dependency array: set page title and fetch initial list of campaigns once on component mount
    document.title = 'Activity History - ColdOutreach';
    api.get('/api/campaigns')
      .then(res => setCampaigns(res.data || []))
      .catch(() => {})
      .finally(() => setCampaignsLoading(false));
  }, []);

  const fetchLogs = useCallback(async (currentOffset, append = false) => {
    if (currentOffset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const params = { limit, offset: currentOffset };
      if (eventType) params.event_type = eventType;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await api.get('/api/user/activity-log', { params });
      const data = res.data || {};
      const newLogs = data.logs || [];

      // Summary is always current totals (backend ignores filters for it)
      if (data.summary && currentOffset === 0) setSummary(data.summary);

      if (append) setLogs(prev => [...prev, ...newLogs]);
      else setLogs(newLogs);

      setHasMore(newLogs.length >= limit);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [eventType, fromDate, toDate]);

  useEffect(() => {
    setOffset(0);
    fetchLogs(0, false);
  }, [eventType, fromDate, toDate, fetchLogs]);

  // Handler and helper functions
  const handleSyncBounces = async () => {
    const activeCamps = campaigns.filter(c => c.status !== 'draft');
    if (activeCamps.length === 0) {
      setToast({ message: 'No active campaigns found. Start a campaign first to check for failed deliveries.', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(activeCamps.map(c => api.post(`/api/campaigns/${c.id}/sync-bounces`)));
      setToast({ message: 'Done! Your failed delivery records have been updated for all active campaigns.', type: 'success' });

      // Refresh the page data
      fetchLogs(0, false);
      api.get('/api/campaigns')
        .then(res => setCampaigns(res.data || []))
        .catch(() => {});
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || 'Something went wrong. Please try again.',
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadMore = () => {
    const nextOffset = offset + limit;
    setOffset(nextOffset);
    fetchLogs(nextOffset, true);
  };

  const handleResetFilters = (e) => {
    e.preventDefault();
    setEventType('');
    setFromDate('');
    setToDate('');
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Event Type', 'Action', 'Details', 'Date'];
    const rows = logs.map(log => {
      const detail = renderLogDetail(log) || '';
      return [log.id, log.event_type, log.action, detail, log.created_at || ''];
    });
    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="container" style={{ paddingBottom: '48px' }}>

      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Activity History</h1>
          <p className="page-subtitle">Track every email sent, campaign run, and account change.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button
            id="sync_bounces_btn"
            className="btn btn-secondary"
            onClick={handleSyncBounces}
            disabled={submitting}
            title="Scans your sender mailbox for emails that were returned or rejected"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: '1px solid var(--border-card)',
              color: 'var(--text-primary)',
            }}
          >
            {submitting ? <IconSpinner /> : <IconRefresh />}
            <span>{submitting ? 'Checking…' : 'Check Deliveries'}</span>
          </button>
          <button
            id="export_csv_btn"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={submitting || logs.length === 0}
            title="Saves your activity history as a spreadsheet file (.csv)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: '1px solid var(--border-card)',
              color: 'var(--text-primary)',
            }}
          >
            <IconDownload />
            <span>Download Log</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <span>{error}</span>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {stats
          ? stats.map(s => <StatCard key={s.label} {...s} />)
          : [0, 1, 2, 3].map(i => (
              <div key={i} style={{
                flex: '1 1 190px', minWidth: 0,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: '12px',
                padding: '20px 22px',
                height: '76px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))
        }
      </div>

      {/* Filter Bar */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '14px 18px',
        marginBottom: '16px',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Type pill filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { label: 'All', value: '' },
            { label: 'Campaigns', value: 'campaign' },
            { label: 'Sender Account', value: 'smtp' },
            { label: 'Account Changes', value: 'profile' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setEventType(f.value)}
              className={`filter-btn${eventType === f.value ? ' active' : ''}`}
              style={{
                height: '36px',
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Date inputs */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'From', val: fromDate, set: setFromDate, placeholder: 'Start Date' },
            { label: 'To',   val: toDate,   set: setToDate, placeholder: 'End Date' },
          ].map(d => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>{d.label}</span>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="var(--text-muted)" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: 'absolute', left: '10px', pointerEvents: 'none', zIndex: 1 }}
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <input
                  type={d.val ? 'date' : 'text'}
                  placeholder={d.placeholder}
                  value={d.val}
                  onChange={e => d.set(e.target.value)}
                  onFocus={(e) => { e.target.type = 'date'; }}
                  onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                  className="form-control"
                  style={{
                    height: '36px',
                    paddingLeft: '32px',
                    paddingRight: '10px',
                    fontSize: '0.84rem',
                    width: '145px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          ))}
          {(eventType || fromDate || toDate) && (
            <button
              onClick={handleResetFilters}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--primary)', fontSize: '0.84rem', fontWeight: 700,
                fontFamily: 'var(--font-body)', padding: '0',
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Two-Column Body ── */}
      {/* Section orientation labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px', marginBottom: '8px' }} className="history-two-col">
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            What happened?
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            How did each campaign do?
          </div>
        </div>
      </div>
      <div className="history-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px', alignItems: 'stretch' }}>

        {/* ── Left: Activity Feed ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Timeline wrapped in card with padding */}
          <div className="card bg-white dark:bg-[var(--bg-card)] border border-slate-200 dark:border-[var(--border-card)]" style={{
            padding: '24px',
            borderRadius: '12px',
            minHeight: '300px',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {loading && (
              <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Loading activity…
              </div>
            )}

            {!loading && logs.length === 0 && (
              <div style={{ padding: '56px 24px', textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--text-muted)',
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>No activity yet</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem', maxWidth: '260px', margin: '0 auto 16px' }}>
                  Once you start a campaign or connect a sender account, every action will appear here.
                </div>
                <a
                  href="/"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontSize: '0.82rem', fontWeight: 700,
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    padding: '7px 14px',
                    border: '1px solid var(--primary)',
                    borderRadius: '8px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                  Go to Campaigns
                </a>
              </div>
            )}

            {!loading && logs.length > 0 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {logs.map((log, i) => {
                    const { icon, color } = getLogIconConfig(log);
                    const detail = renderLogDetail(log);

                    return (
                      <div key={log.id}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '14px',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Icon */}
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '8px',
                            background: `${color}14`,
                            color: color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: '1px',
                          }}>
                            {icon}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {log.action}
                            </div>
                            {detail && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                                {detail}
                              </div>
                            )}
                          </div>

                          {/* Time */}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px', whiteSpace: 'nowrap' }}>
                            {formatRelativeDate(log.created_at)}
                          </div>
                        </div>
                        {i < logs.length - 1 && (
                          <div style={{ height: '1px', background: 'var(--border-card)', margin: '4px 16px', opacity: 0.6 }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                    <button
                      id="load_more_btn"
                      className="btn btn-secondary"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      style={{ fontSize: '0.83rem', minWidth: '140px' }}
                    >
                      {loadingMore ? 'Loading…' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right: Campaign Breakdown ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card bg-white dark:bg-[var(--bg-card)] border border-slate-200 dark:border-[var(--border-card)]" style={{
            padding: '24px',
            borderRadius: '12px',
            minHeight: '300px',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <h2 className="section-title" style={{
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              </span>
              Campaign Breakdown
            </h2>

            {campaignsLoading && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                Loading campaigns…
              </div>
            )}

            {!campaignsLoading && activeCampaigns.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No active campaigns yet.
              </div>
            )}

            {!campaignsLoading && activeCampaigns.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeCampaigns.map(c => (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    isOpen={openCampaignId === c.id}
                    onToggle={() => setOpenCampaignId(openCampaignId === c.id ? null : c.id)}
                  />
                ))}
              </div>
            )}

            {/* Draft campaigns count */}
            {!campaignsLoading && campaigns.filter(c => c.status === 'draft').length > 0 && (
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-page)', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  + {campaigns.filter(c => c.status === 'draft').length} draft campaign(s) not shown
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          minWidth: '280px',
          maxWidth: '400px',
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          <div className={`alert alert-${toast.type}`} style={{ margin: 0, boxShadow: 'var(--shadow-lg)', alignItems: 'center' }}>
            {toast.type === 'success' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Responsive: stack columns on smaller screens */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @media (max-width: 900px) {
          .history-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
