import { useState } from 'react';
import { api } from '../App';

export default function FailedContactsTab({ campaignId, recipients, onRefresh, isEditable, setActiveTab }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [errorFilter, setErrorFilter] = useState('All Errors');
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // CSV Upload States
  const [csvFile, setCsvFile] = useState(null);
  const [csvMode, setCsvMode] = useState('append'); // 'append' or 'replace'
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [actionLoad, setActionLoad] = useState(false);

  // Filter only failed contacts
  const failedContacts = recipients.filter(r => r.status === 'failed');

  // Error parser
  const getErrorGroup = (errorMsg) => {
    if (!errorMsg) return 'Unknown Error';
    const match = errorMsg.match(/^(\d{3})\b/);
    if (match) return `SMTP ${match[1]}`;
    if (errorMsg.toLowerCase().includes('timeout')) return 'Timeout';
    if (errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('credential')) return 'Auth Error';
    if (errorMsg.toLowerCase().includes('connection') || errorMsg.toLowerCase().includes('connect')) return 'Connection Error';
    return 'Other';
  };

  // Group counts for dropdown list
  const groupCounts = { 'All Errors': failedContacts.length };
  failedContacts.forEach(c => {
    const group = getErrorGroup(c.error_message);
    groupCounts[group] = (groupCounts[group] || 0) + 1;
  });

  const uniqueGroups = Object.keys(groupCounts).filter(g => g !== 'All Errors');

  // Filtered contacts based on dropdown selection
  const filteredContacts = failedContacts.filter(c => {
    if (errorFilter === 'All Errors') return true;
    return getErrorGroup(c.error_message) === errorFilter;
  });

  // Selection Logic
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allFilteredIds = filteredContacts.map(c => c.id);
      setSelectedIds(new Set(allFilteredIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id, checked) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  // Delete Individual
  const handleDeleteRecipient = async (recipientId) => {
    if (!confirm('Remove this failed contact from the campaign?')) return;
    setMessage({ text: '', type: '' });
    setActionLoad(true);
    try {
      await api.delete(`/api/campaigns/${campaignId}/recipients/${recipientId}`);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(recipientId);
        return next;
      });
      setMessage({ text: 'Recipient removed.', type: 'success' });
      onRefresh();
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to remove recipient', type: 'error' });
    } finally {
      setActionLoad(false);
    }
  };

  // Delete Selected (Bulk)
  const handleDeleteSelected = async () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${idsToDelete.length} selected failed contacts?`)) return;

    setMessage({ text: '', type: '' });
    setActionLoad(true);
    try {
      await api.delete(`/api/campaigns/${campaignId}/recipients/bulk`, {
        data: { ids: idsToDelete }
      });
      setSelectedIds(new Set());
      setMessage({ text: `Successfully deleted ${idsToDelete.length} contacts.`, type: 'success' });
      onRefresh();
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to delete selected recipients', type: 'error' });
    } finally {
      setActionLoad(false);
    }
  };

  // Download Failed CSV
  const handleDownloadFailedCsv = async () => {
    setMessage({ text: '', type: '' });
    try {
      const res = await api.get(`/api/campaigns/${campaignId}/recipients/csv?status=failed`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign_${campaignId}_failed_contacts.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setMessage({ text: 'Failed to download failed recipients CSV', type: 'error' });
    }
  };

  // Drag and Drop Logic
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

  // Re-upload Corrected CSV
  const handleUploadCorrectedCsv = async (e) => {
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
      const res = await api.post(`/api/campaigns/${campaignId}/recipients/csv`, fd);
      setCsvFile(null);
      const fileInput = document.getElementById('corrected-csv-file-input');
      if (fileInput) fileInput.value = '';
      setMessage({ text: res.data.message || 'CSV file uploaded successfully', type: 'success' });
      onRefresh();
      // Switch back to "All Contacts" tab after successful re-upload
      setActiveTab('all');
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to upload CSV file', type: 'error' });
    } finally {
      setUploadingCsv(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {message.text && (
        <div 
          className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`} 
          style={{ margin: '14px 22px 0 22px' }}
        >
          {message.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '4px' }}><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filter and Download Header */}
      <div className="error-filter-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Filter by Error:
          </label>
          <select 
            className="error-filter-select"
            value={errorFilter}
            onChange={(e) => {
              setErrorFilter(e.target.value);
              setSelectedIds(new Set()); // Reset selections when filter changes
            }}
          >
            <option value="All Errors">All Errors ({groupCounts['All Errors']})</option>
            {uniqueGroups.map(g => (
              <option key={g} value={g}>{g} ({groupCounts[g]})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button"
            className="btn btn-secondary" 
            style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={handleDownloadFailedCsv}
            disabled={failedContacts.length === 0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Failed CSV
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-action-text">
            {selectedIds.size} contact{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <button 
            type="button"
            className="btn btn-secondary"
            style={{ 
              fontSize: '0.8rem', 
              padding: '6px 12px', 
              color: 'var(--error)', 
              borderColor: 'rgba(220,38,38,0.25)', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              backgroundColor: 'var(--card)'
            }}
            onClick={handleDeleteSelected}
            disabled={actionLoad}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete Selected
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  className="table-checkbox"
                  checked={filteredContacts.length > 0 && selectedIds.size === filteredContacts.length}
                  onChange={handleSelectAll}
                  disabled={filteredContacts.length === 0}
                />
              </th>
              <th>Recipient</th>
              <th>Error Message</th>
              <th>Sent At</th>
              {isEditable && <th style={{ width: '60px', textAlign: 'center' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={isEditable ? 5 : 4} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted-foreground)' }}>
                  No failed recipients match this filter.
                </td>
              </tr>
            ) : filteredContacts.map((r) => (
              <tr key={r.id} className="outreach-log-row status-failed">
                <td style={{ textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    className="table-checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={(e) => handleSelectOne(r.id, e.target.checked)}
                  />
                </td>
                <td style={{ fontWeight: 600 }}>{r.email}</td>
                <td style={{ color: 'var(--error)', fontSize: '0.82rem', fontWeight: 500 }}>
                  {r.error_message || '—'}
                </td>
                <td style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>
                  {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                </td>
                {isEditable && (
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-trash"
                      title="Remove contact"
                      onClick={() => handleDeleteRecipient(r.id)}
                      disabled={actionLoad}
                      style={{ background: 'transparent', border: 'none', color: 'var(--error)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--error-glow)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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

      {/* Re-upload Corrected CSV Panel */}
      {isEditable && (
        <div style={{ padding: '24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <h3 className="section-title" style={{ marginBottom: '12px', fontSize: '1rem' }}>
            Re-upload Corrected CSV
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
            Fix any failed contacts in your spreadsheet and upload it here. Make sure the headers match your original import.
          </p>
          <form onSubmit={handleUploadCorrectedCsv} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div 
              className={`drop-zone${isDragActive ? ' dragged' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => { if (!uploadingCsv) document.getElementById('corrected-csv-file-input').click(); }}
              style={{ cursor: 'pointer', background: 'var(--card)' }}
            >
              <input
                type="file"
                id="corrected-csv-file-input"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => setCsvFile(e.target.files[0])}
                disabled={uploadingCsv}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', marginBottom: '4px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              {csvFile ? (
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.9rem' }}>{csvFile.name}</div>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem', marginTop: '2px' }}>
                    {(csvFile.size / 1024).toFixed(1)} KB — Click or drag to replace
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.9rem' }}>Drag & drop your corrected CSV here</div>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem', marginTop: '2px' }}>or click to browse from device</div>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '4px', display: 'block' }}>Import Mode</label>
                <div className="radio-group" style={{ margin: 0 }}>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="correctedCsvMode"
                      value="append"
                      checked={csvMode === 'append'}
                      onChange={() => setCsvMode('append')}
                      disabled={uploadingCsv}
                    />
                    Append (keeps existing log, adds corrected ones)
                  </label>
                  <label className="radio-option" style={{ marginLeft: '16px' }}>
                    <input
                      type="radio"
                      name="correctedCsvMode"
                      value="replace"
                      checked={csvMode === 'replace'}
                      onChange={() => setCsvMode('replace')}
                      disabled={uploadingCsv}
                    />
                    Replace (wipes all existing contacts/log and replaces list)
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploadingCsv || !csvFile}
                style={{ alignSelf: 'flex-end', height: '40px' }}
              >
                {uploadingCsv ? 'Importing...' : 'Upload Corrected CSV'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
