/**
 * CampaignDetail page handles viewing campaign status, recipients list, templates,
 * CSV uploads, and sync operations.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, useAuth } from '../App';
import RichEditor from '../components/RichEditor';
import FailedContactsTab from '../components/FailedContactsTab';
import { getFriendlyError } from '../utils/errors';
import UpgradeModal from '../components/UpgradeModal';

function getFriendlyErrorMessage(errorMsg) {
  if (!errorMsg) return '—';
  const lower = errorMsg.toLowerCase();
  
  if (lower.includes('nxdomain') || lower.includes('domain not found') || lower.includes('dns type')) {
    return "Email domain doesn't exist (spelling error or invalid company website).";
  }
  if (lower.includes('user unknown') || lower.includes('550') || lower.includes('551') || lower.includes('no such user') || lower.includes('recipient rejected') || lower.includes('mailbox unavailable')) {
    return "This email address doesn't exist.";
  }
  if (lower.includes('timeout') || lower.includes('connection timed out')) {
    return "The recipient's mail server didn't respond in time.";
  }
  if (lower.includes('connection refused') || lower.includes('connect refused')) {
    return "The recipient's mail server rejected the connection.";
  }
  if (lower.includes('auth') || lower.includes('credential') || lower.includes('login') || lower.includes('rejection')) {
    return "Sender account authentication failure. Please check your SMTP settings.";
  }
  if (lower.includes('spam') || lower.includes('blocked') || lower.includes('blacklisted') || lower.includes('reputation')) {
    return "Email blocked by recipient server's spam filter.";
  }
  return errorMsg; // Fallback to raw error if it doesn't match common patterns
}

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
      {status === 'sent' ? 'delivered' : status}
    </span>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  // State hooks
  const [campaign, setCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState('all');
  const [submittingSync, setSubmittingSync] = useState(false);

  // New UI states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Outer section tabs & action states
  const [activeSection, setActiveSection] = useState('setup');
  const [activeKebabOpen, setActiveKebabOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Template editing states
  const [campName, setCampName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submittingTemplate, setSubmittingTemplate] = useState(false);

  // Inline recipient states
  const [inlineEmail, setInlineEmail] = useState('');
  const [inlineCompany, setInlineCompany] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);

  // CSV upload states
  const [csvFile, setCsvFile] = useState(null);
  const [csvMode, setCsvMode] = useState('append'); // 'append' or 'replace'
  const [submittingCsv, setSubmittingCsv] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Derived values/variables
  const isEditable = campaign ? (campaign.status === 'draft' || campaign.status === 'paused' || campaign.status === 'completed') : false;
  const isAdmin = user?.role === 'admin';
  const isDeleteQuotaReached = !isAdmin && user?.usage && user?.quotas && user.usage.delete >= user.quotas.delete;
  const isSaveQuotaReached = !isAdmin && user?.usage && user?.quotas && user.usage.save >= user.quotas.save;

  // useEffect hooks
  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!campaign || campaign.status !== 'running') return;
    const t = setInterval(() => fetchData(true), 4000);
    return () => clearInterval(t);
  }, [campaign?.status]);

  useEffect(() => {
    if (campaign) {
      document.title = `${campaign.name} - Campaign Details - ColdOutreach`;
      setCampName(campaign.name);
      setSubject(campaign.subject_template || '');
      setBody(campaign.body_template || '');
    }
  }, [campaign]);

  // Setup click listener on mount to handle closing the kebab menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveKebabOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    const maxPage = Math.ceil(recipients.length / pageSize);
    if (maxPage > 0 && currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [recipients.length, currentPage]);

  // Handler and helper functions
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (!isEditable) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setCsvFile(file);
      } else {
        setMessage({ text: 'Please select a valid CSV file.', type: 'error' });
      }
    }
  };

  const fetchData = async (isPolling = false) => {
    try {
      const [campRes, recRes] = await Promise.all([
        api.get(`/api/campaigns/${id}${isPolling ? '?poll=true' : ''}`),
        api.get(`/api/campaigns/${id}/recipients`),
      ]);
      setCampaign(campRes.data);
      setRecipients(recRes.data);
      await refreshUser();
      return campRes.data;
    } catch (err) {
      setMessage({ text: getFriendlyError(err, "Something went wrong. Please try again."), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    setSubmittingAction(true);
    setMessage({ text: '', type: '' });
    try {
      const fd = new FormData();
      fd.append('action', action);
      const res = await api.post(`/api/campaigns/${id}/action`, fd);
      setCampaign(prev => ({ ...prev, status: res.data.status }));
      fetchData();
      setMessage({ text: `Campaign status updated to ${res.data.status}`, type: 'success' });
    } catch (err) {
      setMessage({ text: getFriendlyError(err, `Failed to execute action: ${action}`), type: 'error' });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (isSaveQuotaReached) {
      setShowUpgradeModal(true);
      return;
    }
    if (!campName.trim() || !subject.trim()) {
      setMessage({ text: 'Campaign name and subject template are required.', type: 'error' });
      return;
    }
    setSubmittingTemplate(true);
    setMessage({ text: '', type: '' });
    try {
      const fd = new FormData();
      fd.append('name', campName);
      fd.append('subject_template', subject);
      fd.append('body_template', body);
      if (campaign.sender_id) {
        fd.append('sender_id', campaign.sender_id);
      }
      await api.put(`/api/campaigns/${id}`, fd);
      await refreshUser();
      setMessage({ text: 'Template saved successfully', type: 'success' });
      fetchData();
    } catch (err) {
      setMessage({ text: getFriendlyError(err, 'Failed to save template'), type: 'error' });
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!inlineEmail.trim()) {
      setMessage({ text: 'Email address is required.', type: 'error' });
      return;
    }
    setSubmittingContact(true);
    setMessage({ text: '', type: '' });
    try {
      const fd = new FormData();
      fd.append('email', inlineEmail.trim());
      fd.append('company', inlineCompany.trim());
      await api.post(`/api/campaigns/${id}/recipients`, fd);
      setInlineEmail('');
      setInlineCompany('');
      setMessage({ text: 'Recipient added successfully', type: 'success' });
      fetchData();
    } catch (err) {
      setMessage({ text: getFriendlyError(err, 'Failed to add recipient'), type: 'error' });
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleUploadCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      setMessage({ text: 'Please select a CSV file first.', type: 'error' });
      return;
    }
    setSubmittingCsv(true);
    setMessage({ text: '', type: '' });
    try {
      const fd = new FormData();
      fd.append('contacts_csv', csvFile);
      fd.append('mode', csvMode);
      const res = await api.post(`/api/campaigns/${id}/recipients/csv`, fd);
      setCsvFile(null);
      const fileInput = document.getElementById('csv-file-input');
      if (fileInput) fileInput.value = '';
      setMessage({ text: res.data.message || 'CSV file processed successfully', type: 'success' });
      fetchData();
    } catch (err) {
      setMessage({ text: getFriendlyError(err, 'Failed to upload CSV file'), type: 'error' });
    } finally {
      setSubmittingCsv(false);
    }
  };

  const handleSyncBounces = async () => {
    setMessage({ text: '', type: '' });
    setSubmittingSync(true);
    const oldFailed = campaign?.stats?.failed || 0;
    try {
      const res = await api.post(`/api/campaigns/${id}/sync-bounces`);
      setMessage({
        text: res.data.message || 'Checking your sender mailbox for delivery failures in the background...',
        type: 'info'
      });
      // Delay fetching data to give the background sync worker time to run
      setTimeout(async () => {
        const updatedCampaign = await fetchData(true);
        const newFailed = updatedCampaign?.stats?.failed || 0;
        const diff = newFailed - oldFailed;
        if (diff > 0) {
          setMessage({
            text: `Delivery failure check complete! Found ${diff} new failed email(s).`,
            type: 'success'
          });
        } else {
          setMessage({
            text: 'Check complete! No new delivery failures found.',
            type: 'success'
          });
        }
        setSubmittingSync(false);
      }, 5000);
    } catch (err) {
      setMessage({
        text: getFriendlyError(err, 'Failed to check for delivery failures.'),
        type: 'error'
      });
      setSubmittingSync(false);
    }
  };

  const handleDownloadCsv = async () => {
    setMessage({ text: '', type: '' });
    try {
      const res = await api.get(`/api/campaigns/${id}/recipients/csv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign_${id}_recipients.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setMessage({ text: getFriendlyError(err, "Something went wrong. Please try again."), type: 'error' });
    }
  };

  const handleDownloadSampleCsv = async () => {
    setMessage({ text: '', type: '' });
    try {
      const res = await api.get('/api/sample-csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_contacts.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setMessage({ text: getFriendlyError(err, "Something went wrong. Please try again."), type: 'error' });
    }
  };

  const handleDeleteRecipient = async (recipientId) => {
    if (!confirm('Remove this contact from the campaign?')) return;
    setMessage({ text: '', type: '' });
    try {
      await api.delete(`/api/campaigns/${id}/recipients/${recipientId}`);
      setMessage({ text: 'Recipient removed.', type: 'success' });
      fetchData();
    } catch (err) {
      setMessage({ text: getFriendlyError(err, 'Failed to remove recipient'), type: 'error' });
    }
  };

  // Helper to parse placeholders from templates
  const detectPlaceholders = (text) => {
    if (!text) return [];
    const doubleMatches = [...text.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1].trim().toLowerCase());
    const singleMatches = [...text.matchAll(/(?<!\{)\{([^{}]+)\}(?!\})/g)].map(m => m[1].trim().toLowerCase());
    return [...new Set([...doubleMatches, ...singleMatches])];
  };

  const getAvailablePlaceholderKeys = () => {
    const keys = new Set(['first_name', 'last_name', 'company', 'role', 'email']);
    recipients.forEach(r => {
      if (r.extra_data) {
        try {
          const extra = JSON.parse(r.extra_data);
          if (extra && typeof extra === 'object') {
            Object.keys(extra).forEach(k => keys.add(k.trim().toLowerCase()));
          }
        } catch {
          // Ignore invalid JSON in extra_data
        }
      }
    });
    return Array.from(keys);
  };

  const usedPlaceholders = campaign ? [...new Set([...detectPlaceholders(subject), ...detectPlaceholders(body)])] : [];
  const availableKeys = getAvailablePlaceholderKeys();
  const unrecognizedPlaceholders = usedPlaceholders.filter(p => !availableKeys.includes(p));

  if (loading) return <p style={{ color: 'var(--muted-foreground)' }}>Loading campaign...</p>;
  if (message.type === 'error' && !campaign) return <div className="alert alert-error">{message.text}</div>;

  const processedCount = (campaign?.stats?.sent || 0) + (campaign?.stats?.failed || 0);
  const remainingCount = (campaign?.stats?.total || 0) - processedCount;
  const sendDelaySec = campaign?.sender?.send_delay_seconds || 3;
  const etaSeconds = remainingCount * sendDelaySec;

  const formatETA = (seconds) => {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const pct = campaign.stats.total > 0 ? Math.round((processedCount / campaign.stats.total) * 100) : 0;

  // Pagination calculations for All Contacts
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRecipients = recipients.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(recipients.length / pageSize);

  return (
    <div style={{ animation: 'slideUp 0.3s var(--ease-smooth)' }}>
      {/* Back link */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--muted-foreground)', fontSize: '0.84rem', fontWeight: 700, marginBottom: '20px' }}>
        ← All Campaigns
      </Link>

      {/* Quota Limit Warning Banner */}
      {(isSaveQuotaReached || isDeleteQuotaReached) && (
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
                onClick={() => setShowUpgradeModal(true)}
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

      {/* Page header */}
      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-subtitle">
            Created {new Date(campaign.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <button className="btn btn-primary" onClick={() => handleAction('start')} disabled={submittingAction} style={{ boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)' }}>
              Start Campaign
            </button>
          )}
          {campaign.status === 'running' && (
            <button className="btn btn-secondary" onClick={() => handleAction('pause')} disabled={submittingAction}>
              Pause
            </button>
          )}

          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '9px 12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40px' }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveKebabOpen(!activeKebabOpen);
              }}
              disabled={submittingAction}
            >
              ⋯
            </button>
            {activeKebabOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '44px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-md)',
                zIndex: 100,
                minWidth: '180px',
                padding: '4px 0',
                textAlign: 'left'
              }}>
                {campaign.status !== 'running' && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveKebabOpen(false);
                      setConfirmResetOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '10px 14px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--foreground)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                    </svg>
                    Retry Campaign
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveKebabOpen(false);
                    if (isDeleteQuotaReached) {
                      alert("You've reached your plan limit. Please upgrade to Pro or contact us for help.");
                      return;
                    }
                    if (campaign.status === 'running') {
                      alert("Cannot delete a running campaign. Please pause it first.");
                      return;
                    }
                    setConfirmDeleteOpen(true);
                  }}
                  disabled={campaign.status === 'running' || isDeleteQuotaReached}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'transparent',
                    color: campaign.status === 'running' || isDeleteQuotaReached ? 'var(--text-muted)' : 'var(--error)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: campaign.status === 'running' || isDeleteQuotaReached ? 'not-allowed' : 'pointer',
                    opacity: campaign.status === 'running' || isDeleteQuotaReached ? 0.5 : 1,
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (campaign.status !== 'running' && !isDeleteQuotaReached) {
                      e.currentTarget.style.background = 'rgba(244, 63, 94, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete Campaign
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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

      {/* 4-Card Hero Statistics Strip */}
      <div className="campaign-stats-grid">
        {/* Card 1: Status & Progress */}
        <div className="metric-card campaign-stat-card accent-indigo" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '6px' }}>Campaign Status</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <StatusBadge status={campaign.status} />
              {campaign.status === 'running' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="pulse-indicator" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', animation: 'pulsing 1.5s infinite' }} />
                  Active
                </span>
              )}
            </div>
            {campaign.status === 'running' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                ETA: ~{formatETA(etaSeconds)} remaining
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
            <div className="progress-bar-track" style={{ height: '4px', flexGrow: 1, margin: 0 }}>
              <div className={`progress-bar-fill${campaign.status === 'running' ? ' shimmer' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', fontWeight: 700, flexShrink: 0 }}>
              {pct}% ({processedCount}/{campaign.stats.total})
            </span>
          </div>
        </div>

        {/* Card 2: Total Contacts */}
        <div className="metric-card campaign-stat-card accent-blue" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="metric-label">Total Leads</div>
            <div className="metric-value">{campaign.stats.total}</div>
          </div>
          <div style={{ color: 'var(--stat-enqueued)', opacity: 0.8 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
        </div>

        {/* Card 3: Sent */}
        <div className="metric-card campaign-stat-card accent-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="metric-label">Delivered</div>
            <div className="metric-value">{campaign.stats.sent}</div>
          </div>
          <div style={{ color: 'var(--stat-delivered)', opacity: 0.8 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>

        {/* Card 4: Failed */}
        <div className="metric-card campaign-stat-card accent-red" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="metric-label">Failed to Deliver</div>
            <div className="metric-value">{campaign.stats.failed}</div>
          </div>
          <div style={{ color: 'var(--stat-failures)', opacity: 0.8 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
        </div>
      </div>

      {/* Outer Section Tabs */}
      <div className="tabs-container" style={{ marginBottom: '24px', background: 'transparent', padding: 0, borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          className={`tab-btn${activeSection === 'setup' ? ' active' : ''}`}
          onClick={() => setActiveSection('setup')}
          style={{ padding: '12px 16px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
          Campaign Setup
        </button>
        <button
          type="button"
          className={`tab-btn${activeSection === 'outreach' ? ' active' : ''}`}
          onClick={() => {
            setActiveSection('outreach');
            setCurrentPage(1);
          }}
          style={{ padding: '12px 16px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M22 12h-6l-3 9L9 3l-3 9H2"></path>
          </svg>
          Outreach Log & Leads ({recipients.length})
        </button>
      </div>

      {/* Main Campaign workspace */}
      {activeSection === 'setup' && (
        <>
          {/* Banner explaining editability status */}
          {campaign && (campaign.status === 'completed' || !isEditable) && (
            <div className="alert alert-info" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>
                {campaign.status === 'completed' && (
                  <>This campaign is <strong>Completed</strong>. You can edit the template, add new leads, or import a CSV. Adding leads will automatically shift the campaign status to <strong>Paused</strong> so you can click <strong>Start Campaign</strong> to send to the new recipients.</>
                )}
                {campaign.status === 'running' && (
                  <>This campaign is currently <strong>Running</strong>. To make edits to your template or manage leads, please pause the campaign first.</>
                )}
                {campaign.status === 'failed' && (
                  <>This campaign is in <strong>Failed</strong> status. To fix SMTP connection issues and retry, reset the campaign status from the kebab menu (<code>⋯</code>).</>
                )}
              </span>
            </div>
          )}

          <div className="campaign-workspace" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch', marginBottom: '32px' }}>

          {/* Left Column: Edit Template */}
          <div className="card" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h2 className="section-title" style={{ marginBottom: '20px' }}>Email Template</h2>
            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
              <div className="form-group">
                <label className="form-label">Campaign Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={campName}
                  onChange={e => setCampName(e.target.value)}
                  disabled={!isEditable || submittingTemplate}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subject Line</label>
                <input
                  type="text"
                  className="form-control"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  disabled={!isEditable || submittingTemplate}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label">Body Template</label>
                <RichEditor
                  value={body}
                  onChange={setBody}
                  disabled={!isEditable || submittingTemplate}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', display: 'block', marginTop: '6px', lineHeight: '1.45' }}>
                  <strong>Personalize your email using contact details</strong> like <code>{"{{first_name}}"}</code>, <code>{"{{company}}"}</code>, or <code>{"{{role}}"}</code>. The app will automatically swap these with each contact's real data when sending. (You can also use any column header name from your spreadsheet).
                </span>
                {unrecognizedPlaceholders.length > 0 && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', fontSize: '0.78rem', color: '#b45309', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontWeight: 700 }}>Unmatched personalization fields:</span>
                    <span>
                      Your email template uses <strong>{unrecognizedPlaceholders.map(u => `{{${u}}}`).join(', ')}</strong>, which doesn't match any columns in your contacts list. Please check your spelling or verify your spreadsheet columns match these exactly.
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={!isEditable || submittingTemplate || isSaveQuotaReached}
                style={{ alignSelf: 'flex-start', opacity: isSaveQuotaReached ? 0.6 : 1, cursor: isSaveQuotaReached ? 'not-allowed' : 'pointer' }}
              >
                {submittingTemplate ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Right Column: Contact List Management */}
          <div className="contacts-section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>

            {/* Add Recipient Card */}
            <div className="card" style={{ padding: '24px' }}>
              <h2 className="section-title" style={{ marginBottom: '16px' }}>Add Lead</h2>
              <form onSubmit={handleAddContact} className="inline-form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="name@company.com"
                    value={inlineEmail}
                    onChange={e => setInlineEmail(e.target.value)}
                    disabled={!isEditable || submittingContact}
                    required
                    style={{ height: '40px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Company Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Acme Corp"
                    value={inlineCompany}
                    onChange={e => setInlineCompany(e.target.value)}
                    disabled={!isEditable || submittingContact}
                    style={{ height: '40px' }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: '40px' }}
                  disabled={!isEditable || submittingContact}
                >
                  {submittingContact ? 'Adding...' : 'Add'}
                </button>
              </form>
            </div>

            {/* Upload CSV Card */}
            <div className="card" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h2 className="section-title" style={{ marginBottom: '12px' }}>Import Contacts</h2>
              <form onSubmit={handleUploadCsv} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  className={`drop-zone${isDragActive ? ' dragged' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => { if (isEditable && !submittingCsv) document.getElementById('csv-file-input').click(); }}
                  style={{ opacity: isEditable ? 1 : 0.6, cursor: isEditable ? 'pointer' : 'not-allowed' }}
                >
                  <input
                    type="file"
                    id="csv-file-input"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={e => setCsvFile(e.target.files[0])}
                    disabled={!isEditable || submittingCsv}
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', marginBottom: '4px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  {csvFile ? (
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.9rem' }}>{csvFile.name}</div>
                      <div style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem', marginTop: '2px' }}>{(csvFile.size / 1024).toFixed(1)} KB — Click or drag to replace</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.9rem' }}>Drag & drop your contacts spreadsheet here</div>
                      <div style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem', marginTop: '2px' }}>or click to browse (.csv format)</div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '4px', display: 'block' }}>How to import</label>
                  <div className="radio-group" style={{ display: 'flex', gap: '20px', margin: '8px 0' }}>
                    <label className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="csvMode"
                        value="append"
                        checked={csvMode === 'append'}
                        onChange={() => setCsvMode('append')}
                        disabled={!isEditable || submittingCsv}
                        style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                      />
                      Add to my current contacts
                    </label>
                    <label className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="csvMode"
                        value="replace"
                        checked={csvMode === 'replace'}
                        onChange={() => setCsvMode('replace')}
                        disabled={!isEditable || submittingCsv}
                        style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                      />
                      Start fresh (replaces existing contacts)
                    </label>
                  </div>
                </div>

                <div className="quick-actions-bar">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!isEditable || submittingCsv || !csvFile}
                  >
                    {submittingCsv ? 'Importing...' : 'Upload Contacts'}
                  </button>
                  <button
                    type="button"
                    className="sample-csv-link"
                    onClick={handleDownloadSampleCsv}
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    Download Example Spreadsheet
                  </button>
                </div>
                <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', display: 'block', lineHeight: '1.45' }}>
                    <strong>How columns in your spreadsheet are matched:</strong>
                    <br />
                    The app matches columns named <code>email</code> or <code>mail</code> to the recipient's email address. It also automatically recognizes columns like <code>company</code>, <code>first_name</code>, and <code>role</code>. Any additional columns you upload can be used as custom templates (for example, <code>{"{{website}}"}</code>).
                  </span>
                </div>
              </form>
            </div>

          </div>
        </div>
      </>
      )}

      {/* Leads log card */}
      {activeSection === 'outreach' && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: '32px' }}>
          <div className="tabs-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '14px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={`tab-btn${activeTab === 'all' ? ' active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Contacts <span className="tab-badge">{recipients.length}</span>
              </button>
              <button
                type="button"
                className={`tab-btn${activeTab === 'failed' ? ' active' : ''}`}
                onClick={() => setActiveTab('failed')}
              >
                Delivery Failures <span className="tab-badge">{recipients.filter(r => r.status === 'failed').length}</span>
              </button>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}
                onClick={handleSyncBounces}
                disabled={submittingSync}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: submittingSync ? 'spin 1.5s linear infinite' : 'none' }}>
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
                {submittingSync ? 'Checking...' : 'Check for Delivery Failures'}
              </button>
              <div
                className="tooltip-container"
                style={{ position: 'relative', display: 'inline-block', cursor: 'pointer', height: '16px' }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted-foreground)' }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                {showTooltip && (
                  <span className="tooltip-text" style={{
                    width: '240px',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--foreground)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    position: 'absolute',
                    zIndex: 100,
                    bottom: '125%',
                    left: '50%',
                    marginLeft: '-120px',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '0.74rem',
                    lineHeight: '1.3',
                    pointerEvents: 'none',
                    textAlign: 'center'
                  }}>
                    Checks your sender mailbox for emails that were returned or couldn't be delivered, and marks those contacts as failed.
                  </span>
                )}
              </div>
            </div>
          </div>

          {activeTab === 'all' ? (
            <>
              <div className="flex-between" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h2 className="section-title">Contacts & Send Results</h2>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={handleDownloadCsv}
                  disabled={recipients.length === 0}
                >
                  Download Contacts List
                </button>
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
                      {isEditable && <th style={{ width: '60px', textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.length === 0 ? (
                      <tr>
                        <td colSpan={isEditable ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted-foreground)' }}>
                          No recipients loaded.
                        </td>
                      </tr>
                    ) : paginatedRecipients.map((r) => (
                      <tr key={r.id} className={`outreach-log-row status-${r.status}`} style={r.status === 'failed' ? { background: 'rgba(244, 63, 94, 0.04)' } : {}}>
                        <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {r.status === 'failed' && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--error)', flexShrink: 0 }}>
                              <polyline points="9 17 4 12 9 7"></polyline>
                              <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                            </svg>
                          )}
                          <span style={r.status === 'failed' ? { color: 'var(--error)' } : {}}>{r.email}</span>
                        </td>
                        <td style={{ color: 'var(--muted-foreground)' }}>{r.company || '—'}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>
                          {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: r.status === 'failed' ? 'var(--error)' : 'var(--muted-foreground)' }}>
                          {getFriendlyErrorMessage(r.error_message)}
                        </td>
                        {isEditable && (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteRecipient(r.id);
                              }}
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
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {recipients.length > pageSize && (
                <div className="flex-between" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                    Showing {startIndex + 1} to {Math.min(startIndex + pageSize, recipients.length)} of {recipients.length} contacts
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                      Previous
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <FailedContactsTab
              campaignId={id}
              recipients={recipients}
              onRefresh={fetchData}
              isEditable={isEditable}
              setActiveTab={setActiveTab}
            />
          )}
        </div>
      )}
      {/* Confirmation Reset Status Modal */}
      {confirmResetOpen && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Retry Campaign from Scratch</h3>
              <button className="modal-close" onClick={() => setConfirmResetOpen(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '30px 24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(217, 119, 6, 0.08)',
                color: 'var(--warning)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
              </div>
              <p style={{ marginBottom: '14px', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Restart campaign from the beginning?
              </p>
              <p style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                This will clear your delivery history and let you start sending emails to all contacts in this list again from the very beginning.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmResetOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => {
                  handleAction('reset');
                  setConfirmResetOpen(false);
                }}>
                  Restart Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Delete Campaign Modal */}
      {confirmDeleteOpen && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Campaign</h3>
              <button className="modal-close" onClick={() => setConfirmDeleteOpen(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '30px 24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(220, 38, 38, 0.08)',
                color: 'var(--error)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </div>
              <p style={{ marginBottom: '14px', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Delete Campaign "{campaign?.name}"?
              </p>
              <p style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                This will permanently erase all contacts, templates, SMTP setups, and analytical results associated with this campaign. <strong>This action is irreversible.</strong>
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDeleteOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={() => {
                  setConfirmDeleteOpen(false);
                  (async () => {
                    try {
                      await api.delete(`/api/campaigns/${id}`);
                      await refreshUser();
                      navigate('/');
                    } catch (err) {
                      setMessage({ text: getFriendlyError(err, "Something went wrong. Please try again."), type: 'error' });
                    }
                  })();
                }}>
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
