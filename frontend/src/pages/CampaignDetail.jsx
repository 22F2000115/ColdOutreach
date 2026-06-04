import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../App';
import RichEditor from '../components/RichEditor';

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
  const [message,     setMessage]     = useState({ text: '', type: '' });

  // Template editing states
  const [campName,    setCampName]    = useState('');
  const [subject,     setSubject]     = useState('');
  const [body,        setBody]        = useState('');
  const [savingTemp,  setSavingTemp]  = useState(false);

  // Inline recipient states
  const [inlineEmail,   setInlineEmail]   = useState('');
  const [inlineCompany, setInlineCompany] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  // CSV upload states
  const [csvFile,      setCsvFile]      = useState(null);
  const [csvMode,      setCsvMode]      = useState('append'); // 'append' or 'replace'
  const [uploadingCsv, setUploadingCsv] = useState(false);

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

  const fetchData = async () => {
    try {
      const [campRes, recRes] = await Promise.all([
        api.get(`/api/campaigns/${id}`),
        api.get(`/api/campaigns/${id}/recipients`),
      ]);
      setCampaign(campRes.data);
      setRecipients(recRes.data);
    } catch (err) {
      setMessage({ text: 'Campaign not found or access denied.', type: 'error' });
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

  useEffect(() => {
    if (campaign) {
      setCampName(campaign.name);
      setSubject(campaign.subject_template || '');
      setBody(campaign.body_template || '');
    }
  }, [campaign]);

  const handleAction = async (action) => {
    setActionLoad(true);
    setMessage({ text: '', type: '' });
    try {
      const fd = new FormData();
      fd.append('action', action);
      const res = await api.post(`/api/campaigns/${id}/action`, fd);
      setCampaign(prev => ({ ...prev, status: res.data.status }));
      fetchData();
      setMessage({ text: `Campaign status updated to ${res.data.status}`, type: 'success' });
    } catch (err) {
      setMessage({ text: getErrorMessage(err, `Failed to execute action: ${action}`), type: 'error' });
    } finally {
      setActionLoad(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      navigate('/');
    } catch (err) {
      setMessage({ text: 'Failed to delete campaign.', type: 'error' });
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!campName.trim() || !subject.trim()) {
      setMessage({ text: 'Campaign name and subject template are required.', type: 'error' });
      return;
    }
    setSavingTemp(true);
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
      setMessage({ text: 'Template saved successfully', type: 'success' });
      fetchData();
    } catch (err) {
      setMessage({ text: getErrorMessage(err, 'Failed to save template'), type: 'error' });
    } finally {
      setSavingTemp(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!inlineEmail.trim()) {
      setMessage({ text: 'Email address is required.', type: 'error' });
      return;
    }
    setAddingContact(true);
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
      setMessage({ text: getErrorMessage(err, 'Failed to add recipient'), type: 'error' });
    } finally {
      setAddingContact(false);
    }
  };

  const handleUploadCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      setMessage({ text: 'Please select a CSV file first.', type: 'error' });
      return;
    }
    setUploadingCsv(true);
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
      setMessage({ text: getErrorMessage(err, 'Failed to upload CSV file'), type: 'error' });
    } finally {
      setUploadingCsv(false);
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
      setMessage({ text: 'Failed to download recipients CSV', type: 'error' });
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
      setMessage({ text: 'Failed to download sample CSV template', type: 'error' });
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
      setMessage({ text: getErrorMessage(err, 'Failed to remove recipient'), type: 'error' });
    }
  };

  if (loading) return <p style={{ color: 'var(--muted-foreground)' }}>Loading campaign...</p>;
  if (message.type === 'error' && !campaign) return <div className="alert alert-error">{message.text}</div>;

  const pct = campaign.stats.total > 0 ? Math.round((campaign.stats.sent / campaign.stats.total) * 100) : 0;
  const isEditable = campaign.status === 'draft' || campaign.status === 'paused';

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
              Start Campaign
            </button>
          )}
          {campaign.status === 'running' && (
            <button className="btn btn-secondary" onClick={() => handleAction('pause')} disabled={actionLoad}>
              Pause
            </button>
          )}
          {campaign.status !== 'running' && (
            <button className="btn btn-secondary" onClick={() => handleAction('reset')} disabled={actionLoad}>
              Reset Status
            </button>
          )}
          <button
            className="btn btn-secondary"
            style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,0.25)' }}
            onClick={handleDeleteCampaign}
            disabled={actionLoad || campaign.status === 'running'}
          >
            Delete
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '24px' }}>
          {message.type === 'success' ? '✓' : '!'} {message.text}
        </div>
      )}

      {/* Top dashboard info row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: '8px' }}>Campaign Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <StatusBadge status={campaign.status} />
            <span style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)' }}>
              {pct}% Completed ({campaign.stats.sent} of {campaign.stats.total} emails sent)
            </span>
          </div>
          <div style={{ marginTop: '16px' }}>
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

      {/* Main Campaign workspace */}
      <div className="campaign-workspace">
        
        {/* Left Column: Edit Template */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 className="section-title" style={{ marginBottom: '20px' }}>Email Template</h2>
          <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Campaign Name</label>
              <input
                type="text"
                className="form-control"
                value={campName}
                onChange={e => setCampName(e.target.value)}
                disabled={!isEditable || savingTemp}
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
                disabled={!isEditable || savingTemp}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label className="form-label">Body Template</label>
              <RichEditor
                value={body}
                onChange={setBody}
                disabled={!isEditable || savingTemp}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', display: 'block', marginTop: '6px' }}>
                Use {"{company}"} to insert the company name dynamically.
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isEditable || savingTemp}
              style={{ alignSelf: 'flex-start' }}
            >
              {savingTemp ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Right Column: Contact List Management */}
        <div className="contacts-section-card">
          
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
                  disabled={!isEditable || addingContact}
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
                  disabled={!isEditable || addingContact}
                  style={{ height: '40px' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: '40px' }}
                disabled={!isEditable || addingContact}
              >
                {addingContact ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>

          {/* Upload CSV Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 className="section-title" style={{ marginBottom: '12px' }}>Import Contacts</h2>
            <form onSubmit={handleUploadCsv} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="upload-csv-box">
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv"
                  onChange={e => setCsvFile(e.target.files[0])}
                  disabled={!isEditable || uploadingCsv}
                  required
                />
              </div>
              
              <div>
                <label className="form-label" style={{ marginBottom: '4px', display: 'block' }}>Import Mode</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="csvMode"
                      value="append"
                      checked={csvMode === 'append'}
                      onChange={() => setCsvMode('append')}
                      disabled={!isEditable || uploadingCsv}
                    />
                    Append to existing
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="csvMode"
                      value="replace"
                      checked={csvMode === 'replace'}
                      onChange={() => setCsvMode('replace')}
                      disabled={!isEditable || uploadingCsv}
                    />
                    Replace list
                  </label>
                </div>
              </div>

              <div className="quick-actions-bar">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!isEditable || uploadingCsv || !csvFile}
                >
                  {uploadingCsv ? 'Importing...' : 'Import CSV'}
                </button>
                <button
                  type="button"
                  className="sample-csv-link"
                  onClick={handleDownloadSampleCsv}
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  Download Sample CSV Template
                </button>
              </div>
            </form>
          </div>

        </div>

      </div>

      {/* Leads log card */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '32px' }}>
        <div className="flex-between" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="section-title">Outreach Log</h2>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            onClick={handleDownloadCsv}
            disabled={recipients.length === 0}
          >
            Download CSV
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
                  {isEditable && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-trash"
                        title="Remove contact"
                        onClick={() => handleDeleteRecipient(r.id)}
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
