import { useState, useEffect } from 'react';
import { useAuth, api } from '../App';
import { Navigate } from 'react-router-dom';

export default function OutreachAI() {
  const { user } = useAuth();

  // If trial user, block and redirect to dashboard (safety fallback)
  if (user?.plan === 'trial') {
    return <Navigate to="/" replace />;
  }

  // Form states
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientRole, setRecipientRole] = useState('');
  const [emailType, setEmailType] = useState('Cold Intro');
  const [tone, setTone] = useState('Professional');
  const [goal, setGoal] = useState('Book a call');
  const [senderName, setSenderName] = useState(user?.email?.split('@')[0] || '');
  const [extraContext, setExtraContext] = useState('');

  // UI/API states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [generatedData, setGeneratedData] = useState(null);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState(0);

  // Campaign integration states
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Fetch campaigns on mount
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await api.get('/api/campaigns');
        // Filter campaigns: status must be draft or paused
        const eligible = (res.data || []).filter(
          c => c.status === 'draft' || c.status === 'paused'
        );
        setCampaigns(eligible);
      } catch (err) {
        console.error('Failed to load campaigns:', err);
      }
    };
    fetchCampaigns();
  }, []);

  // Set page title
  useEffect(() => {
    document.title = 'Outreach AI - ColdOutreach';
  }, []);

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!recipientCompany || !recipientRole || !senderName) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setGeneratedData(null);
    setSelectedSubjectIndex(0);

    try {
      const res = await api.post('/api/ai/generate-email', {
        recipient_company: recipientCompany,
        recipient_role: recipientRole,
        email_type: emailType,
        tone: tone,
        goal: goal,
        sender_name: senderName,
        extra_context: extraContext || null
      });

      setGeneratedData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred during email generation.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseInCampaign = async () => {
    if (!selectedCampaignId || !generatedData) return;

    const campaign = campaigns.find(c => c.id === parseInt(selectedCampaignId));
    if (!campaign) return;

    setSavingCampaign(true);
    setError(null);
    setSuccess(null);

    const activeSubject = generatedData.subjects[selectedSubjectIndex];

    try {
      const fd = new FormData();
      fd.append('name', campaign.name);
      fd.append('subject_template', activeSubject);
      fd.append('body_template', generatedData.body);
      if (campaign.sender_id) {
        fd.append('sender_id', campaign.sender_id);
      }

      await api.put(`/api/campaigns/${campaign.id}`, fd);
      setSuccess(`Successfully updated campaign "${campaign.name}" with the AI template!`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update campaign template.');
    } finally {
      setSavingCampaign(false);
    }
  };

  // Check for spam words
  const checkSpam = () => {
    if (!generatedData) return [];
    const activeSubject = generatedData.subjects[selectedSubjectIndex] || '';
    const bodyText = generatedData.body || '';
    const fullText = (activeSubject + ' ' + bodyText).toLowerCase();

    const spamPhrases = [
      'free', 'guarantee', 'click here', 'buy now', 'risk-free',
      'winner', 'limited time', 'cash', 'save money', 'earn money', 'make money'
    ];

    return spamPhrases.filter(phrase => fullText.includes(phrase));
  };

  const detectedSpam = checkSpam();

  return (
    <div className="container" style={{ paddingBottom: '40px' }}>
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Outreach AI</h1>
        <p className="page-subtitle">Generate high-converting cold email copy tailored to your prospect using AI.</p>
      </header>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          <span>{success}</span>
        </div>
      )}

      <div className="campaign-workspace">
        {/* Left Column - Form */}
        <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
          <h2 className="section-title" style={{ marginBottom: '20px' }}>Email Settings</h2>
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="recipient_company">
                Prospect Company
              </label>
              <input
                id="recipient_company"
                type="text"
                className="form-control"
                placeholder="e.g. Acme Corp"
                value={recipientCompany}
                onChange={(e) => setRecipientCompany(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="recipient_role">
                Prospect Role / Job Title
              </label>
              <input
                id="recipient_role"
                type="text"
                className="form-control"
                placeholder="e.g. VP of Marketing"
                value={recipientRole}
                onChange={(e) => setRecipientRole(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email_type">Email Type</label>
              <select
                id="email_type"
                className="form-control"
                value={emailType}
                onChange={(e) => setEmailType(e.target.value)}
              >
                <option value="Cold Intro">Cold Intro</option>
                <option value="Follow-Up">Follow-Up</option>
                <option value="Break-Up">Break-Up</option>
                <option value="Re-Engagement">Re-Engagement</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="tone">Tone</label>
              <select
                id="tone"
                className="form-control"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option value="Professional">Professional</option>
                <option value="Conversational">Conversational</option>
                <option value="Direct">Direct</option>
                <option value="Friendly">Friendly</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="goal">Campaign Goal</label>
              <select
                id="goal"
                className="form-control"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                <option value="Book a call">Book a call</option>
                <option value="Get a reply">Get a reply</option>
                <option value="Drive to a link">Drive to a link</option>
                <option value="Soft introduction">Soft introduction</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="sender_name">
                Sender Name
              </label>
              <input
                id="sender_name"
                type="text"
                className="form-control"
                placeholder="e.g. John Doe"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="extra_context">Extra Context (Optional)</label>
              <textarea
                id="extra_context"
                className="form-control"
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="Add unique details, e.g. 'Met them at SaaSConf' or 'Mention our 20% discount'"
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
              />
            </div>

            <button
              id="generate_btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading ? (
                <>
                  <span className="sending-dot" />
                  Generating Copy...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                  Generate Email
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column - Output Preview */}
        <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h2 className="section-title" style={{ marginBottom: '20px' }}>Generated Outreach Copy</h2>
          
          {loading && (
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '64px 32px' }}>
              <div style={{ animation: 'pulsing 1.5s infinite alternate', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>Outreach AI is generating your email...</div>
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem', textAlign: 'center', maxWidth: '300px' }}>Writing high-converting subject lines and professional email body.</div>
            </div>
          )}

          {!loading && !generatedData && (
            <div className="empty-state" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="empty-state-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--muted)', color: 'var(--muted-foreground)', margin: '0 auto 16px auto' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
              </div>
              <h3>Ready to write</h3>
              <p style={{ maxWidth: '320px', margin: '8px auto 0' }}>Configure prospect details on the left, then click Generate to create copy instantly.</p>
            </div>
          )}

          {!loading && generatedData && (
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>Select Subject Line Option</label>
                <div className="subject-chips-container">
                  {generatedData.subjects.map((subj, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`subject-chip${selectedSubjectIndex === idx ? ' selected' : ''}`}
                      onClick={() => setSelectedSubjectIndex(idx)}
                    >
                      <input
                        type="radio"
                        className="subject-chip-radio"
                        name="ai_subject"
                        checked={selectedSubjectIndex === idx}
                        readOnly
                      />
                      <span>{subj}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>Email Body</label>
                <div className="ai-output-body" style={{ flexGrow: 1 }}>
                  {generatedData.body}
                </div>
              </div>

              {detectedSpam.length > 0 && (
                <div className="spam-warning" style={{ marginBottom: '20px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px', flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <div>
                    <strong>Spam Filter Warning:</strong> This email copy contains words that might trigger spam filters: <strong>{detectedSpam.join(', ')}</strong>. Consider revising these words.
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="campaign_select" style={{ marginBottom: '6px' }}>Sync to Campaign Template</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      id="campaign_select"
                      className="form-control"
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      style={{ flexGrow: 1 }}
                    >
                      <option value="">-- Choose a Campaign (Draft or Paused) --</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.status})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleUseInCampaign}
                      disabled={savingCampaign || !selectedCampaignId}
                      style={{ flexShrink: 0 }}
                    >
                      {savingCampaign ? 'Syncing...' : 'Use in Campaign'}
                    </button>
                  </div>
                  {campaigns.length === 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', display: 'block', marginTop: '6px' }}>
                      No eligible campaigns found. Create a campaign first or ensure its status is draft/paused.
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleGenerate()}
                    disabled={loading}
                    style={{ gap: '8px', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                    </svg>
                    Regenerate Copy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
