import { useState, useEffect } from 'react';
import { useAuth, api } from '../App';
import { Navigate } from 'react-router-dom';

const CONTEXTS = [
  {
    group: 'Professional / Career',
    items: [
      { id: 'job_seeker', label: 'Job Seeker / Internship', description: 'Cold email recruiters or hiring managers', fields: [
        { key: 'target_role', label: 'Role You\'re Targeting', placeholder: 'e.g. Software Engineer Intern', required: true },
        { key: 'target_company', label: 'Target Company', placeholder: 'e.g. Google', required: true },
        { key: 'your_background', label: 'Your Background / Skills', placeholder: 'e.g. 2nd year CS student, built 3 React projects...', type: 'textarea', required: true },
        { key: 'ask_type', label: 'What Are You Asking For?', type: 'select', options: ['Interview', 'Referral', 'Informational chat'], required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'e.g. Met them at a hackathon', required: false },
      ]},
      { id: 'freelancer_pitch', label: 'Freelancer Pitch', description: 'Pitch your skill or service to potential clients', fields: [
        { key: 'your_skill', label: 'Your Skill / Service', placeholder: 'e.g. UI/UX Design', required: true },
        { key: 'target_company', label: 'Target Company', placeholder: 'e.g. Notion', required: true },
        { key: 'target_role', label: 'Target Role', placeholder: 'e.g. Head of Product', required: true },
        { key: 'value_offer', label: 'Value You Offer', placeholder: 'e.g. Redesign their onboarding flow to cut drop-off', required: true },
        { key: 'cta', label: 'CTA', type: 'select', options: ['Book a call', 'Share my portfolio', 'Get a reply', 'Schedule a quick chat'], required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
    ]
  },
  {
    group: 'Business',
    items: [
      { id: 'b2b_sales', label: 'B2B Sales', description: 'Sell a product or service to another business', fields: [
        { key: 'your_company', label: 'Your Company', placeholder: 'e.g. Acme Inc.', required: true },
        { key: 'product', label: 'What You\'re Selling', placeholder: 'e.g. AI-powered CRM for SMBs', required: true },
        { key: 'target_company', label: 'Target Company', placeholder: 'e.g. Flipkart', required: true },
        { key: 'target_role', label: 'Target Role', placeholder: 'e.g. VP of Sales', required: true },
        { key: 'pain_point', label: 'Pain Point You Solve', placeholder: 'e.g. Sales reps spending 3hrs/day on manual data entry', required: true },
        { key: 'cta', label: 'CTA', type: 'select', options: ['Book a 15-min call', 'Request a demo', 'Get a reply', 'Schedule a meeting'], required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
      { id: 'saas_demo', label: 'SaaS / Product Demo', description: 'Get someone to try or book a demo of your software', fields: [
        { key: 'product_name', label: 'Product Name', placeholder: 'e.g. Zapier', required: true },
        { key: 'target_company', label: 'Target Company', placeholder: 'e.g. HubSpot', required: true },
        { key: 'target_role', label: 'Target Role', placeholder: 'e.g. Head of Operations', required: true },
        { key: 'key_benefit', label: 'Key Benefit for This Prospect', placeholder: 'e.g. Cut integration build time by 80%', required: true },
        { key: 'cta', label: 'CTA', type: 'select', options: ['Book a demo', 'Start a free trial', 'Get a walkthrough', 'Jump on a quick call'], required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
      { id: 'agency_outreach', label: 'Agency Outreach', description: 'Marketing, design, dev, or SEO agencies pitching services', fields: [
        { key: 'agency_name', label: 'Your Agency Name', placeholder: 'e.g. PixelForge', required: true },
        { key: 'service', label: 'Service You\'re Pitching', placeholder: 'e.g. Performance Meta Ads', required: true },
        { key: 'target_company', label: 'Target Company', placeholder: 'e.g. Nykaa', required: true },
        { key: 'target_role', label: 'Target Role', placeholder: 'e.g. CMO', required: true },
        { key: 'pain_point', label: 'Gap or Pain Point You Noticed', placeholder: 'e.g. Their ROAS dropped 40% last quarter', required: true },
        { key: 'cta', label: 'CTA', type: 'select', options: ['Book a strategy call', 'Share a free audit', 'Get a reply', 'Schedule a 20-min chat'], required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
    ]
  },
  {
    group: 'Growth / Partnerships',
    items: [
      { id: 'investor_outreach', label: 'Investor Outreach', description: 'Startup founders reaching out to VCs or angels', fields: [
        { key: 'startup_name', label: 'Startup Name', placeholder: 'e.g. Finlo', required: true },
        { key: 'sector', label: 'Sector / Industry', placeholder: 'e.g. Fintech', required: true },
        { key: 'stage', label: 'Stage', type: 'select', options: ['Pre-seed', 'Seed', 'Series A', 'Series B+'], required: true },
        { key: 'traction', label: 'Traction Highlights', placeholder: 'e.g. ₹20L ARR, 800 paying users, 3x YoY growth', type: 'textarea', required: true },
        { key: 'ask_size', label: 'Ask Size', placeholder: 'e.g. $500K', required: true },
        { key: 'why_this_investor', label: 'Why This Investor Specifically', placeholder: 'e.g. You invested in Razorpay, we\'re in the same space', required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
      { id: 'partnership', label: 'Partnership / Collaboration', description: 'Co-marketing, integration deals, brand partnerships', fields: [
        { key: 'your_company', label: 'Your Company', placeholder: 'e.g. Notion', required: true },
        { key: 'partner_company', label: 'Partner Company', placeholder: 'e.g. Loom', required: true },
        { key: 'partnership_type', label: 'Partnership Type', placeholder: 'e.g. Co-marketing, integration, bundle deal', required: true },
        { key: 'mutual_benefit', label: 'Mutual Benefit', placeholder: 'e.g. Both reach 100K+ remote-first users', required: true },
        { key: 'cta', label: 'CTA', type: 'select', options: ['Explore together on a call', 'Share a partnership brief', 'Get a reply', 'Set up an intro meeting'], required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
      { id: 'influencer_outreach', label: 'Influencer / Creator Outreach', description: 'Brands reaching out to creators for deals', fields: [
        { key: 'brand_name', label: 'Brand Name', placeholder: 'e.g. Bewakoof', required: true },
        { key: 'creator_handle', label: 'Creator Handle / Name', placeholder: 'e.g. @carryminati', required: true },
        { key: 'collaboration_type', label: 'Collaboration Type', placeholder: 'e.g. Sponsored video, affiliate deal, brand ambassador', required: true },
        { key: 'offer', label: 'What You\'re Offering', placeholder: 'e.g. ₹50K flat fee + 10% commission on sales', required: true },
        { key: 'cta', label: 'CTA', type: 'select', options: ['Get a reply if interested', 'Jump on a quick call', 'Share a media kit', 'Confirm interest'], required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
    ]
  },
  {
    group: 'Other',
    items: [
      { id: 'podcast_pitch', label: 'Podcast / Media Pitch', description: 'Pitch yourself as a guest or pitch a story', fields: [
        { key: 'show_name', label: 'Podcast / Show Name', placeholder: 'e.g. The Tim Ferriss Show', required: true },
        { key: 'episode_angle', label: 'Proposed Episode Angle', placeholder: 'e.g. Why Indian D2C brands are winning on 0 VC funding', required: true },
        { key: 'your_credentials', label: 'Your Credentials', placeholder: 'e.g. Founded 3 D2C brands, $2M revenue combined', required: true },
        { key: 'why_their_audience', label: 'Why This Fits Their Audience', placeholder: 'e.g. Your audience loves bootstrapped founder stories', required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
      { id: 'event_conference', label: 'Event / Conference', description: 'Speaker invites, sponsor outreach, attendee invites', fields: [
        { key: 'event_name', label: 'Event Name', placeholder: 'e.g. SaaStock India 2025', required: true },
        { key: 'outreach_type', label: 'Type of Outreach', type: 'select', options: ['Speaker invite', 'Sponsor pitch', 'Attendee invite', 'Partnership'], required: true },
        { key: 'target_name', label: 'Target Name / Company', placeholder: 'e.g. Kunal Shah / CRED', required: true },
        { key: 'value_to_them', label: 'Value to Them', placeholder: 'e.g. 800 founders in the room, perfect audience for your launch', required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
      { id: 'nonprofit_fundraising', label: 'Non-Profit / Fundraising', description: 'Donation asks, corporate partnership, volunteer recruitment', fields: [
        { key: 'org_name', label: 'Organisation Name', placeholder: 'e.g. Teach For India', required: true },
        { key: 'cause', label: 'Cause / Mission', placeholder: 'e.g. Quality education for underserved children', required: true },
        { key: 'target_type', label: 'Target Type', type: 'select', options: ['Individual donor', 'Corporate sponsor', 'Volunteer', 'Grant body'], required: true },
        { key: 'ask', label: 'The Specific Ask', placeholder: 'e.g. ₹1L sponsorship for 50 student kits', required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
      { id: 'real_estate', label: 'Real Estate', description: 'Agents reaching out to buyers, sellers, or landlords', fields: [
        { key: 'outreach_type', label: 'Type of Outreach', type: 'select', options: ['Buyer prospecting', 'Seller prospecting', 'Landlord outreach', 'Investor pitch'], required: true },
        { key: 'target_description', label: 'Who You\'re Reaching', placeholder: 'e.g. Homeowners in Koramangala with 2+ BHK', required: true },
        { key: 'property_or_offer', label: 'Property or Offer Details', placeholder: 'e.g. Free property valuation, or 3BHK listing at ₹1.2Cr', required: true },
        { key: 'extra_context', label: 'Extra Context', placeholder: 'Optional', required: false },
      ]},
    ]
  }
];

export default function OutreachAI() {
  const { user } = useAuth();

  // If trial user, block and redirect to dashboard (safety fallback)
  if (user?.plan === 'trial') {
    return <Navigate to="/" replace />;
  }

  // State
  const [selectedContext, setSelectedContext] = useState(null);
  const [contextData, setContextData] = useState({});
  const [senderName, setSenderName] = useState(user?.email?.split('@')[0] || '');
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
    if (!selectedContext || !senderName) {
      setError('Please select a context and fill in your name.');
      return;
    }

    const context = CONTEXTS.flatMap(g => g.items).find(c => c.id === selectedContext);
    const missing = context.fields.filter(f => f.required && f.key !== 'extra_context' && !contextData[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setGeneratedData(null);
    setSelectedSubjectIndex(0);

    try {
      const res = await api.post('/api/ai/generate-email', {
        context_type: selectedContext,
        sender_name: senderName,
        context_data: contextData,
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

          {/* Sender Name — always visible */}
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Raj"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
            />
          </div>

          {/* Context Picker */}
          {!selectedContext ? (
            <div>
              <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>
                What kind of email are you writing?
              </label>
              {CONTEXTS.map(group => (
                <div key={group.group} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                    {group.group}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {group.items.map(ctx => (
                      <button
                        key={ctx.id}
                        type="button"
                        className="btn btn-secondary"
                        style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px', height: 'auto', gap: '2px' }}
                        onClick={() => { setSelectedContext(ctx.id); setContextData({}); }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{ctx.label}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 400 }}>{ctx.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Dynamic Field Form */
            <div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginBottom: '16px', fontSize: '0.8rem', padding: '6px 12px' }}
                onClick={() => { setSelectedContext(null); setContextData({}); setGeneratedData(null); setError(null); }}
              >
                ← Change Context
              </button>

              <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'var(--muted)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                {CONTEXTS.flatMap(g => g.items).find(c => c.id === selectedContext)?.label}
              </div>

              <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {CONTEXTS.flatMap(g => g.items).find(c => c.id === selectedContext)?.fields.map(field => (
                  <div className="form-group" key={field.key}>
                    <label className="form-label">
                      {field.label}{field.required && field.key !== 'extra_context' ? ' *' : ''}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className="form-control"
                        style={{ minHeight: '72px', resize: 'vertical' }}
                        placeholder={field.placeholder}
                        value={contextData[field.key] || ''}
                        onChange={(e) => setContextData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="form-control"
                        value={contextData[field.key] || ''}
                        onChange={(e) => setContextData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      >
                        <option value="">-- Select --</option>
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control"
                        placeholder={field.placeholder}
                        value={contextData[field.key] || ''}
                        onChange={(e) => setContextData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {loading ? (
                    <><span className="sending-dot" /> Generating Copy...</>
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
          )}
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
                  {generatedData.body.split('\n\n').map((para, i) => (
                    <p key={i} style={{ marginBottom: '12px', lineHeight: '1.65', whiteSpace: 'pre-line' }}>
                      {para}
                    </p>
                  ))}
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
