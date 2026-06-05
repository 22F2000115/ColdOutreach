import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../App';

function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMs < 0) return 'Just now';
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } catch (e) {
    return 'N/A';
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  // Contact details state
  const [contacts, setContacts] = useState([]);
  const [contactType, setContactType] = useState('email');
  const [contactValue, setContactValue] = useState('');
  const [contactLabel, setContactLabel] = useState('');
  const [editingContactId, setEditingContactId] = useState(null);
  const [savingContact, setSavingContact] = useState(false);
  const [confirmContactDeleteId, setConfirmContactDeleteId] = useState(null);
  const [pendingUserUpdate, setPendingUserUpdate] = useState(null);

  // Settings form state
  const [trialMaxSmtp, setTrialMaxSmtp] = useState(1);
  const [trialMaxCampaigns, setTrialMaxCampaigns] = useState(3);
  const [proMaxSmtp, setProMaxSmtp] = useState(3);
  const [proMaxCampaigns, setProMaxCampaigns] = useState(999999);

  const [trialQuotaAdd, setTrialQuotaAdd] = useState(3);
  const [trialQuotaEdit, setTrialQuotaEdit] = useState(5);
  const [trialQuotaDelete, setTrialQuotaDelete] = useState(3);
  const [trialQuotaSave, setTrialQuotaSave] = useState(5);

  const [proQuotaAdd, setProQuotaAdd] = useState(999999);
  const [proQuotaEdit, setProQuotaEdit] = useState(999999);
  const [proQuotaDelete, setProQuotaDelete] = useState(999999);
  const [proQuotaSave, setProQuotaSave] = useState(999999);

  // Modal confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/admin/stats');
      setStats(res.data);
      if (res.data.plan_limits) {
        setTrialMaxSmtp(res.data.plan_limits.trial?.max_smtp_accounts ?? 1);
        setTrialMaxCampaigns(res.data.plan_limits.trial?.max_campaigns ?? 3);
        setProMaxSmtp(res.data.plan_limits.pro?.max_smtp_accounts ?? 3);
        setProMaxCampaigns(res.data.plan_limits.pro?.max_campaigns ?? 999999);
      }
      if (res.data.plan_quotas) {
        setTrialQuotaAdd(res.data.plan_quotas.trial?.add_limit ?? 3);
        setTrialQuotaEdit(res.data.plan_quotas.trial?.edit_limit ?? 5);
        setTrialQuotaDelete(res.data.plan_quotas.trial?.delete_limit ?? 3);
        setTrialQuotaSave(res.data.plan_quotas.trial?.save_limit ?? 5);

        setProQuotaAdd(res.data.plan_quotas.pro?.add_limit ?? 999999);
        setProQuotaEdit(res.data.plan_quotas.pro?.edit_limit ?? 999999);
        setProQuotaDelete(res.data.plan_quotas.pro?.delete_limit ?? 999999);
        setProQuotaSave(res.data.plan_quotas.pro?.save_limit ?? 999999);
      }
    } catch (e) {
      console.error(e);
      setMessage({ text: 'Failed to fetch stats', type: 'error' });
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data || []);
    } catch (e) {
      console.error(e);
      setMessage({ text: 'Failed to fetch users', type: 'error' });
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/api/admin/campaigns');
      setCampaigns(res.data || []);
    } catch (e) {
      console.error(e);
      setMessage({ text: 'Failed to fetch campaigns', type: 'error' });
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get('/api/contact-details');
      setContacts(res.data || []);
    } catch (e) {
      console.error(e);
      setMessage({ text: 'Failed to fetch contact details', type: 'error' });
    }
  };

  const loadData = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });
    await Promise.all([fetchStats(), fetchUsers(), fetchCampaigns(), fetchContacts()]);
    setLoading(false);
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setSavingContact(true);
    setMessage({ text: '', type: '' });
    try {
      const payload = {
        type: contactType,
        value: contactValue,
        label: contactLabel.trim() || null
      };

      if (editingContactId) {
        const res = await api.put(`/api/admin/contact-details/${editingContactId}`, payload);
        setContacts(prev => prev.map(c => c.id === editingContactId ? res.data : c));
        setMessage({ text: 'Contact detail updated successfully', type: 'success' });
      } else {
        const res = await api.post('/api/admin/contact-details', payload);
        setContacts(prev => [...prev, res.data]);
        setMessage({ text: 'Contact detail added successfully', type: 'success' });
      }
      resetContactForm();
    } catch (err) {
      const errDetail = err.response?.data?.detail || 'Failed to save contact';
      setMessage({ text: typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail), type: 'error' });
    } finally {
      setSavingContact(false);
    }
  };

  const handleEditContact = (c) => {
    setEditingContactId(c.id);
    setContactType(c.type);
    setContactValue(c.value);
    setContactLabel(c.label || '');
  };

  const handleDeleteContact = async (id) => {
    try {
      await api.delete(`/api/admin/contact-details/${id}`);
      setContacts(prev => prev.filter(c => c.id !== id));
      setMessage({ text: 'Contact detail deleted successfully', type: 'success' });
      setConfirmContactDeleteId(null);
    } catch (err) {
      const errDetail = err.response?.data?.detail || 'Failed to delete contact';
      setMessage({ text: typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail), type: 'error' });
      setConfirmContactDeleteId(null);
    }
  };

  const resetContactForm = () => {
    setEditingContactId(null);
    setContactType('email');
    setContactValue('');
    setContactLabel('');
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateUser = async (userId, fields) => {
    try {
      const res = await api.patch(`/api/admin/users/${userId}`, fields);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...res.data } : u));
      setMessage({ text: 'User updated successfully', type: 'success' });
      fetchStats(); // Update counts
    } catch (e) {
      const errDetail = e.response?.data?.detail || 'Failed to update user';
      setMessage({ text: typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail), type: 'error' });
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setMessage({ text: 'User deleted successfully', type: 'success' });
      setConfirmDeleteId(null);
      fetchStats(); // Update counts
    } catch (e) {
      const errDetail = e.response?.data?.detail || 'Failed to delete user';
      setMessage({ text: typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail), type: 'error' });
      setConfirmDeleteId(null);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setMessage({ text: '', type: '' });
    try {
      const payload = {
        trial: {
          max_smtp_accounts: parseInt(trialMaxSmtp),
          max_campaigns: parseInt(trialMaxCampaigns)
        },
        pro: {
          max_smtp_accounts: parseInt(proMaxSmtp),
          max_campaigns: parseInt(proMaxCampaigns)
        },
        trial_quotas: {
          add: parseInt(trialQuotaAdd),
          edit: parseInt(trialQuotaEdit),
          delete: parseInt(trialQuotaDelete),
          save: parseInt(trialQuotaSave)
        },
        pro_quotas: {
          add: parseInt(proQuotaAdd),
          edit: parseInt(proQuotaEdit),
          delete: parseInt(proQuotaDelete),
          save: parseInt(proQuotaSave)
        }
      };
      await api.patch('/api/admin/settings', payload);
      setMessage({ text: 'Global plan limits updated successfully', type: 'success' });
      fetchStats();
    } catch (e) {
      const errDetail = e.response?.data?.detail || 'Failed to save settings';
      setMessage({ text: typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail), type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userQuery.toLowerCase())
  );

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(campaignQuery.toLowerCase()) ||
    c.owner_email.toLowerCase().includes(campaignQuery.toLowerCase())
  );

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--muted-foreground)' }}>
        Loading Admin Dashboard…
      </div>
    );
  }

  const targetDeleteUser = users.find(u => u.id === confirmDeleteId);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', borderTop: '4px solid var(--accent-primary)', marginTop: '-36px', paddingTop: '32px' }}>
      {/* Header */}
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Admin Dashboard</h1>
            <span className="badge badge-error" style={{ background: 'var(--error)', color: '#ffffff', fontSize: '0.65rem', padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.05em', fontWeight: 800 }}>Admin Mode</span>
          </div>
          <p className="page-subtitle">Manage system users, campaigns, global limits, and app health.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading} style={{ height: '40px' }}>
          {loading ? 'Syncing...' : 'Sync Data'}
        </button>
      </div>

      {/* Message Banner */}
      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '24px', display: 'flex', alignItems: 'center' }}>
          {message.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          )}
          <span>{message.text}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold', fontSize: '1.1rem', padding: '0 4px' }} onClick={() => setMessage({ text: '', type: '' })}>
            &times;
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tab-bar">
        {[
          {
            id: 'stats',
            label: 'Stats Overview',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            )
          },
          {
            id: 'users',
            label: 'Users Management',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            )
          },
          {
            id: 'campaigns',
            label: 'Campaigns Log',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            )
          },
          {
            id: 'settings',
            label: 'App Limits',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            )
          },
          {
            id: 'contact',
            label: 'Contact Details',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            )
          }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Stats */}
      {activeTab === 'stats' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div className="metric-card admin-stat-card accent-blue">
              <div className="metric-label">Total Users</div>
              <div className="metric-value">{stats.total_users}</div>
            </div>
            <div className="metric-card admin-stat-card accent-indigo">
              <div className="metric-label">Pro Plan Users</div>
              <div className="metric-value">{stats.pro_users}</div>
            </div>
            <div className="metric-card admin-stat-card accent-green">
              <div className="metric-label">Running Campaigns</div>
              <div className="metric-value">{stats.active_campaigns}</div>
            </div>
            <div className="metric-card admin-stat-card accent-orange">
              <div className="metric-label">Emails Sent Today</div>
              <div className="metric-value">{stats.emails_sent_today}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px 28px' }}>
            <h3 className="section-title" style={{ marginBottom: '18px', fontSize: '1.05rem' }}>System Configuration & Status</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
              <div>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '14px', color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}>CURRENT PLAN LIMITS</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>Trial Limit (SMTPs)</span>
                    <span style={{ fontWeight: '700' }}>{stats.plan_limits?.trial?.max_smtp_accounts}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>Trial Limit (Campaigns)</span>
                    <span style={{ fontWeight: '700' }}>{stats.plan_limits?.trial?.max_campaigns}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>Pro Limit (SMTPs)</span>
                    <span style={{ fontWeight: '700' }}>{stats.plan_limits?.pro?.max_smtp_accounts}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>Pro Limit (Campaigns)</span>
                    <span style={{ fontWeight: '700' }}>{stats.plan_limits?.pro?.max_campaigns === 999999 ? 'Unlimited' : stats.plan_limits?.pro?.max_campaigns}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '14px', color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}>APP METRICS & RUNTIME</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>Total Emails Sent</span>
                    <span style={{ fontWeight: '700' }}>{stats.total_emails_sent}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>Logged In Admin</span>
                    <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{currentUser?.email}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>Active Connection</span>
                    <span className="badge badge-success" style={{ fontWeight: 800 }}>Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Search bar toolbar */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
              <input
                type="text"
                placeholder="Search users by email..."
                className="form-control"
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                style={{ margin: 0, paddingLeft: '36px' }}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <span className="badge badge-running" style={{ fontSize: '0.82rem', fontWeight: 600, background: 'var(--surface-hover)', borderColor: 'var(--border-subtle)', color: 'var(--foreground)', height: '40px', display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 'var(--radius-sm)' }}>
              {filteredUsers.length} of {users.length} Users
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>User</th>
                  <th>Email</th>
                  <th>Plan Tier</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Campaigns</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--muted-foreground)' }}>
                      No users match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const isSelf = u.id === currentUser?.id;
                    const initials = u.email
                      ? u.email.split('@')[0].substring(0, 2).toUpperCase()
                      : 'US';
                    return (
                      <tr key={u.id}>
                        <td>
                          {/* Avatar Circle */}
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isSelf ? 'var(--primary)' : 'var(--muted)',
                            color: isSelf ? 'var(--primary-foreground)' : 'var(--foreground)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{u.email}</span>
                            {isSelf && (
                              <span className="badge badge-running" style={{ textTransform: 'none', fontSize: '0.62rem', padding: '1px 6px' }}>You</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {isSelf ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="badge badge-success">{u.plan}</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }} title="You cannot edit your own role or plan."><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                          ) : (
                            <select
                              value={u.plan}
                              onChange={e => setPendingUserUpdate({ userId: u.id, email: u.email, field: 'plan', value: e.target.value, payload: { plan: e.target.value } })}
                              className="form-control"
                              style={{ width: '90px', minHeight: '30px', height: '30px', padding: '2px 8px', fontSize: '0.82rem' }}
                            >
                              <option value="trial">Trial</option>
                              <option value="pro">Pro</option>
                            </select>
                          )}
                        </td>
                        <td>
                          {isSelf ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="badge badge-running">{u.role}</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }} title="You cannot edit your own role or plan."><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                          ) : (
                            <select
                              value={u.role}
                              onChange={e => setPendingUserUpdate({ userId: u.id, email: u.email, field: 'role', value: e.target.value, payload: { role: e.target.value } })}
                              className="form-control"
                              style={{ width: '90px', minHeight: '30px', height: '30px', padding: '2px 8px', fontSize: '0.82rem' }}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </td>
                        <td>
                          {u.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-error">Suspended</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{u.campaign_count}</td>
                        <td style={{ textAlign: 'right' }}>
                          {isSelf ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>—</span>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
                              <button
                                className="btn btn-secondary"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPendingUserUpdate({
                                    userId: u.id,
                                    email: u.email,
                                    field: 'status',
                                    value: u.is_active ? 'Suspended' : 'Active',
                                    payload: { is_active: !u.is_active }
                                  });
                                }}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '0.78rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  borderColor: 'transparent',
                                  background: 'transparent',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--surface-hover)';
                                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.borderColor = 'transparent';
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <line x1="12" y1="8" x2="12" y2="16"></line>
                                  <line x1="8" y1="12" x2="16" y2="12"></line>
                                </svg>
                                {u.is_active ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmDeleteId(u.id);
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
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Search bar toolbar */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
              <input
                type="text"
                placeholder="Filter by campaign name or owner..."
                className="form-control"
                value={campaignQuery}
                onChange={e => setCampaignQuery(e.target.value)}
                style={{ margin: 0, paddingLeft: '36px' }}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <span className="badge badge-running" style={{ background: 'var(--surface-hover)', borderColor: 'var(--border-subtle)', color: 'var(--foreground)' }}>
              {filteredCampaigns.length} of {campaigns.length} Campaigns
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Campaign Name</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Recipients</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--muted-foreground)' }}>
                      No campaigns found.
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map(c => (
                    <tr 
                      key={c.id}
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                    >
                      <td>{c.id}</td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.owner_email}</td>
                      <td>
                        <span className={`badge badge-${c.status}`}>{c.status}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="tab-badge" style={{ padding: '3px 9px', fontSize: '0.74rem' }}>
                          {c.recipient_count}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted-foreground)' }} title={c.created_at ? new Date(c.created_at).toLocaleString() : ''}>
                        {formatRelativeTime(c.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: '780px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h3 className="section-title" style={{ marginBottom: '6px' }}>Global Plan Limits</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
              Configure maximum quota allocations per user plan tier. Updates are applied in real-time.
            </p>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="plan-limits-grid" style={{ marginBottom: '28px' }}>
              {/* Trial Card */}
              <div className="plan-card">
                <div className="plan-card-header trial">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  Trial Tier
                </div>
                <div className="plan-card-body">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Max SMTP Accounts</label>
                    <input
                      type="number"
                      className="form-control"
                      value={trialMaxSmtp}
                      onChange={e => setTrialMaxSmtp(e.target.value)}
                      required
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum Gmail sender configurations allowed.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Max Campaigns</label>
                    <input
                      type="number"
                      className="form-control"
                      value={trialMaxCampaigns}
                      onChange={e => setTrialMaxCampaigns(e.target.value)}
                      required
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum marketing/outreach campaigns creation limit.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Add Quota</label>
                    <input
                      type="number"
                      className="form-control"
                      value={trialQuotaAdd}
                      onChange={e => setTrialQuotaAdd(e.target.value)}
                      required
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum new campaigns allowed to create.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Edit Quota</label>
                    <input
                      type="number"
                      className="form-control"
                      value={trialQuotaEdit}
                      onChange={e => setTrialQuotaEdit(e.target.value)}
                      required
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum campaign detail views allowed.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Delete Quota</label>
                    <input
                      type="number"
                      className="form-control"
                      value={trialQuotaDelete}
                      onChange={e => setTrialQuotaDelete(e.target.value)}
                      required
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum campaign deletions allowed.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Save Changes Quota</label>
                    <input
                      type="number"
                      className="form-control"
                      value={trialQuotaSave}
                      onChange={e => setTrialQuotaSave(e.target.value)}
                      required
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum times changes can be saved.</span>
                  </div>
                </div>
              </div>

              {/* Pro Card */}
              <div className="plan-card">
                <div className="plan-card-header pro">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  Pro Tier
                </div>
                <div className="plan-card-body">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Max SMTP Accounts</label>
                    <input
                      type="number"
                      className="form-control"
                      value={proMaxSmtp}
                      onChange={e => setProMaxSmtp(e.target.value)}
                      required
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Allows multiple active sender profiles for rotation.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Max Campaigns</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={proMaxCampaigns === 999999}
                          onChange={e => {
                            if (e.target.checked) {
                              setProMaxCampaigns(999999);
                            } else {
                              setProMaxCampaigns(10);
                            }
                          }}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--accent-primary)', margin: 0 }}
                        />
                        Unlimited
                      </label>
                    </div>
                    <input
                      type="number"
                      className="form-control"
                      value={proMaxCampaigns === 999999 ? '' : proMaxCampaigns}
                      onChange={e => setProMaxCampaigns(e.target.value === '' ? '' : parseInt(e.target.value))}
                      required={proMaxCampaigns !== 999999}
                      disabled={proMaxCampaigns === 999999}
                      placeholder={proMaxCampaigns === 999999 ? 'Unlimited' : ''}
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum marketing/outreach campaigns creation limit.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Add Quota</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={proQuotaAdd === 999999}
                          onChange={e => {
                            if (e.target.checked) {
                              setProQuotaAdd(999999);
                            } else {
                              setProQuotaAdd(5);
                            }
                          }}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--accent-primary)', margin: 0 }}
                        />
                        Unlimited
                      </label>
                    </div>
                    <input
                      type="number"
                      className="form-control"
                      value={proQuotaAdd === 999999 ? '' : proQuotaAdd}
                      onChange={e => setProQuotaAdd(e.target.value === '' ? '' : parseInt(e.target.value))}
                      required={proQuotaAdd !== 999999}
                      disabled={proQuotaAdd === 999999}
                      placeholder={proQuotaAdd === 999999 ? 'Unlimited' : ''}
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum new campaigns allowed to create.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Edit Quota</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={proQuotaEdit === 999999}
                          onChange={e => {
                            if (e.target.checked) {
                              setProQuotaEdit(999999);
                            } else {
                              setProQuotaEdit(10);
                            }
                          }}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--accent-primary)', margin: 0 }}
                        />
                        Unlimited
                      </label>
                    </div>
                    <input
                      type="number"
                      className="form-control"
                      value={proQuotaEdit === 999999 ? '' : proQuotaEdit}
                      onChange={e => setProQuotaEdit(e.target.value === '' ? '' : parseInt(e.target.value))}
                      required={proQuotaEdit !== 999999}
                      disabled={proQuotaEdit === 999999}
                      placeholder={proQuotaEdit === 999999 ? 'Unlimited' : ''}
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum campaign detail views allowed.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Delete Quota</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={proQuotaDelete === 999999}
                          onChange={e => {
                            if (e.target.checked) {
                              setProQuotaDelete(999999);
                            } else {
                              setProQuotaDelete(5);
                            }
                          }}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--accent-primary)', margin: 0 }}
                        />
                        Unlimited
                      </label>
                    </div>
                    <input
                      type="number"
                      className="form-control"
                      value={proQuotaDelete === 999999 ? '' : proQuotaDelete}
                      onChange={e => setProQuotaDelete(e.target.value === '' ? '' : parseInt(e.target.value))}
                      required={proQuotaDelete !== 999999}
                      disabled={proQuotaDelete === 999999}
                      placeholder={proQuotaDelete === 999999 ? 'Unlimited' : ''}
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum campaign deletions allowed.</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Save Changes Quota</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={proQuotaSave === 999999}
                          onChange={e => {
                            if (e.target.checked) {
                              setProQuotaSave(999999);
                            } else {
                              setProQuotaSave(10);
                            }
                          }}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--accent-primary)', margin: 0 }}
                        />
                        Unlimited
                      </label>
                    </div>
                    <input
                      type="number"
                      className="form-control"
                      value={proQuotaSave === 999999 ? '' : proQuotaSave}
                      onChange={e => setProQuotaSave(e.target.value === '' ? '' : parseInt(e.target.value))}
                      required={proQuotaSave !== 999999}
                      disabled={proQuotaSave === 999999}
                      placeholder={proQuotaSave === 999999 ? 'Unlimited' : ''}
                      min="0"
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>Maximum times changes can be saved.</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              position: 'sticky',
              bottom: '0',
              background: 'var(--bg-page)',
              padding: '16px 0',
              borderTop: '1px solid var(--border-card)',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'flex-start',
              marginTop: '28px'
            }}>
              <button type="submit" className="btn btn-primary" style={{ minWidth: '160px' }} disabled={savingSettings}>
                {savingSettings ? 'Saving Settings...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Contact Details */}
      {activeTab === 'contact' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Add / Edit Form */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 className="section-title" style={{ marginBottom: '20px' }}>
              {editingContactId ? 'Edit Contact Detail' : 'Add Contact Detail'}
            </h2>

            <form onSubmit={handleSaveContact}>
              <div className="form-group">
                <label className="form-label">Contact Type</label>
                <select
                  value={contactType}
                  onChange={e => setContactType(e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="email">Email Address</option>
                  <option value="whatsapp">WhatsApp Number</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Value</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={contactType === 'email' ? 'support@company.com' : 'e.g. +15550199'}
                  value={contactValue}
                  onChange={e => setContactValue(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                  {contactType === 'email' ? 'Enter a valid email address.' : 'Enter a phone number with country code (e.g. +1...).'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Label / Department (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Billing, Tech Support"
                  value={contactLabel}
                  onChange={e => setContactLabel(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={savingContact}>
                  {savingContact ? 'Saving…' : editingContactId ? 'Update Contact' : 'Add Contact'}
                </button>
                {editingContactId && (
                  <button type="button" className="btn btn-secondary" onClick={resetContactForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List of Contacts */}
          <div className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <h2 className="section-title">Active Contacts</h2>
              <span className="badge badge-running" style={{ background: 'var(--surface-hover)', color: 'var(--primary)', borderColor: 'var(--border-subtle)' }}>
                {contacts.length} items configured
              </span>
            </div>

            {contacts.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 16px' }}>
                <div className="empty-state-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <p style={{ fontSize: '0.88rem' }}>No contact details configured yet. Add one on the left.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {contacts.map((c) => {
                  const isEmail = c.type === 'email';
                  return (
                    <div
                      key={c.id}
                      className="card"
                      style={{
                        padding: '16px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid var(--border)',
                        borderLeft: editingContactId === c.id ? '4px solid var(--primary)' : '1px solid var(--border)',
                        boxShadow: editingContactId === c.id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                        transform: editingContactId === c.id ? 'translateY(-1px)' : 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Type Icon Circle */}
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '10px',
                          background: isEmail ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'color-mix(in srgb, var(--stat-delivered) 8%, transparent)',
                          color: isEmail ? 'var(--accent-primary)' : 'var(--stat-delivered)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, padding: '10px'
                        }}>
                          {isEmail ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                              <polyline points="22,6 12,13 2,6" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.92rem', fontFamily: 'var(--font-header)', fontWeight: 700 }}>
                            {c.value}
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                            {c.label || 'No Label'} &bull; <span style={{ textTransform: 'capitalize' }}>{c.type}</span>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleEditContact(c)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderColor: 'transparent',
                            background: 'transparent',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--surface-hover)';
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Edit
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmContactDeleteId(c.id);
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
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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
      )}

      {/* Confirmation User Update Modal */}
      {pendingUserUpdate && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Change</h3>
              <button className="modal-close" onClick={() => setPendingUserUpdate(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '30px 24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.08)',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <p style={{ marginBottom: '14px', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Confirm User Update
              </p>
              <p style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                Are you sure you want to change the <strong>{pendingUserUpdate.field}</strong> of <strong>{pendingUserUpdate.email}</strong> to <strong>{pendingUserUpdate.value}</strong>?
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setPendingUserUpdate(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => {
                  handleUpdateUser(pendingUserUpdate.userId, pendingUserUpdate.payload);
                  setPendingUserUpdate(null);
                }}>
                  Confirm Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Backdrop Modal */}
      {confirmDeleteId && targetDeleteUser && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Account</h3>
              <button className="modal-close" onClick={() => setConfirmDeleteId(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '30px 24px' }}>
              {/* Warning Warning Icon */}
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
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <p style={{ marginBottom: '14px', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Delete {targetDeleteUser.email}?
              </p>
              <p style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                This will permanently erase all campaign logs, contacts list databases, SMTP connections, and user details. <strong>This action is irreversible.</strong>
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDeleteId(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={() => handleDeleteUser(confirmDeleteId)}>
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Contact Delete Modal */}
      {confirmContactDeleteId && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Contact Info</h3>
              <button className="modal-close" onClick={() => setConfirmContactDeleteId(null)}>&times;</button>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <p style={{ marginBottom: '14px', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Delete this contact detail?
              </p>
              <p style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                This contact item will be permanently removed and will no longer be displayed to users on the Contact page.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmContactDeleteId(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={() => handleDeleteContact(confirmContactDeleteId)}>
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
